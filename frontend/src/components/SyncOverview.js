// Files Manager component - Manage and view all files with sync status
import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, HardDrive, Cloud, Database, AlertTriangle, Download, Trash2, ExternalLink, Search, Filter, Eye } from 'lucide-react';
import { listFiles, deleteFile, downloadFile } from '../services/api';

const SyncOverview = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, synced, partial, local
  const [sortBy, setSortBy] = useState('date'); // date, name, size
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [deleteOptions, setDeleteOptions] = useState({
    local: true,
    google: true,
    azure: true
  });
  const [deleting, setDeleting] = useState(false);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const data = await listFiles(1000, 0); // Get up to 1000 files
      setFiles(data.files || []);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError('Failed to load files. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Auto-refresh every 5 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchFiles();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'pending':
      case 'in_progress':
        return <Clock size={16} className="text-yellow-500" />;
      case 'failed':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <AlertTriangle size={16} className="text-gray-400" />;
    }
  };

  const getSyncStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Synced';
      case 'pending':
        return 'Pending';
      case 'in_progress':
        return 'Syncing...';
      case 'failed':
        return 'Failed';
      default:
        return 'Not synced';
    }
  };

  const getSyncStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'pending':
      case 'in_progress':
        return 'status-pending';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-none';
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleDownload = async (file) => {
    try {
      // Prioritize Azure for download if available, then Google, then local
      let fromStorage = 'local';
      let storageLabel = 'Local Storage';
      
      if (file.azure_status === 'completed' && file.azure_blob_url) {
        fromStorage = 'azure';
        storageLabel = 'Azure Blob Storage';
      } else if (file.google_status === 'completed' && file.google_file_id) {
        fromStorage = 'google';
        storageLabel = 'Google Drive';
      }
      
      console.log(`Downloading ${file.original_filename} from ${storageLabel}...`);
      const result = await downloadFile(file.id, fromStorage);
      console.log('Download initiated:', result);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download file: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleOpenDeleteModal = (file) => {
    setFileToDelete(file);
    setDeleteOptions({
      local: true,
      google: file.google_status === 'completed',
      azure: file.azure_status === 'completed'
    });
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;

    try {
      setDeleting(true);
      await deleteFile(fileToDelete.id);
      
      // Remove from local state
      setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
      
      setDeleteModalOpen(false);
      setFileToDelete(null);
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete file: ' + (err.response?.data?.detail || err.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenFile = (file) => {
    // Open file in new tab if it has a URL
    if (file.google_file_id) {
      window.open(`https://drive.google.com/file/d/${file.google_file_id}/view`, '_blank');
    } else if (file.azure_blob_url) {
      window.open(file.azure_blob_url, '_blank');
    } else {
      // Download if no direct URL
      handleDownload(file);
    }
  };

  const getStorageSummary = () => {
    const summary = {
      total: files.length,
      fullySync: 0,
      partialSync: 0,
      notSynced: 0,
      localOnly: 0,
      totalSize: 0
    };

    files.forEach(file => {
      summary.totalSize += file.file_size || 0;
      const googleSynced = file.google_status === 'completed';
      const azureSynced = file.azure_status === 'completed';

      if (googleSynced && azureSynced) {
        summary.fullySync++;
      } else if (googleSynced || azureSynced) {
        summary.partialSync++;
      } else if (file.google_drive_status || file.azure_blob_status) {
        summary.notSynced++;
      } else {
        summary.localOnly++;
      }
    });

    return summary;
  };

  const getFilteredAndSortedFiles = () => {
    let filtered = files;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(file =>
        file.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(file => {
        const googleSynced = file.google_status === 'completed';
        const azureSynced = file.azure_status === 'completed';

        switch (filterStatus) {
          case 'synced':
            return googleSynced && azureSynced;
          case 'partial':
            return (googleSynced || azureSynced) && !(googleSynced && azureSynced);
          case 'local':
            return !googleSynced && !azureSynced;
          default:
            return true;
        }
      });
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.original_filename.localeCompare(b.original_filename);
        case 'size':
          return (b.file_size || 0) - (a.file_size || 0);
        case 'date':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return sorted;
  };

  const summary = getStorageSummary();
  const displayFiles = getFilteredAndSortedFiles();

  if (loading && files.length === 0) {
    return (
      <div className="sync-overview-container">
        <div className="loading-state">
          <RefreshCw className="animate-spin" size={48} />
          <p>Loading sync status...</p>
        </div>
      </div>
    );
  }

  if (error && files.length === 0) {
    return (
      <div className="sync-overview-container">
        <div className="error-state">
          <XCircle size={48} color="#dc2626" />
          <h3>Failed to Load Files</h3>
          <p>{error}</p>
          <button onClick={fetchFiles} className="refresh-button">
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sync-overview-container">
      {/* Header */}
      <div className="sync-overview-header">
        <div>
          <h2>� Files</h2>
          <p>Manage and monitor your files across all storage providers</p>
        </div>
        <div className="overview-controls">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-refresh</span>
          </label>
          <button onClick={fetchFiles} className="refresh-button" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last Update Time */}
      {lastUpdate && (
        <div className="last-update">
          <Clock size={14} />
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="files-toolbar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Files</option>
            <option value="synced">Fully Synced</option>
            <option value="partial">Partially Synced</option>
            <option value="local">Local Only</option>
          </select>
          
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="sync-summary-grid">
        <div className="summary-stat-card">
          <div className="stat-icon total">
            <Database size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{summary.total}</div>
            <div className="stat-label">Total Files</div>
          </div>
        </div>

        <div className="summary-stat-card">
          <div className="stat-icon success">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{summary.fullySync}</div>
            <div className="stat-label">Fully Synced</div>
          </div>
        </div>

        <div className="summary-stat-card">
          <div className="stat-icon warning">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{summary.partialSync}</div>
            <div className="stat-label">Partially Synced</div>
          </div>
        </div>

        <div className="summary-stat-card">
          <div className="stat-icon local">
            <HardDrive size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{formatFileSize(summary.totalSize)}</div>
            <div className="stat-label">Total Storage</div>
          </div>
        </div>
      </div>

      {/* Files List */}
      {displayFiles.length === 0 ? (
        <div className="no-files-state">
          <Database size={64} color="#d1d5db" />
          <h3>{files.length === 0 ? 'No Files Yet' : 'No files match your search'}</h3>
          <p>{files.length === 0 ? 'Upload your first file to get started' : 'Try adjusting your search or filters'}</p>
        </div>
      ) : (
        <div className="sync-files-list">
          {displayFiles.map((file) => {
            const googleSynced = file.google_status === 'completed';
            const azureSynced = file.azure_status === 'completed';
            const allSynced = googleSynced && azureSynced;

            return (
              <div key={file.id} className={`sync-file-card ${allSynced ? 'fully-synced' : ''}`}>
                {/* File Header */}
                <div className="sync-file-header">
                  <div className="file-main-info">
                    <h3>{file.original_filename}</h3>
                    <div className="file-metadata">
                      <span>{formatFileSize(file.file_size || 0)}</span>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                      <span>•</span>
                      <span>v{file.version}</span>
                    </div>
                  </div>
                  <div className="file-actions-group">
                    <div className="overall-sync-status">
                      {allSynced ? (
                        <span className="badge badge-success">
                          <CheckCircle size={14} />
                          All Synced
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <AlertTriangle size={14} />
                          Partial Sync
                        </span>
                      )}
                    </div>
                    <div className="file-action-buttons">
                      <button 
                        onClick={() => handleOpenFile(file)} 
                        className="action-btn view-btn"
                        title="Open/View file"
                      >
                        <ExternalLink size={16} />
                      </button>
                      <button 
                        onClick={() => handleDownload(file)} 
                        className="action-btn download-btn"
                        title="Download file"
                      >
                        <Download size={16} />
                      </button>
                      <button 
                        onClick={() => handleOpenDeleteModal(file)} 
                        className="action-btn delete-btn"
                        title="Delete file"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Storage Provider Status */}
                <div className="provider-sync-grid">
                  {/* Local Storage */}
                  <div className="provider-sync-card local-storage">
                    <div className="provider-sync-header">
                      <HardDrive size={18} />
                      <span>Local Storage</span>
                    </div>
                    <div className="provider-sync-status">
                      <CheckCircle size={16} className="text-green-500" />
                      <span>Stored</span>
                    </div>
                    <div className="provider-sync-details">
                      <p className="sync-time">Always available locally</p>
                    </div>
                  </div>

                  {/* Google Drive */}
                  <div className={`provider-sync-card google-drive ${getSyncStatusClass(file.google_status)}`}>
                    <div className="provider-sync-header">
                      <Cloud size={18} />
                      <span>Google Drive</span>
                    </div>
                    <div className="provider-sync-status">
                      {getSyncStatusIcon(file.google_status)}
                      <span>{getSyncStatusText(file.google_status)}</span>
                    </div>
                    {file.google_file_id && (
                      <div className="provider-sync-details">
                        <p className="sync-time">
                          File ID: {file.google_file_id.substring(0, 8)}...
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Azure Blob Storage */}
                  <div className={`provider-sync-card azure-blob ${getSyncStatusClass(file.azure_status)}`}>
                    <div className="provider-sync-header">
                      <Database size={18} />
                      <span>Azure Blob</span>
                    </div>
                    <div className="provider-sync-status">
                      {getSyncStatusIcon(file.azure_status)}
                      <span>{getSyncStatusText(file.azure_status)}</span>
                    </div>
                    {file.azure_blob_url && (
                      <div className="provider-sync-details">
                        <p className="sync-time">
                          Blob storage ready
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && fileToDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>�️ Delete File</h3>
              <button 
                onClick={() => setDeleteModalOpen(false)} 
                className="modal-close-btn"
                disabled={deleting}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <p className="modal-warning">
                <AlertTriangle size={20} />
                Are you sure you want to delete <strong>{fileToDelete.original_filename}</strong>?
              </p>
              
              <div className="delete-options">
                <h4>Delete from:</h4>
                <label className="delete-option-item">
                  <input
                    type="checkbox"
                    checked={deleteOptions.local}
                    onChange={(e) => setDeleteOptions(prev => ({ ...prev, local: e.target.checked }))}
                    disabled={deleting}
                  />
                  <HardDrive size={18} />
                  <span>Local Storage</span>
                </label>
                
                {fileToDelete.google_status === 'completed' && (
                  <label className="delete-option-item">
                    <input
                      type="checkbox"
                      checked={deleteOptions.google}
                      onChange={(e) => setDeleteOptions(prev => ({ ...prev, google: e.target.checked }))}
                      disabled={deleting}
                    />
                    <Cloud size={18} />
                    <span>Google Drive</span>
                  </label>
                )}
                
                {fileToDelete.azure_status === 'completed' && (
                  <label className="delete-option-item">
                    <input
                      type="checkbox"
                      checked={deleteOptions.azure}
                      onChange={(e) => setDeleteOptions(prev => ({ ...prev, azure: e.target.checked }))}
                      disabled={deleting}
                    />
                    <Database size={18} />
                    <span>Azure Blob Storage</span>
                  </label>
                )}
              </div>
              
              <p className="modal-note">
                💡 <strong>Note:</strong> This action cannot be undone. The file will be permanently deleted from selected storage providers.
              </p>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setDeleteModalOpen(false)} 
                className="modal-btn cancel-btn"
                disabled={deleting}
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete} 
                className="modal-btn delete-confirm-btn"
                disabled={deleting || (!deleteOptions.local && !deleteOptions.google && !deleteOptions.azure)}
              >
                {deleting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="sync-info-panel">
        <h4>📊 File Management Tips</h4>
        <ul>
          <li><ExternalLink size={14} className="inline-icon" /> <strong>Open:</strong> View file in Google Drive or download from Azure</li>
          <li><Download size={14} className="inline-icon" /> <strong>Download:</strong> Save a local copy of the file</li>
          <li><Trash2 size={14} className="inline-icon" /> <strong>Delete:</strong> Remove file from selected storage providers</li>
          <li><Search size={14} className="inline-icon" /> <strong>Search:</strong> Quickly find files by name</li>
          <li><Filter size={14} className="inline-icon" /> <strong>Filter:</strong> View files by sync status (all, synced, partial, local only)</li>
        </ul>
      </div>
    </div>
  );
};

export default SyncOverview;
