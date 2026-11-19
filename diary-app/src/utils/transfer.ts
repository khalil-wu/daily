import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import type { Entry, Tag } from '../store/types';
import { entriesToHtml } from './transferFormat';

export {
  entryToMarkdown,
  entriesToMarkdown,
  entriesToPlainText,
  entriesToHtml,
  parseImportedEntries,
} from './transferFormat';

export async function exportTextFile(filename: string, content: string, mime = 'text/plain'): Promise<{ ok: boolean; path?: string; message?: string }> {
  try {
    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { ok: true, path: filename };
    }
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(content);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri);
    }
    return { ok: true, path: file.uri };
  } catch (e: any) {
    return { ok: false, message: e?.message || '导出失败' };
  }
}

export async function exportPdf(entries: Entry[], tags: Tag[]): Promise<{ ok: boolean; message?: string }> {
  try {
    const html = entriesToHtml(entries, tags);
    if (Platform.OS === 'web') {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
        return { ok: true };
      }
      return exportTextFile(`记得日记-${Date.now()}.html`, html, 'text/html');
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'PDF 生成失败' };
  }
}

export async function pickAndReadTextFile(types: string[] = ['*/*']): Promise<{ name: string; content: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    const file = (asset as any).file as File | undefined;
    if (file) return { name: asset.name, content: await file.text() };
    const r = await fetch(asset.uri);
    return { name: asset.name, content: await r.text() };
  }
  const file = new File(asset.uri);
  const content = await file.text();
  return { name: asset.name, content };
}
