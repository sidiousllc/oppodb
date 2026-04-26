import { useEffect, useState, useCallback } from 'react';
import { Geolocation, Position, GeoPositionOptions } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface GeolocationState {
  position: Position | null;
  error: string | null;
  loading: boolean;
  hasPermission: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    loading: false,
    hasPermission: false,
  });

  const checkPermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setState(s => ({ ...s, hasPermission: true }));
      return true;
    }
    try {
      const perm = await Geolocation.checkPermissions();
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      setState(s => ({ ...s, hasPermission: granted }));
      return granted;
    } catch {
      setState(s => ({ ...s, hasPermission: false, error: 'Permission check failed' }));
      return false;
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      const perm = await Geolocation.requestPermissions();
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      setState(s => ({ ...s, hasPermission: granted }));
      return granted;
    } catch {
      setState(s => ({ ...s, hasPermission: false }));
      return false;
    }
  }, []);

  const getCurrentPosition = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const geoOptions: GeoPositionOptions = {
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        timeout: options.timeout ?? 10000,
        maximumAge: options.maximumAge ?? 0,
      };
      const position = await Geolocation.getCurrentPosition(geoOptions);
      setState({ position, error: null, loading: false, hasPermission: true });
      return position;
    } catch (err: any) {
      const msg = err?.message || 'Failed to get position';
      setState(s => ({ ...s, error: msg, loading: false }));
      return null;
    }
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    ...state,
    checkPermission,
    requestPermission,
    getCurrentPosition,
  };
}

/**
 * Standalone single-shot position getter.
 */
export async function getCurrentPosition(options?: UseGeolocationOptions): Promise<Position | null> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to browser geolocation
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude: pos.coords.altitude ?? 0,
            accuracy: pos.coords.accuracy,
            altitudeAccuracy: pos.coords.altitudeAccuracy ?? 0,
            heading: pos.coords.heading ?? 0,
            speed: pos.coords.speed ?? 0,
          },
          timestamp: pos.timestamp,
          mocked: false,
        }),
        () => resolve(null),
        { timeout: options?.timeout ?? 10000, enableHighAccuracy: options?.enableHighAccuracy ?? false }
      );
    });
  }
  try {
    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: options?.enableHighAccuracy ?? false,
      timeout: options?.timeout ?? 10000,
      maximumAge: options?.maximumAge ?? 0,
    });
  } catch {
    return null;
  }
}
