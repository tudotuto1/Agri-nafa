// =============================================================================
// Saisie manuelle d'une dépense.
//
// Le montant vient en premier et en grand : c'est la seule information que le
// producteur a vraiment en tête, souvent debout dans sa parcelle, une main sur
// le téléphone. Tout le reste est pré-rempli ou choisi d'un doigt.
//
// user_id vient de la session, jamais d'un champ. La RLS le vérifie de toute
// façon, mais un identifiant qui transite par l'interface est un identifiant
// qu'on peut un jour croire modifiable.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";

import {
  Aide,
  BandeauContexte,
  Bouton,
  Champ,
  Ecran,
  Erreur,
  Pilule,
  SousTitre,
  Squelette,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { useCyclesActifs } from "@/lib/cycles";
import {
  affichageVersIso,
  aujourdhuiIso,
  decalerJours,
  grouperChiffres,
  isoVersAffichage,
} from "@/lib/format";
import { messageErreurLisible } from "@/lib/erreurs";
import { ajouter } from "@/lib/file-attente";
import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Valeurs de l'enum categorie_depense, dans l'ordre de la base. Le producteur
// voit un libellé et un pictogramme ; le code brut ne sort jamais à l'écran.
// -----------------------------------------------------------------------------
type Categorie =
  | "intrants"
  | "main_d_oeuvre"
  | "carburant"
  | "transport"
  | "veterinaire"
  | "irrigation"
  | "location"
  | "autre";

const CATEGORIES: { code: Categorie; libelle: string; emoji: string }[] = [
  { code: "intrants", libelle: "Intrants", emoji: "🌾" },
  { code: "main_d_oeuvre", libelle: "Main-d'œuvre", emoji: "👷" },
  { code: "carburant", libelle: "Carburant", emoji: "⛽" },
  { code: "transport", libelle: "Transport", emoji: "🚚" },
  { code: "veterinaire", libelle: "Vétérinaire", emoji: "💉" },
  { code: "irrigation", libelle: "Irrigation", emoji: "💧" },
  { code: "location", libelle: "Location", emoji: "🔑" },
  { code: "autre", libelle: "Autre", emoji: "📦" },
];

// =============================================================================
export default function EcranDepense() {
  const router = useRouter();
  const { session } = useAuth();

  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [categorie, setCategorie] = useState<Categorie>("intrants");
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [dateSaisie, setDateSaisie] = useState(isoVersAffichage(aujourdhuiIso()));

  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const { cycles, chargement, erreur: erreurCycles } = useCyclesActifs();

  // Un seul cycle : aucun choix à faire, le sélecteur reste masqué — mais le
  // bandeau de contexte, lui, affiche de quoi il s'agit.
  useEffect(() => {
    if (cycles.length === 1) setCycleId(cycles[0].id);
  }, [cycles]);

  const montantNombre = Number(montant || "0");
  const dateIso = useMemo(() => affichageVersIso(dateSaisie), [dateSaisie]);

  const dateInvalide = dateSaisie.trim().length > 0 && dateIso === null;
  const pret =
    montantNombre > 0 &&
    description.trim().length > 0 &&
    cycleId !== null &&
    dateIso !== null &&
    !envoi;

  const enregistrer = useCallback(async () => {
    if (!pret || !session?.user || !cycleId || !dateIso) return;

    setEnvoi(true);
    setErreur(null);

    const { enFile, erreur: refus } = await ajouter("depenses", {
      user_id: session.user.id,
      cycle_id: cycleId,
      description: description.trim(),
      categorie,
      montant_total: montantNombre,
      date_depense: dateIso,
      saisie_source: "manuelle",
      validee: true,
    });

    if (refus) {
      setEnvoi(false);
      setErreur(messageErreurLisible(refus, "la dépense"));
      return;
    }

    // dismissTo dépile jusqu'à l'accueil au lieu d'en empiler une seconde
    // copie ; le paramètre porte la confirmation du montant enregistré.
    router.dismissTo({
      pathname: "/(app)/accueil",
      params: {
        depense_enregistree: String(montantNombre),
        en_attente: enFile ? "1" : "",
      },
    });
  }, [pret, session, cycleId, dateIso, description, categorie, montantNombre, router]);

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Noter une dépense</Titre>
        <Squelette hauteur={90} />
        <Squelette hauteur={60} />
        <Squelette hauteur={110} />
      </Ecran>
    );
  }

  // cycle_id est NOT NULL en base : sans cycle actif, aucune dépense ne peut
  // être rattachée. Mieux vaut le dire franchement que laisser saisir pour
  // rien et échouer à l'envoi.
  if (cycles.length === 0) {
    return (
      <Ecran>
        <Titre>Noter une dépense</Titre>
        <View style={styles.vide}>
          <Text style={styles.videEmoji}>🌱</Text>
          <SousTitre>Aucun cycle en cours</SousTitre>
          <Aide>
            Une dépense se rattache toujours à une production. Créez d'abord un
            cycle, puis revenez noter vos dépenses.
          </Aide>
          <Bouton
            titre="Créer un cycle"
            onPress={() => router.replace("/(app)/nouveau-cycle")}
          />
          <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Titre>Noter une dépense</Titre>

      {/* Contexte — visible dès qu'il n'y a qu'un cycle, là où le sélecteur
          disparaît. Ce qui n'a pas à être choisi doit quand même être su. */}
      {cycles.length === 1 ? (
        <BandeauContexte
          emoji={cycles[0].icone}
          principal={cycles[0].speculation ?? cycles[0].nom}
          secondaire={cycles[0].parcelle}
        />
      ) : null}

      {/* 1. Montant --------------------------------------------------------- */}
      <View style={styles.blocMontant}>
        <Text style={styles.montantLibelle}>Montant</Text>
        <View style={styles.montantLigne}>
          <TextInput
            style={styles.montantChamp}
            value={grouperChiffres(montant)}
            onChangeText={(valeur) => setMontant(valeur.replace(/\D/g, "").slice(0, 12))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={couleurs.ligne}
            autoFocus
            accessibilityLabel="Montant de la dépense en francs CFA"
          />
          <Text style={styles.montantDevise}>F</Text>
        </View>
      </View>

      {/* 2. Description ----------------------------------------------------- */}
      <Champ
        libelle="Qu'avez-vous payé ?"
        value={description}
        onChangeText={setDescription}
        placeholder="Ex. 2 sacs de NPK 15-15-15"
        autoCapitalize="sentences"
      />

      {/* 3. Catégorie ------------------------------------------------------- */}
      <View style={styles.bloc}>
        <Text style={styles.libelle}>Catégorie</Text>
        <View style={styles.pilules}>
          {CATEGORIES.map((c) => (
            <Pilule
              key={c.code}
              libelle={c.libelle}
              emoji={c.emoji}
              selectionnee={categorie === c.code}
              onPress={() => setCategorie(c.code)}
            />
          ))}
        </View>
      </View>

      {/* 4. Cycle — masqué s'il n'y en a qu'un ------------------------------ */}
      {cycles.length > 1 ? (
        <View style={styles.bloc}>
          <Text style={styles.libelle}>Pour quel cycle ?</Text>
          <View style={styles.pilules}>
            {cycles.map((cycle) => (
              <Pilule
                key={cycle.id}
                libelle={cycle.nom}
                selectionnee={cycleId === cycle.id}
                onPress={() => setCycleId(cycle.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* 5. Date ------------------------------------------------------------ */}
      <View style={styles.bloc}>
        <Champ
          libelle="Date de la dépense"
          value={dateSaisie}
          onChangeText={setDateSaisie}
          placeholder="JJ/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
        />
        <View style={styles.raccourcisDate}>
          <Bouton
            titre="Aujourd'hui"
            variante="contour"
            onPress={() => setDateSaisie(isoVersAffichage(aujourdhuiIso()))}
            style={styles.raccourci}
          />
          <Bouton
            titre="Hier"
            variante="contour"
            onPress={() =>
              setDateSaisie(isoVersAffichage(decalerJours(aujourdhuiIso(), -1)))
            }
            style={styles.raccourci}
          />
        </View>
        {dateInvalide ? (
          <Text style={styles.dateErreur}>
            Date incomprise. Écrivez-la sous la forme JJ/MM/AAAA.
          </Text>
        ) : null}
      </View>

      <Erreur message={erreur ?? erreurCycles} />

      <Bouton
        titre="Enregistrer la dépense"
        onPress={enregistrer}
        desactive={!pret}
        chargement={envoi}
      />
      <Bouton titre="Annuler" variante="contour" onPress={() => router.back()} />
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  bloc: {
    gap: espaces.sm,
  },
  libelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.encre,
  },

  blocMontant: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  montantLibelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.attenue,
  },
  montantLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  montantChamp: {
    flex: 1,
    minHeight: CIBLE_TACTILE,
    fontSize: 42,
    fontWeight: "700",
    color: couleurs.encre,
    padding: 0,
  },
  montantDevise: {
    fontSize: 30,
    fontWeight: "700",
    color: couleurs.attenue,
  },

  pilules: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: espaces.sm,
  },

  raccourcisDate: {
    flexDirection: "row",
    gap: espaces.sm,
  },
  raccourci: {
    flex: 1,
    minHeight: 48,
  },
  dateErreur: {
    fontSize: textes.petit,
    color: couleurs.rouge,
  },

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
  videEmoji: {
    fontSize: 48,
  },
});
