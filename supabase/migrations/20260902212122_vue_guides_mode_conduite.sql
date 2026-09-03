-- =============================================================================
-- Exposer mode_conduite dans vue_guides.
--
-- La colonne existe sur itineraires_techniques depuis l'ajout du second guide
-- bovin, mais la vue ne la sortait pas : l'écran ne pouvait donc pas
-- distinguer « Embouche bovine — cycle de 4 mois » (intensif) de « Bovin
-- d'embouche — conduite semi-intensive sur pâturage ». Deux cartes identiques
-- pour deux itinéraires différents, c'est un piège plutôt qu'un choix.
--
-- Colonnes existantes reprises à l'identique et dans le même ordre ;
-- mode_conduite ajoutée en dernier. CREATE OR REPLACE VIEW ne sait rien faire
-- d'autre sans lever 42P16.
-- =============================================================================
create or replace view public.vue_guides
with (security_invoker = true) as
select
  it.id as itineraire_id,
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
  s.id as speculation_id,
  s.code as speculation_code,
  s.nom as speculation_nom,
  s.filiere,
  s.icone,
  s.unite_defaut,
  et.nb_etapes,
  it.base_calcul,
  (
    select round(
      sum(i.quantite_par_ha * i.prix_indicatif_unite / nullif(i.taille_conditionnement, 0)),
      2
    )
    from public.intrants_etape i
      join public.etapes_itineraire e on e.id = i.etape_id
    where e.itineraire_id = it.id
  ) as cout_intrants_calcule,
  it.image_credit,
  it.mode_conduite
from public.itineraires_techniques it
  join public.speculations s on s.id = it.speculation_id
  cross join lateral (
    select count(*)::integer as nb_etapes
    from public.etapes_itineraire e
    where e.itineraire_id = it.id
  ) et;
