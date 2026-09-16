import AsyncStorage from '@react-native-async-storage/async-storage';

const REMINDER_STORAGE_KEY = 'arkana_daily_consensus_reminder_target_v1';

export const notificationService = {
  /**
   * Request notification capability
   */
  async requestPermission(): Promise<boolean> {
    return true;
  },

  /**
   * Schedule local reminder for next daily block
   * @param secondsFromNow Duration in seconds (default 24h = 86400s)
   */
  async scheduleDailyConsensusReminder(secondsFromNow: number = 86400): Promise<string | null> {
    try {
      const targetTime = Date.now() + Math.max(60, secondsFromNow) * 1000;
      await AsyncStorage.setItem(REMINDER_STORAGE_KEY, String(targetTime));
      return String(targetTime);
    } catch {
      return null;
    }
  },

  /**
   * Cancel active daily consensus reminder
   */
  async cancelReminder(): Promise<void> {
    try {
      await AsyncStorage.removeItem(REMINDER_STORAGE_KEY);
    } catch {}
  },

  /**
   * Check if consensus reminder is due
   */
  async getNextReminderTimestamp(): Promise<number | null> {
    try {
      const stored = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch {
      return null;
    }
  },
};
