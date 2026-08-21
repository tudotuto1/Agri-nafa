-- =============================================================================
-- AgriNafa — Attribution des photos
--
-- image_path existe déjà mais rien ne porte le crédit. Une photo Wikimedia
-- Commons sous CC-BY-SA exige que l'auteur et la licence soient visibles à
-- côté de l'image, pas seulement archivés quelque part. Sans ce champ, on
-- afficherait une photo en infraction avec sa propre licence.
-- =============================================================================

alter table public.itineraires_techniques
  add column if not exists image_credit text;

alter table public.etapes_itineraire
  add column if not exists image_credit text;

comment on column public.itineraires_techniques.image_credit is
  'Attribution à afficher avec image_path : "Auteur, Licence, Commons". '
  'Obligatoire dès qu''image_path est renseigné — une photo sans son crédit '
  'visible est en infraction avec sa propre licence.';
comment on column public.etapes_itineraire.image_credit is
  'Même règle que itineraires_techniques.image_credit.';

-- Un garde-fou qui empêche d'oublier : impossible d'enregistrer une image
-- sans son crédit.
alter table public.itineraires_techniques
  add constraint chk_image_avec_credit
  check (image_path is null or image_credit is not null);

alter table public.etapes_itineraire
  add constraint chk_image_avec_credit
  check (image_path is null or image_credit is not null);

-- -----------------------------------------------------------------------------
-- Les vues exposent le crédit, sinon l'écran ne peut pas l'afficher.
--
-- ATTENTION — les définitions ci-dessous ne sont PAS celles du fichier fourni.
-- Celui-ci renommait `itineraire_id` en `id`, `etape_id` en `id`, réordonnait
-- toutes les colonnes et en supprimait deux au passage : `cout_intrants_calcule`
-- de vue_guides et `facultative` de vue_etapes_guide.
--
-- CREATE OR REPLACE VIEW ne sait qu'AJOUTER des colonnes en fin de liste. Un
-- renommage ou une suppression est refusé par Postgres (42P16), donc la
-- migration entière aurait échoué. Et si elle était passée, elle aurait cassé
-- lib/guides.ts, qui lit `itineraire_id`, `etape_id` et `facultative`, et
-- effacé le contrôle de coût ajouté par correction_couts_guides.
--
-- Les colonnes existantes sont donc reprises à l'identique et dans le même
-- ordre ; `image_credit` est ajoutée en dernier, seule.
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
  it.image_credit
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
  ) as base_calcul,
  e.image_credit
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

-- -----------------------------------------------------------------------------
-- Première photo réelle : l'aubergine.
--
-- Source : Wikimedia Commons, image de qualité et image valorisée.
-- Auteur : Joydeep. Licence : CC BY-SA 3.0.
-- Page  : https://commons.wikimedia.org/wiki/File:Solanum_melongena_24_08_2012_(1).JPG
--
-- Le fichier lui-même n'a pas pu être téléchargé : le mandataire de sortie de
-- l'environnement de développement bloque tous les domaines wikimedia.org. La
-- ligne est écrite quand même — elle dit l'intention et la contrainte de
-- licence — et l'écran n'affiche rien tant que le fichier n'est pas dans le
-- paquet. Aucune image cassée ne s'affiche : la table de `require` n'a pas
-- encore d'entrée pour cette clé.
-- -----------------------------------------------------------------------------
update public.itineraires_techniques i
set
  image_path = 'guides/aubergine_kalenda/fruit.jpg',
  image_credit = 'Photo : Joydeep, Wikimedia Commons, CC BY-SA 3.0'
from public.speculations s
where s.id = i.speculation_id and s.code = 'aubergine_kalenda';
