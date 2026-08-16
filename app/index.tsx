import { Redirect, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FontSize, FontWeight, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPostAuthRoute, type PostAuthRoute } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { authLinkChecking, canAccessApp, continueAsGuest, isGuest, recoveryReady, session } =
    useAuth();
  const [guestError, setGuestError] = useState<string>();
  const [postAuthRoute, setPostAuthRoute] = useState<PostAuthRoute>();

  useEffect(() => {
    let active = true;

    if (!session) {
      setPostAuthRoute(undefined);
      return () => {
        active = false;
      };
    }

    void getPostAuthRoute(session.user.id).then((route) => {
      if (active) setPostAuthRoute(route);
    });

    return () => {
      active = false;
    };
  }, [session]);

  const openAsGuest = async () => {
    setGuestError(undefined);
    const result = await continueAsGuest();
    if (!result.ok) {
      setGuestError(result.message ?? 'Não foi possível iniciar o modo visitante.');
      return;
    }
    router.replace('/inicio');
  };

  if (
    canAccessApp &&
    !authLinkChecking &&
    !recoveryReady &&
    pathname === '/'
  ) {
    if (session && !postAuthRoute) {
      return (
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    return <Redirect href={isGuest ? '/inicio' : (postAuthRoute ?? '/inicio')} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.xxl,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View style={styles.main}>
          <View
            style={styles.brand}
            accessible
            accessibilityRole="image"
            accessibilityLabel="KAD">
            <Image
              source={require('../assets/images/kad-symbol-v3.png')}
              style={[styles.brandSymbol, { tintColor: colors.primary }]}
              resizeMode="contain"
              accessible={false}
            />
            <Text
              style={[styles.brandName, { color: colors.primary }]}
              accessible={false}>
              KAD
            </Text>
          </View>

          <View style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Estude com direção.</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              Questões, simulados e concursos reunidos para você manter o foco no que importa.
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              label="Entrar"
              size="lg"
              onPress={() => router.push('/auth/login')}
              fullWidth
            />
            <Button
              label="Criar conta"
              size="lg"
              variant="secondary"
              onPress={() => router.push('/auth/cadastro')}
              fullWidth
            />
            <Pressable
              onPress={openAsGuest}
              accessibilityRole="button"
              accessibilityLabel="Continuar como visitante"
              hitSlop={8}
              style={({ pressed }) => [styles.guestAction, pressed && styles.pressed]}>
              <Text style={[styles.guestText, { color: colors.textMuted }]}>Continuar como visitante</Text>
            </Pressable>
            {guestError ? (
              <Text accessibilityRole="alert" style={[styles.guestError, { color: colors.danger }]}>
                {guestError}
              </Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.legal, { color: colors.textSubtle }]}>
          Ao continuar, você aceita os{' '}
          <Text style={[styles.legalLink, { color: colors.text }]} onPress={() => router.push('/legal/termos')}>
            Termos de Uso
          </Text>{' '}
          e a{' '}
          <Text
            style={[styles.legalLink, { color: colors.text }]}
            onPress={() => router.push('/legal/privacidade')}>
            Política de Privacidade
          </Text>
          .
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xxl,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.xxxl,
  },
  brand: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandSymbol: {
    width: 58,
    height: 58,
  },
  brandName: {
    fontSize: 42,
    lineHeight: 46,
    fontWeight: FontWeight.bold,
    letterSpacing: -1.8,
    alignSelf: 'flex-start',
  },
  copy: { gap: Spacing.md },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: FontWeight.bold,
    letterSpacing: -0.8,
  },
  description: {
    ...Typography.body,
    maxWidth: 350,
    fontSize: FontSize.heading,
    lineHeight: 24,
  },
  actions: { gap: Spacing.sm },
  guestAction: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestText: { fontSize: FontSize.body, fontWeight: FontWeight.medium },
  guestError: { fontSize: FontSize.small, lineHeight: 18, textAlign: 'center' },
  legal: {
    fontSize: FontSize.tiny,
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: { fontWeight: FontWeight.semibold, textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
