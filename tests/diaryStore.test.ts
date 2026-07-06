/// <reference types="node" />

import test from 'node:test';
import assert from 'node:assert/strict';

import type { MemorySummary, PersonSummary } from '@/src/data/mock';
import { useDiaryStore } from '@/src/stores/useDiaryStore';

function basePeople(): PersonSummary[] {
  return [
    {
      id: 'p1',
      name: '妈妈',
      relation: '母亲',
      note: '总惦记我。',
      memoryCount: 1,
      lastDate: '1月1日',
      recent: true,
      stars: 1,
    },
    {
      id: 'p2',
      name: '阿澄',
      relation: '朋友',
      note: '会认真听我说话。',
      memoryCount: 0,
      lastDate: '还没有',
      recent: false,
      stars: 1,
    },
  ];
}

function baseMemories(): MemorySummary[] {
  return [
    {
      id: 'm1',
      personId: 'p1',
      personIds: ['p1'],
      title: '旧记忆',
      content: '一条旧记忆。',
      excerpt: '一条旧记忆。',
      date: '1月1日 · 上午',
      year: '2026',
      mood: '安心',
      hasMedia: false,
      attachments: [],
    },
  ];
}

function resetDiaryStore() {
  useDiaryStore.setState({
    people: basePeople(),
    memories: baseMemories(),
    communityPosts: [],
    hydrated: true,
    hydrationError: null,
  });
}

test('diary store adds people and normalizes empty notes', () => {
  resetDiaryStore();

  const person = useDiaryStore.getState().addPerson({
    name: '  爸爸  ',
    relation: '父亲',
    note: '   ',
  });
  const state = useDiaryStore.getState();

  assert.equal(person.name, '爸爸');
  assert.equal(person.note, '还没有写下描述。');
  assert.equal(state.people[0].id, person.id);
  assert.equal(state.people.length, 3);
});

test('diary store stores and updates person avatarUri', () => {
  resetDiaryStore();

  const person = useDiaryStore.getState().addPerson({
    name: '外婆',
    relation: '亲人',
    note: '总怕我饿。',
    avatarUri: ' file:///avatar.jpg ',
  });
  assert.equal(person.avatarUri, 'file:///avatar.jpg');

  const updated = useDiaryStore.getState().updatePerson({
    id: person.id,
    name: '外婆',
    relation: '亲人',
    note: '总怕我饿。',
    avatarUri: null,
  });
  assert.equal(updated?.avatarUri, null);
});

test('diary store updates and deletes a person without deleting memories', () => {
  resetDiaryStore();

  const updated = useDiaryStore.getState().updatePerson({
    id: 'p1',
    name: '妈妈',
    relation: '亲人',
    note: '新的描述',
  });
  assert.equal(updated?.relation, '亲人');
  assert.equal(useDiaryStore.getState().people.find((person) => person.id === 'p1')?.note, '新的描述');

  const deleted = useDiaryStore.getState().deletePerson('p1');
  const state = useDiaryStore.getState();

  assert.equal(deleted, true);
  assert.equal(state.people.some((person) => person.id === 'p1'), false);
  assert.equal(state.memories.length, 1);
  assert.deepEqual(state.memories[0].personIds, []);
  assert.equal(state.memories[0].personId, null);
});

test('diary store toggles person privacy and persists it through update', () => {
  resetDiaryStore();

  const locked = useDiaryStore.getState().updatePerson({
    id: 'p1',
    name: '妈妈',
    relation: '母亲',
    note: '总惦记我。',
    isPrivate: true,
    privacyMode: 'masked',
  });
  assert.equal(locked?.isPrivate, true);
  assert.equal(locked?.privacyMode, 'masked');

  const stored = useDiaryStore.getState().people.find((person) => person.id === 'p1');
  assert.equal(stored?.isPrivate, true);
  assert.equal(stored?.privacyMode, 'masked');

  // 再次 update 不带隐私字段时，保留既有隐私状态
  const renamed = useDiaryStore.getState().updatePerson({
    id: 'p1',
    name: '老妈',
    relation: '母亲',
    note: '总惦记我。',
  });
  assert.equal(renamed?.name, '老妈');
  assert.equal(renamed?.isPrivate, true);
  assert.equal(renamed?.privacyMode, 'masked');

  // 显式解锁
  const unlocked = useDiaryStore.getState().updatePerson({
    id: 'p1',
    name: '老妈',
    relation: '母亲',
    note: '总惦记我。',
    isPrivate: false,
    privacyMode: null,
  });
  assert.equal(unlocked?.isPrivate, false);
});

test('diary store adds memories, de-duplicates people, and updates person stats', () => {
  resetDiaryStore();

  const memory = useDiaryStore.getState().addMemory({
    content: '  今天一起散步。\n聊了很多。 ',
    mood: '平静',
    personIds: ['p1', 'p2', 'p1'],
    isPrivate: true,
    privacyMode: 'masked',
    attachments: [
      {
        id: 'a1',
        type: 'image',
        uri: 'file:///media/a1.jpg',
        fileName: 'a1.jpg',
        mimeType: 'image/jpeg',
      },
    ],
    tags: [' 家人 ', '#家人', '散步'],
  });
  const state = useDiaryStore.getState();

  assert.deepEqual(memory.personIds, ['p1', 'p2']);
  assert.equal(memory.isPrivate, true);
  assert.equal(memory.privacyMode, 'masked');
  assert.equal(memory.hasMedia, true);
  assert.equal(memory.content, '今天一起散步。\n聊了很多。');
  assert.deepEqual(memory.tags, ['家人', '散步']);
  assert.equal(state.memories[0].id, memory.id);
  assert.equal(state.people.find((person) => person.id === 'p1')?.memoryCount, 2);
  assert.equal(state.people.find((person) => person.id === 'p2')?.memoryCount, 1);
  assert.equal(state.people.find((person) => person.id === 'p2')?.recent, true);
});

test('diary store updates memory tags without losing existing tags when omitted', () => {
  resetDiaryStore();

  const tagged = useDiaryStore.getState().addMemory({
    content: '带标签的记忆',
    mood: '温暖',
    personIds: ['p1'],
    tags: ['家人'],
  });
  assert.deepEqual(tagged.tags, ['家人']);

  const changed = useDiaryStore.getState().updateMemory({
    id: tagged.id,
    content: '换一个标签',
    mood: '温暖',
    personIds: ['p1'],
    attachments: [],
    tags: ['电话'],
  });
  assert.deepEqual(changed?.tags, ['电话']);

  const preserved = useDiaryStore.getState().updateMemory({
    id: tagged.id,
    content: '不传标签',
    mood: '温暖',
    personIds: ['p1'],
    attachments: [],
  });
  assert.deepEqual(preserved?.tags, ['电话']);
});

test('diary store updates memory associations, privacy, media, and derived people stats', () => {
  resetDiaryStore();

  const updated = useDiaryStore.getState().updateMemory({
    id: 'm1',
    content: '更新后的正文',
    mood: null,
    personIds: ['p2'],
    isPrivate: false,
    privacyMode: null,
    attachments: [],
  });
  const state = useDiaryStore.getState();

  assert.equal(updated?.personId, 'p2');
  assert.deepEqual(updated?.personIds, ['p2']);
  assert.equal(updated?.mood, '说不清');
  assert.equal(updated?.isPrivate, false);
  assert.equal(updated?.privacyMode, undefined);
  assert.equal(state.people.find((person) => person.id === 'p1')?.memoryCount, 0);
  assert.equal(state.people.find((person) => person.id === 'p1')?.lastDate, '还没有');
  assert.equal(state.people.find((person) => person.id === 'p2')?.memoryCount, 1);
  assert.equal(state.people.find((person) => person.id === 'p2')?.lastDate, '1月1日');
});

test('diary store switches privacy modes without changing memory content', () => {
  resetDiaryStore();

  useDiaryStore.getState().updateMemory({
    id: 'm1',
    content: '一条旧记忆。',
    mood: '安心',
    personIds: ['p1'],
    attachments: [],
    isPrivate: true,
    privacyMode: 'hidden',
  });
  useDiaryStore.getState().updateMemory({
    id: 'm1',
    content: '一条旧记忆。',
    mood: '安心',
    personIds: ['p1'],
    attachments: [],
    isPrivate: true,
    privacyMode: 'masked',
  });

  const memory = useDiaryStore.getState().memories.find((item) => item.id === 'm1');

  assert.equal(memory?.content, '一条旧记忆。');
  assert.equal(memory?.isPrivate, true);
  assert.equal(memory?.privacyMode, 'masked');
});

test('diary store deletes memories and decrements all related people', () => {
  resetDiaryStore();
  const memory = useDiaryStore.getState().addMemory({
    content: '两个人都在的记忆',
    mood: '温暖',
    personIds: ['p1', 'p2'],
  });

  const deleted = useDiaryStore.getState().deleteMemory(memory.id);
  const state = useDiaryStore.getState();

  assert.equal(deleted, true);
  assert.equal(state.memories.some((item) => item.id === memory.id), false);
  assert.equal(state.people.find((person) => person.id === 'p1')?.memoryCount, 1);
  assert.equal(state.people.find((person) => person.id === 'p2')?.memoryCount, 0);
  assert.equal(state.people.find((person) => person.id === 'p2')?.recent, false);
});

test('diary store publishes and removes community posts from public memories', () => {
  resetDiaryStore();

  const post = useDiaryStore.getState().publishMemoryToCommunity('m1');
  assert.ok(post);
  assert.equal(post.memoryId, 'm1');
  assert.equal(useDiaryStore.getState().communityPosts.length, 1);

  const duplicate = useDiaryStore.getState().publishMemoryToCommunity('m1');
  assert.equal(duplicate?.id, post.id);
  assert.equal(useDiaryStore.getState().communityPosts.length, 1);

  const removed = useDiaryStore.getState().unpublishCommunityPost(post.id);
  assert.equal(removed, true);
  assert.equal(useDiaryStore.getState().communityPosts.length, 0);
});

test('diary store persists community follow like and repost state', () => {
  resetDiaryStore();

  const post = useDiaryStore.getState().publishMemoryToCommunity('m1');
  assert.ok(post);
  assert.equal(post.followedByMe, false);
  assert.equal(post.likedByMe, false);
  assert.equal(post.repostedByMe, false);

  const followed = useDiaryStore.getState().toggleCommunityFollow(post.id);
  const liked = useDiaryStore.getState().toggleCommunityLike(post.id);
  const reposted = useDiaryStore.getState().toggleCommunityRepost(post.id);

  assert.equal(followed?.followedByMe, true);
  assert.equal(liked?.likedByMe, true);
  assert.equal(liked?.likes, 1);
  assert.equal(reposted?.repostedByMe, true);

  const unliked = useDiaryStore.getState().toggleCommunityLike(post.id);
  assert.equal(unliked?.likedByMe, false);
  assert.equal(unliked?.likes, 0);

  const stored = useDiaryStore.getState().communityPosts.find((item) => item.id === post.id);
  assert.equal(stored?.followedByMe, true);
  assert.equal(stored?.likedByMe, false);
  assert.equal(stored?.repostedByMe, true);
});

test('diary store does not publish private memories to community', () => {
  resetDiaryStore();
  const privateMemory = useDiaryStore.getState().addMemory({
    content: '只给自己看的记录',
    mood: '安静',
    personIds: ['p1'],
    isPrivate: true,
    privacyMode: 'hidden',
  });

  const post = useDiaryStore.getState().publishMemoryToCommunity(privateMemory.id);

  assert.equal(post, null);
  assert.equal(useDiaryStore.getState().communityPosts.length, 0);
});
