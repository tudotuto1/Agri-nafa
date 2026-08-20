// =============================================================================
// Parcelles — liste et création.
//
// Le tracé sur carte est proposé, jamais imposé : `geometrie` accepte NULL, et
// un producteur qui connaît sa surface n'a aucune raison de dessiner un
// polygone pour la saisir. Ce qui compte en aval — la rentabilité à l'hectare,
// les doses des guides — se calcule sur `superficie_ha`, pas sur le dessin.
//
// Quand le tracé existe, il pré-remplit la superficie sans la verrouiller. Un
// contour posé au doigt sur un écran de six pouces vaut ce qu'il vaut ; le
// producteur, lui, connaît sa parcelle.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Carte } from "@/components/carte";
import {
  Aide,
  Bouton,
  Champ,
  Ecran,
  Erreur,
  EtatVide,
  Squelette,
  Succes,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { VIDES } from "@/components/illustrations-vides";
import { useAuth } from "@/lib/auth";
import { messageErreurLisible } from "@/lib/erreurs";
import { ajouter } from "@/lib/file-attente";
import {
  OUAGADOUGOU,
  SOMMETS_MINIMUM,
  centre,
  depuisGeoJson,
  formaterSuperficie,
  positionValide,
  surfaceHa,
  versGeoJson,
  type Position,
} from "@/lib/geo";
import { supabase } from "@/lib/supabase";

type Parcelle = {
  id: string;
  nom: string;
  superficie_ha: number | string | null;
  type_sol: string | null;
  irriguee: boolean;
  geometrie: unknown;
};

const CHAMPS = "id, nom, superficie_ha, type_sol, irriguee, geometrie";

/** Vue courante. Le tracé prend tout l'écran, donc il remplace le reste. */
type Vue = "liste" | "formulaire" | "trace";

// =============================================================================
export default function EcranParcelles() {
  const router = useRouter();
  const { session } = useAuth();

  const [vue, setVue] = useState<Vue>("liste");

  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  /** Position du profil : centre d'ouverture de la carte. */
  const [depart, setDepart] = useState<Position>(OUAGADOUGOU);

  // Formulaire
  const [nom, setNom] = useState("");
  const [superficie, setSuperficie] = useState("");
  const [typeSol, setTypeSol] = useState("");
  const [irriguee, setIrriguee] = useState(false);
  const [sommets, setSommets] = useState<Position[]>([]);
  const [envoi, setEnvoi] = useState(false);
  /** Dernière valeur posée par un tracé : sert à ne pas écraser une saisie. */
  const [superficieDuTrace, setSuperficieDuTrace] = useState("");

  // ---------------------------------------------------------------------------
  const charger = useCallback(async () => {
    const [resParcelles, resProfil] = await Promise.all([
      supabase
        .from("parcelles")
        .select(CHAMPS)
        .is("deleted_at", null)
        .order("nom", { ascending: true }),
      // Le profil ne sert qu'à centrer la carte : son échec n'est pas une
      // erreur d'écran, on retombe simplement sur Ouagadougou.
      supabase.from("profils").select("latitude, longitude").maybeSingle(),
    ]);

    if (resParcelles.error) {
      setErreur("Impossible de charger vos parcelles. Réessayez.");
      return;
    }

    setErreur(null);
    setParcelles((resParcelles.data ?? []) as Parcelle[]);

    const position = positionValide(
      resProfil.data?.latitude,
      resProfil.data?.longitude,
    );
    if (position) setDepart(position);
  }, []);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  useEffect(() => {
    if (!confirmation) return;
    const t = setTimeout(() => setConfirmation(null), 6000);
    return () => clearTimeout(t);
  }, [confirmation]);

  // ---------------------------------------------------------------------------
  // Tracé
  // ---------------------------------------------------------------------------
  const surfaceTracee = useMemo(() => surfaceHa(sommets), [sommets]);

  const ajouterSommet = useCallback((position: Position) => {
    setSommets((precedents) => [...precedents, position]);
  }, []);

  const annulerDernier = useCallback(() => {
    setSommets((precedents) => precedents.slice(0, -1));
  }, []);

  const terminerTrace = useCallback(() => {
    // Le tracé pré-remplit la superficie, il ne la confisque pas. Un chiffre
    // tapé à la main est le seul que le producteur ait vraiment voulu : on ne
    // l'écrase que s'il est vide, ou s'il vient lui-même d'un tracé précédent.
    if (surfaceTracee > 0) {
      const valeur = surfaceTracee.toString().replace(".", ",");
      setSuperficie((actuelle) =>
        actuelle.trim() === "" || actuelle === superficieDuTrace ? valeur : actuelle,
      );
      setSuperficieDuTrace(valeur);
    }
    setVue("formulaire");
  }, [surfaceTracee, superficieDuTrace]);

  // ---------------------------------------------------------------------------
  // Enregistrement
  // ---------------------------------------------------------------------------
  function reinitialiser() {
    setNom("");
    setSuperficie("");
    setTypeSol("");
    setIrriguee(false);
    setSommets([]);
    setSuperficieDuTrace("");
  }

  const superficieSaisie = Number(superficie.replace(",", "."));
  const superficieValide =
    superficie.trim().length > 0 &&
    Number.isFinite(superficieSaisie) &&
    superficieSaisie > 0;
  const pret = nom.trim().length >= 2 && superficieValide && !envoi;

  const enregistrer = useCallback(async () => {
    if (!pret || !session?.user) return;

    setEnvoi(true);
    setErreur(null);

    const geometrie = versGeoJson(sommets);
    const centreTrace = geometrie ? centre(sommets) : null;

    const { enFile, erreur: refus } = await ajouter("parcelles", {
      // Jamais un champ de formulaire : l'identité vient de la session.
      user_id: session.user.id,
      nom: nom.trim(),
      // Arrondi au centième comme la colonne numeric(8, 2), pour que la valeur
      // relue soit exactement celle qui a été envoyée.
      superficie_ha: Math.round(superficieSaisie * 100) / 100,
      geometrie,
      centre_lat: centreTrace?.lat ?? null,
      centre_lng: centreTrace?.lng ?? null,
      type_sol: typeSol.trim() || null,
      irriguee,
    });

    setEnvoi(false);
    if (refus) {
      setErreur(messageErreurLisible(refus, "cette parcelle"));
      return;
    }

    setConfirmation(
      enFile
        ? `${nom.trim()} est gardée sur le téléphone. Elle apparaîtra dans la liste au retour du réseau.`
        : `${nom.trim()} ajoutée à vos parcelles.`,
    );
    reinitialiser();
    setVue("liste");
    await charger();
  }, [pret, session, nom, superficieSaisie, sommets, typeSol, irriguee, charger]);

  // ---------------------------------------------------------------------------
  // Écran de tracé — plein écran, la carte est l'outil
  // ---------------------------------------------------------------------------
  if (vue === "trace") {
    return (
      <SafeAreaView style={styles.plein} edges={["top", "bottom"]}>
        <View style={styles.enteteTrace}>
          <Text style={styles.consigne}>
            {sommets.length === 0
              ? "Appuyez sur chaque coin de votre parcelle."
              : sommets.length < SOMMETS_MINIMUM
                ? `${sommets.length} coin${sommets.length > 1 ? "s" : ""} posé${sommets.length > 1 ? "s" : ""} — il en faut au moins ${SOMMETS_MINIMUM}.`
                : `${sommets.length} coins · ${formaterSuperficie(surfaceTracee)}`}
          </Text>
        </View>

        <Carte
          mode="dessin"
          sommets={sommets}
          centreDefaut={depart}
          onSommetAjoute={ajouterSommet}
          style={styles.carteTrace}
        />

        <View style={styles.piedTrace}>
          <View style={styles.ligneBoutons}>
            <Bouton
              titre="Annuler le dernier point"
              variante="contour"
              desactive={sommets.length === 0}
              onPress={annulerDernier}
              style={styles.boutonMoitie}
            />
            <Bouton
              titre="Terminer"
              desactive={sommets.length > 0 && sommets.length < SOMMETS_MINIMUM}
              onPress={terminerTrace}
              style={styles.boutonMoitie}
            />
          </View>
          <Bouton
            titre="Revenir sans tracer"
            variante="contour"
            onPress={() => {
              setSommets([]);
              setVue("formulaire");
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Formulaire
  // ---------------------------------------------------------------------------
  if (vue === "formulaire") {
    return (
      <Ecran>
        <Titre>Nouvelle parcelle</Titre>

        <Erreur message={erreur} />

        <Champ
          libelle="Nom de la parcelle"
          value={nom}
          onChangeText={setNom}
          placeholder="Le champ du bas-fond"
          autoCapitalize="sentences"
        />

        <View style={styles.blocTrace}>
          {sommets.length >= SOMMETS_MINIMUM ? (
            <>
              <Text style={styles.traceResume}>
                Tracé enregistré : {sommets.length} coins, {formaterSuperficie(surfaceTracee)}.
              </Text>
              <View style={styles.ligneBoutons}>
                <Bouton
                  titre="Modifier le tracé"
                  variante="contour"
                  onPress={() => setVue("trace")}
                  style={styles.boutonMoitie}
                />
                <Bouton
                  titre="Retirer le tracé"
                  variante="contour"
                  onPress={() => setSommets([])}
                  style={styles.boutonMoitie}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.traceResume}>
                Vous pouvez dessiner le contour sur une carte : la superficie sera
                calculée toute seule.
              </Text>
              <Bouton
                titre="Tracer sur la carte"
                variante="contour"
                onPress={() => setVue("trace")}
              />
            </>
          )}
        </View>

        <Champ
          libelle="Superficie (hectares)"
          value={superficie}
          onChangeText={setSuperficie}
          placeholder="0,50"
          keyboardType="decimal-pad"
          inputMode="decimal"
        />
        <Aide>
          Un tracé au doigt reste approximatif. Si vous connaissez la vraie
          surface de votre parcelle, corrigez ce chiffre : c'est lui qui sert
          aux doses d'engrais et au calcul de rentabilité.
        </Aide>

        <Champ
          libelle="Type de sol"
          value={typeSol}
          onChangeText={setTypeSol}
          placeholder="Argileux, sablonneux, bas-fond…"
          autoCapitalize="sentences"
        />

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: irriguee }}
          onPress={() => setIrriguee((v) => !v)}
          style={styles.ligneInterrupteur}
        >
          <View style={styles.interrupteurTextes}>
            <Text style={styles.interrupteurLibelle}>Parcelle irriguée</Text>
            <Text style={styles.interrupteurAide}>
              Forage, motopompe, puits maraîcher ou canal.
            </Text>
          </View>
          <Switch
            value={irriguee}
            onValueChange={setIrriguee}
            trackColor={{ false: couleurs.ligne, true: couleurs.vert }}
            thumbColor={couleurs.blanc}
          />
        </Pressable>

        <View style={styles.pied}>
          <Bouton
            titre="Enregistrer la parcelle"
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
              setVue("liste");
            }}
          />
        </View>
      </Ecran>
    );
  }

  // ---------------------------------------------------------------------------
  // Liste
  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Mes parcelles</Titre>
        <Squelette hauteur={96} />
        <Squelette hauteur={96} />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Titre>Mes parcelles</Titre>

      <Succes message={confirmation} />
      <Erreur message={erreur} />

      {parcelles.length === 0 ? (
        <EtatVide
          illustration={VIDES.aucune_parcelle}
          titre="Aucune parcelle enregistrée"
          texte="Décrivez vos parcelles une fois : vous pourrez ensuite y rattacher vos cycles de production et suivre la rentabilité champ par champ."
        />
      ) : (
        <>
          <Aide>
            Appuyez sur une parcelle pour voir son tracé et le cycle qui s'y
            trouve.
          </Aide>
          <View style={styles.liste}>
            {parcelles.map((parcelle) => (
              <LigneParcelle
                key={parcelle.id}
                parcelle={parcelle}
                onPress={() =>
                  router.push({
                    pathname: "/(app)/parcelle/[id]",
                    params: { id: parcelle.id },
                  })
                }
              />
            ))}
          </View>
        </>
      )}

      <View style={styles.pied}>
        <Bouton titre="Ajouter une parcelle" onPress={() => setVue("formulaire")} />
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function LigneParcelle({
  parcelle,
  onPress,
}: {
  parcelle: Parcelle;
  onPress: () => void;
}) {
  const tracee = depuisGeoJson(parcelle.geometrie).length >= SOMMETS_MINIMUM;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la parcelle ${parcelle.nom}`}
      onPress={onPress}
      style={({ pressed }) => [styles.carte, pressed && styles.presse]}
    >
      <Text style={styles.carteEmoji}>{parcelle.irriguee ? "💧" : "🌾"}</Text>
      <View style={styles.carteTextes}>
        <Text style={styles.carteNom}>{parcelle.nom}</Text>
        <Text style={styles.carteDetail}>
          {formaterSuperficie(parcelle.superficie_ha)}
          {parcelle.type_sol ? ` · ${parcelle.type_sol}` : ""}
        </Text>
        <Text style={styles.carteEtatTrace}>
          {tracee ? "Tracé sur la carte" : "Sans tracé"}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  liste: { gap: espaces.sm },
  pied: { marginTop: espaces.lg, gap: espaces.sm },
  presse: { opacity: 0.85 },
  ligneBoutons: { flexDirection: "row", gap: espaces.sm },
  boutonMoitie: { flex: 1 },

  // --- Tracé plein écran
  plein: { flex: 1, backgroundColor: couleurs.papier },
  enteteTrace: {
    paddingHorizontal: espaces.md,
    paddingVertical: espaces.sm,
  },
  consigne: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
    textAlign: "center",
  },
  carteTrace: {
    flex: 1,
    marginHorizontal: espaces.md,
  },
  piedTrace: {
    gap: espaces.sm,
    padding: espaces.md,
  },

  // --- Formulaire
  blocTrace: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  traceResume: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },
  ligneInterrupteur: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    minHeight: CIBLE_TACTILE,
    paddingHorizontal: espaces.md,
    paddingVertical: espaces.sm,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  interrupteurTextes: { flex: 1, gap: 2 },
  interrupteurLibelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.encre,
  },
  interrupteurAide: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },

  // --- Liste
  carte: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    minHeight: CIBLE_TACTILE,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  carteEmoji: { fontSize: 32 },
  carteTextes: { flex: 1, gap: 2 },
  carteNom: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  carteDetail: {
    fontSize: textes.petit,
    color: couleurs.encre,
  },
  carteEtatTrace: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  chevron: {
    fontSize: 28,
    color: couleurs.vertFonce,
  },

});
