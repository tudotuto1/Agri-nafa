// =============================================================================
// Génère lib/leaflet-embarque.ts à partir de node_modules/leaflet/dist.
//
// -----------------------------------------------------------------------------
// POURQUOI EMBARQUER LEAFLET PLUTÔT QUE LE CHARGER D'UN CDN
//
// Le tracé d'une parcelle se fait au champ, souvent sans réseau. Un Leaflet
// servi par unpkg ne se chargerait pas plus que les tuiles : l'écran resterait
// blanc et le producteur ne pourrait rien dessiner du tout.
//
// En embarquant la bibliothèque dans le paquet de l'application, seul le fond
// de carte manque hors connexion. Le tracé, lui, reste possible — c'est
// exactement la dégradation qu'on veut.
//
// Les images de Leaflet (marker-icon.png, layers.png) ne sont PAS embarquées :
// elles ne servent qu'au marqueur par défaut et au contrôle de calques, dont
// aucun n'est utilisé. Les sommets sont des L.circleMarker, dessinés en SVG.
//
// Usage : node scripts/generer-leaflet.mjs
// À relancer après chaque montée de version de leaflet dans package.json.
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(racine, "node_modules", "leaflet", "dist");
const sortie = path.join(racine, "lib", "leaflet-embarque.ts");

const version = JSON.parse(
  fs.readFileSync(path.join(racine, "node_modules", "leaflet", "package.json"), "utf8"),
).version;

const js = fs.readFileSync(path.join(dist, "leaflet.js"), "utf8");
const css = fs.readFileSync(path.join(dist, "leaflet.css"), "utf8");

// Le contenu est injecté dans une page HTML, entre <script> et <style>. Une
// balise fermante cachée dans la source refermerait le bloc par surprise et
// laisserait du code s'exécuter hors contexte. Vérifié plutôt que supposé.
for (const [nom, contenu, balise] of [
  ["leaflet.js", js, "</script"],
  ["leaflet.css", css, "</style"],
]) {
  if (contenu.toLowerCase().includes(balise)) {
    throw new Error(`${nom} contient « ${balise} » : injection HTML impossible telle quelle.`);
  }
}

// JSON.stringify produit un littéral de chaîne JavaScript valide, échappement
// compris. Écrire les guillemets à la main serait une source de bugs muets.
const fichier = `// =============================================================================
// Leaflet ${version}, embarqué — FICHIER GÉNÉRÉ, NE PAS MODIFIER À LA MAIN.
//
// Produit par \`node scripts/generer-leaflet.mjs\` depuis
// node_modules/leaflet/dist. Voir ce script pour la raison de cet embarquement :
// en résumé, un CDN ne répond pas au champ, et le tracé doit rester possible
// hors connexion même quand le fond de carte manque.
//
// Leaflet est publié sous licence BSD 2-Clause, © Volodymyr Agafonkin et les
// contributeurs de CloudMade. https://leafletjs.com/
// =============================================================================

/* eslint-disable */

export const LEAFLET_VERSION = ${JSON.stringify(version)};

export const LEAFLET_CSS = ${JSON.stringify(css)};

export const LEAFLET_JS = ${JSON.stringify(js)};
`;

fs.writeFileSync(sortie, fichier);

console.log(`lib/leaflet-embarque.ts écrit — leaflet ${version}`);
console.log(`  css ${css.length} caractères`);
console.log(`  js  ${js.length} caractères`);
