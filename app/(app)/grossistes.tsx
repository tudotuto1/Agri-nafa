// =============================================================================
// Répertoire des acheteurs (« bana-banas »).
//
// Le canal réel de cette relation commerciale, ce n'est pas l'appel : c'est le
// message vocal WhatsApp, souvent tôt le matin. Beaucoup de grossistes des
// marchés urbains ne lisent pas les messages écrits. D'où l'icône micro dans
// la liste : le producteur doit savoir avant d'ouvrir la conversation s'il
// doit écrire ou parler.
//
// Les suppressions sont logiques (deleted_at). Un acheteur retiré reste lié
// aux ventes passées : le supprimer vraiment trouerait la comptabilité.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  Aide,
  Bouton,
  Champ,
  Ecran,
  Erreur,
  Pilule,
  SousTitre,
  Squelette,
  Succes,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { messageErreurLisible } from "@/lib/erreurs";
import {
  INDICATIF_BF,
  LONGUEUR_NUMERO_BF,
  formaterTelephone,
  numeroInternational,
  urlsWhatsapp,
} from "@/lib/format";
import { supabase } from "@/lib/supabase";

type Grossiste = {
  id: string;
  nom: string;
  ville: string | null;
  marche_id: string | null;
  telephone_whatsapp: string | null;
  note_fiabilite: number | null;
  prefere_message_vocal: boolean;
  commentaire: string | null;
};

type Marche = { id: string; nom: string; ville: string };

const CHAMPS =
  "id, nom, ville, marche_id, telephone_whatsapp, note_fiabilite, prefere_message_vocal, commentaire";

// =============================================================================
export default function EcranGrossistes() {
  const router = useRouter();
  const { session } = useAuth();

  const [grossistes, setGrossistes] = useState<Grossiste[]>([]);
  const [marches, setMarches] = useState<Marche[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [numero, setNumero] = useState("");
  const [marcheId, setMarcheId] = useState<string | null>(null);
  const [ville, setVille] = useState("");
  const [note, setNote] = useState<number | null>(null);
  const [prefereVocal, setPrefereVocal] = useState(true);
  const [commentaire, setCommentaire] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // ---------------------------------------------------------------------------
  const charger = useCallback(async () => {
    // Tri : les acheteurs les plus fiables en tête, ceux sans note à la fin.
    const [resG, resM] = await Promise.all([
      supabase
        .from("grossistes")
        .select(CHAMPS)
        .is("deleted_at", null)
        .order("note_fiabilite", { ascending: false, nullsFirst: false })
        .order("nom", { ascending: true }),
      supabase.from("marches").select("id, nom, ville").order("ville"),
    ]);

    if (resG.error || resM.error) {
      setErreur("Impossible de charger vos acheteurs. Réessayez.");
      return;
    }
    setErreur(null);
    setGrossistes((resG.data ?? []) as Grossiste[]);
    setMarches((resM.data ?? []) as Marche[]);
  }, []);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  useEffect(() => {
    if (!confirmation) return;
    const t = setTimeout(() => setConfirmation(null), 5000);
    return () => clearTimeout(t);
  }, [confirmation]);

  const nomsMarches = useMemo(
    () => new Map(marches.map((m) => [m.id, m.nom])),
    [marches],
  );

  // ---------------------------------------------------------------------------
  function reinitialiser() {
    setNom("");
    setNumero("");
    setMarcheId(null);
    setVille("");
    setNote(null);
    setPrefereVocal(true);
    setCommentaire("");
  }

  const numeroComplet = numeroInternational(numero);
  const numeroIncomplet = numero.length > 0 && numeroComplet === null;
  const pret = nom.trim().length >= 2 && !envoi;

  const enregistrer = useCallback(async () => {
    if (!pret || !session?.user) return;

    setEnvoi(true);
    setErreur(null);

    const { error } = await supabase.from("grossistes").insert({
      user_id: session.user.id,
      nom: nom.trim(),
      telephone_whatsapp: numeroComplet,
      marche_id: marcheId,
      ville: ville.trim() || null,
      note_fiabilite: note,
      prefere_message_vocal: prefereVocal,
      commentaire: commentaire.trim() || null,
    });

    setEnvoi(false);
    if (error) {
      setErreur(messageErreurLisible(error, "cet acheteur"));
      return;
    }

    setConfirmation(`${nom.trim()} ajouté à vos acheteurs.`);
    reinitialiser();
    setFormulaireOuvert(false);
    await charger();
  }, [
    pret,
    session,
    nom,
    numeroComplet,
    marcheId,
    ville,
    note,
    prefereVocal,
    commentaire,
    charger,
  ]);

  // Suppression logique : jamais de DELETE.
  const retirer = useCallback(
    (grossiste: Grossiste) => {
      Alert.alert(
        "Retirer cet acheteur ?",
        `${grossiste.nom} n'apparaîtra plus dans votre répertoire. Vos ventes passées avec lui sont conservées.`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Retirer",
            style: "destructive",
            onPress: async () => {
              const { error } = await supabase
                .from("grossistes")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", grossiste.id);

              if (error) {
                setErreur(messageErreurLisible(error, "cet acheteur"));
                return;
              }
              setConfirmation(`${grossiste.nom} retiré de votre répertoire.`);
              await charger();
            },
          },
        ],
      );
    },
    [charger],
  );

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Mes acheteurs</Titre>
        <Squelette hauteur={92} />
        <Squelette hauteur={92} />
        <Squelette hauteur={92} />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Titre>Mes acheteurs</Titre>
      <Aide>
        Vos grossistes, du plus fiable au moins fiable. L'icône 🎤 signale ceux
        qui préfèrent recevoir un message vocal.
      </Aide>

      <Succes message={confirmation} />
      <Erreur message={erreur} />

      {/* Liste -------------------------------------------------------------- */}
      {grossistes.length === 0 && !formulaireOuvert ? (
        <View style={styles.vide}>
          <Text style={styles.videEmoji}>🤝</Text>
          <SousTitre>Aucun acheteur enregistré</SousTitre>
          <Aide>
            Notez les bana-banas avec qui vous travaillez. Vous pourrez les
            joindre d'un doigt au moment de vendre.
          </Aide>
        </View>
      ) : (
        <View style={styles.liste}>
          {grossistes.map((g) => (
            <LigneGrossiste
              key={g.id}
              grossiste={g}
              nomMarche={g.marche_id ? (nomsMarches.get(g.marche_id) ?? null) : null}
              onRetirer={() => retirer(g)}
              onErreur={setErreur}
            />
          ))}
        </View>
      )}

      {/* Formulaire --------------------------------------------------------- */}
      {!formulaireOuvert ? (
        <Bouton titre="+ Ajouter un acheteur" onPress={() => setFormulaireOuvert(true)} />
      ) : (
        <View style={styles.formulaire}>
          <SousTitre>Nouvel acheteur</SousTitre>

          <Champ
            libelle="Nom"
            value={nom}
            onChangeText={setNom}
            placeholder="Ex. Ali Ouédraogo"
            autoCapitalize="words"
            autoFocus
          />

          {/* Numéro WhatsApp — indicatif figé, comme à l'inscription -------- */}
          <View style={styles.bloc}>
            <Text style={styles.libelle}>Numéro WhatsApp (facultatif)</Text>
            <View style={styles.ligneTelephone}>
              <View style={styles.indicatif}>
                <Text style={styles.indicatifTexte}>{INDICATIF_BF}</Text>
              </View>
              <TextInput
                style={styles.numero}
                value={numero}
                onChangeText={(v) =>
                  setNumero(v.replace(/\D/g, "").slice(0, LONGUEUR_NUMERO_BF))
                }
                keyboardType="number-pad"
                placeholder="70 00 00 00"
                placeholderTextColor={couleurs.attenue}
                maxLength={LONGUEUR_NUMERO_BF}
                accessibilityLabel="Numéro WhatsApp, 8 chiffres"
              />
            </View>
            {numeroIncomplet ? (
              <Text style={styles.champErreur}>
                Le numéro doit compter {LONGUEUR_NUMERO_BF} chiffres.
              </Text>
            ) : null}
          </View>

          {/* Marché */}
          <View style={styles.bloc}>
            <Text style={styles.libelle}>Sur quel marché ? (facultatif)</Text>
            <View style={styles.pilules}>
              {marches.map((m) => (
                <Pilule
                  key={m.id}
                  libelle={m.nom}
                  selectionnee={marcheId === m.id}
                  onPress={() => setMarcheId(marcheId === m.id ? null : m.id)}
                />
              ))}
            </View>
          </View>

          <Champ
            libelle="Ville (facultatif)"
            value={ville}
            onChangeText={setVille}
            placeholder="Ex. Ouagadougou"
            autoCapitalize="words"
          />

          {/* Fiabilité */}
          <View style={styles.bloc}>
            <Text style={styles.libelle}>Fiabilité (facultatif)</Text>
            <EtoilesSaisie note={note} onChange={setNote} />
            <Aide>Appuyez sur la même étoile pour retirer la note.</Aide>
          </View>

          {/* Préférence vocale */}
          <View style={styles.interrupteur}>
            <View style={styles.interrupteurTextes}>
              <Text style={styles.libelle}>Préfère les messages vocaux</Text>
              <Aide>
                La plupart des grossistes de marché écoutent, ils ne lisent pas.
              </Aide>
            </View>
            <Switch
              value={prefereVocal}
              onValueChange={setPrefereVocal}
              trackColor={{ false: couleurs.ligne, true: couleurs.vert }}
              thumbColor={couleurs.blanc}
              accessibilityLabel="Préfère les messages vocaux"
            />
          </View>

          <Champ
            libelle="Commentaire (facultatif)"
            value={commentaire}
            onChangeText={setCommentaire}
            placeholder="Ex. paie comptant, vient le mardi"
            autoCapitalize="sentences"
          />

          <Bouton
            titre="Enregistrer l'acheteur"
            onPress={enregistrer}
            desactive={!pret}
            chargement={envoi}
          />
          <Bouton
            titre="Annuler"
            variante="contour"
            onPress={() => {
              reinitialiser();
              setFormulaireOuvert(false);
            }}
          />
        </View>
      )}

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function LigneGrossiste({
  grossiste,
  nomMarche,
  onRetirer,
  onErreur,
}: {
  grossiste: Grossiste;
  nomMarche: string | null;
  onRetirer: () => void;
  onErreur: (message: string) => void;
}) {
  const lieu = nomMarche ?? grossiste.ville;

  // On tente l'application native, puis wa.me. openURL rejette quand aucune
  // application ne sait ouvrir le schéma : c'est plus fiable que canOpenURL,
  // qui exige une déclaration <queries> dans le manifeste Android 11+ et
  // renvoie false à tort sans elle.
  const ouvrirWhatsapp = useCallback(async () => {
    const urls = urlsWhatsapp(grossiste.telephone_whatsapp);
    if (!urls) {
      onErreur("Aucun numéro WhatsApp enregistré pour cet acheteur.");
      return;
    }
    try {
      await Linking.openURL(urls.application);
    } catch {
      try {
        await Linking.openURL(urls.web);
      } catch {
        onErreur("Impossible d'ouvrir WhatsApp sur ce téléphone.");
      }
    }
  }, [grossiste.telephone_whatsapp, onErreur]);

  return (
    <View style={styles.carte}>
      <View style={styles.carteTextes}>
        <View style={styles.carteTitreLigne}>
          <Text style={styles.carteNom}>{grossiste.nom}</Text>
          {grossiste.prefere_message_vocal ? (
            <Text
              style={styles.micro}
              accessibilityLabel="Préfère les messages vocaux"
            >
              🎤
            </Text>
          ) : null}
        </View>

        {lieu ? <Text style={styles.carteLieu}>{lieu}</Text> : null}

        {grossiste.note_fiabilite !== null ? (
          <Etoiles note={grossiste.note_fiabilite} />
        ) : null}

        {grossiste.telephone_whatsapp ? (
          <Text style={styles.carteTelephone}>
            {formaterTelephone(grossiste.telephone_whatsapp)}
          </Text>
        ) : null}
      </View>

      <View style={styles.carteActions}>
        {grossiste.telephone_whatsapp ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Écrire à ${grossiste.nom} sur WhatsApp`}
            onPress={ouvrirWhatsapp}
            style={({ pressed }) => [styles.boutonWhatsapp, pressed && styles.presse]}
          >
            <Text style={styles.boutonWhatsappIcone}>💬</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${grossiste.nom}`}
          onPress={onRetirer}
          hitSlop={8}
          style={({ pressed }) => [styles.boutonRetirer, pressed && styles.presse]}
        >
          <Text style={styles.boutonRetirerTexte}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
function Etoiles({ note }: { note: number }) {
  return (
    <Text
      style={styles.etoiles}
      accessibilityLabel={`Fiabilité : ${note} sur 5`}
    >
      {"★".repeat(note)}
      <Text style={styles.etoilesVides}>{"★".repeat(5 - note)}</Text>
    </Text>
  );
}

function EtoilesSaisie({
  note,
  onChange,
}: {
  note: number | null;
  onChange: (note: number | null) => void;
}) {
  return (
    <View style={styles.etoilesSaisie}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={`${n} étoile${n > 1 ? "s" : ""}`}
          accessibilityState={{ selected: note === n }}
          onPress={() => onChange(note === n ? null : n)}
          hitSlop={6}
        >
          <Text
            style={[
              styles.etoileSaisie,
              note !== null && n <= note && styles.etoileActive,
            ]}
          >
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  bloc: { gap: espaces.sm },
  liste: { gap: espaces.sm },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: espaces.sm },
  presse: { opacity: 0.85 },
  pied: { marginTop: espaces.lg },

  libelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.encre,
  },
  champErreur: {
    fontSize: textes.petit,
    color: couleurs.rouge,
  },

  carte: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  carteTextes: { flex: 1, gap: 2 },
  carteTitreLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  carteNom: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  micro: { fontSize: textes.corps },
  carteLieu: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  carteTelephone: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  carteActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },

  boutonWhatsapp: {
    width: CIBLE_TACTILE,
    height: CIBLE_TACTILE,
    borderRadius: rayons.rond,
    backgroundColor: "#25D366", // vert WhatsApp, reconnu sans savoir lire
    alignItems: "center",
    justifyContent: "center",
  },
  boutonWhatsappIcone: { fontSize: textes.sousTitre },
  boutonRetirer: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  boutonRetirerTexte: {
    fontSize: textes.corps,
    color: couleurs.attenue,
  },

  etoiles: {
    fontSize: textes.corps,
    color: couleurs.or,
    letterSpacing: 2,
  },
  etoilesVides: { color: couleurs.ligne },
  etoilesSaisie: {
    flexDirection: "row",
    gap: espaces.sm,
  },
  etoileSaisie: {
    fontSize: 38,
    color: couleurs.ligne,
  },
  etoileActive: { color: couleurs.or },

  formulaire: {
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  ligneTelephone: {
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
  interrupteur: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
  },
  interrupteurTextes: { flex: 1, gap: espaces.xs },

  vide: {
    alignItems: "center",
    gap: espaces.md,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: couleurs.ligne,
  },
  videEmoji: { fontSize: 48 },
});
