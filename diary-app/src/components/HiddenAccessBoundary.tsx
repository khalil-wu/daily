import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { usePathname } from 'expo-router';
import { actions, useStore } from '../store/store';
import { hiddenAccess, isHiddenFlow } from '../utils/hiddenAccess';
import { PinPadView } from './LockGate';
import { goBack } from './ui';

let mountedBoundaries = 0;

/** The protected screen is mounted only after verification, including deep links. */
export function HiddenAccessBoundary({ entryId, required = false, children }: {
  entryId?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const privacy = useStore(state => state.privacy);
  const hidden = useStore(state => !!entryId && !!state.entries.find(entry => entry.id === entryId)?.hidden);
  const path = usePathname();
  const verifiedHash = useSyncExternalStore(hiddenAccess.subscribe, hiddenAccess.snapshot, () => null);
  const unlock = useCallback(() => {
    if (privacy.passcodeHash) hiddenAccess.unlock(privacy.passcodeHash);
  }, [privacy.passcodeHash]);

  useEffect(() => {
    mountedBoundaries++;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') hiddenAccess.lock();
    });
    const visibility = () => { if (document.visibilityState === 'hidden') hiddenAccess.lock(); };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
      mountedBoundaries--;
      if (mountedBoundaries === 0) hiddenAccess.lock();
    };
  }, []);

  useEffect(() => {
    if (!isHiddenFlow(path) || !privacy.appLock || verifiedHash !== privacy.passcodeHash) hiddenAccess.lock();
  }, [path, privacy.appLock, privacy.passcodeHash, verifiedHash]);

  if ((required || hidden) && privacy.lockHidden && privacy.appLock && privacy.passcodeHash && verifiedHash !== privacy.passcodeHash) {
    return <PinPadView title="验证身份查看隐藏日记" allowBiometric={privacy.biometric} onBiometricSuccess={unlock} onClose={goBack}
      onComplete={async code => {
        if (!await actions.verifyPasscode(code)) return '密码不正确';
        unlock();
        return true;
      }} />;
  }
  return <>{children}</>;
}
