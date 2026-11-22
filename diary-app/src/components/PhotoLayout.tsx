import React, { useState } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from './text';
import { X } from 'lucide-react-native';
import type { PhotoLayout as PhotoLayoutType } from '../store/types';
import { useTheme } from '../theme/ThemeProvider';
import { Photo } from './ui';

interface PhotoLayoutProps {
  photos: string[];
  layout?: PhotoLayoutType;
  onPressPhoto?: (idx: number) => void;
  onRemovePhoto?: (uri: string) => void;
}

/** 日记配图多排版视图：grid（双列网格） / large（逐张大图） / carousel（横滑轮播） */
export function PhotoLayoutView({ photos, layout = 'grid', onPressPhoto, onRemovePhoto }: PhotoLayoutProps) {
  const { c, r } = useTheme();
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [activeIdx, setActiveIdx] = useState(0);

  if (!photos.length) return null;

  const effectiveLayout: PhotoLayoutType = photos.length === 1 ? 'grid' : layout;

  const renderRemoveBtn = (uri: string, alignLeft = false) =>
    onRemovePhoto ? (
      <Pressable
        onPress={() => onRemovePhoto(uri)}
        hitSlop={8}
        style={{
          position: 'absolute',
          top: 8,
          ...(alignLeft ? { left: 8 } : { right: 8 }),
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: 'rgba(47,42,38,0.65)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={14} color="#fff" />
      </Pressable>
    ) : null;

  if (effectiveLayout === 'large') {
    return (
      <View style={{ gap: 12, marginTop: 18 }}>
        {photos.map((uri, idx) => (
          <Pressable
            key={`${uri}_${idx}`}
            onPress={() => onPressPhoto?.(idx)}
            style={{ width: '100%', aspectRatio: 1.4, borderRadius: r(14), overflow: 'hidden' }}
          >
            <Photo uri={uri} style={{ width: '100%', height: '100%' }} radius={r(14)} />
            {renderRemoveBtn(uri)}
          </Pressable>
        ))}
      </View>
    );
  }

  if (effectiveLayout === 'carousel') {
    const slideW = carouselWidth || 280;
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!slideW) return;
      const idx = Math.round(e.nativeEvent.contentOffset.x / slideW);
      if (idx >= 0 && idx < photos.length && idx !== activeIdx) {
        setActiveIdx(idx);
      }
    };
    const safeIdx = Math.min(activeIdx, photos.length - 1);

    return (
      <View
        style={{ marginTop: 18 }}
        onLayout={e => {
          const w = Math.floor(e.nativeEvent.layout.width);
          if (w > 0 && w !== carouselWidth) setCarouselWidth(w);
        }}
      >
        <View style={{ borderRadius: r(14), overflow: 'hidden', position: 'relative' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            onMomentumScrollEnd={onScroll}
            scrollEventThrottle={16}
          >
            {photos.map((uri, idx) => (
              <Pressable
                key={`${uri}_${idx}`}
                onPress={() => onPressPhoto?.(idx)}
                style={{ width: slideW, aspectRatio: 1.38 }}
              >
                <Photo uri={uri} style={{ width: '100%', height: '100%' }} radius={0} />
                {renderRemoveBtn(uri, true)}
              </Pressable>
            ))}
          </ScrollView>

          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: r(999),
              backgroundColor: 'rgba(18,16,14,0.62)',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontVariant: ['tabular-nums'] }}>
              {safeIdx + 1} / {photos.length}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 }}>
          {photos.map((_, idx) => (
            <View
              key={idx}
              style={{
                width: idx === safeIdx ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: idx === safeIdx ? c.primary : c.divider,
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  // 3 图采用 Apple Journal / Day One 式杂志不对称拼图
  if (photos.length === 3) {
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
        <Pressable
          onPress={() => onPressPhoto?.(0)}
          style={{ flex: 1.4, aspectRatio: 0.86, borderRadius: r(14), overflow: 'hidden' }}
        >
          <Photo uri={photos[0]} style={{ width: '100%', height: '100%' }} radius={0} />
          {renderRemoveBtn(photos[0])}
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          {[1, 2].map(idx => (
            <Pressable
              key={`${photos[idx]}_${idx}`}
              onPress={() => onPressPhoto?.(idx)}
              style={{ flex: 1, borderRadius: r(14), overflow: 'hidden' }}
            >
              <Photo uri={photos[idx]} style={{ width: '100%', height: '100%' }} radius={0} />
              {renderRemoveBtn(photos[idx])}
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: 18 }}>
      {photos.map((uri, idx) => (
        <Pressable
          key={`${uri}_${idx}`}
          onPress={() => onPressPhoto?.(idx)}
          style={{
            width: photos.length === 1 ? '100%' : '48.4%',
            aspectRatio: photos.length === 1 ? 1.45 : 1.15,
            borderRadius: r(14),
            overflow: 'hidden',
          }}
        >
          <Photo uri={uri} style={{ width: '100%', height: '100%' }} radius={r(14)} />
          {renderRemoveBtn(uri)}
        </Pressable>
      ))}
    </View>
  );
}
