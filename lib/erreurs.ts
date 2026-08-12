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
  grossistes_note_fiabilite_check: "La note doit être comprise entre 1 et 5 étoiles.",
  parcelles_superficie_ha_check: "La superficie doit être supérieure à zéro.",
  cameras_intervalle_minutes_check: "La cadence doit être d'au moins une minute.",
  cameras_niveau_batterie_check: "Le niveau de batterie doit être compris entre 0 et 100 %.",
  cameras_statut_check: "Cet état de caméra n'est pas reconnu.",
  fiches_prevente_quantite_prevue_check:
    "La quantité annoncée doit être supérieure à zéro.",
  fiches_prevente_prix_demande_check: "Le prix demandé ne peut pas être négatif.",
  fiches_prevente_acompte_pourcent_check:
    "L'acompte doit être compris entre 0 et 100 %.",
};

/**
 * Contraintes d'unicité. Distinctes des contraintes de contrôle : le code n'est
 * pas le même, et le message non plus — ici rien n'est « invalide », c'est
 * seulement que la valeur est déjà prise.
 */
const PAR_UNICITE: Record<string, string> = {
  cameras_identifiant_materiel_key: "Cette caméra est déjà enregistrée.",
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

  // Doublon. La file d'attente absorbe déjà les collisions de clé primaire —
  // celles qui arrivent ici sont de vraies valeurs en double, à montrer.
  if (erreur.code === "23505") {
    for (const [contrainte, message] of Object.entries(PAR_UNICITE)) {
      if (texte.includes(contrainte)) return message;
    }
    return "Cette valeur est déjà utilisée.";
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

  // Formulation sans participe accordé : « la dépense » est féminin,
  // « cet acheteur » masculin. Une tournure impersonnelle évite d'avoir à
  // transporter le genre de chaque sujet jusqu'ici.
  if (texte.includes("network") || texte.includes("fetch") || texte.includes("timeout")) {
    return `Pas de connexion. Impossible d'enregistrer ${sujet}.`;
  }

  return "Enregistrement impossible. Réessayez dans un instant.";
}
