-- =============================================================================
-- AgriNafa · 04 — Finances & commercialisation
-- =============================================================================

create table public.depenses (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  cycle_id                uuid not null,
  description             text not null,
  categorie               public.categorie_depense not null,
  montant_total           numeric(12, 2) not null check (montant_total >= 0), -- FCFA
  stock_id                uuid,
  quantite_stock_utilisee numeric(12, 2) check (quantite_stock_utilisee is null or quantite_stock_utilisee > 0),
  date_depense            date not null default current_date,

  -- Traçabilité de la saisie vocale (CDC §3.A)
  saisie_source           public.source_saisie not null default 'manuelle',
  audio_path              text,
  transcription           text,
  confiance_ia            numeric(4, 3) check (confiance_ia is null or confiance_ia between 0 and 1),
  -- L'IA propose, l'humain valide.
  validee                 boolean not null default true,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,

  constraint fk_depense_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade,
  constraint fk_depense_stock foreign key (stock_id, user_id)
    references public.stocks (id, user_id) on delete set null,
  constraint chk_vocal_a_valider
    check (saisie_source <> 'vocale' or confiance_ia is not null)
);

create index idx_depenses_cycle on public.depenses (cycle_id, date_depense desc) where deleted_at is null;
create index idx_depenses_user on public.depenses (user_id, date_depense desc) where deleted_at is null;
create index idx_depenses_a_valider on public.depenses (user_id) where validee = false and deleted_at is null;

create trigger trg_depenses_updated_at
  before update on public.depenses
  for each row execute function public.tg_maj_updated_at();

-- -----------------------------------------------------------------------------
create table public.productions_recoltes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  cycle_id          uuid not null,
  quantite_recoltee numeric(12, 2) not null check (quantite_recoltee > 0),
  unite             text not null,
  qualite           text check (qualite is null or qualite in ('premier_choix', 'second_choix', 'ecart_de_tri')),
  date_recolte      date not null default current_date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint fk_recolte_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade
);

create index idx_recoltes_cycle on public.productions_recoltes (cycle_id, date_recolte desc) where deleted_at is null;

create trigger trg_recoltes_updated_at
  before update on public.productions_recoltes
  for each row execute function public.tg_maj_updated_at();

-- -----------------------------------------------------------------------------
-- Répertoire des grossistes (« bana-banas », CDC §6)
-- -----------------------------------------------------------------------------
create table public.grossistes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  nom                 text not null,
  marche_id           uuid references public.marches (id) on delete set null,
  telephone_whatsapp  text,
  ville               text,
  -- Canal exclusif de la cible : messages vocaux WhatsApp, le matin.
  prefere_message_vocal boolean not null default true,
  note_fiabilite      smallint check (note_fiabilite is null or note_fiabilite between 1 and 5),
  commentaire         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (id, user_id)
);

create index idx_grossistes_user on public.grossistes (user_id) where deleted_at is null;

create trigger trg_grossistes_updated_at
  before update on public.grossistes
  for each row execute function public.tg_maj_updated_at();

-- -----------------------------------------------------------------------------
create table public.ventes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  cycle_id        uuid not null,
  grossiste_id    uuid,
  client_nom      text,
  quantite_vendue numeric(12, 2) not null check (quantite_vendue > 0),
  prix_unitaire   numeric(12, 2) not null check (prix_unitaire >= 0),
  revenu_total    numeric(14, 2) generated always as (quantite_vendue * prix_unitaire) stored,
  acompte_recu    numeric(12, 2) not null default 0 check (acompte_recu >= 0),
  mode_paiement   public.mode_paiement not null default 'especes',
  marche_id       uuid references public.marches (id) on delete set null,
  date_vente      date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,

  constraint fk_vente_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade,
  constraint fk_vente_grossiste foreign key (grossiste_id, user_id)
    references public.grossistes (id, user_id) on delete set null
);

create index idx_ventes_cycle on public.ventes (cycle_id, date_vente desc) where deleted_at is null;
create index idx_ventes_grossiste on public.ventes (grossiste_id, date_vente desc);

create trigger trg_ventes_updated_at
  before update on public.ventes
  for each row execute function public.tg_maj_updated_at();

-- -----------------------------------------------------------------------------
-- Fiches de prévente WhatsApp (CDC §6)
-- -----------------------------------------------------------------------------
create table public.fiches_prevente (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  cycle_id           uuid not null,
  quantite_prevue    numeric(12, 2) not null check (quantite_prevue > 0),
  unite              text not null default 'kg',
  date_disponibilite date not null,
  prix_demande       numeric(12, 2) check (prix_demande is null or prix_demande >= 0),
  lieu_enlevement    text,
  acompte_pourcent   smallint default 30 check (acompte_pourcent between 0 and 100),
  texte_genere       text,
  capture_id         uuid, -- FK ajoutée en migration 06
  canaux             text[] not null default array['whatsapp'],
  publiee_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint fk_fiche_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade
);

create index idx_fiches_user on public.fiches_prevente (user_id, date_disponibilite desc);

create trigger trg_fiches_updated_at
  before update on public.fiches_prevente
  for each row execute function public.tg_maj_updated_at();
