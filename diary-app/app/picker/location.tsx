import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/text';
import * as Location from 'expo-location';
import { Check, LocateFixed, MapPin, Minus, Plus, X } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getEditorDraft, setEditorEnvironment } from '../../src/store/editorSession';
import { WEATHERS } from '../../src/data/constants';
import type { Place, WeatherKey } from '../../src/store/types';
import { useStore } from '../../src/store/store';
import { Button, Card, NavBar, Screen, SearchBar, goBack, haptic } from '../../src/components/ui';
import { WeatherIcon } from '../../src/components/MoodIcon';

/** Weather is optional and manual; location only changes after a real result or explicit selection. */
export default function LocationPickerScreen() {
  const { c, t, fs, r } = useTheme();
  const existing = getEditorDraft()?.entry;
  const entries = useStore(s => s.entries);
  const [weather, setWeather] = useState<WeatherKey | undefined>(existing?.weather);
  const [temp, setTemp] = useState(existing?.temperature ?? 20);
  const [place, setPlace] = useState<Place | undefined>(existing?.place);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const attempt = useRef(0);
  useEffect(() => () => { attempt.current += 1; }, []);

  const places = useMemo(() => {
    const unique = new Map<string, Place>();
    // Hidden/deleted/draft content must not leak through place suggestions.
    for (const entry of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!entry.deletedAt && !entry.hidden && entry.status === 'published' && entry.place?.name && !unique.has(entry.place.name)) {
        unique.set(entry.place.name, entry.place);
      }
    }
    const q = query.trim().toLocaleLowerCase();
    return [...unique.values()].filter(p => !q || p.name.toLocaleLowerCase().includes(q)).slice(0, 20);
  }, [entries, query]);

  const selectPlace = (next?: Place) => {
    attempt.current += 1; // A delayed GPS response must not replace a newer manual choice.
    setLocating(false);
    setLocationMessage('');
    setPlace(next);
  };

  const locateMe = async () => {
    if (locating) return;
    const request = ++attempt.current;
    setLocating(true);
    setLocationMessage('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
        throw new Error('当前地址暂不支持设备定位，请输入地点名称。');
      }
      const result = await Promise.race([
        (async (): Promise<Place> => {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!permission.granted) throw new Error('未获得定位权限。原地点已保留，你也可以手动输入。');
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude, longitude } = position.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('未取得有效位置，请重试或手动输入。');
          let address: Location.LocationGeocodedAddress | undefined;
          // Expo reverse geocoding is native-only. Keep measured coordinates on web.
          if (Platform.OS !== 'web') {
            try { [address] = await Location.reverseGeocodeAsync({ latitude, longitude }); } catch { /* Measured coordinates remain valid. */ }
          }
          const parts = [address?.city || address?.region, address?.district || address?.street || address?.name].filter(Boolean);
          return { name: parts.length ? [...new Set(parts)].join(' · ') : '记录的位置', detail: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude };
        })(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('定位超时，原地点已保留。请重试或手动输入。')), 15000); }),
      ]);
      if (attempt.current !== request) return;
      setPlace(result);
      setLocationMessage(result.name === '记录的位置' ? '已取得坐标。你可以在下方输入更容易辨认的地点名称。' : '已取得当前位置');
      haptic('success');
    } catch (error) {
      if (attempt.current === request) setLocationMessage(error instanceof Error ? error.message : '暂时无法定位，原地点已保留。请手动输入。');
    } finally {
      clearTimeout(timeout);
      if (attempt.current === request) setLocating(false);
    }
  };

  const confirm = () => {
    attempt.current += 1;
    setEditorEnvironment(weather, weather ? temp : undefined, place);
    goBack();
  };

  return (
    <Screen edges={['top', 'bottom']} keyboard>
      <NavBar title="天气与地点" />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 }}>
        <Text style={t.h3}>天气</Text>
        <Text style={[t.sub, { marginTop: 4, marginBottom: 16 }]}>记录当时的天气，也可以留空。</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {WEATHERS.map(w => {
            const on = weather === w.key;
            return <Pressable key={w.key} accessibilityRole="button" accessibilityLabel={w.label} accessibilityState={{ selected: on }} aria-pressed={on} onPress={() => { haptic('light'); setWeather(cur => cur === w.key ? undefined : w.key); }} style={{ width: '23%', minHeight: 72, backgroundColor: on ? c.primaryFaint : c.card, borderRadius: r(12), paddingVertical: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: on ? c.primary : c.divider }}>
              <WeatherIcon weather={w.key} size={22} /><Text style={{ fontSize: fs(13), color: on ? c.primaryDark : c.textSub }}>{w.label}</Text>
              {on && <Check size={12} color={c.primaryDark} style={{ position: 'absolute', right: 5, top: 5 }} />}
            </Pressable>;
          })}
        </View>
        {weather && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Text style={[t.sub, { flex: 1 }]}>手动记录温度</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="降低温度" onPress={() => setTemp(v => Math.max(-80, v - 1))} style={{ padding: 14 }}><Minus size={16} color={c.text} /></Pressable>
          <Text style={{ fontSize: fs(15), color: c.text, fontVariant: ['tabular-nums'] }}>{temp}°C</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="升高温度" onPress={() => setTemp(v => Math.min(60, v + 1))} style={{ padding: 14 }}><Plus size={16} color={c.text} /></Pressable>
        </View>}
        <Text style={[t.h3, { marginTop: 12, marginBottom: 12 }]}>地点</Text>
        <Button variant="secondary" title={locating ? '正在定位…' : '使用当前位置'} icon={LocateFixed} disabled={locating} onPress={() => void locateMe()} />
        {!!locationMessage && <Text accessibilityLiveRegion="polite" style={[t.sub, { marginTop: 10, marginBottom: 4 }]}>{locationMessage}</Text>}
        {!!place && <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MapPin size={20} color={c.primaryDark} /><View style={{ flex: 1 }}><Text style={t.body}>{place.name}</Text><Text style={[t.caption, { marginTop: 3 }]}>{place.detail || '已选择'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="移除地点" onPress={() => selectPlace()} style={{ padding: 12 }}><X size={18} color={c.textSub} /></Pressable>
        </Card>}
        <SearchBar value={query} onChangeText={setQuery} placeholder="输入地点，或查找用过的地点" style={{ marginTop: 16, marginBottom: 12 }} />
        {!!query.trim() && <Pressable accessibilityRole="button" onPress={() => selectPlace({ name: query.trim().slice(0, 120), detail: '手动记录' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.primaryFaint, borderRadius: r(12), padding: 16, marginBottom: 16 }}>
          <Plus size={18} color={c.primaryDark} /><Text style={{ fontSize: fs(14), color: c.primaryDark, flex: 1 }}>使用“{query.trim().slice(0, 120)}”</Text>
        </Pressable>}
        {!!places.length && <><Text style={[t.caption, { marginBottom: 8 }]}>用过的地点</Text><Card padded={false} style={{ overflow: 'hidden' }}>
          {places.map((item, idx) => <Pressable key={item.name} accessibilityRole="button" accessibilityState={{ selected: place?.name === item.name }} onPress={() => selectPlace(item)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopWidth: idx ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider }}>
            <MapPin size={17} color={c.textSub} /><Text style={[t.body, { flex: 1 }]}>{item.name}</Text>{place?.name === item.name && <Check size={17} color={c.primaryDark} />}
          </Pressable>)}
        </Card></>}
        {!places.length && !query && <Text style={[t.sub, { marginTop: 8 }]}>可以写下城市、街道，或“家里的书桌”等对你有意义的地方。</Text>}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 }}><Button title="完成" onPress={confirm} /></View>
    </Screen>
  );
}
