// =============================================================================
// Étape 3 — Code SMS à 6 chiffres.
//
// Six cases visibles, mais un seul champ de saisie invisible par-dessus :
// c'est ce qui permet à l'autofill Android de coller le code reçu d'un coup.
// Six champs séparés cassent « autoComplete=sms-otp » et obligent à recopier
// le code à la main, en basculant entre le SMS et l'application.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Aide, Ecran, EpisDeMil, Erreur, Titre } from "@/components/ui";
import { couleurs, espaces, rayons, textes } from "@/constants/theme";
import { CLE_LANGUE, supabase, type Langue } from "@/lib/supabase";

const LONGUEUR = 6;
const ATTENTE_RENVOI = 60; // secondes

export default function EcranCode() {
  const router = useRouter();
  const { telephone } = useLocalSearchParams<{ telephone: string }>();

  const champ = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [verification, setVerification] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [compteARebours, setCompteARebours] = useState(ATTENTE_RENVOI);

  useEffect(() => {
    if (compteARebours <= 0) return;
    const minuteur = setTimeout(() => setCompteARebours((s) => s - 1), 1000);
    return () => clearTimeout(minuteur);
  }, [compteARebours]);

  // Vérification déclenchée au sixième chiffre : personne n'a envie d'appuyer
  // sur « Valider » après avoir déjà tapé le code en entier.
  useEffect(() => {
    if (code.length === LONGUEUR && !verification) {
      void verifier(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function verifier(saisie: string) {
    if (!telephone) {
      setErreur("Numéro de téléphone introuvable. Revenez à l'étape précédente.");
      return;
    }
    setVerification(true);
    setErreur(null);

    const { data, error } = await supabase.auth.verifyOtp({
      phone: telephone,
      token: saisie,
      type: "sms",
    });

    if (error || !data.user) {
      setVerification(false);
      setCode("");
      setErreur("Code incorrect ou expiré. Vérifiez vos SMS et recommencez.");
      return;
    }

    // Le profil existe déjà : il a été créé par le trigger sur auth.users.
    // On ne fait qu'y reporter la langue choisie à l'écran 1.
    const langue = (await AsyncStorage.getItem(CLE_LANGUE)) as Langue | null;
    if (langue) {
      await supabase.from("profils").update({ langue }).eq("id", data.user.id);
    }

    router.replace("/(auth)/profil");
  }

  async function renvoyer() {
    if (compteARebours > 0 || !telephone) return;
    setErreur(null);
    setCompteARebours(ATTENTE_RENVOI);
    const { error } = await supabase.auth.signInWithOtp({ phone: telephone });
    if (error) setErreur(error.message);
  }

  return (
    <Ecran>
      <EpisDeMil etape={3} total={5} />
      <Titre>Entrez le code reçu</Titre>
      <Aide>Un SMS de 6 chiffres a été envoyé au {telephone}.</Aide>

      <Pressable onPress={() => champ.current?.focus()} style={styles.cases}>
        {Array.from({ length: LONGUEUR }, (_, i) => (
          <View
            key={i}
            style={[styles.case, i === code.length && styles.caseActive]}
          >
            <Text style={styles.caseTexte}>{code[i] ?? ""}</Text>
          </View>
        ))}

        <TextInput
          ref={champ}
          style={styles.champInvisible}
          value={code}
          onChangeText={(valeur) =>
            setCode(valeur.replace(/\D/g, "").slice(0, LONGUEUR))
          }
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={LONGUEUR}
          autoFocus
          editable={!verification}
          accessibilityLabel="Code de vérification à 6 chiffres"
        />
      </Pressable>

      <Erreur message={erreur} />

      {verification ? <Aide>Vérification en cours…</Aide> : null}

      <Pressable onPress={renvoyer} disabled={compteARebours > 0} hitSlop={12}>
        <Text
          style={[styles.renvoi, compteARebours > 0 && styles.renvoiInactif]}
        >
          {compteARebours > 0
            ? `Renvoyer le code dans ${compteARebours} s`
            : "Renvoyer le code"}
        </Text>
      </Pressable>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  cases: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: espaces.sm,
    marginVertical: espaces.md,
  },
  case: {
    flex: 1,
    height: 68,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    alignItems: "center",
    justifyContent: "center",
  },
  caseActive: {
    borderColor: couleurs.or,
  },
  caseTexte: {
    fontSize: textes.titre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  // Le champ couvre les six cases sans être visible : le clavier s'ouvre au
  // toucher et l'autofill a une cible unique où déposer le code.
  champInvisible: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
    color: "transparent",
  },
  renvoi: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.vert,
    textAlign: "center",
    paddingVertical: espaces.sm,
  },
  renvoiInactif: {
    color: couleurs.attenue,
    fontWeight: "400",
  },
});
