// Navigation component
import React from 'react';
import { Upload, AlertTriangle, BarChart3, Settings } from 'lucide-react';

const Navigation = ({ currentView, onViewChange, apiStatus }) => {
  const navItems = [
    {
      id: 'upload',
      label: 'Upload Files',
      icon: Upload,
      description: 'Upload and sync files'
    },
    {
      id: 'conflicts',
      label: 'Conflicts',
      icon: AlertTriangle,
      description: 'Resolve file conflicts'
    },
    {
      id: 'status',
      label: 'Sync Status',
      icon: BarChart3,
      description: 'View synchronization status'
    }
  ];

  return (
    <nav className="main-navigation">
      <div className="nav-container">
        <div className="nav-items">
          {navItems.map(item => {
            const IconComponent = item.icon;
            const isActive = currentView === item.id;
            const isDisabled = apiStatus === 'disconnected';

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && onViewChange(item.id)}
                className={`nav-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                disabled={isDisabled}
                title={isDisabled ? 'API disconnected' : item.description}
              >
                <IconComponent size={20} />
                <span className="nav-label">{item.label}</span>
                {isActive && <div className="nav-indicator" />}
              </button>
            );
          })}
        </div>

        <div className="nav-actions">
          <div className="storage-indicators">
            <div className="storage-indicator local" title="Local Storage">
              <div className="indicator-dot"></div>
              <span>Local</span>
            </div>
            <div className="storage-indicator google" title="Google Drive">
              <div className="indicator-dot"></div>
              <span>Drive</span>
            </div>
            <div className="storage-indicator azure" title="Azure Blob">
              <div className="indicator-dot"></div>
              <span>Azure</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;