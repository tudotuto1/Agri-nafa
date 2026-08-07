import { Stack } from "expo-router";

export default function DispositionApp() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="accueil" />
    </Stack>
  );
}
