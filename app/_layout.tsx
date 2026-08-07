// =============================================================================
// Aiguilleur de l'application.
//
// Une seule référence pour savoir où reprendre : profils.onboarding_termine,
// lu en base. Aucun état local. Si le réseau coupe entre le code SMS et la
// saisie du profil, le producteur rouvre l'app et retombe exactement à
// l'étape suivante — sur un téléphone partagé comme sur le sien.
// =============================================================================

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Attente } from "@/components/ui";
import { FournisseurAuth, useAuth } from "@/lib/auth";

function Aiguilleur() {
  const { session, profil, chargement } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (chargement) return;

    const dansOnboarding = segments[0] === "(auth)";

    if (!session) {
      if (!dansOnboarding) router.replace("/(auth)/langue");
      return;
    }

    if (!profil?.onboarding_termine) {
      // Session ouverte, parcours inachevé : on laisse circuler librement dans
      // le groupe (auth), on ne rapatrie que si l'utilisateur en est sorti.
      if (!dansOnboarding) router.replace("/(auth)/profil");
      return;
    }

    if (dansOnboarding) router.replace("/(app)/accueil");
  }, [session, profil, chargement, segments, router]);

  if (chargement) return <Attente />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function DispositionRacine() {
  return (
    <SafeAreaProvider>
      <FournisseurAuth>
        <StatusBar style="dark" />
        <Aiguilleur />
      </FournisseurAuth>
    </SafeAreaProvider>
  );
}
