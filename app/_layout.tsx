import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp, useAppTheme } from '@/providers/app-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { Colors } from '@/constants/theme';
import { resolveMotionDuration, resolveStackAnimation } from '@/constants/motion';
import { authRouteAccess } from '@/lib/auth-routing';
import { SearchProvider } from '@/providers/search-provider';
import { SimulationProvider } from '@/providers/simulation-provider';
import { ConcursosProvider } from '@/providers/concursos-provider';
import { QuestionsProvider } from '@/providers/questions-provider';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootNavigator() {
  const reduceMotion = useReducedMotion();
  const { hydrated } = useApp();
  const { scheme } = useAppTheme();
  const colors = Colors[scheme];
  const baseNavigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = useMemo(
    () => ({
      ...baseNavigationTheme,
      colors: {
        ...baseNavigationTheme.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    }),
    [baseNavigationTheme, colors]
  );
  const { session, isGuest, isLoading } = useAuth();
  const routeAccess = authRouteAccess({
    hasSession: Boolean(session),
    isGuest,
  });

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          // iOS usa push de 250 ms; Android usa o push curto nativo de 200 ms.
          // O Native Stack não anima rotas no web, então a troca é imediata.
          animation: resolveStackAnimation(Platform.OS, reduceMotion),
          animationDuration: resolveMotionDuration('navigation', reduceMotion),
          freezeOnBlur: Platform.OS !== 'web',
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />

        <Stack.Protected guard={routeAccess.app}>
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/buscar" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/resultados" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/[discipline]" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/[discipline]/[topic]" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/concurso/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/trilha" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/simulado/configurar" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/simulado/index" options={{ headerShown: false }} />
          <Stack.Screen name="questoes/simulado/resultado" options={{ headerShown: false }} />
          <Stack.Screen name="concurso/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="concursos/salvos" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/editar" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/senha" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/excluir-conta" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/planos" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/feedback" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/desempenho" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/desempenho/questoes" options={{ headerShown: false }} />
          <Stack.Screen name="trilhas" options={{ headerShown: false }} />
          <Stack.Screen name="redacao" options={{ headerShown: false }} />
          <Stack.Screen name="ranking" options={{ headerShown: false }} />
          <Stack.Screen name="biblioteca" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={routeAccess.auth}>
          <Stack.Screen name="auth/login" options={{ headerShown: false }} />
          <Stack.Screen name="auth/cadastro" options={{ headerShown: false }} />
          <Stack.Screen name="auth/confirmar-email" options={{ headerShown: false }} />
          <Stack.Screen name="auth/recuperar-senha" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="auth/nova-senha" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding-preview"
          options={{ headerShown: false, gestureEnabled: false }}
        />

        <Stack.Screen name="legal/termos" options={{ headerShown: false }} />
        <Stack.Screen name="legal/privacidade" options={{ headerShown: false }} />
      </Stack>
      {isLoading || !hydrated ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.loadingOverlay,
            { backgroundColor: colors.background },
          ]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ConcursosProvider>
            <QuestionsProvider>
              <AppProvider>
                <SimulationProvider>
                  <SearchProvider>
                    <RootNavigator />
                  </SearchProvider>
                </SimulationProvider>
              </AppProvider>
            </QuestionsProvider>
          </ConcursosProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
