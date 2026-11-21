# Scene Finder の配布

[Windows版のダウンロードと使い方](https://lllm.gigach.net/)を公開しています。各バージョンのセットアップとSHA-256は[リリース一覧](https://github.com/altimix/scene-finder-downloads/releases)から取得できます。

## サイトの更新

サイトのHTMLと画像は `public/` にあります。公開前に同じバージョンのリリース資産がダウンロードできることを確認します。

Cloudflareの対象アカウントで認証した開発環境から、このリポジトリのルートで以下を実行します。公開するホスト名は `wrangler.json` に指定しています。

```sh
npx wrangler@4.163.0 deploy
```

新しい大学版を公開するときは、動作確認を終えた大学用ZIPを指定して配布メタデータを生成します。セットアップ・3個のモデルデータ・SHA-256一覧を、対応するタグのGitHub ReleaseにZIP内と同じ名前で添付してください。

```sh
python tools/prepare-campus-archive.py SceneFinder-Campus-Offline-X.Y.Z-x64.zip
```

`src/campus-archive.json` にはファイル名、各ファイルの長さ、ZIPヘッダーと全体のSHA-256が入ります。サイトはこれを使ってダウンロード時に元のZIPと同じバイト列を返します。
