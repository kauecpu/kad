import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import {
  createHapticFeedbackController,
  type HapticAction,
  type HapticFeedbackAdapter,
} from '@/lib/haptic-feedback';

const expoHapticsAdapter: HapticFeedbackAdapter = {
  impact: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  notification: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  selection: () => Haptics.selectionAsync(),
};

const controller = createHapticFeedbackController({
  adapter: expoHapticsAdapter,
  platform: Platform.OS === 'web' ? 'web' : 'native',
});

/** Dispara somente os quatro eventos táteis aprovados pelo produto. */
export function triggerHapticFeedback(action: HapticAction): Promise<boolean> {
  return controller.trigger(action);
}
