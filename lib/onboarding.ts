import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_STORAGE_PREFIX = '@kad/onboarding/completed/v1/';

export type PostAuthRoute = '/onboarding' | '/inicio';

function onboardingStorageKey(userId: string) {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`;
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(onboardingStorageKey(userId))) === 'true';
  } catch {
    return false;
  }
}

export async function getPostAuthRoute(userId: string): Promise<PostAuthRoute> {
  return (await hasCompletedOnboarding(userId)) ? '/inicio' : '/onboarding';
}

export async function markOnboardingComplete(userId: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(onboardingStorageKey(userId), 'true');
    return true;
  } catch {
    return false;
  }
}
