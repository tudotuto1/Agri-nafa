-- =============================================================================
-- AgriNafa — Guides, lot 1
--
--   · 3 spéculations nouvelles : tilapia, caprin d'embouche, bovin d'embouche
--   · 3 guides maraîchers complets : oignon Galmi, tomate, chou pommé
--
-- SOURCES
--   · itc.agridata.bf — itinéraires techniques oignon, tomate, chou (Burkina)
--   · RECA Niger / CRA — recueil de fiches techniques maraîchères 2022
--   · Afrique Science — fertilisation de l'oignon au Burkina (Garane et al.)
--   · INERA / CORAF — fiche tomate d'hivernage
--
-- PRUDENCE SUR LES DOSES
--   Les fiches burkinabè et nigériennes ne donnent pas toutes les mêmes
--   chiffres, et la pratique paysanne dépasse souvent la recommandation. Sur
--   l'oignon par exemple, la dose conseillée tourne autour de 350 kg/ha de NPK,
--   quand 500 à 700 kg sont couramment épandus. J'ai retenu la recommandation,
--   pas l'usage : suggérer d'acheter le double d'engrais engage la trésorerie
--   d'un producteur qui n'a pas de marge d'erreur.
--
-- -----------------------------------------------------------------------------
-- TROIS CORRECTIONS PAR RAPPORT AU FICHIER FOURNI
--
-- Relevées contre le schéma réel avant application. Chacune aurait fait échouer
-- la migration entière, pas seulement la ligne concernée.
--
--   1. `difficulte` n'accepte que debutant / intermediaire / experimente
--      (itineraires_techniques_difficulte_check). Le fichier proposait
--      « moyenne », « difficile » et « facile ». Le niveau retenu est celui que
--      décrit déjà le texte de chaque guide :
--        oignon → intermediaire  (« la plus exigeante en fertilisation »)
--        tomate → experimente    (« ne pardonne pas la négligence »)
--        chou   → debutant       (« la culture qui pardonne le plus »)
--
--   2. `type_conseil` n'accepte que calendrier / negociation / conditionnement
--      / transport / evenement / prevente. Les deux conseils oignon marqués
--      « stockage » sont passés en « calendrier » : l'un comme l'autre servent
--      le même propos — ne pas vendre le jour de la récolte. Ajouter
--      « stockage » à la contrainte serait l'autre solution, mais elle touche
--      le schéma et le type TypeConseil côté application.
--
--   3. `array[]` sans type est refusé par PostgreSQL (42P18, « cannot determine
--      type of empty array »). Le matériel vide de l'étape 8 de l'oignon est
--      devenu `array[]::text[]`.
-- -----------------------------------------------------------------------------
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Spéculations manquantes
-- -----------------------------------------------------------------------------
insert into public.speculations (code, nom, filiere, unite_defaut, duree_cycle_jours, icone) values
  ('tilapia',          'Tilapia du Nil',        'elevage', 'kg',   180, '🐟'),
  ('caprin_embouche',  'Caprin d''embouche',    'elevage', 'tete', 90,  '🐐'),
  ('bovin_embouche',   'Bovin d''embouche',     'elevage', 'tete', 120, '🐄')
on conflict (code) do nothing;

-- =============================================================================
-- 2. OIGNON VIOLET DE GALMI
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Oignon Violet de Galmi — saison sèche',
  'La culture de rente du maraîchage sahélien : forte demande, bonne conservation, prix qui grimpent hors saison.',
  'contre_saison',
  'Produire un bulbe de gros calibre et bien conservable, pour vendre en différé quand les prix montent.',
  'L''oignon est la culture maraîchère la plus rentable du Burkina, et la plus exigeante en fertilisation. '
  || 'Son atout décisif : un bulbe bien séché se garde plusieurs mois. Un producteur qui sait stocker ne subit '
  || 'plus le prix du jour de récolte.',
  20000, 40000, 'kg', 1200000, 0.25, 'intermediaire', 160,
  array[10, 11, 12],
  array[
    'Itinéraire technique de production de l''oignon — itc.agridata.bf (Burkina Faso)',
    'Recueil de fiches techniques 2022, culture de l''oignon — RECA Niger',
    'Garane et al., fertilisation de l''oignon au Burkina Faso — Afrique Science'
  ]
from public.speculations s
where s.code = 'oignon'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Pépinière',
   'Semis en planches de 1 m de large, en lignes espacées de 10 cm. Ombrière légère et arrosage matin et soir.',
   -45, -40, array['Terre finement émiettée', 'Ombrière posée', 'Semis peu profond'],
   'preparation', 70,
   array['Planches de 1 m', 'Ombrière', 'Arrosoir à pomme fine', 'Fumier décomposé'],
   array[
     'Semer trop dense : les plants filent et donnent des bulbes chétifs.',
     'Pépinière sur sol lourd mal drainé : la fonte des semis emporte tout en une nuit.',
     'Semences de plus de deux ans : le taux de levée s''effondre.'
   ],
   'Il faut environ 4 kg de semences pour un hectare, et 400 m² de pépinière. Prévoyez large : mieux vaut jeter des plants en trop que manquer au repiquage.'),

  (2, 'Élevage des plants',
   'Désherbage manuel, arrosage régulier, réduction progressive de l''ombrière pour endurcir les plants.',
   -39, -1, array['Plants au diamètre d''un crayon', 'Pas de jaunissement', 'Ombrière retirée en fin de période'],
   'preparation', 100,
   array['Sarcloir', 'Arrosoir'],
   array[
     'Repiquer des plants trop jeunes : le bulbe reste petit.',
     'Laisser la pépinière se dessécher : les plants ne repartent pas après repiquage.'
   ],
   'Le plant est bon à repiquer vers 40-45 jours, quand sa base atteint le diamètre d''un crayon. Plus jeune, il perdra du calibre ; plus vieux, il montera en graines.'),

  (3, 'Préparation du sol et fumure de fond',
   'Labour profond, émottage fin, confection des planches et du réseau d''irrigation. Incorporation de la matière organique et du NPK.',
   -10, -1, array['Sol finement émietté', 'Planches nivelées', 'Drainage assuré', 'Fumure enfouie'],
   'installation', 180,
   array['Charrue ou daba', 'Râteau', 'Brouette', 'Fumier décomposé', 'NPK 15-15-15'],
   array[
     'Fumier non décomposé : il apporte des graines de mauvaises herbes, et l''oignon supporte mal la concurrence.',
     'Planches mal nivelées : l''eau stagne d''un côté, les bulbes pourrissent.',
     'Sol grossier : le bulbe se déforme au contact des mottes.'
   ],
   'L''oignon a des racines courtes et superficielles. Un sol grossièrement travaillé donne des bulbes petits et biscornus : le temps passé à émietter se retrouve dans le calibre.'),

  (4, 'Repiquage',
   'Repiquage en fin d''après-midi, entre 16 h et 18 h. Écartement 25 cm entre lignes et 10 cm sur la ligne.',
   0, 3, array['Repiquage après 16 h', 'Racines bien en terre', 'Arrosage immédiat'],
   'installation', 250,
   array['Cordeau', 'Plantoir', 'Arrosoir'],
   array[
     'Repiquer en pleine chaleur : les plants se couchent et beaucoup meurent.',
     'Enterrer le collet : le bulbe ne se forme pas correctement.',
     'Serrer davantage pour gagner du rendement : on obtient plus de bulbes, mais tous petits et invendables au bon prix.'
   ],
   'Densité visée : environ 400 000 plants par hectare. Sur billons, comptez 50 cm entre billons et 10 cm entre plants, en plantant sur les deux flancs.'),

  (5, 'Première fumure d''entretien',
   'Deux semaines après repiquage, 75 kg/ha de NPK 15-15-15 à la volée, puis arrosage.',
   14, 16, array['Épandage régulier', 'Arrosage juste après', 'Feuillage sec au moment de l''épandage'],
   'entretien', 30,
   array['NPK 15-15-15', 'Seau doseur'],
   array[
     'Épandre sur feuillage mouillé : l''engrais colle aux feuilles et les brûle.',
     'Ne pas arroser après : l''engrais reste en surface et se perd.'
   ],
   'Épandre le matin sur feuillage sec, puis irriguer dans la foulée. C''est l''eau qui fait descendre l''engrais aux racines.'),

  (6, 'Sarclo-binage et irrigation',
   'Binages réguliers pour aérer le sol et supprimer la concurrence. Irrigation selon les besoins, sans excès.',
   10, 110, array['Parcelle propre', 'Sol aéré', 'Pas d''eau stagnante'],
   'entretien', 450,
   array['Sarcloir', 'Motopompe ou arrosoirs'],
   array[
     'Laisser les mauvaises herbes s''installer : l''oignon, avec ses feuilles fines, perd toujours la compétition.',
     'Biner trop profond près des plants : on casse les racines superficielles.',
     'Arroser en excès : le bulbe pourrit et se conserve mal après récolte.'
   ],
   'Un sol constamment humide mais jamais détrempé. En cas de doute, creusez à 5 cm : la terre doit être fraîche sans coller aux doigts.'),

  (7, 'Deuxième fumure et début de bulbaison',
   '40 à 45 jours après repiquage : 25 kg d''urée + 25 kg de NPK. Puis 50 kg d''urée au début de la bulbaison.',
   40, 70, array['Apports fractionnés', 'Arrosage après chaque épandage', 'Bulbe qui commence à grossir'],
   'entretien', 45,
   array['Urée 46 %', 'NPK 15-15-15'],
   array[
     'Continuer l''azote trop tard : le feuillage reste vert, le bulbe ne mûrit pas et se conserve mal.',
     'Tout apporter en une fois : une partie est perdue, et l''excès favorise les maladies.'
   ],
   'Arrêtez tout apport d''azote environ trois semaines avant la récolte. C''est ce qui permet au bulbe de se fermer et de tenir plusieurs mois en stock.'),

  (8, 'Arrêt de l''irrigation et maturation',
   'Suspendre l''arrosage quand la moitié des feuilles se couche. Laisser le bulbe finir de mûrir en terre.',
   110, 125, array['Feuillage couché à 50 %', 'Irrigation arrêtée', 'Tunique extérieure sèche'],
   'recolte', 20,
   array[]::text[],
   array[
     'Arracher dès que les feuilles se couchent : le bulbe n''a pas fini de former ses tuniques et se conservera mal.',
     'Continuer à irriguer : le bulbe repart en végétation et devient invendable en stock.'
   ],
   'Le couchage du feuillage est le signal. Comptez encore 10 à 15 jours sans eau avant d''arracher.'),

  (9, 'Récolte, séchage et stockage',
   'Arrachage par temps sec, séchage à l''ombre sur 2 à 3 semaines, tri par calibre, mise en magasin aéré.',
   125, 150, array['Arrachage par temps sec', 'Séchage à l''ombre', 'Collet bien sec', 'Magasin ventilé'],
   'recolte', 300,
   array['Fourche', 'Cagettes ou nattes', 'Magasin aéré'],
   array[
     'Sécher en plein soleil : le bulbe se cuit et noircit sous la tunique.',
     'Stocker des bulbes au collet encore humide : la pourriture gagne tout le tas.',
     'Empiler trop haut : les bulbes du fond s''écrasent et fermentent.'
   ],
   'Le séchage est ce qui transforme une récolte en épargne. Bien séché et bien stocké, l''oignon se garde 3 à 5 mois — vous vendez quand le prix vous convient, plus quand l''acheteur décide.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'oignon'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Semences Violet de Galmi', 'semence', 4, 'kg', 'sachet', 1, 12000, NULL,
   'Environ 4 kg par hectare, semés sur 400 m² de pépinière. Semences de l''année : le pouvoir germinatif chute vite.', 1),
  (3, 'Fumure organique de fond', 'autre', 25000, 'kg', 'charretée', 500, NULL, 'Fumier de parc, compost, déjections de petits ruminants',
   '20 à 30 tonnes par hectare, bien décomposées et enfouies au labour.', 1),
  (3, 'NPK 15-15-15 (fond)', 'engrais', 250, 'kg', 'sac', 50, 17000, NULL,
   'Environ 250 kg/ha au labour. Complété par les apports d''entretien. Doses indicatives : à ajuster selon analyse de sol.', 2),
  (5, 'NPK 15-15-15 (entretien)', 'engrais', 100, 'kg', 'sac', 50, 17000, NULL,
   '75 kg deux semaines après repiquage, puis 25 kg à 40-45 jours. Toujours épandre sur feuillage sec et arroser après.', 1),
  (7, 'Urée 46 %', 'engrais', 75, 'kg', 'sac', 50, 19000, NULL,
   '25 kg à 40-45 jours après repiquage, puis 50 kg au début de la bulbaison. Arrêter trois semaines avant récolte.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'oignon'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Le stockage est votre meilleure arme',
   'L''oignon est le seul légume que vous pouvez garder plusieurs mois. C''est ce qui change tout : au lieu de vendre en avril avec tout le monde, '
   || 'vous vendez en juillet ou août quand le marché est vide. Un magasin aéré, à l''abri du soleil et de la pluie, avec les bulbes sur claies et pas à même le sol.',
   'calendrier', array[4,5,6,7,8], 1),
  ('Ne jamais vendre tout à la récolte',
   'Le mois de récolte est celui où les prix sont au plus bas, parce que tous les producteurs arrivent en même temps. '
   || 'Vendez de quoi couvrir vos dettes immédiates, et stockez le reste. La différence de prix entre avril et août paie largement le magasin.',
   'calendrier', array[3,4], 2),
  ('Trier par calibre change le prix',
   'Les gros bulbes se négocient nettement mieux que les moyens, et les petits partent au détail ou pour le repiquage. '
   || 'Mélanger les trois, c''est vendre les gros au prix des petits.',
   'conditionnement', NULL, 3),
  ('Vérifier ses pertes de stockage',
   'Comptez 10 à 20 % de perte sur trois mois de stockage, davantage si le séchage a été bâclé. Intégrez cette perte à votre calcul : '
   || 'vendre 80 kg à 600 F rapporte plus que 100 kg à 400 F, mais il faut faire le calcul avant de décider.',
   'calendrier', NULL, 4),
  ('Les acheteurs viennent chercher le Galmi',
   'Le Violet de Galmi est recherché et se vend jusqu''en Côte d''Ivoire et au Ghana. Faites-vous connaître des collecteurs qui remontent vers la côte : '
   || 'ils achètent en gros volume et paient mieux que le marché local.',
   'negociation', NULL, 5),
  ('Annoncer sa récolte avant l''arrachage',
   'Une fiche de prévente envoyée deux semaines avant permet de sécuriser un acompte et d''éviter de brader pour payer la main-d''œuvre d''arrachage.',
   'prevente', NULL, 6)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'oignon'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'kg', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Les premières récoltes précoces arrivent. Les stocks de l''année passée sont épuisés.'),
  (2,  'normal',    'Début de la récolte principale. Les prix commencent à céder.'),
  (3,  'abondance', 'Pleine récolte. Prix au plus bas de l''année. Stockez plutôt que de vendre.'),
  (4,  'abondance', 'Fin de récolte, marchés saturés. Période la moins favorable à la vente.'),
  (5,  'normal',    'Les stocks des producteurs commencent à s''écouler. Les prix remontent doucement.'),
  (6,  'normal',    'L''offre se réduit, la demande reste stable. Bonne fenêtre de déstockage.'),
  (7,  'penurie',   'Hivernage : plus de production fraîche, seuls les stocks alimentent le marché. Les prix montent nettement.'),
  (8,  'penurie',   'Point haut de l''année. Ceux qui ont bien stocké vendent au meilleur prix.'),
  (9,  'penurie',   'Les stocks nationaux s''épuisent, les importations comblent le manque. Prix élevés.'),
  (10, 'normal',    'Les pépinières de saison sèche démarrent. Le marché vit encore sur les importations.'),
  (11, 'normal',    'Repiquages en cours. Aucune production locale fraîche.'),
  (12, 'normal',    'Attente de la récolte. Les prix restent soutenus.')
) as v(mois, tendance, commentaire) on true
where s.code = 'oignon'
on conflict do nothing;

-- =============================================================================
-- 3. TOMATE
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Tomate — saison sèche irriguée',
  'Culture à forte demande et à forte pression sanitaire : elle rapporte bien, mais ne pardonne pas la négligence.',
  'contre_saison',
  'Produire des fruits sains et bien calibrés, en évitant l''effondrement des prix du plein pic.',
  'La tomate est exigeante : maladies, ravageurs, tuteurage, récolte échelonnée. En contrepartie, la demande '
  || 'est constante toute l''année et les transformateurs cherchent des volumes réguliers.',
  15000, 35000, 'kg', 1100000, 0.25, 'experimente', 130,
  array[9, 10, 11],
  array[
    'Itinéraire technique de production de la tomate — itc.agridata.bf (Burkina Faso)',
    'Fiche technique tomate d''hivernage FBT3 — INERA / CORAF',
    'Recueil de fiches techniques maraîchères — RECA Niger'
  ]
from public.speculations s
where s.code = 'tomate'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Choix de la variété et pépinière',
   'Semis en lignes espacées de 15 à 20 cm. Durée de pépinière : 3 semaines en période chaude, 4 en période fraîche.',
   -30, -21, array['Variété adaptée au marché visé', 'Terre de pépinière désinfectée', 'Semis en lignes'],
   'preparation', 60,
   array['Planches de pépinière', 'Ombrière', 'Arrosoir à pomme fine'],
   array[
     'Choisir une variété au hasard : une tomate de table et une tomate d''industrie ne se vendent pas au même acheteur.',
     'Pépinière sur terre non désinfectée : la fonte des semis et les nématodes partent de là.',
     'Semis trop dense : les plants filent et cassent au repiquage.'
   ],
   '3 g de semences sur 3 m² suffisent à repiquer 100 m². Pour un hectare, comptez environ 300 g et 100 m² de pépinière.'),

  (2, 'Préparation du sol et fumure de fond',
   'Piochage sur 40 à 50 cm, émottage, nivellement, planches. Incorporation du fumier et du NPK.',
   -10, -1, array['Sol profondément travaillé', 'Fumure enfouie', 'Drainage assuré'],
   'installation', 170,
   array['Pioche ou charrue', 'Brouette', 'Fumier décomposé', 'NPK 14-23-14 ou 15-15-15'],
   array[
     'Planter derrière une tomate, une aubergine, un piment ou une pomme de terre : ce sont toutes des solanacées, les maladies du sol persistent.',
     'Sauter la fumure organique : sur sol sableux, le rendement est divisé par deux.'
   ],
   'Rotation obligatoire : au moins trois ans sans solanacée sur la même parcelle. C''est la seule protection réellement efficace contre le flétrissement et les nématodes.'),

  (3, 'Repiquage',
   'Repiquer les plants vigoureux de 10 à 15 cm avec 5 à 6 vraies feuilles, en fin d''après-midi.',
   0, 3, array['Plants de 10-15 cm', '5 à 6 vraies feuilles', 'Repiquage après 16 h', 'Arrosage immédiat'],
   'installation', 130,
   array['Cordeau', 'Plantoir', 'Arrosoir'],
   array[
     'Repiquer des plants filés et chétifs : ils ne rattrapent jamais leur retard.',
     'Repiquer en pleine chaleur.',
     'Écartement trop serré : l''humidité stagne dans le feuillage et le mildiou s''installe.'
   ],
   'Écartement 60 à 80 cm entre lignes, 40 à 50 cm sur la ligne. L''air doit circuler entre les plants : c''est la première barrière contre les maladies foliaires.'),

  (4, 'Première fumure d''entretien',
   '2 à 3 semaines après repiquage : 150 kg/ha de NPK 14-23-14 ou 12-22-22.',
   14, 21, array['Épandage au pied sans toucher la tige', 'Enfouissement léger', 'Arrosage après'],
   'entretien', 30,
   array['NPK 14-23-14', 'Sarcloir'],
   array[
     'Épandre contre la tige : l''engrais brûle le collet.',
     'Laisser l''engrais en surface sans enfouir ni arroser.'
   ],
   'Épandre en couronne à 10 cm du pied, gratter légèrement pour enfouir, puis irriguer.'),

  (5, 'Tuteurage',
   'Poser les tuteurs avant que les plants ne se couchent, et attacher au fur et à mesure de la croissance.',
   25, 45, array['Tuteurs solides et enfoncés', 'Attaches non serrantes', 'Fruits hors du sol'],
   'entretien', 200,
   array['Tuteurs bois ou bambou', 'Ficelle souple'],
   array[
     'Tuteurer trop tard : la tige est déjà couchée et casse quand on la relève.',
     'Serrer la ficelle sur la tige : elle étrangle la plante en grossissant.',
     'Ne pas tuteurer du tout : les fruits touchent le sol humide et pourrissent.'
   ],
   'Le tuteurage n''est pas un luxe. Un fruit au sol se tache, pourrit ou se fait manger. C''est souvent la différence entre 60 % et 90 % de récolte commercialisable.'),

  (6, 'Deuxième fumure et floraison',
   'En début de floraison : 150 kg/ha de NPK. Surveillance rapprochée des ravageurs.',
   40, 55, array['Apport à la floraison', 'Fleurs bien nouées', 'Surveillance quotidienne'],
   'entretien', 40,
   array['NPK 14-23-14'],
   array[
     'Trop d''azote à ce stade : la plante fait des feuilles et peu de fruits.',
     'Irrigation irrégulière pendant la floraison : les fleurs coulent et ne donnent rien.'
   ],
   'La floraison est le moment le plus sensible à l''eau. Un coup de sec à ce stade, et vous perdez le premier bouquet — le plus précoce, donc le mieux payé.'),

  (7, 'Protection sanitaire',
   'Surveillance quotidienne. Arrachage et destruction des plants atteints. Traitements raisonnés contre mouche blanche et noctuelles.',
   20, 110, array['Plants malades arrachés et évacués', 'Ravageur identifié avant traitement', 'Traitement en fin de journée'],
   'protection', 220,
   array['Pulvérisateur', 'Sac d''évacuation', 'Neem ou savon noir'],
   array[
     'Traiter au hasard sans savoir contre quoi : on dépense et le ravageur reste.',
     'Traiter en plein soleil : le produit s''évapore et brûle le feuillage.',
     'Laisser un plant viroses en place : les mouches blanches le transmettent à toute la parcelle.'
   ],
   'La mouche blanche transmet le virus des feuilles en cuillère, qui ne se soigne pas. Contre elle, les pièges jaunes englués et l''arrachage immédiat valent mieux que les traitements répétés.'),

  (8, 'Récolte échelonnée',
   'Cueillette tous les 2 à 3 jours, au stade tournant pour le transport, mûr pour la vente locale.',
   85, 125, array['Fruits fermes', 'Cueillette le matin', 'Tri par calibre', 'Fruits à l''ombre'],
   'recolte', 400,
   array['Cagettes', 'Bâche pour l''ombre'],
   array[
     'Cueillir à pleine maturité pour un transport long : les fruits arrivent écrasés.',
     'Entasser dans des sacs : la tomate s''écrase sous son propre poids.',
     'Laisser les cagettes au soleil après cueillette.'
   ],
   'Pour un marché lointain, cueillez au stade tournant — le fruit qui commence juste à colorer. Il finit de mûrir en route et arrive intact.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'tomate'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Semences de tomate', 'semence', 300, 'g', 'sachet', 10, 8000, NULL,
   '3 g pour 3 m² de pépinière permettent de repiquer 100 m². Environ 300 g par hectare.', 1),
  (2, 'Fumure organique de fond', 'autre', 25000, 'kg', 'charretée', 500, NULL, 'Fumier de parc ou compost bien décomposé',
   '20 à 30 tonnes par hectare enfouies au labour.', 1),
  (2, 'NPK 14-23-14 (fond)', 'engrais', 200, 'kg', 'sac', 50, 18000, 'NPK 15-15-15 si le 14-23-14 est introuvable',
   'Environ 200 kg/ha au labour. Doses indicatives : à ajuster selon analyse de sol.', 2),
  (4, 'NPK 14-23-14 (entretien)', 'engrais', 300, 'kg', 'sac', 50, 18000, NULL,
   '150 kg à 2-3 semaines après repiquage, 150 kg en début de floraison. Enfouir et arroser.', 1),
  (5, 'Tuteurs', 'materiel', 12000, 'unité', 'fagot', 50, 500, 'Tiges de bambou, branches de karité ou piquets de brousse',
   'Un tuteur par plant. Réutilisables plusieurs campagnes s''ils sont rentrés après récolte.', 1),
  (7, 'Extrait de neem ou savon noir', 'phytosanitaire', 15, 'l', 'bidon', 5, 3500, 'Décoction de graines de neem préparée sur place',
   'Traitement préventif. Pulvériser en fin de journée. Identifier le ravageur avant tout traitement chimique.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'tomate'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('La tomate ne se stocke pas : anticipez la vente',
   'Contrairement à l''oignon, la tomate ne se garde pas. Vous ne pouvez pas attendre un meilleur prix. '
   || 'La seule marge de manœuvre est en amont : décaler la date de semis pour récolter hors du pic, et avoir un acheteur avant la première cueillette.',
   'calendrier', NULL, 1),
  ('Cueillir au stade tournant pour aller loin',
   'Un fruit cueilli tout juste coloré supporte trois jours de route et arrive présentable. Un fruit cueilli mûr n''arrive pas. '
   || 'Adaptez le stade de cueillette à la distance du marché visé.',
   'conditionnement', NULL, 2),
  ('Les cagettes se rentabilisent vite',
   'Transporter la tomate en sacs, c''est perdre 20 à 30 % de la marchandise en fruits écrasés. '
   || 'Des cagettes empruntées ou achetées d''occasion se rentabilisent en une seule vente.',
   'transport', NULL, 3),
  ('Se rapprocher des transformateurs',
   'Les unités de transformation en purée et concentré achètent des volumes réguliers et se soucient moins du calibre que du tonnage. '
   || 'C''est un débouché pour les écarts de tri et les variétés à petits fruits.',
   'negociation', NULL, 4),
  ('Le prix monte quand la tomate manque',
   'La tomate se raréfie en pleine saison des pluies et en fin de saison sèche chaude. Une récolte qui tombe dans ces fenêtres se vend nettement mieux, '
   || 'mais demande de tenir la pression sanitaire — c''est un arbitrage, pas une évidence.',
   'calendrier', array[6,7,8], 5),
  ('Prévente dès la nouaison',
   'Dès que les premiers fruits sont noués, vous savez à peu près ce que vous allez récolter et quand. '
   || 'C''est le bon moment pour envoyer une fiche de prévente et sécuriser un acompte.',
   'prevente', NULL, 6)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'tomate'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'kg', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Récoltes de contre-saison en cours. L''offre monte progressivement.'),
  (2,  'abondance', 'Pleine production maraîchère. Les prix commencent à s''effondrer.'),
  (3,  'abondance', 'Pic de l''offre. Prix au plus bas. Écoulement difficile.'),
  (4,  'normal',    'La production baisse avec la chaleur. Les prix remontent.'),
  (5,  'normal',    'Fortes chaleurs : la nouaison est mauvaise, l''offre se réduit.'),
  (6,  'penurie',   'Transition vers l''hivernage. Peu de tomate disponible, prix en hausse.'),
  (7,  'penurie',   'Hivernage : maladies et pluies limitent fortement la production. Prix élevés.'),
  (8,  'penurie',   'Point haut de l''année. Peu de producteurs tiennent la pression sanitaire.'),
  (9,  'normal',    'Fin des pluies. Les premières cultures de contre-saison sont en pépinière.'),
  (10, 'normal',    'Repiquages en cours. L''offre reste limitée.'),
  (11, 'normal',    'Premières récoltes précoces. Prix encore corrects.'),
  (12, 'normal',    'Fêtes de fin d''année : la demande soutient les prix malgré l''offre qui monte.')
) as v(mois, tendance, commentaire) on true
where s.code = 'tomate'
on conflict do nothing;

-- =============================================================================
-- 4. CHOU POMMÉ
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Chou pommé — culture de saison fraîche',
  'La culture d''entrée du maraîchage : cycle court, technique simple, écoulement facile en ville.',
  'contre_saison',
  'Produire des pommes fermes et bien formées, à écouler rapidement sur les marchés urbains.',
  'Le chou est la culture qui pardonne le plus. Cycle court, itinéraire simple, demande urbaine constante. '
  || 'C''est souvent par lui qu''un producteur commence le maraîchage — mais il n''aime pas la chaleur : '
  || 'la saison fraîche est sa fenêtre.',
  25000, 50000, 'kg', 750000, 0.1, 'debutant', 115,
  array[10, 11, 12, 1],
  array[
    'Itinéraire technique de production du chou et de la laitue — itc.agridata.bf (Burkina Faso)',
    'Recueil de fiches techniques maraîchères — RECA Niger'
  ]
from public.speculations s
where s.code = 'chou'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Pépinière',
   'Semis en lignes sur planches ombragées. Levée en 5 à 8 jours, plants prêts à repiquer vers 25-30 jours.',
   -30, -25, array['Terre fine et propre', 'Ombrière posée', 'Arrosage matin et soir'],
   'preparation', 50,
   array['Planches de pépinière', 'Ombrière', 'Arrosoir à pomme fine'],
   array[
     'Semer en pleine saison chaude : le chou ne pomme pas au-dessus de 30 °C soutenus.',
     'Pépinière trop arrosée : la fonte des semis emporte les plantules.'
   ],
   'Comptez 300 à 500 g de semences par hectare. Échelonnez vos semis sur trois semaines : vous étalez la récolte et évitez de tout vendre le même jour.'),

  (2, 'Préparation du sol et fumure de fond',
   'Piochage sur 40 à 50 cm, émottage, nivellement. Deux brouettes de fumier décomposé pour 10 m², plus 300 kg/ha de NPK.',
   -10, -1, array['Sol profondément travaillé', 'Fumure enfouie', 'Planches nivelées'],
   'installation', 150,
   array['Pioche', 'Brouette', 'Râteau', 'Fumier décomposé', 'NPK 15-15-15'],
   array[
     'Fumure organique insuffisante : le chou est très gourmand, une pomme se construit avec beaucoup de matière.',
     'Planter derrière un autre chou ou une autre crucifère : les maladies du sol s''accumulent.'
   ],
   'Deux brouettes de fumier pour 10 m², soit 20 à 30 kg. Le chou consomme beaucoup : c''est une culture qui rend ce qu''on lui donne.'),

  (3, 'Repiquage',
   'Repiquage en fin d''après-midi, avec motte de préférence. Écartement 40 à 60 cm entre lignes, 30 à 40 cm sur la ligne.',
   0, 3, array['Repiquage entre 16 h et 18 h', 'Plant bien enfoncé jusqu''aux premières feuilles', 'Arrosage immédiat'],
   'installation', 140,
   array['Cordeau', 'Plantoir', 'Arrosoir'],
   array[
     'Repiquer trop serré : les pommes restent petites.',
     'Repiquer trop superficiellement : le plant se couche au premier vent.'
   ],
   'Densité : 62 500 à 110 000 pieds par hectare selon l''écartement retenu. Plus serré donne plus de pommes mais plus petites : choisissez selon ce que votre marché achète.'),

  (4, 'Première fumure d''entretien',
   '3 semaines après repiquage : 75 kg/ha d''urée à la volée, suivi d''un arrosage.',
   21, 23, array['Feuillage sec à l''épandage', 'Arrosage juste après'],
   'entretien', 25,
   array['Urée 46 %'],
   array['Épandre sur feuillage mouillé : brûlures foliaires garanties.'],
   'Épandre le matin, feuillage sec, puis irriguer. Trois apports d''urée successifs valent mieux qu''un seul apport massif.'),

  (5, 'Sarclo-binage et irrigation',
   'Binages réguliers, buttage léger au pied, irrigation suivie sans excès.',
   10, 100, array['Parcelle propre', 'Plants bien droits', 'Sol frais'],
   'entretien', 300,
   array['Sarcloir', 'Motopompe ou arrosoirs'],
   array[
     'Laisser sécher entre deux arrosages : la pomme éclate quand l''eau revient d''un coup.',
     'Biner trop près du pied : on blesse les racines superficielles.'
   ],
   'L''éclatement des pommes vient presque toujours d''une irrigation irrégulière. Régularité plutôt qu''abondance.'),

  (6, 'Deuxième et troisième fumure',
   '5e et 7e semaines après repiquage : 75 kg/ha d''urée à chaque fois.',
   35, 50, array['Apports fractionnés', 'Arrosage après chaque épandage', 'Pommaison qui démarre'],
   'entretien', 50,
   array['Urée 46 %'],
   array['Poursuivre l''azote pendant la pommaison : la pomme reste lâche et se conserve mal.'],
   'Arrêtez l''urée dès que la pomme commence à se former. Après, l''azote fait pousser des feuilles au lieu de serrer la pomme.'),

  (7, 'Protection contre les chenilles',
   'Surveillance du dessous des feuilles. Ramassage manuel des chenilles, traitement biologique si l''infestation s''étend.',
   15, 100, array['Dessous des feuilles inspecté', 'Chenilles ramassées', 'Traitement en fin de journée'],
   'protection', 150,
   array['Pulvérisateur', 'Neem ou Bt', 'Seau pour le ramassage'],
   array[
     'Ne regarder que le dessus des feuilles : les chenilles et les œufs sont dessous.',
     'Attendre que les dégâts soient visibles : à ce stade la pomme est déjà percée et invendable.'
   ],
   'Sur petites surfaces, le ramassage manuel matin et soir suffit souvent et ne coûte rien. Inspectez le dessous des feuilles deux fois par semaine.'),

  (8, 'Récolte',
   'Couper au ras du sol quand la pomme est ferme sous la pression de la main. Récolte échelonnée sur 2 à 3 semaines.',
   85, 110, array['Pomme ferme au toucher', 'Coupe nette au couteau', 'Quelques feuilles de protection laissées'],
   'recolte', 200,
   array['Couteau ou machette', 'Cagettes', 'Bâche pour l''ombre'],
   array[
     'Récolter trop tard : la pomme éclate et perd toute valeur en une journée.',
     'Retirer toutes les feuilles extérieures : elles protègent la pomme pendant le transport.',
     'Laisser les pommes au soleil : elles se fanent en quelques heures.'
   ],
   'Testez avec la paume : une pomme prête résiste à la pression. Une pomme qui cède est encore lâche, une pomme très dure est au bord de l''éclatement — récoltez-la en premier.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'chou'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (1, 'Semences de chou pommé', 'semence', 400, 'g', 'sachet', 10, 7000, NULL,
   '300 à 500 g par hectare. Choisir une variété tolérante à la chaleur si le semis est tardif.', 1),
  (2, 'Fumure organique de fond', 'autre', 25000, 'kg', 'charretée', 500, NULL, 'Fumier de parc, compost, déjections de volaille décomposées',
   'Deux brouettes pour 10 m², soit 20 à 30 tonnes par hectare. Le chou est très gourmand en matière organique.', 1),
  (2, 'NPK 15-15-15 (fond)', 'engrais', 300, 'kg', 'sac', 50, 17000, NULL,
   '300 kg/ha au labour, soit environ 15 boîtes d''allumettes par planche de 10 m². Doses indicatives.', 2),
  (4, 'Urée 46 %', 'engrais', 225, 'kg', 'sac', 50, 19000, NULL,
   '75 kg aux 3e, 5e et 7e semaines après repiquage. Arrêter dès le début de la pommaison.', 1),
  (7, 'Neem ou Bacillus thuringiensis', 'phytosanitaire', 12, 'l', 'bidon', 5, 4000, 'Décoction de neem préparée sur place',
   'Contre les chenilles. Pulvériser sous les feuilles, en fin de journée. Le ramassage manuel reste efficace sur petite surface.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'chou'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Le chou se vend vite ou se perd',
   'Une pomme récoltée tient quelques jours, pas plus, surtout à la chaleur. Organisez la vente avant de couper : '
   || 'un acheteur prévenu la veille vaut mieux qu''un tas de choux qui fane au marché.',
   'conditionnement', NULL, 1),
  ('Échelonner les semis pour étaler les ventes',
   'Semer toute la parcelle le même jour, c''est tout récolter la même semaine et devoir tout brader. '
   || 'Trois semis espacés de dix jours donnent trois récoltes successives et trois occasions de négocier.',
   'calendrier', NULL, 2),
  ('Laisser les feuilles de protection',
   'Deux ou trois feuilles extérieures laissées autour de la pomme la protègent des chocs pendant le transport. '
   || 'Les acheteurs le savent et paient mieux une marchandise qui arrive intacte.',
   'conditionnement', NULL, 3),
  ('Vendre par charge de tricycle',
   'Le chou est volumineux. Vendre par charge complète de tricycle ou de camionnette simplifie la négociation '
   || 'et évite de payer plusieurs transports pour la même parcelle.',
   'transport', NULL, 4),
  ('Les restaurants et cantines achètent régulièrement',
   'Au-delà des bana-banas, les restaurants, les cantines scolaires et les traiteurs de cérémonies achètent du chou toutes les semaines. '
   || 'Un contact régulier vaut mieux qu''une grosse vente ponctuelle.',
   'negociation', NULL, 5),
  ('La saison fraîche est votre meilleure fenêtre',
   'Le chou pomme mal dès qu''il fait très chaud. Concentrez la production sur la saison fraîche, de novembre à février : '
   || 'meilleures pommes, moins de chenilles, et une demande urbaine soutenue.',
   'calendrier', array[11,12,1,2], 6)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'chou'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'kg', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Bonne période de production. L''offre est correcte, les prix tiennent.'),
  (2,  'abondance', 'Beaucoup de choux arrivent en même temps sur les marchés urbains.'),
  (3,  'abondance', 'Fin de la saison fraîche, pic de l''offre. Prix au plus bas.'),
  (4,  'normal',    'La chaleur monte, la qualité baisse. L''offre se réduit.'),
  (5,  'penurie',   'Trop chaud pour une bonne pommaison. Peu de choux disponibles.'),
  (6,  'penurie',   'Production très limitée. Les prix sont élevés pour qui arrive à produire.'),
  (7,  'penurie',   'Hivernage : pourriture et chenilles. Production difficile, prix hauts.'),
  (8,  'penurie',   'Offre minimale de l''année.'),
  (9,  'normal',    'Fin des pluies. Les pépinières redémarrent.'),
  (10, 'normal',    'Premiers repiquages de saison fraîche. Peu de production encore.'),
  (11, 'normal',    'Premières récoltes de saison fraîche. Bonne fenêtre de vente.'),
  (12, 'normal',    'Fêtes de fin d''année : la demande est forte, les prix corrects.')
) as v(mois, tendance, commentaire) on true
where s.code = 'chou'
on conflict do nothing;
