import { Drawer } from 'expo-router/drawer';
import { Platform, useWindowDimensions } from 'react-native';

import { KadDrawerContent } from '@/components/kad-drawer-content';
import { useTheme } from '@/hooks/use-theme';
import { drawerWidth } from '@/lib/app-feature-catalog';

export const unstable_settings = {
  initialRouteName: 'inicio',
};

export default function MainLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  return (
    <Drawer
      drawerContent={(props) => <KadDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEnabled: true,
        swipeEdgeWidth: 32,
        overlayColor: colors.overlay,
        lazy: true,
        freezeOnBlur: Platform.OS !== 'web',
        drawerStyle: {
          width: drawerWidth(width),
          backgroundColor: colors.surface,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Drawer.Screen name="inicio" options={{ title: 'Início' }} />
      <Drawer.Screen name="questoes" options={{ title: 'Questões' }} />
      <Drawer.Screen name="concursos" options={{ title: 'Concursos' }} />
      <Drawer.Screen name="simulados" options={{ title: 'Simulados' }} />
      <Drawer.Screen name="explorar" options={{ title: 'Explorar' }} />
      <Drawer.Screen name="rank" options={{ title: 'Ranking' }} />
      <Drawer.Screen name="flashcards" options={{ title: 'Flashcards' }} />
    </Drawer>
  );
}
