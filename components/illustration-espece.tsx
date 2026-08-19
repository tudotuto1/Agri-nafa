// =============================================================================
// Illustration d'une spéculation.
//
// -----------------------------------------------------------------------------
// POURQUOI UNE TABLE ÉCRITE À LA MAIN
//
// Metro résout les `require` d'images à la compilation, pas à l'exécution :
// `require(\`../assets/especes/${code}.png\`)` ne construit rien, il échoue.
// La correspondance code → fichier est donc explicite, treize lignes qu'il
// faut tenir à jour. C'est le prix de l'empaquetage statique, pas un oubli.
//
// La contrepartie est bonne : une espèce ajoutée en base sans son illustration
// ne casse rien, elle retombe sur l'emoji.
//
// -----------------------------------------------------------------------------
// L'EMOJI RESTE, ET N'EST PAS UN VESTIGE
//
// `speculations.icone` n'est pas remplacée. Elle sert de repli ici, et surtout
// elle reste seule utilisable là où il n'y a pas d'écran : le texte d'une
// fiche de prévente part sur WhatsApp, et un emoji voyage dans un message
// alors qu'un PNG n'y entre pas.
// =============================================================================

import { Image, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";

/**
 * Chemins statiques, écrits un par un. Voir l'en-tête : Metro n'accepte rien
 * d'autre. Les clés sont les codes de public.speculations.
 */
const ILLUSTRATIONS: Record<string, ImageSourcePropType> = {
  aubergine_kalenda: require("../assets/especes/aubergine_kalenda.png"),
  tomate: require("../assets/especes/tomate.png"),
  oignon: require("../assets/especes/oignon.png"),
  chou: require("../assets/especes/chou.png"),
  mais: require("../assets/especes/mais.png"),
  niebe: require("../assets/especes/niebe.png"),
  poulet_chair: require("../assets/especes/poulet_chair.png"),
  poulet_goliath: require("../assets/especes/poulet_goliath.png"),
  pondeuse: require("../assets/especes/pondeuse.png"),
  ovin_engraissement: require("../assets/especes/ovin_engraissement.png"),
  caprin_embouche: require("../assets/especes/caprin_embouche.png"),
  bovin_embouche: require("../assets/especes/bovin_embouche.png"),
  tilapia: require("../assets/especes/tilapia.png"),
};

/** Tailles d'usage. 96 sur les cartes de guide, 48 en liste et en bandeau. */
export const TAILLE_CARTE = 96;
export const TAILLE_LISTE = 48;

export function illustrationConnue(code: string | null | undefined): boolean {
  return Boolean(code && code in ILLUSTRATIONS);
}

type Props = {
  /** Code de public.speculations. Inconnu ou absent : on retombe sur l'emoji. */
  code: string | null | undefined;
  /** Emoji de speculations.icone, utilisé en repli. */
  emoji?: string | null;
  taille?: number;
  /**
   * Nom lisible, pour les lecteurs d'écran. Sans lui l'image est décorative
   * et reste muette — ce qui est le bon défaut quand le nom est déjà écrit
   * juste à côté, comme sur les cartes de guide.
   */
  nom?: string | null;
};

export function IllustrationEspece({ code, emoji, taille = TAILLE_LISTE, nom }: Props) {
  const source = code ? ILLUSTRATIONS[code] : undefined;

  if (!source) {
    // Repli : l'emoji, dimensionné pour occuper la même place. Un trou dans la
    // mise en page se remarquerait plus qu'un dessin approximatif.
    return (
      <View style={[styles.repli, { width: taille, height: taille }]}>
        <Text
          accessibilityElementsHidden={!nom}
          style={{ fontSize: Math.round(taille * 0.72) }}
        >
          {emoji ?? "🌱"}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={{ width: taille, height: taille }}
      resizeMode="contain"
      accessible={Boolean(nom)}
      accessibilityRole={nom ? "image" : undefined}
      accessibilityLabel={nom ?? undefined}
    />
  );
}

const styles = StyleSheet.create({
  repli: {
    alignItems: "center",
    justifyContent: "center",
  },
});
