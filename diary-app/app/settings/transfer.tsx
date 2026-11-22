import { HiddenAccessBoundary } from '../../src/components/HiddenAccessBoundary';
import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { Braces, FileCode2, FileSpreadsheet, FileText, Printer } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { flushPendingState, getPersistenceError } from '../../src/store/storage';
import { actions, useStore } from '../../src/store/store';
import { Group, NavBar, Row, Screen } from '../../src/components/ui';
import { useFeedback } from '../../src/components/feedback';
import {
  entriesToMarkdown,
  entriesToPlainText,
  exportPdf,
  exportTextFile,
  parseImportedEntries,
  pickAndReadTextFile,
} from '../../src/utils/transfer';

/** 12. 导入与导出（1:1 复刻设计稿3 #12） */
export default function TransferScreen() { return <HiddenAccessBoundary required><TransferScreenContent /></HiddenAccessBoundary>; }

function TransferScreenContent() {
  const { c } = useTheme();
  const { toast } = useFeedback();
  const entries = useStore(s => s.entries);
  const tags = useStore(s => s.tags);
  const [busy, setBusy] = useState(false);

  const importFile = async (format: 'md' | 'txt' | 'json') => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pickAndReadTextFile(
        format === 'json' ? ['application/json', '*/*'] : ['text/plain', 'text/markdown', '*/*'],
      );
      if (!picked) return;
      const { entries: parsed } = parseImportedEntries(picked.content, format);
      if (!parsed.length) {
        toast('未在文件中识别到可导入的日记', { type: 'warning' });
        return;
      }
      const n = actions.importEntries(parsed);
      await flushPendingState();
      if (getPersistenceError()) throw new Error(getPersistenceError()!);
      toast('导入成功', { message: `已从「${picked.name}」导入 ${n} 篇日记` });
    } catch (e: any) {
      toast(e?.message || '导入失败，请检查文件编码与格式', { type: 'error' });
    } finally { setBusy(false); }
  };

  const doExport = async (kind: 'md' | 'pdf' | 'txt' | 'json') => {
    if (busy) return;
    const published = entries.filter(e => !e.deletedAt && e.status === 'published');
    if (!published.length) {
      toast('当前还没有可导出的日记', { type: 'warning' });
      return;
    }
    setBusy(true);
    try {
    const stamp = new Date().toISOString().slice(0, 10);
    let res: { ok: boolean; message?: string };
    if (kind === 'md') {
      res = await exportTextFile(`记得日记-${stamp}.md`, entriesToMarkdown(entries, tags), 'text/markdown');
    } else if (kind === 'txt') {
      res = await exportTextFile(`记得日记-${stamp}.txt`, entriesToPlainText(entries, tags), 'text/plain');
    } else if (kind === 'json') {
      res = await exportTextFile(
        `记得日记-${stamp}.json`,
        JSON.stringify({ app: '记得日记', exportedAt: Date.now(), entries: published, tags }, null, 2),
        'application/json',
      );
    } else {
      res = await exportPdf(entries, tags);
    }
    if (res.ok) toast('导出成功', { message: `已准备 ${published.length} 篇日记` });
    else toast(res.message || '导出失败', { type: 'error' });
    } catch (error) { toast(error instanceof Error ? error.message : '导出失败', { type: 'error' }); }
    finally { setBusy(false); }
  };

  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar variant="large" title="导入与导出" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Group title="导入日记（从其他格式文件）">
          <Row
            icon={FileCode2}
            iconColor={c.primaryDark}
            title="从 Markdown 文件导入"
            subtitle="支持 .md 文件"
            onPress={() => void importFile('md')}
          />
          <Row
            icon={FileText}
            iconColor={c.primaryDark}
            title="从纯文本文件导入"
            subtitle="支持 .txt 文件"
            onPress={() => void importFile('txt')}
          />
          <Row
            icon={Braces}
            iconColor={c.primaryDark}
            title="从 JSON 文件导入"
            subtitle="支持 .json 格式"
            onPress={() => void importFile('json')}
          />
        </Group>

        <Group title="导出日记（保存或迁移数据）">
          <Row
            icon={FileCode2}
            iconColor={c.primaryDark}
            title="导出为 Markdown"
            subtitle="通用格式，便于长期保存"
            disabled={busy}
            onPress={() => void doExport('md')}
          />
          <Row
            icon={Printer}
            iconColor={c.primaryDark}
            title="导出为 PDF"
            subtitle="适合打印与归档"
            disabled={busy}
            onPress={() => void doExport('pdf')}
          />
          <Row
            icon={FileText}
            iconColor={c.primaryDark}
            title="导出为纯文本"
            subtitle="轻量，兼容性强"
            disabled={busy}
            onPress={() => void doExport('txt')}
          />
          <Row
            icon={FileSpreadsheet}
            iconColor={c.primaryDark}
            title="导出为 JSON"
            subtitle="包含日记完整信息（标签、时间等）"
            disabled={busy}
            onPress={() => void doExport('json')}
          />
        </Group>
      </ScrollView>
    </Screen>
  );
}
