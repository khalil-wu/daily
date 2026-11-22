import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ReminderSettings } from '../store/types';
import { applyReminderSchedule, type ReminderResult } from './reminderSchedule';

const ANDROID_CHANNEL_ID = 'daily-reminder';

/**
 * Android 8+ 的通知必须归属到一个通知渠道。
 * 「重要提醒」开 → HIGH 渠道（能出声、能出现在屏上）；关 → DEFAULT 渠道（静默折叠进通知栏）。
 * 两个渠道分开建，这样用户改设置时不会把系统里已有的渠道级别改掉。
 */
async function ensureAndroidChannels(rem: ReminderSettings): Promise<string> {
  const important = rem.important !== false;
  const channelId = `${ANDROID_CHANNEL_ID}-${important ? 'high' : 'default'}-${rem.method === 'notify_sound' ? 'sound' : 'quiet'}`;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: '每日日记提醒',
    importance: important ? Notifications.AndroidImportance.HIGH : Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: important ? [0, 250, 250, 250] : undefined,
    sound: rem.method === 'notify_sound' ? 'default' : null,
  });
  return channelId;
}

/** 同步本地每日提醒通知计划 */
let scheduling: Promise<unknown> = Promise.resolve();
export function rescheduleDailyReminder(rem: ReminderSettings): Promise<ReminderResult> {
  if (Platform.OS === 'web') return Promise.resolve('web');
  const settings = { ...rem, days: [...rem.days] };
  const next = scheduling.catch(() => {}).then(async () => {
    let channelId: string | undefined;
    return applyReminderSchedule(settings, {
      list: async () => (await Notifications.getAllScheduledNotificationsAsync()).filter(request => {
        const trigger = request.trigger;
        return request.content.data?.jideDailyReminder === true || (request.content.title === '记得日记' && trigger && 'type' in trigger && ['daily', 'weekly', 'calendar'].includes(trigger.type));
      }).map(request => request.identifier),
      permission: async () => {
        if (Platform.OS === 'android') channelId = await ensureAndroidChannels(settings);
        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) return false;
        return true;
      },
      cancel: id => Notifications.cancelScheduledNotificationAsync(id),
      schedule: trigger => Notifications.scheduleNotificationAsync({
        content: { title: '记得日记', body: settings.text || '该写日记啦，记录今天的生活、想法与心情', sound: settings.method === 'notify_sound', data: { jideDailyReminder: true } },
        trigger: trigger.weekday === undefined
          ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: trigger.hour, minute: trigger.minute, ...(channelId ? { channelId } : {}) }
          : { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, hour: trigger.hour, minute: trigger.minute, weekday: trigger.weekday, ...(channelId ? { channelId } : {}) },
      }),
    });
  });
  scheduling = next;
  return next;
}
