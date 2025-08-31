// Sync status component
import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, File, Cloud, HardDrive } from 'lucide-react';
import { listFiles, getSyncStatus } from '../services/api';

const SyncStatus = ({ refreshTrigger }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedFiles, setExpandedFiles] = useState({});
  const [detailedStatus, setDetailedStatus] = useState({});

  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const filesData = await listFiles();
      setFiles(filesData);
    } catch (err) {
      setError('Failed to fetch files: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedStatus = async (filename) => {
    try {
      const status = await getSyncStatus(filename);
      setDetailedStatus(prev => ({ ...prev, [filename]: status }));
    } catch (err) {
      console.error(`Failed to fetch detailed status for ${filename}:`, err);
    }
  };

  const toggleFileExpansion = async (filename) => {
    const isExpanded = expandedFiles[filename];
    setExpandedFiles(prev => ({ 
      ...prev, 
      [filename]: !isExpanded 
    }));

    // Fetch detailed status if expanding and not already fetched
    if (!isExpanded && !detailedStatus[filename]) {
      await fetchDetailedStatus(filename);
    }
  };

  const groupFilesByName = (files) => {
    const grouped = {};
    files.forEach(file => {
      if (!grouped[file.filename]) {
        grouped[file.filename] = [];
      }
      grouped[file.filename].push(file);
    });
    return grouped;
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'local':
        return <HardDrive size={16} className="text-gray-600" />;
      case 'google_drive':
        return <Cloud size={16} className="text-blue-500" />;
      case 'azure_blob':
        return <Cloud size={16} className="text-cyan-500" />;
      default:
        return <File size={16} />;
    }
  };

  const getProviderName = (provider) => {
    switch (provider) {
      case 'local':
        return 'Local Storage';
      case 'google_drive':
        return 'Google Drive';
      case 'azure_blob':
        return 'Azure Blob';
      default:
        return provider;
    }
  };

  const getSyncStatusIcon = (providers) => {
    const totalProviders = 3; // local, google_drive, azure_blob
    const syncedProviders = Object.keys(providers).length;
    
    if (syncedProviders === totalProviders) {
      return <CheckCircle size={20} className="text-green-500" />;
    } else if (syncedProviders > 1) {
      return <AlertCircle size={20} className="text-yellow-500" />;
    } else {
      return <XCircle size={20} className="text-red-500" />;
    }
  };

  const getSyncStatusText = (providers) => {
    const totalProviders = 3;
    const syncedProviders = Object.keys(providers).length;
    
    if (syncedProviders === totalProviders) {
      return 'Fully Synced';
    } else if (syncedProviders > 1) {
      return `Partially Synced (${syncedProviders}/${totalProviders})`;
    } else {
      return 'Not Synced';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="sync-status-container">
        <h2>📊 Sync Status</h2>
        <div className="loading-state">
          <RefreshCw className="animate-spin" size={24} />
          <p>Loading file sync status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sync-status-container">
        <h2>📊 Sync Status</h2>
        <div className="error-state">
          <AlertCircle size={24} className="text-red-500" />
          <p>{error}</p>
          <button onClick={fetchFiles} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const groupedFiles = groupFilesByName(files);
  const fileNames = Object.keys(groupedFiles);

  if (fileNames.length === 0) {
    return (
      <div className="sync-status-container">
        <h2>📊 Sync Status</h2>
        <div className="no-files-state">
          <File size={48} className="text-gray-400" />
          <h3>No Files Found</h3>
          <p>Upload some files to see their sync status here.</p>
          <button onClick={fetchFiles} className="refresh-button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sync-status-container">
      <div className="sync-status-header">
        <h2>📊 Sync Status</h2>
        <p>Monitor file synchronization across all storage providers</p>
        <button onClick={fetchFiles} className="refresh-button">
          <RefreshCw size={16} />
          Refresh ({fileNames.length} files)
        </button>
      </div>

      <div className="sync-summary">
        <div className="summary-card">
          <h3>📁 Total Files</h3>
          <div className="summary-value">{fileNames.length}</div>
        </div>
        <div className="summary-card">
          <h3>✅ Fully Synced</h3>
          <div className="summary-value">
            {fileNames.filter(filename => {
              const versions = groupedFiles[filename];
              const providers = {};
              versions.forEach(v => providers[v.provider] = true);
              return Object.keys(providers).length === 3;
            }).length}
          </div>
        </div>
        <div className="summary-card">
          <h3>⚠️ Partially Synced</h3>
          <div className="summary-value">
            {fileNames.filter(filename => {
              const versions = groupedFiles[filename];
              const providers = {};
              versions.forEach(v => providers[v.provider] = true);
              const syncedCount = Object.keys(providers).length;
              return syncedCount > 1 && syncedCount < 3;
            }).length}
          </div>
        </div>
        <div className="summary-card">
          <h3>❌ Not Synced</h3>
          <div className="summary-value">
            {fileNames.filter(filename => {
              const versions = groupedFiles[filename];
              const providers = {};
              versions.forEach(v => providers[v.provider] = true);
              return Object.keys(providers).length === 1;
            }).length}
          </div>
        </div>
      </div>

      <div className="files-list">
        {fileNames.map(filename => {
          const versions = groupedFiles[filename];
          const providers = {};
          versions.forEach(v => providers[v.provider] = true);
          const isExpanded = expandedFiles[filename];
          const detailed = detailedStatus[filename];

          return (
            <div key={filename} className="file-status-card">
              <div 
                className="file-status-header"
                onClick={() => toggleFileExpansion(filename)}
                style={{ cursor: 'pointer' }}
              >
                <div className="file-info">
                  <File size={20} />
                  <div>
                    <h3>{filename}</h3>
                    <p className="file-meta">
                      {versions.length} version{versions.length !== 1 ? 's' : ''} • 
                      {versions[0]?.size ? formatFileSize(versions[0].size) : 'Unknown size'}
                    </p>
                  </div>
                </div>
                
                <div className="sync-status-indicator">
                  {getSyncStatusIcon(providers)}
                  <span className="sync-status-text">
                    {getSyncStatusText(providers)}
                  </span>
                  <RefreshCw 
                    size={16} 
                    className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="file-status-details">
                  <div className="provider-status-grid">
                    {versions.map((version, index) => (
                      <div key={index} className="provider-status-card">
                        <div className="provider-header">
                          {getProviderIcon(version.provider)}
                          <h4>{getProviderName(version.provider)}</h4>
                          <CheckCircle size={14} className="text-green-500" />
                        </div>
                        <div className="provider-details">
                          <p>Size: {formatFileSize(version.size)}</p>
                          <p>Modified: {formatTimestamp(version.modified_time)}</p>
                          {version.checksum && (
                            <p className="checksum">Checksum: {version.checksum.substring(0, 8)}...</p>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Show missing providers */}
                    {!providers.local && (
                      <div className="provider-status-card missing">
                        <div className="provider-header">
                          {getProviderIcon('local')}
                          <h4>Local Storage</h4>
                          <XCircle size={14} className="text-red-500" />
                        </div>
                        <p className="missing-text">Not synced</p>
                      </div>
                    )}
                    
                    {!providers.google_drive && (
                      <div className="provider-status-card missing">
                        <div className="provider-header">
                          {getProviderIcon('google_drive')}
                          <h4>Google Drive</h4>
                          <XCircle size={14} className="text-red-500" />
                        </div>
                        <p className="missing-text">Not synced</p>
                      </div>
                    )}
                    
                    {!providers.azure_blob && (
                      <div className="provider-status-card missing">
                        <div className="provider-header">
                          {getProviderIcon('azure_blob')}
                          <h4>Azure Blob</h4>
                          <XCircle size={14} className="text-red-500" />
                        </div>
                        <p className="missing-text">Not synced</p>
                      </div>
                    )}
                  </div>

                  {detailed && (
                    <div className="detailed-status">
                      <h4>Detailed Status</h4>
                      <div className="status-details">
                        <p>Versions: {detailed.versions}</p>
                        <p>Has Conflicts: {detailed.has_conflicts ? 'Yes' : 'No'}</p>
                        {detailed.has_conflicts && (
                          <p className="conflict-warning">
                            ⚠️ This file has conflicts that need resolution
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SyncStatus;