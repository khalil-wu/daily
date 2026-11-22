import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from './text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { photoSource } from '../data/assets';
import { usePhotoUri } from '../utils/usePhotoUri';
import { useTheme } from '../theme/ThemeProvider';
import { AccessibleModal, FadeIn, useReducedMotion } from './motion';

const THUMB_WIDTH = 66;
function Thumb({ uri, active, index, onPress }: { uri: string; active: boolean; index: number; onPress: () => void }) {
  const { c, r } = useTheme();
  const src = photoSource(usePhotoUri(uri));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`查看第 ${index + 1} 张照片`} accessibilityState={{ selected: active }} aria-selected={active} onPress={onPress} style={{ width: 56, height: 56, marginRight: 10, borderWidth: 2, borderColor: active ? c.primary : 'transparent', borderRadius: r(8), overflow: 'hidden', opacity: active ? 1 : 0.65 }}>
      {src && <Image source={src} style={{ width: 52, height: 52 }} resizeMode="cover" />}
    </Pressable>
  );
}

/** 单页大图：PagedPhoto 里再按屏幕宽度居中 contain */
function PagerPhoto({ uri, index, width }: { uri: string; index: number; width: number }) {
  const src = photoSource(usePhotoUri(uri));
  if (!src) return <View style={{ width }} />;
  return (
    <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
      <Image accessibilityLabel={`第 ${index + 1} 张照片`} source={src} style={{ width: '100%', height: '92%' }} resizeMode="contain" />
    </View>
  );
}

export function PhotoViewer({ photos, initialIndex = 0, visible, onClose, onOpenEntry }: { photos: string[]; initialIndex?: number; visible: boolean; onClose: () => void; onOpenEntry?: (index: number) => void }) {
  const [idx, setIdx] = useState(initialIndex);
  const insets = useSafeAreaInsets();
  const { fs } = useTheme();
  const reduced = useReducedMotion();
  const thumbs = useRef<FlatList<string>>(null);
  const pager = useRef<FlatList<string>>(null);
  const { width: winW } = useWindowDimensions();

  useEffect(() => {
    if (visible) setIdx(Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1)));
  }, [visible, initialIndex, photos.length]);
  useEffect(() => {
    if (visible && photos.length > 1) thumbs.current?.scrollToIndex({ index: idx, animated: !reduced, viewPosition: 0.5 });
  }, [idx, visible, photos.length, reduced]);
  // 箭头/缩略图/键盘改变 idx 时同步大图分页；手势滑动由 onMomentumScrollEnd 反向同步 idx
  useEffect(() => {
    if (visible && photos.length > 1) pager.current?.scrollToIndex({ index: idx, animated: !reduced });
  }, [idx, visible, photos.length, reduced]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setIdx(i => Math.min(Math.max(0, i + (event.key === 'ArrowLeft' ? -1 : 1)), Math.max(0, photos.length - 1)));
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [visible, photos.length]);

  if (!visible) return null;
  const arrowStyle = { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(50,46,43,0.9)', alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <AccessibleModal label="照片查看器" visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <FadeIn dy={0} duration={180} style={{ flex: 1, backgroundColor: '#12100e' }}>
      <View style={{ flex: 1, backgroundColor: '#12100e' }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text accessibilityLiveRegion="polite" style={{ color: '#EFE8E0', fontSize: fs(14), flex: 1 }}>{photos.length > 0 ? `${idx + 1} / ${photos.length}` : '暂无照片'}</Text>
          {onOpenEntry && <Pressable accessibilityRole="button" accessibilityLabel="查看这张照片的日记" onPress={() => onOpenEntry(idx)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: '#fff', fontSize: fs(14) }}>查看日记</Text></Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="关闭照片查看器" onPress={onClose} style={arrowStyle}>
            <X size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <FlatList
            ref={pager}
            horizontal
            pagingEnabled
            data={photos}
            keyExtractor={(item, i) => `${i}:${item}`}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(idx, Math.max(0, photos.length - 1))}
            getItemLayout={(_, i) => ({ length: winW, offset: winW * i, index: i })}
            onMomentumScrollEnd={e => {
              const i = Math.round(e.nativeEvent.contentOffset.x / winW);
              if (i !== idx) setIdx(Math.max(0, Math.min(photos.length - 1, i)));
            }}
            renderItem={({ item, index }) => <PagerPhoto uri={item} index={index} width={winW} />}
            windowSize={3}
            maxToRenderPerBatch={3}
          />
          {photos.length > 1 && <>
            <Pressable accessibilityRole="button" accessibilityLabel="上一张照片" accessibilityState={{ disabled: idx === 0 }} disabled={idx === 0} onPress={() => setIdx(i => i - 1)} style={[arrowStyle, { position: 'absolute', left: 14, top: '46%', opacity: idx === 0 ? 0.3 : 1 }]}>
              <ChevronLeft size={22} color="#fff" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="下一张照片" accessibilityState={{ disabled: idx === photos.length - 1 }} disabled={idx === photos.length - 1} onPress={() => setIdx(i => i + 1)} style={[arrowStyle, { position: 'absolute', right: 14, top: '46%', opacity: idx === photos.length - 1 ? 0.3 : 1 }]}>
              <ChevronRight size={22} color="#fff" />
            </Pressable>
          </>}
        </View>

        {photos.length > 1 && <FlatList
          ref={thumbs} horizontal data={photos} extraData={idx} keyExtractor={(_, i) => String(i)}
          initialNumToRender={8} maxToRenderPerBatch={8} windowSize={3} initialScrollIndex={Math.min(idx, photos.length - 1)}
          getItemLayout={(_, index) => ({ length: THUMB_WIDTH, offset: THUMB_WIDTH * index, index })}
          renderItem={({ item, index }) => <Thumb uri={item} index={index} active={index === idx} onPress={() => setIdx(index)} />}
          showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 18, paddingTop: 10 }} style={{ flexGrow: 0, flexShrink: 0 }}
        />}
      </View>
      </FadeIn>
    </AccessibleModal>
  );
}
