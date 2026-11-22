import { resolveVideoUri, storeVideo } from './videoStore';

/** Audio uses the existing binary media store and the same durable URI resolver. */
export const resolveAudioUri = resolveVideoUri;
export async function storeAudio(id: string, uri: string) {
  if (uri.startsWith('mock:')) throw new Error('这段录音没有音频文件，请重新录制');
  const result = await storeVideo(id, uri);
  if (!result.durable) throw new Error('录音保存失败，请检查设备存储空间后重试');
  return result.uri;
}
