import { create } from 'zustand';

import { mergeDiaryData as mergeImportedDiaryData } from '@/src/backup/backupMerge';
import type { MergeDiaryDataOptions } from '@/src/backup/backupMerge';
import { CommunityPost, MemoryAttachment, MemoryLocation, MemoryPrivacyMode, MemorySummary, MemoryVoiceNote, PersonPrivacyMode, PersonSummary, communityPosts as seedCommunityPosts, memories as seedMemories, people as seedPeople } from '@/src/data/mock';
import { normalizeAvatarUri, normalizeTags, normalizeVoiceNotes } from '@/src/data/normalizeDiaryFields';
import { normalizeDiaryData } from '@/src/backup/backupPayload';
import { loadDiaryData, saveDiaryData } from '@/src/storage/diaryRepository';
import type { DiaryData } from '@/src/storage/diaryRepository';

type AddPersonInput = {
  name: string;
  relation: string;
  note: string;
  avatarUri?: string | null;
  isPrivate?: boolean;
  privacyMode?: PersonPrivacyMode | null;
};

type UpdatePersonInput = AddPersonInput & {
  id: string;
};

type AddMemoryInput = {
  content: string;
  mood: string | null;
  personIds: string[];
  attachments?: MemoryAttachment[];
  voiceNotes?: MemoryVoiceNote[];
  tags?: string[];
  isPrivate?: boolean;
  privacyMode?: MemoryPrivacyMode | null;
  location?: MemoryLocation | null;
};

type UpdateMemoryInput = AddMemoryInput & {
  id: string;
};

type DiaryState = {
  people: PersonSummary[];
  memories: MemorySummary[];
  communityPosts: CommunityPost[];
  hydrated: boolean;
  hydrationError: string | null;
  hydrate: () => Promise<void>;
  replaceDiaryData: (data: DiaryData) => void;
  mergeDiaryData: (data: DiaryData, options?: MergeDiaryDataOptions) => void;
  addPerson: (input: AddPersonInput) => PersonSummary;
  updatePerson: (input: UpdatePersonInput) => PersonSummary | null;
  deletePerson: (id: string) => boolean;
  addMemory: (input: AddMemoryInput) => MemorySummary;
  updateMemory: (input: UpdateMemoryInput) => MemorySummary | null;
  deleteMemory: (id: string) => boolean;
  publishMemoryToCommunity: (memoryId: string) => CommunityPost | null;
  unpublishCommunityPost: (postId: string) => boolean;
  toggleCommunityFollow: (postId: string) => CommunityPost | null;
  toggleCommunityLike: (postId: string) => CommunityPost | null;
  toggleCommunityRepost: (postId: string) => CommunityPost | null;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function timePeriod(date: Date): string {
  const hour = date.getHours();
  if (hour < 6) return '凌晨';
  if (hour < 12) return '上午';
  if (hour < 18) return '下午';
  if (hour < 23) return '晚上';
  return '夜里';
}

function shortDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function trimText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function titleFrom(content: string, hasMedia = false): string {
  if (!content.trim() && hasMedia) return '一张照片';
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? content;
  return trimText(firstLine, 18);
}

function excerptFrom(content: string, hasMedia = false): string {
  if (!content.trim() && hasMedia) return '这张照片，也有了它的故事。';
  return trimText(content, 96);
}

function compactPersonIds(personIds: string[]): string[] {
  return Array.from(new Set(personIds));
}

function firstMemoryDateFor(personId: string, memories: MemorySummary[]): string {
  const memory = memories.find((item) => item.personIds.includes(personId));
  return memory?.date.split(' · ')[0] ?? '还没有';
}

function nextPersonAfterDelta(
  person: PersonSummary,
  delta: number,
  memories: MemorySummary[],
): PersonSummary {
  const memoryCount = Math.max(0, person.memoryCount + delta);
  return {
    ...person,
    memoryCount,
    lastDate: memoryCount > 0 ? firstMemoryDateFor(person.id, memories) : '还没有',
    recent: memoryCount > 0,
    stars: memoryCount > 0 ? Math.min(2, Math.max(1, memoryCount)) : 1,
  };
}

function persistData(
  set: (partial: Partial<DiaryState>) => void,
  data: Pick<DiaryState, 'people' | 'memories'> & { communityPosts?: CommunityPost[] },
  fallbackMessage: string,
) {
  void saveDiaryData(data).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : fallbackMessage;
    set({ hydrationError: message });
  });
}

function updateCommunityPost(
  set: (partial: Partial<DiaryState>) => void,
  get: () => DiaryState,
  postId: string,
  updater: (post: CommunityPost) => CommunityPost,
): CommunityPost | null {
  const oldPost = get().communityPosts.find((post) => post.id === postId);
  if (!oldPost) return null;

  const updatedPost = updater(oldPost);
  const nextData = {
    people: get().people,
    memories: get().memories,
    communityPosts: get().communityPosts.map((post) => (post.id === postId ? updatedPost : post)),
  };

  set(nextData);
  persistData(set, nextData, '社区互动保存失败');
  return updatedPost;
}

export const useDiaryStore = create<DiaryState>((set, get) => ({
  people: seedPeople,
  memories: seedMemories,
  communityPosts: seedCommunityPosts,
  hydrated: false,
  hydrationError: null,
  hydrate: async () => {
    if (get().hydrated) return;

    try {
      const data = await loadDiaryData();
      set({ people: data.people, memories: data.memories, communityPosts: data.communityPosts ?? [], hydrated: true, hydrationError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : '本地数据读取失败';
      set({ hydrated: true, hydrationError: message });
    }
  },
  replaceDiaryData: (data) => {
    const nextData = normalizeDiaryData(data);
    set({ ...nextData, hydrated: true, hydrationError: null });
    persistData(set, nextData, '备份恢复失败');
  },
  mergeDiaryData: (data, options) => {
    const nextData = mergeImportedDiaryData({ people: get().people, memories: get().memories }, data, options);
    set({ ...nextData, hydrated: true, hydrationError: null });
    persistData(set, nextData, '备份合并失败');
  },
  addPerson: (input) => {
    const person: PersonSummary = {
      id: createId('person'),
      name: input.name.trim(),
      relation: input.relation,
      note: input.note.trim() || '还没有写下描述。',
      avatarUri: normalizeAvatarUri(input.avatarUri),
      memoryCount: 0,
      lastDate: '还没有',
      recent: false,
      stars: 1,
      isPrivate: input.isPrivate ?? false,
      privacyMode: input.isPrivate ? (input.privacyMode ?? 'hidden') : undefined,
    };

    const nextData = {
      people: [person, ...get().people],
      memories: get().memories,
      communityPosts: get().communityPosts,
    };

    set(nextData);
    persistData(set, nextData, '人物保存失败');
    return person;
  },
  updatePerson: (input) => {
    const oldPerson = get().people.find((person) => person.id === input.id);
    if (!oldPerson) return null;
    const nextIsPrivate = input.isPrivate ?? oldPerson.isPrivate ?? false;

    const updatedPerson: PersonSummary = {
      ...oldPerson,
      name: input.name.trim(),
      relation: input.relation,
      note: input.note.trim() || '还没有写下描述。',
      avatarUri: input.avatarUri === undefined ? oldPerson.avatarUri ?? null : normalizeAvatarUri(input.avatarUri),
      isPrivate: nextIsPrivate,
      privacyMode: nextIsPrivate ? (input.privacyMode ?? oldPerson.privacyMode ?? 'hidden') : undefined,
    };
    const nextData = {
      people: get().people.map((person) => (person.id === input.id ? updatedPerson : person)),
      memories: get().memories,
      communityPosts: get().communityPosts,
    };

    set(nextData);
    persistData(set, nextData, '人物保存失败');
    return updatedPerson;
  },
  deletePerson: (id) => {
    const oldPerson = get().people.find((person) => person.id === id);
    if (!oldPerson) return false;

    const memories = get().memories.map((memory) => {
      if (!memory.personIds.includes(id)) return memory;
      const personIds = memory.personIds.filter((personId) => personId !== id);
      return {
        ...memory,
        personId: personIds[0] ?? null,
        personIds,
      };
    });
    const nextData = {
      people: get().people.filter((person) => person.id !== id),
      memories,
      communityPosts: get().communityPosts,
    };

    set(nextData);
    persistData(set, nextData, '人物移除失败');
    return true;
  },
  addMemory: (input) => {
    const now = new Date();
    const personIds = compactPersonIds(input.personIds);
    const content = input.content.trim();
    const attachments = input.attachments ?? [];
    const voiceNotes = normalizeVoiceNotes(input.voiceNotes);
    const tags = normalizeTags(input.tags);
    const memory: MemorySummary = {
      id: createId('memory'),
      personId: personIds[0] ?? null,
      personIds,
      title: titleFrom(content, attachments.length > 0),
      content,
      excerpt: excerptFrom(content, attachments.length > 0),
      date: `${shortDate(now)} · ${timePeriod(now)}`,
      year: String(now.getFullYear()),
      mood: input.mood ?? '说不清',
      hasMedia: attachments.length > 0,
      attachments,
      voiceNotes,
      tags,
      isPrivate: Boolean(input.isPrivate),
      privacyMode: input.isPrivate ? input.privacyMode ?? 'hidden' : undefined,
      location: input.location ?? null,
    };

    const nextData = {
      memories: [memory, ...get().memories],
      communityPosts: get().communityPosts,
      people: get().people.map((person) => {
        if (!personIds.includes(person.id)) return person;
        const memoryCount = person.memoryCount + 1;
        return {
          ...person,
          memoryCount,
          lastDate: shortDate(now),
          recent: true,
          stars: Math.min(2, Math.max(1, memoryCount)),
        };
      }),
    };

    set(nextData);
    persistData(set, nextData, '记忆保存失败');

    return memory;
  },
  updateMemory: (input) => {
    const oldMemory = get().memories.find((memory) => memory.id === input.id);
    if (!oldMemory) return null;

    const personIds = compactPersonIds(input.personIds);
    const content = input.content.trim();
    const attachments = input.attachments ?? oldMemory.attachments;
    const voiceNotes = input.voiceNotes === undefined ? normalizeVoiceNotes(oldMemory.voiceNotes) : normalizeVoiceNotes(input.voiceNotes);
    const tags = input.tags === undefined ? normalizeTags(oldMemory.tags) : normalizeTags(input.tags);
    const nextIsPrivate = typeof input.isPrivate === 'boolean' ? input.isPrivate : Boolean(oldMemory.isPrivate);
    const updatedMemory: MemorySummary = {
      ...oldMemory,
      personId: personIds[0] ?? null,
      personIds,
      title: titleFrom(content, attachments.length > 0),
      content,
      excerpt: excerptFrom(content, attachments.length > 0),
      mood: input.mood ?? '说不清',
      hasMedia: attachments.length > 0,
      attachments,
      voiceNotes,
      tags,
      isPrivate: nextIsPrivate,
      privacyMode: nextIsPrivate
        ? input.privacyMode ?? oldMemory.privacyMode ?? 'hidden'
        : undefined,
      location: input.location ?? null,
    };
    const memories = get().memories.map((memory) => (memory.id === input.id ? updatedMemory : memory));
    const oldIds = new Set(oldMemory.personIds);
    const nextIds = new Set(personIds);

    const people = get().people.map((person) => {
      const removed = oldIds.has(person.id) && !nextIds.has(person.id);
      const added = !oldIds.has(person.id) && nextIds.has(person.id);
      if (removed) return nextPersonAfterDelta(person, -1, memories);
      if (added) return nextPersonAfterDelta(person, 1, memories);
      if (nextIds.has(person.id)) {
        return { ...person, lastDate: firstMemoryDateFor(person.id, memories) };
      }
      return person;
    });
    const communityPosts = get().communityPosts.map((post) => (
      post.memoryId === updatedMemory.id
        ? {
            ...post,
            title: updatedMemory.title,
            excerpt: updatedMemory.excerpt,
            content: updatedMemory.content,
            mood: updatedMemory.mood,
            attachmentUri: updatedMemory.attachments[0]?.uri ?? null,
          }
        : post
    ));
    const nextData = { people, memories, communityPosts };

    set(nextData);
    persistData(set, nextData, '记忆保存失败');
    return updatedMemory;
  },
  deleteMemory: (id) => {
    const oldMemory = get().memories.find((memory) => memory.id === id);
    if (!oldMemory) return false;

    const deletedPersonIds = new Set(oldMemory.personIds);
    const memories = get().memories.filter((memory) => memory.id !== id);
    const people = get().people.map((person) => {
      if (!deletedPersonIds.has(person.id)) return person;
      return nextPersonAfterDelta(person, -1, memories);
    });
    const communityPosts = get().communityPosts.filter((post) => post.memoryId !== id);
    const nextData = { people, memories, communityPosts };

    set(nextData);
    persistData(set, nextData, '记忆移除失败');
    return true;
  },
  publishMemoryToCommunity: (memoryId) => {
    const memory = get().memories.find((item) => item.id === memoryId);
    if (!memory || memory.isPrivate) return null;
    const existing = get().communityPosts.find((post) => post.memoryId === memoryId);
    if (existing) return existing;

    const post: CommunityPost = {
      id: createId('community'),
      memoryId: memory.id,
      title: memory.title,
      excerpt: memory.excerpt,
      content: memory.content,
      date: memory.date,
      mood: memory.mood,
      attachmentUri: memory.attachments[0]?.uri ?? null,
      likes: 0,
      comments: 0,
      followedByMe: false,
      likedByMe: false,
      repostedByMe: false,
    };
    const nextData = {
      people: get().people,
      memories: get().memories,
      communityPosts: [post, ...get().communityPosts],
    };
    set(nextData);
    persistData(set, nextData, '社区发布失败');
    return post;
  },
  unpublishCommunityPost: (postId) => {
    const oldPost = get().communityPosts.find((post) => post.id === postId);
    if (!oldPost) return false;
    const nextData = {
      people: get().people,
      memories: get().memories,
      communityPosts: get().communityPosts.filter((post) => post.id !== postId),
    };
    set(nextData);
    persistData(set, nextData, '社区移除失败');
    return true;
  },
  toggleCommunityFollow: (postId) => updateCommunityPost(set, get, postId, (post) => ({
    ...post,
    followedByMe: !post.followedByMe,
  })),
  toggleCommunityLike: (postId) => updateCommunityPost(set, get, postId, (post) => {
    const likedByMe = !post.likedByMe;
    const likes = Math.max(0, post.likes + (likedByMe ? 1 : -1));
    return { ...post, likedByMe, likes };
  }),
  toggleCommunityRepost: (postId) => updateCommunityPost(set, get, postId, (post) => ({
    ...post,
    repostedByMe: !post.repostedByMe,
  })),
}));
