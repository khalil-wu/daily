import { useMemo } from 'react';

import {
  canRevealPrivateMemories,
  decoratePeopleWithVisibleMemoryStats,
  getDisplayMemories,
  getDisplayPeople,
  lockedPersonIdsOf,
} from '@/src/privacy/memoryVisibility';
import { useAppLockStore } from '@/src/stores/useAppLockStore';
import { useDiaryStore } from '@/src/stores/useDiaryStore';

export function useVisibleDiaryData() {
  const people = useDiaryStore((state) => state.people);
  const memories = useDiaryStore((state) => state.memories);
  const appLockEnabled = useAppLockStore((state) => state.appLockEnabled);
  const locked = useAppLockStore((state) => state.locked);
  const canRevealPrivate = canRevealPrivateMemories(appLockEnabled, locked);
  const lockedPersonIds = useMemo(() => lockedPersonIdsOf(people), [people]);
  const visibleMemories = useMemo(
    () => getDisplayMemories(memories, canRevealPrivate, lockedPersonIds),
    [canRevealPrivate, memories, lockedPersonIds],
  );
  const visiblePeople = useMemo(
    () => getDisplayPeople(decoratePeopleWithVisibleMemoryStats(people, visibleMemories), canRevealPrivate),
    [people, visibleMemories, canRevealPrivate],
  );

  return {
    canRevealPrivate,
    people,
    memories,
    visiblePeople,
    visibleMemories,
  };
}
