#!/bin/bash
set -e
cd "$(dirname "$0")"

PORT=8010
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Pythonが見つかりません。https://www.python.org/ からインストールしてください。"
  read -r -p "Enterで終了します..."
  exit 1
fi

open "http://localhost:${PORT}/index.html" >/dev/null 2>&1 &
echo "ローカルサーバーを起動します: http://localhost:${PORT}"
echo "終了するには、このウィンドウを閉じてください。"
"$PY" -m http.server "$PORT"
