import type { ReminderSettings } from '../store/types';

export interface ReminderTrigger { hour: number; minute: number; weekday?: number }
export type ReminderResult = 'ok' | 'denied' | 'web' | 'error';

/** App weekdays are 0=Sunday; native weekly triggers use 1=Sunday. */
export function reminderTriggers(rem: ReminderSettings): ReminderTrigger[] {
  if (!rem.daily) return [];
  if (!Number.isInteger(rem.hour) || rem.hour < 0 || rem.hour > 23 || !Number.isInteger(rem.minute) || rem.minute < 0 || rem.minute > 59) throw new Error('提醒时间无效');
  const time = { hour: rem.hour, minute: rem.minute };
  if (rem.repeat === 'daily') return [time];
  const days = rem.repeat === 'weekday' ? [1, 2, 3, 4, 5] : rem.repeat === 'weekend' ? [0, 6] : rem.days;
  const unique = [...new Set(days)].filter(day => Number.isInteger(day) && day >= 0 && day <= 6).sort();
  if (!unique.length) throw new Error('请至少选择一天');
  return unique.map(day => ({ ...time, weekday: day + 1 }));
}

export interface ReminderPort {
  /** Return only this feature's pending reminders. */
  list(): Promise<string[]>;
  permission(): Promise<boolean>;
  cancel(id: string): Promise<void>;
  schedule(trigger: ReminderTrigger): Promise<string>;
}

/** A rejected or partially scheduled plan must never be reported as active. */
export async function applyReminderSchedule(rem: ReminderSettings, port: ReminderPort): Promise<ReminderResult> {
  const created: string[] = [];
  try {
    const plan = reminderTriggers(rem);
    if (plan.length && !await port.permission()) return 'denied';
    for (const id of await port.list()) await port.cancel(id);
    for (const trigger of plan) created.push(await port.schedule(trigger));
    return 'ok';
  } catch {
    await Promise.allSettled(created.map(id => port.cancel(id)));
    return 'error';
  }
}
