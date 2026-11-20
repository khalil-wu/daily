import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Check, ChevronDown, HeartHandshake, RefreshCw, Sparkles, Wand2 } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import { actions, useStore } from '../store/store';
import { updateEditorDraft } from '../store/editorSession';
import type { Entry, MoodKey } from '../store/types';
import { moodMeta, relationLabel } from '../data/constants';
import { useFeedback } from './feedback';
import { BottomSheet } from './motion';
import { RichBody } from './RichBody';
import { plainText } from '../utils/text';
import { detectNewPeople, matchPeopleInText } from '../utils/people';
import { localMood, localQuestions, localTags, localTitle } from '../utils/ai/local';
import { canSendEntry } from '../utils/ai/privacy';
import { detectCrisis, HOTLINE } from '../utils/ai/safety';
import { aiErrorMessage, AIError } from '../utils/ai/client';
import { askFollowUps, organizeEntry, tidyBody, useAIStatus } from '../services/ai';
import type { OrganizeResult } from '../utils/ai/parse';

type TabKey = 'ask' | 'organize' | 'tidy';

/**
 * 「记得」面板：追问、整理、理顺口述。
 * 本机建议立刻出现；开启「记得」后，AI 的建议在同一位置补充进来。
 * AI 只问和整理，永远不替用户写。
 */
export function RememberPanel({ entry, applyBody }: { entry: Entry; applyBody: (next: string, step?: boolean) => void }) {
  const { c, t, fs } = useTheme();
  const { toast } = useFeedback();
  const tags = useStore(s => s.tags);
  const people = useStore(s => s.people);
  const aiStatus = useAIStatus();
  const aiReady = aiStatus === 'ready';

  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState<TabKey>('ask');
  const [busy, setBusy] = useState<null | 'ask' | 'organize' | 'tidy'>(null);
  const [seed, setSeed] = useState(0);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState<OrganizeResult | null>(null);
  const [tidied, setTidied] = useState<string | null>(null);

  const body = plainText(`${entry.title}\n${entry.body}`);
  const sendable = canSendEntry(entry);
  const crisis = useMemo(() => detectCrisis(body), [body]);

  const toggle = () => {
    setOpen(v => {
      Animated.timing(anim, { toValue: v ? 0 : 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      return !v;
    });
  };

  /* ---------- 追问 ---------- */
  const questions = useMemo(() => {
    const local = localQuestions({ hasBody: !!body, hour: new Date().getHours(), seed });
    return [...aiQuestions, ...local.filter(q => !aiQuestions.includes(q))].slice(0, 3);
  }, [aiQuestions, body, seed]);

  const askAI = async () => {
    if (busy) return;
    setBusy('ask');
    try {
      const got = await askFollowUps(entry, [...aiQuestions, ...questions]);
      setAiQuestions(cur => [...got, ...cur].slice(0, 3));
    } catch (e) {
      toast(e instanceof AIError && e.kind === 'hidden' ? '隐藏日记不会发送给「记得」' : aiErrorMessage(e), { type: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const insertQuestion = (q: string) => {
    const cur = entry.body;
    const lead = cur.trim() ? `${cur.replace(/\s+$/, '')}\n\n` : '';
    applyBody(`${lead}> ${q}\n\n`, true);
    toast('已把问题放进正文');
  };

  /* ---------- 整理 ---------- */
  const suggest = useMemo(() => {
    const titles = [
      ...(aiResult?.titles ?? []),
      ...(localTitle(entry.body) ? [localTitle(entry.body)!] : []),
    ].filter((x, i, arr) => x && x !== entry.title && arr.indexOf(x) === i).slice(0, 3);
    const mood = (aiResult?.mood ?? localMood(body)) as MoodKey | undefined;
    const tagIds = [...(aiResult?.tagIds ?? []), ...localTags(body, tags, entry.tags)]
      .filter((id, i, arr) => arr.indexOf(id) === i && !entry.tags.includes(id)).slice(0, 3);
    const peopleIds = [...(aiResult?.peopleIds ?? []), ...matchPeopleInText(body, people)]
      .filter((id, i, arr) => arr.indexOf(id) === i && !entry.people.includes(id)).slice(0, 5);
    const newPeople = [...(aiResult?.newPeople ?? []), ...detectNewPeople(body, people)]
      .filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i && !peopleIds.includes(people.find(pp => pp.name === p.name)?.id ?? '')).slice(0, 4);
    return { titles, mood, tagIds, peopleIds, newPeople };
  }, [aiResult, entry.body, entry.title, entry.tags, entry.people, body, tags, people]);

  const organizeAI = async () => {
    if (busy) return;
    setBusy('organize');
    try {
      const res = await organizeEntry(entry);
      setAiResult(res);
    } catch (e) {
      toast(aiErrorMessage(e), { type: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  /* ---------- 理顺 ---------- */
  const canTidy = body.length >= 12;
  const tidyAI = async () => {
    if (busy) return;
    setBusy('tidy');
    try {
      setTidied(await tidyBody(entry));
    } catch (e) {
      toast(aiErrorMessage(e), { type: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const aiNote = !sendable
    ? '隐藏日记不会发送给「记得」'
    : aiStatus === 'off'
      ? '以下建议都在本机生成；开启「记得」后会读一读再帮你问和整理'
      : aiStatus === 'needs_setup'
        ? '「记得」已开启，还差服务地址、模型或密钥'
        : null;

  const S = {
    head: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
    label: { fontSize: fs(12), color: c.textSub, fontWeight: '500' as const },
  };

  return (
    <View style={{ marginBottom: 14, backgroundColor: c.cardAlt, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: open ? c.primarySoft : c.divider, overflow: 'hidden' }}>
      {/* 折叠头：永远只占一行 */}
      <Pressable onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 }}>
        <Sparkles size={14} color={c.primaryDark} />
        <Text style={{ fontSize: fs(13), color: c.primaryDark, fontWeight: '500', marginLeft: 6 }}>记得</Text>
        <Text style={{ fontSize: fs(12), color: c.textMuted, marginLeft: 6, flex: 1 }} numberOfLines={1}>
          {open ? '问你、帮你整理，不替你写' : '追问 · 整理 · 理顺口述'}
        </Text>
        <Animated.View style={{ transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <ChevronDown size={16} color={c.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View style={{ height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }), opacity: anim }}>
        <View style={{ height: 420, paddingHorizontal: 14, paddingBottom: 12 }}>
          {/* 页签 */}
          <View style={{ flexDirection: 'row', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.divider }}>
            {([
              { key: 'ask', label: '追问' },
              { key: 'organize', label: '整理' },
              { key: 'tidy', label: '理顺口述' },
            ] as { key: TabKey; label: string }[]).map(it => (
              <Pressable key={it.key} onPress={() => setTab(it.key)} style={{ paddingVertical: 8 }}>
                <Text style={{ fontSize: fs(13), color: tab === it.key ? c.text : c.textMuted, fontWeight: tab === it.key ? '600' : '400' }}>{it.label}</Text>
                <View style={{ height: 2, width: 14, marginTop: 5, borderRadius: 1, backgroundColor: tab === it.key ? c.primary : 'transparent' }} />
              </Pressable>
            ))}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 12, paddingBottom: 6 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {crisis && (
              <View style={{ flexDirection: 'row', gap: 8, backgroundColor: c.dangerSoft, borderRadius: 12, padding: 10, marginBottom: 12 }}>
                <HeartHandshake size={15} color={c.danger} style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: fs(12), color: c.danger, lineHeight: fs(12) * 1.55 }}>
                  读到了一些不太好过的表达。如果最近真的撑得辛苦，现在就联系一个信任的人，或拨打 {HOTLINE.number}（{HOTLINE.name}，24 小时）。
                </Text>
              </View>
            )}

            {tab === 'ask' && (
              <View style={{ gap: 8 }}>
                <Text style={S.label}>顺着你已经写的，接着问自己：</Text>
                {questions.map((q, i) => (
                  <Pressable
                    key={`${i}-${q}`}
                    onPress={() => insertQuestion(q)}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.card, borderRadius: 12, padding: 12, opacity: pressed ? 0.75 : 1 })}
                  >
                    <Text style={{ flex: 1, fontSize: fs(13.5), color: c.text, lineHeight: fs(13.5) * 1.5 }}>{q}</Text>
                    <Text style={{ fontSize: fs(11), color: c.primaryDark, marginTop: 2 }}>写入 ›</Text>
                  </Pressable>
                ))}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
                  <Pressable onPress={() => { setAiQuestions([]); setSeed(s => s + 1); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}>
                    <RefreshCw size={12} color={c.textSub} />
                    <Text style={{ fontSize: fs(12), color: c.textSub }}>换一批</Text>
                  </Pressable>
                  {aiReady && sendable && (
                    <Pressable onPress={() => void askAI()} disabled={!!busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, opacity: busy ? 0.5 : 1 }}>
                      {busy === 'ask' ? <ActivityIndicator size={12} color={c.primaryDark} /> : <Sparkles size={12} color={c.primaryDark} />}
                      <Text style={{ fontSize: fs(12), color: c.primaryDark }}>让「记得」问得更深</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {tab === 'organize' && (
              <View style={{ gap: 14 }}>
                {suggest.titles.length > 0 && (
                  <View>
                    <Text style={S.label}>标题</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {suggest.titles.map(title => (
                        <Pressable key={title} onPress={() => updateEditorDraft({ title })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                          <Text style={{ fontSize: fs(12.5), color: c.text }}>{title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                {suggest.mood && suggest.mood !== entry.mood && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={S.label}>心情</Text>
                    <Pressable onPress={() => updateEditorDraft({ mood: suggest.mood })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                      <Text style={{ fontSize: fs(12.5), color: c.text }}>{moodMeta(suggest.mood)?.label}</Text>
                    </Pressable>
                  </View>
                )}
                {suggest.tagIds.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={S.label}>标签</Text>
                    {suggest.tagIds.map(id => {
                      const tg = tags.find(x => x.id === id);
                      return tg ? (
                        <Pressable key={id} onPress={() => updateEditorDraft({ tags: [...entry.tags, id] })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                          <Text style={{ fontSize: fs(12.5), color: c.text }}>#{tg.name}</Text>
                        </Pressable>
                      ) : null;
                    })}
                  </View>
                )}
                {(suggest.peopleIds.length > 0 || suggest.newPeople.length > 0) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={S.label}>和谁</Text>
                    {suggest.peopleIds.map(id => {
                      const p = people.find(x => x.id === id);
                      return p ? (
                        <Pressable key={id} onPress={() => updateEditorDraft({ people: [...entry.people, id] })} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.divider }}>
                          <Text style={{ fontSize: fs(12.5), color: c.text }}>{p.name}</Text>
                        </Pressable>
                      ) : null;
                    })}
                    {suggest.newPeople.map(np => (
                      <Pressable
                        key={np.name}
                        onPress={() => {
                          const created = actions.addPerson(np.name, np.relation);
                          if (created) updateEditorDraft({ people: [...entry.people, created.id] });
                        }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: c.primaryFaint, borderWidth: StyleSheet.hairlineWidth, borderColor: c.primarySoft }}
                      >
                        <Text style={{ fontSize: fs(12.5), color: c.primaryDark }}>+ {np.name}（{relationLabel(np.relation)}）</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {!suggest.titles.length && !suggest.mood && !suggest.tagIds.length && !suggest.peopleIds.length && !suggest.newPeople.length && (
                  <Text style={{ fontSize: fs(12.5), color: c.textMuted }}>{body ? '能想到的都已经标上了' : '先写一点内容，这里会给出标题、心情、标签和身边人的建议'}</Text>
                )}
                {aiReady && sendable && (
                  <Pressable onPress={() => void organizeAI()} disabled={!!busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, opacity: busy ? 0.5 : 1 }}>
                    {busy === 'organize' ? <ActivityIndicator size={12} color={c.primaryDark} /> : <Wand2 size={13} color={c.primaryDark} />}
                    <Text style={{ fontSize: fs(12), color: c.primaryDark }}>让「记得」整理一遍</Text>
                  </Pressable>
                )}
              </View>
            )}

            {tab === 'tidy' && (
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: fs(12.5), color: c.textSub, lineHeight: fs(12.5) * 1.6 }}>
                  把口述或随手记的文字理顺：补标点、分段、去口头语。不添加内容，不改写语气，原文会保留在撤销历史里。
                </Text>
                {!aiReady ? (
                  <Text style={{ fontSize: fs(12), color: c.textMuted }}>开启「记得」后可用</Text>
                ) : !sendable ? (
                  <Text style={{ fontSize: fs(12), color: c.textMuted }}>隐藏日记不会发送给「记得」</Text>
                ) : !canTidy ? (
                  <Text style={{ fontSize: fs(12), color: c.textMuted }}>正文再多写一点（至少十几个字）就能理顺</Text>
                ) : (
                  <Pressable onPress={() => void tidyAI()} disabled={!!busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: busy ? 0.5 : 1 }}>
                    {busy === 'tidy' ? <ActivityIndicator size={12} color={c.primaryDark} /> : <Wand2 size={13} color={c.primaryDark} />}
                    <Text style={{ fontSize: fs(12), color: c.primaryDark }}>理顺这段文字</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* 底部：AI 状态说明 / 去开启 */}
            {aiNote && (
              <Pressable onPress={() => router.push('/settings/ai')} style={{ marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }}>
                <Text style={{ fontSize: fs(11.5), color: c.textMuted }}>
                  {aiNote} · <Text style={{ color: c.primaryDark }}>去设置 ›</Text>
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Animated.View>

      {/* 理顺结果预览：接受才替换正文 */}
      <BottomSheet visible={tidied !== null} onClose={() => setTidied(null)} title="理顺后的正文" maxHeight={0.8}>
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
          {tidied !== null && <RichBody body={tidied} />}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 6 }}>
            <Pressable onPress={() => setTidied(null)} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: fs(14), color: c.textSub }}>保留原文</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (tidied) applyBody(tidied, true);
                setTidied(null);
                toast('已替换为理顺后的文字，可撤销');
              }}
              style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: c.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
            >
              <Check size={15} color="#fff" />
              <Text style={{ fontSize: fs(14), color: '#fff', fontWeight: '600' }}>用这个</Text>
            </Pressable>
          </View>
        </ScrollView>
      </BottomSheet>
    </View>
  );
}
