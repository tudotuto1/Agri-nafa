// =============================================================================
// Étape 1 — Choix de la langue.
//
// Le choix est enregistré localement avant même qu'un compte existe : l'écran
// suivant doit déjà s'afficher dans la bonne langue. Il sera recopié dans
// public.profils une fois la session ouverte.
// =============================================================================

import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Aide, Bouton, Carte, Ecran, EpisDeMil, Titre } from "@/components/ui";
import { couleurs, espaces, rayons, textes } from "@/constants/theme";
import { CLE_LANGUE, type Langue } from "@/lib/supabase";

const LANGUES: { code: Langue; nom: string; locuteurs: string }[] = [
  { code: "fr", nom: "Français", locuteurs: "Langue officielle" },
  { code: "moore", nom: "Mooré", locuteurs: "Plateau central" },
  { code: "dioula", nom: "Dioula", locuteurs: "Ouest et Sud-Ouest" },
  { code: "fulfulde", nom: "Fulfuldé", locuteurs: "Sahel et Est" },
];

export default function EcranLangue() {
  const router = useRouter();
  const [choix, setChoix] = useState<Langue>("fr");

  async function continuer() {
    await AsyncStorage.setItem(CLE_LANGUE, choix);
    router.push("/(auth)/telephone");
  }

  return (
    <Ecran>
      <EpisDeMil etape={1} total={5} />
      <Titre>Choisissez votre langue</Titre>
      <Aide>
        Appuyez sur le haut-parleur pour entendre le nom de chaque langue.
      </Aide>

      <View style={styles.liste}>
        {LANGUES.map((langue) => (
          <Carte
            key={langue.code}
            titre={langue.nom}
            sousTitre={langue.locuteurs}
            selectionnee={choix === langue.code}
            onPress={() => setChoix(langue.code)}
            action={<BoutonHautParleur langue={langue.nom} />}
          />
        ))}
      </View>

      <Bouton titre="Continuer" onPress={continuer} />
    </Ecran>
  );
}

// L'énoncé parlé viendra du bucket « guides-audio » : des enregistrements de
// locuteurs natifs, pas une synthèse vocale — aucun moteur TTS ne prononce
// correctement le mooré ou le fulfuldé.
function BoutonHautParleur({ langue }: { langue: string }) {
  const [enAttente, setEnAttente] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Écouter en ${langue}`}
      onPress={() => setEnAttente(true)}
      style={({ pressed }) => [styles.hautParleur, pressed && styles.presse]}
    >
      <Text style={styles.hautParleurIcone}>{enAttente ? "⏳" : "🔊"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  liste: {
    gap: espaces.sm,
  },
  hautParleur: {
    width: 52,
    height: 52,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    alignItems: "center",
    justifyContent: "center",
  },
  presse: {
    opacity: 0.7,
  },
  hautParleurIcone: {
    fontSize: textes.sousTitre,
  },
});
