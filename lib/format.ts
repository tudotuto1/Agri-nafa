// =============================================================================
// Formatage des montants et des dates.
//
// Le franc CFA n'a pas de subdivision en usage courant : on travaille en
// francs entiers, groupés par tranches de trois. L'espace de séparation est
// insécable, pour que « 1 245 500 F » ne se brise jamais en fin de ligne —
// un montant coupé en deux se relit de travers.
// =============================================================================

export const ESPACE_INSECABLE = " ";

/** Groupe une suite de chiffres par tranches de trois : "1245500" → "1 245 500". */
export function grouperChiffres(chiffres: string): string {
  return chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_INSECABLE);
}

/** Montant en francs CFA, arrondi à l'unité : 1245500.5 → "1 245 501 F". */
export function formaterFcfa(montant: number | null | undefined): string {
  const arrondi = Math.round(montant ?? 0);
  const signe = arrondi < 0 ? "−" : "";
  return `${signe}${grouperChiffres(Math.abs(arrondi).toString())}${ESPACE_INSECABLE}F`;
}

// -----------------------------------------------------------------------------
// Dates
//
// La base attend AAAA-MM-JJ ; on saisit et on lit en JJ/MM/AAAA. La conversion
// se fait sur les composants de la date, jamais via Date.parse d'une chaîne
// locale : selon le fuseau, « 2026-08-08 » peut retomber au 7 août.
// -----------------------------------------------------------------------------

/** Date du jour au format AAAA-MM-JJ, dans le fuseau du téléphone. */
export function aujourdhuiIso(): string {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${maintenant.getFullYear()}-${mois}-${jour}`;
}

/** Décale une date ISO d'un nombre de jours : ("2026-08-08", -1) → "2026-08-07". */
export function decalerJours(iso: string, jours: number): string {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(a, m - 1, j + jours);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/** AAAA-MM-JJ → JJ/MM/AAAA. */
export function isoVersAffichage(iso: string): string {
  const [a, m, j] = iso.split("-");
  return a && m && j ? `${j}/${m}/${a}` : "";
}

/**
 * JJ/MM/AAAA → AAAA-MM-JJ, ou null si la date n'existe pas.
 * Le contrôle rejette le 31/02 : construire la date et vérifier qu'elle n'a
 * pas glissé au mois suivant est la seule façon fiable de le voir.
 */
export function affichageVersIso(affichage: string): string | null {
  const m = affichage.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;

  const jour = Number(m[1]);
  const mois = Number(m[2]);
  const annee = Number(m[3]);
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;

  const d = new Date(annee, mois - 1, jour);
  if (d.getFullYear() !== annee || d.getMonth() !== mois - 1 || d.getDate() !== jour) {
    return null;
  }
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}
