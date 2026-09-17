/* --------------------------------------------------------------
   Arcade leaderboard, shared by every game in this cabinet.
   One store, keyed by game id, so a new minigame gets records,
   name entry and the "new record" notice for free.
   -------------------------------------------------------------- */
const KEY = 'arcade/v1';
const MAX = 10;

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
function write(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

export const Scores = {
  /** highest first, at most `n` */
  top(game, n = MAX) {
    const db = read();
    return (db.games?.[game] || []).slice(0, n);
  },

  best(game) { return this.top(game, 1)[0] || null; },

  /** the 1-based place this score would take, or null if it misses the board */
  rank(game, score) {
    if (score <= 0) return null;
    const list = this.top(game);
    let i = 0;
    while (i < list.length && list[i].score >= score) i++;
    return i < MAX ? i + 1 : null;
  },

  /** @returns {{rank:number, isRecord:boolean, list:Array}} */
  add(game, name, score) {
    const db = read();
    db.games = db.games || {};
    const list = db.games[game] || [];
    const entry = { name: (name || 'AAA').slice(0, 3).toUpperCase(), score, at: Date.now() };
    let i = 0;
    while (i < list.length && list[i].score >= score) i++;
    list.splice(i, 0, entry);
    db.games[game] = list.slice(0, MAX);
    db.lastName = entry.name;
    write(db);
    return { rank: i + 1, isRecord: i === 0, list: db.games[game], entry };
  },

  lastName() { return read().lastName || 'AAA'; },

  clear(game) {
    const db = read();
    if (db.games) delete db.games[game];
    write(db);
  }
};
