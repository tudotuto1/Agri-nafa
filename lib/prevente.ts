// =============================================================================
// Composition du message de prévente.
//
// C'est le livrable réel de l'écran : un texte destiné à un statut WhatsApp ou
// à un message direct, pas à un courrier. Phrases courtes, une information par
// ligne, des emojis qui servent de repères visuels à qui lit mal.
//
// Le message est écrit pour obtenir une chose : un acompte. Le montant à
// verser y figure en chiffres, calculé, pas en pourcentage à convertir de
// tête. Un grossiste qui doit faire une règle de trois ne répond pas.
// =============================================================================

import { dateEnFrancais, formaterFcfa, grouperChiffres } from "@/lib/format";

export type DonneesFiche = {
  /** Ce que le producteur annonce : « Aubergine Kalenda », « Poulet de chair ». */
  produit: string;
  quantite: number;
  unite: string;
  /** AAAA-MM-JJ */
  dateDisponibilite: string;
  lieu: string | null;
  prixUnitaire: number | null;
  acomptePourcent: number;
};

/** Montant d'acompte demandé, arrondi au franc. null si non calculable. */
export function montantAcompte(donnees: DonneesFiche): number | null {
  if (donnees.prixUnitaire === null || donnees.prixUnitaire <= 0) return null;
  if (donnees.quantite <= 0) return null;
  const total = donnees.quantite * donnees.prixUnitaire;
  return Math.round((total * donnees.acomptePourcent) / 100);
}

export function composerTextePrevente(donnees: DonneesFiche): string {
  const { produit, quantite, unite, dateDisponibilite, lieu, prixUnitaire } = donnees;
  const lignes: string[] = [];

  lignes.push(
    `🌾 ${produit.toUpperCase()} — ${grouperChiffres(String(quantite))} ${unite} à vendre`,
  );
  lignes.push("");
  lignes.push(`📅 Disponible le ${dateEnFrancais(dateDisponibilite)}`);
  if (lieu) lignes.push(`📍 Enlèvement à ${lieu}`);

  if (prixUnitaire !== null && prixUnitaire > 0) {
    const total = quantite * prixUnitaire;
    lignes.push(`💰 ${formaterFcfa(prixUnitaire)}/${unite} — ${formaterFcfa(total)} le tout`);

    const acompte = montantAcompte(donnees);
    if (acompte !== null && donnees.acomptePourcent > 0) {
      lignes.push("");
      lignes.push(
        `Je réserve à celui qui verse un acompte de ${donnees.acomptePourcent} %, soit ${formaterFcfa(acompte)}.`,
      );
    } else {
      lignes.push("");
      lignes.push("Premier arrivé, premier servi.");
    }
  } else {
    lignes.push("");
    lignes.push("Faites-moi votre meilleure offre.");
  }

  lignes.push("📲 Orange Money, Moov Money, Wave ou espèces.");
  lignes.push("");
  lignes.push("Répondez ici, un message vocal suffit. 🎤");

  return lignes.join("\n");
}
