/* Word Kick — shirts, players, keepers, the goal, crests and trophies, drawn
   as inline SVG. No image files, so the game stays small and works offline.
   Movement is done in main.js with the Web Animations API. */

let uid = 0;
const nextId = p => `${p}${++uid}`;

/* Stripes, hoops, checks or a sash in `alt`, clipped to whatever shape
   `clipId` points at. The box is the area to cover. */
function patternLayer(kit, clipId, { x, y, w, h }) {
  const a = kit.alt;
  let marks = '';
  if (kit.pattern === 'stripes') {
    const step = w / 5;
    for (let i = 0; i < 5; i++) marks += `<rect x="${x + i * step + step * 0.25}" y="${y}" width="${step * 0.5}" height="${h}" fill="${a}"/>`;
  } else if (kit.pattern === 'hoops') {
    const step = h / 6;
    for (let i = 0; i < 6; i += 2) marks += `<rect x="${x}" y="${y + i * step}" width="${w}" height="${step}" fill="${a}"/>`;
  } else if (kit.pattern === 'checks') {
    const n = 6, sw = w / n, sh = sw;
    for (let r = 0; r * sh < h; r++) for (let c = 0; c < n; c++) {
      if ((r + c) % 2) marks += `<rect x="${x + c * sw}" y="${y + r * sh}" width="${sw}" height="${sh}" fill="${a}"/>`;
    }
  } else if (kit.pattern === 'sash') {
    marks = `<path d="M${x} ${y + h * 0.05} L${x + w * 0.25} ${y} L${x + w} ${y + h * 0.75} L${x + w} ${y + h} Z" fill="${a}"/>`;
  }
  return marks ? `<g clip-path="url(#${clipId})">${marks}</g>` : '';
}

/* Front of a shirt, for the kit picker and the scoreboard. */
const SHIRT = 'M30 10 L42 6 Q50 14 58 6 L70 10 L92 26 L82 42 L72 36 L72 92 L28 92 L28 36 L18 42 L8 26 Z';
export function shirtSVG(kit, { number = '', cls = 'shirt-svg' } = {}) {
  const clip = nextId('sh');
  const trim = kit.pattern === 'solid' ? kit.alt : kit.shirt;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><clipPath id="${clip}"><path d="${SHIRT}"/></clipPath></defs>
    <path d="${SHIRT}" fill="${kit.shirt}"/>
    ${patternLayer(kit, clip, { x: 8, y: 6, w: 84, h: 86 })}
    <path d="M42 6 Q50 14 58 6" stroke="${trim}" stroke-width="4" fill="none"/>
    <path d="M92 26 L82 42 M8 26 L18 42" stroke="${trim}" stroke-width="4"/>
    <path d="${SHIRT}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
    ${number !== '' ? `<text x="50" y="66" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="30" fill="${kit.num}" stroke="rgba(0,0,0,.25)" stroke-width="1">${number}</text>` : ''}
  </svg>`;
}

/* A player seen from behind, taking the kick: name and number on the back.
   `kit` is a player kit (from KITS) or a team kit with shirt/trim/shorts. */
export function shooterSVG(kit, { number = 10, name = '', skin = '#e8b98f', hair = '#3b2314' } = {}) {
  const k = normalizeKit(kit);
  const clip = nextId('bk');
  const torso = 'M26 58 Q30 50 44 48 L76 48 Q90 50 94 58 L108 90 L96 96 L88 80 L86 134 L34 134 L32 80 L24 96 L12 90 Z';
  const label = String(name).toUpperCase().slice(0, 10);
  return `<svg class="shooter-svg" viewBox="0 0 120 230" aria-hidden="true">
    <defs><clipPath id="${clip}"><path d="${torso}"/></clipPath></defs>
    <rect x="40" y="150" width="15" height="52" rx="6" fill="${skin}"/>
    <rect x="65" y="150" width="15" height="52" rx="6" fill="${skin}"/>
    <rect x="39" y="176" width="17" height="38" rx="5" fill="${k.socks}"/>
    <rect x="64" y="176" width="17" height="38" rx="5" fill="${k.socks}"/>
    <path d="M36 212 h22 v10 h-26 Z M62 212 h22 l4 10 h-26 Z" fill="#111827"/>
    <path d="M32 128 L88 128 L92 162 L62 162 L60 148 L58 162 L28 162 Z" fill="${k.shorts}"/>
    <path d="M24 96 L14 128 M96 96 L106 128" stroke="${skin}" stroke-width="11" stroke-linecap="round"/>
    <path d="${torso}" fill="${k.shirt}"/>
    ${patternLayer(k, clip, { x: 12, y: 48, w: 96, h: 86 })}
    <path d="${torso}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2"/>
    <rect x="50" y="40" width="20" height="12" fill="${skin}"/>
    <ellipse cx="60" cy="28" rx="19" ry="21" fill="${hair}"/>
    <ellipse cx="41" cy="31" rx="4" ry="6" fill="${skin}"/><ellipse cx="79" cy="31" rx="4" ry="6" fill="${skin}"/>
    ${label ? `<text x="60" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="${label.length > 7 ? 7 : 9}" fill="${k.num}">${escSvg(label)}</text>` : ''}
    <text x="60" y="110" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="34" fill="${k.num}" stroke="rgba(0,0,0,.25)" stroke-width="1">${Number(number) || ''}</text>
  </svg>`;
}

/* A keeper facing the camera, arms out, big gloves. */
export function keeperSVG({ shirt, alt = null, pattern = 'solid', shorts = '#111827', socks = null, gloves = '#f8fafc', skin = '#e8b98f', hair = '#3b2314', number = 1, num = '#fff' }) {
  const clip = nextId('gk');
  const torso = 'M48 62 Q52 54 64 52 L96 52 Q108 54 112 62 L114 120 L46 120 Z';
  const kit = { shirt, alt: alt || shirt, pattern };
  return `<svg class="keeper-svg" viewBox="0 0 160 180" aria-hidden="true">
    <defs><clipPath id="${clip}"><path d="${torso}"/></clipPath></defs>
    <rect x="56" y="136" width="16" height="40" rx="6" fill="${socks || shirt}"/>
    <rect x="88" y="136" width="16" height="40" rx="6" fill="${socks || shirt}"/>
    <path d="M52 174 h22 v6 h-24 Z M86 174 h22 l2 6 h-24 Z" fill="#111827"/>
    <path d="M46 116 L114 116 L116 144 L82 144 L80 132 L78 144 L44 144 Z" fill="${shorts}"/>
    <path d="M50 64 Q30 60 18 36 M110 64 Q130 60 142 36" stroke="${shirt}" stroke-width="15" stroke-linecap="round" fill="none"/>
    <g class="gk-glove"><ellipse cx="16" cy="30" rx="14" ry="16" fill="${gloves}" stroke="rgba(0,0,0,.3)" stroke-width="2"/>
      <ellipse cx="144" cy="30" rx="14" ry="16" fill="${gloves}" stroke="rgba(0,0,0,.3)" stroke-width="2"/></g>
    <path d="${torso}" fill="${shirt}"/>
    ${patternLayer(kit, clip, { x: 46, y: 52, w: 68, h: 68 })}
    <path d="${torso}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2"/>
    <text x="80" y="102" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="24" fill="${num}">${number}</text>
    <rect x="72" y="42" width="16" height="12" fill="${skin}"/>
    <ellipse cx="80" cy="28" rx="18" ry="20" fill="${skin}"/>
    <path d="M62 24 Q64 6 80 6 Q96 6 98 24 Q90 14 80 14 Q70 14 62 24Z" fill="${hair}"/>
    <circle cx="73" cy="28" r="3" fill="#111"/><circle cx="87" cy="28" r="3" fill="#111"/>
    <path d="M73 38 Q80 42 87 38" stroke="#5b2a1a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/* The player's own keeper: their kit, bright gloves. */
export function myKeeperSVG(kit) {
  return keeperSVG({ shirt: kit.shirt, alt: kit.alt, pattern: kit.pattern, shorts: kit.shorts, socks: kit.socks, gloves: '#facc15', num: kit.num, hair: '#3b2314' });
}

/* A rival team's keeper, in their keeper color. */
export function rivalKeeperSVG(team) {
  const dark = isLight(team.gk) ? '#111827' : '#ffffff';
  return keeperSVG({ shirt: team.gk, shorts: '#111827', gloves: '#f8fafc', skin: team.skin, hair: team.hair, num: dark });
}

export function ballSVG() {
  return `<svg class="ball-svg" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18" fill="#fff" stroke="#111" stroke-width="2"/>
    <path d="M20 12 L27 17 L24 25 L16 25 L13 17 Z" fill="#111"/>
    <path d="M20 12 L20 3 M27 17 L36 14 M24 25 L29 33 M16 25 L11 33 M13 17 L4 14" stroke="#111" stroke-width="2"/>
  </svg>`;
}

/* The goal, from the penalty spot: posts, bar and net. */
export function goalSVG() {
  let net = '';
  for (let x = 14; x < 290; x += 12) net += `M${x} 10 L${x + (x - 150) * 0.06} 104 `;
  for (let y = 18; y < 104; y += 10) net += `M10 ${y} L290 ${y} `;
  return `<svg class="goal-svg" viewBox="0 0 300 110" preserveAspectRatio="none" aria-hidden="true">
    <rect x="8" y="8" width="284" height="98" fill="rgba(255,255,255,.08)"/>
    <path class="net" d="${net}" stroke="rgba(255,255,255,.45)" stroke-width="1" fill="none"/>
    <path d="M6 108 L6 6 L294 6 L294 108" stroke="#f8fafc" stroke-width="7" fill="none" stroke-linejoin="round"/>
    <path d="M6 108 L6 6 L294 6 L294 108" stroke="rgba(0,0,0,.2)" stroke-width="1.5" fill="none" transform="translate(2 2)"/>
  </svg>`;
}

/* A team crest: a shield in their colors with their initials. */
export function crestSVG(team) {
  const initials = team.name.replace(/\bFC\b/, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2);
  const k = team.kit;
  return `<svg class="crest-svg" viewBox="0 0 60 70" aria-hidden="true">
    <path d="M30 3 L56 12 L54 42 Q50 60 30 67 Q10 60 6 42 L4 12 Z" fill="${k.shirt}" stroke="${k.trim}" stroke-width="4"/>
    <path d="M6 30 L54 30 L54 38 L6 38 Z" fill="${k.trim}" opacity=".85"/>
    <text x="30" y="${team.champion ? 58 : 56}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="15" fill="${k.num}">${escSvg(initials)}</text>
    ${team.champion ? `<path d="M22 10 L25 20 L30 12 L35 20 L38 10 L38 24 L22 24Z" fill="#facc15" stroke="#a16207" stroke-width="1"/>` : ''}
  </svg>`;
}

const TROPHY_COLORS = {
  local:       { cup: '#d6a35c', edge: '#8a5a1c', base: '#1d4ed8' },
  continental: { cup: '#e5e7eb', edge: '#6b7280', base: '#b91c1c' },
  golden:      { cup: '#facc15', edge: '#a16207', base: '#111827' },
};

export function trophySVG(cupId, { small = false, grade = '' } = {}) {
  const c = TROPHY_COLORS[cupId] || TROPHY_COLORS.local;
  const label = { local: 'LOCAL', continental: 'CONT.', golden: 'GOLD' }[cupId] || '';
  return `<svg class="trophy-svg${small ? ' small' : ''}" viewBox="0 0 120 150" aria-hidden="true">
    <path d="M28 18 Q6 18 8 40 Q10 62 36 66" stroke="${c.cup}" stroke-width="7" fill="none"/>
    <path d="M92 18 Q114 18 112 40 Q110 62 84 66" stroke="${c.cup}" stroke-width="7" fill="none"/>
    <path d="M24 10 L96 10 Q96 70 60 84 Q24 70 24 10Z" fill="${c.cup}" stroke="${c.edge}" stroke-width="3"/>
    <path d="M36 16 Q38 52 56 70" stroke="rgba(255,255,255,.55)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <rect x="52" y="82" width="16" height="22" fill="${c.cup}" stroke="${c.edge}" stroke-width="2"/>
    <rect x="30" y="104" width="60" height="12" rx="3" fill="${c.cup}" stroke="${c.edge}" stroke-width="2"/>
    <rect x="22" y="116" width="76" height="28" rx="4" fill="${c.base}"/>
    <text x="60" y="${grade ? 128 : 135}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="11" fill="#fff">${label}</text>
    ${grade ? `<text x="60" y="140" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="9" fill="#fff">GRADE ${grade}</text>` : ''}
    <path d="M60 30 l4 9 10 1 -8 6 3 10 -9 -6 -9 6 3 -10 -8 -6 10 -1Z" fill="${c.edge}" opacity=".6"/>
  </svg>`;
}

/* ------------------------------------------------------------ helpers -- */
function normalizeKit(kit) {
  if (kit.pattern) return kit;
  // A rival team's kit: plain shirt with their trim.
  return { shirt: kit.shirt, alt: kit.trim, pattern: 'solid', shorts: kit.shorts, socks: kit.shirt, num: kit.num };
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function escSvg(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
