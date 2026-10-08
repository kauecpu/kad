import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Ionicons from '@/components/ui/app-icon';
import { FontSize, FontWeight, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  APP_PRIMARY_DESTINATIONS,
  bottomNavigationDestinationForPath,
  bottomSheetItemsForGroup,
  type AppBottomSheetGroupId,
  type AppPrimaryDestination,
} from '@/lib/app-feature-catalog';

const NAVIGATION_HEIGHT = 72;
const HOME_BUTTON_SIZE = 60;
const MIN_TOUCH_TARGET = 48;

function navigationShadow(shadowColor: string): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor,
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -4 },
    },
    android: { elevation: 14 },
    default: { boxShadow: '0 -4px 18px rgba(0, 0, 0, 0.12)' },
  });
}

export function KadBottomNavigation() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [openGroup, setOpenGroup] = useState<AppBottomSheetGroupId | null>(null);
  const activeDestination = bottomNavigationDestinationForPath(pathname);
  const bottomInset = Math.max(insets.bottom, Spacing.sm);

  useEffect(() => setOpenGroup(null), [pathname]);

  const activate = (destination: AppPrimaryDestination) => {
    if (destination.behavior === 'sheet' && destination.group) {
      setOpenGroup(destination.group);
      return;
    }
    if (destination.href) router.navigate(destination.href);
  };

  return (
    <>
      <View
        accessibilityRole="tablist"
        style={[
          styles.navigation,
          navigationShadow(colors.shadow),
          { minHeight: NAVIGATION_HEIGHT + bottomInset },
        ]}>
        <View style={[styles.centerCurve, { backgroundColor: colors.surface }]} />
        <View
          style={[
            styles.navigationSurface,
            { backgroundColor: colors.surface, paddingBottom: bottomInset },
          ]}>
          {APP_PRIMARY_DESTINATIONS.map((destination) => {
            const active = destination.id === activeDestination;
            const isHome = destination.id === 'home';
            return (
              <Pressable
                key={destination.id}
                onPress={() => activate(destination)}
                accessibilityRole="tab"
                accessibilityLabel={
                  destination.behavior === 'sheet'
                    ? `Abrir ${destination.title}`
                    : `Ir para ${destination.title}`
                }
                accessibilityState={{ selected: active, expanded: openGroup === destination.group }}
                hitSlop={4}
                style={({ pressed }) => [
                  styles.item,
                  isHome ? styles.homeItem : styles.standardItem,
                  pressed && styles.pressed,
                ]}>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    isHome ? styles.homeButton : styles.iconContainer,
                    isHome
                      ? {
                          backgroundColor: active ? colors.primary : colors.primarySoft,
                        }
                      : active && { backgroundColor: colors.tabActiveSurface },
                    isHome && navigationShadow(colors.shadow),
                  ]}>
                  <Ionicons
                    name={destination.icon}
                    size={isHome ? 28 : 20}
                    color={
                      isHome && active
                        ? colors.onPrimary
                        : active
                          ? colors.tabActive
                          : colors.tabInactive
                    }
                    filled={active}
                    aria-hidden
                  />
                </View>
                <Text
                  style={[
                    styles.label,
                    {
                      color: active ? colors.tabActive : colors.tabInactive,
                      fontWeight: active ? FontWeight.bold : FontWeight.medium,
                    },
                  ]}>
                  {destination.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <NavigationSheet
        group={openGroup}
        onClose={() => setOpenGroup(null)}
        animationType={reduceMotion ? 'none' : 'fade'}
      />
    </>
  );
}

type NavigationSheetProps = {
  group: AppBottomSheetGroupId | null;
  onClose: () => void;
  animationType: 'none' | 'fade';
};

function NavigationSheet({ group, onClose, animationType }: NavigationSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const destination = APP_PRIMARY_DESTINATIONS.find((item) => item.group === group);
  const items = group ? bottomSheetItemsForGroup(group) : [];

  const openItem = (href: (typeof items)[number]['href']) => {
    onClose();
    router.navigate(href);
  };

  return (
    <Modal
      visible={Boolean(group)}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.modalRoot} accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar navegação"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(Spacing.xxl, insets.bottom + Spacing.lg),
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.text }]}>
            {destination?.title}
          </Text>
          <View style={styles.sheetItems}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => openItem(item.href)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${item.title}`}
                style={({ pressed }) => [
                  styles.sheetItem,
                  { backgroundColor: colors.surfaceAlt },
                  pressed && styles.pressed,
                ]}>
                <View style={styles.sheetItemLead}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} filled={false} />
                  <Text style={[styles.sheetItemLabel, { color: colors.text }]}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={20} color={colors.textSubtle} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  navigation: {
    position: 'relative',
    zIndex: 20,
    overflow: 'visible',
  },
  centerCurve: {
    pointerEvents: 'none',
    position: 'absolute',
    top: -22,
    left: '50%',
    width: 88,
    height: 52,
    marginLeft: -44,
    borderTopLeftRadius: Radius.pill,
    borderTopRightRadius: Radius.pill,
  },
  navigationSurface: {
    minHeight: NAVIGATION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  item: {
    width: 72,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.xs,
  },
  standardItem: { height: 64 },
  homeItem: { height: 84, marginTop: -30 },
  iconContainer: {
    width: 48,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    width: HOME_BUTTON_SIZE,
    height: HOME_BUTTON_SIZE,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.tiny,
    lineHeight: 16,
    textAlign: 'center',
  },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    gap: Spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radius.pill,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  sheetTitle: {
    fontSize: FontSize.heading,
    lineHeight: 24,
    fontWeight: FontWeight.bold,
  },
  sheetItems: { gap: Spacing.sm },
  sheetItem: {
    minHeight: 56,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetItemLead: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  sheetItemLabel: {
    flexShrink: 1,
    fontSize: FontSize.body,
    lineHeight: 22,
    fontWeight: FontWeight.medium,
  },
  pressed: { opacity: 0.68 },
});
