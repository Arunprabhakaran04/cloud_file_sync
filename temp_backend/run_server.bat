@echo off
echo Starting File Manager Cloud Temporary Backend...
cd %~dp0
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
