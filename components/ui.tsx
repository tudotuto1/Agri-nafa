// =============================================================================
// Briques d'interface communes.
//
// Tout est surdimensionné à dessein : gros boutons, gros textes, forts
// contrastes. Chaque écran doit rester utilisable d'une main, au champ.
// =============================================================================

import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";

// -----------------------------------------------------------------------------
export function Ecran({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.ecran} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.ecranContenu}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
export function Titre({ children }: { children: ReactNode }) {
  return <Text style={styles.titre}>{children}</Text>;
}

export function SousTitre({ children }: { children: ReactNode }) {
  return <Text style={styles.sousTitre}>{children}</Text>;
}

export function Aide({ children }: { children: ReactNode }) {
  return <Text style={styles.aide}>{children}</Text>;
}

export function Erreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.erreurBoite}>
      <Text style={styles.erreurTexte}>{message}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
type BoutonProps = {
  titre: string;
  onPress: () => void;
  variante?: "plein" | "contour";
  desactive?: boolean;
  chargement?: boolean;
  style?: ViewStyle;
};

export function Bouton({
  titre,
  onPress,
  variante = "plein",
  desactive = false,
  chargement = false,
  style,
}: BoutonProps) {
  const inactif = desactive || chargement;
  const contour = variante === "contour";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif, busy: chargement }}
      disabled={inactif}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bouton,
        contour && styles.boutonContour,
        inactif && styles.boutonInactif,
        pressed && !inactif && styles.boutonPresse,
        style,
      ]}
    >
      {chargement ? (
        <ActivityIndicator color={contour ? couleurs.vert : couleurs.blanc} />
      ) : (
        <Text style={[styles.boutonTexte, contour && styles.boutonTexteContour]}>
          {titre}
        </Text>
      )}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
type ChampProps = TextInputProps & { libelle: string };

export function Champ({ libelle, style, ...props }: ChampProps) {
  return (
    <View style={styles.champBloc}>
      <Text style={styles.champLibelle}>{libelle}</Text>
      <TextInput
        placeholderTextColor={couleurs.attenue}
        style={[styles.champ, style]}
        {...props}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
type CarteProps = {
  titre: string;
  sousTitre?: string;
  emoji?: string;
  selectionnee?: boolean;
  onPress: () => void;
  action?: ReactNode;
};

export function Carte({
  titre,
  sousTitre,
  emoji,
  selectionnee = false,
  onPress,
  action,
}: CarteProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selectionnee }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.carte,
        selectionnee && styles.carteSelectionnee,
        pressed && styles.cartePressee,
      ]}
    >
      {emoji ? <Text style={styles.carteEmoji}>{emoji}</Text> : null}
      <View style={styles.carteTextes}>
        <Text style={styles.carteTitre}>{titre}</Text>
        {sousTitre ? <Text style={styles.carteSousTitre}>{sousTitre}</Text> : null}
      </View>
      {action}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Barre de progression : des épis de mil qui poussent.
// Une étape franchie fait monter la tige — métaphore lisible sans savoir lire.
// -----------------------------------------------------------------------------
export function EpisDeMil({ etape, total }: { etape: number; total: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: etape }}
      style={styles.epis}
    >
      {Array.from({ length: total }, (_, i) => {
        const rang = i + 1;
        const fait = rang < etape;
        const enCours = rang === etape;
        return (
          <View
            key={rang}
            style={[
              styles.epi,
              fait && styles.epiFait,
              enCours && styles.epiEnCours,
            ]}
          />
        );
      })}
    </View>
  );
}

// -----------------------------------------------------------------------------
export function Attente() {
  return (
    <View style={styles.attente}>
      <ActivityIndicator size="large" color={couleurs.vert} />
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.papier,
  },
  ecranContenu: {
    flexGrow: 1,
    padding: espaces.lg,
    gap: espaces.md,
  },

  titre: {
    fontSize: textes.titre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  sousTitre: {
    fontSize: textes.sousTitre,
    fontWeight: "600",
    color: couleurs.encre,
  },
  aide: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.attenue,
  },

  erreurBoite: {
    backgroundColor: "#FDECEE",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.rouge,
    borderRadius: rayons.sm,
    padding: espaces.md,
  },
  erreurTexte: {
    fontSize: textes.corps,
    color: couleurs.rouge,
  },

  bouton: {
    minHeight: CIBLE_TACTILE,
    borderRadius: rayons.md,
    backgroundColor: couleurs.vert,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: espaces.lg,
  },
  boutonContour: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: couleurs.vert,
  },
  boutonInactif: {
    opacity: 0.45,
  },
  boutonPresse: {
    opacity: 0.85,
  },
  boutonTexte: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.blanc,
  },
  boutonTexteContour: {
    color: couleurs.vert,
  },

  champBloc: {
    gap: espaces.sm,
  },
  champLibelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.encre,
  },
  champ: {
    minHeight: CIBLE_TACTILE,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    paddingHorizontal: espaces.md,
    fontSize: textes.corps,
    color: couleurs.encre,
  },

  carte: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    minHeight: CIBLE_TACTILE + 12,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    padding: espaces.md,
  },
  carteSelectionnee: {
    borderColor: couleurs.vert,
    backgroundColor: "#EAF6EE",
  },
  cartePressee: {
    opacity: 0.85,
  },
  carteEmoji: {
    fontSize: 30,
  },
  carteTextes: {
    flex: 1,
    gap: 2,
  },
  carteTitre: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.encre,
  },
  carteSousTitre: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },

  epis: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: espaces.sm,
    height: 24,
  },
  epi: {
    flex: 1,
    height: 5,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.ligne,
  },
  epiFait: {
    height: 14,
    backgroundColor: couleurs.vert,
  },
  epiEnCours: {
    height: 24,
    backgroundColor: couleurs.or,
  },

  attente: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: couleurs.papier,
  },
});
