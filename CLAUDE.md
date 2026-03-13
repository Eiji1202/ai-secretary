# スケジューラーくん 仕様書

## 概要

LINEから指示するとClaudeが動いてカレンダー管理・天気通知などを行う個人AI秘書LINEボット。

## 技術スタック

| レイヤー        | 技術                                    |
| --------------- | --------------------------------------- |
| Webhookサーバー | Hono + Cloudflare Workers (TypeScript)  |
| AI処理          | Claude API（claude-sonnet-4、tool_use） |
| カレンダー      | Google Calendar API / TimeTree API      |
| LINE連携        | LINE Messaging API                      |
| 天気            | Open-Meteo API（無料・登録不要）        |
| 定期実行        | Cloudflare Workers Cron Trigger         |

## 環境変数

`.dev.vars`（ローカル）および `wrangler secret`（本番）で管理。

```
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
LINE_USER_ID=
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN_WORK=
GOOGLE_REFRESH_TOKEN_PRIVATE=
USER_NAME=
```

## 機能一覧

### 1. 予定登録

- LINEで自然言語で指示（例：「来週月曜14時に歯医者」）
- Claudeが日時・タイトルを解析
- キーワードで登録先を自動振り分け
  - 「仕事」「MTG」「打ち合わせ」などのキーワード → **Googleカレンダー**
  - それ以外（プライベート） → **TimeTree**
  - 「両方に入れて」と明示した場合のみ両方登録
- 登録完了後にどちらに入れたか明示してLINEに返信

```
例）
「📅 Googleカレンダーに登録しました！
 3/17（月）14:00〜15:00 MTG」

「📅 TimeTreeに登録しました！
 3/22（土）19:00〜 ディナー」
```

### 2. 予定確認

- LINEで「今日の予定は？」などと聞くと返答
- Google Calendar APIで取得
- Claudeが自然な文章に整形して返信

### 3. 毎朝7時の自動通知

- Cloudflare Workers Cron Triggerで毎朝7時（JST）に実行
- `crons = ["0 22 * * *"]`（UTC 22:00 = JST 07:00）
- 天気情報（Open-Meteo API）を取得
- Googleカレンダーから当日の予定を取得
- **予定がある日のみ予定を表示**（予定なしの日も通知は送る）
- LINE Push Messageで送信

```
通知フォーマット例）

☀️ おはようございます！

📍 現在地：岐阜県

🌤️ 今日の天気
天気：晴れ
気温：12°C（最高16°C / 最低8°C）
降水確率：10%

📅 今日の予定
10:00〜11:00 MTG
14:00〜15:00 歯医者

---

予定なしの場合）

☀️ おはようございます！

📍 現在地：岐阜県

🌦️ 今日の天気
天気：雨のち曇り
気温：9°C（最高11°C / 最低7°C）
降水確率：80%
🌂 傘を持っていきましょう！

📅 今日の予定はありません
```

### 4. 現在地の管理

- デフォルトは**岐阜県**固定（緯度：35.3912、経度：136.7223）
- 「今日は東京にいる」「大阪に移動した」などとLINEで送ると切り替え
- 切り替えはその日限り（翌日は岐阜に戻る）※要件に応じて変更可

## ファイル構成

```
ai-secretary/
├── src/
│   └── index.ts        # メインのWorkerコード
├── .dev.vars           # ローカル環境変数（gitignore済み）
├── .gitignore
├── wrangler.toml       # Cloudflare Workers設定
├── tsconfig.json
├── package.json
└── CLAUDE.md           # この仕様書
```

## 注意事項

- `.dev.vars` は絶対にGitにコミットしない
- 本番の環境変数は `npx wrangler secret put KEY_NAME` で登録
- タイムゾーンは常に `Asia/Tokyo` を明示する
- TimeTree APIとGoogle Calendar APIは並列（Promise.all）で叩く
