-- =============================================================================
-- AgriNafa · 10 — Guides enrichis
--
-- Le schéma initial portait un itinéraire textuel. Ce qu'il faut désormais :
-- des chiffres qui tiennent au champ, des doses qui s'adaptent à la surface
-- réelle, des images, et un volet commercialisation.
--
-- Parti pris central : TOUT CE QUI SE DOSE EST EXPRIMÉ À L'HECTARE, et
-- l'application multiplie par la surface du producteur. Stocker « 3 sacs de
-- NPK » serait faux pour 90 % des exploitations : à Loumbila on cultive
-- souvent moins d'un demi-hectare, et un guide qui parle en sacs pour un
-- hectare fait sur-doser ceux qui ont moins. Un mauvais dosage d'engrais,
-- c'est une récolte perdue chez quelqu'un.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Itinéraires : données économiques et agronomiques de cadrage
-- -----------------------------------------------------------------------------
alter table public.itineraires_techniques
  add column if not exists image_path            text,
  add column if not exists resume                text,
  -- Bornes de rendement observées localement, à l'hectare. Une fourchette
  -- plutôt qu'un chiffre : annoncer un rendement unique serait mentir sur la
  -- variabilité pluviométrique du Sahel.
  add column if not exists rendement_min_ha      numeric(10, 2),
  add column if not exists rendement_max_ha      numeric(10, 2),
  add column if not exists unite_rendement       text,
  -- Coût indicatif de mise en culture d'un hectare, hors main-d'œuvre
  -- familiale. Sert à projeter un besoin de trésorerie avant de démarrer.
  add column if not exists cout_indicatif_ha     numeric(12, 2),
  add column if not exists surface_min_ha        numeric(8, 2),
  add column if not exists difficulte            text
    check (difficulte is null or difficulte in ('debutant', 'intermediaire', 'experimente')),
  add column if not exists duree_totale_jours    integer,
  add column if not exists mois_semis_conseilles smallint[],
  add column if not exists sources               text[];

comment on column public.itineraires_techniques.rendement_min_ha is
  'Fourchette basse observée localement. Ne jamais présenter le maximum seul : '
  'un producteur qui bâtit sa trésorerie sur le meilleur cas se retrouve à découvert.';

-- -----------------------------------------------------------------------------
-- Étapes : image, durée de travail, matériel, alertes
-- -----------------------------------------------------------------------------
alter table public.etapes_itineraire
  add column if not exists image_path        text,
  add column if not exists phase             text
    check (phase is null or phase in
      ('preparation', 'installation', 'entretien', 'protection', 'recolte', 'commercialisation')),
  -- Charge de travail à l'hectare : l'app la ramène à la surface réelle.
  add column if not exists heures_travail_ha numeric(6, 1),
  add column if not exists materiel          text[],
  -- Les erreurs qui coûtent une récolte, formulées comme telles.
  add column if not exists erreurs_frequentes text[],
  add column if not exists astuce            text,
  add column if not exists facultative       boolean not null default false;

-- -----------------------------------------------------------------------------
-- Intrants dosés à l'hectare
--
-- Table dédiée plutôt qu'un champ texte : c'est ce qui permet à l'application
-- de calculer « pour vos 0,4 ha : 2 sacs de 50 kg » au lieu d'afficher une
-- consigne que le producteur devra convertir de tête.
-- -----------------------------------------------------------------------------
create table if not exists public.intrants_etape (
  id              uuid primary key default gen_random_uuid(),
  etape_id        uuid not null references public.etapes_itineraire (id) on delete cascade,
  nom             text not null,
  categorie       public.categorie_stock not null,
  -- Quantité pour UN hectare. Multipliée par la surface côté application.
  quantite_par_ha numeric(10, 2) not null check (quantite_par_ha > 0),
  unite           text not null,
  -- Conditionnement du commerce local : sac de 50 kg, sachet de 100 g…
  conditionnement text,
  taille_conditionnement numeric(10, 2) check (taille_conditionnement is null or taille_conditionnement > 0),
  prix_indicatif_unite numeric(12, 2) check (prix_indicatif_unite is null or prix_indicatif_unite >= 0),
  substitut_local text,   -- alternative accessible : fumure organique, compost…
  consigne        text,
  ordre           integer not null default 1
);

create index if not exists idx_intrants_etape on public.intrants_etape (etape_id, ordre);

comment on table public.intrants_etape is
  'Doses exprimées à l''hectare. L''application les ramène à la surface réelle '
  'du producteur : une consigne en sacs pour un hectare fait sur-doser '
  'quiconque cultive moins.';

-- -----------------------------------------------------------------------------
-- Conseils de commercialisation
--
-- Le cahier des charges le dit : le producteur subit le diktat des acheteurs
-- à la récolte, par manque de trésorerie. Savoir cultiver ne suffit pas —
-- savoir vendre est la moitié du métier.
-- -----------------------------------------------------------------------------
create table if not exists public.conseils_commercialisation (
  id             uuid primary key default gen_random_uuid(),
  speculation_id uuid not null references public.speculations (id) on delete cascade,
  titre          text not null,
  contenu        text not null,
  type_conseil   text not null check (type_conseil in
    ('calendrier', 'negociation', 'conditionnement', 'transport', 'evenement', 'prevente')),
  -- Mois où la stratégie s'applique, si elle est saisonnière.
  mois_concernes smallint[],
  ordre          integer not null default 1
);

create index if not exists idx_conseils_speculation
  on public.conseils_commercialisation (speculation_id, ordre);

-- -----------------------------------------------------------------------------
-- Saisonnalité des prix
--
-- La donnée qui change la décision : produire en contre-saison n'a de sens
-- que si l'on voit l'écart de prix entre l'abondance d'hivernage et la
-- pénurie de saison sèche.
-- -----------------------------------------------------------------------------
create table if not exists public.saisonnalite_prix (
  id             uuid primary key default gen_random_uuid(),
  speculation_id uuid not null references public.speculations (id) on delete cascade,
  mois           smallint not null check (mois between 1 and 12),
  prix_moyen     numeric(12, 2) check (prix_moyen is null or prix_moyen >= 0),
  unite          text not null default 'kg',
  tendance       text not null check (tendance in ('abondance', 'normal', 'penurie')),
  commentaire    text,
  unique (speculation_id, mois)
);

comment on table public.saisonnalite_prix is
  'Prix indicatifs par mois. Repères de décision, jamais une garantie : '
  'les cours réels dépendent de la pluviométrie et des importations.';

-- -----------------------------------------------------------------------------
-- RLS : référentiel public en lecture, écriture back-office seulement
-- -----------------------------------------------------------------------------
alter table public.intrants_etape              enable row level security;
alter table public.conseils_commercialisation  enable row level security;
alter table public.saisonnalite_prix           enable row level security;

create policy "intrants_etape_lecture_publique" on public.intrants_etape
  for select to authenticated using (true);

create policy "conseils_commercialisation_lecture_publique" on public.conseils_commercialisation
  for select to authenticated using (true);

create policy "saisonnalite_prix_lecture_publique" on public.saisonnalite_prix
  for select to authenticated using (true);

grant select on public.intrants_etape, public.conseils_commercialisation,
                public.saisonnalite_prix to authenticated;
