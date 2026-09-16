// =============================================================================
// Réserve d'espace en bas d'écran.
//
// Le bouton flottant de l'assistant est posé au-dessus du contenu, ancré en
// bas à droite. Or tous les écrans de l'application se terminent par un
// bouton pleine largeur — « Enregistrer la dépense », « Valider », « Retour ».
// Les mesures se recoupent exactement : le bouton flottant occupe une bande de
// 24 à 84 px au-dessus de la zone sûre, le dernier bouton de l'écran occupe
// 24 à 84 px lui aussi. Le flottant recouvrirait donc la partie droite du
// dernier bouton, libellé compris sur un écran étroit.
//
// Plutôt que de déplacer le bouton flottant — ce qui l'éloignerait du pouce,
// seule position qui vaille sur un téléphone tenu d'une main — l'écran réserve
// la hauteur correspondante sous son contenu.
//
// -----------------------------------------------------------------------------
// POURQUOI UN CONTEXTE, ET PAS UNE MARGE ÉCRITE SUR CHAQUE ÉCRAN
//
// Il y a dix-huit écrans, et il s'en ajoute à chaque lot. Une marge posée à la
// main serait oubliée sur le prochain, et le défaut ne se verrait qu'au moment
// où quelqu'un n'arrive plus à valider sa saisie. Ici `Ecran` lit la réserve :
// tout écran monté sous le bouton flottant l'obtient sans rien demander.
//
// Et les cinq écrans d'inscription, qui utilisent `Ecran` mais vivent hors du
// groupe (app), n'ont pas de bouton flottant — ils lisent donc zéro et ne
// paient pas une réserve qui ne leur sert à rien.
//
// Ce module ne dépend que de React et du thème : `components/ui` peut l'importer
// sans créer de cycle avec `components/bouton-assistant`, qui lui utilise `ui`.
// =============================================================================

import { createContext, useContext, type ReactNode } from "react";

import { CIBLE_TACTILE, espaces } from "@/constants/theme";

/**
 * Hauteur du bouton flottant, plus son décalage par rapport au bas, plus un
 * intervalle pour que le dernier bouton de l'écran ne le frôle pas.
 */
export const RESERVE_BOUTON_FLOTTANT = CIBLE_TACTILE + espaces.lg + espaces.md;

const ContexteReserve = createContext(0);

export function FournisseurReserveBasse({
  reserve,
  children,
}: {
  reserve: number;
  children: ReactNode;
}) {
  return (
    <ContexteReserve.Provider value={reserve}>{children}</ContexteReserve.Provider>
  );
}

/** Hauteur à réserver sous le contenu. Zéro hors du groupe (app). */
export function useReserveBasse(): number {
  return useContext(ContexteReserve);
}
