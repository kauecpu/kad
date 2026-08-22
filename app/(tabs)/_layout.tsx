import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { HapticTab } from '@/components/haptic-tab';
import { resolveMotionDuration } from '@/constants/motion';
import { FontSize, FontWeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shouldFreezeInactiveTabs } from '@/lib/theme-responsiveness';

export const unstable_settings = {
  initialRouteName: 'inicio',
};

function tabIcon(
  outlineName: keyof typeof MaterialCommunityIcons.glyphMap,
  filledName: keyof typeof MaterialCommunityIcons.glyphMap
) {
  return function TabIcon({ focused }: { color: string; focused: boolean }) {
    const { colors } = useTheme();
    const reduceMotion = useReducedMotion();
    const active = useRef(new Animated.Value(focused ? 1 : 0)).current;

    useEffect(() => {
      const animation = Animated.timing(active, {
        toValue: focused ? 1 : 0,
        duration: resolveMotionDuration('icon', reduceMotion),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start();
      return () => animation.stop();
    }, [active, focused, reduceMotion]);

    return (
      <Animated.View style={styles.tabGlyph}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabActiveCapsule,
            { backgroundColor: colors.tabActiveSurface, opacity: active },
          ]}
        />
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

const HomeTabIcon = tabIcon('home-variant-outline', 'home-variant');
const QuestionsTabIcon = tabIcon('book-outline', 'book');
const RankTabIcon = tabIcon('trophy-outline', 'trophy');
const SimulationsTabIcon = tabIcon('clock-outline', 'clock');
const ProfileTabIcon = tabIcon('account-outline', 'account');

function TabLabel({ children, focused }: { children: string; focused: boolean }) {
  const { colors } = useTheme();

  return (
    <Text
      style={[
        styles.tabLabel,
        {
          color: focused ? colors.tabActive : colors.tabInactive,
          fontWeight: focused ? FontWeight.semibold : FontWeight.medium,
        },
      ]}>
      {children}
    </Text>
  );
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
        freezeOnBlur: shouldFreezeInactiveTabs(Platform.OS),
        lazy: true,
        tabBarStyle: [
          styles.tabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ],
        tabBarIconStyle: styles.tabIcon,
        tabBarLabel: TabLabel,
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen
        name="inicio"
        options={{ title: 'Início', tabBarIcon: HomeTabIcon }}
      />
      <Tabs.Screen
        name="questoes"
        options={{
          title: 'Questões',
          tabBarIcon: QuestionsTabIcon,
        }}
      />
      <Tabs.Screen
        name="rank"
        options={{ title: 'Rank', tabBarIcon: RankTabIcon }}
      />
      <Tabs.Screen name="concursos" options={{ href: null }} />
      <Tabs.Screen
        name="simulados"
        options={{ title: 'Simulados', tabBarIcon: SimulationsTabIcon }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ProfileTabIcon }}
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
  tabActiveCapsule: {
    position: 'absolute',
    width: 42,
    height: 30,
    left: -9,
    top: -3,
    borderRadius: 15,
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
