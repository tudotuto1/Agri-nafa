// =============================================================================
// Guides techniques — liste.
//
// Un seul itinéraire est écrit pour l'instant. Les autres spéculations
// apparaissent quand même, grisées et marquées « Guide en préparation » : un
// producteur qui ne voit que l'aubergine croit que l'application ne sait rien
// de sa tomate. Montrer ce qui vient est une information, pas du remplissage.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Aide,
  Bouton,
  Ecran,
  Erreur,
  SousTitre,
  Squelette,
  Titre,
} from "@/components/ui";
import { couleurs, espaces, rayons, textes } from "@/constants/theme";
import {
  IllustrationEspece,
  TAILLE_CARTE,
  TAILLE_LISTE,
} from "@/components/illustration-espece";
import { formaterFcfa } from "@/lib/format";
import {
  LIBELLES_DIFFICULTE,
  formaterQuantite,
  nombre,
  type Guide,
} from "@/lib/guides";
import { supabase } from "@/lib/supabase";

type SpeculationSansGuide = {
  id: string;
  nom: string;
  code: string;
  icone: string | null;
  filiere: string;
};

// =============================================================================
export default function EcranGuides() {
  const router = useRouter();

  const [guides, setGuides] = useState<Guide[]>([]);
  const [aVenir, setAVenir] = useState<SpeculationSansGuide[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    const [resGuides, resSpec] = await Promise.all([
      supabase.from("vue_guides").select("*").order("titre"),
      supabase.from("speculations").select("id, code, nom, icone, filiere").order("nom"),
    ]);

    if (resGuides.error || resSpec.error) {
      setErreur("Impossible de charger les guides. Réessayez.");
      return;
    }

    const liste = (resGuides.data ?? []) as Guide[];
    const avecGuide = new Set(liste.map((g) => g.speculation_id));
    setGuides(liste);
    setAVenir(
      ((resSpec.data ?? []) as SpeculationSansGuide[]).filter(
        (s) => !avecGuide.has(s.id),
      ),
    );
  }, []);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  if (chargement) {
    return (
      <Ecran>
        <Titre>Guides techniques</Titre>
        <Squelette hauteur={190} />
        <Squelette hauteur={70} />
        <Squelette hauteur={70} />
      </Ecran>
    );
  }

  return (
    <Ecran>
      <Titre>Guides techniques</Titre>
      <Aide>
        L'itinéraire complet d'une culture, de la pépinière à la vente, avec les
        doses ramenées à votre surface.
      </Aide>

      <Erreur message={erreur} />

      {guides.map((guide) => (
        <CarteGuide
          key={guide.itineraire_id}
          guide={guide}
          onPress={() =>
            router.push({
              pathname: "/(app)/guide/[id]",
              params: { id: guide.itineraire_id },
            })
          }
        />
      ))}

      {aVenir.length > 0 ? (
        <>
          <SousTitre>Bientôt disponibles</SousTitre>
          <View style={styles.liste}>
            {aVenir.map((s) => (
              <View key={s.id} style={styles.carteGrisee}>
                <IllustrationEspece
                  code={s.code}
                  emoji={s.icone}
                  taille={TAILLE_LISTE}
                />
                <View style={styles.griseTextes}>
                  <Text style={styles.nomGrise}>{s.nom}</Text>
                  <Text style={styles.enPreparation}>Guide en préparation</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.pied}>
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
function CarteGuide({ guide, onPress }: { guide: Guide; onPress: () => void }) {
  const min = nombre(guide.rendement_min_ha);
  const max = nombre(guide.rendement_max_ha);
  const cout = nombre(guide.cout_indicatif_ha);
  const unite = guide.unite_rendement ?? guide.unite_defaut;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le guide ${guide.titre}`}
      onPress={onPress}
      style={({ pressed }) => [styles.carte, pressed && styles.presse]}
    >
      <View style={styles.carteEntete}>
        <IllustrationEspece
          code={guide.speculation_code}
          emoji={guide.icone}
          taille={TAILLE_CARTE}
        />
        <View style={styles.carteTextes}>
          <Text style={styles.carteTitre}>{guide.titre}</Text>
          <Text style={styles.carteSpeculation}>{guide.speculation_nom}</Text>
        </View>
      </View>

      {guide.resume ? <Text style={styles.resume}>{guide.resume}</Text> : null}

      <View style={styles.chiffres}>
        {guide.difficulte ? (
          <Chiffre
            libelle="Niveau"
            valeur={LIBELLES_DIFFICULTE[guide.difficulte] ?? guide.difficulte}
          />
        ) : null}
        {guide.duree_totale_jours ? (
          <Chiffre libelle="Durée" valeur={`${guide.duree_totale_jours} jours`} />
        ) : null}
        {min !== null && max !== null ? (
          <Chiffre
            libelle="Rendement"
            valeur={`${formaterQuantite(min, unite)} à ${formaterQuantite(max, unite)} par ha`}
          />
        ) : null}
        {cout !== null ? (
          <Chiffre libelle="Coût indicatif" valeur={`${formaterFcfa(cout)} par ha`} />
        ) : null}
      </View>

      <Text style={styles.etapes}>
        {guide.nb_etapes} étape{guide.nb_etapes > 1 ? "s" : ""} · Ouvrir ›
      </Text>
    </Pressable>
  );
}

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.chiffre}>
      <Text style={styles.chiffreLibelle}>{libelle}</Text>
      <Text style={styles.chiffreValeur}>{valeur}</Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  liste: { gap: espaces.sm },
  presse: { opacity: 0.85 },
  pied: { marginTop: espaces.lg },

  carte: {
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.vert,
  },
  carteEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
  },
  carteTextes: { flex: 1, gap: 2 },
  carteTitre: {
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  carteSpeculation: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  resume: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },
  chiffres: {
    gap: espaces.sm,
    paddingTop: espaces.sm,
    borderTopWidth: 2,
    borderTopColor: couleurs.ligne,
  },
  chiffre: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
  },
  chiffreLibelle: {
    width: 110,
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  chiffreValeur: {
    flex: 1,
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },
  etapes: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },

  carteGrisee: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.papier,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: couleurs.ligne,
    opacity: 0.75,
  },
  griseTextes: { flex: 1, gap: 2 },
  nomGrise: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.attenue,
  },
  enPreparation: {
    fontSize: textes.petit,
    fontStyle: "italic",
    color: couleurs.attenue,
  },
});
