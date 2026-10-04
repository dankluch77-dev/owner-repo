@echo off
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Не найден Node.js.
  echo Скачай и установи версию LTS с https://nodejs.org , потом запусти этот файл снова.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Первый запуск: скачиваю Electron, это займёт минуту-две...
  call npm install
  if errorlevel 1 (
    echo.
    echo Установка не удалась. Проверь интернет и запусти файл ещё раз.
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" "."
