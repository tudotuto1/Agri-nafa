-- =============================================================================
-- AgriNafa · 01 — Socle
-- Extensions, types métier, fonctions utilitaires, profils exploitants
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Types métier (ENUM plutôt que VARCHAR libre : le CDC listait les valeurs
-- en commentaire, on les fait respecter par la base)
-- -----------------------------------------------------------------------------
create type public.type_cycle       as enum ('culture', 'elevage');
create type public.statut_cycle     as enum ('planifie', 'actif', 'cloture', 'sinistre');
create type public.filiere          as enum ('maraichage', 'avicole', 'elevage', 'cereale', 'autre');
create type public.categorie_stock  as enum ('semence', 'engrais', 'aliment', 'prophylaxie', 'phytosanitaire', 'carburant', 'materiel', 'autre');
create type public.sens_mouvement   as enum ('entree', 'sortie', 'ajustement', 'perte');
create type public.categorie_depense as enum ('intrants', 'main_d_oeuvre', 'carburant', 'transport', 'veterinaire', 'irrigation', 'location', 'autre');
create type public.source_saisie    as enum ('manuelle', 'vocale', 'import', 'automatique');
create type public.mode_paiement    as enum ('especes', 'orange_money', 'moov_money', 'telecel', 'wave', 'virement', 'credit');
create type public.langue_app       as enum ('fr', 'moore', 'dioula', 'fulfulde');
create type public.gravite_alerte   as enum ('info', 'attention', 'urgent');

-- -----------------------------------------------------------------------------
-- Horodatage automatique
-- -----------------------------------------------------------------------------
create or replace function public.tg_maj_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.tg_maj_updated_at is
  'Met à jour updated_at. Colonne pivot de la synchronisation offline-first : '
  'le client ne redemande que les lignes modifiées depuis son dernier passage.';

-- -----------------------------------------------------------------------------
-- Profils exploitants (extension de auth.users)
-- -----------------------------------------------------------------------------
create table public.profils (
  id                uuid primary key references auth.users (id) on delete cascade,
  nom_complet       text not null,
  telephone         text,
  langue            public.langue_app not null default 'fr',
  -- Beaucoup d'utilisateurs cibles ne lisent pas : l'app doit pouvoir basculer
  -- en mode vocal/pictogrammes dès l'ouverture.
  mode_vocal_prefere boolean not null default false,
  localite          text,
  commune           text,
  region            text,
  superficie_ha     numeric(8, 2) check (superficie_ha is null or superficie_ha >= 0),
  latitude          numeric(10, 7),
  longitude         numeric(10, 7),
  onboarding_termine boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_profils_updated_at
  before update on public.profils
  for each row execute function public.tg_maj_updated_at();

-- Création automatique du profil à l'inscription (OTP téléphone)
create or replace function public.tg_creer_profil_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profils (id, nom_complet, telephone, langue)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nom_complet', 'Nouvel exploitant'),
    new.phone,
    coalesce((new.raw_user_meta_data ->> 'langue')::public.langue_app, 'fr')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_cree
  after insert on auth.users
  for each row execute function public.tg_creer_profil_utilisateur();

-- -----------------------------------------------------------------------------
-- Planification événementielle inversée (CDC §5)
-- Partir de la date de forte demande, remonter au jour de mise en place.
-- -----------------------------------------------------------------------------
create or replace function public.date_mise_en_place(
  date_cible_marche date,
  duree_cycle_jours integer,
  marge_securite_jours integer default 7
)
returns date
language sql
immutable
security invoker
set search_path = ''
as $$
  select date_cible_marche - (duree_cycle_jours + marge_securite_jours);
$$;

comment on function public.date_mise_en_place is
  'Ex. Tabaski le 27/05 - (45 j de poulets de chair + 7 j de marge) = mise en place le 05/04.';
