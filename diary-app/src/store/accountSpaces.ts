import type { Account, AccountSpace, AppState } from './types';
import { defaultState } from './storage';

export const accountSpaceKey = (account?: Account) => account ? `${account.remote ? 'cloud' : 'device'}:${account.id}` : 'guest';

export function captureSpace(s: AppState): AccountSpace {
  const { entries, tags, people, notebooks, reviews, profile, sync, conflicts, recentSearches, activeNotebook, backup } = s;
  return { entries, tags, people, notebooks, reviews, profile, sync, conflicts, recentSearches, activeNotebook, backup };
}

/** Switching identity never claims or uploads another identity's diary collection. */
export function switchAccount(s: AppState, account?: Account): AppState {
  const previous = accountSpaceKey(s.account);
  const next = accountSpaceKey(account);
  if (previous === next) return { ...s, account, usageMode: account ? 'account' : 'local' };
  const spaces = { ...s.accountSpaces, [previous]: captureSpace(s) };
  const restored = spaces[next] ?? captureSpace(defaultState());
  delete spaces[next];
  return { ...s, ...restored, account, accountSpaces: spaces,
    usageMode: account ? 'account' : 'local',
    sync: { ...restored.sync, cloud: !!account },
  };
}

export function allStoredEntries(s: AppState) {
  return [captureSpace(s), ...Object.values(s.accountSpaces ?? {})].flatMap(space => [...space.entries, ...space.conflicts.map(c => c.cloudEntry)]);
}
