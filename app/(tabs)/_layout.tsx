import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { FontSize, FontWeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  initialRouteName: 'inicio',
};

function tabIcon(
  defaultName: keyof typeof Ionicons.glyphMap,
  selectedName: keyof typeof Ionicons.glyphMap
) {
  return function TabIcon({ color, focused }: { color: string; focused: boolean }) {
    return <Ionicons name={focused ? selectedName : defaultName} size={22} color={color} />;
  };
}

export default function MainLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ],
        tabBarLabelStyle: styles.tabLabel,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="inicio"
        options={{ title: 'Início', tabBarIcon: tabIcon('home-outline', 'home') }}
      />
      <Tabs.Screen
        name="questoes"
        options={{ title: 'Questões', tabBarIcon: tabIcon('reader-outline', 'reader') }}
      />
      <Tabs.Screen
        name="concursos"
        options={{ title: 'Concursos', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }}
      />
      <Tabs.Screen
        name="simulados"
        options={{ title: 'Simulados', tabBarIcon: tabIcon('stopwatch-outline', 'stopwatch') }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: tabIcon('person-outline', 'person') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    minHeight: 58,
    paddingTop: 5,
    paddingBottom: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: {
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.medium,
  },
});
