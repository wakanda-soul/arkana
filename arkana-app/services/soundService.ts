import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Vibration, Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

const MUTE_STORAGE_KEY = 'arkana_sound_muted_v1';
const AMBIENT_STORAGE_KEY = 'arkana_ambient_muted_v1';

let isMutedState = false;
let isAmbientMutedState = false;
let isInitialized = false;
let audioConfigured = false;

// 14 Approved Sound Assets
const SOUND_AMBIENT_HANG = require('@/assets/audio/ambient_hang_loop.mp3');
const SOUND_CARD_DEAL = require('@/assets/audio/card_deal.wav');
const SOUND_DECK_GATHER = require('@/assets/audio/deck_gather.wav');
const SOUND_CARD_FOCUS = require('@/assets/audio/card_focus.wav');
const SOUND_MAJOR_ARCANA_REVEAL = require('@/assets/audio/major_arcana_reveal.wav');
const SOUND_PORTAL_ENTER = require('@/assets/audio/portal_enter.wav');
const SOUND_TAB_SWITCH = require('@/assets/audio/tab_switch.wav');
const SOUND_MODAL_CLOSE = require('@/assets/audio/modal_close.wav');
const SOUND_FILTER_TAB = require('@/assets/audio/filter_tab.wav');
const SOUND_WALLET_CONNECTED = require('@/assets/audio/wallet_connected.wav');
const SOUND_WALLET_DISCONNECT = require('@/assets/audio/wallet_disconnect.wav');
const SOUND_TX_ERROR = require('@/assets/audio/tx_error.wav');
const SOUND_BURN_IGNITE = require('@/assets/audio/burn_ignite.wav');
const SOUND_ORACLE_SEND = require('@/assets/audio/oracle_send.wav');

const players: Record<string, AudioPlayer | null> = {};
let ambientPlayer: AudioPlayer | null = null;

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
        Vibration.vibrate(25);
      } else if (type === 'medium') {
        Vibration.vibrate(50);
      } else if (type === 'heavy') {
        Vibration.vibrate(80);
      } else if (type === 'success') {
        Vibration.vibrate([0, 35, 45, 40]);
      } else if (type === 'warning' || type === 'error') {
        Vibration.vibrate([0, 45, 55, 45]);
      }
    } catch {}
  }
}

export const soundService = {
  async init(): Promise<boolean> {
    if (isInitialized) return !isMutedState;
    try {
      const storedMute = await AsyncStorage.getItem(MUTE_STORAGE_KEY);
      if (storedMute !== null) {
        isMutedState = storedMute === 'true';
      }
      const storedAmbient = await AsyncStorage.getItem(AMBIENT_STORAGE_KEY);
      if (storedAmbient !== null) {
        isAmbientMutedState = storedAmbient === 'true';
      }
      isInitialized = true;
      await configureAudio();

      // Pre-warm high-frequency UI sound players for instant latency-free clicks
      getOrCreatePlayer('tab_switch', SOUND_TAB_SWITCH);
      getOrCreatePlayer('card_deal', SOUND_CARD_DEAL);
      getOrCreatePlayer('deck_gather', SOUND_DECK_GATHER);
      getOrCreatePlayer('card_focus', SOUND_CARD_FOCUS);
      getOrCreatePlayer('modal_close', SOUND_MODAL_CLOSE);
    } catch (e) {
      console.warn('[SoundService] Init error:', e);
    }
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
    if (isMutedState && ambientPlayer) {
      try {
        ambientPlayer.pause();
      } catch {}
    }
    return isMutedState;
  },

  async setMuted(muted: boolean): Promise<void> {
    isMutedState = muted;
    try {
      await AsyncStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    } catch {}
    if (isMutedState && ambientPlayer) {
      try {
        ambientPlayer.pause();
      } catch {}
    }
  },

  // --- Approved Sound Effect Triggers ---

  /**
   * Silk slide of card dealt to altar table (User's Drive card_deal.mp3)
   */
  async playCardDeal(): Promise<void> {
    triggerHaptic('light');
    await playEffect('card_deal', SOUND_CARD_DEAL, 0.85);
  },

  /**
   * Solid altar thump of 78 cards squared after shuffle
   */
  async playDeckGather(): Promise<void> {
    triggerHaptic('medium');
    await playEffect('deck_gather', SOUND_DECK_GATHER, 0.9);
  },

  /**
   * Delicate tactile fingertip touch on facedown card
   */
  async playCardFocus(): Promise<void> {
    triggerHaptic('light');
    await playEffect('card_focus', SOUND_CARD_FOCUS, 0.8);
  },

  /**
   * Resonant Tibetan temple gong for Major Arcana card reveals
   */
  async playMajorArcanaReveal(): Promise<void> {
    triggerHaptic('heavy');
    await playEffect('major_arcana_reveal', SOUND_MAJOR_ARCANA_REVEAL, 0.95);
  },

  /**
   * Deep vacuum air whoosh entering the sacred spread arena (1.0s)
   */
  async playPortalEnter(): Promise<void> {
    triggerHaptic('medium');
    await playEffect('portal_enter', SOUND_PORTAL_ENTER, 0.85);
  },

  /**
   * Soft dry tactile click switching bottom navigation tabs
   */
  async playTabSwitch(): Promise<void> {
    triggerHaptic('light');
    await playEffect('tab_switch', SOUND_TAB_SWITCH, 0.7);
  },

  /**
   * Soft parchment/grimoire settling sound closing modals
   */
  async playModalClose(): Promise<void> {
    triggerHaptic('light');
    await playEffect('modal_close', SOUND_MODAL_CLOSE, 0.8);
  },

  /**
   * Deep rich rustle of ancient foliant page turn in Codex
   */
  async playFilterTab(): Promise<void> {
    triggerHaptic('light');
    await playEffect('filter_tab', SOUND_FILTER_TAB, 0.8);
  },

  /**
   * Noble temple chord when connecting Solana wallet (User's Drive chord)
   */
  async playWalletConnected(): Promise<void> {
    triggerHaptic('success');
    await playEffect('wallet_connected', SOUND_WALLET_CONNECTED, 0.85);
  },

  /**
   * Minimalist soft tactile click disconnecting wallet (0.2s)
   */
  async playWalletDisconnect(): Promise<void> {
    triggerHaptic('warning');
    await playEffect('wallet_disconnect', SOUND_WALLET_DISCONNECT, 0.75);
  },

  /**
   * Somber toll of the heavy bronze bell of destiny on transaction failure/error (1.4s)
   */
  async playTxError(): Promise<void> {
    triggerHaptic('error');
    await playEffect('tx_error', SOUND_TX_ERROR, 0.9);
  },

  /**
   * Powerful sacred altar flame whoosh on SOL -> SKR burn & offering
   */
  async playBurnIgnite(): Promise<void> {
    triggerHaptic('heavy');
    await playEffect('burn_ignite', SOUND_BURN_IGNITE, 0.9);
  },

  /**
   * Tactile scroll click with subtle air trail sending question to oracle (0.12s)
   */
  async playOracleSend(): Promise<void> {
    triggerHaptic('light');
    await playEffect('oracle_send', SOUND_ORACLE_SEND, 0.8);
  },

  /**
   * Background Hang Ambient: 90s seamless loop of authentic handpan
   */
  async startAmbientHang(volume: number = 0.28): Promise<void> {
    if (isMutedState || isAmbientMutedState) return;
    try {
      await configureAudio();
      if (!ambientPlayer) {
        ambientPlayer = createAudioPlayer(SOUND_AMBIENT_HANG);
        ambientPlayer.loop = true;
      }
      ambientPlayer.volume = volume;
      ambientPlayer.play();
    } catch (err) {
      console.warn('[SoundService] Ambient playback warning:', err);
    }
  },

  stopAmbientHang(): void {
    if (ambientPlayer) {
      try {
        ambientPlayer.pause();
      } catch {}
    }
  },

  isAmbientMuted(): boolean {
    return isAmbientMutedState;
  },

  async toggleAmbient(): Promise<boolean> {
    isAmbientMutedState = !isAmbientMutedState;
    try {
      await AsyncStorage.setItem(AMBIENT_STORAGE_KEY, String(isAmbientMutedState));
    } catch {}
    if (isAmbientMutedState) {
      this.stopAmbientHang();
    } else if (!isMutedState) {
      this.startAmbientHang();
    }
    return isAmbientMutedState;
  },

  // --- Backward Compatibility Aliases ---

  async playCardFlip(): Promise<void> {
    await this.playCardDeal();
  },

  async playCardShuffle(): Promise<void> {
    await this.playDeckGather();
  },

  async playConsensusSeal(): Promise<void> {
    await this.playMajorArcanaReveal();
  },

  async playTap(): Promise<void> {
    await this.playTabSwitch();
  },

  triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): void {
    triggerHaptic(type);
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
