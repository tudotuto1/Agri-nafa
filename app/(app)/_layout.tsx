import { Stack } from "expo-router";

import { BoutonAssistant } from "@/components/bouton-assistant";

// Le bouton d'assistant enveloppe la pile : posé ici, il survit aux
// changements d'écran — la feuille garde donc le guide choisi d'un écran à
// l'autre — et il se retire de lui-même sur le détail d'un guide, qui porte
// déjà son onglet « Poser une question ».
export default function DispositionApp() {
  return (
    <BoutonAssistant>
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
        <Stack.Screen name="alertes" />
        <Stack.Screen name="cameras" />
        <Stack.Screen name="camera/[id]" />
        <Stack.Screen name="camera-installation" />
        <Stack.Screen name="parcelles" />
        <Stack.Screen name="parcelle/[id]" />
        <Stack.Screen name="guides" />
        <Stack.Screen name="guide/[id]" />
        <Stack.Screen name="file-attente" />
        <Stack.Screen name="planifier" />
      </Stack>
    </BoutonAssistant>
  );
}
