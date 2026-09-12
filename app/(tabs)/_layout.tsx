import { Drawer } from 'expo-router/drawer';
import { Platform, StyleSheet, View } from 'react-native';

import { KadBottomNavigation } from '@/components/kad-bottom-navigation';
import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  initialRouteName: 'inicio',
};

export default function MainLayout() {
  const { colors } = useTheme();

  return (
    <View style={styles.shell}>
      <View style={styles.content}>
        <Drawer
          drawerContent={() => null}
          screenOptions={{
            headerShown: false,
            drawerType: 'front',
            swipeEnabled: false,
            overlayColor: colors.overlay,
            lazy: true,
            freezeOnBlur: Platform.OS !== 'web',
            drawerStyle: {
              width: 0,
              display: 'none',
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
      <KadBottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  content: { flex: 1 },
});

