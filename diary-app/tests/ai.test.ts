import test from 'node:test';
import assert from 'node:assert/strict';
import { actions, getState, hydrate } from '../src/store/store';
import { clearAllStorage } from '../src/store/storage';
import { AIError, aiErrorMessage, apiHost, chatComplete, isConfigComplete, resolveApiUrl } from '../src/utils/ai/client';
import { localMood, localQuestions, localTags, localTitle } from '../src/utils/ai/local';
import { pickMemories } from '../src/utils/ai/memory';
import { acceptTidied, extractJson, parseOrganize, parseQuestions, parseReply, parseReview } from '../src/utils/ai/parse';
import { canSendEntry, clipText, sendableEntries } from '../src/utils/ai/privacy';
import { buildDigest, entriesInRange, periodRange, periodStats } from '../src/utils/ai/review';
import { buildReplyMessages, describeEntry } from '../src/utils/ai/prompts';
import { detectCrisis, HOTLINE } from '../src/utils/ai/safety';
import { aiStatus, shouldAutoReply, writeReply } from '../src/services/ai';
import { setAIKey } from '../src/services/aiKey';
import type { Entry, Person, Tag } from '../src/store/types';

const entry = (over: Partial<Entry> = {}): Entry => ({
  id: 'e1', title: '', body: '', createdAt: 1000, updatedAt: 1000, tags: [], people: [], photos: [],
  audios: [], videos: [], favorite: false, pinned: false, hidden: false, status: 'published', ...over,
});
const tag = (id: string, name: string): Tag => ({ id, name, icon: 'Star' });
const person = (id: string, name: string, over: Partial<Person> = {}): Person => ({
  id, name, relation: 'friend', aliases: [], color: '#C98B6B', createdAt: 1, ...over,
});
const fakeFetch = (data: unknown, status = 200): typeof fetch =>
  (async () => ({ ok: status >= 200 && status < 300, status, json: async () => data })) as unknown as typeof fetch;
const failFetch = (): typeof fetch => (async () => { throw new Error('offline'); }) as unknown as typeof fetch;

async function freshStore() {
  await clearAllStorage();
  await hydrate();
  await actions.wipeAll();
}

/* ---------------- JSON 提取与追问 ---------------- */

test('AI 解析：从混杂输出里取出第一个 JSON 对象', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('前言 ```json\n{"a":{"b":"}x"}}\n``` 后记'), { a: { b: '}x' } });
  assert.equal(extractJson('没有对象'), null);
  assert.equal(extractJson('{bad json}'), null);
  assert.equal(extractJson(''), null);
});

test('AI 解析：追问取 JSON 或按行兜底，去重、限长、统一问号', () => {
  const tooLong = `这是一个${'特别'.repeat(30)}的问题`; // 超过 60 字，应被丢弃
  const json = `{"questions":["那只猫后来怎么样了","晚饭是谁做的？","${tooLong}","那只猫后来怎么样了"]}`;
  assert.deepEqual(parseQuestions(json), [
    '那只猫后来怎么样了？',
    '晚饭是谁做的？',
  ]);
  // 不按 JSON 给时按行取：只收以问号结尾的行
  assert.deepEqual(parseQuestions('- 今天最开心的一刻\n- 当时谁在你旁边？\n1. 明天还想再去吗？'), ['当时谁在你旁边？', '明天还想再去吗？']);
  assert.equal(parseQuestions('完全不是问题的文字').length, 0);
});

/* ---------------- 整理 ---------------- */

test('AI 解析：整理结果清洗——标题去标点、心情对表、标签只选已有、人名必须在原文出现过', () => {
  const tags = [tag('work', '工作'), tag('life', '生活')];
  const people = [person('p_mom', '妈妈', { aliases: ['老妈'] }), person('p_zhou', '小周', { relation: 'colleague' })];
  const body = '老妈今天来家里吃饭，小周下班顺路带了蛋糕，大家聊得很开心。';
  const res = parseOrganize(
    JSON.stringify({
      titles: ['「妈妈做的饭。」', '蛋糕和晚饭'],
      mood: '开心',
      tags: ['#生活', '不存在的标签', 'life'],
      people: [
        { name: '老妈', relation: 'family' },
        { name: '小周', relation: '同事' },
        { name: '凭空出现的人', relation: 'friend' },
        { name: '大家', relation: 'friend' }, // 泛指人群但不在原文的称呼也要丢
      ],
    }),
    { tags, people, body },
  )!;
  assert.deepEqual(res.titles, ['妈妈做的饭', '蛋糕和晚饭']);
  assert.equal(res.mood, 'happy');
  assert.deepEqual(res.tagIds, ['life']);
  assert.deepEqual(res.peopleIds, ['p_mom', 'p_zhou']);
  assert.deepEqual(res.newPeople, [{ name: '大家', relation: 'friend' }]); // 「大家」在原文里出现，算未建档的人
  // 原文里没有的人一律不进结果
  const res2 = parseOrganize('{"people":[{"name":"不存在的张三"}],"titles":[],"mood":null,"tags":[]}', { tags, people, body });
  assert.equal(res2, null);
});

test('AI 解析：理顺结果只接受篇幅变化不大的版本', () => {
  const orig = '今天然后那个就是说我跟老妈去了菜市场买了好多菜';
  assert.equal(acceptTidied(orig, '今天，我跟老妈去了菜市场，买了好多菜。'), '今天，我跟老妈去了菜市场，买了好多菜。');
  assert.equal(acceptTidied(orig, '去买菜了'), null); // 删掉太多
  assert.equal(acceptTidied(orig, `${orig}${orig}${orig}`), null); // 添了太多
  assert.equal(acceptTidied(orig, orig), null); // 一模一样
  assert.equal(acceptTidied(orig, ''), null);
});

test('AI 解析：回信去掉包裹、限制长度；太短的不要', () => {
  assert.equal(parseReply('「今天陪妈妈逛了菜市场，听她讲了很多以前的事。」'), '今天陪妈妈逛了菜市场，听她讲了很多以前的事。');
  assert.equal(parseReply('好的'), null);
  const long = parseReply('很长的信'.repeat(200))!;
  assert.ok(long.length <= 400 && long.endsWith('…'));
});

test('AI 解析：回顾的摘句必须能在原文里找到，找不到就丢掉', () => {
  const list = [
    { id: 'a', title: '周末', body: '今天陪妈妈去了菜市场，她说现在的菜比以前贵多了。' },
    { id: 'b', title: '', body: '晚上和小周散步。' },
  ];
  const res = parseReview(
    JSON.stringify({
      summary: '这一周你在陪伴家人和朋友的日常里，写到了菜市场的热闹和散步时的松弛。',
      themes: ['陪伴', '日常', '这个主题写得实在是太长了肯定不行'],
      moodLine: '忙碌里透着安稳',
      quote: '她说现在的菜比以前贵多了', // 原文里有
      question: '下周想为哪件小事留一点时间',
    }),
    list,
  )!;
  assert.equal(res.quote?.entryId, 'a');
  assert.deepEqual(res.themes, ['陪伴', '日常']);
  assert.ok(res.question.endsWith('？'));
  // 编造的原句不进结果
  const res2 = parseReview(JSON.stringify({ summary: '这一周你在陪伴家人和朋友的日常里走过。', quote: '原文里根本没有这句话' }), list)!;
  assert.equal(res2.quote, undefined);
  // summary 太短视为失败
  assert.equal(parseReview('{"summary":"短"}', list), null);
});

/* ---------------- 隐私边界 ---------------- */

test('AI 隐私：隐藏、回收站、草稿日记永远不发给模型', () => {
  assert.equal(canSendEntry(entry({ hidden: false })), true);
  assert.equal(canSendEntry(entry({ hidden: true })), false);
  assert.equal(canSendEntry(entry({ deletedAt: 1 })), false);
  const list = [entry({ id: 'ok' }), entry({ id: 'h', hidden: true }), entry({ id: 'd', deletedAt: 1 }), entry({ id: 'draft', status: 'draft' })];
  assert.deepEqual(sendableEntries(list).map(e => e.id), ['ok']);
});

test('AI 隐私：过长正文只保留开头和结尾，中间明确标记省略', () => {
  const long = '开头'.repeat(10) + '中'.repeat(6000) + '结尾'.repeat(10);
  const clipped = clipText(long, 4000);
  assert.ok(clipped.length < long.length);
  assert.ok(clipped.startsWith('开头') && clipped.endsWith('结尾'));
  assert.ok(clipped.includes('中间省略'));
  assert.equal(clipText('短文'), '短文');
});

/* ---------------- 本机建议 ---------------- */

test('AI 本机：标题取首句、标签看关键词、心情有明显倾向才猜、追问按时段出', () => {
  assert.equal(localTitle('今天陪妈妈去了菜市场。晚上一起做饭。'), '今天陪妈妈去了菜市场');
  assert.equal(localTitle('   '), null);
  const tags = [tag('work', '工作'), tag('life', '生活'), tag('sport', '运动')];
  assert.deepEqual(localTags('今天去超市买了菜，晚上做饭，收拾了房间', tags), ['life']);
  assert.deepEqual(localTags('今天去超市', tags, ['life']), []);
  assert.equal(localMood('今天真的好累，很累很累，撑不住了'), 'tired');
  assert.equal(localMood('今天去了菜市场'), undefined); // 没有明显倾向不猜
  const empty = localQuestions({ hasBody: false, hour: 8, seed: 0 });
  const later = localQuestions({ hasBody: false, hour: 8, seed: 3 });
  const deepen = localQuestions({ hasBody: true, hour: 8, seed: 0 });
  assert.equal(empty.length, 3);
  assert.notDeepEqual(empty, later); // seed 换一批
  assert.notDeepEqual(empty, deepen); // 有正文后换「往深处问」的问题
});

/* ---------------- 记忆挑选 ---------------- */

test('AI 记忆：挑和今天相关（同一个人/相同关键词）的旧日记，排除隐藏和未来的', () => {
  const now = 200 * 86400000;
  const old = (id: string, over: Partial<Entry>) => entry({ id, createdAt: now - 10 * 86400000, ...over });
  const entries = [
    old('same-person', { people: ['p_mom'], body: '完全不同的内容' }),
    old('same-words', { body: '上次也去了那家菜市场，菜市场的阿姨还记得我' }),
    old('unrelated', { body: '一些无关的话' }),
    old('hidden', { people: ['p_mom'], hidden: true }),
    old('draft', { people: ['p_mom'], status: 'draft' }),
    entry({ id: 'future', createdAt: now + 86400000, people: ['p_mom'] }),
  ];
  const today = entry({ id: 'today', createdAt: now, people: ['p_mom'], body: '今天又去了菜市场' });
  const picks = pickMemories(today, entries);
  const ids = picks.map(m => m.entryId);
  assert.ok(ids.includes('same-person') && ids.includes('same-words'));
  assert.ok(!ids.includes('unrelated') && !ids.includes('hidden') && !ids.includes('draft') && !ids.includes('future') && !ids.includes('today'));
});

/* ---------------- 周 / 月回顾 ---------------- */

test('AI 回顾：自然周从周一开始，自然月取整月，区间内只收可发送的日记', () => {
  // 2026-11-20 是周五
  const now = new Date(2026, 10, 20, 15).getTime();
  const w = periodRange('week', 0, now);
  assert.equal(new Date(w.from).getDay(), 1); // 周一
  assert.equal((w.to - w.from) / 86400000, 7);
  assert.equal(w.label, '本周');
  const m = periodRange('month', -1, now);
  assert.equal(new Date(m.from).getDate(), 1);
  assert.equal(new Date(m.from).getMonth(), 9);
  assert.equal(new Date(m.to).getMonth(), 10);
  assert.equal(m.label, '上月');

  const inside = entry({ id: 'in', createdAt: w.from + 1000 });
  const outside = entry({ id: 'out', createdAt: w.to + 1000 });
  const hidden = entry({ id: 'hid', createdAt: w.from + 2000, hidden: true });
  assert.deepEqual(entriesInRange([outside, hidden, inside], w.from, w.to).map(e => e.id), ['in']);

  const stats = periodStats([inside, hidden, entry({ id: 'x', createdAt: w.from + 3000, mood: 'calm', people: ['p1'] })], w.from, w.to);
  assert.deepEqual([stats.count, stats.moods[0]?.mood, stats.people[0]?.id], [2, 'calm', 'p1']);
});

test('AI 回顾：摘录带上日期、心情和人名；篇数多时自动压短', () => {
  const ctx = { tags: [tag('life', '生活')], people: [person('p_mom', '妈妈', { relation: 'family' })] };
  const list = [entry({ id: 'a', createdAt: new Date(2026, 10, 16, 10).getTime(), mood: 'calm', people: ['p_mom'], title: '周一', body: '和妈妈喝茶' })];
  const digest = buildDigest(list, ctx);
  assert.ok(digest.includes('11月16日') && digest.includes('心情：平静') && digest.includes('和：妈妈') && digest.includes('周一'));
  const many = Array.from({ length: 30 }, (_, i) => entry({ id: `e${i}`, createdAt: 1000 + i, body: '字'.repeat(500) }));
  const short = buildDigest(many, ctx, 9000);
  assert.ok(short.length < 30 * 500);
});

/* ---------------- 提示词与接口 ---------------- */

test('AI 提示词：日记描述只含文字信息；危机日记换上谨慎的提示词', () => {
  const ctx = { tags: [tag('life', '生活')], people: [person('p_mom', '妈妈', { relation: 'family' })] };
  const e = entry({ title: '晚饭', body: '和妈妈吃饭', mood: 'calm', tags: ['life'], people: ['p_mom'], createdAt: new Date(2026, 10, 20, 19).getTime() });
  const desc = describeEntry(e, ctx);
  assert.ok(desc.includes('心情：平静') && desc.includes('身边人：妈妈（家人）') && desc.includes('和妈妈吃饭'));
  const normal = buildReplyMessages(e, ctx);
  const crisis = buildReplyMessages(entry({ ...e, body: '觉得活着没意思' }), ctx, { crisis: true });
  assert.ok(!normal[0].content.includes(HOTLINE.number));
  assert.ok(crisis[0].content.includes(HOTLINE.number));
  assert.equal(detectCrisis('最近总是想，活着没意思'), true);
  assert.equal(detectCrisis('今天过得很平静'), false);
});

test('AI 接口：地址补全、主机名提取、配置完整性', () => {
  assert.equal(resolveApiUrl('api.example.com'), 'https://api.example.com/v1/chat/completions');
  assert.equal(resolveApiUrl('https://a.com/v1/'), 'https://a.com/v1/chat/completions');
  assert.equal(resolveApiUrl('https://a.com/v2beta', 'models'), 'https://a.com/v2beta/models');
  assert.equal(resolveApiUrl('https://a.com/v1/chat/completions'), 'https://a.com/v1/chat/completions');
  assert.equal(apiHost('https://api.example.com/v1'), 'api.example.com');
  assert.equal(apiHost('example.com/v1'), 'example.com');
  assert.equal(isConfigComplete({ baseUrl: 'x', model: 'y', apiKey: 'k' }), true);
  assert.equal(isConfigComplete({ baseUrl: 'x', model: '', apiKey: 'k' }), false);
});

test('AI 接口：错误按状态码分类，网络错误与坏响应都能看懂', async () => {
  const cfg = { baseUrl: 'https://a.com', model: 'm', apiKey: 'k' };
  const msgs = [{ role: 'user' as const, content: 'hi' }];
  const kindOf = async (impl: typeof fetch) => {
    try {
      await chatComplete(cfg, msgs, { fetchImpl: impl, timeoutMs: 3000 });
      return 'ok';
    } catch (e) {
      assert.ok(e instanceof AIError);
      return (e as AIError).kind;
    }
  };
  assert.equal(await kindOf(fakeFetch({ choices: [{ message: { content: ' 回答 ' } }] })), 'ok');
  assert.equal(await chatComplete(cfg, msgs, { fetchImpl: fakeFetch({ choices: [{ message: { content: ' 回答 ' } }] }) }), '回答');
  assert.equal(await kindOf(fakeFetch({}, 401)), 'auth');
  assert.equal(await kindOf(fakeFetch({}, 429)), 'rate');
  assert.equal(await kindOf(fakeFetch({}, 500)), 'server');
  assert.equal(await kindOf(failFetch()), 'network');
  assert.equal(await kindOf(fakeFetch({ choices: [{}] })), 'bad_response');
  assert.ok(aiErrorMessage(new AIError('auth')).includes('密钥'));
});

/* ---------------- 服务层（状态机 + 回信落库） ---------------- */

test('AI 服务：未同意/未配置不发请求；隐藏日记不发；回信写进日记', async () => {
  await freshStore();
  const e = entry({ id: 'post', title: '晚饭', body: '今天和妈妈一起做饭，她说我切菜变快了。' });
  actions.upsertEntry(e, true);

  // 没开启：shouldAutoReply 否、writeReply 报 disabled
  assert.equal(aiStatus(getState().ai, true), 'off');
  assert.equal(await shouldAutoReply(e), false);
  await assert.rejects(() => writeReply('post'), (err: unknown) => (err as AIError).kind === 'disabled');

  // 开启但没密钥：needs_setup
  actions.setAI({ enabled: true, consentAt: 1, baseUrl: 'https://a.com', model: 'm' });
  assert.equal(aiStatus(getState().ai, false), 'needs_setup');
  assert.equal(await shouldAutoReply(e), false);

  // 配齐了：ready；隐藏日记仍然不发
  await setAIKey('k');
  assert.equal(await shouldAutoReply(e), true);
  assert.equal(await shouldAutoReply(entry({ ...e, hidden: true })), false);

  const replyText = '切菜变快了，妈妈在用最日常的方式夸你，这顿饭里藏着她没说出口的放心。';
  const text = await writeReply('post', { fetchImpl: fakeFetch({ choices: [{ message: { content: replyText } }] }) });
  assert.ok(text.includes('妈妈'));
  assert.equal(getState().entries.find(x => x.id === 'post')?.ai?.reply?.text, text);

  // 隐藏日记直接拒绝
  actions.upsertEntry(entry({ id: 'hid', hidden: true, body: '秘密' }), true);
  await assert.rejects(() => writeReply('hid'), (err: unknown) => (err as AIError).kind === 'hidden');
  await setAIKey('');
});
