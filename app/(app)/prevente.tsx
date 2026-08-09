// =============================================================================
// Fiche de prévente.
//
// La pièce centrale du modèle commercial : vendre avant de récolter, et
// sécuriser un acompte. Un producteur qui a encaissé 30 % en avance ne brade
// plus sa récolte le jour où le bana-bana se présente au champ.
//
// L'écran ne se contente pas d'enregistrer une intention : il compose le
// message, le montre tel qu'il partira, et l'envoie. Le texte est le produit.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  Aide,
  Avertissement,
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
import { useCyclesActifs } from "@/lib/cycles";
import { messageErreurLisible } from "@/lib/erreurs";
import { ajouter } from "@/lib/file-attente";
import {
  affichageVersIso,
  aujourdhuiIso,
  formaterFcfa,
  formaterTelephone,
  grouperChiffres,
  isoVersAffichage,
  urlsWhatsapp,
} from "@/lib/format";
import { composerTextePrevente, montantAcompte } from "@/lib/prevente";
import { supabase } from "@/lib/supabase";

const ACOMPTES = [0, 20, 30, 50];

type Grossiste = {
  id: string;
  nom: string;
  telephone_whatsapp: string | null;
  prefere_message_vocal: boolean;
  ville: string | null;
};

// =============================================================================
export default function EcranPrevente() {
  const router = useRouter();
  const { session, profil } = useAuth();
  const { cycles, chargement, erreur: erreurCycles } = useCyclesActifs();

  const [cycleId, setCycleId] = useState<string | null>(null);
  const [quantite, setQuantite] = useState("");
  const [dateSaisie, setDateSaisie] = useState("");
  const [prix, setPrix] = useState("");
  const [lieu, setLieu] = useState(profil?.localite ?? "");
  const [acomptePourcent, setAcomptePourcent] = useState(30);

  const [grossistes, setGrossistes] = useState<Grossiste[]>([]);
  const [choixAcheteur, setChoixAcheteur] = useState(false);
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [enFileAttente, setEnFileAttente] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    if (cycles.length === 1) setCycleId(cycles[0].id);
  }, [cycles]);

  useEffect(() => {
    supabase
      .from("grossistes")
      .select("id, nom, telephone_whatsapp, prefere_message_vocal, ville")
      .is("deleted_at", null)
      .not("telephone_whatsapp", "is", null)
      .order("note_fiabilite", { ascending: false, nullsFirst: false })
      .order("nom")
      .then(({ data }) => setGrossistes((data ?? []) as Grossiste[]));
  }, []);

  const cycleChoisi = useMemo(
    () => cycles.find((c) => c.id === cycleId) ?? null,
    [cycles, cycleId],
  );

  // Choisir un cycle repropose ses valeurs : le reliquat de récolte et la date
  // de fin prévue. Toute modification ultérieure est conservée jusqu'au
  // changement de cycle suivant.
  useEffect(() => {
    if (!cycleChoisi) return;
    const restant = cycleChoisi.quantiteRestante;
    setQuantite(restant !== null && restant > 0 ? String(Math.round(restant)) : "");
    setDateSaisie(
      cycleChoisi.dateFinPrevue ? isoVersAffichage(cycleChoisi.dateFinPrevue) : "",
    );
    // La fiche précédente ne vaut plus pour un autre cycle.
    setFicheId(null);
  }, [cycleChoisi]);

  const quantiteNombre = Number(quantite || "0");
  const prixNombre = prix ? Number(prix) : null;
  const dateIso = useMemo(() => affichageVersIso(dateSaisie), [dateSaisie]);
  const dateInvalide = dateSaisie.trim().length > 0 && dateIso === null;
  const unite = cycleChoisi?.unite ?? "unité";
  const produit = cycleChoisi?.speculation ?? cycleChoisi?.nom ?? "Ma production";

  // Vendre sous son prix de revient, c'est vendre à perte. Le producteur peut
  // avoir de bonnes raisons de le faire — besoin de liquidités, récolte
  // périssable. On le lui dit, on ne l'empêche pas.
  const alertePrix = useMemo(() => {
    const revient = cycleChoisi?.prixDeRevient ?? null;
    if (revient === null || revient <= 0 || prixNombre === null || prixNombre <= 0) {
      return null;
    }
    if (prixNombre >= revient) return null;
    const perte = (revient - prixNombre) * quantiteNombre;
    return `À ${formaterFcfa(prixNombre)}/${unite}, vous vendez en dessous de vos ${formaterFcfa(
      revient,
    )}/${unite} de prix de revient${
      quantiteNombre > 0 ? `, soit ${formaterFcfa(perte)} de perte sur ce lot` : ""
    }. Si c'est un choix assumé, continuez.`;
  }, [cycleChoisi, prixNombre, quantiteNombre, unite]);

  const donnees = useMemo(
    () => ({
      produit,
      quantite: quantiteNombre,
      unite,
      dateDisponibilite: dateIso ?? aujourdhuiIso(),
      lieu: lieu.trim() || null,
      prixUnitaire: prixNombre,
      acomptePourcent,
    }),
    [produit, quantiteNombre, unite, dateIso, lieu, prixNombre, acomptePourcent],
  );

  const texte = useMemo(() => composerTextePrevente(donnees), [donnees]);
  const acompte = montantAcompte(donnees);

  const pret = quantiteNombre > 0 && cycleId !== null && dateIso !== null;

  // ---------------------------------------------------------------------------
  // La fiche est enregistrée avant tout partage : si WhatsApp ne s'ouvre pas,
  // ou si le producteur ferme l'application, l'annonce existe quand même.
  const assurerFiche = useCallback(async (): Promise<string | null> => {
    if (ficheId) return ficheId;
    if (!session?.user || !cycleId || !dateIso) return null;

    // publiee_at part dans l'insertion, pas dans une mise à jour ultérieure :
    // la fiche est créée au moment même du partage, et une mise à jour ne
    // saurait pas attendre le réseau — seules les insertions se mettent en
    // file. Un aller-retour de moins, et rien à rattraper hors ligne.
    const { id, enFile, erreur: refus } = await ajouter("fiches_prevente", {
      user_id: session.user.id,
      cycle_id: cycleId,
      quantite_prevue: quantiteNombre,
      unite,
      date_disponibilite: dateIso,
      prix_demande: prixNombre,
      lieu_enlevement: lieu.trim() || null,
      acompte_pourcent: acomptePourcent,
      texte_genere: texte,
      canaux: ["whatsapp"],
      publiee_at: new Date().toISOString(),
      // capture_id reste vide : la photo de caméra viendra plus tard.
    });

    if (refus) {
      setErreur(messageErreurLisible(refus, "cette fiche"));
      return null;
    }
    setEnFileAttente(enFile);
    setFicheId(id);
    return id;
  }, [
    ficheId,
    session,
    cycleId,
    dateIso,
    quantiteNombre,
    unite,
    prixNombre,
    lieu,
    acomptePourcent,
    texte,
  ]);

  const partager = useCallback(
    async (numero: string | null) => {
      if (!pret) return;
      setEnvoi(true);
      setErreur(null);

      const id = await assurerFiche();
      if (!id) {
        setEnvoi(false);
        return;
      }

      const encode = encodeURIComponent(texte);
      const chiffres = numero ? urlsWhatsapp(numero) : null;
      const application = chiffres
        ? `${chiffres.application}&text=${encode}`
        : `whatsapp://send?text=${encode}`;
      const web = chiffres
        ? `${chiffres.web}?text=${encode}`
        : `https://wa.me/?text=${encode}`;

      try {
        await Linking.openURL(application);
      } catch {
        try {
          await Linking.openURL(web);
        } catch {
          setEnvoi(false);
          setErreur("Impossible d'ouvrir WhatsApp sur ce téléphone.");
          return;
        }
      }

      setEnvoi(false);
      setChoixAcheteur(false);
      setConfirmation(
        enFileAttente
          ? "Message partagé. La fiche est gardée sur le téléphone et partira au retour du réseau."
          : "Fiche enregistrée et partagée.",
      );
    },
    [pret, assurerFiche, texte, enFileAttente],
  );

  useEffect(() => {
    if (!confirmation) return;
    const t = setTimeout(() => setConfirmation(null), 6000);
    return () => clearTimeout(t);
  }, [confirmation]);

  // ---------------------------------------------------------------------------
  if (chargement) {
    return (
      <Ecran>
        <Titre>Fiche de prévente</Titre>
        <Squelette hauteur={90} />
        <Squelette hauteur={90} />
        <Squelette hauteur={160} />
      </Ecran>
    );
  }

  if (cycles.length === 0) {
    return (
      <Ecran>
        <Titre>Fiche de prévente</Titre>
        <View style={styles.vide}>
          <Text style={styles.videEmoji}>🌱</Text>
          <SousTitre>Aucun cycle en cours</SousTitre>
          <Aide>
            Une prévente annonce une récolte à venir. Créez d'abord un cycle de
            production.
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
      <Titre>Fiche de prévente</Titre>
      <Aide>
        Annoncez votre récolte avant qu'elle soit prête, et sécurisez un
        acompte. Un lot déjà réservé ne se brade pas au champ.
      </Aide>

      <Succes message={confirmation} />

      {/* 1. Cycle ----------------------------------------------------------- */}
      {cycles.length > 1 ? (
        <View style={styles.bloc}>
          <Text style={styles.libelle}>Quelle production annoncez-vous ?</Text>
          <View style={styles.pilules}>
            {cycles.map((c) => (
              <Pilule
                key={c.id}
                libelle={c.nom}
                selectionnee={cycleId === c.id}
                onPress={() => setCycleId(c.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* 2. Quantité -------------------------------------------------------- */}
      <View style={styles.blocChiffre}>
        <Text style={styles.chiffreLibelle}>Quantité annoncée</Text>
        <View style={styles.chiffreLigne}>
          <TextInput
            style={styles.chiffreChamp}
            value={grouperChiffres(quantite)}
            onChangeText={(v) => setQuantite(v.replace(/\D/g, "").slice(0, 9))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={couleurs.ligne}
            accessibilityLabel="Quantité annoncée"
          />
          <Text style={styles.chiffreUnite}>{unite}</Text>
        </View>
      </View>

      {/* 3. Date de disponibilité ------------------------------------------ */}
      <View style={styles.bloc}>
        <Champ
          libelle="Disponible à partir du"
          value={dateSaisie}
          onChangeText={setDateSaisie}
          placeholder="JJ/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
        />
        {dateInvalide ? (
          <Text style={styles.champErreur}>
            Date incomprise. Écrivez-la sous la forme JJ/MM/AAAA.
          </Text>
        ) : null}
      </View>

      {/* 4. Prix demandé ---------------------------------------------------- */}
      <View style={styles.blocChiffre}>
        <View style={styles.prixEntete}>
          <Text style={styles.chiffreLibelle}>Prix demandé</Text>
          {cycleChoisi?.prixDeRevient ? (
            <Text style={styles.revient}>
              Vous revient à {formaterFcfa(cycleChoisi.prixDeRevient)}/{unite}
            </Text>
          ) : null}
        </View>
        <View style={styles.chiffreLigne}>
          <TextInput
            style={styles.chiffreChamp}
            value={grouperChiffres(prix)}
            onChangeText={(v) => setPrix(v.replace(/\D/g, "").slice(0, 9))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={couleurs.ligne}
            accessibilityLabel={`Prix demandé par ${unite}`}
          />
          <Text style={styles.chiffreUnite}>F/{unite}</Text>
        </View>
      </View>

      <Avertissement message={alertePrix} />

      {/* 5. Lieu ------------------------------------------------------------ */}
      <Champ
        libelle="Lieu d'enlèvement"
        value={lieu}
        onChangeText={setLieu}
        placeholder="Ex. Loumbila"
        autoCapitalize="words"
      />

      {/* 6. Acompte --------------------------------------------------------- */}
      <View style={styles.bloc}>
        <Text style={styles.libelle}>Acompte demandé</Text>
        <View style={styles.pilules}>
          {ACOMPTES.map((p) => (
            <Pilule
              key={p}
              libelle={p === 0 ? "Aucun" : `${p} %`}
              selectionnee={acomptePourcent === p}
              onPress={() => setAcomptePourcent(p)}
            />
          ))}
        </View>
        {acompte !== null && acomptePourcent > 0 ? (
          <Text style={styles.acompteCalcule}>
            Soit {formaterFcfa(acompte)} à verser pour réserver.
          </Text>
        ) : null}
      </View>

      {/* Aperçu du message -------------------------------------------------- */}
      <SousTitre>Votre message</SousTitre>
      <View style={styles.bulleConteneur}>
        <View style={styles.bulle}>
          <Text style={styles.bulleTexte}>{texte}</Text>
          <Text style={styles.bulleHeure}>
            {new Date().getHours().toString().padStart(2, "0")}:
            {new Date().getMinutes().toString().padStart(2, "0")} ✓✓
          </Text>
        </View>
      </View>

      <Erreur message={erreur ?? erreurCycles} />

      {/* Partage ------------------------------------------------------------ */}
      {!choixAcheteur ? (
        <>
          <Bouton
            titre="Partager sur WhatsApp"
            onPress={() => partager(null)}
            desactive={!pret}
            chargement={envoi}
          />
          <Bouton
            titre="Envoyer à un acheteur"
            variante="contour"
            onPress={() => setChoixAcheteur(true)}
            desactive={!pret}
          />
        </>
      ) : (
        <View style={styles.bloc}>
          <SousTitre>À qui l'envoyer ?</SousTitre>
          {grossistes.length === 0 ? (
            <Aide>
              Aucun acheteur avec un numéro WhatsApp. Ajoutez-en depuis « Mes
              acheteurs ».
            </Aide>
          ) : (
            <View style={styles.liste}>
              {grossistes.map((g) => (
                <Pressable
                  key={g.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Envoyer à ${g.nom}`}
                  onPress={() => partager(g.telephone_whatsapp)}
                  disabled={envoi}
                  style={({ pressed }) => [styles.acheteur, pressed && styles.presse]}
                >
                  <View style={styles.acheteurTextes}>
                    <View style={styles.acheteurTitre}>
                      <Text style={styles.acheteurNom}>{g.nom}</Text>
                      {g.prefere_message_vocal ? <Text>🎤</Text> : null}
                    </View>
                    <Text style={styles.acheteurDetail}>
                      {g.ville ? `${g.ville} · ` : ""}
                      {formaterTelephone(g.telephone_whatsapp)}
                    </Text>
                    {g.prefere_message_vocal ? (
                      <Text style={styles.acheteurVocal}>
                        Doublez d'un vocal : il vous répondra plus vite.
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.acheteurFleche}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Bouton
            titre="Retour"
            variante="contour"
            onPress={() => setChoixAcheteur(false)}
          />
        </View>
      )}

      <View style={styles.pied}>
        <Bouton titre="Fermer" variante="contour" onPress={() => router.back()} />
      </View>
    </Ecran>
  );
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  bloc: { gap: espaces.sm },
  liste: { gap: espaces.sm },
  pilules: { flexDirection: "row", flexWrap: "wrap", gap: espaces.sm },
  presse: { opacity: 0.85 },
  pied: { marginTop: espaces.lg },

  libelle: {
    fontSize: textes.corps,
    fontWeight: "600",
    color: couleurs.encre,
  },
  champErreur: { fontSize: textes.petit, color: couleurs.rouge },

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
  prixEntete: { gap: espaces.xs },
  revient: {
    fontSize: textes.petit,
    color: couleurs.attenue,
  },
  acompteCalcule: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.vert,
  },

  // Bulle inspirée de WhatsApp : le producteur reconnaît l'objet avant de
  // lire le texte, et sait donc à quoi ressemblera ce qu'il envoie.
  bulleConteneur: {
    backgroundColor: "#ECE5DD",
    padding: espaces.md,
    borderRadius: rayons.md,
  },
  bulle: {
    alignSelf: "flex-end",
    maxWidth: "95%",
    backgroundColor: "#DCF8C6",
    borderRadius: rayons.md,
    borderTopRightRadius: 4,
    padding: espaces.md,
    gap: espaces.xs,
  },
  bulleTexte: {
    fontSize: textes.petit,
    lineHeight: 23,
    color: "#111B21",
  },
  bulleHeure: {
    fontSize: 12,
    color: "#667781",
    alignSelf: "flex-end",
  },

  acheteur: {
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
  acheteurTextes: { flex: 1, gap: 2 },
  acheteurTitre: {
    flexDirection: "row",
    alignItems: "center",
    gap: espaces.sm,
  },
  acheteurNom: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.encre,
  },
  acheteurDetail: { fontSize: textes.petit, color: couleurs.attenue },
  acheteurVocal: { fontSize: textes.petit, color: couleurs.vert },
  acheteurFleche: { fontSize: textes.titre, color: couleurs.attenue },

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
  videEmoji: { fontSize: 48 },
});
