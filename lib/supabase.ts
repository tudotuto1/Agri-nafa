// =============================================================================
// Client Supabase unique de l'application.
//
// Toujours la clé publiable, jamais la service_role : c'est ce qui garantit
// que la RLS s'applique. Une service_role embarquée dans un APK public
// donnerait à quiconque le décompile un accès total à la base.
// =============================================================================

import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const cle = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !cle) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont absentes. " +
      "Copiez .env.example en .env avant de lancer l'application.",
  );
}

export const supabase = createClient(url, cle, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Pas de redirection OAuth par URL sur mobile : l'authentification passe
    // par un code SMS, il n'y a rien à lire dans l'URL de lancement.
    detectSessionInUrl: false,
  },
});

// Android suspend les minuteurs dès que l'application passe en arrière-plan.
// Sans ce relais, le jeton expire en silence et le producteur se retrouve
// déconnecté au moment où il ouvre l'app pour saisir une dépense.
AppState.addEventListener("change", (etat) => {
  if (etat === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// -----------------------------------------------------------------------------
export type Langue = "fr" | "moore" | "dioula" | "fulfulde";

export type Profil = {
  id: string;
  nom_complet: string;
  telephone: string | null;
  langue: Langue;
  mode_vocal_prefere: boolean;
  localite: string | null;
  commune: string | null;
  region: string | null;
  superficie_ha: number | null;
  onboarding_termine: boolean;
};

export type Speculation = {
  id: string;
  code: string;
  nom: string;
  filiere: "maraichage" | "avicole" | "elevage" | "cereale" | "autre";
  unite_defaut: string;
  duree_cycle_jours: number | null;
  icone: string | null;
};

// Clé AsyncStorage du choix de langue. Il est fait avant même d'avoir un
// compte, donc avant de pouvoir l'écrire dans public.profils.
export const CLE_LANGUE = "agrinafa.langue";
