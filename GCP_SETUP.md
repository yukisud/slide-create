# GCP Cloud Run セットアップ手順（PlaywrightスクショAPI）

## 1. プロジェクト作成

```bash
gcloud projects create YOUR_PROJECT_ID
gcloud config set project YOUR_PROJECT_ID
```

## 2. 請求の紐付け

GCPコンソールでプロジェクトにBillingを紐付けてください。

## 3. API有効化

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## 4. Cloud Runへデプロイ

```bash
gcloud run deploy slide-render \
  --source server \
  --region asia-northeast1 \
  --allow-unauthenticated
```

デプロイ完了後、表示されたURLがAPIのエンドポイントです。

## 5. セキュリティ（任意）

APIキーを使う場合：

```bash
gcloud run services update slide-render \
  --region asia-northeast1 \
  --set-env-vars API_KEY=YOUR_KEY,ALLOWED_ORIGINS=https://YOUR_GITHUB_PAGES_URL
```

## 6. 動作確認

```bash
curl -X POST "https://YOUR_CLOUD_RUN_URL/render" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"url":"https://YOUR_GITHUB_PAGES_URL/index.html","format":"png"}' \
  --output slide.png
```

PDFの場合：

```bash
curl -X POST "https://YOUR_CLOUD_RUN_URL/render" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"url":"https://YOUR_GITHUB_PAGES_URL/index.html","format":"pdf"}' \
  --output slide.pdf
```
