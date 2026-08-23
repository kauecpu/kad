import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

export function useOpenAppDrawer(): () => void {
  const navigation = useNavigation();

  return useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);
}
