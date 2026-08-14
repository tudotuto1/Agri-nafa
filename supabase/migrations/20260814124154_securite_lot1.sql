-- =============================================================================
-- Sécurité, lot 1 : fermer l'accès aux fonctions internes, plafonner l'acompte.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fonctions internes : retirer l'accès public
--
-- Ces deux fonctions sont des triggers ou des utilitaires internes, et sont les
-- seules du schéma `public` en SECURITY DEFINER — donc les seules à s'exécuter
-- avec les droits du propriétaire plutôt que ceux de l'appelant. Rien ne
-- justifie qu'un rôle client les garde dans ses droits.
--
-- Précision sur ce que cette migration corrige, pour ne pas se raconter
-- d'histoire : aucune des deux n'est aujourd'hui atteignable depuis l'API REST.
-- `tg_creer_profil_utilisateur` renvoie `trigger` et `rls_auto_enable` renvoie
-- `event_trigger` ; PostgREST n'expose pas les fonctions à pseudo-type, et
-- Postgres lui-même refuse un appel direct. Ce qu'on retire ici est donc un
-- droit qui ne sert à rien — ce qui est précisément la raison de le retirer.
-- Le jour où l'une d'elles change de signature, la porte serait déjà fermée.
--
-- Révoquer EXECUTE ne désarme pas les triggers : Postgres vérifie ce droit à la
-- création du trigger, pas à chaque déclenchement. La création automatique du
-- profil à l'inscription continue donc de fonctionner (vérifié en base).
--
-- `revoke ... from public` ne suffit pas seul : un droit accordé nommément à
-- `authenticated` survit à une révocation sur PUBLIC. D'où les trois rôles.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
revoke execute on function public.tg_creer_profil_utilisateur() from anon, authenticated, public;

-- Volontairement épargnées : `generer_calendrier_sanitaire`,
-- `date_mise_en_place` et `tendance_prix` sont appelées par l'application et
-- restent exécutables par `authenticated`. Elles sont toutes en SECURITY
-- INVOKER — la RLS de l'appelant s'applique, il n'y a pas d'élévation de droit
-- à refermer. `premier-cycle.tsx` appelle la première en RPC juste après la
-- création d'un cycle d'élevage : la révoquer casserait l'inscription.

-- -----------------------------------------------------------------------------
-- 2. Un acompte ne peut pas dépasser la vente
--
-- Un acompte supérieur au montant de la vente n'a pas de sens comptable : il
-- ferait apparaître un encaissement que la vente ne justifie pas, et la marge
-- calculée derrière deviendrait fausse.
--
-- Les trois colonnes sont NOT NULL, donc l'expression ne peut jamais s'évaluer
-- à NULL : pas de ligne qui passerait à travers par un trou de trivalence.
-- `quantite_vendue * prix_unitaire` est exactement l'expression de la colonne
-- générée `revenu_total` ; on la réécrit plutôt que de référencer la colonne
-- calculée, ce qui garde la contrainte indépendante de sa définition.
alter table public.ventes
  add constraint chk_acompte_plafonne
  check (acompte_recu <= quantite_vendue * prix_unitaire);

comment on constraint chk_acompte_plafonne on public.ventes is
  'Un acompte encaissé ne peut pas excéder le montant total de la vente.';
