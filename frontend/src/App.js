import React, { useState, useEffect } from 'react';
import './App.css';
import FileUpload from './components/FileUpload';
import ConflictList from './components/ConflictList';
import SyncStatus from './components/SyncStatus';
import Navigation from './components/Navigation';
import { healthCheck } from './services/api';

function App() {
  const [currentView, setCurrentView] = useState('upload');
  const [apiStatus, setApiStatus] = useState('checking');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  const renderCurrentView = () => {
    switch (currentView) {
      case 'upload':
        return <FileUpload onUploadSuccess={handleUploadSuccess} />;
      case 'conflicts':
        return <ConflictList refreshTrigger={refreshTrigger} />;
      case 'status':
        return <SyncStatus refreshTrigger={refreshTrigger} />;
      default:
        return <FileUpload onUploadSuccess={handleUploadSuccess} />;
    }
  };

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