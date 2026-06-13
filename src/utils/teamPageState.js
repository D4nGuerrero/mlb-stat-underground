import { saveListScroll, restoreListScroll } from './listScrollRestore';

const PREFIX = 'mlbTeamPage:';

export function loadTeamPageState(teamId) {
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${teamId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTeamPageState(teamId, state) {
  try {
    const prev = loadTeamPageState(teamId) ?? {};
    sessionStorage.setItem(`${PREFIX}${teamId}`, JSON.stringify({ ...prev, ...state }));
  } catch {
    /* ignore */
  }
}

export function persistTeamPageLeave(teamId, state) {
  saveListScroll(`team:${teamId}`);
  saveTeamPageState(teamId, state);
}

export function restoreTeamPageScroll(teamId) {
  restoreListScroll(`team:${teamId}`);
}