// =============================================================================
// Guide technique — détail d'un itinéraire.
//
// Quatre onglets : l'itinéraire pas à pas, l'économie, quand vendre, et
// comment vendre. Le fil conducteur est la taille de l'exploitation : tout ce
// qui se dose y est ramené, parce qu'un producteur de 0,25 ha ne doit jamais
// avoir à diviser une consigne à l'hectare au moment d'acheter son engrais.
//
// -----------------------------------------------------------------------------
// CE QUE « TAILLE » VEUT DIRE
//
// Les colonnes de la base s'appellent toutes `*_ha` : elles ont été écrites
// pour des cultures. `base_calcul` dit comment les lire — une valeur à
// l'hectare, à la tête ou au bassin. Pour un troupeau, l'hectare n'a aucun
// sens : on raisonne à l'animal.
//
// Le calcul ne change pas d'une base à l'autre, c'est toujours « valeur
// unitaire × taille ». Ce qui change, ce sont les paliers proposés et les
// mots. Les règles vivent dans lib/guides.ts, pas ici : cet écran ne fait que
// les appliquer.
//
// Les guides de culture doivent s'afficher exactement comme avant l'arrivée de
// cette colonne. Les taux unitaires (« coût par tête ») ne sont donc montrés
// que hors hectare, où ils n'existaient pas auparavant.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  Aide,
  Bouton,
  CaseACocher,
  Ecran,
  Erreur,
  Onglets,
  Pilule,
  SousTitre,
  Squelette,
  Titre,
} from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import {
  IllustrationEspece,
  TAILLE_CARTE,
} from "@/components/illustration-espece";
import { useAuth } from "@/lib/auth";
import { formaterFcfa, grouperChiffres } from "@/lib/format";
import {
  LIBELLES_CONSEIL,
  LIBELLES_DIFFICULTE,
  LIBELLES_PHASE,
  MOIS_COURTS,
  MOIS_LONGS,
  conditionnementsNecessaires,
  coutEtape,
  doseSurface,
  formaterQuantite,
  formaterTaille,
  heuresPourSurface,
  nombre,
  reglesBase,
  tailleParDefaut,
  type Conseil,
  type EtapeGuide,
  type Guide,
  type Intrant,
  type MoisSaisonnalite,
  type Phase,
  type TypeConseil,
} from "@/lib/guides";
import { supabase } from "@/lib/supabase";

type CleOnglet = "itineraire" | "economie" | "vendre" | "commercialisation";

const ONGLETS: { cle: CleOnglet; libelle: string; emoji: string }[] = [
  { cle: "itineraire", libelle: "Itinéraire", emoji: "🌱" },
  { cle: "economie", libelle: "Économie", emoji: "💰" },
  { cle: "vendre", libelle: "Quand vendre", emoji: "📅" },
  { cle: "commercialisation", libelle: "Commercialisation", emoji: "🤝" },
];

// Une couleur par phase. Le texte du badge passe en encre sur l'or, qui est
// trop clair pour du blanc.
const COULEURS_PHASE: Record<Phase, { fond: string; texte: string }> = {
  preparation: { fond: couleurs.attenue, texte: couleurs.blanc },
  installation: { fond: couleurs.vertFonce, texte: couleurs.blanc },
  entretien: { fond: "#1F7A8C", texte: couleurs.blanc },
  protection: { fond: couleurs.rouge, texte: couleurs.blanc },
  recolte: { fond: couleurs.or, texte: couleurs.encre },
  commercialisation: { fond: "#6B4E9E", texte: couleurs.blanc },
};

// =============================================================================
export default function EcranGuideDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profil } = useAuth();

  const [onglet, setOnglet] = useState<CleOnglet>("itineraire");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [etapes, setEtapes] = useState<EtapeGuide[]>([]);
  const [saisons, setSaisons] = useState<MoisSaisonnalite[]>([]);
  const [conseils, setConseils] = useState<Conseil[]>([]);
  const [prixRevientReel, setPrixRevientReel] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Taille de travail : surface en hectares, effectif en têtes ou nombre de
  // bassins selon le guide. Pré-remplie depuis le profil quand cela a un sens,
  // et modifiable sans que rien ne soit enregistré.
  //
  // Elle ne peut pas être initialisée ici : `base_calcul` arrive avec le guide.
  // D'où le null de départ, résolu au chargement.
  const [taille, setTaille] = useState<number | null>(null);

  const charger = useCallback(async () => {
    if (!id) return;
    setErreur(null);

    const [resGuide, resEtapes] = await Promise.all([
      supabase.from("vue_guides").select("*").eq("itineraire_id", id).single(),
      supabase
        .from("vue_etapes_guide")
        .select("*")
        .eq("itineraire_id", id)
        .order("ordre"),
    ]);

    if (resGuide.error || !resGuide.data) {
      setErreur("Ce guide est introuvable.");
      return;
    }

    const g = resGuide.data as Guide;
    setGuide(g);
    setEtapes((resEtapes.data ?? []) as EtapeGuide[]);

    // Une seule fois : un rechargement ne doit pas écraser le palier que le
    // producteur vient de choisir.
    setTaille((actuelle) =>
      actuelle ?? tailleParDefaut(g.base_calcul, profil?.superficie_ha),
    );

    // Le reste dépend de la spéculation : on l'enchaîne une fois connue.
    const [resSaisons, resConseils, resCycles] = await Promise.all([
      supabase
        .from("saisonnalite_prix")
        .select("mois, tendance, commentaire, prix_moyen")
        .eq("speculation_id", g.speculation_id)
        .order("mois"),
      supabase
        .from("conseils_commercialisation")
        .select("id, titre, contenu, type_conseil, mois_concernes, ordre")
        .eq("speculation_id", g.speculation_id)
        .order("ordre"),
      supabase
        .from("cycles_production")
        .select("id")
        .eq("speculation_id", g.speculation_id)
        .eq("statut", "actif")
        .is("deleted_at", null),
    ]);

    setSaisons((resSaisons.data ?? []) as MoisSaisonnalite[]);
    setConseils((resConseils.data ?? []) as Conseil[]);

    // Prix de revient réel du producteur, s'il mène déjà cette culture.
    const ids = ((resCycles.data ?? []) as { id: string }[]).map((c) => c.id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("vue_rentabilite_cycles")
        .select("prix_de_revient_unitaire")
        .in("cycle_id", ids);
      const valeurs = ((data ?? []) as { prix_de_revient_unitaire: number | string | null }[])
        .map((l) => nombre(l.prix_de_revient_unitaire))
        .filter((v): v is number => v !== null && v > 0);
      setPrixRevientReel(
        valeurs.length > 0 ? valeurs.reduce((s, v) => s + v, 0) / valeurs.length : null,
      );
    }
  }, [id]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Squelette hauteur={34} largeur="70%" />
        <Squelette hauteur={48} />
        <Squelette hauteur={120} />
        <Squelette hauteur={120} />
      </Ecran>
    );
  }

  if (!guide) {
    return (
      <Ecran>
        <Titre>Guide</Titre>
        <Erreur message={erreur ?? "Guide indisponible."} />
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </Ecran>
    );
  }

  const unite = guide.unite_rendement ?? guide.unite_defaut;

  // `taille` est null tant que le chargement n'a pas eu lieu ; à ce stade le
  // guide est là, donc la valeur de départ de sa base fait un repli sûr.
  const tailleEffective = taille ?? tailleParDefaut(guide.base_calcul, profil?.superficie_ha);

  return (
    <Ecran>
      <View style={styles.entete}>
        <IllustrationEspece
          code={guide.speculation_code}
          emoji={guide.icone}
          taille={TAILLE_CARTE}
        />
        <View style={styles.enteteTextes}>
          <Titre>{guide.titre}</Titre>
          <Aide>
            {guide.speculation_nom}
            {guide.difficulte
              ? ` · ${LIBELLES_DIFFICULTE[guide.difficulte] ?? guide.difficulte}`
              : ""}
          </Aide>
        </View>
      </View>

      <Onglets onglets={ONGLETS} actif={onglet} onChange={setOnglet} />

      {onglet === "itineraire" ? (
        <OngletItineraire
          etapes={etapes}
          base={guide.base_calcul}
          taille={tailleEffective}
          onTaille={setTaille}
          sources={guide.sources}
        />
      ) : null}

      {onglet === "economie" ? (
        <OngletEconomie
          guide={guide}
          etapes={etapes}
          taille={tailleEffective}
          onTaille={setTaille}
          unite={unite}
          prixRevientReel={prixRevientReel}
        />
      ) : null}

      {onglet === "vendre" ? (
        <OngletVendre saisons={saisons} moisSemis={guide.mois_semis_conseilles} />
      ) : null}

      {onglet === "commercialisation" ? <OngletCommercialisation conseils={conseils} /> : null}

      <View style={styles.pied}>
        <Bouton
          titre="Planifier une vente"
          variante="contour"
          onPress={() =>
            router.push({
              pathname: "/(app)/planifier",
              params: { speculation_id: guide.speculation_id },
            })
          }
        />
        <Bouton
          titre="Démarrer ce cycle"
          onPress={() =>
            router.push({
              pathname: "/(app)/nouveau-cycle",
              params: {
                speculation_id: guide.speculation_id,
                speculation_nom: guide.speculation_nom,
              },
            })
          }
        />
        <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// =============================================================================
// Onglet 1 — Itinéraire
// =============================================================================
function OngletItineraire({
  etapes,
  base,
  taille,
  onTaille,
  sources,
}: {
  etapes: EtapeGuide[];
  base: string;
  taille: number;
  onTaille: (t: number) => void;
  sources: string[] | null;
}) {
  const [ouverte, setOuverte] = useState<string | null>(
    etapes.length > 0 ? etapes[0].etape_id : null,
  );
  const regles = reglesBase(base);

  return (
    <View style={styles.bloc}>
      <SelecteurTaille base={base} taille={taille} onChange={onTaille} />

      <View style={styles.frise}>
        {etapes.map((etape, index) => (
          <CarteEtape
            key={etape.etape_id}
            etape={etape}
            base={base}
            taille={taille}
            derniere={index === etapes.length - 1}
            ouverte={ouverte === etape.etape_id}
            onToggle={() =>
              setOuverte(ouverte === etape.etape_id ? null : etape.etape_id)
            }
          />
        ))}
      </View>

      {/* Mention obligatoire — visible, jamais repliable ------------------- */}
      <View style={styles.mentionDoses}>
        <Text style={styles.mentionTitre}>À propos des doses</Text>
        <Text style={styles.mentionTexte}>
          Les quantités de ce guide sont indicatives. Elles proviennent de
          fiches techniques régionales et sont {regles.mentionDoses}.
        </Text>
        <Text style={styles.mentionTexte}>
          Elles ne remplacent ni une analyse de sol, ni l'avis d'un agent
          agricole de votre zone. Votre terre, votre eau et votre climat
          peuvent commander d'autres doses.
        </Text>
        {sources && sources.length > 0 ? (
          <>
            <Text style={styles.sourcesTitre}>Sources</Text>
            {sources.map((s) => (
              <Text key={s} style={styles.source}>
                · {s}
              </Text>
            ))}
          </>
        ) : null}
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
function SelecteurTaille({
  base,
  taille,
  onChange,
}: {
  base: string;
  taille: number;
  onChange: (t: number) => void;
}) {
  const regles = reglesBase(base);
  return (
    <View style={styles.selecteur}>
      <Text style={styles.selecteurLibelle}>{regles.libelleSelecteur}</Text>
      <View style={styles.pilules}>
        {regles.tailles.map((t) => (
          <Pilule
            key={t}
            libelle={formaterTaille(base, t)}
            selectionnee={taille === t}
            onPress={() => onChange(t)}
          />
        ))}
      </View>
      <Aide>{regles.aideSelecteur}</Aide>
    </View>
  );
}

// -----------------------------------------------------------------------------
function CarteEtape({
  etape,
  base,
  taille,
  derniere,
  ouverte,
  onToggle,
}: {
  etape: EtapeGuide;
  base: string;
  taille: number;
  derniere: boolean;
  ouverte: boolean;
  onToggle: () => void;
}) {
  const [coches, setCoches] = useState<Set<number>>(new Set());
  const phase = etape.phase;
  const couleurPhase = phase ? COULEURS_PHASE[phase] : null;
  const regles = reglesBase(base);
  const cout = coutEtape(etape.intrants ?? [], taille);
  const heures = heuresPourSurface(etape.heures_travail_ha, taille);

  return (
    <View style={styles.friseLigne}>
      {/* Colonne de la frise : pastille numérotée + trait vertical */}
      <View style={styles.friseColonne}>
        <View
          style={[
            styles.pastille,
            couleurPhase ? { backgroundColor: couleurPhase.fond } : null,
          ]}
        >
          <Text
            style={[
              styles.pastilleTexte,
              couleurPhase ? { color: couleurPhase.texte } : null,
            ]}
          >
            {etape.ordre}
          </Text>
        </View>
        {!derniere ? <View style={styles.trait} /> : null}
      </View>

      <View style={styles.etapeCarte}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: ouverte }}
          onPress={onToggle}
          style={styles.etapeEntete}
        >
          <View style={styles.etapeTextes}>
            <Text style={styles.etapeTitre}>{etape.titre}</Text>
            <View style={styles.etapeMeta}>
              {phase && couleurPhase ? (
                <View style={[styles.badge, { backgroundColor: couleurPhase.fond }]}>
                  <Text style={[styles.badgeTexte, { color: couleurPhase.texte }]}>
                    {LIBELLES_PHASE[phase]}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.fenetre}>{libelleFenetre(etape)}</Text>
            </View>
          </View>
          <Text style={styles.chevron}>{ouverte ? "▾" : "▸"}</Text>
        </Pressable>

        {ouverte ? (
          <View style={styles.etapeContenu}>
            {etape.description ? (
              <Text style={styles.description}>{etape.description}</Text>
            ) : null}

            {/* Intrants ramenés à la taille choisie -------------------------- */}
            {etape.intrants && etape.intrants.length > 0 ? (
              <View style={styles.sousBloc}>
                <Text style={styles.sousTitre}>
                  Ce qu'il vous faut pour {formaterTaille(base, taille)}
                </Text>
                {etape.intrants.map((intrant) => (
                  <LigneIntrant key={intrant.id} intrant={intrant} taille={taille} />
                ))}
                {cout !== null ? (
                  <View style={styles.totalEtape}>
                    <Text style={styles.totalLibelle}>Coût estimé de l'étape</Text>
                    <Text style={styles.totalValeur}>{formaterFcfa(cout)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Erreurs fréquentes — le contenu le plus utile ---------------- */}
            {etape.erreurs_frequentes && etape.erreurs_frequentes.length > 0 ? (
              <View style={styles.blocErreurs}>
                <Text style={styles.blocErreursTitre}>Erreurs qui coûtent cher</Text>
                {etape.erreurs_frequentes.map((e) => (
                  <Text key={e} style={styles.blocErreursTexte}>
                    · {e}
                  </Text>
                ))}
              </View>
            ) : null}

            {etape.astuce ? (
              <View style={styles.blocAstuce}>
                <Text style={styles.blocAstuceTitre}>💡 Astuce</Text>
                <Text style={styles.blocAstuceTexte}>{etape.astuce}</Text>
              </View>
            ) : null}

            {/* Matériel et travail ----------------------------------------- */}
            {(etape.materiel && etape.materiel.length > 0) || heures !== null ? (
              <View style={styles.sousBloc}>
                <Text style={styles.sousTitre}>Matériel et travail</Text>
                {etape.materiel?.map((m) => (
                  <Text key={m} style={styles.materiel}>
                    · {m}
                  </Text>
                ))}
                {heures !== null ? (
                  <Text style={styles.heures}>
                    Environ {grouperChiffres(String(Math.round(heures)))} heures de
                    travail{regles.heuresEnTotal ? " au total" : ""} pour{" "}
                    {formaterTaille(base, taille)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Points de contrôle ------------------------------------------ */}
            {etape.points_de_controle && etape.points_de_controle.length > 0 ? (
              <View style={styles.sousBloc}>
                <Text style={styles.sousTitre}>Points de contrôle</Text>
                {etape.points_de_controle.map((point, i) => (
                  <CaseACocher
                    key={point}
                    libelle={point}
                    cochee={coches.has(i)}
                    onToggle={() =>
                      setCoches((prec) => {
                        const suivant = new Set(prec);
                        if (suivant.has(i)) suivant.delete(i);
                        else suivant.add(i);
                        return suivant;
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function libelleFenetre(etape: EtapeGuide): string {
  const { jour_debut: d, jour_fin: f } = etape;
  if (d === null && f === null) return "Sans fenêtre définie";
  const texte = (j: number) =>
    j < 0 ? `J${j}` : j === 0 ? "jour du repiquage" : `J+${j}`;
  if (d !== null && f !== null) return `De ${texte(d)} à ${texte(f)}`;
  return texte((d ?? f) as number);
}

// -----------------------------------------------------------------------------
function LigneIntrant({ intrant, taille }: { intrant: Intrant; taille: number }) {
  const quantite = doseSurface(intrant.quantite_par_ha, taille);
  const unites = conditionnementsNecessaires(quantite, intrant.taille_conditionnement);
  const prix = nombre(intrant.prix_indicatif_unite);

  return (
    <View style={styles.intrant}>
      <View style={styles.intrantEntete}>
        <Text style={styles.intrantNom}>{intrant.nom}</Text>
        <Text style={styles.intrantQuantite}>
          {formaterQuantite(quantite, intrant.unite)}
        </Text>
      </View>

      {/* Un producteur achète des sacs, pas des kilos. */}
      {unites !== null && intrant.conditionnement ? (
        <Text style={styles.intrantAchat}>
          soit {unites} {intrant.conditionnement}
          {unites > 1 ? "s" : ""} à acheter
          {prix !== null ? ` · ${formaterFcfa(prix * unites)}` : ""}
        </Text>
      ) : null}

      {intrant.consigne ? (
        <Text style={styles.intrantConsigne}>{intrant.consigne}</Text>
      ) : null}

      {intrant.substitut_local ? (
        <Text style={styles.intrantSubstitut}>
          À défaut : {intrant.substitut_local}
        </Text>
      ) : null}
    </View>
  );
}

// =============================================================================
// Onglet 2 — Économie
// =============================================================================
function OngletEconomie({
  guide,
  etapes,
  taille,
  onTaille,
  unite,
  prixRevientReel,
}: {
  guide: Guide;
  etapes: EtapeGuide[];
  taille: number;
  onTaille: (t: number) => void;
  unite: string;
  prixRevientReel: number | null;
}) {
  const [prixVente, setPrixVente] = useState("");

  const base = guide.base_calcul;
  const regles = reglesBase(base);
  // Les colonnes s'appellent *_ha, mais elles portent une valeur par tête ou
  // par bassin quand le guide le dit. Le produit est le même dans les trois cas.
  const coutUnitaire = nombre(guide.cout_indicatif_ha);
  const coutTotal = coutUnitaire !== null ? coutUnitaire * taille : null;
  const rendMin = nombre(guide.rendement_min_ha);
  const rendMax = nombre(guide.rendement_max_ha);
  const recolteMin = rendMin !== null ? rendMin * taille : null;
  const recolteMax = rendMax !== null ? rendMax * taille : null;

  // Les taux unitaires ne sont montrés que hors hectare. Les guides de culture
  // doivent s'afficher exactement comme avant l'arrivée de base_calcul.
  const montrerTaux = base !== "hectare";

  const prix = nombre(prixVente);
  const caMin = prix !== null && recolteMin !== null ? prix * recolteMin : null;
  const caMax = prix !== null && recolteMax !== null ? prix * recolteMax : null;
  const margeMin = caMin !== null && coutTotal !== null ? caMin - coutTotal : null;
  const margeMax = caMax !== null && coutTotal !== null ? caMax - coutTotal : null;

  // Prix de revient issu du guide, à la fourchette basse de rendement : c'est
  // l'hypothèse prudente, la seule sur laquelle on peut bâtir une trésorerie.
  const revientGuide =
    coutTotal !== null && recolteMin !== null && recolteMin > 0
      ? coutTotal / recolteMin
      : null;

  return (
    <View style={styles.bloc}>
      <SelecteurTaille base={base} taille={taille} onChange={onTaille} />

      <View style={styles.carteEco}>
        <Text style={styles.ecoTitre}>Ce que ça coûte</Text>
        {montrerTaux ? (
          <LigneEco
            libelle={`Coût ${regles.parUnite}`}
            valeur={coutUnitaire !== null ? formaterFcfa(coutUnitaire) : "—"}
          />
        ) : null}
        <LigneEco
          libelle={`${regles.verbeTotal} ${formaterTaille(base, taille)}`}
          valeur={coutTotal !== null ? formaterFcfa(coutTotal) : "—"}
          fort
        />
        <Aide>Hors main-d'œuvre familiale et hors amortissement du matériel.</Aide>
      </View>

      <View style={styles.carteEco}>
        <Text style={styles.ecoTitre}>Ce que ça peut rapporter</Text>
        {montrerTaux ? (
          <LigneEco
            libelle={`Rendement ${regles.parUnite}`}
            valeur={
              rendMin !== null && rendMax !== null
                ? `${formaterQuantite(rendMin, unite)} à ${formaterQuantite(rendMax, unite)}`
                : "—"
            }
          />
        ) : null}
        <LigneEco
          libelle="Récolte attendue"
          valeur={
            recolteMin !== null && recolteMax !== null
              ? `${formaterQuantite(recolteMin, unite)} à ${formaterQuantite(recolteMax, unite)}`
              : "—"
          }
        />

        <View style={styles.champPrix}>
          <Text style={styles.champLibelle}>À quel prix comptez-vous vendre ?</Text>
          <View style={styles.champLigne}>
            <TextInput
              style={styles.champSaisie}
              value={grouperChiffres(prixVente)}
              onChangeText={(v) => setPrixVente(v.replace(/\D/g, "").slice(0, 7))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={couleurs.ligne}
              accessibilityLabel={`Prix de vente par ${unite}`}
            />
            <Text style={styles.champUnite}>F/{unite}</Text>
          </View>
        </View>

        {caMin !== null && caMax !== null ? (
          <>
            <LigneEco
              libelle="Chiffre d'affaires estimé"
              valeur={`${formaterFcfa(caMin)} à ${formaterFcfa(caMax)}`}
            />
            <LigneEco
              libelle="Marge projetée"
              valeur={
                margeMin !== null && margeMax !== null
                  ? `${formaterFcfa(margeMin)} à ${formaterFcfa(margeMax)}`
                  : "—"
              }
              fort
              couleur={margeMin !== null && margeMin < 0 ? couleurs.rouge : couleurs.vertFonce}
            />
            {margeMin !== null && margeMin < 0 ? (
              <Text style={styles.avertissementEco}>
                À ce prix, l'hypothèse basse de rendement ne couvre pas vos coûts.
              </Text>
            ) : null}
          </>
        ) : (
          <Aide>Saisissez un prix pour voir votre marge projetée.</Aide>
        )}
      </View>

      {/* Comparaison guide / réalité du producteur ------------------------- */}
      <View style={styles.carteEco}>
        <Text style={styles.ecoTitre}>Votre prix de revient</Text>
        <LigneEco
          libelle="Estimé par ce guide"
          valeur={revientGuide !== null ? `${formaterFcfa(revientGuide)}/${unite}` : "—"}
        />
        {prixRevientReel !== null ? (
          <>
            <LigneEco
              libelle="Le vôtre, sur vos cycles en cours"
              valeur={`${formaterFcfa(prixRevientReel)}/${unite}`}
              fort
              couleur={
                revientGuide !== null && prixRevientReel > revientGuide
                  ? couleurs.rouge
                  : couleurs.vertFonce
              }
            />
            {revientGuide !== null ? (
              <Text style={styles.comparaison}>
                {prixRevientReel > revientGuide
                  ? "Vous produisez plus cher que le guide. Regardez vos dépenses par poste : c'est souvent l'eau ou le transport."
                  : "Vous produisez moins cher que l'estimation du guide. C'est un argument à opposer à un acheteur."}
              </Text>
            ) : null}
          </>
        ) : (
          <Aide>
            Enregistrez vos dépenses et vos récoltes sur un cycle de cette
            culture pour comparer avec votre coût réel.
          </Aide>
        )}
      </View>

      <Aide>
        {etapes.length} étapes composent cet itinéraire. Les coûts détaillés par
        étape figurent dans l'onglet Itinéraire.
      </Aide>
    </View>
  );
}

function LigneEco({
  libelle,
  valeur,
  fort,
  couleur,
}: {
  libelle: string;
  valeur: string;
  fort?: boolean;
  couleur?: string;
}) {
  return (
    <View style={styles.ligneEco}>
      <Text style={styles.ligneEcoLibelle}>{libelle}</Text>
      <Text
        style={[
          styles.ligneEcoValeur,
          fort && styles.ligneEcoValeurForte,
          couleur ? { color: couleur } : null,
        ]}
      >
        {valeur}
      </Text>
    </View>
  );
}

// =============================================================================
// Onglet 3 — Quand vendre
// =============================================================================
const COULEURS_TENDANCE = {
  // Contre-intuitif et assumé : l'abondance est une mauvaise nouvelle pour le
  // producteur. Tout le monde récolte en même temps, les prix s'effondrent.
  abondance: { fond: couleurs.rouge, hauteur: 0.35, libelle: "Prix bas" },
  normal: { fond: couleurs.attenue, hauteur: 0.6, libelle: "Prix moyens" },
  penurie: { fond: couleurs.vert, hauteur: 1, libelle: "Prix hauts" },
} as const;

function OngletVendre({
  saisons,
  moisSemis,
}: {
  saisons: MoisSaisonnalite[];
  moisSemis: number[] | null;
}) {
  const [moisOuvert, setMoisOuvert] = useState<number | null>(null);
  const semis = useMemo(() => new Set(moisSemis ?? []), [moisSemis]);
  const parMois = useMemo(
    () => new Map(saisons.map((s) => [s.mois, s])),
    [saisons],
  );
  const detail = moisOuvert !== null ? parMois.get(moisOuvert) : null;

  if (saisons.length === 0) {
    return (
      <View style={styles.bloc}>
        <Aide>La saisonnalité des prix n'est pas encore documentée pour cette culture.</Aide>
      </View>
    );
  }

  return (
    <View style={styles.bloc}>
      {/* La légende vient AVANT le graphique : sans elle, un producteur lit
          « abondance » comme une bonne nouvelle. */}
      <View style={styles.legende}>
        <Text style={styles.legendeTitre}>Comment lire ce calendrier</Text>
        <Text style={styles.legendeTexte}>
          Les barres montrent le prix que vous pouvez espérer, pas la quantité
          produite dans la région.
        </Text>
        <View style={styles.legendeLignes}>
          <LigneLegende
            couleur={couleurs.rouge}
            titre="Abondance — prix bas"
            texte="Tout le monde récolte. Mauvaise période pour vendre."
          />
          <LigneLegende
            couleur={couleurs.attenue}
            titre="Normal — prix moyens"
            texte="Offre et demande équilibrées."
          />
          <LigneLegende
            couleur={couleurs.vert}
            titre="Pénurie — prix hauts"
            texte="Peu de produit sur le marché. Bonne période pour vendre."
          />
        </View>
      </View>

      <View style={styles.graphique}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((mois) => {
          const donnee = parMois.get(mois);
          const style = donnee ? COULEURS_TENDANCE[donnee.tendance] : null;
          const estSemis = semis.has(mois);
          return (
            <Pressable
              key={mois}
              accessibilityRole="button"
              accessibilityLabel={`${MOIS_LONGS[mois - 1]} : ${
                donnee ? COULEURS_TENDANCE[donnee.tendance].libelle : "non documenté"
              }`}
              onPress={() => setMoisOuvert(moisOuvert === mois ? null : mois)}
              style={styles.colonne}
            >
              <View style={styles.zoneBarre}>
                <View
                  style={[
                    styles.barre,
                    style
                      ? { backgroundColor: style.fond, height: `${style.hauteur * 100}%` }
                      : { backgroundColor: couleurs.ligne, height: "20%" },
                    moisOuvert === mois && styles.barreActive,
                  ]}
                />
              </View>
              <Text style={[styles.moisTexte, estSemis && styles.moisSemis]}>
                {MOIS_COURTS[mois - 1]}
              </Text>
              {estSemis ? <Text style={styles.marqueSemis}>🌱</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <Aide>Appuyez sur un mois pour lire le détail. 🌱 = semis conseillé.</Aide>

      {detail ? (
        <View style={styles.detailMois}>
          <View style={styles.detailEntete}>
            <Text style={styles.detailTitre}>{MOIS_LONGS[detail.mois - 1]}</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: COULEURS_TENDANCE[detail.tendance].fond },
              ]}
            >
              <Text style={[styles.badgeTexte, { color: couleurs.blanc }]}>
                {COULEURS_TENDANCE[detail.tendance].libelle}
              </Text>
            </View>
          </View>
          {detail.commentaire ? (
            <Text style={styles.detailTexte}>{detail.commentaire}</Text>
          ) : null}
        </View>
      ) : null}

      {semis.size > 0 ? (
        <View style={styles.encartSemis}>
          <Text style={styles.encartSemisTitre}>🌱 Semis conseillés</Text>
          <Text style={styles.encartSemisTexte}>
            {[...semis]
              .sort((a, b) => a - b)
              .map((m) => MOIS_LONGS[m - 1])
              .join(", ")}
            . Semer à ces mois-là vise les fenêtres où les prix sont les plus
            élevés.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function LigneLegende({
  couleur,
  titre,
  texte,
}: {
  couleur: string;
  titre: string;
  texte: string;
}) {
  return (
    <View style={styles.ligneLegende}>
      <View style={[styles.pastilleLegende, { backgroundColor: couleur }]} />
      <View style={styles.legendeTextes}>
        <Text style={styles.legendeLigneTitre}>{titre}</Text>
        <Text style={styles.legendeLigneTexte}>{texte}</Text>
      </View>
    </View>
  );
}

// =============================================================================
// Onglet 4 — Commercialisation
// =============================================================================
function OngletCommercialisation({ conseils }: { conseils: Conseil[] }) {
  const groupes = useMemo(() => {
    const map = new Map<TypeConseil, Conseil[]>();
    for (const c of conseils) {
      const liste = map.get(c.type_conseil) ?? [];
      liste.push(c);
      map.set(c.type_conseil, liste);
    }
    return [...map.entries()];
  }, [conseils]);

  if (conseils.length === 0) {
    return (
      <View style={styles.bloc}>
        <Aide>Les conseils de commercialisation ne sont pas encore écrits pour cette culture.</Aide>
      </View>
    );
  }

  return (
    <View style={styles.bloc}>
      {groupes.map(([type, liste]) => {
        const meta = LIBELLES_CONSEIL[type] ?? { libelle: type, emoji: "•" };
        return (
          <View key={type} style={styles.groupeConseil}>
            <View style={styles.groupeEntete}>
              <Text style={styles.groupeEmoji}>{meta.emoji}</Text>
              <SousTitre>{meta.libelle}</SousTitre>
            </View>
            {liste.map((c) => (
              <View key={c.id} style={styles.conseil}>
                <Text style={styles.conseilTitre}>{c.titre}</Text>
                <Text style={styles.conseilTexte}>{c.contenu}</Text>
                {c.mois_concernes && c.mois_concernes.length > 0 ? (
                  <Text style={styles.conseilMois}>
                    Concerne : {c.mois_concernes.map((m) => MOIS_LONGS[m - 1]).join(", ")}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

// =============================================================================
const styles = StyleSheet.create({
  bloc: { gap: espaces.md },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: espaces.sm },
  pied: { marginTop: espaces.lg, gap: espaces.sm },

  entete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.md,
  },
  enteteTextes: { flex: 1, gap: espaces.xs },

  selecteur: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.vert,
  },
  selecteurLibelle: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },

  // --- frise -----------------------------------------------------------------
  frise: { gap: 0 },
  friseLigne: { flexDirection: "row", gap: espaces.md },
  friseColonne: { alignItems: "center", width: 40 },
  pastille: {
    width: 40,
    height: 40,
    borderRadius: rayons.rond,
    backgroundColor: couleurs.attenue,
    alignItems: "center",
    justifyContent: "center",
  },
  pastilleTexte: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.blanc,
  },
  trait: {
    flex: 1,
    width: 3,
    backgroundColor: couleurs.ligne,
    marginVertical: espaces.xs,
  },
  etapeCarte: {
    flex: 1,
    marginBottom: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  etapeEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
    minHeight: CIBLE_TACTILE,
    padding: espaces.md,
  },
  etapeTextes: { flex: 1, gap: espaces.xs },
  etapeTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  etapeMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: espaces.sm,
  },
  badge: {
    paddingHorizontal: espaces.sm,
    paddingVertical: 3,
    borderRadius: rayons.rond,
  },
  badgeTexte: { fontSize: 13, fontWeight: "700" },
  fenetre: { fontSize: textes.petit, color: couleurs.attenue },
  chevron: { fontSize: textes.sousTitre, color: couleurs.attenue },

  etapeContenu: {
    gap: espaces.md,
    paddingHorizontal: espaces.md,
    paddingBottom: espaces.md,
  },
  description: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },
  sousBloc: { gap: espaces.sm },
  sousTitre: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.attenue,
    textTransform: "uppercase",
  },

  intrant: {
    gap: 2,
    padding: espaces.sm,
    borderRadius: rayons.sm,
    backgroundColor: couleurs.papier,
  },
  intrantEntete: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
  },
  intrantNom: {
    flex: 1,
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },
  intrantQuantite: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },
  intrantAchat: {
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },
  intrantConsigne: {
    fontSize: 14,
    lineHeight: 20,
    color: couleurs.attenue,
  },
  intrantSubstitut: {
    fontSize: 14,
    fontStyle: "italic",
    color: couleurs.attenue,
  },
  totalEtape: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: espaces.sm,
    borderTopWidth: 2,
    borderTopColor: couleurs.ligne,
  },
  totalLibelle: { fontSize: textes.petit, color: couleurs.attenue },
  totalValeur: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },

  blocErreurs: {
    gap: espaces.xs,
    padding: espaces.md,
    borderRadius: rayons.sm,
    backgroundColor: "#FDECEE",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.rouge,
  },
  blocErreursTitre: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.rouge,
  },
  blocErreursTexte: {
    fontSize: 14,
    lineHeight: 21,
    color: couleurs.encre,
  },
  blocAstuce: {
    gap: espaces.xs,
    padding: espaces.md,
    borderRadius: rayons.sm,
    backgroundColor: "#FFF8E1",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.or,
  },
  blocAstuceTitre: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },
  blocAstuceTexte: {
    fontSize: 14,
    lineHeight: 21,
    color: couleurs.encre,
  },
  materiel: { fontSize: 14, lineHeight: 21, color: couleurs.encre },
  heures: {
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
    marginTop: espaces.xs,
  },

  mentionDoses: {
    gap: espaces.sm,
    marginTop: espaces.md,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: "#FFF8E1",
    borderWidth: 2,
    borderColor: couleurs.or,
  },
  mentionTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  mentionTexte: {
    fontSize: textes.petit,
    lineHeight: 21,
    color: couleurs.encre,
  },
  sourcesTitre: {
    fontSize: 14,
    fontWeight: "700",
    color: couleurs.attenue,
    marginTop: espaces.xs,
  },
  source: { fontSize: 13, lineHeight: 19, color: couleurs.attenue },

  // --- économie --------------------------------------------------------------
  carteEco: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  ecoTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  ligneEco: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
  },
  ligneEcoLibelle: {
    flex: 1,
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  ligneEcoValeur: {
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
    textAlign: "right",
  },
  ligneEcoValeurForte: { fontSize: textes.corps, fontWeight: "700" },
  avertissementEco: {
    fontSize: textes.petit,
    color: couleurs.rouge,
  },
  comparaison: {
    fontSize: textes.petit,
    lineHeight: 21,
    color: couleurs.attenue,
  },
  champPrix: { gap: espaces.sm, marginVertical: espaces.sm },
  champLibelle: {
    fontSize: textes.petit,
    fontWeight: "600",
    color: couleurs.encre,
  },
  champLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  champSaisie: {
    flex: 1,
    minHeight: CIBLE_TACTILE,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    borderRadius: rayons.md,
    paddingHorizontal: espaces.md,
    fontSize: textes.sousTitre,
    fontWeight: "700",
    color: couleurs.encre,
  },
  champUnite: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.attenue,
  },

  // --- saisonnalité ----------------------------------------------------------
  legende: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  legendeTitre: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  legendeTexte: {
    fontSize: textes.petit,
    lineHeight: 21,
    color: couleurs.attenue,
  },
  legendeLignes: { gap: espaces.sm, marginTop: espaces.xs },
  ligneLegende: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: espaces.sm,
  },
  pastilleLegende: {
    width: 18,
    height: 18,
    borderRadius: rayons.sm,
    marginTop: 2,
  },
  legendeTextes: { flex: 1 },
  legendeLigneTitre: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },
  legendeLigneTexte: { fontSize: 14, color: couleurs.attenue },

  graphique: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 180,
    padding: espaces.sm,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  colonne: { flex: 1, alignItems: "center", gap: 2, height: "100%" },
  zoneBarre: { flex: 1, width: "100%", justifyContent: "flex-end" },
  barre: { width: "100%", borderRadius: rayons.sm },
  barreActive: { borderWidth: 3, borderColor: couleurs.encre },
  moisTexte: { fontSize: 12, color: couleurs.attenue },
  moisSemis: { fontWeight: "700", color: couleurs.encre },
  marqueSemis: { fontSize: 11 },

  detailMois: {
    gap: espaces.sm,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.encre,
  },
  detailEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  detailTitre: {
    flex: 1,
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
    textTransform: "capitalize",
  },
  detailTexte: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },
  encartSemis: {
    gap: espaces.xs,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: "#EAF6EE",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.vert,
  },
  encartSemisTitre: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },
  encartSemisTexte: {
    fontSize: textes.petit,
    lineHeight: 21,
    color: couleurs.encre,
  },

  // --- commercialisation -----------------------------------------------------
  groupeConseil: { gap: espaces.sm },
  groupeEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  groupeEmoji: { fontSize: textes.sousTitre },
  conseil: {
    gap: espaces.xs,
    padding: espaces.md,
    borderRadius: rayons.md,
    backgroundColor: couleurs.blanc,
    borderWidth: 2,
    borderColor: couleurs.ligne,
  },
  conseilTitre: {
    fontSize: textes.petit,
    fontWeight: "700",
    color: couleurs.encre,
  },
  conseilTexte: {
    fontSize: textes.petit,
    lineHeight: 22,
    color: couleurs.encre,
  },
  conseilMois: {
    fontSize: 14,
    fontStyle: "italic",
    color: couleurs.attenue,
  },
});
