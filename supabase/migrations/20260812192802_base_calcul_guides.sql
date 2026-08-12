-- =============================================================================
-- AgriNafa — Base de calcul des guides
--
-- LE PROBLÈME
--   Les colonnes du guide s'appellent rendement_min_ha, cout_indicatif_ha,
--   quantite_par_ha. Elles ont été pensées pour des cultures.
--
--   Pour un élevage, l'hectare n'a aucun sens : on raisonne par tête ou par
--   bande. On pourrait réinterpréter silencieusement « ha » comme « tête »,
--   mais le nom mentirait — et quelqu'un finirait par multiplier un coût par
--   la surface d'une parcelle pour des bœufs.
--
-- LA CORRECTION
--   Une colonne base_calcul rend l'unité explicite. L'application lit ce champ
--   pour savoir si elle propose un sélecteur de surface ou un nombre de têtes,
--   et pour libeller « par hectare » ou « par tête ».
--
--   Les noms de colonnes restent inchangés : les renommer casserait les deux
--   vues et l'écran guide, pour un gain cosmétique. Le commentaire porte le
--   sens là où il compte.
--
-- -----------------------------------------------------------------------------
-- CORRECTION PAR RAPPORT AU FICHIER FOURNI : LES DEUX VUES
--
-- Le fichier réécrivait vue_guides et vue_etapes_guide à partir d'une
-- définition neuve. Deux conséquences, relevées avant application :
--
--   1. CREATE OR REPLACE VIEW ne sait qu'AJOUTER des colonnes en fin de liste.
--      Il ne peut ni renommer, ni réordonner, ni supprimer. Les définitions
--      fournies commençaient par `i.id` là où les vues exposent
--      `itineraire_id` et `etape_id` : PostgreSQL aurait refusé les deux
--      instructions (42P16), et la migration entière avec elles.
--
--   2. Si elles étaient passées, elles auraient cassé l'application. Le type
--      Guide de lib/guides.ts lit `itineraire_id`, EtapeGuide lit `etape_id`
--      et `facultative` — cette dernière absente de la définition fournie.
--
-- Les vues sont donc reprises telles qu'elles existent, à l'identique, avec la
-- seule colonne base_calcul ajoutée à la fin. C'est le seul endroit où
-- CREATE OR REPLACE l'autorise, et le seul qui ne casse rien en aval.
--
-- Dans vue_etapes_guide, base_calcul est lue par sous-requête plutôt que par
-- une jointure supplémentaire : une jointure, même sur une colonne NOT NULL,
-- change la forme de la requête pour rien, alors qu'une sous-requête scalaire
-- ne peut pas modifier le nombre de lignes renvoyées.
-- -----------------------------------------------------------------------------
-- =============================================================================

alter table public.itineraires_techniques
  add column if not exists base_calcul text not null default 'hectare'
    check (base_calcul in ('hectare', 'tete', 'bassin'));

comment on column public.itineraires_techniques.base_calcul is
  'Unité de raisonnement du guide. hectare : cultures. tete : élevage à l''animal. '
  'bassin : pisciculture. Détermine la lecture des colonnes *_ha, qui portent '
  'alors une valeur par tête ou par bassin.';

comment on column public.itineraires_techniques.rendement_min_ha is
  'Rendement minimum attendu. Par hectare, par tête ou par bassin selon base_calcul.';
comment on column public.itineraires_techniques.rendement_max_ha is
  'Rendement maximum attendu. Par hectare, par tête ou par bassin selon base_calcul.';
comment on column public.itineraires_techniques.cout_indicatif_ha is
  'Coût indicatif hors main-d''œuvre familiale. Par hectare, par tête ou par bassin selon base_calcul.';
comment on column public.itineraires_techniques.surface_min_ha is
  'Seuil minimal pour se lancer. En hectares, en nombre de têtes ou en nombre de bassins selon base_calcul.';

comment on column public.intrants_etape.quantite_par_ha is
  'Quantité rapportée à l''unité de base du guide parent (hectare, tête ou bassin). '
  'L''application multiplie par la taille réelle de l''exploitation.';

-- Les 4 guides existants sont tous des cultures : la valeur par défaut convient.
-- Explicite malgré tout, pour que la colonne ne dépende pas du défaut.
update public.itineraires_techniques set base_calcul = 'hectare'
where speculation_id in (
  select id from public.speculations where filiere in ('maraichage', 'cereale')
);

-- -----------------------------------------------------------------------------
-- Les vues exposent la nouvelle colonne : sans ça l'application ne peut pas
-- adapter ses libellés. Colonnes existantes reprises à l'identique, dans le
-- même ordre ; base_calcul ajoutée en dernier.
-- -----------------------------------------------------------------------------
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
  it.base_calcul
from public.itineraires_techniques it
  join public.speculations s on s.id = it.speculation_id
  cross join lateral (
    select count(*)::integer as nb_etapes
    from public.etapes_itineraire e
    where e.itineraire_id = it.id
  ) et;

create or replace view public.vue_etapes_guide
with (security_invoker = true) as
select
  e.id as etape_id,
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
  coalesce(ing.intrants, '[]'::jsonb) as intrants,
  (
    select it.base_calcul
    from public.itineraires_techniques it
    where it.id = e.itineraire_id
  ) as base_calcul
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
      )
      order by i.ordre
    ) as intrants
    from public.intrants_etape i
    where i.etape_id = e.id
  ) ing;
