import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../src/components/text';
import { router } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { getEditorDraft, updateEditorDraft } from '../src/store/editorSession';
import { useStore } from '../src/store/store';
import { TEMPLATE_CATEGORIES, TEMPLATES, type TemplateMeta } from '../src/data/constants';
import { TEMPLATE_IMAGES } from '../src/data/assets';
import { Button, Card, NavBar, Screen, goBack, haptic } from '../src/components/ui';
import { RichBody } from '../src/components/RichBody';
import { useFeedback } from '../src/components/feedback';

export default function TemplatesScreen() {
  const { c, t, fs, r } = useTheme();
  const { toast } = useFeedback();
  const tags = useStore(s => s.tags);
  const [cat, setCat] = useState<'all' | 'life' | 'growth' | 'study' | 'work'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const list = useMemo(() => cat === 'all' ? TEMPLATES : TEMPLATES.filter(x => x.category === cat), [cat]);
  const hasBody = !!getEditorDraft()?.entry.body.trim();
  const pickTemplate = (tpl: TemplateMeta) => {
    haptic('light');
    const existing = getEditorDraft();
    if (existing) {
      const append = !!existing.entry.body.trim();
      updateEditorDraft({
        title: existing.entry.title.trim() ? existing.entry.title : tpl.title,
        body: append ? `${existing.entry.body}\n\n${tpl.body}` : tpl.body,
        tags: Array.from(new Set([...existing.entry.tags, ...tpl.tags.filter(id => tags.some(tag => tag.id === id))])),
        template: tpl.id,
      });
      toast(append ? `已将「${tpl.name}」追加到正文` : `已使用「${tpl.name}」模板`);
      goBack();
    } else router.replace({ pathname: '/write', params: { template: tpl.id } });
  };
  return (
    <Screen enter="page" edges={['top', 'bottom']}>
      <NavBar title="模板中心" />
      <Text style={[t.sub, { paddingHorizontal: 20, marginBottom: 8 }]}>先看看内容，再选择适合今天的记录方式。</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 8 }}>
        {TEMPLATE_CATEGORIES.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: cat === item.key }} onPress={() => setCat(item.key)} style={{ paddingHorizontal: 14, minHeight: 44, borderRadius: r(999), alignItems: 'center', justifyContent: 'center', backgroundColor: cat === item.key ? c.primaryFaint : c.card, borderWidth: 1, borderColor: cat === item.key ? c.primary : c.divider }}><Text style={{ fontSize: fs(14), color: cat === item.key ? c.primaryDark : c.textSub, fontWeight: cat === item.key ? '600' : '400' }}>{item.label}</Text></Pressable>)}
      </ScrollView>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 12 }}>
        {list.map((tpl, idx) => {
          const open = expanded === tpl.id;
          const namedTags = tpl.tags.map(id => tags.find(tag => tag.id === id)?.name).filter(Boolean);
          const sectionCount = tpl.body.split('\n').filter(line => line.trim().startsWith('#')).length;
          const summary = [...namedTags.map(n => `#${n}`), sectionCount ? `${sectionCount} 个小节` : '空白自由排版'].join(' · ');
          return <Card key={tpl.id} padded={false} style={{ overflow: 'hidden' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`预览${tpl.name}`} accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : tpl.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, backgroundColor: pressed ? c.cardAlt : 'transparent' })}>
              <Image
                source={TEMPLATE_IMAGES[tpl.image]}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: r(10),
                  backgroundColor: c.primaryFaint,
                }}
                resizeMode="cover"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={t.h3}>{tpl.name}</Text>
                <Text style={[t.sub, { marginTop: 3 }]}>{tpl.desc}</Text>
                <Text style={{ fontSize: fs(11.5), color: c.textMuted, marginTop: 4 }}>{summary}</Text>
              </View>
              {open ? <ChevronUp size={18} color={c.textMuted} /> : <ChevronDown size={18} color={c.textMuted} />}
            </Pressable>
            {open && <View style={{ padding: 16, paddingTop: 4, gap: 14 }}>
              <View style={{ padding: 14, backgroundColor: c.bg, borderRadius: r(12), borderTopWidth: 3, borderTopColor: c.primary, gap: 10 }}><Text style={[t.readingTitle, { fontSize: fs(18) }]}>{tpl.title}</Text><RichBody body={tpl.body} /></View>
              {!!namedTags.length && <Text style={t.caption}>标签：{namedTags.map(name => `#${name}`).join(' · ')}</Text>}
              <Text style={t.caption}>{hasBody ? '模板会追加到现有正文末尾，并保留你已填写的标题。' : '使用后可以自由编辑标题和正文。'}</Text>
              <Button title={hasBody ? '追加到正文' : '使用这个模板'} onPress={() => pickTemplate(tpl)} />
            </View>}
          </Card>;
        })}
      </ScrollView>
    </Screen>
  );
}
