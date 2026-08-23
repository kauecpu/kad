import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { usePathname, useRouter } from 'expo-router';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Ionicons from '@/components/ui/app-icon';
import { FontSize, FontWeight, Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  APP_DRAWER_GROUPS,
  drawerItemsForGroup,
  isDrawerRouteActive,
  type AppDrawerItem,
} from '@/lib/app-feature-catalog';

export function KadDrawerContent({ navigation, ...props }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const pathname = usePathname();
  const router = useRouter();

  const openItem = (item: AppDrawerItem) => {
    navigation.closeDrawer();
    router.navigate(item.href);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.brandRail, { backgroundColor: colors.primary }]} />
      <DrawerContentScrollView
        {...props}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="KAD Concursos"
          style={styles.brand}>
          <View style={[styles.brandSymbol, { backgroundColor: colors.primarySoft }]}>
            <Image
              source={require('../assets/images/kad-symbol-v3.png')}
              resizeMode="contain"
              style={styles.brandImage}
            />
          </View>
          <View style={styles.brandCopy}>
            <Text style={[styles.brandName, { color: colors.text }]}>KAD</Text>
            <Text style={[styles.brandDescriptor, { color: colors.primary }]}>CONCURSOS</Text>
          </View>
        </View>

        {APP_DRAWER_GROUPS.slice(0, -1).map((group) => (
          <DrawerGroup
            key={group.id}
            title={group.title}
            items={drawerItemsForGroup(group.id)}
            pathname={pathname}
            onPress={openItem}
          />
        ))}

        <View style={[styles.accountDivider, { backgroundColor: colors.border }]} />
        <DrawerGroup
          title={APP_DRAWER_GROUPS[APP_DRAWER_GROUPS.length - 1].title}
          items={drawerItemsForGroup('account')}
          pathname={pathname}
          onPress={openItem}
        />
      </DrawerContentScrollView>
    </View>
  );
}

type DrawerGroupProps = {
  title: string;
  items: readonly AppDrawerItem[];
  pathname: string;
  onPress: (item: AppDrawerItem) => void;
};

function DrawerGroup({ title, items, pathname, onPress }: DrawerGroupProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: colors.textSubtle }]}>{title}</Text>
      <View style={styles.groupItems}>
        {items.map((item) => {
          const active = isDrawerRouteActive(pathname, item.href);
          const webCurrentPage =
            Platform.OS === 'web' && active ? ({ 'aria-current': 'page' } as const) : {};

          return (
            <Pressable
              {...webCurrentPage}
              key={item.id}
              onPress={() => onPress(item)}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.drawerItem,
                active && { backgroundColor: colors.primarySoft },
                pressed && styles.pressed,
              ]}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.itemIcon}>
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={active ? colors.primary : colors.textMuted}
                  filled={active}
                />
              </View>
              <Text
                style={[
                  styles.itemLabel,
                  {
                    color: active ? colors.primary : colors.text,
                    fontWeight: active ? FontWeight.semibold : FontWeight.medium,
                  },
                ]}>
                {item.title}
              </Text>
              {active ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.activeMarker, { backgroundColor: colors.primary }]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  brandRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  brand: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  brandSymbol: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandImage: { width: 34, height: 34 },
  brandCopy: { gap: 1 },
  brandName: {
    fontSize: FontSize.title,
    lineHeight: 26,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.5,
  },
  brandDescriptor: {
    fontFamily: Fonts.mono,
    fontSize: FontSize.tiny,
    fontWeight: FontWeight.bold,
    letterSpacing: 2.2,
  },
  group: { gap: Spacing.xs },
  groupTitle: {
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.tiny,
    lineHeight: 16,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  groupItems: { gap: 2 },
  drawerItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  itemIcon: {
    width: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    flexShrink: 1,
    fontSize: FontSize.body,
    lineHeight: 20,
  },
  activeMarker: { width: 5, height: 5, borderRadius: Radius.pill },
  accountDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  pressed: { opacity: 0.68 },
});
