export interface DictationCallbacks {
  lang?: string;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

export interface DictationSession {
  start: () => boolean;
  stop: () => void;
}

/* ---------------- Web（浏览器 Web Speech API） ---------------- */

function getSpeechCtor(): (new () => any) | null {
  const g = globalThis as any;
  if (!g || typeof g.window === 'undefined') return null;
  return g.window.SpeechRecognition || g.window.webkitSpeechRecognition || null;
}

/** 运行环境是不是浏览器（不引 react-native 的 Platform，让纯 Node 测试也能跑这份文件） */
function isWebRuntime(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/* ---------------- 原生（expo-speech-recognition） ---------------- */

/**
 * 懒加载原生模块：Expo Go 里没有它，只有开发构建 / EAS 构建才有。
 * 拿到手的是一个代理对象，直接访问属性也包在 try 里。
 */
function getNativeMod(): any | null {
  if (isWebRuntime()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
    return typeof mod?.start === 'function' ? mod : null;
  } catch {
    return null;
  }
}

/** 当前运行环境是否支持语音听写（Web 走浏览器 API，原生需要构建内包含该模块） */
export function isDictationSupported(): boolean {
  if (isWebRuntime()) return getSpeechCtor() !== null;
  return getNativeMod() !== null;
}

/* ---------------- Web 实现 ---------------- */

function createWebSession(cb: DictationCallbacks): DictationSession {
  const Ctor = getSpeechCtor();
  let rec: any = null;
  let active = false;

  return {
    start() {
      if (!Ctor) {
        cb.onError?.('当前浏览器不支持语音听写');
        return false;
      }
      try {
        rec = new Ctor();
        rec.lang = cb.lang ?? 'zh-CN';
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (event: any) => {
          let interim = '';
          let finalText = '';
          const results = event?.results;
          const startIdx = typeof event?.resultIndex === 'number' ? event.resultIndex : 0;
          if (results) {
            for (let i = startIdx; i < results.length; i++) {
              const r = results[i];
              const transcript = r?.[0]?.transcript ?? '';
              if (r?.isFinal) finalText += transcript;
              else interim += transcript;
            }
          }
          cb.onInterim?.(interim);
          if (finalText) cb.onFinal?.(finalText);
        };

        rec.onerror = (event: any) => {
          const code = event?.error;
          const msg =
            code === 'not-allowed'
              ? '麦克风权限被拒绝，请在浏览器设置中允许'
              : code === 'no-speech'
                ? '未检测到语音输入'
                : '语音识别中断，请重试';
          cb.onError?.(msg);
        };

        rec.onend = () => {
          active = false;
          cb.onInterim?.('');
          cb.onEnd?.();
        };

        active = true;
        rec.start();
        return true;
      } catch {
        active = false;
        cb.onError?.('无法启动语音听写');
        return false;
      }
    },
    stop() {
      if (!rec) return;
      try {
        if (active) rec.stop();
      } catch {}
      active = false;
      rec = null;
    },
  };
}

/* ---------------- 原生实现（iOS SFSpeechRecognizer / Android SpeechRecognizer） ---------------- */

function createNativeSession(cb: DictationCallbacks): DictationSession {
  const mod = getNativeMod();
  const subs: { remove: () => void }[] = [];
  let active = false; // 用户还想继续听写
  let running = false; // 原生识别器当前在跑

  const cleanup = () => {
    while (subs.length) {
      try {
        subs.pop()?.remove();
      } catch {}
    }
    running = false;
  };

  const doStart = () => {
    try {
      mod.start({
        lang: cb.lang ?? 'zh-CN',
        interimResults: true,
        // 让“说完自动上屏”的体验不断线；iOS 17-/旧 Android 会自动停，
        // 由 end 事件兜底重开一轮
        continuous: true,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false,
      });
      running = true;
      return true;
    } catch {
      return false;
    }
  };

  return {
    start() {
      if (!mod) {
        cb.onError?.('当前环境不支持语音听写');
        return false;
      }
      active = true;
      subs.push(
        mod.addListener('result', (ev: any) => {
          const t = ev?.results?.[0]?.transcript ?? '';
          if (ev?.isFinal) {
            cb.onInterim?.('');
            if (t.trim()) cb.onFinal?.(t);
          } else {
            cb.onInterim?.(t);
          }
        }),
        mod.addListener('error', (ev: any) => {
          const code = ev?.error;
          // 没检测到说话不算错误，end 事件会接着来处理
          if (code === 'no-speech') return;
          active = false;
          const msg =
            code === 'not-allowed'
              ? '麦克风或语音识别权限被拒绝'
              : code === 'service-not-allowed' || code === 'language-not-supported'
                ? '这台设备暂不支持中文语音听写'
                : code === 'network'
                  ? '当前网络不可用，语音听写需要联网'
                  : '语音识别中断，请重试';
          cb.onError?.(msg);
        }),
        mod.addListener('end', () => {
          running = false;
          // 用户没有点停止就自然结束了（iOS 17- 静默超时 / 旧 Android 不支持连续）：
          // 还想要听写就接着再开一轮
          if (active && doStart()) return;
          active = false;
          cleanup();
          cb.onInterim?.('');
          cb.onEnd?.();
        }),
      );
      // 权限是异步的：先挂上监听再请求，拒绝时通过回调告知
      void (async () => {
        try {
          const perm = await mod.requestPermissionsAsync();
          if (!perm?.granted) {
            active = false;
            cb.onError?.('需要麦克风与语音识别权限才能听写');
            cb.onEnd?.();
            cleanup();
            return;
          }
          if (!active) return;
          if (!doStart()) {
            active = false;
            cb.onError?.('这台设备暂不支持语音听写');
            cb.onEnd?.();
            cleanup();
          }
        } catch {
          active = false;
          cb.onError?.('无法启动语音听写');
          cb.onEnd?.();
          cleanup();
        }
      })();
      return true;
    },
    stop() {
      active = false;
      try {
        mod?.stop();
      } catch {}
      // stop() 会带出最终 result 和 end 事件，由它们收尾；
      // 万一识别器已经停了，这里直接结束，避免卡界面
      if (!running) {
        cleanup();
        cb.onEnd?.();
      }
    },
  };
}

/** 创建连续中文语音听写会话：原生走系统识别，Web 走浏览器 API */
export function createDictationSession(cb: DictationCallbacks): DictationSession {
  return isWebRuntime() ? createWebSession(cb) : createNativeSession(cb);
}
