-- =============================================================================
-- AgriNafa · 11 — Adaptation des guides à la surface réelle
--
-- La fonction ci-dessous est le cœur de la promesse « petit comme grand
-- espace » : elle prend une dose à l'hectare et la ramène à la parcelle du
-- producteur, puis la traduit en conditionnement du commerce local.
--
-- Le calcul vit en base, pas dans l'application : le jour où l'on ajustera un
-- dosage, aucune version d'app ne restera avec l'ancien chiffre.
-- =============================================================================

create or replace function public.dose_pour_surface(
  p_quantite_par_ha numeric,
  p_surface_ha numeric,
  p_taille_conditionnement numeric default null
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'quantite', round(p_quantite_par_ha * p_surface_ha, 2),
    -- Nombre d'unités à acheter, arrondi au supérieur : on n'achète pas
    -- 1,3 sac d'engrais. Mieux vaut un reste en magasin qu'une parcelle
    -- sous-dosée sur sa dernière planche.
    'conditionnements', case
      when p_taille_conditionnement is null or p_taille_conditionnement <= 0 then null
      else ceil((p_quantite_par_ha * p_surface_ha) / p_taille_conditionnement)
    end
  );
$$;

comment on function public.dose_pour_surface is
  'Ramène une dose à l''hectare à la surface réelle et l''exprime en '
  'conditionnements achetables. Arrondi au supérieur : on n''achète pas un tiers de sac.';

-- -----------------------------------------------------------------------------
-- Vue : étapes d'un itinéraire avec leurs intrants déjà agrégés
-- -----------------------------------------------------------------------------
create or replace view public.vue_etapes_guide
with (security_invoker = true) as
select
  e.id            as etape_id,
  e.itineraire_id,
  e.ordre,
  e.titre,
  e.description,
  e.phase,
  e.jour_debut,
  e.jour_fin,
  e.points_de_controle,
  e.erreurs_frequentes,
  e.astuce,
  e.materiel,
  e.heures_travail_ha,
  e.image_path,
  e.audio_path,
  e.facultative,
  coalesce(ing.intrants, '[]'::jsonb) as intrants
from public.etapes_itineraire e
cross join lateral (
  select jsonb_agg(
           jsonb_build_object(
             'id', i.id,
             'nom', i.nom,
             'categorie', i.categorie,
             'quantite_par_ha', i.quantite_par_ha,
             'unite', i.unite,
             'conditionnement', i.conditionnement,
             'taille_conditionnement', i.taille_conditionnement,
             'prix_indicatif_unite', i.prix_indicatif_unite,
             'substitut_local', i.substitut_local,
             'consigne', i.consigne
           ) order by i.ordre
         ) as intrants
  from public.intrants_etape i
  where i.etape_id = e.id
) ing;

-- -----------------------------------------------------------------------------
-- Vue : itinéraires avec leur nombre d'étapes et leur spéculation
-- -----------------------------------------------------------------------------
create or replace view public.vue_guides
with (security_invoker = true) as
select
  it.id           as itineraire_id,
  it.titre,
  it.resume,
  it.description,
  it.saison,
  it.objectif,
  it.image_path,
  it.difficulte,
  it.duree_totale_jours,
  it.rendement_min_ha,
  it.rendement_max_ha,
  it.unite_rendement,
  it.cout_indicatif_ha,
  it.surface_min_ha,
  it.mois_semis_conseilles,
  it.sources,
  s.id            as speculation_id,
  s.code          as speculation_code,
  s.nom           as speculation_nom,
  s.filiere,
  s.icone,
  s.unite_defaut,
  et.nb_etapes
from public.itineraires_techniques it
join public.speculations s on s.id = it.speculation_id
cross join lateral (
  select count(*)::integer as nb_etapes
  from public.etapes_itineraire e
  where e.itineraire_id = it.id
) et;

grant execute on function public.dose_pour_surface to authenticated;
grant select on public.vue_etapes_guide, public.vue_guides to authenticated;
