import type { ApplicableRestriction, NearbySign } from '../types';
import { formatRestriction } from '../logic/applicability';
import { formatSignName, formatDistance, getDefaultIconUrl, getIconUrl } from '../logic/nearbySigns';
import './BottomSheet.css';

interface BottomSheetProps {
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
  signsInRestrictionAreas?: NearbySign[];
}

function getRestrictionDisplay(
  primaryRestriction: ApplicableRestriction | undefined,
  signsInRestrictionAreas: NearbySign[],
  formatRestriction: (r: ApplicableRestriction) => string,
  formatSignName: (s: NearbySign) => string
): string {
  if (!primaryRestriction) return 'Ei rajoituksia';
  const restrictionText = formatRestriction(primaryRestriction);
  if (restrictionText !== 'Rajoitus') return restrictionText;
  if (signsInRestrictionAreas.length === 0) return 'Rajoitus';
  const uniqueNames = [...new Set(signsInRestrictionAreas.map(formatSignName).filter(Boolean))];
  return uniqueNames.join(', ') || 'Rajoitus';
}

function BottomSheet({ restrictions, signs, signsInRestrictionAreas = [] }: BottomSheetProps) {
  const primaryRestriction = restrictions[0];
  const nearestSign = signs[0];
  const restrictionDisplay = getRestrictionDisplay(
    primaryRestriction,
    signsInRestrictionAreas,
    formatRestriction,
    formatSignName
  );

  return (
    <div className="bottom-sheet">
      <div className="summary-grid">
        <div className="summary-cell">
          <div className="summary-title">Rajoitus</div>
          <div className="summary-value" title={restrictionDisplay}>
            {restrictionDisplay}
          </div>
          {signsInRestrictionAreas.length > 0 && (
            <div className="summary-area-signs">
              {signsInRestrictionAreas.slice(0, 5).map((sign) => (
                <img
                  key={sign.id}
                  className="summary-area-sign-icon"
                  src={sign.iconUrl}
                  alt={formatSignName(sign)}
                  title={formatSignName(sign)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    const baseKey = sign.iconKey.split('_')[0];
                    if (target.src.includes('_')) {
                      target.src = getIconUrl(baseKey);
                    } else {
                      target.src = getDefaultIconUrl();
                    }
                  }}
                />
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
