// =============================================================================
// Étape 5 — Premier cycle de production.
//
// La liste des spéculations est lue dans la table « speculations », jamais
// codée en dur : ajouter une culture au référentiel doit suffire, sans imposer
// une nouvelle version de l'application à des producteurs qui mettent à jour
// rarement et sur une connexion coûteuse.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  Aide,
  Attente,
  Bouton,
  Carte,
  Champ,
  Ecran,
  EpisDeMil,
  Erreur,
  SousTitre,
  Titre,
} from "@/components/ui";
import { espaces } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { ajouter } from "@/lib/file-attente";
import { messageErreurLisible } from "@/lib/erreurs";
import { supabase, type Speculation } from "@/lib/supabase";

type TypeCycle = "culture" | "elevage";

const FILIERES: Record<TypeCycle, Speculation["filiere"][]> = {
  culture: ["maraichage", "cereale"],
  elevage: ["avicole", "elevage"],
};

export default function EcranPremierCycle() {
  const router = useRouter();
  const { session, rafraichirProfil } = useAuth();

  const [type, setType] = useState<TypeCycle>("culture");
  const [speculations, setSpeculations] = useState<Speculation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [choix, setChoix] = useState<Speculation | null>(null);
  const [effectif, setEffectif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    supabase
      .from("speculations")
      .select("id, code, nom, filiere, unite_defaut, duree_cycle_jours, icone")
      .order("nom")
      .then(({ data, error }) => {
        if (!actif) return;
        if (error) setErreur(error.message);
        else setSpeculations((data ?? []) as Speculation[]);
        setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  const proposees = useMemo(
    () => speculations.filter((s) => FILIERES[type].includes(s.filiere)),
    [speculations, type],
  );

  function changerType(nouveau: TypeCycle) {
    setType(nouveau);
    setChoix(null);
    setEffectif("");
  }

  // Un cycle d'élevage sans effectif de départ ne permet aucun suivi de
  // mortalité — la contrainte chk_effectif_elevage le refuse d'ailleurs en base.
  const effectifRequis = type === "elevage";
  const effectifValide = !effectifRequis || Number(effectif) > 0;
  const pret = choix !== null && effectifValide;

  async function creer() {
    if (!choix || !session?.user || !pret) return;

    setEnvoi(true);
    setErreur(null);

    const debut = new Date();
    const finPrevue = choix.duree_cycle_jours
      ? new Date(debut.getTime() + choix.duree_cycle_jours * 86_400_000)
      : null;

    const {
      id: cycleId,
      enFile,
      erreur: refus,
    } = await ajouter("cycles_production", {
      user_id: session.user.id,
      nom: choix.nom,
      type,
      speculation_id: choix.id,
      date_debut: debut.toISOString().slice(0, 10),
      date_fin_prevue: finPrevue ? finPrevue.toISOString().slice(0, 10) : null,
      effectif_initial: effectifRequis ? Number(effectif) : null,
      statut: "actif",
    });

    if (refus) {
      setEnvoi(false);
      setErreur(messageErreurLisible(refus, "ce cycle"));
      return;
    }

    // Projette le protocole sanitaire type sur des dates réelles : les 7 actes
    // du calendrier volaille deviennent des rendez-vous datés, du premier
    // anti-stress au contrôle de poids.
    //
    // Inutile de tenter l'appel si le cycle attend encore sur le téléphone :
    // la fonction s'exécute en base, sur une ligne qui n'y est pas.
    if (type === "elevage" && !enFile) {
      const { error: errCalendrier } = await supabase.rpc(
        "generer_calendrier_sanitaire",
        { p_cycle_id: cycleId },
      );
      // Un calendrier manquant ne doit pas bloquer l'inscription : il pourra
      // être régénéré depuis la fiche du cycle.
      if (errCalendrier) {
        console.warn("Calendrier sanitaire non généré :", errCalendrier.message);
      }
    }

    const { error: errProfil } = await supabase
      .from("profils")
      .update({ onboarding_termine: true })
      .eq("id", session.user.id);

    setEnvoi(false);
    if (errProfil) {
      // Une mise à jour ne se met pas en file : seules les insertions le
      // peuvent. L'inscription s'achève donc en ligne — ce qui n'a rien
      // d'absurde, le code SMS de l'étape précédente exigeait déjà du réseau.
      setErreur(
        enFile
          ? "Votre cycle est gardé sur le téléphone. Reconnectez-vous pour terminer l'inscription."
          : messageErreurLisible(errProfil, "votre profil"),
      );
      return;
    }

    await rafraichirProfil();
    router.replace("/(app)/accueil");
  }

  if (chargement) return <Attente />;

  return (
    <Ecran>
      <EpisDeMil etape={5} total={5} />
      <Titre>Votre première production</Titre>
      <Aide>
        Vous pourrez en ajouter d'autres ensuite. Commencez par celle qui est
        déjà en terre ou en poulailler.
      </Aide>

      <View style={styles.bascule}>
        <Bouton
          titre="🌱 Culture"
          variante={type === "culture" ? "plein" : "contour"}
          onPress={() => changerType("culture")}
          style={styles.basculeBouton}
        />
        <Bouton
          titre="🐔 Élevage"
          variante={type === "elevage" ? "plein" : "contour"}
          onPress={() => changerType("elevage")}
          style={styles.basculeBouton}
        />
      </View>

      <SousTitre>Que produisez-vous ?</SousTitre>
      <View style={styles.liste}>
        {proposees.map((speculation) => (
          <Carte
            key={speculation.id}
            emoji={speculation.icone ?? undefined}
            codeEspece={speculation.code}
            titre={speculation.nom}
            sousTitre={
              speculation.duree_cycle_jours
                ? `Cycle d'environ ${speculation.duree_cycle_jours} jours`
                : undefined
            }
            selectionnee={choix?.id === speculation.id}
            onPress={() => setChoix(speculation)}
          />
        ))}
      </View>

      {effectifRequis ? (
        <Champ
          libelle="Nombre de sujets mis en place"
          value={effectif}
          onChangeText={(valeur) => setEffectif(valeur.replace(/\D/g, ""))}
          placeholder="Ex. 250"
          keyboardType="number-pad"
        />
      ) : null}

      <Erreur message={erreur} />

      <Bouton
        titre="Terminer l'inscription"
        onPress={creer}
        desactive={!pret}
        chargement={envoi}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  bascule: {
    flexDirection: "row",
    gap: espaces.sm,
  },
  basculeBouton: {
    flex: 1,
  },
  liste: {
    gap: espaces.sm,
  },
});
