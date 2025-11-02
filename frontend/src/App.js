import React, { useState, useEffect } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import ConflictList from './components/ConflictList';
import SyncOverview from './components/SyncOverview';
import Navigation from './components/Navigation';
import Auth from './components/Auth';
import GoogleDriveConnect from './components/GoogleDriveConnect';
import { healthCheck, isAuthenticated, logout } from './services/api';

function App() {
  const [currentView, setCurrentView] = useState('upload');
  const [apiStatus, setApiStatus] = useState('checking');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  // Check API health on component mount
  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    try {
      await healthCheck();
      setApiStatus('connected');
    } catch (error) {
      setApiStatus('disconnected');
      console.error('API health check failed:', error);
    }
  };

  const handleUploadSuccess = () => {
    // Trigger refresh of other components
    setRefreshTrigger(prev => prev + 1);
  };

  const handleAuthSuccess = (result) => {
    setAuthenticated(true);
    console.log('Authentication successful:', result);
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setCurrentView('upload');
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'upload':
        return <FileUpload onUploadSuccess={handleUploadSuccess} />;
      case 'overview':
        return <SyncOverview refreshTrigger={refreshTrigger} />;
      case 'conflicts':
        return <ConflictList refreshTrigger={refreshTrigger} />;
      default:
        return <FileUpload onUploadSuccess={handleUploadSuccess} />;
    }
  };

  // Show auth screen if not authenticated
  if (!authenticated) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🔄 Cloud Storage Sync Tool</h1>
          <div className={`api-status ${apiStatus}`}>
            <span className="status-dot"></span>
            API Status: {apiStatus === 'checking' ? 'Checking...' : 
                        apiStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </div>
        </header>
        <main className="App-main">
          {apiStatus === 'disconnected' ? (
            <div className="error-message">
              <h2>⚠️ API Connection Failed</h2>
              <p>Unable to connect to the backend API. Please ensure:</p>
              <ul>
                <li>The FastAPI server is running on http://localhost:8000</li>
                <li>Your network connection is stable</li>
                <li>CORS is properly configured</li>
              </ul>
              <button onClick={checkApiHealth} className="retry-button">
                Retry Connection
              </button>
            </div>
          ) : (
            <Auth onAuthSuccess={handleAuthSuccess} />
          )}
        </main>
        <footer className="App-footer">
          <p>Multi-cloud storage synchronization with conflict resolution</p>
          <div className="storage-providers">
            <span className="provider local">Local Storage</span>
            <span className="provider google">Google Drive</span>
            <span className="provider azure">Azure Blob</span>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-left">
          <h1>🔄 Cloud Storage Sync Tool</h1>
          <GoogleDriveConnect />
        </div>
        <div className="header-right">
          <div className={`api-status ${apiStatus}`}>
            <span className="status-dot"></span>
            API Status: {apiStatus === 'checking' ? 'Checking...' : 
                        apiStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </div>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <Navigation 
        currentView={currentView} 
        onViewChange={setCurrentView}
        apiStatus={apiStatus}
      />

      <main className="App-main">
        {apiStatus === 'disconnected' ? (
          <div className="error-message">
            <h2>⚠️ API Connection Failed</h2>
            <p>Unable to connect to the backend API. Please ensure:</p>
            <ul>
              <li>The FastAPI server is running on http://localhost:8000</li>
              <li>Your network connection is stable</li>
              <li>CORS is properly configured</li>
            </ul>
            <button onClick={checkApiHealth} className="retry-button">
              Retry Connection
            </button>
          </div>
        ) : (
          renderCurrentView()
        )}
      </main>

      <footer className="App-footer">
        <p>Multi-cloud storage synchronization with conflict resolution</p>
        <div className="storage-providers">
          <span className="provider local">Local Storage</span>
          <span className="provider google">Google Drive</span>
          <span className="provider azure">Azure Blob</span>
        </div>
      </footer>
    </div>
  );
}

export default App;