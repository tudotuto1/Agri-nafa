// =============================================================================
// File d'attente d'écriture.
//
// Une saisie ne doit jamais se perdre. Si la base est joignable, l'écriture
// part tout de suite. Sinon elle attend sur le téléphone et repart seule au
// retour du signal. Le producteur, lui, continue son travail.
//
// -----------------------------------------------------------------------------
// L'IDEMPOTENCE EST LE POINT CRITIQUE
//
// L'identifiant est tiré sur le téléphone et envoyé comme `id` dans
// l'insertion. Sans cela, le scénario suivant crée un doublon :
//
//   1. l'application envoie la dépense
//   2. Supabase l'écrit
//   3. le réseau coupe avant que la réponse revienne
//   4. l'application croit avoir échoué et rejoue
//   5. une deuxième dépense de 45 000 F apparaît
//
// Avec un identifiant fixé côté client, le rejeu se heurte à la clé primaire
// et renvoie 23505. On traite ce conflit comme un succès : la ligne est là,
// c'est tout ce qui compte. Une comptabilité qui double les dépenses au
// premier trou de réseau ne serait opposable à personne.
// -----------------------------------------------------------------------------
//
// Ce module ne s'occupe que des écritures. Les lectures sont un autre
// chantier : ce qui se perd, c'est ce qu'on saisit.
// =============================================================================

// =============================================================================
// PÉRIMÈTRE : LES INSERTIONS SEULEMENT
//
// Huit écritures passent volontairement en direct, hors de cette file. Toutes
// sont des mises à jour, et c'est le point : `vider()` ne sait rejouer qu'un
// `.insert()`. Une mise à jour mise en file n'y trouverait pas de quoi repartir.
//
//   – marquer une alerte lue, une par une ou toutes (alertes.tsx)
//   – supprimer un acheteur (grossistes.tsx)
//   – rattacher ou détacher un cycle d'une parcelle (parcelle/[id].tsx)
//   – renseigner la langue, clore l'inscription, modifier son profil
//     (code.tsx, premier-cycle.tsx, profil.tsx)
//
// Les cinq premières — les trois premières lignes de la liste — ne perdent
// rien à échouer : l'alerte reste affichée, l'acheteur reste dans la liste, le
// cycle reste où il était. Le producteur recommence, et c'est tout.
//
// Les trois dernières demandent une nuance, parce qu'elles touchent au profil :
//
//   – la langue se repose d'un geste, à la page suivante ;
//   – `onboarding_termine` a déjà son rattrapage dédié dans premier-cycle.tsx :
//     le cycle, lui, est passé par la file et est donc gardé — seul le drapeau
//     manque, et l'écran le dit ;
//   – modifier son profil est le seul cas qui touche à de la saisie — nom,
//     localité, superficie. Son échec n'escamote rien pour autant : il
//     s'affiche aussitôt et le texte reste dans le formulaire, sous les yeux
//     de celui qui vient de le taper.
//
// Ce qui se perd sans bruit, ce sont les insertions faites hors ligne, et
// c'est exactement ce que cette file garde.
//
// Les couvrir supposerait de gérer les conflits de version entre appareils :
// beaucoup de complexité pour protéger des gestes dont la perte ne coûte
// rien, ou se voit immédiatement.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { messageErreurLisible, type ErreurEcriture } from "@/lib/erreurs";
import { formaterFcfa } from "@/lib/format";

export const CLE_FILE = "agrinafa.file-attente";

/** Au-delà, on cesse de réessayer et on marque l'entrée pour l'utilisateur. */
export const TENTATIVES_MAX = 5;

/**
 * Plafond du nombre d'entrées gardées sur le téléphone.
 *
 * AsyncStorage n'est pas infini, et une file qui gonfle sans bruit finit par
 * échouer à s'écrire — c'est-à-dire à perdre des saisies au moment précis où
 * elle prétend les garder. Mieux vaut refuser franchement la 201e que rendre
 * les 200 premières incertaines.
 *
 * Le plafond compte TOUTES les entrées, abandons compris : ce qui est en jeu
 * est la place occupée, et une entrée abandonnée en occupe autant qu'une autre.
 * L'écran file-attente.tsx permet de les purger.
 */
export const ENTREES_MAX = 200;

/**
 * Codes des refus qui ne viennent pas de la base.
 *
 * Ils voyagent dans le même canal que les erreurs Postgres — les écrans
 * appellent tous `messageErreurLisible` sur ce qu'ils reçoivent — mais ne sont
 * pas des codes Postgres : ils ont la forme d'un mot, là où Postgres numérote.
 * Aucune collision possible, donc, et aucun écran à modifier.
 */
export const CODE_FILE_PLEINE = "FILE_PLEINE";
export const CODE_FILE_NON_ECRITE = "FILE_NON_ECRITE";

function refusLocal(code: string, message: string): ErreurEcriture {
  return { code, message, details: "" };
}

/** Violation d'unicité. Toutes contraintes confondues — voir estDoublonClePrimaire. */
const CODE_DOUBLON = "23505";

export type EntreeFile = {
  /** UUID tiré sur le téléphone, envoyé comme `id` de la ligne. */
  id: string;
  table: string;
  donnees: Record<string, unknown>;
  creeeLe: string;
  tentatives: number;
  /** Renseigné quand l'entrée est abandonnée : elle ne repartira plus. */
  erreur?: string;
};

export type ResultatAjout = {
  id: string;
  /** true : gardée sur le téléphone, elle repartira au retour du réseau. */
  enFile: boolean;
  /**
   * Renseigné pour un refus — jamais pour une simple panne de réseau.
   * Vient de la base, ou du téléphone lui-même quand il n'a pas pu garder la
   * saisie. Dans les deux cas `messageErreurLisible` sait le traduire.
   */
  erreur: ErreurEcriture | null;
};

type ReponseEcriture = { error: PostgrestError | null; status?: number };

// -----------------------------------------------------------------------------
// Panne de réseau ou refus de la base ?
//
// La distinction commande tout : une panne se rejoue, un refus jamais. Rejouer
// une contrainte violée remplirait la file d'entrées condamnées.
//
// postgrest-js met `status` à 0 et laisse `code` vide quand la requête n'a pas
// atteint le serveur — vérifié dans son code, pas supposé. Dès que Postgres ou
// PostgREST a répondu, un code est présent.
// -----------------------------------------------------------------------------
const INDICES_RESEAU = [
  "network request failed",
  "failed to fetch",
  "network error",
  "fetcherror",
  "timeout",
  "timed out",
  "connection appears to be offline",
  "load failed",
];

export function estEchecReseau(reponse: ReponseEcriture): boolean {
  const { error, status } = reponse;
  if (!error) return false;

  // La requête n'a jamais atteint le serveur.
  if (status === 0) return true;

  // Un code renseigné signifie que la base a répondu : c'est un refus.
  if ((error.code ?? "").trim().length > 0) return false;

  const texte = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return INDICES_RESEAU.some((indice) => texte.includes(indice));
}

/**
 * Le rejeu a-t-il buté sur SA PROPRE ligne, déjà écrite ?
 *
 * Le code 23505 ne suffit pas à le conclure, et c'est un piège : il couvre
 * toutes les contraintes d'unicité de la table, pas seulement la clé primaire.
 * `cameras.identifiant_materiel` est unique lui aussi. Deux caméras distinctes
 * déclarées avec le même numéro de série lèvent exactement le même 23505 — le
 * prendre pour un succès effacerait la saisie sans un mot, l'inverse précis de
 * ce que cette file promet.
 *
 * Seule la clé primaire porte l'identifiant que nous avons tiré nous-mêmes :
 * c'est la seule collision qui prouve que notre ligne est arrivée.
 *
 * Postgres nomme la contrainte violée dans le message et désigne la colonne
 * dans le détail. Relevé sur la base plutôt que supposé :
 *
 *   clé primaire   → « ...unique constraint "cameras_pkey" »
 *                    détail « Key (id)=(...) already exists. »
 *   numéro de série→ « ...unique constraint "cameras_identifiant_materiel_key" »
 *
 * Les deux marqueurs sont testés, l'un rattrapant l'autre si le message
 * changeait de forme. En cas de doute, la fonction répond non : signaler une
 * erreur sur une ligne en réalité écrite se voit et se corrige, alors qu'une
 * saisie escamotée ne se remarque qu'au moment où elle manque.
 */
function estDoublonClePrimaire(
  erreur: PostgrestError | null,
  table: string,
): boolean {
  if ((erreur?.code ?? "") !== CODE_DOUBLON) return false;

  const message = (erreur?.message ?? "").toLowerCase();
  const details = (erreur?.details ?? "").toLowerCase();

  if (message.includes(`${table.toLowerCase()}_pkey`)) return true;
  // « Key (id)=(4f3a…) already exists. » — la clé en cause est bien l'id.
  return /key \(id\)=/.test(details);
}

// -----------------------------------------------------------------------------
// Décrire une entrée à l'écran
//
// Une entrée en attente est une ligne de table brute. Telle quelle, elle ne dit
// rien à un producteur : `productions_recoltes` n'est pas un mot, et
// `{"montant_total": 45000}` encore moins. Ces trois fonctions traduisent.
// -----------------------------------------------------------------------------
const LIBELLES_TABLE: Record<string, string> = {
  depenses: "Dépense",
  ventes: "Vente",
  productions_recoltes: "Récolte",
  fiches_prevente: "Fiche de prévente",
  cycles_production: "Cycle de production",
  grossistes: "Grossiste",
  parcelles: "Parcelle",
  cameras: "Caméra",
};

/** Groupe nominal attendu par `messageErreurLisible`, par table. */
const SUJETS_TABLE: Record<string, string> = {
  depenses: "la dépense",
  ventes: "la vente",
  productions_recoltes: "la récolte",
  fiches_prevente: "la fiche de prévente",
  cycles_production: "le cycle",
  grossistes: "le grossiste",
  parcelles: "la parcelle",
  cameras: "la caméra",
};

/** Nom lisible de ce qui a été saisi. Repli sur le nom de table, faute de mieux. */
export function libelleTable(table: string): string {
  return LIBELLES_TABLE[table] ?? table;
}

function nombre(valeur: unknown): number | null {
  return typeof valeur === "number" && Number.isFinite(valeur) ? valeur : null;
}

function texte(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.trim().length > 0 ? valeur.trim() : null;
}

/**
 * Ce qui identifie l'entrée pour celui qui l'a saisie : un montant quand il y
 * en a un, sinon une quantité, sinon un nom.
 *
 * Les montants ne sont affichés que là où ils existent vraiment. Multiplier
 * quantité et prix pour une vente est légitime — c'est la définition de
 * `revenu_total` en base. Rien n'est inventé ailleurs.
 */
export function resumeEntree(entree: EntreeFile): string | null {
  const d = entree.donnees;

  switch (entree.table) {
    case "depenses": {
      const montant = nombre(d.montant_total);
      const quoi = texte(d.description);
      if (montant === null) return quoi;
      return quoi ? `${formaterFcfa(montant)} · ${quoi}` : formaterFcfa(montant);
    }
    case "ventes": {
      const q = nombre(d.quantite_vendue);
      const prix = nombre(d.prix_unitaire);
      const client = texte(d.client_nom);
      const montant = q !== null && prix !== null ? formaterFcfa(q * prix) : null;
      if (!montant) return client;
      return client ? `${montant} · ${client}` : montant;
    }
    case "productions_recoltes": {
      const q = nombre(d.quantite_recoltee);
      if (q === null) return null;
      return `${q} ${texte(d.unite) ?? ""}`.trim();
    }
    case "fiches_prevente": {
      const q = nombre(d.quantite_prevue);
      const prix = nombre(d.prix_demande);
      const quantite = q === null ? null : `${q} ${texte(d.unite) ?? ""}`.trim();
      if (q !== null && prix !== null) {
        return `${quantite} · ${formaterFcfa(q * prix)} demandés`;
      }
      return quantite;
    }
    case "parcelles": {
      const nom = texte(d.nom);
      const surface = nombre(d.superficie_ha);
      if (surface === null) return nom;
      return nom ? `${nom} · ${surface} ha` : `${surface} ha`;
    }
    default:
      return texte(d.nom);
  }
}

// -----------------------------------------------------------------------------
// Persistance
// -----------------------------------------------------------------------------
async function lire(): Promise<EntreeFile[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_FILE);
    if (!brut) return [];
    const analyse = JSON.parse(brut);
    return Array.isArray(analyse) ? (analyse as EntreeFile[]) : [];
  } catch {
    // Une file illisible ne doit pas empêcher l'application de démarrer.
    return [];
  }
}

/**
 * Persiste la file. Lève si le stockage refuse.
 *
 * Le `catch` silencieux serait ici la pire des consolations : l'appelant
 * croirait la saisie gardée alors qu'elle n'existe nulle part. Mémoire pleine,
 * quota atteint, stockage chiffré indisponible au démarrage — les causes sont
 * réelles sur des téléphones d'entrée de gamme. On remonte, l'appelant décide.
 */
async function ecrire(file: EntreeFile[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_FILE, JSON.stringify(file));
  } catch (cause) {
    throw new Error(
      `Impossible d'enregistrer la file sur le téléphone : ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }
  // Après l'écriture seulement : notifier une file non persistée afficherait
  // un compteur que le prochain démarrage démentirait.
  notifier(file);
}

export async function lireFile(): Promise<EntreeFile[]> {
  return lire();
}

/** Entrées qui attendent encore leur tour. Les abandons n'y figurent pas. */
export async function nombreEnAttente(): Promise<number> {
  const file = await lire();
  return file.filter((e) => !e.erreur).length;
}

export async function viderCompletement(): Promise<void> {
  await AsyncStorage.removeItem(CLE_FILE);
  notifier([]);
}

// -----------------------------------------------------------------------------
// Abonnement, pour que l'interface reflète l'état de la file
// -----------------------------------------------------------------------------
type Ecouteur = (file: EntreeFile[]) => void;
const ecouteurs = new Set<Ecouteur>();

function notifier(file: EntreeFile[]) {
  ecouteurs.forEach((e) => e(file));
}

export function sabonner(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  void lire().then(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

// -----------------------------------------------------------------------------
// Écriture
// -----------------------------------------------------------------------------
export function nouvelIdentifiant(): string {
  return Crypto.randomUUID();
}

/**
 * Tente l'insertion. En cas de panne réseau — et seulement dans ce cas — la
 * charge est gardée sur le téléphone et un succès optimiste est renvoyé.
 * Un refus de la base remonte tel quel : l'écran doit pouvoir l'expliquer.
 */
export async function ajouter(
  table: string,
  donnees: Record<string, unknown>,
): Promise<ResultatAjout> {
  const id = nouvelIdentifiant();
  const charge = { id, ...donnees };

  const reponse = (await supabase
    .from(table)
    .insert(charge)) as unknown as ReponseEcriture;

  if (!reponse.error) return { id, enFile: false, erreur: null };

  // Notre ligne existait déjà : un envoi précédent avait abouti sans qu'on
  // reçoive la réponse. Un doublon sur une AUTRE contrainte d'unicité n'est pas
  // ce cas — il tombe plus bas, et remonte à l'écran comme un refus.
  if (estDoublonClePrimaire(reponse.error, table)) {
    return { id, enFile: false, erreur: null };
  }

  if (!estEchecReseau(reponse)) {
    return { id, enFile: false, erreur: reponse.error };
  }

  const file = await lire();

  // Plafond atteint : refuser franchement plutôt que d'entasser. Une file qui
  // déborde ne se signale pas toute seule — elle échoue à s'écrire, un jour,
  // sans que personne ne l'ait demandé.
  if (file.length >= ENTREES_MAX) {
    return {
      id,
      enFile: false,
      erreur: refusLocal(
        CODE_FILE_PLEINE,
        `File pleine : ${file.length} entrées sur ${ENTREES_MAX}.`,
      ),
    };
  }

  file.push({
    id,
    table,
    donnees,
    creeeLe: new Date().toISOString(),
    tentatives: 0,
  });

  try {
    await ecrire(file);
  } catch (cause) {
    // Le téléphone n'a pas voulu garder la saisie. Le dire est la seule
    // réponse acceptable : annoncer « gardée sur le téléphone » serait une
    // promesse que rien ne tient.
    return {
      id,
      enFile: false,
      erreur: refusLocal(
        CODE_FILE_NON_ECRITE,
        cause instanceof Error ? cause.message : String(cause),
      ),
    };
  }

  return { id, enFile: true, erreur: null };
}

// -----------------------------------------------------------------------------
// Reprise en main par l'utilisateur
//
// Une entrée abandonnée ne repart plus d'elle-même. Ces deux fonctions sont ce
// qui permet à l'écran file-attente.tsx d'exister : sans elles, « abandonnée »
// serait un état sans issue.
// -----------------------------------------------------------------------------

/** Remet une entrée abandonnée dans le circuit : compteur à zéro, motif effacé. */
export async function reessayerEntree(id: string): Promise<void> {
  const file = await lire();
  await ecrire(
    file.map((e) => (e.id === id ? { ...e, tentatives: 0, erreur: undefined } : e)),
  );
}

/** Retire définitivement une entrée. L'écran doit demander confirmation. */
export async function supprimerEntree(id: string): Promise<void> {
  const file = await lire();
  await ecrire(file.filter((e) => e.id !== id));
}

// -----------------------------------------------------------------------------
// Rejeu
// -----------------------------------------------------------------------------
export type ResultatVidage = {
  envoyees: number;
  restantes: number;
  abandonnees: number;
};

// Un seul rejeu à la fois : NetInfo peut signaler plusieurs bascules coup sur
// coup, et deux rejeux concurrents se disputeraient la même file.
let rejeuEnCours = false;

export async function vider(): Promise<ResultatVidage> {
  if (rejeuEnCours) {
    const file = await lire();
    return {
      envoyees: 0,
      restantes: file.filter((e) => !e.erreur).length,
      abandonnees: file.filter((e) => e.erreur).length,
    };
  }
  rejeuEnCours = true;

  try {
    let file = await lire();
    let envoyees = 0;

    // Dans l'ordre de saisie : une vente peut dépendre d'un cycle créé juste
    // avant, et la base refuserait la référence dans le désordre.
    for (const entree of [...file]) {
      if (entree.erreur) continue;

      const reponse = (await supabase
        .from(entree.table)
        .insert({ id: entree.id, ...entree.donnees })) as unknown as ReponseEcriture;

      if (!reponse.error || estDoublonClePrimaire(reponse.error, entree.table)) {
        file = file.filter((e) => e.id !== entree.id);
        envoyees += 1;
        continue;
      }

      if (estEchecReseau(reponse)) {
        const tentatives = entree.tentatives + 1;
        file = file.map((e) =>
          e.id === entree.id
            ? {
                ...e,
                tentatives,
                erreur:
                  tentatives >= TENTATIVES_MAX
                    ? "Envoi impossible après plusieurs essais."
                    : undefined,
              }
            : e,
        );
        // Le réseau est retombé : inutile d'essayer les suivantes maintenant.
        break;
      }

      // Refus de la base. Le rejouer ne changera rien : on marque l'entrée
      // plutôt que de la laisser tourner en boucle.
      //
      // Le motif est traduit ici, au moment où on le connaît encore comme une
      // erreur Postgres. Plus tard il ne sera plus qu'une chaîne, et l'écran
      // qui l'affiche n'aurait eu qu'un « violates check constraint » à montrer
      // à un maraîcher.
      const motif = reponse.error
        ? messageErreurLisible(reponse.error, SUJETS_TABLE[entree.table] ?? "cette saisie")
        : "Refusé par la base.";
      file = file.map((e) =>
        e.id === entree.id ? { ...e, tentatives: e.tentatives + 1, erreur: motif } : e,
      );
    }

    await ecrire(file);
    return {
      envoyees,
      restantes: file.filter((e) => !e.erreur).length,
      abandonnees: file.filter((e) => e.erreur).length,
    };
  } finally {
    rejeuEnCours = false;
  }
}

// -----------------------------------------------------------------------------
// Reprise automatique
// -----------------------------------------------------------------------------
let arreterEcoute: (() => void) | null = null;

/** Rejoue la file dès que la connexion revient. Idempotent. */
export function demarrerEcouteReseau(): () => void {
  if (arreterEcoute) return arreterEcoute;

  let connecteAvant: boolean | null = null;

  const desabonner = NetInfo.addEventListener((etat) => {
    // isInternetReachable vaut null tant que la sonde n'a pas abouti ; on ne
    // le traite comme un refus que lorsqu'il est explicitement faux.
    const connecte = Boolean(etat.isConnected) && etat.isInternetReachable !== false;
    const retourDuReseau = connecte && connecteAvant === false;
    connecteAvant = connecte;

    if (retourDuReseau) void vider();
  });

  // Une file peut avoir survécu à la fermeture de l'application.
  void vider();

  arreterEcoute = () => {
    desabonner();
    arreterEcoute = null;
  };
  return arreterEcoute;
}

// -----------------------------------------------------------------------------
// Hook d'affichage
// -----------------------------------------------------------------------------
export function useFileAttente() {
  const [file, setFile] = useState<EntreeFile[]>([]);

  useEffect(() => sabonner(setFile), []);

  const rejouer = useCallback(async () => {
    await vider();
  }, []);

  return {
    entrees: file,
    total: file.length,
    enAttente: file.filter((e) => !e.erreur).length,
    abandonnees: file.filter((e) => e.erreur).length,
    rejouer,
  };
}
