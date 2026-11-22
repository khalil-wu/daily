import { Platform } from 'react-native';
import { setOtpTicket } from './cloud';

/**
 * Web 端人机验证门：服务端下发 SVG 图形码，答对换一次性 ticket，
 * ticket 随 /cb 发码请求由服务端核销后才转发 CloudBase。
 * 原生端直连 CloudBase 网关，不走此门（也无 HTTP 明文限制问题之外的意义）。
 */

export function captchaGateActive(): boolean {
  return Platform.OS === 'web';
}

export interface CaptchaChallenge {
  id: string;
  svg: string;
}

/** 获取一次图形验证码；服务不可达时抛错（调用方决定是否放行）。 */
export async function fetchCaptcha(): Promise<CaptchaChallenge> {
  const res = await fetch('/api/captcha', { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id || !data?.svg) throw new Error(data?.error || '验证服务暂不可用，请稍后重试');
  return { id: data.id, svg: data.svg };
}

/** 提交图形码答案，成功返回一次性 ticket。 */
export async function solveCaptcha(id: string, answer: string): Promise<string> {
  const res = await fetch('/api/captcha/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ id, answer }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ticket) throw new Error(data?.error || '验证失败，请重试');
  return data.ticket;
}

/** 用 ticket 包裹一次云端操作；ticket 单次有效，用完即清。 */
export async function withOtpTicket<T>(ticket: string, run: () => Promise<T>): Promise<T> {
  setOtpTicket(ticket);
  try {
    return await run();
  } finally {
    setOtpTicket(null);
  }
}
