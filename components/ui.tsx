// =============================================================================
// Briques d'interface communes.
//
// Tout est surdimensionné à dessein : gros boutons, gros textes, forts
// contrastes. Chaque écran doit rester utilisable d'une main, au champ.
// =============================================================================

import { ReactNode, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
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
type EcranProps = {
  children: ReactNode;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
};

export function Ecran({ children, refreshControl }: EcranProps) {
  return (
    <SafeAreaView style={styles.ecran} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.ecranContenu}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
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

export function Succes({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.succesBoite}>
      <Text style={styles.succesTexte}>{message}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Pilule sélectionnable, pour un choix parmi une liste courte et fermée.
// Préférée à un menu déroulant : tout est visible d'un coup d'œil, et la cible
// reste large sous un doigt.
// -----------------------------------------------------------------------------
export function Pilule({
  libelle,
  emoji,
  selectionnee,
  onPress,
}: {
  libelle: string;
  emoji?: string;
  selectionnee: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: selectionnee }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pilule,
        selectionnee && styles.piluleSelectionnee,
        pressed && styles.boutonPresse,
      ]}
    >
      {emoji ? <Text style={styles.piluleEmoji}>{emoji}</Text> : null}
      <Text style={[styles.piluleTexte, selectionnee && styles.piluleTexteSelectionne]}>
        {libelle}
      </Text>
    </Pressable>
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
// Barre de progression continue, pour l'avancement d'un cycle dans le temps.
// Distincte des épis de mil, qui jalonnent des étapes discrètes.
// -----------------------------------------------------------------------------
export function BarreProgression({
  avancement,
  couleur = couleurs.vert,
}: {
  avancement: number;
  couleur?: string;
}) {
  const borne = Math.min(Math.max(avancement, 0), 1);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(borne * 100) }}
      style={styles.barreFond}
    >
      <View
        style={[
          styles.barreRemplie,
          { width: `${borne * 100}%`, backgroundColor: couleur },
        ]}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
export function Badge({
  texte,
  ton = "info",
}: {
  texte: string;
  ton?: "info" | "urgent";
}) {
  const urgent = ton === "urgent";
  return (
    <View style={[styles.badge, urgent && styles.badgeUrgent]}>
      <Text style={[styles.badgeTexte, urgent && styles.badgeTexteUrgent]}>
        {texte}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Squelette de chargement.
//
// Préféré à un spinner plein écran : la page garde sa forme pendant l'attente,
// donc l'œil sait déjà où regarder quand les chiffres arrivent. Sur une 2G
// rurale, l'attente se compte en secondes — autant qu'elle soit lisible.
// -----------------------------------------------------------------------------
export function Squelette({
  hauteur = 20,
  largeur = "100%",
}: {
  hauteur?: number;
  largeur?: number | `${number}%`;
}) {
  const pulsation = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulsation, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulsation, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [pulsation]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.squelette, { height: hauteur, width: largeur, opacity: pulsation }]}
    />
  );
}

// -----------------------------------------------------------------------------
// Destination provisoire des actions rapides, le temps que chaque écran soit
// écrit. Un bouton qui ne mène nulle part laisse croire à une panne.
// -----------------------------------------------------------------------------
export function EcranAVenir({
  emoji,
  titre,
  explication,
  onRetour,
}: {
  emoji: string;
  titre: string;
  explication: string;
  onRetour: () => void;
}) {
  return (
    <Ecran>
      <Text style={styles.aVenirEmoji}>{emoji}</Text>
      <Titre>{titre}</Titre>
      <Aide>{explication}</Aide>
      <View style={styles.aVenirPied}>
        <Bouton titre="Retour" variante="contour" onPress={onRetour} />
      </View>
    </Ecran>
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

  succesBoite: {
    backgroundColor: "#EAF6EE",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.vert,
    borderRadius: rayons.sm,
    padding: espaces.md,
  },
  succesTexte: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.encre,
  },

  pilule: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
    minHeight: 52,
    paddingHorizontal: espaces.md,
    paddingVertical: espaces.sm,
    borderRadius: rayons.rond,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    backgroundColor: couleurs.blanc,
  },
  piluleSelectionnee: {
    borderColor: couleurs.vert,
    backgroundColor: couleurs.vert,
  },
  piluleEmoji: {
    fontSize: textes.corps,
  },
  piluleTexte: {
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },
  piluleTexteSelectionne: {
    color: couleurs.blanc,
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

  barreFond: {
    height: 10,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.ligne,
    overflow: "hidden",
  },
  barreRemplie: {
    height: "100%",
    borderRadius: rayons.rond,
  },

  badge: {
    minWidth: 30,
    paddingHorizontal: espaces.sm,
    paddingVertical: 3,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.or,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeUrgent: {
    backgroundColor: couleurs.rouge,
  },
  badgeTexte: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },
  badgeTexteUrgent: {
    color: couleurs.blanc,
  },

  squelette: {
    borderRadius: rayons.sm,
    backgroundColor: couleurs.ligne,
  },

  aVenirEmoji: {
    fontSize: 56,
  },
  aVenirPied: {
    marginTop: "auto",
  },

  attente: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: couleurs.papier,
  },
});
