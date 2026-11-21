import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, Platform, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Stack, router, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { FeedbackProvider } from '../src/components/feedback';
import { PinPadView } from '../src/components/LockGate';
import { TutorialOverlay } from '../src/components/TutorialOverlay';
import { actions, closeTutorial, hydrate, useActiveTour, useHydrated, useStore } from '../src/store/store';
import { isAutoBackupDue, writeAutoBackup } from '../src/services/autoBackup';
import { IMAGES } from '../src/data/assets';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** 1. 启动页（品牌与氛围 - 1:1 复刻设计稿1 #1） */
function SplashOverlay({ onDone }: { onDone: () => void }) {
  const { t, fs } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 380, useNativeDriver: Platform.OS !== 'web' }).start(onDone);
    }, 900);
    return () => clearTimeout(timer);
  }, [opacity, onDone]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 99, backgroundColor: '#F8F5EF', opacity }]}>
      <Image source={IMAGES.splash} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="cover" />
      <View style={{ flex: 1, alignItems: 'center', paddingTop: '44%' }}>
        <Text style={[t.display, { fontSize: fs(34), color: '#2F2A26', letterSpacing: 4 }]}>记得日记</Text>
        <Text style={{ fontSize: fs(14), color: '#7A746E', marginTop: 12, letterSpacing: 1.5 }}>记下生活，记得自己</Text>
      </View>
    </Animated.View>
  );
}

function AppShell() {
  const { c, dark } = useTheme();
  const hydrated = useHydrated();
  const privacy = useStore(s => s.privacy);
  const onboarded = useStore(s => s.onboarded);
  const activeTour = useActiveTour();
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const [showSplash, setShowSplash] = useState(true);
  const [locked, setLocked] = useState(false);
  const lockInit = useRef(false);
  const bgAt = useRef<number | null>(null);

  // 路由守卫：未完成引导时，深链进来的任何页面都先回到引导流程
  useEffect(() => {
    if (!hydrated || onboarded) return;
    const publicPaths = ['/onboarding', '/auth/choose', '/auth/login', '/auth/register', '/auth/forgot'];
    if (!publicPaths.includes(pathname)) router.replace('/onboarding');
  }, [hydrated, onboarded, pathname]);

  useEffect(() => {
    if (!hydrated || lockInit.current) return;
    lockInit.current = true;
    actions.purgeExpiredTrash();
    // 自动备份：到期才写，失败不打扰用户（下次启动再试）
    const snap = actions.snapshot();
    if (isAutoBackupDue(snap)) {
      void writeAutoBackup(snap).then(() => actions.setBackup({ lastBackupAt: Date.now() })).catch(() => undefined);
    }
    if (onboarded && privacy.appLock && privacy.passcodeHash) {
      setLocked(true);
    }
  }, [hydrated, onboarded, privacy.appLock, privacy.passcodeHash]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (!privacy.appLock || !privacy.passcodeHash || !onboarded) return;
      if (next === 'background' || next === 'inactive') {
        bgAt.current = Date.now();
      } else if (next === 'active' && bgAt.current !== null) {
        const elapsedSec = (Date.now() - bgAt.current) / 1000;
        bgAt.current = null;
        if (elapsedSec >= privacy.lockDelay) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [privacy.appLock, privacy.passcodeHash, privacy.lockDelay, onboarded]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void SystemUI.setBackgroundColorAsync(c.bg).catch(() => {});
    }
  }, [c.bg]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(res => {
      if (res.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && pathRef.current !== '/write') {
        router.push('/write');
      }
    });
    return () => sub.remove();
  }, []);

  const framedWeb = Platform.OS === 'web' && width >= 520;
  const tallFrame = framedWeb && height >= 740;

  const content = (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {hydrated ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/choose" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/forgot" />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="write" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="saved" options={{ animation: 'fade' }} />
        <Stack.Screen name="memory/[id]" />
        <Stack.Screen name="search" />
        <Stack.Screen name="notebooks" />
        <Stack.Screen name="annual-report" />
        <Stack.Screen name="templates" />
        <Stack.Screen name="drafts" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="trash" />
        <Stack.Screen name="photos" />
        <Stack.Screen name="memory-map" />
        <Stack.Screen name="hidden" />
        <Stack.Screen name="sync-conflict" />
        <Stack.Screen name="offline" />
        <Stack.Screen name="picker/mood" />
        <Stack.Screen name="picker/tags" />
        <Stack.Screen name="picker/photos" />
        <Stack.Screen name="picker/audio" />
        <Stack.Screen name="picker/video" />
        <Stack.Screen name="picker/location" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/reminders" />
        <Stack.Screen name="settings/reminder-time" />
        <Stack.Screen name="settings/appearance" />
        <Stack.Screen name="settings/typography" />
        <Stack.Screen name="settings/goals" />
        <Stack.Screen name="settings/privacy" />
        <Stack.Screen name="settings/backup" />
        <Stack.Screen name="settings/transfer" />
        <Stack.Screen name="settings/delete-account" />
        <Stack.Screen name="settings/help" />
        <Stack.Screen name="settings/about" />
      </Stack>
      ) : (
        <View style={{ flex: 1, backgroundColor: c.bg }} />
      )}

      {locked && (
        <View style={StyleSheet.absoluteFill}>
          <PinPadView
            title="请输入应用锁密码"
            allowBiometric={privacy.biometric}
            onBiometricSuccess={() => setLocked(false)}
            onComplete={async code => {
              const ok = await actions.verifyPasscode(code);
              if (!ok) return '密码不正确，请重试';
              setLocked(false);
              return true;
            }}
          />
        </View>
      )}

      {/* 新手导览：启动页淡出、应用锁解开之后才开始 */}
      <TutorialOverlay
        tour={showSplash || locked ? null : activeTour}
        onFinish={tour => {
          closeTutorial();
          if (tour === 'home') actions.setTutorialSeen(true);
          else actions.setEditorTourSeen(true);
        }}
      />

      {showSplash && <SplashOverlay onDone={() => setShowSplash(false)} />}
    </View>
  );

  if (!framedWeb) return content;

  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#110F0D' : '#E9E2D8', alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={[
          {
            width: '100%',
            maxWidth: 420,
            flex: 1,
            maxHeight: tallFrame ? 880 : undefined,
            overflow: 'hidden',
            backgroundColor: c.bg,
            borderRadius: tallFrame ? 36 : 0,
            marginVertical: tallFrame ? 16 : 0,
            borderWidth: tallFrame ? 1 : 0,
            borderColor: c.divider,
          },
          tallFrame && ({ boxShadow: dark ? '0 24px 64px rgba(0,0,0,0.55)' : '0 22px 56px rgba(47,42,38,0.14)' } as ViewStyle),
        ]}
      >
        {content}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoSerifSC: require('../assets/fonts/NotoSerifSC-Regular.otf'),
    'NotoSerifSC-SemiBold': require('../assets/fonts/NotoSerifSC-SemiBold.otf'),
  });

  useEffect(() => {
    void hydrate();
  }, []);

  const hydrated = useHydrated();
  if (!hydrated || !fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#F8F5EF' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <FeedbackProvider>
            <AppShell />
          </FeedbackProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
