// =============================================================================
// Dicter une dépense.
//
// Le chemin le plus court entre un producteur qui ne lit pas et une
// comptabilité opposable : il parle, l'IA propose, il valide.
//
// -----------------------------------------------------------------------------
// APPUI POUR DÉMARRER, APPUI POUR ARRÊTER
//
// Pas de maintien enfoncé. Tenir un doigt sur un écran pendant trente secondes
// est déjà pénible assis ; debout, au champ, une main occupée par un sac, c'est
// une promesse d'enregistrements coupés au milieu d'une phrase.
//
// -----------------------------------------------------------------------------
// CE QUI EST ENVOYÉ, ET CE QUI NE L'EST PAS
//
// L'audio part dans notes-vocales sous {user_id}/{horodatage}.m4a — le chemin
// que la fonction vérifie avant de lire quoi que ce soit. Puis la fonction est
// appelée EN DIRECT : elle a besoin du réseau pour joindre le service de
// transcription, et rien ne sert de mettre en file un appel qui ne peut pas
// aboutir hors ligne. Voir la note sur la file d'attente plus bas.
//
// La dépense revient avec validee = false : elle existe en base mais reste
// hors des calculs de rentabilité tant que le producteur n'a pas confirmé.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AudioQuality,
  IOSOutputFormat,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from "expo-audio";

import {
  Aide,
  Bouton,
  Ecran,
  Erreur,
  Pilule,
  SousTitre,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { formaterFcfa } from "@/lib/format";
import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Enregistrement calibré pour la voix, pas pour la musique.
//
// Le préréglage HIGH_QUALITY produit du 128 kbit/s stéréo en 44,1 kHz : une
// minute pèse près d'un mégaoctet, à envoyer depuis un village en 2G. Mono à
// 64 kbit/s divise ça par deux sans rien coûter à l'intelligibilité — la
// transcription ramène de toute façon le signal à 16 kHz.
//
// LOW_QUALITY n'est pas une option : sur Android il sort du .3gp en AMR, que le
// bucket refuse — ses types autorisés sont mpeg, mp4, ogg, wav et webm.
// -----------------------------------------------------------------------------
const ENREGISTREMENT: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: ".m4a",
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 64000,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: {
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
};

/**
 * Deux minutes suffisent largement à dire « j'ai acheté deux sacs d'engrais à
 * quarante-cinq mille ». Au-delà, on coupe : le bucket plafonne à 10 Mo et une
 * note interminable coûte du forfait pour rien.
 */
const DUREE_MAX_S = 120;

type Etape =
  | { nom: "pret" }
  | { nom: "enregistre" }
  | { nom: "envoie"; phase: "televersement" | "analyse" }
  | { nom: "resultat"; reponse: ReponseFonction };

type Cycle = { id: string; nom: string; type?: string };

type Analyse = {
  description?: string | null;
  categorie?: string | null;
  montant_total?: number | null;
  date_depense?: string | null;
};

type Depense = {
  id: string;
  description: string;
  categorie: string;
  montant_total: number;
  cycle_id: string;
  date_depense: string;
};

type ReponseFonction =
  | { statut: "a_valider"; message: string; transcription: string; confiance: number; depense: Depense }
  | { statut: "audio_inaudible"; message: string; transcription: string }
  | { statut: "besoin_precision"; message: string; transcription: string; analyse?: Analyse }
  | { statut: "aucun_cycle"; message: string; transcription: string }
  | {
      statut: "cycle_a_preciser";
      message: string;
      transcription: string;
      analyse?: Analyse;
      cycles_proposes: Cycle[];
    };

// =============================================================================
export default function EcranDepenseVocale() {
  const router = useRouter();
  const { session } = useAuth();

  const enregistreur = useAudioRecorder(ENREGISTREMENT);
  const etatEnregistreur = useAudioRecorderState(enregistreur, 250);

  const [etape, setEtape] = useState<Etape>({ nom: "pret" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [validation, setValidation] = useState(false);
  // Conservé entre deux appels : préciser un cycle ne doit pas obliger à
  // reparler, la fonction sait relire la même note.
  const cheminAudio = useRef<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  }, []);

  const secondes = Math.floor(etatEnregistreur.durationMillis / 1000);

  // ---------------------------------------------------------------- démarrer
  const demarrer = useCallback(async () => {
    setErreur(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setErreur(
        "Le micro n'est pas autorisé. Ouvrez les réglages du téléphone pour l'autoriser.",
      );
      return;
    }
    await enregistreur.prepareToRecordAsync();
    enregistreur.record();
    setEtape({ nom: "enregistre" });
  }, [enregistreur]);

  // ------------------------------------------------------ arrêter et envoyer
  const arreterEtEnvoyer = useCallback(async () => {
    await enregistreur.stop();
    const uri = enregistreur.uri;
    if (!uri || !session?.user) {
      setErreur("L'enregistrement n'a pas pu être récupéré. Réessayez.");
      setEtape({ nom: "pret" });
      return;
    }

    setEtape({ nom: "envoie", phase: "televersement" });
    setErreur(null);

    try {
      // Le chemin porte l'identifiant de l'appelant : la fonction refuse tout
      // fichier hors de ce dossier, et la policy Storage aussi.
      const chemin = `${session.user.id}/${Date.now()}.m4a`;
      const donnees = await (await fetch(uri)).arrayBuffer();

      const { error: errEnvoi } = await supabase.storage
        .from("notes-vocales")
        .upload(chemin, donnees, { contentType: "audio/mp4", upsert: false });

      if (errEnvoi) {
        setErreur(
          "La note vocale n'a pas pu être envoyée. Vérifiez votre connexion, puis réessayez.",
        );
        setEtape({ nom: "pret" });
        return;
      }

      cheminAudio.current = chemin;
      await analyser(chemin);
    } catch {
      setErreur("La note vocale n'a pas pu être lue sur le téléphone. Réessayez.");
      setEtape({ nom: "pret" });
    }
  }, [enregistreur, session]);

  // ------------------------------------------------------------- la fonction
  const analyser = useCallback(async (chemin: string, cycleId?: string) => {
    setEtape({ nom: "envoie", phase: "analyse" });
    const { data, error } = await supabase.functions.invoke("saisie-vocale", {
      body: cycleId ? { audio_path: chemin, cycle_id: cycleId } : { audio_path: chemin },
    });

    if (error || !data || typeof data.statut !== "string") {
      setErreur(
        "L'analyse n'a pas abouti. Elle a besoin d'une vraie connexion — réessayez une fois le réseau revenu.",
      );
      setEtape({ nom: "pret" });
      return;
    }
    setEtape({ nom: "resultat", reponse: data as ReponseFonction });
  }, []);

  // Coupure automatique : `stop()` est idempotent côté module, mais on ne
  // déclenche l'envoi qu'une fois, à la bascule.
  useEffect(() => {
    if (etape.nom === "enregistre" && secondes >= DUREE_MAX_S) {
      void arreterEtEnvoyer();
    }
  }, [etape.nom, secondes, arreterEtEnvoyer]);

  const recommencer = useCallback(() => {
    cheminAudio.current = null;
    setErreur(null);
    setEtape({ nom: "pret" });
  }, []);

  // --------------------------------------------------------------- valider
  const valider = useCallback(
    async (depense: Depense) => {
      setValidation(true);
      const { error } = await supabase
        .from("depenses")
        .update({ validee: true })
        .eq("id", depense.id);
      setValidation(false);

      if (error) {
        setErreur("La validation n'a pas abouti. Réessayez.");
        return;
      }
      router.replace({
        pathname: "/(app)/accueil",
        params: { depense_enregistree: "1" },
      });
    },
    [router],
  );

  return (
    <Ecran>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Revenir en arrière"
        onPress={() => router.back()}
        style={styles.retour}
      >
        <Text style={styles.retourTexte}>‹ Retour</Text>
      </Pressable>

      <Titre>Dicter une dépense</Titre>

      <Erreur message={erreur} />

      {etape.nom === "pret" || etape.nom === "enregistre" ? (
        <Micro
          enregistre={etape.nom === "enregistre"}
          secondes={secondes}
          onPress={() => (etape.nom === "enregistre" ? arreterEtEnvoyer() : demarrer())}
        />
      ) : null}

      {etape.nom === "envoie" ? <Attente phase={etape.phase} /> : null}

      {etape.nom === "resultat" ? (
        <Resultat
          reponse={etape.reponse}
          validation={validation}
          onValider={valider}
          onRecommencer={recommencer}
          onCycle={(id) => {
            if (cheminAudio.current) void analyser(cheminAudio.current, id);
          }}
          onCorriger={(d) =>
            router.push({
              pathname: "/(app)/depense",
              params: {
                montant: String(d.montant_total ?? ""),
                description: d.description ?? "",
                categorie: d.categorie ?? "",
                cycle_id: d.cycle_id ?? "",
                date: d.date_depense ?? "",
              },
            })
          }
        />
      ) : null}

      <View style={styles.pied} />
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
// Le bouton. Grand, centré, et il change de sens en changeant d'aspect.
function Micro({
  enregistre,
  secondes,
  onPress,
}: {
  enregistre: boolean;
  secondes: number;
  onPress: () => void;
}) {
  return (
    <View style={styles.zoneMicro}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          enregistre ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"
        }
        accessibilityState={{ busy: enregistre }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.micro,
          enregistre && styles.microActif,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={styles.microEmoji}>{enregistre ? "■" : "🎤"}</Text>
      </Pressable>

      {enregistre ? (
        <>
          <Onde />
          <Text style={styles.chrono}>{minutage(secondes)}</Text>
          <Aide>
            Appuyez de nouveau pour arrêter. Coupure automatique à{" "}
            {minutage(DUREE_MAX_S)}.
          </Aide>
        </>
      ) : (
        <Aide>
          Appuyez, dites ce que vous avez acheté et combien vous l&apos;avez payé,
          puis appuyez de nouveau. Par exemple : « j&apos;ai acheté deux sacs
          d&apos;engrais NPK à quarante-cinq mille francs ».
        </Aide>
      )}
    </View>
  );
}

/**
 * Trois points qui pulsent, décalés.
 *
 * Une vraie onde demanderait le niveau du micro rafraîchi soixante fois par
 * seconde ; sur un téléphone d'entrée de gamme ça coûte plus que ça ne
 * rassure. Ce qu'il faut prouver, c'est que le téléphone écoute — trois
 * points qui bougent le disent aussi bien.
 */
function Onde() {
  const [pas, setPas] = useState(0);
  useEffect(() => {
    const minuteur = setInterval(() => setPas((p) => (p + 1) % 3), 320);
    return () => clearInterval(minuteur);
  }, []);
  return (
    <View accessibilityElementsHidden style={styles.onde}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.point, pas === i && styles.pointActif]} />
      ))}
    </View>
  );
}

function Attente({ phase }: { phase: "televersement" | "analyse" }) {
  return (
    <View style={styles.attente}>
      <Onde />
      <Text style={styles.attenteTitre}>
        {phase === "televersement" ? "Envoi de la note…" : "J'écoute votre note…"}
      </Text>
      <Aide>
        {phase === "televersement"
          ? "La note part vers le serveur."
          : "Cela prend quelques secondes. Ne fermez pas l'écran."}
      </Aide>
    </View>
  );
}

// -----------------------------------------------------------------------------
function Resultat({
  reponse,
  validation,
  onValider,
  onRecommencer,
  onCycle,
  onCorriger,
}: {
  reponse: ReponseFonction;
  validation: boolean;
  onValider: (d: Depense) => void;
  onRecommencer: () => void;
  onCycle: (id: string) => void;
  onCorriger: (d: Depense) => void;
}) {
  if (reponse.statut === "a_valider") {
    const d = reponse.depense;
    return (
      <View style={styles.carte}>
        <SousTitre>Dépense comprise</SousTitre>
        <Text style={styles.montant}>{formaterFcfa(d.montant_total)}</Text>
        <Text style={styles.description}>{d.description}</Text>
        <Text style={styles.categorie}>{libelleCategorie(d.categorie)}</Text>

        <Transcription texte={reponse.transcription} />

        <Aide>
          Elle est enregistrée mais ne compte pas encore dans vos résultats.
          Validez pour qu&apos;elle y entre.
        </Aide>

        <Bouton
          titre="Valider"
          onPress={() => onValider(d)}
          chargement={validation}
        />
        <Bouton titre="Corriger" variante="contour" onPress={() => onCorriger(d)} />
      </View>
    );
  }

  if (reponse.statut === "cycle_a_preciser") {
    return (
      <View style={styles.carte}>
        <SousTitre>À quel cycle ?</SousTitre>
        <Aide>{reponse.message}</Aide>
        <Transcription texte={reponse.transcription} />
        <View style={styles.cycles}>
          {reponse.cycles_proposes.map((c) => (
            <Pilule
              key={c.id}
              libelle={c.nom}
              selectionnee={false}
              onPress={() => onCycle(c.id)}
            />
          ))}
        </View>
      </View>
    );
  }

  if (reponse.statut === "aucun_cycle") {
    return (
      <View style={styles.carte}>
        <SousTitre>Aucun cycle en cours</SousTitre>
        <Aide>{reponse.message}</Aide>
        <Bouton titre="Réessayer" variante="contour" onPress={onRecommencer} />
      </View>
    );
  }

  // audio_inaudible et besoin_precision : même geste, redire.
  return (
    <View style={styles.carte}>
      <SousTitre>
        {reponse.statut === "audio_inaudible"
          ? "Je n'ai pas bien entendu"
          : "Il manque une précision"}
      </SousTitre>
      <Aide>{reponse.message}</Aide>
      <Transcription texte={reponse.transcription} />
      <Bouton titre="Réessayer" onPress={onRecommencer} />
    </View>
  );
}

/** Ce que le téléphone a cru entendre. Sans ça, un refus reste inexplicable. */
function Transcription({ texte }: { texte?: string }) {
  if (!texte) return null;
  return (
    <View style={styles.transcription}>
      <Text style={styles.transcriptionLibelle}>Ce que j&apos;ai entendu</Text>
      <Text style={styles.transcriptionTexte}>« {texte} »</Text>
    </View>
  );
}

const LIBELLES: Record<string, string> = {
  intrants: "Intrants",
  main_d_oeuvre: "Main-d'œuvre",
  carburant: "Carburant",
  transport: "Transport",
  veterinaire: "Vétérinaire",
  irrigation: "Irrigation",
  location: "Location",
  autre: "Autre",
};

function libelleCategorie(code: string): string {
  return LIBELLES[code] ?? code;
}

function minutage(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  retour: { minHeight: CIBLE_TACTILE, justifyContent: "center" },
  retourTexte: { fontSize: textes.corps, color: couleurs.vertFonce, fontWeight: "600" },

  zoneMicro: { alignItems: "center", gap: espaces.md, paddingVertical: espaces.xl },
  micro: {
    width: 176,
    height: 176,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.vertFonce,
    alignItems: "center",
    justifyContent: "center",
  },
  microActif: { backgroundColor: couleurs.rouge },
  microEmoji: { fontSize: 68, color: couleurs.blanc },

  onde: { flexDirection: "row", gap: espaces.sm, height: 18, alignItems: "center" },
  point: {
    width: 14,
    height: 14,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.ligne,
  },
  pointActif: { backgroundColor: couleurs.vertFonce, width: 18, height: 18 },

  chrono: {
    fontSize: 42,
    lineHeight: 50,
    fontWeight: "700",
    color: couleurs.encre,
    fontVariant: ["tabular-nums"],
  },

  attente: { alignItems: "center", gap: espaces.md, paddingVertical: espaces.xxl },
  attenteTitre: { fontSize: textes.sousTitre, fontWeight: "700", color: couleurs.encre },

  carte: {
    marginTop: espaces.lg,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    gap: espaces.sm,
  },
  montant: {
    fontSize: 42,
    lineHeight: 50,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },
  description: { fontSize: textes.corps, lineHeight: 26, color: couleurs.encre },
  categorie: { fontSize: textes.petit, color: couleurs.attenue },
  cycles: { flexDirection: "row", flexWrap: "wrap", gap: espaces.sm },

  transcription: {
    backgroundColor: couleurs.blanc,
    borderRadius: rayons.md,
    padding: espaces.md,
    gap: espaces.xs,
    marginVertical: espaces.sm,
  },
  transcriptionLibelle: { fontSize: textes.petit, color: couleurs.attenue },
  transcriptionTexte: {
    fontSize: textes.corps,
    lineHeight: 26,
    color: couleurs.encre,
    fontStyle: "italic",
  },

  pied: { height: espaces.xxl },
});
