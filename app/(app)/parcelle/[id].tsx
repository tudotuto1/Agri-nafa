// =============================================================================
// Fiche d'une parcelle : le tracé, la surface, et ce qui pousse dessus.
//
// Le lien parcelle ↔ cycle se fait ici et pas à la création du cycle : au
// moment de lancer une production, le producteur pense à sa culture et à sa
// date de semis, pas à sa cartographie. Il rattache après coup, quand il vient
// voir sa parcelle.
//
// La contrainte `fk_cycle_parcelle` porte sur (parcelle_id, user_id) : la base
// refuse de rattacher un cycle à la parcelle de quelqu'un d'autre, quoi que
// l'application envoie.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Carte } from "@/components/carte";
import {
  Aide,
  Bouton,
  Ecran,
  Erreur,
  SousTitre,
  Squelette,
  Succes,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { messageErreurLisible } from "@/lib/erreurs";
import { dateEnFrancais } from "@/lib/format";
import {
  OUAGADOUGOU,
  SOMMETS_MINIMUM,
  centre,
  depuisGeoJson,
  formaterSuperficie,
  positionValide,
  surfaceHa,
  type Position,
} from "@/lib/geo";
import { supabase } from "@/lib/supabase";

type Parcelle = {
  id: string;
  nom: string;
  superficie_ha: number | string | null;
  type_sol: string | null;
  irriguee: boolean;
  geometrie: unknown;
  centre_lat: number | string | null;
  centre_lng: number | string | null;
};

type Cycle = {
  id: string;
  nom: string;
  statut: string;
  parcelle_id: string | null;
  date_debut: string;
  date_fin_prevue: string | null;
  speculation_id: string | null;
};

type Speculation = { id: string; nom: string; icone: string | null };

const CHAMPS_PARCELLE =
  "id, nom, superficie_ha, type_sol, irriguee, geometrie, centre_lat, centre_lng";
const CHAMPS_CYCLE =
  "id, nom, statut, parcelle_id, date_debut, date_fin_prevue, speculation_id";

// =============================================================================
export default function EcranParcelle() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [parcelle, setParcelle] = useState<Parcelle | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [speculations, setSpeculations] = useState<Speculation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const [choixOuvert, setChoixOuvert] = useState(false);
  const [rattachement, setRattachement] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  const charger = useCallback(async () => {
    if (!id) return;

    const [resParcelle, resCycles, resSpec] = await Promise.all([
      supabase.from("parcelles").select(CHAMPS_PARCELLE).eq("id", id).maybeSingle(),
      // Tous les cycles vivants, pas seulement ceux de cette parcelle : la même
      // requête sert à afficher ce qui pousse ici et à proposer ce qu'on peut y
      // rattacher.
      supabase
        .from("cycles_production")
        .select(CHAMPS_CYCLE)
        .in("statut", ["actif", "planifie"])
        .is("deleted_at", null)
        .order("date_debut", { ascending: false }),
      supabase.from("speculations").select("id, nom, icone"),
    ]);

    if (resParcelle.error || resCycles.error) {
      setErreur("Impossible de charger cette parcelle. Réessayez.");
      return;
    }

    setErreur(null);
    setParcelle((resParcelle.data ?? null) as Parcelle | null);
    setCycles((resCycles.data ?? []) as Cycle[]);
    setSpeculations((resSpec.data ?? []) as Speculation[]);
  }, [id]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  // Un cycle peut avoir été créé ailleurs pendant que cette fiche restait
  // montée sous un autre écran : on relit au retour.
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger]),
  );

  useEffect(() => {
    if (!confirmation) return;
    const t = setTimeout(() => setConfirmation(null), 6000);
    return () => clearTimeout(t);
  }, [confirmation]);

  // ---------------------------------------------------------------------------
  const sommets = useMemo(
    () => depuisGeoJson(parcelle?.geometrie),
    [parcelle?.geometrie],
  );
  const tracee = sommets.length >= SOMMETS_MINIMUM;

  const nomsSpeculations = useMemo(
    () => new Map(speculations.map((s) => [s.id, s])),
    [speculations],
  );

  const ici = useMemo(
    () => cycles.filter((c) => c.parcelle_id === id),
    [cycles, id],
  );
  // Un cycle déjà placé ailleurs peut être déplacé, mais c'est un geste
  // différent de « rattacher » : on ne propose que ceux qui n'ont pas de
  // parcelle, pour ne pas défaire un rattachement par mégarde.
  const libres = useMemo(
    () => cycles.filter((c) => c.parcelle_id === null),
    [cycles],
  );

  /** Centre d'ouverture : le tracé, sinon le centre enregistré, sinon Ouaga. */
  const centreCarte: Position = useMemo(() => {
    if (tracee) return centre(sommets) ?? OUAGADOUGOU;
    return (
      positionValide(parcelle?.centre_lat, parcelle?.centre_lng) ?? OUAGADOUGOU
    );
  }, [tracee, sommets, parcelle?.centre_lat, parcelle?.centre_lng]);

  // ---------------------------------------------------------------------------
  const rattacher = useCallback(
    async (cycle: Cycle) => {
      if (!id) return;
      setRattachement(cycle.id);
      setErreur(null);

      const { error } = await supabase
        .from("cycles_production")
        .update({ parcelle_id: id })
        .eq("id", cycle.id);

      setRattachement(null);
      if (error) {
        setErreur(messageErreurLisible(error, "ce cycle"));
        return;
      }

      setConfirmation(`${cycle.nom} est maintenant sur cette parcelle.`);
      setChoixOuvert(false);
      await charger();
    },
    [id, charger],
  );

  const detacher = useCallback(
    async (cycle: Cycle) => {
      setRattachement(cycle.id);
      setErreur(null);

      const { error } = await supabase
        .from("cycles_production")
        .update({ parcelle_id: null })
        .eq("id", cycle.id);

      setRattachement(null);
      if (error) {
        setErreur(messageErreurLisible(error, "ce cycle"));
        return;
      }

      setConfirmation(`${cycle.nom} n'est plus rattaché à cette parcelle.`);
      await charger();
    },
    [charger],
  );

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Squelette hauteur={36} largeur="70%" />
        <Squelette hauteur={220} />
        <Squelette hauteur={90} />
      </Ecran>
    );
  }

  if (!parcelle) {
    return (
      <Ecran>
        <Titre>Parcelle introuvable</Titre>
        <Aide>
          Cette parcelle a peut-être été retirée, ou elle n'est pas encore
          partie du téléphone. Si vous venez de la créer sans réseau, elle
          apparaîtra dès que la connexion revient.
        </Aide>
        <Erreur message={erreur} />
        <View style={styles.pied}>
          <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Titre>{parcelle.nom}</Titre>

      <Succes message={confirmation} />
      <Erreur message={erreur} />

      {tracee ? (
        <Carte
          mode="lecture"
          sommets={sommets}
          centreDefaut={centreCarte}
          style={styles.carte}
        />
      ) : (
        <View style={styles.sansTrace}>
          <Text style={styles.sansTraceEmoji}>🗺️</Text>
          <Text style={styles.sansTraceTexte}>
            Cette parcelle n'a pas de tracé. La surface saisie suffit pour les
            calculs ; le contour ne sert qu'à s'y retrouver.
          </Text>
        </View>
      )}

      <View style={styles.chiffres}>
        <Chiffre libelle="Superficie" valeur={formaterSuperficie(parcelle.superficie_ha)} />
        {tracee ? (
          <Chiffre
            libelle="Surface du tracé"
            valeur={formaterSuperficie(surfaceHa(sommets))}
          />
        ) : null}
        <Chiffre libelle="Type de sol" valeur={parcelle.type_sol ?? "Non précisé"} />
        <Chiffre
          libelle="Irrigation"
          valeur={parcelle.irriguee ? "Parcelle irriguée" : "Pluvial"}
        />
      </View>

      {/* ------------------------------------------------------------------- */}
      <SousTitre>Ce qui pousse ici</SousTitre>

      {ici.length === 0 ? (
        <Aide>
          Aucun cycle n'est rattaché à cette parcelle pour l'instant.
        </Aide>
      ) : (
        <View style={styles.liste}>
          {ici.map((cycle) => (
            <LigneCycle
              key={cycle.id}
              cycle={cycle}
              speculation={
                cycle.speculation_id
                  ? nomsSpeculations.get(cycle.speculation_id)
                  : undefined
              }
              actionTitre="Retirer"
              enCours={rattachement === cycle.id}
              onAction={() => detacher(cycle)}
            />
          ))}
        </View>
      )}

      {choixOuvert ? (
        <View style={styles.choix}>
          <SousTitre>Quel cycle rattacher ?</SousTitre>
          {libres.length === 0 ? (
            <Aide>
              Tous vos cycles en cours sont déjà placés sur une parcelle. Créez
              un nouveau cycle depuis l'accueil pour en rattacher un ici.
            </Aide>
          ) : (
            <View style={styles.liste}>
              {libres.map((cycle) => (
                <LigneCycle
                  key={cycle.id}
                  cycle={cycle}
                  speculation={
                    cycle.speculation_id
                      ? nomsSpeculations.get(cycle.speculation_id)
                      : undefined
                  }
                  actionTitre="Rattacher"
                  enCours={rattachement === cycle.id}
                  onAction={() => rattacher(cycle)}
                />
              ))}
            </View>
          )}
          <Bouton
            titre="Fermer"
            variante="contour"
            onPress={() => setChoixOuvert(false)}
          />
        </View>
      ) : (
        <Bouton titre="Rattacher un cycle" onPress={() => setChoixOuvert(true)} />
      )}

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function LigneCycle({
  cycle,
  speculation,
  actionTitre,
  enCours,
  onAction,
}: {
  cycle: Cycle;
  speculation?: Speculation;
  actionTitre: string;
  enCours: boolean;
  onAction: () => void;
}) {
  return (
    <View style={styles.cycle}>
      <Text style={styles.cycleEmoji}>{speculation?.icone ?? "🌱"}</Text>
      <View style={styles.cycleTextes}>
        <Text style={styles.cycleNom}>{cycle.nom}</Text>
        <Text style={styles.cycleDetail}>
          {speculation?.nom ? `${speculation.nom} · ` : ""}
          {cycle.statut === "planifie" ? "Planifié" : "En cours"}
        </Text>
        <Text style={styles.cycleDate}>
          Semis le {dateEnFrancais(cycle.date_debut)}
          {cycle.date_fin_prevue
            ? ` · récolte prévue le ${dateEnFrancais(cycle.date_fin_prevue)}`
            : ""}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionTitre} ${cycle.nom}`}
        accessibilityState={{ busy: enCours }}
        disabled={enCours}
        onPress={onAction}
        style={({ pressed }) => [styles.cycleAction, pressed && styles.presse]}
      >
        <Text style={styles.cycleActionTexte}>{enCours ? "…" : actionTitre}</Text>
      </Pressable>
    </View>
  );
}

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.chiffre}>
      <Text style={styles.chiffreLibelle}>{libelle}</Text>
      <Text style={styles.chiffreValeur}>{valeur}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  liste: { gap: espaces.sm },
  pied: { marginTop: espaces.lg, gap: espaces.sm },
  presse: { opacity: 0.85 },

  // Hauteur fixe : la carte vit dans une page qui défile, elle ne peut pas
  // prendre « le reste ».
  carte: { height: 260 },

  sansTrace: {
    alignItems: "center",
    gap: espaces.sm,
    padding: espaces.lg,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: couleurs.ligne,
  },
  sansTraceEmoji: { fontSize: 36 },
  sansTraceTexte: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.attenue,
    textAlign: "center",
  },

  chiffres: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  chiffre: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
  },
  chiffreLibelle: {
    width: 130,
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  chiffreValeur: {
    flex: 1,
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },

  choix: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderColor: couleurs.vert,
  },
  cycle: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
    minHeight: CIBLE_TACTILE,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  cycleEmoji: { fontSize: 28 },
  cycleTextes: { flex: 1, gap: 2 },
  cycleNom: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  cycleDetail: {
    fontSize: textes.petit,
    color: couleurs.encre,
  },
  cycleDate: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  cycleAction: {
    justifyContent: "center",
    minHeight: CIBLE_TACTILE,
    paddingHorizontal: espaces.md,
    borderRadius: rayons.sm,
    borderWidth: 2,
    borderColor: couleurs.vert,
  },
  cycleActionTexte: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },
});
