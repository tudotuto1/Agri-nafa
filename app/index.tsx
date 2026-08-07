import { Redirect } from "expo-router";

// Point d'entrée neutre : l'aiguilleur de app/_layout.tsx reprend la main dès
// que la session et le profil sont connus.
export default function Index() {
  return <Redirect href="/(auth)/langue" />;
}
