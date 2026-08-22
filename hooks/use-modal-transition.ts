import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  MOTION_EASING,
  resolveMotionDuration,
  shouldUnmountModal,
} from '@/constants/motion';

/** Mantém o modal montado durante a saída, sem atrasar a ação que o fechou. */
export function useModalTransition(visible: boolean) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const previousVisible = useRef(visible);
  const visibleRef = useRef(visible);
  const transitionGeneration = useRef(0);
  visibleRef.current = visible;

  const finishClose = useCallback((generation: number) => {
    if (shouldUnmountModal(generation, transitionGeneration.current, visibleRef.current)) {
      setMounted(false);
    }
  }, []);

  useEffect(() => {
    if (previousVisible.current === visible) return;
    previousVisible.current = visible;
    const generation = ++transitionGeneration.current;
    cancelAnimation(progress);

    const duration = resolveMotionDuration('modal', reduceMotion);
    if (visible) {
      setMounted(true);
      if (duration === 0) {
        progress.value = 1;
        return;
      }
      progress.value = withTiming(1, {
        duration,
        easing: Easing.bezier(...MOTION_EASING.standard),
      });
      return;
    }

    if (duration === 0) {
      progress.value = 0;
      setMounted(false);
      return;
    }

    progress.value = withTiming(
      0,
      { duration, easing: Easing.bezier(...MOTION_EASING.standard) },
      (finished) => {
        if (finished) runOnJS(finishClose)(generation);
      }
    );
  }, [finishClose, progress, reduceMotion, visible]);

  useEffect(() => {
    if (!reduceMotion) return;
    ++transitionGeneration.current;
    cancelAnimation(progress);
    progress.value = visible ? 1 : 0;
    if (!visible) setMounted(false);
  }, [progress, reduceMotion, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [32, 0]) }],
  }));

  return {
    mounted,
    interactive: visible,
    backdropStyle,
    surfaceStyle,
  };
}
