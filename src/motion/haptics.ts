import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

async function runNativeHaptic(feedback: () => Promise<void>) {
  if (Platform.OS === 'web') return;

  try {
    await feedback();
  } catch {
    // Haptics are supportive only; interaction should never fail because feedback is unavailable.
  }
}

export function selectionFeedback() {
  return runNativeHaptic(() => Haptics.selectionAsync());
}

export function successFeedback() {
  return runNativeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function warningFeedback() {
  return runNativeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function errorFeedback() {
  return runNativeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

export function lightImpactFeedback() {
  return runNativeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function mediumImpactFeedback() {
  return runNativeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function heavyImpactFeedback() {
  return runNativeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export function rigidImpactFeedback() {
  return runNativeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
}

export function softImpactFeedback() {
  return runNativeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}
