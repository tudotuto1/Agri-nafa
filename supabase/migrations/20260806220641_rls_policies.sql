-- =============================================================================
-- AgriNafa · 08 — Row Level Security
-- Un exploitant ne voit et n'écrit que ses propres données.
-- Toutes les policies utilisent (select auth.uid()) : évalué une fois par
-- requête au lieu d'une fois par ligne.
-- =============================================================================

alter table public.profils                enable row level security;
alter table public.parcelles              enable row level security;
alter table public.cycles_production      enable row level security;
alter table public.stocks                 enable row level security;
alter table public.mouvements_stock       enable row level security;
alter table public.depenses               enable row level security;
alter table public.productions_recoltes   enable row level security;
alter table public.grossistes             enable row level security;
alter table public.ventes                 enable row level security;
alter table public.fiches_prevente        enable row level security;
alter table public.evenements_sanitaires  enable row level security;
alter table public.mortalites             enable row level security;
alter table public.suivi_itineraire       enable row level security;
alter table public.cameras                enable row level security;
alter table public.captures               enable row level security;
alter table public.alertes                enable row level security;

alter table public.speculations           enable row level security;
alter table public.marches                enable row level security;
alter table public.prix_marches           enable row level security;
alter table public.itineraires_techniques enable row level security;
alter table public.etapes_itineraire      enable row level security;
alter table public.protocoles_sanitaires  enable row level security;

-- -----------------------------------------------------------------------------
create policy "profil_lecture_soi" on public.profils
  for select to authenticated using (id = (select auth.uid()));

create policy "profil_maj_soi" on public.profils
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 15 tables x 4 policies : écrit en boucle, car 60 blocs recopiés à la main
-- c'est 60 occasions d'ouvrir les données d'un exploitant à un autre.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tables_utilisateur text[] := array[
    'parcelles', 'cycles_production', 'stocks', 'mouvements_stock',
    'depenses', 'productions_recoltes', 'grossistes', 'ventes',
    'fiches_prevente', 'evenements_sanitaires', 'mortalites',
    'suivi_itineraire', 'cameras', 'captures', 'alertes'
  ];
begin
  foreach t in array tables_utilisateur loop
    execute format($f$
      create policy %I on public.%I
        for select to authenticated
        using (user_id = (select auth.uid()));
    $f$, t || '_lecture', t);

    execute format($f$
      create policy %I on public.%I
        for insert to authenticated
        with check (user_id = (select auth.uid()));
    $f$, t || '_insertion', t);

    execute format($f$
      create policy %I on public.%I
        for update to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()));
    $f$, t || '_maj', t);

    execute format($f$
      create policy %I on public.%I
        for delete to authenticated
        using (user_id = (select auth.uid()));
    $f$, t || '_suppression', t);
  end loop;
end
$$;

-- -----------------------------------------------------------------------------
-- Référentiel : lecture pour les authentifiés, écriture réservée au back-office
-- (service_role contourne déjà la RLS).
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
  tables_referentiel text[] := array[
    'speculations', 'marches', 'prix_marches',
    'itineraires_techniques', 'etapes_itineraire', 'protocoles_sanitaires'
  ];
begin
  foreach t in array tables_referentiel loop
    execute format($f$
      create policy %I on public.%I
        for select to authenticated using (true);
    $f$, t || '_lecture_publique', t);
  end loop;
end
$$;

-- Exception : un producteur peut remonter un prix constaté au marché.
create policy "prix_contribution_producteur" on public.prix_marches
  for insert to authenticated
  with check (source = 'producteur');

-- -----------------------------------------------------------------------------
-- Storage : cloisonnement par dossier {user_id}/{cycle_id}/{fichier}
-- -----------------------------------------------------------------------------
create policy "captures_lecture_proprietaire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "captures_ecriture_proprietaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'captures'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "vocales_lecture_proprietaire" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'notes-vocales'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "vocales_ecriture_proprietaire" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'notes-vocales'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "vocales_suppression_proprietaire" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'notes-vocales'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "guides_audio_lecture" on storage.objects
  for select to authenticated
  using (bucket_id = 'guides-audio');

-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on all functions in schema public to authenticated;
