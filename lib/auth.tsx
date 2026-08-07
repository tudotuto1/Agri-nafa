// =============================================================================
// Contexte d'authentification.
//
// Le profil n'est jamais créé ici : un trigger sur auth.users s'en charge en
// base. L'application se contente de le lire et de le mettre à jour. Deux
// sources de vérité finiraient toujours par diverger.
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase, type Profil } from "@/lib/supabase";

type ContexteAuth = {
  session: Session | null;
  profil: Profil | null;
  chargement: boolean;
  rafraichirProfil: () => Promise<void>;
  deconnexion: () => Promise<void>;
};

const Contexte = createContext<ContexteAuth | null>(null);

const CHAMPS_PROFIL =
  "id, nom_complet, telephone, langue, mode_vocal_prefere, localite, commune, region, superficie_ha, onboarding_termine";

export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);

  const lireProfil = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profils")
      .select(CHAMPS_PROFIL)
      .eq("id", userId)
      .maybeSingle();

    // maybeSingle plutôt que single : juste après l'inscription, le trigger
    // peut n'avoir pas encore validé sa transaction. Une absence momentanée
    // n'est pas une erreur, l'aiguilleur repassera.
    if (error) {
      console.warn("Lecture du profil impossible :", error.message);
      return;
    }
    setProfil((data as Profil | null) ?? null);
  }, []);

  const rafraichirProfil = useCallback(async () => {
    if (!session?.user) return;
    await lireProfil(session.user.id);
  }, [session, lireProfil]);

  useEffect(() => {
    let actif = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!actif) return;
      setSession(data.session);
      if (data.session?.user) await lireProfil(data.session.user.id);
      if (actif) setChargement(false);
    });

    const { data: abonnement } = supabase.auth.onAuthStateChange(
      async (_evenement, nouvelleSession) => {
        if (!actif) return;
        setSession(nouvelleSession);
        if (nouvelleSession?.user) {
          await lireProfil(nouvelleSession.user.id);
        } else {
          setProfil(null);
        }
        if (actif) setChargement(false);
      },
    );

    return () => {
      actif = false;
      abonnement.subscription.unsubscribe();
    };
  }, [lireProfil]);

  const deconnexion = useCallback(async () => {
    await supabase.auth.signOut();
    setProfil(null);
  }, []);

  const valeur = useMemo(
    () => ({ session, profil, chargement, rafraichirProfil, deconnexion }),
    [session, profil, chargement, rafraichirProfil, deconnexion],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAuth() {
  const contexte = useContext(Contexte);
  if (!contexte) {
    throw new Error("useAuth doit être utilisé dans un <FournisseurAuth>.");
  }
  return contexte;
}
