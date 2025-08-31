// Conflict list component
import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Users, FileX, RefreshCw } from 'lucide-react';
import { getConflicts, resolveConflict } from '../services/api';

const ConflictList = ({ refreshTrigger }) => {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingConflicts, setResolvingConflicts] = useState({});

  useEffect(() => {
    fetchConflicts();
  }, [refreshTrigger]);

  const fetchConflicts = async () => {
    try {
      setLoading(true);
      setError(null);
      const conflictsData = await getConflicts();
      setConflicts(conflictsData);
    } catch (err) {
      setError('Failed to fetch conflicts: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflict = async (filename, resolution) => {
    try {
      setResolvingConflicts(prev => ({ ...prev, [filename]: true }));
      
      const result = await resolveConflict(filename, resolution);
      
      // Update local state to reflect resolution
      setConflicts(prev => 
        prev.map(conflict => 
          conflict.filename === filename 
            ? { ...conflict, resolution_status: 'resolved' }
            : conflict
        )
      );
      
      // Show success message (you might want to add a toast notification here)
      console.log('Conflict resolved:', result);
      
    } catch (err) {
      setError(`Failed to resolve conflict for ${filename}: ` + (err.response?.data?.detail || err.message));
    } finally {
      setResolvingConflicts(prev => ({ ...prev, [filename]: false }));
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getConflictTypeIcon = (type) => {
    switch (type) {
      case 'timestamp_mismatch':
        return <Clock size={16} className="text-yellow-500" />;
      case 'size_mismatch':
        return <FileX size={16} className="text-red-500" />;
      case 'checksum_mismatch':
        return <Users size={16} className="text-purple-500" />;
      default:
        return <AlertTriangle size={16} className="text-orange-500" />;
    }
  };

  const getConflictTypeDescription = (type) => {
    switch (type) {
      case 'timestamp_mismatch':
        return 'Files have different modification times';
      case 'size_mismatch':
        return 'Files have different sizes';
      case 'checksum_mismatch':
        return 'Files have different content';
      default:
        return 'Unknown conflict type';
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

  if (loading) {
    return (
      <div className="conflict-list-container">
        <h2>⚠️ Conflict Resolution</h2>
        <div className="loading-state">
          <RefreshCw className="animate-spin" size={24} />
          <p>Loading conflicts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conflict-list-container">
        <h2>⚠️ Conflict Resolution</h2>
        <div className="error-state">
          <AlertTriangle size={24} className="text-red-500" />
          <p>{error}</p>
          <button onClick={fetchConflicts} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="conflict-list-container">
        <h2>⚠️ Conflict Resolution</h2>
        <div className="no-conflicts-state">
          <CheckCircle size={48} className="text-green-500" />
          <h3>🎉 No Conflicts Found!</h3>
          <p>All files are synchronized across all storage providers.</p>
          <button onClick={fetchConflicts} className="refresh-button">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="conflict-list-container">
      <div className="conflict-header">
        <h2>⚠️ Conflict Resolution</h2>
        <p>Resolve conflicts between different storage providers</p>
        <button onClick={fetchConflicts} className="refresh-button">
          <RefreshCw size={16} />
          Refresh ({conflicts.length} conflicts)
        </button>
      </div>

      <div className="conflicts-grid">
        {conflicts.map((conflict) => (
          <div key={conflict.filename} className="conflict-card">
            <div className="conflict-card-header">
              <div className="conflict-info">
                {getConflictTypeIcon(conflict.conflict_type)}
                <div>
                  <h3>{conflict.filename}</h3>
                  <p className="conflict-type">
                    {getConflictTypeDescription(conflict.conflict_type)}
                  </p>
                </div>
              </div>
              <div className={`conflict-status ${conflict.resolution_status}`}>
                {conflict.resolution_status === 'resolved' ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <AlertTriangle size={16} className="text-orange-500" />
                )}
                {conflict.resolution_status}
              </div>
            </div>

            <div className="conflict-details">
              <p className="detected-time">
                Detected: {formatTimestamp(conflict.detected_at)}
              </p>
              
              <div className="storage-versions">
                {conflict.local_info && (
                  <div className="version-info local">
                    <h4>📁 Local Storage</h4>
                    <p>Size: {formatFileSize(conflict.local_info.size)}</p>
                    <p>Modified: {formatTimestamp(conflict.local_info.modified_time)}</p>
                  </div>
                )}
                
                {conflict.google_drive_info && (
                  <div className="version-info google">
                    <h4>🔵 Google Drive</h4>
                    <p>Size: {formatFileSize(conflict.google_drive_info.size)}</p>
                    <p>Modified: {formatTimestamp(conflict.google_drive_info.modified_time)}</p>
                  </div>
                )}
                
                {conflict.azure_blob_info && (
                  <div className="version-info azure">
                    <h4>🟦 Azure Blob</h4>
                    <p>Size: {formatFileSize(conflict.azure_blob_info.size)}</p>
                    <p>Modified: {formatTimestamp(conflict.azure_blob_info.modified_time)}</p>
                  </div>
                )}
              </div>
            </div>

            {conflict.resolution_status === 'pending' && (
              <div className="resolution-actions">
                <h4>Resolution Options:</h4>
                <div className="resolution-buttons">
                  <button
                    onClick={() => handleResolveConflict(conflict.filename, 'last-write-wins')}
                    disabled={resolvingConflicts[conflict.filename]}
                    className="resolution-button last-write"
                  >
                    {resolvingConflicts[conflict.filename] ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      <Clock size={14} />
                    )}
                    Last Write Wins
                  </button>
                  
                  <button
                    onClick={() => handleResolveConflict(conflict.filename, 'keep-both')}
                    disabled={resolvingConflicts[conflict.filename]}
                    className="resolution-button keep-both"
                  >
                    {resolvingConflicts[conflict.filename] ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      <Users size={14} />
                    )}
                    Keep Both
                  </button>
                  
                  <button
                    onClick={() => handleResolveConflict(conflict.filename, 'manual')}
                    disabled={resolvingConflicts[conflict.filename]}
                    className="resolution-button manual"
                  >
                    {resolvingConflicts[conflict.filename] ? (
                      <RefreshCw className="animate-spin" size={14} />
                    ) : (
                      <AlertTriangle size={14} />
                    )}
                    Manual Review
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="resolution-guide">
        <h3>📋 Resolution Guide</h3>
        <ul>
          <li><strong>Last Write Wins:</strong> Keep the most recently modified version</li>
          <li><strong>Keep Both:</strong> Rename files to preserve all versions</li>
          <li><strong>Manual Review:</strong> Mark for manual resolution later</li>
        </ul>
      </div>
    </div>
  );
};

export default ConflictList;