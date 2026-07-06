import { useState } from 'react';
import { router } from 'expo-router';
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

export default function CreatePersonScreen() {
  const addPerson = useDiaryStore((state) => state.addPerson);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState(relations[0]);
  const [note, setNote] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    const person = addPerson({ name, relation, note, avatarUri });
    router.replace(`/person/${person.id}`);
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
          <Pressable accessibilityRole="button" accessibilityLabel="取消新增人物" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>取消</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>你想记住谁？</Text>

        <Pressable accessibilityRole="button" accessibilityLabel="上传人物头像" onPress={() => void pickAvatar()} style={styles.avatarWrap}>
          <Avatar name={name.trim() || '新'} size={88} highlighted avatarUri={avatarUri} />
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

        <PrimaryButton label="记住这个人" onPress={save} disabled={!canSave} />
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
    justifyContent: 'flex-start',
  },
  cancel: {
    color: colors.textSecondary,
    fontFamily: typography.fontFamily.display,
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    includeFontPadding: false,
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
    borderBottomWidth: strokeWidth.input,
    borderBottomColor: colors.stroke,
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
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSecondary,
    borderWidth: strokeWidth.input,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
});
