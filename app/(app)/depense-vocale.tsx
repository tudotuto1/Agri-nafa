import { useRouter } from "expo-router";

import { EcranAVenir } from "@/components/ui";

export default function EcranDepenseVocale() {
  const router = useRouter();
  return (
    <EcranAVenir
      emoji="🎤"
      titre="Dicter une dépense"
      explication="Bientôt : appuyez, parlez, et la dépense est comprise puis proposée à votre validation."
      onRetour={() => router.back()}
    />
  );
}
