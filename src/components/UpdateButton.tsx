import { useState, useEffect } from 'react';
import type { UpdateStatus } from '../types';
import { db, getLastUpdated } from '../data/db';
import './UpdateButton.css';

interface UpdateButtonProps {
  onUpdate: () => void;
  status: UpdateStatus;
}

function UpdateButton({ onUpdate, status }: UpdateButtonProps) {
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [dbInfo, setDbInfo] = useState<string>('');

  useEffect(() => {
    loadInfo();
  }, [status.isUpdating]);

  const loadInfo = async () => {
    const rajoitusDate = await getLastUpdated('rajoitus');
    const vesiliikenneDate = await getLastUpdated('vesiliikenne');

    if (rajoitusDate || vesiliikenneDate) {
      const date = new Date(rajoitusDate || vesiliikenneDate || '');
      setLastUpdate(date.toLocaleString('fi-FI'));
    }

    const areaCount = await db.restriction_areas.count();
    const signCount = await db.traffic_signs.count();
    if (areaCount > 0 || signCount > 0) {
      setDbInfo(`${areaCount} rajoitusaluetta ja ${signCount} merkkiä`);
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

      {status.isUpdating && status.message && (
        <div className="update-message active">{status.message}</div>
      )}

      {status.isUpdating && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      )}

      {!status.isUpdating && (dbInfo || lastUpdate) && (
        <div className="download-info">
          {dbInfo && <div className="download-count">{dbInfo}</div>}
          {lastUpdate && <div className="download-time">Päivitetty: {lastUpdate}</div>}
        </div>
      )}

      {status.error && (
        <div className="update-error">{status.error}</div>
      )}
    </div>
  );
}

export default UpdateButton;
