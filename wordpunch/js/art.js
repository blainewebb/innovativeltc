/* Word Punch — the fighters, the player and the belts, drawn as inline SVG.
   No image files, so the whole game stays a few hundred kilobytes of text
   and works offline. Animation is CSS on the classes used here. */

const HAIR = {
  none: c => `<path d="M62 70 Q70 38 100 36 Q130 38 138 70 Q128 54 100 52 Q72 54 62 70Z" fill="${c}"/>`,
  mustache: c => `<path d="M60 76 Q62 36 100 34 Q138 36 140 76 Q132 50 100 48 Q68 50 60 76Z" fill="${c}"/>`,
  bow: c => `<path d="M56 96 Q52 34 100 30 Q148 34 144 96 Q140 60 128 54 Q100 44 72 54 Q60 60 56 96Z" fill="${c}"/>`,
  glasses: c => `<path d="M60 70 Q64 44 80 50 Q84 38 100 44 Q116 38 120 50 Q136 44 140 70 Q128 58 100 56 Q72 58 60 70Z" fill="${c}"/>`,
};

const ACC = {
  none: () => '',
  mustache: c => `<path d="M78 112 Q90 104 100 110 Q110 104 122 112 Q112 120 100 114 Q88 120 78 112Z" fill="${c}"/>`,
  cap: () => `<path d="M60 70 Q62 36 100 34 Q138 36 140 70Z" fill="#1d4ed8"/>
    <path d="M58 70 L160 70 Q162 78 150 78 L58 76Z" fill="#1e3a8a"/>
    <text x="100" y="62" text-anchor="middle" font-size="20" font-weight="900" fill="#fff" font-family="Arial,sans-serif">A</text>`,
  beanie: () => `<path d="M60 74 Q60 30 100 30 Q140 30 140 74Z" fill="#334155"/>
    <rect x="58" y="66" width="84" height="12" rx="5" fill="#475569"/>
    <circle cx="100" cy="28" r="8" fill="#94a3b8"/>`,
  bow: () => `<path d="M112 44 L128 34 L128 56Z M112 44 L96 34 L96 56Z" fill="#facc15" transform="translate(12 -6)"/>
    <circle cx="124" cy="39" r="5" fill="#eab308"/>`,
  tophat: () => `<rect x="70" y="8" width="60" height="44" rx="4" fill="#111827"/>
    <rect x="70" y="40" width="60" height="7" fill="#b91c1c"/>
    <rect x="56" y="48" width="88" height="9" rx="4" fill="#111827"/>`,
  glasses: () => `<g fill="rgba(255,255,255,.25)" stroke="#111" stroke-width="3">
    <circle cx="84" cy="88" r="11"/><circle cx="116" cy="88" r="11"/></g>
    <path d="M95 88 L105 88" stroke="#111" stroke-width="3"/>`,
  crown: () => `<path d="M64 52 L70 18 L86 38 L100 12 L114 38 L130 18 L136 52Z" fill="#facc15" stroke="#a16207" stroke-width="2"/>
    <circle cx="100" cy="30" r="4" fill="#dc2626"/><circle cx="78" cy="40" r="3" fill="#2563eb"/><circle cx="122" cy="40" r="3" fill="#16a34a"/>`,
};

const BROWS = {
  worried: `<path d="M72 74 L92 70 M108 70 L128 74" stroke="#2a1a10" stroke-width="4" stroke-linecap="round"/>`,
  flat: `<path d="M72 72 L92 72 M108 72 L128 72" stroke="#2a1a10" stroke-width="4" stroke-linecap="round"/>`,
  angry: `<path d="M72 68 L92 76 M108 76 L128 68" stroke="#2a1a10" stroke-width="5" stroke-linecap="round"/>`,
};

/* The opponent, facing the camera, gloves up. */
export function fighterSVG(f, { id = '' } = {}) {
  const L = f.look;
  const hair = (HAIR[L.acc] || HAIR.none)(L.hair);
  const acc = (ACC[L.acc] || ACC.none)(L.hair);
  const shade = 'rgba(0,0,0,.12)';
  return `<svg class="fighter-svg" ${id ? `id="${id}"` : ''} viewBox="0 0 200 270" aria-hidden="true">
  <g class="f-body">
    <rect x="86" y="120" width="28" height="26" fill="${L.skin}"/>
    <path d="M36 170 Q40 142 100 138 Q160 142 164 170 L152 236 L48 236Z" fill="${L.skin}"/>
    <path d="M100 150 L100 220" stroke="${shade}" stroke-width="3"/>
    <path d="M70 176 Q84 186 98 176 M102 176 Q116 186 130 176" stroke="${shade}" stroke-width="3" fill="none"/>
    <rect x="44" y="230" width="112" height="40" rx="6" fill="${L.trunks}"/>
    <rect x="44" y="230" width="112" height="8" fill="rgba(255,255,255,.55)"/>
  </g>
  <g class="f-head">
    <circle cx="60" cy="94" r="9" fill="${L.skin}"/><circle cx="140" cy="94" r="9" fill="${L.skin}"/>
    <ellipse cx="100" cy="90" rx="40" ry="46" fill="${L.skin}"/>
    ${hair}
    <g class="face-ok">
      ${BROWS[L.brow] || BROWS.flat}
      <ellipse cx="84" cy="88" rx="7" ry="8" fill="#fff"/><ellipse cx="116" cy="88" rx="7" ry="8" fill="#fff"/>
      <circle class="pupil" cx="85" cy="89" r="4" fill="#111"/><circle class="pupil" cx="117" cy="89" r="4" fill="#111"/>
      <path d="M86 118 Q100 124 114 116" stroke="#5b2a1a" stroke-width="4" fill="none" stroke-linecap="round"/>
    </g>
    <g class="face-hurt">
      <path d="M76 82 L92 94 M92 82 L76 94 M108 82 L124 94 M124 82 L108 94" stroke="#111" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="100" cy="118" rx="9" ry="11" fill="#5b1a1a"/>
    </g>
    <path d="M98 96 Q94 106 100 108" stroke="${shade}" stroke-width="3" fill="none"/>
    ${acc}
  </g>
  <g class="f-arm f-arm-l">
    <path d="M44 170 Q30 200 56 190" stroke="${L.skin}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <g class="glove glove-l"><ellipse cx="62" cy="178" rx="26" ry="24" fill="${L.gloves}"/>
      <ellipse cx="54" cy="170" rx="8" ry="6" fill="rgba(255,255,255,.4)"/>
      <rect x="44" y="196" width="36" height="10" rx="4" fill="#fff"/></g>
  </g>
  <g class="f-arm f-arm-r">
    <path d="M156 170 Q170 200 144 190" stroke="${L.skin}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <g class="glove glove-r"><ellipse cx="138" cy="178" rx="26" ry="24" fill="${L.gloves}"/>
      <ellipse cx="130" cy="170" rx="8" ry="6" fill="rgba(255,255,255,.4)"/>
      <rect x="120" y="196" width="36" height="10" rx="4" fill="#fff"/></g>
  </g>
</svg>`;
}

/* Just the head, for ladder cards. */
export function faceSVG(f) {
  const L = f.look;
  const hair = (HAIR[L.acc] || HAIR.none)(L.hair);
  const acc = (ACC[L.acc] || ACC.none)(L.hair);
  return `<svg class="face-svg" viewBox="40 0 120 140" aria-hidden="true">
    <circle cx="60" cy="94" r="9" fill="${L.skin}"/><circle cx="140" cy="94" r="9" fill="${L.skin}"/>
    <ellipse cx="100" cy="90" rx="40" ry="46" fill="${L.skin}"/>
    ${hair}
    ${BROWS[L.brow] || BROWS.flat}
    <ellipse cx="84" cy="88" rx="7" ry="8" fill="#fff"/><ellipse cx="116" cy="88" rx="7" ry="8" fill="#fff"/>
    <circle cx="85" cy="89" r="4" fill="#111"/><circle cx="117" cy="89" r="4" fill="#111"/>
    <path d="M86 118 Q100 124 114 116" stroke="#5b2a1a" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${acc}
  </svg>`;
}

let uid = 0;

/* What shows on top of the player's head from behind. */
const HATS = {
  none: () => '',
  headband: c => `<rect x="112" y="62" width="76" height="12" rx="4" fill="${c}"/>
    <path d="M150 72 Q160 92 170 100 M150 72 Q146 94 140 104" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  mohawk: (c, hair) => `<path d="M138 50 L142 30 L148 46 L152 26 L156 46 L162 30 L164 52 Z" fill="${hair}"/>
    <rect x="140" y="44" width="22" height="30" rx="8" fill="${hair}"/>`,
  bun: (c, hair) => `<circle cx="150" cy="44" r="16" fill="${hair}"/><rect x="138" y="54" width="24" height="7" rx="3" fill="${c}"/>`,
  crown: () => `<path d="M122 52 L126 26 L138 40 L150 20 L162 40 L174 26 L178 52Z" fill="#facc15" stroke="#a16207" stroke-width="2"/>
    <circle cx="150" cy="34" r="4" fill="#dc2626"/>`,
  beanie: c => `<path d="M111 80 Q110 40 150 38 Q190 40 189 80Z" fill="${c}"/><rect x="109" y="72" width="82" height="12" rx="5" fill="rgba(0,0,0,.25)"/>
    <circle cx="150" cy="36" r="8" fill="#f8fafc"/>`,
};

/* The player, seen from behind like the classic arcade view: back of the
   head, shoulders, and two big gloves. `look` is a playable character's
   { skin, hair, hat, band } and `style` special gloves { a, b } from the
   Prize Room. */
export function playerSVG(gloves = '#22c55e', look = {}, style = null) {
  const skin = look.skin || '#e8b98f';
  const hair = look.hair || '#3b2314';
  const hat = (HATS[look.hat] || HATS.none)(look.band || '#ef4444', hair);
  const gid = `pgl${++uid}`;
  const fill = style ? `url(#${gid})` : gloves;
  return `<svg class="player-svg" viewBox="0 0 300 170" aria-hidden="true">
  ${style ? `<defs><radialGradient id="${gid}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${style.a}"/><stop offset="1" stop-color="${style.b}"/></radialGradient></defs>` : ''}
  <path d="M60 170 Q70 112 150 104 Q230 112 240 170Z" fill="${skin}"/>
  <path d="M150 116 L150 170" stroke="rgba(0,0,0,.12)" stroke-width="4"/>
  <g class="p-head"><ellipse cx="150" cy="84" rx="38" ry="42" fill="${hair}"/>
    <ellipse cx="112" cy="88" rx="7" ry="10" fill="${skin}"/><ellipse cx="188" cy="88" rx="7" ry="10" fill="${skin}"/>${hat}</g>
  <g class="pg pg-l"><ellipse cx="72" cy="120" rx="40" ry="36" fill="${fill}"/>
    <ellipse cx="60" cy="106" rx="12" ry="8" fill="rgba(255,255,255,.4)"/>
    <rect x="44" y="146" width="56" height="16" rx="6" fill="#fff"/></g>
  <g class="pg pg-r"><ellipse cx="228" cy="120" rx="40" ry="36" fill="${fill}"/>
    <ellipse cx="216" cy="106" rx="12" ry="8" fill="rgba(255,255,255,.4)"/>
    <rect x="200" y="146" width="56" height="16" rx="6" fill="#fff"/></g>
</svg>`;
}

const BELT_COLORS = {
  minor: { strap: '#1d4ed8', plate: '#d6a35c', edge: '#8a5a1c' },
  major: { strap: '#b91c1c', plate: '#e5e7eb', edge: '#6b7280' },
  world: { strap: '#111827', plate: '#facc15', edge: '#a16207' },
};

export function beltSVG(circuitId, { small = false, grade = '' } = {}) {
  const c = BELT_COLORS[circuitId] || BELT_COLORS.minor;
  return `<svg class="belt-svg${small ? ' small' : ''}" viewBox="0 0 240 110" aria-hidden="true">
    <rect x="0" y="36" width="240" height="38" rx="10" fill="${c.strap}"/>
    <rect x="0" y="44" width="240" height="4" fill="rgba(255,255,255,.25)"/>
    <rect x="0" y="62" width="240" height="4" fill="rgba(255,255,255,.25)"/>
    <circle cx="36" cy="55" r="14" fill="${c.plate}" stroke="${c.edge}" stroke-width="3"/>
    <circle cx="204" cy="55" r="14" fill="${c.plate}" stroke="${c.edge}" stroke-width="3"/>
    <ellipse cx="120" cy="55" rx="58" ry="50" fill="${c.plate}" stroke="${c.edge}" stroke-width="5"/>
    <ellipse cx="120" cy="55" rx="44" ry="37" fill="none" stroke="${c.edge}" stroke-width="2"/>
    <text x="120" y="${grade ? 52 : 64}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${circuitId === 'world' ? 22 : 18}" fill="${c.edge}">${circuitId === 'world' ? 'CHAMP' : circuitId.toUpperCase()}</text>
    ${grade ? `<text x="120" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="14" fill="${c.edge}">GRADE ${grade}</text>` : ''}
  </svg>`;
}

/* Little pictures for gear in the Prize Room. */
export function gearSVG(g) {
  const id = `gear${++uid}`;
  if (g.slot === 'gloves') {
    return `<svg class="gear-svg" viewBox="0 0 80 70" aria-hidden="true">
      <defs><radialGradient id="${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${g.a}"/><stop offset="1" stop-color="${g.b}"/></radialGradient></defs>
      <ellipse cx="40" cy="30" rx="28" ry="26" fill="url(#${id})" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
      <ellipse cx="30" cy="20" rx="8" ry="5" fill="rgba(255,255,255,.45)"/>
      <rect x="20" y="52" width="40" height="12" rx="4" fill="#fff"/></svg>`;
  }
  if (g.slot === 'ropes') {
    return `<svg class="gear-svg" viewBox="0 0 80 60" aria-hidden="true">
      <rect x="6" y="6" width="8" height="50" rx="3" fill="#cbd5e1"/><rect x="66" y="6" width="8" height="50" rx="3" fill="#cbd5e1"/>
      ${[16, 30, 44].map(y => `<rect x="10" y="${y}" width="60" height="6" rx="3" fill="${y === 30 ? g.b : g.a}"/>`).join('')}</svg>`;
  }
  const pose = { dance: 'rotate(-15 40 32)', spin: 'rotate(20 40 32)', flex: '' }[g.move] || '';
  return `<svg class="gear-svg" viewBox="0 0 80 64" aria-hidden="true">
    <path d="M40 2 L47 22 L70 16 L54 32 L70 48 L47 42 L40 62 L33 42 L10 48 L26 32 L10 16 L33 22 Z" fill="#facc15" opacity=".35"/>
    <g transform="${pose}"><circle cx="40" cy="20" r="7" fill="#f8fafc"/>
      <path d="M40 27 L40 44 M40 44 L32 58 M40 44 L48 58 M40 30 L28 20 M40 30 L52 20" stroke="#f8fafc" stroke-width="4" stroke-linecap="round"/>
      <circle cx="26" cy="16" r="6" fill="#ef4444"/><circle cx="54" cy="16" r="6" fill="#ef4444"/></g></svg>`;
}
