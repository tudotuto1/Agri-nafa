// =============================================================================
// Bouton d'assistant flottant, et sa feuille.
//
// L'assistant existait déjà, mais enfoui dans le cinquième onglet d'un écran
// de guide : il fallait savoir qu'il était là pour y arriver. Ce bouton le
// rend joignable depuis n'importe quel écran de l'application.
//
// -----------------------------------------------------------------------------
// UNE FEUILLE, PAS UNE PAGE
//
// Une navigation démonterait l'écran courant et emporterait la saisie en
// cours — la dépense à moitié remplie, le prix qu'on était en train de taper.
// Poser une question ne doit rien coûter : la feuille se referme et l'écran
// est resté exactement où il était.
//
// -----------------------------------------------------------------------------
// LE GUIDE, QU'IL FAUT BIEN CHOISIR
//
// L'assistant ne répond que depuis un guide, il lui faut donc un
// `itineraire_id`. Deux chemins, dans cet ordre, parce que c'est l'ordre de
// probabilité : on pose presque toujours une question sur ce qu'on cultive en
// ce moment. Les guides des cycles actifs viennent donc en premier, la liste
// complète n'est proposée qu'ensuite ou à la demande.
//
// Le choix est mémorisé tant que l'application tourne — cet état vit dans le
// composant, monté par la disposition du groupe (app), donc conservé d'un
// écran à l'autre et perdu à la déconnexion. C'est exactement la durée
// voulue. Un moyen d'en changer reste visible en permanence : mémoriser un
// choix sans pouvoir le défaire serait pire que de reposer la question.
//
// -----------------------------------------------------------------------------
// POURQUOI UNE REQUÊTE À PART PLUTÔT QUE useCyclesActifs
//
// `useCyclesActifs` ne remonte pas `itineraire_id`, et sans lui on ne sait pas
// départager les deux guides du bovin d'embouche. Il charge par ailleurs
// quatre tables dont la rentabilité, inutiles ici.
//
// -----------------------------------------------------------------------------
// OÙ VIVENT LES DONNÉES, ET POURQUOI PAS DANS LA FEUILLE
//
// `Modal` démonte ses enfants dès qu'il se referme — vérifié dans son rendu,
// qui renvoie null tant que `visible` n'est pas vrai. Tout état logé dans la
// feuille serait donc rechargé à chaque ouverture : la liste des guides, les
// cycles, et surtout les étapes du guide retenu, qui portent les intrants.
// Sur un réseau facturé au mégaoctet, c'est la même facture payée dix fois.
//
// Guides, cycles, étapes et guide choisi vivent donc ici, dans un composant
// monté par la disposition du groupe (app) et qui ne se démonte qu'à la
// déconnexion. Le chargement reste paresseux — rien ne part tant que la
// feuille n'a pas été ouverte une première fois.
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { FormulaireAssistant } from "@/components/assistant";
import { IllustrationEspece, TAILLE_LISTE } from "@/components/illustration-espece";
import {
  FournisseurReserveBasse,
  MARGE_BOUTON_FLOTTANT,
  RESERVE_BOUTON_FLOTTANT,
  TAILLE_BOUTON_FLOTTANT,
} from "@/components/reserve-basse";
import { Aide, Bouton, Erreur, Squelette } from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { libelleModeConduite, questionsSuggerees, type EtapeGuide } from "@/lib/guides";
import { supabase } from "@/lib/supabase";

/** Ce que la feuille a besoin de savoir d'un guide pour le proposer. */
type GuideChoisissable = {
  itineraire_id: string;
  speculation_id: string;
  speculation_code: string;
  speculation_nom: string;
  icone: string | null;
  mode_conduite: string | null;
  base_calcul: string;
  mois_semis_conseilles: number[] | null;
  duree_totale_jours: number | null;
};

/**
 * Encombrement du bouton flottant, réexporté ici parce que c'est le fichier du
 * bouton qu'on vient lire quand on se demande la place qu'il prend. La valeur
 * est définie dans reserve-basse.tsx, d'où le style ci-dessous la tire aussi :
 * une seule source, pas deux qui s'accordent par chance.
 *
 * `Ecran` l'applique déjà à tous les écrans du groupe (app) — l'écrire une
 * seconde fois sur un écran donné doublerait la marge.
 */
export { RESERVE_BOUTON_FLOTTANT };

// `titre` n'y figure pas : les cartes montrent le nom de la spéculation et son
// mode de conduite, jamais le libellé long. Les trois dernières colonnes ne
// sont pas lues ici mais par `questionsSuggerees`.
const COLONNES_GUIDE =
  "itineraire_id, speculation_id, speculation_code, speculation_nom, icone, mode_conduite, base_calcul, mois_semis_conseilles, duree_totale_jours";

// -----------------------------------------------------------------------------
// Le logo, redessiné.
//
// `assets/adaptive-icon.png` n'aurait pas convenu tel quel : son dessin
// n'occupe que le tiers central du fichier — la zone sûre imposée par les
// icônes adaptatives d'Android — et la pousse y est peinte en blanc cassé
// pour se détacher de la plaque de fond verte. Posé dans un bouton de 60 px,
// le motif serait tombé à 20 px utiles.
//
// Contrastes mesurés sur le fond vertFonce #007134 : l'or du drapeau donne
// 4,18 et le blanc 6,16. Le seuil applicable est celui des éléments non
// textuels, 3,0 — les deux passent. L'or n'aurait pas suffi pour du texte,
// mais ceci est un pictogramme.
// -----------------------------------------------------------------------------
function LogoAgriNafa({ taille }: { taille: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24">
      {/* La tige, du pied jusque sous l'étoile. */}
      <Path
        d="M 12 21.8 L 12 11.2"
        stroke={couleurs.blanc}
        strokeWidth={2.3}
        strokeLinecap="round"
      />
      {/* Feuille droite, puis feuille gauche, en quinconce comme sur l'icône.
          Elles ont été épaissies après rendu à la taille réelle : au premier
          tracé, plus fin, elles se réduisaient à des filaments de deux pixels
          et le motif se lisait comme une fourche. */}
      <Path
        d="M 12 15.8 C 13.1 12.0 15.5 10.3 18.3 10.7 C 18.2 14.3 15.7 16.6 12 15.8 Z"
        fill={couleurs.blanc}
      />
      <Path
        d="M 12 20.0 C 10.9 16.2 8.5 14.5 5.7 14.9 C 5.8 18.5 8.3 20.8 12 20.0 Z"
        fill={couleurs.blanc}
      />
      {/* L'étoile du drapeau. */}
      <Path
        d="M 12.00 1.80 L 13.26 5.46 L 17.14 5.53 L 14.04 7.86 L 15.17 11.57 L 12.00 9.35 L 8.83 11.57 L 9.96 7.86 L 6.86 5.53 L 10.74 5.46 Z"
        fill={couleurs.or}
      />
    </Svg>
  );
}

// -----------------------------------------------------------------------------
/**
 * Guides proposables, et ceux qui correspondent aux cycles en cours.
 *
 * Ne part qu'une fois `actif` passé à vrai — c'est-à-dire à la première
 * ouverture de la feuille — et ne repart plus ensuite.
 */
function useGuidesAssistant(actif: boolean) {
  const [guides, setGuides] = useState<GuideChoisissable[]>([]);
  const [duCycle, setDuCycle] = useState<GuideChoisissable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [demarre, setDemarre] = useState(false);

  // Deux effets, et ce n'est pas de la coquetterie. Mettre le drapeau à jour
  // depuis l'effet de chargement le ferait figurer dans ses dépendances :
  // React exécuterait alors le nettoyage du premier passage — donc
  // `vivant = false` — avant de relancer l'effet, et la requête en vol serait
  // jetée à son retour. La feuille resterait sur ses squelettes pour toujours.
  //
  // Ici le drapeau ne fait que passer une fois de faux à vrai, et ne revient
  // jamais : refermer la feuille ne rejette pas un chargement en cours.
  useEffect(() => {
    if (actif) setDemarre(true);
  }, [actif]);

  useEffect(() => {
    if (!demarre) return;
    let vivant = true;

    (async () => {
      const [resGuides, resCycles] = await Promise.all([
        supabase.from("vue_guides").select(COLONNES_GUIDE).order("speculation_nom"),
        supabase
          .from("cycles_production")
          .select("speculation_id, itineraire_id")
          .eq("statut", "actif")
          .is("deleted_at", null)
          .order("date_debut", { ascending: false }),
      ]);

      if (!vivant) return;

      if (resGuides.error) {
        setErreur("Impossible de charger les guides. Réessayez.");
        setChargement(false);
        return;
      }

      const liste = (resGuides.data ?? []) as GuideChoisissable[];
      setGuides(liste);

      // L'échec des cycles n'est pas bloquant : on retombe sur la liste
      // complète, qui reste utilisable.
      const lignes = (resCycles.data ?? []) as {
        speculation_id: string;
        itineraire_id: string | null;
      }[];

      // Un cycle désigne son itinéraire quand le mode de conduite a été
      // choisi. Sinon on remonte par la spéculation — et si elle porte
      // plusieurs guides, on les propose tous : deviner lequel serait un choix
      // pris à la place du producteur.
      const retenus = new Map<string, GuideChoisissable>();
      for (const ligne of lignes) {
        const candidats = ligne.itineraire_id
          ? liste.filter((g) => g.itineraire_id === ligne.itineraire_id)
          : liste.filter((g) => g.speculation_id === ligne.speculation_id);
        for (const g of candidats) retenus.set(g.itineraire_id, g);
      }
      setDuCycle([...retenus.values()]);
      setChargement(false);
    })();

    return () => {
      vivant = false;
    };
  }, [demarre]);

  return { guides, duCycle, chargement, erreur };
}

/**
 * Étapes du guide retenu. Elles ne servent qu'aux suggestions : les charger
 * pour les quatorze itinéraires d'avance ferait passer tout le référentiel sur
 * le réseau pour trois phrases.
 */
function useEtapesDuGuide(itineraireId: string | null) {
  const [etapes, setEtapes] = useState<EtapeGuide[]>([]);

  useEffect(() => {
    setEtapes([]);
    if (!itineraireId) return;
    let vivant = true;
    supabase
      .from("vue_etapes_guide")
      .select("*")
      .eq("itineraire_id", itineraireId)
      .order("ordre")
      .then(({ data, error }) => {
        if (vivant && !error) setEtapes((data ?? []) as EtapeGuide[]);
      });
    return () => {
      vivant = false;
    };
  }, [itineraireId]);

  return etapes;
}

// -----------------------------------------------------------------------------
export function BoutonAssistant({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const [choisi, setChoisi] = useState<GuideChoisissable | null>(null);

  // Ces trois-là survivent à la fermeture de la feuille, qui les démonterait.
  const { guides, duCycle, chargement, erreur } = useGuidesAssistant(ouvert);
  const etapes = useEtapesDuGuide(choisi?.itineraire_id ?? null);

  // Sans étapes, `questionsSuggerees` renvoie ses replis génériques plutôt que
  // rien : l'affichage est utile avant même que la requête soit revenue, puis
  // se précise.
  const suggestions = useMemo(
    () => questionsSuggerees(choisi, etapes),
    [choisi, etapes],
  );

  // L'écran guide porte déjà son onglet « Poser une question ». Deux entrées
  // vers la même fonction, à trente pixels l'une de l'autre, se liraient comme
  // deux fonctions différentes.
  //
  // expo-router retire les segments de groupe du chemin — vérifié dans
  // getRouteInfo, qui filtre tout segment entre parenthèses — donc `(app)`
  // n'y figure pas. `includes` plutôt que `startsWith` pour que la règle tienne
  // si la route est un jour regroupée autrement. Le `/` final distingue le
  // détail d'un guide de la liste `/guides`, qui garde le bouton.
  const masque = pathname.includes("/guide/");

  return (
    <FournisseurReserveBasse reserve={masque ? 0 : RESERVE_BOUTON_FLOTTANT}>
      <View style={styles.pile}>
        {children}

        {masque ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Poser une question à l'assistant"
            onPress={() => setOuvert(true)}
            style={({ pressed }) => [
              styles.flottant,
              { bottom: insets.bottom + MARGE_BOUTON_FLOTTANT },
              pressed && styles.flottantPresse,
            ]}
          >
            <LogoAgriNafa taille={34} />
          </Pressable>
        )}
      </View>

      <Modal
        visible={ouvert}
        animationType="slide"
        presentationStyle="pageSheet"
        // Sans ceci, le bouton retour d'Android ne referme pas la feuille.
        onRequestClose={() => setOuvert(false)}
      >
        <FeuilleAssistant
          guides={guides}
          duCycle={duCycle}
          chargement={chargement}
          erreur={erreur}
          choisi={choisi}
          suggestions={suggestions}
          onChoisir={setChoisi}
          onFermer={() => setOuvert(false)}
        />
      </Modal>
    </FournisseurReserveBasse>
  );
}

// -----------------------------------------------------------------------------
function FeuilleAssistant({
  guides,
  duCycle,
  chargement,
  erreur,
  choisi,
  suggestions,
  onChoisir,
  onFermer,
}: {
  guides: GuideChoisissable[];
  duCycle: GuideChoisissable[];
  chargement: boolean;
  erreur: string | null;
  choisi: GuideChoisissable | null;
  suggestions: string[];
  onChoisir: (guide: GuideChoisissable | null) => void;
  onFermer: () => void;
}) {
  // Seul état purement local : savoir si l'on regarde la liste complète. Le
  // perdre à la fermeture est voulu — on rouvre sur ses productions en cours.
  const [toutVoir, setToutVoir] = useState(false);

  const choisir = useCallback(
    (guide: GuideChoisissable) => {
      onChoisir(guide);
      setToutVoir(false);
    },
    [onChoisir],
  );

  // Rien à proposer depuis les cycles, ou demande explicite : la liste entière.
  const listeComplete = toutVoir || duCycle.length === 0;
  const proposes = listeComplete ? guides : duCycle;

  return (
    <SafeAreaView style={styles.feuille} edges={["top", "bottom"]}>
      <View style={styles.entete}>
        <Text style={styles.enteteTitre}>Poser une question</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          onPress={onFermer}
          style={({ pressed }) => [styles.fermer, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.fermerTexte}>Fermer</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.feuilleContenu}
        keyboardShouldPersistTaps="handled"
      >
        <Erreur message={erreur} />

        {chargement ? (
          <View style={styles.bloc}>
            <Squelette hauteur={28} />
            <Squelette hauteur={72} />
            <Squelette hauteur={72} />
          </View>
        ) : choisi ? (
          <>
            <View style={styles.choixFait}>
              <IllustrationEspece
                code={choisi.speculation_code}
                emoji={choisi.icone}
                taille={TAILLE_LISTE}
              />
              <View style={styles.choixTextes}>
                <Text style={styles.choixLibelle}>Sur le guide</Text>
                <Text style={styles.choixTitre}>{titreCourt(choisi)}</Text>
              </View>
            </View>
            <Bouton
              titre="Changer de guide"
              variante="contour"
              onPress={() => onChoisir(null)}
            />

            <FormulaireAssistant
              itineraireId={choisi.itineraire_id}
              suggestions={suggestions}
            />
          </>
        ) : (
          <View style={styles.bloc}>
            <Text style={styles.consigne}>
              {listeComplete
                ? "Sur quel guide porte votre question ?"
                : "Sur quelle production porte votre question ?"}
            </Text>

            <Aide>
              L&apos;assistant répond à partir d&apos;un guide. Choisissez
              celui qui correspond à votre question.
            </Aide>

            {proposes.map((g) => (
              <Pressable
                key={g.itineraire_id}
                accessibilityRole="button"
                accessibilityLabel={`Poser une question sur ${titreCourt(g)}`}
                onPress={() => choisir(g)}
                style={({ pressed }) => [styles.carteGuide, pressed && { opacity: 0.8 }]}
              >
                <IllustrationEspece
                  code={g.speculation_code}
                  emoji={g.icone}
                  taille={TAILLE_LISTE}
                />
                <Text style={styles.carteTexte}>{titreCourt(g)}</Text>
              </Pressable>
            ))}

            {listeComplete ? null : (
              <Bouton
                titre="Autre sujet"
                variante="contour"
                onPress={() => setToutVoir(true)}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Le nom de la spéculation suffit à s'y retrouver, sauf quand elle porte
 * plusieurs conduites : « Bovin d'embouche » seul ne dirait pas laquelle des
 * deux, et c'est justement là que le choix compte.
 */
function titreCourt(guide: GuideChoisissable): string {
  const mode = libelleModeConduite(guide.mode_conduite);
  return mode ? `${guide.speculation_nom} — ${mode}` : guide.speculation_nom;
}

const styles = StyleSheet.create({
  pile: { flex: 1 },

  flottant: {
    position: "absolute",
    // Mêmes constantes que la réserve calculée dans reserve-basse.tsx :
    // agrandir le bouton déplace l'une et l'autre du même geste.
    right: MARGE_BOUTON_FLOTTANT,
    width: TAILLE_BOUTON_FLOTTANT,
    height: TAILLE_BOUTON_FLOTTANT,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.vertFonce,
    alignItems: "center",
    justifyContent: "center",
    // Le bouton se détache d'un fond papier clair : sans ombre ni liseré il
    // flotterait sans qu'on voie qu'il est au-dessus du contenu.
    borderWidth: 2,
    borderColor: couleurs.blanc,
    elevation: 6,
    shadowColor: couleurs.encre,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  flottantPresse: { opacity: 0.85 },

  feuille: { flex: 1, backgroundColor: couleurs.papier },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: espaces.lg,
    paddingVertical: espaces.sm,
    borderBottomWidth: 2,
    borderBottomColor: couleurs.ligne,
    backgroundColor: couleurs.blanc,
  },
  enteteTitre: {
    flex: 1,
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  fermer: {
    minHeight: CIBLE_TACTILE,
    justifyContent: "center",
    paddingHorizontal: espaces.sm,
  },
  fermerTexte: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },
  feuilleContenu: { padding: espaces.lg, gap: espaces.md },

  bloc: { gap: espaces.md },
  consigne: {
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
  },

  carteGuide: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    minHeight: CIBLE_TACTILE + 12,
    padding: espaces.md,
    borderRadius: rayons.md,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    backgroundColor: couleurs.blanc,
  },
  carteTexte: { flex: 1, fontSize: textes.corps, color: couleurs.encre },

  choixFait: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.vert,
  },
  choixTextes: { flex: 1, gap: espaces.xs },
  choixLibelle: { fontSize: textes.petit, color: couleurs.attenue },
  choixTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
});
