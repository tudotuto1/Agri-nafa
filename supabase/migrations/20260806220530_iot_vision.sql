-- =============================================================================
-- AgriNafa · 06 — IoT & vision par ordinateur
-- =============================================================================

create table public.cameras (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  parcelle_id          uuid,
  nom                  text not null,
  identifiant_materiel text unique,
  latitude             numeric(10, 7),
  longitude            numeric(10, 7),
  -- Mode séquentiel par défaut : la 4G rurale ne supporte pas le flux continu.
  intervalle_minutes   integer not null default 10 check (intervalle_minutes >= 1),
  streaming_actif      boolean not null default false,
  niveau_batterie      smallint check (niveau_batterie is null or niveau_batterie between 0 and 100),
  derniere_capture_at  timestamptz,
  statut               text not null default 'active'
                       check (statut in ('active', 'hors_ligne', 'maintenance', 'retiree')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint fk_camera_parcelle foreign key (parcelle_id, user_id)
    references public.parcelles (id, user_id) on delete set null,
  unique (id, user_id)
);

create index idx_cameras_user on public.cameras (user_id, statut);

create trigger trg_cameras_updated_at
  before update on public.cameras
  for each row execute function public.tg_maj_updated_at();

-- -----------------------------------------------------------------------------
create table public.captures (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  camera_id       uuid not null,
  cycle_id        uuid,
  storage_path    text not null,
  captured_at     timestamptz not null default now(),
  analyse_statut  text not null default 'en_attente'
                  check (analyse_statut in ('en_attente', 'analysee', 'ignoree', 'echec')),
  diagnostic      text,
  score_risque    numeric(4, 3) check (score_risque is null or score_risque between 0 and 1),
  fournisseur_ia  text,
  details_ia      jsonb,
  analysee_at     timestamptz,
  created_at      timestamptz not null default now(),

  constraint fk_capture_camera foreign key (camera_id, user_id)
    references public.cameras (id, user_id) on delete cascade,
  constraint fk_capture_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete set null,
  unique (id, user_id)
);

create index idx_captures_camera on public.captures (camera_id, captured_at desc);
create index idx_captures_a_analyser on public.captures (captured_at)
  where analyse_statut = 'en_attente';

-- Rattrapage de la FK laissée ouverte en migration 04
alter table public.fiches_prevente
  add constraint fk_fiche_capture foreign key (capture_id, user_id)
  references public.captures (id, user_id) on delete set null;

-- -----------------------------------------------------------------------------
create table public.alertes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  categorie   text not null check (categorie in
              ('ia_vision', 'prophylaxie', 'stock_bas', 'prix_marche', 'meteo', 'cycle', 'systeme')),
  gravite     public.gravite_alerte not null default 'info',
  titre       text not null,
  message     text not null,
  cycle_id    uuid,
  camera_id   uuid,
  capture_id  uuid,
  action_cible text,
  lue_at      timestamptz,
  created_at  timestamptz not null default now(),

  constraint fk_alerte_cycle foreign key (cycle_id, user_id)
    references public.cycles_production (id, user_id) on delete cascade,
  constraint fk_alerte_camera foreign key (camera_id, user_id)
    references public.cameras (id, user_id) on delete cascade,
  constraint fk_alerte_capture foreign key (capture_id, user_id)
    references public.captures (id, user_id) on delete cascade
);

create index idx_alertes_non_lues on public.alertes (user_id, created_at desc) where lue_at is null;

create or replace function public.tg_alerte_sur_capture_risquee()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nom_camera text;
begin
  if new.analyse_statut = 'analysee'
     and new.score_risque is not null
     and new.score_risque >= 0.60
     and (tg_op = 'INSERT' or old.analyse_statut is distinct from 'analysee')
  then
    select nom into v_nom_camera from public.cameras where id = new.camera_id;

    insert into public.alertes
      (user_id, categorie, gravite, titre, message, cycle_id, camera_id, capture_id, action_cible)
    values (
      new.user_id,
      'ia_vision',
      case when new.score_risque >= 0.80 then 'urgent'::public.gravite_alerte
           else 'attention'::public.gravite_alerte end,
      format('Alerte vision IA — %s', coalesce(v_nom_camera, 'caméra')),
      format('%s détecté avec un risque de %s %%. Intervenir sous 48 h.',
             coalesce(new.diagnostic, 'Symptôme'),
             round(new.score_risque * 100)),
      new.cycle_id, new.camera_id, new.id,
      '/carte'
    );
  end if;
  return new;
end;
$$;

create trigger trg_alerte_capture
  after insert or update on public.captures
  for each row execute function public.tg_alerte_sur_capture_risquee();

-- -----------------------------------------------------------------------------
-- Buckets Storage
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('captures',     'captures',     false, 5242880,  array['image/jpeg', 'image/png', 'image/webp']),
  ('notes-vocales','notes-vocales',false, 10485760, array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm']),
  ('guides-audio', 'guides-audio', true,  20971520, array['audio/mpeg', 'audio/ogg'])
on conflict (id) do nothing;
