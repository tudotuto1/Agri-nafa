// =============================================================================
// Nouveau cycle — écran d'attente.
//
// Reçoit déjà la spéculation quand on arrive depuis un guide, et le plan
// complet quand on arrive depuis la planification inversée.
//
// L'écran de création n'existe pas encore. Tant qu'il n'existe pas, ce qui a
// été calculé est AFFICHÉ plutôt que gardé en silence : un producteur qui a
// choisi sa date de vente et obtenu sa date de mise en place doit repartir
// avec les deux, même si l'application ne sait pas encore les enregistrer.
// Perdre son travail sans le dire serait pire que l'écran manquant lui-même.
// =============================================================================

import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Bouton, Ecran, SousTitre, Titre } from "@/components/ui";
import { couleurs, espaces, rayons, textes } from "@/constants/theme";
import { dateEnFrancais } from "@/lib/format";
import { libelleModeConduite } from "@/lib/guides";

export default function EcranNouveauCycle() {
  const router = useRouter();
  const {
    speculation_nom: speculationNom,
    date_debut: dateDebut,
    date_cible_marche: dateCible,
    evenement_cible: evenement,
    mode_conduite: mode,
  } = useLocalSearchParams<{
    speculation_id?: string;
    speculation_nom?: string;
    itineraire_id?: string;
    date_debut?: string;
    date_cible_marche?: string;
    evenement_cible?: string;
    mode_conduite?: string;
  }>();

  const plan = Boolean(dateDebut && dateCible);

  return (
    <Ecran>
      <Titre>Nouveau cycle</Titre>

      <Text style={styles.explication}>
        {speculationNom
          ? `Bientôt : ouvrez un cycle de ${speculationNom} et suivez sa rentabilité du semis à la vente. Votre choix est déjà retenu.`
          : "Bientôt : ouvrez un cycle de culture ou d'élevage et suivez sa rentabilité du semis à la vente."}
      </Text>

      {plan ? (
        <View style={styles.plan}>
          <SousTitre>Votre plan</SousTitre>
          <Text style={styles.planNote}>
            Notez-le : l&apos;enregistrement n&apos;est pas encore possible.
          </Text>
          <Ligne libelle="Production" valeur={speculationNom ?? "—"} />
          <Ligne libelle="Mise en place" valeur={dateEnFrancais(dateDebut!)} />
          <Ligne libelle="Vente visée" valeur={dateEnFrancais(dateCible!)} />
          {mode ? (
            <Ligne libelle="Conduite" valeur={libelleModeConduite(mode) ?? mode} />
          ) : null}
          {evenement ? <Ligne libelle="Occasion" valeur={evenement} /> : null}
        </View>
      ) : null}

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneLibelle}>{libelle}</Text>
      <Text style={styles.ligneValeur}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  explication: {
    fontSize: textes.corps,
    lineHeight: 26,
    color: couleurs.attenue,
  },
  plan: {
    marginTop: espaces.lg,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    gap: espaces.xs,
  },
  planNote: {
    fontSize: textes.petit,
    color: couleurs.attenue,
    marginBottom: espaces.sm,
  },
  ligne: { flexDirection: "row", justifyContent: "space-between", gap: espaces.sm },
  ligneLibelle: { fontSize: textes.petit, color: couleurs.attenue },
  ligneValeur: { fontSize: textes.corps, fontWeight: "700", color: couleurs.encre },
  pied: { marginTop: espaces.xl },
});
