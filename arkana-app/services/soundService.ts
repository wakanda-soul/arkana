import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Vibration, Platform, AppState } from 'react-native';
import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// Auto-pause / resume ambient hang on background/foreground
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    if (isInitialized && !isMutedState && !isAmbientMutedState) {
      soundService.startAmbientHang();
    }
  } else if (nextState.match(/inactive|background/)) {
    soundService.stopAmbientHang();
  }
});

const MUTE_STORAGE_KEY = 'arkana_sound_muted_v1';
const AMBIENT_STORAGE_KEY = 'arkana_ambient_muted_v1';

let isMutedState = false;
let isAmbientMutedState = false;
let isInitialized = false;
let audioConfigured = false;

// 14 Mastered Organic Sound Assets
const SOUND_ASSETS: Record<string, any> = {
  ambient_hang: require('@/assets/audio/ambient_hang_loop.mp3'),
  card_deal: require('@/assets/audio/card_deal.wav'),
  deck_gather: require('@/assets/audio/deck_gather.wav'),
  card_focus: require('@/assets/audio/card_focus.wav'),
  major_arcana_reveal: require('@/assets/audio/major_arcana_reveal.wav'),
  portal_enter: require('@/assets/audio/portal_enter.wav'),
  tab_switch: require('@/assets/audio/tab_switch.wav'),
  modal_close: require('@/assets/audio/modal_close.wav'),
  filter_tab: require('@/assets/audio/filter_tab.wav'),
  wallet_connected: require('@/assets/audio/wallet_connected.wav'),
  wallet_disconnect: require('@/assets/audio/wallet_disconnect.wav'),
  tx_error: require('@/assets/audio/tx_error.wav'),
  burn_ignite: require('@/assets/audio/burn_ignite.wav'),
  oracle_send: require('@/assets/audio/oracle_send.wav'),
};

const cachedUris: Record<string, string> = {};
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

/**
 * Resolves a bundled asset to a local file:// path using expo-asset.
 * This ensures Android ExoPlayer accesses real files on disk instead of
 * failing on obfuscated/compressed resources inside the APK.
 */
async function resolveAndCacheAsset(key: string, source: any): Promise<string> {
  if (cachedUris[key]) return cachedUris[key];
  try {
    const [asset] = await Asset.loadAsync(source);
    const localUri = asset.localUri || asset.uri;
    if (localUri) {
      cachedUris[key] = localUri;
      return localUri;
    }
  } catch (e) {
    console.warn(`[SoundService] Failed to resolve asset ${key}:`, e);
  }
  return '';
}

function getOrCreatePlayer(key: string, source: any): AudioPlayer | null {
  try {
    if (!players[key]) {
      const uri = cachedUris[key];
      const playerSource = uri ? { uri } : source;
      players[key] = createAudioPlayer(playerSource);
    }
    return players[key];
  } catch (err) {
    console.warn(`[SoundService] Failed to create player for ${key}:`, err);
    return null;
  }
}

/**
 * Plays a sound effect with 0ms latency.
 * Non-blocking position reset via seekTo ensures repeated rapid taps
 * never lock up the JavaScript bridge.
 */
function playEffect(key: string, source: any, volume: number = 0.85) {
  if (isMutedState) return;
  try {
    if (!audioConfigured) {
      configureAudio().catch(() => {});
    }
    const player = getOrCreatePlayer(key, source);
    if (!player) return;
    player.volume = volume;
    try {
      player.seekTo(0);
    } catch {}
    player.play();
  } catch (err) {
    console.warn(`[SoundService] Playback warning for ${key}:`, err);
  }
}

/**
 * Universal tactile haptic motor trigger.
 * Dual-driver combining expo-haptics AND native Android Vibration to ensure
 * physical tactile pulses even on Xiaomi/POCO/MIUI/HyperOS with system touch
 * vibrations disabled.
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

  if (Platform.OS === 'android') {
    try {
      if (type === 'light') {
        Vibration.vibrate(28);
      } else if (type === 'medium') {
        Vibration.vibrate(55);
      } else if (type === 'heavy') {
        Vibration.vibrate(85);
      } else if (type === 'success') {
        Vibration.vibrate([0, 35, 45, 40]);
      } else if (type === 'warning' || type === 'error') {
        Vibration.vibrate([0, 45, 55, 45]);
      }
    } catch {}
  }
}

export const soundService = {
  /**
   * Initializes audio system:
   * 1. Reads user preferences from AsyncStorage.
   * 2. Configures Android audio mode.
   * 3. Pre-extracts all audio assets to local disk cache via expo-asset.
   * 4. Pre-warms players for instant 0ms latency playback.
   * 5. Automatically begins ambient hang loop if enabled.
   */
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

      // Resolve and extract all audio assets in parallel into local cache
      const assetKeys = Object.keys(SOUND_ASSETS);
      await Promise.allSettled(
        assetKeys.map(async (key) => {
          const uri = await resolveAndCacheAsset(key, SOUND_ASSETS[key]);
          if (uri) {
            getOrCreatePlayer(key, { uri });
          } else {
            getOrCreatePlayer(key, SOUND_ASSETS[key]);
          }
        })
      );

      // Auto-start ambient hang loop on app launch if unmuted
      if (!isMutedState && !isAmbientMutedState) {
        this.startAmbientHang();
      }
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
    if (isMutedState) {
      this.stopAmbientHang();
    } else if (!isAmbientMutedState) {
      this.startAmbientHang();
    }
    return isMutedState;
  },

  async setMuted(muted: boolean): Promise<void> {
    isMutedState = muted;
    try {
      await AsyncStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    } catch {}
    if (isMutedState) {
      this.stopAmbientHang();
    } else if (!isAmbientMutedState) {
      this.startAmbientHang();
    }
  },

  // --- Approved Sound Effect Triggers ---

  /**
   * Silk slide of card dealt to altar table
   */
  playCardDeal(): void {
    triggerHaptic('light');
    playEffect('card_deal', SOUND_ASSETS.card_deal, 0.9);
  },

  /**
   * Solid altar thump of 78 cards squared after shuffle
   */
  playDeckGather(): void {
    triggerHaptic('medium');
    playEffect('deck_gather', SOUND_ASSETS.deck_gather, 0.95);
  },

  /**
   * Delicate tactile fingertip touch on facedown card
   */
  playCardFocus(): void {
    triggerHaptic('light');
    playEffect('card_focus', SOUND_ASSETS.card_focus, 0.85);
  },

  /**
   * Resonant Tibetan temple gong for Major Arcana card reveals
   */
  playMajorArcanaReveal(): void {
    triggerHaptic('heavy');
    playEffect('major_arcana_reveal', SOUND_ASSETS.major_arcana_reveal, 0.85);
  },

  /**
   * Deep vacuum air whoosh entering the sacred spread arena (1.0s)
   */
  playPortalEnter(): void {
    triggerHaptic('medium');
    playEffect('portal_enter', SOUND_ASSETS.portal_enter, 0.8);
  },

  /**
   * Soft dry tactile click switching bottom navigation tabs
   */
  playTabSwitch(): void {
    triggerHaptic('light');
    playEffect('tab_switch', SOUND_ASSETS.tab_switch, 0.95);
  },

  /**
   * Soft parchment/grimoire settling sound closing modals
   */
  playModalClose(): void {
    triggerHaptic('light');
    playEffect('modal_close', SOUND_ASSETS.modal_close, 0.85);
  },

  /**
   * Deep rich rustle of ancient foliant page turn in Codex
   */
  playFilterTab(): void {
    triggerHaptic('light');
    playEffect('filter_tab', SOUND_ASSETS.filter_tab, 0.85);
  },

  /**
   * Noble temple chord when connecting Solana wallet
   */
  playWalletConnected(): void {
    triggerHaptic('success');
    playEffect('wallet_connected', SOUND_ASSETS.wallet_connected, 0.9);
  },

  /**
   * Minimalist soft tactile click disconnecting wallet (0.2s)
   */
  playWalletDisconnect(): void {
    triggerHaptic('warning');
    playEffect('wallet_disconnect', SOUND_ASSETS.wallet_disconnect, 0.75);
  },

  /**
   * Somber toll of the heavy bronze bell of destiny on transaction failure/error (1.4s)
   */
  playTxError(): void {
    triggerHaptic('error');
    playEffect('tx_error', SOUND_ASSETS.tx_error, 0.85);
  },

  /**
   * Powerful sacred altar flame whoosh on SOL -> SKR burn & offering
   */
  playBurnIgnite(): void {
    triggerHaptic('heavy');
    playEffect('burn_ignite', SOUND_ASSETS.burn_ignite, 0.8);
  },

  /**
   * Tactile scroll click with subtle air trail sending question to oracle (0.12s)
   */
  playOracleSend(): void {
    triggerHaptic('light');
    playEffect('oracle_send', SOUND_ASSETS.oracle_send, 0.85);
  },

  /**
   * Background Hang Ambient: 90s seamless loop of authentic handpan
   */
  startAmbientHang(volume: number = 0.22): void {
    if (isMutedState || isAmbientMutedState) return;
    try {
      if (!audioConfigured) {
        configureAudio().catch(() => {});
      }
      if (!ambientPlayer) {
        const uri = cachedUris['ambient_hang'];
        const source = uri ? { uri } : SOUND_ASSETS.ambient_hang;
        ambientPlayer = createAudioPlayer(source);
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

  playCardFlip(): void {
    this.playCardDeal();
  },

  playCardShuffle(): void {
    this.playDeckGather();
  },

  playConsensusSeal(): void {
    this.playMajorArcanaReveal();
  },

  playTap(): void {
    this.playTabSwitch();
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
