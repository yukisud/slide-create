# Slide Exporter (Electron版)

html2canvasの制限を回避し、**100%正確なレンダリング**でスライドを書き出すデスクトップアプリ。

## セットアップ

```bash
cd electron
npm install
```

## 起動

```bash
npm start
```

## ビルド（配布用）

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## 特徴

- **Chromiumベースのレンダリング** - ブラウザと100%同じ見た目
- **ネイティブスクリーンショット** - html2canvasの問題を完全回避
- **オフライン動作** - サーバー不要
- **1クリック書き出し** - 既存UIをそのまま使用

## 仕組み

```
通常ブラウザ: html2canvas → 不正確なレンダリング → ズレる
Electron版:   Chromium → 正確なレンダリング → ネイティブキャプチャ → 完璧
```
