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
// Téléphone et WhatsApp
// -----------------------------------------------------------------------------

/** Le Burkina Faso, et rien d'autre : l'application ne s'adresse qu'à lui. */
export const INDICATIF_BF = "+226";
export const LONGUEUR_NUMERO_BF = 8;

/** 8 chiffres saisis → numéro international stocké en base : "+22670000000". */
export function numeroInternational(chiffres: string): string | null {
  const nettoye = chiffres.replace(/\D/g, "");
  if (nettoye.length !== LONGUEUR_NUMERO_BF) return null;
  return `${INDICATIF_BF}${nettoye}`;
}

/** "+226 70 00 00 00" → "22670000000" : WhatsApp veut des chiffres nus. */
export function chiffresWhatsapp(numero: string | null): string | null {
  if (!numero) return null;
  const nettoye = numero.replace(/\D/g, "");
  return nettoye.length >= 8 ? nettoye : null;
}

/**
 * Les deux URL d'ouverture d'une conversation, dans l'ordre d'essai.
 * L'application native d'abord ; wa.me ensuite, qui fonctionne même sans
 * WhatsApp installé — le producteur tombe alors sur la page d'installation
 * plutôt que sur une erreur muette.
 */
export function urlsWhatsapp(
  numero: string | null,
): { application: string; web: string } | null {
  const chiffres = chiffresWhatsapp(numero);
  if (!chiffres) return null;
  return {
    application: `whatsapp://send?phone=${chiffres}`,
    web: `https://wa.me/${chiffres}`,
  };
}

/** Affichage lisible d'un numéro burkinabè : "+226 70 00 00 00". */
export function formaterTelephone(numero: string | null): string {
  const chiffres = chiffresWhatsapp(numero);
  if (!chiffres) return "";
  const local = chiffres.startsWith("226") ? chiffres.slice(3) : chiffres;
  const paires = local.match(/\d{2}/g);
  return paires ? `${INDICATIF_BF} ${paires.join(" ")}` : `${INDICATIF_BF} ${local}`;
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

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const JOURS = [
  "dimanche", "lundi", "mardi", "mercredi",
  "jeudi", "vendredi", "samedi",
];

/**
 * AAAA-MM-JJ → « mardi 15 septembre ». Les noms sont en dur plutôt que via
 * Intl : les données de locale sont incomplètes sur beaucoup d'Android
 * d'entrée de gamme, et un « Tuesday September 15 » dans un message destiné
 * à un grossiste burkinabè passerait mal.
 */
export function dateEnFrancais(iso: string, avecJour = true): string {
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return "";
  const d = new Date(a, m - 1, j);
  const jour = avecJour ? `${JOURS[d.getDay()]} ` : "";
  return `${jour}${j} ${MOIS[m - 1]}`;
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

// -----------------------------------------------------------------------------
// Dates relatives
// -----------------------------------------------------------------------------

/**
 * Horodatage → « il y a 2 h ».
 *
 * Écrit à la main plutôt qu'avec Intl.RelativeTimeFormat : les données de
 * locale manquent sur beaucoup d'Android d'entrée de gamme, et le repli
 * silencieux vers l'anglais donnerait « 2 hours ago » au milieu d'un écran
 * français.
 *
 * L'unité monte dès que le compte atteint la suivante. On ne descend pas sous
 * la minute : « il y a 3 s » sur une alerte pousse à recharger pour voir si le
 * chiffre bouge, alors que « à l'instant » clôt la question.
 *
 * Une date future renvoie « à l'instant » plutôt qu'un compte négatif : l'heure
 * du téléphone peut avancer sur celle du serveur, et « il y a −4 min » se lit
 * comme un bug.
 */
export function dateRelative(
  horodatage: string | null | undefined,
  maintenant: Date = new Date(),
): string {
  if (!horodatage) return "";

  const instant = new Date(horodatage);
  const ms = instant.getTime();
  if (!Number.isFinite(ms)) return "";

  const secondes = Math.floor((maintenant.getTime() - ms) / 1000);
  if (secondes < 60) return "à l'instant";

  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `il y a ${minutes}${ESPACE_INSECABLE}min`;

  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures}${ESPACE_INSECABLE}h`;

  const jours = Math.floor(heures / 24);
  if (jours < 7) return `il y a ${jours}${ESPACE_INSECABLE}jour${jours > 1 ? "s" : ""}`;

  const semaines = Math.floor(jours / 7);
  if (jours < 30) {
    return `il y a ${semaines}${ESPACE_INSECABLE}semaine${semaines > 1 ? "s" : ""}`;
  }

  const mois = Math.floor(jours / 30);
  if (jours < 365) return `il y a ${mois}${ESPACE_INSECABLE}mois`;

  const annees = Math.floor(jours / 365);
  return `il y a ${annees}${ESPACE_INSECABLE}an${annees > 1 ? "s" : ""}`;
}

/** Horodatage ISO → « 15 septembre, 14:30 ». Pour l'horodatage exact d'un cliché. */
export function horodatageEnFrancais(horodatage: string | null | undefined): string {
  if (!horodatage) return "";
  const d = new Date(horodatage);
  if (!Number.isFinite(d.getTime())) return "";
  const heure = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${MOIS[d.getMonth()]}, ${heure}`;
}
