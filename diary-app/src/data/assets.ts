import type { ImageSourcePropType } from 'react-native';

/** 内置图片资源（由 gpt-image 生成 / 摄影素材） */
export const IMAGES = {
  splash: require('../../assets/images/splash.jpg'),
  onboardNotebook: require('../../assets/images/onboard-notebook.jpg'),
  onboardClouds: require('../../assets/images/onboard-clouds.jpg'),
  onboardPolaroid: require('../../assets/images/onboard-polaroid.jpg'),
  mountainsMist: require('../../assets/images/mountains-mist.jpg'),
  meCover: require('../../assets/images/me-cover.jpg'),
  avatar: require('../../assets/images/avatar.jpg'),
  appIcon: require('../../assets/images/app-icon.png'),
  emptyBook: require('../../assets/images/empty-book.jpg'),
  emptySearch: require('../../assets/images/empty-search.jpg'),
  offlineField: require('../../assets/images/offline-field.jpg'),
  syncConflict: require('../../assets/images/sync-conflict.jpg'),
  savedSuccess: require('../../assets/images/saved-success.jpg'),
  permission: require('../../assets/images/permission.jpg'),
} as const;

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

export const TEMPLATE_IMAGES: Record<string, ImageSourcePropType> = {
  'template-daily': require('../../assets/images/template-daily.jpg'),
  'template-free': require('../../assets/images/template-free.jpg'),
  'template-travel': require('../../assets/images/template-travel.jpg'),
  'template-reading': require('../../assets/images/template-reading.jpg'),
  'template-goal': require('../../assets/images/template-goal.jpg'),
  'template-gratitude': require('../../assets/images/template-gratitude.jpg'),
  'template-mood': require('../../assets/images/template-mood.jpg'),
};

export const PHOTO_ASSET_KEYS = Object.keys(PHOTO_ASSETS);

/** 把日记里的照片字符串解析为 Image source */
export function photoSource(uri?: string): ImageSourcePropType | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('asset:')) return PHOTO_ASSETS[uri.slice(6)] ?? (uri === 'asset:avatar' ? IMAGES.avatar : undefined);
  return { uri };
}
