#!/bin/bash
set -euo pipefail

APP_PATH="/Applications/Slide Exporter.app"

if [ ! -d "$APP_PATH" ]; then
  echo "App not found: $APP_PATH"
  echo "Move the app to /Applications and try again."
  read -r -p "Press Enter to exit..."
  exit 1
fi

if ! xattr -rd com.apple.quarantine "$APP_PATH"; then
  echo "Permission required. Retrying with sudo..."
  sudo xattr -rd com.apple.quarantine "$APP_PATH"
fi

echo "Done. You can now open the app by double-clicking."
read -r -p "Press Enter to close..."
