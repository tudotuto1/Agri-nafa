-- =============================================================================
-- AgriNafa · 05 — Élevage & santé animale
-- Objectif du CDC : maintenir la mortalité des bandes sous 5 %.
-- =============================================================================

create table public.evenements_sanitaires (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  cycle_id      uuid not null,
  protocole_id  uuid references public.protocoles_sanitaires (id) on delete set null,
  nom           text not null,
  type_acte     text not null check (type_acte in ('vaccin', 'vitamine', 'deparasitage', 'traitement', 'controle')),
  produit       text,
  jour_age      integer check (jour_age is null or jour_age >= 0),
  date_prevue   date not null,
  date_realisee date,
  stock_id      uuid,
  cout          numeric(12, 2) check (cout is null or cout >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint fk_sanit_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade,
  constraint fk_sanit_stock foreign key (stock_id, user_id)
    references public.stocks (id, user_id) on delete set null
);

create index idx_sanit_a_venir
  on public.evenements_sanitaires (user_id, date_prevue)
  where date_realisee is null;

create trigger trg_sanit_updated_at
  before update on public.evenements_sanitaires
  for each row execute function public.tg_maj_updated_at();

-- Statut dérivé plutôt que stocké : « en retard » dépend du jour où on regarde.
create or replace function public.statut_evenement_sanitaire(
  p_date_prevue date,
  p_date_realisee date
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_date_realisee is not null then 'realise'
    when p_date_prevue < current_date then 'en_retard'
    when p_date_prevue <= current_date + 2 then 'imminent'
    else 'planifie'
  end;
$$;

-- -----------------------------------------------------------------------------
create or replace function public.generer_calendrier_sanitaire(p_cycle_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cycle   public.cycles_production%rowtype;
  v_inseres integer := 0;
begin
  select * into v_cycle
  from public.cycles_production
  where id = p_cycle_id;

  if not found then
    raise exception 'Cycle % introuvable', p_cycle_id;
  end if;

  if v_cycle.speculation_id is null then
    return 0;
  end if;

  insert into public.evenements_sanitaires
    (user_id, cycle_id, protocole_id, nom, type_acte, produit, jour_age, date_prevue)
  select
    v_cycle.user_id,
    v_cycle.id,
    p.id,
    p.nom,
    p.type_acte,
    p.produit,
    p.jour_age,
    v_cycle.date_debut + p.jour_age
  from public.protocoles_sanitaires p
  where p.speculation_id = v_cycle.speculation_id
    and not exists (
      select 1 from public.evenements_sanitaires e
      where e.cycle_id = v_cycle.id and e.protocole_id = p.id
    );

  get diagnostics v_inseres = row_count;
  return v_inseres;
end;
$$;

comment on function public.generer_calendrier_sanitaire is
  'Projette le protocole type de la spéculation sur les dates réelles du cycle.';

-- -----------------------------------------------------------------------------
create table public.mortalites (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  cycle_id     uuid not null,
  nombre       integer not null check (nombre > 0),
  cause        text check (cause is null or cause in
                ('maladie', 'chaleur', 'predateur', 'accident', 'ecrasement', 'inconnue')),
  date_constat date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now(),

  constraint fk_mortalite_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade
);

create index idx_mortalites_cycle on public.mortalites (cycle_id, date_constat desc);

-- -----------------------------------------------------------------------------
create table public.suivi_itineraire (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  cycle_id      uuid not null,
  etape_id      uuid not null references public.etapes_itineraire (id) on delete cascade,
  realisee      boolean not null default false,
  date_realisee date,
  notes         text,
  updated_at    timestamptz not null default now(),

  constraint fk_suivi_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade,
  unique (cycle_id, etape_id)
);

create trigger trg_suivi_updated_at
  before update on public.suivi_itineraire
  for each row execute function public.tg_maj_updated_at();
