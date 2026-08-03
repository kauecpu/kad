import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/providers/app-provider';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { Colors } from '@/constants/theme';
import { SearchProvider } from '@/providers/search-provider';
import { SimulationProvider } from '@/providers/simulation-provider';
import { ConcursosProvider } from '@/providers/concursos-provider';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootNavigator() {
  const { scheme, hydrated } = useApp();
  const colors = Colors[scheme];
  const { canAccessApp, isLoading } = useAuth();

  if (isLoading || !hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/cadastro" options={{ headerShown: false }} />
        <Stack.Screen name="auth/recuperar-senha" options={{ headerShown: false }} />
        <Stack.Screen name="auth/nova-senha" options={{ headerShown: false }} />
        <Stack.Screen name="legal/termos" options={{ headerShown: false }} />
        <Stack.Screen name="legal/privacidade" options={{ headerShown: false }} />
        <Stack.Protected guard={canAccessApp}>
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
          <Stack.Screen name="perfil/desempenho" options={{ headerShown: false }} />
          <Stack.Screen name="perfil/desempenho/questoes" options={{ headerShown: false }} />
          <Stack.Screen name="trilhas" options={{ headerShown: false }} />
          <Stack.Screen name="redacao" options={{ headerShown: false }} />
          <Stack.Screen name="biblioteca" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ConcursosProvider>
            <AppProvider>
              <SimulationProvider>
                <SearchProvider>
                  <RootNavigator />
                </SearchProvider>
              </SimulationProvider>
            </AppProvider>
          </ConcursosProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
