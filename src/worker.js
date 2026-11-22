import currentArchive from "./campus-archive.json";
import archive030 from "./campus-archive-0.3.0.json";
import archive031 from "./campus-archive-0.3.1.json";
import archive032 from "./campus-archive-0.3.2.json";
import archive033 from "./campus-archive-0.3.3.json";
import archive034 from "./campus-archive-0.3.4.json";
import archive035 from "./campus-archive-0.3.5.json";

const releases = "https://github.com/altimix/scene-finder-downloads/releases/download/";
const archives = new Map([archive030, archive031, archive032, archive033, archive034, archive035, currentArchive].map(archive => ["/downloads/" + archive.name, archive]));

function windowFor(range, length) {
  if (!range) return [0, length - 1];
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= length) return null;
  return [start, end];
}

// ZIP_STORED media already lives in the release. Keep only the ZIP headers
// and central directory in this Worker, and stream each asset directly.
function partsFor(archive, start, end) {
  let offset = 0;
  const parts = [];
  for (const segment of archive.segments) {
    const last = offset + segment.size - 1;
    if (start <= last && end >= offset) {
      parts.push({segment, lo: Math.max(start - offset, 0), hi: Math.min(end, last) - offset});
    }
    offset = last + 1;
  }
  return parts;
}

async function assetBody(archive, {segment, lo, hi}, signal) {
  const partial = lo !== 0 || hi !== segment.size - 1;
  const url = releases + archive.tag + "/" + encodeURIComponent(segment.file);
  const headers = {"Accept-Encoding": "identity"};
  if (partial) headers.Range = "bytes=" + lo + "-" + hi;
  const asset = await fetch(url, {headers, signal, redirect: "follow"});
  const expectedRange = `bytes ${lo}-${hi}/${segment.size}`;
  if (!asset.body || (partial ? asset.status !== 206 || asset.headers.get("Content-Range") !== expectedRange : asset.status !== 200)) {
    await asset.body?.cancel();
    throw new Error("Release asset is unavailable");
  }
  return asset.body;
}

async function streamZip(archive, parts, writable, first, stream, signal) {
  try {
    for (const part of parts) {
      if (part.segment.file) {
        const source = part === first ? stream : await assetBody(archive, part, signal);
        await source.pipeTo(writable, {preventClose: true});
      } else {
        const bytes = Uint8Array.from(atob(part.segment.bytes), ch => ch.charCodeAt(0));
        const writer = writable.getWriter();
        try { await writer.write(bytes.subarray(part.lo, part.hi + 1)); }
        finally { writer.releaseLock(); }
      }
    }
    await writable.close();
  } catch (error) {
    await writable.abort(error).catch(() => {});
    await stream?.cancel().catch(() => {});
  }
}

export default {
  async fetch(request, env, ctx) {
    const archive = archives.get(new URL(request.url).pathname);
    if (!archive) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {status: 405, headers: {Allow: "GET, HEAD"}});
    }
    const etag = '"' + archive.sha256 + '"';
    const headers = new Headers({
      "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="' + archive.name + '"',
      "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400, no-transform",
      ETag: etag, "X-Content-Type-Options": "nosniff"
    });
    if (request.headers.get("If-None-Match") === etag) return new Response(null, {status: 304, headers});
    const ifRange = request.headers.get("If-Range");
    const range = !ifRange || ifRange === etag ? request.headers.get("Range") : null;
    const bounds = windowFor(range, archive.size);
    if (!bounds) {
      headers.set("Content-Range", "bytes */" + archive.size);
      return new Response(null, {status: 416, headers});
    }
    const [start, end] = bounds;
    const length = end - start + 1;
    headers.set("Content-Length", String(length));
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${archive.size}`);
    const init = {status: range ? 206 : 200, headers};
    if (request.method === "HEAD") return new Response(null, init);
    const parts = partsFor(archive, start, end);
    const first = parts.find(part => part.segment.file);
    let stream;
    try { if (first) stream = await assetBody(archive, first, request.signal); }
    catch { return new Response("配布ファイルに接続できません。しばらくしてから再度お試しください。", {status: 502}); }
    const body = new FixedLengthStream(length);
    ctx.waitUntil(streamZip(archive, parts, body.writable, first, stream, request.signal));
    return new Response(body.readable, init);
  }
};
