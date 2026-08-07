-- =============================================================================
-- AgriNafa · 07 — Vues analytiques
--
-- CORRECTION MAJEURE PAR RAPPORT AU CAHIER DES CHARGES
-- Le CDC propose SUM(DISTINCT d.montant_total) sur des jointures multiples.
-- Le DISTINCT dédoublonne les MONTANTS, pas les lignes parasites : deux
-- dépenses de 15 000 F sont comptées une seule fois.
-- Chaque flux est donc agrégé dans son propre LATERAL avant toute jointure.
-- =============================================================================

create or replace view public.vue_rentabilite_cycles
with (security_invoker = true) as
select
  c.id                                as cycle_id,
  c.user_id,
  c.nom                               as nom_cycle,
  c.type,
  c.statut,
  c.date_debut,
  c.date_fin_prevue,
  c.date_cible_marche,
  s.nom                               as speculation,
  p.nom                               as parcelle,

  dep.total_depenses,
  dep.nb_depenses,
  rec.total_recolte,
  rec.unite_recolte,
  ven.total_revenus,
  ven.quantite_vendue,
  ven.total_acomptes,

  case
    when rec.total_recolte > 0
      then round(dep.total_depenses / rec.total_recolte, 2)
    else null
  end                                 as prix_de_revient_unitaire,

  case
    when ven.quantite_vendue > 0
      then round(ven.total_revenus / ven.quantite_vendue, 2)
    else null
  end                                 as prix_vente_moyen,

  (ven.total_revenus - dep.total_depenses) as benefice_net,

  case
    when dep.total_depenses > 0
      then round(((ven.total_revenus - dep.total_depenses) / dep.total_depenses) * 100, 1)
    else null
  end                                 as marge_pourcent,

  greatest(rec.total_recolte - ven.quantite_vendue, 0) as quantite_restante,

  case
    when c.date_fin_prevue is not null and c.statut = 'actif'
      then c.date_fin_prevue - current_date
  end                                 as jours_avant_fin,
  case
    when c.date_cible_marche is not null
      then c.date_cible_marche - current_date
  end                                 as jours_avant_cible

from public.cycles_production c
left join public.speculations s on s.id = c.speculation_id
left join public.parcelles   p on p.id = c.parcelle_id

cross join lateral (
  select
    coalesce(sum(d.montant_total), 0)::numeric(14, 2) as total_depenses,
    count(*)                                          as nb_depenses
  from public.depenses d
  where d.cycle_id = c.id
    and d.deleted_at is null
    and d.validee = true
) dep

cross join lateral (
  select
    coalesce(sum(r.quantite_recoltee), 0)::numeric(14, 2) as total_recolte,
    max(r.unite)                                          as unite_recolte
  from public.productions_recoltes r
  where r.cycle_id = c.id
    and r.deleted_at is null
) rec

cross join lateral (
  select
    coalesce(sum(v.revenu_total), 0)::numeric(14, 2)     as total_revenus,
    coalesce(sum(v.quantite_vendue), 0)::numeric(14, 2)  as quantite_vendue,
    coalesce(sum(v.acompte_recu), 0)::numeric(14, 2)     as total_acomptes
  from public.ventes v
  where v.cycle_id = c.id
    and v.deleted_at is null
) ven

where c.deleted_at is null;

comment on view public.vue_rentabilite_cycles is
  'Rentabilité temps réel par cycle. Remplace la vue du CDC dont le '
  'SUM(DISTINCT) sur jointures multiples écrasait les montants identiques.';

-- -----------------------------------------------------------------------------
create or replace view public.vue_stocks_valorises
with (security_invoker = true) as
select
  st.id                as stock_id,
  st.user_id,
  st.nom,
  st.categorie,
  st.quantite_disponible,
  st.unite,
  st.prix_unitaire_moyen,
  round(st.quantite_disponible * st.prix_unitaire_moyen, 2) as valeur_stock,
  st.seuil_alerte,
  (st.seuil_alerte is not null and st.quantite_disponible <= st.seuil_alerte) as sous_le_seuil,
  st.date_peremption,
  case
    when st.date_peremption is not null then st.date_peremption - current_date
  end                  as jours_avant_peremption,
  mvt.dernier_mouvement
from public.stocks st
cross join lateral (
  select max(m.date_mouvement) as dernier_mouvement
  from public.mouvements_stock m
  where m.stock_id = st.id
) mvt
where st.deleted_at is null;

-- -----------------------------------------------------------------------------
-- Santé des bandes — objectif CDC : mortalité < 5 %
-- -----------------------------------------------------------------------------
create or replace view public.vue_sante_bandes
with (security_invoker = true) as
select
  c.id                as cycle_id,
  c.user_id,
  c.nom               as nom_cycle,
  c.date_debut,
  (current_date - c.date_debut) as jour_age,
  c.effectif_initial,
  mo.total_mortalites,
  greatest(c.effectif_initial - mo.total_mortalites, 0) as effectif_actuel,
  case
    when c.effectif_initial > 0
      then round((mo.total_mortalites::numeric / c.effectif_initial) * 100, 2)
  end                 as taux_mortalite_pourcent,
  case
    when c.effectif_initial > 0
     and (mo.total_mortalites::numeric / c.effectif_initial) * 100 > 5
      then true else false
  end                 as seuil_alerte_depasse,
  sa.actes_en_retard,
  sa.prochain_acte,
  sa.date_prochain_acte
from public.cycles_production c
cross join lateral (
  select coalesce(sum(m.nombre), 0)::integer as total_mortalites
  from public.mortalites m
  where m.cycle_id = c.id
) mo
cross join lateral (
  select
    count(*) filter (where e.date_realisee is null and e.date_prevue < current_date) as actes_en_retard,
    (array_agg(e.nom order by e.date_prevue)
       filter (where e.date_realisee is null))[1]                                    as prochain_acte,
    min(e.date_prevue) filter (where e.date_realisee is null)                        as date_prochain_acte
  from public.evenements_sanitaires e
  where e.cycle_id = c.id
) sa
where c.type = 'elevage'
  and c.deleted_at is null;

-- -----------------------------------------------------------------------------
-- Agri-Score — score indicatif décomposé et auditable
-- -----------------------------------------------------------------------------
create or replace view public.vue_agri_score
with (security_invoker = true) as
with base as (
  select
    pr.id as user_id,
    greatest(extract(month from age(current_date, pr.created_at::date))::integer, 0) as anciennete_mois,
    (select count(*) from public.cycles_production c
      where c.user_id = pr.id and c.statut = 'cloture' and c.deleted_at is null) as cycles_clotures,
    (select count(*) from public.vue_rentabilite_cycles v
      where v.user_id = pr.id and v.statut = 'cloture' and v.benefice_net > 0)   as cycles_rentables,
    (select count(distinct d.date_depense) from public.depenses d
      where d.user_id = pr.id and d.deleted_at is null
        and d.date_depense >= current_date - 90)                                  as jours_saisie_90j,
    (select count(*) from public.ventes v
      where v.user_id = pr.id and v.deleted_at is null
        and v.date_vente >= current_date - 365)                                   as ventes_12m,
    (select coalesce(sum(v.benefice_net), 0) from public.vue_rentabilite_cycles v
      where v.user_id = pr.id)                                                    as benefice_cumule
  from public.profils pr
)
select
  user_id,
  anciennete_mois,
  cycles_clotures,
  cycles_rentables,
  jours_saisie_90j,
  ventes_12m,
  benefice_cumule,

  least(anciennete_mois * 2, 10) + least(cycles_clotures * 5, 15)      as points_historique,
  least(round(jours_saisie_90j * 1.2)::integer, 30)                     as points_regularite,
  case when cycles_clotures > 0
       then least(round((cycles_rentables::numeric / cycles_clotures) * 30)::integer, 30)
       else 0 end                                                       as points_performance,
  least(ventes_12m * 3, 15)                                             as points_commercial,

  least(
      least(anciennete_mois * 2, 10) + least(cycles_clotures * 5, 15)
    + least(round(jours_saisie_90j * 1.2)::integer, 30)
    + case when cycles_clotures > 0
           then least(round((cycles_rentables::numeric / cycles_clotures) * 30)::integer, 30)
           else 0 end
    + least(ventes_12m * 3, 15),
  100)                                                                  as agri_score
from base;

comment on view public.vue_agri_score is
  'Score indicatif de solvabilité (0-100), décomposé en 4 composantes auditables. '
  'Aide à la décision pour un partenaire financier — ne constitue pas un octroi de crédit.';

-- -----------------------------------------------------------------------------
-- Tableau de bord d'accueil — une seule requête au lancement de l'app
-- -----------------------------------------------------------------------------
create or replace view public.vue_tableau_bord
with (security_invoker = true) as
select
  pr.id                as user_id,
  pr.nom_complet,
  pr.langue,
  agg.cycles_actifs,
  agg.total_depenses,
  agg.total_revenus,
  agg.benefice_net,
  al.alertes_non_lues,
  al.alertes_urgentes,
  sk.stocks_sous_seuil,
  dv.depenses_a_valider
from public.profils pr
cross join lateral (
  select
    count(*) filter (where v.statut = 'actif')          as cycles_actifs,
    coalesce(sum(v.total_depenses), 0)::numeric(14, 2)  as total_depenses,
    coalesce(sum(v.total_revenus), 0)::numeric(14, 2)   as total_revenus,
    coalesce(sum(v.benefice_net), 0)::numeric(14, 2)    as benefice_net
  from public.vue_rentabilite_cycles v
  where v.user_id = pr.id and v.statut in ('actif', 'cloture')
) agg
cross join lateral (
  select
    count(*)                                                  as alertes_non_lues,
    count(*) filter (where a.gravite = 'urgent')               as alertes_urgentes
  from public.alertes a
  where a.user_id = pr.id and a.lue_at is null
) al
cross join lateral (
  select count(*) as stocks_sous_seuil
  from public.vue_stocks_valorises s
  where s.user_id = pr.id and s.sous_le_seuil
) sk
cross join lateral (
  select count(*) as depenses_a_valider
  from public.depenses d
  where d.user_id = pr.id and d.validee = false and d.deleted_at is null
) dv;
