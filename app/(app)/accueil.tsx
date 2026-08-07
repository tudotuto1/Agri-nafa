// =============================================================================
// Accueil — provisoire.
//
// À brancher sur public.vue_tableau_bord, qui renvoie en une seule requête les
// cycles actifs, le cumul dépenses/revenus, les alertes non lues, les stocks
// sous le seuil et les dépenses dictées en attente de validation.
// =============================================================================

import { StyleSheet, Text, View } from "react-native";

import { Aide, Bouton, Ecran, SousTitre, Titre } from "@/components/ui";
import { couleurs, espaces, rayons, textes } from "@/constants/theme";
import { useAuth } from "@/lib/auth";

export default function EcranAccueil() {
  const { profil, deconnexion } = useAuth();

  return (
    <Ecran>
      <Titre>Bonjour {profil?.nom_complet ?? ""}</Titre>
      <Aide>
        {profil?.localite ? `${profil.localite} · ` : ""}
        Votre exploitation est enregistrée.
      </Aide>

      <View style={styles.bandeau}>
        <Text style={styles.bandeauEmoji}>🌾</Text>
        <View style={styles.bandeauTextes}>
          <SousTitre>Tableau de bord en préparation</SousTitre>
          <Aide>
            Dépenses, rentabilité par cycle et calendrier sanitaire arrivent
            dans la prochaine version.
          </Aide>
        </View>
      </View>

      <View style={styles.pied}>
        <Bouton titre="Se déconnecter" variante="contour" onPress={deconnexion} />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    flexDirection: "row",
    gap: espaces.md,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  bandeauEmoji: {
    fontSize: textes.titre,
  },
  bandeauTextes: {
    flex: 1,
    gap: espaces.xs,
  },
  pied: {
    marginTop: "auto",
  },
});
