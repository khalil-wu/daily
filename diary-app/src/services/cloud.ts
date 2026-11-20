import AV from 'leancloud-storage/core';
import type { Account, Entry } from '../store/types';

/**
 * 云端服务（LeanCloud）。
 * 未在 app.json extra.leancloud 里配置 AppID 之前，cloudConfigured() 为 false，
 * 应用保持完全本地可用（账号/同步走本机模拟）。
 */

interface CloudConfig {
  appId: string;
  appKey: string;
  serverURL?: string;
}

function readConfig(): CloudConfig {
  try {
    // expo-constants 在 Node 测试环境下不可用，懒加载兜底为空配置
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const extra = (Constants?.expoConfig?.extra ?? {}) as { leancloud?: CloudConfig };
    return extra.leancloud ?? { appId: '', appKey: '' };
  } catch {
    return { appId: '', appKey: '' };
  }
}

export function cloudConfigured(): boolean {
  const c = readConfig();
  return !!c.appId && !!c.appKey;
}

let inited = false;

/** 初始化 SDK（幂等）；未配置时静默返回。 */
export function initCloud() {
  if (inited || !cloudConfigured()) return;
  // 各平台显式指定适配器（core 入口不自动选择）；不 import react-native 以便 Node 测试可跑
  const isWeb = typeof document !== 'undefined';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const adapters = isWeb
    ? require('@leancloud/platform-adapters-browser')
    : require('@leancloud/platform-adapters-react-native');
  AV.setAdapters(adapters);
  const c = readConfig();
  AV.init({ appId: c.appId, appKey: c.appKey, serverURL: c.serverURL || undefined });
  inited = true;
}

function ensureInit() {
  initCloud();
  if (!inited) throw new Error('云端尚未配置');
}

/* ---------------- 账号 ---------------- */

function toAccount(user: AV.User): Account {
  const nickname = (user.get('nickname') as string) || (user.get('email') as string) || (user.get('mobilePhoneNumber') as string) || '记得自己';
  return {
    id: user.id || user.get('username') || '',
    identifier: (user.get('mobilePhoneNumber') as string) || (user.get('email') as string) || user.get('username'),
    nickname,
    createdAt: user.createdAt ? user.createdAt.getTime() : Date.now(),
    remote: true,
  };
}

/** 恢复本地登录态；无会话返回 null。 */
export async function currentRemoteAccount(): Promise<Account | null> {
  if (!cloudConfigured()) return null;
  initCloud();
  if (!inited) return null;
  try {
    const user = await AV.User.currentAsync();
    return user ? toAccount(user) : null;
  } catch {
    return null;
  }
}

/** 手机号：发送登录/注册验证码。 */
export async function sendSmsCode(phone: string) {
  ensureInit();
  await AV.User.requestLoginSmsCode(phone);
}

/** 手机号 + 验证码：未注册自动注册并登录。 */
export async function loginByPhone(phone: string, code: string): Promise<Account> {
  ensureInit();
  const user = await AV.User.signUpOrlogInWithMobilePhone(phone, code);
  return toAccount(user);
}

/** 手机号：重置密码（先 requestPasswordResetBySmsCode）。 */
export async function sendResetSmsCode(phone: string) {
  ensureInit();
  await AV.User.requestPasswordResetBySmsCode(phone);
}

export async function resetPasswordBySms(code: string, newPassword: string) {
  ensureInit();
  await AV.User.resetPasswordBySmsCode(code, newPassword);
}

/** 邮箱：注册并发送验证邮件。 */
export async function registerByEmail(email: string, password: string): Promise<Account> {
  ensureInit();
  const user = new AV.User();
  user.setUsername(email);
  user.setPassword(password);
  user.setEmail(email);
  await user.signUp();
  void AV.User.requestEmailVerify(email).catch(() => {});
  return toAccount(user);
}

/** 手机号或邮箱 + 密码登录。 */
export async function loginByPassword(identifier: string, password: string): Promise<Account> {
  ensureInit();
  const id = identifier.trim();
  try {
    const user = await AV.User.logIn(id, password);
    return toAccount(user);
  } catch (e) {
    if (!/^1\d{10}$/.test(id)) throw e;
    const user = await AV.User.logInWithMobilePhone(id, password);
    return toAccount(user);
  }
}

/** 邮箱：发送重置密码邮件。 */
export async function requestPasswordResetEmail(email: string) {
  ensureInit();
  await AV.User.requestPasswordReset(email);
}

/** 给当前登录用户设置初始密码（手机号注册后可选），失败不影响登录。 */
export async function setPasswordForCurrent(password: string): Promise<boolean> {
  try {
    const user = AV.User.current();
    if (!user) return false;
    user.setPassword(password);
    await user.save();
    return true;
  } catch {
    return false;
  }
}

export async function logoutRemote() {
  if (!inited) return;
  try {
    await AV.User.logOut();
  } catch {
    /* 会话已失效也视为登出成功 */
  }
}

/* ---------------- 日记同步 ---------------- */

const CLASS = 'DiaryEntry';

/** 拉取当前用户云端的全部日记。 */
export async function pullRemoteEntries(): Promise<Entry[]> {
  ensureInit();
  const user = AV.User.current();
  if (!user) throw new Error('云端会话已失效，请重新登录');
  const q = new AV.Query(CLASS);
  q.equalTo('owner', user);
  q.limit(1000);
  q.select(['entryId', 'data']);
  const rows = (await q.find()) as AV.Object[];
  return rows.map(r => r.get('data') as Entry);
}

/** 把合并后的日记集写回云端：按 entryId 覆盖，云端多出的删掉。 */
export async function pushRemoteEntries(entries: Entry[]): Promise<void> {
  ensureInit();
  const user = AV.User.current();
  if (!user) throw new Error('云端会话已失效，请重新登录');

  const q = new AV.Query(CLASS);
  q.equalTo('owner', user);
  q.limit(1000);
  const remote = (await q.find()) as AV.Object[];
  const remoteById = new Map(remote.map(r => [r.get('entryId') as string, r]));

  const acl = new AV.ACL(user); // 仅本人可读可写
  const saves: AV.Object[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    seen.add(e.id);
    const obj = remoteById.get(e.id) ?? new AV.Object(CLASS);
    if (!remoteById.has(e.id)) {
      obj.set('entryId', e.id);
      obj.set('owner', user);
      obj.setACL(acl);
    }
    if (obj.get('updatedAt') === e.updatedAt) continue; // 没变就跳过
    obj.set('updatedAt', e.updatedAt);
    obj.set('data', e);
    saves.push(obj);
  }
  const deletes = remote.filter(r => !seen.has(r.get('entryId') as string));
  if (saves.length) await AV.Object.saveAll(saves);
  if (deletes.length) await AV.Object.destroyAll(deletes);
}

/** 注销云端账号（删除用户与名下日记）。 */
export async function destroyRemoteAccount(): Promise<void> {
  ensureInit();
  const user = AV.User.current();
  if (!user) return;
  const q = new AV.Query(CLASS);
  q.equalTo('owner', user);
  q.limit(1000);
  const rows = (await q.find()) as AV.Object[];
  if (rows.length) await AV.Object.destroyAll(rows);
  await user.destroy();
}

/** 把 LeanCloud 错误码翻成人话。 */
export function cloudError(e: unknown, fallback: string): string {
  const code = (e as { code?: number })?.code;
  const table: Record<number, string> = {
    202: '该账号已被注册，请直接登录',
    210: '账号或密码不正确',
    211: '账号不存在，请先注册',
    213: '该手机号尚未注册',
    214: '该手机号已被注册',
    216: '请先验证邮箱后再登录',
    219: '登录过于频繁，请稍后再试',
    601: '验证码发送过于频繁，请稍后再试',
    603: '验证码错误或已过期',
    605: '验证服务暂不可用，请稍后再试',
  };
  return (code && table[code]) || fallback;
}
