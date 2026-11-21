"""Generate the download Worker's ZIP layout from the tested campus release ZIP."""

import base64
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import zipfile


def manifest(path):
    match = re.fullmatch(r"SceneFinder-Campus-Offline-(\d+\.\d+\.\d+)-x64\.zip", path.name)
    if not match:
        raise ValueError("Expected the campus distribution ZIP")
    version = match[1]
    expected = {f"SceneFinder-Campus-Setup-{version}-x64.exe", "SHA256SUMS-Campus.txt",
                *(f"SceneFinder-Campus-Gemma-{version}.part{i}.bin" for i in (1, 2, 3))}
    size = path.stat().st_size
    segments = []
    with path.open("rb") as data, zipfile.ZipFile(path) as archive:
        if len(archive.infolist()) != len(expected) or set(archive.namelist()) != expected:
            raise ValueError("Unexpected release media")

        def literal(offset, end):
            if not 0 <= end - offset <= 65536:
                raise ValueError("Unexpected ZIP metadata length")
            data.seek(offset)
            raw = data.read(end - offset)
            segments.append(dict(bytes=base64.b64encode(raw).decode("ascii"), size=len(raw)))

        end = 0
        for entry in sorted(archive.infolist(), key=lambda item: item.header_offset):
            if entry.compress_type != zipfile.ZIP_STORED or entry.flag_bits & 1:
                raise ValueError("Archive must contain unchanged release assets")
            data.seek(entry.header_offset)
            if data.read(4) != b"PK\x03\x04":
                raise ValueError("Invalid local file header")
            data.seek(entry.header_offset + 26)
            name_len, extra_len = struct.unpack("<HH", data.read(4))
            start = entry.header_offset + 30 + name_len + extra_len
            literal(end, start)
            segments.append(dict(file=entry.filename, size=entry.file_size))
            end = start + entry.file_size
        literal(end, size)
        data.seek(0)
        digest = hashlib.file_digest(data, "sha256").hexdigest()
    if sum(part["size"] for part in segments) != size:
        raise ValueError("ZIP layout does not cover whole archive")
    return dict(name=path.name, size=size, tag="v" + version, sha256=digest, segments=segments)


if __name__ == "__main__":
    output = Path(__file__).resolve().parents[1] / "src/campus-archive.json"
    output.write_text(json.dumps(manifest(Path(sys.argv[1])), indent=2) + "\n", encoding="utf-8")
