// =============================================================================
// AgriNafa — Edge Function « saisie-vocale »
//
// Flux : note vocale dans Storage → Whisper → structuration JSON stricte →
//        insertion dans public.depenses avec validee = false.
//
// Deux principes non négociables :
//  1. On n'écrit jamais avec la service_role. Le client Supabase est construit
//     avec le JWT de l'appelant, donc la RLS s'applique. Un bug de la fonction
//     ne peut pas écrire dans le cycle d'un autre exploitant.
//  2. L'IA propose, l'humain valide. Toute dépense dictée entre en base avec
//     validee = false et reste hors des calculs de rentabilité tant que le
//     producteur n'a pas confirmé sur son téléphone.
// =============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TAILLE_MAX_AUDIO = 25 * 1024 * 1024; // limite de l'API Whisper
const MODELE_TRANSCRIPTION = "whisper-1";
const MODELE_STRUCTURATION = "gpt-4o-mini";

// Vocabulaire injecté dans Whisper. Sans ça, « NPK » devient « en pé ka »,
// « Kalenda » devient « calendrier » et « bana-bana » devient « banane ».
const AMORCE_WHISPER = [
  "Vocabulaire agricole du Burkina Faso :",
  "NPK 15-15-15, urée, engrais, semence, aliment démarrage, aliment finition,",
  "aubergine Kalenda, tomate, oignon Galmi, chou, niébé, maïs,",
  "poulet de chair, Goliath, pondeuse, poussin, bande, ovin, mouton,",
  "Gumboro, Newcastle, Lasota, déparasitage, vitamines, prophylaxie,",
  "bana-bana, grossiste, Sankariaré, Nabi-Yaar, Loumbila, Ouagadougou, Bobo-Dioulasso,",
  "motopompe, carburant, sarclage, repiquage, pépinière, hivernage, contre-saison,",
  "sac, botte, tine, plat, bassine, charretée, kilo, litre, dose,",
  "francs CFA, mille francs.",
].join(" ");

const CONSIGNE_STRUCTURATION = `Tu extrais une dépense agricole depuis la transcription d'une note vocale
d'un producteur burkinabè. Tu réponds UNIQUEMENT en JSON conforme au schéma.

RÈGLES DE MONTANT
- La monnaie est toujours le franc CFA (FCFA). Ne convertis jamais.
- "quarante-cinq mille" = 45000. "vingt-cinq mille balles" = 25000.
- "cinq cent" seul dans un contexte de prix signifie 500, pas 500000.
- Si aucun montant n'est énoncé, mets montant_total à null. N'invente jamais
  un chiffre : une dépense fausse est pire qu'une dépense manquante.

RÈGLES DE CATÉGORIE — choisis strictement parmi :
- intrants : engrais, semences, aliment bétail, produits phytosanitaires, vaccins
- main_d_oeuvre : manœuvres, journaliers, sarclage, repiquage, gardiennage
- carburant : essence, gasoil, pétrole pour motopompe ou groupe
- transport : location de tricycle, camion, charrette, frais de route
- veterinaire : consultation, acte vétérinaire, soins
- irrigation : réparation de pompe, tuyaux, forage, redevance eau
- location : location de terre, de matériel, de bœufs de trait
- autre : tout le reste

UNITÉS LOCALES : sac, botte, tine, plat, bassine, charretée, kg, litre, dose,
sujet, tête. Conserve l'unité telle qu'énoncée.

DATE : résous les expressions relatives par rapport à la date du jour fournie.
"aujourd'hui" = date du jour. "hier" = veille. Si rien n'est dit, date du jour.

CYCLE : choisis l'identifiant dans la liste des cycles actifs fournie, en te
basant sur ce que le producteur mentionne (culture, animal, parcelle). Si aucun
indice ne permet de trancher et qu'il y a plusieurs cycles, mets cycle_id à null.

STOCK : si l'achat correspond à un article de la liste de stocks fournie, indique
son identifiant. Sinon null.

CONFIANCE : 0 à 1. Sois sévère. Baisse la confiance si le montant est ambigu,
si la transcription est incohérente, ou si la langue ne semble pas être du
français.`;

const SCHEMA_DEPENSE = {
  name: "depense_agricole",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "description", "categorie", "montant_total", "quantite", "unite",
      "article", "cycle_id", "stock_id", "date_depense", "confiance", "remarque",
    ],
    properties: {
      description: { type: "string", description: "Résumé court et lisible de la dépense" },
      categorie: {
        type: "string",
        enum: ["intrants", "main_d_oeuvre", "carburant", "transport",
               "veterinaire", "irrigation", "location", "autre"],
      },
      montant_total: { type: ["number", "null"], description: "Montant en FCFA" },
      quantite: { type: ["number", "null"] },
      unite: { type: ["string", "null"] },
      article: { type: ["string", "null"], description: "Article acheté, ex. Engrais NPK 15-15-15" },
      cycle_id: { type: ["string", "null"] },
      stock_id: { type: ["string", "null"] },
      date_depense: { type: ["string", "null"], description: "AAAA-MM-JJ" },
      confiance: { type: "number" },
      remarque: { type: ["string", "null"], description: "Ce qui manque ou reste ambigu" },
    },
  },
};

function reponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Confiance acoustique dérivée des log-probabilités de Whisper.
// Bien plus fiable que de demander au LLM d'évaluer une transcription qu'il
// n'a pas entendue : ici on mesure ce que le modèle audio a réellement perçu.
function confianceAcoustique(segments: Array<Record<string, number>> | undefined): number {
  if (!segments?.length) return 0.5;
  const moyenneLogprob =
    segments.reduce((s, seg) => s + (seg.avg_logprob ?? -1), 0) / segments.length;
  const parolePresente =
    1 - segments.reduce((s, seg) => s + (seg.no_speech_prob ?? 0), 0) / segments.length;
  // avg_logprob ~ -0.1 (excellent) à -1.0 (mauvais)
  const clarte = Math.min(Math.max((moyenneLogprob + 1) / 0.9, 0), 1);
  return Math.round(Math.min(clarte, parolePresente) * 1000) / 1000;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reponse({ erreur: "Méthode non autorisée" }, 405);

  const cleOpenAI = Deno.env.get("OPENAI_API_KEY");
  if (!cleOpenAI) return reponse({ erreur: "OPENAI_API_KEY absente des secrets du projet" }, 500);

  const entete = req.headers.get("Authorization");
  if (!entete) return reponse({ erreur: "Authentification requise" }, 401);

  // Client porteur du JWT de l'appelant : la RLS reste active de bout en bout.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: entete } } },
  );

  const { data: { user }, error: errAuth } = await supabase.auth.getUser();
  if (errAuth || !user) return reponse({ erreur: "Session invalide" }, 401);

  let corps: { audio_path?: string; cycle_id?: string };
  try {
    corps = await req.json();
  } catch {
    return reponse({ erreur: "Corps JSON attendu : { audio_path, cycle_id? }" }, 400);
  }

  const audioPath = corps.audio_path;
  if (!audioPath) return reponse({ erreur: "audio_path manquant" }, 400);

  // Le chemin doit commencer par le dossier de l'appelant. La policy Storage le
  // garantit déjà ; on refuse plus tôt pour un message d'erreur clair.
  if (!audioPath.startsWith(`${user.id}/`)) {
    return reponse({ erreur: "Chemin audio hors de votre espace" }, 403);
  }

  // ---------------------------------------------------------------- 1. Audio
  const { data: fichier, error: errStorage } = await supabase
    .storage.from("notes-vocales").download(audioPath);

  if (errStorage || !fichier) {
    return reponse({ erreur: "Note vocale introuvable", detail: errStorage?.message }, 404);
  }
  if (fichier.size > TAILLE_MAX_AUDIO) {
    return reponse({ erreur: "Note vocale trop longue (25 Mo maximum)" }, 413);
  }

  // --------------------------------------------------------- 2. Transcription
  const formulaire = new FormData();
  formulaire.append("file", fichier, audioPath.split("/").pop() ?? "note.m4a");
  formulaire.append("model", MODELE_TRANSCRIPTION);
  // Langue forcée au français. Whisper ne connaît ni le mooré ni le dioula :
  // en détection automatique il produirait une transcription hallucinée dans
  // une langue voisine, ce qui est pire qu'un échec franc.
  formulaire.append("language", "fr");
  formulaire.append("prompt", AMORCE_WHISPER);
  formulaire.append("response_format", "verbose_json");

  const repWhisper = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cleOpenAI}` },
    body: formulaire,
  });

  if (!repWhisper.ok) {
    return reponse({ erreur: "Transcription échouée", detail: await repWhisper.text() }, 502);
  }

  const whisper = await repWhisper.json();
  const transcription: string = (whisper.text ?? "").trim();
  const confAcoustique = confianceAcoustique(whisper.segments);

  if (!transcription || transcription.length < 4) {
    return reponse({
      statut: "audio_inaudible",
      message: "Je n'ai rien entendu de clair. Réessayez en parlant près du téléphone.",
      transcription,
    });
  }

  // ------------------------------------------- 3. Contexte : cycles et stocks
  const [{ data: cycles }, { data: stocks }] = await Promise.all([
    supabase.from("cycles_production")
      .select("id, nom, type, date_debut")
      .eq("statut", "actif").is("deleted_at", null).limit(30),
    supabase.from("stocks")
      .select("id, nom, categorie, unite")
      .is("deleted_at", null).limit(60),
  ]);

  if (!cycles?.length) {
    return reponse({
      statut: "aucun_cycle",
      message: "Créez d'abord un cycle de production pour y rattacher vos dépenses.",
      transcription,
    });
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  // ------------------------------------------------------- 4. Structuration
  const repLLM = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cleOpenAI}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELE_STRUCTURATION,
      temperature: 0,
      messages: [
        { role: "system", content: CONSIGNE_STRUCTURATION },
        {
          role: "user",
          content: [
            `Date du jour : ${aujourdhui}`,
            `Cycles actifs : ${JSON.stringify(cycles)}`,
            `Stocks existants : ${JSON.stringify(stocks ?? [])}`,
            `Transcription : « ${transcription} »`,
          ].join("\n\n"),
        },
      ],
      response_format: { type: "json_schema", json_schema: SCHEMA_DEPENSE },
    }),
  });

  if (!repLLM.ok) {
    return reponse({ erreur: "Analyse échouée", detail: await repLLM.text() }, 502);
  }

  const extrait = JSON.parse((await repLLM.json()).choices[0].message.content);

  // ------------------------------------------------------- 5. Garde-fous
  // La confiance finale est le minimum des deux maillons : une extraction
  // parfaite sur un audio incompris ne vaut rien, et l'inverse non plus.
  const confiance = Math.round(Math.min(confAcoustique, extrait.confiance ?? 0) * 1000) / 1000;

  if (extrait.montant_total === null || extrait.montant_total <= 0) {
    return reponse({
      statut: "besoin_precision",
      message: "Je n'ai pas entendu le montant. Redites en précisant la somme en francs.",
      transcription,
      analyse: extrait,
      confiance,
    });
  }

  // Le cycle doit appartenir à l'appelant : on ne fait pas confiance au LLM
  // pour renvoyer un identifiant légitime.
  const idsAutorises = new Set(cycles.map((c: { id: string }) => c.id));
  let cycleId = corps.cycle_id ?? extrait.cycle_id;
  if (!cycleId || !idsAutorises.has(cycleId)) {
    if (cycles.length === 1) {
      cycleId = cycles[0].id; // un seul cycle actif : aucune ambiguïté
    } else {
      return reponse({
        statut: "cycle_a_preciser",
        message: "À quel cycle rattacher cette dépense ?",
        transcription,
        analyse: extrait,
        confiance,
        cycles_proposes: cycles,
      });
    }
  }

  const stockId = extrait.stock_id && (stocks ?? []).some(
    (s: { id: string }) => s.id === extrait.stock_id,
  ) ? extrait.stock_id : null;

  // ------------------------------------------------------- 6. Insertion
  const { data: depense, error: errInsert } = await supabase
    .from("depenses")
    .insert({
      user_id: user.id,
      cycle_id: cycleId,
      description: extrait.description,
      categorie: extrait.categorie,
      montant_total: extrait.montant_total,
      stock_id: stockId,
      quantite_stock_utilisee: null,
      date_depense: extrait.date_depense ?? aujourdhui,
      saisie_source: "vocale",
      audio_path: audioPath,
      transcription,
      confiance_ia: confiance,
      validee: false, // l'IA propose, le producteur valide
    })
    .select()
    .single();

  if (errInsert) {
    return reponse({ erreur: "Enregistrement refusé", detail: errInsert.message }, 400);
  }

  return reponse({
    statut: "a_valider",
    message: "Dépense comprise. Vérifiez puis validez.",
    transcription,
    confiance,
    confiance_acoustique: confAcoustique,
    depense,
    suggestion_stock: {
      article: extrait.article,
      quantite: extrait.quantite,
      unite: extrait.unite,
      stock_id: stockId,
    },
  });
});
