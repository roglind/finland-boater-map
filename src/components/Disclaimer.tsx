import './Disclaimer.css';

interface DisclaimerProps {
  onAccept: () => void;
}

function Disclaimer({ onAccept }: DisclaimerProps) {
  return (
    <div className="disclaimer-overlay">
      <div className="disclaimer-box">
        <h2 className="disclaimer-title">Huomio ennen käyttöä</h2>

        <div className="disclaimer-body">
          <p>
            Tämä palvelu hyödyntää Väyläviraston avointa vesiväylädataa (CC BY 4.0).
            Tiedot sisältävät muun muassa vesiliikennemerkkejä ja rajoitusalueita.
          </p>
          <p>
            Palvelu on tarkoitettu vain informatiiviseen käyttöön. Tiedot eivät ole
            kattavia, ajantasaisia tai virallisia navigointitietoja, eikä niitä tule
            käyttää ainoana perusteena navigointiin tai turvallisuuteen liittyviin
            päätöksiin.
          </p>
          <p>
            Palvelun tarjoaja ei vastaa tietojen mahdollisista virheistä, puutteista
            tai viiveistä eikä niiden käytöstä aiheutuvista vahingoista.
          </p>
          <p>
            Käyttäjän vastuulla on varmistaa tiedot virallisista lähteistä ennen
            niiden käyttöä navigointiin tai muuhun kriittiseen tarkoitukseen.
          </p>
          <p className="disclaimer-accept-text">
            Hyväksyt ehdot jatkamalla palveluun.
          </p>
        </div>

        <button className="disclaimer-btn" onClick={onAccept}>
          OK
        </button>
        <p className="disclaimer-hint">Paina "OK" jatkaaksesi palveluun.</p>
      </div>
    </div>
  );
}

export default Disclaimer;
