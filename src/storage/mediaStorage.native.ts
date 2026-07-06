import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';

import { MemoryAttachment } from '@/src/data/mock';

function createAttachmentId(index: number): string {
  return `media-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function extensionFor(asset: ImagePickerAsset): string {
  const fromName = asset.fileName?.match(/\.[a-zA-Z0-9]+$/)?.[0];
  if (fromName) return fromName.toLowerCase();
  if (asset.mimeType === 'image/png') return '.png';
  if (asset.mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

async function persistImageAsset(asset: ImagePickerAsset, id: string): Promise<string> {
  const directory = ensureMediaDirectory();
  const destination = new File(directory, `${id}${extensionFor(asset)}`);

  const source = new File(asset.uri);
  await source.copy(destination, { overwrite: true });
  return destination.uri;
}

function ensureMediaDirectory(): Directory {
  const directory = new Directory(Paths.document, 'media');
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

export async function persistPickedImages(assets: ImagePickerAsset[]): Promise<MemoryAttachment[]> {
  return Promise.all(assets.map(async (asset, index) => {
    const id = createAttachmentId(index);

    try {
      const uri = await persistImageAsset(asset, id);
      return {
        id,
        type: 'image',
        uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      };
    } catch {
      return {
        id,
        type: 'image',
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      };
    }
  }));
}

export async function persistPickedAvatar(asset: ImagePickerAsset): Promise<string> {
  try {
    return await persistImageAsset(asset, `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  } catch {
    return asset.uri;
  }
}

// 把原生端录音的临时文件复制到持久 media 目录，返回持久化 uri。
export async function persistVoiceRecording(sourceUri: string): Promise<string> {
  try {
    const directory = ensureMediaDirectory();
    const id = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const destination = new File(directory, `${id}.m4a`);
    const source = new File(sourceUri);
    await source.copy(destination, { overwrite: true });
    return destination.uri;
  } catch {
    return sourceUri;
  }
}
