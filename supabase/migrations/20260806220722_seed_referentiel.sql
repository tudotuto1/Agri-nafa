-- =============================================================================
-- AgriNafa · 09 — Référentiel Burkina Faso (idempotent)
-- =============================================================================

insert into public.speculations (code, nom, filiere, unite_defaut, duree_cycle_jours, icone) values
  ('aubergine_kalenda', 'Aubergine locale Kalenda',   'maraichage', 'kg',    90,  '🍆'),
  ('tomate',            'Tomate',                     'maraichage', 'kg',    100, '🍅'),
  ('oignon',            'Oignon violet de Galmi',     'maraichage', 'kg',    120, '🧅'),
  ('chou',              'Chou pommé',                 'maraichage', 'kg',    85,  '🥬'),
  ('poulet_chair',      'Poulet de chair',            'avicole',    'sujet', 45,  '🐔'),
  ('poulet_goliath',    'Poulet Goliath',             'avicole',    'sujet', 75,  '🐓'),
  ('pondeuse',          'Poule pondeuse',             'avicole',    'sujet', 500, '🥚'),
  ('ovin_engraissement','Ovin d''engraissement',      'elevage',    'tete',  90,  '🐑'),
  ('mais',              'Maïs',                       'cereale',    'kg',    110, '🌽'),
  ('niebe',             'Niébé',                      'cereale',    'kg',    75,  '🫘')
on conflict (code) do nothing;

insert into public.marches (nom, ville, region, type_marche, latitude, longitude, jours_affluence) values
  ('Marché de Sankariaré',    'Ouagadougou',    'Centre',       'gros',    12.3901, -1.5197, array['mardi','vendredi']),
  ('Marché de Nabi-Yaar',     'Ouagadougou',    'Centre',       'gros',    12.3486, -1.5310, array['lundi','jeudi']),
  ('Grand Marché Rood Woko',  'Ouagadougou',    'Centre',       'detail',  12.3686, -1.5275, array['tous les jours']),
  ('Grand Marché de Bobo',    'Bobo-Dioulasso', 'Hauts-Bassins','gros',    11.1783, -4.2979, array['mercredi','samedi']),
  ('Marché de Loumbila',      'Loumbila',       'Plateau-Central','collecte', 12.5033, -1.3833, array['dimanche']),
  ('Marché de Koudougou',     'Koudougou',      'Centre-Ouest', 'gros',    12.2530, -2.3622, array['mardi']),
  ('Marché de Ouahigouya',    'Ouahigouya',     'Nord',         'gros',    13.5828, -2.4219, array['jeudi'])
on conflict do nothing;

-- Protocole volaille (CDC §5)
insert into public.protocoles_sanitaires (speculation_id, nom, type_acte, produit, jour_age, obligatoire, voie, consigne)
select s.id, v.nom, v.type_acte, v.produit, v.jour_age, v.obligatoire, v.voie, v.consigne
from public.speculations s
cross join (values
  ('Anti-stress démarrage',   'vitamine',     'Complexe vitaminé + antibiotique', 1,  true,  'eau de boisson', 'Dès la réception des poussins, 3 jours de suite.'),
  ('Vaccin Newcastle HB1',    'vaccin',       'HB1',                              7,  true,  'oculaire',       'Chaîne de froid impérative. Tôt le matin, avant la chaleur.'),
  ('Vaccin Gumboro 1',        'vaccin',       'IBD intermédiaire',                14, true,  'eau de boisson', 'Retirer l''eau 2 h avant. Eau non chlorée.'),
  ('Vaccin Gumboro rappel',   'vaccin',       'IBD intermédiaire',                21, true,  'eau de boisson', 'Rappel indispensable : sans lui, le premier vaccin ne protège pas.'),
  ('Vaccin Newcastle Lasota', 'vaccin',       'Lasota',                           28, true,  'eau de boisson', 'Rappel Newcastle.'),
  ('Vitamines de finition',   'vitamine',     'Complexe vitaminé',                35, false, 'eau de boisson', 'Soutien avant la sortie de bande.'),
  ('Contrôle de poids',       'controle',     null,                               40, false, null,             'Peser 10 sujets au hasard, estimer le poids moyen de vente.')
) as v(nom, type_acte, produit, jour_age, obligatoire, voie, consigne)
where s.code = 'poulet_chair'
on conflict (speculation_id, nom, jour_age) do nothing;

-- Protocole ovins
insert into public.protocoles_sanitaires (speculation_id, nom, type_acte, produit, jour_age, obligatoire, voie, consigne)
select s.id, v.nom, v.type_acte, v.produit, v.jour_age, v.obligatoire, v.voie, v.consigne
from public.speculations s
cross join (values
  ('Déparasitage interne',  'deparasitage', 'Albendazole',            3,  true,  'orale',      'À l''entrée en bergerie, avant la transition alimentaire.'),
  ('Déparasitage externe',  'deparasitage', 'Ivermectine',            5,  true,  'injectable', 'Contre gale et tiques.'),
  ('Vaccin pasteurellose',  'vaccin',       'Vaccin anti-pasteurelle',10, true,  'injectable', 'Surtout en saison de fortes variations de température.'),
  ('Pesée intermédiaire',   'controle',     null,                     45, false, null,         'Vérifier le GMQ, ajuster la ration si le gain est faible.')
) as v(nom, type_acte, produit, jour_age, obligatoire, voie, consigne)
where s.code = 'ovin_engraissement'
on conflict (speculation_id, nom, jour_age) do nothing;

-- Itinéraire aubergine Kalenda en contre-saison irriguée
insert into public.itineraires_techniques (speculation_id, titre, description, saison, objectif)
select s.id,
  'Aubergine Kalenda — contre-saison irriguée',
  'Produire en saison sèche pour vendre quand l''offre d''hivernage s''est effondrée.',
  'contre_saison',
  'Éviter l''effondrement des prix lié aux récoltes massives de l''hivernage.'
from public.speculations s
where s.code = 'aubergine_kalenda'
  and not exists (
    select 1 from public.itineraires_techniques i
    where i.speculation_id = s.id and i.saison = 'contre_saison'
  );

insert into public.etapes_itineraire (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle)
select i.id, e.ordre, e.titre, e.description, e.jour_debut, e.jour_fin, e.controles
from public.itineraires_techniques i
cross join (values
  (1, 'Préparation de la pépinière',
      'Planches surélevées, terreau désinfecté, ombrière légère contre le soleil de saison sèche.',
      -35, -30, array['Sol drainant', 'Ombrière posée', 'Arrosoir à pomme fine']),
  (2, 'Semis en pépinière',
      'Semis en lignes espacées de 10 cm, 1 cm de profondeur. Arrosage matin et soir.',
      -30, -28, array['Semences certifiées', 'Levée attendue à 8-10 jours']),
  (3, 'Entretien du plant',
      'Désherbage manuel, réduction progressive de l''ombrière pour endurcir les plants.',
      -27, -6, array['Plants vigoureux', 'Pas de fonte des semis']),
  (4, 'Préparation de la parcelle et fumure de fond',
      'Labour, apport de fumure organique bien décomposée, incorporation du NPK 15-15-15.',
      -10, -1, array['Fumier décomposé', 'NPK incorporé', 'Réseau d''irrigation testé']),
  (5, 'Repiquage',
      'Plants de 4-5 vraies feuilles, en fin d''après-midi. Écartement 80 × 60 cm. Arrosage copieux immédiat.',
      0, 2, array['4-5 vraies feuilles', 'Repiquage après 16 h', 'Arrosage le jour même']),
  (6, 'Gestion du stress hydrique',
      'Irrigation régulière aux heures fraîches. Paillage du sol pour limiter l''évaporation.',
      3, 45, array['Sol humide sans excès', 'Paillage en place', 'Pas de flétrissement à midi']),
  (7, 'Lutte intégrée contre le flétrissement bactérien',
      'Surveillance quotidienne via la caméra. Arrachage et destruction hors parcelle de tout plant atteint. Ne jamais irriguer d''un plant malade vers un plant sain.',
      10, 80, array['Plants suspects arrachés', 'Alertes IA traitées sous 48 h', 'Rotation prévue']),
  (8, 'Fumure de couverture et tuteurage',
      'Apport d''urée en deux fractions. Tuteurage des plants les plus chargés.',
      30, 50, array['Urée fractionnée', 'Plants soutenus']),
  (9, 'Récolte échelonnée et prévente',
      'Cueillette tous les 3-4 jours, fruits brillants et fermes. Fiches de prévente envoyées 10 jours avant le pic.',
      75, 110, array['Tri par calibre', 'Fiche de prévente envoyée', 'Acompte sécurisé'])
) as e(ordre, titre, description, jour_debut, jour_fin, controles)
where i.saison = 'contre_saison'
on conflict (itineraire_id, ordre) do nothing;
