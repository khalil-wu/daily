import { fileURLToPath } from 'node:url';
/** Against a local export only: node --import tsx scripts/verify-backup.mts */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { defaultState, normalizeEntry } from '../src/store/storage';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import type { AppState } from '../src/store/types';

const baseURL = process.env.DIARY_TEST_URL || 'http://127.0.0.1:8765';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Use a local preview for seeded test data.');
const browser = await chromium.launch({ headless: true });
const errors: string[] = [];
const seed = (): AppState => ({ ...defaultState(), onboarded: true, usageMode: 'local', tutorialSeen: true, editorTourSeen: true, backup: { auto: false } });
async function open(state: AppState) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'zh-CN', acceptDownloads: true });
  // tsx preserves function names with this helper inside serialized evaluate callbacks.
  await context.addInitScript('globalThis.__name = (value) => value;');
  await context.addInitScript(value => {
    if (!sessionStorage.getItem('backup-test-seeded')) {
      localStorage.setItem('jide-diary:state:v1', JSON.stringify(value));
      sessionStorage.setItem('backup-test-seeded', 'yes');
    }
  }, state);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}/settings/backup`);
  await page.getByRole('button', { name: /^手动备份/ }).waitFor();
  return { context, page };
}

try {
  const initial = seed();
  initial.profile.avatar = 'idb:photo/avatar';
  initial.profile.cover = 'idb:photo/cover';
  initial.entries = [normalizeEntry({ id: 'portable-test', title: '媒体备份验收', body: '真实照片、录音、视频与封面跨浏览器恢复', status: 'published',
    photos: ['idb:photo/photo'], audios: [{ id: 'aud', uri: 'idb:video/audio', duration: 1, createdAt: Date.now() }],
    videos: [{ id: 'vid', uri: 'idb:video/video', poster: 'idb:photo/poster', duration: 1, createdAt: Date.now() }],
  })];
  const source = await open(initial);
  const jpeg = (await readFile(new URL('../assets/images/avatar.jpg', import.meta.url))).toString('base64');
  const mediaHashes = await source.page.evaluate(async jpegBase64 => {
    const image = new Blob([Uint8Array.from(atob(jpegBase64), ch => ch.charCodeAt(0))], { type: 'image/jpeg' });
    const wavBytes = new Uint8Array(44 + 8000 * 2);
    const view = new DataView(wavBytes.buffer);
    const ascii = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) wavBytes[offset + i] = text.charCodeAt(i); };
    ascii(0, 'RIFF'); view.setUint32(4, wavBytes.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, 16000, true);
    const audio = new Blob([wavBytes], { type: 'audio/wav' });
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const painter = canvas.getContext('2d')!; painter.fillStyle = '#9c7a60'; painter.fillRect(0, 0, 32, 32);
    const stream = canvas.captureStream(5);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.start();
    await new Promise(resolve => setTimeout(resolve, 500));
    const video = await new Promise<Blob>(resolve => { recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' })); recorder.stop(); });
    stream.getTracks().forEach(track => track.stop());
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('jide-diary-media', 2);
      request.onupgradeneeded = () => { for (const name of ['photos', 'videos']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const values = [['photos', 'photo', image], ['photos', 'avatar', image], ['photos', 'cover', image], ['photos', 'poster', image], ['videos', 'audio', audio], ['videos', 'video', video]] as const;
    const hashes: Record<string, string> = {};
    for (const [store, id, blob] of values) {
      await new Promise<void>((resolve, reject) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(blob, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      hashes[`${store}/${id}`] = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }
    db.close();
    return hashes;
  }, jpeg);
  const downloadPromise = source.page.waitForEvent('download');
  await source.page.getByRole('button', { name: /^手动备份/ }).click();
  const download = await downloadPromise;
  const backup = await readFile((await download.path())!, 'utf8');
  const portable = JSON.parse(backup);
  assert.equal(portable.mediaVersion, 1);
  assert.equal(portable.media.length, 6);
  for (const item of portable.media) assert.equal(createHash('sha256').update(Buffer.from(item.data, 'base64')).digest('hex'), item.sha256);
  await source.context.close();

  // A separate browser context has neither the source IndexedDB nor its blob URLs.
  const target = await open(seed());
  const chooserPromise = target.page.waitForEvent('filechooser');
  await target.page.getByRole('button', { name: /^恢复数据/ }).click();
  await (await chooserPromise).setFiles({ name: 'portable-test.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await target.page.getByRole('button', { name: '合并恢复', exact: true }).click();
  await target.page.waitForFunction(() => (JSON.parse(localStorage.getItem('jide-diary:state:v1') || '{}').entries || []).some((e: { id: string }) => e.id === 'portable-test'));
  await target.page.reload();
  const restored = await target.page.evaluate(async () => {
    const state = JSON.parse(localStorage.getItem('jide-diary:state:v1')!);
    const entry = state.entries.find((e: { id: string }) => e.id === 'portable-test');
    const references: Record<string, string> = { 'photos/photo': entry.photos[0], 'photos/avatar': state.profile.avatar, 'photos/cover': state.profile.cover, 'photos/poster': entry.videos[0].poster, 'videos/audio': entry.audios[0].uri, 'videos/video': entry.videos[0].uri };
    // Merge restores diary data; profile stays the current device's preference.
    delete references['photos/avatar']; delete references['photos/cover'];
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('jide-diary-media', 2); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const hashes: Record<string, string> = {};
    for (const [original, uri] of Object.entries(references)) {
      const match = /^idb:(photo|video)\/(.+)$/.exec(uri)!;
      if (!match) throw new Error('Expected a durable IndexedDB URI');
      const blob = await new Promise<Blob>((resolve, reject) => { const request = db.transaction(match[1] === 'photo' ? 'photos' : 'videos').objectStore(match[1] === 'photo' ? 'photos' : 'videos').get(match[2]); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
      hashes[original] = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    }
    db.close(); return hashes;
  });
  for (const [key, digest] of Object.entries(restored)) assert.equal(digest, mediaHashes[key]);
  await target.page.goto(`${baseURL}/memory/portable-test`);
  await target.page.getByText('媒体备份验收', { exact: true }).waitFor();
  await target.page.getByRole('button', { name: '播放录音', exact: true }).waitFor();
  await target.page.getByRole('button', { name: '播放录音', exact: true }).click();
  await target.page.getByRole('button', { name: '暂停录音', exact: true }).waitFor();
  await mkdir(new URL('../docs/qa', import.meta.url), { recursive: true });
  await target.page.screenshot({ path: fileURLToPath(new URL('../docs/qa/portable-backup-restored.png', import.meta.url)), fullPage: true });
  assert.deepEqual(errors, []);
  const report = { passed: true, exportedMedia: portable.media.length, restoredMediaChecksums: Object.keys(restored).length, audioPlaybackAfterReload: true, browserErrors: errors.length };
  await writeFile(new URL('../docs/qa/backup-browser-report.json', import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await target.context.close();
} finally { await browser.close(); }
