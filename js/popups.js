/* popups.js – DVPRS modalas */

const dvprs = [
  { n: 0,  emoji: '😀', color: '#16a34a', text: 'NERA SKAUSMO' },
  { n: 1,  emoji: '🙂', color: '#22c55e', text: 'NEPASTEBIMAS SKAUSMAS' },
  { n: 2,  emoji: '🙂', color: '#4ade80', text: 'PASTEBIMAS SKAUSMAS, NEKELIANTIS NEPATOGUMŲ' },
  { n: 3,  emoji: '🙂', color: '#86efac', text: 'SKAUSMAS, KURIS KARTAIS NELEIDŽIA SUSIKAUPTI' },
  { n: 4,  emoji: '😐', color: '#facc15', text: 'SKAUSMAS, KURIS NELEIDŽIA SUSIKAUPTI' },
  { n: 5,  emoji: '😐', color: '#fbbf24', text: 'SKAUSMAS, KURIS TRUKDO VEIKLOMS' },
  { n: 6,  emoji: '😐', color: '#f59e0b', text: 'SUNKU IGNORUOTI SKAUSMĄ' },
  { n: 7,  emoji: '😣', color: '#fb7185', text: 'SUNKU SUSIKAUPTI DĖL SKAUSMO' },
  { n: 8,  emoji: '😣', color: '#f43f5e', text: 'DĖL SKAUSMO SUNKU KĄ NORS DARYTI' },
  { n: 9,  emoji: '😭', color: '#ef4444', text: 'NEPAKELIAMAS SKAUSMAS, NIEKO NEĮMANOMA DARYTI' },
  { n: 10, emoji: '😭', color: '#b91c1c', text: 'DIDŽIAUSIAS SKAUSMAS, NIEKAS DAUGIAU NERŪPI' }
];

function openDvprs() {
  document.getElementById('dvprsModal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeDvprs() {
  document.getElementById('dvprsModal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function setPainFromDvprs(n) {
  document.getElementById('skausmas').value = 'taip';
  document.getElementById('skausmoLygis').value = String(n);
  document.getElementById('skausmoLygis').toggleAttribute('required', true);
  closeDvprs();
  document.getElementById('skausmas_section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderDvprs() {
  const grid = document.getElementById('dvprsGrid');
  if (!grid) return;

  grid.innerHTML = dvprs.map(item => `
    <button
      type="button"
      class="dvprsCard"
      style="--dvprsColor:${item.color}"
      onclick="setPainFromDvprs(${item.n})"
      aria-label="Skausmo lygis ${item.n} iš 10"
    >
      <div class="dvprsBar" style="background-color:${item.color}"></div>
      <div class="dvprsTop">
        <div class="dvprsLeft">
          <div class="dvprsEmoji" aria-hidden="true">${item.emoji}</div>
          <div class="dvprsNum">${item.n}</div>
        </div>
        <div class="dvprsTag">${item.n}/10</div>
      </div>
      <div class="dvprsText">${escapeHtml(item.text)}</div>
    </button>
  `).join('');
}
