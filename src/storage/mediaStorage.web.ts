import type { ImagePickerAsset } from 'expo-image-picker';

import { MemoryAttachment } from '@/src/data/mock';

function createAttachmentId(index: number): string {
  return `media-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

function uriFor(asset: ImagePickerAsset): string {
  if (asset.base64) {
    return `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`;
  }
  return asset.uri;
}

export async function persistPickedImages(assets: ImagePickerAsset[]): Promise<MemoryAttachment[]> {
  return assets.map((asset, index) => ({
    id: createAttachmentId(index),
    type: 'image',
    uri: uriFor(asset),
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  }));
}

export async function persistPickedAvatar(asset: ImagePickerAsset): Promise<string> {
  return uriFor(asset);
}

// Web 端录音已是 data URI 字符串，无需复制，直接返回。
export async function persistVoiceRecording(sourceUri: string): Promise<string> {
  return sourceUri;
}
