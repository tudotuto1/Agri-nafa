-- =============================================================================
-- AgriNafa — Guides, lot 3 : céréales, légumineuse et aviculture
--
--   · Maïs             (hectare)
--   · Niébé            (hectare)
--   · Poulet de chair  (tete)
--   · Poulet Goliath   (tete)
--   · Poule pondeuse   (tete)
--
-- SOURCES
--   · Recommandations de doses d''engrais pour les cultures vivrières — ministères
--     de l''Agriculture de la sous-région
--   · Effets de la micro-dose de NPK et d''urée — IDR / Université Nazi Boni
--   · IITA — Guide sur la production du niébé en Afrique de l''Ouest
--   · FAO — systèmes de culture du maïs en Afrique de l''Ouest, ouest du Burkina
--   · Paramètres technico-économiques des élevages de poulets de chair,
--     commune de Bobo-Dioulasso — IDR
--   · Simulation technico-économique d''une bande de poulets de chair — IPRAVI
--
-- NOTE SUR LA MICRO-DOSE
--   La micro-dose consiste à placer 2 g d''engrais directement dans le poquet
--   plutôt qu''à la volée. Elle donne de meilleurs rendements que la dose
--   vulgarisée tout en consommant moins d''engrais. C''est la technique la plus
--   pertinente pour un producteur à faible trésorerie : elle est signalée comme
--   telle dans les étapes concernées.
--
-- -----------------------------------------------------------------------------
-- UNE CORRECTION PAR RAPPORT AU FICHIER FOURNI : type_conseil
--
-- La contrainte n'accepte que calendrier / negociation / conditionnement /
-- transport / evenement / prevente. Quatre conseils étaient marqués
-- « stockage » — le même écart que dans le lot 1. Le remplaçant est choisi sur
-- le contenu de chaque conseil, pas au hasard :
--
--   maïs, « le stockage exige un grain vraiment sec »  → conditionnement
--         l'action concrète est de sécher et de contrôler le lot
--   maïs, « garder d'abord la consommation familiale » → calendrier
--         il s'agit d'arbitrer la vente contre la soudure
--   niébé, « la fane est un second revenu »            → calendrier
--         une fenêtre de saison sèche, déjà datée sur ce conseil
--   niébé, « le grain se conserve et se vend en différé » → calendrier
--         vendre plus tard, comme pour l'oignon du lot 1
--
-- Rien d'autre n'a été touché. En particulier, les `null::int[]` déjà présents
-- dans les blocs avicoles sont conservés : ils typent la colonne
-- mois_concernes, qui est un smallint[], et évitent le 42804 rencontré au
-- lot 2. Les blocs maïs et niébé sont typés par leur conseil daté.
-- -----------------------------------------------------------------------------
-- =============================================================================

-- =============================================================================
-- 1. MAÏS
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Maïs — culture pluviale d''hivernage',
  'La céréale qui nourrit la famille et dégage un surplus vendable, à condition de fertiliser au bon moment.',
  'hivernage',
  'Produire 2 à 4 tonnes par hectare en respectant les dates d''apport d''engrais, qui font toute la différence.',
  'Le maïs est devenu la première céréale de rente de l''ouest du Burkina. Son rendement dépend moins de la '
  || 'quantité d''engrais que du moment où on l''apporte : un NPK épandu trois semaines trop tard perd une '
  || 'grande part de son effet. C''est le calendrier, plus que la dose, qui sépare une bonne récolte d''une médiocre.',
  'hectare',
  2000, 4000, 'kg', 320000, 0.25, 'debutant', 110,
  array[6, 7],
  array[
    'Recommandations de doses d''engrais minéraux pour les cultures vivrières — ministères de l''Agriculture',
    'Effets de la micro-dose de NPK et d''urée sur les rendements — IDR / Université Nazi Boni',
    'FAO — systèmes de culture du maïs en Afrique de l''Ouest, ouest du Burkina Faso'
  ]
from public.speculations s
where s.code = 'mais'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Choisir la variété selon la pluviométrie',
   'Variété précoce en zone à pluies courtes, intermédiaire ou tardive en zone bien arrosée. '
   || 'Se procurer des semences certifiées auprès d''un fournisseur reconnu.',
   -30, -15, array['Variété adaptée à la zone', 'Semences certifiées', 'Cycle compatible avec la saison'],
   'preparation', 6,
   array['Semences certifiées'],
   array[
     'Semer une variété tardive en zone à pluies courtes : l''épi n''a pas le temps de se remplir.',
     'Ressemer du grain de la récolte précédente sur une variété hybride : le rendement chute de moitié.'
   ],
   'En zone à moins de 700 mm, prenez une variété précoce. Au-delà de 900 mm, une intermédiaire ou une tardive valorise mieux la saison.'),

  (2, 'Préparer le sol et apporter la fumure organique',
   'Labour dès les premières pluies utiles. Épandage et enfouissement de la fumure organique.',
   -15, -3, array['Labour effectué', 'Fumure organique enfouie', 'Parcelle propre'],
   'preparation', 120,
   array['Charrue ou daba', 'Charrette', 'Fumier de parc'],
   array[
     'Labourer sur sol trop sec : le travail est pénible et les mottes ne se cassent pas.',
     'Épandre le fumier en surface sans l''enfouir : il sèche et perd l''essentiel de sa valeur.'
   ],
   'Le parcage des bœufs directement dans le champ, en accord avec un éleveur, fertilise gratuitement et améliore durablement le sol. C''est une pratique ancienne qui reste la plus économique.'),

  (3, 'Semer',
   'Semis en poquets dès une pluie utile de 20 mm minimum. Écartement 80 cm entre lignes, 40 cm entre poquets, 2 à 3 graines par poquet.',
   0, 3, array['Pluie utile confirmée', 'Écartements respectés', '2 à 3 graines par poquet', 'Profondeur 3 à 5 cm'],
   'installation', 90,
   array['Cordeau', 'Daba', 'Semences'],
   array[
     'Semer après une petite pluie qui ne mouille que la surface : les graines lèvent puis meurent.',
     'Semer trop profond : la levée est irrégulière et tardive.',
     'Semer trop dense en espérant plus : les plants se concurrencent et les épis restent petits.'
   ],
   'Visez environ 60 000 plants par hectare. Un semis en ligne au cordeau facilite énormément les sarclages et les apports d''engrais qui suivent.'),

  (4, 'Premier apport de NPK',
   'NPK 15-15-15 avant ou au moment du semis, et au plus tard au stade 3 feuilles, soit avant le 15e jour.',
   0, 15, array['Apport avant le 15e jour', 'Sol humide', 'Engrais à 5 cm du plant', 'Poquet refermé'],
   'entretien', 60,
   array['NPK 15-15-15', 'Doseur ou capsule de bouteille'],
   array[
     'Apporter le NPK trop tard : passé le stade 3 feuilles, une grande partie de l''effet est perdue.',
     'Mettre l''engrais en contact direct avec le plant : il le brûle et le tue.',
     'Épandre sur sol sec : l''engrais reste inerte jusqu''à la pluie suivante, s''il n''est pas emporté avant.'
   ],
   'En micro-dose, comptez environ 6,4 g par poquet, soit deux capsules de bouteille de bière rases. Le poquet doit être refermé après l''apport. Cette technique donne de meilleurs rendements que l''épandage à la volée tout en consommant moins d''engrais.'),

  (5, 'Premier sarclage et démariage',
   'Sarcler dès que les mauvaises herbes apparaissent. Démarier à 2 plants par poquet.',
   12, 20, array['Parcelle propre', 'Démariage à 2 plants', 'Sol aéré'],
   'entretien', 130,
   array['Daba', 'Sarcloir'],
   array[
     'Retarder le premier sarclage : les 30 premiers jours décident du rendement, les herbes prennent l''eau et l''azote.',
     'Ne pas démarier : trois plants dans un poquet donnent trois petits épis au lieu de deux bons.'
   ],
   'Le premier sarclage est le plus rentable de tous. Un champ sale pendant le premier mois perd facilement un tiers de son rendement, quelle que soit la fertilisation.'),

  (6, 'Apport d''urée',
   'Urée 46 % entre le 30e et le 45e jour après semis, juste avant l''apparition des panicules, à 5-10 cm du pied.',
   30, 45, array['Apport avant les panicules', 'Sol humide', 'Engrais enfoui', 'Distance au pied respectée'],
   'entretien', 55,
   array['Urée 46 %', 'Daba'],
   array[
     'Épandre l''urée sur sol sec ou en plein soleil : elle se volatilise en quelques heures.',
     'Apporter après l''apparition des panicules : trop tard, le grain ne se remplit pas mieux.',
     'Mettre l''urée en contact avec la tige : brûlure garantie.'
   ],
   'Épandez l''urée le matin après une pluie, ou juste avant une pluie annoncée, et enfouissez-la légèrement. C''est la seule façon de ne pas en perdre la moitié dans l''air.'),

  (7, 'Deuxième sarclage et buttage',
   'Second sarclage suivi d''un buttage au pied des plants, qui améliore l''ancrage et la rétention d''eau.',
   40, 55, array['Parcelle propre', 'Plants buttés', 'Pas de plants couchés'],
   'entretien', 110,
   array['Daba'],
   array['Butter trop tard : les plants versent au premier grand vent et les épis pourrissent au sol.'],
   'Le buttage ancre le plant et retient l''eau au pied. Sur les parcelles exposées au vent, c''est ce qui évite la verse au moment où l''épi devient lourd.'),

  (8, 'Surveillance des ravageurs',
   'Inspection régulière des cornets pour détecter les chenilles légionnaires. Ramassage manuel ou traitement ciblé.',
   15, 80, array['Cornets inspectés deux fois par semaine', 'Chenilles ramassées', 'Traitement seulement si nécessaire'],
   'protection', 70,
   array['Pulvérisateur', 'Neem ou Bt', 'Cendre de bois'],
   array[
     'Ne regarder que les feuilles extérieures : la chenille se cache dans le cornet central.',
     'Traiter systématiquement sans avoir constaté de dégâts : dépense inutile.'
   ],
   'Contre la chenille légionnaire, une pincée de cendre de bois ou de sable fin déposée dans le cornet donne de bons résultats sur petite surface, et ne coûte rien.'),

  (9, 'Récolte et séchage',
   'Récolter quand les spathes sont sèches et le grain dur. Séchage des épis, égrenage, puis stockage.',
   95, 115, array['Spathes sèches', 'Grain dur à l''ongle', 'Séchage complet avant stockage', 'Magasin propre et sec'],
   'recolte', 220,
   array['Sacs', 'Aire de séchage', 'Égreneuse ou battoir'],
   array[
     'Stocker un grain insuffisamment sec : moisissures et charançons ruinent la récolte en quelques semaines.',
     'Laisser les épis trop longtemps au champ : les rongeurs et les oiseaux se servent.',
     'Stocker à même le sol : l''humidité remonte dans les sacs du bas.'
   ],
   'Le grain est assez sec quand il casse net sous la dent au lieu de s''écraser. Stockez sur palettes ou sur un lit de bois, jamais à même le sol.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'mais'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Semences de maïs certifiées', 'semence', 25, 'kg', 'sac', 25, 18000, NULL,
   'Environ 25 kg par hectare en semis manuel. Semences certifiées : le grain de récolte ne convient pas pour un hybride.', 1),
  (2, 'Fumure organique', 'autre', 5000, 'kg', 'charretée', 500, NULL, 'Parcage direct des bœufs dans le champ, en accord avec un éleveur',
   '5 tonnes par hectare minimum, enfouies au labour. Le parcage est la solution la plus économique.', 1),
  (4, 'NPK 15-15-15', 'engrais', 200, 'kg', 'sac', 50, 17000, NULL,
   '200 kg/ha soit 4 sacs, ou 6,4 g par poquet en micro-dose. À apporter avant le 15e jour après semis.', 1),
  (6, 'Urée 46 %', 'engrais', 100, 'kg', 'sac', 50, 19000, NULL,
   '100 kg/ha soit 2 sacs, entre 30 et 45 jours après semis, avant l''apparition des panicules.', 1),
  (8, 'Neem ou Bacillus thuringiensis', 'phytosanitaire', 8, 'l', 'bidon', 5, 4000, 'Cendre de bois ou sable fin déposé dans le cornet',
   'Contre la chenille légionnaire. Traiter uniquement en cas de dégâts constatés.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'mais'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Ne pas vendre à la récolte si vous pouvez l''éviter',
   'Le maïs est au prix le plus bas en octobre-novembre, quand tout le monde récolte. Il vaut souvent le double en soudure, '
   || 'entre juin et août. Un magasin sec et bien tenu transforme votre récolte en épargne.',
   'calendrier', array[10,11], 1),
  ('Le stockage exige un grain vraiment sec',
   'Stocker du maïs mal séché, c''est nourrir les charançons et les moisissures. Séchez jusqu''à ce que le grain casse net sous la dent, '
   || 'et surveillez le stock une fois par mois.',
   'conditionnement', NULL, 2),
  ('Garder d''abord la consommation familiale',
   'Réservez ce qu''il faut pour nourrir la famille jusqu''à la prochaine récolte avant de calculer ce que vous vendez. '
   || 'Racheter du maïs en soudure au double du prix de vente est la perte la plus fréquente et la plus évitable.',
   'calendrier', NULL, 3),
  ('Vendre groupé pour peser sur le prix',
   'Un producteur seul avec dix sacs n''a aucun poids. Dix producteurs avec cent sacs intéressent un acheteur qui vient sur place '
   || 'et paie mieux que le collecteur du marché.',
   'negociation', NULL, 4),
  ('Les provendiers achètent en continu',
   'Les fabricants d''aliment pour volaille et bétail ont besoin de maïs toute l''année. C''est un débouché qui échappe '
   || 'à la saisonnalité du marché alimentaire.',
   'negociation', NULL, 5)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'mais'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'kg', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Les stocks paysans sont encore fournis. Prix modérés.'),
  (2,  'normal',    'Écoulement progressif des stocks. Les prix commencent à monter.'),
  (3,  'normal',    'Les greniers se vident. Hausse régulière.'),
  (4,  'penurie',   'Début de soudure. Les prix montent nettement.'),
  (5,  'penurie',   'Soudure installée. Beaucoup de ménages achètent du maïs.'),
  (6,  'penurie',   'Pleine soudure. Prix au plus haut de l''année.'),
  (7,  'penurie',   'Les stocks nationaux sont bas, les travaux champêtres battent leur plein.'),
  (8,  'penurie',   'Fin de soudure. Prix encore élevés avant les premières récoltes.'),
  (9,  'normal',    'Premières récoltes de variétés précoces. Les prix commencent à céder.'),
  (10, 'abondance', 'Récolte principale. Prix au plus bas. Stockez plutôt que de vendre.'),
  (11, 'abondance', 'Marchés saturés par les récoltes. Période la moins favorable à la vente.'),
  (12, 'normal',    'Les prix se stabilisent après l''afflux de récolte.')
) as v(mois, tendance, commentaire) on true
where s.code = 'mais'
on conflict do nothing;

-- =============================================================================
-- 2. NIÉBÉ
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Niébé — grain et fane',
  'Une culture à double revenu : le grain se vend, la fane nourrit le bétail et se vend aussi.',
  'hivernage',
  'Produire du grain et récupérer la fane, tout en enrichissant le sol en azote pour la culture suivante.',
  'Le niébé est la légumineuse la plus utile du Sahel : cycle court, peu exigeant en engrais, il fixe l''azote '
  || 'et laisse le sol meilleur qu''il ne l''a trouvé. Sa fane vaut cher en saison sèche, quand le fourrage manque — '
  || 'c''est un second revenu que beaucoup de producteurs négligent.',
  'hectare',
  600, 1500, 'kg', 180000, 0.25, 'debutant', 80,
  array[6, 7, 8],
  array[
    'IITA — Guide sur la production du niébé en Afrique de l''Ouest',
    'Effets de la micro-dose de NPK sur les légumineuses — IDR / Université Nazi Boni'
  ]
from public.speculations s
where s.code = 'niebe'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Choisir la variété selon l''objectif',
   'Variété à port érigé et cycle court pour le grain, variété rampante pour produire davantage de fane. '
   || 'Choisir une variété résistante au striga si la parcelle en est infestée.',
   -20, -10, array['Variété adaptée à l''objectif', 'Résistance au striga vérifiée si nécessaire', 'Semences certifiées'],
   'preparation', 5,
   array['Semences certifiées'],
   array[
     'Semer une variété sensible sur une parcelle infestée de striga : la récolte peut être totalement perdue.',
     'Choisir au hasard entre variété érigée et rampante sans réfléchir au débouché fane.'
   ],
   'Le striga du niébé est un parasite qui se fixe sur les racines. La seule protection efficace est une variété résistante, associée à la rotation.'),

  (2, 'Préparer le sol',
   'Labour léger ou grattage. Le niébé n''exige pas un travail profond et supporte des sols pauvres.',
   -10, -2, array['Parcelle nettoyée', 'Sol ameubli en surface'],
   'preparation', 60,
   array['Daba', 'Charrue légère'],
   array['Labourer profondément inutilement : dépense d''énergie sans gain de rendement sur cette culture.'],
   'Le niébé est la culture idéale après une céréale exigeante. Il n''a pas besoin d''un sol riche, et il en laissera un meilleur.'),

  (3, 'Semer',
   'Semis en poquets après une pluie utile. Écartement 60 à 80 cm entre lignes selon la variété, 20 à 40 cm sur la ligne.',
   0, 3, array['Pluie utile confirmée', 'Écartements adaptés à la variété', '2 à 3 graines par poquet'],
   'installation', 70,
   array['Cordeau', 'Daba', 'Semences'],
   array[
     'Serrer une variété rampante : elle s''étouffe elle-même et les gousses pourrissent au sol.',
     'Semer trop tôt dans la saison pour une variété à cycle court : la récolte tombe en pleine pluie et les gousses moisissent.'
   ],
   'Pour une variété érigée, 60 × 20 cm. Pour une rampante, 80 × 40 cm. La variété rampante donne moins de grain mais beaucoup plus de fane.'),

  (4, 'Apport d''engrais de fond',
   'Le niébé fixe son propre azote. Un apport modéré de NPK au semis suffit, en micro-dose de préférence.',
   0, 12, array['Apport léger au semis', 'Aucun apport d''urée', 'Poquet refermé'],
   'entretien', 30,
   array['NPK 15-15-15', 'Doseur'],
   array[
     'Apporter de l''urée : elle bloque la fixation d''azote par les nodosités, la plante fait des feuilles et peu de gousses.',
     'Sur-fertiliser en pensant faire mieux : c''est une dépense inutile sur cette culture.'
   ],
   'La micro-dose est particulièrement adaptée au niébé : 2 g par poquet suffisent. Sur une légumineuse, la technique permet de réduire la quantité d''engrais d''environ 12,5 kg par hectare par rapport à l''épandage classique.'),

  (5, 'Sarclages',
   'Deux sarclages, le premier vers 15 jours, le second avant la floraison.',
   12, 35, array['Premier sarclage avant 20 jours', 'Parcelle propre à la floraison'],
   'entretien', 120,
   array['Daba', 'Sarcloir'],
   array[
     'Sarcler après la floraison sur une variété rampante : on casse les tiges et on perd des gousses.',
     'Laisser les herbes jusqu''à la floraison : le rendement chute fortement.'
   ],
   'Sur variété rampante, faites vos deux sarclages avant que les tiges ne couvrent le sol. Après, on ne peut plus circuler sans casser.'),

  (6, 'Protection contre les insectes de floraison',
   'La floraison et la formation des gousses sont les périodes les plus sensibles. Surveillance et traitements ciblés.',
   35, 60, array['Inspection deux fois par semaine à la floraison', 'Traitement en fin de journée', 'Ravageur identifié'],
   'protection', 60,
   array['Pulvérisateur', 'Neem'],
   array[
     'Négliger la période de floraison : les thrips et les punaises peuvent anéantir la production de gousses.',
     'Traiter en pleine journée pendant la floraison : on tue aussi les insectes pollinisateurs.'
   ],
   'Deux traitements bien placés, un à la floraison et un à la formation des gousses, valent mieux que cinq traitements au hasard. Faites-les en fin de journée.'),

  (7, 'Récolte du grain',
   'Récolte échelonnée des gousses sèches, ou récolte unique quand la majorité des gousses ont bruni.',
   65, 85, array['Gousses brunes et sèches', 'Récolte par temps sec', 'Séchage avant battage'],
   'recolte', 180,
   array['Sacs', 'Bâche', 'Aire de séchage'],
   array[
     'Attendre que toutes les gousses soient sèches sur une variété échelonnée : les premières s''ouvrent et le grain tombe au sol.',
     'Récolter par temps humide : le grain moisit au stockage.'
   ],
   'Sur les variétés à maturité échelonnée, passez deux ou trois fois. Chaque passage évite que des gousses s''ouvrent et se vident au sol.'),

  (8, 'Récolte et conservation de la fane',
   'Faucher les fanes après la récolte du grain, sécher à l''ombre, botteler et stocker à l''abri.',
   70, 90, array['Fanes fauchées après récolte du grain', 'Séchage à l''ombre', 'Bottes stockées à l''abri'],
   'recolte', 90,
   array['Faucille', 'Ficelle', 'Hangar ou grenier'],
   array[
     'Laisser les fanes au champ : elles perdent leur valeur et le bétail les piétine.',
     'Sécher en plein soleil : les feuilles tombent et il ne reste que les tiges, sans valeur.'
   ],
   'La fane de niébé est un fourrage de grande qualité qui se vend cher en saison sèche. Séchez-la à l''ombre pour garder les feuilles : ce sont elles qui portent la valeur nutritive et le prix.'),

  (9, 'Stockage du grain',
   'Traitement du grain contre les bruches avant stockage. Conservation en sacs hermétiques ou en fûts.',
   85, 95, array['Grain bien sec', 'Traitement anti-bruches fait', 'Sacs hermétiques fermés'],
   'recolte', 30,
   array['Sacs hermétiques triple fond', 'Fûts métalliques'],
   array[
     'Stocker sans protection : les bruches détruisent le stock en deux à trois mois.',
     'Utiliser des insecticides non homologués pour les denrées : risque grave pour la santé de la famille.'
   ],
   'Les sacs hermétiques à triple épaisseur étouffent les bruches sans aucun produit chimique. C''est la méthode la plus sûre pour un grain destiné à la consommation familiale.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'niebe'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Semences de niébé certifiées', 'semence', 20, 'kg', 'sac', 25, 15000, NULL,
   '15 à 25 kg par hectare selon l''écartement. Choisir une variété résistante au striga si la parcelle est infestée.', 1),
  (4, 'NPK 15-15-15', 'engrais', 100, 'kg', 'sac', 50, 17000, NULL,
   '100 kg/ha au semis, ou 2 g par poquet en micro-dose. Ne jamais apporter d''urée : elle bloque la fixation d''azote.', 1),
  (6, 'Extrait de neem', 'phytosanitaire', 10, 'l', 'bidon', 5, 3500, 'Décoction de graines de neem préparée sur place',
   'Deux traitements bien placés : un à la floraison, un à la formation des gousses. En fin de journée.', 1),
  (9, 'Sacs hermétiques triple fond', 'materiel', 12, 'unité', 'lot', 5, 2500, 'Fûts métalliques bien fermés',
   'Contre les bruches, sans produit chimique. Indispensable pour un grain destiné à la famille.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'niebe'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('La fane est un second revenu, pas un déchet',
   'En saison sèche, quand le fourrage manque, la fane de niébé bien conservée se vend très bien aux éleveurs et aux emboucheurs. '
   || 'Beaucoup de producteurs laissent cette valeur au champ.',
   'calendrier', array[1,2,3,4,5], 1),
  ('Le grain se conserve et se vend en différé',
   'Comme le maïs, le niébé vaut nettement plus cher en soudure qu''à la récolte. Avec des sacs hermétiques, '
   || 'vous stockez sans perte et vendez au moment favorable.',
   'calendrier', NULL, 2),
  ('Vendre aux emboucheurs de la zone',
   'Les emboucheurs ovins et bovins achètent la fane chaque saison sèche. Un accord direct avec deux ou trois d''entre eux '
   || 'évite de passer par un intermédiaire.',
   'negociation', NULL, 3),
  ('Le niébé prépare la culture suivante',
   'En fixant l''azote, le niébé laisse le sol enrichi. La céréale semée derrière rend mieux avec moins d''engrais. '
   || 'Ce gain n''apparaît pas sur la vente du niébé, mais il est bien réel.',
   'calendrier', NULL, 4),
  ('Le grain trié se vend mieux',
   'Un lot propre, sans grains percés ni débris, se négocie nettement au-dessus d''un lot brut. '
   || 'Le tri est un travail lent mais directement rentable.',
   'conditionnement', NULL, 5)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'niebe'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'kg', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Stocks encore disponibles. La fane, elle, commence à bien se vendre.'),
  (2,  'normal',    'Les prix du grain montent doucement. Forte demande en fane.'),
  (3,  'normal',    'Fourrage rare : la fane atteint ses meilleurs prix.'),
  (4,  'penurie',   'Début de soudure. Le grain se raréfie et se valorise bien.'),
  (5,  'penurie',   'Soudure : prix élevés sur le grain.'),
  (6,  'penurie',   'Point haut de l''année pour le grain.'),
  (7,  'penurie',   'Stocks épuisés avant les nouvelles récoltes.'),
  (8,  'normal',    'Premières récoltes de variétés précoces.'),
  (9,  'abondance', 'Récolte principale. Les prix chutent.'),
  (10, 'abondance', 'Marchés saturés. Période la moins favorable à la vente du grain.'),
  (11, 'normal',    'Les prix se stabilisent. La fane commence à intéresser les éleveurs.'),
  (12, 'normal',    'Demande régulière. Bon moment pour commencer à vendre la fane.')
) as v(mois, tendance, commentaire) on true
where s.code = 'niebe'
on conflict do nothing;

-- =============================================================================
-- 3. POULET DE CHAIR
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Poulet de chair — bande de 45 jours',
  'Le cycle le plus court de l''élevage : six semaines entre le poussin et la vente. Rapide, mais sans droit à l''erreur.',
  'toute_saison',
  'Sortir des poulets de 1,8 à 2,2 kg en 42 à 45 jours, avec moins de 5 % de mortalité.',
  'Le poulet de chair transforme vite l''argent en argent, mais tout se joue sur les dix premiers jours et sur la '
  || 'régularité de l''aliment. Une bande mal démarrée ne se rattrape jamais : les poussins qui prennent du retard '
  || 'la première semaine restent petits jusqu''au bout.',
  'tete',
  1800, 2200, 'g de poids vif par sujet', 1500,
  100, 'intermediaire', 45,
  array[1, 2, 3, 9, 10, 11],
  array[
    'Paramètres technico-économiques des élevages de poulets de chair, Bobo-Dioulasso — IDR',
    'Simulation technico-économique d''une bande de poulets de chair — IPRAVI',
    'Guide d''élevage du poulet de chair — documentation technique fournisseur'
  ]
from public.speculations s
where s.code = 'poulet_chair'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Préparer et désinfecter le bâtiment',
   'Vide sanitaire de 15 jours minimum entre deux bandes. Nettoyage complet, désinfection, chaulage, mise en place de la litière.',
   -15, -2, array['Vide sanitaire de 15 jours respecté', 'Bâtiment lavé et désinfecté', 'Litière propre de 8 à 10 cm', 'Matériel désinfecté'],
   'preparation', 20,
   array['Désinfectant', 'Chaux', 'Copeaux ou balle de riz', 'Pulvérisateur'],
   array[
     'Enchaîner deux bandes sans vide sanitaire : les germes de la bande précédente attendent les poussins.',
     'Réutiliser la litière de la bande précédente pour économiser : c''est la première source de coccidiose.',
     'Désinfecter sans avoir d''abord lavé : le désinfectant n''agit pas sur des surfaces sales.'
   ],
   'Le vide sanitaire est le seul moment où vous pouvez casser le cycle des maladies. Quinze jours bâtiment vide, lavé et sec, valent mieux que tous les traitements de la bande suivante.'),

  (2, 'Préchauffer et recevoir les poussins',
   'Préchauffage du poulailler 24 à 48 h avant l''arrivée. Température de 32 à 34 °C sous l''éleveuse. Eau sucrée à l''arrivée.',
   0, 1, array['Litière à 30 °C avant l''arrivée', 'Abreuvoirs remplis d''eau tiède sucrée', 'Poussins répartis uniformément', 'Aucun poussin entassé'],
   'installation', 12,
   array['Éleveuse ou lampes', 'Abreuvoirs premier âge', 'Mangeoires plateaux', 'Thermomètre'],
   array[
     'Recevoir les poussins dans un bâtiment froid : ils s''entassent, s''étouffent, et ceux qui survivent gardent du retard.',
     'Donner de l''eau froide à des poussins qui sortent du transport.',
     'Placer les abreuvoirs trop loin : un poussin qui ne trouve pas l''eau dans l''heure ne démarre pas.'
   ],
   'Les poussins vous disent si la température est bonne : entassés sous la lampe, ils ont froid ; collés aux murs, trop chaud ; répartis partout et actifs, c''est juste.'),

  (3, 'Démarrage — les dix premiers jours',
   'Aliment démarrage à volonté, eau propre en permanence. Baisse progressive de la température de 2 °C par semaine. Éclairage prolongé.',
   1, 10, array['Aliment toujours disponible', 'Eau changée deux fois par jour', 'Température ajustée chaque semaine', 'Mortalité inférieure à 2 %'],
   'entretien', 40,
   array['Aliment démarrage', 'Abreuvoirs', 'Mangeoires', 'Thermomètre'],
   array[
     'Laisser les mangeoires vides quelques heures : à cet âge, chaque interruption coûte du poids final.',
     'Baisser la température trop vite.',
     'Négliger la propreté des abreuvoirs : c''est par là que passent la plupart des infections précoces.'
   ],
   'Tout se joue ici. Un poussin qui ne triple pas son poids en une semaine ne rattrapera pas son retard, quelle que soit la suite. Surveillez, comptez, pesez.'),

  (4, 'Programme de prophylaxie',
   'Suivre le calendrier vaccinal : Newcastle, Gumboro et rappels. Complexes vitaminés autour des vaccinations.',
   1, 30, array['Vaccin Newcastle à J7', 'Gumboro à J14', 'Rappel Gumboro à J21', 'Rappel Newcastle à J28'],
   'protection', 15,
   array['Vaccins', 'Eau non chlorée', 'Complexe vitaminé'],
   array[
     'Vacciner avec de l''eau chlorée : le vaccin est détruit, la vaccination ne sert à rien.',
     'Sauter le rappel Gumboro : sans lui, la première vaccination ne protège pas.',
     'Rompre la chaîne du froid du vaccin entre la pharmacie et le poulailler.'
   ],
   'AgriNafa génère automatiquement votre calendrier vaccinal à la création de la bande. Pour la vaccination par l''eau, retirez les abreuvoirs deux heures avant : les poulets assoiffés boivent toute la dose rapidement.'),

  (5, 'Croissance',
   'Passage progressif à l''aliment croissance vers 3 semaines. Densité surveillée, litière remuée, ventilation adaptée.',
   11, 28, array['Transition d''aliment sur 3 jours', 'Litière sèche et remuée', 'Ventilation sans courant d''air', 'Pesée hebdomadaire'],
   'entretien', 45,
   array['Aliment croissance', 'Mangeoires adultes', 'Râteau'],
   array[
     'Changer d''aliment brutalement : diarrhée et perte de croissance.',
     'Laisser la litière se compacter et devenir humide : ammoniac, brûlures des pattes, maladies respiratoires.',
     'Densité trop forte : les sujets se gênent, mangent mal et se blessent.'
   ],
   'Une litière humide qui pique les yeux quand vous entrez, c''est de l''ammoniac. Remuez, ajoutez des copeaux secs, et ouvrez davantage sans créer de courant d''air direct sur les animaux.'),

  (6, 'Finition',
   'Aliment finition dans les deux dernières semaines. Surveillance du poids et préparation de la vente.',
   29, 42, array['Poids moyen suivi', 'Aliment finition distribué', 'Acheteurs contactés', 'Poids cible atteint'],
   'entretien', 35,
   array['Aliment finition', 'Balance'],
   array[
     'Prolonger la bande au-delà de 45 jours en pensant gagner du poids : l''indice de consommation se dégrade, chaque kilo supplémentaire coûte de plus en plus cher.',
     'Ne pas peser et vendre « au jugé ».'
   ],
   'Comptez environ 2,2 kg d''aliment pour 1 kg de poids vif. Au-delà de 45 jours, ce ratio se dégrade nettement : c''est le moment de vendre, pas d''attendre.'),

  (7, 'Vente',
   'Mise à jeun 8 à 12 heures avant l''enlèvement. Ramassage de nuit ou tôt le matin. Vente échelonnée ou en lot.',
   42, 45, array['Mise à jeun respectée', 'Ramassage de nuit ou au frais', 'Manipulation sans brutalité', 'Comptage vérifié'],
   'recolte', 20,
   array['Cages de transport', 'Balance'],
   array[
     'Ramasser en pleine chaleur : stress, mortalité pendant le transport, sujets abîmés.',
     'Attraper les poulets par une aile : fractures et carcasses déclassées.',
     'Vendre toute la bande à un seul acheteur sans avoir consulté ailleurs.'
   ],
   'Retirez l''aliment 8 à 12 heures avant l''enlèvement, en laissant l''eau. Le tube digestif se vide, les carcasses sont plus propres, et l''effet sur le poids vif est faible.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'poulet_chair'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Désinfectant', 'autre', 0.02, 'l', 'bidon', 5, 8000, NULL,
   'Pour le nettoyage du bâtiment entre deux bandes. Laver avant de désinfecter.', 1),
  (1, 'Copeaux ou balle de riz', 'autre', 1.5, 'kg', 'sac', 25, 1500, 'Balle de riz, coques d''arachide broyées',
   'Litière de 8 à 10 cm. Jamais réutilisée d''une bande à l''autre.', 2),
  (2, 'Poussin d''un jour', 'autre', 1, 'unité', 'carton', 100, 500, NULL,
   'Un poussin par sujet. Prévoir 2 % de plus pour compenser la mortalité de démarrage.', 1),
  (3, 'Aliment démarrage', 'aliment', 1, 'kg', 'sac', 50, 20000, NULL,
   'Environ 1 kg par sujet sur la phase de démarrage. À volonté, jamais de rupture.', 1),
  (5, 'Aliment croissance', 'aliment', 2, 'kg', 'sac', 50, 18000, NULL,
   'Environ 2 kg par sujet. Transition progressive sur 3 jours depuis le démarrage.', 1),
  (6, 'Aliment finition', 'aliment', 1.5, 'kg', 'sac', 50, 17000, NULL,
   'Environ 1,5 kg par sujet. Comptez au total 4,4 kg d''aliment pour 2 kg de poids vif.', 1),
  (4, 'Vaccins et vitamines', 'prophylaxie', 1, 'dose', 'flacon', 100, 3500, NULL,
   'Newcastle, Gumboro et rappels selon le calendrier généré par AgriNafa. Chaîne du froid impérative.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'poulet_chair'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Placer la bande avant de la démarrer',
   'Une bande de 500 poulets qui sort sans acheteur, c''est 500 animaux qui mangent tous les jours sans grossir utilement. '
   || 'Contactez vos acheteurs dès la troisième semaine, pas la veille de la sortie.',
   'prevente', null::int[], 1),
  ('Caler la sortie sur les fêtes',
   'Fêtes de fin d''année, Ramadan, Tabaski, cérémonies : la demande en poulet grimpe. '
   || 'Utilisez la planification inversée pour placer votre mise en place 45 jours avant la date visée.',
   'evenement', NULL, 2),
  ('Restaurants et maquis prennent régulièrement',
   'Un accord avec deux ou trois restaurants urbains assure un écoulement régulier, bande après bande, '
   || 'à un prix souvent meilleur que la vente au détail.',
   'negociation', NULL, 3),
  ('Éviter les périodes de forte chaleur',
   'En avril-mai, la chaleur augmente la mortalité et dégrade la croissance. Si vous le pouvez, '
   || 'évitez de faire tomber une bande en pleine canicule.',
   'calendrier', array[4,5], 4),
  ('Connaître son prix de revient au sujet',
   'Additionnez poussin, aliment, prophylaxie, litière et charges, puis divisez par le nombre de sujets vendus — '
   || 'pas par le nombre mis en place. AgriNafa le calcule pour vous. C''est ce chiffre qui doit guider votre négociation.',
   'negociation', NULL, 5),
  ('Vendre par lot plutôt qu''au détail',
   'La vente au détail rapporte plus par sujet mais prend du temps et immobilise l''éleveur. '
   || 'Pour une bande entière, un ou deux acheteurs en gros valent souvent mieux, surtout si la sortie est calée sur une fête.',
   'transport', NULL, 6)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'poulet_chair'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'sujet', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Après-fêtes : la demande retombe. Prix moyens.'),
  (2,  'normal',    'Marché régulier, restauration urbaine active.'),
  (3,  'normal',    'Demande stable. Bonne période de production avant les fortes chaleurs.'),
  (4,  'normal',    'Chaleur : production plus difficile, mortalité en hausse.'),
  (5,  'normal',    'Pic de chaleur. Peu d''éleveurs mettent en place, l''offre baisse.'),
  (6,  'penurie',   'Offre réduite après la période chaude. Bons prix pour qui a des sujets prêts.'),
  (7,  'normal',    'Hivernage : reprise progressive des mises en place.'),
  (8,  'normal',    'Marché stable.'),
  (9,  'normal',    'Rentrée : la restauration urbaine reprend. Demande correcte.'),
  (10, 'normal',    'Marché régulier.'),
  (11, 'normal',    'Les éleveurs mettent en place pour les fêtes. Demande qui monte.'),
  (12, 'penurie',   'Fêtes de fin d''année : demande forte, meilleurs prix de l''année.')
) as v(mois, tendance, commentaire) on true
where s.code = 'poulet_chair'
on conflict do nothing;

-- =============================================================================
-- 4. POULET GOLIATH
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Poulet Goliath — cycle de 75 jours',
  'Plus rustique que le poulet de chair, plus proche du goût du poulet local, et mieux payé au marché.',
  'toute_saison',
  'Sortir des sujets de 2,5 à 3 kg en 70 à 80 jours, avec une conduite plus souple que le poulet de chair.',
  'Le Goliath tient une place intermédiaire : il grandit plus lentement que le poulet de chair mais résiste mieux, '
  || 'accepte une conduite semi-intensive et se vend plus cher parce que sa chair est plus ferme. '
  || 'C''est un bon compromis pour un éleveur qui n''a pas un bâtiment parfaitement équipé.',
  'tete',
  2500, 3000, 'g de poids vif par sujet', 2200,
  50, 'intermediaire', 75,
  array[1, 2, 3, 9, 10],
  array[
    'Paramètres technico-économiques des élevages avicoles — IDR / Université Nazi Boni',
    'Documentation technique des souches à croissance lente'
  ]
from public.speculations s
where s.code = 'poulet_goliath'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Préparer le bâtiment',
   'Vide sanitaire, nettoyage, désinfection, litière neuve. Prévoir un parcours extérieur si possible.',
   -15, -2, array['Vide sanitaire respecté', 'Bâtiment désinfecté', 'Litière neuve', 'Parcours clôturé si prévu'],
   'preparation', 22,
   array['Désinfectant', 'Chaux', 'Copeaux', 'Grillage pour le parcours'],
   array[
     'Négliger le vide sanitaire.',
     'Prévoir un parcours sans clôture correcte : prédateurs et vols.'
   ],
   'Le Goliath valorise bien un parcours extérieur : il picore, se dépense, et la chair y gagne en fermeté — ce qui se paie au marché.'),

  (2, 'Recevoir et démarrer les poussins',
   'Mêmes exigences que le poulet de chair sur les dix premiers jours : chaleur, eau, aliment démarrage à volonté.',
   0, 14, array['Préchauffage fait', 'Eau tiède sucrée à l''arrivée', 'Aliment toujours disponible', 'Mortalité sous 2 %'],
   'installation', 45,
   array['Éleveuse', 'Abreuvoirs premier âge', 'Aliment démarrage'],
   array[
     'Croire qu''un poussin rustique n''a pas besoin de chaleur : le démarrage est aussi exigeant que pour un poulet de chair.',
     'Rationner dès le départ.'
   ],
   'La rusticité du Goliath se manifeste après le démarrage, pas pendant. Les deux premières semaines demandent la même rigueur.'),

  (3, 'Prophylaxie',
   'Calendrier vaccinal complet : Newcastle, Gumboro et rappels, plus vaccination variole si la zone l''exige.',
   1, 40, array['Newcastle à J7 et J28', 'Gumboro à J14 et J21', 'Chaîne du froid respectée'],
   'protection', 18,
   array['Vaccins', 'Eau non chlorée'],
   array[
     'Alléger le programme sanitaire parce que la souche est rustique : le Goliath résiste mieux au stress, pas aux virus.',
     'Utiliser de l''eau chlorée pour la vaccination.'
   ],
   'La rusticité ne protège pas de Newcastle ni de Gumboro. Le calendrier est le même que pour le poulet de chair, et il est généré automatiquement par AgriNafa.'),

  (4, 'Croissance en conduite semi-intensive',
   'Aliment croissance complété par un parcours extérieur, des sous-produits locaux et de la verdure.',
   15, 60, array['Aliment distribué matin et soir', 'Parcours accessible en journée', 'Eau propre en permanence', 'Litière sèche'],
   'entretien', 90,
   array['Aliment croissance', 'Mangeoires', 'Son', 'Verdure'],
   array[
     'Compter uniquement sur le parcours pour nourrir : la croissance s''effondre et le cycle s''allonge de plusieurs semaines.',
     'Laisser sortir les sujets tôt le matin sur une herbe couverte de rosée en saison fraîche.'
   ],
   'Le parcours et les sous-produits locaux — son, drêches, termites, verdure — peuvent couvrir une part de la ration et réduire nettement la facture d''aliment. Mais ils la complètent, ils ne la remplacent pas.'),

  (5, 'Finition',
   'Aliment finition sur les trois dernières semaines. Suivi du poids et préparation de la vente.',
   61, 75, array['Poids moyen suivi', 'Aliment finition distribué', 'Acheteurs contactés'],
   'entretien', 40,
   array['Aliment finition', 'Balance'],
   array['Prolonger indéfiniment : au-delà de 80 jours, l''aliment consommé ne se retrouve plus dans le poids.'],
   'Le Goliath se vend à la pièce plus qu''au kilo. Un sujet bien conformé, à la peau propre et à la crête vive, se négocie mieux qu''un sujet plus lourd mais mal présenté.'),

  (6, 'Vente',
   'Mise à jeun avant enlèvement, ramassage au frais, vente à la pièce ou en lot.',
   75, 80, array['Mise à jeun 8 à 12 h', 'Ramassage au frais', 'Sujets propres et vifs'],
   'recolte', 22,
   array['Cages de transport', 'Balance'],
   array[
     'Ramasser en pleine chaleur.',
     'Vendre au même prix qu''un poulet de chair : le Goliath se paie plus cher, faites-le valoir.'
   ],
   'Le Goliath est recherché pour les cérémonies et les repas de fête, où sa chair ferme est préférée. Faites valoir la différence auprès de l''acheteur, elle est réelle et elle se paie.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'poulet_goliath'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Copeaux ou balle de riz', 'autre', 1.8, 'kg', 'sac', 25, 1500, 'Balle de riz, coques d''arachide',
   'Litière de 8 à 10 cm, renouvelée à chaque bande.', 1),
  (2, 'Poussin Goliath d''un jour', 'autre', 1, 'unité', 'carton', 100, 700, NULL,
   'Un poussin par sujet. Prévoir 2 % de plus pour la mortalité de démarrage.', 1),
  (2, 'Aliment démarrage', 'aliment', 1.2, 'kg', 'sac', 50, 20000, NULL,
   'Environ 1,2 kg par sujet sur les deux premières semaines.', 2),
  (4, 'Aliment croissance', 'aliment', 4, 'kg', 'sac', 50, 18000, 'Son de mil, drêches, verdure du parcours en complément',
   'Environ 4 kg par sujet. Le parcours et les sous-produits locaux peuvent en couvrir une partie.', 1),
  (5, 'Aliment finition', 'aliment', 2, 'kg', 'sac', 50, 17000, NULL,
   'Environ 2 kg par sujet sur les trois dernières semaines.', 1),
  (3, 'Vaccins et vitamines', 'prophylaxie', 1, 'dose', 'flacon', 100, 3500, NULL,
   'Programme complet malgré la rusticité de la souche. Chaîne du froid impérative.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'poulet_goliath'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Ne pas se vendre au prix du poulet de chair',
   'Le Goliath a une chair plus ferme, plus proche du poulet local, et les consommateurs le savent. '
   || 'Il se vend nettement plus cher à la pièce. Faites valoir la différence, elle est reconnue sur le marché.',
   'negociation', null::int[], 1),
  ('Cibler les cérémonies',
   'Mariages, baptêmes, funérailles, fêtes religieuses : ce sont les occasions où le poulet à chair ferme est préféré. '
   || 'Un réseau de contacts sur ces événements vaut mieux qu''un étal de marché.',
   'evenement', NULL, 2),
  ('Le parcours réduit la facture d''aliment',
   'Un parcours extérieur bien conduit peut couvrir une part significative de la ration. '
   || 'C''est le principal avantage économique du Goliath sur le poulet de chair.',
   'conditionnement', NULL, 3),
  ('Vendre à la pièce plutôt qu''au poids',
   'La vente à la pièce valorise mieux un beau sujet. Soignez la présentation : plumage propre, animal vif, '
   || 'crête et pattes bien colorées.',
   'conditionnement', NULL, 4),
  ('Étaler les mises en place',
   'Avec un cycle de 75 jours, deux ou trois bandes décalées permettent d''avoir des sujets prêts presque toute l''année, '
   || 'et de servir les cérémonies quand elles se présentent.',
   'calendrier', NULL, 5)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'poulet_goliath'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'sujet', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',   'Saison des cérémonies et mariages. Demande soutenue.'),
  (2,  'normal',   'Saison sèche : nombreuses cérémonies, bon écoulement.'),
  (3,  'normal',   'Demande régulière pour les fêtes familiales.'),
  (4,  'normal',   'Chaleur : conduite plus difficile, offre en baisse.'),
  (5,  'penurie',  'Peu d''éleveurs produisent en pleine chaleur. Bons prix.'),
  (6,  'penurie',  'Offre limitée, demande maintenue.'),
  (7,  'normal',   'Hivernage : les travaux champêtres mobilisent, moins de cérémonies.'),
  (8,  'abondance','Période creuse pour les cérémonies. Écoulement plus lent.'),
  (9,  'normal',   'Reprise de la demande après les récoltes.'),
  (10, 'normal',   'Saison des mariages et cérémonies après récolte. Bonne demande.'),
  (11, 'normal',   'Demande soutenue, préparation des fêtes.'),
  (12, 'penurie',  'Fêtes de fin d''année : meilleurs prix de l''année.')
) as v(mois, tendance, commentaire) on true
where s.code = 'poulet_goliath'
on conflict do nothing;

-- =============================================================================
-- 5. POULE PONDEUSE
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Poule pondeuse — cycle de production d''œufs',
  'Un revenu quotidien plutôt qu''une vente unique : l''élevage qui change la trésorerie d''une exploitation.',
  'toute_saison',
  'Obtenir 250 à 300 œufs par poule sur un cycle de ponte d''environ 14 mois.',
  'La pondeuse est le seul élevage qui rapporte tous les jours. En contrepartie, elle immobilise du capital '
  || 'pendant cinq mois avant le premier œuf, et le moindre stress fait chuter la ponte immédiatement. '
  || 'C''est un élevage de régularité, pas de coup d''éclat.',
  'tete',
  250, 300, 'œufs par poule et par cycle', 12000,
  100, 'experimente', 500,
  array[1, 2, 9, 10, 11],
  array[
    'Paramètres technico-économiques des élevages avicoles — IDR / Université Nazi Boni',
    'Documentation technique des souches pondeuses commerciales'
  ]
from public.speculations s
where s.code = 'pondeuse'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Mesurer l''engagement avant de démarrer',
   'Cinq mois de dépenses sans aucune recette avant le premier œuf. Vérifier la capacité à financer l''aliment sur toute cette période.',
   -30, -15, array['Trésorerie couvrant 5 mois d''aliment', 'Débouché œufs identifié', 'Bâtiment adapté à un long cycle'],
   'preparation', 8,
   array['Carnet ou AgriNafa'],
   array[
     'Démarrer une bande de pondeuses avec la trésorerie d''une bande de chair : les ordres de grandeur n''ont rien à voir.',
     'Ne pas avoir de débouché régulier : les œufs ne se stockent pas longtemps.'
   ],
   'Une poulette mange pendant cinq mois avant de pondre son premier œuf. C''est la principale différence avec le poulet de chair, et la principale cause d''abandon en cours de route.'),

  (2, 'Préparer le bâtiment et recevoir les poussins',
   'Bâtiment désinfecté, litière neuve, préchauffage. Réception et démarrage identiques au poulet de chair.',
   0, 14, array['Vide sanitaire respecté', 'Préchauffage fait', 'Eau tiède à l''arrivée', 'Mortalité sous 2 %'],
   'installation', 40,
   array['Éleveuse', 'Abreuvoirs', 'Aliment démarrage poulette'],
   array[
     'Utiliser de l''aliment poulet de chair : la poulette grossit trop vite, son squelette ne suit pas et la ponte en souffre.',
     'Négliger le préchauffage.'
   ],
   'La poulette doit grandir lentement et régulièrement. Un aliment trop riche donne une poule grasse qui pond mal — c''est l''erreur la plus fréquente.'),

  (3, 'Élevage des poulettes',
   'Phases démarrage puis croissance poulette jusqu''à 16 semaines. Contrôle régulier du poids et de l''homogénéité du lot.',
   15, 112, array['Pesée hebdomadaire', 'Lot homogène', 'Poids conforme au guide de la souche', 'Programme lumineux respecté'],
   'entretien', 160,
   array['Aliment poulette', 'Balance', 'Mangeoires'],
   array[
     'Ne pas peser : un lot hétérogène donne une ponte irrégulière et un pic médiocre.',
     'Allonger la durée d''éclairage trop tôt : la poule entre en ponte avant d''être prête et fait de petits œufs toute sa carrière.'
   ],
   'Pesez un échantillon chaque semaine et comparez au guide de votre souche. Un lot dont les poids sont dispersés annonce une ponte décevante, et cela se corrige encore à ce stade.'),

  (4, 'Prophylaxie complète',
   'Programme vaccinal étendu : Newcastle, Gumboro, bronchite, variole, et déparasitages selon le plan local.',
   1, 120, array['Programme vaccinal complet', 'Rappels effectués', 'Chaîne du froid respectée', 'Déparasitage avant l''entrée en ponte'],
   'protection', 30,
   array['Vaccins', 'Eau non chlorée', 'Vermifuge'],
   array[
     'Alléger le programme : sur un cycle de 14 mois, une maladie qui passe coûte des mois de production.',
     'Vacciner une poule déjà en ponte sans nécessité : le stress fait chuter la production.'
   ],
   'Le programme de la pondeuse est plus lourd que celui du poulet de chair parce que l''animal vit dix fois plus longtemps. Tout doit être fait avant l''entrée en ponte.'),

  (5, 'Transition et entrée en ponte',
   'Passage à l''aliment pondeuse vers 17 semaines. Mise en place des pondoirs. Augmentation progressive de la durée d''éclairage.',
   113, 140, array['Aliment pondeuse introduit', 'Pondoirs installés et propres', 'Éclairage augmenté progressivement', 'Premiers œufs vers 20 semaines'],
   'installation', 40,
   array['Aliment pondeuse', 'Pondoirs', 'Copeaux pour pondoirs'],
   array[
     'Installer les pondoirs après les premiers œufs : les poules prennent l''habitude de pondre au sol et n''en changent plus.',
     'Passer à l''aliment pondeuse trop tôt : excès de calcium sur un squelette encore en croissance.'
   ],
   'Installez les pondoirs deux semaines avant les premiers œufs, garnis de copeaux propres. Une poule qui prend l''habitude du sol y restera, et vous ramasserez des œufs sales et cassés pendant un an.'),

  (6, 'Conduite de la ponte',
   'Ramassage des œufs deux à trois fois par jour. Aliment et eau sans rupture. Éclairage constant. Enregistrement quotidien de la production.',
   141, 490, array['Ramassage 2 à 3 fois par jour', 'Aliment jamais en rupture', 'Éclairage stable', 'Ponte notée chaque jour'],
   'entretien', 500,
   array['Aliment pondeuse', 'Plateaux à œufs', 'Carnet de ponte'],
   array[
     'Réduire l''éclairage ou l''aliment quand la trésorerie serre : la ponte chute en trois jours et met des semaines à remonter.',
     'Laisser les œufs longtemps dans les pondoirs : ils se salissent, se cassent, et les poules prennent le goût de les picorer.',
     'Changer brutalement de marque d''aliment.'
   ],
   'Notez la ponte chaque jour. Une baisse soudaine signale toujours quelque chose : stress, maladie, chaleur, rupture d''eau. Détectée le jour même, elle se corrige ; découverte trois semaines plus tard, elle a déjà coûté cher.'),

  (7, 'Réforme',
   'En fin de cycle, vente des poules de réforme. Nettoyage complet et vide sanitaire avant la bande suivante.',
   480, 500, array['Ponte devenue non rentable', 'Acheteurs de réforme contactés', 'Vide sanitaire planifié'],
   'recolte', 30,
   array['Cages de transport'],
   array[
     'Garder les poules trop longtemps : passé un certain taux de ponte, elles mangent plus qu''elles ne rapportent.',
     'Enchaîner sans vide sanitaire.'
   ],
   'Calculez le seuil : quand la valeur des œufs produits ne couvre plus le coût de l''aliment, il est temps de réformer. AgriNafa vous donne ce chiffre à partir de vos saisies.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'pondeuse'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (2, 'Poussin pondeuse d''un jour', 'autre', 1, 'unité', 'carton', 100, 900, NULL,
   'Un poussin par sujet. Souche pondeuse, jamais un poussin de chair.', 1),
  (2, 'Aliment démarrage poulette', 'aliment', 1, 'kg', 'sac', 50, 20000, NULL,
   'Environ 1 kg par sujet sur les premières semaines. Aliment poulette, pas aliment chair.', 2),
  (3, 'Aliment croissance poulette', 'aliment', 6, 'kg', 'sac', 50, 17000, NULL,
   'Environ 6 kg par sujet jusqu''à 16 semaines. Croissance lente et régulière recherchée.', 1),
  (5, 'Pondoirs', 'materiel', 0.2, 'unité', 'unité', 1, 8000, 'Caisses en bois garnies de copeaux',
   'Un pondoir pour 5 poules. À installer deux semaines avant les premiers œufs.', 1),
  (6, 'Aliment pondeuse', 'aliment', 45, 'kg', 'sac', 50, 18000, NULL,
   'Environ 120 g par jour et par poule sur toute la durée de ponte. Jamais de rupture.', 1),
  (4, 'Programme vaccinal complet', 'prophylaxie', 1, 'dose', 'flacon', 100, 5000, NULL,
   'Newcastle, Gumboro, bronchite, variole et rappels. Tout doit être fait avant l''entrée en ponte.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'pondeuse'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Un revenu quotidien, c''est ce qui change tout',
   'Contrairement à toutes les autres productions, la pondeuse rapporte tous les jours. '
   || 'Pour une famille, cette régularité vaut souvent plus qu''un bénéfice ponctuel plus élevé.',
   'calendrier', null::int[], 1),
  ('Sécuriser des clients réguliers',
   'Boutiques de quartier, restaurants, pâtisseries, revendeuses de marché : construisez un réseau de clients fixes. '
   || 'Les œufs ne se stockent pas, la régularité de l''écoulement est plus importante que le prix unitaire.',
   'negociation', NULL, 2),
  ('Livrer soi-même se paie',
   'Un producteur qui livre chaque matin ses clients obtient un meilleur prix qu''en vendant à un collecteur. '
   || 'Le temps investi se rattrape largement sur la marge.',
   'transport', NULL, 3),
  ('Les œufs propres se vendent mieux',
   'Ramassez souvent, gardez les pondoirs propres, et ne lavez pas les œufs — le lavage retire la protection naturelle '
   || 'et réduit leur durée de conservation. Un œuf propre au ramassage vaut mieux qu''un œuf lavé.',
   'conditionnement', NULL, 4),
  ('Anticiper le creux de trésorerie des cinq premiers mois',
   'C''est là que la plupart des projets échouent. Provisionnez l''aliment de toute la période d''élevage des poulettes '
   || 'avant même d''acheter les poussins.',
   'calendrier', NULL, 5),
  ('Vendre les poules de réforme au bon moment',
   'Les poules de réforme trouvent preneur, notamment pour les cérémonies. Prévenez vos acheteurs quelques semaines à l''avance '
   || 'plutôt que de brader le jour du dépeuplement.',
   'prevente', NULL, 6)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'pondeuse'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'unité', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',   'Demande régulière. Les pâtisseries et restaurants tournent.'),
  (2,  'normal',   'Marché stable.'),
  (3,  'normal',   'Demande soutenue. Attention à la chaleur qui approche.'),
  (4,  'penurie',  'La chaleur fait chuter la ponte chez beaucoup d''éleveurs. L''offre baisse, les prix montent.'),
  (5,  'penurie',  'Pic de chaleur : ponte réduite dans toute la région. Prix élevés.'),
  (6,  'penurie',  'Offre encore limitée. Bonne période pour qui maîtrise l''ambiance de son bâtiment.'),
  (7,  'normal',   'Hivernage : les températures baissent, la ponte se rétablit.'),
  (8,  'normal',   'Retour à une offre normale.'),
  (9,  'normal',   'Rentrée scolaire : la demande urbaine repart.'),
  (10, 'normal',   'Marché régulier.'),
  (11, 'normal',   'Préparation des fêtes : les pâtisseries commandent davantage.'),
  (12, 'penurie',  'Fêtes de fin d''année : forte demande des pâtisseries et de la restauration.')
) as v(mois, tendance, commentaire) on true
where s.code = 'pondeuse'
on conflict do nothing;
