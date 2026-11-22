import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useHydrated, useStore } from '../src/store/store';
import { useTheme } from '../src/theme/ThemeProvider';

export default function Index() {
  const hydrated = useHydrated();
  const onboarded = useStore(s => s.onboarded);
  const { c } = useTheme();

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return <Redirect href={onboarded ? '/shelf' : '/onboarding'} />;
}
