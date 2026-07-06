import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/src/components/person/Avatar';
import { PrimaryButton } from '@/src/components/ui/PrimaryButton';
import { Screen } from '@/src/components/ui/Screen';
import { selectionFeedback } from '@/src/motion';
import { persistPickedAvatar } from '@/src/storage/mediaStorage';
import { useDiaryStore } from '@/src/stores/useDiaryStore';
import { alpha, colors, radius, spacing, strokeWidth, typography } from '@/src/theme';

const relations = ['母亲', '父亲', '朋友', '恋人', '亲人', '宠物', '自己', '其他'];

export default function EditPersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const people = useDiaryStore((state) => state.people);
  const updatePerson = useDiaryStore((state) => state.updatePerson);
  const person = people.find((item) => item.id === id);
  const [name, setName] = useState(person?.name ?? '');
  const [relation, setRelation] = useState(person?.relation ?? relations[0]);
  const [note, setNote] = useState(person?.note ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(person?.avatarUri ?? null);
  const [isPrivate, setIsPrivate] = useState(person?.isPrivate ?? false);
  const [privacyMode, setPrivacyMode] = useState<'hidden' | 'masked'>(person?.privacyMode ?? 'hidden');

  const canSave = name.trim().length > 0;

  if (!person) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <Text style={styles.empty}>没找到这个人。</Text>
          <PrimaryButton label="回去看看" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const save = () => {
    if (!canSave) return;
    updatePerson({ id: person.id, name, relation, note, avatarUri, isPrivate, privacyMode });
    router.back();
  };

  const pickAvatar = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要照片权限', '允许访问照片后，就能给这个人换一张头像。');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: Platform.OS === 'web',
    });

    if (!result.canceled) {
      setAvatarUri(await persistPickedAvatar(result.assets[0]));
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="取消编辑人物" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>取消</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="保存人物"
            accessibilityState={{ disabled: !canSave }}
            onPress={save}
            hitSlop={12}
            disabled={!canSave}
          >
            <Text style={[styles.save, !canSave && styles.saveDisabled]}>保存</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>改一改这个人</Text>

        <Pressable accessibilityRole="button" accessibilityLabel="更换人物头像" onPress={() => void pickAvatar()} style={styles.avatarWrap}>
          <Avatar name={name.trim() || person.name} size={88} highlighted={person.recent} avatarUri={avatarUri} />
          <Text style={styles.helper}>{avatarUri ? '换一张头像' : '上传头像'}</Text>
        </Pressable>

        <View style={styles.formBlock}>
          <Text style={styles.label}>名字</Text>
          <TextInput
            accessibilityLabel="名字"
            value={name}
            onChangeText={setName}
            placeholder="写下名字"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            autoFocus
          />
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>关系</Text>
          <View style={styles.relationWrap}>
            {relations.map((item) => {
              const active = item === relation;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`关系：${item}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    if (!active) void selectionFeedback();
                    setRelation(item);
                  }}
                  style={[styles.relationPill, active && styles.relationPillActive]}
                >
                  <Text style={[styles.relationText, active && styles.relationTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.formBlock}>
          <Text style={styles.label}>他/她在你生命里是什么样的人？</Text>
          <TextInput
            accessibilityLabel="备注"
            placeholder="一句话就好"
            placeholderTextColor={colors.textTertiary}
            value={note}
            onChangeText={setNote}
            style={[styles.input, styles.multiline]}
            multiline
          />
        </View>

        <View style={styles.formBlock}>
          <View style={styles.privacyHeader}>
            <Text style={styles.label}>私密人物</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="私密人物开关"
              accessibilityState={{ checked: isPrivate }}
              onPress={() => {
                void selectionFeedback();
                setIsPrivate((value) => !value);
              }}
              style={[styles.toggle, isPrivate && styles.toggleActive]}
            >
              <View style={[styles.toggleKnob, isPrivate && styles.toggleKnobActive]} />
            </Pressable>
          </View>
          <Text style={styles.helper}>开启后，这位人物和 ta 相关的记忆会一起被保护起来。</Text>

          {isPrivate ? (
            <View style={styles.relationWrap}>
              {(
                [
                  { key: 'hidden', label: '完全隐藏', hint: '从星图和列表里消失' },
                  { key: 'masked', label: '模糊占位', hint: '显示为「私密人物」' },
                ] as const
              ).map((item) => {
                const active = item.key === privacyMode;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={`隐私模式：${item.label}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      if (!active) void selectionFeedback();
                      setPrivacyMode(item.key);
                    }}
                    style={[styles.relationPill, active && styles.relationPillActive]}
                  >
                    <Text style={[styles.relationText, active && styles.relationTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
  },
  save: {
    color: colors.accent,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  saveDisabled: {
    opacity: 0.35,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.display,
    lineHeight: typography.lineHeights.display,
    fontWeight: '500',
    includeFontPadding: false,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  helper: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    includeFontPadding: false,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: colors.bgWash,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
  },
  toggleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: radius.circle,
    backgroundColor: colors.bgPaper,
    transform: [{ translateX: 0 }],
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },
  formBlock: {
    gap: spacing.md,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.title,
    fontWeight: '500',
    lineHeight: typography.lineHeights.title,
    includeFontPadding: false,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    paddingVertical: spacing.md,
    includeFontPadding: false,
  },
  multiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  relationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  relationPill: {
    borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  relationPillActive: {
    backgroundColor: alpha.accent10,
  },
  relationText: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: '500',
    includeFontPadding: false,
  },
  relationTextActive: {
    color: colors.accent,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  empty: {
    color: colors.textTertiary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
