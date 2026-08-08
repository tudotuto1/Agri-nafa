// =============================================================================
// Accueil — tableau de bord.
//
// Deux requêtes seulement, lancées en parallèle : vue_tableau_bord pour les
// agrégats, vue_rentabilite_cycles pour le détail des cycles actifs. Les deux
// vues sont en security_invoker, donc la RLS filtre déjà sur l'utilisateur :
// aucun `.eq("user_id", …)` à écrire côté client, et rien à oublier d'écrire.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import {
  Aide,
  Badge,
  BarreProgression,
  Bouton,
  Ecran,
  Erreur,
  SousTitre,
  Squelette,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// PostgREST rend numeric et bigint en nombres JSON — vérifié contre la base,
// pas supposé. Pas de conversion à faire à la réception.
// -----------------------------------------------------------------------------
type TableauBord = {
  nom_complet: string | null;
  cycles_actifs: number;
  total_depenses: number;
  total_revenus: number;
  benefice_net: number;
  alertes_non_lues: number;
  alertes_urgentes: number;
  stocks_sous_seuil: number;
  depenses_a_valider: number;
};

type CycleActif = {
  cycle_id: string;
  nom_cycle: string;
  speculation: string | null;
  date_debut: string;
  date_fin_prevue: string | null;
  jours_avant_fin: number | null;
  benefice_net: number;
};

const CHAMPS_CYCLE =
  "cycle_id, nom_cycle, speculation, date_debut, date_fin_prevue, jours_avant_fin, benefice_net";

// -----------------------------------------------------------------------------
// Un montant en francs CFA se lit par tranches de trois chiffres. L'espace
// utilisé est insécable : « 1 245 500 F » ne doit jamais se couper en fin de
// ligne, sinon le chiffre devient illisible d'un coup d'œil.
// -----------------------------------------------------------------------------
const ESPACE_INSECABLE = " ";

export function formaterFcfa(montant: number | null | undefined): string {
  const arrondi = Math.round(montant ?? 0);
  const signe = arrondi < 0 ? "−" : "";
  const chiffres = Math.abs(arrondi)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_INSECABLE);
  return `${signe}${chiffres}${ESPACE_INSECABLE}F`;
}

// Avancement d'un cycle dans le temps, borné à [0, 1].
export function avancementCycle(debut: string, fin: string | null): number {
  if (!fin) return 0;
  const t0 = Date.parse(debut);
  const t1 = Date.parse(fin);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;
  return Math.min(Math.max((Date.now() - t0) / (t1 - t0), 0), 1);
}

function libelleEcheance(jours: number | null): string {
  if (jours === null) return "Sans date de fin";
  if (jours < 0) return `En retard de ${Math.abs(jours)} j`;
  if (jours === 0) return "Se termine aujourd'hui";
  return `${jours} j avant la fin`;
}

// =============================================================================
export default function EcranAccueil() {
  const router = useRouter();
  const { profil, deconnexion } = useAuth();

  const [bord, setBord] = useState<TableauBord | null>(null);
  const [cycles, setCycles] = useState<CycleActif[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);

    const [resBord, resCycles] = await Promise.all([
      supabase.from("vue_tableau_bord").select("*").single(),
      supabase
        .from("vue_rentabilite_cycles")
        .select(CHAMPS_CYCLE)
        .eq("statut", "actif")
        .order("date_fin_prevue", { ascending: true, nullsFirst: false }),
    ]);

    if (resBord.error) {
      setErreur("Impossible de charger votre tableau de bord.");
      return;
    }
    if (resCycles.error) {
      setErreur("Impossible de charger vos cycles en cours.");
      return;
    }

    setBord(resBord.data as TableauBord);
    setCycles((resCycles.data ?? []) as CycleActif[]);
  }, []);

  useEffect(() => {
    let actif = true;
    charger().finally(() => {
      if (actif) setChargement(false);
    });
    return () => {
      actif = false;
    };
  }, [charger]);

  const rafraichir = useCallback(async () => {
    setRafraichissement(true);
    await charger();
    setRafraichissement(false);
  }, [charger]);

  const prenom = (bord?.nom_complet ?? profil?.nom_complet ?? "").split(" ")[0];

  return (
    <Ecran
      refreshControl={
        <RefreshControl
          refreshing={rafraichissement}
          onRefresh={rafraichir}
          colors={[couleurs.vert]}
          tintColor={couleurs.vert}
        />
      }
    >
      <View style={styles.entete}>
        <View style={styles.enteteTextes}>
          <Titre>Bonjour {prenom}</Titre>
          {profil?.localite ? <Aide>{profil.localite}</Aide> : null}
        </View>
        {bord && bord.alertes_non_lues > 0 ? (
          <Badge
            texte={String(bord.alertes_non_lues)}
            ton={bord.alertes_urgentes > 0 ? "urgent" : "info"}
          />
        ) : null}
      </View>

      {chargement ? (
        <SqueletteAccueil />
      ) : !bord ? (
        <View style={styles.bloc}>
          <Erreur message={erreur ?? "Tableau de bord indisponible."} />
          <Bouton titre="Réessayer" onPress={rafraichir} chargement={rafraichissement} />
        </View>
      ) : (
        <>
          {/* Un rafraîchissement qui échoue ne doit pas effacer des chiffres
              déjà valides : sur un réseau rural, la coupure est la norme. On
              signale l'échec sans vider l'écran. */}
          {erreur ? (
            <View style={styles.bloc}>
              <Erreur message={`${erreur} Chiffres affichés : ceux du dernier chargement réussi.`} />
              <Bouton
                titre="Réessayer"
                variante="contour"
                onPress={rafraichir}
                chargement={rafraichissement}
              />
            </View>
          ) : null}

          <CarteBenefice bord={bord} />

          {bord.alertes_non_lues > 0 ? (
            <LigneAlerte
              nombre={bord.alertes_non_lues}
              urgentes={bord.alertes_urgentes}
            />
          ) : null}

          {bord.depenses_a_valider > 0 ? (
            <Rappel
              emoji="🎤"
              texte={`${bord.depenses_a_valider} dépense${
                bord.depenses_a_valider > 1 ? "s" : ""
              } dictée${bord.depenses_a_valider > 1 ? "s" : ""} à valider`}
              onPress={() => router.push("/(app)/depense-vocale")}
            />
          ) : null}

          <SousTitre>Cycles en cours</SousTitre>
          {cycles.length === 0 ? (
            <AucunCycle onCreer={() => router.push("/(app)/nouveau-cycle")} />
          ) : (
            <View style={styles.liste}>
              {cycles.map((cycle) => (
                <CarteCycle key={cycle.cycle_id} cycle={cycle} />
              ))}
            </View>
          )}

          <SousTitre>Actions rapides</SousTitre>
          <View style={styles.grille}>
            <ActionRapide
              emoji="🎤"
              libelle="Dicter une dépense"
              onPress={() => router.push("/(app)/depense-vocale")}
            />
            <ActionRapide
              emoji="💰"
              libelle="Nouvelle vente"
              onPress={() => router.push("/(app)/vente")}
            />
            <ActionRapide
              emoji="📋"
              libelle="Fiche prévente"
              onPress={() => router.push("/(app)/prevente")}
            />
            <ActionRapide
              emoji="📖"
              libelle="Guides"
              onPress={() => router.push("/(app)/guides")}
            />
          </View>
        </>
      )}

      <View style={styles.pied}>
        <Bouton titre="Se déconnecter" variante="contour" onPress={deconnexion} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function CarteBenefice({ bord }: { bord: TableauBord }) {
  const positif = bord.benefice_net >= 0;
  return (
    <View style={styles.carteBenefice}>
      <Text style={styles.benefLibelle}>Bénéfice net</Text>
      <Text
        style={[styles.benefMontant, { color: positif ? couleurs.vert : couleurs.rouge }]}
        // Le chiffre peut être long : on le réduit plutôt que de le tronquer.
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formaterFcfa(bord.benefice_net)}
      </Text>

      <View style={styles.benefDetails}>
        <View style={styles.benefColonne}>
          <Text style={styles.benefDetailLibelle}>Revenus</Text>
          <Text style={[styles.benefDetailValeur, { color: couleurs.vert }]}>
            {formaterFcfa(bord.total_revenus)}
          </Text>
        </View>
        <View style={styles.separateur} />
        <View style={styles.benefColonne}>
          <Text style={styles.benefDetailLibelle}>Dépenses</Text>
          <Text style={[styles.benefDetailValeur, { color: couleurs.rouge }]}>
            {formaterFcfa(bord.total_depenses)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
function CarteCycle({ cycle }: { cycle: CycleActif }) {
  const avancement = avancementCycle(cycle.date_debut, cycle.date_fin_prevue);
  const enRetard = cycle.jours_avant_fin !== null && cycle.jours_avant_fin < 0;
  const imminent =
    cycle.jours_avant_fin !== null &&
    cycle.jours_avant_fin >= 0 &&
    cycle.jours_avant_fin <= 7;

  const couleurBarre = enRetard
    ? couleurs.rouge
    : imminent
      ? couleurs.or
      : couleurs.vert;

  return (
    <View style={styles.carteCycle}>
      <View style={styles.cycleEntete}>
        <View style={styles.cycleTextes}>
          <Text style={styles.cycleNom}>{cycle.nom_cycle}</Text>
          {cycle.speculation ? (
            <Text style={styles.cycleSpeculation}>{cycle.speculation}</Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.cycleBenefice,
            { color: cycle.benefice_net >= 0 ? couleurs.vert : couleurs.rouge },
          ]}
        >
          {formaterFcfa(cycle.benefice_net)}
        </Text>
      </View>

      <BarreProgression avancement={avancement} couleur={couleurBarre} />

      <Text style={[styles.cycleEcheance, enRetard && { color: couleurs.rouge }]}>
        {libelleEcheance(cycle.jours_avant_fin)}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
function LigneAlerte({ nombre, urgentes }: { nombre: number; urgentes: number }) {
  const urgent = urgentes > 0;
  return (
    <View style={[styles.alerte, urgent && styles.alerteUrgente]}>
      <Text style={styles.alerteEmoji}>{urgent ? "🔴" : "🔔"}</Text>
      <Text style={styles.alerteTexte}>
        {nombre} alerte{nombre > 1 ? "s" : ""} non lue{nombre > 1 ? "s" : ""}
        {urgent ? `, dont ${urgentes} urgente${urgentes > 1 ? "s" : ""}` : ""}
      </Text>
    </View>
  );
}

function Rappel({
  emoji,
  texte,
  onPress,
}: {
  emoji: string;
  texte: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.rappel, pressed && styles.presse]}
    >
      <Text style={styles.alerteEmoji}>{emoji}</Text>
      <Text style={styles.alerteTexte}>{texte}</Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
function AucunCycle({ onCreer }: { onCreer: () => void }) {
  return (
    <View style={styles.vide}>
      <Text style={styles.videEmoji}>🌱</Text>
      <SousTitre>Aucun cycle en cours</SousTitre>
      <Aide>
        Créez un cycle pour suivre vos dépenses, vos récoltes et savoir ce que
        votre production vous rapporte vraiment.
      </Aide>
      <Bouton titre="Créer un cycle" onPress={onCreer} />
    </View>
  );
}

// -----------------------------------------------------------------------------
function ActionRapide({
  emoji,
  libelle,
  onPress,
}: {
  emoji: string;
  libelle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.presse]}
    >
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={styles.actionLibelle}>{libelle}</Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
function SqueletteAccueil() {
  return (
    <View style={styles.bloc}>
      <View style={styles.carteBenefice}>
        <Squelette hauteur={16} largeur="40%" />
        <Squelette hauteur={44} largeur="70%" />
        <Squelette hauteur={38} />
      </View>
      <Squelette hauteur={22} largeur="45%" />
      <View style={styles.carteCycle}>
        <Squelette hauteur={20} largeur="60%" />
        <Squelette hauteur={10} />
        <Squelette hauteur={14} largeur="35%" />
      </View>
      <View style={styles.carteCycle}>
        <Squelette hauteur={20} largeur="50%" />
        <Squelette hauteur={10} />
        <Squelette hauteur={14} largeur="30%" />
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
  },
  enteteTextes: {
    flex: 1,
    gap: espaces.xs,
  },
  bloc: {
    gap: espaces.md,
  },
  liste: {
    gap: espaces.sm,
  },

  carteBenefice: {
    gap: espaces.sm,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  benefLibelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.attenue,
  },
  benefMontant: {
    fontSize: 40,
    fontWeight: "700",
  },
  benefDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: espaces.sm,
    paddingTop: espaces.md,
    borderTopWidth: 2,
    borderTopColor: couleurs.ligne,
  },
  benefColonne: {
    flex: 1,
    gap: espaces.xs,
  },
  separateur: {
    width: 2,
    alignSelf: "stretch",
    backgroundColor: couleurs.ligne,
    marginHorizontal: espaces.md,
  },
  benefDetailLibelle: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  benefDetailValeur: {
    fontSize: textes.corps,
    fontWeight: "700",
  },

  carteCycle: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  cycleEntete: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
  },
  cycleTextes: {
    flex: 1,
    gap: 2,
  },
  cycleNom: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  cycleSpeculation: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  cycleBenefice: {
    fontSize: textes.corps,
    fontWeight: "700",
  },
  cycleEcheance: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },

  alerte: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: "#FFF8E1",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.or,
  },
  alerteUrgente: {
    backgroundColor: "#FDECEE",
    borderLeftColor: couleurs.rouge,
  },
  rappel: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    minHeight: CIBLE_TACTILE,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  alerteEmoji: {
    fontSize: textes.sousTitre,
  },
  alerteTexte: {
    flex: 1,
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },

  vide: {
    alignItems: "center",
    gap: espaces.md,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: couleurs.ligne,
  },
  videEmoji: {
    fontSize: 48,
  },

  grille: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: espaces.sm,
  },
  action: {
    // Deux colonnes : (100% - un interstice) / 2
    width: "48%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: espaces.sm,
    minHeight: 104,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  actionEmoji: {
    fontSize: 30,
  },
  actionLibelle: {
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
    textAlign: "center",
  },
  presse: {
    opacity: 0.85,
  },

  pied: {
    marginTop: espaces.lg,
  },
});
