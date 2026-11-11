// Cartoon art, drawn in code as SVG so there are no image files to download.
// face(): a customer's head and shoulders. good(): one of the goods. scene(): the table or shop with a customer.
import { GOODS } from './data.js';

const DARK = '#2B1D14';

// How each customer looks. hair: short | hightop | braids | bald; hat: gele | kufi | fila | hijab.
const LOOKS = {
  mamabola:   { skin: '#8D5524', hat: 'gele', hatColor: '#E86A33', shirt: '#E86A33', trim: '#FFD27A' },
  mrade:      { skin: '#6B3E26', hair: 'short', shirt: '#2F6FB0', mustache: true },
  unclesule:  { skin: '#7A4A2A', hat: 'kufi', hatColor: '#F2EFE6', shirt: '#E9E1CF', beard: '#BDB6A8' },
  ngozi:      { skin: '#A0663D', hair: 'braids', shirt: '#7B4FA0' },
  musa:       { skin: '#5C3A21', hat: 'kufi', hatColor: '#2E8B57', shirt: '#2E8B57' },
  aisha:      { skin: '#9B6A43', hat: 'hijab', hatColor: '#2E7D74', shirt: '#2E7D74' },
  babakunle:  { skin: '#6E4428', hat: 'fila', hatColor: '#8E3B46', shirt: '#8E3B46', beard: '#CFC8BA' },
  iyatunde:   { skin: '#7D4B2B', hat: 'gele', hatColor: '#D9A400', shirt: '#D9A400', trim: '#FFF1B8' },
  mrokon:     { skin: '#6A4026', hair: 'short', shirt: '#4A4F57', tie: '#C0392B', glasses: true },
  chidi:      { skin: '#8A5A35', hair: 'hightop', shirt: '#C0392B', grin: true },
  pastorfemi: { skin: '#5E3A22', hair: 'bald', shirt: '#263B5E', collar: true, glasses: true },
  madamcaro:  { skin: '#A66A3F', hat: 'gele', hatColor: '#B0306A', shirt: '#B0306A', trim: '#F7C6DD', earrings: true },
};

const MOUTH = {
  happy: '<path d="M42 59 Q50 67 58 59" fill="none" stroke="#3A1F12" stroke-width="2.4" stroke-linecap="round"/>',
  neutral: '<path d="M43 61 H57" fill="none" stroke="#3A1F12" stroke-width="2.4" stroke-linecap="round"/>',
  sad: '<path d="M42 64 Q50 57 58 64" fill="none" stroke="#3A1F12" stroke-width="2.4" stroke-linecap="round"/>',
  grin: '<path d="M42 59 Q52 66 60 57" fill="none" stroke="#3A1F12" stroke-width="2.4" stroke-linecap="round"/>',
};

function hairBack(L) {
  if (L.hat === 'hijab') return `<path d="M22 50 C20 22 36 14 50 14 C64 14 80 22 78 50 L80 84 H20 Z" fill="${L.hatColor}"/>`;
  if (L.hair === 'braids') return `<path d="M27 44 L24 74 M31 50 L29 78 M69 50 L71 78 M73 44 L76 74" stroke="${DARK}" stroke-width="4" stroke-linecap="round"/>`;
  return '';
}

function hairFront(L) {
  switch (L.hat) {
    case 'gele':
      return `<path d="M23 40 C17 18 38 6 50 10 C64 6 86 16 77 40 C70 30 30 30 23 40 Z" fill="${L.hatColor}"/>
        <path d="M30 26 C40 20 60 20 70 26" fill="none" stroke="${L.trim}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M64 12 C74 2 86 8 80 18 C78 12 70 10 64 12 Z" fill="${L.hatColor}"/>`;
    case 'kufi':
      return `<path d="M29 32 C29 18 71 18 71 32 Z" fill="${L.hatColor}"/><path d="M29 32 H71" stroke="#00000022" stroke-width="2"/>`;
    case 'fila':
      return `<path d="M28 33 C26 16 58 10 74 20 C80 24 76 32 72 33 Z" fill="${L.hatColor}"/><path d="M28 33 H72" stroke="#00000033" stroke-width="2"/>`;
    case 'hijab':
      return `<path d="M27 44 C26 26 38 20 50 20 C62 20 74 26 73 44 C68 32 32 32 27 44 Z" fill="${L.hatColor}"/>`;
    default:
  }
  switch (L.hair) {
    case 'short': return `<path d="M28 42 C25 22 40 18 50 18 C62 18 76 23 72 42 C67 31 33 31 28 42 Z" fill="${DARK}"/>`;
    case 'hightop': return `<path d="M29 40 L30 14 C38 10 62 10 70 14 L71 40 C66 30 34 30 29 40 Z" fill="${DARK}"/>`;
    case 'braids': return `<path d="M27 46 C24 22 40 17 50 17 C62 17 77 22 73 46 C68 32 32 32 27 46 Z" fill="${DARK}"/>`;
    case 'bald': return `<path d="M30 36 C32 26 40 22 50 22 C60 22 68 26 70 36" fill="none" stroke="#00000022" stroke-width="3"/>`;
    default: return '';
  }
}

export function face(cid, { mood = 'happy', size = 88, label = '' } = {}) {
  const L = LOOKS[cid];
  if (!L) return '';
  const mouth = MOUTH[mood === 'happy' && L.grin ? 'grin' : mood];
  const brows = mood === 'sad'
    ? '<path d="M37 41 L45 43 M63 41 L55 43" stroke="#3A1F12" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M37 41 Q41 39 45 41 M55 41 Q59 39 63 41" fill="none" stroke="#3A1F12" stroke-width="2" stroke-linecap="round"/>';
  const extras = [
    L.beard ? `<path d="M31 54 C33 72 44 76 50 76 C56 76 67 72 69 54 C64 64 36 64 31 54 Z" fill="${L.beard}"/>` : '',
    L.mustache ? '<path d="M42 56 Q50 52 58 56" fill="none" stroke="#2B1D14" stroke-width="3" stroke-linecap="round"/>' : '',
    L.glasses ? '<g fill="none" stroke="#1F2A24" stroke-width="2"><circle cx="41" cy="48" r="6"/><circle cx="59" cy="48" r="6"/><path d="M47 48 H53"/></g>' : '',
    L.earrings ? '<circle cx="27" cy="57" r="2.6" fill="#F5B70A"/><circle cx="73" cy="57" r="2.6" fill="#F5B70A"/>' : '',
  ].join('');
  const neck = L.hat === 'hijab' ? '' : `<rect x="43" y="64" width="14" height="12" fill="${L.skin}"/>`;
  const top = [
    L.collar ? '<path d="M44 74 L50 82 L56 74 Z" fill="#FFFFFF"/>' : '',
    L.tie ? `<path d="M47 76 L53 76 L52 90 L50 94 L48 90 Z" fill="${L.tie}"/>` : '',
    L.trim ? `<path d="M30 84 C40 80 60 80 70 84" fill="none" stroke="${L.trim}" stroke-width="2.5"/>` : '',
  ].join('');
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" ${a11y}>
    ${hairBack(L)}
    <path d="M12 100 C12 80 30 72 50 72 C70 72 88 80 88 100 Z" fill="${L.shirt}"/>${top}${neck}
    <circle cx="28" cy="49" r="4.5" fill="${L.skin}"/><circle cx="72" cy="49" r="4.5" fill="${L.skin}"/>
    <ellipse cx="50" cy="46" rx="22" ry="25" fill="${L.skin}"/>
    ${hairFront(L)}
    <circle cx="41" cy="48" r="2.6" fill="#1A120C"/><circle cx="59" cy="48" r="2.6" fill="#1A120C"/>
    ${brows}${extras}${mouth}
  </svg>`;
}

// Goods, drawn in a 48×48 box.
const GOOD_ART = {
  rice: `<path d="M10 16 H38 L35 42 H13 Z" fill="#E6E9EC"/><path d="M10 16 H38" stroke="#B9C0C7" stroke-width="2"/>
    <path d="M12 16 C16 8 32 8 36 16" fill="none" stroke="#8A939C" stroke-width="2"/><ellipse cx="24" cy="16" rx="14" ry="4" fill="#FFFFFF"/>
    <circle cx="19" cy="15" r="1" fill="#D6D2C4"/><circle cx="26" cy="16" r="1" fill="#D6D2C4"/><circle cx="30" cy="14.5" r="1" fill="#D6D2C4"/>
    <rect x="16" y="24" width="16" height="9" rx="2" fill="#0E6B43"/>`,
  garri: `<path d="M12 20 H36 L33 42 H15 Z" fill="#3E7CC4"/><ellipse cx="24" cy="20" rx="12" ry="4" fill="#F1E3B8"/>
    <path d="M17 18 C20 12 28 12 31 18" fill="#F1E3B8"/>`,
  water: `<rect x="8" y="12" width="32" height="30" rx="6" fill="#CFE7F7" stroke="#7FB6DA" stroke-width="2"/>
    <rect x="13" y="17" width="10" height="9" rx="2" fill="#FFFFFF" stroke="#7FB6DA"/><rect x="25" y="17" width="10" height="9" rx="2" fill="#FFFFFF" stroke="#7FB6DA"/>
    <rect x="13" y="28" width="10" height="9" rx="2" fill="#FFFFFF" stroke="#7FB6DA"/><rect x="25" y="28" width="10" height="9" rx="2" fill="#FFFFFF" stroke="#7FB6DA"/>
    <path d="M18 9 H30" stroke="#7FB6DA" stroke-width="3" stroke-linecap="round"/>`,
  recharge: `<rect x="7" y="13" width="34" height="22" rx="4" fill="#F5B70A"/><rect x="7" y="19" width="34" height="4" fill="#C98F00"/>
    <text x="24" y="32" text-anchor="middle" font-size="8" font-weight="800" font-family="system-ui,sans-serif" fill="#17231C">₦500</text>`,
  noodles: `<rect x="8" y="12" width="32" height="26" rx="4" fill="#E8742C"/><path d="M8 18 H40 M8 32 H40" stroke="#B9531A" stroke-width="2"/>
    <path d="M14 25 q3 -4 6 0 t6 0 t6 0 t6 0" fill="none" stroke="#FFE08A" stroke-width="2.4"/>`,
  bread: `<path d="M7 30 C7 14 41 14 41 30 V36 H7 Z" fill="#C8873F"/><path d="M7 30 C7 22 41 22 41 30" fill="#E0A55C"/>
    <path d="M16 20 L19 26 M24 19 L26 25 M32 20 L33 26" stroke="#9A5F22" stroke-width="2" stroke-linecap="round"/>`,
  drinks: `<path d="M20 6 H28 V12 C33 15 33 18 33 22 V42 H15 V22 C15 18 15 15 20 12 Z" fill="#2F8F4E"/>
    <rect x="20" y="4" width="8" height="4" rx="1" fill="#C0392B"/><rect x="15" y="24" width="18" height="9" fill="#C0392B"/>`,
  palmoil: `<path d="M19 6 H29 V11 C35 14 36 18 36 22 V42 H12 V22 C12 18 13 14 19 11 Z" fill="#E9EEF0" stroke="#B9C0C7" stroke-width="1.5"/>
    <path d="M13 22 H35 V41 H13 Z" fill="#D9531E"/><rect x="19" y="3" width="10" height="5" rx="1" fill="#F5B70A"/>`,
};

export function good(id, size = 32) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${GOOD_ART[id] || ''}</svg>`;
}

// Pictures for the levels page. 1 and 2 reuse the selling scenes; 3–7 are simple previews.
export function levelPicture(n) {
  if (n === 1) return scene(1, { cid: 'mamabola', stock: { rice: 1, garri: 1, water: 1, recharge: 1 } });
  if (n === 2) return scene(2, { cid: 'musa', stock: { rice: 1, bread: 1, drinks: 1, palmoil: 1 } });
  const sky = '<rect width="360" height="170" fill="#EAF2EC"/><rect y="140" width="360" height="30" fill="#CFC6B4"/>';
  const shop = (x, w, h, color, label) => `<rect x="${x}" y="${140 - h}" width="${w}" height="${h}" fill="#FFFFFF" stroke="#C3CEC6"/>
    <rect x="${x}" y="${140 - h}" width="${w}" height="16" fill="${color}"/>
    <text x="${x + w / 2}" y="${140 - h + 12}" text-anchor="middle" font-size="10" font-weight="800" font-family="system-ui,sans-serif" fill="#FFFFFF">${label}</text>
    <rect x="${x + w / 2 - 12}" y="${112}" width="24" height="28" fill="#0A5434"/>`;
  const person = (cid, x, y, size = 64) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">${face(cid, { size: 100 }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`;
  const pics = {
    3: `${sky}${shop(70, 220, 110, '#0E6B43', 'OGA SHOP')}${person('mrade', 100, 62)}${person('ngozi', 196, 62)}
      <rect x="80" y="118" width="200" height="22" fill="#A86B32"/><text x="180" y="160" text-anchor="middle" font-size="11" font-weight="700" font-family="system-ui,sans-serif" fill="#3C4A41">Your staff</text>`,
    4: `${sky}${shop(14, 100, 80, '#0E6B43', 'BRANCH 1')}${shop(130, 100, 96, '#0E6B43', 'MAIN')}${shop(246, 100, 80, '#0E6B43', 'BRANCH 2')}`,
    5: `${sky}${shop(40, 150, 100, '#0E6B43', 'OGA SHOP')}
      <g transform="translate(220 70)"><rect width="70" height="60" rx="6" fill="#E9EEF0" stroke="#8A939C" stroke-width="3"/><rect x="8" y="10" width="54" height="10" rx="2" fill="#8A939C"/>
      <text x="35" y="46" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui,sans-serif" fill="#3C4A41">FREEZER</text></g>
      <g fill="#F5B70A" stroke="#C98F00" stroke-width="2"><ellipse cx="310" cy="134" rx="14" ry="5"/><ellipse cx="310" cy="127" rx="14" ry="5"/><ellipse cx="310" cy="120" rx="14" ry="5"/></g>`,
    6: `${sky}<rect x="40" y="40" width="280" height="100" fill="#FFFFFF" stroke="#C3CEC6"/><rect x="40" y="40" width="280" height="22" fill="#0E6B43"/>
      <text x="180" y="56" text-anchor="middle" font-size="13" font-weight="800" font-family="system-ui,sans-serif" fill="#FFFFFF" letter-spacing="2">OGA SUPERMARKET</text>
      <rect x="60" y="76" width="70" height="40" fill="#CFE7F7"/><rect x="230" y="76" width="70" height="40" fill="#CFE7F7"/><rect x="155" y="90" width="50" height="50" fill="#0A5434"/>
      <path d="M262 128 h22 l-4 10 h-16 z" fill="none" stroke="#3C4A41" stroke-width="2"/>`,
    7: `${sky}<rect x="120" y="14" width="120" height="126" fill="#FFFFFF" stroke="#C3CEC6"/><rect x="40" y="62" width="80" height="78" fill="#F4F7F5" stroke="#C3CEC6"/><rect x="240" y="62" width="80" height="78" fill="#F4F7F5" stroke="#C3CEC6"/>
      <rect x="120" y="14" width="120" height="20" fill="#0E6B43"/><text x="180" y="28" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui,sans-serif" fill="#FFFFFF" letter-spacing="2">OGA MALL</text>
      ${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => `<rect x="${134 + c * 34}" y="${42 + r * 22}" width="22" height="14" fill="#CFE7F7"/>`).join('')).join('')}`,
  };
  return `<svg class="scene" viewBox="0 0 360 170" width="100%" style="display:block" aria-hidden="true">${pics[n] || sky}</svg>`;
}

// The selling place: a market table (Level 1) or a shop (Level 2), the goods in stock, and maybe a customer.
// Venue layers, drawn behind the seller: a crowd and umbrellas, mall glass and tiles, bazaar fabric and lanterns.
const PEOPLE = ['#7A4A2A', '#5C3A21', '#8D5B34', '#6B4226', '#9A6A43'];
const CLOTH = ['#E85D3F', '#2F80ED', '#F5B70A', '#7B4FB8', '#1E9E6A', '#D94F8A'];
function crowd(xs, y) {
  return xs.map((x, i) => `<g opacity=".8"><rect x="${x - 9}" y="${y + 14}" width="18" height="30" rx="8" fill="${CLOTH[i % CLOTH.length]}"/><circle cx="${x}" cy="${y + 7}" r="8" fill="${PEOPLE[i % PEOPLE.length]}"/></g>`).join('');
}
function venueBack(venue, level) {
  if (venue === 'mall') {
    return `<rect width="360" height="170" fill="#EEF2F6"/>
      <g stroke="#D5DCE3" stroke-width="1">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<path d="M${i * 45} 100 V170"/>`).join('')}<path d="M0 120 H360 M0 145 H360"/></g>
      <rect x="0" y="0" width="360" height="20" fill="#2B3A4A"/><text x="180" y="14" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui,sans-serif" fill="#FFFFFF" letter-spacing="3">SHOPPING MALL</text>
      <g><rect x="18" y="30" width="80" height="70" fill="#CFE6F5" stroke="#9FB3C4" stroke-width="3"/><path d="M58 30 V100" stroke="#9FB3C4" stroke-width="3"/>
        <rect x="262" y="30" width="80" height="70" fill="#CFE6F5" stroke="#9FB3C4" stroke-width="3"/><path d="M302 30 V100" stroke="#9FB3C4" stroke-width="3"/>
        <path d="M26 36 L44 58 M270 36 L288 58" stroke="#FFFFFF" stroke-width="4" opacity=".7"/></g>
      <g fill="#FFF7D6">${[60, 180, 300].map((x) => `<circle cx="${x}" cy="26" r="4"/>`).join('')}</g>`;
  }
  if (venue === 'bazaar') {
    const stripes = CLOTH.map((c, i) => `<rect x="${i * 60}" y="0" width="60" height="30" fill="${c}"/>`).join('');
    return `<rect width="360" height="170" fill="#FBEBD3"/>${stripes}
      <path d="M0 30 C30 46 60 46 90 30 C120 46 150 46 180 30 C210 46 240 46 270 30 C300 46 330 46 360 30" fill="none" stroke="#7A3E14" stroke-width="3"/>
      <g>${[40, 120, 240, 320].map((x, i) => `<path d="M${x} 36 V52" stroke="#7A3E14" stroke-width="2"/><circle cx="${x}" cy="60" r="8" fill="${['#F5B70A', '#E85D3F', '#F5B70A', '#E85D3F'][i]}"/><circle cx="${x}" cy="60" r="3" fill="#FFF7D6"/>`).join('')}</g>
      <g opacity=".75">${[[14, '#B5532A'], [300, '#7B4FB8']].map(([x, c]) => `<rect x="${x}" y="72" width="46" height="62" fill="${c}"/><path d="M${x} 82 H${x + 46} M${x} 96 H${x + 46} M${x} 110 H${x + 46}" stroke="#FFFFFF" stroke-width="2" opacity=".5"/>`).join('')}</g>`;
  }
  if (venue === 'night') {
    const bulbs = [20, 60, 100, 140, 180, 220, 260, 300, 340].map((x, i) => `<circle cx="${x}" cy="${26 + (i % 2) * 6}" r="5" fill="${['#FFE08A', '#FF9E6B', '#9FE3FF'][i % 3]}"/>`).join('');
    return `<rect width="360" height="170" fill="#1B2440"/>
      <circle cx="310" cy="58" r="14" fill="#FFF3C4"/><circle cx="304" cy="54" r="12" fill="#1B2440"/>
      <g fill="#FFFFFF" opacity=".7">${[[40, 60], [90, 80], [150, 52], [230, 70], [200, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6"/>`).join('')}</g>
      <path d="M0 22 Q90 42 180 22 Q270 42 360 22" fill="none" stroke="#3A4466" stroke-width="2"/>${bulbs}
      <path d="M20 40 V170 M340 40 V170" stroke="#4A3220" stroke-width="6"/>
      <g opacity=".6">${crowd([40, 70, 290, 320], 84)}</g>`;
  }
  if (venue === 'floating') {
    return `<rect width="360" height="170" fill="#D9F0FA"/>
      <path d="M0 22 H360" stroke="#8FC7E0" stroke-width="44" opacity=".35"/>
      <g fill="#7A4A2A"><rect x="18" y="60" width="6" height="80"/><rect x="336" y="60" width="6" height="80"/></g>
      <path d="M8 62 L44 44 L80 62 Z M280 62 L316 44 L352 62 Z" fill="#B5532A"/>
      <path d="M0 120 Q30 112 60 120 T120 120 T180 120 T240 120 T300 120 T360 120 V170 H0 Z" fill="#3D8FBF"/>
      <path d="M0 132 Q30 126 60 132 T120 132 T180 132 T240 132 T300 132 T360 132" fill="none" stroke="#FFFFFF" stroke-width="2" opacity=".5"/>`;
  }
  if (venue === 'wholesale') {
    const sacks = [[18, 98], [46, 98], [32, 72], [286, 98], [314, 98], [300, 72]].map(([x, y]) => `<path d="M${x} ${y + 40} Q${x - 2} ${y + 6} ${x + 6} ${y} H${x + 22} Q${x + 30} ${y + 6} ${x + 28} ${y + 40} Z" fill="#D9C39A" stroke="#A88B5C" stroke-width="2"/>`).join('');
    return `<rect width="360" height="170" fill="#E4E6E2"/>
      <path d="M0 0 H360 V30 H0 Z" fill="#9AA3A8"/><g stroke="#7C868C" stroke-width="2">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => `<path d="M${i * 30} 0 V30"/>`).join('')}</g>
      <rect x="0" y="30" width="360" height="6" fill="#6B757B"/>
      <text x="180" y="54" text-anchor="middle" font-size="11" font-weight="800" font-family="system-ui,sans-serif" fill="#55635A" letter-spacing="3">WHOLESALE</text>
      ${sacks}`;
  }
  if (venue === 'festive') {
    const flags = [10, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 340].map((x, i) => `<path d="M${x} ${14 + (i % 2) * 4} l12 0 l-6 14 Z" fill="${CLOTH[i % CLOTH.length]}"/>`).join('');
    return `<rect width="360" height="170" fill="#FFF2E0"/>
      <path d="M0 14 Q180 30 360 14" fill="none" stroke="#7A3E14" stroke-width="2"/>${flags}
      <g>${[[30, '#E85D3F'], [330, '#2F80ED']].map(([x, c]) => `<ellipse cx="${x}" cy="56" rx="11" ry="14" fill="${c}"/><path d="M${x} 70 V96" stroke="#55635A" stroke-width="1.5"/>`).join('')}</g>
      <g fill="#F5B70A">${[[80, 50], [280, 46], [180, 40]].map(([x, y]) => `<path d="M${x} ${y - 7} l2 5 h5 l-4 3 l2 5 l-5 -3 l-5 3 l2 -5 l-4 -3 h5 Z"/>`).join('')}</g>
      ${crowd([22, 50, 78, 282, 310, 338], 70)}`;
  }
  if (venue === 'open') {
    return `<rect width="360" height="170" fill="#FFF0D1"/>
      ${crowd([22, 52, 82, 278, 308, 338], 56)}${crowd([36, 66, 294, 324], 84)}
      <g>${[[60, '#E85D3F'], [300, '#2F80ED']].map(([x, c]) => `<path d="M${x - 46} 34 Q${x} -6 ${x + 46} 34 Z" fill="${c}"/><path d="M${x} 34 V64" stroke="#5C3A21" stroke-width="3"/>`).join('')}</g>
      <path d="M20 40 V170 M340 40 V170" stroke="#8B5A2B" stroke-width="6"/>`;
  }
  return null;
}

export function scene(level, { cid = null, mood = 'happy', stock = {}, height = 170, venue = null } = {}) {
  const shown = Object.keys(GOODS).filter((id) => GOODS[id].level <= level && stock[id] > 0).slice(0, 6);
  const slots = shown.length ? shown : [];
  const spacing = 300 / Math.max(slots.length, 1);
  const goodsRow = slots.map((id, i) => `<g transform="translate(${30 + i * spacing + (spacing - 44) / 2} 96)">${GOOD_ART[id] ? `<svg width="44" height="44" viewBox="0 0 48 48">${GOOD_ART[id]}</svg>` : ''}</g>`).join('');
  const back = level === 1
    ? `<rect width="360" height="170" fill="#FFF6DD"/>
       <path d="M0 0 H360 V36 C330 50 300 50 270 36 C240 50 210 50 180 36 C150 50 120 50 90 36 C60 50 30 50 0 36 Z" fill="#0E6B43"/>
       <path d="M45 0 V44 M135 0 V44 M225 0 V44 M315 0 V44" stroke="#FFFFFF" stroke-width="14" opacity=".9"/>
       <path d="M20 40 V170 M340 40 V170" stroke="#8B5A2B" stroke-width="6"/>`
    : `<rect width="360" height="170" fill="#EAF2EC"/>
       <rect x="0" y="0" width="360" height="22" fill="#0E6B43"/>
       <text x="180" y="16" text-anchor="middle" font-size="12" font-weight="800" font-family="system-ui,sans-serif" fill="#FFFFFF" letter-spacing="2">OGA SHOP</text>
       <g fill="#C9A26B"><rect x="16" y="46" width="90" height="5"/><rect x="16" y="84" width="90" height="5"/><rect x="254" y="46" width="90" height="5"/><rect x="254" y="84" width="90" height="5"/></g>
       <g opacity=".85">
         <svg x="22" y="18" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.noodles}</svg><svg x="54" y="18" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.drinks}</svg>
         <svg x="22" y="56" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.palmoil}</svg><svg x="54" y="56" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.bread}</svg>
         <svg x="262" y="18" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.rice}</svg><svg x="294" y="18" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.water}</svg>
         <svg x="262" y="56" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.garri}</svg><svg x="294" y="56" width="28" height="28" viewBox="0 0 48 48">${GOOD_ART.recharge}</svg>
       </g>`;
  const venueLayer = venueBack(venue, level);
  const person = cid && LOOKS[cid]
    ? `<g class="scene-customer" data-animate><svg x="125" y="${level === 1 ? 34 : 28}" width="110" height="110" viewBox="0 0 100 100">${face(cid, { mood, size: 100 }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg></g>`
    : '';
  const counter = level === 1
    ? '<rect x="10" y="140" width="340" height="30" fill="#A86B32"/><rect x="10" y="136" width="340" height="8" rx="2" fill="#C98848"/>'
    : '<rect x="0" y="140" width="360" height="30" fill="#0A5434"/><rect x="0" y="136" width="360" height="8" fill="#0E6B43"/>';
  const venueCounter = venue === 'mall' ? '<rect x="0" y="140" width="360" height="30" fill="#4A5868"/><rect x="0" y="136" width="360" height="8" fill="#6B7C8E"/>'
    : venue === 'bazaar' ? '<rect x="10" y="140" width="340" height="30" fill="#7A3E14"/><rect x="10" y="136" width="340" height="8" rx="2" fill="#B5532A"/>'
    : venue === 'night' ? '<rect x="10" y="140" width="340" height="30" fill="#4A3220"/><rect x="10" y="136" width="340" height="8" rx="2" fill="#6B4A2E"/>'
    : venue === 'floating' ? '<path d="M6 136 H354 L330 170 H30 Z" fill="#8B5A2B"/><rect x="6" y="134" width="348" height="8" rx="3" fill="#B07A45"/>'
    : venue === 'wholesale' ? '<rect x="0" y="140" width="360" height="30" fill="#8A9399"/><rect x="0" y="136" width="360" height="8" fill="#A8B0B5"/>'
    : venue === 'festive' ? '<rect x="10" y="140" width="340" height="30" fill="#B5532A"/><rect x="10" y="136" width="340" height="8" rx="2" fill="#E85D3F"/>' : counter;
  return `<svg class="scene" viewBox="0 0 360 170" width="100%" style="display:block;max-height:${height}px" aria-hidden="true">${venueLayer || back}${person}${venueLayer ? venueCounter : counter}${goodsRow}</svg>`;
}
