# youtube-playlist-converter-to-iwasync

YouTubeのプレイリストを、iwaSync3・Vizvidで読み込めるJSONに変換するCloudflare Workersアプリです。

## 使い方

1. YouTubeプレイリストのURLを入力します。
2. 出力形式を「iwaSyncのみ」「Vizvidのみ」「両方」から選択します。
3. 必要なオプションを設定して「JSONを生成」を押します。

単一形式の場合はJSONをダウンロードします。「両方」の場合は、一度のプレイリスト取得で2つのJSONを生成し、画面の各リンクからダウンロードできます。

ダウンロード名の先頭には、生成時の端末の日時を `yyyymmdd_HHMM_` 形式で付けます（例: `20261014_1445_vizvid_playlist.json`）。「両方」で生成した2ファイルには同じ日時が付きます。

- iwaSync: Video / Liveモードを選択できます。既存の `{ "tracks": [...] }` 形式です。
- Vizvid: プレイリスト名、0以上のプレイヤー番号（`playerIndex`）、Quest用URLに同じYouTube URLを設定するかを選択できます。プレイヤー番号の意味はワールドのVizvid設定に合わせてください。
- Vizvidの初期値: プレイリスト名は「YouTubeプレイリスト」、`playerIndex` は `0`、`urlForQuest` は空文字です。出力は `[{ "title": "...", "entries": [...] }]` 形式です。
- 「昇順で並び替え」は取得した動画の並び順を反転します。両形式に適用されます。

## ローカル開発

Node.js 24で動作確認しています。

```sh
npm ci
npm start -- --local
npm test -- --runInBand
npx wrangler deploy --dry-run --outdir /tmp/playlist-converter-build
```

実際の変換にはYouTube Data API v3のAPIキーが必要です。ローカルではWranglerの非公開設定 `.dev.vars` に `YOUTUBE_API_KEY` を設定します。このファイルはGit管理対象外です。キーをコミットしたり、ログやチャットに貼り付けたりしないでください。本番ではCloudflare WorkerのSecretとして設定してください。

テストはYouTube APIをモックし、出力形式・オプション・ページネーション・エラー応答を検証します。実際のAPIアクセスやVRC内での読み込みは別途確認してください。
