import { useState, useEffect } from 'react';
import type { UpdateStatus } from '../types';
import { getLastUpdated } from '../data/db';
import './UpdateButton.css';

interface UpdateButtonProps {
  onUpdate: () => void;
  status: UpdateStatus;
}

function UpdateButton({ onUpdate, status }: UpdateButtonProps) {
  const [lastUpdate, setLastUpdate] = useState<string>('');
  
  useEffect(() => {
    loadLastUpdate();
  }, [status.isUpdating]);
  
  const loadLastUpdate = async () => {
    const rajoitusDate = await getLastUpdated('rajoitus');
    const vesiliikenneDate = await getLastUpdated('vesiliikenne');
    
    if (rajoitusDate || vesiliikenneDate) {
      const date = new Date(rajoitusDate || vesiliikenneDate || '');
      setLastUpdate(date.toLocaleString('fi-FI'));
    }
  };
  
  return (
    <div className="update-button-container">
      <button
        className="update-btn"
        onClick={onUpdate}
        disabled={status.isUpdating}
      >
        {status.isUpdating ? (
          <>
            <span className="spinner" />
            Päivitetään...
          </>
        ) : (
          <>
            <span>🔄</span>
            Päivitä aineisto
          </>
        )}
      </button>
      
      {status.message && (
        <div className={`update-message ${status.isUpdating ? 'active' : ''}`}>
          {status.message}
          {status.isUpdating && status.progress > 0 && (
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${status.progress}%` }}
              />
            </div>
          )}
        </div>
      )}
      
      {lastUpdate && !status.isUpdating && (
        <div className="last-update">
          Viimeksi päivitetty: {lastUpdate}
        </div>
      )}
    </div>
  );
}

export default UpdateButton;
