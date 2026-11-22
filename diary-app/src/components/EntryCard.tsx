import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './text';
import { Heart, MapPin, Mic, Pin, Video } from 'lucide-react-native';
import type { Entry } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';
import { useStore } from '../store/store';
import { DEFAULT_NOTEBOOK_ID, moodMeta } from '../data/constants';
import { posterUri } from '../services/videoStore';
import { entryCover } from '../utils/video';
import { fmtMonthDay, fmtTime, WEEK_CN } from '../utils/date';
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
   * 分组模式：多篇日记共用一张圆角卡片，条目之间用细分隔线，
   * 不再各自带阴影和外边距。first / last 决定圆角与分隔线。
   */
  grouped?: { first: boolean; last: boolean };
}

/** Day One 式 72×72 微型多图拼图缩略图 */
function MiniPhotoThumb({ entry }: { entry: Entry }) {
  const { r } = useTheme();
  const cover = entryCover(entry);
  const photos = entry.photos;

  if (cover.isVideo || photos.length <= 1) {
    return (
      <View style={{ width: 72, height: 72, borderRadius: r(12), overflow: 'hidden', position: 'relative' }}>
        <Photo uri={cover.isVideo ? posterUri(cover.uri) ?? cover.uri : cover.uri} style={{ width: '100%', height: '100%' }} radius={0} />
        {cover.isVideo && (
          <View style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: 'rgba(18,16,14,0.65)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: r(6) }}>
            <Video size={10} color="#fff" fill="#fff" />
          </View>
        )}
      </View>
    );
  }

  if (photos.length === 2) {
    return (
      <View style={{ width: 72, height: 72, borderRadius: r(12), overflow: 'hidden', flexDirection: 'row', gap: 2 }}>
        <Photo uri={photos[0]} style={{ flex: 1, height: '100%' }} radius={0} />
        <Photo uri={photos[1]} style={{ flex: 1, height: '100%' }} radius={0} />
      </View>
    );
  }

  if (photos.length === 3) {
    return (
      <View style={{ width: 72, height: 72, borderRadius: r(12), overflow: 'hidden', flexDirection: 'row', gap: 2 }}>
        <Photo uri={photos[0]} style={{ flex: 1.15, height: '100%' }} radius={0} />
        <View style={{ flex: 1, gap: 2 }}>
          <Photo uri={photos[1]} style={{ flex: 1 }} radius={0} />
          <Photo uri={photos[2]} style={{ flex: 1 }} radius={0} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: 72, height: 72, borderRadius: r(12), overflow: 'hidden', gap: 2 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
        <Photo uri={photos[0]} style={{ flex: 1 }} radius={0} />
        <Photo uri={photos[1]} style={{ flex: 1 }} radius={0} />
      </View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 2 }}>
        <Photo uri={photos[2]} style={{ flex: 1 }} radius={0} />
        <View style={{ flex: 1, position: 'relative' }}>
          <Photo uri={photos[3]} style={{ width: '100%', height: '100%' }} radius={0} />
          {photos.length > 4 && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(18,16,14,0.52)', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] }}>+{photos.length - 3}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** 列表模式日记卡片（左侧日期列 + 中间标题摘要 + 右侧 Day One 式拼图缩略图） */
function EntryListCardInner({ entry, onPress, onLongPress, query, compactDate, noMargin, grouped }: Props) {
  const { c, t, fs, r, frame } = useTheme();
  const cardStyle = useStore(s => s.appearance.cardStyle);
  const tags = useStore(s => s.tags);
  const notebooks = useStore(s => s.notebooks);
  const d = new Date(entry.createdAt);
  const month = `${d.getMonth() + 1}月`;
  const day = `${d.getDate()}`;
  const week = WEEK_CN[d.getDay()];
  const cover = entryCover(entry);
  const showImage = cardStyle === 'image' && !!cover.uri;
  const mood = moodMeta(entry.mood);
  const firstTag = entry.tags.length ? tags.find(x => x.id === entry.tags[0]) : undefined;
  const nb = entry.notebookId && entry.notebookId !== DEFAULT_NOTEBOOK_ID ? notebooks.find(n => n.id === entry.notebookId) : undefined;
  const preview = excerpt(entry.body, 56);
  const titleFallback = entry.title ? '' : preview.slice(0, 16);
  const previewText = entry.title || !titleFallback ? preview : preview.slice(titleFallback.length);

  return (
    <PressableScale
      scaleTo={0.985}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title || '无题日记'}，${fmtMonthDay(entry.createdAt)}${entry.status === 'draft' ? '，草稿' : ''}`}
      accessibilityHint={onLongPress ? '轻触查看，长按显示更多操作' : '查看日记'}
      style={
        grouped
          ? {
              flexDirection: 'row',
              backgroundColor: c.card,
              paddingHorizontal: 14,
              paddingVertical: 15,
              borderTopLeftRadius: grouped.first ? r(18) : 0,
              borderTopRightRadius: grouped.first ? r(18) : 0,
              borderBottomLeftRadius: grouped.last ? r(18) : 0,
              borderBottomRightRadius: grouped.last ? r(18) : 0,
            }
          : {
              flexDirection: 'row',
              backgroundColor: c.card,
              borderRadius: r(16),
              paddingHorizontal: 14,
              paddingVertical: 14,
              marginBottom: noMargin ? 0 : 12,
              ...frame,
            }
      }
    >
      {grouped && !grouped.first && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 14 + 46 + 12, right: 14, height: StyleSheet.hairlineWidth, backgroundColor: c.divider }} />
      )}
      {!compactDate && (
        <View
          style={{
            width: 36,
            alignItems: 'center',
            paddingTop: 2,
            marginRight: grouped ? 12 : 10,
            ...(grouped ? { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.divider, width: 46, paddingRight: 12 } : {}),
          }}
        >
          <Text style={{ fontSize: fs(10.5), color: c.textMuted }}>{month}</Text>
          <Text style={{ fontSize: fs(21), color: c.text, fontWeight: '600', lineHeight: fs(25), fontVariant: ['tabular-nums'] }}>{day}</Text>
          <Text style={{ fontSize: fs(10.5), color: c.textMuted }}>{week}</Text>
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
              style={{ ...t.readingTitle, fontSize: fs(15.5), lineHeight: fs(23), flexShrink: 1 }}
            />
          </View>
          {!!previewText && (
            <HighlightText
              text={previewText}
              query={query}
              numberOfLines={2}
              style={{ ...t.bodySerif, fontSize: fs(13.5), color: c.textSub, lineHeight: fs(13.5) * 1.58, marginTop: 4 }}
            />
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, rowGap: 4, flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: fs(11), color: c.textMuted, fontVariant: ['tabular-nums'], flexShrink: 0 }}>
              {compactDate ? `${fmtMonthDay(entry.createdAt)} · ${fmtTime(entry.createdAt)}` : fmtTime(entry.createdAt)}
            </Text>
            {nb && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: nb.color, flexShrink: 0 }} />}
            {mood && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <MoodIcon mood={mood.key} size={16} />
                <Text style={{ fontSize: fs(11), color: c.textSub }}>{mood.label}</Text>
              </View>
            )}
            {firstTag && (
              <View style={{ maxWidth: 96, paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: r(999), backgroundColor: c.primaryFaint, flexShrink: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: fs(10.5), color: c.primaryDark }}>#{firstTag.name}</Text>
              </View>
            )}
            {entry.weather && (
              <View style={{ flexShrink: 0 }}>
                <WeatherIcon weather={entry.weather} size={15} />
              </View>
            )}
            {!mood && !firstTag && !!entry.place?.name && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1, minWidth: 0 }}>
                <MapPin size={11} color={c.textMuted} />
                <Text style={{ fontSize: fs(11), color: c.textMuted, flexShrink: 1 }} numberOfLines={1}>{entry.place.name.split('·')[0].trim()}</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {entry.audios.length > 0 && <Mic size={12} color={c.primaryDark} />}
            {entry.videos.length > 0 && <Video size={12} color={c.primaryDark} />}
            {entry.favorite && <Heart size={12.5} color={c.danger} fill={c.danger} />}
          </View>
        </View>
      </View>

      {showImage && (
        <View style={{ marginLeft: 12, justifyContent: 'center' }}>
          <MiniPhotoThumb entry={entry} />
        </View>
      )}
    </PressableScale>
  );
}

/** 卡片/网格模式日记卡片（双列图文网格 / 纸面引文卡片） */
function EntryGridCardInner({ entry, onPress, onLongPress }: { entry: Entry; onPress: () => void; onLongPress?: () => void }) {
  const { c, t, fs, r, frame } = useTheme();
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
      accessibilityRole="button"
      accessibilityLabel={`${entry.title || '无题日记'}，${fmtMonthDay(entry.createdAt)}${entry.status === 'draft' ? '，草稿' : ''}`}
      accessibilityHint={onLongPress ? '轻触查看，长按显示更多操作' : '查看日记'}
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: c.card,
        borderRadius: r(16),
        overflow: 'hidden',
        ...frame,
      }}
    >
      {showImage ? (
        <View style={{ width: '100%', aspectRatio: 1.12, position: 'relative' }}>
          <Photo uri={cover.isVideo ? posterUri(cover.uri) ?? cover.uri : cover.uri} style={{ width: '100%', height: '100%' }} radius={0} />
          {cover.isVideo ? (
            <View style={{ position: 'absolute', right: 8, bottom: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(18,16,14,0.62)', alignItems: 'center', justifyContent: 'center' }}>
              <Video size={13} color="#fff" fill="#fff" />
            </View>
          ) : entry.photos.length > 1 ? (
            <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(18,16,14,0.62)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: r(6) }}>
              <Text style={{ color: '#fff', fontSize: 10.5, fontVariant: ['tabular-nums'] }}>{entry.photos.length}</Text>
            </View>
          ) : null}
          {entry.pinned && (
            <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: c.card, borderRadius: r(999), padding: 5 }}>
              <Pin size={11} color={c.primaryDark} fill={c.primaryDark} />
            </View>
          )}
          {entry.favorite && (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: c.card, borderRadius: r(999), padding: 5 }}>
              <Heart size={11} color={c.danger} fill={c.danger} />
            </View>
          )}
        </View>
      ) : (
        <View style={{ padding: 13, backgroundColor: c.cardAlt, aspectRatio: 1.12, justifyContent: 'space-between', borderTopWidth: 3, borderTopColor: mood?.color ?? c.primarySoft }}>
          <Text style={{ fontSize: 22, lineHeight: 22, color: c.primarySoft, fontWeight: '700' }}>“</Text>
          <Text textRole="reading" numberOfLines={4} style={{ fontSize: fs(12.5), color: c.textSub, lineHeight: fs(12.5) * 1.6 }}>
            {preview || '写下当下的片刻思绪…'}
          </Text>
        </View>
      )}
      <View style={{ padding: 12 }}>
        <Text numberOfLines={1} style={[t.readingTitle, { fontSize: fs(14.5), lineHeight: fs(21) }]}>
          {entry.title || '无题日记'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>{fmtMonthDay(entry.createdAt)}</Text>
          {mood && <MoodIcon mood={mood.key} size={15} />}
        </View>
      </View>
    </PressableScale>
  );
}

export const EntryListCard = React.memo(EntryListCardInner);
export const EntryGridCard = React.memo(EntryGridCardInner);
