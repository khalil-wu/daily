import { useEffect, useState } from 'react';
import { photoUriNow, resolvePhotoUri } from '../services/photoStore';

/**
 * 日记里记的照片地址 → 现在能显示的地址。
 * 先试同步换算（本次会话里刚存好的），不行再去 IndexedDB / 文档目录里取，
 * 网页端刷新后照片还在，靠的就是后面这一步。
 */
export function usePhotoUri(stored?: string): string | undefined {
  const [uri, setUri] = useState(() => (stored ? photoUriNow(stored) || undefined : undefined));
  useEffect(() => {
    if (!stored) {
      setUri(undefined);
      return;
    }
    const now = photoUriNow(stored);
    if (now) {
      setUri(now);
      return;
    }
    let alive = true;
    void resolvePhotoUri(stored).then(resolved => {
      if (alive) setUri(resolved ?? undefined);
    });
    return () => {
      alive = false;
    };
  }, [stored]);
  return uri;
}
