// =============================================================================
// Nouveau cycle — écran d'attente.
//
// Reçoit déjà la spéculation quand on arrive depuis un guide, pour que le
// bouton « Démarrer ce cycle » ne perde pas le choix du producteur en route.
// =============================================================================

import { useLocalSearchParams, useRouter } from "expo-router";

import { EcranAVenir } from "@/components/ui";

export default function EcranNouveauCycle() {
  const router = useRouter();
  const { speculation_nom: speculationNom } = useLocalSearchParams<{
    speculation_id?: string;
    speculation_nom?: string;
  }>();

  return (
    <EcranAVenir
      emoji="🌱"
      titre="Nouveau cycle"
      explication={
        speculationNom
          ? `Bientôt : ouvrez un cycle de ${speculationNom} et suivez sa rentabilité du semis à la vente. Votre choix est déjà retenu.`
          : "Bientôt : ouvrez un cycle de culture ou d'élevage et suivez sa rentabilité du semis à la vente."
      }
      onRetour={() => router.back()}
    />
  );
}
