import type { ImageSourcePropType } from 'react-native';
import type { MoodKey, WeatherKey } from '../store/types';

/** 内置场景插画与封面（线绘陪伴风 04-ink-companion 优化版） */
export const IMAGES = {
  splash: require('../../assets/ink-companion/illustrations/profile-cover.jpg'),
  onboardNotebook: require('../../assets/ink-companion/illustrations/onboard-write.jpg'),
  onboardClouds: require('../../assets/ink-companion/illustrations/memory-sticker.png'),
  onboardPolaroid: require('../../assets/ink-companion/illustrations/onboard-memory.jpg'),
  mountainsMist: require('../../assets/ink-companion/illustrations/profile-cover.jpg'),
  meCover: require('../../assets/ink-companion/illustrations/profile-cover.jpg'),
  avatar: require('../../assets/images/avatar.jpg'),
  appIcon: require('../../assets/ink-companion/illustrations/app-icon.png'),
  emptyBook: require('../../assets/ink-companion/illustrations/empty-book.png'),
  emptySearch: require('../../assets/ink-companion/illustrations/empty-search.png'),
  offlineField: require('../../assets/ink-companion/illustrations/cloud-sync.png'),
  syncConflict: require('../../assets/ink-companion/illustrations/cloud-sync.png'),
  savedSuccess: require('../../assets/ink-companion/illustrations/saved-success.png'),
  permission: require('../../assets/ink-companion/illustrations/privacy-lock.png'),
  privacyLock: require('../../assets/ink-companion/illustrations/privacy-lock.png'),
  cloudSync: require('../../assets/ink-companion/illustrations/cloud-sync.png'),
  memorySticker: require('../../assets/ink-companion/illustrations/memory-sticker.png'),
  companionBird: require('../../assets/ink-companion/illustrations/companion-bird.png'),
} as const;

/** 底部导航线绘图标（17-navigation-icons 归一化 96×96） */
export const NAV_ICONS: Record<string, ImageSourcePropType> = {
  index: require('../../assets/ink-companion/nav/diary.png'),
  calendar: require('../../assets/ink-companion/nav/calendar.png'),
  review: require('../../assets/ink-companion/nav/review.png'),
  stats: require('../../assets/ink-companion/nav/stats.png'),
  me: require('../../assets/ink-companion/nav/profile.png'),
};

/** 写作工具栏与常用操作线绘图标（16-editor-icons 归一化 96×96） */
export const EDITOR_ICONS = {
  undo: require('../../assets/ink-companion/editor/undo.png'),
  redo: require('../../assets/ink-companion/editor/redo.png'),
  heading: require('../../assets/ink-companion/editor/heading.png'),
  bold: require('../../assets/ink-companion/editor/bold.png'),
  italic: require('../../assets/ink-companion/editor/italic.png'),
  underline: require('../../assets/ink-companion/editor/underline.png'),
  quote: require('../../assets/ink-companion/editor/quote.png'),
  checklist: require('../../assets/ink-companion/editor/checklist.png'),
  bullets: require('../../assets/ink-companion/editor/bullets.png'),
  numbered: require('../../assets/ink-companion/editor/numbered.png'),
  font: require('../../assets/ink-companion/editor/font.png'),
  photo: require('../../assets/ink-companion/editor/photo.png'),
  video: require('../../assets/ink-companion/editor/video.png'),
  audio: require('../../assets/ink-companion/editor/audio.png'),
  sticker: require('../../assets/ink-companion/editor/sticker.png'),
  write: require('../../assets/ink-companion/editor/write.png'),
  save: require('../../assets/ink-companion/editor/save.png'),
  close: require('../../assets/ink-companion/editor/close.png'),
  palette: require('../../assets/ink-companion/editor/palette.png'),
} as const;

/** 手绘团子情绪图标（11-moods 归一化 128×128） */
export const MOOD_ICONS: Record<MoodKey, ImageSourcePropType> = {
  happy: require('../../assets/ink-companion/moods/happy.png'),
  calm: require('../../assets/ink-companion/moods/calm.png'),
  grateful: require('../../assets/ink-companion/moods/grateful.png'),
  tired: require('../../assets/ink-companion/moods/tired.png'),
  down: require('../../assets/ink-companion/moods/sad.png'),
  anxious: require('../../assets/ink-companion/moods/anxious.png'),
};

/** 天气图标（12-weather 归一化 128×128） */
export const WEATHER_ICONS: Record<WeatherKey, ImageSourcePropType> = {
  sunny: require('../../assets/ink-companion/weather/sunny.png'),
  cloudy: require('../../assets/ink-companion/weather/partly-cloudy.png'),
  overcast: require('../../assets/ink-companion/weather/overcast.png'),
  lightRain: require('../../assets/ink-companion/weather/rainy.png'),
  rain: require('../../assets/ink-companion/weather/rainy.png'),
  heavyRain: require('../../assets/ink-companion/weather/stormy.png'),
  snow: require('../../assets/ink-companion/weather/snowy.png'),
  thunder: require('../../assets/ink-companion/weather/stormy.png'),
};

/** 日记照片可引用的内置素材：asset:<key> */
export const PHOTO_ASSETS: Record<string, ImageSourcePropType> = {
  'photo-mountain': require('../../assets/images/photo-mountain.jpg'),
  'photo-sky': require('../../assets/images/photo-sky.jpg'),
  'photo-blossom': require('../../assets/images/photo-blossom.jpg'),
  'photo-lake': require('../../assets/images/photo-lake.jpg'),
  'photo-road': require('../../assets/images/photo-road.jpg'),
  'photo-mist': require('../../assets/images/photo-mist.jpg'),
  'photo-cloud': require('../../assets/images/photo-cloud.jpg'),
  'photo-daisy': require('../../assets/images/photo-daisy.jpg'),
  'photo-reeds': require('../../assets/images/photo-reeds.jpg'),
  'photo-field': require('../../assets/images/photo-field.jpg'),
  'photo-coffee': require('../../assets/images/photo-coffee.jpg'),
  'photo-flowers': require('../../assets/images/photo-flowers.jpg'),
  'photo-dried': require('../../assets/images/photo-dried.jpg'),
  'photo-tea': require('../../assets/images/photo-tea.jpg'),
  'photo-sunset': require('../../assets/images/photo-sunset.jpg'),
  'photo-street': require('../../assets/images/photo-street.jpg'),
};

/** 模板中心剪纸风封面（13-templates 优化版 320×320） */
export const TEMPLATE_IMAGES: Record<string, ImageSourcePropType> = {
  'template-daily': require('../../assets/ink-companion/templates/daily.jpg'),
  'template-free': require('../../assets/ink-companion/templates/free.jpg'),
  'template-travel': require('../../assets/ink-companion/templates/travel.jpg'),
  'template-reading': require('../../assets/ink-companion/templates/reading.jpg'),
  'template-goal': require('../../assets/ink-companion/templates/goal.jpg'),
  'template-gratitude': require('../../assets/ink-companion/templates/gratitude.jpg'),
  'template-mood': require('../../assets/ink-companion/templates/mood.jpg'),
  'template-work': require('../../assets/ink-companion/templates/work.jpg'),
};

export const PHOTO_ASSET_KEYS = Object.keys(PHOTO_ASSETS);

/** 把日记里的照片字符串解析为 Image source */
export function photoSource(uri?: string): ImageSourcePropType | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('asset:')) return PHOTO_ASSETS[uri.slice(6)] ?? (uri === 'asset:avatar' ? IMAGES.avatar : undefined);
  return { uri };
}
