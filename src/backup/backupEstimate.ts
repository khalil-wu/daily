export type BackupExportEstimate = {
  textBytes: number;
  embeddedMediaBytes: number;
  totalBytes: number;
  embeddedMediaCount: number;
  missingMediaCount: number;
};

export function estimateTextBytes(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else bytes += 3;
  }
  return bytes;
}

export function backupSizeLevel(totalBytes: number): 'normal' | 'large' | 'huge' {
  if (totalBytes >= 50 * 1024 * 1024) return 'huge';
  if (totalBytes >= 10 * 1024 * 1024) return 'large';
  return 'normal';
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}
