import * as DocumentPicker from 'expo-document-picker';
import { Directory, EncodingType, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { BackupExportEstimate } from '@/src/backup/backupEstimate';
import { estimateTextBytes } from '@/src/backup/backupEstimate';
import { DiaryBackupPayload, parseBackupMedia } from '@/src/backup/backupPayload';
import type { DiaryBackupEmbeddedAvatar, DiaryBackupEmbeddedMedia, DiaryBackupEmbeddedVoiceNote, DiaryBackupMedia } from '@/src/backup/backupPayload';
import type { DiaryData } from '@/src/storage/diaryRepository';

function fileNameFor(payload: DiaryBackupPayload): string {
  return `remember-diary-${payload.exportedAt.slice(0, 10)}.json`;
}

function ensureMediaDirectory(): Directory {
  const directory = new Directory(Paths.document, 'media');
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

function extensionFor(fileName: string | null, mimeType: string | null): string {
  const fromName = fileName?.match(/\.[a-zA-Z0-9]+$/)?.[0];
  if (fromName) return fromName.toLowerCase();
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'audio/webm') return '.webm';
  if (mimeType === 'audio/mpeg') return '.mp3';
  if (mimeType === 'audio/mp4') return '.m4a';
  return '.jpg';
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64) || 'media';
}

async function embeddedMediaFor(payload: DiaryBackupPayload): Promise<DiaryBackupMedia> {
  const attachments: DiaryBackupEmbeddedMedia[] = [];
  const avatars: DiaryBackupEmbeddedAvatar[] = [];
  const voiceNotes: DiaryBackupEmbeddedVoiceNote[] = [];

  for (const person of payload.data.people) {
    if (!person.avatarUri || person.avatarUri.startsWith('data:')) continue;

    try {
      const file = new File(person.avatarUri);
      if (!file.exists) continue;
      avatars.push({
        kind: 'avatar',
        personId: person.id,
        fileName: null,
        mimeType: file.type || null,
        base64: await file.base64(),
      });
    } catch {
      // Missing avatar files should not block exporting the text backup.
    }
  }

  for (const memory of payload.data.memories) {
    for (const attachment of memory.attachments) {
      if (!attachment.uri || attachment.uri.startsWith('data:')) continue;

      try {
        const file = new File(attachment.uri);
        if (!file.exists) continue;
        attachments.push({
          kind: 'attachment',
          memoryId: memory.id,
          attachmentId: attachment.id,
          fileName: attachment.fileName ?? null,
          mimeType: attachment.mimeType || file.type || null,
          width: attachment.width,
          height: attachment.height,
          base64: await file.base64(),
        });
      } catch {
        // Missing or inaccessible media should not block exporting the text backup.
      }
    }

    for (const voice of memory.voiceNotes ?? []) {
      if (!voice.uri || voice.uri.startsWith('data:')) continue;

      try {
        const file = new File(voice.uri);
        if (!file.exists) continue;
        voiceNotes.push({
          kind: 'voice',
          memoryId: memory.id,
          voiceNoteId: voice.id,
          fileName: null,
          mimeType: file.type || 'audio/webm',
          base64: await file.base64(),
        });
      } catch {
        // Missing or inaccessible media should not block exporting the text backup.
      }
    }
  }

  return { attachments, avatars, voiceNotes };
}

export async function estimateBackupExport(payload: DiaryBackupPayload): Promise<BackupExportEstimate> {
  let embeddedMediaBytes = 0;
  let embeddedMediaCount = 0;
  let missingMediaCount = 0;

  for (const person of payload.data.people) {
    if (!person.avatarUri || person.avatarUri.startsWith('data:')) continue;

    try {
      const file = new File(person.avatarUri);
      if (file.exists && file.size > 0) {
        embeddedMediaBytes += file.size;
        embeddedMediaCount += 1;
      } else {
        missingMediaCount += 1;
      }
    } catch {
      missingMediaCount += 1;
    }
  }

  for (const memory of payload.data.memories) {
    for (const attachment of memory.attachments) {
      if (!attachment.uri || attachment.uri.startsWith('data:')) continue;

      try {
        const file = new File(attachment.uri);
        if (file.exists && file.size > 0) {
          embeddedMediaBytes += file.size;
          embeddedMediaCount += 1;
        } else {
          missingMediaCount += 1;
        }
      } catch {
        missingMediaCount += 1;
      }
    }

    for (const voice of memory.voiceNotes ?? []) {
      if (!voice.uri || voice.uri.startsWith('data:')) continue;

      try {
        const file = new File(voice.uri);
        if (file.exists && file.size > 0) {
          embeddedMediaBytes += file.size;
          embeddedMediaCount += 1;
        } else {
          missingMediaCount += 1;
        }
      } catch {
        missingMediaCount += 1;
      }
    }
  }

  const textBytes = estimateTextBytes(JSON.stringify(payload));
  return {
    textBytes,
    embeddedMediaBytes,
    totalBytes: textBytes + Math.ceil(embeddedMediaBytes * 1.34),
    embeddedMediaCount,
    missingMediaCount,
  };
}

export async function exportBackup(payload: DiaryBackupPayload): Promise<string> {
  const media = await embeddedMediaFor(payload);
  const hasMedia = media.attachments.length > 0 || (media.avatars?.length ?? 0) > 0 || (media.voiceNotes?.length ?? 0) > 0;
  const exportPayload: DiaryBackupPayload = hasMedia
    ? { ...payload, media }
    : payload;
  const file = new File(Paths.document, fileNameFor(payload));
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(exportPayload, null, 2));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      dialogTitle: '备份记得日记',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  }

  return file.uri;
}

export async function importBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return null;
  const file = new File(result.assets[0].uri);
  return file.text();
}

export async function restoreBackupMedia(data: DiaryData, raw: string): Promise<DiaryData> {
  const media = parseBackupMedia(raw);
  if (media.attachments.length === 0 && (media.avatars?.length ?? 0) === 0 && (media.voiceNotes?.length ?? 0) === 0) return data;

  const directory = ensureMediaDirectory();
  const embeddedByKey = new Map(
    media.attachments.map((attachment) => [`${attachment.memoryId}:${attachment.attachmentId}`, attachment]),
  );
  const avatarsByPersonId = new Map((media.avatars ?? []).map((avatar) => [avatar.personId, avatar]));
  const voicesByKey = new Map((media.voiceNotes ?? []).map((voice) => [`${voice.memoryId}:${voice.voiceNoteId}`, voice]));
  const importId = Date.now().toString(36);

  return {
    people: await Promise.all(data.people.map(async (person) => {
      const embedded = avatarsByPersonId.get(person.id);
      if (!embedded) return person;

      try {
        const fileName = `backup-${importId}-${safeName(person.id)}-avatar${extensionFor(embedded.fileName, embedded.mimeType)}`;
        const file = new File(directory, fileName);
        file.create({ overwrite: true, intermediates: true });
        file.write(embedded.base64, { encoding: EncodingType.Base64 });
        return { ...person, avatarUri: file.uri };
      } catch {
        return person;
      }
    })),
    memories: await Promise.all(data.memories.map(async (memory) => ({
      ...memory,
      attachments: await Promise.all(memory.attachments.map(async (attachment) => {
        const embedded = embeddedByKey.get(`${memory.id}:${attachment.id}`);
        if (!embedded) return attachment;

        try {
          const fileName = `backup-${importId}-${safeName(memory.id)}-${safeName(attachment.id)}${extensionFor(embedded.fileName, embedded.mimeType)}`;
          const file = new File(directory, fileName);
          file.create({ overwrite: true, intermediates: true });
          file.write(embedded.base64, { encoding: EncodingType.Base64 });
          return {
            ...attachment,
            uri: file.uri,
            fileName: embedded.fileName ?? attachment.fileName,
            mimeType: embedded.mimeType ?? attachment.mimeType,
            width: embedded.width ?? attachment.width,
            height: embedded.height ?? attachment.height,
          };
        } catch {
          return attachment;
        }
      })),
      voiceNotes: await Promise.all((memory.voiceNotes ?? []).map(async (voice) => {
        const embedded = voicesByKey.get(`${memory.id}:${voice.id}`);
        if (!embedded) return voice;

        try {
          const fileName = `backup-${importId}-${safeName(memory.id)}-${safeName(voice.id)}${extensionFor(embedded.fileName, embedded.mimeType)}`;
          const file = new File(directory, fileName);
          file.create({ overwrite: true, intermediates: true });
          file.write(embedded.base64, { encoding: EncodingType.Base64 });
          return {
            ...voice,
            uri: file.uri,
          };
        } catch {
          return voice;
        }
      })),
    }))),
    communityPosts: data.communityPosts,
  };
}
