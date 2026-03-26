@echo off
echo Cerrando procesos en el puerto 3000...

for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Puerto 3000 liberado.
echo.
echo Iniciando Dungeon Crawler...
npm run dev

pause
