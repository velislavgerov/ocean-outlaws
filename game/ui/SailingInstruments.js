export default class SailingInstruments {
  constructor() {
    this._build();
    globalThis.experience.ticker.register(13, 'hud.update', () => this._update());
  }

  _build() {
    const hud = document.createElement('div');
    hud.className = 'sailing-hud';
    hud.innerHTML = `
      <div class="instrument" data-id="inst-sog"><label>SOG</label><span id="v-sog">0.0</span><unit>kn</unit></div>
      <div class="instrument" data-id="inst-awa"><label>AWA</label><span id="v-awa">0</span><unit>°</unit></div>
      <div class="instrument" data-id="inst-aws"><label>AWS</label><span id="v-aws">0.0</span><unit>kn</unit></div>
      <div class="instrument" data-id="inst-tws"><label>TWS</label><span id="v-tws">0.0</span><unit>kn</unit></div>
      <div class="instrument" data-id="inst-heel"><label>HEEL</label><span id="v-heel">0.0</span><unit>°</unit></div>
      <div class="instrument" data-id="inst-lee"><label>LEE</label><span id="v-lee">0.0</span><unit>°</unit></div>
      <div class="trim-bar">
        <label>TRIM</label>
        <div class="bar-track">
          <div class="bar-fill" id="trim-fill"></div>
          <div class="optimal-marker" id="trim-optimal"></div>
        </div>
      </div>
    `;
    document.body.appendChild(hud);

    this._hud = hud;
    this._refs = {
      sog: document.getElementById('v-sog'),
      awa: document.getElementById('v-awa'),
      aws: document.getElementById('v-aws'),
      tws: document.getElementById('v-tws'),
      heel: document.getElementById('v-heel'),
      lee: document.getElementById('v-lee'),
      trim: document.getElementById('trim-fill'),
      optimal: document.getElementById('trim-optimal')
    };
  }

  _update() {
    const exp = globalThis.experience;
    const boat = exp.localBoat?.physical;
    const wind = exp.wind;
    if (!boat || !wind) return;

    const sog = boat.speedSOG * 1.944;
    const aws = (boat.apparentWindSpeed || 0) * 1.944;
    const tws = wind.trueWindSpeed * 1.944;

    this._refs.sog.textContent = sog.toFixed(1);
    this._refs.awa.textContent = Math.round(boat.apparentWindAngle || 0);
    this._refs.aws.textContent = aws.toFixed(1);
    this._refs.tws.textContent = tws.toFixed(1);
    this._refs.heel.textContent = Math.abs(boat.heelAngle || 0).toFixed(1);
    this._refs.lee.textContent = (boat.leewayAngle || 0).toFixed(1);

    const eff = boat.sailEfficiency ?? 1;
    this._refs.trim.style.width = `${boat.sailTrim}%`;
    this._refs.trim.style.background = eff > 0.75 ? '#00cc66' : eff > 0.4 ? '#ff8800' : '#cc2200';
    const optPct = (getOptimalTrimForHUD(Math.abs(boat.apparentWindAngle || 90)) / 90) * 100;
    this._refs.optimal.style.left = `${optPct}%`;

    this._hud.classList.toggle('gust-active', wind._gustPhase !== 'idle');
  }
}

function getOptimalTrimForHUD(awa) {
  return Math.max(5, Math.min(88, (Math.abs(awa) - 30) * (83 / 150)));
}
