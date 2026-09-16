import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const MUTE_STORAGE_KEY = 'arkana_sound_muted_v1';

let isMutedState = false;
let isInitialized = false;

export const soundService = {
  async init(): Promise<boolean> {
    if (isInitialized) return !isMutedState;
    try {
      const stored = await AsyncStorage.getItem(MUTE_STORAGE_KEY);
      if (stored !== null) {
        isMutedState = stored === 'true';
      }
      isInitialized = true;
    } catch {}
    return !isMutedState;
  },

  isMuted(): boolean {
    return isMutedState;
  },

  async toggleMute(): Promise<boolean> {
    isMutedState = !isMutedState;
    try {
      await AsyncStorage.setItem(MUTE_STORAGE_KEY, String(isMutedState));
    } catch {}
    return isMutedState;
  },

  async setMuted(muted: boolean): Promise<void> {
    isMutedState = muted;
    try {
      await AsyncStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    } catch {}
  },

  playCardFlip(): void {
    if (isMutedState) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },

  playCardShuffle(): void {
    if (isMutedState) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },

  playConsensusSeal(): void {
    if (isMutedState) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },

  triggerHapticFlip(): void {
    this.playCardFlip();
  },

  triggerHapticShuffle(): void {
    this.playCardShuffle();
  },

  triggerHapticSeal(): void {
    this.playConsensusSeal();
  },
};
