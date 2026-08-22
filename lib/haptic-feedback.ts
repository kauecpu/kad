export const HAPTIC_ACTIONS = [
  'confirm-answer',
  'toggle-favorite',
  'complete-goal',
  'finish-simulation',
] as const;

export type HapticAction = (typeof HAPTIC_ACTIONS)[number];
export type HapticImpactStyle = 'medium';
export type HapticNotificationType = 'success';

export type HapticFeedbackAdapter = {
  impact: (style: HapticImpactStyle) => Promise<void>;
  notification: (type: HapticNotificationType) => Promise<void>;
  selection: () => Promise<void>;
};

type HapticFeedbackControllerOptions = {
  adapter: HapticFeedbackAdapter;
  platform: 'native' | 'web';
};

function isHapticAction(action: string): action is HapticAction {
  return HAPTIC_ACTIONS.some((allowedAction) => allowedAction === action);
}

/**
 * Mantém a política tátil em um único lugar. A API aceita string para falhar
 * fechada caso uma ação não autorizada chegue em tempo de execução.
 */
export function createHapticFeedbackController({
  adapter,
  platform,
}: HapticFeedbackControllerOptions) {
  return {
    async trigger(action: string): Promise<boolean> {
      if (platform === 'web' || !isHapticAction(action)) return false;

      try {
        switch (action) {
          case 'confirm-answer':
            await adapter.impact('medium');
            break;
          case 'toggle-favorite':
            await adapter.selection();
            break;
          case 'complete-goal':
          case 'finish-simulation':
            await adapter.notification('success');
            break;
        }
        return true;
      } catch {
        // Feedback tátil é complementar e nunca deve bloquear a ação principal.
        return false;
      }
    },
  };
}
