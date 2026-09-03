// =============================================================================
// Planification inversée.
//
// La promesse centrale du projet, et jusqu'ici jamais montrée : le producteur
// part de QUAND IL VEUT VENDRE, l'application remonte le temps à sa place.
//
// Trois étapes, dans l'ordre où la décision se prend : ce qu'on produit, pour
// quand, et la date à laquelle il faut s'y mettre.
//
// -----------------------------------------------------------------------------
// LE CAS LE PLUS UTILE EST CELUI OÙ C'EST TROP TARD
//
// Un maraîcher qui apprend en mars qu'il ne peut plus viser la Tabaski a
// encore le temps de choisir autre chose. Un écran qui afficherait une date
// passée sans rien dire ne servirait à rien — pire, il laisserait croire que
// c'est jouable. Le refus est donc explicite, et toujours accompagné de deux
// issues : la première date encore atteignable avec cette spéculation, et les
// spéculations à cycle plus court qui tiennent encore dans le délai.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  Titre,
} from "@/components/ui";
import { IllustrationEspece, TAILLE_LISTE } from "@/components/illustration-espece";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import {
  affichageVersIso,
  aujourdhuiIso,
  dateEnFrancais,
  isoVersAffichage,
} from "@/lib/format";
import {
  EVENEMENTS,
  MARGES,
  MARGE_DEFAUT,
  delaiEnFrancais,
  joursEntre,
  premiereDatePossible,
  prochaineOccurrence,
  speculationsQuiTiennent,
  type SpeculationPlanifiable,
} from "@/lib/planification";
import { supabase } from "@/lib/supabase";
import { libelleModeConduite } from "@/lib/guides";
import {
  demandeUnChoix,
  itinerairesDe,
  useItinerairesParSpeculation,
} from "@/lib/modes-conduite";

export default function EcranPlanifier() {
  const router = useRouter();
  // Arrivée depuis un guide : la spéculation est déjà choisie.
  const { speculation_id: speculationParam } = useLocalSearchParams<{
    speculation_id?: string;
  }>();

  const [speculations, setSpeculations] = useState<SpeculationPlanifiable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [choixId, setChoixId] = useState<string | null>(speculationParam ?? null);
  const [evenement, setEvenement] = useState<string | null>(null);
  const [dateSaisie, setDateSaisie] = useState("");
  const [marge, setMarge] = useState(MARGE_DEFAUT);
  const [itineraireId, setItineraireId] = useState<string | null>(null);
  const { parSpeculation } = useItinerairesParSpeculation();

  const [miseEnPlace, setMiseEnPlace] = useState<string | null>(null);
  const [calcul, setCalcul] = useState(false);

  useEffect(() => {
    supabase
      .from("speculations")
      .select("id, code, nom, icone, duree_cycle_jours")
      .order("nom")
      .then(({ data, error }) => {
        if (error) setErreur("Impossible de charger la liste des productions.");
        else setSpeculations((data ?? []) as SpeculationPlanifiable[]);
        setChargement(false);
      });
  }, []);

  const choix = useMemo(
    () => speculations.find((s) => s.id === choixId) ?? null,
    [speculations, choixId],
  );

  const itineraires = itinerairesDe(parSpeculation, choixId);
  const modeARenseigner = demandeUnChoix(parSpeculation, choixId) && itineraireId === null;
  const itineraireChoisi = useMemo(
    () => itineraires.find((i) => i.itineraire_id === itineraireId) ?? null,
    [itineraires, itineraireId],
  );

  // Changer de production invalide le mode retenu. Un seul itinéraire est pris
  // d'office : il n'y a pas de choix à poser.
  const choisirSpeculation = useCallback(
    (id: string) => {
      setChoixId(id);
      const liste = itinerairesDe(parSpeculation, id);
      setItineraireId(liste.length === 1 ? liste[0].itineraire_id : null);
    },
    [parSpeculation],
  );

  const evenementChoisi = useMemo(
    () => EVENEMENTS.find((e) => e.code === evenement) ?? null,
    [evenement],
  );

  const dateIso = useMemo(() => affichageVersIso(dateSaisie), [dateSaisie]);
  const dateInvalide = dateSaisie.trim().length > 0 && dateIso === null;

  // Choisir un événement à date fixe propose sa prochaine occurrence ; une
  // fête lunaire ne propose rien et attend la saisie. Dans les deux cas la
  // date reste modifiable — c'est le producteur qui sait.
  const choisirEvenement = useCallback((code: string) => {
    setEvenement(code);
    const e = EVENEMENTS.find((x) => x.code === code);
    if (e?.dateFixe) {
      setDateSaisie(isoVersAffichage(prochaineOccurrence(e.dateFixe[0], e.dateFixe[1])));
    }
  }, []);

  const duree = choix?.duree_cycle_jours ?? null;
  const pret = choix !== null && dateIso !== null && duree !== null && !modeARenseigner;

  // La date de mise en place vient de la base, jamais d'un calcul local :
  // public.date_mise_en_place est la source de vérité, et deux soustractions
  // qui divergent d'un jour seraient impossibles à départager plus tard.
  useEffect(() => {
    if (!pret || !dateIso || duree === null) {
      setMiseEnPlace(null);
      return;
    }
    let vivant = true;
    setCalcul(true);
    supabase
      .rpc("date_mise_en_place", {
        date_cible_marche: dateIso,
        duree_cycle_jours: duree,
        marge_securite_jours: marge,
      })
      .then(({ data, error }) => {
        if (!vivant) return;
        if (error) {
          setErreur("Le calcul n'a pas abouti. Vérifiez votre connexion.");
          setMiseEnPlace(null);
        } else {
          setErreur(null);
          setMiseEnPlace(typeof data === "string" ? data : null);
        }
        setCalcul(false);
      });
    return () => {
      vivant = false;
    };
  }, [pret, dateIso, duree, marge]);

  const joursAvantMiseEnPlace = miseEnPlace ? joursEntre(miseEnPlace) : null;
  const tropTard = joursAvantMiseEnPlace !== null && joursAvantMiseEnPlace < 0;

  const replis = useMemo(() => {
    if (!tropTard || !dateIso) return [];
    return speculationsQuiTiennent(speculations, dateIso, marge, choixId ?? undefined);
  }, [tropTard, dateIso, speculations, marge, choixId]);

  const premiereVente = useMemo(
    () => (tropTard && duree !== null ? premiereDatePossible(duree, marge) : null),
    [tropTard, duree, marge],
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

      <Titre>Planifier une vente</Titre>
      <Aide>
        Partez de la date à laquelle vous voulez vendre. L&apos;application
        remonte le temps et vous dit quand vous y mettre.
      </Aide>

      <Erreur message={erreur} />

      {/* 1. Que produire ? ------------------------------------------------- */}
      <View style={styles.bloc}>
        <SousTitre>1. Que voulez-vous produire ?</SousTitre>
        {chargement ? (
          <View style={styles.liste}>
            <Squelette hauteur={72} />
            <Squelette hauteur={72} />
            <Squelette hauteur={72} />
          </View>
        ) : (
          <View style={styles.liste}>
            {speculations.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityState={{ selected: choixId === s.id }}
                onPress={() => choisirSpeculation(s.id)}
                style={({ pressed }) => [
                  styles.carteSpec,
                  choixId === s.id && styles.carteSpecChoisie,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <IllustrationEspece code={s.code} emoji={s.icone} taille={TAILLE_LISTE} />
                <View style={styles.specTextes}>
                  <Text style={styles.specNom}>{s.nom}</Text>
                  <Text style={styles.specDuree}>
                    {s.duree_cycle_jours
                      ? `Cycle d'environ ${s.duree_cycle_jours} jours`
                      : "Durée de cycle inconnue"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Mode de conduite — posé seulement là où plusieurs itinéraires
          existent, et avant la date : c'est lui qui fixe la durée du cycle. */}
      {itineraires.length > 1 ? (
        <View style={styles.bloc}>
          <SousTitre>Quelle conduite ?</SousTitre>
          <Aide>
            Cette production a plusieurs itinéraires. Le mode choisi détermine
            le guide associé au cycle, et la durée n&apos;est pas la même.
          </Aide>
          <View style={styles.liste}>
            {itineraires.map((it) => (
              <Pressable
                key={it.itineraire_id}
                accessibilityRole="button"
                accessibilityState={{ selected: itineraireId === it.itineraire_id }}
                onPress={() => setItineraireId(it.itineraire_id)}
                style={({ pressed }) => [
                  styles.carteSpec,
                  itineraireId === it.itineraire_id && styles.carteSpecChoisie,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.specTextes}>
                  <Text style={styles.specNom}>
                    {libelleModeConduite(it.mode_conduite) ?? it.titre}
                  </Text>
                  <Text style={styles.specDuree}>
                    {it.duree_totale_jours
                      ? `Guide d'environ ${it.duree_totale_jours} jours`
                      : it.titre}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {/* 2. Pour quand ? --------------------------------------------------- */}
      <View style={styles.bloc}>
        <SousTitre>2. Pour quand ?</SousTitre>
        <Aide>Choisissez un événement, ou entrez directement une date.</Aide>

        <View style={styles.pilules}>
          {EVENEMENTS.map((e) => (
            <Pilule
              key={e.code}
              libelle={e.libelle}
              emoji={e.emoji}
              selectionnee={evenement === e.code}
              onPress={() => choisirEvenement(e.code)}
            />
          ))}
        </View>

        {evenementChoisi ? (
          <Text style={styles.noteEvenement}>{evenementChoisi.note}</Text>
        ) : null}

        <Champ
          libelle="Date de vente visée"
          value={dateSaisie}
          onChangeText={setDateSaisie}
          placeholder="JJ/MM/AAAA"
          keyboardType="number-pad"
        />
        {dateInvalide ? (
          <Erreur message="Date incomprise. Écrivez-la sous la forme JJ/MM/AAAA." />
        ) : null}
      </View>

      {/* Marge de sécurité -------------------------------------------------- */}
      <View style={styles.bloc}>
        <SousTitre>Marge de sécurité</SousTitre>
        <Aide>
          Des jours d&apos;avance pour absorber les imprévus : un retard
          d&apos;approvisionnement, une pluie qui décale un semis, un animal qui
          prend moins vite que prévu.
        </Aide>
        <View style={styles.pilules}>
          {MARGES.map((m) => (
            <Pilule
              key={m}
              libelle={m === 0 ? "Aucune" : `${m} jours`}
              selectionnee={marge === m}
              onPress={() => setMarge(m)}
            />
          ))}
        </View>
      </View>

      {/* 3. Le résultat ----------------------------------------------------- */}
      {pret && miseEnPlace && !calcul ? (
        tropTard ? (
          <TropTard
            dateCible={dateIso!}
            premiereVente={premiereVente}
            replis={replis}
            marge={marge}
            onChoisir={choisirSpeculation}
          />
        ) : (
          <Resultat
            ecartGuide={
              itineraireChoisi?.duree_totale_jours && duree !== null
                ? itineraireChoisi.duree_totale_jours - duree
                : null
            }
            miseEnPlace={miseEnPlace}
            jours={joursAvantMiseEnPlace}
            duree={duree!}
            marge={marge}
            dateCible={dateIso!}
            onCreer={() =>
              router.push({
                pathname: "/(app)/nouveau-cycle",
                params: {
                  speculation_id: choix!.id,
                  speculation_nom: choix!.nom,
                  itineraire_id: itineraireChoisi?.itineraire_id ?? "",
                  mode_conduite: itineraireChoisi?.mode_conduite ?? "",
                  date_debut: miseEnPlace,
                  date_cible_marche: dateIso!,
                  evenement_cible: evenementChoisi?.libelle ?? "",
                },
              })
            }
          />
        )
      ) : null}

      <View style={styles.pied} />
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function Resultat({
  miseEnPlace,
  jours,
  duree,
  marge,
  dateCible,
  ecartGuide,
  onCreer,
}: {
  miseEnPlace: string;
  jours: number | null;
  duree: number;
  marge: number;
  dateCible: string;
  /** Jours d'écart entre le guide du mode choisi et la durée qui sert au calcul. */
  ecartGuide: number | null;
  onCreer: () => void;
}) {
  return (
    <View style={styles.resultat}>
      <Text style={styles.resultatLibelle}>Mettez en place le</Text>
      {/* 42 px, comme les montants : c'est LE chiffre de l'écran. */}
      <Text style={styles.resultatDate} adjustsFontSizeToFit numberOfLines={2}>
        {dateEnFrancais(miseEnPlace)}
      </Text>
      {jours !== null ? (
        <Text style={styles.resultatDelai}>
          soit {delaiEnFrancais(jours)}
          {jours > 0 ? " pour vous préparer" : ""}
        </Text>
      ) : null}

      <View style={styles.detail}>
        <Ligne libelle="Vente visée" valeur={dateEnFrancais(dateCible)} />
        <Ligne libelle="Durée du cycle" valeur={`${duree} jours`} />
        <Ligne
          libelle="Marge de sécurité"
          valeur={marge === 0 ? "aucune" : `${marge} jours`}
        />
      </View>

      {/* La planification s'appuie sur speculations.duree_cycle_jours, qui est
          la même pour tous les modes de conduite. Quand le guide du mode
          choisi annonce nettement plus long, le dire : se taire ferait partir
          un éleveur trop tard, et c'est précisément ce que cet écran doit
          empêcher. */}
      {ecartGuide !== null && ecartGuide >= 15 ? (
        <Text style={styles.ecart}>
          Attention : le guide de cette conduite annonce {ecartGuide} jours de
          plus que la durée de cycle utilisée pour ce calcul. Prévoyez de
          démarrer plus tôt, ou augmentez la marge.
        </Text>
      ) : null}

      <Bouton titre="Créer ce cycle" onPress={onCreer} />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Le refus, et ce qui reste possible. Deux issues valent mieux qu'un constat.
function TropTard({
  dateCible,
  premiereVente,
  replis,
  marge,
  onChoisir,
}: {
  dateCible: string;
  premiereVente: string | null;
  replis: import("@/lib/planification").SpeculationPlanifiable[];
  marge: number;
  onChoisir: (id: string) => void;
}) {
  const delai = joursEntre(dateCible);

  return (
    <View style={styles.tropTard}>
      <Text style={styles.tropTardTitre}>
        Il est trop tard pour viser cette date avec cette spéculation.
      </Text>
      <Text style={styles.tropTardTexte}>
        Il faudrait avoir déjà commencé.
        {delai !== null && delai >= 0
          ? ` Il ne reste que ${delai} jours avant le ${dateEnFrancais(dateCible, false)}.`
          : ""}
      </Text>

      {premiereVente ? (
        <View style={styles.encart}>
          <Text style={styles.encartTitre}>En démarrant aujourd&apos;hui</Text>
          <Text style={styles.encartTexte}>
            La première vente possible serait le {dateEnFrancais(premiereVente)}.
          </Text>
        </View>
      ) : null}

      {replis.length > 0 ? (
        <View style={styles.bloc}>
          <SousTitre>Ce qui tient encore dans le délai</SousTitre>
          <Aide>
            Ces productions ont un cycle assez court pour être vendues à la date
            visée, marge de {marge === 0 ? "0 jour" : `${marge} jours`} comprise.
          </Aide>
          <View style={styles.liste}>
            {replis.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`Choisir ${s.nom} à la place`}
                onPress={() => onChoisir(s.id)}
                style={({ pressed }) => [styles.carteSpec, pressed && { opacity: 0.85 }]}
              >
                <IllustrationEspece code={s.code} emoji={s.icone} taille={TAILLE_LISTE} />
                <View style={styles.specTextes}>
                  <Text style={styles.specNom}>{s.nom}</Text>
                  <Text style={styles.specDuree}>{s.duree_cycle_jours} jours de cycle</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Text style={styles.tropTardTexte}>
          Aucune production du référentiel n&apos;a un cycle assez court pour
          cette date. Visez l&apos;occasion suivante.
        </Text>
      )}
    </View>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.ligne}>
      <Text style={styles.ligneLibelle}>{libelle}</Text>
      <Text style={styles.ligneValeur}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  retour: { minHeight: CIBLE_TACTILE, justifyContent: "center" },
  retourTexte: { fontSize: textes.corps, color: couleurs.vertFonce, fontWeight: "600" },
  bloc: { gap: espaces.sm, marginTop: espaces.lg },
  liste: { gap: espaces.sm },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: espaces.sm },

  carteSpec: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    backgroundColor: couleurs.blanc,
    minHeight: CIBLE_TACTILE,
  },
  carteSpecChoisie: { borderColor: couleurs.vertFonce, backgroundColor: "#EAF6EE" },
  specTextes: { flex: 1, gap: 2 },
  specNom: { fontSize: textes.corps, fontWeight: "700", color: couleurs.encre },
  specDuree: { fontSize: textes.petit, color: couleurs.attenue },

  noteEvenement: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
    backgroundColor: "#FFF8E1",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.or,
    borderRadius: rayons.sm,
    padding: espaces.md,
  },

  resultat: {
    marginTop: espaces.lg,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderColor: couleurs.vertFonce,
    gap: espaces.sm,
  },
  resultatLibelle: { fontSize: textes.corps, color: couleurs.attenue },
  resultatDate: {
    fontSize: 42,
    lineHeight: 50,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },
  resultatDelai: { fontSize: textes.corps, color: couleurs.encre },
  detail: { gap: espaces.xs, marginVertical: espaces.md },
  ligne: { flexDirection: "row", justifyContent: "space-between", gap: espaces.sm },
  ligneLibelle: { fontSize: textes.petit, color: couleurs.attenue },
  ligneValeur: { fontSize: textes.petit, fontWeight: "700", color: couleurs.encre },

  ecart: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
    backgroundColor: "#FFF8E1",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.or,
    borderRadius: rayons.sm,
    padding: espaces.md,
    marginBottom: espaces.sm,
  },
  tropTard: {
    marginTop: espaces.lg,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: "#FDECEE",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.rouge,
    gap: espaces.sm,
  },
  tropTardTitre: {
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  tropTardTexte: { fontSize: textes.corps, lineHeight: 26, color: couleurs.encre },
  encart: {
    backgroundColor: couleurs.blanc,
    borderRadius: rayons.md,
    padding: espaces.md,
    gap: espaces.xs,
  },
  encartTitre: { fontSize: textes.petit, color: couleurs.attenue },
  encartTexte: { fontSize: textes.corps, fontWeight: "700", color: couleurs.encre },

  pied: { height: espaces.xxl },
});
