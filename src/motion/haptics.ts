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
