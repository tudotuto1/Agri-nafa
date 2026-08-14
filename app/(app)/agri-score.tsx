// =============================================================================
// Agri-Score.
//
// Un score de solvabilité lisible par un partenaire financier, construit sur
// ce que le producteur a réellement enregistré — pas sur une garantie foncière
// qu'il n'a pas.
//
// -----------------------------------------------------------------------------
// RIEN N'EST CALCULÉ ICI
//
// Le barème vit dans public.vue_agri_score, auditable par un prêteur. Cet
// écran lit des points déjà calculés et les met en forme. Le dupliquer en
// TypeScript créerait deux vérités : le jour où le barème évolue en base,
// l'application afficherait l'ancien, et personne ne saurait lequel fait foi.
//
// Les seuls nombres écrits ici sont les plafonds de chaque composante, qui
// servent à dessiner une barre. Ce sont des bornes d'affichage, pas un calcul.
// -----------------------------------------------------------------------------
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import {
  Aide,
  BarreProgression,
  Bouton,
  Ecran,
  Erreur,
  SousTitre,
  Squelette,
  Titre,
} from "@/components/ui";
import { couleurs, espaces, rayons, textes } from "@/constants/theme";
import { formaterFcfa } from "@/lib/format";
import { supabase } from "@/lib/supabase";

type AgriScore = {
  anciennete_mois: number;
  cycles_clotures: number;
  cycles_rentables: number;
  jours_saisie_90j: number;
  ventes_12m: number;
  benefice_cumule: number;
  points_historique: number;
  points_regularite: number;
  points_performance: number;
  points_commercial: number;
  agri_score: number;
};

// Plafonds déclarés par la vue. Ils bornent les barres, ils ne recalculent rien.
const PLAFONDS = {
  historique: 25,
  regularite: 30,
  performance: 30,
  commercial: 15,
} as const;

// Ces couleurs servent de couleur de TEXTE — chiffre du score, mention,
// points par composante. D'où le vert assombri.
function couleurDuScore(score: number): string {
  if (score < 40) return couleurs.rouge;
  if (score < 70) return couleurs.or;
  return couleurs.vertFonce;
}

function mentionDuScore(score: number): string {
  if (score < 40) return "En construction";
  if (score < 70) return "En progression";
  return "Solide";
}

// =============================================================================
export default function EcranAgriScore() {
  const router = useRouter();

  const [donnees, setDonnees] = useState<AgriScore | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    // La RLS filtre déjà sur l'utilisateur : la vue est en security_invoker.
    const { data, error } = await supabase.from("vue_agri_score").select("*").single();

    if (error) {
      setErreur("Impossible de charger votre Agri-Score.");
      return;
    }
    setDonnees(data as AgriScore);
  }, []);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  if (chargement) {
    return (
      <Ecran>
        <Titre>Mon Agri-Score</Titre>
        <View style={styles.centre}>
          <Squelette hauteur={200} largeur="70%" />
        </View>
        <Squelette hauteur={70} />
        <Squelette hauteur={70} />
        <Squelette hauteur={70} />
      </Ecran>
    );
  }

  if (!donnees) {
    return (
      <Ecran>
        <Titre>Mon Agri-Score</Titre>
        <Erreur message={erreur ?? "Agri-Score indisponible."} />
        <Bouton titre="Réessayer" onPress={charger} />
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </Ecran>
    );
  }

  const score = donnees.agri_score;
  const couleur = couleurDuScore(score);

  // Un compte neuf a mécaniquement peu de points : il n'a pas encore eu le
  // temps d'en gagner. Le dire évite qu'un producteur lise « 12 sur 100 »
  // comme un jugement sur son exploitation.
  const compteNeuf =
    donnees.cycles_clotures === 0 &&
    donnees.ventes_12m === 0 &&
    donnees.anciennete_mois <= 2;

  return (
    <Ecran>
      <Titre>Mon Agri-Score</Titre>

      {/* 1. Le score ------------------------------------------------------- */}
      <View style={styles.centre}>
        <Anneau score={score} couleur={couleur} />
        <Text style={[styles.mention, { color: couleur }]}>{mentionDuScore(score)}</Text>
      </View>

      {compteNeuf ? (
        <View style={styles.debutant}>
          <Text style={styles.debutantEmoji}>🌱</Text>
          <View style={styles.debutantTextes}>
            <SousTitre>Votre compte vient d'ouvrir</SousTitre>
            <Aide>
              Ce score est bas parce qu'il n'a encore rien à mesurer, pas parce
              que votre exploitation irait mal. Il monte à mesure que vous notez
              vos dépenses, vos récoltes et vos ventes.
            </Aide>
          </View>
        </View>
      ) : null}

      {/* 2 et 3. Les composantes et comment les faire monter ---------------- */}
      <SousTitre>Ce qui compose votre score</SousTitre>

      <Composante
        emoji="📆"
        titre="Historique"
        points={donnees.points_historique}
        plafond={PLAFONDS.historique}
        conseil={
          donnees.cycles_clotures === 0
            ? `Votre compte a ${donnees.anciennete_mois} mois et aucun cycle n'est encore clôturé. Menez un cycle jusqu'à sa fin pour gagner des points.`
            : `Votre compte a ${donnees.anciennete_mois} mois et vous avez clôturé ${donnees.cycles_clotures} cycle${donnees.cycles_clotures > 1 ? "s" : ""}. Chaque cycle mené à terme en ajoute.`
        }
      />

      <Composante
        emoji="✍️"
        titre="Régularité"
        points={donnees.points_regularite}
        plafond={PLAFONDS.regularite}
        conseil={`Vous avez saisi ${donnees.jours_saisie_90j} jour${
          donnees.jours_saisie_90j > 1 ? "s" : ""
        } sur les 90 derniers. Notez vos dépenses chaque semaine pour gagner des points.`}
      />

      <Composante
        emoji="📈"
        titre="Performance"
        points={donnees.points_performance}
        plafond={PLAFONDS.performance}
        conseil={
          donnees.cycles_clotures === 0
            ? "Cette part se calcule sur la proportion de vos cycles clôturés qui dégagent un bénéfice. Aucun cycle n'est encore terminé."
            : `${donnees.cycles_rentables} cycle${donnees.cycles_rentables > 1 ? "s" : ""} rentable${donnees.cycles_rentables > 1 ? "s" : ""} sur ${donnees.cycles_clotures} clôturé${donnees.cycles_clotures > 1 ? "s" : ""}. Vendre au-dessus de votre prix de revient fait monter cette part.`
        }
      />

      <Composante
        emoji="🤝"
        titre="Commercial"
        points={donnees.points_commercial}
        plafond={PLAFONDS.commercial}
        conseil={
          donnees.ventes_12m === 0
            ? "Aucune vente enregistrée sur les 12 derniers mois. Chaque vente notée compte, même petite."
            : `${donnees.ventes_12m} vente${donnees.ventes_12m > 1 ? "s" : ""} enregistrée${donnees.ventes_12m > 1 ? "s" : ""} sur 12 mois. Continuez à les noter au fur et à mesure.`
        }
      />

      {donnees.benefice_cumule !== 0 ? (
        <View style={styles.cumul}>
          <Text style={styles.cumulLibelle}>Bénéfice cumulé enregistré</Text>
          <Text
            style={[
              styles.cumulValeur,
              { color: donnees.benefice_cumule >= 0 ? couleurs.vertFonce : couleurs.rouge },
            ]}
          >
            {formaterFcfa(donnees.benefice_cumule)}
          </Text>
        </View>
      ) : null}

      {/* Mention légale — visible, jamais repliable ------------------------ */}
      <View style={styles.mentionLegale}>
        <Text style={styles.mentionLegaleTitre}>Ce que ce score n'est pas</Text>
        <Text style={styles.mentionLegaleTexte}>
          L'Agri-Score est un indicateur, calculé à partir des données que vous
          enregistrez vous-même. Il peut aider un partenaire financier à mieux
          vous connaître et à instruire une demande.
        </Text>
        <Text style={styles.mentionLegaleTexte}>
          Il ne constitue en aucun cas un accord de crédit, une promesse de
          financement, ni un engagement d'AgriNafa ou d'un établissement
          financier. Toute décision de prêt appartient au prêteur seul, selon
          ses propres critères.
        </Text>
      </View>

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
// Anneau de progression. Un arc exact, tracé au trait : la longueur visible du
// cercle est proportionnelle au score.
// -----------------------------------------------------------------------------
function Anneau({
  score,
  couleur,
  taille = 220,
  epaisseur = 20,
}: {
  score: number;
  couleur: string;
  taille?: number;
  epaisseur?: number;
}) {
  const centre = taille / 2;
  const rayon = (taille - epaisseur) / 2;
  const circonference = 2 * Math.PI * rayon;
  const part = Math.min(Math.max(score / 100, 0), 1);

  return (
    <View
      style={{ width: taille, height: taille }}
      accessibilityRole="progressbar"
      accessibilityLabel={`Agri-Score : ${score} sur 100`}
      accessibilityValue={{ min: 0, max: 100, now: score }}
    >
      <Svg width={taille} height={taille}>
        {/* piste */}
        <Circle
          cx={centre}
          cy={centre}
          r={rayon}
          stroke={couleurs.ligne}
          strokeWidth={epaisseur}
          fill="none"
        />
        {/* arc du score, démarré à midi */}
        <Circle
          cx={centre}
          cy={centre}
          r={rayon}
          stroke={couleur}
          strokeWidth={epaisseur}
          fill="none"
          strokeDasharray={circonference}
          strokeDashoffset={circonference * (1 - part)}
          strokeLinecap="round"
          rotation={-90}
          originX={centre}
          originY={centre}
        />
      </Svg>

      <View style={styles.anneauCentre} pointerEvents="none">
        <Text style={[styles.scoreChiffre, { color: couleur }]}>{score}</Text>
        <Text style={styles.scoreSur}>sur 100</Text>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
function Composante({
  emoji,
  titre,
  points,
  plafond,
  conseil,
}: {
  emoji: string;
  titre: string;
  points: number;
  plafond: number;
  conseil: string;
}) {
  const part = plafond > 0 ? points / plafond : 0;
  const couleur = part >= 0.7 ? couleurs.vertFonce : part >= 0.4 ? couleurs.or : couleurs.rouge;

  return (
    <View style={styles.composante}>
      <View style={styles.composanteEntete}>
        <Text style={styles.composanteEmoji}>{emoji}</Text>
        <Text style={styles.composanteTitre}>{titre}</Text>
        <Text style={styles.composantePoints}>
          <Text style={{ color: couleur }}>{points}</Text>
          <Text style={styles.composantePlafond}> / {plafond}</Text>
        </Text>
      </View>

      <BarreProgression avancement={part} couleur={couleur} />

      <Text style={styles.composanteConseil}>{conseil}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  centre: {
    alignItems: "center",
    gap: espaces.sm,
    paddingVertical: espaces.md,
  },
  anneauCentre: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreChiffre: {
    fontSize: 68,
    fontWeight: "700",
    lineHeight: 76,
  },
  scoreSur: {
    fontSize: textes.corps,
    color: couleurs.attenue,
  },
  mention: {
    fontSize: textes.sousTitre,
    fontWeight: "700",
  },

  debutant: {
    flexDirection: "row",
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: "#EAF6EE",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.vert,
  },
  debutantEmoji: { fontSize: textes.titre },
  debutantTextes: { flex: 1, gap: espaces.xs },

  composante: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  composanteEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  composanteEmoji: { fontSize: textes.corps },
  composanteTitre: {
    flex: 1,
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  composantePoints: {
    fontSize: textes.sousTitre,
    fontWeight: "700",
  },
  composantePlafond: {
    fontSize: textes.corps,
    color: couleurs.attenue,
  },
  composanteConseil: {
    fontSize: textes.petit,
    lineHeight: 21,
    color: couleurs.attenue,
  },

  cumul: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  cumulLibelle: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  cumulValeur: {
    fontSize: textes.corps,
    fontWeight: "700",
  },

  mentionLegale: {
    gap: espaces.sm,
    marginTop: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: "#FFF8E1",
    borderWidth: 2,
    borderColor: couleurs.or,
  },
  mentionLegaleTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  mentionLegaleTexte: {
    fontSize: textes.petit,
    lineHeight: 21,
    color: couleurs.encre,
  },

  pied: { marginTop: espaces.md },
});
