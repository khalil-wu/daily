import type { ImagePickerAsset } from 'expo-image-picker';

import { MemoryAttachment } from '@/src/data/mock';

function createAttachmentId(index: number): string {
  return `media-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function persistPickedImages(assets: ImagePickerAsset[]): Promise<MemoryAttachment[]> {
  return assets.map((asset, index) => ({
    id: createAttachmentId(index),
    type: 'image',
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  }));
}

export async function persistPickedAvatar(asset: ImagePickerAsset): Promise<string> {
  return asset.uri;
}

export async function persistVoiceRecording(sourceUri: string): Promise<string> {
  return sourceUri;
}
