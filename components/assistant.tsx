// =============================================================================
// Formulaire de question à l'assistant.
//
// Une seule implémentation, montée à deux endroits : le cinquième onglet de
// l'écran guide, et la feuille du bouton flottant. Deux copies divergeraient à
// la première correction — et ce qui divergerait ici, ce sont les quatre cas
// de réponse et le traitement du 429, c'est-à-dire précisément ce qu'on ne
// peut pas se permettre de traiter différemment d'un écran à l'autre.
//
// -----------------------------------------------------------------------------
// LE PÉRIMÈTRE, ET CE QU'IL IMPOSE À L'ÉCRAN
//
// L'assistant ne répond QUE depuis le guide désigné par `itineraireId` —
// c'est la garantie qui empêche une dose inventée d'atteindre quelqu'un qui
// n'a pas les moyens de rater sa campagne. Deux conséquences.
//
// D'abord les suggestions : devant un champ vide, beaucoup ne savent pas quoi
// demander, et une question au hasard a toutes les chances d'être refusée.
// Elles sont donc tirées du contenu réellement présent dans le guide affiché,
// et calculées par l'appelant qui, lui, a les étapes sous la main.
//
// Ensuite le quota, montré en permanence et jamais recalculé ici : la fonction
// le renvoie à chaque réponse, refus compris. Le compter côté client
// divergerait au premier appel perdu, et c'est le genre d'écart qu'on ne
// remarque qu'au moment où le producteur est bloqué sans comprendre.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Aide, Bouton, Champ, Erreur } from "@/components/ui";
import { CIBLE_TACTILE, couleurs, espaces, rayons, textes } from "@/constants/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const LONGUEUR_MAX = 500;
const LONGUEUR_MIN = 3;

export type ReponseAssistant =
  | { statut: "repondue"; reponse: string; guide_source: string; questions_restantes: number }
  | { statut: "refusee"; motif: string; message: string; questions_restantes: number }
  | { statut: "quota_epuise"; message: string; questions_restantes: number };

export function FormulaireAssistant({
  itineraireId,
  suggestions,
}: {
  /** Guide interrogé. En changer vide la réponse affichée, pas la saisie. */
  itineraireId: string;
  suggestions: string[];
}) {
  const { session } = useAuth();
  const [question, setQuestion] = useState("");
  const [restantes, setRestantes] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [reponse, setReponse] = useState<ReponseAssistant | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Quota lu une fois. Ensuite il vient des réponses. Il ne dépend pas du
  // guide — c'est un compte par personne et par jour — donc changer de guide
  // ne le relit pas.
  useEffect(() => {
    if (!session?.user) return;
    let actif = true;
    supabase
      .rpc("questions_restantes_aujourdhui", { p_user_id: session.user.id })
      .then(({ data, error }) => {
        if (actif && !error) setRestantes(typeof data === "number" ? data : null);
      });
    return () => {
      actif = false;
    };
  }, [session]);

  // Une réponse tirée du guide précédent, laissée sous le nouveau, se lirait
  // comme une réponse à propos de celui-ci. La saisie en cours, elle, est
  // conservée : on change souvent de guide justement pour reposer la même
  // question ailleurs.
  useEffect(() => {
    setReponse(null);
    setErreur(null);
  }, [itineraireId]);

  const epuise = restantes !== null && restantes <= 0;
  const longueur = question.trim().length;
  const pret = longueur >= LONGUEUR_MIN && !envoi && !epuise;

  const envoyer = useCallback(async () => {
    if (!pret) return;
    setEnvoi(true);
    setErreur(null);
    setReponse(null);

    const { data, error } = await supabase.functions.invoke("question-guide", {
      body: { question: question.trim(), itineraire_id: itineraireId },
    });

    if (error) {
      // Un quota épuisé revient en 429, donc par le canal d'erreur de
      // supabase-js. Le corps porte le message et le compteur : sans le lire,
      // on afficherait « erreur technique » à quelqu'un qui a simplement fini
      // ses questions du jour.
      const contexte = (error as { context?: unknown }).context;
      if (contexte instanceof Response) {
        try {
          const corps = await contexte.json();
          if (corps?.statut === "quota_epuise") {
            setRestantes(0);
            setReponse(corps as ReponseAssistant);
            setEnvoi(false);
            return;
          }
          if (typeof corps?.erreur === "string") {
            setErreur(corps.erreur);
            setEnvoi(false);
            return;
          }
        } catch {
          // corps illisible : on retombe sur le message générique
        }
      }
      setErreur("L'assistant n'a pas répondu. Réessayez dans un moment.");
      setEnvoi(false);
      return;
    }

    const recue = data as ReponseAssistant;
    setReponse(recue);
    if (typeof recue?.questions_restantes === "number") {
      setRestantes(recue.questions_restantes);
    }
    setQuestion("");
    setEnvoi(false);
  }, [pret, question, itineraireId]);

  return (
    <View style={styles.bloc}>
      <CompteurQuota restantes={restantes} />

      <Aide>
        L&apos;assistant répond à partir de ce guide seulement. Il préfère ne
        rien dire plutôt que d&apos;avancer un chiffre qu&apos;il n&apos;a pas.
      </Aide>

      <Erreur message={erreur} />

      <Champ
        libelle="Votre question"
        value={question}
        onChangeText={(t) => setQuestion(t.slice(0, LONGUEUR_MAX))}
        placeholder="Par exemple : à quel moment faut-il sarcler ?"
        multiline
        editable={!epuise}
        style={styles.champQuestion}
      />
      <Text style={styles.compteur}>
        {LONGUEUR_MAX - question.length} caractères restants
      </Text>

      {question.length === 0 && suggestions.length > 0 && !epuise ? (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitre}>Vous pouvez demander</Text>
          {suggestions.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`Utiliser la question : ${s}`}
              onPress={() => setQuestion(s)}
              style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.suggestionTexte}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Bouton
        titre="Envoyer"
        onPress={() => void envoyer()}
        desactive={!pret}
        chargement={envoi}
      />

      {reponse ? <ReponseAffichee reponse={reponse} /> : null}
    </View>
  );
}

function CompteurQuota({ restantes }: { restantes: number | null }) {
  return (
    <Text style={styles.quota}>
      {restantes === null
        ? "Vérification de vos questions du jour…"
        : `${restantes} question${restantes > 1 ? "s" : ""} restante${
            restantes > 1 ? "s" : ""
          } aujourd'hui`}
    </Text>
  );
}

function ReponseAffichee({ reponse }: { reponse: ReponseAssistant }) {
  if (reponse.statut === "repondue") {
    return (
      <View style={styles.reponse}>
        <Text style={styles.reponseTexte}>{reponse.reponse}</Text>
        <Text style={styles.sourceReponse}>D&apos;après le guide {reponse.guide_source}</Text>
      </View>
    );
  }

  if (reponse.statut === "quota_epuise") {
    return (
      <View style={styles.refus}>
        <Text style={styles.refusTexte}>{reponse.message}</Text>
      </View>
    );
  }

  // Un seul motif reçoit un texte à nous : celui-là dit au producteur que sa
  // question a servi à quelque chose, ce que le message de la fonction ne dit
  // pas. Tous les autres sont affichés tels quels — les reformuler ferait
  // dériver un refus dont la formulation a été pesée côté serveur.
  const texte =
    reponse.motif === "information_absente_du_guide"
      ? "Cette information n'est pas encore dans nos guides. Votre question a été transmise — nous complétons le contenu à partir de ce que les producteurs demandent."
      : reponse.message;

  return (
    <View style={styles.refus}>
      <Text style={styles.refusTexte}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espaces.md },
  quota: {
    fontSize: textes.corps,
    fontWeight: "700",
    color: couleurs.vertFonce,
  },
  champQuestion: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  compteur: {
    fontSize: textes.petit,
    color: couleurs.attenue,
    textAlign: "right",
  },
  suggestions: { gap: espaces.sm },
  suggestionsTitre: { fontSize: textes.petit, color: couleurs.attenue },
  suggestion: {
    minHeight: CIBLE_TACTILE,
    justifyContent: "center",
    paddingHorizontal: espaces.md,
    paddingVertical: espaces.sm,
    borderRadius: rayons.md,
    borderWidth: 2,
    borderColor: couleurs.ligne,
    backgroundColor: couleurs.blanc,
  },
  suggestionTexte: { fontSize: textes.corps, color: couleurs.encre },
  reponse: {
    marginTop: espaces.md,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: couleurs.papier,
    borderLeftWidth: 5,
    borderLeftColor: couleurs.vertFonce,
    gap: espaces.sm,
  },
  reponseTexte: { fontSize: textes.corps, lineHeight: 27, color: couleurs.encre },
  sourceReponse: { fontSize: textes.petit, color: couleurs.attenue, fontStyle: "italic" },
  refus: {
    marginTop: espaces.md,
    padding: espaces.lg,
    borderRadius: rayons.lg,
    backgroundColor: "#FFF8E1",
    borderLeftWidth: 5,
    borderLeftColor: couleurs.or,
  },
  refusTexte: { fontSize: textes.corps, lineHeight: 27, color: couleurs.encre },
});
