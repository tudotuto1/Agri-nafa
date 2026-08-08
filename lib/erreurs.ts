// =============================================================================
// Traduction des erreurs d'écriture en français lisible.
//
// Les noms de contraintes viennent du schéma réel et les messages attendus ont
// été relevés sur la base elle-même, pas devinés. Un « violates check
// constraint » affiché à un maraîcher n'est pas une information : c'est un mur.
//
// Règle : aucune chaîne renvoyée ici ne doit contenir de vocabulaire Postgres.
// =============================================================================

import type { PostgrestError } from "@supabase/supabase-js";

const PAR_CONTRAINTE: Record<string, string> = {
  depenses_montant_total_check: "Le montant ne peut pas être négatif.",
  ventes_quantite_vendue_check: "La quantité vendue doit être supérieure à zéro.",
  ventes_prix_unitaire_check: "Le prix unitaire ne peut pas être négatif.",
  ventes_acompte_recu_check: "L'acompte ne peut pas être négatif.",
  productions_recoltes_quantite_recoltee_check:
    "La quantité récoltée doit être supérieure à zéro.",
  productions_recoltes_qualite_check: "La qualité choisie n'est pas reconnue.",
};

/**
 * @param sujet groupe nominal utilisé dans les messages génériques,
 *              par exemple « la dépense » ou « la vente ».
 */
export function messageErreurLisible(erreur: PostgrestError, sujet: string): string {
  const texte = `${erreur.message ?? ""} ${erreur.details ?? ""}`.toLowerCase();

  // Colonne générée : le total est calculé par la base, jamais écrit.
  // Signe d'une régression dans le code, pas d'une faute de saisie.
  if (erreur.code === "428C9") {
    return "Ce total est calculé automatiquement et ne peut pas être saisi.";
  }

  if (erreur.code === "23514") {
    for (const [contrainte, message] of Object.entries(PAR_CONTRAINTE)) {
      if (texte.includes(contrainte)) return message;
    }
    return `Une valeur saisie n'est pas acceptée. Vérifiez les montants.`;
  }

  if (erreur.code === "23502") {
    if (texte.includes("description")) return "La description est obligatoire.";
    if (texte.includes("cycle_id")) return "Choisissez le cycle concerné.";
    if (texte.includes("quantite_vendue")) return "La quantité vendue est obligatoire.";
    if (texte.includes("quantite_recoltee")) return "La quantité récoltée est obligatoire.";
    if (texte.includes("prix_unitaire")) return "Le prix unitaire est obligatoire.";
    // unite est NOT NULL : signe que l'unité de la spéculation n'a pas été
    // résolue, pas d'une faute de saisie.
    if (texte.includes('"unite"')) {
      return "L'unité de cette production est introuvable. Réessayez depuis l'accueil.";
    }
    return "Un champ obligatoire est resté vide.";
  }

  if (erreur.code === "23503") {
    return "Le cycle choisi n'existe plus. Revenez en arrière et réessayez.";
  }

  if (erreur.code === "22007" || erreur.code === "22008") {
    return "La date n'est pas comprise. Écrivez-la sous la forme JJ/MM/AAAA.";
  }

  if (erreur.code === "22P02") {
    return "Une valeur saisie n'est pas au bon format.";
  }

  if (erreur.code === "42501" || erreur.code === "PGRST301") {
    return `Vous n'avez pas le droit d'enregistrer ${sujet}.`;
  }

  if (texte.includes("network") || texte.includes("fetch") || texte.includes("timeout")) {
    return `Pas de connexion. ${majuscule(sujet)} n'a pas été enregistrée.`;
  }

  return "Enregistrement impossible. Réessayez dans un instant.";
}

function majuscule(mots: string): string {
  return mots.charAt(0).toUpperCase() + mots.slice(1);
}
