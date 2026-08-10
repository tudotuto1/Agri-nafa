// =============================================================================
// Guides techniques : types et calculs d'adaptation à la surface.
//
// -----------------------------------------------------------------------------
// POURQUOI CE CALCUL EXISTE AUSSI CÔTÉ APPLICATION
//
// La base porte public.dose_pour_surface() et reste la référence. Mais le
// sélecteur de surface recalcule à chaque appui : un aller-retour réseau par
// intrant et par changement de surface serait inutilisable sur une 2G rurale,
// et impossible hors connexion — précisément là où le producteur consulte son
// guide, au champ.
//
// Les deux implémentations doivent donc rester d'accord. Celle-ci reproduit la
// formule SQL au caractère près : arrondi à 2 décimales pour la quantité,
// arrondi au SUPÉRIEUR pour les conditionnements. Elle est vérifiée contre les
// valeurs renvoyées par la fonction SQL.
//
// Ce qui n'est jamais dupliqué, c'est la DONNÉE : quantite_par_ha vit en base
// et nulle part ailleurs. Le jour où une dose est corrigée, aucune version de
// l'application ne garde l'ancienne.
// -----------------------------------------------------------------------------
// =============================================================================

import { ESPACE_INSECABLE, grouperChiffres } from "@/lib/format";

/**
 * Les colonnes `numeric` de PostgreSQL peuvent arriver en nombre ou en chaîne
 * selon le sérialiseur. Sur des doses d'engrais, une chaîne silencieusement
 * traitée comme NaN donnerait une quantité vide à l'écran : on coerce.
 */
export function nombre(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined) return null;
  // Number("") vaut 0 : une chaîne vide deviendrait une dose de zéro, ce qui
  // se lirait « ne rien épandre » au lieu de « valeur inconnue ».
  if (typeof valeur === "string" && valeur.trim() === "") return null;
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(n) ? n : null;
}

// -----------------------------------------------------------------------------
export type Intrant = {
  id: string;
  nom: string;
  categorie: string;
  quantite_par_ha: number | string;
  unite: string;
  conditionnement: string | null;
  taille_conditionnement: number | string | null;
  prix_indicatif_unite: number | string | null;
  substitut_local: string | null;
  consigne: string | null;
};

export type EtapeGuide = {
  etape_id: string;
  itineraire_id: string;
  ordre: number;
  titre: string;
  description: string | null;
  phase: Phase | null;
  jour_debut: number | null;
  jour_fin: number | null;
  points_de_controle: string[] | null;
  erreurs_frequentes: string[] | null;
  astuce: string | null;
  materiel: string[] | null;
  heures_travail_ha: number | string | null;
  facultative: boolean;
  intrants: Intrant[];
};

export type Guide = {
  itineraire_id: string;
  titre: string;
  resume: string | null;
  description: string | null;
  saison: string | null;
  objectif: string | null;
  difficulte: string | null;
  duree_totale_jours: number | null;
  rendement_min_ha: number | string | null;
  rendement_max_ha: number | string | null;
  unite_rendement: string | null;
  cout_indicatif_ha: number | string | null;
  surface_min_ha: number | string | null;
  mois_semis_conseilles: number[] | null;
  sources: string[] | null;
  speculation_id: string;
  speculation_code: string;
  speculation_nom: string;
  icone: string | null;
  unite_defaut: string;
  nb_etapes: number;
};

export type MoisSaisonnalite = {
  mois: number;
  tendance: "abondance" | "normal" | "penurie";
  commentaire: string | null;
  prix_moyen: number | string | null;
};

export type TypeConseil =
  | "calendrier"
  | "negociation"
  | "conditionnement"
  | "transport"
  | "evenement"
  | "prevente";

export type Conseil = {
  id: string;
  titre: string;
  contenu: string;
  type_conseil: TypeConseil;
  mois_concernes: number[] | null;
  ordre: number;
};

export type Phase =
  | "preparation"
  | "installation"
  | "entretien"
  | "protection"
  | "recolte"
  | "commercialisation";

// -----------------------------------------------------------------------------
// Adaptation à la surface — miroir exact de public.dose_pour_surface()
// -----------------------------------------------------------------------------

/** Quantité pour la surface réelle, arrondie à 2 décimales comme en base. */
export function doseSurface(
  quantiteParHa: number | string | null | undefined,
  surfaceHa: number,
): number | null {
  const parHa = nombre(quantiteParHa);
  if (parHa === null || !Number.isFinite(surfaceHa) || surfaceHa <= 0) return null;
  return Math.round(parHa * surfaceHa * 100) / 100;
}

/**
 * Nombre d'unités à acheter, arrondi au SUPÉRIEUR : on n'achète pas 1,3 sac
 * d'engrais. Mieux vaut un reste en magasin qu'une dernière planche sous-dosée.
 */
export function conditionnementsNecessaires(
  quantite: number | null,
  tailleConditionnement: number | string | null | undefined,
): number | null {
  const taille = nombre(tailleConditionnement);
  if (quantite === null || taille === null || taille <= 0) return null;
  return Math.ceil(quantite / taille);
}

/** Coût d'un intrant pour la surface : prix du conditionnement × nombre d'unités. */
export function coutIntrant(intrant: Intrant, surfaceHa: number): number | null {
  const prix = nombre(intrant.prix_indicatif_unite);
  if (prix === null) return null;
  const quantite = doseSurface(intrant.quantite_par_ha, surfaceHa);
  const unites = conditionnementsNecessaires(quantite, intrant.taille_conditionnement);
  if (unites === null) return null;
  return prix * unites;
}

/**
 * Coût d'une étape. null si aucun intrant n'est chiffré — un total de 0 F
 * se lirait comme « gratuit » alors qu'il signifie « prix inconnus ».
 */
export function coutEtape(intrants: Intrant[], surfaceHa: number): number | null {
  const chiffres = intrants
    .map((i) => coutIntrant(i, surfaceHa))
    .filter((c): c is number => c !== null);
  return chiffres.length > 0 ? chiffres.reduce((s, c) => s + c, 0) : null;
}

/** Heures de travail ramenées à la surface. */
export function heuresPourSurface(
  heuresParHa: number | string | null | undefined,
  surfaceHa: number,
): number | null {
  const h = nombre(heuresParHa);
  if (h === null) return null;
  return Math.round(h * surfaceHa * 10) / 10;
}

// -----------------------------------------------------------------------------
// Libellés
// -----------------------------------------------------------------------------
export const SURFACES = [0.25, 0.5, 1, 2, 5] as const;

/** Ramène une surface libre à la valeur proposée la plus proche. */
export function surfaceLaPlusProche(surface: number | null | undefined): number {
  const s = nombre(surface);
  if (s === null || s <= 0) return 0.5;
  return SURFACES.reduce((meilleure, candidate) =>
    Math.abs(candidate - s) < Math.abs(meilleure - s) ? candidate : meilleure,
  );
}

export function formaterSurface(surface: number): string {
  return `${surface.toString().replace(".", ",")} ha`;
}

/**
 * Quantité lisible : groupement par milliers et virgule décimale française.
 * Le groupement réutilise celui des montants — une seule règle typographique
 * dans l'application, et elle est déjà éprouvée.
 */
export function formaterQuantite(quantite: number | null, unite: string): string {
  if (quantite === null) return "—";
  const arrondi = Math.round(quantite * 100) / 100;
  const signe = arrondi < 0 ? "−" : "";
  const [entier, decimales] = Math.abs(arrondi).toString().split(".");
  const groupe = grouperChiffres(entier);
  const texte = decimales ? `${groupe},${decimales}` : groupe;
  return `${signe}${texte}${ESPACE_INSECABLE}${unite}`;
}

export const LIBELLES_PHASE: Record<Phase, string> = {
  preparation: "Préparation",
  installation: "Installation",
  entretien: "Entretien",
  protection: "Protection",
  recolte: "Récolte",
  commercialisation: "Commercialisation",
};

export const LIBELLES_DIFFICULTE: Record<string, string> = {
  debutant: "Accessible aux débutants",
  intermediaire: "Demande de l'expérience",
  experimente: "Pour producteurs expérimentés",
};

export const LIBELLES_CONSEIL: Record<TypeConseil, { libelle: string; emoji: string }> = {
  calendrier: { libelle: "Quand produire", emoji: "📅" },
  negociation: { libelle: "Négocier", emoji: "🤝" },
  conditionnement: { libelle: "Préparer le lot", emoji: "📦" },
  transport: { libelle: "Transporter", emoji: "🚚" },
  evenement: { libelle: "Pics de demande", emoji: "🎉" },
  prevente: { libelle: "Vendre à l'avance", emoji: "📋" },
};

export const MOIS_COURTS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

export const MOIS_LONGS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
