import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';
import { Audio } from 'expo-av';

const MUTE_STORAGE_KEY = 'arkana_sound_muted_v1';

let isMutedState = false;
let isInitialized = false;
let audioConfigured = false;

const SOUND_CARD_FLIP = require('@/assets/audio/card_flip.wav');
const SOUND_CARD_SHUFFLE = require('@/assets/audio/card_shuffle.wav');
const SOUND_CHIME = require('@/assets/audio/chime.wav');
const SOUND_TAP = require('@/assets/audio/tap.wav');

async function configureAudio() {
  if (audioConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioConfigured = true;
  } catch (err) {
    console.warn('Failed to configure Audio mode:', err);
  }
}

async function playSoundFile(source: any, volume: number = 0.8) {
  try {
    await configureAudio();
    const { sound } = await Audio.Sound.createAsync(
      source,
      { shouldPlay: true, volume },
      (status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      }
    );
  } catch (err) {
    console.warn('Audio playback warning:', err);
  }
}

/**
 * Universal tactile haptic motor trigger.
 * Calls expo-haptics AND native Android Vibration to ensure physical tactile pulses
 * even on Xiaomi/MIUI/HyperOS and devices with system touch vibrations turned off.
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  try {
    if (type === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (type === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (type === 'heavy') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  } catch {}

  // Native Vibration for Android guaranteed motor pulse
  if (Platform.OS === 'android') {
    try {
      if (type === 'light') {
        Vibration.vibrate(28);
      } else if (type === 'medium') {
        Vibration.vibrate(48);
      } else if (type === 'heavy') {
        Vibration.vibrate(75);
      } else if (type === 'success') {
        Vibration.vibrate([0, 35, 50, 45]);
      } else if (type === 'warning' || type === 'error') {
        Vibration.vibrate([0, 50, 60, 50]);
      }
    } catch {}
  }
}

export const soundService = {
  async init(): Promise<boolean> {
    if (isInitialized) return !isMutedState;
    try {
      const stored = await AsyncStorage.getItem(MUTE_STORAGE_KEY);
      if (stored !== null) {
        isMutedState = stored === 'true';
      }
      isInitialized = true;
      await configureAudio();
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

  async playCardFlip(): Promise<void> {
    this.triggerHapticFlip();
    if (isMutedState) return;
    await playSoundFile(SOUND_CARD_FLIP, 0.85);
  },

  async playCardShuffle(): Promise<void> {
    this.triggerHapticShuffle();
    if (isMutedState) return;
    await playSoundFile(SOUND_CARD_SHUFFLE, 0.9);
  },

  async playConsensusSeal(): Promise<void> {
    this.triggerHapticSeal();
    if (isMutedState) return;
    await playSoundFile(SOUND_CHIME, 0.95);
  },

  async playTap(): Promise<void> {
    this.triggerHapticTap();
    if (isMutedState) return;
    await playSoundFile(SOUND_TAP, 0.65);
  },

  triggerHapticFlip(): void {
    triggerHaptic('light');
  },

  triggerHapticShuffle(): void {
    triggerHaptic('medium');
  },

  triggerHapticSeal(): void {
    triggerHaptic('success');
  },

  triggerHapticTap(): void {
    triggerHaptic('light');
  },

  triggerHapticHeavy(): void {
    triggerHaptic('heavy');
  },
};
