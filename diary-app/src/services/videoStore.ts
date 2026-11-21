import type { VideoClip } from '../store/types';

/**
 * 视频文件的存放与读取。
 *
 * 相册和相机给出的地址都只是临时的：原生端在缓存目录里，系统随时可能清掉；
 * 网页端是 blob: 地址，刷新页面就失效。所以选好视频后先收进应用自己的空间：
 *  - 原生：复制到文档目录 videos/，日记里记相对写法 appdoc:videos/<文件名>
 *    （iOS 每次升级应用，文档目录的绝对路径都会变，不能把绝对路径写进日记）
 *  - 网页：文件存进 IndexedDB，日记里记 idb:video/<id>，播放时再换成 blob 地址
 *
 * 这个模块会被 store 引用，而 store 要在 Node 测试里运行，
 * 所以不在顶层引入 react-native / expo 模块，用到时再取。
 */

export const DOC_PREFIX = 'appdoc:';
export const IDB_PREFIX = 'idb:video/';

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

/** appdoc: 相对写法 → 当前这次安装下的绝对地址 */
function docUri(stored: string): string {
  if (docBase == null) docBase = fs().Paths.document.uri.replace(/\/+$/, '');
  return `${docBase}/${stored.slice(DOC_PREFIX.length)}`;
}

function videoDir() {
  const { Directory, Paths } = fs();
  const dir = new Directory(Paths.document, 'videos');
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
const DB_STORE = 'videos';
/** 与 photoStore 共用这个库，打开时补建照片表，免得先开视频表的那一侧升不了级 */
const PHOTOS_STORE = 'photos';
/** 本次会话里已经换好的 blob 地址：id → url */
const objectUrls = new Map<string, string>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持本地文件存储'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of [DB_STORE, PHOTOS_STORE]) {
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
 * 把刚选好 / 拍好的视频收进应用自己的空间，返回写进日记的 uri。
 * durable = false 表示没能收进来，只能先用临时地址（之后可能失效）。
 */
export async function storeVideo(id: string, sourceUri: string, opts?: { blob?: Blob }): Promise<{ uri: string; durable: boolean }> {
  const rt = runtime();
  if (rt === 'web') {
    try {
      const blob = opts?.blob ?? (await (await fetch(sourceUri)).blob());
      await idbRun('readwrite', s => s.put(blob, id));
      // 选取时拿到的 blob 地址在本次会话内仍然有效，直接复用
      objectUrls.set(id, sourceUri);
      return { uri: `${IDB_PREFIX}${id}`, durable: true };
    } catch {
      return { uri: sourceUri, durable: false };
    }
  }
  if (rt === 'native') {
    try {
      const { File } = fs();
      const name = `${id}.${extOf(sourceUri, 'mp4')}`;
      const dest = new File(videoDir(), name);
      if (dest.exists) dest.delete();
      await new File(sourceUri).copy(dest);
      return { uri: `${DOC_PREFIX}videos/${name}`, durable: true };
    } catch {
      return { uri: sourceUri, durable: false };
    }
  }
  return { uri: sourceUri, durable: false };
}

/** 日记里记下的视频 uri → 现在可以播放的地址；文件已经不在这台设备上时返回 null */
export async function resolveVideoUri(uri: string): Promise<string | null> {
  if (!uri) return null;
  const rt = runtime();
  if (uri.startsWith(IDB_PREFIX)) {
    if (rt !== 'web') return null;
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
    if (rt !== 'native') return null;
    try {
      const abs = docUri(uri);
      return new (fs().File)(abs).exists ? abs : null;
    } catch {
      return null;
    }
  }
  if (rt === 'native' && uri.startsWith('file:')) {
    try {
      return new (fs().File)(uri).exists ? uri : null;
    } catch {
      return uri;
    }
  }
  if (rt === 'web' && uri.startsWith('blob:')) {
    // 刷新页面后旧的 blob 地址会失效
    try {
      await fetch(uri);
      return uri;
    } catch {
      return null;
    }
  }
  return uri;
}

/** 封面 uri → 可以直接交给图片组件的地址（同步） */
export function posterUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (!uri.startsWith(DOC_PREFIX)) return uri;
  if (runtime() !== 'native') return undefined;
  try {
    return docUri(uri);
  } catch {
    return undefined;
  }
}

export interface Poster {
  uri: string;
  /** 画面摆正之后的宽高（竖拍视频的原始尺寸常常是横着的，以封面为准） */
  width: number;
  height: number;
}

/** 网页端：把视频画到画布上截一帧，返回一张小尺寸的 JPEG（data: 地址，可随日记一起保存） */
function grabFrameOnWeb(url: string, seconds: number): Promise<Poster | undefined> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    let done = false;
    const finish = (value?: Poster) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };
    const timer = setTimeout(() => finish(), 6000);
    const draw = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return finish();
        const scale = Math.min(1, 480 / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish({ uri: canvas.toDataURL('image/jpeg', 0.62), width: w, height: h });
      } catch {
        finish();
      }
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish();
    video.onseeked = draw;
    video.onloadeddata = () => {
      const total = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : seconds;
      const at = Math.min(1, total / 2);
      if (at > 0.05) video.currentTime = at;
      else draw();
    };
    video.src = url;
  });
}

/** 取视频中的一帧作封面；取不到时返回 undefined（界面用占位底色） */
export async function makePoster(id: string, playableUri: string, seconds: number): Promise<Poster | undefined> {
  const rt = runtime();
  try {
    if (rt === 'web') return await grabFrameOnWeb(playableUri, seconds);
    if (rt === 'native') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Thumbs = require('expo-video-thumbnails') as typeof import('expo-video-thumbnails');
      const at = Math.round(Math.min(1, Math.max(0, seconds) / 2) * 1000);
      const shot = await Thumbs.getThumbnailAsync(playableUri, { time: at, quality: 0.6 });
      try {
        const { File } = fs();
        const dest = new File(videoDir(), `${id}.jpg`);
        if (dest.exists) dest.delete();
        await new File(shot.uri).copy(dest);
        return { uri: `${DOC_PREFIX}videos/${id}.jpg`, width: shot.width, height: shot.height };
      } catch {
        return { uri: shot.uri, width: shot.width, height: shot.height };
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** 删除不再被任何日记引用的视频文件（连同封面） */
export async function discardVideoFiles(clips: Pick<VideoClip, 'uri' | 'poster'>[]): Promise<void> {
  const rt = runtime();
  if (rt === 'node' || !clips.length) return;
  for (const clip of clips) {
    try {
      if (rt === 'web') {
        if (!clip.uri.startsWith(IDB_PREFIX)) continue;
        const id = clip.uri.slice(IDB_PREFIX.length);
        const url = objectUrls.get(id);
        if (url) {
          URL.revokeObjectURL(url);
          objectUrls.delete(id);
        }
        await idbRun('readwrite', s => s.delete(id));
      } else {
        const { File } = fs();
        for (const stored of [clip.uri, clip.poster]) {
          if (!stored?.startsWith(DOC_PREFIX)) continue;
          const file = new File(docUri(stored));
          if (file.exists) file.delete();
        }
      }
    } catch {
      // 清理失败不影响日记本身
    }
  }
}

/** 清空全部视频文件（「清空所有数据」与注销账号时使用） */
export async function clearAllVideoFiles(): Promise<void> {
  const rt = runtime();
  try {
    if (rt === 'web') {
      objectUrls.forEach(url => URL.revokeObjectURL(url));
      objectUrls.clear();
      await idbRun('readwrite', s => s.clear());
    } else if (rt === 'native') {
      const { Directory, Paths } = fs();
      const dir = new Directory(Paths.document, 'videos');
      if (dir.exists) dir.delete();
    }
  } catch {
    // 同上
  }
}
