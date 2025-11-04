# Quick Start Guide - Cloud Storage Sync Tool

## Backend Setup (5 minutes)

### 1. Install Dependencies

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Install packages
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

Generate secure keys:

```python
# Run in Python
import secrets
print("SECRET_KEY:", secrets.token_urlsafe(32))

from cryptography.fernet import Fernet
print("TOKEN_ENCRYPTION_KEY:", Fernet.generate_key().decode())
```

Update `.env` with:
- `SECRET_KEY` and `TOKEN_ENCRYPTION_KEY` (generated above)
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (from Google Cloud Console)

### 3. Run Backend

```bash
# Simple SQLite mode (for testing)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or with Docker:

```bash
docker-compose up --build
```

Backend will be available at: http://localhost:8000

**API Docs**: http://localhost:8000/docs

## Frontend Setup (2 minutes)

### 1. Install Dependencies

```bash
cd frontend
npm install axios
```

### 2. Update API Configuration

Create `frontend/src/config.js`:

```javascript
export const API_BASE_URL = 'http://localhost:8000';
```

### 3. Run Frontend

```bash
npm start
```

Frontend will be available at: http://localhost:3000

## Quick Test Flow

1. **Register**: Go to http://localhost:3000 and register a new account
2. **Connect Google Drive**: Click "Connect Google Drive" button
3. **Upload File**: Select a file and click upload
4. **Watch Sync**: See the file sync to local storage and Google Drive
5. **View Files**: See your uploaded files in the file list

## Testing with cURL

```bash
# 1. Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","full_name":"Test"}'

# Save the access_token from response

# 2. Upload file
curl -X POST http://localhost:8000/api/v1/upload \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@test.pdf" \
  -F "sync_google=true"

# Save the job_id from response

# 3. Check status
curl http://localhost:8000/api/v1/status/JOB_ID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Common Issues

### "Module not found" errors
```bash
pip install -r requirements.txt
```

### "Connection refused" when uploading
Make sure backend is running on port 8000

### Google OAuth fails
- Check redirect URI: http://localhost:8000/auth/google/callback
- Enable Google Drive API in Console
- Check client ID/secret in .env

## Need Help?

- Check backend logs: `docker-compose logs -f backend`
- Visit API docs: http://localhost:8000/docs
- Review README.md for detailed documentation
