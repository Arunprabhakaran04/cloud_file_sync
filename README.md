# Cloud Storage Sync Tool 🚀

A full-stack application for synchronizing files across local storage, Google Drive, and Azure Blob Storage with automatic conflict detection and resolution.

## ✨ Features

- 📤 **File Upload**: Web-based file upload with progress tracking
- 💾 **Local Storage**: Fast local file storage with metadata tracking
- 🔄 **Multi-Cloud Sync**: Automatic synchronization to Google Drive and Azure Blob
- 🔐 **User Authentication**: Secure JWT-based authentication
- 🔗 **Google Drive OAuth**: Per-user Google Drive access
- ⚔️ **Conflict Detection**: Automatic conflict detection across storage backends
- 🔧 **Conflict Resolution**: Multiple resolution strategies (last-write-wins, keep-both, manual)
- 📊 **Status Tracking**: Real-time sync status and progress
- 🎯 **RESTful API**: Complete REST API with OpenAPI documentation
- 🐳 **Docker Support**: Docker and docker-compose configurations
- 📱 **React Frontend**: Modern React frontend (integrated)

## 🚀 Quick Start

### Backend Setup (5 minutes)

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python setup.py  # Generates secure keys and checks config
uvicorn app.main:app --reload
```

**Access:**
- API: http://localhost:8000
- Docs: http://localhost:8000/docs

### Frontend Setup (2 minutes)

```bash
cd frontend
npm install
npm start
```

**Access:** http://localhost:3000

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [backend/README.md](backend/README.md) | Complete backend API documentation |
| [backend/QUICKSTART.md](backend/QUICKSTART.md) | 5-minute setup guide |
| [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) | Production deployment guide |
| [frontend/INTEGRATION.md](frontend/INTEGRATION.md) | Frontend integration guide |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | Complete project summary |

## 🔧 Key Features

### Authentication
- JWT-based API authentication
- Google OAuth2 for Drive access
- Encrypted token storage

### File Management
- Upload files via REST API
- Automatic sync to Google Drive
- Optional Azure Blob sync
- Background processing with retry logic

### Conflict Resolution
- Automatic conflict detection
- Multiple resolution strategies
- Manual conflict resolution UI

## 🛠️ Tech Stack

**Backend:** FastAPI, SQLModel, PostgreSQL, Google Drive API, Azure Blob Storage
**Frontend:** React, Axios
**DevOps:** Docker, docker-compose

## 📖 API Endpoints

```bash
# Authentication
POST   /auth/register          # Register user
POST   /auth/login             # Login
GET    /auth/google/start      # Start Google OAuth
GET    /auth/google/callback   # OAuth callback

# File Operations
POST   /api/v1/upload          # Upload & sync file
GET    /api/v1/files           # List files
GET    /api/v1/files/{id}      # Get/download file
DELETE /api/v1/files/{id}      # Delete file
GET    /api/v1/status/{job_id} # Check sync status

# Conflicts
GET    /api/v1/conflicts       # List conflicts
POST   /api/v1/conflicts/{id}/resolve  # Resolve conflict
```

## 🐳 Docker Deployment

```bash
cd backend
docker-compose up --build
```

## 📝 Configuration

1. Copy `backend/.env.example` to `backend/.env`
2. Run `python backend/setup.py` to generate secure keys
3. Add Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)
4. (Optional) Add Azure Storage connection string

## ✅ Project Status

**Status:** ✅ **Complete & Production Ready**

All core features implemented:
- ✅ File upload with multipart support
- ✅ Local storage with async operations
- ✅ Google Drive OAuth integration
- ✅ Azure Blob Storage support (code complete)
- ✅ Background sync with retry logic
- ✅ Conflict detection and resolution
- ✅ JWT authentication
- ✅ Complete API documentation
- ✅ Docker support
- ✅ Frontend integration

## 🤝 Getting Help

- **Setup Issues:** Run `python backend/setup.py` for guided setup
- **API Reference:** http://localhost:8000/docs
- **Full Documentation:** See `backend/README.md`

## 📞 Support

For issues and questions:
- Check the documentation in `backend/` and `frontend/`
- Review API docs at http://localhost:8000/docs
- Open an issue on GitHub

---

**Made with ❤️ using FastAPI and React**

Start with `cd backend && python setup.py` for guided setup!
