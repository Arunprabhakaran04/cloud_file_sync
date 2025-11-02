import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000, // 30 seconds timeout for file uploads
});

// Request interceptor to add authentication token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_id');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// ============= Authentication =============

// Register new user
export const register = async (email, password, fullName) => {
  try {
    const response = await api.post('/auth/register', {
      email,
      password,
      full_name: fullName
    });
    
    // Store token and user_id
    const { access_token, user_id } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user_id', user_id);
    
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Login user
export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password
    });
    
    // Store token and user_id
    const { access_token, user_id } = response.data;
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user_id', user_id);
    
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Logout user
export const logout = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_id');
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('access_token');
};

// Get current user ID
export const getCurrentUserId = () => {
  return localStorage.getItem('user_id');
};

// ============= Google Drive =============

// Start Google OAuth flow
export const startGoogleAuth = () => {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }
  window.location.href = `${api.defaults.baseURL}/auth/google/start?user_id=${userId}`;
};

// Check Google Drive connection status
export const checkGoogleStatus = async () => {
  try {
    const userId = getCurrentUserId();
    const response = await api.get(`/auth/google/status/${userId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ============= File Upload =============

// Upload file with sync options
export const uploadFile = async (file, syncGoogle = true, syncAzure = false, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sync_google', syncGoogle.toString());
  formData.append('sync_azure', syncAzure.toString());

  try {
    const response = await api.post('/api/v1/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onUploadProgress,
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get sync job status
export const getSyncStatus = async (jobId) => {
  try {
    const response = await api.get(`/api/v1/status/${jobId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Poll sync status until completion
export const pollSyncStatus = async (jobId, onProgress, intervalMs = 2000) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const status = await getSyncStatus(jobId);
        
        if (onProgress) {
          onProgress(status);
        }
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          resolve(status);
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, intervalMs);
  });
};

// ============= File Management =============

// List all files for the user
export const listFiles = async (limit = 100, offset = 0, status = null) => {
  try {
    const params = { limit, offset };
    if (status) {
      params.status = status;
    }
    
    const response = await api.get('/api/v1/files', { params });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get file details
export const getFile = async (fileId) => {
  try {
    const response = await api.get(`/api/v1/files/${fileId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Download file from storage
export const downloadFile = async (fileId, fromStorage = 'azure') => {
  try {
    // First get file metadata to get the download URL or info
    const fileResponse = await api.get(`/api/v1/files/${fileId}`);
    const fileInfo = fileResponse.data;
    
    // If downloading from Azure and URL is available, use signed URL
    if (fromStorage === 'azure' && fileInfo.azure_blob_url) {
      // Open Azure blob URL directly - it will trigger download
      window.open(fileInfo.azure_blob_url, '_blank');
      return { success: true, message: 'Download started from Azure Blob Storage' };
    }
    
    // If downloading from Google Drive
    if (fromStorage === 'google' && fileInfo.google_file_id) {
      // Open Google Drive download link
      window.open(`https://drive.google.com/uc?export=download&id=${fileInfo.google_file_id}`, '_blank');
      return { success: true, message: 'Download started from Google Drive' };
    }
    
    // Otherwise download from local storage
    const response = await api.get(`/api/v1/files/${fileId}`, {
      params: {
        download: true,
        from_storage: 'local'
      },
      responseType: 'blob'
    });
    
    // Create download link for blob
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Get filename from Content-Disposition header if available
    const contentDisposition = response.headers['content-disposition'];
    let filename = fileInfo.original_filename || 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true, message: 'Download completed' };
  } catch (error) {
    throw error;
  }
};

// Delete file
export const deleteFile = async (fileId, deleteFromCloud = true) => {
  try {
    const response = await api.delete(`/api/v1/files/${fileId}`, {
      params: { delete_from_cloud: deleteFromCloud }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ============= Conflicts =============

// Get all conflicts
export const getConflicts = async (resolved = false) => {
  try {
    const response = await api.get('/api/v1/conflicts', {
      params: { resolved }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get conflict details
export const getConflict = async (conflictId) => {
  try {
    const response = await api.get(`/api/v1/conflicts/${conflictId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Resolve conflict
export const resolveConflict = async (conflictId, policy, notes = '') => {
  try {
    const response = await api.post(`/api/v1/conflicts/${conflictId}/resolve`, {
      policy,
      notes
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ============= Health Check =============

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;