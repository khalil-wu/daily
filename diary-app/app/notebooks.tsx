import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BookOpen, Check, Edit3, FolderOpen, MoreHorizontal, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../src/theme/ThemeProvider';
import { actions, inNotebook, useStore } from '../src/store/store';
import type { Notebook } from '../src/store/types';
import { DEFAULT_NOTEBOOK_ID, NOTEBOOK_COLORS } from '../src/data/constants';
import { Button, Card, Field, NavBar, Screen, TextAction, haptic } from '../src/components/ui';
import { useFeedback } from '../src/components/feedback';
import { BottomSheet } from '../src/components/motion';

/** 日记本管理页：新建 / 重命名 / 改色 / 切换 / 删除（默认日记本受保护） */
export default function NotebooksScreen() {
  const { c, t, fs } = useTheme();
  const { toast, confirm, sheet } = useFeedback();
  const notebooks = useStore(s => s.notebooks);
  const activeNotebook = useStore(s => s.activeNotebook);
  const entries = useStore(s => s.entries);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Notebook | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [colorInput, setColorInput] = useState<string>(NOTEBOOK_COLORS[0]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    const alive = entries.filter(e => !e.deletedAt && !e.hidden);
    for (const nb of notebooks) {
      map.set(nb.id, alive.filter(e => inNotebook(e, nb.id)).length);
    }
    return map;
  }, [entries, notebooks]);

  const openCreate = () => {
    setEditing(null);
    setNameInput('');
    setColorInput(NOTEBOOK_COLORS[notebooks.length % NOTEBOOK_COLORS.length]);
    setModalOpen(true);
  };

  const openEdit = (nb: Notebook) => {
    setEditing(nb);
    setNameInput(nb.name);
    setColorInput(nb.color);
    setModalOpen(true);
  };

  const saveModal = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      toast('请输入日记本名称', { type: 'warning' });
      return;
    }
    if (editing) {
      actions.updateNotebook(editing.id, { name: trimmed, color: colorInput });
      toast('已更新日记本');
    } else {
      const created = actions.addNotebook(trimmed, colorInput);
      if (created) toast(`已创建「${created.name}」`);
    }
    setModalOpen(false);
  };

  const onNotebookPress = (nb: Notebook) => {
    const isDefault = nb.id === DEFAULT_NOTEBOOK_ID;
    sheet(
      [
        {
          label: '在首页查看此日记本',
          icon: FolderOpen,
          onPress: () => {
            actions.setActiveNotebook(nb.id);
            router.replace('/(tabs)');
          },
        },
        {
          label: '重命名或更换颜色',
          icon: Edit3,
          onPress: () => openEdit(nb),
        },
        ...(!isDefault
          ? [
              {
                label: '删除日记本',
                icon: Trash2,
                destructive: true,
                onPress: async () => {
                  const ok = await confirm({
                    title: `删除「${nb.name}」？`,
                    message: '其中的日记将自动移入「我的日记」，不会丢失任何内容。',
                    confirmText: '删除',
                    destructive: true,
                    icon: 'danger',
                  });
                  if (!ok) return;
                  actions.removeNotebook(nb.id);
                  toast('已删除日记本，日记已归入「我的日记」');
                },
              },
            ]
          : []),
      ],
      nb.name,
    );
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="我的日记本" right={<TextAction label="新建" bold color={c.primaryDark} onPress={openCreate} />} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32, gap: 12 }}>
        <Card
          onPress={() => {
            haptic('light');
            actions.setActiveNotebook(null);
            router.replace('/(tabs)');
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.primaryFaint, alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} color={c.primaryDark} />
            </View>
            <View>
              <Text style={[t.h3, { fontSize: fs(15) }]}>全部日记</Text>
              <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 2 }}>
                聚合显示所有日记本的内容
              </Text>
            </View>
          </View>
          {activeNotebook === null && <Check size={18} color={c.primary} />}
        </Card>

        <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 4 }}>分类日记本（{notebooks.length}）</Text>

        {notebooks.map(nb => {
          const isDefault = nb.id === DEFAULT_NOTEBOOK_ID;
          const cnt = counts.get(nb.id) ?? 0;
          const selected = activeNotebook === nb.id;
          return (
            <Card
              key={nb.id}
              onPress={() => onNotebookPress(nb)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderColor: selected ? c.primary : c.divider,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: `${nb.color}26`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: nb.color }} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={[t.h3, { fontSize: fs(15.5), flexShrink: 1 }]}>{nb.name}</Text>
                    {isDefault && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 999, backgroundColor: c.bgDeep }}>
                        <Text style={{ fontSize: fs(10), color: c.textMuted }}>默认</Text>
                      </View>
                    )}
                    {selected && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 999, backgroundColor: c.primaryFaint }}>
                        <Text style={{ fontSize: fs(10), color: c.primaryDark }}>当前查看</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: fs(12), color: c.textSub, marginTop: 3 }}>共 {cnt} 篇日记</Text>
                </View>
              </View>
              <MoreHorizontal size={18} color={c.textMuted} />
            </Card>
          );
        })}

        <Button
          title="新建日记本"
          variant="soft"
          icon={Plus}
          onPress={openCreate}
          style={{ marginTop: 6 }}
        />
      </ScrollView>

      {/* 新建 / 编辑日记本弹窗 */}
      <BottomSheet visible={modalOpen} onClose={() => setModalOpen(false)} keyboard>
          <View style={{ flexShrink: 1, paddingTop: 6 }}>
            <Text style={[t.h2, { textAlign: 'center', marginBottom: 18 }]}>
              {editing ? '编辑日记本' : '新建日记本'}
            </Text>

            <Text style={{ fontSize: fs(12.5), color: c.textSub, marginBottom: 6 }}>名称</Text>
            <Field
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="例如：读书摘抄、旅行手记、工作复盘…"
              maxLength={16}
            />

            <Text style={{ fontSize: fs(12.5), color: c.textSub, marginTop: 6, marginBottom: 10 }}>主题标识色</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 }}>
              {NOTEBOOK_COLORS.map(col => {
                const picked = colorInput === col;
                return (
                  <Pressable
                    key={col}
                    onPress={() => {
                      haptic('light');
                      setColorInput(col);
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: col,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: picked ? 2.5 : 0,
                      borderColor: c.text,
                    }}
                  >
                    {picked && <Check size={16} color="#fff" strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>

            <Button title={editing ? '保存修改' : '创建日记本'} onPress={saveModal} />
          </View>
      </BottomSheet>
    </Screen>
  );
}
