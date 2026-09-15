import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

const MUTE_STORAGE_KEY = 'arkana_sound_muted_v1';

let isMutedState = false;
let isInitialized = false;

function generateWavDataUri(
  durationSec: number,
  sampleRate: number,
  genFn: (t: number, duration: number) => number
): string {
  const numSamples = Math.floor(durationSec * sampleRate);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.max(-1, Math.min(1, genFn(t, durationSec)));
    const intSample = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return 'data:audio/wav;base64,' + buffer.toString('base64');
}

// 1. Card flip/deal: snappy mechanical tick and quick acoustic whoosh
const FLIP_URI = generateWavDataUri(0.05, 22050, (t) => {
  const env = Math.exp(-t * 90);
  const click = Math.sin(2 * Math.PI * (1400 - t * 10000) * t);
  return env * click;
});

// 2. Card shuffle: 3 rhythmic flutter pulses
const SHUFFLE_URI = generateWavDataUri(0.18, 22050, (t) => {
  const pulse = Math.sin(2 * Math.PI * 25 * t);
  const env = Math.abs(pulse) * Math.exp(-t * 12);
  const noise = (Math.sin(2 * Math.PI * 1800 * t) + Math.sin(2 * Math.PI * 900 * t)) * 0.5;
  return env * noise;
});

// 3. Sacred seal / consensus chime: resonant D-pentatonic gong
const GONG_URI = generateWavDataUri(0.85, 22050, (t) => {
  const env = Math.exp(-t * 3.8);
  const f1 = Math.sin(2 * Math.PI * 587.33 * t); // D5
  const f2 = Math.sin(2 * Math.PI * 880.00 * t) * 0.4; // A5
  const f3 = Math.sin(2 * Math.PI * 1174.66 * t) * 0.2; // D6
  return env * (f1 + f2 + f3);
});

async function playUri(uri: string, volume: number = 0.6) {
  if (isMutedState) return;

  try {
    const { Audio } = await import('expo-av');
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume }
    );

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (err) {
    // Graceful fallback: audio failure should never interrupt UI
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
    playUri(FLIP_URI, 0.4);
  },

  playCardShuffle(): void {
    playUri(SHUFFLE_URI, 0.5);
  },

  playConsensusSeal(): void {
    playUri(GONG_URI, 0.8);
  },
};
