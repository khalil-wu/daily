import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, getState, hydrate } from '../src/store/store';
import { clearAllStorage, normalizeState } from '../src/store/storage';
import { buildSnapshotPayload } from '../src/services/autoBackup';
import { entryToMarkdown } from '../src/utils/transferFormat';
import {
  daysUntilBirthday, detectNewPeople, entriesWithPerson, groupPeopleByRelation, matchPeopleInText,
  normalizeBirthday, personNames, summarizePeople, summarizePerson,
} from '../src/utils/people';
import type { Entry, Person } from '../src/store/types';

const person = (over: Partial<Person> & Pick<Person, 'id' | 'name'>): Person => ({
  relation: 'other', aliases: [], color: '#C98B6B', createdAt: 1, ...over,
});

async function freshStore() {
  await clearAllStorage();
  await hydrate();
  await actions.wipeAll();
}

test('身边人：新增去重、别名清理、改名不与他人重名、删除后日记保留只解除关联', async () => {
  await freshStore();
  const mom = actions.addPerson('  妈妈 ', 'family', { aliases: ['老妈', '妈妈', ' '] })!;
  assert.equal(mom.name, '妈妈');
  assert.deepEqual(mom.aliases, ['老妈']); // 与本名相同的别名、空白别名被去掉
  assert.equal(actions.addPerson('妈妈', 'friend')!.id, mom.id); // 同名返回原来的人，关系不被改写
  assert.equal(getState().people[0].relation, 'family');
  assert.equal(actions.addPerson('   '), null);
  const zhou = actions.addPerson('小周', 'colleague')!;
  assert.notEqual(zhou.color, mom.color);

  actions.updatePerson(zhou.id, { name: '妈妈' }); // 想改成已有的名字：不生效
  assert.equal(getState().people.find(p => p.id === zhou.id)!.name, '小周');
  actions.updatePerson(zhou.id, { name: '周舟', relation: 'friend', note: ' 楼下工位 ' });
  const renamed = getState().people.find(p => p.id === zhou.id)!;
  assert.deepEqual([renamed.name, renamed.relation, renamed.note], ['周舟', 'friend', '楼下工位']);

  const e = actions.newEntry({ title: '晚饭', body: '和妈妈、周舟一起吃饭', status: 'published', people: [mom.id, zhou.id] });
  actions.upsertEntry(e, true);
  actions.removePerson(mom.id);
  assert.equal(getState().people.some(p => p.id === mom.id), false);
  const kept = getState().entries.find(x => x.id === e.id)!;
  assert.deepEqual(kept.people, [zhou.id]);
  assert.equal(kept.body, '和妈妈、周舟一起吃饭'); // 日记正文一个字不动
});

test('身边人：旧版本数据没有 people 字段时自动补全，脏数据被丢弃', () => {
  const migrated = normalizeState({
    entries: [{ id: 'old', title: '旧', body: '正文', createdAt: 1, updatedAt: 1 } as any],
    people: [
      { id: 'p1', name: ' 奶奶 ', relation: 'family' },
      { id: 'p1', name: '重复的 id' },
      { id: 'p2', name: '' },
      { name: '没有 id' },
      { id: 'p3', name: '阿树', relation: '不存在的关系', birthday: '13-40', aliases: ['树', 3] },
    ] as any,
  });
  assert.deepEqual(migrated.entries[0].people, []);
  assert.deepEqual(migrated.people.map(p => [p.id, p.name, p.relation]), [['p1', '奶奶', 'family'], ['p3', '阿树', 'other']]);
  assert.equal(migrated.people[1].birthday, undefined);
  assert.deepEqual(migrated.people[1].aliases, ['树']);
  assert.deepEqual(normalizeState({}).people, []);
  assert.equal(normalizeState({}).ai.enabled, false);
  assert.equal(normalizeState({ appearance: { accent: 'rose' } as any }).appearance.style, 'companion');
});

test('身边人：在正文里按出现顺序识别已有的人，别名也算；常见称呼提示新建', () => {
  const people = [
    person({ id: 'p_zhou', name: '小周', relation: 'colleague' }),
    person({ id: 'p_mom', name: '妈妈', relation: 'family', aliases: ['老妈'] }),
    person({ id: 'p_no', name: '阿树' }),
  ];
  assert.deepEqual(personNames(people[1]), ['妈妈', '老妈']);
  const body = '下班后**老妈**打来电话。\n- 小周请大家喝了奶茶';
  assert.deepEqual(matchPeopleInText(body, people), ['p_mom', 'p_zhou']);
  assert.deepEqual(matchPeopleInText('', people), []);
  assert.deepEqual(matchPeopleInText(body, []), []);

  // 「老妈」已经是妈妈的别名，不再提示；爸爸、奶奶还没记录
  assert.deepEqual(detectNewPeople('老妈说我爸最近血压高，周末去看奶奶', people), [
    { name: '爸爸', relation: 'family' },
    { name: '奶奶', relation: 'family' },
  ]);
  assert.deepEqual(detectNewPeople('今天一个人待着', people), []);
});

test('身边人：每个人的日记数、最近一次、最常见心情；隐藏和草稿不计入；按关系分组', () => {
  const day = 86400000;
  const now = new Date(2026, 10, 20, 12).getTime();
  const mk = (id: string, daysAgo: number, over: Partial<Entry>): Entry => ({
    id, title: id, body: '', createdAt: now - daysAgo * day, updatedAt: now - daysAgo * day, tags: [], people: [], photos: [],
    audios: [], videos: [], favorite: false, pinned: false, hidden: false, status: 'published', ...over,
  });
  const mom = person({ id: 'mom', name: '妈妈', relation: 'family', createdAt: 1 });
  const dad = person({ id: 'dad', name: '爸爸', relation: 'family', createdAt: 2 });
  const zhou = person({ id: 'zhou', name: '小周', relation: 'colleague', createdAt: 3 });
  const entries = [
    mk('a', 1, { people: ['mom'], mood: 'calm' }),
    mk('b', 9, { people: ['mom', 'dad'], mood: 'calm' }),
    mk('c', 30, { people: ['mom'], mood: 'down' }),
    mk('hidden', 0, { people: ['mom'], hidden: true }),
    mk('draft', 0, { people: ['mom'], status: 'draft' }),
    mk('trash', 0, { people: ['mom'], deletedAt: now }),
  ];
  assert.deepEqual(entriesWithPerson(entries, 'mom').map(e => e.id), ['a', 'b', 'c']);
  const s = summarizePerson(entries, mom, now);
  assert.deepEqual([s.count, s.daysSince, s.topMood], [3, 1, 'calm']);
  assert.equal(s.firstAt, now - 30 * day);
  assert.deepEqual(summarizePerson(entries, zhou, now), { person: zhou, count: 0 });

  const groups = groupPeopleByRelation(summarizePeople(entries, [zhou, dad, mom], now));
  assert.deepEqual(groups.map(g => [g.label, g.list.map(x => x.person.name)]), [['家人', ['妈妈', '爸爸']], ['同事', ['小周']]]);
});

test('身边人：生日的写法与倒数（跨年、平年的 2 月 29 日）', () => {
  assert.equal(normalizeBirthday('3-8'), '03-08');
  assert.equal(normalizeBirthday('12月25日'), '12-25');
  assert.equal(normalizeBirthday('2/30'), null);
  assert.equal(normalizeBirthday('13-01'), null);
  assert.equal(normalizeBirthday('生日'), null);
  const now = new Date(2026, 10, 20, 15).getTime();
  assert.equal(daysUntilBirthday('11-20', now), 0);
  assert.equal(daysUntilBirthday('11-25', now), 5);
  assert.equal(daysUntilBirthday('01-01', now), 42);
  assert.equal(daysUntilBirthday('02-29', new Date(2027, 1, 27).getTime()), 1); // 2027 不是闰年，按 2 月 28 日
  assert.equal(daysUntilBirthday(undefined, now), null);
  assert.equal(daysUntilBirthday('生日', now), null);
});

test('身边人：备份带上身边人，合并恢复不覆盖本机已有的人；导出 Markdown 写明和谁在一起', async () => {
  await freshStore();
  const mom = actions.addPerson('妈妈', 'family')!;
  const e = actions.newEntry({ title: '菜市场', body: '陪妈妈买菜', status: 'published', people: [mom.id] });
  actions.upsertEntry(e, true);
  const payload = JSON.parse(JSON.stringify(buildSnapshotPayload(getState())));
  assert.equal(payload.people[0].name, '妈妈');

  await actions.wipeAll();
  assert.deepEqual(getState().people, []);
  actions.restoreSnapshot(payload, 'merge');
  assert.deepEqual(getState().people.map(p => p.name), ['妈妈']);
  assert.deepEqual(getState().entries.find(x => x.id === e.id)!.people, [mom.id]);

  // 本机改过关系之后再合并同一份备份：以本机为准
  actions.updatePerson(mom.id, { relation: 'other' });
  actions.restoreSnapshot(payload, 'merge');
  assert.equal(getState().people.length, 1);
  assert.equal(getState().people[0].relation, 'other');

  const md = entryToMarkdown(getState().entries[0], getState().tags, getState().people);
  assert.ok(md.includes('和：妈妈'));
  assert.ok(!entryToMarkdown({ ...getState().entries[0], people: [] }, getState().tags, getState().people).includes('和：'));
});
