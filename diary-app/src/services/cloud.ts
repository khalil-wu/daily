import type { Account, Entry } from '../store/types';

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

export function initCloud() {
  if (inited || !cloudConfigured()) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cloudbase = require('@cloudbase/js-sdk').default ?? require('@cloudbase/js-sdk');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isRN = typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';
  if (isRN) {
    // RN 端需要官方适配器（mmkv 持久化登录态）；Web 端 SDK 自带浏览器适配
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('@cloudbase/adapter-rn');
  }
  const c = readConfig();
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
  try {
    const state = await auth.getLoginState();
    const user = state?.user ?? state;
    return user ? toAccount(user) : null;
  } catch {
    return null;
  }
}

/** 手机号：发送登录/注册验证码（未注册自动注册）。 */
export async function sendSmsCode(phone: string) {
  ensureInit();
  const res = await auth.signInWithOtp({ phone: `+86 ${phone}`, options: { shouldCreateUser: true } });
  pendingOtp = unwrap(res) ?? res;
}

/** 手机号 + 验证码：登录。 */
export async function loginByPhone(phone: string, code: string): Promise<Account> {
  ensureInit();
  if (!pendingOtp?.verifyOtp) {
    const res = await auth.signInWithOtp({ phone: `+86 ${phone}`, options: { shouldCreateUser: true } });
    pendingOtp = unwrap(res) ?? res;
  }
  const res = await pendingOtp!.verifyOtp!({ token: code });
  pendingOtp = null;
  const data = unwrap(res);
  return toAccount(data?.user ?? data);
}

/** 手机号：重置密码验证码（复用 OTP 通道）。 */
export async function sendResetSmsCode(phone: string) {
  await sendSmsCode(phone);
}

/** 验证码验证后设置新密码。 */
export async function resetPasswordBySms(code: string, newPassword: string) {
  ensureInit();
  if (!pendingOtp?.verifyOtp) throw new Error('请先获取验证码');
  await pendingOtp.verifyOtp({ token: code });
  pendingOtp = null;
  try {
    const user = auth.currentUser ?? (await auth.getUser?.());
    if (user?.updatePassword) await user.updatePassword(newPassword);
    else await auth.updatePassword?.(newPassword, '');
  } catch {
    /* 密码设置失败不影响重置后的登录态 */
  }
}

/** 邮箱：注册（CloudBase signUp；验证邮件由平台模板发送）。 */
export async function registerByEmail(email: string, password: string): Promise<Account> {
  ensureInit();
  const res = await auth.signUp({ email, password });
  const data = unwrap(res);
  return toAccount(data?.user ?? data);
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

/** 邮箱：发送重置密码邮件（平台内置代发）。 */
export async function requestPasswordResetEmail(email: string) {
  ensureInit();
  try {
    const res = await auth.resetPasswordForEmail({ email });
    unwrap(res);
  } catch {
    // 部分环境未开通重置邮件模板时，退化为 OTP 验证码登录后再改密码
    const res = await auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    pendingOtp = unwrap(res) ?? res;
  }
}

export async function logoutRemote() {
  if (!inited) return;
  try {
    await auth.signOut();
  } catch {
    /* 会话已失效也视为登出成功 */
  }
}

/** 给当前登录用户设置初始密码（手机号注册后可选），失败不影响登录。 */
export async function setPasswordForCurrent(password: string): Promise<boolean> {
  try {
    const user = auth.currentUser ?? (await auth.getUser?.());
    if (user?.updatePassword) await user.updatePassword(password);
    else await auth.updatePassword?.(password, '');
    return true;
  } catch {
    return false;
  }
}

/* ---------------- 日记同步 ---------------- */

const COLLECTION = 'diary_entries';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return app.database();
}

async function uid(): Promise<string> {
  const state = await auth.getLoginState();
  const user = state?.user ?? state;
  const id = user?.uid ?? user?.id;
  if (!id) throw new Error('云端会话已失效，请重新登录');
  return id;
}

interface Row { _id: string; entryId: string; updatedAt: number; data: Entry }

/** 拉取当前用户云端的全部日记。 */
export async function pullRemoteEntries(): Promise<Entry[]> {
  ensureInit();
  const id = await uid();
  const res = await db().collection(COLLECTION).where({ uid: id }).limit(1000).get();
  const rows = (res?.data ?? []) as Row[];
  return rows.map(r => r.data);
}

/** 把合并后的日记集写回云端：按 entryId 覆盖，云端多出的删掉。 */
export async function pushRemoteEntries(entries: Entry[]): Promise<void> {
  ensureInit();
  const id = await uid();
  const res = await db().collection(COLLECTION).where({ uid: id }).limit(1000).get();
  const rows = (res?.data ?? []) as Row[];
  const remoteById = new Map(rows.map(r => [r.entryId, r]));
  const seen = new Set<string>();

  for (const e of entries) {
    seen.add(e.id);
    const row = remoteById.get(e.id);
    if (row && row.updatedAt === e.updatedAt) continue;
    if (row) {
      await db().collection(COLLECTION).doc(row._id).update({ updatedAt: e.updatedAt, data: e });
    } else {
      await db().collection(COLLECTION).add({ uid: id, entryId: e.id, updatedAt: e.updatedAt, data: e });
    }
  }
  for (const row of rows) {
    if (!seen.has(row.entryId)) await db().collection(COLLECTION).doc(row._id).remove();
  }
}

/** 注销云端账号（删除用户名下日记并注销账号）。 */
export async function destroyRemoteAccount(): Promise<void> {
  ensureInit();
  const id = await uid();
  const res = await db().collection(COLLECTION).where({ uid: id }).limit(1000).get();
  const rows = (res?.data ?? []) as Row[];
  for (const row of rows) {
    await db().collection(COLLECTION).doc(row._id).remove();
  }
  await auth.deleteUser?.({});
}

/** 把云端错误翻成人话。 */
export function cloudError(e: unknown, fallback: string): string {
  const err = e as { code?: string | number; message?: string };
  const msg = err?.message ?? '';
  if (/already|exists|duplicate/i.test(msg)) return '该账号已被注册，请直接登录';
  if (/not found|not exist|没有.*用户/i.test(msg)) return '账号不存在，请先注册';
  if (/password|credential|凭证/i.test(msg)) return '账号或密码不正确';
  if (/code|otp|验证码|token/i.test(msg)) return '验证码错误或已过期';
  if (/frequent|limit|频繁/i.test(msg)) return '操作过于频繁，请稍后再试';
  return fallback;
}
