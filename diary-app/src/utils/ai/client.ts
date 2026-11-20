/**
 * 与模型服务通信（OpenAI 兼容的 chat/completions 接口）。
 * 这里是整个应用里唯一会把日记文字发到设备之外的地方。
 */

export interface AIConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AIErrorKind =
  | 'disabled' // 没开启或没同意
  | 'not_configured' // 地址 / 模型 / 密钥没填全
  | 'hidden' // 隐藏日记不发送
  | 'empty' // 没有可以发送的内容
  | 'auth'
  | 'rate'
  | 'network'
  | 'timeout'
  | 'server'
  | 'bad_response'
  | 'aborted';

const MESSAGES: Record<AIErrorKind, string> = {
  disabled: '还没有开启「记得」',
  not_configured: '请先填写服务地址、模型和密钥',
  hidden: '隐藏日记不会发送给 AI',
  empty: '先写一点内容吧',
  auth: '密钥无效或已过期',
  rate: '请求太频繁，或额度已用完',
  network: '连不上模型服务，请检查网络和服务地址',
  timeout: '等了太久没有回应，请稍后再试',
  server: '模型服务暂时出错了',
  bad_response: '模型返回的内容看不懂',
  aborted: '已取消',
};

export class AIError extends Error {
  constructor(public readonly kind: AIErrorKind, detail?: string) {
    super(detail ? `${MESSAGES[kind]}（${detail}）` : MESSAGES[kind]);
    this.name = 'AIError';
  }
}

export function aiErrorMessage(e: unknown): string {
  return e instanceof AIError ? e.message : '出了点问题，请稍后再试';
}

/** 把用户填的服务地址补成完整的接口地址：可以填到域名、填到 /v1，或者直接填完整路径 */
export function resolveApiUrl(baseUrl: string, path: 'chat/completions' | 'models' = 'chat/completions'): string {
  let u = baseUrl.trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  u = u.replace(/\/(chat\/completions|models)$/i, '');
  if (!/\/v\d+[a-z]*$/i.test(u)) u = `${u}/v1`;
  return `${u}/${path}`;
}

/** 服务地址里的主机名，用来告诉用户「内容会发到哪里」 */
export function apiHost(baseUrl: string): string {
  const m = /^(?:https?:\/\/)?([^/\s?#]+)/i.exec(baseUrl.trim());
  return m ? m[1] : '';
}

export function isConfigComplete(cfg: Partial<AIConfig> | null | undefined): cfg is AIConfig {
  return !!cfg && !!cfg.baseUrl?.trim() && !!cfg.model?.trim() && !!cfg.apiKey?.trim();
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** 测试时注入 */
  fetchImpl?: typeof fetch;
}

function kindForStatus(status: number): AIErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429 || status === 402) return 'rate';
  if (status === 408 || status === 504) return 'timeout';
  return 'server';
}

async function request(url: string, init: RequestInit, opts: ChatOptions): Promise<any> {
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? 60000);
  const onAbort = () => ctrl.abort();
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', onAbort);
  }
  try {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, signal: ctrl.signal });
    } catch {
      throw new AIError(timedOut ? 'timeout' : opts.signal?.aborted ? 'aborted' : 'network');
    }
    if (!res.ok) throw new AIError(kindForStatus(res.status), String(res.status));
    try {
      return await res.json();
    } catch {
      throw new AIError(timedOut ? 'timeout' : 'bad_response');
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/** 发一轮对话，返回模型回复的文字 */
export async function chatComplete(cfg: AIConfig, messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (!isConfigComplete(cfg)) throw new AIError('not_configured');
  const data = await request(
    resolveApiUrl(cfg.baseUrl),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey.trim()}` },
      body: JSON.stringify({
        model: cfg.model.trim(),
        messages,
        temperature: opts.temperature ?? 0.6,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        stream: false,
      }),
    },
    opts,
  );
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AIError('bad_response');
  return content.trim();
}

/** 列出服务提供的模型，用于「检测连接」和选模型 */
export async function listModels(cfg: Pick<AIConfig, 'baseUrl' | 'apiKey'>, opts: ChatOptions = {}): Promise<string[]> {
  if (!cfg.baseUrl.trim() || !cfg.apiKey.trim()) throw new AIError('not_configured');
  const data = await request(
    resolveApiUrl(cfg.baseUrl, 'models'),
    { method: 'GET', headers: { Authorization: `Bearer ${cfg.apiKey.trim()}` } },
    { timeoutMs: 20000, ...opts },
  );
  const list: unknown[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return list
    .map(m => (typeof m === 'string' ? m : (m as { id?: unknown })?.id))
    .filter((id): id is string => typeof id === 'string' && !!id)
    .sort();
}
