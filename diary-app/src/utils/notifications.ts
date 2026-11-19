import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { ReminderSettings } from '../store/types';

const ANDROID_CHANNEL_ID = 'daily-reminder';

/**
 * Android 8+ 的通知必须归属到一个通知渠道。
 * 「重要提醒」开 → HIGH 渠道（能出声、能出现在屏上）；关 → DEFAULT 渠道（静默折叠进通知栏）。
 * 两个渠道分开建，这样用户改设置时不会把系统里已有的渠道级别改掉。
 */
async function ensureAndroidChannels(rem: ReminderSettings): Promise<string> {
  const important = rem.important !== false;
  const channelId = important ? `${ANDROID_CHANNEL_ID}-high` : `${ANDROID_CHANNEL_ID}-default`;
  await Notifications.setNotificationChannelAsync(channelId, {
    name: '每日日记提醒',
    importance: important ? Notifications.AndroidImportance.HIGH : Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: important ? [0, 250, 250, 250] : undefined,
    sound: rem.method === 'notify_sound' && important ? 'default' : undefined,
  });
  return channelId;
}

/** 同步本地每日提醒通知计划 */
export async function rescheduleDailyReminder(rem: ReminderSettings): Promise<'ok' | 'denied' | 'web'> {
  if (Platform.OS === 'web') return 'web';
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!rem.daily) return 'ok';
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    const channelId = Platform.OS === 'android' ? await ensureAndroidChannels(rem) : undefined;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '记得日记',
        body: rem.text || '该写日记啦 ✨ 记录今天的生活，想法与心情',
        sound: rem.method === 'notify_sound',
        ...(channelId ? { channelId } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: rem.hour,
        minute: rem.minute,
        ...(channelId ? { channelId } : {}),
      },
    });
    return 'ok';
  } catch {
    return 'ok';
  }
}
