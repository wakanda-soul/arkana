import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

const MUTE_STORAGE_KEY = 'arkana_sound_muted_v1';

let isMutedState = false;
let isInitialized = false;
let audioConfigured = false;

const SOUND_CARD_FLIP = require('@/assets/audio/card_flip.wav');
const SOUND_CARD_SHUFFLE = require('@/assets/audio/card_shuffle.wav');
const SOUND_CHIME = require('@/assets/audio/chime.wav');
const SOUND_TAP = require('@/assets/audio/tap.wav');

const players: Record<string, AudioPlayer | null> = {};

async function configureAudio() {
  if (audioConfigured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
    audioConfigured = true;
  } catch (err) {
    console.warn('[SoundService] Failed to configure Audio mode:', err);
  }
}

function getOrCreatePlayer(key: string, source: any): AudioPlayer | null {
  try {
    if (!players[key]) {
      players[key] = createAudioPlayer(source);
    }
    return players[key];
  } catch (err) {
    console.warn(`[SoundService] Failed to create player for ${key}:`, err);
    return null;
  }
}

async function playEffect(key: string, source: any, volume: number = 0.8) {
  if (isMutedState) return;
  try {
    await configureAudio();
    const player = getOrCreatePlayer(key, source);
    if (!player) return;
    player.volume = volume;
    if (player.currentTime > 0) {
      await player.seekTo(0);
    }
    player.play();
  } catch (err) {
    console.warn(`[SoundService] Playback warning for ${key}:`, err);
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
        Vibration.vibrate(30);
      } else if (type === 'medium') {
        Vibration.vibrate(55);
      } else if (type === 'heavy') {
        Vibration.vibrate(85);
      } else if (type === 'success') {
        Vibration.vibrate([0, 40, 50, 45]);
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
      // Pre-warm audio players for instant feedback
      getOrCreatePlayer('card_flip', SOUND_CARD_FLIP);
      getOrCreatePlayer('card_shuffle', SOUND_CARD_SHUFFLE);
      getOrCreatePlayer('chime', SOUND_CHIME);
      getOrCreatePlayer('tap', SOUND_TAP);
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
    await playEffect('card_flip', SOUND_CARD_FLIP, 0.85);
  },

  async playCardShuffle(): Promise<void> {
    this.triggerHapticShuffle();
    if (isMutedState) return;
    await playEffect('card_shuffle', SOUND_CARD_SHUFFLE, 0.9);
  },

  async playConsensusSeal(): Promise<void> {
    this.triggerHapticSeal();
    if (isMutedState) return;
    await playEffect('chime', SOUND_CHIME, 0.95);
  },

  async playTap(): Promise<void> {
    this.triggerHapticTap();
    if (isMutedState) return;
    await playEffect('tap', SOUND_TAP, 0.65);
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
