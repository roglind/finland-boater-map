import type { AppFilters, UpdateStatus } from '../types';
import UpdateButton from './UpdateButton';
import './SettingsPanel.css';

interface SettingsPanelProps {
  filters: AppFilters;
  availableVlmtyyppi: number[];
  onFilterChange: <K extends keyof AppFilters>(key: K, value: AppFilters[K]) => void;
  onClose: () => void;
  onUpdate: () => void;
  updateStatus: UpdateStatus;
}

function SettingsPanel({ filters, availableVlmtyyppi, onFilterChange, onClose, onUpdate, updateStatus }: SettingsPanelProps) {
  const toggleVlmtyyppi = (value: number) => {
    const newSet = new Set(filters.selectedVlmtyyppi);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    onFilterChange('selectedVlmtyyppi', newSet);
  };
  
  const selectAllVlmtyyppi = () => {
    onFilterChange('selectedVlmtyyppi', new Set(availableVlmtyyppi));
  };
  
  const clearAllVlmtyyppi = () => {
    onFilterChange('selectedVlmtyyppi', new Set<number>());
  };
  
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Asetukset</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="settings-content">
          <section className="settings-section">
            <h3>Rajoitussuodattimet</h3>
            
            <div className="setting-item">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={filters.lisatietoja}
                  onChange={(e) => onFilterChange('lisatietoja', e.target.checked)}
                />
                <span className="switch" />
                <span className="label-text">Lisätietoja</span>
              </label>
              <p className="setting-description">
                Kun päällä, näytetään poikkeus- ja lisätietotekstit alueiden merkkien yhteydessä
              </p>
            </div>
            
            <div className="setting-item">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={filters.vesiskootteri}
                  onChange={(e) => onFilterChange('vesiskootteri', e.target.checked)}
                />
                <span className="switch" />
                <span className="label-text">Vesiskootteri</span>
              </label>
              <p className="setting-description">
                Kun pois päältä, piilotetaan vesiskootteri-rajoitukset
              </p>
            </div>
          </section>
          
          <section className="settings-section">
            <h3>Läheisten merkkien säde</h3>
            <div className="setting-item">
              <label>
                <span className="label-text">
                  Säde: {filters.nearbyRadius} m
                </span>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={filters.nearbyRadius}
                  onChange={(e) => onFilterChange('nearbyRadius', parseInt(e.target.value))}
                  className="radius-slider"
                />
              </label>
            </div>
          </section>
          
          <section className="settings-section">
            <div className="section-header">
              <h3>Merkkityypit</h3>
              <div className="bulk-actions">
                <button onClick={selectAllVlmtyyppi} className="text-btn">Valitse kaikki</button>
                <button onClick={clearAllVlmtyyppi} className="text-btn">Tyhjennä</button>
              </div>
            </div>
            <p className="setting-description">
              {filters.selectedVlmtyyppi.size === 0 ? 'Näytetään kaikki merkit' : `Valittu ${filters.selectedVlmtyyppi.size} tyyppiä`}
            </p>
            
            <div className="vlmtyyppi-grid">
              {availableVlmtyyppi.map(type => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.selectedVlmtyyppi.has(type)}
                    onChange={() => toggleVlmtyyppi(type)}
                  />
                  <span className="checkbox-custom" />
                  <span className="label-text">Tyyppi {type}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="settings-section">
            <h3>Aineisto</h3>
            <div className="setting-item">
              <UpdateButton onUpdate={onUpdate} status={updateStatus} />
            </div>
            <div className="setting-item settings-data-buttons">
              <button
                className="settings-data-btn"
                onClick={() => window.open('?viewer=areas', '_blank')}
              >
                View area data
              </button>
              <button
                className="settings-data-btn"
                onClick={() => window.open('?viewer=signs', '_blank')}
              >
                View sign data
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
