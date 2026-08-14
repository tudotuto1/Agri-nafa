// =============================================================================
// Enregistrement d'une vente.
//
// Le total encaissé est affiché en grand sous les deux champs qui le
// produisent : c'est le seul chiffre que le producteur vérifie avant de
// valider, et le seul qu'il retiendra.
//
// revenu_total n'est JAMAIS envoyé : c'est une colonne générée par la base
// (quantite_vendue * prix_unitaire). Toute écriture est rejetée en 428C9.
// Le total affiché ici n'est qu'un aperçu ; la vérité reste calculée en base.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TextInput, View } from "react-native";

import {
  Aide,
  BandeauContexte,
  Avertissement,
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
// Valeurs de l'enum mode_paiement, dans l'ordre de la base.
// -----------------------------------------------------------------------------
type ModePaiement =
  | "especes"
  | "orange_money"
  | "moov_money"
  | "telecel"
  | "wave"
  | "virement"
  | "credit";

const MODES: { code: ModePaiement; libelle: string; emoji: string }[] = [
  { code: "especes", libelle: "Espèces", emoji: "💵" },
  { code: "orange_money", libelle: "Orange Money", emoji: "📱" },
  { code: "moov_money", libelle: "Moov Money", emoji: "📱" },
  { code: "telecel", libelle: "Telecel", emoji: "📱" },
  { code: "wave", libelle: "Wave", emoji: "🌊" },
  { code: "virement", libelle: "Virement", emoji: "🏦" },
  { code: "credit", libelle: "Crédit", emoji: "🤝" },
];

// =============================================================================
export default function EcranVente() {
  const router = useRouter();
  const { session } = useAuth();

  const [quantite, setQuantite] = useState("");
  const [prix, setPrix] = useState("");
  const [client, setClient] = useState("");
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [acompte, setAcompte] = useState("");
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [dateSaisie, setDateSaisie] = useState(isoVersAffichage(aujourdhuiIso()));

  const { cycles, chargement, erreur: erreurCycles } = useCyclesActifs();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Un seul cycle : aucun choix à faire, le champ reste masqué.
  useEffect(() => {
    if (cycles.length === 1) setCycleId(cycles[0].id);
  }, [cycles]);

  // ---------------------------------------------------------------------------
  const cycleChoisi = useMemo(
    () => cycles.find((c) => c.id === cycleId) ?? null,
    [cycles, cycleId],
  );

  const quantiteNombre = Number(quantite || "0");
  const prixNombre = Number(prix || "0");
  const acompteNombre = Number(acompte || "0");
  const total = quantiteNombre * prixNombre;

  const dateIso = useMemo(() => affichageVersIso(dateSaisie), [dateSaisie]);
  const dateInvalide = dateSaisie.trim().length > 0 && dateIso === null;

  // Garde-fou métier, volontairement non bloquant : le producteur peut vendre
  // sur pied, ou n'avoir pas encore saisi sa récolte. Il en sait plus que
  // l'application — on l'informe, on ne lui interdit rien.
  const alerteStock = useMemo(() => {
    if (!cycleChoisi || quantiteNombre <= 0) return null;
    const restant = cycleChoisi.quantiteRestante;
    if (restant === null || quantiteNombre <= restant) return null;

    const u = cycleChoisi.unite;
    return restant === 0
      ? `Aucune récolte n'est encore enregistrée sur ce cycle. Si vous vendez sur pied, continuez : la vente sera enregistrée.`
      : `Vous vendez ${grouperChiffres(String(quantiteNombre))} ${u} alors que ${grouperChiffres(
          String(restant),
        )} ${u} seulement restent en récolte enregistrée. Vente sur pied ou récolte non saisie ? La vente sera enregistrée quand même.`;
  }, [cycleChoisi, quantiteNombre]);

  // Un acompte encaisse ne peut pas depasser ce que la vente rapporte : la base
  // le refuse depuis securite_lot1. On le dit ici plutot que de laisser partir
  // l'ecriture — hors ligne elle serait mise en file, et ne serait rejetee
  // qu'a la reconnexion, loin de l'ecran ou la faute a ete faite.
  const acompteExcessif = acompteNombre > total && total > 0;

  const pret =
    quantiteNombre > 0 &&
    prixNombre > 0 &&
    !acompteExcessif &&
    cycleId !== null &&
    dateIso !== null &&
    !envoi;

  const enregistrer = useCallback(async () => {
    if (!pret || !session?.user || !cycleId || !dateIso) return;

    setEnvoi(true);
    setErreur(null);

    // revenu_total est absent de cet objet, et doit le rester.
    const { enFile, erreur: refus } = await ajouter("ventes", {
      user_id: session.user.id,
      cycle_id: cycleId,
      client_nom: client.trim() || null,
      quantite_vendue: quantiteNombre,
      prix_unitaire: prixNombre,
      acompte_recu: acompteNombre,
      mode_paiement: mode,
      date_vente: dateIso,
    });

    if (refus) {
      setEnvoi(false);
      setErreur(messageErreurLisible(refus, "la vente"));
      return;
    }

    router.dismissTo({
      pathname: "/(app)/accueil",
      params: {
        vente_enregistree: String(total),
        en_attente: enFile ? "1" : "",
      },
    });
  }, [
    pret,
    session,
    cycleId,
    dateIso,
    client,
    quantiteNombre,
    prixNombre,
    acompteNombre,
    mode,
    total,
    router,
  ]);

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Nouvelle vente</Titre>
        <Squelette hauteur={90} />
        <Squelette hauteur={90} />
        <Squelette hauteur={110} />
      </Ecran>
    );
  }

  if (cycles.length === 0) {
    return (
      <Ecran>
        <Titre>Nouvelle vente</Titre>
        <View style={styles.vide}>
          <Text style={styles.videEmoji}>🌱</Text>
          <SousTitre>Aucun cycle en cours</SousTitre>
          <Aide>
            Une vente se rattache toujours à une production. Créez d'abord un
            cycle, puis revenez enregistrer vos ventes.
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
      <Titre>Nouvelle vente</Titre>

      {/* Contexte — visible dès qu'il n'y a qu'un cycle, là où le sélecteur
          disparaît. Ce qui n'a pas à être choisi doit quand même être su. */}
      {cycles.length === 1 ? (
        <BandeauContexte
          emoji={cycles[0].icone}
          principal={cycles[0].speculation ?? cycles[0].nom}
          secondaire={cycles[0].parcelle}
        />
      ) : null}

      {/* 1. Quantité -------------------------------------------------------- */}
      <View style={styles.blocChiffre}>
        <Text style={styles.chiffreLibelle}>Quantité vendue</Text>
        <View style={styles.chiffreLigne}>
          <TextInput
            style={styles.chiffreChamp}
            value={grouperChiffres(quantite)}
            onChangeText={(v) => setQuantite(v.replace(/\D/g, "").slice(0, 9))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={couleurs.ligne}
            autoFocus
            accessibilityLabel="Quantité vendue"
          />
          <Text style={styles.chiffreUnite}>{unite}</Text>
        </View>
      </View>

      {/* 2. Prix unitaire --------------------------------------------------- */}
      <View style={styles.blocChiffre}>
        <Text style={styles.chiffreLibelle}>Prix par {unite}</Text>
        <View style={styles.chiffreLigne}>
          <TextInput
            style={styles.chiffreChamp}
            value={grouperChiffres(prix)}
            onChangeText={(v) => setPrix(v.replace(/\D/g, "").slice(0, 9))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={couleurs.ligne}
            accessibilityLabel="Prix unitaire en francs CFA"
          />
          <Text style={styles.chiffreUnite}>F</Text>
        </View>
      </View>

      {/* Total — le chiffre que le producteur vérifie avant de valider ------ */}
      <View style={styles.blocTotal}>
        <Text style={styles.totalLibelle}>Total de la vente</Text>
        <Text style={styles.totalMontant} adjustsFontSizeToFit numberOfLines={1}>
          {formaterFcfa(total)}
        </Text>
        {quantiteNombre > 0 && prixNombre > 0 ? (
          <Text style={styles.totalDetail}>
            {grouperChiffres(String(quantiteNombre))} {unite} ×{" "}
            {formaterFcfa(prixNombre)}
          </Text>
        ) : null}
      </View>

      <Avertissement message={alerteStock} />

      {/* 3. Client ---------------------------------------------------------- */}
      <Champ
        libelle="Client (facultatif)"
        value={client}
        onChangeText={setClient}
        placeholder="Ex. Ali, bana-bana de Sankariaré"
        autoCapitalize="words"
      />

      {/* 4. Mode de paiement ------------------------------------------------ */}
      <View style={styles.bloc}>
        <Text style={styles.libelle}>Comment avez-vous été payé ?</Text>
        <View style={styles.pilules}>
          {MODES.map((m) => (
            <Pilule
              key={m.code}
              libelle={m.libelle}
              emoji={m.emoji}
              selectionnee={mode === m.code}
              onPress={() => setMode(m.code)}
            />
          ))}
        </View>
      </View>

      {/* 5. Acompte --------------------------------------------------------- */}
      <Champ
        libelle="Acompte déjà reçu (facultatif)"
        value={grouperChiffres(acompte)}
        onChangeText={(v) => setAcompte(v.replace(/\D/g, "").slice(0, 12))}
        placeholder="0"
        keyboardType="number-pad"
      />
      <Erreur
        message={
          acompteExcessif
            ? `L'acompte dépasse le total de la vente (${formaterFcfa(total)}). Un acompte est une avance : il ne peut pas être plus grand que ce qui est vendu.`
            : null
        }
      />

      {/* 6. Cycle — masqué s'il n'y en a qu'un ------------------------------ */}
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

      {/* 7. Date ------------------------------------------------------------ */}
      <View style={styles.bloc}>
        <Champ
          libelle="Date de la vente"
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
        titre="Enregistrer la vente"
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

  blocTotal: {
    gap: espaces.xs,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: "#EAF6EE",
    borderWidth: 2,
    borderColor: couleurs.vert,
  },
  totalLibelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.attenue,
  },
  totalMontant: {
    fontSize: 40,
    fontWeight: "700",
    color: couleurs.vert,
  },
  totalDetail: {
    fontSize: textes.petit,
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
