# Render セットアップ手順（PlaywrightスクショAPI）

## 1. リポジトリをGitHubに置く

RenderはGitHub連携でデプロイします。リポジトリをGitHubにpushしてください。

## 2. Renderで新規Web Serviceを作成

- Dashboard → New → Web Service
- リポジトリを選択
- Root Directory: `server`
- Environment: `Docker`
- Region: 任意（日本に近いリージョン推奨）

## 3. 環境変数（任意）

- `API_KEY`: 任意の文字列
- `ALLOWED_ORIGINS`: GitHub PagesのURL（例: `https://USER.github.io/REPO`）

## 4. デプロイ

Deployを実行すると、RenderのURLが発行されます。

## 5. 動作確認

```bash
curl -X POST "https://YOUR_RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"url":"https://YOUR_GITHUB_PAGES_URL/index.html","format":"png"}' \
  --output slide.png
```

HTMLを直接送る場合：

```bash
curl -X POST "https://YOUR_RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"html":"<!doctype html>...","format":"png","selector":"#capture-root"}' \
  --output slide.png
```

PDFの場合：

```bash
curl -X POST "https://YOUR_RENDER_URL/render" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"url":"https://YOUR_GITHUB_PAGES_URL/index.html","format":"pdf"}' \
  --output slide.pdf
```
