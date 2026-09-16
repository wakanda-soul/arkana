import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@arkana_unlocked_cards_v1';

// Initially zero cards unlocked; cards are discovered organically through readings and rituals
export const STARTER_UNLOCKED_CARDS: string[] = [];

/**
 * Retrieve the set of card numbers unlocked by the user
 */
export async function getUnlockedCards(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Initialize with starter set
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(STARTER_UNLOCKED_CARDS));
      return STARTER_UNLOCKED_CARDS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(new Set([...STARTER_UNLOCKED_CARDS, ...parsed]));
    }
    return STARTER_UNLOCKED_CARDS;
  } catch {
    return STARTER_UNLOCKED_CARDS;
  }
}

/**
 * Unlock newly drawn cards and persist to storage
 */
export async function unlockCards(newCardNos: string[]): Promise<string[]> {
  try {
    const current = await getUnlockedCards();
    const updated = Array.from(new Set([...current, ...newCardNos]));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return STARTER_UNLOCKED_CARDS;
  }
}
