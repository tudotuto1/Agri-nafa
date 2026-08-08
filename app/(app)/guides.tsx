import { useRouter } from "expo-router";

import { EcranAVenir } from "@/components/ui";

export default function EcranGuides() {
  const router = useRouter();
  return (
    <EcranAVenir
      emoji="📖"
      titre="Guides techniques"
      explication="Bientôt : l'itinéraire de votre culture, étape par étape, en images et en audio."
      onRetour={() => router.back()}
    />
  );
}
