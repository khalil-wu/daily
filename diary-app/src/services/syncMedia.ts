import { sha256 } from '@noble/hashes/sha2.js';
import type { Entry } from '../store/types';
import { deviceMediaIO, MAX_BACKUP_MEDIA_BYTES, type BackupMediaIO, type MediaKind } from './backupMedia';

const PREFIX = 'cloud-media:';
export interface CloudMedia { fileID: string; hash: string; size: number; mime: string; kind: MediaKind; key?: string }
export interface CloudMediaTransport {
  upload(path: string, bytes: Uint8Array, mime: string): Promise<string>;
  download(fileID: string, maxBytes: number): Promise<Uint8Array>;
}
const checksum = (bytes: Uint8Array) => Array.from(sha256(bytes), n => n.toString(16).padStart(2, '0')).join('');
export const cloudMediaReference = (media: CloudMedia) => PREFIX + encodeURIComponent(JSON.stringify(media));
export function parseCloudMedia(uri: string): CloudMedia | null {
  if (!uri.startsWith(PREFIX)) return null;
  let m: CloudMedia;
  try { m = JSON.parse(decodeURIComponent(uri.slice(PREFIX.length))); } catch { throw new Error('云端附件信息已损坏'); }
  if (!m || typeof m.fileID !== 'string' || !m.fileID.startsWith('cloud://') || !/^[a-f0-9]{64}$/.test(m.hash)
    || !Number.isSafeInteger(m.size) || m.size <= 0 || m.size > MAX_BACKUP_MEDIA_BYTES
    || !['image', 'audio', 'video'].includes(m.kind) || typeof m.mime !== 'string' || !m.mime.startsWith(`${m.kind}/`)) throw new Error('云端附件信息无效');
  return m;
}

export function mapEntryMedia(e: Entry, map: (uri: string, kind: MediaKind) => string): Entry {
  return { ...e, photos: e.photos.map(p => map(p, 'image')),
    audios: e.audios.map(a => ({ ...a, uri: map(a.uri, 'audio') })),
    videos: e.videos.map(v => ({ ...v, uri: map(v.uri, 'video'), poster: v.poster ? map(v.poster, 'image') : undefined })),
  };
}

/** Cache maps cloud references to durable local files, and is scoped to one account. */
export function createMediaSync(accountId: string, initialCache: Record<string, string>, transport: CloudMediaTransport, io: BackupMediaIO = deviceMediaIO) {
  const cache = { ...initialCache };
  const created: { uri: string; kind: MediaKind }[] = [];
  let total = 0;
  const counted = new Set<string>();
  const charge = (key: string, size: number) => {
    if (counted.has(key)) return;
    counted.add(key);
    total += size;
    if (total > MAX_BACKUP_MEDIA_BYTES) throw new Error('本次同步附件合计超过 25 MiB，请分批同步或使用备份迁移');
  };
  const refs = (entries: Entry[]) => {
    const unique = new Map<string, MediaKind>();
    entries.forEach(e => mapEntryMedia(e, (uri, kind) => { if (!uri.startsWith('asset:')) unique.set(uri, kind); return uri; }));
    return unique;
  };
  return {
    cache,
    async download(entries: Entry[]): Promise<Entry[]> {
      const replacement = new Map<string, string>();
      for (const [uri, kind] of refs(entries)) {
        const media = parseCloudMedia(uri);
        if (!media) {
          try { await io.read(uri, kind, MAX_BACKUP_MEDIA_BYTES); } catch { throw new Error('云端有旧版附件位置，原设备需重新同步完整附件'); }
          replacement.set(uri, uri);
          continue;
        }
        if (media.kind !== kind) throw new Error('云端附件类型不匹配');
        let local = cache[uri];
        if (local) {
          try { const existing = await io.read(local, kind, media.size); if (checksum(existing.bytes) !== media.hash) local = ''; } catch { local = ''; }
        }
        if (!local) {
          charge(uri, media.size);
          const bytes = await transport.download(media.fileID, media.size);
          if (bytes.length !== media.size || checksum(bytes) !== media.hash) throw new Error('云端附件校验失败，未覆盖本机日记');
          local = await io.write(kind, media.mime, bytes);
          created.push({ uri: local, kind });
          cache[uri] = local;
        }
        replacement.set(uri, local);
      }
      return entries.map(e => mapEntryMedia(e, uri => replacement.get(uri) ?? uri));
    },
    async upload(entries: Entry[]): Promise<Entry[]> {
      const reverse = new Map(Object.entries(cache).map(([remote, local]) => [local, remote]));
      const replacement = new Map<string, string>();
      for (const [uri, kind] of refs(entries)) {
        if (parseCloudMedia(uri)) { replacement.set(uri, uri); continue; }
        const known = reverse.get(uri);
        if (known) { replacement.set(uri, known); continue; }
        const { bytes, mime } = await io.read(uri, kind, MAX_BACKUP_MEDIA_BYTES - total);
        if (!bytes.length) throw new Error('本机附件已丢失，日记尚未完整同步');
        const hash = checksum(bytes);
        charge(`${kind}:${hash}`, bytes.length);
        const duplicate = Object.keys(cache).find(ref => { const item = parseCloudMedia(ref); return item?.hash === hash && item.kind === kind; });
        const remote = cloudMediaReference({
          fileID: duplicate ? parseCloudMedia(duplicate)!.fileID : await transport.upload(`diary-media/${accountId}/${kind}-${hash}`, bytes, mime),
          hash, size: bytes.length, mime, kind, key: checksum(new TextEncoder().encode(uri)),
        });
        cache[remote] = uri;
        replacement.set(uri, remote);
      }
      return entries.map(e => mapEntryMedia(e, uri => replacement.get(uri) ?? uri));
    },
    async rollback() { await Promise.allSettled(created.map(item => io.remove(item.uri, item.kind))); },
  };
}
