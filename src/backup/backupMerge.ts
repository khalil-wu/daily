import { normalizeDiaryData } from '@/src/backup/backupPayload';
import type { DiaryData } from '@/src/storage/diaryRepository';

export type DiaryDataStats = {
  people: number;
  memories: number;
  photos: number;
  privateMemories: number;
};

export type BackupImportPreview = {
  current: DiaryDataStats;
  imported: DiaryDataStats;
  newPeople: number;
  newMemories: number;
  duplicatePeople: number;
  duplicateMemories: number;
  duplicatePeopleDetails: Array<{
    id: string;
    name: string;
    relation: string;
  }>;
  duplicateMemoryDetails: Array<{
    id: string;
    title: string;
    date: string;
  }>;
};

export type MergeDiaryDataOptions = {
  overwriteDuplicates?: boolean;
};

export function getDiaryDataStats(data: DiaryData): DiaryDataStats {
  return {
    people: data.people.length,
    memories: data.memories.length,
    photos: data.memories.reduce((sum, memory) => sum + memory.attachments.length, 0),
    privateMemories: data.memories.filter((memory) => memory.isPrivate).length,
  };
}

export function buildImportPreview(current: DiaryData, incoming: DiaryData): BackupImportPreview {
  const normalizedCurrent = normalizeDiaryData(current);
  const normalizedIncoming = normalizeDiaryData(incoming);
  const currentPeopleIds = new Set(normalizedCurrent.people.map((person) => person.id));
  const currentMemoryIds = new Set(normalizedCurrent.memories.map((memory) => memory.id));
  const duplicatePeopleDetails = normalizedIncoming.people
    .filter((person) => currentPeopleIds.has(person.id))
    .map((person) => ({
      id: person.id,
      name: person.name,
      relation: person.relation,
    }));
  const duplicateMemoryDetails = normalizedIncoming.memories
    .filter((memory) => currentMemoryIds.has(memory.id))
    .map((memory) => ({
      id: memory.id,
      title: memory.title,
      date: memory.date,
    }));

  return {
    current: getDiaryDataStats(normalizedCurrent),
    imported: getDiaryDataStats(normalizedIncoming),
    newPeople: normalizedIncoming.people.filter((person) => !currentPeopleIds.has(person.id)).length,
    newMemories: normalizedIncoming.memories.filter((memory) => !currentMemoryIds.has(memory.id)).length,
    duplicatePeople: duplicatePeopleDetails.length,
    duplicateMemories: duplicateMemoryDetails.length,
    duplicatePeopleDetails,
    duplicateMemoryDetails,
  };
}

export function mergeDiaryData(
  current: DiaryData,
  incoming: DiaryData,
  options: MergeDiaryDataOptions = {},
): DiaryData {
  const normalizedCurrent = normalizeDiaryData(current);
  const normalizedIncoming = normalizeDiaryData(incoming);
  const currentPeopleIds = new Set(normalizedCurrent.people.map((person) => person.id));
  const currentMemoryIds = new Set(normalizedCurrent.memories.map((memory) => memory.id));
  const incomingPeopleById = new Map(normalizedIncoming.people.map((person) => [person.id, person]));
  const incomingMemoriesById = new Map(normalizedIncoming.memories.map((memory) => [memory.id, memory]));
  const overwriteDuplicates = Boolean(options.overwriteDuplicates);
  const nextPeople = [
    ...normalizedCurrent.people.map((person) => (
      overwriteDuplicates && incomingPeopleById.has(person.id)
        ? incomingPeopleById.get(person.id)!
        : person
    )),
    ...normalizedIncoming.people.filter((person) => !currentPeopleIds.has(person.id)),
  ];
  const validPersonIds = new Set(nextPeople.map((person) => person.id));
  const nextMemories = [
    ...normalizedCurrent.memories.map((memory) => (
      overwriteDuplicates && incomingMemoriesById.has(memory.id)
        ? incomingMemoriesById.get(memory.id)!
        : memory
    )),
    ...normalizedIncoming.memories
      .filter((memory) => !currentMemoryIds.has(memory.id))
      .map((memory) => {
        const personIds = memory.personIds.filter((personId) => validPersonIds.has(personId));
        return {
          ...memory,
          personId: personIds[0] ?? null,
          personIds,
        };
      }),
  ];

  return normalizeDiaryData({ people: nextPeople, memories: nextMemories });
}
