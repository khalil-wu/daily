import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/text';
import { router } from 'expo-router';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { useStore } from '../src/store/store';
import { groupByPlace, type PlaceGroup } from '../src/utils/places';
import { EmptyState, NavBar, Row, Screen, TextAction } from '../src/components/ui';
import { EntryListCard } from '../src/components/EntryCard';
import { BottomSheet, FadeIn } from '../src/components/motion';
import { moodMeta } from '../src/data/constants';
import { fmtMonthDay } from '../src/utils/date';
import { IMAGES } from '../src/data/assets';

const MAP_H = 250;
const PAD = 26;

/** 足迹散布图：把经纬度线性投影到卡片内（日记地点通常集中在几座城市，不需要真实底图） */
function FootprintMap({ groups, selected, onSelect }: { groups: PlaceGroup[]; selected: string | null; onSelect: (names: string[]) => void }) {
  const { c, dark, fs, r, fonts } = useTheme();
  const [W, setWidth] = useState(280);
  const plotted = useMemo(() => groups.filter(g => g.lat != null && g.lng != null), [groups]);

  interface Cluster { key: string; x: number; y: number; r: number; count: number; label: string; main: string; members: string[] }
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

    const clusters: Cluster[] = [];
    for (const p of projected) {
      const near = clusters.find(cl => Math.hypot(cl.x - p.x, cl.y - p.y) < 30);
      if (near) {
        // Keep the cluster position weighted by its journal count.
        near.x = (near.x * near.count + p.x * p.g.count) / (near.count + p.g.count);
        near.y = (near.y * near.count + p.y * p.g.count) / (near.count + p.g.count);
        near.count += p.g.count;
        near.members.push(p.g.name);
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

  return (
    <View onLayout={event => setWidth(Math.max(1, event.nativeEvent.layout.width - 2 * (dark ? 0 : StyleSheet.hairlineWidth)))} style={{ borderRadius: r(20), overflow: 'hidden', backgroundColor: c.bgDeep, borderWidth: dark ? 0 : StyleSheet.hairlineWidth, borderColor: c.divider }}>
      <Svg width={W} height={MAP_H}>
        {/* 网格底纹：不画真实地图轮廓，用浅色经纬线让坐标关系可读 */}
        {Array.from({ length: 7 }, (_, i) => (
          <Line key={`v${i}`} x1={(W / 8) * (i + 1)} y1={0} x2={(W / 8) * (i + 1)} y2={MAP_H} stroke={c.divider} strokeWidth={0.6} />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={(MAP_H / 6) * (i + 1)} x2={W} y2={(MAP_H / 6) * (i + 1)} stroke={c.divider} strokeWidth={0.6} />
        ))}
        {pts.map(cl => {
          const on = selected !== null && cl.members.includes(selected);
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
                  x={Math.min(W - 56, Math.max(56, cl.x))} y={Math.min(MAP_H - 10, cl.y + cl.r + 16)}
                  fontSize={fs(12)} fontFamily={fonts.ui}
                  fill={on ? c.primaryDark : c.textSub}
                  fontWeight={on ? '600' : '400'}
                  textAnchor="middle"
                >
                  {cl.members.length > 1 ? `${cl.members.length} 处地点` : cl.label} ×{cl.count}
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
          onPress={() => onSelect(cl.members)}
          accessibilityRole="button" accessibilityLabel={cl.members.length > 1 ? `${cl.members.length} 处相邻地点，共 ${cl.count} 篇日记，选择地点` : `${cl.members[0]}，${cl.count} 篇日记`}
          style={{ position: 'absolute', left: cl.x - Math.max(22, cl.r + 8), top: cl.y - Math.max(22, cl.r + 8), width: Math.max(44, (cl.r + 8) * 2), height: Math.max(44, (cl.r + 8) * 2) }}
        />
      ))}
    </View>
  );
}

/** Coordinates show relative distribution; named places without coordinates stay in the list. */
export default function MemoryMapScreen() {
  const { c, fs, t, r } = useTheme();
  const entries = useStore(s => s.entries);
  const [selected, setSelected] = useState<string | null>(null);
  const [cluster, setCluster] = useState<string[] | null>(null);
  const groups = useMemo(() => groupByPlace(entries), [entries]);
  const located = useMemo(() => groups.filter(group => group.locatedCount > 0), [groups]);
  const named = useMemo(() => groups.filter(group => group.locatedCount === 0), [groups]);
  const current = groups.find(group => group.name === selected) ?? null;
  const clusterGroups = cluster ? groups.filter(group => cluster.includes(group.name)) : [];
  const close = () => { setSelected(null); setCluster(null); };
  const selectCluster = (names: string[]) => {
    if (names.length === 1) { setCluster(null); setSelected(names[0]); }
    else { setCluster(names); setSelected(null); }
  };

  return <Screen edges={['top', 'bottom']}>
    <NavBar title="足迹地图" subtitle={groups.length ? `${groups.length} 处地点 · ${located.length} 处有坐标` : undefined} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 36 }}>
      {groups.length === 0 ? <View style={{ flex: 1, justifyContent: 'center', paddingTop: 80 }}>
        <EmptyState image={IMAGES.emptyBook} imageSize={170} title="还没有足迹" desc="写日记时添加地点，可以在这里按去过的地方回看。" action="去写日记" onAction={() => router.push('/write')} />
      </View> : <>
        {located.length > 0 && <>
          <Text accessibilityRole="header" style={[t.h3, { marginBottom: 10 }]}>地点分布示意</Text>
          <FadeIn duration={280}><FootprintMap groups={located} selected={selected} onSelect={selectCluster} /></FadeIn>
          <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 10, lineHeight: fs(12) * 1.7 }}>
            根据已保存的坐标显示相对分布，不是街道地图。相邻地点会合并成圆点，点开可选择每一处地点。
          </Text>
        </>}
        {[{ label: '有坐标的地点', list: located }, { label: '仅记录名称的地点', list: named }].filter(section => section.list.length > 0).map(section => <View key={section.label} style={{ marginTop: 20 }}>
          <Text accessibilityRole="header" style={[t.h3, { fontSize: fs(14), marginBottom: 8 }]}>{section.label}</Text>
          <View style={{ backgroundColor: c.card, borderRadius: r(16), overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
            {section.list.map((group, index) => <Row key={group.name} icon={MapPin} iconColor={group.locatedCount > 0 ? c.primaryDark : c.textMuted}
              title={group.name} subtitle={group.locatedCount === 0 ? '未保存坐标，仍可回看这里的日记' : `${group.locatedCount} 篇含坐标${group.locatedCount < group.count ? ` · ${group.count - group.locatedCount} 篇仅记录名称` : ''}`}
              value={`${group.count} 篇 · ${fmtMonthDay(group.latest)}`} onPress={() => { setCluster(null); setSelected(group.name); }}
              style={{ borderTopWidth: index > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: c.divider }} />)}
          </View>
        </View>)}
      </>}
    </ScrollView>
    <BottomSheet visible={!!current || !!cluster} onClose={close} title={current ? current.name : '选择相邻地点'} maxHeight={0.88}>
      {current ? <>
        {cluster && <TextAction label="返回地点列表" onPress={() => setSelected(null)} />}
        <Text style={[t.sub, { marginBottom: 12 }]}>{current.count} 篇日记 · {current.locatedCount > 0 ? `${current.locatedCount} 篇含坐标` : '仅记录地点名称'}</Text>
        <FlatList data={current.entries} keyExtractor={entry => entry.id} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5}
          style={{ flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 8 }} ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <EntryListCard entry={item} compactDate onPress={() => { close(); router.push({ pathname: '/memory/[id]', params: { id: item.id } }); }} />} />
      </> : <ScrollView style={{ flexShrink: 1 }}>
        <Text style={[t.sub, { marginBottom: 12 }]}>圆点附近共有 {clusterGroups.length} 处地点，请选择想回看的地方。</Text>
        {clusterGroups.map(group => <Row key={group.name} icon={MapPin} title={group.name} value={`${group.count} 篇`} onPress={() => setSelected(group.name)} />)}
      </ScrollView>}
    </BottomSheet>
  </Screen>;
}
