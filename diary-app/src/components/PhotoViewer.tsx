import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { photoSource } from '../data/assets';
import { usePhotoUri } from '../utils/usePhotoUri';

function Thumb({ uri, active, onPress }: { uri: string; active: boolean; onPress: () => void }) {
  const src = photoSource(usePhotoUri(uri));
  return (
    <Pressable onPress={onPress} style={{ borderWidth: 2, borderColor: active ? '#B79276' : 'transparent', borderRadius: 8, overflow: 'hidden', opacity: active ? 1 : 0.55 }}>
      {src && <Image source={src} style={{ width: 52, height: 52 }} resizeMode="cover" />}
    </Pressable>
  );
}

export function PhotoViewer({ photos, initialIndex = 0, visible, onClose }: { photos: string[]; initialIndex?: number; visible: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIndex);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setIdx(Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1)));
  }, [visible, initialIndex, photos.length]);

  const current = photos[idx];
  const currentUri = usePhotoUri(current);
  const src = photoSource(currentUri);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(18,16,14,0.96)' }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <Text style={{ color: '#EFE8E0', fontSize: 14 }}>{photos.length > 0 ? `${idx + 1} / ${photos.length}` : ''}</Text>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} color="#fff" />
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
          {src && <Image source={src} style={{ width: '100%', height: '82%' }} resizeMode="contain" />}
          {photos.length > 1 && (
            <>
              {idx > 0 && (
                <Pressable onPress={() => setIdx(i => i - 1)} style={{ position: 'absolute', left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronLeft size={22} color="#fff" />
                </Pressable>
              )}
              {idx < photos.length - 1 && (
                <Pressable onPress={() => setIdx(i => i + 1)} style={{ position: 'absolute', right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronRight size={22} color="#fff" />
                </Pressable>
              )}
            </>
          )}
        </View>

        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 18, gap: 10, alignItems: 'center', justifyContent: 'center', flexGrow: 1 }} style={{ flexGrow: 0 }}>
            {photos.map((p, i) => (
              <Thumb key={p + i} uri={p} active={i === idx} onPress={() => setIdx(i)} />
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
