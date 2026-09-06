@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer from https://nodejs.org and run this again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0])>=24?0:1)"
if errorlevel 1 (
  echo Avalon requires Node.js 24 or newer.
  pause
  exit /b 1
)
set "AVALON_PLATFORM="
if exist "node_modules\.avalon-platform" set /p AVALON_PLATFORM=<"node_modules\.avalon-platform"
if not "%AVALON_PLATFORM%"=="win32" (
  echo Preparing Avalon for Windows. This only takes a moment on future launches.
  call npm ci
  if errorlevel 1 goto failure
  >"node_modules\.avalon-platform" echo win32
)
echo Building your round table...
call npm run build
if errorlevel 1 goto failure
echo.
echo Avalon is opening at http://localhost:4173
echo Keep this window open while playing. Press Ctrl+C to stop.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:4173'"
call npm start
exit /b %errorlevel%
:failure
echo.
echo Avalon could not start. The error is shown above.
pause
exit /b 1
