-- =============================================================================
-- Durée de cycle du poulet Goliath, et documentation de la colonne.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- La planification inversée lit duree_cycle_jours : un écart avec le guide
-- décale la date de mise en place calculée.
--
-- Le Goliath portait 75 jours alors que sa dernière étape — « Vente » — se
-- termine à J+80. Un producteur visant la Tabaski recevait donc une date de
-- mise en place cinq jours trop tardive, et ses sujets n'étaient pas prêts.
--
-- 80 est aussi la convention déjà suivie par toutes les autres filières
-- animales, où duree_cycle_jours vaut exactement le jour de la dernière étape :
-- poulet de chair 45, caprin 90, ovin et bovin 120, tilapia 180, pondeuse 500.
-- Le Goliath était le seul à s'en écarter.
--
-- Cette colonne sert aussi, côté application, à calculer `date_fin_prevue` à la
-- création d'un cycle et à afficher « Cycle d'environ N jours » — voir
-- app/(auth)/premier-cycle.tsx. Les cycles déjà créés gardent la date calculée
-- au moment de leur création : elle est stockée, pas recalculée.
-- -----------------------------------------------------------------------------
update public.speculations set duree_cycle_jours = 80 where code = 'poulet_goliath';

-- -----------------------------------------------------------------------------
-- L'écart entre les deux durées est légitime et doit cesser d'être pris pour
-- une incohérence : le guide couvre plus que le cycle productif. L'aubergine
-- commence sa pépinière 35 jours avant repiquage et le niébé sèche ses fanes
-- après la récolte du grain, d'où 55 et 20 jours de plus au guide.
-- -----------------------------------------------------------------------------
comment on column public.speculations.duree_cycle_jours is
  'Durée du cycle productif, utilisée par la planification inversée. Peut être '
  'inférieure à duree_totale_jours du guide, qui inclut préparation en amont '
  'et opérations post-récolte (pépinière, séchage des fanes).';
