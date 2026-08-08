import { useRouter } from "expo-router";

import { EcranAVenir } from "@/components/ui";

export default function EcranNouveauCycle() {
  const router = useRouter();
  return (
    <EcranAVenir
      emoji="🌱"
      titre="Nouveau cycle"
      explication="Bientôt : ouvrez un cycle de culture ou d'élevage et suivez sa rentabilité du semis à la vente."
      onRetour={() => router.back()}
    />
  );
}
