# AI秘書 仕様書

## 概要

LINEから指示するとClaudeが動いてカレンダー管理・天気通知・ニュース配信などを行う個人AI秘書LINEボット。

## 技術スタック

| レイヤー        | 技術                                             |
| --------------- | ------------------------------------------------ |
| Webhookサーバー | Hono + Cloudflare Workers (TypeScript)           |
| AI処理          | Claude API（claude-opus-4-5 / claude-haiku-4-5） |
| カレンダー      | Google Calendar API（仕事用・プライベート用）    |
| LINE連携        | LINE Messaging API                               |
| 天気            | Open-Meteo API（無料・登録不要）                 |
| ニュース        | Hacker News API / Google News RSS                |
| 定期実行        | Cloudflare Workers Cron Trigger                  |
| データ保存      | Cloudflare KV（会話履歴・位置情報）              |

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

KVネームスペース: `CHAT_HISTORY`（会話履歴・位置情報の保存用）

## 機能一覧

### 1. 予定登録

- LINEで自然言語で指示（例：「来週月曜14時に歯医者」）
- Claudeが日時・タイトルを解析
- キーワードで登録先カレンダーを自動振り分け
  - 「仕事」「MTG」「打ち合わせ」などのキーワード → **仕事用Googleカレンダー**
  - それ以外（プライベート） → **プライベート用Googleカレンダー**
- 登録完了後にどちらに入れたか明示してLINEに返信

### 2. 予定確認

- LINEで「今日の予定は？」などと聞くと返答
- 仕事用・プライベート用両方のGoogleカレンダーから取得
- Claudeが自然な文章に整形して返信

### 3. 予定検索・削除・更新

- キーワードで予定を検索（30日間）
- イベントIDを指定して削除
- タイトル・日時・色・参加者の変更が可能
- カレンダーの色指定: 青(1), 緑(2), 紫(3), 赤(4), 黄(5), オレンジ(6), 水色(7), グレー(8), 濃青(9), 濃緑(10), ピンク(11)

### 4. 天気取得

- 現在地の天気予報をOpen-Meteo APIから取得
- 気温・降水確率・天気の種類を返答

### 5. 毎朝7時の自動通知

- Cloudflare Workers Cron Triggerで毎朝7時（JST）に実行
- `crons = ["0 22 * * *"]`（UTC 22:00 = JST 07:00）
- 以下を並列取得して3通のLINEメッセージで送信:
  1. **天気 + 予定**: 天気情報 + 仕事用・プライベート用カレンダーの当日予定
  2. **AI/テックニュース**: Hacker Newsからキーワードフィルタ（AI, LLM, Claude等）で上位5件、Claude Haikuで日本語翻訳
  3. **経済ニュース**: Google News RSSから経済関連キーワード（経済, 株価, 日経, 円相場等）で上位5件

### 6. 現在地の管理

- デフォルトは**岐阜県**固定（緯度：35.3912、経度：136.7223）
- 「今日は東京にいる」「大阪に移動した」などとLINEで送ると切り替え
- 切り替えはその日限り（KVのTTLで23:59:59 JSTに自動失効）

### 7. 会話履歴

- ユーザーごとにKVに保存（最大10メッセージ、24時間TTL）
- 文脈を踏まえた自然な会話が可能

## Claudeツール定義

| ツール名                        | 機能           |
| ------------------------------- | -------------- |
| `add_google_calendar_event`     | 予定登録       |
| `get_today_events`              | 今日の予定取得 |
| `search_google_calendar_events` | 予定検索       |
| `delete_google_calendar_event`  | 予定削除       |
| `update_google_calendar_event`  | 予定更新       |
| `set_location`                  | 現在地設定     |
| `get_weather`                   | 天気取得       |

## ファイル構成

```
ai-secretary/
├── src/
│   ├── index.ts             # Honoサーバー、Webhookエンドポイント、Cronハンドラ
│   ├── claude.ts            # Claude API連携、ツール定義・実行、システムプロンプト
│   ├── cron.ts              # 毎朝通知ロジック（天気・予定・ニュース）
│   ├── google-calendar.ts   # Google Calendar API操作（OAuth2認証含む）
│   ├── line.ts              # LINE Messaging API（reply / push）
│   ├── news.ts              # ニュース取得（Hacker News / Google News RSS）
│   ├── weather.ts           # Open-Meteo API天気取得
│   └── types.ts             # 型定義（Bindings等）
├── .dev.vars                # ローカル環境変数（gitignore済み）
├── .gitignore
├── wrangler.jsonc           # Cloudflare Workers設定
├── tsconfig.json
├── package.json
└── CLAUDE.md                # この仕様書
```

## 注意事項

- `.dev.vars` は絶対にGitにコミットしない
- 本番の環境変数は `npx wrangler secret put KEY_NAME` で登録
- タイムゾーンは常に `Asia/Tokyo` を明示する
- 外部API呼び出しは可能な限り並列（Promise.all）で実行する
- Claudeのモデル: チャットは `claude-opus-4-5`、ニュース翻訳は `claude-haiku-4-5-20251001`
