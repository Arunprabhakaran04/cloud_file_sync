import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000, // 30 seconds timeout for file uploads
});

// Request interceptor to add authentication if needed
api.interceptors.request.use(
  (config) => {
    // Add any auth headers here if needed
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
    return Promise.reject(error);
  }
);

// File upload service
export const uploadFile = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post('/upload', formData, {
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

// List all files across all storage providers
export const listFiles = async () => {
  try {
    const response = await api.get('/files');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get conflicts
export const getConflicts = async () => {
  try {
    const response = await api.get('/conflicts');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Resolve conflict
export const resolveConflict = async (filename, resolution) => {
  try {
    const response = await api.post(`/conflicts/${encodeURIComponent(filename)}/resolve`, {}, {
      params: { resolution }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get sync status for a specific file
export const getSyncStatus = async (filename) => {
  try {
    const response = await api.get(`/sync-status/${encodeURIComponent(filename)}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Google authentication
export const initiateGoogleAuth = async () => {
  try {
    const response = await api.post('/auth/google');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Health check
export const healthCheck = async () => {
  try {
    const response = await api.get('/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export default api;