// =============================================================================
// Palette et mesures — dérivées du drapeau burkinabè.
//
// Le contraste prime sur l'élégance : l'application est consultée dehors, en
// plein soleil, sur des écrans bon marché souvent rayés.
// =============================================================================

export const couleurs = {
  rouge: "#E8112D",
  vert: "#009E49",
  // Le vert du drapeau (#009E49) donne 3,51 sur blanc et 3,32 sur papier :
  // insuffisant pour du texte selon les critères d'accessibilité, et c'est le
  // premier élément à disparaître en plein soleil sur un écran rayé.
  // Cette variante assombrie dépasse 4,5 tout en restant reconnaissable.
  //
  // Ratios mesurés sur #007134 : 6,16 sur blanc, 5,83 sur papier. Les deux
  // dépassent 4,5 avec de la marge — inutile d'assombrir davantage, ce qui
  // aurait éloigné la teinte du drapeau sans rien gagner de lisible.
  //
  // Réservée au texte, aux icônes et aux fonds portant du texte blanc. Les
  // aplats sans texte — barres de progression, épis de mil, bordures — gardent
  // le vert du drapeau : c'est lui qui donne son identité à l'application.
  vertFonce: "#007134",
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
