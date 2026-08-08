import { useRouter } from "expo-router";

import { EcranAVenir } from "@/components/ui";

export default function EcranPrevente() {
  const router = useRouter();
  return (
    <EcranAVenir
      emoji="📋"
      titre="Fiche de prévente"
      explication="Bientôt : annoncez votre récolte à vos grossistes avant qu'elle ne soit prête."
      onRetour={() => router.back()}
    />
  );
}
