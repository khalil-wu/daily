import { gcm } from '@noble/ciphers/aes.js';
import { scryptAsync } from '@noble/hashes/scrypt.js';

/**
 * 备份文件加密：scrypt 派生密钥 + AES-256-GCM。
 * 纯 JS 实现，iOS / Android / Web / Node 测试行为一致；密码不落盘，忘记就无法解密。
 */

export const BACKUP_FORMAT = 'jide-diary-encrypted-backup';

export interface EncryptedBackup {
  format: typeof BACKUP_FORMAT;
  v: 1;
  app: '记得日记';
  exportedAt: number;
  count: number;
  kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
  cipher: { name: 'aes-256-gcm'; iv: string };
  data: string;
}

const KDF = { N: 1 << 14, r: 8, p: 1 };

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const g = (globalThis as any).crypto;
  if (g?.getRandomValues) {
    g.getRandomValues(out);
    return out;
  }
  // React Native（Hermes）没有 WebCrypto，用 expo-crypto 的系统级随机源
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ExpoCrypto = require('expo-crypto');
  return ExpoCrypto.getRandomBytes(n);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toB64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
    return btoa(chunks.join(''));
  }
  const chunks: string[] = [];
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63]);
    if (s.length >= 16384) { chunks.push(s); s = ''; }
  }
  chunks.push(s);
  return chunks.join('');
}

export function fromB64(str: string): Uint8Array {
  const clean = str.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor(clean.length * 6 / 8));
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2] ?? 'A') & 63) << 6) | (B64.indexOf(clean[i + 3] ?? 'A') & 63);
    out[offset++] = (n >> 16) & 255;
    if (clean[i + 2] !== undefined) out[offset++] = (n >> 8) & 255;
    if (clean[i + 3] !== undefined) out[offset++] = n & 255;
  }
  return out;
}

// Hermes 旧版本没有 TextDecoder：两个方向都留纯 JS 兜底
const enc = { encode: (str: string) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str) : utf8Encode(str)) };
const dec = { decode: (b: Uint8Array) => (typeof TextDecoder !== 'undefined' ? new TextDecoder().decode(b) : utf8Decode(b)) };

function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }
  return new Uint8Array(out);
}

export function utf8Decode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i];
    let cp: number;
    if (x < 0x80) { cp = x; i += 1; }
    else if (x < 0xe0) { cp = ((x & 31) << 6) | (b[i + 1] & 63); i += 2; }
    else if (x < 0xf0) { cp = ((x & 15) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63); i += 3; }
    else { cp = ((x & 7) << 18) | ((b[i + 1] & 63) << 12) | ((b[i + 2] & 63) << 6) | (b[i + 3] & 63); i += 4; }
    s += String.fromCodePoint(cp);
  }
  return s;
}
export const _utf8Encode = utf8Encode;

async function deriveKey(password: string, salt: Uint8Array, p = KDF) {
  return scryptAsync(enc.encode(password.normalize('NFKC')), salt, { N: p.N, r: p.r, p: p.p, dkLen: 32 });
}

export function isEncryptedBackup(x: unknown): x is EncryptedBackup {
  return !!x && typeof x === 'object' && (x as any).format === BACKUP_FORMAT;
}

/** 把任意 JSON 可序列化对象加密成备份文件内容 */
export async function encryptBackup(payload: unknown, password: string, count = 0): Promise<string> {
  if (!password) throw new Error('缺少备份密码');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const data = gcm(key, iv).encrypt(enc.encode(JSON.stringify(payload)));
  const file: EncryptedBackup = {
    format: BACKUP_FORMAT,
    v: 1,
    app: '记得日记',
    exportedAt: Date.now(),
    count,
    kdf: { name: 'scrypt', ...KDF, salt: toB64(salt) },
    cipher: { name: 'aes-256-gcm', iv: toB64(iv) },
    data: toB64(data),
  };
  return JSON.stringify(file, null, 2);
}

export class WrongPasswordError extends Error {
  constructor() {
    super('密码不正确，或备份文件已损坏');
  }
}

/** 解密备份；密码错误或文件被改动时抛出 WrongPasswordError（GCM 自带完整性校验） */
export async function decryptBackup<T = unknown>(file: EncryptedBackup, password: string): Promise<T> {
  if (file?.v !== 1 || file?.kdf?.name !== 'scrypt' || file?.cipher?.name !== 'aes-256-gcm') throw new Error('不支持的备份格式');
  const { N, r, p } = file.kdf;
  // Imported parameters are untrusted: bound both memory and CPU before scrypt.
  if (![N, r, p].every(n => Number.isSafeInteger(n) && n > 0) || N < 2 || (N & (N - 1)) !== 0
    || N > 1 << 18 || r > 32 || p > 8 || 128 * N * r > 64 * 1024 * 1024 || N * r * p > 1 << 22) throw new Error('备份文件参数异常');
  const decode = (value: unknown) => {
    if (typeof value !== 'string' || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('备份文件数据已损坏');
    return fromB64(value);
  };
  const salt = decode(file.kdf.salt);
  const iv = decode(file.cipher.iv);
  const encrypted = decode(file.data);
  if (salt.length !== 16 || iv.length !== 12 || encrypted.length < 16) throw new Error('备份文件数据已损坏');
  const key = await deriveKey(password, salt, { N, r, p });
  let plain: Uint8Array;
  try {
    plain = gcm(key, iv).decrypt(encrypted);
  } catch {
    throw new WrongPasswordError();
  }
  return JSON.parse(dec.decode(plain)) as T;
}
