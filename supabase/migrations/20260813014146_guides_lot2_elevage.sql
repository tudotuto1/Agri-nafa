-- =============================================================================
-- AgriNafa — Guides, lot 2 : élevage et pisciculture
--
--   · Ovin d'embouche      (base_calcul = tete)
--   · Caprin d'embouche    (base_calcul = tete)
--   · Bovin d'embouche     (base_calcul = tete)
--   · Tilapia en étang     (base_calcul = bassin, bassin de référence 400 m²)
--
-- SOURCES
--   · Sano et al. — typologie d'ateliers d'embouche ovine au Burkina Faso (LRRD)
--   · Évaluation des performances de l'embouche ovine paysanne, Korsimoro (BF)
--   · Analyse des pratiques d'embouche ovine en zones semi-arides du BF
--   · Module de formation embouche ovine-caprine — STAMP Mali
--   · Cahiers Agricultures — valorisation des ressources alimentaires locales
--   · FAO — élevage du tilapia en étang, alimentation et densités
--   · RECA Niger — recueil de fiches techniques 2022, élevage du tilapia
--
-- AVERTISSEMENT PORTÉ PAR LE CONTENU
--   En embouche, la ration est le premier poste de dépense et la première
--   cause d'échec. Un éleveur qui achète l'animal sans provisionner sa
--   nourriture sur toute la durée revend maigre, à perte. Chaque guide le dit
--   avant la première étape, pas en conclusion.
--
-- -----------------------------------------------------------------------------
-- CORRECTION PAR RAPPORT AU FICHIER FOURNI : LE TYPE DE mois_concernes
--
-- `conseils_commercialisation.mois_concernes` est un smallint[]. Dans une liste
-- VALUES dont TOUTES les lignes portent NULL pour cette colonne, PostgreSQL n'a
-- rien pour en déduire le type : il retombe sur `text`, puis refuse d'insérer
-- du text dans un smallint[] (42804).
--
-- Les blocs caprin, bovin et tilapia sont dans ce cas — aucun de leurs conseils
-- n'est daté. Le bloc ovin passait, lui, grâce au seul `array[6,7,8]` de son
-- cinquième conseil, qui suffisait à typer toute la colonne. C'est aussi
-- pourquoi le lot 1 n'avait rien révélé : chacune de ses listes contenait au
-- moins un mois renseigné.
--
-- Le premier NULL de chaque liste concernée est donc typé explicitement. Rien
-- d'autre ne change : ces conseils restent sans mois, ce qui est le sens voulu.
-- -----------------------------------------------------------------------------
-- =============================================================================

-- =============================================================================
-- 1. OVIN D'EMBOUCHE
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Embouche ovine — bélier de 4 mois',
  'Acheter un animal maigre, le nourrir méthodiquement, le revendre gras au moment où le marché paie le mieux.',
  'toute_saison',
  'Gagner 10 à 14 kg de poids vif par animal en 110 à 120 jours, et vendre sur un pic de demande.',
  'L''embouche ovine est l''activité d''élevage la plus répandue au Burkina, et la plus liée au calendrier religieux. '
  || 'Tout se joue sur trois choses : le prix d''achat de l''animal maigre, le coût de la ration, et la date de vente. '
  || 'Rater l''une des trois annule le bénéfice des deux autres.',
  'tete',
  10, 14, 'kg de gain de poids vif', 45000,
  5, 'intermediaire', 120,
  array[1, 2, 8, 9],
  array[
    'Sano et al. — typologie d''ateliers d''embouche ovine au Burkina Faso',
    'Évaluation des performances de l''embouche ovine paysanne, commune de Korsimoro',
    'Module de formation embouche ovine-caprine — STAMP Mali',
    'Cahiers Agricultures — valorisation des ressources alimentaires locales'
  ]
from public.speculations s
where s.code = 'ovin_engraissement'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Calculer avant d''acheter',
   'Poser le calcul complet : prix d''achat, coût de la ration sur 120 jours, frais vétérinaires, et prix de vente espéré. '
   || 'Si la marge est négative sur le papier, elle le sera aussi dans la bergerie.',
   -15, -8, array['Coût total de la ration provisionné', 'Date de vente fixée', 'Marge prévisionnelle positive'],
   'preparation', 4,
   array['Carnet ou AgriNafa'],
   array[
     'Acheter l''animal avec tout son argent et compter nourrir « au fur et à mesure » : c''est la première cause d''échec. On finit par sous-alimenter et revendre maigre.',
     'Se fier au prix de vente de l''an dernier sans vérifier le marché.',
     'Oublier les frais vétérinaires et le transport dans le calcul.'
   ],
   'La ration coûte souvent autant que l''animal lui-même. Avant d''acheter un bélier, ayez de côté de quoi le nourrir 120 jours. Sinon, achetez-en un de moins.'),

  (2, 'Choisir les animaux',
   'Acheter des mâles entiers, jeunes, en bon état général mais maigres. Éviter les animaux malades ou trop âgés.',
   -7, 0, array['Mâle entier', 'Bon état général', 'Dentition vérifiée', 'Aplombs corrects'],
   'preparation', 8,
   array['Balance ou ruban barymétrique'],
   array[
     'Prendre un animal déjà gras : il n''y a plus de marge de croissance, vous payez le poids que vous espériez gagner.',
     'Prendre un animal malade parce qu''il est bon marché : il coûtera plus en soins qu''il ne rapportera.',
     'Acheter des mâles castrés : les mâles entiers prennent nettement mieux.'
   ],
   'Un animal jeune, maigre mais vif, avec un bon appétit, est le meilleur candidat. Regardez l''œil et la vivacité avant la carcasse.'),

  (3, 'Déparasitage et prophylaxie',
   'Déparasitage interne et externe dès l''arrivée, avant toute transition alimentaire. Vaccination selon le calendrier local.',
   1, 10, array['Déparasitage interne fait', 'Déparasitage externe fait', 'Animal isolé les premiers jours'],
   'protection', 6,
   array['Albendazole', 'Ivermectine', 'Seringues'],
   array[
     'Nourrir richement un animal parasité : les vers profitent de la ration à sa place, le gain de poids ne vient pas.',
     'Mélanger tout de suite les nouveaux arrivants au reste du troupeau.'
   ],
   'Le déparasitage est l''investissement le plus rentable de toute l''embouche. Quelques centaines de francs qui décident du gain de poids des quatre mois suivants.'),

  (4, 'Transition alimentaire',
   'Passer progressivement du fourrage seul à la ration d''embouche, sur 10 à 15 jours.',
   3, 18, array['Augmentation progressive du concentré', 'Pas de refus dans l''auge', 'Bouses normales'],
   'preparation', 15,
   array['Auges', 'Abreuvoirs', 'Fourrage', 'Concentré'],
   array[
     'Passer d''un coup à la ration complète : acidose, diarrhée, parfois mort de l''animal.',
     'Changer brutalement de type d''aliment en cours d''embouche.'
   ],
   'Augmentez le concentré d''un quart chaque 3 ou 4 jours. Un rumen a besoin de deux semaines pour s''adapter — les brûler coûte plus cher que les respecter.'),

  (5, 'Alimentation quotidienne',
   'Ration distribuée deux fois par jour, eau propre à volonté. Fourrage grossier plus concentré azoté et énergétique.',
   18, 110, array['Deux distributions par jour', 'Eau propre en permanence', 'Auges nettoyées', 'Pierre à lécher disponible'],
   'entretien', 120,
   array['Auges', 'Abreuvoirs', 'Tourteau de coton', 'Son de blé', 'Fourrage', 'Pierre à lécher'],
   array[
     'Rationner quand l''argent manque : le gain de poids s''arrête net et ne se rattrape pas.',
     'Négliger l''eau : un mouton qui boit mal mange mal.',
     'Laisser les refus s''accumuler dans l''auge : ils fermentent et dégoûtent l''animal.'
   ],
   'Une ration éprouvée au Burkina : 15 % de tourteau de coton, 6 % de son de blé, 31 % de graines de coton et 48 % de gousses de Piliostigma reticulatum. Les gousses sont ramassées gratuitement en brousse et remplacent une partie du tourteau, qui est le poste le plus cher.'),

  (6, 'Suivi du poids',
   'Pesée ou mesure au ruban barymétrique tous les 15 jours. Ajustement de la ration selon le gain constaté.',
   20, 110, array['Pesée tous les 15 jours', 'Gain quotidien calculé', 'Ration ajustée si nécessaire'],
   'entretien', 10,
   array['Balance ou ruban barymétrique', 'Carnet'],
   array[
     'Ne jamais peser et juger « à l''œil » : on se rend compte trop tard que l''animal ne prend pas.',
     'Attendre la fin pour constater un problème d''alimentation.'
   ],
   'Visez 100 à 120 g de gain par jour. En dessous de 80 g avec une bonne ration, cherchez du côté des parasites ou d''une maladie avant d''augmenter la nourriture.'),

  (7, 'Finition et vente',
   'Deux à trois semaines avant la date cible, soigner la présentation : pelage propre, animal bien en chair, exposition au bon moment.',
   100, 120, array['Poids cible atteint', 'Animal propre et présentable', 'Acheteurs contactés', 'Date de vente respectée'],
   'recolte', 20,
   array['Brosse', 'Corde'],
   array[
     'Vendre après la fête : les prix retombent en quelques jours, parfois de moitié.',
     'Vendre tous les animaux le même jour au même acheteur, sans mise en concurrence.',
     'Amener les animaux au marché sans les avoir abreuvés : ils paraissent creux et se négocient moins bien.'
   ],
   'La présentation compte autant que le poids réel. Un animal propre, brossé, bien tenu, se vend nettement mieux que le même animal sale et fatigué du transport.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'ovin_engraissement'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (3, 'Albendazole (déparasitage interne)', 'prophylaxie', 1, 'dose', 'flacon', 20, 3000, NULL,
   'Une dose par animal à l''arrivée. Renouveler à mi-parcours si l''élevage est en zone humide.', 1),
  (3, 'Ivermectine (déparasitage externe)', 'prophylaxie', 1, 'dose', 'flacon', 20, 4500, NULL,
   'Une dose par animal contre gale et tiques. Injectable, à faire par un agent vétérinaire.', 2),
  (5, 'Tourteau de coton', 'aliment', 30, 'kg', 'sac', 50, 14000, 'Gousses de Piliostigma reticulatum ou d''Acacia raddiana ramassées en brousse',
   'Environ 250 g par jour et par animal sur la durée. Poste le plus cher : les gousses de brousse peuvent en remplacer une partie.', 1),
  (5, 'Son de blé ou de mil', 'aliment', 15, 'kg', 'sac', 50, 9000, 'Son de riz local',
   'Environ 120 g par jour et par animal. Complément énergétique.', 2),
  (5, 'Graines de coton', 'aliment', 55, 'kg', 'sac', 50, 11000, NULL,
   'Environ 450 g par jour et par animal. Apport en énergie et matières grasses.', 3),
  (5, 'Fourrage grossier', 'aliment', 90, 'kg', 'botte', 15, 1000, 'Fanes de niébé, fanes d''arachide, tiges de mil ou de sorgho',
   'À volonté, environ 750 g par jour et par animal. Les fanes de niébé sont les meilleures et souvent disponibles sur l''exploitation.', 4),
  (5, 'Pierre à lécher', 'aliment', 1, 'unité', 'bloc', 1, 2500, NULL,
   'Un bloc pour 5 à 10 animaux sur la durée. Apporte les minéraux qui manquent aux rations locales.', 5)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'ovin_engraissement'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Tout se joue sur la date de vente',
   'Un bélier vendu la veille de la Tabaski et le même vendu une semaine après ne valent pas le même prix — l''écart peut aller du simple au double. '
   || 'Fixez la date de vente AVANT d''acheter l''animal, et remontez le calendrier à partir de là.',
   'evenement', NULL, 1),
  ('Utiliser la planification inversée',
   'AgriNafa calcule votre date d''achat à partir de la date cible. Pour une embouche de 120 jours visant la Tabaski, '
   || 'il faut acheter environ quatre mois plus tôt, avec une marge de sécurité de deux semaines.',
   'calendrier', NULL, 2),
  ('Ne pas tout vendre au même acheteur',
   'Les marchands de bétail se connaissent et s''entendent sur les prix. Faire venir deux ou trois acheteurs le même jour '
   || 'change la négociation plus sûrement que n''importe quel argument.',
   'negociation', NULL, 3),
  ('Le poids se vérifie, il ne se devine pas',
   'Un acheteur expérimenté estime le poids mieux que vous à l''œil. Si vous avez pesé vos animaux et noté leur gain, '
   || 'vous discutez sur des chiffres et non sur une impression.',
   'negociation', NULL, 4),
  ('Éviter d''entrer en embouche en saison des pluies',
   'Les performances sont moins bonnes en hivernage : humidité, parasites, pâturage détrempé. '
   || 'Les cycles qui démarrent en saison sèche donnent de meilleurs gains.',
   'calendrier', array[6,7,8], 5),
  ('Les pics de demande à viser',
   'Tabaski en priorité, puis Ramadan et les fêtes de fin d''année. Ces trois fenêtres concentrent l''essentiel de la demande '
   || 'et supportent les meilleurs prix de l''année.',
   'evenement', NULL, 6),
  ('Vendre au marché ou depuis la bergerie',
   'Vendre sur place évite les frais et la fatigue du transport, mais limite le nombre d''acheteurs. '
   || 'Au marché, vous touchez plus de monde mais l''animal arrive fatigué. Pour un lot important, faites venir les acheteurs chez vous.',
   'transport', NULL, 7)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'ovin_engraissement'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'tete', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Après-fêtes : la demande retombe. Bonne période pour acheter des animaux maigres.'),
  (2,  'normal',    'Marché calme. Les prix d''achat des maigres sont favorables.'),
  (3,  'normal',    'Ramadan approche selon les années : la demande commence à monter.'),
  (4,  'penurie',   'Période de Ramadan possible : demande soutenue, prix en hausse.'),
  (5,  'penurie',   'Approche de la Tabaski selon le calendrier lunaire : les prix montent fortement.'),
  (6,  'penurie',   'Fenêtre de Tabaski possible : point haut de l''année pour les béliers bien finis.'),
  (7,  'normal',    'Après la Tabaski, le marché se calme brutalement. Éviter de vendre maintenant.'),
  (8,  'abondance', 'Hivernage : beaucoup d''animaux au pâturage, peu de demande. Prix bas.'),
  (9,  'abondance', 'Marché atone. Bonne période pour acheter en vue des fêtes de fin d''année.'),
  (10, 'normal',    'Reprise progressive de la demande.'),
  (11, 'normal',    'Préparation des fêtes de fin d''année. La demande remonte.'),
  (12, 'penurie',   'Fêtes de fin d''année : demande forte, notamment en zone urbaine.')
) as v(mois, tendance, commentaire) on true
where s.code = 'ovin_engraissement'
on conflict do nothing;

-- =============================================================================
-- 2. CAPRIN D'EMBOUCHE
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Embouche caprine — cycle court de 3 mois',
  'La porte d''entrée de l''élevage : moins de capital qu''un mouton, cycle plus court, animal plus rustique.',
  'toute_saison',
  'Gagner 6 à 10 kg de poids vif par animal en 90 jours, avec une mise de fonds réduite.',
  'La chèvre coûte moins cher à l''achat qu''un mouton et mange davantage de ressources locales. '
  || 'C''est l''élevage qui demande le moins de capital pour démarrer. En contrepartie, le prix de vente '
  || 'est plus faible et la demande moins liée aux fêtes : c''est un revenu plus régulier, moins spectaculaire.',
  'tete',
  6, 10, 'kg de gain de poids vif', 28000,
  5, 'debutant', 90,
  array[1, 2, 9, 10],
  array[
    'Module de formation embouche ovine-caprine — STAMP Mali',
    'Analyse des pratiques d''embouche en zones semi-arides du Burkina Faso'
  ]
from public.speculations s
where s.code = 'caprin_embouche'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Calculer et acheter',
   'Poser le calcul avant d''acheter : prix d''achat, ration sur 90 jours, soins, prix de vente espéré. '
   || 'Choisir des animaux jeunes, entiers, en bon état mais maigres.',
   -10, 0, array['Ration provisionnée sur 90 jours', 'Animaux jeunes et vifs', 'Marge prévisionnelle positive'],
   'preparation', 8,
   array['Carnet ou AgriNafa', 'Ruban barymétrique'],
   array[
     'Acheter plus d''animaux que ce qu''on peut nourrir : mieux vaut trois chèvres bien nourries que six affamées.',
     'Prendre des femelles de réforme : elles engraissent mal et se revendent mal.'
   ],
   'La chèvre valorise mieux que le mouton les fourrages grossiers et les feuillages. Si vous avez des ressources ligneuses sur l''exploitation, elle est plus rentable.'),

  (2, 'Déparasitage et soins d''entrée',
   'Déparasitage interne et externe dès l''arrivée. Isolement les premiers jours. Vaccination contre la pasteurellose.',
   1, 10, array['Déparasitage fait', 'Animaux isolés', 'Vaccination réalisée'],
   'protection', 5,
   array['Albendazole', 'Ivermectine', 'Vaccin anti-pasteurelle'],
   array[
     'Sauter le déparasitage : les caprins sont très sensibles aux strongles, la ration profite aux vers.',
     'Introduire directement les nouveaux dans le troupeau existant.'
   ],
   'Les chèvres sont plus sensibles aux parasites internes que les moutons. Un déparasitage à l''entrée et un second à 45 jours sécurisent le gain de poids.'),

  (3, 'Transition alimentaire',
   'Passage progressif à la ration d''embouche sur 10 jours.',
   3, 15, array['Concentré augmenté par paliers', 'Pas de diarrhée', 'Appétit régulier'],
   'preparation', 10,
   array['Auges', 'Abreuvoirs'],
   array['Passer d''un coup à la ration riche : diarrhée et parfois perte de l''animal.'],
   'Même principe que pour le mouton : un quart de concentré en plus tous les 3 jours, pas davantage.'),

  (4, 'Alimentation quotidienne',
   'Deux distributions par jour, eau propre à volonté. Fourrage et feuillages plus concentré.',
   15, 80, array['Deux distributions par jour', 'Eau propre', 'Fourrage à volonté', 'Pierre à lécher'],
   'entretien', 90,
   array['Auges', 'Abreuvoirs', 'Aliment bétail', 'Fanes de niébé', 'Foin'],
   array[
     'Distribuer au sol : la chèvre refuse ce qui est souillé, le gaspillage est considérable.',
     'Négliger les feuillages : ils réduisent nettement la facture de concentré.'
   ],
   'Une ration type : 0,6 kg de foin, 0,5 kg de fane de niébé et 0,4 kg d''aliment bétail par jour et par animal. Les feuillages d''arbres fourragers remplacent avantageusement une partie du foin.'),

  (5, 'Suivi et ajustement',
   'Pesée tous les 15 jours. Vérification de l''état général et des parasites.',
   15, 80, array['Pesée régulière', 'Gain quotidien suivi', 'Second déparasitage à 45 jours'],
   'entretien', 8,
   array['Ruban barymétrique', 'Carnet'],
   array['Juger à l''œil sans mesurer : on constate trop tard un animal qui ne prend pas.'],
   'Visez 70 à 100 g de gain par jour. La chèvre prend moins vite que le mouton, mais elle coûte aussi moins cher à nourrir.'),

  (6, 'Finition et vente',
   'Soigner la présentation, contacter plusieurs acheteurs, vendre à la date prévue.',
   80, 90, array['Poids cible atteint', 'Animaux propres', 'Plusieurs acheteurs sollicités'],
   'recolte', 12,
   array['Brosse', 'Corde'],
   array[
     'Vendre au premier acheteur venu sans comparer.',
     'Attendre indéfiniment un meilleur prix : chaque jour supplémentaire coûte une ration.'
   ],
   'Contrairement au mouton, la demande de chèvre est plus régulière sur l''année. C''est un revenu moins dépendant du calendrier des fêtes, donc plus prévisible.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'caprin_embouche'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (2, 'Albendazole', 'prophylaxie', 2, 'dose', 'flacon', 20, 3000, NULL,
   'Une dose à l''entrée, une seconde à 45 jours. Les caprins sont très sensibles aux strongles.', 1),
  (2, 'Ivermectine', 'prophylaxie', 1, 'dose', 'flacon', 20, 4500, NULL,
   'Une dose à l''entrée contre gale et tiques.', 2),
  (2, 'Vaccin anti-pasteurelle', 'prophylaxie', 1, 'dose', 'flacon', 25, 3500, NULL,
   'Une dose à l''entrée. Important en période de fortes variations de température.', 3),
  (4, 'Aliment bétail concentré', 'aliment', 36, 'kg', 'sac', 50, 13000, 'Mélange local de son et tourteau',
   'Environ 400 g par jour et par animal sur 90 jours.', 1),
  (4, 'Fanes de niébé', 'aliment', 45, 'kg', 'botte', 15, 900, 'Fanes d''arachide, feuillages d''arbres fourragers',
   'Environ 500 g par jour et par animal. Souvent disponibles sur l''exploitation après la récolte.', 2),
  (4, 'Foin ou fourrage grossier', 'aliment', 54, 'kg', 'botte', 15, 800, 'Tiges de mil ou de sorgho, herbe de brousse fauchée',
   'Environ 600 g par jour et par animal, distribué au râtelier.', 3),
  (4, 'Pierre à lécher', 'aliment', 1, 'unité', 'bloc', 1, 2500, NULL,
   'Un bloc pour 5 à 10 animaux sur la durée.', 4)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'caprin_embouche'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Un revenu plus régulier que le mouton',
   'La demande de viande de chèvre est moins concentrée sur les fêtes. Vous vendez toute l''année, à un prix moins spectaculaire '
   || 'mais plus prévisible. Pour une trésorerie familiale, c''est souvent préférable.',
   'calendrier', NULL::smallint[], 1),
  ('Cycle court : plusieurs rotations par an',
   'Avec 90 jours par cycle, vous pouvez faire trois ou quatre rotations dans l''année. '
   || 'Le capital tourne plus vite qu''en embouche ovine, ce qui compense un bénéfice unitaire plus faible.',
   'calendrier', NULL, 2),
  ('Les bouchers urbains achètent en continu',
   'Au-delà des marchés à bétail, les bouchers de quartier ont besoin d''un approvisionnement régulier. '
   || 'Un accord avec deux ou trois d''entre eux sécurise l''écoulement de chaque bande.',
   'negociation', NULL, 3),
  ('Vendre par lot plutôt qu''à l''unité',
   'Un acheteur qui prend cinq animaux d''un coup négocie moins durement au détail. '
   || 'Groupez vos ventes, éventuellement avec un voisin éleveur.',
   'negociation', NULL, 4),
  ('Les feuillages réduisent la facture',
   'La chèvre valorise les feuillages d''arbres que le mouton refuse. Exploiter cette ressource gratuite '
   || 'peut réduire le coût de la ration d''un tiers.',
   'conditionnement', NULL, 5)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'caprin_embouche'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'tete', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',   'Marché stable. Bonne période d''achat de maigres.'),
  (2,  'normal',   'Demande régulière des bouchers urbains.'),
  (3,  'normal',   'Marché calme, prix stables.'),
  (4,  'normal',   'Demande légèrement soutenue en période de Ramadan.'),
  (5,  'normal',   'Marché stable.'),
  (6,  'normal',   'La demande se reporte surtout sur les ovins à l''approche de la Tabaski.'),
  (7,  'abondance','Hivernage : les animaux sont au pâturage, l''offre est abondante et les prix bas.'),
  (8,  'abondance','Point bas de l''année. Bonne période pour constituer une bande.'),
  (9,  'normal',   'Reprise progressive de la demande.'),
  (10, 'normal',   'Marché stable, écoulement régulier.'),
  (11, 'normal',   'Préparation des fêtes de fin d''année.'),
  (12, 'penurie',  'Fêtes de fin d''année : demande urbaine soutenue, meilleurs prix de l''année.')
) as v(mois, tendance, commentaire) on true
where s.code = 'caprin_embouche'
on conflict do nothing;

-- =============================================================================
-- 3. BOVIN D'EMBOUCHE
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Embouche bovine — cycle de 4 mois',
  'L''élevage le plus rentable en valeur absolue, et le plus exigeant en trésorerie. À ne pas aborder sans réserves.',
  'toute_saison',
  'Gagner 80 à 120 kg de poids vif par animal en 120 jours, avec une alimentation maîtrisée.',
  'L''embouche bovine engage des sommes importantes : l''animal coûte cher, et sa ration davantage encore. '
  || 'C''est l''activité où une erreur de calcul se paie le plus cher — mais aussi celle qui dégage la marge '
  || 'la plus élevée par tête quand elle est bien conduite.',
  'tete',
  80, 120, 'kg de gain de poids vif', 250000,
  2, 'experimente', 120,
  array[9, 10, 11],
  array[
    'Analyse des pratiques d''embouche en zones semi-arides du Burkina Faso',
    'Cahiers Agricultures — valorisation des ressources alimentaires locales',
    'Données de filière embouche bovine, Burkina Faso'
  ]
from public.speculations s
where s.code = 'bovin_embouche'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Vérifier sa capacité financière',
   'Avant tout achat : additionner le prix de l''animal, le coût de la ration sur 120 jours, les frais vétérinaires et le transport. '
   || 'Ne se lancer que si la totalité est disponible ou financée.',
   -20, -10, array['Coût total chiffré', 'Trésorerie disponible sur 120 jours', 'Prix de vente vérifié au marché'],
   'preparation', 6,
   array['Carnet ou AgriNafa'],
   array[
     'Compter sur la vente d''une récolte à venir pour payer la ration : si la récolte est mauvaise, l''animal est sous-alimenté.',
     'Sous-estimer le coût de l''alimentation, qui représente souvent plus que le prix de l''animal.',
     'Se lancer sur plusieurs têtes dès le premier cycle.'
   ],
   'L''alimentation d''un bovin en embouche coûte couramment entre 1 000 et 2 500 FCFA par jour. Sur 120 jours, c''est 120 000 à 300 000 FCFA par animal, hors achat. Faites ce calcul avant tout autre.'),

  (2, 'Choisir les animaux',
   'Mâles entiers, jeunes, de bonne conformation, maigres mais sains. Vérifier dentition, aplombs et état général.',
   -10, 0, array['Mâle entier', 'Jeune', 'Bonne ossature', 'Aucun signe de maladie'],
   'preparation', 12,
   array['Ruban barymétrique'],
   array[
     'Acheter un animal âgé : il transforme mal et sa viande se négocie moins bien.',
     'Choisir sur la seule apparence de gros gabarit : un animal déjà lourd laisse peu de marge de gain.',
     'Négliger les aplombs : un animal qui boite mange moins et perd du poids.'
   ],
   'Un bovin de 250 à 300 kg à l''entrée, jeune et bien charpenté, est le profil qui transforme le mieux. Les races locales sont plus rustiques et moins exigeantes que les métisses.'),

  (3, 'Quarantaine et prophylaxie',
   'Isolement une à deux semaines. Déparasitage interne et externe, vaccinations, traitement contre les trypanosomoses si la zone est concernée.',
   1, 14, array['Animal isolé', 'Déparasitage complet', 'Vaccinations à jour', 'Aucun signe clinique'],
   'protection', 15,
   array['Albendazole', 'Ivermectine', 'Vaccins', 'Case d''isolement'],
   array[
     'Mettre directement l''animal avec les autres : une maladie importée contamine tout l''atelier.',
     'Sauter le déparasitage sur un animal acheté au marché : il en revient presque toujours porteur.'
   ],
   'La quarantaine paraît une perte de temps. Elle évite qu''un animal malade contamine des bêtes qui représentent plusieurs centaines de milliers de francs.'),

  (4, 'Transition alimentaire',
   'Passage progressif du fourrage à la ration d''embouche sur 15 à 21 jours.',
   5, 26, array['Concentré augmenté par paliers', 'Rumination normale', 'Bouses fermes'],
   'preparation', 25,
   array['Auges', 'Abreuvoirs'],
   array[
     'Accélérer la transition pour gagner du temps : l''acidose ruminale peut tuer l''animal en quelques heures.',
     'Distribuer beaucoup de concentré sans fibre : le rumen ne fonctionne plus.'
   ],
   'Trois semaines de transition pour un bovin, pas deux. C''est plus long que pour un mouton parce que le rumen est plus volumineux et plus lent à s''adapter.'),

  (5, 'Alimentation quotidienne',
   'Deux à trois distributions par jour. Fourrage grossier à volonté, concentré selon le poids. Eau propre en permanence.',
   26, 110, array['Distributions régulières aux mêmes heures', 'Eau propre à volonté', 'Auges nettoyées', 'Fourrage toujours disponible'],
   'entretien', 200,
   array['Auges', 'Abreuvoirs', 'Tourteau de coton', 'Son', 'Fourrage', 'Pierre à lécher'],
   array[
     'Réduire la ration en cours de route faute d''argent : le gain de poids s''arrête et les jours passés sont perdus.',
     'Changer d''aliment brutalement en cours de cycle.',
     'Négliger l''abreuvement : un bovin boit 30 à 50 litres par jour, davantage en saison chaude.'
     ],
   'Comptez environ 2 à 3 kg de concentré et 6 à 8 kg de fourrage par jour et par animal, ajustés au poids. L''eau est le nutriment le plus souvent négligé et le plus déterminant.'),

  (6, 'Suivi du gain de poids',
   'Pesée ou barymétrie tous les 15 jours. Ajustement de la ration au poids réel.',
   26, 110, array['Pesée tous les 15 jours', 'Gain quotidien calculé', 'Ration réajustée'],
   'entretien', 15,
   array['Ruban barymétrique', 'Carnet'],
   array[
     'Garder la même ration du début à la fin : les besoins augmentent avec le poids.',
     'Ne pas peser : sur un bovin, une semaine de mauvais gain coûte plusieurs milliers de francs.'
   ],
   'Visez 700 g à 1 kg de gain par jour. En dessous de 500 g avec une bonne ration, cherchez un problème sanitaire avant d''ajouter du concentré.'),

  (7, 'Finition et vente',
   'Deux semaines avant la date cible : soigner l''état de finition et la présentation. Contacter plusieurs acheteurs.',
   105, 120, array['Poids cible atteint', 'Bon état d''engraissement', 'Plusieurs acheteurs contactés', 'Transport organisé'],
   'recolte', 25,
   array['Corde', 'Brosse'],
   array[
     'Vendre en catastrophe parce que la ration n''est plus finançable : l''acheteur le sent et fait baisser le prix.',
     'Prolonger l''embouche « pour gagner encore un peu » : au-delà d''un certain état, le gain ralentit et la ration continue de coûter.',
     'Transporter l''animal sur une longue distance juste avant la vente : il perd du poids et de l''allure.'
   ],
   'Un bovin bien fini se reconnaît à l''arrondi des hanches et de la croupe. Passé ce stade, chaque jour supplémentaire coûte plus qu''il ne rapporte : c''est le moment de vendre.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'bovin_embouche'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (3, 'Albendazole', 'prophylaxie', 2, 'dose', 'flacon', 10, 4500, NULL,
   'Une dose à l''entrée, une à mi-parcours. Dose adaptée au poids de l''animal.', 1),
  (3, 'Ivermectine', 'prophylaxie', 2, 'dose', 'flacon', 10, 6000, NULL,
   'Contre parasites externes et internes. À faire par un agent vétérinaire.', 2),
  (5, 'Tourteau de coton', 'aliment', 180, 'kg', 'sac', 50, 14000, 'Graines de coton entières, gousses de Piliostigma',
   'Environ 1,5 kg par jour et par animal. Principal apport azoté.', 1),
  (5, 'Son de blé ou de mil', 'aliment', 120, 'kg', 'sac', 50, 9000, 'Son de riz, drêches de brasserie',
   'Environ 1 kg par jour et par animal. Apport énergétique.', 2),
  (5, 'Fourrage grossier', 'aliment', 840, 'kg', 'botte', 15, 1000, 'Tiges de mil, fanes de niébé, paille de riz traitée à l''urée',
   'Environ 7 kg par jour et par animal. La fibre est indispensable au bon fonctionnement du rumen.', 3),
  (5, 'Pierre à lécher', 'aliment', 2, 'unité', 'bloc', 1, 3500, NULL,
   'Deux blocs par animal sur la durée du cycle.', 4)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'bovin_embouche'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Ne jamais vendre sous la contrainte',
   'Un éleveur qui doit vendre parce qu''il ne peut plus payer la ration se fait imposer son prix. '
   || 'C''est pourquoi la trésorerie se provisionne avant l''achat, pas pendant le cycle.',
   'negociation', NULL::smallint[], 1),
  ('Faire venir plusieurs acheteurs le même jour',
   'Sur un bovin, quelques milliers de francs d''écart représentent une part importante de la marge. '
   || 'La mise en concurrence est le levier de négociation le plus efficace.',
   'negociation', NULL, 2),
  ('Connaître le prix du kilo au marché',
   'Le prix du kilogramme de bœuf se situe couramment autour de 3 000 FCFA avec os et 4 000 FCFA sans os. '
   || 'Connaître ces repères permet d''évaluer si l''offre reçue est cohérente avec le poids de votre animal.',
   'negociation', NULL, 3),
  ('Viser les grandes occasions',
   'Fêtes religieuses, cérémonies, mariages : la demande en gros animaux se concentre sur ces événements. '
   || 'Un bovin fini pour une période creuse se vend nettement moins bien.',
   'evenement', NULL, 4),
  ('Les bouchers et chevillards paient mieux que les intermédiaires',
   'Vendre directement à un boucher ou à un chevillard supprime une marge intermédiaire. '
   || 'Cela demande de connaître le milieu, mais l''écart est substantiel sur un animal de cette valeur.',
   'negociation', NULL, 5),
  ('Éviter le transport juste avant la vente',
   'Un bovin transporté sur une longue distance perd du poids et arrive fatigué. '
   || 'Faites plutôt venir l''acheteur, ou prévoyez un jour de repos et d''abreuvement avant la pesée.',
   'transport', NULL, 6)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'bovin_embouche'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'tete', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Après-fêtes : bonne période pour acheter des animaux maigres.'),
  (2,  'normal',    'Marché calme. Prix d''achat favorables.'),
  (3,  'normal',    'Saison sèche : le pâturage se raréfie, certains éleveurs déstockent. Achats intéressants.'),
  (4,  'normal',    'Fin de saison sèche. Beaucoup d''animaux maigres sur le marché.'),
  (5,  'penurie',   'Demande soutenue à l''approche des grandes fêtes selon le calendrier.'),
  (6,  'penurie',   'Période de forte demande possible. Bons prix pour les animaux bien finis.'),
  (7,  'normal',    'Retombée après les fêtes. Marché plus calme.'),
  (8,  'abondance', 'Hivernage : pâturage abondant, peu de déstockage, demande faible.'),
  (9,  'abondance', 'Les animaux reprennent au pâturage. Prix bas, bonne fenêtre d''achat.'),
  (10, 'normal',    'Reprise progressive du marché.'),
  (11, 'normal',    'Préparation des fêtes de fin d''année et des cérémonies de saison sèche.'),
  (12, 'penurie',   'Fêtes et cérémonies : demande forte en gros animaux, meilleurs prix.')
) as v(mois, tendance, commentaire) on true
where s.code = 'bovin_embouche'
on conflict do nothing;

-- =============================================================================
-- 4. TILAPIA EN ÉTANG
--
-- Base de calcul : le bassin. Bassin de référence de 400 m² (4 ares), taille
-- courante des étangs de grossissement dans les fiches ouest-africaines.
-- =============================================================================
insert into public.itineraires_techniques
  (speculation_id, titre, description, saison, objectif, resume, base_calcul,
   rendement_min_ha, rendement_max_ha, unite_rendement, cout_indicatif_ha,
   surface_min_ha, difficulte, duree_totale_jours, mois_semis_conseilles, sources)
select s.id,
  'Tilapia du Nil — grossissement en étang',
  'Une filière encore peu occupée au Burkina, avec une demande urbaine bien supérieure à l''offre locale.',
  'toute_saison',
  'Produire des tilapias de 200 à 300 g en 5 à 6 mois, dans un étang de 400 m².',
  'La pisciculture demande une ressource en eau fiable et une discipline quotidienne, mais elle occupe '
  || 'un marché mal servi : le poisson consommé au Burkina vient largement de la pêche et de l''importation. '
  || 'Un bassin bien conduit trouve preneur sans difficulté.',
  'bassin',
  200, 400, 'kg par bassin de 400 m²', 350000,
  1, 'experimente', 180,
  array[3, 4, 5],
  array[
    'FAO — élevage du tilapia en étang : densités, alimentation et croissance',
    'RECA Niger — recueil de fiches techniques 2022, élevage du tilapia du Nil',
    'Lazard — élevage du tilapia en Afrique, données techniques sur la pisciculture en étang'
  ]
from public.speculations s
where s.code = 'tilapia'
  and not exists (select 1 from public.itineraires_techniques i where i.speculation_id = s.id);

insert into public.etapes_itineraire
  (itineraire_id, ordre, titre, description, jour_debut, jour_fin, points_de_controle,
   phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
select i.id, v.*
from public.itineraires_techniques i
join public.speculations s on s.id = i.speculation_id
cross join (values
  (1, 'Vérifier la ressource en eau',
   'S''assurer d''un approvisionnement en eau fiable toute l''année : barrage, forage, cours d''eau permanent. '
   || 'Vérifier le débit disponible et la possibilité de vidanger le bassin.',
   -60, -45, array['Eau disponible toute l''année', 'Débit suffisant', 'Vidange possible par gravité'],
   'preparation', 20,
   array['Pelle', 'Niveau'],
   array[
     'Creuser un bassin sans avoir vérifié l''eau en saison sèche : le bassin s''assèche et tout le cheptel meurt.',
     'Choisir un point bas inondable : la crue emporte les poissons.',
     'Oublier de prévoir la vidange : sans elle, la pêche finale est impossible.'
   ],
   'L''eau est la contrainte numéro un. Un bassin près d''un barrage permanent ou d''un forage à bon débit vaut mieux qu''un grand bassin mal alimenté.'),

  (2, 'Construire le bassin',
   'Creuser un étang de 400 m² environ, profondeur de 0,8 à 1,5 m, avec pente vers la vidange. Digues compactées.',
   -45, -20, array['Fond en pente vers la vidange', 'Digues bien compactées', 'Tuyaux d''alimentation et de vidange posés'],
   'installation', 250,
   array['Pelles', 'Pioches', 'Brouettes', 'Tuyaux PVC', 'Grillage fin'],
   array[
     'Digues non compactées : elles fuient et le niveau baisse en permanence.',
     'Fond plat sans pente : impossible de vider complètement, des poissons restent et contaminent le cycle suivant.',
     'Oublier le grillage aux entrées et sorties : les prédateurs entrent, les poissons sortent.'
   ],
   'Prévoyez une pente régulière du fond vers le point de vidange. C''est ce qui permet de récupérer tous les poissons à la pêche finale — et surtout tous les prédateurs avant le cycle suivant.'),

  (3, 'Préparer et fertiliser le bassin',
   'Assèchement, chaulage, fertilisation organique pour développer le plancton, puis remplissage progressif.',
   -20, -7, array['Fond asséché et craquelé', 'Chaulage fait', 'Fumure organique répartie', 'Eau verdâtre au bout d''une semaine'],
   'preparation', 40,
   array['Chaux', 'Fumier de volaille ou de petits ruminants', 'Brouette'],
   array[
     'Empoissonner dans une eau claire : sans plancton, les alevins n''ont rien à manger et la croissance démarre mal.',
     'Sur-fertiliser : l''eau devient trop chargée, l''oxygène chute la nuit et les poissons meurent au petit matin.'
   ],
   'Une eau légèrement verte signale un plancton actif : c''est la nourriture gratuite de vos poissons. Le test simple : plongez le bras, vous devez perdre la main de vue vers 30-40 cm de profondeur.'),

  (4, 'Empoissonner',
   'Mise en charge d''alevins de 10 à 20 g, à une densité de 2 à 3 poissons par m². Acclimatation progressive avant lâcher.',
   0, 2, array['Alevins de 10 à 20 g', 'Densité respectée', 'Acclimatation en sac 20 minutes', 'Lâcher tôt le matin'],
   'installation', 12,
   array['Sacs de transport', 'Seaux', 'Épuisette'],
   array[
     'Lâcher les alevins directement sans acclimatation : le choc thermique en tue une grande partie.',
     'Surcharger le bassin en espérant plus de production : les poissons restent petits et invendables.',
     'Empoissonner en pleine chaleur de la journée.'
   ],
   'Densité recommandée : 2 à 3 alevins par m², soit 800 à 1 200 alevins pour un bassin de 400 m². Un optimum souvent cité est de 2,5 par m². Privilégiez des alevins mâles : ils grandissent environ deux fois plus vite que les femelles.'),

  (5, 'Alimentation quotidienne',
   'Distribution deux fois par jour, matin et fin d''après-midi, toujours au même endroit. Ration calculée sur la biomasse estimée.',
   2, 170, array['Deux distributions par jour', 'Toujours au même point', 'Ration ajustée chaque mois', 'Pas de restes visibles'],
   'entretien', 180,
   array['Tourteau d''arachide', 'Son de blé', 'Seau doseur'],
   array[
     'Distribuer au hasard sur tout le bassin : impossible de voir si les poissons mangent, et beaucoup se perd.',
     'Garder la même ration toute la durée : les besoins augmentent avec la biomasse.',
     'Sur-nourrir : les restes pourrissent, consomment l''oxygène et étouffent les poissons.'
   ],
   'Ration journalière : environ 6 % de la biomasse tant que les poissons font moins de 70 g, puis 4 % au-delà. Un mélange simple et éprouvé : moitié tourteau d''arachide, moitié son de blé.'),

  (6, 'Pêches de contrôle mensuelles',
   'Chaque mois, pêcher un échantillon à l''épuisette, peser, calculer le poids moyen et réajuster la ration.',
   30, 170, array['Pêche de contrôle mensuelle', 'Poids moyen noté', 'Ration recalculée', 'État sanitaire vérifié'],
   'entretien', 25,
   array['Épuisette ou petite senne', 'Balance', 'Carnet'],
   array[
     'Ne jamais contrôler : on découvre à la pêche finale que les poissons sont trop petits, sans avoir pu corriger.',
     'Manipuler brutalement les poissons : les blessures s''infectent.'
   ],
   'Sans pesée mensuelle, vous nourrissez à l''aveugle. Un poisson qui grandit d''environ 1 g par jour est sur la bonne trajectoire ; nettement moins, et il faut chercher la cause avant qu''il soit trop tard.'),

  (7, 'Surveillance quotidienne du bassin',
   'Contrôle du niveau d''eau, de la couleur, des entrées et sorties. Retrait des herbes aquatiques. Surveillance des prédateurs.',
   2, 175, array['Niveau d''eau stable', 'Couleur de l''eau normale', 'Grillages intacts', 'Aucun poisson en surface le matin'],
   'protection', 90,
   array['Râteau', 'Grillage de rechange'],
   array[
     'Ignorer des poissons qui montent respirer en surface au petit matin : c''est un manque d''oxygène, il faut agir immédiatement.',
     'Laisser les herbes aquatiques envahir : elles gênent la pêche et concurrencent le plancton.',
     'Négliger les grillages : oiseaux, serpents et poissons prédateurs font des dégâts rapides.'
   ],
   'Des poissons qui « happent » l''air en surface tôt le matin annoncent une asphyxie. Renouvelez de l''eau immédiatement et arrêtez la nourriture ce jour-là.'),

  (8, 'Pêche et vente',
   'Vidange progressive et pêche totale à 5-6 mois, quand le poids moyen atteint 200 à 300 g. Vente immédiate ou conservation sous glace.',
   150, 180, array['Poids moyen de 200 g minimum', 'Acheteurs prévenus', 'Glace ou transport frais organisé', 'Bassin totalement vidé'],
   'recolte', 60,
   array['Senne', 'Bassines', 'Glace', 'Balance'],
   array[
     'Pêcher sans avoir organisé la vente : le poisson frais ne se garde pas quelques heures à la chaleur.',
     'Laisser des poissons dans le bassin après vidange : ils se reproduisent et le cycle suivant démarre surpeuplé.',
     'Pêcher en pleine chaleur : mortalité rapide et poisson de mauvaise présentation.'
   ],
   'Pêchez tôt le matin, acheteurs prévenus la veille. Le poisson frais est une denrée qui perd sa valeur en quelques heures : la logistique de vente se prépare avant de toucher à la vidange.')
) as v(ordre, titre, description, jour_debut, jour_fin, points_de_controle, phase, heures_travail_ha, materiel, erreurs_frequentes, astuce)
where s.code = 'tilapia'
on conflict (itineraire_id, ordre) do nothing;

insert into public.intrants_etape
  (etape_id, nom, categorie, quantite_par_ha, unite, conditionnement, taille_conditionnement, prix_indicatif_unite, substitut_local, consigne, ordre)
select e.id, v.nom, v.cat::public.categorie_stock, v.qte, v.unite, v.cond, v.taille, v.prix, v.sub, v.consigne, v.ordre
from public.etapes_itineraire e
join public.itineraires_techniques i on i.id = e.itineraire_id
join public.speculations s on s.id = i.speculation_id
join (values
  (2, 'Tuyaux PVC alimentation et vidange', 'materiel', 12, 'm', 'barre', 6, 6000, NULL,
   'Pour un bassin de 400 m². Prévoir une vanne ou un bouchon étanche côté vidange.', 1),
  (2, 'Grillage fin', 'materiel', 8, 'm', 'rouleau', 10, 9000, NULL,
   'Aux entrées et sorties d''eau, pour empêcher l''entrée des prédateurs et la fuite des poissons.', 2),
  (3, 'Chaux vive', 'autre', 40, 'kg', 'sac', 25, 4500, NULL,
   'Environ 100 g par m² sur le fond asséché. Assainit le bassin et corrige l''acidité.', 1),
  (3, 'Fumure organique de fertilisation', 'autre', 400, 'kg', 'brouette', 60, NULL, 'Fiente de volaille, fumier de petits ruminants bien décomposé',
   'Environ 1 kg par m² pour amorcer le plancton. Répartir sur le fond avant remplissage.', 2),
  (4, 'Alevins de tilapia', 'autre', 1000, 'unité', 'sac de transport', 250, 100, NULL,
   '2 à 3 alevins par m², soit environ 1 000 pour un bassin de 400 m². Privilégier des alevins mâles de 10 à 20 g.', 1),
  (5, 'Tourteau d''arachide', 'aliment', 250, 'kg', 'sac', 50, 15000, 'Tourteau de coton si l''arachide est indisponible',
   'Moitié de la ration. Quantité totale indicative pour un cycle de 6 mois sur un bassin de 400 m².', 1),
  (5, 'Son de blé', 'aliment', 250, 'kg', 'sac', 50, 9000, 'Son de riz ou de mil',
   'Moitié de la ration. À doser chaque mois selon la biomasse estimée après pêche de contrôle.', 2),
  (8, 'Glace', 'autre', 100, 'kg', 'barre', 25, 1500, NULL,
   'Pour la conservation le jour de la pêche. À prévoir avant de vidanger, pas après.', 1)
) as v(ordre_etape, nom, cat, qte, unite, cond, taille, prix, sub, consigne, ordre)
  on v.ordre_etape = e.ordre
where s.code = 'tilapia'
on conflict do nothing;

insert into public.conseils_commercialisation (speculation_id, titre, contenu, type_conseil, mois_concernes, ordre)
select s.id, v.titre, v.contenu, v.type, v.mois, v.ordre
from public.speculations s
join (values
  ('Organiser la vente avant de vidanger',
   'Le poisson frais se dégrade en quelques heures à la chaleur. Prévenez vos acheteurs plusieurs jours à l''avance '
   || 'et fixez l''heure de la pêche avec eux. Une pêche réussie sans acheteur est une perte sèche.',
   'prevente', NULL::smallint[], 1),
  ('La glace fait partie du coût de production',
   'Sans chaîne du froid, même sommaire, vous vendez dans l''urgence au prix qu''on vous impose. '
   || 'Quelques barres de glace achetées la veille vous donnent une journée de marge de négociation.',
   'conditionnement', NULL, 2),
  ('Restaurants, maquis et hôtels achètent en continu',
   'Le poisson d''élevage intéresse particulièrement la restauration urbaine, qui cherche un approvisionnement régulier et de calibre homogène. '
   || 'Un accord avec deux ou trois établissements sécurise l''écoulement de chaque cycle.',
   'negociation', NULL, 3),
  ('Vendre vivant se paie mieux',
   'Un tilapia vendu vivant, dans une bassine d''eau, se négocie nettement mieux qu''un poisson mort depuis quelques heures. '
   || 'Sur les marchés urbains, c''est un argument de fraîcheur immédiatement visible.',
   'conditionnement', NULL, 4),
  ('Échelonner les bassins pour vendre toute l''année',
   'Avec deux ou trois bassins empoissonnés à des dates décalées, vous récoltez plusieurs fois dans l''année '
   || 'au lieu d''une seule grosse vente difficile à écouler.',
   'calendrier', NULL, 5),
  ('Le carême et les périodes de jeûne soutiennent la demande',
   'La demande en poisson augmente pendant les périodes de jeûne chrétien et lors du Ramadan. '
   || 'Caler une pêche sur ces fenêtres améliore sensiblement le prix.',
   'evenement', NULL, 6)
) as v(titre, contenu, type, mois, ordre) on true
where s.code = 'tilapia'
on conflict do nothing;

insert into public.saisonnalite_prix (speculation_id, mois, prix_moyen, unite, tendance, commentaire)
select s.id, v.mois, NULL, 'kg', v.tendance, v.commentaire
from public.speculations s
join (values
  (1,  'normal',    'Demande stable. Les prises de pêche en barrage sont encore correctes.'),
  (2,  'normal',    'Marché régulier.'),
  (3,  'penurie',   'Les barrages baissent, la pêche naturelle se raréfie. Le poisson d''élevage se valorise bien.'),
  (4,  'penurie',   'Étiage : peu de poisson sauvage disponible. Prix élevés.'),
  (5,  'penurie',   'Fin de saison sèche, offre au plus bas. Meilleure fenêtre de vente de l''année.'),
  (6,  'normal',    'Premières pluies. La pêche naturelle reprend progressivement.'),
  (7,  'normal',    'Hivernage : les barrages se remplissent, les captures augmentent.'),
  (8,  'abondance', 'Bonne période de pêche naturelle. Concurrence forte sur le marché.'),
  (9,  'abondance', 'Offre abondante de poisson sauvage. Prix bas.'),
  (10, 'normal',    'Les captures diminuent, les prix se redressent.'),
  (11, 'normal',    'Demande stable en zone urbaine.'),
  (12, 'normal',    'Fêtes de fin d''année : demande soutenue en restauration.')
) as v(mois, tendance, commentaire) on true
where s.code = 'tilapia'
on conflict do nothing;
