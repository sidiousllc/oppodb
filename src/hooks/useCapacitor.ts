import { useEffect, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Toast } from '@capacitor/toast';
import { Motion } from '@capacitor/motion';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to initialize Capacitor native integrations.
 * Safe to call on web/desktop — all methods are no-ops there.
 */
export function useCapacitor() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const hideStatusBar = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.hide();
    } catch {}
  };

  const showStatusBar = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.show();
    } catch {}
  };

  const hapticFeedback = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
      await Haptics.impact({ style: map[style] });
    } catch {}
  };

  const vibrate = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.vibrate({ duration: 100 });
    } catch {}
  };

  const showToast = async (message: string, duration: 'short' | 'long' = 'short') => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Toast.show({ text: message, duration: duration === 'long' ? 'long' : 'short' });
    } catch {}
  };

  const requestMotionPermission = async () => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      await Motion.addListener('accel', () => {});
      return true;
    } catch {
      return false;
    }
  };

  return { isNative, hideStatusBar, showStatusBar, hapticFeedback, vibrate, showToast, requestMotionPermission };
}
