import type { MemorySummary, PersonPrivacyMode, PersonSummary } from '@/src/data/mock';

const MASKED_TEXT = '解锁后查看正文和照片。';
const MASKED_PERSON_NAME = '私密人物';
const MASKED_PERSON_NOTE = '解锁后查看。';

export function canRevealPrivateMemories(appLockEnabled: boolean, locked: boolean): boolean {
  return appLockEnabled && !locked;
}

function privacyModeFor(memory: MemorySummary) {
  if (!memory.isPrivate) return null;
  return memory.privacyMode ?? 'hidden';
}

export function isMemoryVisible(memory: MemorySummary, canRevealPrivate: boolean): boolean {
  if (canRevealPrivate || !memory.isPrivate) return true;
  return privacyModeFor(memory) === 'masked';
}

export function isMemoryMasked(memory: MemorySummary, canRevealPrivate: boolean): boolean {
  return Boolean(memory.isPrivate && !canRevealPrivate && privacyModeFor(memory) === 'masked');
}

export function maskMemory(memory: MemorySummary): MemorySummary {
  return {
    ...memory,
    title: '私密记忆',
    content: MASKED_TEXT,
    excerpt: MASKED_TEXT,
    hasMedia: false,
    attachments: [],
    tags: [],
    isMasked: true,
  };
}

function memoryTouchesLockedPerson(memory: MemorySummary, lockedPersonIds: Set<string>): boolean {
  if (lockedPersonIds.size === 0) return false;
  return memory.personIds.some((id) => lockedPersonIds.has(id));
}

export function filterVisibleMemories(
  memories: MemorySummary[],
  canRevealPrivate: boolean,
  lockedPersonIds: Set<string> = new Set(),
): MemorySummary[] {
  return memories.filter((memory) => {
    if (!canRevealPrivate && memoryTouchesLockedPerson(memory, lockedPersonIds)) return false;
    return isMemoryVisible(memory, canRevealPrivate);
  });
}

export function getDisplayMemories(
  memories: MemorySummary[],
  canRevealPrivate: boolean,
  lockedPersonIds: Set<string> = new Set(),
): MemorySummary[] {
  return filterVisibleMemories(memories, canRevealPrivate, lockedPersonIds)
    .map((memory) => (isMemoryMasked(memory, canRevealPrivate) ? maskMemory(memory) : { ...memory, isMasked: false }));
}

function shortDateFrom(memory: MemorySummary | undefined): string {
  return memory?.date.split(' · ')[0] ?? '还没有';
}

function statsForPerson(personId: string, memories: MemorySummary[]) {
  const relatedMemories = memories.filter((memory) => memory.personIds.includes(personId));
  const memoryCount = relatedMemories.length;

  return {
    memoryCount,
    lastDate: memoryCount > 0 ? shortDateFrom(relatedMemories[0]) : '还没有',
    recent: memoryCount > 0,
    stars: memoryCount > 0 ? Math.min(2, Math.max(1, memoryCount)) : 1,
  };
}

export function decoratePeopleWithVisibleMemoryStats(
  people: PersonSummary[],
  visibleMemories: MemorySummary[],
): PersonSummary[] {
  return people.map((person) => ({
    ...person,
    ...statsForPerson(person.id, visibleMemories),
  }));
}

// —— 人物级隐私（与记忆级对称：hidden 消失 / masked 占位） ——

export function isPersonLocked(person: PersonSummary): boolean {
  return Boolean(person.isPrivate);
}

export function personPrivacyModeFor(person: PersonSummary): PersonPrivacyMode {
  return person.privacyMode ?? 'hidden';
}

export function isPersonVisible(person: PersonSummary, canRevealPrivate: boolean): boolean {
  if (canRevealPrivate || !isPersonLocked(person)) return true;
  return personPrivacyModeFor(person) === 'masked';
}

export function isPersonMasked(person: PersonSummary, canRevealPrivate: boolean): boolean {
  return Boolean(isPersonLocked(person) && !canRevealPrivate && personPrivacyModeFor(person) === 'masked');
}

export function maskPerson(person: PersonSummary): PersonSummary {
  return {
    ...person,
    name: MASKED_PERSON_NAME,
    note: MASKED_PERSON_NOTE,
    relation: '私密',
    avatarUri: null,
    isMasked: true,
  };
}

export function filterVisiblePeople(people: PersonSummary[], canRevealPrivate: boolean): PersonSummary[] {
  return people.filter((person) => isPersonVisible(person, canRevealPrivate));
}

export function getDisplayPeople(people: PersonSummary[], canRevealPrivate: boolean): PersonSummary[] {
  return filterVisiblePeople(people, canRevealPrivate).map((person) =>
    isPersonMasked(person, canRevealPrivate) ? maskPerson(person) : { ...person, isMasked: false },
  );
}

export function lockedPersonIdsOf(people: PersonSummary[]): Set<string> {
  return new Set(people.filter(isPersonLocked).map((person) => person.id));
}
