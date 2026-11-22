import type { Account, Entry, SyncMetadata } from '../store/types';
import { isEntryRecord, normalizeEntry } from '../store/storage';
import { sha256 as hashText, isPhone } from '../utils/text';
import { sameEntry } from '../store/sync';
import { mapEntryMedia, parseCloudMedia } from './syncMedia';

/**
 * 云端服务（腾讯云开发 CloudBase）。
 * 在 app.json extra.cloudbase 里配置环境 ID 之前，cloudConfigured() 为 false，
 * 应用保持完全本地可用（账号/同步走本机模拟）。
 */

import { cloudbaseEnvId, cloudbaseRegion } from './cloud.config';

interface CloudConfig {
  env: string;
  region?: string;
}

function readConfig(): CloudConfig {
  return { env: cloudbaseEnvId, region: cloudbaseRegion };
}

/** 只认真实运行时（浏览器或 React Native）；Node 测试环境视为未配置。 */
function runtimeSupported(): boolean {
  if (typeof document !== 'undefined') return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';
}

export function cloudConfigured(): boolean {
  return !!readConfig().env && runtimeSupported();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any = null;
let inited = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pendingOtp: { verifyOtp?: (p: { token: string | number }) => Promise<any> } | null = null;
let pendingOtpIdentifier = '';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pendingReset: ((p: { nonce: string; password: string }) => Promise<any>) | null = null;

/** 一次性人机验证票据：Web 端发码前注入 /cb 网关，由服务端核销。 */
let otpTicket: string | null = null;
export function setOtpTicket(ticket: string | null) {
  otpTicket = ticket;
}

/**
 * Web 端把对 CloudBase 网关的请求改写到本站 /cb/ 路径，
 * 由 nginx 反向代理转发并剥掉 Origin，绕开免费版不支持
 * 自定义 Web 安全域名的限制。RN 端无 CORS 约束，直连即可。
 */
function patchWebGateway(env: string) {
  if (typeof window === 'undefined') return;
  const gateway = `https://${env}.api.tcloudbasegateway.com`;
  const proxyUrl = (value: string) => {
    try {
      const url = new URL(value, window.location.href);
      if (url.origin !== gateway) return value;
      let proxied = `/cb${url.pathname}${url.search}`;
      // OTP 发送必须带人机验证票据；服务端核销后才转发到 CloudBase。
      if (url.pathname === '/auth/v1/verification' && otpTicket) {
        proxied += `${url.search ? '&' : '?'}jt=${encodeURIComponent(otpTicket)}`;
      }
      return proxied;
    } catch { return value; }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__jideGatewayPatched) {
    w.__jideGatewayPatched = true;
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
      const u = String(url);
      return origOpen.call(this, method, proxyUrl(u), ...rest as []);
    };
    const origFetch = window.fetch?.bind(window);
    if (origFetch) {
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const proxied = proxyUrl(u);
        if (proxied !== u) return origFetch(typeof Request !== 'undefined' && input instanceof Request ? new Request(new URL(proxied, window.location.href), input) : proxied, init);
        return origFetch(input as RequestInfo, init);
      };
    }
  }
}

export function initCloud() {
  if (inited || !cloudConfigured()) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cloudbase = require('@cloudbase/js-sdk').default ?? require('@cloudbase/js-sdk');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRN = typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';
  if (isRN) {
    // RN 端需要官方适配器（mmkv 持久化登录态）；Web 端 SDK 自带浏览器适配
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const adapter = require('@cloudbase/adapter-rn');
    cloudbase.useAdapters(adapter.default ?? adapter);
  }
  const c = readConfig();
  if (!isRN) patchWebGateway(c.env);
  app = cloudbase.init({ env: c.env, region: c.region });
  auth = app.auth();
  inited = true;
}

function ensureInit() {
  initCloud();
  if (!inited) throw new Error('云端尚未配置');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(res: any): any {
  if (res?.error) throw Object.assign(new Error(res.error.message || '云端错误'), { code: res.error.code });
  return res?.data ?? res;
}

/* ---------------- 账号 ---------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAccount(user: any): Account {
  if (!user || !(user.uid ?? user.id)) throw new Error('登录尚未完成，请完成账号验证后重试');
  return {
    id: user?.uid ?? user?.id ?? '',
    identifier: user?.phone ?? user?.email ?? user?.username ?? '',
    nickname: user?.name ?? user?.nickname ?? user?.email ?? user?.phone ?? '记得自己',
    createdAt: user?.created_at ? new Date(user.created_at).getTime() : Date.now(),
    remote: true,
  };
}

/** 恢复本地登录态；无会话返回 null。 */
export async function currentRemoteAccount(): Promise<Account | null> {
  if (!cloudConfigured()) return null;
  initCloud();
  if (!inited) return null;
  const state = await auth.getLoginState();
  const user = state?.user ?? state;
  return user ? toAccount(user) : null;
}

/** 手机号：发送登录/注册验证码（未注册自动注册）。 */
export async function sendSmsCode(phone: string) {
  ensureInit();
  const res = await auth.signInWithOtp({ phone: `+86 ${phone}`, options: { shouldCreateUser: true } });
  pendingOtp = unwrap(res) ?? res;
  pendingOtpIdentifier = phone.trim();
}

/** 手机号 + 验证码：登录。 */
export async function loginByPhone(phone: string, code: string): Promise<Account> {
  ensureInit();
  if (!pendingOtp?.verifyOtp || pendingOtpIdentifier !== phone.trim()) throw new Error('请先为当前手机号获取验证码');
  const res = await pendingOtp!.verifyOtp!({ token: code });
  pendingOtp = null;
  const data = unwrap(res);
  return toAccount(data?.user ?? data);
}

/** 邮箱：发送登录/注册验证码（内置邮件代发，未注册自动注册）。 */
export async function sendEmailCode(email: string) {
  ensureInit();
  const res = await auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  pendingOtp = unwrap(res) ?? res;
  pendingOtpIdentifier = email.trim().toLowerCase();
}

/** 邮箱 + 验证码：登录。 */
export async function loginByEmail(email: string, code: string): Promise<Account> {
  ensureInit();
  if (!pendingOtp?.verifyOtp || pendingOtpIdentifier !== email.trim().toLowerCase()) throw new Error('请先为当前邮箱获取验证码');
  const res = await pendingOtp!.verifyOtp!({ token: code });
  pendingOtp = null;
  const data = unwrap(res);
  return toAccount(data?.user ?? data);
}

/**
 * 注册验证码（手机号或邮箱）：走 SDK signUp 流程，验证码通过时
 * 密码随账号一并写入；已存在的账号则等价于验证码登录。
 * 密码须在发码时确定——之后修改密码需要重新获取验证码。
 */
export async function sendRegisterCode(identifier: string, password: string) {
  ensureInit();
  const id = identifier.trim();
  const params = isPhone(id) ? { phone: `+86 ${id}`, password } : { email: id, password };
  const res = await auth.signUp(params);
  const data = unwrap(res);
  if (typeof data?.verifyOtp !== 'function') throw new Error('验证码通道异常，请稍后再试');
  pendingOtp = { verifyOtp: data.verifyOtp };
  pendingOtpIdentifier = isPhone(id) ? id : id.toLowerCase();
}

/**
 * 重置密码验证码（手机号或邮箱，target=USER，账号必须已存在）。
 * 新版 SDK 用 resetPasswordForEmail：验证 nonce 后直接写入新密码并自动登录。
 */
export async function requestPasswordReset(identifier: string) {
  ensureInit();
  const id = identifier.trim();
  const res = await auth.resetPasswordForEmail(isPhone(id) ? id : id.toLowerCase());
  const data = unwrap(res);
  if (typeof data?.updateUser !== 'function') throw new Error('重置通道异常，请稍后再试');
  pendingReset = data.updateUser;
}

/** 验证码 + 新密码确认重置；成功后云端已登录，返回账号供本地切换。 */
export async function confirmPasswordReset(code: string, newPassword: string): Promise<Account> {
  ensureInit();
  if (!pendingReset) throw new Error('请先获取验证码');
  const data = unwrap(await pendingReset({ nonce: code, password: newPassword }));
  pendingReset = null;
  const account = await currentRemoteAccount();
  return account ?? toAccount(data?.user ?? data);
}

/** 手机号或邮箱 + 密码登录。 */
export async function loginByPassword(identifier: string, password: string): Promise<Account> {
  ensureInit();
  const id = identifier.trim();
  const params = /^1\d{10}$/.test(id) ? { phone: `+86 ${id}`, password } : { email: id, password };
  const res = await auth.signInWithPassword(params);
  const data = unwrap(res);
  return toAccount(data?.user ?? data);
}

export async function logoutRemote() {
  pendingOtp = null;
  pendingOtpIdentifier = '';
  pendingReset = null;
  if (!inited) return;
  unwrap(await auth.signOut());
}

/* ---------------- 多账号会话快照（快速切换） ---------------- */

/**
 * SDK 把整份会话（access/refresh token 等）以 `xxx{env}` 为 key 存在 localStorage；
 * 切换账号时按账号快照保存、用时恢复，refresh token 有效期内即可免密登录。
 * RN 端凭证在适配器存储（mmkv），此处返回 null，调用方回退到重新登录。
 */
function sessionStorageKeys(): string[] {
  if (typeof localStorage === 'undefined') return [];
  const env = readConfig().env;
  if (!env) return [];
  return Object.keys(localStorage).filter(k => k.endsWith(env) && k !== `lang_${env}`);
}

/** 当前云端会话快照；无会话（或未登录）返回 null。 */
export function snapshotRemoteSession(): Record<string, string> | null {
  const keys = sessionStorageKeys();
  if (!keys.length || typeof localStorage === 'undefined') return null;
  const snap: Record<string, string> = {};
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v != null) snap[k] = v;
  }
  return Object.keys(snap).length ? snap : null;
}

/** 把快照写回 storage（不触发任何网络请求）。 */
export function restoreRemoteSession(snap: Record<string, string>) {
  if (typeof localStorage === 'undefined') return;
  for (const [k, v] of Object.entries(snap)) localStorage.setItem(k, v);
}

/** 只删本地会话凭证，不调 signOut——refresh token 保留，日后恢复快照仍有效。 */
export function dropRemoteSessionLocal() {
  if (typeof localStorage === 'undefined') return;
  for (const k of sessionStorageKeys()) localStorage.removeItem(k);
}

/** 换会话前重置 SDK 单例与挂起流程：其内存凭证缓存与 storage 解耦，必须重建。 */
export function resetRemoteSessionCache() {
  inited = false;
  app = null;
  auth = null;
  pendingOtp = null;
  pendingOtpIdentifier = '';
  pendingReset = null;
}

/* ---------------- 日记同步 ---------------- */

const COLLECTION = 'diary_entries';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return app.database();
}

async function uid(expected?: string): Promise<string> {
  const state = await auth.getLoginState();
  const user = state?.user ?? state;
  const id = user?.uid ?? user?.id;
  if (!id) throw new Error('云端会话已失效，请重新登录');
  if (expected && id !== expected) throw new Error('云端会话账号已切换，请重新同步');
  return id;
}

interface Row { _id: string; entryId: string; updatedAt: number; data: Entry; kind?: string; metadata?: SyncMetadata }

function confirmAdded(result: { id?: string; ids?: string[]; insertedIds?: string[]; code?: string; message?: string }) {
  if (result?.id || result?.ids?.length || result?.insertedIds?.length) return;
  if (/duplicate|exist/i.test(result?.code ?? '')) throw new Error('另一设备刚创建了这篇记录，请重新同步');
  throw new Error(`云端未确认写入${result?.code ? `（${result.code}）` : ''}，请检查权限后重试`);
}

/** CloudBase caps individual queries; page through every record in stable order. */
async function allRows(userId: string): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const result = await db().collection(COLLECTION).where({ uid: userId }).orderBy('_id', 'asc').skip(offset).limit(pageSize).get();
    if (!Array.isArray(result?.data)) throw new Error('云端返回的数据格式不正确');
    rows.push(...result.data);
    if (result.data.length < pageSize) return rows;
  }
}

/** 拉取当前用户云端的全部日记。 */
export async function pullRemoteEntries(expectedAccount?: string): Promise<Entry[]> {
  ensureInit();
  const id = await uid(expectedAccount);
  const rows = (await allRows(id)).filter(r => r.kind !== 'metadata');
  if (rows.some(r => !isEntryRecord(r.data) || r.data.id !== r.entryId)) throw new Error('云端日记数据异常，请重试');
  return rows.map(r => normalizeEntry(r.data));
}

/** 按 entryId 更新；删除使用 tombstone，避免移除另一设备刚上传的日记。 */
export async function pushRemoteEntries(entries: Entry[], expectedRemote?: Entry[], expectedAccount?: string): Promise<void> {
  ensureInit();
  const id = await uid(expectedAccount);
  const rows = await allRows(id);
  const remoteById = new Map(rows.map(r => [r.entryId, r]));
  const expectedById = expectedRemote && new Map(expectedRemote.map(e => [e.id, e]));

  for (const e of entries) {
    await uid(id);
    const row = remoteById.get(e.id);
    if (row && isEntryRecord(row.data) && sameEntry(normalizeEntry(row.data), e)) continue;
    if (row && expectedById && (!expectedById.has(e.id) || !sameEntry(normalizeEntry(row.data), expectedById.get(e.id)!))) {
      throw new Error('另一设备刚修改了日记，请重新同步');
    }
    // A new remote edit since pull must not be silently overwritten by this upload.
    if (row && row.data.updatedAt > e.updatedAt) throw new Error('另一设备刚修改了日记，请重新同步');
    if (row) {
      const result = await db().collection(COLLECTION).where({ _id: row._id, uid: id, updatedAt: row.updatedAt }).update({ updatedAt: Math.max(e.updatedAt, row.updatedAt + 1), data: e });
      if (!(result.updated ?? result.stats?.updated)) throw new Error('另一设备刚修改了日记，请重新同步');
    } else {
      confirmAdded(await db().collection(COLLECTION).add({ _id: (await hashText(`${id}:${e.id}`)).slice(0, 32), uid: id, entryId: e.id, updatedAt: e.updatedAt, data: e }));
    }
  }
}

/** Metadata lives under the same uid access rule; device secrets never enter it. */
export async function pullRemoteMetadata(expectedAccount: string): Promise<SyncMetadata | undefined> {
  ensureInit();
  const id = await uid(expectedAccount);
  const rows = await allRows(id);
  return rows.find(r => r.kind === 'metadata')?.metadata;
}

export async function pushRemoteMetadata(metadata: SyncMetadata, expected: SyncMetadata | undefined, expectedAccount: string) {
  ensureInit();
  const id = await uid(expectedAccount);
  const rows = await allRows(id);
  const row = rows.find(r => r.kind === 'metadata');
  if (JSON.stringify(row?.metadata) !== JSON.stringify(expected)) throw new Error('另一设备刚修改了标签或设置，请重新同步');
  if (row) {
    const result = await db().collection(COLLECTION).where({ _id: row._id, uid: id, updatedAt: row.updatedAt })
      .update({ metadata, updatedAt: Math.max(Date.now(), row.updatedAt + 1) });
    if (!(result.updated ?? result.stats?.updated)) throw new Error('另一设备刚修改了标签或设置，请重新同步');
  } else confirmAdded(await db().collection(COLLECTION).add({ _id: (await hashText(`${id}:__metadata__`)).slice(0, 32), uid: id, entryId: '__metadata__', kind: 'metadata', metadata, updatedAt: Date.now() }));
}

export function remoteMediaTransport(expectedAccount: string) {
  return {
    async upload(path: string, bytes: Uint8Array, mime: string): Promise<string> {
      ensureInit();
      await uid(expectedAccount);
      try {
        const result = await app.uploadFile({ cloudPath: path, filePath: new Uint8Array(bytes).buffer, headers: { 'Content-Type': mime } });
        await uid(expectedAccount);
        if (!result?.fileID) throw new Error('missing file id');
        return result.fileID;
      } catch (error) { throw new Error(`云端附件上传失败，请检查网络、存储配额与权限：${(error as Error).message ?? '服务未返回回执'}`); }
    },
    async download(fileID: string, maxBytes: number): Promise<Uint8Array> {
      ensureInit();
      await uid(expectedAccount);
      const result = await app.getTempFileURL({ fileList: [fileID] });
      const file = result?.fileList?.[0];
      if (!file?.tempFileURL || (file.code && file.code !== 'SUCCESS')) throw new Error('云端附件下载失败，请检查存储权限');
      const response = await fetch(file.tempFileURL);
      if (!response.ok) throw new Error('云端附件下载失败，请稍后重试');
      if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('云端附件大小与记录不符');
      const reader = response.body?.getReader?.();
      let bytes: Uint8Array;
      if (reader) {
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          length += next.value.length;
          if (length > maxBytes) { await reader.cancel(); throw new Error('云端附件大小与记录不符'); }
          chunks.push(next.value);
        }
        bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      } else bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > maxBytes) throw new Error('云端附件大小与记录不符');
      await uid(expectedAccount);
      return bytes;
    },
  };
}

/** 注销云端账号（删除用户名下日记并注销账号）。 */
export async function destroyRemoteAccount(cachedMedia: string[] = []): Promise<void> {
  ensureInit();
  if (typeof auth.deleteUser !== 'function') throw new Error('当前服务暂不支持注销账号');
  const id = await uid();
  const rows = await allRows(id);
  const fileIds = new Set<string>();
  const collect = (uri: string) => { const media = parseCloudMedia(uri); if (media) fileIds.add(media.fileID); return uri; };
  cachedMedia.forEach(collect);
  rows.filter(row => row.kind !== 'metadata').forEach(row => mapEntryMedia(normalizeEntry(row.data), collect));
  const files = [...fileIds];
  for (let offset = 0; offset < files.length; offset += 50) {
    const batch = files.slice(offset, offset + 50);
    const result = await app.deleteFile({ fileList: batch });
    if (!Array.isArray(result?.fileList) || result.fileList.length !== batch.length || result.fileList.some((file: { code?: string }) => file.code && file.code !== 'SUCCESS' && !/NOT_FOUND|NONEXIST/i.test(file.code))) {
      throw new Error('云端附件删除尚未完成，请稍后重试注销');
    }
  }
  for (const row of rows) {
    const result = await db().collection(COLLECTION).doc(row._id).remove();
    if (result?.code || result?.deleted !== 1) throw new Error('云端记录删除尚未完成，请稍后重试注销');
  }
  unwrap(await auth.deleteUser({}));
}

/** 把云端错误翻成人话。 */
export function cloudError(e: unknown, fallback: string): string {
  const err = e as { code?: string | number; message?: string };
  const msg = err?.message ?? '';
  if (/^请先为当前|^请先获取验证码|^请先完成人机验证|^登录尚未完成|^另一设备刚|^云端|^本机|^本次|^附件|^当前网络|^无法确认|^修改密码需要|^验证码通道异常|^重置通道异常/.test(msg)) return msg;
  if (/already|exists|duplicate/i.test(msg)) return '该账号已被注册，请直接登录';
  if (/permission|access.denied|无权限|没有权限/i.test(msg)) return '云端权限未开放，请检查账号权限与服务配置';
  if (/quota|storage.*limit/i.test(msg)) return '云端存储额度不足，请释放空间后重试';
  if (/not found|not exist|没有.*用户/i.test(msg)) return '账号不存在，请先注册';
  if (/password|credential|凭证/i.test(msg)) return '账号或密码不正确';
  if (/code|otp|验证码|token/i.test(msg)) return '验证码错误或已过期';
  if (/frequent|limit|频繁/i.test(msg)) return '操作过于频繁，请稍后再试';
  return fallback;
}
