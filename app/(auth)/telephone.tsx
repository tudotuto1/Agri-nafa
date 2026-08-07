// =============================================================================
// Étape 2 — Numéro de téléphone.
//
// L'indicatif +226 est figé : l'application ne s'adresse qu'au Burkina Faso, et
// un sélecteur de pays serait un obstacle de plus sur un parcours qui doit
// tenir en trois gestes.
// =============================================================================

import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Aide, Bouton, Ecran, EpisDeMil, Erreur, Titre } from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

const INDICATIF = "+226";
const LONGUEUR = 8;

export default function EcranTelephone() {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const complet = numero.length === LONGUEUR;

  async function envoyerCode() {
    if (!complet) return;
    setEnvoi(true);
    setErreur(null);

    const telephone = `${INDICATIF}${numero}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: telephone });

    setEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    router.push({ pathname: "/(auth)/code", params: { telephone } });
  }

  return (
    <Ecran>
      <EpisDeMil etape={2} total={5} />
      <Titre>Votre numéro de téléphone</Titre>
      <Aide>
        Utilisez le numéro qui porte votre WhatsApp : c'est par lui que vos
        acheteurs vous joindront.
      </Aide>

      <View style={styles.ligne}>
        <View style={styles.indicatif}>
          <Text style={styles.indicatifTexte}>{INDICATIF}</Text>
        </View>
        <TextInput
          style={styles.numero}
          value={numero}
          onChangeText={(valeur) =>
            setNumero(valeur.replace(/\D/g, "").slice(0, LONGUEUR))
          }
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="70 00 00 00"
          placeholderTextColor={couleurs.attenue}
          maxLength={LONGUEUR}
          autoFocus
          accessibilityLabel="Numéro de téléphone, 8 chiffres"
        />
      </View>

      <Erreur message={erreur} />

      <Bouton
        titre="Recevoir le code"
        onPress={envoyerCode}
        desactive={!complet}
        chargement={envoi}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row",
    gap: espaces.sm,
  },
  indicatif: {
    minHeight: CIBLE_TACTILE,
    justifyContent: "center",
    paddingHorizontal: espaces.md,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    borderRadius: rayons.md,
    backgroundColor: couleurs.ligne,
  },
  indicatifTexte: {
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  numero: {
    flex: 1,
    minHeight: CIBLE_TACTILE,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    paddingHorizontal: espaces.md,
    fontSize: textes.sousTitre,
    letterSpacing: 2,
    color: couleurs.encre,
  },
});
