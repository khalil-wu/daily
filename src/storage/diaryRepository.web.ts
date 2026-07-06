import { CommunityPost, MemorySummary, PersonSummary, communityPosts as seedCommunityPosts, memories as seedMemories, people as seedPeople } from '@/src/data/mock';
import { normalizeAttachments, normalizeAvatarUri, normalizeTags, normalizeVoiceNotes } from '@/src/data/normalizeDiaryFields';
import { normalizeLocation } from '@/src/location/locationLabel';

export type DiaryData = {
  people: PersonSummary[];
  memories: MemorySummary[];
  communityPosts?: CommunityPost[];
};

const STORAGE_KEY = 'remember-diary:v1';

function cloneSeedData(): DiaryData {
  return {
    people: seedPeople.map((person) => ({ ...person, avatarUri: person.avatarUri ?? null })),
    communityPosts: seedCommunityPosts.map((post) => ({ ...post })),
    memories: seedMemories.map((memory) => ({
      ...memory,
      personIds: [...memory.personIds],
      attachments: [...memory.attachments],
      voiceNotes: [...(memory.voiceNotes ?? [])],
      tags: [...(memory.tags ?? [])],
    })),
  };
}

function normalizeDiaryData(data: DiaryData): DiaryData {
  return {
    people: data.people.map((person) => ({ ...person, avatarUri: normalizeAvatarUri(person.avatarUri) })),
    communityPosts: normalizeCommunityPosts(data.communityPosts),
    memories: data.memories.map((memory) => {
      const personIds = memory.personIds?.length
        ? memory.personIds
        : memory.personId
          ? [memory.personId]
          : [];
      return {
        ...memory,
        personId: personIds[0] ?? null,
        personIds: [...personIds],
        content: memory.content ?? memory.excerpt,
        attachments: normalizeAttachments(memory.attachments),
        voiceNotes: normalizeVoiceNotes(memory.voiceNotes),
        tags: normalizeTags(memory.tags),
        hasMedia: Boolean(memory.hasMedia || memory.attachments?.length),
        isPrivate: Boolean(memory.isPrivate),
        privacyMode: memory.isPrivate ? memory.privacyMode ?? 'hidden' : undefined,
        location: normalizeLocation(memory.location),
      };
    }),
  };
}

function normalizeCommunityPosts(posts?: CommunityPost[]): CommunityPost[] {
  return (posts ?? []).map((post) => ({
    ...post,
    attachmentUri: post.attachmentUri ?? null,
    likes: typeof post.likes === 'number' ? post.likes : 0,
    comments: typeof post.comments === 'number' ? post.comments : 0,
    followedByMe: Boolean(post.followedByMe),
    likedByMe: Boolean(post.likedByMe),
    repostedByMe: Boolean(post.repostedByMe),
  }));
}

function canUseLocalStorage(): boolean {
  return typeof globalThis.localStorage !== 'undefined';
}

function readStoredData(): DiaryData | null {
  if (!canUseLocalStorage()) return null;
  const raw = globalThis.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return normalizeDiaryData(JSON.parse(raw) as DiaryData);
  } catch {
    return null;
  }
}

function writeStoredData(data: DiaryData): void {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeDiaryData(data)));
}

export async function loadDiaryData(): Promise<DiaryData> {
  const stored = readStoredData();
  if (stored) return stored;

  const seed = cloneSeedData();
  writeStoredData(seed);
  return seed;
}

export async function saveDiaryData(data: DiaryData): Promise<void> {
  writeStoredData(data);
}
