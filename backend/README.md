# Cloud Storage Sync Tool - Backend

FastAPI backend for synchronizing files across local storage, Google Drive, and Azure Blob Storage.

## Features

- ✅ File upload with multipart/form-data support
- ✅ Local file storage
- ✅ Google Drive integration with OAuth2 (per-user)
- ✅ Azure Blob Storage integration (prepared for use)
- ✅ Background sync with retry logic
- ✅ Conflict detection and resolution
- ✅ File versioning and metadata tracking
- ✅ JWT-based authentication
- ✅ Async database operations with SQLModel
- ✅ Structured logging
- ✅ Docker support

## Tech Stack

- **Framework**: FastAPI + Uvicorn
- **Database**: SQLite (dev) / PostgreSQL (production)
- **ORM**: SQLModel + Alembic
- **Storage**: 
  - Local filesystem
  - Google Drive (google-api-python-client)
  - Azure Blob Storage (azure-storage-blob)
- **Authentication**: JWT + OAuth2 (Google)
- **Background Tasks**: FastAPI BackgroundTasks

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py      # Authentication endpoints
│   │       ├── uploads.py   # File upload endpoints
│   │       ├── files.py     # File management endpoints
│   │       └── conflicts.py # Conflict resolution endpoints
│   ├── core/
│   │   ├── config.py        # Configuration settings
│   │   ├── security.py      # Security utilities (JWT, encryption)
│   │   └── logger.py        # Structured logging
│   ├── db/
│   │   ├── models.py        # SQLModel database models
│   │   ├── crud.py          # Database CRUD operations
│   │   └── session.py       # Database session management
│   ├── services/
│   │   └── storage/
│   │       ├── local_storage.py    # Local file operations
│   │       ├── google_drive.py     # Google Drive adapter
│   │       ├── azure_blob.py       # Azure Blob adapter
│   │       └── sync_manager.py     # Sync orchestration
│   └── auth/
│       └── google_oauth.py  # Google OAuth2 handler
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Setup Instructions

### Prerequisites

- Python 3.11+
- Docker & Docker Compose (optional)
- Google Cloud Console project with OAuth2 credentials
- Azure Storage Account (optional, for Azure integration)

### 1. Clone and Install

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

**Required Environment Variables:**

```env
# Security (Generate secure random strings)
SECRET_KEY=your-secret-key-min-32-chars-change-in-production
TOKEN_ENCRYPTION_KEY=your-token-encryption-key-32-chars-for-fernet

# Google OAuth2 (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback

# Azure (Optional - for Azure Blob Storage)
AZURE_STORAGE_CONNECTION_STRING=your-azure-connection-string

# Frontend URL
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

#### Generate Secure Keys:

```python
# SECRET_KEY
import secrets
print(secrets.token_urlsafe(32))

# TOKEN_ENCRYPTION_KEY (must be exactly 32 characters)
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

### 3. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Drive API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: `http://localhost:8000/auth/google/callback`
7. Copy Client ID and Client Secret to `.env`

### 4. Run the Application

#### Option A: Local Development (SQLite)

```bash
# Run with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Option B: Docker Compose (PostgreSQL)

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### 5. Access the API

- **API Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login with email/password |
| GET | `/auth/google/start?user_id={id}` | Start Google OAuth flow |
| GET | `/auth/google/callback` | Google OAuth callback |
| GET | `/auth/google/status/{user_id}` | Check Google connection status |

### File Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/upload` | Upload file and sync to cloud |
| GET | `/api/v1/status/{job_id}` | Get sync job status |

### File Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/files` | List user's files |
| GET | `/api/v1/files/{file_id}` | Get file info or download |
| DELETE | `/api/v1/files/{file_id}` | Delete file |

### Conflicts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/conflicts` | List conflicts |
| GET | `/api/v1/conflicts/{id}` | Get conflict details |
| POST | `/api/v1/conflicts/{id}/resolve` | Resolve conflict |

## Frontend Integration Guide

### 1. Authentication Flow

```javascript
// Register user
const registerResponse = await axios.post('http://localhost:8000/auth/register', {
  email: 'user@example.com',
  password: 'securepassword',
  full_name: 'John Doe'
});

const { access_token, user_id } = registerResponse.data;

// Store token
localStorage.setItem('access_token', access_token);
localStorage.setItem('user_id', user_id);

// Login user
const loginResponse = await axios.post('http://localhost:8000/auth/login', {
  email: 'user@example.com',
  password: 'securepassword'
});

const { access_token, user_id } = loginResponse.data;
```

### 2. Connect Google Drive

```javascript
// Redirect user to Google OAuth
const userId = localStorage.getItem('user_id');
window.location.href = `http://localhost:8000/auth/google/start?user_id=${userId}`;

// After redirect back to frontend (e.g., /auth/google/success?user_id=1)
// Check connection status
const statusResponse = await axios.get(
  `http://localhost:8000/auth/google/status/${userId}`
);

if (statusResponse.data.connected) {
  console.log('Google Drive connected!');
}
```

### 3. Upload File

```javascript
import axios from 'axios';

const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sync_google', 'true');
  formData.append('sync_azure', 'false');

  const token = localStorage.getItem('access_token');

  try {
    const response = await axios.post(
      'http://localhost:8000/api/v1/upload',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    const { job_id, file_id, filename, message } = response.data;
    console.log('Upload started:', message);
    
    // Poll for status
    pollJobStatus(job_id);
    
    return response.data;
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  }
};

// Poll job status
const pollJobStatus = async (jobId) => {
  const token = localStorage.getItem('access_token');
  
  const interval = setInterval(async () => {
    try {
      const response = await axios.get(
        `http://localhost:8000/api/v1/status/${jobId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const { status, progress_percentage, error_message } = response.data;
      
      console.log(`Sync status: ${status} - ${progress_percentage}%`);

      if (status === 'completed' || status === 'failed') {
        clearInterval(interval);
        
        if (status === 'failed') {
          console.error('Sync failed:', error_message);
        } else {
          console.log('Sync completed successfully!');
        }
      }
    } catch (error) {
      console.error('Status check failed:', error);
      clearInterval(interval);
    }
  }, 2000); // Poll every 2 seconds
};
```

### 4. List Files

```javascript
const listFiles = async () => {
  const token = localStorage.getItem('access_token');

  const response = await axios.get(
    'http://localhost:8000/api/v1/files?limit=50&offset=0',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  return response.data.files;
};
```

### 5. Download File

```javascript
const downloadFile = async (fileId, fromStorage = 'local') => {
  const token = localStorage.getItem('access_token');

  const response = await axios.get(
    `http://localhost:8000/api/v1/files/${fileId}?download=true&from_storage=${fromStorage}`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
      responseType: fromStorage === 'local' ? 'blob' : 'json'
    }
  );

  if (fromStorage === 'local') {
    // Create download link for blob
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'filename.ext');
    document.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    // Open cloud download URL
    window.open(response.data.download_url, '_blank');
  }
};
```

### 6. Handle Conflicts

```javascript
const listConflicts = async () => {
  const token = localStorage.getItem('access_token');

  const response = await axios.get(
    'http://localhost:8000/api/v1/conflicts?resolved=false',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  return response.data.conflicts;
};

const resolveConflict = async (conflictId, policy) => {
  const token = localStorage.getItem('access_token');

  const response = await axios.post(
    `http://localhost:8000/api/v1/conflicts/${conflictId}/resolve`,
    {
      policy: policy, // 'last-write', 'keep-both', or 'manual'
      notes: 'User resolved conflict'
    },
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );

  return response.data;
};
```

### 7. Complete React Example Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:8000';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setStatus('Uploading...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('sync_google', 'true');

    const token = localStorage.getItem('access_token');

    try {
      const response = await axios.post(
        `${API_URL}/api/v1/upload`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setStatus(`Upload accepted: ${response.data.message}`);
      
      // Poll for status
      pollStatus(response.data.job_id);
    } catch (error) {
      setStatus(`Error: ${error.response?.data?.detail || error.message}`);
      setUploading(false);
    }
  };

  const pollStatus = async (jobId) => {
    const token = localStorage.getItem('access_token');
    
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/v1/status/${jobId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        const { status: jobStatus, progress_percentage } = response.data;
        setStatus(`Syncing: ${jobStatus} (${progress_percentage}%)`);

        if (jobStatus === 'completed' || jobStatus === 'failed') {
          clearInterval(interval);
          setUploading(false);
          setStatus(jobStatus === 'completed' ? 'Sync completed!' : 'Sync failed');
        }
      } catch (error) {
        clearInterval(interval);
        setUploading(false);
        setStatus('Status check failed');
      }
    }, 2000);
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      {status && <p>{status}</p>}
    </div>
  );
};

export default FileUpload;
```

## CORS Configuration

The backend is configured to accept requests from the frontend. Update `CORS_ORIGINS` in `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://yourdomain.com
```

## Testing

### Manual Testing with cURL

```bash
# Register user
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","full_name":"Test User"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'

# Upload file (replace TOKEN with your JWT)
curl -X POST http://localhost:8000/api/v1/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/path/to/file.pdf" \
  -F "sync_google=true"

# List files
curl -X GET http://localhost:8000/api/v1/files \
  -H "Authorization: Bearer TOKEN"
```

### Unit Tests (TODO)

```bash
pytest tests/ -v --cov=app
```

## Deployment

### Production Checklist

- [ ] Use PostgreSQL instead of SQLite
- [ ] Set strong `SECRET_KEY` and `TOKEN_ENCRYPTION_KEY`
- [ ] Configure proper OAuth redirect URI
- [ ] Use HTTPS for all endpoints
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Use environment-specific `.env` files
- [ ] Review and restrict CORS origins

### Environment Variables for Production

```env
ENV=production
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
SECRET_KEY=<strong-random-key>
TOKEN_ENCRYPTION_KEY=<32-char-fernet-key>
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com
```

## Troubleshooting

### Issue: "Import could not be resolved" errors

These are linting errors. Install dependencies in your environment:
```bash
pip install -r requirements.txt
```

### Issue: Database connection failed

- Check DATABASE_URL in `.env`
- For Docker: ensure database service is healthy
- For local: ensure PostgreSQL is running

### Issue: Google OAuth fails

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Check redirect URI matches Google Console configuration
- Ensure Google Drive API is enabled

### Issue: Token encryption error

- Ensure `TOKEN_ENCRYPTION_KEY` is exactly 32 characters or valid Fernet key
- Generate new key with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
