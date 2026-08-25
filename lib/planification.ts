// =============================================================================
// Planification inversée.
//
// Le producteur part de QUAND IL VEUT VENDRE, pas de quand il veut commencer.
// C'est l'inverse du raisonnement habituel, et c'est ce qui fait la valeur de
// l'écran : viser la Tabaski se décide en février, pas en mai.
//
// -----------------------------------------------------------------------------
// LA DATE DE MISE EN PLACE N'EST PAS CALCULÉE ICI
//
// Elle vient de public.date_mise_en_place(), en base. Ce module ne fait que
// ce que la base ne fait pas : proposer des dates d'événement, mesurer les
// délais, et chercher un repli quand il est trop tard. Dupliquer la soustraction
// côté client ferait deux vérités pour un même chiffre.
//
// -----------------------------------------------------------------------------
// POURQUOI AUCUNE DATE DE FÊTE MUSULMANE N'EST ÉCRITE ICI
//
// Tabaski et Ramadan suivent le calendrier lunaire : ils reculent d'environ
// onze jours par an dans le calendrier grégorien, et leur date est arrêtée
// localement à l'observation du croissant. Une table codée en dur serait juste
// une année, fausse la suivante, et personne ne s'en apercevrait avant qu'un
// éleveur ait manqué son marché.
//
// Ces événements ne portent donc qu'un LIBELLÉ : la date est demandée au
// producteur, qui la connaît mieux que l'application. Les fêtes à date civile
// fixe — Noël, rentrée scolaire — sont proposées, et restent modifiables.
// =============================================================================

import { aujourdhuiIso, decalerJours } from "@/lib/format";

export type Evenement = {
  code: string;
  libelle: string;
  emoji: string;
  /**
   * Date civile fixe [mois, jour], quand elle existe. `null` pour les fêtes
   * lunaires, dont la date est demandée au producteur.
   */
  dateFixe: [number, number] | null;
  /** Une ligne d'explication affichée sous les pilules quand il est choisi. */
  note: string;
};

export const EVENEMENTS: Evenement[] = [
  {
    code: "tabaski",
    libelle: "Tabaski",
    emoji: "🐏",
    dateFixe: null,
    note: "La Tabaski recule d'environ onze jours chaque année et sa date est annoncée localement. Indiquez-la vous-même.",
  },
  {
    code: "ramadan",
    libelle: "Ramadan",
    emoji: "🌙",
    dateFixe: null,
    note: "Le Ramadan suit le calendrier lunaire : sa date change tous les ans. Indiquez celle de l'année visée.",
  },
  {
    code: "fetes_fin_annee",
    libelle: "Fêtes de fin d'année",
    emoji: "🎄",
    dateFixe: [12, 25],
    note: "Date proposée : le 25 décembre. Modifiez-la si vous visez plutôt le Nouvel An.",
  },
  {
    code: "rentree_scolaire",
    libelle: "Rentrée scolaire",
    emoji: "🎒",
    dateFixe: [10, 1],
    note: "Date proposée : début octobre, la rentrée habituelle au Burkina Faso. Ajustez selon l'année.",
  },
];

/** Marges proposées, en jours. La valeur par défaut est la deuxième. */
export const MARGES = [0, 7, 14, 21];
export const MARGE_DEFAUT = 7;

/**
 * Prochaine occurrence d'une date civile fixe, à partir d'aujourd'hui.
 * Le 25 décembre demandé le 26 décembre renvoie l'année suivante — sinon
 * l'écran proposerait une cible déjà passée.
 */
export function prochaineOccurrence(
  mois: number,
  jour: number,
  aujourdhui: string = aujourdhuiIso(),
): string {
  const annee = Number(aujourdhui.slice(0, 4));
  const candidat = `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  return candidat >= aujourdhui
    ? candidat
    : `${annee + 1}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

const JOUR_MS = 86_400_000;

/**
 * Nombre de jours entre deux dates ISO. Négatif si `iso` est déjà passée.
 * Les deux bornes sont lues à minuit UTC : aucune heure locale ne vient
 * décaler le compte d'un jour.
 */
export function joursEntre(iso: string, depuis: string = aujourdhuiIso()): number | null {
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${depuis}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / JOUR_MS);
}

export type SpeculationPlanifiable = {
  id: string;
  code: string;
  nom: string;
  icone: string | null;
  duree_cycle_jours: number | null;
};

/**
 * Spéculations qui tiennent encore dans le délai, de la plus longue à la plus
 * courte — la plus longue d'abord parce que c'est celle qui ressemble le plus
 * à ce que le producteur voulait faire.
 *
 * `exclure` retire celle qu'il vient d'essayer : la reproposer serait absurde.
 */
export function speculationsQuiTiennent(
  speculations: SpeculationPlanifiable[],
  dateCible: string,
  marge: number,
  exclure?: string,
  aujourdhui: string = aujourdhuiIso(),
): SpeculationPlanifiable[] {
  const delai = joursEntre(dateCible, aujourdhui);
  if (delai === null) return [];

  return speculations
    .filter((s) => {
      if (s.id === exclure) return false;
      if (s.duree_cycle_jours === null) return false;
      return s.duree_cycle_jours + marge <= delai;
    })
    .sort((a, b) => (b.duree_cycle_jours ?? 0) - (a.duree_cycle_jours ?? 0));
}

/**
 * Première date de vente encore atteignable si l'on démarre aujourd'hui.
 * C'est le repli le plus concret quand la cible est manquée : plutôt que
 * « trop tard », l'écran peut dire à partir de quand ce sera possible.
 */
export function premiereDatePossible(
  dureeCycleJours: number,
  marge: number,
  aujourdhui: string = aujourdhuiIso(),
): string {
  return decalerJours(aujourdhui, dureeCycleJours + marge);
}

/** « dans 34 jours », « demain », « aujourd'hui », « il y a 3 jours ». */
export function delaiEnFrancais(jours: number): string {
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "demain";
  if (jours === -1) return "hier";
  return jours > 0 ? `dans ${jours} jours` : `il y a ${Math.abs(jours)} jours`;
}
