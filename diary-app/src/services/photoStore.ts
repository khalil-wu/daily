import type { Entry } from '../store/types';

/**
 * 照片文件的存放与读取。做法与 videoStore 一致：
 *  - 原生：复制到文档目录 photos/，日记里记 appdoc:photos/<文件名>
 *  - 网页：文件存进 IndexedDB，日记里记 idb:photo/<id>，显示时再换成 blob 地址
 *
 * 相册给出的地址在原生端位于缓存目录（系统可能清掉），在网页端是 blob: 地址
 * （刷新即失效），所以导入后必须先把文件收进应用自己的空间。
 *
 * 原生端图片组件本身就能直接读 file:// 绝对地址，但 iOS 每次升级应用文档目录的
 * 绝对路径都会变；所以应用自己的文件一律记相对写法，只在显示时换算成当前绝对路径。
 */

export const DOC_PREFIX = 'appdoc:';
export const IDB_PREFIX = 'idb:photo/';
const PHOTO_DIR = 'photos';

type Runtime = 'node' | 'web' | 'native';
let runtimeCache: Runtime | null = null;

function runtime(): Runtime {
  if (runtimeCache) return runtimeCache;
  if (typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined') {
    runtimeCache = 'node';
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native') as typeof import('react-native');
    runtimeCache = Platform.OS === 'web' ? 'web' : 'native';
  }
  return runtimeCache;
}

function fs() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system') as typeof import('expo-file-system');
}

/* ---------------- 原生：文档目录 ---------------- */

let docBase: string | null = null;

function docUri(stored: string): string {
  if (docBase == null) docBase = fs().Paths.document.uri.replace(/\/+$/, '');
  return `${docBase}/${stored.slice(DOC_PREFIX.length)}`;
}

function photoDir() {
  const { Directory, Paths } = fs();
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function extOf(uri: string, fallback: string) {
  const m = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri);
  return (m?.[1] ?? fallback).toLowerCase();
}

/* ---------------- 网页：IndexedDB ---------------- */

const DB_NAME = 'jide-diary-media';
const DB_VERSION = 2;
const DB_STORE = 'photos';
/** IndexedDB 要拿到更高版本号才会执行 onupgradeneeded 建新表 */
const VIDEOS_STORE = 'videos';
const objectUrls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持本地文件存储'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of [VIDEOS_STORE, DB_STORE]) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRun<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, mode);
    const req = run(tx.objectStore(DB_STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    const fail = () => {
      db.close();
      reject(tx.error ?? req.error ?? new Error('本地文件存储失败'));
    };
    tx.onerror = fail;
    tx.onabort = fail;
  });
}

/* ---------------- 对外接口 ---------------- */

/**
 * 把刚选好 / 拍好的照片收进应用自己的空间，返回写进日记的 uri。
 * durable = false 表示没能收进来，只能先用临时地址（之后可能失效）。
 */
export async function storePhoto(id: string, sourceUri: string, opts?: { blob?: Blob }): Promise<{ uri: string; durable: boolean }> {
  const rt = runtime();
  if (rt === 'web') {
    try {
      const blob = opts?.blob ?? (await (await fetch(sourceUri)).blob());
      await idbRun('readwrite', s => s.put(blob, id));
      objectUrls.set(id, sourceUri);
      return { uri: `${IDB_PREFIX}${id}`, durable: true };
    } catch {
      return { uri: sourceUri, durable: false };
    }
  }
  if (rt === 'native') {
    try {
      const { File } = fs();
      const name = `${id}.${extOf(sourceUri, 'jpg')}`;
      const dest = new File(photoDir(), name);
      if (dest.exists) dest.delete();
      await new File(sourceUri).copy(dest);
      return { uri: `${DOC_PREFIX}${PHOTO_DIR}/${name}`, durable: true };
    } catch {
      return { uri: sourceUri, durable: false };
    }
  }
  return { uri: sourceUri, durable: false };
}

/** 同步换算：编辑页里刚存好的照片立刻就能显示，不经过一次异步查询 */
export function photoUriNow(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith(IDB_PREFIX)) {
    // 没缓存就交给 resolvePhotoUri 去 IndexedDB 里取，不能把 idb: 原样当地址用
    return objectUrls.get(uri.slice(IDB_PREFIX.length)) ?? '';
  }
  if (uri.startsWith(DOC_PREFIX)) {
    if (runtime() !== 'native') return '';
    try {
      const abs = docUri(uri);
      return new (fs().File)(abs).exists ? abs : '';
    } catch {
      return '';
    }
  }
  return uri;
}

/** 日记里记下的照片 uri → 现在可以显示的地址；文件已经不在这台设备上时返回 null */
export async function resolvePhotoUri(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith(IDB_PREFIX)) {
    if (runtime() !== 'web') return null;
    const id = uri.slice(IDB_PREFIX.length);
    const cached = objectUrls.get(id);
    if (cached) return cached;
    try {
      const blob = await idbRun<Blob | undefined>('readonly', s => s.get(id));
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      objectUrls.set(id, url);
      return url;
    } catch {
      return null;
    }
  }
  if (uri.startsWith(DOC_PREFIX)) {
    if (runtime() !== 'native') return null;
    return photoUriNow(uri) || null;
  }
  if (uri.startsWith('asset:')) return uri;
  if (runtime() === 'web' && uri.startsWith('blob:')) {
    try {
      await fetch(uri);
      return uri;
    } catch {
      return null;
    }
  }
  return uri;
}

/**
 * 删除不再被任何日记引用的照片文件。
 * 只处理应用自己收进来的文件（appdoc: / idb:photo/），相册原图与示例素材一律不碰。
 */
export async function discardPhotoFiles(uris: string[]): Promise<void> {
  const rt = runtime();
  if (rt === 'node' || !uris.length) return;
  for (const uri of uris) {
    try {
      if (uri.startsWith(IDB_PREFIX)) {
        if (rt !== 'web') continue;
        const id = uri.slice(IDB_PREFIX.length);
        const url = objectUrls.get(id);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrls.delete(id);
        }
        await idbRun('readwrite', s => s.delete(id));
      } else if (uri.startsWith(DOC_PREFIX)) {
        if (rt !== 'native') continue;
        const file = new (fs().File)(docUri(uri));
        if (file.exists) file.delete();
      }
    } catch {
      // 清理失败不影响日记本身
    }
  }
}

/** 清空全部照片文件（「清空所有数据」与注销账号时使用） */
export async function clearAllPhotoFiles(): Promise<void> {
  const rt = runtime();
  try {
    if (rt === 'web') {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
      objectUrls.clear();
      await idbRun('readwrite', s => s.clear());
    } else if (rt === 'native') {
      const { Directory, Paths } = fs();
      const dir = new Directory(Paths.document, PHOTO_DIR);
      if (dir.exists) dir.delete();
    }
  } catch {
    // 同上
  }
}

/** 候选照片里，已经没有任何一篇日记在引用的那些 */
export function unreferencedPhotos(candidates: string[], entries: Pick<Entry, 'photos'>[]): string[] {
  if (!candidates.length) return [];
  const used = new Set<string>();
  for (const e of entries) for (const p of e.photos ?? []) used.add(p);
  const seen = new Set<string>();
  return candidates.filter(uri => {
    if (used.has(uri) || seen.has(uri)) return false;
    seen.add(uri);
    return true;
  });
}
