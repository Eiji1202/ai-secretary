# AI秘書

LINEから自然言語で指示すると、Claudeが動いてカレンダー管理・天気通知・ニュース配信を行う個人AI秘書LINEボットです。

## できること

- **予定管理** - 「来週月曜14時に歯医者」のように自然言語で予定の登録・検索・変更・削除
- **仕事/プライベート自動振り分け** - キーワード（MTG、打ち合わせ等）で登録先カレンダーを自動判定
- **天気確認** - 「今日の天気は？」で現在地の天気を取得
- **現在地切り替え** - 「今日は東京にいる」で天気の取得先を変更（翌日自動リセット）
- **毎朝7時の自動通知** - 天気 + 今日の予定 + AI/テックニュース + 経済ニュースをLINEに配信
- **会話の文脈理解** - 直近の会話履歴を保持し、文脈を踏まえた応答

## 技術スタック

- **ランタイム**: Cloudflare Workers + Hono
- **AI**: Claude API (claude-opus-4-5 / claude-haiku-4-5)
- **カレンダー**: Google Calendar API (OAuth2)
- **メッセージング**: LINE Messaging API
- **天気**: Open-Meteo API
- **ニュース**: Hacker News API / Google News RSS
- **ストレージ**: Cloudflare KV

## 前提条件

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare アカウント
- LINE Developers アカウント
- Google Cloud アカウント
- Anthropic API キー

## セットアップ

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd ai-secretary
npm install
```

### 2. 各種APIキーの発行

#### LINE Messaging API

1. [LINE Developers Console](https://developers.line.biz/console/) にログイン
2. 新しいプロバイダーを作成（または既存を選択）
3. **Messaging API** チャネルを作成
4. 「Messaging API設定」タブから以下を取得:
   - **チャネルシークレット** → `LINE_CHANNEL_SECRET`
   - **チャネルアクセストークン**（長期）を発行 → `LINE_CHANNEL_ACCESS_TOKEN`
5. 「チャットの基本設定」で自分のユーザーIDを確認 → `LINE_USER_ID`
6. Webhook URLはデプロイ後に設定（手順6参照）

#### Anthropic (Claude API)

1. [Anthropic Console](https://console.anthropic.com/) にログイン
2. 「API Keys」から新しいキーを作成 → `ANTHROPIC_API_KEY`

#### Google Calendar API

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」から **Google Calendar API** を有効化
3. 「APIとサービス」→「認証情報」→「OAuth 2.0 クライアントID」を作成
   - アプリケーションの種類: **ウェブアプリケーション**
   - 承認済みリダイレクトURI: `http://localhost:3000/callback`（トークン取得用）
   - **クライアントID** → `GOOGLE_CLIENT_ID`
   - **クライアントシークレット** → `GOOGLE_CLIENT_SECRET`
4. 「OAuth 同意画面」でテストユーザーに自分のGoogleアカウントを追加
5. リフレッシュトークンの取得（仕事用・プライベート用それぞれ）:

```bash
# ブラウザで以下のURLにアクセスして認可コードを取得
# <CLIENT_ID> は自分のクライアントIDに置き換え
https://accounts.google.com/o/oauth2/v2/auth?client_id=<CLIENT_ID>&redirect_uri=http://localhost:3000/callback&response_type=code&scope=https://www.googleapis.com/auth/calendar&access_type=offline&prompt=consent

# リダイレクトURLのcodeパラメータから認可コードを取得し、リフレッシュトークンを発行
curl -X POST https://oauth2.googleapis.com/token \
  -d "code=<AUTH_CODE>" \
  -d "client_id=<CLIENT_ID>" \
  -d "client_secret=<CLIENT_SECRET>" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "grant_type=authorization_code"
```

- 仕事用Googleアカウントで取得 → `GOOGLE_REFRESH_TOKEN_WORK`
- プライベート用Googleアカウントで取得 → `GOOGLE_REFRESH_TOKEN_PRIVATE`

> **Note**: 1つのGoogleアカウントで仕事もプライベートも管理する場合は、同じリフレッシュトークンを両方に設定してください。

### 3. 環境変数の設定

#### ローカル開発

プロジェクトルートに `.dev.vars` を作成:

```
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_USER_ID=your_line_user_id
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REFRESH_TOKEN_WORK=your_work_refresh_token
GOOGLE_REFRESH_TOKEN_PRIVATE=your_private_refresh_token
USER_NAME=あなたの名前
```

#### 本番環境

```bash
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_USER_ID
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REFRESH_TOKEN_WORK
npx wrangler secret put GOOGLE_REFRESH_TOKEN_PRIVATE
npx wrangler secret put USER_NAME
```

### 4. Cloudflare KVの作成

```bash
npx wrangler kv namespace create CHAT_HISTORY
```

出力されたIDを `wrangler.jsonc` の `kv_namespaces[0].id` に設定してください。

### 5. 開発・デプロイ

```bash
# ローカル開発
npm run dev

# デプロイ
npm run deploy
```

### 6. LINE Webhookの設定

デプロイ後、LINE Developers ConsoleでWebhook URLを設定:

```
https://ai-secretary.<your-subdomain>.workers.dev/webhook
```

「Webhookの利用」をオンにし、「検証」ボタンで接続を確認してください。

## ファイル構成

```
ai-secretary/
├── src/
│   ├── index.ts             # Honoサーバー、Webhookエンドポイント、Cronハンドラ
│   ├── claude.ts            # Claude API連携、ツール定義・実行
│   ├── cron.ts              # 毎朝通知ロジック（天気・予定・ニュース）
│   ├── google-calendar.ts   # Google Calendar API操作
│   ├── line.ts              # LINE Messaging API（reply / push）
│   ├── news.ts              # ニュース取得（Hacker News / Google News RSS）
│   ├── weather.ts           # Open-Meteo API天気取得
│   └── types.ts             # 型定義
├── .dev.vars                # ローカル環境変数（gitignore済み）
├── wrangler.jsonc           # Cloudflare Workers設定
├── tsconfig.json
├── package.json
└── CLAUDE.md                # 仕様書
```

## ライセンス

MIT
