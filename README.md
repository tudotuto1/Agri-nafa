# AgriNafa

Application mobile de gestion d'exploitation agricole pour le Burkina Faso.
Saisie des dépenses à la voix, suivi de rentabilité par cycle, calendrier
sanitaire des bandes, prix des marchés.

Conçue pour la réalité du terrain : téléphones d'entrée de gamme, connexion
intermittente, utilisateurs qui ne lisent pas toujours. D'où les gros boutons,
les forts contrastes, les pictogrammes — et la note vocale comme mode de saisie
principal.

## Pile technique

| Couche | Choix |
| --- | --- |
| Application | Expo SDK 52, Expo Router 4, React Native 0.76 |
| Base de données | PostgreSQL 17 (Supabase), RLS sur toutes les tables |
| Authentification | OTP par SMS, indicatif +226 |
| Saisie vocale | Edge Function Deno → Whisper → structuration JSON stricte |

## Mise en route

```bash
npm install
cp .env.example .env      # renseigner l'URL et la clé publiable Supabase
npx expo start
```

Le `.env` n'est jamais commité. Les deux valeurs qu'il contient sont publiques
par conception : la clé publiable ne donne accès qu'à ce que la RLS autorise.
La clé OpenAI, elle, n'apparaît nulle part dans l'application — elle vit
uniquement dans les secrets Supabase, lue côté serveur par l'Edge Function.

## Base de données

Le dossier `supabase/migrations/` contient les 11 migrations telles qu'elles
sont appliquées en production : 25 tables, 7 vues analytiques, 72 policies RLS,
10 fonctions, 63 index, et le référentiel burkinabè (10 spéculations,
7 marchés, 11 protocoles sanitaires, itinéraire technique de l'aubergine
Kalenda en 9 étapes).

Les deux dernières migrations enrichissent les guides techniques : doses
d'intrants, conseils de commercialisation et saisonnalité des prix. Tout ce
qui se dose y est exprimé **à l'hectare**, et la fonction `dose_pour_surface`
le ramène à la parcelle réelle. Beaucoup d'exploitations font moins d'un
demi-hectare : une consigne libellée en sacs pour un hectare ferait sur-doser
ceux qui cultivent moins, et un mauvais dosage d'engrais coûte une récolte.

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy saisie-vocale
supabase secrets set OPENAI_API_KEY=sk-...
```

## Invariants

Ces décisions structurent le reste du code. Les contourner casse quelque chose
en aval.

**Le profil n'est jamais créé par l'application.** Un trigger sur `auth.users`
s'en charge en base. L'app fait `select` et `update`, jamais `insert` sur
`profils` — deux sources de vérité finiraient par diverger.

**`onboarding_termine` est la seule référence de progression.** Aucun état
local : si le réseau coupe entre le code SMS et la saisie du profil,
l'aiguilleur reprend à l'étape suivante grâce à ce champ en base.

**Jamais la `service_role` côté client.** Toujours la clé publiable, pour que
la RLS s'applique. L'Edge Function elle-même travaille avec le JWT de
l'appelant.

**Les dépenses dictées entrent avec `validee = false`.** Elles restent hors de
`vue_rentabilite_cycles` tant que le producteur n'a pas confirmé. C'est ce qui
rend la comptabilité opposable devant un prêteur.

**Le référentiel vient de la base.** La liste des spéculations se lit dans la
table `speculations` : ajouter une culture ne doit pas imposer une nouvelle
version de l'app à des producteurs qui mettent à jour rarement.

**`prix_unitaire_moyen` ne s'écrit jamais directement.** Un trigger recalcule
le coût unitaire moyen pondéré depuis `mouvements_stock`.

## Compilation de l'APK

Le workflow `.github/workflows/apk.yml` se déclenche manuellement
(`workflow_dispatch`) ou sur un tag `v*`, qui publie en plus une Release.

Secrets attendus : `ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`.

## Reste à faire

- Accueil branché sur `vue_tableau_bord`
- Enregistrement audio → bucket `notes-vocales` au chemin
  `{user_id}/{uuid}.m4a` → appel de la fonction `saisie-vocale`
- Écran de validation des dépenses dictées
- Couche hors-ligne : file d'attente locale, synchronisation sur `updated_at`,
  suppressions logiques via `deleted_at`
- Enregistrements des guides parlés (bucket `guides-audio`) pour les boutons
  haut-parleur du choix de langue
