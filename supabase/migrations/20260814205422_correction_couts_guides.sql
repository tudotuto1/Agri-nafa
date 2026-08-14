-- =============================================================================
-- Correction des coûts et durées de guides, et contrôle automatique des coûts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Coûts recalculés
--
-- Les valeurs précédentes étaient inférieures à la somme des intrants du guide
-- lui-même. Un éleveur qui budgète 1 500 F par poulet manque d'argent avant la
-- sortie de bande.
--
-- Rappel de lecture : ces trois itinéraires sont en `base_calcul = 'tete'`.
-- `cout_indicatif_ha` s'y lit « par sujet », pas par hectare — le nom de la
-- colonne date d'avant les filières animales.
-- -----------------------------------------------------------------------------
update public.itineraires_techniques i set cout_indicatif_ha = 2100
from public.speculations s where s.id = i.speculation_id and s.code = 'poulet_chair';

update public.itineraires_techniques i set cout_indicatif_ha = 3200
from public.speculations s where s.id = i.speculation_id and s.code = 'poulet_goliath';

update public.itineraires_techniques i set cout_indicatif_ha = 23000
from public.speculations s where s.id = i.speculation_id and s.code = 'pondeuse';

-- -----------------------------------------------------------------------------
-- 2. Durées alignées sur la dernière étape réelle du guide.
--
-- Niébé : la dernière étape « Stockage du grain » se termine à J+95, alors que
-- la durée annoncée était de 80 jours. Le guide se poursuivait après sa propre
-- fin.
--
-- Poulet Goliath : la dernière étape « Vente » se termine à J+80. La valeur
-- retenue ici est 85, soit cinq jours de plus que la dernière étape — une marge
-- volontaire, non l'alignement strict. Relevé et signalé plutôt que corrigé
-- d'office : c'est un choix de contenu, pas une erreur de saisie.
-- -----------------------------------------------------------------------------
update public.itineraires_techniques i set duree_totale_jours = 85
from public.speculations s where s.id = i.speculation_id and s.code = 'poulet_goliath';

update public.itineraires_techniques i set duree_totale_jours = 95
from public.speculations s where s.id = i.speculation_id and s.code = 'niebe';

-- L'embouche ovine dure 110 à 120 jours selon les sources burkinabè.
-- Aligne aussi la spéculation sur son itinéraire, qui portait déjà 120.
update public.speculations set duree_cycle_jours = 120 where code = 'ovin_engraissement';

-- -----------------------------------------------------------------------------
-- 3. Contrôle automatique : la somme des intrants du guide
--
-- Un chiffre saisi à la main qui diverge de ses propres composants doit se
-- voir. `cout_intrants_calcule` recalcule ce que coûtent les intrants du guide
-- pour UNE unité de base — un hectare, un sujet, un bassin — afin d'être
-- directement comparable à `cout_indicatif_ha`.
--
-- POURQUOI QUANTITÉ × PRIX UNITAIRE, ET NON LE PRIX DES CONDITIONNEMENTS
--
-- `prix_indicatif_unite` est le prix du conditionnement entier : 20 000 F le
-- sac de 50 kg. L'application, elle, arrondit au conditionnement supérieur —
-- on n'achète pas 1,3 sac. Ce calcul est juste au moment de l'achat, sur la
-- surface réelle du producteur, mais il ne peut pas servir de référence par
-- unité de base : à `base_calcul = 'tete'`, l'aliment de démarrage vaut 1 kg
-- par sujet, et l'arrondi facturerait un sac de 50 kg entier POUR UN POULET.
-- La somme « conditionnée » donne ainsi 68 500 F par poulet de chair, là où le
-- coût réel est de l'ordre de 1 800 F.
--
-- On ramène donc au prix unitaire — prix du conditionnement divisé par sa
-- taille — puis on multiplie par la dose. Le résultat est linéaire, valable
-- quelle que soit la base, et c'est le seul qui se compare honnêtement à un
-- coût indicatif exprimé lui aussi par unité de base. L'arrondi au sac reste
-- où il a du sens : dans `coutIntrant()`, à l'achat.
--
-- NULL et non 0 quand aucun intrant n'est chiffré : un zéro se lirait
-- « gratuit » là où il faut lire « prix inconnus ». Les intrants sans prix sont
-- ignorés par `sum()`, ce qui minore le total — l'écart affiché est donc un
-- plancher, jamais une surestimation.
--
-- Colonnes existantes reprises à l'identique et dans le même ordre : un
-- CREATE OR REPLACE VIEW ne sait qu'ajouter en fin de liste.
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
  ) as cout_intrants_calcule
from public.itineraires_techniques it
  join public.speculations s on s.id = it.speculation_id
  cross join lateral (
    select count(*)::integer as nb_etapes
    from public.etapes_itineraire e
    where e.itineraire_id = it.id
  ) et;

comment on view public.vue_guides is
  'Guides techniques. `cout_intrants_calcule` somme les intrants du guide pour '
  'une unité de base, au prix unitaire : il sert à repérer un '
  '`cout_indicatif_ha` saisi à la main qui ne couvrirait même pas ses propres '
  'intrants. Un écart positif est normal — le coût indicatif comprend la '
  'main-d''oeuvre et les services, que la table des intrants ne porte pas.';
