export const WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

const pad = (n: number) => String(n).padStart(2, '0');

export function startOfDay(t: number | Date): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayKey(t: number | Date): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isSameDay(a: number, b: number) {
  return dayKey(a) === dayKey(b);
}

export function fmtTime(t: number) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 1月26日 */
export function fmtMonthDay(t: number) {
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 2025年1月26日 */
export function fmtFullDate(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 1月26日 · 周日 */
export function fmtMonthDayWeek(t: number) {
  return `${fmtMonthDay(t)} · ${WEEK_CN[new Date(t).getDay()]}`;
}

/** 1月26日 15:24 */
export function fmtMonthDayTime(t: number) {
  return `${fmtMonthDay(t)} ${fmtTime(t)}`;
}

/** 2025-01-26 20:30 */
export function fmtDateTime(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${fmtTime(t)}`;
}

/** 今天 15:24 / 昨天 21:10 / 1月20日 09:12 / 2024年12月3日 */
export function fmtRelative(t: number, now = Date.now()) {
  const today = startOfDay(now);
  const day = startOfDay(t);
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return `今天 ${fmtTime(t)}`;
  if (diff === 1) return `昨天 ${fmtTime(t)}`;
  if (new Date(t).getFullYear() === new Date(now).getFullYear()) return fmtMonthDayTime(t);
  return fmtFullDate(t);
}

/** 刚刚 / 2 分钟前 / 3 小时前 */
export function fmtAgo(t: number, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 30) return '刚刚';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return fmtMonthDayTime(t);
}

export function fmtDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function daysBetween(a: number, b: number) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

export function pad2(n: number) {
  return pad(n);
}

/** 按当前小时给出问候语（首页「今日」卡片用） */
export function greetingFor(hour: number) {
  if (hour >= 5 && hour < 9) return '早上好';
  if (hour >= 9 && hour < 12) return '上午好';
  if (hour >= 12 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  if (hour >= 18 && hour < 23) return '晚上好';
  return '夜深了';
}

/**
 * 把「某一天」与「时:分」合成一个时间戳，并保证不晚于 now（日记不能写在未来）。
 * day 只取年月日，时间部分由 hour / minute 决定。
 */
export function composeDateTime(day: number, hour: number, minute: number, now = Date.now()) {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return Math.min(d.getTime(), now);
}
