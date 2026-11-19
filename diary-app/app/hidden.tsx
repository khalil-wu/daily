import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { actions, useStore } from '../src/store/store';
import { EmptyState, NavBar, Screen, goBack } from '../src/components/ui';
import { EntryListCard } from '../src/components/EntryCard';
import { PinPadView } from '../src/components/LockGate';
import { IMAGES } from '../src/data/assets';

/** 隐藏日记列表（如已设置应用锁，则需验证后进入） */
export default function HiddenEntriesScreen() {
  const entries = useStore(s => s.entries);
  const privacy = useStore(s => s.privacy);
  const [unlocked, setUnlocked] = useState(!(privacy.appLock && privacy.passcodeHash));

  const list = useMemo(
    () => entries.filter(e => !e.deletedAt && e.hidden).sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  );

  if (!unlocked) {
    return (
      <PinPadView
        title="验证身份查看隐藏日记"
        allowBiometric={privacy.biometric}
        onBiometricSuccess={() => setUnlocked(true)}
        onClose={goBack}
        onComplete={async code => {
          const ok = await actions.verifyPasscode(code);
          if (!ok) return '密码不正确';
          setUnlocked(true);
          return true;
        }}
      />
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <NavBar title="隐藏日记" />
      {list.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            image={IMAGES.emptyBook}
            imageSize={170}
            title="没有隐藏的日记"
            desc="在日记详情页右上角“···”中可以将私密日记隐藏，保护个人空间。"
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 }}>
          {list.map(e => (
            <EntryListCard key={e.id} entry={e} onPress={() => router.push({ pathname: '/memory/[id]', params: { id: e.id } })} />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
