// =============================================================================
// Chargement des cycles actifs, avec leur unité et leurs agrégats.
//
// Trois requêtes en parallèle plutôt qu'une jointure imbriquée PostgREST :
// l'unité vit dans speculations, les agrégats dans vue_rentabilite_cycles.
// La table des spéculations tient en une dizaine de lignes — la rapatrier
// coûte moins cher qu'une requête dont on ne peut pas vérifier la forme.
//
// Partagé par les écrans de vente et de récolte : une seule définition de ce
// qu'est « un cycle sur lequel on peut écrire ».
// =============================================================================

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type CycleActifDetaille = {
  id: string;
  nom: string;
  /** Unité de la spéculation (kg, sujet, tête…), jamais vide. */
  unite: string;
  /** Récolté moins déjà vendu. null si la vue ne sait pas. */
  quantiteRestante: number | null;
  totalRecolte: number | null;
  totalDepenses: number | null;
  prixDeRevient: number | null;
};

const UNITE_PAR_DEFAUT = "unité";

/**
 * Prix de revient une fois une récolte supplémentaire enregistrée : les mêmes
 * dépenses réparties sur la récolte cumulée.
 *
 * Renvoie null quand le chiffre n'aurait pas de sens — aucune dépense saisie,
 * ou cumul nul. Mieux vaut ne rien afficher qu'afficher zéro : « 0 F/kg »
 * se lirait comme « ça ne m'a rien coûté ».
 */
export function prixDeRevientProjete(
  totalDepenses: number | null,
  totalRecolte: number | null,
  quantiteAjoutee: number,
): number | null {
  if (totalDepenses === null || totalDepenses <= 0) return null;
  if (quantiteAjoutee <= 0) return null;
  const cumul = (totalRecolte ?? 0) + quantiteAjoutee;
  if (cumul <= 0) return null;
  return totalDepenses / cumul;
}

export function useCyclesActifs() {
  const [cycles, setCycles] = useState<CycleActifDetaille[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;

    (async () => {
      const [resCycles, resSpec, resRenta] = await Promise.all([
        supabase
          .from("cycles_production")
          .select("id, nom, speculation_id")
          .eq("statut", "actif")
          .is("deleted_at", null)
          .order("date_debut", { ascending: false }),
        supabase.from("speculations").select("id, unite_defaut"),
        supabase
          .from("vue_rentabilite_cycles")
          .select(
            "cycle_id, quantite_restante, total_recolte, total_depenses, prix_de_revient_unitaire",
          )
          .eq("statut", "actif"),
      ]);

      if (!actif) return;

      if (resCycles.error || resSpec.error || resRenta.error) {
        setErreur("Impossible de charger vos cycles. Réessayez.");
        setChargement(false);
        return;
      }

      const unites = new Map<string, string>(
        ((resSpec.data ?? []) as { id: string; unite_defaut: string }[]).map((s) => [
          s.id,
          s.unite_defaut,
        ]),
      );

      type LigneRenta = {
        cycle_id: string;
        quantite_restante: number | null;
        total_recolte: number | null;
        total_depenses: number | null;
        prix_de_revient_unitaire: number | null;
      };
      const agregats = new Map<string, LigneRenta>(
        ((resRenta.data ?? []) as LigneRenta[]).map((r) => [r.cycle_id, r]),
      );

      const liste: CycleActifDetaille[] = (
        (resCycles.data ?? []) as {
          id: string;
          nom: string;
          speculation_id: string | null;
        }[]
      ).map((c) => {
        const agg = agregats.get(c.id);
        return {
          id: c.id,
          nom: c.nom,
          unite:
            (c.speculation_id ? unites.get(c.speculation_id) : null) ?? UNITE_PAR_DEFAUT,
          quantiteRestante: agg?.quantite_restante ?? null,
          totalRecolte: agg?.total_recolte ?? null,
          totalDepenses: agg?.total_depenses ?? null,
          prixDeRevient: agg?.prix_de_revient_unitaire ?? null,
        };
      });

      setCycles(liste);
      setChargement(false);
    })();

    return () => {
      actif = false;
    };
  }, []);

  return { cycles, chargement, erreur };
}
