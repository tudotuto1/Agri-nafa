// =============================================================================
// Palette et mesures — dérivées du drapeau burkinabè.
//
// Le contraste prime sur l'élégance : l'application est consultée dehors, en
// plein soleil, sur des écrans bon marché souvent rayés.
// =============================================================================

export const couleurs = {
  rouge: "#E8112D",
  vert: "#009E49",
  or: "#FCD116",
  encre: "#122B1B",
  attenue: "#5E7263",
  papier: "#F6FAF2",
  ligne: "#E2EBDB",
  blanc: "#FFFFFF",
} as const;

export const espaces = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const rayons = {
  sm: 8,
  md: 14,
  lg: 22,
  rond: 999,
} as const;

// Corps de texte volontairement grands : la cible a souvent plus de 45 ans et
// lit avec difficulté. Rien en dessous de 16.
export const textes = {
  titre: 30,
  sousTitre: 22,
  corps: 18,
  petit: 15,
} as const;

// Hauteur minimale d'une zone tappable. Un doigt calleux sur un écran poussiéreux
// ne vise pas au pixel près.
export const CIBLE_TACTILE = 60;
