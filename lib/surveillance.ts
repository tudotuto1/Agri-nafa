// =============================================================================
// Alertes et caméras : présentation et petits calculs.
//
// Regroupés hors des écrans parce que ce sont des règles, pas de la mise en
// page : le seuil de batterie faible, la conversion du score de risque, la
// liste des destinations vers lesquelles une alerte a le droit de mener.
// =============================================================================

import type { Href } from "expo-router";

import { couleurs } from "@/constants/theme";
import { ESPACE_INSECABLE } from "@/lib/format";

// -----------------------------------------------------------------------------
// Alertes
// -----------------------------------------------------------------------------

export type Gravite = "info" | "attention" | "urgent";

export type CategorieAlerte =
  | "ia_vision"
  | "prophylaxie"
  | "stock_bas"
  | "prix_marche"
  | "meteo"
  | "cycle"
  | "systeme";

export type Alerte = {
  id: string;
  categorie: string;
  gravite: string;
  titre: string;
  message: string;
  cycle_id: string | null;
  camera_id: string | null;
  capture_id: string | null;
  action_cible: string | null;
  lue_at: string | null;
  created_at: string;
};

export const CATEGORIES: Record<CategorieAlerte, { libelle: string; emoji: string }> = {
  ia_vision: { libelle: "Surveillance par caméra", emoji: "📷" },
  prophylaxie: { libelle: "Calendrier sanitaire", emoji: "💉" },
  stock_bas: { libelle: "Stock bas", emoji: "📦" },
  prix_marche: { libelle: "Prix du marché", emoji: "💰" },
  meteo: { libelle: "Météo", emoji: "🌦️" },
  cycle: { libelle: "Cycle de production", emoji: "🌱" },
  systeme: { libelle: "Application", emoji: "⚙️" },
};

export function categorie(valeur: string): { libelle: string; emoji: string } {
  return CATEGORIES[valeur as CategorieAlerte] ?? { libelle: valeur, emoji: "🔔" };
}

/**
 * Couleur de bordure par gravité.
 *
 * L'or de `attention` est celui du drapeau : très lisible en plein soleil, et
 * il ne se confond pas avec le vert des états normaux.
 */
export function couleurGravite(gravite: string): string {
  if (gravite === "urgent") return couleurs.rouge;
  if (gravite === "attention") return couleurs.or;
  return couleurs.ligne;
}

export const LIBELLES_GRAVITE: Record<Gravite, string> = {
  urgent: "Urgent",
  attention: "À surveiller",
  info: "Information",
};

export function libelleGravite(gravite: string): string {
  return LIBELLES_GRAVITE[gravite as Gravite] ?? "Information";
}

/**
 * Où mène une alerte, quand elle mène quelque part.
 *
 * `action_cible` est une colonne texte libre, écrite en base par un trigger.
 * Celui de `tg_alerte_sur_capture_risquee` y pose `/carte` — une route qui
 * n'existe pas dans cette application. La suivre aveuglément afficherait
 * l'écran « page introuvable » d'Expo Router à un producteur qui vient de
 * toucher une alerte de maladie.
 *
 * On ne passe donc au routeur que des destinations connues. Ce qui n'est pas
 * reconnu se replie sur ce que l'alerte désigne réellement : sa caméra. Et à
 * défaut, on ne navigue pas — l'alerte est marquée lue, ce qui est déjà le
 * geste que le producteur a demandé.
 *
 * Une chaîne venue de la base n'entre jamais telle quelle dans `router.push`.
 */
const ROUTES_AUTORISEES: Record<string, Href> = {
  "/alertes": "/(app)/alertes",
  "/cameras": "/(app)/cameras",
  "/parcelles": "/(app)/parcelles",
  "/guides": "/(app)/guides",
  "/prevente": "/(app)/prevente",
  "/grossistes": "/(app)/grossistes",
  "/agri-score": "/(app)/agri-score",
  "/depense": "/(app)/depense",
  "/vente": "/(app)/vente",
  "/recolte": "/(app)/recolte",
};

export function destination(alerte: Alerte): Href | null {
  const cible = (alerte.action_cible ?? "").trim().toLowerCase();

  // Une cible explicite et reconnue l'emporte : c'est ce que l'auteur de
  // l'alerte a demandé.
  const connue = ROUTES_AUTORISEES[cible];
  if (connue) return connue;

  // Sinon, le sujet de l'alerte. Le trigger de vision pose « /carte », qui ne
  // correspond à aucun écran ; volontairement absent de la liste ci-dessus,
  // plutôt que redirigé au jugé vers un écran qui n'a pas déclenché l'alerte.
  // Ces alertes-là portent toutes un camera_id, et le cliché en cause est
  // justement sur la fiche de la caméra.
  if (alerte.camera_id) {
    return { pathname: "/(app)/camera/[id]", params: { id: alerte.camera_id } };
  }

  return null;
}

// -----------------------------------------------------------------------------
// Caméras
// -----------------------------------------------------------------------------

export type StatutCamera = "active" | "hors_ligne" | "maintenance" | "retiree";

export type Camera = {
  id: string;
  nom: string;
  parcelle_id: string | null;
  identifiant_materiel: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  intervalle_minutes: number;
  niveau_batterie: number | null;
  derniere_capture_at: string | null;
  statut: string;
};

export const STATUTS: { valeur: StatutCamera; libelle: string }[] = [
  { valeur: "active", libelle: "Active" },
  { valeur: "hors_ligne", libelle: "Hors ligne" },
  { valeur: "maintenance", libelle: "En maintenance" },
  { valeur: "retiree", libelle: "Retirée" },
];

export function libelleStatut(statut: string): string {
  return STATUTS.find((s) => s.valeur === statut)?.libelle ?? statut;
}

export function couleurStatut(statut: string): string {
  if (statut === "active") return couleurs.vert;
  if (statut === "hors_ligne") return couleurs.rouge;
  if (statut === "maintenance") return couleurs.or;
  return couleurs.attenue;
}

/** Intervalles proposés, en minutes. La 4G rurale ne suit pas plus vite. */
export const INTERVALLES = [5, 10, 15, 30, 60] as const;
export const INTERVALLE_DEFAUT = 10;

/**
 * En dessous, la batterie passe au rouge.
 *
 * Une caméra solaire qui tombe sous ce seuil ne tiendra pas la nuit : c'est le
 * moment d'aller nettoyer le panneau, pas quand elle est déjà éteinte.
 */
export const BATTERIE_FAIBLE = 20;

export function batterieFaible(niveau: number | null | undefined): boolean {
  return typeof niveau === "number" && Number.isFinite(niveau) && niveau < BATTERIE_FAIBLE;
}

/**
 * Icône de batterie. `null` n'est pas zéro : une caméra qui n'a jamais parlé
 * n'a pas une batterie vide, elle a une batterie inconnue. Les afficher pareil
 * enverrait quelqu'un changer un panneau qui va très bien.
 */
export function iconeBatterie(niveau: number | null | undefined): string {
  if (typeof niveau !== "number" || !Number.isFinite(niveau)) return "❔";
  if (niveau < BATTERIE_FAIBLE) return "🪫";
  return "🔋";
}

export function texteBatterie(niveau: number | null | undefined): string {
  if (typeof niveau !== "number" || !Number.isFinite(niveau)) return "Batterie inconnue";
  // Espace insécable avant le pourcent : l'usage français, et surtout jamais un
  // « 18 » seul en fin de ligne avec le « % » renvoyé à la suivante.
  return `${Math.round(niveau)}${ESPACE_INSECABLE}%`;
}

// -----------------------------------------------------------------------------
// Captures
// -----------------------------------------------------------------------------

export type Capture = {
  id: string;
  storage_path: string;
  captured_at: string;
  analyse_statut: string;
  diagnostic: string | null;
  score_risque: number | string | null;
  fournisseur_ia: string | null;
  analysee_at: string | null;
};

/**
 * Score de risque en pourcentage.
 *
 * La colonne est un `numeric(4, 3)` contraint entre 0 et 1 : c'est une
 * fraction, pas un pourcentage. Afficher `0.85` tel quel donnerait « risque de
 * 0,85 % » là où la base dit 85 % — un danger majeur lu comme négligeable.
 *
 * Renvoie null si le score est absent : « 0 % » se lirait « aucun risque »
 * alors que la valeur signifie « pas encore analysé ».
 */
export function scorePourcent(score: number | string | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  if (typeof score === "string" && score.trim() === "") return null;
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Au-delà, le diagnostic est présenté comme urgent — le seuil du trigger. */
export const SEUIL_RISQUE_URGENT = 80;

export function couleurRisque(pourcent: number | null): string {
  if (pourcent === null) return couleurs.attenue;
  if (pourcent >= SEUIL_RISQUE_URGENT) return couleurs.rouge;
  if (pourcent >= 60) return couleurs.or;
  return couleurs.vert;
}

export const LIBELLES_ANALYSE: Record<string, string> = {
  en_attente: "Analyse à venir",
  analysee: "Analysée",
  ignoree: "Non analysée",
  echec: "Analyse impossible",
};

export function libelleAnalyse(statut: string): string {
  return LIBELLES_ANALYSE[statut] ?? "Analyse à venir";
}
