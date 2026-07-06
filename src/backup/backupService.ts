import type { BackupExportEstimate } from '@/src/backup/backupEstimate';
import { estimateTextBytes } from '@/src/backup/backupEstimate';
import { DiaryBackupPayload } from '@/src/backup/backupPayload';
import type { DiaryData } from '@/src/storage/diaryRepository';

export async function exportBackup(payload: DiaryBackupPayload): Promise<string> {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName = `remember-diary-${payload.exportedAt.slice(0, 10)}.json`;

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return fileName;
}

export async function estimateBackupExport(payload: DiaryBackupPayload): Promise<BackupExportEstimate> {
  const textBytes = estimateTextBytes(JSON.stringify(payload));
  return {
    textBytes,
    embeddedMediaBytes: 0,
    totalBytes: textBytes,
    embeddedMediaCount: 0,
    missingMediaCount: 0,
  };
}

export async function importBackupText(): Promise<string | null> {
  return null;
}

export async function restoreBackupMedia(data: DiaryData, _raw?: string): Promise<DiaryData> {
  return data;
}
