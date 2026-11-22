import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/store/storage';
import { applyReminderSchedule, reminderTriggers, type ReminderPort, type ReminderTrigger } from '../src/utils/reminderSchedule';

const settings = defaultState().reminders;

test('提醒的每日、工作日、周末与自定义规则生成实际对应的计划', () => {
  assert.deepEqual(reminderTriggers(settings), [{ hour: settings.hour, minute: settings.minute }]);
  assert.deepEqual(reminderTriggers({ ...settings, repeat: 'weekday' }).map(item => item.weekday), [2, 3, 4, 5, 6]);
  assert.deepEqual(reminderTriggers({ ...settings, repeat: 'weekend' }).map(item => item.weekday), [1, 7]);
  assert.deepEqual(reminderTriggers({ ...settings, repeat: 'custom', days: [6, 0, 6, -1, 8] }).map(item => item.weekday), [1, 7]);
  assert.deepEqual(reminderTriggers({ ...settings, daily: false }), []);
  assert.throws(() => reminderTriggers({ ...settings, repeat: 'custom', days: [] }), /至少选择一天/);
  assert.throws(() => reminderTriggers({ ...settings, hour: 25 }), /时间无效/);
});

test('提醒权限拒绝、系统错误和部分安排失败均不返回成功，关闭时取消计划', async () => {
  const created: ReminderTrigger[] = [];
  const cancelled: string[] = [];
  let granted = false;
  const port: ReminderPort = { list: async () => ['old-reminder'], permission: async () => granted, cancel: async id => { cancelled.push(id); }, schedule: async trigger => { created.push(trigger); return `created-${created.length}`; } };
  assert.equal(await applyReminderSchedule(settings, port), 'denied');
  assert.deepEqual(cancelled, []);
  assert.deepEqual(created, []);
  granted = true;
  assert.equal(await applyReminderSchedule({ ...settings, repeat: 'weekend' }, port), 'ok');
  assert.equal(created.length, 2);
  assert.deepEqual(cancelled, ['old-reminder']);
  created.length = 0;
  cancelled.length = 0;
  let calls = 0;
  assert.equal(await applyReminderSchedule({ ...settings, repeat: 'weekend' }, { ...port, schedule: async () => { if (++calls === 2) throw new Error('system scheduling failed'); return 'partial'; } }), 'error');
  assert.deepEqual(cancelled, ['old-reminder', 'partial']);
  cancelled.length = 0;
  assert.equal(await applyReminderSchedule({ ...settings, daily: false }, { ...port, permission: async () => { throw new Error('should not request permission when disabling'); } }), 'ok');
  assert.deepEqual(cancelled, ['old-reminder']);
});
