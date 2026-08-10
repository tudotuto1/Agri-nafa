-- =============================================================================
-- AgriNafa — Contenu du guide : Aubergine Kalenda, contre-saison irriguée
--
-- SOURCES DES DONNÉES TECHNIQUES
--   · Fiche technique Aubergine, CRA Dosso / RECA Niger
--   · Fiche technique Aubergine, CNRADA (Mauritanie)
--   · Fiche technique synthétique aubergine (Solanum melongena), Bénin
--   · Chambres d'agriculture — itinéraire aubergine, gestion du flétrissement
--   · Cahiers Agricultures 2021 — saisonnalité maraîchère au Burkina Faso
--
-- AVERTISSEMENT INSCRIT DANS LES DONNÉES
--   Les doses ci-dessous sont indicatives et issues de fiches régionales.
--   Elles ne remplacent pas une analyse de sol ni l'avis d'un agent agricole.
--   Chaque intrant porte une consigne rappelant ce point : un producteur qui
--   suit une dose fausse perd une campagne qu'il n'a pas les moyens de
--   recommencer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. L'itinéraire : économie et cadrage
-- -----------------------------------------------------------------------------
update public.itineraires_techniques i
set
  resume = 'L''aubergine Kalenda F1 est la variété la plus cultivée en Afrique de l''Ouest. '
        || 'Son cycle court et sa vigueur en font une culture accessible dès un demi-hectare, '
        || 'à condition de maîtriser l''irrigation et le flétrissement bactérien.',
  -- Fourchette large et assumée : le rendement dépend surtout de l'eau et de
  -- la pression sanitaire. Annoncer un chiffre unique tromperait.
  rendement_min_ha   = 12000,
  rendement_max_ha   = 30000,
  unite_rendement    = 'kg',
  -- Coût indicatif hors main-d'œuvre familiale et hors amortissement du forage.
  cout_indicatif_ha  = 850000,
  surface_min_ha     = 0.25,
  -- Corrigé de « moyenne » : la contrainte itineraires_techniques_difficulte_check
  -- posée par la migration 10 n'accepte que debutant / intermediaire / experimente.
  -- La valeur d'origine faisait échouer la migration en 23514.
  difficulte         = 'intermediaire',
  duree_totale_jours = 145,
  -- Semis en pépinière d'octobre à décembre pour récolter avant le pic de
  -- production de février-mars, quand les prix s'effondrent.
  mois_semis_conseilles = array[9, 10, 11, 12],
  sources = array[
    'Fiche technique Aubergine — CRA Dosso / RECA Niger',
    'Fiche technique Aubergine — CNRADA',
    'Fiche technique synthétique Solanum melongena — Bénin',
    'Cahiers Agricultures (2021) — saisonnalité maraîchère Burkina Faso'
  ]
from public.speculations s
where s.id = i.speculation_id and s.code = 'aubergine_kalenda';

-- -----------------------------------------------------------------------------
-- 2. Les étapes : phase, matériel, erreurs fréquentes, astuce
-- -----------------------------------------------------------------------------
update public.etapes_itineraire e set
  phase = 'preparation',
  heures_travail_ha = 60,
  materiel = array['Planches surélevées', 'Ombrière (paille ou moustiquaire)', 'Arrosoir à pomme fine', 'Fumier bien décomposé'],
  erreurs_frequentes = array[
    'Pépinière trop large : on ne peut plus désherber sans piétiner les plants. Rester à 1 m de large.',
    'Fumier frais au lieu de décomposé : il brûle les jeunes racines.',
    'Pas d''ombrière en saison sèche : le soleil de midi tue les semis levés.'
  ],
  astuce = 'Pailler la pépinière juste après le semis, puis retirer la paille dès la levée. Ça garde l''humidité sans étouffer les plantules.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 1;

update public.etapes_itineraire e set
  phase = 'preparation',
  heures_travail_ha = 25,
  materiel = array['Semences Kalenda F1 certifiées', 'Cordeau', 'Arrosoir'],
  erreurs_frequentes = array[
    'Semer trop profond : au-delà de 1 cm, la levée est irrégulière.',
    'Semences reprises d''une récolte précédente : Kalenda est un hybride F1, la seconde génération dégénère.',
    'Semer toute la quantité d''un coup : échelonner sur 2 semaines étale la récolte et les rentrées d''argent.'
  ],
  astuce = 'La levée arrive entre 8 et 10 jours. Si rien ne sort à 12 jours, ne rachetez pas de semences avant d''avoir vérifié l''arrosage : c''est presque toujours l''eau, pas la graine.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 2;

update public.etapes_itineraire e set
  phase = 'preparation',
  heures_travail_ha = 80,
  materiel = array['Sarcloir', 'Arrosoir'],
  erreurs_frequentes = array[
    'Garder l''ombrière jusqu''au bout : les plants restent tendres et souffrent au repiquage.',
    'Arroser abondamment la veille du repiquage seulement : il faut réduire progressivement pendant la dernière semaine.'
  ],
  astuce = 'Endurcir les plants en retirant l''ombrière 2 h de plus chaque jour la dernière semaine. Un plant endurci reprend en 3 jours, un plant tendre en 10.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 3;

update public.etapes_itineraire e set
  phase = 'installation',
  heures_travail_ha = 150,
  materiel = array['Charrue ou daba', 'Brouette', 'Fumier décomposé', 'NPK 15-15-15'],
  erreurs_frequentes = array[
    'Épandre le NPK en surface sans l''enfouir : une grande partie se perd à la première irrigation.',
    'Sauter la fumure organique pour économiser : c''est elle qui retient l''eau dans les sols sableux du Sahel.',
    'Planter derrière une tomate, un piment ou une pomme de terre : mêmes maladies, le flétrissement reste dans le sol.'
  ],
  astuce = 'Sur sol sableux, planter à plat. Sur sol argileux qui retient l''eau, faire des billons de 60 cm : les racines d''aubergine pourrissent en sol gorgé.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 4;

update public.etapes_itineraire e set
  phase = 'installation',
  heures_travail_ha = 120,
  materiel = array['Cordeau', 'Plantoir', 'Arrosoir'],
  erreurs_frequentes = array[
    'Repiquer en pleine chaleur : les plants se couchent et beaucoup ne repartent pas.',
    'Serrer les plants pour en mettre plus : l''air ne circule plus et les maladies foliaires s''installent.',
    'Oublier l''arrosage du jour même : c''est lui qui colle la terre aux racines.'
  ],
  astuce = 'Écartement 60 cm entre lignes et 40 cm sur la ligne, soit environ 40 000 plants par hectare. Repiquer au stade 4-5 vraies feuilles, après 16 h.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 5;

update public.etapes_itineraire e set
  phase = 'entretien',
  heures_travail_ha = 400,
  materiel = array['Motopompe ou arrosoirs', 'Paille de brousse', 'Tuyaux'],
  erreurs_frequentes = array[
    'Arroser à midi : l''eau s''évapore et le choc thermique stresse la plante.',
    'Alterner sécheresse et gros arrosage : c''est ce qui fait éclater et déformer les fruits.',
    'Négliger le paillage : sur sol nu en saison sèche, il faut deux fois plus d''eau et de carburant.'
  ],
  astuce = 'Le paillage est l''investissement le plus rentable de la contre-saison. La paille de brousse est gratuite, elle divise presque par deux la consommation de carburant de la motopompe.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 6;

update public.etapes_itineraire e set
  phase = 'protection',
  heures_travail_ha = 200,
  materiel = array['Sac pour évacuer les plants malades', 'Pulvérisateur', 'Savon noir ou neem'],
  erreurs_frequentes = array[
    'Laisser un plant flétri en place « pour voir » : il contamine toute la ligne par l''eau d''irrigation.',
    'Jeter les plants arrachés au bord du champ : la bactérie revient. Il faut les brûler ou les enfouir loin.',
    'Traiter au hasard sans identifier le ravageur : contre les araignées rouges, un insecticide ordinaire ne fait rien, il faut un acaricide.'
  ],
  astuce = 'Le flétrissement bactérien ne se soigne pas. On l''évite : rotation de 3 ans sans solanacées, drainage, et arrachage immédiat. Les plants greffés sur Solanum torvum y résistent.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 7;

update public.etapes_itineraire e set
  phase = 'entretien',
  heures_travail_ha = 90,
  materiel = array['Urée', 'Tuteurs en bois ou bambou', 'Ficelle'],
  erreurs_frequentes = array[
    'Tout l''azote d''un coup : la plante fait des feuilles et peu de fruits.',
    'Épandre l''urée au pied sans arroser derrière : elle se volatilise en quelques heures sous le soleil.',
    'Tuteurer trop tard : une branche chargée qui casse, c''est plusieurs kilos perdus.'
  ],
  astuce = 'Fractionner l''azote en trois apports, vers 40, 60 et 80 jours après repiquage. Toujours enfouir légèrement et arroser juste après.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 8;

update public.etapes_itineraire e set
  phase = 'recolte',
  heures_travail_ha = 350,
  materiel = array['Sécateur ou couteau', 'Cagettes ou paniers', 'Bâche pour l''ombre'],
  erreurs_frequentes = array[
    'Arracher le fruit à la main : on blesse la branche et on ouvre la porte aux maladies.',
    'Laisser les fruits en plein soleil après cueillette : ils se rident en deux heures et perdent leur prix.',
    'Attendre que les fruits grossissent trop : ils deviennent amers et les grossistes les refusent.'
  ],
  astuce = 'Cueillir tous les 3 à 4 jours, tôt le matin, quand le fruit est brillant et ferme. Un fruit terne est déjà trop mûr. Trier par calibre : un lot homogène se négocie mieux qu''un lot mélangé.'
from public.itineraires_techniques i join public.speculations s on s.id = i.speculation_id
where e.itineraire_id = i.id and s.code = 'aubergine_kalenda' and e.ordre = 9;

-- -----------------------------------------------------------------------------
-- 3. Les intrants, dose par hectare
--
-- La colonne quantite_par_ha permet à l'application de recalculer la dose pour
-- la surface réelle du producteur. Un exploitant de 0,25 ha ne doit pas avoir
-- à diviser de tête.
-- -----------------------------------------------------------------------------
insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.categorie::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.substitut, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Fumier bien décomposé (pépinière)', 'autre',        150,   'kg', 'brouette', 60,   NULL,  'Compost de ménage ou déjections de petits ruminants bien mûres',
      'Environ 2 à 3 kg par m² de planche. Doit être décomposé : du fumier frais brûle les jeunes racines.', 1),
  (1, 'NPK 15-15-15 (pépinière)',          'engrais',      2,     'kg', 'sachet',   1,    900,   NULL,
      'Environ 40 g par m² de planche, soit le contenu de 4 boîtes d''allumettes. Bien mélanger à la terre.', 2),
  (2, 'Semences Kalenda F1',               'semence',      300,   'g',  'sachet',   10,   9500,  NULL,
      'Environ 300 g par hectare. Utiliser des semences certifiées : Kalenda est un hybride, les graines reprises dégénèrent.', 1),
  (4, 'Fumure organique de fond',          'autre',        30000, 'kg', 'charretée',500,  NULL,  'Fumier de parc, compost, ou déjections de volaille bien décomposées',
      '30 tonnes par hectare, enfouies au labour. C''est la matière organique qui retient l''eau dans les sols sableux.', 1),
  (4, 'NPK 15-15-15 (fumure de fond)',     'engrais',      500,   'kg', 'sac',      50,   17000, NULL,
      'Dose indicative de 500 kg/ha à enfouir au labour. À ajuster selon une analyse de sol ou l''avis de votre agent agricole.', 2),
  (8, 'Urée 46 %',                         'engrais',      150,   'kg', 'sac',      50,   19000, NULL,
      'Environ 150 kg/ha au total, fractionnés en trois apports vers 40, 60 et 80 jours. Enfouir et arroser aussitôt, sinon l''azote se volatilise.', 1),
  (7, 'Savon noir ou extrait de neem',     'phytosanitaire', 10,  'l',  'bidon',    5,    3500,  'Décoction de feuilles de neem préparée sur place',
      'Traitement préventif contre pucerons et acariens. Pulvériser en fin de journée, jamais en plein soleil.', 1),
  (6, 'Paille de brousse pour paillage',   'autre',        4000,  'kg', 'charretée',300,  NULL,  'Tiges de mil ou de sorgho après battage',
      'Couche de 5 cm au pied des plants. Souvent gratuite, elle réduit fortement les besoins en eau.', 1)
) as v(ordre_etape, nom, categorie, qte, unite, cond, taille, prix, substitut, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'aubergine_kalenda'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 4. Commercialisation
-- -----------------------------------------------------------------------------
insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type_conseil, v.mois, v.ordre
from public.speculations s
join (values
  ('Viser la fenêtre où l''offre est faible',
   'En contre-saison, tous les maraîchers irriguent en même temps. Le pic de production tombe en février-mars, et c''est là que les prix sont au plus bas. '
   || 'Semer en pépinière dès septembre-octobre permet de récolter en décembre-janvier, avant l''arrivée massive des autres. '
   || 'À l''inverse, une production tenue jusqu''en juin-juillet trouve un marché dégarni, mais demande de tenir la pression sanitaire de l''hivernage.',
   'calendrier', array[9,10,11,12], 1),

  ('Connaître son prix de revient avant de discuter',
   'Un bana-bana propose toujours un prix bas au premier tour. Le seul argument qui tient face à lui, c''est votre coût réel au kilo. '
   || 'AgriNafa le calcule à partir de vos dépenses et de vos récoltes : regardez-le avant de négocier. '
   || 'Vendre en dessous, c''est travailler à perte, même si la somme totale paraît importante.',
   'negociation', NULL, 2),

  ('Ne pas vendre tout à un seul acheteur',
   'Un producteur qui n''a qu''un acheteur subit son prix. Enregistrez plusieurs grossistes dans le répertoire et sollicitez-en deux ou trois avant chaque récolte. '
   || 'Même si vous finissez par vendre au même, il le sait et ajuste son offre.',
   'negociation', NULL, 3),

  ('Le tri par calibre paie',
   'Un lot mélangé se négocie au prix du plus petit fruit. Séparer les gros calibres des petits demande une heure de travail et se rattrape largement sur le prix. '
   || 'Les écarts de tri se vendent au marché de détail plutôt que d''être jetés.',
   'conditionnement', NULL, 4),

  ('Annoncer la récolte avant qu''elle soit prête',
   'Une fiche de prévente envoyée 10 à 15 jours avant la récolte permet de sécuriser un acompte. '
   || 'C''est cet acompte qui évite de brader au dernier moment faute de trésorerie. '
   || 'Joignez une photo récente : les grossistes achètent d''abord avec les yeux.',
   'prevente', NULL, 5),

  ('Les grossistes répondent aux vocaux',
   'Les femmes grossistes des grands marchés urbains lisent peu les messages écrits, mais écoutent tous leurs vocaux, généralement le matin. '
   || 'Un message vocal de 20 secondes qui annonce la quantité, la date et le lieu obtient plus de réponses qu''un long texte.',
   'negociation', NULL, 6),

  ('Grouper le transport avec des voisins',
   'Un tricycle à moitié vide coûte le même prix qu''un tricycle plein. '
   || 'S''entendre avec deux ou trois producteurs voisins pour une même journée de collecte divise le coût de transport par autant.',
   'transport', NULL, 7),

  ('Les pics de demande à ne pas manquer',
   'La demande en légumes monte nettement pendant le Ramadan et autour des fêtes de fin d''année. '
   || 'Une récolte calée sur ces périodes se vend plus cher et plus vite. Utilisez la planification inversée pour remonter à la date de semis.',
   'evenement', NULL, 8)
) as v(titre, contenu, type_conseil, mois, ordre) on true
where s.code = 'aubergine_kalenda'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 5. Saisonnalité des prix
--
-- prix_moyen reste NULL volontairement : je n'ai pas de relevés fiables en
-- FCFA par mois pour l'aubergine au Burkina. Inventer un chiffre serait pire
-- que ne rien afficher. La tendance, elle, est documentée. Les prix réels
-- remonteront par la table prix_marches, alimentée par les producteurs.
-- -----------------------------------------------------------------------------
insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'kg', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',     'Les premières récoltes de contre-saison arrivent. L''offre reste mesurée, les prix tiennent.'),
  (2,  'abondance',  'Début du pic de production maraîchère. L''offre monte vite, les prix commencent à céder.'),
  (3,  'abondance',  'Pic de production. C''est le mois où les prix sont au plus bas. Éviter d''y concentrer sa récolte.'),
  (4,  'abondance',  'La production ralentit mais les stocks des grossistes sont encore pleins.'),
  (5,  'normal',     'Fin de contre-saison. L''offre se réduit, les prix commencent à remonter.'),
  (6,  'normal',     'Début des pluies. Les cultures irriguées s''arrêtent, la transition s''amorce.'),
  (7,  'penurie',    'Hivernage. Peu de maraîchage, pluies et pistes difficiles. Les prix montent nettement.'),
  (8,  'penurie',    'Cœur de l''hivernage. Offre faible, transport compliqué, prix élevés.'),
  (9,  'penurie',    'L''offre reste faible. Bonne période de vente pour qui a su produire malgré les pluies.'),
  (10, 'normal',     'Fin des pluies. Les pépinières de contre-saison démarrent, l''offre est encore limitée.'),
  (11, 'normal',     'Les premiers repiquages de contre-saison sont en terre. L''offre reste modérée.'),
  (12, 'normal',     'Fêtes de fin d''année : la demande monte. Bonne fenêtre pour une récolte précoce.')
) as v(mois, tendance, commentaire) on true
where s.code = 'aubergine_kalenda'
on conflict do nothing;
