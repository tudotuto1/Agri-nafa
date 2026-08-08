import { useRouter } from "expo-router";

import { EcranAVenir } from "@/components/ui";

export default function EcranVente() {
  const router = useRouter();
  return (
    <EcranAVenir
      emoji="💰"
      titre="Nouvelle vente"
      explication="Bientôt : enregistrez une vente, son acompte et son mode de paiement."
      onRetour={() => router.back()}
    />
  );
}
