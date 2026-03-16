import type { ApplicableRestriction, NearbySign, AppFilters } from '../types';
import { formatSignName, formatDistance, bearingToCompass, getDefaultIconUrl, getIconUrl } from '../logic/nearbySigns';
import type { RestrictionDisplayItem } from '../logic/restrictionDisplay';
import './BottomSheet.css';

interface BottomSheetProps {
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
  restrictionDisplayItems?: RestrictionDisplayItem[];
  filters: AppFilters;
}

function BottomSheet({ restrictions, signs, restrictionDisplayItems = [], filters }: BottomSheetProps) {
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
          <div className="summary-title">Läheiset merkit</div>
          {signs.length > 0 ? (
            <div className="summary-nearby-signs">
              {signs.map((sign) => (
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
