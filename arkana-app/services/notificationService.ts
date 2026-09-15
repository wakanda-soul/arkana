import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Ensure notification alert behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CONSENSUS_REMINDER_IDENTIFIER = 'arkana_daily_consensus_reminder';

export const notificationService = {
  /**
   * Request push/local notification permission from user
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (err) {
      console.warn('[Notifications] Failed to request permissions:', err);
      return false;
    }
  },

  /**
   * Schedule local reminder notification for next daily block
   * @param secondsFromNow Duration in seconds (default 24h = 86400s)
   */
  async scheduleDailyConsensusReminder(secondsFromNow: number = 86400): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) return null;

      // Cancel previous consensus reminder if any
      await Notifications.cancelScheduledNotificationAsync(CONSENSUS_REMINDER_IDENTIFIER).catch(() => {});

      const id = await Notifications.scheduleNotificationAsync({
        identifier: CONSENSUS_REMINDER_IDENTIFIER,
        content: {
          title: 'Arkana: New Block Ready \u2726',
          body: 'A new daily archetype awaits on the Altar. Inscribe your daily reading to maintain your on-chain streak.',
          data: { screen: 'altar' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(60, secondsFromNow),
          repeats: false,
        },
      });

      return id;
    } catch (err) {
      console.warn('[Notifications] Failed to schedule consensus reminder:', err);
      return null;
    }
  },

  /**
   * Cancel active daily consensus reminder
   */
  async cancelReminder(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelScheduledNotificationAsync(CONSENSUS_REMINDER_IDENTIFIER);
    } catch {}
  },
};
