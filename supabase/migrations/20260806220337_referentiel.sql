-- =============================================================================
-- AgriNafa · 02 — Référentiel partagé
-- Données communes à tous les exploitants : marchés, spéculations, prix,
-- itinéraires techniques. Lecture pour tous, écriture réservée au back-office.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Spéculations (aubergine Kalenda, poulet de chair, ovins…)
-- -----------------------------------------------------------------------------
create table public.speculations (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  nom                 text not null,
  filiere             public.filiere not null,
  unite_defaut        text not null default 'kg',
  -- Durée type du cycle : alimente le calcul de planification inversée.
  duree_cycle_jours   integer check (duree_cycle_jours is null or duree_cycle_jours > 0),
  icone               text,
  created_at          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Marchés de gros (Sankariaré, Nabi-Yaar, Bobo…)
-- -----------------------------------------------------------------------------
create table public.marches (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  ville       text not null,
  region      text,
  type_marche text not null default 'gros' check (type_marche in ('gros', 'detail', 'collecte')),
  latitude    numeric(10, 7) not null,
  longitude   numeric(10, 7) not null,
  jours_affluence text[],
  created_at  timestamptz not null default now()
);

create index idx_marches_ville on public.marches (ville);

-- -----------------------------------------------------------------------------
-- Relevés de prix — historique par marché et par spéculation
-- -----------------------------------------------------------------------------
create table public.prix_marches (
  id             uuid primary key default gen_random_uuid(),
  marche_id      uuid not null references public.marches (id) on delete cascade,
  speculation_id uuid not null references public.speculations (id) on delete cascade,
  prix_unitaire  numeric(12, 2) not null check (prix_unitaire >= 0), -- FCFA
  unite          text not null default 'kg',
  date_releve    date not null default current_date,
  source         text not null default 'producteur'
                 check (source in ('officiel', 'producteur', 'ong', 'grossiste', 'estimation')),
  created_at     timestamptz not null default now(),
  -- Un seul relevé par marché/spéculation/jour/source : évite les doublons
  -- envoyés en rafale quand plusieurs téléphones sortent du mode hors-ligne.
  unique (marche_id, speculation_id, date_releve, source)
);

create index idx_prix_recents
  on public.prix_marches (speculation_id, date_releve desc, marche_id);

-- Tendance sur 7 jours, consommée par le bandeau de prix de l'accueil
create or replace function public.tendance_prix(
  p_speculation_id uuid,
  p_marche_id uuid,
  p_jours integer default 7
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  with bornes as (
    select
      (select prix_unitaire from public.prix_marches
        where speculation_id = p_speculation_id and marche_id = p_marche_id
        order by date_releve desc limit 1) as actuel,
      (select prix_unitaire from public.prix_marches
        where speculation_id = p_speculation_id and marche_id = p_marche_id
          and date_releve <= current_date - p_jours
        order by date_releve desc limit 1) as ancien
  )
  select case
    when ancien is null or ancien = 0 then null
    else round(((actuel - ancien) / ancien) * 100, 1)
  end
  from bornes;
$$;

-- -----------------------------------------------------------------------------
-- Itinéraires techniques « de A à Z » (CDC §5)
-- -----------------------------------------------------------------------------
create table public.itineraires_techniques (
  id             uuid primary key default gen_random_uuid(),
  speculation_id uuid not null references public.speculations (id) on delete cascade,
  titre          text not null,
  description    text,
  saison         text check (saison in ('hivernage', 'contre_saison', 'toute_saison')),
  objectif       text,
  created_at     timestamptz not null default now()
);

create table public.etapes_itineraire (
  id             uuid primary key default gen_random_uuid(),
  itineraire_id  uuid not null references public.itineraires_techniques (id) on delete cascade,
  ordre          integer not null,
  titre          text not null,
  description    text,
  -- Fenêtre exprimée en jours depuis le début du cycle : permet de projeter
  -- l'étape sur des dates réelles quel que soit le jour de semis.
  jour_debut     integer,
  jour_fin       integer,
  points_de_controle text[],
  audio_path     text, -- version parlée de l'étape (moore / dioula)
  unique (itineraire_id, ordre)
);

create index idx_etapes_itineraire on public.etapes_itineraire (itineraire_id, ordre);

-- -----------------------------------------------------------------------------
-- Calendrier de prophylaxie type (Gumboro, Newcastle, vitamines…)
-- -----------------------------------------------------------------------------
create table public.protocoles_sanitaires (
  id             uuid primary key default gen_random_uuid(),
  speculation_id uuid not null references public.speculations (id) on delete cascade,
  nom            text not null,
  type_acte      text not null check (type_acte in ('vaccin', 'vitamine', 'deparasitage', 'traitement', 'controle')),
  produit        text,
  jour_age       integer not null check (jour_age >= 0),
  obligatoire    boolean not null default true,
  voie           text,
  consigne       text,
  unique (speculation_id, nom, jour_age)
);
