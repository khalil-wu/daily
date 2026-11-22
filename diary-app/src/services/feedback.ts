import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

const DRAFT_KEY = 'jide:feedback-draft:v1';
export interface FeedbackDraft { id: string; text: string }
let writes: Promise<unknown> = Promise.resolve();

export function newFeedbackDraft(text = ''): FeedbackDraft {
  // randomUUID is HTTPS-only on web; getRandomValues also works at the current HTTP IP.
  const bytes = Crypto.getRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { id, text };
}

export function saveFeedbackDraft(draft: FeedbackDraft): Promise<void> {
  const next = writes.catch(() => {}).then(() => AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)));
  writes = next;
  return next;
}

export async function loadFeedbackDraft(): Promise<FeedbackDraft> {
  await writes.catch(() => {});
  const raw = await AsyncStorage.getItem(DRAFT_KEY);
  if (raw) {
    try {
      const value = JSON.parse(raw);
      if (typeof value.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.id) && typeof value.text === 'string') return { id: value.id, text: value.text.slice(0, 4000) };
    } catch { /* Corrupt auxiliary draft does not affect the diary. */ }
  }
  return newFeedbackDraft();
}

export async function submitFeedback(draft: FeedbackDraft): Promise<string> {
  if (!draft.text.trim()) throw new Error('请先填写反馈内容');
  await saveFeedbackDraft(draft);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const endpoint = Platform.OS === 'web' ? '/api/feedback' : 'http://39.105.19.77/api/feedback';
    const response = await fetch(endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: draft.id, message: draft.text.trim(), version: '1.0.0', platform: Platform.OS }),
    });
    let result: { received?: boolean; id?: string; error?: string } = {};
    try { result = await response.json(); } catch { /* Old static deployment may return HTML. */ }
    if (!response.ok || result.received !== true || result.id !== draft.id) {
      throw new Error(result.error || '反馈服务暂时不可用，内容已保留，可稍后重试或导出');
    }
    return draft.id;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('提交超时，内容已保留。重试不会重复提交');
    if (error instanceof TypeError) throw new Error('无法连接反馈服务，内容已保留，请检查网络后重试');
    throw error;
  } finally { clearTimeout(timeout); }
}
