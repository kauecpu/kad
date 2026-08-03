import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { FontSize, FontWeight, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { continueAsGuest } = useAuth();

  const openAsGuest = async () => {
    await continueAsGuest();
    router.replace('/inicio');
  };

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
          <Image
            source={require('../assets/images/kad-logo-v3.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="KAD Concursos"
          />

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
  logo: {
    width: 210,
    height: 76,
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
  legal: {
    fontSize: FontSize.tiny,
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: { fontWeight: FontWeight.semibold, textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
