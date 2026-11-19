import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { LocateFixed, MapPin, Minus, Plus } from 'lucide-react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getEditorDraft, setEditorEnvironment } from '../../src/store/editorSession';
import { WEATHERS } from '../../src/data/constants';
import type { Place, WeatherKey } from '../../src/store/types';
import { Button, NavBar, Screen, SearchBar, goBack, haptic } from '../../src/components/ui';
import { WeatherIcon } from '../../src/components/MoodIcon';
import { useFeedback } from '../../src/components/feedback';

const PRESET_PLACES: Place[] = [
  { name: '杭州市 · 西湖区', detail: '当前位置附近 · 约 200 m' },
  { name: '杭州市 · 西湖风景名胜区', detail: '约 4.2 km' },
  { name: '杭州市 · 灵隐寺', detail: '约 6.8 km' },
  { name: '杭州市 · 拱墅区运河边', detail: '约 5.1 km' },
  { name: '上海市 · 安福路', detail: '咖啡馆与梧桐树荫' },
  { name: '北京市 · 颐和园', detail: '昆明湖畔' },
  { name: '大理市 · 洱海边', detail: '环海西路' },
  { name: '家 · 书桌前', detail: '安静的私人角落' },
];

/** 10. 天气与地点添加页（1:1 复刻设计稿2 #10） */
export default function LocationPickerScreen() {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const existing = getEditorDraft()?.entry;
  const [weather, setWeather] = useState<WeatherKey | undefined>(existing?.weather);
  const [temp, setTemp] = useState<number>(existing?.temperature ?? 12);
  const [place, setPlace] = useState<Place | undefined>(existing?.place);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PRESET_PLACES;
    return PRESET_PLACES.filter(p => p.name.toLowerCase().includes(q) || p.detail?.toLowerCase().includes(q));
  }, [query]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        toast('未获得定位权限，可手动搜索或选择地点', { type: 'info' });
        setLocating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const first = geo[0];
      const city = first?.city || first?.region || '当前城市';
      const district = first?.district || first?.street || first?.name || '当前位置';
      const picked: Place = {
        name: `${city} · ${district}`,
        detail: '当前 GPS 定位',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setPlace(picked);
      toast(`已定位：${picked.name}`);
    } catch {
      setPlace({ name: '杭州市 · 西湖区', detail: '当前位置附近' });
      toast('已自动填充附近地点', { type: 'info' });
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    setEditorEnvironment(weather, weather ? temp : undefined, place);
    goBack();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="添加天气与地点" />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={[t.h3, { fontSize: fs(15) }]}>天气</Text>
          {weather && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => setTemp(v => v - 1)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                <Minus size={13} color={c.text} />
              </Pressable>
              <Text style={{ fontSize: fs(13), color: c.text, fontVariant: ['tabular-nums'], minWidth: 36, textAlign: 'center' }}>{temp}°C</Text>
              <Pressable onPress={() => setTemp(v => v + 1)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                <Plus size={13} color={c.text} />
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 22 }}>
          {WEATHERS.map(w => {
            const on = weather === w.key;
            return (
              <Pressable
                key={w.key}
                onPress={() => {
                  haptic('light');
                  setWeather(cur => (cur === w.key ? undefined : w.key));
                }}
                style={{
                  width: '23%',
                  backgroundColor: on ? c.primaryFaint : c.card,
                  borderRadius: 14,
                  paddingVertical: 12,
                  alignItems: 'center',
                  gap: 6,
                  borderWidth: on ? 1.5 : StyleSheet.hairlineWidth,
                  borderColor: on ? c.primary : c.divider,
                }}
              >
                <WeatherIcon weather={w.key} size={22} />
                <Text style={{ fontSize: fs(12), color: on ? c.primaryDark : c.textSub }}>{w.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={[t.h3, { fontSize: fs(15) }]}>地点</Text>
          <Pressable onPress={() => void locateMe()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <LocateFixed size={14} color={c.primaryDark} />
            <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>{locating ? '定位中…' : '使用当前位置'}</Text>
          </Pressable>
        </View>

        <SearchBar value={query} onChangeText={setQuery} placeholder="搜索或选择地点" style={{ marginBottom: 12 }} />

        {!!query.trim() && (
          <Pressable
            onPress={() => setPlace({ name: query.trim(), detail: '自定义地点' })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.primaryFaint, borderRadius: 14, padding: 14, marginBottom: 10 }}
          >
            <MapPin size={18} color={c.primaryDark} />
            <Text style={{ fontSize: fs(14), color: c.primaryDark, flex: 1 }}>使用自定义地点“{query.trim()}”</Text>
          </Pressable>
        )}

        <View style={{ backgroundColor: c.card, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
          {filtered.map((item, idx) => {
            const on = place?.name === item.name;
            return (
              <Pressable
                key={item.name}
                onPress={() => {
                  haptic('light');
                  setPlace(on ? undefined : item);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 14,
                  borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: c.divider,
                  backgroundColor: on ? c.primaryFaint : 'transparent',
                }}
              >
                <MapPin size={18} color={on ? c.primaryDark : c.textMuted} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs(14.5), color: on ? c.primaryDark : c.text, fontWeight: on ? '600' : '400' }}>{item.name}</Text>
                  {!!item.detail && <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 2 }}>{item.detail}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 8 }}>
        <Button title="确定" onPress={confirm} />
      </View>
    </Screen>
  );
}
