import type { AccentKey, FontScaleKey, LineHeightKey, ThemeMode } from '../theme/tokens';

export type MoodKey = 'happy' | 'calm' | 'tired' | 'down' | 'anxious' | 'grateful';
export type WeatherKey = 'sunny' | 'cloudy' | 'overcast' | 'lightRain' | 'rain' | 'heavyRain' | 'snow' | 'thunder';
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

export interface Entry {
  id: string;
  title: string;
  body: string; // 轻量富文本：**粗体** *斜体* __下划线__ ，行首 "- " 无序列表，"1. " 有序列表，"# " 小标题
  createdAt: number;
  updatedAt: number;
  mood?: MoodKey;
  tags: string[]; // tag id
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
  template?: string;
  /** 所属日记本；为空表示默认日记本 */
  notebookId?: string;
  /** 多图排版方式 */
  photoLayout?: PhotoLayout;
}

export type PhotoLayout = 'grid' | 'large' | 'carousel';

/** 日记本（分组） */
export interface Notebook {
  id: string;
  name: string;
  color: string;
  createdAt: number;
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
}

export interface BackupSettings {
  auto: boolean;
  lastBackupAt?: number;
  lastBackupPath?: string;
}

export interface AppearanceSettings {
  theme: ThemeMode;
  accent: AccentKey;
  fontScale: FontScaleKey;
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
}

export interface StoredAccount extends Account {
  passwordHash: string;
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
  version: 1;
  onboarded: boolean;
  tutorialSeen?: boolean;
  /** 是否已看过写作页导览 */
  editorTourSeen?: boolean;
  usageMode: 'local' | 'account' | null;
  entries: Entry[];
  tags: Tag[];
  notebooks: Notebook[];
  /** 首页当前查看的日记本；null 表示全部 */
  activeNotebook: string | null;
  goals: GoalSettings;
  account?: Account;
  accounts: StoredAccount[];
  profile: Profile;
  appearance: AppearanceSettings;
  reminders: ReminderSettings;
  privacy: PrivacySettings;
  sync: SyncSettings;
  backup: BackupSettings;
  recentSearches: string[];
  conflicts: SyncConflict[];
  firstUseAt: number;
  permissionsAsked: { photos?: boolean; camera?: boolean; microphone?: boolean; notifications?: boolean; location?: boolean };
}
