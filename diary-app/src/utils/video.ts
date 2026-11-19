import type { Entry, VideoClip } from '../store/types';
import { fmtDuration } from './date';

/** 单段视频最长时长（秒） */
export const MAX_VIDEO_SECONDS = 60;

/**
 * 相册 / 相机给出的时长统一成「秒」。
 * 原生端返回毫秒，网页端返回秒；读不到时长（null、NaN、Infinity）记为 0。
 */
export function videoSeconds(raw: number | null | undefined, unit: 'ms' | 's'): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0;
  return unit === 'ms' ? raw / 1000 : raw;
}

/** 是否超过单段上限（留 1 秒余量：相机到点自动停止时常会多出零点几秒） */
export function isVideoTooLong(seconds: number, max = MAX_VIDEO_SECONDS): boolean {
  return seconds > max + 1;
}

/** 写进日记的时长：整秒，至少 1 秒；读不到时长时为 0（界面上不显示时长） */
export function clipDuration(seconds: number): number {
  return seconds > 0 ? Math.max(1, Math.round(seconds)) : 0;
}

/** 清洗 videos 字段：旧数据没有这个字段、导入文件里混进坏数据时都能得到干净的数组 */
export function normalizeVideos(raw: unknown): VideoClip[] {
  if (!Array.isArray(raw)) return [];
  const out: VideoClip[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const v = item as Partial<VideoClip>;
    if (typeof v.id !== 'string' || !v.id || typeof v.uri !== 'string' || !v.uri) continue;
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    const clip: VideoClip = {
      id: v.id,
      uri: v.uri,
      duration: typeof v.duration === 'number' && Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration) : 0,
      createdAt: typeof v.createdAt === 'number' && Number.isFinite(v.createdAt) ? v.createdAt : 0,
    };
    if (typeof v.poster === 'string' && v.poster) clip.poster = v.poster;
    if (typeof v.width === 'number' && v.width > 0) clip.width = v.width;
    if (typeof v.height === 'number' && v.height > 0) clip.height = v.height;
    out.push(clip);
  }
  return out;
}

/** 列表缩略图 / 分享卡用的封面：优先第一张照片，没有照片时用第一段视频的封面 */
export function entryCover(entry: Pick<Entry, 'photos' | 'videos'>): { uri?: string; isVideo: boolean } {
  if (entry.photos.length > 0) return { uri: entry.photos[0], isVideo: false };
  const withPoster = entry.videos.find(v => !!v.poster);
  if (withPoster) return { uri: withPoster.poster, isVideo: true };
  return { uri: undefined, isVideo: entry.videos.length > 0 };
}

/** 视频卡片的宽高比：竖拍最高到 4:5，横拍最宽到 16:9，读不到尺寸时与单张照片一致 */
export function videoAspect(clip: Pick<VideoClip, 'width' | 'height'>): number {
  if (!clip.width || !clip.height) return 1.45;
  return Math.min(16 / 9, Math.max(0.8, clip.width / clip.height));
}

/** 候选视频里，已经没有任何一篇日记在引用的那些（它们的文件可以清理） */
export function unreferencedVideos(candidates: VideoClip[], entries: Pick<Entry, 'videos'>[]): VideoClip[] {
  if (!candidates.length) return [];
  const used = new Set<string>();
  for (const e of entries) for (const v of e.videos ?? []) used.add(v.uri);
  const seen = new Set<string>();
  return candidates.filter(v => {
    if (used.has(v.uri) || seen.has(v.uri)) return false;
    seen.add(v.uri);
    return true;
  });
}

/** 导出文字里的一句话说明：视频 2 段（00:12、00:45） */
export function videoNote(videos: VideoClip[]): string {
  if (!videos.length) return '';
  const durations = videos.filter(v => v.duration > 0).map(v => fmtDuration(v.duration));
  return `视频 ${videos.length} 段${durations.length ? `（${durations.join('、')}）` : ''}`;
}

/** 搜索用：带视频的日记可以用「视频」搜到 */
export function videoSearchWords(entry: Pick<Entry, 'videos'>): string {
  return entry.videos.length > 0 ? '视频' : '';
}

export interface MediaItem {
  kind: 'photo' | 'video';
  key: string;
  /** 照片 uri，或视频封面 uri（可能没有） */
  uri?: string;
  entryId: string;
  title: string;
  date: number;
  video?: VideoClip;
}

/** 影像记忆：把已发布日记里的照片和视频按时间倒序摊开 */
export function collectMedia(entries: Entry[]): MediaItem[] {
  const out: MediaItem[] = [];
  entries
    .filter(e => !e.deletedAt && !e.hidden && e.status === 'published')
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(e => {
      const title = e.title || '无题日记';
      e.photos.forEach((uri, i) => out.push({ kind: 'photo', key: `${e.id}:p${i}`, uri, entryId: e.id, title, date: e.createdAt }));
      e.videos.forEach(v => out.push({ kind: 'video', key: `${e.id}:v${v.id}`, uri: v.poster, entryId: e.id, title, date: e.createdAt, video: v }));
    });
  return out;
}
