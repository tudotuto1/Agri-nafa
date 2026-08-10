import { Stack } from "expo-router";

export default function DispositionApp() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="accueil" />
      <Stack.Screen name="nouveau-cycle" />
      <Stack.Screen name="depense" />
      <Stack.Screen name="depense-vocale" />
      <Stack.Screen name="vente" />
      <Stack.Screen name="recolte" />
      <Stack.Screen name="grossistes" />
      <Stack.Screen name="agri-score" />
      <Stack.Screen name="prevente" />
      <Stack.Screen name="guides" />
      <Stack.Screen name="guide/[id]" />
    </Stack>
  );
}
