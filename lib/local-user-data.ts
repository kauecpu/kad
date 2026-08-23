import AsyncStorage from '@react-native-async-storage/async-storage';

import { localUserDataInventory } from './local-user-data-keys';
import { protectedStorage } from './protected-storage';

export async function eraseLocalUserData(ownerId: string) {
  try {
    await protectedStorage.beginOwnerDeletion(ownerId);
    const physicalKeys = await AsyncStorage.getAllKeys();
    const { privateLogicalKeys, plainKeys } = localUserDataInventory(ownerId, physicalKeys);

    await Promise.all(
      privateLogicalKeys.map((key) => protectedStorage.removeItem(key))
    );
    await AsyncStorage.multiRemove(plainKeys);
    await protectedStorage.deleteOwnerKey(ownerId);
  } catch (error) {
    protectedStorage.cancelOwnerDeletion(ownerId);
    throw error;
  }
}
