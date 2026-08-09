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

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as Crypto from "expo-crypto";
import type { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export const CLE_FILE = "agrinafa.file-attente";

/** Au-delà, on cesse de réessayer et on marque l'entrée pour l'utilisateur. */
export const TENTATIVES_MAX = 5;

/** Conflit de clé primaire : la ligne existe déjà, donc le rejeu a abouti. */
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
  /** Renseigné seulement pour un refus de la base — jamais pour une panne. */
  erreur: PostgrestError | null;
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

function estDoublon(erreur: PostgrestError | null): boolean {
  return (erreur?.code ?? "") === CODE_DOUBLON;
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

async function ecrire(file: EntreeFile[]): Promise<void> {
  await AsyncStorage.setItem(CLE_FILE, JSON.stringify(file));
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

  // La ligne existait déjà : un envoi précédent avait abouti sans qu'on
  // reçoive la réponse.
  if (estDoublon(reponse.error)) return { id, enFile: false, erreur: null };

  if (!estEchecReseau(reponse)) {
    return { id, enFile: false, erreur: reponse.error };
  }

  const file = await lire();
  file.push({
    id,
    table,
    donnees,
    creeeLe: new Date().toISOString(),
    tentatives: 0,
  });
  await ecrire(file);

  return { id, enFile: true, erreur: null };
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

      if (!reponse.error || estDoublon(reponse.error)) {
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
      file = file.map((e) =>
        e.id === entree.id
          ? { ...e, tentatives: e.tentatives + 1, erreur: reponse.error?.message ?? "Refusé" }
          : e,
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
    enAttente: file.filter((e) => !e.erreur).length,
    abandonnees: file.filter((e) => e.erreur).length,
    rejouer,
  };
}
