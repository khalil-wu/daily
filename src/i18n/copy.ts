export function getHomeHeadline(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 23 || hour < 5) return '夜深了，慢慢写。';
  if (hour >= 18) return '这些人，都在你的时间里。';
  return '今天，你想记住谁？';
}

export function getSaveFeedback(opts: { personName?: string; hasImage?: boolean; hasVideo?: boolean; short?: boolean }): string {
  if (opts.personName) return `已经替你记下了，在${opts.personName}的时间线里。`;
  if (opts.hasVideo) return '这一小段时间，替你收好了。';
  if (opts.hasImage) return '这张照片，替你收好了。';
  if (opts.short) return '这一句，记下了。';
  return '已经替你记下了。';
}

export const writingPlaceholders = [
  '这一刻的想法...',
  '分享一点今天的片段。',
  '想说点什么？',
  '写给现在，也写给以后。',
  '照片背后的那句话...',
];

export function pickPlaceholder(): string {
  return writingPlaceholders[Math.floor(Math.random() * writingPlaceholders.length)];
}

export type MoodDef = {
  id: string;
  emoji: string;
  label: string;
  custom?: boolean;
};

// 默认心情集（id 与 label 同值，旧数据存的 label 可直接命中）
export const defaultMoods: MoodDef[] = [
  { id: '平静', emoji: '😌', label: '平静' },
  { id: '开心', emoji: '😊', label: '开心' },
  { id: '想家', emoji: '🥺', label: '想家' },
  { id: '难过', emoji: '😢', label: '难过' },
  { id: '温暖', emoji: '🤗', label: '温暖' },
  { id: '疲惫', emoji: '😮‍💨', label: '疲惫' },
  { id: '感动', emoji: '🥹', label: '感动' },
  { id: '怀念', emoji: '🌸', label: '怀念' },
  { id: '说不清', emoji: '🌀', label: '说不清' },
];

// 兼容旧版 moods 字符串数组的引用（已迁移到 defaultMoods，保留导出避免破坏）
export const moods = defaultMoods.map((m) => m.label);

// 按值（id 或 label）从注册表解析出 {emoji, label}；找不到时回退为纯文字无表情。
export function resolveMood(value: string | null | undefined, registry: MoodDef[]): { emoji: string; label: string } | null {
  if (!value) return null;
  const byId = registry.find((m) => m.id === value);
  if (byId) return { emoji: byId.emoji, label: byId.label };
  const byLabel = registry.find((m) => m.label === value);
  if (byLabel) return { emoji: byLabel.emoji, label: byLabel.label };
  return { emoji: '', label: value };
}

export const emptyStates = {
  home: '先记住一个重要的人吧。',
  timeline: '你的时间还是新的，从今天开始留下点什么吧。',
  calendarMonth: '这个月还很安静。',
  person: (pronoun: string) => `这里还很安静，写下一件关于${pronoun}的小事。`,
};

export function formatEntryDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
