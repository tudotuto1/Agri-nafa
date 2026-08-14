// =============================================================================
// Les trois qualités de récolte, et ce qu'elles veulent dire.
//
// -----------------------------------------------------------------------------
// POURQUOI LE TEXTE EST VISIBLE ET NON REPLIÉ DERRIÈRE UNE ICÔNE
//
// « Premier choix » et « second choix » sont des mots de commerçant, pas de
// producteur. Un maraîcher qui ne sait pas où passe la limite coche au hasard,
// et la comptabilité qui en découle ne vaut plus rien — c'est justement elle
// qu'on veut pouvoir présenter à un prêteur.
//
// -----------------------------------------------------------------------------
// POURQUOI LE VOCABULAIRE DÉPEND DE LA FILIÈRE
//
// « Fruits ou grains bien formés » n'a aucun sens pour un aviculteur. Le
// référentiel porte `speculations.filiere`, qui distingue le végétal de
// l'élevage — mais pas les poissons des ruminants : tilapia, caprin et bovin
// sont tous les trois en `elevage`.
//
// C'est `unite_defaut` qui les sépare : les animaux comptés à la tête portent
// `tete` ou `sujet`, le tilapia porte `kg`. Ce n'est pas parfait — un bovin
// vendu au kilo tomberait dans le vocabulaire piscicole — mais c'est un signal
// du référentiel, pas un code d'espèce écrit en dur, et il se corrige en base
// le jour où le cas se présente.
//
// Les trois CODES ne changent jamais : ce sont ceux de la contrainte CHECK de
// productions_recoltes. Seuls les mots d'explication varient.
// =============================================================================

/** Valeurs acceptées par la contrainte CHECK. Ne jamais modifier. */
export type Qualite = "premier_choix" | "second_choix" | "ecart_de_tri";

export type DescriptionQualite = {
  code: Qualite;
  libelle: string;
  emoji: string;
  explication: string;
};

/** Registre de vocabulaire par famille de production. */
type Vocabulaire = { premier: string; second: string; ecart: string };

const VEGETAL: Vocabulaire = {
  premier:
    "Fruits ou grains bien formés, sains, de calibre régulier. C'est ce qui se vend au meilleur prix aux grossistes.",
  second:
    "Marchandise saine mais de calibre irrégulier, ou avec de petits défauts d'aspect. Se vend au détail ou à prix réduit.",
  ecart:
    "Trop petit, abîmé ou déformé pour la vente normale. À écouler en transformation, en consommation familiale ou en alimentation animale plutôt que de le jeter.",
};

const ANIMAL: Vocabulaire = {
  premier:
    "Sujets bien conformés, sains, de calibre régulier. C'est ce qui se vend au meilleur prix aux grossistes.",
  second:
    "Sujets sains mais de calibre irrégulier, ou avec de petits défauts d'aspect. Se vendent au détail ou à prix réduit.",
  // Pas d'« alimentation animale » ici : ce sont les animaux eux-mêmes.
  ecart:
    "Sujets trop petits, blessés ou mal conformés pour la vente normale. À écouler en consommation familiale ou auprès d'acheteurs moins exigeants plutôt que de les perdre.",
};

const POISSON: Vocabulaire = {
  premier:
    "Poissons ayant atteint la taille marchande, sains et de calibre régulier. C'est ce qui se vend au meilleur prix aux grossistes.",
  second:
    "Poissons sains mais de taille irrégulière, ou avec de petits défauts d'aspect. Se vendent au détail ou à prix réduit.",
  ecart:
    "Poissons en dessous de la taille marchande, ou abîmés. À écouler en consommation familiale ou en transformation — fumage, séchage — plutôt que de les perdre.",
};

/** Unités qui désignent un animal compté un par un. */
const UNITES_A_LA_TETE = ["tete", "sujet"];

/** Unités au poids : dans la filière élevage, c'est le signe d'une pisciculture. */
const UNITES_AU_POIDS = ["kg", "g", "t", "tonne"];

function vocabulaire(
  filiere: string | null | undefined,
  uniteDefaut: string | null | undefined,
): Vocabulaire {
  if (filiere === "avicole") return ANIMAL;

  if (filiere === "elevage") {
    // Le poisson demande un signal positif — l'unité au poids. Sans quoi on
    // reste sur l'animal : dans `elevage`, trois spéculations sur quatre sont
    // des bêtes comptées à la tête, et « poissons » sur un troupeau serait plus
    // déroutant que l'inverse.
    const unite = (uniteDefaut ?? "").trim().toLowerCase();
    if (UNITES_A_LA_TETE.includes(unite)) return ANIMAL;
    return UNITES_AU_POIDS.includes(unite) ? POISSON : ANIMAL;
  }

  // maraichage, cereale, autre, et tout ce qui n'est pas reconnu : le
  // vocabulaire végétal est le repli le moins surprenant.
  return VEGETAL;
}

/**
 * Les trois qualités, libellées et expliquées pour la filière du cycle.
 *
 * L'ordre est celui du meilleur au moins bon : c'est celui dans lequel un
 * producteur trie son tas.
 */
export function qualitesPour(
  filiere: string | null | undefined,
  uniteDefaut: string | null | undefined,
): DescriptionQualite[] {
  const mots = vocabulaire(filiere, uniteDefaut);
  return [
    {
      code: "premier_choix",
      libelle: "Premier choix",
      emoji: "⭐",
      explication: mots.premier,
    },
    {
      code: "second_choix",
      libelle: "Second choix",
      emoji: "👍",
      explication: mots.second,
    },
    {
      code: "ecart_de_tri",
      libelle: "Écart de tri",
      emoji: "🥬",
      explication: mots.ecart,
    },
  ];
}
