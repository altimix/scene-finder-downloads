# Scene Finder の配布

[Windows版のダウンロードと使い方](https://lllm.gigach.net/)を公開しています。各バージョンのセットアップとSHA-256は[リリース一覧](https://github.com/altimix/scene-finder-downloads/releases)から取得できます。

## サイトの更新

サイトのHTMLと画像は `public/` にあります。公開前に同じバージョンのリリース資産がダウンロードできることを確認します。

Cloudflareの対象アカウントで認証した開発環境から、このリポジトリのルートで以下を実行します。公開するホスト名は `wrangler.json` に指定しています。

```sh
npx wrangler@4.163.0 deploy
```
