// =============================================================================
// Carte de parcelle — Leaflet dans une WebView.
//
// -----------------------------------------------------------------------------
// POURQUOI UNE WEBVIEW
//
// Pas de module natif : l'application doit rester lançable dans Expo Go, sans
// build de développement. Leaflet est embarqué dans le paquet (voir
// lib/leaflet-embarque.ts) plutôt que chargé d'un CDN, parce qu'un CDN ne
// répond pas plus qu'un serveur de tuiles quand on est au champ.
//
// -----------------------------------------------------------------------------
// CE QUI TIENT LIEU DE SOURCE DE VÉRITÉ
//
// Les sommets vivent côté React Native. La WebView ne les stocke pas : elle
// affiche ce qu'on lui donne et signale les appuis. Un « annuler » ne demande
// donc aucune synchronisation — on retire un point du tableau et on redessine.
//
// Le pont ne transporte jamais de tableau [a, b] : on passe des objets
// { lat, lng }, que Leaflet accepte partout où il attend une position. Il n'y a
// ainsi aucun endroit où l'ordre des deux nombres puisse s'inverser en silence.
//
// -----------------------------------------------------------------------------
// HORS CONNEXION
//
// Les tuiles OpenStreetMap ne se chargeront pas. Le conteneur reste gris et un
// bandeau l'explique — jamais un écran blanc, qui se lit comme une panne. Le
// bandeau laisse passer les appuis (pointer-events: none) : le tracé continue
// de fonctionner, seul le fond manque.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { couleurs, rayons } from "@/constants/theme";
import { LEAFLET_CSS, LEAFLET_JS } from "@/lib/leaflet-embarque";
import type { Position } from "@/lib/geo";
import { cadre } from "@/lib/geo";

/** Zoom d'ouverture : une parcelle maraîchère tient dans le cadre. */
const ZOOM_DEFAUT = 16;

/** Précision de stockage : 7 décimales valent environ un centimètre. */
function arrondir7(valeur: number): number {
  return Math.round(valeur * 1e7) / 1e7;
}

type ProprietesCarte = {
  /** `dessin` : les appuis posent des sommets. `lecture` : carte consultable. */
  mode: "dessin" | "lecture";
  sommets: Position[];
  /** Centre à l'ouverture, quand il n'y a pas encore de tracé à cadrer. */
  centreDefaut: Position;
  onSommetAjoute?: (position: Position) => void;
  style?: object;
};

// =============================================================================
export function Carte({
  mode,
  sommets,
  centreDefaut,
  onSommetAjoute,
  style,
}: ProprietesCarte) {
  const webview = useRef<WebView>(null);
  const [prete, setPrete] = useState(false);

  // La page n'est construite qu'une fois. La reconstruire à chaque sommet
  // rechargerait la carte et ferait perdre le zoom et le recadrage du
  // producteur — insupportable au bout de trois points.
  const html = useMemo(
    () => construireHtml(centreDefaut, mode === "dessin"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Le cadrage initial attend le tracé : au premier rendu d'une parcelle
  // existante, les sommets ne sont pas encore chargés.
  const dejaCadre = useRef(false);

  useEffect(() => {
    if (!prete) return;

    const ordres = [`window.agrinafa.dessiner(${JSON.stringify(sommets)});`];

    if (!dejaCadre.current && sommets.length > 0) {
      const bornes = cadre(sommets);
      if (bornes) {
        ordres.push(`window.agrinafa.cadrer(${JSON.stringify(bornes)});`);
        dejaCadre.current = true;
      }
    }

    // Le `true;` final évite un avertissement de la WebView iOS, qui exige une
    // valeur de retour non-objet.
    webview.current?.injectJavaScript(`${ordres.join("")}true;`);
  }, [prete, sommets]);

  const surMessage = useCallback(
    (evenement: WebViewMessageEvent) => {
      let message: { type?: string; lat?: number; lng?: number };
      try {
        message = JSON.parse(evenement.nativeEvent.data);
      } catch {
        // Un message illisible ne doit pas faire tomber l'écran de tracé.
        return;
      }

      if (message.type === "pret") {
        setPrete(true);
        return;
      }

      if (message.type === "clic") {
        const { lat, lng } = message;
        if (typeof lat !== "number" || typeof lng !== "number") return;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onSommetAjoute?.({ lat: arrondir7(lat), lng: arrondir7(lng) });
      }
    },
    [onSommetAjoute],
  );

  return (
    <View style={[styles.cadre, style]}>
      <WebView
        ref={webview}
        source={{ html }}
        originWhitelist={["*"]}
        onMessage={surMessage}
        javaScriptEnabled
        // La page est entièrement locale et n'a rien à conserver entre deux
        // ouvertures : moins de surface, moins de stockage sur un téléphone
        // d'entrée de gamme.
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
        // Aucune navigation vers le réseau : la page est locale et le reste. Le
        // filtre porte sur http(s) plutôt que sur une liste blanche d'URL
        // internes — selon la plateforme, le document initial se présente en
        // about:blank ou en data:, et le refuser laisserait un écran vide.
        // Les tuiles ne passent pas par ici : ce sont des sous-ressources
        // <img>, que cette fonction n'intercepte pas.
        onShouldStartLoadWithRequest={(requete) => !/^https?:/i.test(requete.url)}
        // Le geste vertical appartient à la carte, pas à la page qui la porte.
        nestedScrollEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        // Le gris est déjà celui du conteneur Leaflet : aucun flash blanc entre
        // le montage de la WebView et l'initialisation de la carte.
        style={styles.web}
        containerStyle={styles.web}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// La page
// -----------------------------------------------------------------------------

/** PNG transparent de 1 pixel : une tuile absente ne montre pas d'image cassée. */
const TUILE_VIDE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const FOND_GRIS = "#DCE3D6";

function construireHtml(centre: Position, interactif: boolean): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>${LEAFLET_CSS}</style>
<style>
  html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; }
  #carte {
    height: 100%;
    width: 100%;
    /* Le fond du conteneur : ce qui reste visible quand les tuiles manquent. */
    background: ${FOND_GRIS};
  }
  .leaflet-container { background: ${FOND_GRIS}; font: 13px system-ui, sans-serif; }
  #avis {
    position: absolute;
    left: 12px; right: 12px; top: 12px;
    z-index: 900;
    padding: 12px 14px;
    border-radius: 12px;
    border: 2px solid ${couleurs.or};
    background: rgba(255, 255, 255, 0.95);
    color: ${couleurs.encre};
    font: 600 14px/1.4 system-ui, sans-serif;
    /* Décisif : le bandeau explique, il ne bloque pas. Un appui posé dessus
       traverse et atteint la carte, donc le tracé reste possible. */
    pointer-events: none;
  }
  #avis[hidden] { display: none; }
  .leaflet-control-attribution { font-size: 10px; }
</style>
</head>
<body>
<div id="carte"></div>
<div id="avis" hidden>${
    interactif
      ? "Fond de carte indisponible sans réseau. Le tracé fonctionne quand même&nbsp;: appuyez pour poser vos coins."
      : "Fond de carte indisponible sans réseau. Le contour de la parcelle reste affiché."
  }</div>

<script>${LEAFLET_JS}</script>
<script>
(function () {
  var INTERACTIF = ${interactif ? "true" : "false"};
  var CENTRE = ${JSON.stringify(centre)};

  function envoyer(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  // En lecture, la carte est figée. Elle vit dans une page qui défile : une
  // carte déplaçable capterait le geste vertical et le producteur ne pourrait
  // plus faire défiler la fiche de sa parcelle. En dessin, elle occupe tout
  // l'écran et peut prendre tous les gestes.
  var carte = L.map('carte', {
    attributionControl: true,
    zoomControl: INTERACTIF,
    dragging: INTERACTIF,
    touchZoom: INTERACTIF,
    scrollWheelZoom: INTERACTIF,
    boxZoom: INTERACTIF,
    keyboard: false,
    // Le double appui pour zoomer entrerait en conflit avec la pose rapide de
    // deux sommets voisins : on garde le pincement, qui n'est pas ambigu.
    doubleClickZoom: false,
  }).setView(CENTRE, ${ZOOM_DEFAUT});

  var chargees = 0;
  var enEchec = 0;
  var avis = document.getElementById('avis');
  var dernierEtat = null;

  var fond = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
    errorTileUrl: '${TUILE_VIDE}',
  }).addTo(carte);

  function majFond() {
    // « Indisponible » seulement si rien n'est passé : en réseau partiel,
    // quelques trous gris valent mieux qu'un message qui contredit l'écran.
    var indisponible = enEchec > 0 && chargees === 0;
    if (indisponible === dernierEtat) return;
    dernierEtat = indisponible;
    avis.hidden = !indisponible;
  }

  fond.on('tileload', function () { chargees += 1; majFond(); });
  fond.on('tileerror', function () { enEchec += 1; majFond(); });

  var couche = L.layerGroup().addTo(carte);

  window.agrinafa = {
    // Les sommets arrivent en objets { lat, lng } : Leaflet les accepte tels
    // quels, et aucun ordre de tableau n'est à deviner.
    dessiner: function (sommets) {
      couche.clearLayers();

      if (sommets.length >= 3) {
        L.polygon(sommets, {
          color: '${couleurs.vert}', weight: 3,
          fillColor: '${couleurs.vert}', fillOpacity: 0.25,
        }).addTo(couche);
      } else if (sommets.length === 2) {
        L.polyline(sommets, { color: '${couleurs.vert}', weight: 3 }).addTo(couche);
      }

      // circleMarker plutôt que marker : dessiné en SVG, donc sans le fichier
      // marker-icon.png que Leaflet irait chercher — et ne trouverait pas.
      for (var i = 0; i < sommets.length; i += 1) {
        L.circleMarker(sommets[i], {
          radius: 9,
          color: '#FFFFFF', weight: 3,
          fillColor: '${couleurs.rouge}', fillOpacity: 1,
        }).addTo(couche);
      }
    },

    cadrer: function (bornes) {
      carte.fitBounds([bornes.sudOuest, bornes.nordEst], {
        padding: [40, 40],
        // Sur une parcelle minuscule, fitBounds irait au zoom maximal et le
        // producteur perdrait tout repère alentour.
        maxZoom: 18,
      });
    },
  };

  if (INTERACTIF) {
    carte.on('click', function (evenement) {
      envoyer({ type: 'clic', lat: evenement.latlng.lat, lng: evenement.latlng.lng });
    });
  }

  envoyer({ type: 'pret' });
}());
</script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  cadre: {
    flex: 1,
    overflow: "hidden",
    borderRadius: rayons.md,
    backgroundColor: couleurs.ligne,
  },
  web: { flex: 1, backgroundColor: couleurs.ligne },
});
