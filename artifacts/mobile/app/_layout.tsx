import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const C = Colors.dark;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: C.backgroundDeep },
                headerTintColor: C.text,
                headerTitleStyle: {
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 17,
                  color: C.text,
                },
                contentStyle: { backgroundColor: C.background },
                headerShadowVisible: false,
                headerBackTitle: "Back",
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="atlas/[id]"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="atlas/[id]/node-form"
                options={{
                  presentation: "modal",
                  headerShown: false,
                  contentStyle: { backgroundColor: C.backgroundDeep },
                }}
              />
              <Stack.Screen
                name="atlas/[id]/edge-form"
                options={{
                  presentation: "modal",
                  headerShown: false,
                  contentStyle: { backgroundColor: C.backgroundDeep },
                }}
              />
              <Stack.Screen
                name="atlas/[id]/node-detail"
                options={{
                  presentation: "modal",
                  headerShown: false,
                  contentStyle: { backgroundColor: C.backgroundDeep },
                }}
              />
              <Stack.Screen
                name="atlas/[id]/ai-generate"
                options={{
                  presentation: "modal",
                  headerShown: false,
                  contentStyle: { backgroundColor: C.backgroundDeep },
                }}
              />
              <Stack.Screen
                name="atlas/create"
                options={{
                  presentation: "modal",
                  headerShown: false,
                  contentStyle: { backgroundColor: C.backgroundDeep },
                }}
              />
              <Stack.Screen
                name="atlas/import"
                options={{
                  presentation: "modal",
                  headerShown: false,
                  contentStyle: { backgroundColor: C.backgroundDeep },
                }}
              />
            </Stack>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
