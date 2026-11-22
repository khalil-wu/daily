import { sha256 } from '@noble/hashes/sha2.js';
import type { AppState } from '../store/types';
import { isEntryRecord, normalizeState } from '../store/storage';
import { fromB64, toB64 } from '../utils/backupCrypto';
import { uid } from '../utils/text';
import { buildSnapshotPayload } from './autoBackup';
import { discardPhotoFiles, resolvePhotoUri, storePhoto } from './photoStore';
import { discardVideoFiles, resolveVideoUri, storeVideo } from './videoStore';

/** Base64 + encryption need extra memory; cap binary content before encoding it. */
export const MAX_BACKUP_MEDIA_BYTES = 25 * 1024 * 1024;
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;
const PREFIX = 'backup-media:';
export type MediaKind = 'image' | 'audio' | 'video';
export interface BackupMediaItem { id: string; kind: MediaKind; mime: string; size: number; sha256: string; data: string }
export interface BackupMediaIO {
  read(uri: string, kind: MediaKind, maxBytes: number): Promise<{ bytes: Uint8Array; mime: string }>;
  write(kind: MediaKind, mime: string, bytes: Uint8Array): Promise<string>;
  remove(uri: string, kind: MediaKind): Promise<void>;
}
export type PortableBackup = ReturnType<typeof buildSnapshotPayload> & { mediaVersion: 1; media: BackupMediaItem[] };

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v',
  'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac', 'audio/3gpp': '3gp', 'audio/amr': 'amr',
};
const hash = (bytes: Uint8Array) => Array.from(sha256(bytes), n => n.toString(16).padStart(2, '0')).join('');
const sizeError = () => new Error('附件总大小超过 25 MiB，请先减少附件后再备份');
const assetUri = (uri: string) => /^asset:[A-Za-z0-9_-]+$/.test(uri);

/** Never interpret a backup reference as a filesystem path. */
export function isSafeStoredMediaUri(uri: string): boolean {
  return assetUri(uri) || /^idb:(photo|video)\/[A-Za-z0-9_-]+$/.test(uri)
    || /^appdoc:(photos|videos)\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(uri);
}

function mediaRefs(s: Pick<AppState, 'entries' | 'profile'>): { uri: string; kind: MediaKind }[] {
  const refs: { uri: string; kind: MediaKind }[] = [];
  const add = (uri: unknown, kind: MediaKind) => { if (typeof uri === 'string' && uri) refs.push({ uri, kind }); };
  for (const e of s.entries) {
    e.photos.forEach(uri => add(uri, 'image'));
    e.audios.forEach(a => add(a.uri, 'audio'));
    e.videos.forEach(v => { add(v.uri, 'video'); add(v.poster, 'image'); });
  }
  add(s.profile.avatar, 'image');
  add(s.profile.cover, 'image');
  return refs;
}

function remap(s: ReturnType<typeof buildSnapshotPayload>, lookup: (uri: string, kind: MediaKind) => string) {
  return {
    ...s,
    profile: { ...s.profile, avatar: s.profile.avatar ? lookup(s.profile.avatar, 'image') : undefined, cover: s.profile.cover ? lookup(s.profile.cover, 'image') : undefined },
    entries: s.entries.map(e => ({
      ...e,
      photos: e.photos.map(uri => lookup(uri, 'image')),
      audios: e.audios.map(a => ({ ...a, uri: lookup(a.uri, 'audio') })),
      videos: e.videos.map(v => ({ ...v, uri: lookup(v.uri, 'video'), poster: v.poster ? lookup(v.poster, 'image') : undefined })),
    })),
  };
}

function normalizeMime(mime: string, kind: MediaKind, uri = '') {
  const given = mime.split(';')[0].trim().toLowerCase();
  const clean = given === 'image/jpg' ? 'image/jpeg' : given === 'audio/x-m4a' ? 'audio/mp4' : given;
  if (MIME_EXT[clean] && clean.startsWith(`${kind}/`)) return clean;
  if (clean && clean !== 'application/octet-stream') throw new Error(`暂不支持备份 ${clean} 格式的附件`);
  const ext = uri.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1].toLowerCase();
  const known = Object.keys(MIME_EXT).find(key => key.startsWith(`${kind}/`) && MIME_EXT[key] === ext);
  return known ?? (kind === 'image' ? 'image/jpeg' : `${kind}/mp4`);
}

export async function createPortableBackup(snapshot: AppState, io: BackupMediaIO = deviceMediaIO): Promise<PortableBackup> {
  const data = buildSnapshotPayload(snapshot);
  const replacements = new Map<string, string>();
  const media: BackupMediaItem[] = [];
  let total = 0;
  for (const { uri, kind } of mediaRefs(data)) {
    if (assetUri(uri)) continue;
    const key = `${kind}:${uri}`;
    if (replacements.has(key)) continue;
    const { bytes, mime } = await io.read(uri, kind, MAX_BACKUP_MEDIA_BYTES - total);
    if (!bytes.length) throw new Error('有附件为空或已丢失，备份未生成');
    total += bytes.length;
    if (total > MAX_BACKUP_MEDIA_BYTES) throw sizeError();
    const id = `m${media.length}`;
    media.push({ id, kind, mime: normalizeMime(mime, kind, uri), size: bytes.length, sha256: hash(bytes), data: toB64(bytes) });
    replacements.set(key, `${PREFIX}${id}`);
  }
  return { ...remap(data, (uri, kind) => replacements.get(`${kind}:${uri}`) ?? uri), mediaVersion: 1, media };
}

function encodedSize(data: string) {
  return data.length / 4 * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
}

function validateManifest(raw: unknown): BackupMediaItem[] {
  if (!Array.isArray(raw) || raw.length > 10000) throw new Error('备份附件目录无效');
  const ids = new Set<string>();
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^m\d+$/.test(item.id) || ids.has(item.id)
      || !['image', 'audio', 'video'].includes(item.kind) || typeof item.mime !== 'string' || !MIME_EXT[item.mime] || !item.mime.startsWith(`${item.kind}/`)
      || !Number.isSafeInteger(item.size) || item.size <= 0 || typeof item.data !== 'string' || item.data.length % 4 !== 0
      || item.data.length > Math.ceil(MAX_BACKUP_MEDIA_BYTES / 3) * 4 || encodedSize(item.data) !== item.size
      || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error('备份附件信息无效');
    total += item.size;
    if (total > MAX_BACKUP_MEDIA_BYTES) throw sizeError();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(item.data)) throw new Error('备份附件编码已损坏');
    ids.add(item.id);
  }
  return raw;
}

export async function restorePortableBackup(raw: unknown, io: BackupMediaIO = deviceMediaIO): Promise<{ snapshot: ReturnType<typeof buildSnapshotPayload>; mediaCount: number; legacy: boolean }> {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as AppState).entries) || !(raw as AppState).entries.every(isEntryRecord)) throw new Error('文件不是有效的记得日记备份');
  const source = raw as Record<string, unknown>;
  const { media: _media, mediaVersion: _mediaVersion, ...withoutMedia } = source;
  const snapshot = buildSnapshotPayload(normalizeState(withoutMedia));
  if (source.mediaVersion === undefined) {
    // Legacy snapshots contain local references only; never read those paths during restore.
    for (const { uri } of mediaRefs(snapshot)) {
      if (uri.startsWith('appdoc:') && !isSafeStoredMediaUri(uri)) throw new Error('旧备份含有不安全的附件路径');
      if (uri.startsWith(PREFIX)) throw new Error('备份缺少附件目录');
      if (!isSafeStoredMediaUri(uri) && !/^(https?:|blob:|data:(image|audio|video)\/|mock:)/.test(uri) && !safeNativeFile(uri)) throw new Error('旧备份附件属于其他设备，无法安全恢复；请在原设备重新生成完整备份');
    }
    return { snapshot, mediaCount: 0, legacy: true };
  }
  if (source.mediaVersion !== 1) throw new Error('暂不支持这个版本的媒体备份');
  const media = validateManifest(source.media);
  const byId = new Map(media.map(item => [item.id, item]));
  const used = new Set<string>();
  for (const { uri, kind } of mediaRefs(snapshot)) {
    if (assetUri(uri)) continue;
    if (!uri.startsWith(PREFIX)) throw new Error('完整备份包含未打包的附件');
    const item = byId.get(uri.slice(PREFIX.length));
    if (!item || item.kind !== kind) throw new Error('备份缺少所引用的附件');
    used.add(item.id);
  }
  const written: { uri: string; kind: MediaKind }[] = [];
  const replacements = new Map<string, string>();
  try {
    for (const item of media) {
      if (!used.has(item.id)) continue;
      const bytes = fromB64(item.data);
      if (hash(bytes) !== item.sha256) throw new Error('备份中的附件已损坏，原有日记未被修改');
      const uri = await io.write(item.kind, item.mime, bytes);
      written.push({ uri, kind: item.kind });
      replacements.set(`${PREFIX}${item.id}`, uri);
    }
    return { snapshot: remap(snapshot, uri => replacements.get(uri) ?? uri), mediaCount: written.length, legacy: false };
  } catch (error) {
    await Promise.allSettled(written.map(item => io.remove(item.uri, item.kind)));
    throw error;
  }
}

function nativeFs(): typeof import('expo-file-system') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system');
}
const isWeb = () => typeof document !== 'undefined';

function safeNativeFile(uri: string) {
  if (!uri.startsWith('file:') || isWeb()) return false;
  try {
    if (decodeURIComponent(uri).split('/').includes('..')) return false;
    const { Paths } = nativeFs();
    return [Paths.document.uri, Paths.cache.uri].some(base => uri.startsWith(`${base.replace(/\/+$/, '')}/`));
  } catch { return false; }
}

export const deviceMediaIO: BackupMediaIO = {
  async read(uri, kind, maxBytes) {
    if (maxBytes <= 0) throw sizeError();
    if (uri.startsWith('mock:')) throw new Error('存在旧版模拟录音，它没有音频文件；请移除这段录音后再备份');
    if (uri.startsWith('data:')) {
      const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(uri);
      if (!match || !MIME_EXT[match[1]] || !match[1].startsWith(`${kind}/`) || match[2].length % 4) throw new Error('附件数据格式不支持');
      if (encodedSize(match[2]) > maxBytes) throw sizeError();
      return { bytes: fromB64(match[2]), mime: match[1] };
    }
    if (!isSafeStoredMediaUri(uri) && !safeNativeFile(uri) && !(isWeb() && uri.startsWith(`blob:${window.location.origin}/`))) {
      throw new Error('附件不是设备内的文件，请先将附件保存到设备后再备份');
    }
    const resolved = kind === 'image' ? await resolvePhotoUri(uri) : await resolveVideoUri(uri);
    if (!resolved) throw new Error('有附件已不在这台设备上，无法生成完整备份');
    if (isWeb()) {
      const response = await fetch(resolved);
      if (!response.ok) throw new Error('附件读取失败，备份未生成');
      if (Number(response.headers.get('content-length')) > maxBytes) throw sizeError();
      const blob = await response.blob();
      if (blob.size > maxBytes) throw sizeError();
      return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type };
    }
    if (!safeNativeFile(resolved)) throw new Error('附件路径不在应用存储空间内');
    const file = new (nativeFs().File)(resolved);
    if (!file.exists) throw new Error('有附件已丢失，无法生成完整备份');
    if (file.size > maxBytes) throw sizeError();
    return { bytes: await file.bytes(), mime: normalizeMime(file.type, kind, resolved) };
  },
  async write(kind, mime, bytes) {
    const id = uid('restore');
    if (isWeb()) {
      const blob = new Blob([new Uint8Array(bytes)], { type: mime });
      const source = URL.createObjectURL(blob);
      try {
        const result = kind === 'image' ? await storePhoto(id, source, { blob }) : await storeVideo(id, source, { blob });
        if (!result.durable) throw new Error('附件保存失败，请检查设备存储空间');
        return result.uri;
      } finally { URL.revokeObjectURL(source); }
    }
    const { File, Directory, Paths } = nativeFs();
    const dir = new Directory(Paths.document, kind === 'image' ? 'photos' : 'videos');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const name = `${id}.${MIME_EXT[mime]}`;
    const file = new File(dir, name);
    file.create();
    try { file.write(bytes); } catch (error) { if (file.exists) file.delete(); throw error; }
    return `appdoc:${kind === 'image' ? 'photos' : 'videos'}/${name}`;
  },
  async remove(uri, kind) {
    if (kind === 'image') await discardPhotoFiles([uri]);
    else await discardVideoFiles([{ uri }]);
  },
};
