// =============================================================================
// Étape 4 — Identité de l'exploitant.
//
// « update » et jamais « insert » : la ligne existe déjà, créée par le trigger
// sur auth.users au moment de l'inscription.
// =============================================================================

import { useState } from "react";
import { useRouter } from "expo-router";

import { Aide, Bouton, Champ, Ecran, EpisDeMil, Erreur, Titre } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Au Burkina, une surface se dicte « deux virgule cinq ». PostgreSQL attend un
// point : sans cette conversion, 2,5 ha part en base comme 2 ha ou rien.
function versNombre(saisie: string): number | null {
  const normalise = saisie.trim().replace(",", ".");
  if (!normalise) return null;
  const valeur = Number(normalise);
  return Number.isFinite(valeur) && valeur >= 0 ? valeur : null;
}

export default function EcranProfil() {
  const router = useRouter();
  const { session, profil, rafraichirProfil } = useAuth();

  const [nom, setNom] = useState(
    profil && profil.nom_complet !== "Nouvel exploitant" ? profil.nom_complet : "",
  );
  const [localite, setLocalite] = useState(profil?.localite ?? "");
  const [surface, setSurface] = useState(
    profil?.superficie_ha != null ? String(profil.superficie_ha).replace(".", ",") : "",
  );
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const complet = nom.trim().length >= 2 && localite.trim().length >= 2;

  async function enregistrer() {
    if (!complet || !session?.user) return;

    const superficie = versNombre(surface);
    if (surface.trim() && superficie === null) {
      setErreur("La surface doit être un nombre, par exemple 2,5.");
      return;
    }

    setEnvoi(true);
    setErreur(null);

    const { error } = await supabase
      .from("profils")
      .update({
        nom_complet: nom.trim(),
        localite: localite.trim(),
        superficie_ha: superficie,
      })
      .eq("id", session.user.id);

    setEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }

    await rafraichirProfil();
    router.push("/(auth)/premier-cycle");
  }

  return (
    <Ecran>
      <EpisDeMil etape={4} total={5} />
      <Titre>Parlez-nous de vous</Titre>
      <Aide>Ces informations restent privées. Elles servent à vos calculs.</Aide>

      <Champ
        libelle="Nom complet"
        value={nom}
        onChangeText={setNom}
        placeholder="Ex. Ousmane Sawadogo"
        autoCapitalize="words"
        autoComplete="name"
      />

      <Champ
        libelle="Localité"
        value={localite}
        onChangeText={setLocalite}
        placeholder="Ex. Loumbila"
        autoCapitalize="words"
      />

      <Champ
        libelle="Surface exploitée (hectares)"
        value={surface}
        onChangeText={setSurface}
        placeholder="Ex. 2,5"
        keyboardType="decimal-pad"
      />

      <Erreur message={erreur} />

      <Bouton
        titre="Continuer"
        onPress={enregistrer}
        desactive={!complet}
        chargement={envoi}
      />
    </Ecran>
  );
}
