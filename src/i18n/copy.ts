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

export const moods = ['平静', '开心', '想家', '难过', '温暖', '疲惫', '感动', '怀念', '说不清'];

export const emptyStates = {
  home: '先记住一个重要的人吧。',
  timeline: '你的时间还是新的，从今天开始留下点什么吧。',
  calendarMonth: '这个月还很安静。',
  person: (pronoun: string) => `这里还很安静，写下一件关于${pronoun}的小事。`,
};

export function formatEntryDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
