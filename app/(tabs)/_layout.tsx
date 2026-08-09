import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { FontSize, FontWeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  initialRouteName: 'inicio',
};

function tabIcon(
  outlineName: keyof typeof MaterialCommunityIcons.glyphMap,
  filledName: keyof typeof MaterialCommunityIcons.glyphMap
) {
  return function TabIcon({ focused }: { color: string; focused: boolean }) {
    const { colors } = useTheme();
    const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

    useEffect(() => {
      const animation = Animated.timing(active, {
        toValue: focused ? 1 : 0,
        duration: 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [active, focused]);

    return (
      <Animated.View style={styles.tabGlyph}>
        <Animated.View
          style={[
            styles.tabGlyphLayer,
            { opacity: active.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
          ]}>
          <MaterialCommunityIcons name={outlineName} size={24} color={colors.tabInactive} />
        </Animated.View>
        <Animated.View style={[styles.tabGlyphLayer, { opacity: active }]}>
          <MaterialCommunityIcons name={filledName} size={24} color={colors.tabActive} />
        </Animated.View>
      </Animated.View>
    );
  };
}

export default function MainLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarButton: HapticTab,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ],
        tabBarIconStyle: styles.tabIcon,
        tabBarLabel: ({ children }) => (
          <Text style={[styles.tabLabel, { color: colors.tabInactive }]}>{children}</Text>
        ),
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="inicio"
        options={{ title: 'Início', tabBarIcon: tabIcon('home-variant-outline', 'home-variant') }}
      />
      <Tabs.Screen
        name="questoes"
        options={{
          title: 'Questões',
          tabBarIcon: tabIcon('book-outline', 'book'),
        }}
      />
      <Tabs.Screen
        name="concursos"
        options={{ title: 'Concursos', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }}
      />
      <Tabs.Screen
        name="simulados"
        options={{ title: 'Simulados', tabBarIcon: tabIcon('clock-outline', 'clock') }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: tabIcon('account-outline', 'account') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    minHeight: 62,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
  },
  tabIcon: {
    marginTop: 1,
  },
  tabGlyph: {
    width: 24,
    height: 24,
  },
  tabGlyphLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: FontSize.tiny - 1,
    fontWeight: FontWeight.medium,
  },
});
