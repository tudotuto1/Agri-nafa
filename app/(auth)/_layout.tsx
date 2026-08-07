import { Stack } from "expo-router";

export default function DispositionOnboarding() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="langue" />
      <Stack.Screen name="telephone" />
      <Stack.Screen name="code" />
      <Stack.Screen name="profil" />
      <Stack.Screen name="premier-cycle" />
    </Stack>
  );
}
