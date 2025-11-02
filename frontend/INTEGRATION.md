# Frontend Integration Guide

## Overview

The React frontend has been updated to integrate with the new FastAPI backend. All API calls now use JWT authentication and support the full feature set including Google Drive OAuth.

## Updated API Service

The `frontend/src/services/api.js` has been completely rewritten to support:

- ✅ JWT authentication with automatic token management
- ✅ User registration and login
- ✅ Google Drive OAuth integration
- ✅ File upload with cloud sync options
- ✅ File listing, download, and deletion
- ✅ Conflict management
- ✅ Sync status polling

## Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `.env` in the frontend directory:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
```

### 3. Run Frontend

```bash
npm start
```

## Using the Updated API

### Authentication

```javascript
import { register, login, logout, isAuthenticated } from './services/api';

// Register new user
const handleRegister = async () => {
  try {
    const result = await register('user@example.com', 'password123', 'John Doe');
    console.log('Registered:', result);
    // Token is automatically stored and user is authenticated
  } catch (error) {
    console.error('Registration failed:', error.response?.data?.detail);
  }
};

// Login
const handleLogin = async () => {
  try {
    const result = await login('user@example.com', 'password123');
    console.log('Logged in:', result);
    // Token is automatically stored
  } catch (error) {
    console.error('Login failed:', error.response?.data?.detail);
  }
};

// Logout
const handleLogout = () => {
  logout();
  // Redirect to login page
};

// Check if authenticated
if (isAuthenticated()) {
  console.log('User is logged in');
}
```

### Google Drive Connection

```javascript
import { startGoogleAuth, checkGoogleStatus } from './services/api';

// Connect to Google Drive
const connectGoogleDrive = () => {
  startGoogleAuth(); // Redirects to Google OAuth
};

// After OAuth callback, check status
const checkConnection = async () => {
  try {
    const status = await checkGoogleStatus();
    console.log('Google Drive connected:', status.connected);
  } catch (error) {
    console.error('Status check failed:', error);
  }
};
```

### File Upload

```javascript
import { uploadFile, pollSyncStatus } from './services/api';

const handleFileUpload = async (file) => {
  try {
    // Upload file with sync options
    const result = await uploadFile(
      file,
      true,  // sync to Google Drive
      false, // don't sync to Azure
      (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log('Upload progress:', percentCompleted + '%');
      }
    );

    console.log('Upload started:', result);
    const { job_id, file_id, message } = result;

    // Poll for sync status
    const finalStatus = await pollSyncStatus(
      job_id,
      (status) => {
        console.log('Sync progress:', status.progress_percentage + '%');
      }
    );

    console.log('Sync completed:', finalStatus);
  } catch (error) {
    console.error('Upload failed:', error.response?.data?.detail);
  }
};
```

### File Management

```javascript
import { listFiles, getFile, downloadFile, deleteFile } from './services/api';

// List all files
const loadFiles = async () => {
  try {
    const result = await listFiles(50, 0); // limit=50, offset=0
    console.log('Files:', result.files);
    return result.files;
  } catch (error) {
    console.error('Failed to load files:', error);
  }
};

// Get file details
const getFileDetails = async (fileId) => {
  try {
    const file = await getFile(fileId);
    console.log('File details:', file);
    return file;
  } catch (error) {
    console.error('Failed to get file:', error);
  }
};

// Download file
const handleDownload = async (fileId, fromStorage = 'local') => {
  try {
    await downloadFile(fileId, fromStorage);
    // File will be downloaded automatically
  } catch (error) {
    console.error('Download failed:', error);
  }
};

// Delete file
const handleDelete = async (fileId) => {
  try {
    const result = await deleteFile(fileId, true); // also delete from cloud
    console.log('File deleted:', result);
  } catch (error) {
    console.error('Delete failed:', error);
  }
};
```

### Conflict Management

```javascript
import { getConflicts, resolveConflict } from './services/api';

// Load conflicts
const loadConflicts = async () => {
  try {
    const result = await getConflicts(false); // unresolved only
    console.log('Conflicts:', result.conflicts);
    return result.conflicts;
  } catch (error) {
    console.error('Failed to load conflicts:', error);
  }
};

// Resolve conflict
const handleResolveConflict = async (conflictId, policy) => {
  try {
    const result = await resolveConflict(
      conflictId,
      policy, // 'last-write', 'keep-both', or 'manual'
      'User resolved the conflict'
    );
    console.log('Conflict resolved:', result);
  } catch (error) {
    console.error('Failed to resolve conflict:', error);
  }
};
```

## Complete Component Example

Here's a complete example of a file upload component:

```jsx
import React, { useState, useEffect } from 'react';
import {
  uploadFile,
  pollSyncStatus,
  listFiles,
  checkGoogleStatus,
  startGoogleAuth
} from './services/api';

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('');

  // Check Google connection on mount
  useEffect(() => {
    checkConnection();
    loadFiles();
  }, []);

  const checkConnection = async () => {
    try {
      const status = await checkGoogleStatus();
      setGoogleConnected(status.connected);
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const loadFiles = async () => {
    try {
      const result = await listFiles();
      setFiles(result.files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setSyncStatus('Uploading...');

    try {
      // Upload file
      const result = await uploadFile(
        file,
        googleConnected, // sync to Google if connected
        false,
        (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percent);
        }
      );

      setSyncStatus('Syncing to cloud...');

      // Poll sync status
      await pollSyncStatus(result.job_id, (status) => {
        setSyncStatus(
          `${status.status} (${status.progress_percentage}%)`
        );
      });

      setSyncStatus('Completed!');
      
      // Reload file list
      await loadFiles();
      
    } catch (error) {
      setSyncStatus(`Error: ${error.response?.data?.detail || error.message}`);
    } finally {
      setUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setSyncStatus('');
      }, 3000);
    }
  };

  return (
    <div className="file-manager">
      <h1>Cloud File Sync</h1>

      {/* Google Drive Connection */}
      <div className="google-connection">
        {googleConnected ? (
          <p>✅ Google Drive Connected</p>
        ) : (
          <button onClick={startGoogleAuth}>
            Connect Google Drive
          </button>
        )}
      </div>

      {/* File Upload */}
      <div className="file-upload">
        <input
          type="file"
          onChange={handleFileUpload}
          disabled={uploading}
        />
        
        {uploading && (
          <div className="upload-progress">
            <progress value={uploadProgress} max="100" />
            <p>{syncStatus}</p>
          </div>
        )}
      </div>

      {/* File List */}
      <div className="file-list">
        <h2>Your Files ({files.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Status</th>
              <th>Google Drive</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>{file.original_filename}</td>
                <td>{(file.file_size / 1024).toFixed(2)} KB</td>
                <td>
                  <span className={`status ${file.overall_status}`}>
                    {file.overall_status}
                  </span>
                </td>
                <td>
                  {file.google_file_id ? '✅' : '❌'}
                </td>
                <td>
                  <button onClick={() => handleDownload(file.id)}>
                    Download
                  </button>
                  <button onClick={() => handleDelete(file.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileManager;
```

## OAuth Callback Handling

After Google OAuth, the user is redirected back to the frontend. Handle this in your app:

```jsx
// In App.js or a dedicated callback component
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const GoogleCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('user_id');
    const error = params.get('message');

    if (error) {
      console.error('Google auth failed:', error);
      alert('Failed to connect Google Drive: ' + error);
      navigate('/');
    } else if (userId) {
      console.log('Google auth successful for user:', userId);
      alert('Google Drive connected successfully!');
      navigate('/');
    }
  }, [location, navigate]);

  return <div>Processing Google authentication...</div>;
};

// Add to your routes
<Route path="/auth/google/success" element={<GoogleCallback />} />
<Route path="/auth/google/error" element={<GoogleCallback />} />
```

## Error Handling

All API functions throw errors that should be caught:

```javascript
try {
  const result = await someApiCall();
} catch (error) {
  if (error.response) {
    // Server responded with error
    console.error('Server error:', error.response.data.detail);
    alert(error.response.data.detail);
  } else if (error.request) {
    // Request made but no response
    console.error('Network error:', error.message);
    alert('Network error. Please check your connection.');
  } else {
    // Other errors
    console.error('Error:', error.message);
    alert('An error occurred: ' + error.message);
  }
}
```

## Token Management

Tokens are automatically managed:
- Stored in localStorage on login/register
- Automatically attached to all requests
- Removed on logout or 401 error
- User redirected to login on 401

## Testing

Test the integration:

1. **Start backend**: `cd backend && uvicorn app.main:app --reload`
2. **Start frontend**: `cd frontend && npm start`
3. **Register** a new user
4. **Connect Google Drive**
5. **Upload** a file
6. **Watch** the sync progress
7. **List** files and check statuses

## Troubleshooting

### CORS errors
- Check `CORS_ORIGINS` in backend `.env`
- Ensure frontend URL is included

### 401 Unauthorized
- User needs to login first
- Check if token is stored: `localStorage.getItem('access_token')`

### Upload fails
- Check file size limits in backend `.env`
- Check allowed file extensions

### Google OAuth fails
- Verify redirect URI matches backend config
- Check Google Cloud Console credentials

## Next Steps

1. ✅ Update existing components to use new API
2. ✅ Add authentication UI (login/register forms)
3. ✅ Add Google Drive connection button
4. ✅ Update FileUpload component
5. ✅ Update file list to show sync status
6. ✅ Add conflict resolution UI

See the backend README.md for full API documentation.
