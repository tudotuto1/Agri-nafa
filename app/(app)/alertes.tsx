// =============================================================================
// Alertes.
//
// Deux sections : ce qui attend une réaction, puis ce qui est déjà traité.
// L'historique n'est pas décoratif — un producteur qui veut savoir depuis quand
// une caméra signale une tache sur ses feuilles a besoin de la première alerte,
// pas seulement de la dernière.
//
// Toucher une alerte la marque lue. C'est un geste unique : le producteur ne
// devrait pas avoir à comprendre la différence entre « ouvrir » et « marquer
// lu ». La navigation, elle, ne suit jamais aveuglément `action_cible` — voir
// `destination()` dans lib/surveillance.ts.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import {
  Aide,
  Bouton,
  Ecran,
  Erreur,
  EtatVide,
  SousTitre,
  Squelette,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { VIDES } from "@/components/illustrations-vides";
import { dateRelative } from "@/lib/format";
import {
  categorie,
  couleurGravite,
  destination,
  libelleGravite,
  type Alerte,
} from "@/lib/surveillance";
import { supabase } from "@/lib/supabase";

const CHAMPS =
  "id, categorie, gravite, titre, message, cycle_id, camera_id, capture_id, action_cible, lue_at, created_at";

// =============================================================================
export default function EcranAlertes() {
  const router = useRouter();

  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toutMarquer, setToutMarquer] = useState(false);

  // ---------------------------------------------------------------------------
  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from("alertes")
      .select(CHAMPS)
      .order("created_at", { ascending: false });

    if (error) {
      setErreur("Impossible de charger vos alertes. Réessayez.");
      return;
    }
    setErreur(null);
    setAlertes((data ?? []) as Alerte[]);
  }, []);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  const rafraichir = useCallback(async () => {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }, [charger]);

  const nonLues = useMemo(() => alertes.filter((a) => a.lue_at === null), [alertes]);
  const historique = useMemo(() => alertes.filter((a) => a.lue_at !== null), [alertes]);

  // ---------------------------------------------------------------------------
  const ouvrir = useCallback(
    async (alerte: Alerte) => {
      const cible = destination(alerte);

      // L'état local passe à « lue » tout de suite : l'écran doit répondre au
      // doigt, pas à la latence d'une 2G rurale. L'écriture suit.
      if (alerte.lue_at === null) {
        const maintenant = new Date().toISOString();
        setAlertes((liste) =>
          liste.map((a) => (a.id === alerte.id ? { ...a, lue_at: maintenant } : a)),
        );

        const { error } = await supabase
          .from("alertes")
          .update({ lue_at: maintenant })
          .eq("id", alerte.id);

        if (error) {
          // On remet l'alerte en non-lue : lui laisser l'air traitée alors que
          // rien n'est parti la ferait disparaître au prochain chargement.
          setAlertes((liste) =>
            liste.map((a) => (a.id === alerte.id ? { ...a, lue_at: null } : a)),
          );
          setErreur("Cette alerte n'a pas pu être marquée comme lue. Réessayez.");
        }
      }

      if (cible) router.push(cible);
    },
    [router],
  );

  const marquerTout = useCallback(async () => {
    if (nonLues.length === 0) return;
    setToutMarquer(true);
    setErreur(null);

    const maintenant = new Date().toISOString();
    const { error } = await supabase
      .from("alertes")
      .update({ lue_at: maintenant })
      .is("lue_at", null);

    setToutMarquer(false);
    if (error) {
      setErreur("Les alertes n'ont pas pu être marquées comme lues. Réessayez.");
      return;
    }
    await charger();
  }, [nonLues.length, charger]);

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Alertes</Titre>
        <Squelette hauteur={110} />
        <Squelette hauteur={110} />
        <Squelette hauteur={110} />
      </Ecran>
    );
  }

  return (
    <Ecran
      refreshControl={
        <RefreshControl
          refreshing={rafraichissement}
          onRefresh={rafraichir}
          tintColor={couleurs.vertFonce}
          colors={[couleurs.vertFonce]}
        />
      }
    >
      <Titre>Alertes</Titre>

      <Erreur message={erreur} />

      {alertes.length === 0 ? (
        <EtatVide
          illustration={VIDES.aucune_alerte}
          titre="Aucune alerte"
          texte="Vos alertes apparaîtront ici : rappels du calendrier sanitaire, stocks qui s'épuisent, mouvements de prix sur les marchés."
        />
      ) : null}

      {nonLues.length > 0 ? (
        <>
          <SousTitre>
            {nonLues.length} alerte{nonLues.length > 1 ? "s" : ""} non lue
            {nonLues.length > 1 ? "s" : ""}
          </SousTitre>
          <View style={styles.liste}>
            {nonLues.map((alerte) => (
              <LigneAlerte
                key={alerte.id}
                alerte={alerte}
                onPress={() => ouvrir(alerte)}
              />
            ))}
          </View>
          <Bouton
            titre="Tout marquer comme lu"
            variante="contour"
            chargement={toutMarquer}
            onPress={marquerTout}
          />
        </>
      ) : null}

      {historique.length > 0 ? (
        <>
          <SousTitre>Historique</SousTitre>
          <Aide>
            Les alertes déjà lues restent consultables : c'est ce qui permet de
            dater le début d'un problème.
          </Aide>
          <View style={styles.liste}>
            {historique.map((alerte) => (
              <LigneAlerte
                key={alerte.id}
                alerte={alerte}
                onPress={() => ouvrir(alerte)}
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function LigneAlerte({ alerte, onPress }: { alerte: Alerte; onPress: () => void }) {
  const lue = alerte.lue_at !== null;
  const cat = categorie(alerte.categorie);
  const bordure = couleurGravite(alerte.gravite);
  const mene = destination(alerte) !== null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${libelleGravite(alerte.gravite)} — ${alerte.titre}${lue ? "" : ", non lue"}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.carte,
        // La gravité tient dans la bordure gauche : elle reste visible même
        // quand le texte déborde, et ne coûte pas un mot de plus à lire.
        { borderLeftColor: bordure },
        lue && styles.carteLue,
        pressed && styles.presse,
      ]}
    >
      <View style={styles.entete}>
        <Text style={styles.emoji}>{cat.emoji}</Text>
        <View style={styles.enteteTextes}>
          <Text style={[styles.titre, lue && styles.texteLu]}>{alerte.titre}</Text>
          <Text style={styles.categorie}>
            {cat.libelle} · {dateRelative(alerte.created_at)}
          </Text>
        </View>
        {lue ? null : <View style={[styles.pastille, { backgroundColor: bordure }]} />}
      </View>

      <Text style={[styles.message, lue && styles.texteLu]}>{alerte.message}</Text>

      {mene ? <Text style={styles.action}>Ouvrir ›</Text> : null}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  liste: { gap: espaces.sm },
  pied: { marginTop: espaces.lg },
  presse: { opacity: 0.85 },

  carte: {
    gap: espaces.sm,
    minHeight: CIBLE_TACTILE,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    borderLeftWidth: 8,
  },
  // Lue : atténuée, jamais masquée. L'historique doit rester lisible.
  carteLue: { backgroundColor: couleurs.papier },
  texteLu: { color: couleurs.attenue },

  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  emoji: { fontSize: 28 },
  enteteTextes: { flex: 1, gap: 2 },
  titre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  categorie: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  pastille: {
    width: 14,
    height: 14,
    borderRadius: rayons.rond,
  },
  message: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },
  action: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },

});
