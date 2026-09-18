/* --------------------------------------------------------------
   The cabinet's catalogue. One entry per game; the home screen, the
   settings rows, the soundtrack and the leaderboard all read from
   here, so adding a game means adding an object and a module.
   Modules are imported on demand, so the first screen stays small.
   -------------------------------------------------------------- */
export const GAMES = [
  {
    id: 'fruit-slash',
    kicker: 'FRUIT', name: 'SLASH',
    tagline: 'SWIPE TO SLICE',
    accent: '#ff5c8a',
    track: 'slash',
    options: ['duration', 'bombs', 'sound', 'music', 'speed'],
    art: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="fsA" cx="35%" cy="30%">
          <stop offset="0" stop-color="#ff9db0"/><stop offset="1" stop-color="#d92b47"/>
        </radialGradient>
      </defs>
      <path d="M6 40a26 26 0 0052 0z" fill="#2f8f3e"/>
      <path d="M9.5 40a22.5 22.5 0 0045 0z" fill="#f7f6d8"/>
      <path d="M13 40a19 19 0 0038 0z" fill="url(#fsA)"/>
      <g fill="#2a1a0c"><ellipse cx="24" cy="47" rx="2" ry="2.8"/><ellipse cx="32" cy="51" rx="2" ry="2.8"/><ellipse cx="40" cy="47" rx="2" ry="2.8"/></g>
      <path d="M4 30L60 12" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity=".92"/>
    </svg>`,
    load: () => import('./fruit-slash/index.js')
  },
  {
    id: 'asteroid-run',
    kicker: 'ASTEROID', name: 'RUN',
    tagline: 'TILT TO FLY',
    accent: '#6ad4ff',
    track: 'space',
    options: ['duration', 'sound', 'music', 'speed'],
    art: `<svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="arA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8fd2ff"/>
        </linearGradient>
      </defs>
      <circle cx="13" cy="15" r="2" fill="#fff" opacity=".75"/>
      <circle cx="52" cy="11" r="1.5" fill="#fff" opacity=".6"/>
      <circle cx="46" cy="47" r="1.6" fill="#fff" opacity=".5"/>
      <path d="M48 18a9 9 0 11-1 14l-5 3 1-6a9 9 0 015-11z" fill="#6b6f80"/>
      <circle cx="48" cy="24" r="2.3" fill="#4a4e5c"/><circle cx="43" cy="30" r="1.6" fill="#4a4e5c"/>
      <path d="M26 8c7 6 10 15 10 24H16c0-9 3-18 10-24z" fill="url(#arA)"/>
      <path d="M16 32l-8 10h10zM36 32l8 10H34z" fill="#ff5c8a"/>
      <circle cx="26" cy="21" r="4.5" fill="#1b2a5c"/><circle cx="26" cy="21" r="4.5" fill="none" stroke="#cfe9ff" stroke-width="1.4"/>
      <path d="M22 42h8l-4 12z" fill="#ffb648"/>
    </svg>`,
    load: () => import('./asteroid-run/index.js')
  }
];

export const byId = id => GAMES.find(g => g.id === id);
