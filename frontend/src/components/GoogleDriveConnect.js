// Google Drive connection component
import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle, XCircle, Loader, ExternalLink } from 'lucide-react';
import { checkGoogleStatus, startGoogleAuth } from '../services/api';

const GoogleDriveConnect = () => {
  const [connectionStatus, setConnectionStatus] = useState('checking'); // checking, connected, disconnected
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await checkGoogleStatus();
      setConnectionStatus(status.connected ? 'connected' : 'disconnected');
    } catch (err) {
      console.error('Failed to check Google Drive status:', err);
      setConnectionStatus('disconnected');
      setError('Failed to check connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    try {
      startGoogleAuth();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="google-drive-connect">
        <Loader className="animate-spin" size={20} />
        <span>Checking Google Drive connection...</span>
      </div>
    );
  }

  return (
    <div className={`google-drive-connect ${connectionStatus}`}>
      {connectionStatus === 'connected' ? (
        <>
          <CheckCircle size={20} className="text-green-500" />
          <span>Google Drive Connected</span>
        </>
      ) : (
        <>
          <XCircle size={20} className="text-red-500" />
          <span>Google Drive Not Connected</span>
          <button onClick={handleConnect} className="connect-button">
            <Cloud size={16} />
            Connect Now
          </button>
        </>
      )}
      {error && <small className="error-text">{error}</small>}
    </div>
  );
};

export default GoogleDriveConnect;
