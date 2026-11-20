/**
 * 「记得」（AI）密钥的存放处。
 * 密钥不放进应用状态，因此不会出现在备份、导出文件或同步数据里：
 * - iOS / Android：系统钥匙串 / Keystore（expo-secure-store）
 * - 网页：浏览器本地存储（只在这台设备的这个浏览器里）
 * - 测试环境：内存
 */

const KEY = 'jide-diary.ai-key.v1';
let memory: string | null = null;

const isNode = () => typeof process !== 'undefined' && !!process.versions?.node && typeof window === 'undefined';
const isWeb = () => typeof document !== 'undefined' && typeof localStorage !== 'undefined';

function secureStore(): { getItemAsync(k: string): Promise<string | null>; setItemAsync(k: string, v: string): Promise<void>; deleteItemAsync(k: string): Promise<void> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store');
    return mod?.getItemAsync ? mod : null;
  } catch {
    return null;
  }
}

export async function getAIKey(): Promise<string> {
  if (isNode()) return memory ?? '';
  try {
    if (isWeb()) return localStorage.getItem(KEY) ?? '';
    return (await secureStore()?.getItemAsync(KEY)) ?? memory ?? '';
  } catch {
    return memory ?? '';
  }
}

export async function setAIKey(value: string): Promise<void> {
  const v = value.trim();
  memory = v || null;
  if (isNode()) return;
  try {
    if (isWeb()) {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
      return;
    }
    const store = secureStore();
    if (!store) return;
    if (v) await store.setItemAsync(KEY, v);
    else await store.deleteItemAsync(KEY);
  } catch {
    /* 存不进安全存储时，密钥只在本次运行期间有效 */
  }
}

export async function clearAIKey(): Promise<void> {
  await setAIKey('');
}

/** 展示用：只露出末 4 位 */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return '';
  return k.length <= 8 ? '••••' : `${k.slice(0, 3)}••••${k.slice(-4)}`;
}
