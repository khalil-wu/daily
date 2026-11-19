import type { AppState, Entry, Tag } from '../store/types';
import { moodMeta, weatherMeta } from '../data/constants';
import { normalizeEntry } from '../store/storage';
import { fmtDateTime, fmtFullDate } from './date';
import { plainText, uid } from './text';
import { videoNote } from './video';

export function entryToMarkdown(entry: Entry, tags: Tag[]): string {
  const tagNames = entry.tags.map(id => tags.find(t => t.id === id)?.name).filter(Boolean);
  const mood = moodMeta(entry.mood);
  const weather = weatherMeta(entry.weather);
  const metaParts = [fmtDateTime(entry.createdAt)];
  if (entry.place?.name) metaParts.push(entry.place.name);
  if (weather) metaParts.push(`${weather.label}${entry.temperature != null ? ` ${entry.temperature}°C` : ''}`);
  if (mood) metaParts.push(`心情：${mood.label}`);
  if (tagNames.length) metaParts.push(`标签：${tagNames.join(' / ')}`);
  // 文字导出带不走视频文件，但要留下「这里有过视频」的记录
  const videos = videoNote(entry.videos);
  if (videos) metaParts.push(videos);

  return [
    `# ${entry.title || '无题日记'}`,
    '',
    `> ${metaParts.join(' · ')}`,
    '',
    entry.body,
    '',
  ].join('\n');
}

export function entriesToMarkdown(entries: Entry[], tags: Tag[]): string {
  const list = entries.filter(e => !e.deletedAt && e.status === 'published').sort((a, b) => b.createdAt - a.createdAt);
  const header = `# 记得日记导出\n\n导出时间：${fmtDateTime(Date.now())} · 共 ${list.length} 篇\n\n---\n\n`;
  return header + list.map(e => entryToMarkdown(e, tags)).join('\n---\n\n');
}

export function entriesToPlainText(entries: Entry[], tags: Tag[]): string {
  const list = entries.filter(e => !e.deletedAt && e.status === 'published').sort((a, b) => b.createdAt - a.createdAt);
  return list
    .map(e => {
      const mood = moodMeta(e.mood);
      const tagNames = e.tags.map(id => tags.find(t => t.id === id)?.name).filter(Boolean).join(', ');
      const videos = videoNote(e.videos);
      return [
        `${e.title || '无题日记'}`,
        `${fmtDateTime(e.createdAt)}${e.place?.name ? ` | ${e.place.name}` : ''}${mood ? ` | ${mood.label}` : ''}${tagNames ? ` | #${tagNames}` : ''}${videos ? ` | ${videos}` : ''}`,
        '',
        plainText(e.body),
      ].join('\n');
    })
    .join('\n\n====================================\n\n');
}

export function entriesToHtml(entries: Entry[], tags: Tag[]): string {
  const list = entries.filter(e => !e.deletedAt && e.status === 'published').sort((a, b) => b.createdAt - a.createdAt);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cards = list
    .map(e => {
      const mood = moodMeta(e.mood);
      const tagNames = e.tags.map(id => tags.find(t => t.id === id)?.name).filter(Boolean);
      const bodyHtml = esc(plainText(e.body)).replace(/\n/g, '<br/>');
      const videos = videoNote(e.videos);
      return `
        <article style="margin-bottom:28px;padding-bottom:22px;border-bottom:1px solid #EDE6DE;">
          <div style="font-size:12px;color:#7A746E;margin-bottom:6px;">
            ${esc(fmtFullDate(e.createdAt))} ${e.place?.name ? `· ${esc(e.place.name)}` : ''} ${mood ? `· ${esc(mood.label)}` : ''} ${videos ? `· ${esc(videos)}` : ''}
          </div>
          <h2 style="font-size:19px;color:#2F2A26;margin:0 0 10px 0;">${esc(e.title || '无题日记')}</h2>
          ${tagNames.length ? `<div style="margin-bottom:10px;">${tagNames.map(n => `<span style="display:inline-block;background:#F3EBE2;color:#9C7A60;font-size:11px;padding:2px 8px;border-radius:999px;margin-right:6px;">#${esc(n!)}</span>`).join('')}</div>` : ''}
          <div style="font-size:15px;line-height:1.85;color:#2F2A26;">${bodyHtml}</div>
        </article>`;
    })
    .join('');

  return `<!doctype html>
  <html lang="zh-CN">
    <head><meta charset="utf-8" /><title>记得日记</title></head>
    <body style="font-family:'Songti SC','Noto Serif CJK SC',serif;background:#F8F5EF;color:#2F2A26;max-width:680px;margin:0 auto;padding:36px 24px;">
      <header style="text-align:center;margin-bottom:36px;">
        <h1 style="margin:0;font-size:26px;letter-spacing:2px;">记得日记</h1>
        <p style="color:#7A746E;font-size:13px;margin-top:6px;">记下生活，记得自己 · 共 ${list.length} 篇</p>
      </header>
      ${cards}
    </body>
  </html>`;
}

/** 解析导入的 Markdown / TXT / JSON 内容 */
export function parseImportedEntries(raw: string, format: 'md' | 'txt' | 'json'): { entries: Entry[]; snapshot?: Partial<AppState> } {
  if (format === 'json') {
    const parsed = JSON.parse(raw);
    // 逐篇补全字段：旧版本导出的文件没有 videos 等后来新增的字段
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.entries)) {
      return { entries: parsed.entries.map(normalizeEntry), snapshot: parsed };
    }
    if (Array.isArray(parsed)) {
      return { entries: parsed.map(normalizeEntry) };
    }
    throw new Error('JSON 格式不正确，未找到日记数组');
  }

  const sep = format === 'md' ? /\n---\n+/ : /\n={10,}\n+/;
  const blocks = raw
    .split(sep)
    .map(b => b.trim())
    .filter(b => b && !b.startsWith('# 记得日记导出'));

  const now = Date.now();
  const entries: Entry[] = blocks.map((block, idx) => {
    const lines = block.split('\n');
    let title = '';
    let bodyStart = 0;
    if (lines[0]?.startsWith('# ')) {
      title = lines[0].slice(2).trim();
      bodyStart = 1;
    } else if (lines.length > 1) {
      title = lines[0].trim();
      bodyStart = 1;
    }
    while (bodyStart < lines.length && (!lines[bodyStart].trim() || lines[bodyStart].startsWith('>'))) {
      bodyStart += 1;
    }
    const body = lines.slice(bodyStart).join('\n').trim() || block;
    const t = now - idx * 60000;
    return {
      id: uid('e'),
      title,
      body,
      createdAt: t,
      updatedAt: t,
      tags: [],
      photos: [],
      audios: [],
      videos: [],
      favorite: false,
      pinned: false,
      hidden: false,
      status: 'published',
    };
  });
  return { entries };
}
