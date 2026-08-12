// =============================================================================
// Géométrie des parcelles : surface, centre, et conversion GeoJSON.
//
// -----------------------------------------------------------------------------
// L'ORDRE DES COORDONNÉES
//
// Deux conventions se croisent ici et elles sont inversées l'une par rapport à
// l'autre :
//
//   Leaflet   → [latitude, longitude]
//   GeoJSON   → [longitude, latitude]   (RFC 7946, § 3.1.1)
//
// La colonne `parcelles.geometrie` est du GeoJSON standard : c'est donc
// [longitude, latitude] qui part en base. L'inversion ne lève aucune erreur —
// une parcelle de Ouagadougou (12,37 N / 1,52 O) relue à l'envers se retrouve
// au large du Ghana, et personne ne s'en aperçoit avant le prochain affichage.
//
// D'où le choix de ne jamais manipuler de tableaux nus dans le reste de
// l'application : on travaille sur `Position { lat, lng }`, où le nom porte le
// sens, et la conversion vers les tableaux est confinée aux deux fonctions
// `versGeoJson` / `depuisGeoJson`. Un test de va-et-vient les surveille.
// -----------------------------------------------------------------------------
// =============================================================================

/** Un sommet du tracé. Les champs sont nommés : aucune ambiguïté d'ordre. */
export type Position = { lat: number; lng: number };

/** Polygone GeoJSON tel qu'il est stocké dans `parcelles.geometrie`. */
export type PolygoneGeoJson = {
  type: "Polygon";
  /** Anneaux fermés. Chaque position est [longitude, latitude]. */
  coordinates: number[][][];
};

/** Ouagadougou — centre par défaut quand le profil n'a pas de position. */
export const OUAGADOUGOU: Position = { lat: 12.3714, lng: -1.5197 };

/** Rayon équatorial WGS84, en mètres. */
const RAYON_TERRE = 6378137;

const RAD = Math.PI / 180;

/** Nombre minimal de sommets distincts pour qu'un tracé ait une surface. */
export const SOMMETS_MINIMUM = 3;

// -----------------------------------------------------------------------------
// Surface
// -----------------------------------------------------------------------------

/**
 * Surface sphérique du polygone, en mètres carrés.
 *
 * Formule des trapèzes sphériques : pour chaque côté, l'aire du fuseau compris
 * entre le côté et le méridien de référence, sommée avec son signe. C'est la
 * même que celle de Leaflet.draw et de l'API Google Maps, ce qui garantit que
 * la surface affichée pendant le tracé et celle recalculée ailleurs coïncident.
 *
 * Le résultat est pris en valeur absolue : le sens de parcours du producteur —
 * horaire ou antihoraire — ne change pas la taille de son champ.
 *
 * La Terre est traitée comme une sphère de rayon équatorial, pas comme un
 * ellipsoïde : à la latitude du Burkina cela surestime d'environ 0,7 %, soit
 * 70 m² sur un hectare. C'est très en dessous de l'erreur d'un tracé fait au
 * doigt sur un écran de téléphone — et c'est bien pour cela que le champ
 * superficie reste modifiable. Ce n'est pas une mesure cadastrale.
 */
export function surfaceM2(sommets: Position[]): number {
  if (sommets.length < SOMMETS_MINIMUM) return 0;

  let somme = 0;
  for (let i = 0; i < sommets.length; i += 1) {
    const p1 = sommets[i];
    const p2 = sommets[(i + 1) % sommets.length];
    somme +=
      (p2.lng - p1.lng) * RAD * (2 + Math.sin(p1.lat * RAD) + Math.sin(p2.lat * RAD));
  }

  return Math.abs((somme * RAYON_TERRE * RAYON_TERRE) / 2);
}

/**
 * Surface en hectares, arrondie au centième.
 *
 * Le centième n'est pas un choix d'affichage : `superficie_ha` est un
 * `numeric(8, 2)`. Arrondir ici évite qu'une valeur envoyée diffère de celle
 * relue, et 0,01 ha vaut 100 m² — bien en deçà de la précision d'un tracé fait
 * au doigt sur un téléphone.
 */
export function surfaceHa(sommets: Position[]): number {
  return Math.round((surfaceM2(sommets) / 10000) * 100) / 100;
}

// -----------------------------------------------------------------------------
// Centre
// -----------------------------------------------------------------------------

/** Arrondi à 7 décimales, la précision de `centre_lat` / `centre_lng`. */
function arrondir7(valeur: number): number {
  return Math.round(valeur * 1e7) / 1e7;
}

/**
 * Centroïde du polygone (formule du lacet), utilisé pour `centre_lat` et
 * `centre_lng`.
 *
 * À l'échelle d'une parcelle — quelques centaines de mètres — la courbure de la
 * Terre est négligeable et le calcul plan suffit largement.
 *
 * Repli sur la moyenne des sommets quand l'aire est nulle : trois points
 * alignés, ou deux points confondus, donneraient une division par zéro. Le
 * tracé est alors dégénéré, mais on veut quand même un point de recentrage
 * plutôt qu'un NaN qui remonterait jusqu'en base.
 */
export function centre(sommets: Position[]): Position | null {
  if (sommets.length === 0) return null;
  if (sommets.length < SOMMETS_MINIMUM) return moyenne(sommets);

  let aireDouble = 0;
  let lng = 0;
  let lat = 0;

  for (let i = 0; i < sommets.length; i += 1) {
    const p1 = sommets[i];
    const p2 = sommets[(i + 1) % sommets.length];
    const croix = p1.lng * p2.lat - p2.lng * p1.lat;
    aireDouble += croix;
    lng += (p1.lng + p2.lng) * croix;
    lat += (p1.lat + p2.lat) * croix;
  }

  if (aireDouble === 0) return moyenne(sommets);

  return {
    lat: arrondir7(lat / (3 * aireDouble)),
    lng: arrondir7(lng / (3 * aireDouble)),
  };
}

function moyenne(sommets: Position[]): Position {
  const total = sommets.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: arrondir7(total.lat / sommets.length),
    lng: arrondir7(total.lng / sommets.length),
  };
}

// -----------------------------------------------------------------------------
// GeoJSON
// -----------------------------------------------------------------------------

/** Aire signée du polygone en degrés carrés. Le signe donne le sens de parcours. */
function aireSignee(sommets: Position[]): number {
  let somme = 0;
  for (let i = 0; i < sommets.length; i += 1) {
    const p1 = sommets[i];
    const p2 = sommets[(i + 1) % sommets.length];
    somme += p1.lng * p2.lat - p2.lng * p1.lat;
  }
  return somme / 2;
}

/**
 * Construit le polygone GeoJSON à stocker.
 *
 * Trois règles de la RFC 7946 sont appliquées ici :
 *   - les positions sont [longitude, latitude] ;
 *   - l'anneau est fermé, le dernier point répète le premier ;
 *   - l'anneau extérieur tourne dans le sens antihoraire (§ 3.1.6).
 *
 * Le sens n'a pas d'incidence sur l'affichage, mais le normaliser rend
 * l'écriture déterministe : deux producteurs qui tracent la même parcelle en
 * sens opposés produisent le même GeoJSON.
 *
 * Renvoie null en deçà de trois sommets — il n'y a pas de polygone à écrire, et
 * `geometrie` accepte NULL.
 */
export function versGeoJson(sommets: Position[]): PolygoneGeoJson | null {
  if (sommets.length < SOMMETS_MINIMUM) return null;

  const ordonnes = aireSignee(sommets) < 0 ? [...sommets].reverse() : sommets;
  const anneau = ordonnes.map((p) => [p.lng, p.lat]);
  anneau.push([...anneau[0]]);

  return { type: "Polygon", coordinates: [anneau] };
}

/**
 * Relit un polygone stocké et le ramène en sommets nommés.
 *
 * Tolérante par construction : la colonne est un `jsonb` libre, une valeur
 * ancienne ou malformée ne doit pas faire planter l'écran de détail. Tout ce
 * qui n'est pas un anneau exploitable renvoie un tableau vide, que l'appelant
 * traite comme « parcelle sans tracé ».
 *
 * Le point de fermeture est retiré : le reste de l'application raisonne sur des
 * sommets distincts, et Leaflet referme le polygone tout seul.
 */
export function depuisGeoJson(valeur: unknown): Position[] {
  if (typeof valeur !== "object" || valeur === null) return [];

  const geo = valeur as Partial<PolygoneGeoJson>;
  if (geo.type !== "Polygon" || !Array.isArray(geo.coordinates)) return [];

  const anneau = geo.coordinates[0];
  if (!Array.isArray(anneau)) return [];

  const sommets: Position[] = [];
  for (const position of anneau) {
    if (!Array.isArray(position) || position.length < 2) continue;
    const lng = Number(position[0]);
    const lat = Number(position[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    sommets.push({ lat, lng });
  }

  // Anneau fermé : le dernier point répète le premier, on ne le garde pas.
  if (sommets.length > 1) {
    const premier = sommets[0];
    const dernier = sommets[sommets.length - 1];
    if (premier.lat === dernier.lat && premier.lng === dernier.lng) sommets.pop();
  }

  return sommets;
}

// -----------------------------------------------------------------------------
// Cadrage et affichage
// -----------------------------------------------------------------------------

/** Coin sud-ouest et coin nord-est englobant les sommets, pour cadrer la carte. */
export function cadre(
  sommets: Position[],
): { sudOuest: Position; nordEst: Position } | null {
  if (sommets.length === 0) return null;

  let latMin = sommets[0].lat;
  let latMax = sommets[0].lat;
  let lngMin = sommets[0].lng;
  let lngMax = sommets[0].lng;

  for (const p of sommets) {
    if (p.lat < latMin) latMin = p.lat;
    if (p.lat > latMax) latMax = p.lat;
    if (p.lng < lngMin) lngMin = p.lng;
    if (p.lng > lngMax) lngMax = p.lng;
  }

  return {
    sudOuest: { lat: latMin, lng: lngMin },
    nordEst: { lat: latMax, lng: lngMax },
  };
}

/**
 * Vérifie qu'une position est plausible.
 *
 * Un profil peut porter des coordonnées saisies de travers ; centrer la carte
 * sur une latitude de 200° laisserait un écran vide sans rien expliquer.
 */
export function positionValide(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): Position | null {
  const la = Number(lat);
  const lo = Number(lng);
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  // 0/0 est le « point nul » classique d'une colonne mal remplie : au large du
  // golfe de Guinée, donc jamais une vraie parcelle burkinabè.
  if (la === 0 && lo === 0) return null;
  return { lat: la, lng: lo };
}

/** Surface en hectares, virgule française, pour l'affichage. */
export function formaterSuperficie(hectares: number | string | null): string {
  const n = Number(hectares);
  if (hectares === null || hectares === "" || !Number.isFinite(n)) return "—";
  return `${(Math.round(n * 100) / 100).toString().replace(".", ",")} ha`;
}
