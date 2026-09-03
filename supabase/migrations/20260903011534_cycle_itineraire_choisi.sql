-- =============================================================================
-- Rattacher un cycle à l'itinéraire choisi.
--
-- Depuis qu'une spéculation peut porter plusieurs guides — le bovin d'embouche
-- en conduite intensive ou semi-intensive — `speculation_id` ne suffit plus à
-- retrouver l'itinéraire que le producteur a retenu. Sans cette colonne, le
-- choix du mode de conduite serait une étape sans effet : demandée à l'écran,
-- jetée à l'enregistrement.
--
-- Nullable, et elle le reste : les cycles créés avant cette colonne n'ont pas
-- de mode, et les spéculations à guide unique n'ont rien à choisir.
--
-- ON DELETE SET NULL plutôt que CASCADE : retirer un guide du référentiel ne
-- doit jamais emporter le cycle d'un producteur, ni ses dépenses et ses
-- récoltes avec lui. Le cycle survit, il perd seulement sa référence.
-- =============================================================================
alter table public.cycles_production
  add column if not exists itineraire_id uuid
  references public.itineraires_techniques (id) on delete set null;

comment on column public.cycles_production.itineraire_id is
  'Itinéraire technique retenu pour ce cycle. Renseigné quand la spéculation '
  'en propose plusieurs — modes de conduite de l''élevage, par exemple. Null '
  'sinon : le guide se retrouve alors par speculation_id.';

create index if not exists idx_cycles_itineraire
  on public.cycles_production (itineraire_id)
  where itineraire_id is not null;
