import type { MoodKey, Notebook, RelationKey, Tag, WeatherKey } from '../store/types';

/** 身边人的关系分组（顺序即列表里的展示顺序） */
export const RELATIONS: { key: RelationKey; label: string }[] = [
  { key: 'family', label: '家人' },
  { key: 'partner', label: '伴侣' },
  { key: 'friend', label: '朋友' },
  { key: 'colleague', label: '同事' },
  { key: 'other', label: '其他' },
];

export function relationLabel(key?: RelationKey) {
  return RELATIONS.find(r => r.key === key)?.label ?? '其他';
}

/** 身边人头像底色 */
export const PERSON_COLORS = ['#C98B6B', '#7E9BB8', '#8FA98C', '#B58FA8', '#C9A45C', '#7F8FA6', '#A8846E', '#6FA3A0'];

/** 日记本可选配色（莫兰迪色系，与主题色板协调） */
export const NOTEBOOK_COLORS = ['#B79276', '#9CC59A', '#93AFCF', '#E79A93', '#B9A7C9', '#E8A86B', '#8E8A84'];

/** 默认日记本：id 固定为 nb_default，删除其他日记本时日记归入此处 */
export const DEFAULT_NOTEBOOK_ID = 'nb_default';
export const DEFAULT_NOTEBOOKS: Notebook[] = [
  { id: DEFAULT_NOTEBOOK_ID, name: '我的日记', color: '#B79276', createdAt: 0 },
];

export interface MoodMeta {
  key: MoodKey;
  label: string;
  desc: string;
  color: string; // 主色（脸）
  soft: string; // 浅底
  score: number; // 用于情绪趋势 1~5
}

export const MOODS: MoodMeta[] = [
  { key: 'happy', label: '开心', desc: '心情愉悦', color: '#F2C462', soft: '#FCF1D8', score: 5 },
  { key: 'calm', label: '平静', desc: '内心安稳', color: '#9CC59A', soft: '#E6F1E3', score: 4 },
  { key: 'grateful', label: '感恩', desc: '心怀感激', color: '#E79A93', soft: '#FBE5E2', score: 5 },
  { key: 'tired', label: '疲惫', desc: '有些累', color: '#B9A7C9', soft: '#EEE8F3', score: 2 },
  { key: 'down', label: '低落', desc: '情绪低沉', color: '#93AFCF', soft: '#E4ECF5', score: 1 },
  { key: 'anxious', label: '焦虑', desc: '有些不安', color: '#E8A86B', soft: '#FBE9D8', score: 2 },
];

export const MOOD_ORDER: MoodKey[] = ['happy', 'calm', 'tired', 'down', 'anxious', 'grateful'];

export function moodMeta(key?: MoodKey): MoodMeta | undefined {
  return MOODS.find(m => m.key === key);
}

/** 心情徽标/卡片柔和底色：浅色用柔彩，深色用低透明色，避免白字压浅底不可读 */
export function moodTint(mood: MoodMeta | undefined, dark: boolean): string {
  if (!mood) return 'transparent';
  return dark ? `${mood.color}2A` : mood.soft;
}

export interface WeatherMeta {
  key: WeatherKey;
  label: string;
  icon: 'Sun' | 'CloudSun' | 'Cloud' | 'CloudDrizzle' | 'CloudRain' | 'CloudRainWind' | 'Snowflake' | 'CloudLightning';
  color: string;
}

export const WEATHERS: WeatherMeta[] = [
  { key: 'sunny', label: '晴', icon: 'Sun', color: '#F0B44C' },
  { key: 'cloudy', label: '多云', icon: 'CloudSun', color: '#E2A65A' },
  { key: 'overcast', label: '阴', icon: 'Cloud', color: '#A9A39C' },
  { key: 'lightRain', label: '小雨', icon: 'CloudDrizzle', color: '#86ABCB' },
  { key: 'rain', label: '中雨', icon: 'CloudRain', color: '#6F98BE' },
  { key: 'heavyRain', label: '大雨', icon: 'CloudRainWind', color: '#5B86AE' },
  { key: 'snow', label: '雪', icon: 'Snowflake', color: '#8FB7D6' },
  { key: 'thunder', label: '雷阵雨', icon: 'CloudLightning', color: '#C49A5A' },
];

export function weatherMeta(key?: WeatherKey): WeatherMeta | undefined {
  return WEATHERS.find(w => w.key === key);
}

/** 标签可用图标（lucide 名称） */
export const TAG_ICONS = [
  'BookOpen', 'Briefcase', 'Coffee', 'Plane', 'Heart', 'Sprout', 'BookMarked', 'Dumbbell', 'HeartPulse', 'Wallet',
  'Music', 'Camera', 'Star', 'Smile', 'Home', 'Gift', 'Palette', 'Leaf', 'Moon', 'Utensils',
] as const;
export type TagIconName = (typeof TAG_ICONS)[number];

export const DEFAULT_TAGS: Tag[] = [
  { id: 'study', name: '学习', icon: 'BookOpen', builtin: true },
  { id: 'work', name: '工作', icon: 'Briefcase', builtin: true },
  { id: 'life', name: '生活', icon: 'Coffee', builtin: true },
  { id: 'travel', name: '旅行', icon: 'Plane', builtin: true },
  { id: 'emotion', name: '情绪', icon: 'Heart', builtin: true },
  { id: 'growth', name: '成长', icon: 'Sprout', builtin: true },
  { id: 'reading', name: '阅读', icon: 'BookMarked', builtin: true },
  { id: 'sport', name: '运动', icon: 'Dumbbell', builtin: true },
  { id: 'health', name: '健康', icon: 'HeartPulse', builtin: true },
  { id: 'finance', name: '理财', icon: 'Wallet', builtin: true },
];

export interface TemplateMeta {
  id: string;
  name: string;
  desc: string;
  category: 'life' | 'growth' | 'study' | 'work';
  image: string; // asset key
  title: string;
  body: string;
  tags: string[];
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'daily-review', name: '每日复盘', desc: '回顾今日收获，反思与改进', category: 'growth', image: 'template-daily',
    title: '今日复盘',
    body: '# 今天完成了什么\n- \n\n# 有哪些收获\n- \n\n# 可以做得更好的地方\n- \n\n# 明天最重要的三件事\n1. \n2. \n3. ',
    tags: ['growth'],
  },
  {
    id: 'free', name: '自由日记', desc: '随心记录当下的想法与感受', category: 'life', image: 'template-free',
    title: '', body: '', tags: ['life'],
  },
  {
    id: 'travel', name: '旅行记录', desc: '记录旅途中的风景、体验与见闻', category: 'life', image: 'template-travel',
    title: '旅行记录 · ',
    body: '# 目的地\n\n# 路上的风景\n\n# 印象最深的瞬间\n\n# 想对未来的自己说\n',
    tags: ['travel'],
  },
  {
    id: 'reading', name: '阅读笔记', desc: '整理阅读收获、摘录与思考', category: 'study', image: 'template-reading',
    title: '阅读笔记：《》',
    body: '# 书籍信息\n作者：\n\n# 精彩摘录\n- \n\n# 我的思考\n\n# 可以付诸行动的一点\n',
    tags: ['reading', 'study'],
  },
  {
    id: 'goal', name: '目标打卡', desc: '设定目标并记录每天的进展', category: 'work', image: 'template-goal',
    title: '目标打卡 · 第  天',
    body: '# 我的目标\n\n# 今日进展\n- \n\n# 遇到的困难\n\n# 给自己的鼓励\n',
    tags: ['growth', 'work'],
  },
  {
    id: 'gratitude', name: '感恩日记', desc: '写下今天值得感谢的人和事', category: 'life', image: 'template-gratitude',
    title: '今天的三件小确幸',
    body: '1. \n2. \n3. \n\n# 想感谢的人\n\n# 此刻的心情\n',
    tags: ['emotion'],
  },
  {
    id: 'mood', name: '情绪梳理', desc: '觉察情绪，温柔地与自己对话', category: 'growth', image: 'template-mood',
    title: '和情绪聊聊',
    body: '# 此刻的感受\n\n# 是什么引发了它\n\n# 我需要什么\n\n# 我可以为自己做的一件小事\n',
    tags: ['emotion', 'growth'],
  },
];

export const TEMPLATE_CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'life', label: '生活' },
  { key: 'growth', label: '成长' },
  { key: 'study', label: '学习' },
  { key: 'work', label: '工作' },
] as const;

/** 每日写作灵感提示词库（参考 Stoic / 格志日记 / Apple Journal） */
export const DAILY_PROMPTS: { id: string; category: string; title: string; guide: string }[] = [
  { id: 'p1', category: '小确幸', title: '今天发生的最温暖的一件小事是什么？', guide: '不用很宏大，也许是一杯热饮、一句问候或窗外的一缕阳光。' },
  { id: 'p2', category: '情绪觉察', title: '如果把今天的心情比作一种天气，它是什么样的？', guide: '试着描述它为什么而来，又如何慢慢流动。' },
  { id: 'p3', category: '自我对话', title: '最近有哪些事一直在占用你的注意力？', guide: '写下来之后，哪些是可以放下的，哪些值得继续专注？' },
  { id: 'p4', category: '感恩时刻', title: '此刻最想感谢的自己或身边的一个人', guide: '写下对方或你自己做过的一件值得被记住的小事。' },
  { id: 'p5', category: '微小进步', title: '今天有哪些做得比昨天更从容的地方？', guide: '哪怕只是早睡了二十分钟，或者拒绝了一件勉强的事。' },
  { id: 'p6', category: '五感记忆', title: '今天看到、听到或尝到最难忘的一个瞬间', guide: '用具体的细节留住当下的画面、声音与气味。' },
  { id: 'p7', category: '能量来源', title: '最近什么活动让你做完之后觉得身心充电？', guide: '观察能给你带来平静与快乐的日常习惯。' },
  { id: 'p8', category: '给未来', title: '想对一年后的自己说的一句话', guide: '把此刻的期待、困惑或祝福存进时间胶囊。' },
];

/** 列表底部「每日一句」（参考 Diarly 首页名言卡 / 一言），按日轮换 */
export const DAILY_QUOTES: { text: string; from: string }[] = [
  { text: '人生如逆旅，我亦是行人。', from: '苏轼' },
  { text: '此心安处是吾乡。', from: '苏轼' },
  { text: '岁月不饶人，我亦未曾饶过岁月。', from: '木心' },
  { text: '从前的日色变得慢，车、马、邮件都慢，一生只够爱一个人。', from: '木心' },
  { text: '面朝大海，春暖花开。', from: '海子' },
  { text: '黑夜给了我黑色的眼睛，我却用它寻找光明。', from: '顾城' },
  { text: '草在结它的种子，风在摇它的叶子，我们站着，不说话，就十分美好。', from: '顾城' },
  { text: '醒来觉得甚是爱你。', from: '朱生豪' },
  { text: '落霞与孤鹜齐飞，秋水共长天一色。', from: '王勃' },
  { text: '一个人只拥有此生此世是不够的，他还应该拥有诗意的世界。', from: '王小波' },
  { text: '星星发亮是为了让每一个人有一天都能找到属于自己的星星。', from: '《小王子》' },
  { text: '凡是过往，皆为序章。', from: '莎士比亚' },
  { text: '人生碌碌，竞短论长，却不道荣枯有数，得失难量。', from: '沈复' },
  { text: '生活不是你活过的样子，而是你记住的样子。', from: '麦家' },
];

export const APP_VERSION = '1.0.0';
