.PHONY: dev deploy secret logs

# ローカル開発サーバー起動
dev:
	npm run dev

# 本番デプロイ
deploy:
	npx wrangler deploy

# シークレット登録（make secret KEY=ANTHROPIC_API_KEY）
secret:
	npx wrangler secret put $(KEY)

# ログ確認
logs:
	npx wrangler tail

# 型チェック
typecheck:
	npx tsc --noEmit

# シークレット一覧確認
secrets-list:
	npx wrangler secret list

# シークレット削除（make secret-delete KEY=ANTHROPIC_API_KEY）
secret-delete:
	npx wrangler secret delete $(KEY)

# フォーマット
format:
	npx prettier --write src/**/*.ts

# リント
lint:
	npx eslint src/**/*.ts

# リント修正
lint-fix:
	npx eslint src/**/*.ts --fix
