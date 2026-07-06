export type PersonPrivacyMode = 'hidden' | 'masked';

export type PersonSummary = {
  id: string;
  name: string;
  relation: string;
  note: string;
  avatarUri?: string | null;
  memoryCount: number;
  lastDate: string;
  recent: boolean;
  stars: number;
  isPrivate?: boolean;
  privacyMode?: PersonPrivacyMode;
  isMasked?: boolean;
};

export type MemoryAttachment = {
  id: string;
  type: 'image';
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
  mimeType?: string | null;
};

export type MemoryVoiceNote = {
  id: string;
  uri: string;
  durationMs: number;
  createdAt: string;
};

export type MemoryPrivacyMode = 'hidden' | 'masked';

export type MemoryLocation = {
  latitude: number;
  longitude: number;
  label: string;
  accuracy?: number | null;
};

export type MemorySummary = {
  id: string;
  personId: string | null;
  personIds: string[];
  title: string;
  content: string;
  excerpt: string;
  date: string;
  year: string;
  mood: string;
  hasMedia?: boolean;
  attachments: MemoryAttachment[];
  voiceNotes?: MemoryVoiceNote[];
  tags?: string[];
  isPrivate?: boolean;
  privacyMode?: MemoryPrivacyMode;
  location?: MemoryLocation | null;
  isMasked?: boolean;
};

export type CommunityPost = {
  id: string;
  memoryId: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  mood?: string | null;
  attachmentUri?: string | null;
  likes: number;
  comments: number;
  followedByMe?: boolean;
  likedByMe?: boolean;
  repostedByMe?: boolean;
};

export const communityPosts: CommunityPost[] = [];

export const people: PersonSummary[] = [
  { id: 'mom', name: '妈妈', relation: '母亲', note: '她总说自己不累。', memoryCount: 38, lastDate: '7月2日', recent: true, stars: 2 },
  { id: 'dad', name: '爸爸', relation: '父亲', note: '问钱够不够时总装得很随意。', memoryCount: 24, lastDate: '6月20日', recent: false, stars: 1 },
  { id: 'grandma', name: '外婆', relation: '亲人', note: '总怕你饿着。', memoryCount: 18, lastDate: '5月13日', recent: true, stars: 1 },
  { id: 'friend', name: '阿澄', relation: '朋友', note: '总能接住我的沉默。', memoryCount: 12, lastDate: '6月28日', recent: true, stars: 2 },
  { id: 'young-self', name: '小时候的我', relation: '自己', note: '很多画面还在心里亮着。', memoryCount: 16, lastDate: '4月12日', recent: false, stars: 1 },
];

export const memories: MemorySummary[] = [
  { id: 'm1', personId: 'mom', personIds: ['mom'], title: '她打电话说要好好吃饭', content: '她打电话说："一个人在外面，也要把饭吃好。"', excerpt: '她打电话说："一个人在外面，也要把饭吃好。"', date: '7月2日 · 晚上', year: '2026', mood: '想家', attachments: [] },
  { id: 'm2', personId: 'mom', personIds: ['mom'], title: '春节回家她做了一桌菜', content: '回家那天，厨房一直是热的，像她没说出口的想念。', excerpt: '回家那天，厨房一直是热的，像她没说出口的想念。', date: '2月10日 · 下午', year: '2026', mood: '温暖', hasMedia: true, attachments: [] },
  { id: 'm3', personId: 'dad', personIds: ['dad'], title: '他问钱还够不够', content: '电话挂前，爸爸装作顺手地问了一句，钱还够不够。', excerpt: '电话挂前，爸爸装作顺手地问了一句，钱还够不够。', date: '6月20日 · 晚上', year: '2026', mood: '感动', attachments: [] },
  { id: 'm4', personId: 'friend', personIds: ['friend'], title: '她坐着陪我发呆', content: '那天谁都没多说，她只是坐在旁边，像是把时间放慢了。', excerpt: '那天谁都没多说，她只是坐在旁边，像是把时间放慢了。', date: '6月28日 · 傍晚', year: '2026', mood: '平静', attachments: [] },
  { id: 'm5', personId: 'mom', personIds: ['mom'], title: '她问我钱够不够', content: '她问我钱够不够，我说够，其实那天有点撑不住。', excerpt: '她问我钱够不够，我说够，其实那天有点撑不住。', date: '9月3日 · 晚上', year: '2025', mood: '说不清', attachments: [] },
  { id: 'm6', personId: 'grandma', personIds: ['grandma'], title: '外婆的背影', content: '她在厨房忙了一下午，我只拍到了她的背影。', excerpt: '她在厨房忙了一下午，我只拍到了她的背影。', date: '2月9日 · 下午', year: '2024', mood: '怀念', hasMedia: true, attachments: [] },
];
