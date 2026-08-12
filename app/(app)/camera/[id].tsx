// =============================================================================
// Fiche d'une caméra : ses réglages, et l'historique de ses clichés.
//
// -----------------------------------------------------------------------------
// L'ANALYSE PAR IA N'EXISTE PAS ENCORE
//
// La table `captures` porte `diagnostic`, `score_risque` et `fournisseur_ia`,
// et un trigger sait déjà lever une alerte au-delà de 80 % de risque. Mais rien
// n'alimente ces colonnes : aucun modèle ne tourne, aucun boîtier n'envoie de
// photo.
//
// Cet écran le dit. Un cadre vide à l'endroit du diagnostic ressemble à une
// panne — le producteur croit que l'analyse a échoué sur SA plante, et il
// attend un verdict qui ne viendra jamais. La mention « analyse à venir » coûte
// une ligne et lève l'ambiguïté.
// -----------------------------------------------------------------------------
//
// Le bucket `captures` est privé : les vignettes passent par des URL signées,
// demandées en un seul appel pour toute la grille.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Aide,
  Bouton,
  Ecran,
  Erreur,
  SousTitre,
  Squelette,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { dateRelative, horodatageEnFrancais } from "@/lib/format";
import { positionValide } from "@/lib/geo";
import {
  couleurRisque,
  couleurStatut,
  iconeBatterie,
  libelleAnalyse,
  libelleStatut,
  scorePourcent,
  texteBatterie,
  type Camera,
  type Capture,
} from "@/lib/surveillance";
import { supabase } from "@/lib/supabase";

const CHAMPS_CAMERA =
  "id, nom, parcelle_id, identifiant_materiel, latitude, longitude, intervalle_minutes, niveau_batterie, derniere_capture_at, statut";
const CHAMPS_CAPTURE =
  "id, storage_path, captured_at, analyse_statut, diagnostic, score_risque, fournisseur_ia, analysee_at";

/** Une heure : bien au-delà du temps passé sur une grille de vignettes. */
const DUREE_SIGNATURE = 3600;

/** Les plus récents d'abord, et pas plus qu'un écran ne peut en montrer. */
const CLICHES_MAX = 60;

// =============================================================================
export default function EcranCamera() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [camera, setCamera] = useState<Camera | null>(null);
  const [parcelle, setParcelle] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [vignettes, setVignettes] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  const charger = useCallback(async () => {
    if (!id) return;

    const [resCamera, resCaptures] = await Promise.all([
      supabase.from("cameras").select(CHAMPS_CAMERA).eq("id", id).maybeSingle(),
      supabase
        .from("captures")
        .select(CHAMPS_CAPTURE)
        .eq("camera_id", id)
        .order("captured_at", { ascending: false })
        .limit(CLICHES_MAX),
    ]);

    if (resCamera.error || resCaptures.error) {
      setErreur("Impossible de charger cette caméra. Réessayez.");
      return;
    }

    setErreur(null);
    const cam = (resCamera.data ?? null) as Camera | null;
    setCamera(cam);

    const liste = (resCaptures.data ?? []) as Capture[];
    setCaptures(liste);

    if (cam?.parcelle_id) {
      const { data } = await supabase
        .from("parcelles")
        .select("nom")
        .eq("id", cam.parcelle_id)
        .maybeSingle();
      setParcelle((data?.nom as string | undefined) ?? null);
    } else {
      setParcelle(null);
    }

    // Bucket privé : une URL signée par cliché, demandées en un seul appel.
    // Un aller-retour par vignette rendrait la grille inutilisable sur 2G.
    if (liste.length > 0) {
      const { data: signees } = await supabase.storage
        .from("captures")
        .createSignedUrls(
          liste.map((c) => c.storage_path),
          DUREE_SIGNATURE,
        );

      const table: Record<string, string> = {};
      for (const item of signees ?? []) {
        // `path` peut être null quand l'objet manque au bucket : la ligne existe
        // en base mais le fichier a disparu. On laisse la vignette vide plutôt
        // que d'insérer une URL nulle qui ferait planter <Image>.
        if (item.signedUrl && item.path) table[item.path] = item.signedUrl;
      }
      setVignettes(table);
    }
  }, [id]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  const position = useMemo(
    () => positionValide(camera?.latitude, camera?.longitude),
    [camera?.latitude, camera?.longitude],
  );

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Squelette hauteur={36} largeur="70%" />
        <Squelette hauteur={160} />
        <Squelette hauteur={120} />
      </Ecran>
    );
  }

  if (!camera) {
    return (
      <Ecran>
        <Titre>Caméra introuvable</Titre>
        <Aide>
          Cette caméra a peut-être été retirée, ou elle n'est pas encore partie
          du téléphone. Si vous venez de la déclarer sans réseau, elle
          apparaîtra dès que la connexion revient.
        </Aide>
        <Erreur message={erreur} />
        <View style={styles.pied}>
          <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Titre>{camera.nom}</Titre>

      <Erreur message={erreur} />

      <View style={styles.fiche}>
        <Ligne
          libelle="État"
          valeur={libelleStatut(camera.statut)}
          couleur={couleurStatut(camera.statut)}
        />
        <Ligne libelle="Parcelle" valeur={parcelle ?? "Aucune parcelle rattachée"} />
        <Ligne
          libelle="Batterie"
          valeur={`${iconeBatterie(camera.niveau_batterie)} ${texteBatterie(camera.niveau_batterie)}`}
          couleur={
            typeof camera.niveau_batterie === "number" && camera.niveau_batterie < 20
              ? couleurs.rouge
              : undefined
          }
        />
        <Ligne
          libelle="Cadence"
          valeur={`Une photo toutes les ${camera.intervalle_minutes} min`}
        />
        <Ligne
          libelle="Identifiant"
          valeur={camera.identifiant_materiel ?? "Non renseigné"}
        />
        <Ligne
          libelle="Position"
          valeur={
            position
              ? `${position.lat.toFixed(5)} · ${position.lng.toFixed(5)}`
              : "Non renseignée"
          }
        />
        <Ligne
          libelle="Dernière photo"
          valeur={
            camera.derniere_capture_at
              ? dateRelative(camera.derniere_capture_at)
              : "Aucune photo reçue"
          }
        />
      </View>

      {/* ------------------------------------------------------------------- */}
      <SousTitre>Photos</SousTitre>

      {captures.length === 0 ? (
        <View style={styles.vide}>
          <Text style={styles.videEmoji}>🖼️</Text>
          <Text style={styles.videTitre}>
            Cette caméra n'a pas encore envoyé de photo.
          </Text>
          <Text style={styles.videTexte}>
            Une fois le boîtier posé et alimenté, les clichés arriveront ici
            automatiquement, à la cadence réglée plus haut.
          </Text>
        </View>
      ) : (
        <View style={styles.grille}>
          {captures.map((capture) => (
            <Vignette
              key={capture.id}
              capture={capture}
              url={vignettes[capture.storage_path]}
            />
          ))}
        </View>
      )}

      {/* Dit une fois, en bas, plutôt que répété sur chaque vignette. */}
      <View style={styles.aVenir}>
        <Text style={styles.aVenirTitre}>🔬 Analyse automatique — à venir</Text>
        <Text style={styles.aVenirTexte}>
          La détection des maladies sur les photos n'est pas encore en service.
          Aucun cliché n'est analysé aujourd'hui : continuez à surveiller vos
          plants vous-même. Le diagnostic apparaîtra sous chaque photo le jour
          où la fonction sera activée.
        </Text>
      </View>

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function Vignette({ capture, url }: { capture: Capture; url?: string }) {
  const pourcent = scorePourcent(capture.score_risque);
  const analysee = capture.analyse_statut === "analysee" && capture.diagnostic !== null;

  return (
    <View style={styles.vignette}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={`Photo du ${horodatageEnFrancais(capture.captured_at)}`}
        />
      ) : (
        <View style={[styles.image, styles.imageAbsente]}>
          <Text style={styles.imageAbsenteTexte}>Image indisponible</Text>
        </View>
      )}

      <View style={styles.vignetteBas}>
        <Text style={styles.vignetteDate}>
          {horodatageEnFrancais(capture.captured_at)}
        </Text>
        <Text style={styles.vignetteRelative}>{dateRelative(capture.captured_at)}</Text>

        {analysee ? (
          <>
            <Text style={styles.diagnostic}>{capture.diagnostic}</Text>
            {pourcent !== null ? (
              <Text style={[styles.risque, { color: couleurRisque(pourcent) }]}>
                Risque {pourcent} %
              </Text>
            ) : null}
            {capture.fournisseur_ia ? (
              <Text style={styles.fournisseur}>Analyse : {capture.fournisseur_ia}</Text>
            ) : null}
          </>
        ) : (
          // Pas un espace vide : le producteur doit savoir que rien n'a été
          // examiné, plutôt que de croire à un verdict rassurant.
          <Text style={styles.nonAnalysee}>{libelleAnalyse(capture.analyse_statut)}</Text>
        )}
      </View>
    </View>
  );
}

function Ligne({
  libelle,
  valeur,
  couleur,
}: {
  libelle: string;
  valeur: string;
  couleur?: string;
}) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneLibelle}>{libelle}</Text>
      <Text style={[styles.ligneValeur, couleur ? { color: couleur } : null]}>
        {valeur}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  pied: { marginTop: espaces.lg },

  fiche: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
  },
  ligneLibelle: {
    width: 120,
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  ligneValeur: {
    flex: 1,
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },

  grille: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: espaces.sm,
  },
  vignette: {
    // Deux colonnes : (100 % − un interstice) / 2
    width: "48%",
    flexGrow: 1,
    borderRadius: rayons.md,
    overflow: "hidden",
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  image: {
    width: "100%",
    height: 130,
    backgroundColor: couleurs.ligne,
  },
  imageAbsente: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageAbsenteTexte: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  vignetteBas: {
    gap: 2,
    padding: espaces.sm,
  },
  vignetteDate: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },
  vignetteRelative: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  diagnostic: {
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },
  risque: {
    fontSize: textes.petit,
    fontWeight: "700",
  },
  fournisseur: {
    fontSize: textes.petit,
    fontStyle: "italic",
    color: couleurs.attenue,
  },
  nonAnalysee: {
    fontSize: textes.petit,
    fontStyle: "italic",
    color: couleurs.attenue,
  },

  aVenir: {
    gap: espaces.xs,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: couleurs.or,
  },
  aVenirTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  aVenirTexte: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },

  vide: {
    alignItems: "center",
    gap: espaces.sm,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: couleurs.ligne,
  },
  videEmoji: { fontSize: 44 },
  videTitre: {
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
    textAlign: "center",
  },
  videTexte: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.attenue,
    textAlign: "center",
  },
});
