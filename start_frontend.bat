@echo off
echo ===================================================
echo Starting Argus Vault Next.js Frontend on port 8080...
echo ===================================================
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)
npm run dev
