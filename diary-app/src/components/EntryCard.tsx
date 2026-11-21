import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Heart, MapPin, Mic, Pin, Video } from 'lucide-react-native';
import type { Entry } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { moodMeta } from '../data/constants';
import { posterUri } from '../services/videoStore';
import { entryCover } from '../utils/video';
import { fmtMonthDay, WEEK_CN } from '../utils/date';
import { excerpt } from '../utils/text';
import { Photo } from './ui';
import { PressableScale } from './motion';
import { MoodIcon, WeatherIcon } from './MoodIcon';
import { HighlightText } from './RichBody';

interface Props {
  entry: Entry;
  onPress: () => void;
  onLongPress?: () => void;
  query?: string;
  compactDate?: boolean;
  noMargin?: boolean;
  /**
   * 分组模式（设计稿1 #9）：多篇日记共用一张圆角卡片，条目之间用细分隔线，
   * 不再各自带阴影和外边距。first / last 决定圆角与分隔线。
   */
  grouped?: { first: boolean; last: boolean };
}

/** 列表模式日记卡片（1:1 复刻设计稿1 #9 左侧日期列 + 中间标题摘要 + 右侧圆角缩略图） */
function EntryListCardInner({ entry, onPress, onLongPress, query, compactDate, noMargin, grouped }: Props) {
  const { c, t, fs, dark, look, r } = useTheme();
  const cardStyle = useStore(s => s.appearance.cardStyle);
  const tags = useStore(s => s.tags);
  const d = new Date(entry.createdAt);
  const month = `${d.getMonth() + 1}月`;
  const day = `${d.getDate()}`;
  const week = WEEK_CN[d.getDay()];
  const cover = entryCover(entry);
  const showImage = cardStyle === 'image' && !!cover.uri;
  const mood = moodMeta(entry.mood);
  const firstTag = entry.tags.length ? tags.find(x => x.id === entry.tags[0]) : undefined;
  const preview = excerpt(entry.body, 56);
  const titleFallback = entry.title ? '' : preview.slice(0, 16);
  const previewText = entry.title || !titleFallback ? preview : preview.slice(titleFallback.length);

  return (
    <PressableScale
      scaleTo={0.985}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={
        grouped
          ? {
              flexDirection: 'row',
              backgroundColor: c.card,
              paddingHorizontal: 14,
              paddingVertical: 15,
              borderTopLeftRadius: grouped.first ? 18 : 0,
              borderTopRightRadius: grouped.first ? 18 : 0,
              borderBottomLeftRadius: grouped.last ? 18 : 0,
              borderBottomRightRadius: grouped.last ? 18 : 0,
            }
          : {
              flexDirection: 'row',
              backgroundColor: c.card,
              borderRadius: r(16),
              paddingHorizontal: 12,
              paddingVertical: 13,
              marginBottom: noMargin ? 0 : 12,
              borderWidth: look.flat ? 1 : dark ? 0 : StyleSheet.hairlineWidth,
              borderColor: look.flat ? c.border : c.divider,
              shadowColor: c.shadow,
              shadowOpacity: dark || look.flat ? 0 : 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 },
              elevation: dark || look.flat ? 0 : 1,
            }
      }
    >
      {grouped && !grouped.first && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 14 + 46 + 12, right: 14, height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
      )}
      {!compactDate && (
        <View
          style={{
            width: 34,
            alignItems: 'center',
            paddingTop: 2,
            marginRight: grouped ? 12 : 9,
            ...(grouped ? { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.divider, width: 46, paddingRight: 12 } : {}),
          }}
        >
          <Text style={{ fontSize: fs(10.5), color: c.textSub }}>{month}</Text>
          <Text style={{ fontSize: fs(20), color: c.text, fontWeight: '600', lineHeight: fs(25), fontVariant: ['tabular-nums'] }}>{day}</Text>
          <Text style={{ fontSize: fs(10), color: c.textMuted }}>{week}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
        <View style={{ minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 }}>
            {entry.pinned && <Pin size={12} color={c.primary} fill={c.primary} />}
            <HighlightText
              text={entry.title || titleFallback || '无题日记'}
              query={query}
              numberOfLines={1}
              style={{ ...t.h3, fontSize: fs(14.5), flexShrink: 1 }}
            />
          </View>
          {!!previewText && (
            <HighlightText
              text={previewText}
              query={query}
              numberOfLines={2}
              style={{ fontSize: fs(13), color: c.textSub, lineHeight: fs(13) * 1.55, marginTop: 4 }}
            />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
            {compactDate && <Text style={{ fontSize: fs(11), color: c.textMuted }}>{fmtMonthDay(entry.createdAt)}</Text>}
            {mood && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MoodIcon mood={mood.key} size={14} />
                <Text style={{ fontSize: fs(11), color: c.textSub }}>{mood.label}</Text>
              </View>
            )}
            {firstTag && (
              <View style={{ paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 999, backgroundColor: c.primaryFaint }}>
                <Text style={{ fontSize: fs(10.5), color: c.primaryDark }}>#{firstTag.name}</Text>
              </View>
            )}
            {entry.weather && <WeatherIcon weather={entry.weather} size={13} />}
            {!mood && !firstTag && !!entry.place?.name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1, minWidth: 0 }}>
                <MapPin size={11} color={c.textMuted} />
                <Text style={{ fontSize: fs(11), color: c.textMuted, flexShrink: 1 }} numberOfLines={1}>{entry.place.name.split('·')[0].trim()}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            {entry.audios.length > 0 && <Mic size={12} color={c.primaryDark} />}
            {entry.videos.length > 0 && <Video size={12} color={c.primaryDark} />}
            {entry.favorite && <Heart size={12} color={c.danger} fill={c.danger} />}
          </View>
        </View>
      </View>

      {showImage && (
        <View style={{ marginLeft: 10, justifyContent: 'center' }}>
          <Photo uri={cover.isVideo ? posterUri(cover.uri) ?? cover.uri : cover.uri} style={{ width: 62, height: 62 }} radius={10} />
          {cover.isVideo ? (
            <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(47,42,38,0.65)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 6 }}>
              <Video size={10} color="#fff" fill="#fff" />
            </View>
          ) : entry.photos.length > 1 ? (
            <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(47,42,38,0.65)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
              <Text style={{ color: '#fff', fontSize: 10 }}>{entry.photos.length}</Text>
            </View>
          ) : null}
        </View>
      )}
    </PressableScale>
  );
}

/** 卡片/网格模式日记卡片（1:1 复刻设计稿1 #10 双列图文网格） */
function EntryGridCardInner({ entry, onPress, onLongPress }: { entry: Entry; onPress: () => void; onLongPress?: () => void }) {
  const { c, t, fs, dark, look, r } = useTheme();
  const cardStyle = useStore(s => s.appearance.cardStyle);
  const mood = moodMeta(entry.mood);
  const cover = entryCover(entry);
  const showImage = cardStyle === 'image' && !!cover.uri;
  const preview = excerpt(entry.body, 42);

  return (
    <PressableScale
      scaleTo={0.975}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: c.card,
        borderRadius: r(16),
        overflow: 'hidden',
        borderWidth: look.flat ? 1 : dark ? 0 : StyleSheet.hairlineWidth,
        borderColor: look.flat ? c.border : c.divider,
        shadowColor: c.shadow,
        shadowOpacity: dark || look.flat ? 0 : 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: dark || look.flat ? 0 : 1,
      }}
    >
      {showImage ? (
        <View style={{ width: '100%', aspectRatio: 1.12, position: 'relative' }}>
          <Photo uri={cover.isVideo ? posterUri(cover.uri) ?? cover.uri : cover.uri} style={{ width: '100%', height: '100%' }} radius={0} />
          {cover.isVideo && (
            <View style={{ position: 'absolute', right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(47,42,38,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Video size={13} color="#fff" fill="#fff" />
            </View>
          )}
          {entry.pinned && (
            <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999, padding: 4 }}>
              <Pin size={11} color={c.primary} fill={c.primary} />
            </View>
          )}
          {entry.favorite && (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999, padding: 4 }}>
              <Heart size={11} color={c.danger} fill={c.danger} />
            </View>
          )}
        </View>
      ) : (
        <View style={{ padding: 12, backgroundColor: c.primaryFaint, aspectRatio: 1.12, justifyContent: 'center' }}>
          <Text numberOfLines={5} style={{ fontSize: fs(12.5), color: c.textSub, lineHeight: fs(12.5) * 1.55 }}>
            {preview || '写下当下的片刻思绪…'}
          </Text>
        </View>
      )}
      <View style={{ padding: 11 }}>
        <Text numberOfLines={1} style={[t.h3, { fontSize: fs(14) }]}>
          {entry.title || '无题日记'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
          <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>{fmtMonthDay(entry.createdAt)}</Text>
          {mood && <MoodIcon mood={mood.key} size={15} />}
        </View>
      </View>
    </PressableScale>
  );
}

export const EntryListCard = React.memo(EntryListCardInner);
export const EntryGridCard = React.memo(EntryGridCardInner);
