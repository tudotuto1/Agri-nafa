// =============================================================================
// Caméras de surveillance — liste et enregistrement.
//
// -----------------------------------------------------------------------------
// CE QUE CET ÉCRAN NE FAIT PAS
//
// Le matériel n'est pas déployé. Aucune caméra n'existe, aucun cliché n'arrive,
// et la détection de maladies par IA n'analyse rien du tout aujourd'hui. Cet
// écran permet de déclarer un boîtier et de le rattacher à une parcelle ; il ne
// prétend à rien de plus.
//
// C'est délibéré. Une interface qui laisse croire qu'une surveillance tourne
// est pire qu'une interface absente : le producteur cesse d'aller voir ses
// plants, en confiance, et découvre le mildiou trois semaines trop tard. Un
// écran vide qui dit ce qui viendra ne coûte rien ; une fausse promesse coûte
// une récolte.
// -----------------------------------------------------------------------------
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { ajouter } from "@/lib/file-attente";
import { dateRelative } from "@/lib/format";
import { positionValide } from "@/lib/geo";
import {
  INTERVALLES,
  INTERVALLE_DEFAUT,
  STATUTS,
  couleurStatut,
  iconeBatterie,
  libelleStatut,
  texteBatterie,
  type Camera,
  type StatutCamera,
} from "@/lib/surveillance";
import { supabase } from "@/lib/supabase";

type Parcelle = {
  id: string;
  nom: string;
  centre_lat: number | string | null;
  centre_lng: number | string | null;
};

const CHAMPS =
  "id, nom, parcelle_id, identifiant_materiel, latitude, longitude, intervalle_minutes, niveau_batterie, derniere_capture_at, statut";

// =============================================================================
export default function EcranCameras() {
  const router = useRouter();
  const { session } = useAuth();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [materiel, setMateriel] = useState("");
  const [parcelleId, setParcelleId] = useState<string | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [intervalle, setIntervalle] = useState<number>(INTERVALLE_DEFAUT);
  const [statut, setStatut] = useState<StatutCamera>("active");
  const [envoi, setEnvoi] = useState(false);

  // ---------------------------------------------------------------------------
  const charger = useCallback(async () => {
    const [resCameras, resParcelles] = await Promise.all([
      supabase.from("cameras").select(CHAMPS).order("nom", { ascending: true }),
      supabase
        .from("parcelles")
        .select("id, nom, centre_lat, centre_lng")
        .is("deleted_at", null)
        .order("nom", { ascending: true }),
    ]);

    if (resCameras.error) {
      setErreur("Impossible de charger vos caméras. Réessayez.");
      return;
    }
    setErreur(null);
    setCameras((resCameras.data ?? []) as Camera[]);
    setParcelles((resParcelles.data ?? []) as Parcelle[]);
  }, []);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  useEffect(() => {
    if (!confirmation) return;
    const t = setTimeout(() => setConfirmation(null), 6000);
    return () => clearTimeout(t);
  }, [confirmation]);

  const nomsParcelles = useMemo(
    () => new Map(parcelles.map((p) => [p.id, p.nom])),
    [parcelles],
  );

  const parcelleChoisie = useMemo(
    () => parcelles.find((p) => p.id === parcelleId) ?? null,
    [parcelles, parcelleId],
  );

  /** Le centre n'est proposé que si la parcelle en a un d'exploitable. */
  const centreParcelle = useMemo(
    () =>
      parcelleChoisie
        ? positionValide(parcelleChoisie.centre_lat, parcelleChoisie.centre_lng)
        : null,
    [parcelleChoisie],
  );

  // ---------------------------------------------------------------------------
  function reinitialiser() {
    setNom("");
    setMateriel("");
    setParcelleId(null);
    setLatitude("");
    setLongitude("");
    setIntervalle(INTERVALLE_DEFAUT);
    setStatut("active");
  }

  const position = positionValide(
    latitude.replace(",", ".") || null,
    longitude.replace(",", ".") || null,
  );
  const positionIncomplete =
    (latitude.trim().length > 0 || longitude.trim().length > 0) && position === null;
  const pret = nom.trim().length >= 2 && !positionIncomplete && !envoi;

  const enregistrer = useCallback(async () => {
    if (!pret || !session?.user) return;

    setEnvoi(true);
    setErreur(null);

    const { enFile, erreur: refus } = await ajouter("cameras", {
      user_id: session.user.id,
      nom: nom.trim(),
      // Chaîne vide → null : `identifiant_materiel` est unique, et deux caméras
      // sans numéro renseigné se heurteraient sur la chaîne vide.
      identifiant_materiel: materiel.trim() || null,
      parcelle_id: parcelleId,
      latitude: position?.lat ?? null,
      longitude: position?.lng ?? null,
      intervalle_minutes: intervalle,
      statut,
    });

    setEnvoi(false);
    if (refus) {
      setErreur(messageErreurLisible(refus, "cette caméra"));
      return;
    }

    setConfirmation(
      enFile
        ? `${nom.trim()} est gardée sur le téléphone. Elle apparaîtra au retour du réseau.`
        : `${nom.trim()} enregistrée.`,
    );
    reinitialiser();
    setFormulaireOuvert(false);
    await charger();
  }, [pret, session, nom, materiel, parcelleId, position, intervalle, statut, charger]);

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Caméras</Titre>
        <Squelette hauteur={120} />
        <Squelette hauteur={120} />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Titre>Caméras</Titre>

      <Succes message={confirmation} />
      <Erreur message={erreur} />

      {!formulaireOuvert ? (
        <Bouton
          titre="Comment installer une caméra"
          variante="contour"
          onPress={() => router.push("/(app)/camera-installation")}
        />
      ) : null}

      {cameras.length === 0 && !formulaireOuvert ? (
        <View style={styles.vide}>
          <Text style={styles.videEmoji}>📷</Text>
          <Text style={styles.videTitre}>Aucune caméra</Text>
          <Text style={styles.videTexte}>
            Ces caméras solaires 4G se posent au champ et envoient une photo à
            intervalle régulier ; la surveillance automatique des maladies
            arrivera quand le matériel sera déployé.
          </Text>
          <Text style={styles.videNote}>
            Vous pouvez déjà déclarer un boîtier pour préparer son installation.
          </Text>
        </View>
      ) : null}

      {cameras.length > 0 ? (
        <View style={styles.liste}>
          {cameras.map((camera) => (
            <LigneCamera
              key={camera.id}
              camera={camera}
              parcelle={
                camera.parcelle_id ? nomsParcelles.get(camera.parcelle_id) : undefined
              }
              onPress={() =>
                router.push({
                  pathname: "/(app)/camera/[id]",
                  params: { id: camera.id },
                })
              }
            />
          ))}
        </View>
      ) : null}

      {/* --------------------------------------------------------------- */}
      {formulaireOuvert ? (
        <View style={styles.formulaire}>
          <SousTitre>Nouvelle caméra</SousTitre>

          <Champ
            libelle="Nom de la caméra"
            value={nom}
            onChangeText={setNom}
            placeholder="Caméra du bas-fond"
            autoCapitalize="sentences"
          />

          <Champ
            libelle="Identifiant du matériel"
            value={materiel}
            onChangeText={setMateriel}
            placeholder="Numéro inscrit sous le boîtier"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Aide>
            Le numéro de série du boîtier. Il identifie la caméra auprès du
            serveur : un même numéro ne peut être déclaré qu'une fois.
          </Aide>

          {parcelles.length > 0 ? (
            <>
              <Text style={styles.libelle}>Parcelle surveillée</Text>
              <View style={styles.pilules}>
                <Pilule
                  libelle="Aucune"
                  selectionnee={parcelleId === null}
                  onPress={() => setParcelleId(null)}
                />
                {parcelles.map((p) => (
                  <Pilule
                    key={p.id}
                    libelle={p.nom}
                    selectionnee={parcelleId === p.id}
                    onPress={() => setParcelleId(p.id)}
                  />
                ))}
              </View>
            </>
          ) : (
            <Aide>
              Aucune parcelle enregistrée. Vous pourrez rattacher cette caméra à
              une parcelle plus tard.
            </Aide>
          )}

          <Text style={styles.libelle}>Position</Text>
          {centreParcelle ? (
            <Bouton
              titre="Utiliser le centre de la parcelle"
              variante="contour"
              onPress={() => {
                setLatitude(String(centreParcelle.lat));
                setLongitude(String(centreParcelle.lng));
              }}
            />
          ) : parcelleChoisie ? (
            <Aide>
              Cette parcelle n'a pas de tracé, donc pas de centre connu. Saisissez
              la position à la main, ou laissez vide.
            </Aide>
          ) : null}

          <View style={styles.ligneChamps}>
            <View style={styles.demi}>
              <Champ
                libelle="Latitude"
                value={latitude}
                onChangeText={setLatitude}
                placeholder="12,3714"
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
              />
            </View>
            <View style={styles.demi}>
              <Champ
                libelle="Longitude"
                value={longitude}
                onChangeText={setLongitude}
                placeholder="-1,5197"
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
              />
            </View>
          </View>
          {positionIncomplete ? (
            <Erreur message="Renseignez la latitude ET la longitude, ou laissez les deux vides." />
          ) : null}

          <Text style={styles.libelle}>Une photo toutes les…</Text>
          <View style={styles.pilules}>
            {INTERVALLES.map((minutes) => (
              <Pilule
                key={minutes}
                libelle={`${minutes} min`}
                selectionnee={intervalle === minutes}
                onPress={() => setIntervalle(minutes)}
              />
            ))}
          </View>
          <Aide>
            Plus la cadence est rapide, plus la batterie et le forfait 4G
            s'épuisent vite.
          </Aide>

          <Text style={styles.libelle}>État</Text>
          <View style={styles.pilules}>
            {STATUTS.map((s) => (
              <Pilule
                key={s.valeur}
                libelle={s.libelle}
                selectionnee={statut === s.valeur}
                onPress={() => setStatut(s.valeur)}
              />
            ))}
          </View>

          <View style={styles.pied}>
            <Bouton
              titre="Enregistrer la caméra"
              onPress={enregistrer}
              desactive={!pret}
              chargement={envoi}
            />
            <Bouton
              titre="Annuler"
              variante="contour"
              onPress={() => {
                reinitialiser();
                setErreur(null);
                setFormulaireOuvert(false);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.pied}>
          <Bouton
            titre="Déclarer une caméra"
            onPress={() => setFormulaireOuvert(true)}
          />
          <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
        </View>
      )}
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function LigneCamera({
  camera,
  parcelle,
  onPress,
}: {
  camera: Camera;
  parcelle?: string;
  onPress: () => void;
}) {
  const faible =
    typeof camera.niveau_batterie === "number" && camera.niveau_batterie < 20;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la caméra ${camera.nom}`}
      onPress={onPress}
      style={({ pressed }) => [styles.carte, pressed && styles.presse]}
    >
      <View style={styles.carteEntete}>
        <Text style={styles.carteEmoji}>📷</Text>
        <View style={styles.carteTextes}>
          <Text style={styles.carteNom}>{camera.nom}</Text>
          <Text style={styles.carteParcelle}>
            {parcelle ?? "Aucune parcelle rattachée"}
          </Text>
        </View>
        <View
          style={[styles.badgeStatut, { borderColor: couleurStatut(camera.statut) }]}
        >
          <Text style={[styles.badgeTexte, { color: couleurStatut(camera.statut) }]}>
            {libelleStatut(camera.statut)}
          </Text>
        </View>
      </View>

      <View style={styles.carteBas}>
        <Text style={[styles.info, faible && styles.infoAlerte]}>
          {iconeBatterie(camera.niveau_batterie)}{" "}
          {texteBatterie(camera.niveau_batterie)}
        </Text>
        <Text style={styles.info}>
          {camera.derniere_capture_at
            ? `Dernière photo ${dateRelative(camera.derniere_capture_at)}`
            : "Aucune photo reçue"}
        </Text>
      </View>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  liste: { gap: espaces.sm },
  pied: { marginTop: espaces.md, gap: espaces.sm },
  presse: { opacity: 0.85 },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: espaces.sm },
  ligneChamps: { flexDirection: "row", gap: espaces.sm },
  demi: { flex: 1 },
  libelle: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },

  formulaire: {
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderColor: couleurs.vert,
  },

  carte: {
    gap: espaces.sm,
    minHeight: CIBLE_TACTILE,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  carteEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  carteEmoji: { fontSize: 30 },
  carteTextes: { flex: 1, gap: 2 },
  carteNom: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  carteParcelle: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  badgeStatut: {
    paddingHorizontal: espaces.sm,
    paddingVertical: 4,
    borderRadius: rayons.rond,
    borderWidth: 2,
  },
  badgeTexte: {
    fontSize: textes.petit,
    fontWeight: "700",
  },
  carteBas: {
    gap: 2,
    paddingTop: espaces.sm,
    borderTopWidth: 2,
    borderTopColor: couleurs.ligne,
  },
  info: {
    fontSize: textes.petit,
    color: couleurs.encre,
  },
  infoAlerte: {
    color: couleurs.rouge,
    fontWeight: "700",
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
  videNote: {
    fontSize: textes.petit,
    fontStyle: "italic",
    color: couleurs.attenue,
    textAlign: "center",
  },
});
