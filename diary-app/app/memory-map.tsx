import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { useStore } from '../src/store/store';
import type { Entry } from '../src/store/types';
import { EmptyState, NavBar, Row, Screen } from '../src/components/ui';
import { EntryListCard } from '../src/components/EntryCard';
import { FadeIn } from '../src/components/motion';
import { moodMeta } from '../src/data/constants';
import { fmtMonthDay } from '../src/utils/date';
import { IMAGES } from '../src/data/assets';

interface PlaceGroup {
  name: string;
  entries: Entry[];
  count: number;
  latest: number;
  lat?: number;
  lng?: number;
}

/** 按地点名分组；坐标取组内已有定位的平均值（同一地点的几次记录坐标会有轻微差异） */
function groupByPlace(entries: Entry[]): PlaceGroup[] {
  const map = new Map<string, PlaceGroup>();
  for (const e of entries) {
    const name = e.place?.name?.trim();
    if (!name || e.deletedAt || e.hidden || e.status !== 'published') continue;
    let g = map.get(name);
    if (!g) {
      g = { name, entries: [], count: 0, latest: 0 };
      map.set(name, g);
    }
    g.entries.push(e);
    g.count += 1;
    g.latest = Math.max(g.latest, e.createdAt);
    if (e.place?.latitude != null && e.place?.longitude != null) {
      const n = g.entries.filter(x => x.place?.latitude != null).length;
      g.lat = ((g.lat ?? 0) * (n - 1) + e.place.latitude) / n;
      g.lng = ((g.lng ?? 0) * (n - 1) + e.place.longitude) / n;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.latest - a.latest);
}

const MAP_H = 250;
const PAD = 26;

/** 足迹散布图：把经纬度线性投影到卡片内（日记地点通常集中在几座城市，不需要真实底图） */
function FootprintMap({ groups, selected, onSelect }: { groups: PlaceGroup[]; selected: string | null; onSelect: (name: string) => void }) {
  const { c, dark, fs } = useTheme();
  const { width } = useWindowDimensions();
  const W = Math.min(width - 40, 640);
  const plotted = groups.filter(g => g.lat != null && g.lng != null);

  interface Cluster { key: string; x: number; y: number; r: number; count: number; label: string; main: string }
  // 同一城市里的几个区在投影上会挤成一团：按像素距离把相邻点聚成一个簇
  const pts = useMemo<Cluster[]>(() => {
    if (!plotted.length) return [];
    const lats = plotted.map(g => g.lat!);
    const lngs = plotted.map(g => g.lng!);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latSpan = Math.max(maxLat - minLat, 0.5);
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos(midLat * Math.PI / 180);
    const lngSpan = Math.max(maxLng - minLng, 0.5) * cosLat;
    const scale = Math.min((W - PAD * 2) / lngSpan, (MAP_H - PAD * 2) / latSpan);
    const midLng = (minLng + maxLng) / 2;

    const projected = plotted.map(g => ({
      g,
      x: W / 2 + (g.lng! - midLng) * cosLat * scale,
      y: MAP_H / 2 - (g.lat! - midLat) * scale,
    }));
    projected.sort((a, b) => b.g.count - a.g.count);

    const clusters: (Cluster & { members: string[] })[] = [];
    for (const p of projected) {
      const near = clusters.find(cl => Math.hypot(cl.x - p.x, cl.y - p.y) < 30);
      if (near) {
        near.count += p.g.count;
        near.members.push(p.g.name);
        // 簇的位置向篇数更多的一方微移
        near.x = (near.x + p.x) / 2;
        near.y = (near.y + p.y) / 2;
      } else {
        clusters.push({ key: p.g.name, x: p.x, y: p.y, r: 0, count: p.g.count, label: labelPart(p.g.name), main: p.g.name, members: [p.g.name] });
      }
    }
    return clusters.map(cl => ({ ...cl, r: Math.min(17, 6.5 + cl.count * 1.5) }));
  }, [plotted, W]);

  // 「杭州市 · 西湖区」→ 取最后一段「西湖区」做标签，同一座城市各区不会都叫「杭州市」
  function labelPart(name: string) {
    const parts = name.split('·').map(x => x.trim()).filter(Boolean);
    return (parts[parts.length - 1] || name).slice(0, 6);
  }

  const labelFor = (name: string) => name.split('·')[0].trim().slice(0, 6);

  return (
    <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: dark ? c.cardAlt : '#E9E4DA', borderWidth: dark ? 0 : StyleSheet.hairlineWidth, borderColor: c.divider }}>
      <Svg width={W} height={MAP_H}>
        {/* 网格底纹：不画真实地图轮廓，用浅色经纬线让坐标关系可读 */}
        {Array.from({ length: 7 }, (_, i) => (
          <Line key={`v${i}`} x1={(W / 8) * (i + 1)} y1={0} x2={(W / 8) * (i + 1)} y2={MAP_H} stroke={dark ? '#39332C' : '#DDD5C8'} strokeWidth={0.6} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={(MAP_H / 6) * (i + 1)} x2={W} y2={(MAP_H / 6) * (i + 1)} stroke={dark ? '#39332C' : '#DDD5C8'} strokeWidth={0.6} />
        ))}
        {pts.map(cl => {
          const on = selected === cl.main;
          const g = groups.find(x => x.name === cl.main);
          const latest = g?.entries.find(e => e.createdAt === g.latest);
          const moodColor = moodMeta(latest?.mood)?.color ?? c.primary;
          return (
            <React.Fragment key={cl.key}>
              {on && <Circle cx={cl.x} cy={cl.y} r={cl.r + 6} fill="none" stroke={c.primary} strokeWidth={1.5} />}
              <Circle
                cx={cl.x} cy={cl.y} r={cl.r}
                fill={moodColor}
                fillOpacity={on ? 0.95 : 0.78}
                stroke={c.card}
                strokeWidth={1.5}
              />
              {(on || cl.count >= 2) && (
                <SvgText
                  x={cl.x} y={cl.y + cl.r + 13}
                  fontSize={fs(10.5)}
                  fill={on ? c.primaryDark : c.textSub}
                  fontWeight={on ? '600' : '400'}
                  textAnchor="middle"
                >
                  {cl.label} ×{cl.count}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
      {/* 覆盖点击区：SVG onPress 在部分 Android 版本不触发，补一层 */}
      {pts.map(cl => (
        <Pressable
          key={`hit-${cl.key}`}
          onPress={() => onSelect(cl.main)}
          accessibilityLabel={`${cl.label}，${cl.count} 篇`}
          style={{ position: 'absolute', left: cl.x - cl.r - 8, top: cl.y - cl.r - 8, width: (cl.r + 8) * 2, height: (cl.r + 8) * 2 }}
        />
      ))}
    </View>
  );
}

/** 足迹地图：按地点回看日记（1:1 复刻不了地图服务商，就把“去过哪”画成一张温柔的散点图） */
export default function MemoryMapScreen() {
  const { c, fs } = useTheme();
  const entries = useStore(s => s.entries);
  const [selected, setSelected] = useState<string | null>(null);

  const groups = useMemo(() => groupByPlace(entries), [entries]);
  const plottedCount = groups.filter(g => g.lat != null).length;
  const current = groups.find(g => g.name === selected) ?? null;
  const shown = useMemo(
    () => (current ? [...current.entries].sort((a, b) => b.createdAt - a.createdAt) : []),
    [current],
  );

  const toggle = (name: string) => {
    setSelected(cur => (cur === name ? null : name));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar
        title="足迹地图"
        subtitle={groups.length ? `${groups.length} 处地点 · ${plottedCount} 处已定位` : undefined}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 36 }}>
        {groups.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingTop: 80 }}>
            <EmptyState
              image={IMAGES.emptyBook}
              imageSize={170}
              title="还没有足迹"
              desc="写日记时添加「地点天气」，去过的地方会在这里聚成你的足迹地图。"
              action="去写日记"
              onAction={() => router.push('/write')}
            />
          </View>
        ) : (
          <>
            <FadeIn duration={380}>
              <FootprintMap groups={groups} selected={selected} onSelect={toggle} />
            </FadeIn>
            <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 8, marginLeft: 4 }}>
              每个圆点是一处去过的地方，越大代表在那里写得越多{plottedCount < groups.length ? '；没有定位的地点列在下方' : ''}
            </Text>

            <View style={{ marginTop: 16, backgroundColor: c.card, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
              {groups.map((g, i) => {
                const on = selected === g.name;
                return (
                  <Row
                    key={g.name}
                    icon={MapPin}
                    iconColor={g.lat != null ? c.primaryDark : c.textMuted}
                    title={g.name}
                    subtitle={g.lat == null ? '未定位' : undefined}
                    value={`${g.count} 篇 · ${fmtMonthDay(g.latest)}`}
                    chevron={false}
                    onPress={() => toggle(g.name)}
                    style={{ backgroundColor: on ? c.primaryFaint : 'transparent', borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider }}
                  />
                );
              })}
            </View>

            {current && (
              <FadeIn dy={8} duration={260}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 }}>
                  <Text style={{ fontSize: fs(14), color: c.text, fontWeight: '600' }}>「{current.name}」的 {shown.length} 篇日记</Text>
                  <Pressable hitSlop={8} onPress={() => setSelected(null)}>
                    <Text style={{ fontSize: fs(12.5), color: c.textMuted }}>收起</Text>
                  </Pressable>
                </View>
                {shown.map(e => (
                  <EntryListCard key={e.id} entry={e} compactDate onPress={() => router.push({ pathname: '/memory/[id]', params: { id: e.id } })} />
                ))}
              </FadeIn>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
