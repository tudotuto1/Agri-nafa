// =============================================================================
// Enregistrement d'une récolte.
//
// L'écran montre en tête ce que le cycle a déjà produit et ce que chaque kilo
// a coûté jusqu'ici. Dès qu'une quantité est saisie, le nouveau prix de
// revient s'affiche à côté de l'ancien : c'est le lien que le producteur doit
// voir. Ses dépenses se répartissent sur une récolte plus grande, donc chaque
// kilo lui revient moins cher — et c'est ce chiffre-là qu'il opposera au
// bana-bana qui lui propose un prix.
//
// La colonne unite est NOT NULL : elle reprend l'unité de la spéculation.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";

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
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { prixDeRevientProjete, useCyclesActifs } from "@/lib/cycles";
import { messageErreurLisible } from "@/lib/erreurs";
import { ajouter } from "@/lib/file-attente";
import {
  affichageVersIso,
  aujourdhuiIso,
  decalerJours,
  formaterFcfa,
  grouperChiffres,
  isoVersAffichage,
} from "@/lib/format";
import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Valeurs acceptées par la contrainte CHECK de productions_recoltes.
// La qualité reste facultative : un second appui désélectionne.
// -----------------------------------------------------------------------------
type Qualite = "premier_choix" | "second_choix" | "ecart_de_tri";

const QUALITES: { code: Qualite; libelle: string; emoji: string }[] = [
  { code: "premier_choix", libelle: "Premier choix", emoji: "⭐" },
  { code: "second_choix", libelle: "Second choix", emoji: "👍" },
  { code: "ecart_de_tri", libelle: "Écart de tri", emoji: "🥬" },
];

// =============================================================================
export default function EcranRecolte() {
  const router = useRouter();
  const { session } = useAuth();

  const [quantite, setQuantite] = useState("");
  const [qualite, setQualite] = useState<Qualite | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [dateSaisie, setDateSaisie] = useState(isoVersAffichage(aujourdhuiIso()));

  const { cycles, chargement, erreur: erreurCycles } = useCyclesActifs();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (cycles.length === 1) setCycleId(cycles[0].id);
  }, [cycles]);

  const cycleChoisi = useMemo(
    () => cycles.find((c) => c.id === cycleId) ?? null,
    [cycles, cycleId],
  );

  const quantiteNombre = Number(quantite || "0");
  const dateIso = useMemo(() => affichageVersIso(dateSaisie), [dateSaisie]);
  const dateInvalide = dateSaisie.trim().length > 0 && dateIso === null;

  // Prix de revient projeté : les mêmes dépenses réparties sur la récolte
  // cumulée, cette saisie comprise.
  const prixDeRevientApres = useMemo(
    () =>
      cycleChoisi
        ? prixDeRevientProjete(
            cycleChoisi.totalDepenses,
            cycleChoisi.totalRecolte,
            quantiteNombre,
          )
        : null,
    [cycleChoisi, quantiteNombre],
  );

  const pret =
    quantiteNombre > 0 && cycleId !== null && dateIso !== null && !envoi;

  const enregistrer = useCallback(async () => {
    if (!pret || !session?.user || !cycleId || !dateIso || !cycleChoisi) return;

    setEnvoi(true);
    setErreur(null);

    const { enFile, erreur: refus } = await ajouter("productions_recoltes", {
      user_id: session.user.id,
      cycle_id: cycleId,
      quantite_recoltee: quantiteNombre,
      // NOT NULL : on reprend l'unité de la spéculation, jamais une chaîne vide.
      unite: cycleChoisi.unite,
      qualite,
      date_recolte: dateIso,
    });

    if (refus) {
      setEnvoi(false);
      setErreur(messageErreurLisible(refus, "la récolte"));
      return;
    }

    router.dismissTo({
      pathname: "/(app)/accueil",
      params: {
        recolte_enregistree: `${quantiteNombre} ${cycleChoisi.unite}`,
        en_attente: enFile ? "1" : "",
      },
    });
  }, [pret, session, cycleId, dateIso, cycleChoisi, quantiteNombre, qualite, router]);

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Noter une récolte</Titre>
        <Squelette hauteur={80} />
        <Squelette hauteur={90} />
        <Squelette hauteur={110} />
      </Ecran>
    );
  }

  if (cycles.length === 0) {
    return (
      <Ecran>
        <Titre>Noter une récolte</Titre>
        <View style={styles.vide}>
          <Text style={styles.videEmoji}>🌱</Text>
          <SousTitre>Aucun cycle en cours</SousTitre>
          <Aide>
            Une récolte se rattache toujours à une production. Créez d'abord un
            cycle, puis revenez noter vos récoltes.
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

  const unite = cycleChoisi?.unite ?? "unité";

  return (
    <Ecran>
      <Titre>Noter une récolte</Titre>

      {/* Contexte : ce que le cycle a déjà produit et ce qu'il a coûté ------- */}
      {cycleChoisi ? (
        <View style={styles.contexte}>
          <View style={styles.contexteLigne}>
            <Text style={styles.contexteLibelle}>Déjà récolté</Text>
            <Text style={styles.contexteValeur}>
              {grouperChiffres(String(cycleChoisi.totalRecolte ?? 0))} {unite}
            </Text>
          </View>

          <View style={styles.contexteSeparateur} />

          <View style={styles.contexteLigne}>
            <Text style={styles.contexteLibelle}>Prix de revient</Text>
            {cycleChoisi.prixDeRevient !== null ? (
              <View style={styles.revientLigne}>
                <Text
                  style={[
                    styles.contexteValeur,
                    prixDeRevientApres !== null && styles.revientAncien,
                  ]}
                >
                  {formaterFcfa(cycleChoisi.prixDeRevient)}/{unite}
                </Text>
                {prixDeRevientApres !== null ? (
                  <>
                    <Text style={styles.fleche}>→</Text>
                    <Text style={styles.revientNouveau}>
                      {formaterFcfa(prixDeRevientApres)}/{unite}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : (
              <Text style={styles.contexteAbsent}>
                {prixDeRevientApres !== null
                  ? `${formaterFcfa(prixDeRevientApres)}/${unite} après cette récolte`
                  : "Pas encore calculable"}
              </Text>
            )}
          </View>

          {prixDeRevientApres !== null ? (
            <Text style={styles.contexteNote}>
              Vos dépenses se répartissent sur une récolte plus grande : chaque{" "}
              {unite} vous revient moins cher.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* 1. Quantité -------------------------------------------------------- */}
      <View style={styles.blocChiffre}>
        <Text style={styles.chiffreLibelle}>Quantité récoltée</Text>
        <View style={styles.chiffreLigne}>
          <TextInput
            style={styles.chiffreChamp}
            value={grouperChiffres(quantite)}
            onChangeText={(v) => setQuantite(v.replace(/\D/g, "").slice(0, 9))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={couleurs.ligne}
            autoFocus
            accessibilityLabel="Quantité récoltée"
          />
          <Text style={styles.chiffreUnite}>{unite}</Text>
        </View>
      </View>

      {/* 2. Qualité — facultative, un second appui désélectionne ------------ */}
      <View style={styles.bloc}>
        <Text style={styles.libelle}>Qualité (facultatif)</Text>
        <View style={styles.pilules}>
          {QUALITES.map((q) => (
            <Pilule
              key={q.code}
              libelle={q.libelle}
              emoji={q.emoji}
              selectionnee={qualite === q.code}
              onPress={() => setQualite(qualite === q.code ? null : q.code)}
            />
          ))}
        </View>
        <Aide>Appuyez une seconde fois pour retirer votre choix.</Aide>
      </View>

      {/* 3. Cycle — masqué s'il n'y en a qu'un ------------------------------ */}
      {cycles.length > 1 ? (
        <View style={styles.bloc}>
          <Text style={styles.libelle}>De quel cycle vient cette récolte ?</Text>
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

      {/* 4. Date ------------------------------------------------------------ */}
      <View style={styles.bloc}>
        <Champ
          libelle="Date de la récolte"
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
        titre="Enregistrer la récolte"
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

  contexte: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  contexteLigne: {
    gap: espaces.xs,
  },
  contexteSeparateur: {
    height: 2,
    backgroundColor: couleurs.ligne,
  },
  contexteLibelle: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  contexteValeur: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  contexteAbsent: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.vert,
  },
  contexteNote: {
    fontSize: textes.petit,
    lineHeight: 20,
    color: couleurs.attenue,
  },
  revientLigne: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: espaces.sm,
  },
  revientAncien: {
    color: couleurs.attenue,
    textDecorationLine: "line-through",
  },
  fleche: {
    fontSize: textes.corps,
    color: couleurs.attenue,
  },
  revientNouveau: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.vert,
  },

  blocChiffre: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  chiffreLibelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.attenue,
  },
  chiffreLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  chiffreChamp: {
    flex: 1,
    minHeight: CIBLE_TACTILE,
    fontSize: 42,
    fontWeight: "700",
    color: couleurs.encre,
    padding: 0,
  },
  chiffreUnite: {
    fontSize: textes.sousTitre,
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
