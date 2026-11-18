/** Inline SVG icons for the menu (original line art, currentColor). */
const s = (body: string, fill = false): string =>
  `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${body}</svg>`;

export const ICON = {
  play: s('<path d="M7 4l13 8-13 8z"/>', true),
  agents: s('<path d="M13 2l6 6-6 6-6-6z" fill="currentColor"/><path d="M6 13l4 4-4 4-4-4z"/>'),
  arsenal: s('<path d="M3 6h18v12H3z"/><path d="M3 10h18M9 6v12"/><path d="M13 14h5"/>'),
  maps: s('<path d="M3 5l5 7-5 7M10 5l5 7-5 7"/><path d="M18 9l3 3-3 3"/>'),
  career: s('<path d="M3 20l6-7 4 4 8-10"/><path d="M16 7h5v5"/>'),
  store: s('<path d="M5 8h14l-1.5 12h-11z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M17 3l3 3"/>'),
  social: s('<path d="M7 4l8 8-8 8"/><path d="M13 4l8 8-8 8" opacity=".45"/>'),
  gear: s('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  help: s('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),
  shard: s('<path d="M3 5h18l-9 15z"/><path d="M8 8.5l4 6 4-6"/>'),
  token: s('<path d="M8 3l-3 18M16 3l3 18M5.5 9h13M6 15h12"/><path d="M12 3v18" opacity=".5"/>'),
  compass: s('<circle cx="12" cy="12" r="9"/><path d="M16 8l-2.5 5.5L8 16l2.5-5.5z" fill="currentColor"/>'),
  diamond: s('<path d="M12 2l10 10-10 10L2 12z"/><path d="M12 7l5 5-5 5-5-5z" fill="currentColor"/>'),
  enter: s('<path d="M4 12h12M10 7l-6 5 6 5"/><path d="M20 4v8"/>'),
  esc: s('<path d="M3 6h18v12H3z"/><path d="M7 10v4h3M7 12h2M14 10h-2v2h2v2h-2M18 10h-2v4h2"/>'),
  tab: s('<path d="M3 6h18v12H3z"/><path d="M6 12h9M12 9l3 3-3 3M18 9v6"/>'),
  f1: s('<path d="M3 6h18v12H3z"/><path d="M8 15V9h3M8 12h2M14 10l2-1v6"/>'),
};

/** Original brand mark: two broken blades with a spark between them. */
export const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M6 6 L29 27 L21 58 L16 31 Z" fill="#ece6ef"/>
  <path d="M58 6 L35 30 L43 58 L47 33 Z" fill="#ece6ef"/>
  <path d="M10 12 L26 27" stroke="#0b0a0f" stroke-width="2"/>
  <path d="M30 33 L34 33 L32 46 Z" fill="#ff5fa8"/>
</svg>`;

export const TRIANGLE = `<svg class="tri" viewBox="0 0 28 26" aria-hidden="true">
  <path d="M2 3h24L14 23z" fill="none" stroke="#ff5fa8" stroke-width="2"/>
  <path d="M9 7h10l-5 9z" fill="#ff5fa8" opacity=".6"/>
</svg>`;

/** Ink-brush wraith on the left edge (abstract, roughened by turbulence). */
export const SPIRIT = `<svg class="mm-spirit no-hit" viewBox="0 0 200 520" aria-hidden="true">
  <defs>
    <filter id="mm-ink" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="4"/>
      <feDisplacementMap in="SourceGraphic" scale="22"/>
    </filter>
    <linearGradient id="mm-ink-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3dae0" stop-opacity=".95"/>
      <stop offset=".7" stop-color="#b9adb6" stop-opacity=".55"/>
      <stop offset="1" stop-color="#6d6370" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g filter="url(#mm-ink)">
    <path d="M96 14 C 120 70, 150 110, 142 180 C 136 236, 162 300, 150 370 C 142 430, 118 480, 96 520 L 0 520 L 0 170 C 30 140, 66 96, 96 14 Z" fill="url(#mm-ink-fade)"/>
    <path d="M70 120 C 90 150, 120 150, 128 200 C 132 250, 110 300, 112 360" stroke="#0b0a0f" stroke-width="6" fill="none" opacity=".55"/>
    <ellipse cx="104" cy="212" rx="13" ry="24" fill="#0b0a0f"/>
    <ellipse cx="72" cy="230" rx="7" ry="11" fill="#0b0a0f" opacity=".85"/>
  </g>
</svg>`;

export const SKYLINE = `<svg class="skyline no-hit" viewBox="0 0 268 70" preserveAspectRatio="none" aria-hidden="true">
  <path fill="#3a3340" d="M0 70V44h12V30h10v14h8V20h6v-8h4v8h6v50h6V36h14v-6h8v40h10V16h4V6h2v10h4v54h8V40h12v30h6V26h10v-8h6v52h10V34h8v36h6V46h14V30h8v40h8V22h4v-6h4v54h10V40h12v30z"/>
  <path fill="#ff5fa8" opacity=".5" d="M64 40h2v2h-2zM98 26h2v2h-2zM150 30h2v2h-2zM210 34h2v2h-2zM120 50h2v2h-2z"/>
</svg>`;
