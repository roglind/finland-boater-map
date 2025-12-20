import { useState } from 'react';
import type { ApplicableRestriction, NearbySign } from '../types';
import { formatRestriction } from '../logic/applicability';
import { formatSignName, formatDistance } from '../logic/nearbySigns';
import './BottomSheet.css';

interface BottomSheetProps {
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
}

function BottomSheet({ restrictions, signs }: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const hasContent = restrictions.length > 0 || signs.length > 0;
  
  return (
    <div className={`bottom-sheet ${isExpanded ? 'expanded' : ''} ${!hasContent ? 'empty' : ''}`}>
      <div className="bottom-sheet-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="drag-handle" />
        <div className="header-content">
          {restrictions.length > 0 && (
            <div className="primary-info">
              {formatRestriction(restrictions[0])}
            </div>
          )}
          {restrictions.length === 0 && signs.length === 0 && (
            <div className="no-data">Ei rajoituksia tai merkkejä lähistöllä</div>
          )}
        </div>
      </div>
      
      <div className="bottom-sheet-content">
        {restrictions.length > 0 && (
          <section className="restrictions-section">
            <h3>Voimassa olevat rajoitukset</h3>
            <div className="restrictions-list">
              {restrictions.map((restriction, idx) => (
                <div 
                  key={restriction.id} 
                  className={`restriction-item ${restriction.isPrimary ? 'primary' : ''}`}
                >
                  <div className="restriction-title">
                    {formatRestriction(restriction)}
                    {restriction.isPrimary && <span className="badge">Tärkein</span>}
                  </div>
                  
                  {restriction.poikkeus && (
                    <div className="restriction-detail">
                      <strong>Poikkeus:</strong> {restriction.poikkeus}
                    </div>
                  )}
                  
                  {restriction.lisatieto && (
                    <div className="restriction-detail">
                      <strong>Lisätieto:</strong> {restriction.lisatieto}
                    </div>
                  )}
                  
                  {restriction.alkuPvm && (
                    <div className="restriction-meta">
                      Voimassa: {new Date(restriction.alkuPvm).toLocaleDateString('fi-FI')}
                      {restriction.loppuPvm && ` - ${new Date(restriction.loppuPvm).toLocaleDateString('fi-FI')}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        
        {signs.length > 0 && (
          <section className="signs-section">
            <h3>Lähellä olevat merkit</h3>
            <div className="signs-list">
              {signs.map(sign => (
                <div key={sign.id} className="sign-item">
                  <div className="sign-icon">
                    <img 
                      src={sign.iconUrl} 
                      alt={formatSignName(sign)}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        const baseKey = sign.iconKey.split('_')[0];
                        if (target.src.includes('_')) {
                          target.src = `/icons/${baseKey}.png`;
                        } else if (!target.src.includes('default')) {
                          target.src = '/icons/merkki_default.png';
                        }
                      }}
                    />
                  </div>
                  <div className="sign-info">
                    <div className="sign-name">{formatSignName(sign)}</div>
                    {sign.lisakilmentekstiFi && (
                      <div className="sign-detail">{sign.lisakilmentekstiFi}</div>
                    )}
                    <div className="sign-distance">{formatDistance(sign.distance)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default BottomSheet;
