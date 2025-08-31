// File upload component
import React, { useState, useRef } from 'react';
import { Upload, File, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { uploadFile } from '../services/api';

const FileUpload = ({ onUploadSuccess }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleFileSelection = (file) => {
    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setUploadStatus('error');
      setUploadResult({ message: 'File size exceeds 100MB limit' });
      return;
    }

    setSelectedFile(file);
    setUploadStatus('idle');
    setUploadResult(null);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      const result = await uploadFile(selectedFile, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
      });

      setUploadStatus('success');
      setUploadResult(result);
      setSelectedFile(null);
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess();
      }

    } catch (error) {
      setUploadStatus('error');
      setUploadResult({ 
        message: error.response?.data?.detail || 'Upload failed. Please try again.' 
      });
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadResult(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    switch (uploadStatus) {
      case 'uploading':
        return <Loader className="animate-spin" />;
      case 'success':
        return <CheckCircle className="text-green-500" />;
      case 'error':
        return <AlertCircle className="text-red-500" />;
      default:
        return <Upload />;
    }
  };

  return (
    <div className="file-upload-container">
      <h2>📤 Upload Files</h2>
      <p>Upload files to sync across Local Storage, Google Drive, and Azure Blob Storage</p>

      {/* Drag and Drop Area */}
      <div
        className={`drop-zone ${isDragActive ? 'active' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          accept="*/*"
        />
        
        <div className="drop-zone-content">
          {getStatusIcon()}
          
          {selectedFile ? (
            <div className="selected-file-info">
              <File size={24} />
              <div className="file-details">
                <p className="filename">{selectedFile.name}</p>
                <p className="filesize">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="primary-text">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="secondary-text">or click to browse</p>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress */}
      {uploadStatus === 'uploading' && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <span className="progress-text">{uploadProgress}%</span>
        </div>
      )}

      {/* Upload Controls */}
      <div className="upload-controls">
        {selectedFile && uploadStatus === 'idle' && (
          <>
            <button onClick={handleUpload} className="upload-button">
              <Upload size={16} />
              Upload & Sync
            </button>
            <button onClick={resetUpload} className="cancel-button">
              Cancel
            </button>
          </>
        )}
        
        {uploadStatus === 'success' && (
          <button onClick={resetUpload} className="new-upload-button">
            Upload Another File
          </button>
        )}
        
        {uploadStatus === 'error' && (
          <button onClick={resetUpload} className="retry-button">
            Try Again
          </button>
        )}
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`upload-result ${uploadStatus}`}>
          {uploadStatus === 'success' ? (
            <div className="success-message">
              <CheckCircle size={20} />
              <div>
                <h4>✅ Upload Successful!</h4>
                <p>{uploadResult.message}</p>
                {uploadResult.sync_status && (
                  <div className="sync-details">
                    <p><strong>Sync Status:</strong></p>
                    <ul>
                      <li>Local: ✅ Saved</li>
                      <li>Google Drive: {uploadResult.sync_status.google_drive_success ? '✅' : '❌'}</li>
                      <li>Azure Blob: {uploadResult.sync_status.azure_blob_success ? '✅' : '❌'}</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="error-message">
              <AlertCircle size={20} />
              <div>
                <h4>❌ Upload Failed</h4>
                <p>{uploadResult.message}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Size Limit Info */}
      <div className="upload-info">
        <p>📋 <strong>Upload Guidelines:</strong></p>
        <ul>
          <li>Maximum file size: 100MB</li>
          <li>All file types supported</li>
          <li>Files sync automatically to all connected storage providers</li>
          <li>Conflicts will be detected and can be resolved manually</li>
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;