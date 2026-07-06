import { Platform } from 'react-native';
import * as Location from 'expo-location';

import { formatLocationLabel } from './locationLabel';

// 只取城市与区县级别，隐私克制：不落到街道门牌
export async function resolvePlaceLabel(latitude: number, longitude: number): Promise<string> {
  const fallback = formatLocationLabel(latitude, longitude);
  if (Platform.OS === 'web') return fallback;

  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = results[0];
    if (!place) return fallback;
    const city = place.city ?? place.region ?? '';
    const district = place.district ?? place.subregion ?? '';
    if (city && district && district !== city) return `${city} · ${district}`;
    if (city) return city;
    if (district) return district;
    return fallback;
  } catch {
    return fallback;
  }
}
