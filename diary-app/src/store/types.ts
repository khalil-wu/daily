import type { AccentKey, FontFamilyKey, FontScaleKey, LineHeightKey, StyleKey, ThemeMode } from '../theme/tokens';

export type MoodKey = 'happy' | 'calm' | 'tired' | 'down' | 'anxious' | 'grateful' | 'excited' | 'angry';
export type WeatherKey = 'sunny' | 'cloudy' | 'overcast' | 'lightRain' | 'rain' | 'heavyRain' | 'snow' | 'thunder' | 'windy' | 'clearNight';
export type EntryStatus = 'published' | 'draft';

export interface AudioClip {
  id: string;
  uri: string;
  duration: number; // 秒
  createdAt: number;
}

export interface VideoClip {
  id: string;
  /**
   * 视频文件位置。应用自己保存的文件用相对写法（见 services/videoStore）：
   * appdoc:videos/xxx.mp4（原生，文档目录下）或 idb:video/xxx（网页，IndexedDB）
   */
  uri: string;
  duration: number; // 秒
  /** 封面图 uri（取视频中的一帧） */
  poster?: string;
  width?: number;
  height?: number;
  createdAt: number;
}

export interface Place {
  name: string; // 杭州市 · 西湖区
  detail?: string; // 当前位置附近 · 约 200 m
  latitude?: number;
  longitude?: number;
}

/** 身边人与我的关系 */
export type RelationKey = 'family' | 'partner' | 'friend' | 'colleague' | 'other';

/**
 * 身边人：只存在于本机日记里的人物。
 * 标记谁出现在一篇日记里，只是给自己看的索引，对方不会收到任何通知。
 */
export interface Person {
  id: string;
  name: string;
  relation: RelationKey;
  /** 日记里可能出现的其他叫法（「妈」「老妈」） */
  aliases: string[];
  note?: string;
  /** 生日，MM-DD */
  birthday?: string;
  color: string;
  createdAt: number;
}

/** 「记得」（AI）为单篇日记留下的内容 */
export interface EntryAI {
  /** 回信 */
  reply?: { text: string; at: number };
}

export interface Entry {
  id: string;
  title: string;
  body: string; // 轻量富文本：**粗体** *斜体* __下划线__ ，行首 "- " 无序列表，"1. " 有序列表，"# " 小标题
  createdAt: number;
  updatedAt: number;
  mood?: MoodKey;
  tags: string[]; // tag id
  /** 这篇日记里出现的身边人（person id） */
  people: string[];
  ai?: EntryAI;
  photos: string[]; // uri，或 asset:photo-xxx
  audios: AudioClip[];
  videos: VideoClip[];
  weather?: WeatherKey;
  temperature?: number;
  place?: Place;
  favorite: boolean;
  pinned: boolean;
  hidden: boolean;
  status: EntryStatus;
  deletedAt?: number;
  /** 云端永久删除标记；不包含正文，不进入本机日记列表。 */
  purgedAt?: number;
  template?: string;
  /** 所属日记本；为空表示默认日记本 */
  notebookId?: string;
  /** 多图排版方式 */
  photoLayout?: PhotoLayout;
  /** 信纸底纹 */
  paper?: PaperKey;
}

export type PhotoLayout = 'grid' | 'large' | 'carousel';

/** 信纸底纹（15-backgrounds；undefined = 无信纸） */
export type PaperKey = 'paper-white' | 'mist-blue' | 'mint-leaves' | 'lilac-air' | 'night-sky' | 'ocean' | 'forest' | 'ink' | 'scrapbook' | 'geometric';

/** 日记本（分组） */
export interface Notebook {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  /** 书架顺序；旧数据没有该字段，沿用原数组顺序 */
  order?: number;
}

/** 写作目标 */
export interface GoalSettings {
  enabled: boolean;
  dailyWords: number;
}

export interface Tag {
  id: string;
  name: string;
  icon: string; // lucide 图标名映射 key
  builtin?: boolean;
}

export type RepeatRule = 'daily' | 'weekday' | 'weekend' | 'custom';

export interface ReminderSettings {
  daily: boolean;
  hour: number;
  minute: number;
  repeat: RepeatRule;
  days: number[]; // 0=周日 ... 6=周六（custom 时使用）
  text: string;
  important: boolean;
  method: 'notify' | 'notify_sound';
}

export interface PrivacySettings {
  appLock: boolean;
  passcodeHash?: string;
  biometric: boolean;
  lockHidden: boolean;
  encryptBackup: boolean;
  lockDelay: 0 | 60 | 300; // 切到后台多久后锁定（秒）
}

export interface SyncSettings {
  cloud: boolean;
  wifiOnly: boolean;
  syncPhotos: boolean;
  syncTags: boolean;
  syncSettings: boolean;
  lastSyncAt?: number;
  /** 永久删除的 ID 与时间，避免其他设备把旧版本重新同步回来。 */
  deletedEntries?: Record<string, number>;
  /** 已确认上传的逐篇版本，避免其他日记的未来时间影响冲突判断。 */
  entryRevisions?: Record<string, number>;
  /** 完整内容指纹；仅在这一版本的全部附件也被云端确认后记录。 */
  entryHashes?: Record<string, string>;
  mediaCache?: Record<string, string>;
  metadataBaseline?: SyncMetadata;
}

export interface SyncMetadata {
  tags?: Tag[];
  people?: Person[];
  notebooks?: Notebook[];
  appearance?: AppearanceSettings;
  goals?: GoalSettings;
  reminders?: ReminderSettings;
}

export type AccountSpace = Pick<AppState, 'entries' | 'tags' | 'people' | 'notebooks' | 'reviews' | 'profile' | 'sync' | 'conflicts' | 'recentSearches' | 'activeNotebook' | 'backup'>;

export interface BackupSettings {
  auto: boolean;
  lastBackupAt?: number;
  lastBackupPath?: string;
}

/**
 * 「记得」（AI）设置。密钥不在这里：它单独存放在设备的安全存储里（services/aiKey），
 * 因此不会进入备份、导出文件或同步数据。
 */
export interface AISettings {
  enabled: boolean;
  /** 用户同意把日记文字发给所填模型服务的时间；没有同意就不会发出任何请求 */
  consentAt?: number;
  baseUrl: string;
  model: string;
  /** 发布后自动请「记得」回信 */
  autoReply: boolean;
  /** 回信时附带几段相关的旧日记，让「记得」能提起以前写过的事 */
  useMemory: boolean;
}

/** 周 / 月回顾 */
export interface PeriodReview {
  id: string;
  kind: 'week' | 'month';
  from: number;
  to: number;
  createdAt: number;
  entryCount: number;
  summary: string;
  themes: string[];
  moodLine: string;
  /** 从日记原文里摘出的一句话 */
  quote?: { text: string; entryId: string };
  /** 留给下一段时间的一个问题 */
  question: string;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  /** 整体风格：配色基调、圆角与描边 */
  style: StyleKey;
  accent: AccentKey;
  fontScale: FontScaleKey;
  fontFamily: FontFamilyKey;
  lineHeight: LineHeightKey;
  contentWidth: number; // 0 窄 ~ 1 宽
  cardStyle: 'simple' | 'image';
  homeView: 'list' | 'card';
}

export interface Account {
  id: string;
  identifier: string; // 手机号或邮箱
  nickname: string;
  createdAt: number;
  /** true = CloudBase 云端账号；未标记的是本机模拟账号 */
  remote?: boolean;
}

export interface StoredAccount extends Account {
  /** 本机账号的密码散列；云端账号无此字段 */
  passwordHash?: string;
  /** 云端账号在本机的会话快照（storage key → value），切换账号时免密恢复 */
  remoteSession?: Record<string, string>;
}

export interface Profile {
  name: string;
  avatar?: string; // uri / asset:avatar
  signature: string;
  cover?: string;
}

export interface SyncConflict {
  entryId: string;
  localUpdatedAt: number;
  cloudUpdatedAt: number;
  cloudEntry: Entry;
}

export interface AppState {
  /** 非当前账号的数据空间，仅本机保存，不进入备份或云端负载。 */
  accountSpaces?: Record<string, AccountSpace>;
  version: 1;
  onboarded: boolean;
  tutorialSeen?: boolean;
  /** 是否已看过写作页导览 */
  editorTourSeen?: boolean;
  /** 是否已看过书架导览 */
  shelfTourSeen?: boolean;
  /** 是否已经拖动整理过书架（之后不再提示） */
  shelfDragHintSeen?: boolean;
  usageMode: 'local' | 'account' | null;
  entries: Entry[];
  tags: Tag[];
  people: Person[];
  notebooks: Notebook[];
  /** 首页当前查看的日记本；null 表示全部 */
  activeNotebook: string | null;
  goals: GoalSettings;
  account?: Account;
  accounts: StoredAccount[];
  profile: Profile;
  appearance: AppearanceSettings;
  ai: AISettings;
  reviews: PeriodReview[];
  reminders: ReminderSettings;
  privacy: PrivacySettings;
  sync: SyncSettings;
  backup: BackupSettings;
  recentSearches: string[];
  conflicts: SyncConflict[];
  firstUseAt: number;
  permissionsAsked: { photos?: boolean; camera?: boolean; microphone?: boolean; notifications?: boolean; location?: boolean };
}
