import { useState } from 'react';
import type { ApplicableRestriction, NearbySign, AppFilters, BoatPosition } from '../types';
import { formatSignName, formatDistance, bearingToCompass, getDefaultIconUrl, getIconUrl } from '../logic/nearbySigns';
import type { RestrictionDisplayItem } from '../logic/restrictionDisplay';
import './BottomSheet.css';

interface BottomSheetProps {
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
  restrictionDisplayItems?: RestrictionDisplayItem[];
  filters: AppFilters;
  boatPosition?: BoatPosition | null;
}

function BottomSheet({ restrictions, signs, restrictionDisplayItems = [], filters, boatPosition }: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const primaryItem = restrictionDisplayItems[0];
  const restrictionLabel = primaryItem
    ? primaryItem.label
    : restrictions.length > 0
      ? 'Rajoitus'
      : 'Ei rajoituksia';

  return (
    <div
      className={`bottom-sheet ${isExpanded ? 'bottom-sheet--expanded' : ''}`}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      onClick={() => { if (!isExpanded) setIsExpanded(true); }}
      onKeyDown={(e) => {
        if (!isExpanded && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setIsExpanded(true);
        }
      }}
    >
      {isExpanded && (
        <button
          type="button"
          className="bottom-sheet__close"
          aria-label="Sulje"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
        >
          ×
        </button>
      )}
      <div className="summary-grid">
        <div className="summary-cell">
          <div className="summary-title">Rajoitus</div>
          {restrictionDisplayItems.length === 0 && (
            <div className="summary-value" title={restrictionLabel}>
              {restrictionLabel}
            </div>
          )}
          {restrictionDisplayItems.length > 0 && (
            <div className="summary-area-signs">
              {restrictionDisplayItems.slice(0, 6).map((item, idx) => (
                <div key={idx} className="summary-area-sign-block">
                  <img
                    className="summary-area-sign-icon"
                    src={item.iconUrl}
                    alt={item.label}
                    title={item.label}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (item.iconKey === 'merkki_default') {
                        target.classList.add('summary-sign-fallback');
                        return;
                      }
                      const baseKey = item.iconKey.split('_')[0];
                      if (target.src.includes('_')) {
                        target.src = getIconUrl(baseKey);
                      } else {
                        target.src = getDefaultIconUrl();
                      }
                    }}
                  />
                  <div className="summary-area-sign-detail">
                    <span className="summary-area-sign-label">{item.label}</span>
                    {filters.lisatietoja && item.poikkeus && (
                      <span className="summary-area-extra"> {item.poikkeus}</span>
                    )}
                    {filters.lisatietoja && item.lisatieto && (
                      <span className="summary-area-extra"> {item.lisatieto}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="summary-cell">
          <div className="summary-title">Nopeus</div>
          <div className="summary-value summary-speed">
            {boatPosition?.speed != null
              ? `${(boatPosition.speed * 3.6).toFixed(1)} km/h`
              : '– km/h'}
          </div>
        </div>

        <div className="summary-cell">
          <div className="summary-title">Läheiset merkit</div>
          {signs.filter(s => s.distance <= filters.nearbyRadius).length > 0 ? (
            <div className="summary-nearby-signs">
              {signs.filter(s => s.distance <= filters.nearbyRadius).map((sign) => (
                <div key={sign.id} className="summary-area-sign-block">
                  <img
                    className="summary-area-sign-icon"
                    src={sign.iconUrl}
                    alt={formatSignName(sign)}
                    title={formatSignName(sign)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const baseKey = sign.iconKey.split('_')[0];
                      if (target.src.includes('_')) {
                        target.src = getIconUrl(baseKey);
                      } else if (!target.src.includes('merkki_default')) {
                        target.src = getDefaultIconUrl();
                      } else {
                        target.classList.add('summary-sign-fallback');
                        target.alt = 'Merkki';
                      }
                    }}
                  />
                  <div className="summary-area-sign-detail">
                    <span className="summary-area-sign-label">{formatSignName(sign)}</span>
                    <span className="summary-sign-location">
                      {formatDistance(sign.distance)} {bearingToCompass(sign.bearing)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="summary-value">Ei merkkejä lähellä</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
