// =============================================================================
// Illustrations des états vides, et tuiles de trame.
//
// Même contrainte que pour les espèces : Metro résout les `require` d'images à
// la compilation, donc les chemins sont écrits un par un. Voir
// components/illustration-espece.tsx pour le détail du raisonnement.
// =============================================================================

import type { ImageSourcePropType } from "react-native";

/** Une illustration par écran susceptible d'être vide. */
export const VIDES = {
  aucun_cycle: require("../assets/vides/aucun_cycle.png"),
  aucune_alerte: require("../assets/vides/aucune_alerte.png"),
  aucun_acheteur: require("../assets/vides/aucun_acheteur.png"),
  aucune_parcelle: require("../assets/vides/aucune_parcelle.png"),
  aucune_camera: require("../assets/vides/aucune_camera.png"),
  file_vide: require("../assets/vides/file_vide.png"),
} satisfies Record<string, ImageSourcePropType>;

/**
 * Tuiles de trame Faso Dan Fani, à répéter en fond d'en-tête.
 * Chaque tuile porte déjà sa couleur de fond : le motif et l'aplat ne se
 * séparent pas, sans quoi une opacité mal réglée les désaccorderait.
 */
export const TRAMES = {
  vert: require("../assets/trame/trame-vert.png"),
  nuit: require("../assets/trame/trame-nuit.png"),
  rouge: require("../assets/trame/trame-rouge.png"),
} satisfies Record<string, ImageSourcePropType>;

export type TonEntete = keyof typeof TRAMES;
