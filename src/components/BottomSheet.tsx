import type { ApplicableRestriction, NearbySign } from '../types';
import { formatSignName, formatDistance, getDefaultIconUrl, getIconUrl } from '../logic/nearbySigns';
import type { RestrictionDisplayItem } from '../logic/restrictionDisplay';
import './BottomSheet.css';

interface BottomSheetProps {
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
  restrictionDisplayItems?: RestrictionDisplayItem[];
}

function BottomSheet({ restrictions, signs, restrictionDisplayItems = [] }: BottomSheetProps) {
  const nearestSign = signs[0];
  const primaryItem = restrictionDisplayItems[0];
  const restrictionLabel = primaryItem
    ? primaryItem.label
    : restrictions.length > 0
      ? 'Rajoitus'
      : 'Ei rajoituksia';

  return (
    <div className="bottom-sheet">
      <div className="summary-grid">
        <div className="summary-cell">
          <div className="summary-title">Rajoitus</div>
          <div className="summary-value" title={restrictionLabel}>
            {restrictionLabel}
          </div>
          {restrictionDisplayItems.length > 0 && (
            <div className="summary-area-signs">
              {restrictionDisplayItems.slice(0, 6).map((item, idx) => (
                <div key={idx} className="summary-area-sign-block">
                  <img
                    className="summary-area-sign-icon"
                    src={getIconUrl(item.iconKey)}
                    alt={item.label}
                    title={item.label}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
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
                    {item.poikkeus && (
                      <span className="summary-area-extra"> {item.poikkeus}</span>
                    )}
                    {item.lisatieto && (
                      <span className="summary-area-extra"> {item.lisatieto}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="summary-cell">
          <div className="summary-title">Lähin merkki</div>
          {nearestSign ? (
            <div className="summary-sign">
              <img
                className="summary-sign-icon"
                src={nearestSign.iconUrl}
                alt={formatSignName(nearestSign)}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const baseKey = nearestSign.iconKey.split('_')[0];
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
              <div className="summary-sign-text" title={`${formatSignName(nearestSign)} (${formatDistance(nearestSign.distance)})`}>
                {formatSignName(nearestSign)} ({formatDistance(nearestSign.distance)})
              </div>
            </div>
          ) : (
            <div className="summary-value">Ei merkkejä</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BottomSheet;
