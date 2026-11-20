import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AISettings, Entry, PeriodReview } from '../store/types';
import { actions, getState, useStore } from '../store/store';
import { AIError, aiErrorMessage, chatComplete, isConfigComplete, type AIConfig } from '../utils/ai/client';
import { pickMemories } from '../utils/ai/memory';
import { acceptTidied, parseOrganize, parseQuestions, parseReply, parseReview, type OrganizeResult } from '../utils/ai/parse';
import { canSendEntry } from '../utils/ai/privacy';
import { buildFollowUpMessages, buildOrganizeMessages, buildReplyMessages, buildReviewMessages, buildTidyMessages } from '../utils/ai/prompts';
import { buildDigest, entriesInRange, MIN_REVIEW_ENTRIES, periodRange, type ReviewKind } from '../utils/ai/review';
import { detectCrisis } from '../utils/ai/safety';
import { plainText, uid } from '../utils/text';
import { getAIKey } from './aiKey';

/**
 * 「记得」的全部联网动作都从这里出去。
 * 每个动作发出之前都要过三道检查：已开启并同意、配置齐全、这篇日记允许发送（隐藏日记不发）。
 */

export interface AIRuntime {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export type AIStatus = 'off' | 'needs_setup' | 'ready';

export function aiStatus(ai: AISettings, hasKey: boolean): AIStatus {
  if (!ai.enabled || !ai.consentAt) return 'off';
  return ai.baseUrl.trim() && ai.model.trim() && hasKey ? 'ready' : 'needs_setup';
}

/** 界面用：当前「记得」处于什么状态（密钥变化后重新检测） */
export function useAIStatus(): AIStatus {
  const ai = useStore(s => s.ai);
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => {
    let live = true;
    void getAIKey().then(k => {
      if (live) setHasKey(!!k);
    });
    return () => {
      live = false;
    };
  }, [ai.enabled, ai.baseUrl, ai.model]);
  return aiStatus(ai, hasKey);
}

async function loadConfig(): Promise<AIConfig> {
  const ai = getState().ai;
  if (!ai.enabled || !ai.consentAt) throw new AIError('disabled');
  const cfg = { baseUrl: ai.baseUrl, model: ai.model, apiKey: await getAIKey() };
  if (!isConfigComplete(cfg)) throw new AIError('not_configured');
  return cfg;
}

function ctx() {
  const s = getState();
  return { tags: s.tags, people: s.people };
}

function hasText(entry: Pick<Entry, 'title' | 'body'>) {
  return !!entry.title.trim() || !!plainText(entry.body).trim();
}

/** 追问：帮用户继续往下写。空白页也可以问 */
export async function askFollowUps(entry: Entry, avoid: string[] = [], rt: AIRuntime = {}): Promise<string[]> {
  if (!canSendEntry(entry)) throw new AIError('hidden');
  const cfg = await loadConfig();
  const raw = await chatComplete(cfg, buildFollowUpMessages(entry, ctx(), avoid), { temperature: 0.8, ...rt });
  const list = parseQuestions(raw);
  if (!list.length) throw new AIError('bad_response');
  return list;
}

/** 整理：标题、心情、标签、身边人的建议 */
export async function organizeEntry(entry: Entry, rt: AIRuntime = {}): Promise<OrganizeResult> {
  if (!canSendEntry(entry)) throw new AIError('hidden');
  if (!plainText(entry.body).trim()) throw new AIError('empty');
  const cfg = await loadConfig();
  const c = ctx();
  const raw = await chatComplete(cfg, buildOrganizeMessages(entry, c), { temperature: 0.3, ...rt });
  const result = parseOrganize(raw, { ...c, body: `${entry.title}\n${entry.body}` });
  if (!result) throw new AIError('bad_response');
  return result;
}

/** 理顺口述：只补标点、分段、去口头语。结果不合格（篇幅变化过大）时报错，原文不动 */
export async function tidyBody(entry: Entry, rt: AIRuntime = {}): Promise<string> {
  if (!canSendEntry(entry)) throw new AIError('hidden');
  if (plainText(entry.body).trim().length < 12) throw new AIError('empty');
  const cfg = await loadConfig();
  const raw = await chatComplete(cfg, buildTidyMessages(entry.body), { temperature: 0.2, ...rt });
  const next = acceptTidied(entry.body, raw);
  if (!next) throw new AIError('bad_response');
  return next;
}

/** 回信：写完之后「记得」回一封短信，并存进这篇日记 */
export async function writeReply(entryId: string, rt: AIRuntime = {}): Promise<string> {
  const s = getState();
  const entry = s.entries.find(e => e.id === entryId);
  if (!entry || !hasText(entry)) throw new AIError('empty');
  if (!canSendEntry(entry)) throw new AIError('hidden');
  const cfg = await loadConfig();
  const memories = s.ai.useMemory ? pickMemories(entry, s.entries) : [];
  const crisis = detectCrisis(`${entry.title}\n${entry.body}`);
  const raw = await chatComplete(cfg, buildReplyMessages(entry, ctx(), { memories, crisis }), { temperature: 0.7, ...rt });
  const text = parseReply(raw);
  if (!text) throw new AIError('bad_response');
  actions.setEntryAI(entryId, { reply: { text, at: Date.now() } });
  return text;
}

/** 周 / 月回顾：读这段时间的日记，写一份回看，并存下来 */
export async function writeReview(kind: ReviewKind, offset = 0, rt: AIRuntime = {}, now = Date.now()): Promise<PeriodReview> {
  const s = getState();
  const period = periodRange(kind, offset, now);
  const list = entriesInRange(s.entries, period.from, period.to);
  if (list.length < MIN_REVIEW_ENTRIES) throw new AIError('empty');
  const cfg = await loadConfig();
  const raw = await chatComplete(cfg, buildReviewMessages(period.label, buildDigest(list, ctx())), { temperature: 0.5, timeoutMs: 90000, ...rt });
  const result = parseReview(raw, list);
  if (!result) throw new AIError('bad_response');
  const review: PeriodReview = { id: uid('rv'), kind, from: period.from, to: period.to, createdAt: Date.now(), entryCount: list.length, ...result };
  actions.saveReview(review);
  return review;
}

/* ---------------- 回信任务（发布后在后台进行，页面可随时查看进度） ---------------- */

export interface ReplyJob {
  status: 'idle' | 'loading' | 'error';
  error?: string;
}

const IDLE: ReplyJob = { status: 'idle' };
const jobs = new Map<string, ReplyJob>();
const jobSubs = new Set<() => void>();

function setJob(id: string, job: ReplyJob) {
  if (job.status === 'idle') jobs.delete(id);
  else jobs.set(id, job);
  jobSubs.forEach(fn => fn());
}

/** 开始写回信（同一篇日记不会同时写两封）。结果存进日记后任务结束 */
export function startReply(entryId: string, rt: AIRuntime = {}): Promise<void> {
  if (jobs.get(entryId)?.status === 'loading') return Promise.resolve();
  setJob(entryId, { status: 'loading' });
  return writeReply(entryId, rt).then(
    () => setJob(entryId, IDLE),
    e => setJob(entryId, { status: 'error', error: aiErrorMessage(e) }),
  );
}

export function clearReplyJob(entryId: string) {
  if (jobs.get(entryId)?.status !== 'loading') setJob(entryId, IDLE);
}

export function getReplyJob(entryId?: string): ReplyJob {
  return (entryId && jobs.get(entryId)) || IDLE;
}

export function useReplyJob(entryId?: string): ReplyJob {
  return useSyncExternalStore(
    cb => {
      jobSubs.add(cb);
      return () => jobSubs.delete(cb);
    },
    () => getReplyJob(entryId),
    () => getReplyJob(entryId),
  );
}

/** 发布后要不要自动请「记得」回信 */
export async function shouldAutoReply(entry: Pick<Entry, 'hidden' | 'deletedAt' | 'title' | 'body'>): Promise<boolean> {
  const ai = getState().ai;
  if (!ai.autoReply || !canSendEntry(entry) || !hasText(entry)) return false;
  return aiStatus(ai, !!(await getAIKey())) === 'ready';
}
