/// <reference types="node" />

import test from 'node:test';
import assert from 'node:assert/strict';

import { backupSizeLevel, estimateTextBytes, formatBytes } from '@/src/backup/backupEstimate';
import { buildImportPreview, mergeDiaryData } from '@/src/backup/backupMerge';
import { createBackupPayload, normalizeDiaryData, parseBackupMedia, parseBackupPayload } from '@/src/backup/backupPayload';
import { parseMemoryDate } from '@/src/date/parseMemoryDate';
import {
  canRevealPrivateMemories,
  decoratePeopleWithVisibleMemoryStats,
  filterVisibleMemories,
  filterVisiblePeople,
  getDisplayMemories,
  getDisplayPeople,
  isMemoryMasked,
  isPersonMasked,
  isPersonVisible,
  lockedPersonIdsOf,
  maskPerson,
} from '@/src/privacy/memoryVisibility';
import type { DiaryData } from '@/src/storage/diaryRepository';
import { normalizeMemoryDraft } from '@/src/storage/draftTypes';
import { useDraftStore } from '@/src/stores/useDraftStore';

function sampleData(): DiaryData {
  return {
    people: [
      {
        id: 'mom',
        name: '妈妈',
        relation: '母亲',
        note: '总惦记我。',
        memoryCount: 0,
        lastDate: '还没有',
        recent: false,
        stars: 1,
      },
      {
        id: 'friend',
        name: '阿澄',
        relation: '朋友',
        note: '会认真听我说话。',
        memoryCount: 99,
        lastDate: '昨天',
        recent: true,
        stars: 2,
      },
    ],
    memories: [
      {
        id: 'm1',
        personId: 'mom',
        personIds: ['mom'],
        title: '一通电话',
        content: '她说要好好吃饭。',
        excerpt: '她说要好好吃饭。',
        date: '7月2日 · 晚上',
        year: '2026',
        mood: '想家',
        attachments: [],
      },
      {
        id: 'm2',
        personId: 'friend',
        personIds: ['friend'],
        title: '一段私密记忆',
        content: '只想自己看。',
        excerpt: '只想自己看。',
        date: '6月28日 · 傍晚',
        year: '2026',
        mood: '平静',
        hasMedia: true,
        isPrivate: true,
        privacyMode: 'hidden',
        attachments: [
          {
            id: 'a1',
            type: 'image',
            uri: 'file:///media/a1.jpg',
            width: 120,
            height: 80,
            fileName: 'a1.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      },
    ],
  };
}

test('normalizeDiaryData keeps valid data, filters broken relations, and recomputes person stats', () => {
  const normalized = normalizeDiaryData({
    people: [
      ...sampleData().people,
      { id: '', name: '无效', relation: '其他' },
    ],
    memories: [
      ...sampleData().memories,
      {
        id: 'm3',
        personId: 'missing',
        personIds: ['missing', 'mom'],
        title: '',
        excerpt: '旧格式正文',
        date: '5月1日 · 上午',
        year: '2025',
        mood: '温暖',
        attachments: [{ id: 'bad', type: 'image', uri: '' }],
      },
    ],
  });

  assert.equal(normalized.people.length, 2);
  assert.equal(normalized.memories.length, 3);
  assert.deepEqual(normalized.memories[2].personIds, ['mom']);
  assert.equal(normalized.memories[2].content, '旧格式正文');
  assert.equal(normalized.memories[2].attachments.length, 0);
  assert.equal(normalized.memories[1].privacyMode, 'hidden');
  assert.equal(normalized.people.find((person) => person.id === 'mom')?.memoryCount, 2);
  assert.equal(normalized.people.find((person) => person.id === 'mom')?.lastDate, '7月2日');
  assert.equal(normalized.people.find((person) => person.id === 'friend')?.memoryCount, 1);
});

test('normalizeDiaryData defaults avatarUri and tags while preserving valid values', () => {
  const normalized = normalizeDiaryData({
    people: [
      {
        id: 'mom',
        name: '妈妈',
        relation: '母亲',
        note: '总惦记我。',
        avatarUri: ' file:///avatar.jpg ',
      },
    ],
    memories: [
      {
        id: 'm1',
        personId: 'mom',
        personIds: ['mom'],
        title: '一通电话',
        content: '她说要好好吃饭。',
        excerpt: '她说要好好吃饭。',
        date: '7月2日 · 晚上',
        year: '2026',
        mood: '想家',
        attachments: [],
        tags: [' 家人 ', '#家人', '电话'],
      },
      {
        id: 'm2',
        personId: 'mom',
        personIds: ['mom'],
        title: '旧记忆',
        content: '旧格式没有标签。',
        excerpt: '旧格式没有标签。',
        date: '7月3日 · 上午',
        year: '2026',
        mood: '平静',
        attachments: [],
      },
    ],
  });

  assert.equal(normalized.people[0].avatarUri, 'file:///avatar.jpg');
  assert.deepEqual(normalized.memories[0].tags, ['家人', '电话']);
  assert.deepEqual(normalized.memories[1].tags, []);
});

test('backup payload parser accepts wrapped payloads and embedded media metadata', () => {
  const payload = createBackupPayload(sampleData());
  const raw = JSON.stringify({
    ...payload,
    media: {
      attachments: [
        {
          memoryId: 'm2',
          attachmentId: 'a1',
          fileName: 'a1.jpg',
          mimeType: 'image/jpeg',
          width: 120,
          height: 80,
          base64: 'ZmFrZQ==',
        },
        { memoryId: 'm2', attachmentId: '', base64: 'ignored' },
      ],
    },
  });

  const parsed = parseBackupPayload(raw);
  const media = parseBackupMedia(raw);

  assert.equal(parsed.memories.length, 2);
  assert.equal(parsed.memories[1].isPrivate, true);
  assert.equal(parsed.memories[1].privacyMode, 'hidden');
  assert.equal(media.attachments.length, 1);
  assert.equal(media.attachments[0].attachmentId, 'a1');
});

test('backup preview and merge skip duplicate ids and append new data safely', () => {
  const current = sampleData();
  const incoming: DiaryData = {
    people: [
      current.people[0],
      {
        id: 'dad',
        name: '爸爸',
        relation: '父亲',
        note: '问我钱够不够。',
        memoryCount: 0,
        lastDate: '还没有',
        recent: false,
        stars: 1,
      },
    ],
    memories: [
      current.memories[0],
      {
        id: 'm-new',
        personId: 'dad',
        personIds: ['dad', 'missing'],
        title: '新记忆',
        content: '一条从备份来的新记忆。',
        excerpt: '一条从备份来的新记忆。',
        date: '1月1日 · 上午',
        year: '2024',
        mood: '安心',
        attachments: [],
      },
    ],
  };

  const preview = buildImportPreview(current, incoming);
  const merged = mergeDiaryData(current, incoming);

  assert.equal(preview.newPeople, 1);
  assert.equal(preview.newMemories, 1);
  assert.equal(preview.duplicatePeople, 1);
  assert.equal(preview.duplicatePeopleDetails[0].name, '妈妈');
  assert.equal(preview.duplicateMemoryDetails[0].title, '一通电话');
  assert.equal(merged.people.length, 3);
  assert.equal(merged.memories.length, 3);
  assert.deepEqual(merged.memories.find((memory) => memory.id === 'm-new')?.personIds, ['dad']);
  assert.equal(merged.people.find((person) => person.id === 'dad')?.memoryCount, 1);
});

test('backup merge can overwrite duplicate people and memories when requested', () => {
  const current = sampleData();
  const incoming: DiaryData = {
    people: [
      {
        ...current.people[0],
        relation: '亲人',
        note: '从备份覆盖来的描述。',
      },
      {
        id: 'dad',
        name: '爸爸',
        relation: '父亲',
        note: '新人物',
        memoryCount: 0,
        lastDate: '还没有',
        recent: false,
        stars: 1,
      },
    ],
    memories: [
      {
        ...current.memories[0],
        personId: 'dad',
        personIds: ['dad'],
        title: '覆盖后的记忆',
        content: '这条重复记忆来自备份。',
        excerpt: '这条重复记忆来自备份。',
        mood: '覆盖',
      },
    ],
  };

  const merged = mergeDiaryData(current, incoming, { overwriteDuplicates: true });

  assert.equal(merged.people.find((person) => person.id === 'mom')?.relation, '亲人');
  assert.equal(merged.people.find((person) => person.id === 'mom')?.note, '从备份覆盖来的描述。');
  assert.equal(merged.people.find((person) => person.id === 'mom')?.memoryCount, 0);
  assert.equal(merged.people.find((person) => person.id === 'dad')?.memoryCount, 1);
  assert.equal(merged.memories.find((memory) => memory.id === 'm1')?.title, '覆盖后的记忆');
  assert.deepEqual(merged.memories.find((memory) => memory.id === 'm1')?.personIds, ['dad']);
});

test('backup merge keeps tags when appending and overwriting memories', () => {
  const current = sampleData();
  const incoming: DiaryData = {
    people: current.people,
    memories: [
      {
        ...current.memories[0],
        title: '覆盖标签',
        tags: ['家人', '电话'],
      },
      {
        id: 'm-new',
        personId: 'mom',
        personIds: ['mom'],
        title: '新标签',
        content: '带标签的新记忆。',
        excerpt: '带标签的新记忆。',
        date: '3月1日 · 上午',
        year: '2026',
        mood: '温暖',
        attachments: [],
        tags: ['春天'],
      },
    ],
  };

  const appended = mergeDiaryData(current, incoming);
  const overwritten = mergeDiaryData(current, incoming, { overwriteDuplicates: true });

  assert.deepEqual(appended.memories.find((memory) => memory.id === 'm-new')?.tags, ['春天']);
  assert.deepEqual(overwritten.memories.find((memory) => memory.id === 'm1')?.tags, ['家人', '电话']);
});

test('draft normalization and store save restore clear complete drafts', async () => {
  useDraftStore.setState({ draft: null, hydrated: true, hydrationError: null });
  const draft = normalizeMemoryDraft({
    content: '  写了一半 ',
    mood: '平静',
    personIds: ['mom', 'mom'],
    attachments: [],
    location: null,
    privacyMode: 'masked',
    tags: [' 家人 ', '#家人'],
    updatedAt: '2026-07-05T00:00:00.000Z',
  });

  assert.ok(draft);
  assert.deepEqual(draft.personIds, ['mom']);
  assert.deepEqual(draft.tags, ['家人']);

  await useDraftStore.getState().saveDraft(draft);
  assert.equal(useDraftStore.getState().draft?.content, '  写了一半 ');
  assert.equal(useDraftStore.getState().draft?.privacyMode, 'masked');

  await useDraftStore.getState().clearDraft();
  assert.equal(useDraftStore.getState().draft, null);
});

test('parseMemoryDate reads valid Chinese display dates and rejects invalid dates', () => {
  assert.deepEqual(parseMemoryDate({ year: '2026', date: '7月2日 · 晚上' }), { year: 2026, month: 7, day: 2 });
  assert.equal(parseMemoryDate({ year: '2026', date: '2月30日 · 上午' }), null);
  assert.equal(parseMemoryDate({ year: 'bad', date: '7月2日 · 晚上' }), null);
});

test('private memory visibility supports hidden and masked modes', () => {
  const data: DiaryData = {
    ...sampleData(),
    memories: [
      ...sampleData().memories,
      {
        id: 'm3',
        personId: 'friend',
        personIds: ['friend'],
        title: '只遮正文',
        content: '这句不能在锁定时露出来。',
        excerpt: '这句不能在锁定时露出来。',
        date: '6月29日 · 晚上',
        year: '2026',
        mood: '安静',
        isPrivate: true,
        privacyMode: 'masked',
        hasMedia: true,
        attachments: [
          {
            id: 'a2',
            type: 'image',
            uri: 'file:///media/a2.jpg',
            fileName: 'a2.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      },
    ],
  };

  assert.equal(canRevealPrivateMemories(false, false), false);
  assert.equal(canRevealPrivateMemories(true, true), false);
  assert.equal(canRevealPrivateMemories(true, false), true);

  const hiddenPrivate = filterVisibleMemories(data.memories, false);
  const displayMemories = getDisplayMemories(data.memories, false);
  const visiblePrivate = filterVisibleMemories(data.memories, true);
  const decoratedPeople = decoratePeopleWithVisibleMemoryStats(data.people, hiddenPrivate);

  assert.deepEqual(hiddenPrivate.map((memory) => memory.id), ['m1', 'm3']);
  assert.deepEqual(visiblePrivate.map((memory) => memory.id), ['m1', 'm2', 'm3']);
  assert.equal(isMemoryMasked(data.memories[2], false), true);
  assert.equal(displayMemories.find((memory) => memory.id === 'm3')?.content, '解锁后查看正文和照片。');
  assert.equal(displayMemories.find((memory) => memory.id === 'm3')?.attachments.length, 0);
  assert.equal(decoratedPeople.find((person) => person.id === 'friend')?.memoryCount, 1);
  assert.equal(decoratedPeople.find((person) => person.id === 'friend')?.lastDate, '6月29日');
});

test('person-level privacy hides and masks people, and hides their memories', () => {
  const people: DiaryData['people'] = [
    { id: 'mom', name: '妈妈', relation: '母亲', note: '总惦记我。', memoryCount: 0, lastDate: '还没有', recent: false, stars: 1 },
    { id: 'ex', name: '前任', relation: '朋友', note: '一段不想被看到的过去。', memoryCount: 0, lastDate: '还没有', recent: false, stars: 1, isPrivate: true, privacyMode: 'hidden' },
    { id: 'crush', name: '某人', relation: '朋友', note: '心动。', memoryCount: 0, lastDate: '还没有', recent: false, stars: 1, isPrivate: true, privacyMode: 'masked' },
  ];
  const memories: DiaryData['memories'] = [
    { id: 'm1', personId: 'mom', personIds: ['mom'], title: '一通电话', content: '她说要好好吃饭。', excerpt: '她说要好好吃饭。', date: '7月2日 · 晚上', year: '2026', mood: '想家', attachments: [] },
    { id: 'm2', personId: 'ex', personIds: ['ex'], title: '私密过往', content: '只想自己看。', excerpt: '只想自己看。', date: '6月28日 · 傍晚', year: '2026', mood: '平静', attachments: [] },
    { id: 'm3', personId: 'mom', personIds: ['mom', 'ex'], title: '一起吃饭', content: '那天三个人一起。', excerpt: '那天三个人一起。', date: '5月1日 · 中午', year: '2026', mood: '说不清', attachments: [] },
    { id: 'm4', personId: 'crush', personIds: ['crush'], title: '心动瞬间', content: '多看了一眼。', excerpt: '多看了一眼。', date: '4月12日 · 下午', year: '2026', mood: '心动', attachments: [] },
  ];

  const lockedIds = lockedPersonIdsOf(people);
  assert.deepEqual(Array.from(lockedIds).sort(), ['crush', 'ex']);

  assert.equal(isPersonVisible(people[1], false), false);
  assert.equal(isPersonVisible(people[2], false), true);
  assert.equal(isPersonVisible(people[1], true), true);
  assert.equal(isPersonVisible(people[2], true), true);

  const filtered = filterVisiblePeople(people, false);
  assert.deepEqual(filtered.map((p) => p.id), ['mom', 'crush']);

  const displayPeople = getDisplayPeople(people, false);
  const maskedCrush = displayPeople.find((p) => p.id === 'crush');
  assert.equal(maskedCrush?.name, '私密人物');
  assert.equal(maskedCrush?.note, '解锁后查看。');
  assert.equal(maskedCrush?.isMasked, true);
  assert.equal(isPersonMasked(people[2], false), true);
  assert.equal(isPersonMasked(people[2], true), false);

  const displayMemories = getDisplayMemories(memories, false, lockedIds);
  assert.deepEqual(displayMemories.map((m) => m.id), ['m1']);
  const revealedMemories = getDisplayMemories(memories, true, lockedIds);
  assert.deepEqual(revealedMemories.map((m) => m.id), ['m1', 'm2', 'm3', 'm4']);

  assert.equal(maskPerson(people[1]).note, '解锁后查看。');
  assert.equal(maskPerson(people[1]).name, '私密人物');
});

test('backup size helpers produce stable estimates and warning levels', () => {
  assert.equal(estimateTextBytes('abc记'), 6);
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '2 KB');
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB');
  assert.equal(backupSizeLevel(5 * 1024 * 1024), 'normal');
  assert.equal(backupSizeLevel(12 * 1024 * 1024), 'large');
  assert.equal(backupSizeLevel(60 * 1024 * 1024), 'huge');
});
