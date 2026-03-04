import type { ApplicableRestriction, NearbySign } from '../types';
import { formatRestriction } from '../logic/applicability';
import { formatSignName, formatDistance, getDefaultIconUrl, getIconUrl } from '../logic/nearbySigns';
import './BottomSheet.css';

interface BottomSheetProps {
  restrictions: ApplicableRestriction[];
  signs: NearbySign[];
}

function BottomSheet({ restrictions, signs }: BottomSheetProps) {
  const primaryRestriction = restrictions[0];
  const nearestSign = signs[0];

  return (
    <div className="bottom-sheet">
      <div className="summary-grid">
        <div className="summary-cell">
          <div className="summary-title">Rajoitus</div>
          <div className="summary-value" title={primaryRestriction ? formatRestriction(primaryRestriction) : 'Ei rajoituksia'}>
            {primaryRestriction ? formatRestriction(primaryRestriction) : 'Ei rajoituksia'}
          </div>
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
