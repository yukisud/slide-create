@echo off
setlocal
set PORT=8010
cd /d %~dp0

start "" http://localhost:%PORT%/index.html
where py >nul 2>nul
if %errorlevel%==0 (
  echo Starting local server with py...
  py -m http.server %PORT%
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Starting local server with python...
  python -m http.server %PORT%
  goto :eof
)

echo Pythonが見つかりません。https://www.python.org/ からインストールしてください。
pause
