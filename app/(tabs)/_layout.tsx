import { Drawer } from 'expo-router/drawer';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { KadBottomNavigation } from '@/components/kad-bottom-navigation';
import { KadDrawerContent } from '@/components/kad-drawer-content';
import { useTheme } from '@/hooks/use-theme';
import { drawerWidth } from '@/lib/app-feature-catalog';

export const unstable_settings = {
  initialRouteName: 'inicio',
};

export default function MainLayout() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.shell}>
      <View style={styles.content}>
        <Drawer
          drawerContent={(props) => <KadDrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerType: isMobile ? 'front' : 'permanent',
            swipeEnabled: !isMobile,
            swipeEdgeWidth: 32,
            overlayColor: colors.overlay,
            lazy: true,
            freezeOnBlur: Platform.OS !== 'web',
            drawerStyle: {
              width: isMobile ? 0 : drawerWidth(width),
              display: isMobile ? 'none' : 'flex',
              backgroundColor: colors.surface,
            },
            sceneStyle: { backgroundColor: colors.background },
          }}>
          <Drawer.Screen name="inicio" options={{ title: 'Início' }} />
          <Drawer.Screen name="questoes" options={{ title: 'Questões' }} />
          <Drawer.Screen name="concursos" options={{ title: 'Concursos' }} />
          <Drawer.Screen name="simulados" options={{ title: 'Simulados' }} />
          <Drawer.Screen name="ranking" options={{ title: 'Ranking' }} />
          <Drawer.Screen name="trilhas" options={{ title: 'Trilhas' }} />
          <Drawer.Screen name="redacao" options={{ title: 'Redação' }} />
          <Drawer.Screen name="biblioteca" options={{ title: 'Biblioteca' }} />
          <Drawer.Screen name="flashcards" options={{ title: 'Flashcards' }} />
          <Drawer.Screen name="perfil" options={{ title: 'Perfil' }} />
          <Drawer.Screen name="configuracoes" options={{ title: 'Configurações' }} />
          <Drawer.Screen name="explorar" options={{ title: 'Explorar' }} />
          <Drawer.Screen name="rank" options={{ title: 'Ranking antigo' }} />
        </Drawer>
      </View>
      {isMobile ? <KadBottomNavigation /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: { flex: 1 },
});

