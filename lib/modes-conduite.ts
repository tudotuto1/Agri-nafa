// =============================================================================
// Modes de conduite : quand une spéculation porte plusieurs itinéraires.
//
// Une même production peut se mener de plusieurs façons, et l'écart n'est pas
// cosmétique : le bovin d'embouche demande 120 jours en conduite intensive
// contre 180 en semi-intensive. Choisir l'un ou l'autre change la date de mise
// en place, le coût, et les étapes à suivre.
//
// Ce module dit simplement, pour chaque spéculation, quels itinéraires
// existent. Les écrans de création n'ont à poser la question que là où il y a
// vraiment un choix — imposer une étape de plus pour une spéculation qui n'a
// qu'un guide serait une friction gratuite.
//
// Séparé de lib/guides.ts à dessein : celui-ci est purement calculatoire et se
// transpile tel quel dans les tests. Y verser un hook React et le client
// Supabase le rendrait intestable.
// =============================================================================

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type ItineraireDisponible = {
  itineraire_id: string;
  speculation_id: string;
  titre: string;
  mode_conduite: string | null;
  duree_totale_jours: number | null;
};

/**
 * Itinéraires groupés par spéculation.
 *
 * L'échec est silencieux et non bloquant : sans cette information, les écrans
 * de création se comportent comme avant l'existence des modes de conduite.
 * Mieux vaut une question en moins qu'un écran de création inaccessible.
 */
export function useItinerairesParSpeculation() {
  const [parSpeculation, setParSpeculation] = useState<
    Map<string, ItineraireDisponible[]>
  >(new Map());
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    supabase
      .from("vue_guides")
      .select("itineraire_id, speculation_id, titre, mode_conduite, duree_totale_jours")
      .then(({ data, error }) => {
        if (!actif) return;
        if (!error) {
          const table = new Map<string, ItineraireDisponible[]>();
          for (const ligne of (data ?? []) as ItineraireDisponible[]) {
            const liste = table.get(ligne.speculation_id) ?? [];
            liste.push(ligne);
            table.set(ligne.speculation_id, liste);
          }
          // Ordre stable : le plus court d'abord. Deux conduites listées dans
          // un ordre qui change d'un affichage à l'autre déstabilisent le
          // choix plus qu'elles ne l'éclairent.
          for (const liste of table.values()) {
            liste.sort(
              (a, b) => (a.duree_totale_jours ?? 0) - (b.duree_totale_jours ?? 0),
            );
          }
          setParSpeculation(table);
        }
        setChargement(false);
      });
    return () => {
      actif = false;
    };
  }, []);

  return { parSpeculation, chargement };
}

/** Les itinéraires d'une spéculation, ou une liste vide. */
export function itinerairesDe(
  table: Map<string, ItineraireDisponible[]>,
  speculationId: string | null | undefined,
): ItineraireDisponible[] {
  return speculationId ? (table.get(speculationId) ?? []) : [];
}

/** Y a-t-il un choix à poser ? Un seul itinéraire ne se choisit pas. */
export function demandeUnChoix(
  table: Map<string, ItineraireDisponible[]>,
  speculationId: string | null | undefined,
): boolean {
  return itinerairesDe(table, speculationId).length > 1;
}
