import type { ImageSourcePropType } from 'react-native';
import type { MoodKey, PaperKey, WeatherKey } from '../store/types';
import type { StyleKey } from '../theme/palette';

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

/** 每种主题风格一套插画包：onboarding、封面与场景插画全部跟随风格切换 */
export interface IllustrationPack {
  onboardWrite: ImageSourcePropType;
  onboardMemory: ImageSourcePropType;
  cover: ImageSourcePropType;
  emptyBook: ImageSourcePropType;
  emptySearch: ImageSourcePropType;
  savedSuccess: ImageSourcePropType;
  privacyLock: ImageSourcePropType;
  cloudSync: ImageSourcePropType;
  memorySticker: ImageSourcePropType;
  /** 墨色/灰洗笔触在深色底上会消失，需要一块「贴上去的浅色底托」 */
  darkPlate: boolean;
}
export type IllustrationName = Exclude<keyof IllustrationPack, 'darkPlate'>;

const pack = (p: Omit<IllustrationPack, 'darkPlate'>, darkPlate = false): IllustrationPack => ({ ...p, darkPlate });

export const ILLUSTRATION_PACKS: Record<StyleKey, IllustrationPack> = {
  companion: pack({
    onboardWrite: require('../../assets/ink-companion/illustrations/onboard-write.jpg'),
    onboardMemory: require('../../assets/ink-companion/illustrations/onboard-memory.jpg'),
    cover: require('../../assets/ink-companion/illustrations/profile-cover.jpg'),
    emptyBook: require('../../assets/ink-companion/illustrations/empty-book.png'),
    emptySearch: require('../../assets/ink-companion/illustrations/empty-search.png'),
    savedSuccess: require('../../assets/ink-companion/illustrations/saved-success.png'),
    privacyLock: require('../../assets/ink-companion/illustrations/privacy-lock.png'),
    cloudSync: require('../../assets/ink-companion/illustrations/cloud-sync.png'),
    memorySticker: require('../../assets/ink-companion/illustrations/memory-sticker.png'),
  }, true),
  editorial: pack({
    onboardWrite: require('../../assets/packs/editorial/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/editorial/onboard-memory.jpg'),
    cover: require('../../assets/packs/editorial/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/editorial/empty-book.png'),
    emptySearch: require('../../assets/packs/editorial/empty-search.png'),
    savedSuccess: require('../../assets/packs/editorial/saved-success.png'),
    privacyLock: require('../../assets/packs/editorial/privacy-lock.png'),
    cloudSync: require('../../assets/packs/editorial/cloud-sync.png'),
    memorySticker: require('../../assets/packs/editorial/memory-sticker.png'),
  }),
  warm: pack({
    onboardWrite: require('../../assets/packs/warm/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/warm/onboard-memory.jpg'),
    cover: require('../../assets/packs/warm/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/warm/empty-book.png'),
    emptySearch: require('../../assets/packs/warm/empty-search.png'),
    savedSuccess: require('../../assets/packs/warm/saved-success.png'),
    privacyLock: require('../../assets/packs/warm/privacy-lock.png'),
    cloudSync: require('../../assets/packs/warm/cloud-sync.png'),
    memorySticker: require('../../assets/packs/warm/memory-sticker.png'),
  }),
  cool: pack({
    onboardWrite: require('../../assets/packs/cool/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/cool/onboard-memory.jpg'),
    cover: require('../../assets/packs/cool/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/cool/empty-book.png'),
    emptySearch: require('../../assets/packs/cool/empty-search.png'),
    savedSuccess: require('../../assets/packs/cool/saved-success.png'),
    privacyLock: require('../../assets/packs/cool/privacy-lock.png'),
    cloudSync: require('../../assets/packs/cool/cloud-sync.png'),
    memorySticker: require('../../assets/packs/cool/memory-sticker.png'),
  }),
  ink: pack({
    onboardWrite: require('../../assets/packs/ink/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/ink/onboard-memory.jpg'),
    cover: require('../../assets/packs/ink/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/ink/empty-book.png'),
    emptySearch: require('../../assets/packs/ink/empty-search.png'),
    savedSuccess: require('../../assets/packs/ink/saved-success.png'),
    privacyLock: require('../../assets/packs/ink/privacy-lock.png'),
    cloudSync: require('../../assets/packs/ink/cloud-sync.png'),
    memorySticker: require('../../assets/packs/ink/memory-sticker.png'),
  }, true),
  forest: pack({
    onboardWrite: require('../../assets/packs/forest/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/forest/onboard-memory.jpg'),
    cover: require('../../assets/packs/forest/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/forest/empty-book.png'),
    emptySearch: require('../../assets/packs/forest/empty-search.png'),
    savedSuccess: require('../../assets/packs/forest/saved-success.png'),
    privacyLock: require('../../assets/packs/forest/privacy-lock.png'),
    cloudSync: require('../../assets/packs/forest/cloud-sync.png'),
    memorySticker: require('../../assets/packs/forest/memory-sticker.png'),
  }),
  sakura: pack({
    onboardWrite: require('../../assets/packs/sakura/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/sakura/onboard-memory.jpg'),
    cover: require('../../assets/packs/sakura/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/sakura/empty-book.png'),
    emptySearch: require('../../assets/packs/sakura/empty-search.png'),
    savedSuccess: require('../../assets/packs/sakura/saved-success.png'),
    privacyLock: require('../../assets/packs/sakura/privacy-lock.png'),
    cloudSync: require('../../assets/packs/sakura/cloud-sync.png'),
    memorySticker: require('../../assets/packs/sakura/memory-sticker.png'),
  }),
  kraft: pack({
    onboardWrite: require('../../assets/packs/kraft/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/kraft/onboard-memory.jpg'),
    cover: require('../../assets/packs/kraft/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/kraft/empty-book.png'),
    emptySearch: require('../../assets/packs/kraft/empty-search.png'),
    savedSuccess: require('../../assets/packs/kraft/saved-success.png'),
    privacyLock: require('../../assets/packs/kraft/privacy-lock.png'),
    cloudSync: require('../../assets/packs/kraft/cloud-sync.png'),
    memorySticker: require('../../assets/packs/kraft/memory-sticker.png'),
  }, true),
  vivid: pack({
    onboardWrite: require('../../assets/packs/vivid/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/vivid/onboard-memory.jpg'),
    cover: require('../../assets/packs/vivid/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/vivid/empty-book.png'),
    emptySearch: require('../../assets/packs/vivid/empty-search.png'),
    savedSuccess: require('../../assets/packs/vivid/saved-success.png'),
    privacyLock: require('../../assets/packs/vivid/privacy-lock.png'),
    cloudSync: require('../../assets/packs/vivid/cloud-sync.png'),
    memorySticker: require('../../assets/packs/vivid/memory-sticker.png'),
  }),
  midnight: pack({
    onboardWrite: require('../../assets/packs/midnight/onboard-write.jpg'),
    onboardMemory: require('../../assets/packs/midnight/onboard-memory.jpg'),
    cover: require('../../assets/packs/midnight/profile-cover.jpg'),
    emptyBook: require('../../assets/packs/midnight/empty-book.png'),
    emptySearch: require('../../assets/packs/midnight/empty-search.png'),
    savedSuccess: require('../../assets/packs/midnight/saved-success.png'),
    privacyLock: require('../../assets/packs/midnight/privacy-lock.png'),
    cloudSync: require('../../assets/packs/midnight/cloud-sync.png'),
    memorySticker: require('../../assets/packs/midnight/memory-sticker.png'),
  }),
};

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
  strike: require('../../assets/ink-companion/editor/strike.png'),
  highlight: require('../../assets/ink-companion/editor/highlight.png'),
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
  excited: require('../../assets/ink-companion/moods/excited.png'),
  angry: require('../../assets/ink-companion/moods/angry.png'),
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
  windy: require('../../assets/ink-companion/weather/windy.png'),
  clearNight: require('../../assets/ink-companion/weather/clear-night.png'),
};

/** 信纸全图（720×1080）与选择器缩略图（120×180） */
export const PAPER_IMAGES: Record<PaperKey, ImageSourcePropType> = {
  'paper-white': require('../../assets/papers/paper-white.jpg'),
  'mist-blue': require('../../assets/papers/mist-blue.jpg'),
  'mint-leaves': require('../../assets/papers/mint-leaves.jpg'),
  'lilac-air': require('../../assets/papers/lilac-air.jpg'),
  'night-sky': require('../../assets/papers/night-sky.jpg'),
  ocean: require('../../assets/papers/ocean.jpg'),
  forest: require('../../assets/papers/forest.jpg'),
  ink: require('../../assets/papers/ink.jpg'),
  scrapbook: require('../../assets/papers/scrapbook.jpg'),
  geometric: require('../../assets/papers/geometric.jpg'),
};
export const PAPER_THUMBS: Record<PaperKey, ImageSourcePropType> = {
  'paper-white': require('../../assets/papers/thumb/paper-white.jpg'),
  'mist-blue': require('../../assets/papers/thumb/mist-blue.jpg'),
  'mint-leaves': require('../../assets/papers/thumb/mint-leaves.jpg'),
  'lilac-air': require('../../assets/papers/thumb/lilac-air.jpg'),
  'night-sky': require('../../assets/papers/thumb/night-sky.jpg'),
  ocean: require('../../assets/papers/thumb/ocean.jpg'),
  forest: require('../../assets/papers/thumb/forest.jpg'),
  ink: require('../../assets/papers/thumb/ink.jpg'),
  scrapbook: require('../../assets/papers/thumb/scrapbook.jpg'),
  geometric: require('../../assets/papers/thumb/geometric.jpg'),
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
