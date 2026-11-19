import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { getEditorDraft, updateEditorDraft } from '../src/store/editorSession';
import { TEMPLATE_CATEGORIES, TEMPLATES, type TemplateMeta } from '../src/data/constants';
import { TEMPLATE_IMAGES } from '../src/data/assets';
import { NavBar, Screen, goBack, haptic } from '../src/components/ui';
import { useFeedback } from '../src/components/feedback';

/** 6. 模板中心（1:1 复刻设计稿2 #6） */
export default function TemplatesScreen() {
  const { c, t, fs, dark } = useTheme();
  const { toast } = useFeedback();
  const [cat, setCat] = useState<'all' | 'life' | 'growth' | 'study' | 'work'>('all');

  const list = useMemo(
    () => (cat === 'all' ? TEMPLATES : TEMPLATES.filter(x => x.category === cat)),
    [cat],
  );

  const pickTemplate = (tpl: TemplateMeta) => {
    haptic('light');
    const existing = getEditorDraft();
    if (existing) {
      updateEditorDraft({
        title: existing.entry.title.trim() ? existing.entry.title : tpl.title,
        body: existing.entry.body.trim() ? `${existing.entry.body}\n\n${tpl.body}` : tpl.body,
        tags: Array.from(new Set([...existing.entry.tags, ...tpl.tags])),
        template: tpl.id,
      });
      toast(`已套用「${tpl.name}」模板`);
      goBack();
    } else {
      router.replace({ pathname: '/write', params: { template: tpl.id } });
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="模板中心" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingVertical: 8 }}>
        {TEMPLATE_CATEGORIES.map(item => {
          const on = cat === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setCat(item.key)}
              style={{
                paddingHorizontal: 14,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? c.primaryFaint : 'transparent',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: on ? c.primary : 'transparent',
              }}
            >
              <Text style={{ fontSize: fs(13.5), color: on ? c.primaryDark : c.textSub, fontWeight: on ? '600' : '400' }}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 12 }}>
        {list.map(tpl => (
          <Pressable
            key={tpl.id}
            onPress={() => pickTemplate(tpl)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 14,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: c.divider,
              shadowColor: c.shadow,
              shadowOpacity: dark ? 0 : 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 2 },
              elevation: dark ? 0 : 1,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <Image
              source={TEMPLATE_IMAGES[tpl.image]}
              style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: c.primaryFaint }}
              resizeMode="cover"
            />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[t.h3, { fontSize: fs(16) }]}>{tpl.name}</Text>
              <Text style={[t.sub, { marginTop: 4 }]} numberOfLines={2}>
                {tpl.desc}
              </Text>
            </View>
            <ChevronRight size={18} color={c.textMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
