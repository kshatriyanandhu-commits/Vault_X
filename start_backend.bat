@echo off
echo ===================================================
echo Starting Argus Vault Django Backend on port 8000...
echo ===================================================
cd /d "%~dp0backend"
if not exist "venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv venv
    venv\Scripts\pip.exe install -r requirements.txt
    venv\Scripts\python.exe manage.py migrate
    venv\Scripts\python.exe manage.py createsuperadmin
)
venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
