// =============================================================================
// Saisies en attente.
//
// Une saisie perdue en silence est le pire scénario de cette application. Tout
// le reste — un chiffre approximatif, un écran laid, une lenteur — se rattrape.
// Une dépense de 45 000 F qui n'est jamais arrivée et dont personne n'a été
// prévenu fausse une comptabilité qu'on voulait pouvoir présenter à un prêteur.
//
// Cet écran est la contrepartie de la file : ce qui n'a pas pu partir doit
// pouvoir être vu, relancé ou supprimé — en connaissance de cause.
//
// Deux sections, dans cet ordre :
//   1. ce qui a échoué et ne repartira plus seul  → demande une décision
//   2. ce qui attend encore le réseau             → n'en demande aucune
// =============================================================================

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Aide,
  Bouton,
  Ecran,
  EtatVide,
  SousTitre,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { VIDES } from "@/components/illustrations-vides";
import { horodatageEnFrancais } from "@/lib/format";
import {
  ENTREES_MAX,
  libelleTable,
  reessayerEntree,
  resumeEntree,
  supprimerEntree,
  useFileAttente,
  type EntreeFile,
} from "@/lib/file-attente";

// Le plafond n'a d'intérêt qu'une fois qu'on s'en approche. En dessous, le
// rappeler n'informe pas : il inquiète.
const SEUIL_AFFICHAGE_PLAFOND = Math.round(ENTREES_MAX * 0.75);

export default function EcranFileAttente() {
  const router = useRouter();
  const { entrees, total, enAttente, abandonnees, rejouer } = useFileAttente();
  const [occupe, setOccupe] = useState<string | null>(null);

  const echouees = useMemo(() => entrees.filter((e) => e.erreur), [entrees]);
  const enCours = useMemo(() => entrees.filter((e) => !e.erreur), [entrees]);

  const relancer = useCallback(async (entree: EntreeFile) => {
    setOccupe(entree.id);
    await reessayerEntree(entree.id);
    // Remettre le compteur à zéro ne suffit pas : sans rejeu, l'entrée
    // attendrait la prochaine bascule du réseau pour être retentée.
    await rejouer();
    setOccupe(null);
  }, [rejouer]);

  const supprimer = useCallback((entree: EntreeFile) => {
    Alert.alert(
      "Supprimer cette saisie ?",
      `${libelleTable(entree.table)}${
        resumeEntree(entree) ? ` — ${resumeEntree(entree)}` : ""
      }\n\nElle sera définitivement perdue. Cette action ne peut pas être annulée.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            setOccupe(entree.id);
            void supprimerEntree(entree.id).finally(() => setOccupe(null));
          },
        },
      ],
    );
  }, []);

  return (
    <Ecran>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Revenir à l'accueil"
        onPress={() => router.back()}
        style={styles.retour}
      >
        <Text style={styles.retourTexte}>‹ Accueil</Text>
      </Pressable>

      <Titre>Saisies en attente</Titre>

      {total === 0 ? (
        <EtatVide
          illustration={VIDES.file_vide}
          titre="Rien en attente"
          texte="Tout est enregistré. Aucune saisie n'attend sur le téléphone."
        />
      ) : (
        <Aide>
          {total} saisie{total > 1 ? "s" : ""} gardée{total > 1 ? "s" : ""} sur ce
          téléphone.
          {total >= SEUIL_AFFICHAGE_PLAFOND
            ? ` ${total} sur ${ENTREES_MAX} : au-delà, aucune nouvelle saisie ne pourra être gardée.`
            : ""}
        </Aide>
      )}

      {/* 1. Ce qui ne repartira plus seul ----------------------------------- */}
      {echouees.length > 0 ? (
        <View style={styles.bloc}>
          <SousTitre>
            {echouees.length} saisie{echouees.length > 1 ? "s" : ""} non envoyée
            {echouees.length > 1 ? "s" : ""}
          </SousTitre>
          <Aide>
            Ces saisies ne repartiront pas toutes seules. Corrigez la cause si
            vous le pouvez, puis réessayez — ou supprimez-les si elles font
            double emploi.
          </Aide>

          {echouees.map((entree) => (
            <View key={entree.id} style={[styles.carte, styles.carteEchec]}>
              <View style={styles.enTete}>
                <Text style={styles.table}>{libelleTable(entree.table)}</Text>
                <Text style={styles.date}>{horodatageEnFrancais(entree.creeeLe)}</Text>
              </View>

              {resumeEntree(entree) ? (
                <Text style={styles.resume}>{resumeEntree(entree)}</Text>
              ) : null}

              <Text style={styles.motif}>{entree.erreur}</Text>

              <View style={styles.actions}>
                <Bouton
                  titre="Réessayer"
                  onPress={() => void relancer(entree)}
                  chargement={occupe === entree.id}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer cette ${libelleTable(
                    entree.table,
                  ).toLowerCase()}`}
                  onPress={() => supprimer(entree)}
                  disabled={occupe === entree.id}
                  style={({ pressed }) => [
                    styles.supprimer,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={styles.supprimerTexte}>Supprimer</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* 2. Ce qui attend simplement le réseau ------------------------------ */}
      {enCours.length > 0 ? (
        <View style={styles.bloc}>
          <SousTitre>
            {enAttente} en attente du réseau
          </SousTitre>
          <Aide>
            Rien à faire : elles partiront seules dès que la connexion revient.
          </Aide>

          {enCours.map((entree) => (
            <View key={entree.id} style={styles.carte}>
              <View style={styles.enTete}>
                <Text style={styles.table}>{libelleTable(entree.table)}</Text>
                <Text style={styles.date}>{horodatageEnFrancais(entree.creeeLe)}</Text>
              </View>
              {resumeEntree(entree) ? (
                <Text style={styles.resume}>{resumeEntree(entree)}</Text>
              ) : null}
              {entree.tentatives > 0 ? (
                <Text style={styles.tentatives}>
                  {entree.tentatives} essai{entree.tentatives > 1 ? "s" : ""} déjà
                  effectué{entree.tentatives > 1 ? "s" : ""}.
                </Text>
              ) : null}
            </View>
          ))}

          <Bouton titre="Tout renvoyer maintenant" onPress={() => void rejouer()} />
        </View>
      ) : null}

      {abandonnees === 0 && enAttente === 0 ? null : <View style={styles.pied} />}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  retour: {
    minHeight: CIBLE_TACTILE,
    justifyContent: "center",
  },
  retourTexte: {
    fontSize: textes.corps,
    color: couleurs.vertFonce,
    fontWeight: "600",
  },
  bloc: {
    gap: espaces.sm,
    marginTop: espaces.lg,
  },
  carte: {
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.papier,
    borderWidth: 1,
    borderColor: couleurs.ligne,
    gap: espaces.xs,
  },
  // L'échec se distingue au premier coup d'œil, sans avoir à lire.
  carteEchec: {
    backgroundColor: "#FDECEE",
    borderColor: "#F5C6CC",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.rouge,
  },
  enTete: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: espaces.sm,
  },
  table: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  date: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  resume: {
    fontSize: textes.corps,
    color: couleurs.encre,
  },
  motif: {
    fontSize: textes.petit,
    color: couleurs.rouge,
    marginTop: espaces.xs,
  },
  tentatives: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  actions: {
    gap: espaces.sm,
    marginTop: espaces.sm,
  },
  supprimer: {
    minHeight: CIBLE_TACTILE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: rayons.md,
    borderWidth: 2,
    borderColor: couleurs.rouge,
  },
  supprimerTexte: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.rouge,
  },
  pied: { height: espaces.xxl },
});
