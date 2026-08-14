// =============================================================================
// Schémas d'installation, dessinés en SVG.
//
// Pas de photos : le modèle de caméra n'est pas arrêté, et une photo d'un
// boîtier qui ne sera pas celui livré tromperait plus qu'elle n'aiderait. Un
// trait épais et une forme simple montrent le geste sans prétendre montrer
// l'objet.
//
// Dessinés en code plutôt qu'importés en fichiers .svg : aucun octet à
// télécharger, donc le manuel s'ouvre au champ sans réseau. Les traits sont
// volontairement gros — ces schémas se regardent en plein soleil, sur un écran
// souvent rayé.
//
// Toutes les figures partagent le même repère de 300 × 190 : les proportions
// restent cohérentes d'une étape à l'autre, et la mise à l'échelle se fait
// toute seule selon la largeur du téléphone.
// =============================================================================

import { View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Text as TexteSvg,
} from "react-native-svg";

import { couleurs } from "@/constants/theme";

const LARGEUR = 300;
const HAUTEUR = 190;

/** Épaisseur de trait principale. En dessous, le dessin disparaît au soleil. */
const TRAIT = 5;
const TRAIT_FIN = 3;

type Props = { children: React.ReactNode };

function Cadre({ children }: Props) {
  return (
    <View style={{ width: "100%", aspectRatio: LARGEUR / HAUTEUR }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}>
        {children}
      </Svg>
    </View>
  );
}

/** Légende courte à l'intérieur du schéma. */
function Legende({
  x,
  y,
  children,
  ancre = "middle",
  taille = 13,
  couleur = couleurs.attenue,
}: {
  x: number;
  y: number;
  children: string;
  ancre?: "start" | "middle" | "end";
  taille?: number;
  couleur?: string;
}) {
  return (
    <TexteSvg
      x={x}
      y={y}
      fill={couleur}
      fontSize={taille}
      fontWeight="700"
      textAnchor={ancre}
    >
      {children}
    </TexteSvg>
  );
}

/** Le boîtier, réutilisé dans plusieurs schémas : une forme reconnaissable. */
function Boitier({
  x,
  y,
  largeur = 78,
  hauteur = 54,
}: {
  x: number;
  y: number;
  largeur?: number;
  hauteur?: number;
}) {
  const cx = x + largeur * 0.36;
  const cy = y + hauteur / 2;
  return (
    <G>
      <Rect
        x={x}
        y={y}
        width={largeur}
        height={hauteur}
        rx={10}
        fill={couleurs.blanc}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />
      <Circle
        cx={cx}
        cy={cy}
        r={hauteur * 0.28}
        fill={couleurs.papier}
        stroke={couleurs.encre}
        strokeWidth={TRAIT_FIN}
      />
      <Circle cx={cx} cy={cy} r={hauteur * 0.12} fill={couleurs.encre} />
    </G>
  );
}

// =============================================================================
// 1 — Contenu du carton
// =============================================================================
export function SchemaContenu() {
  return (
    <Cadre>
      {/* Boîtier */}
      <Boitier x={16} y={26} />
      <Legende x={55} y={98}>
        Boîtier
      </Legende>

      {/* Panneau solaire, avec ses cellules */}
      <G>
        <Rect
          x={116}
          y={26}
          width={86}
          height={54}
          rx={4}
          fill={couleurs.papier}
          stroke={couleurs.encre}
          strokeWidth={TRAIT}
        />
        <Line x1={145} y1={26} x2={145} y2={80} stroke={couleurs.encre} strokeWidth={TRAIT_FIN} />
        <Line x1={174} y1={26} x2={174} y2={80} stroke={couleurs.encre} strokeWidth={TRAIT_FIN} />
        <Line x1={116} y1={53} x2={202} y2={53} stroke={couleurs.encre} strokeWidth={TRAIT_FIN} />
      </G>
      <Legende x={159} y={98}>
        Panneau
      </Legende>

      {/* Mât / fixation */}
      <G>
        <Rect
          x={244}
          y={22}
          width={16}
          height={62}
          rx={4}
          fill={couleurs.blanc}
          stroke={couleurs.encre}
          strokeWidth={TRAIT}
        />
        <Rect
          x={232}
          y={84}
          width={40}
          height={12}
          rx={3}
          fill={couleurs.ligne}
          stroke={couleurs.encre}
          strokeWidth={TRAIT_FIN}
        />
      </G>
      <Legende x={252} y={112}>
        Mât
      </Legende>

      {/* Câble */}
      <Path
        d="M 24 140 C 60 118, 92 168, 128 142"
        fill="none"
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
        strokeLinecap="round"
      />
      <Legende x={76} y={176}>
        Câble
      </Legende>

      {/* Visserie */}
      <G>
        {[172, 202, 232, 262].map((cx) => (
          <G key={cx}>
            <Circle
              cx={cx}
              cy={142}
              r={11}
              fill={couleurs.blanc}
              stroke={couleurs.encre}
              strokeWidth={TRAIT_FIN}
            />
            <Line
              x1={cx - 5}
              y1={142}
              x2={cx + 5}
              y2={142}
              stroke={couleurs.encre}
              strokeWidth={TRAIT_FIN}
            />
          </G>
        ))}
      </G>
      <Legende x={217} y={176}>
        Visserie
      </Legende>
    </Cadre>
  );
}

// =============================================================================
// 2 — Carte SIM
// =============================================================================
export function SchemaSim() {
  return (
    <Cadre>
      {/* Boîtier vu de profil, capot ouvert */}
      <Rect
        x={26}
        y={54}
        width={150}
        height={78}
        rx={10}
        fill={couleurs.blanc}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />
      {/* Le logement */}
      <Rect
        x={112}
        y={76}
        width={56}
        height={34}
        rx={3}
        fill={couleurs.papier}
        stroke={couleurs.encre}
        strokeWidth={TRAIT_FIN}
      />
      {/* Capot relevé, avec son joint */}
      <Polyline
        points="26,54 26,26 96,26"
        fill="none"
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
        strokeLinecap="round"
      />
      <Line
        x1={30}
        y1={34}
        x2={92}
        y2={34}
        stroke={couleurs.vert}
        strokeWidth={TRAIT_FIN}
        strokeDasharray="6 5"
      />
      <Legende x={60} y={20} taille={12} couleur={couleurs.vertFonce}>
        joint étanche
      </Legende>

      {/* La SIM : le coin biseauté est en bas à gauche, côté insertion */}
      <G>
        <Polygon
          points="212,76 268,76 268,110 220,110 212,100"
          fill={couleurs.or}
          stroke={couleurs.encre}
          strokeWidth={TRAIT}
          strokeLinejoin="round"
        />
        {/* La puce dorée */}
        <Rect
          x={232}
          y={84}
          width={24}
          height={18}
          rx={3}
          fill={couleurs.papier}
          stroke={couleurs.encre}
          strokeWidth={TRAIT_FIN}
        />
      </G>
      <Legende x={240} y={132} taille={12}>
        coin biseauté
      </Legende>
      <Line
        x1={214}
        y1={104}
        x2={222}
        y2={118}
        stroke={couleurs.attenue}
        strokeWidth={2}
      />

      {/* Sens d'insertion */}
      <G>
        <Line
          x1={206}
          y1={62}
          x2={176}
          y2={62}
          stroke={couleurs.vert}
          strokeWidth={TRAIT}
          strokeLinecap="round"
        />
        <Polygon points="168,62 182,55 182,69" fill={couleurs.vert} />
      </G>
      <Legende x={200} y={166} ancre="middle" taille={12} couleur={couleurs.vertFonce}>
        puce vers le bas
      </Legende>
    </Cadre>
  );
}

// =============================================================================
// 3 — Emplacement
// =============================================================================
export function SchemaEmplacement() {
  const solY = 156;
  return (
    <Cadre>
      {/* Le sol et les rangs de culture */}
      <Line
        x1={0}
        y1={solY}
        x2={LARGEUR}
        y2={solY}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />
      {[150, 182, 214, 246, 278].map((x) => (
        <G key={x}>
          <Line
            x1={x}
            y1={solY}
            x2={x}
            y2={solY - 14}
            stroke={couleurs.vert}
            strokeWidth={TRAIT_FIN}
          />
          <Circle cx={x} cy={solY - 18} r={5} fill={couleurs.vert} />
        </G>
      ))}

      {/* Le cône de vision, posé avant le mât pour rester en arrière-plan */}
      <Polygon
        points="70,44 292,132 292,156 70,156"
        fill={couleurs.or}
        fillOpacity={0.28}
        stroke={couleurs.or}
        strokeWidth={TRAIT_FIN}
      />

      {/* Le mât */}
      <Rect
        x={62}
        y={40}
        width={14}
        height={116}
        fill={couleurs.blanc}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />
      <Boitier x={54} y={16} largeur={44} hauteur={30} />

      {/* La cote de hauteur */}
      <Line
        x1={38}
        y1={40}
        x2={38}
        y2={solY}
        stroke={couleurs.rouge}
        strokeWidth={TRAIT_FIN}
      />
      <Line x1={30} y1={40} x2={46} y2={40} stroke={couleurs.rouge} strokeWidth={TRAIT_FIN} />
      <Line x1={30} y1={solY} x2={46} y2={solY} stroke={couleurs.rouge} strokeWidth={TRAIT_FIN} />
      {/* Fond plein derrière la cote : elle croise sa propre ligne de rappel. */}
      <Rect x={6} y={90} width={64} height={20} rx={4} fill={couleurs.papier} />
      <Legende x={38} y={105} ancre="middle" taille={13} couleur={couleurs.rouge}>
        2,5 – 3 m
      </Legende>

      <Legende x={210} y={182} taille={12}>
        vue dégagée sur les rangs
      </Legende>
    </Cadre>
  );
}

// =============================================================================
// 4 — Orientation du panneau
// =============================================================================
export function SchemaPanneau() {
  const solY = 150;
  return (
    <Cadre>
      {/* La course du soleil, d'est en ouest */}
      <Path
        d="M 34 138 A 116 116 0 0 1 266 138"
        fill="none"
        stroke={couleurs.or}
        strokeWidth={TRAIT_FIN}
        strokeDasharray="8 7"
      />
      <Circle cx={150} cy={30} r={16} fill={couleurs.or} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const r = (angle * Math.PI) / 180;
        return (
          <Line
            key={angle}
            x1={150 + Math.cos(r) * 22}
            y1={30 + Math.sin(r) * 22}
            x2={150 + Math.cos(r) * 30}
            y2={30 + Math.sin(r) * 30}
            stroke={couleurs.or}
            strokeWidth={TRAIT_FIN}
            strokeLinecap="round"
          />
        );
      })}

      {/* Le sol */}
      <Line
        x1={0}
        y1={solY}
        x2={LARGEUR}
        y2={solY}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />

      {/* Le panneau, de profil, incliné d'environ 15° face au sud */}
      <G>
        <Line
          x1={104}
          y1={128}
          x2={196}
          y2={104}
          stroke={couleurs.encre}
          strokeWidth={TRAIT + 3}
          strokeLinecap="round"
        />
        {/* Le pied */}
        <Line
          x1={186}
          y1={106}
          x2={186}
          y2={solY}
          stroke={couleurs.encre}
          strokeWidth={TRAIT_FIN}
        />
        <Line
          x1={112}
          y1={126}
          x2={112}
          y2={solY}
          stroke={couleurs.encre}
          strokeWidth={TRAIT_FIN}
        />
      </G>

      {/* L'angle, contre l'horizontale */}
      <Line
        x1={104}
        y1={128}
        x2={200}
        y2={128}
        stroke={couleurs.attenue}
        strokeWidth={2}
        strokeDasharray="5 4"
      />
      <Path
        d="M 138 128 A 34 34 0 0 0 136 120"
        fill="none"
        stroke={couleurs.rouge}
        strokeWidth={TRAIT_FIN}
      />
      <Legende x={62} y={140} taille={13} couleur={couleurs.rouge}>
        environ 15°
      </Legende>

      {/* Les points cardinaux : la face du panneau regarde le sud */}
      <Legende x={222} y={92} taille={16} couleur={couleurs.vertFonce}>
        SUD
      </Legende>
      <Legende x={40} y={92} taille={14}>
        nord
      </Legende>
      <Legende x={150} y={180} taille={12}>
        la face vitrée regarde le sud
      </Legende>
    </Cadre>
  );
}

// =============================================================================
// 5 — Raccordement
// =============================================================================
export function SchemaConnecteur() {
  return (
    <Cadre>
      {/* Le câble venant du panneau, sous gaine */}
      <G>
        <Line
          x1={10}
          y1={92}
          x2={104}
          y2={92}
          stroke={couleurs.encre}
          strokeWidth={TRAIT + 9}
          strokeLinecap="round"
        />
        <Line
          x1={10}
          y1={92}
          x2={104}
          y2={92}
          stroke={couleurs.papier}
          strokeWidth={TRAIT + 3}
          strokeLinecap="round"
        />
        {/* Les nervures de la gaine */}
        {[24, 40, 56, 72, 88].map((x) => (
          <Line
            key={x}
            x1={x}
            y1={82}
            x2={x}
            y2={102}
            stroke={couleurs.encre}
            strokeWidth={2}
          />
        ))}
      </G>
      <Legende x={70} y={62} taille={11}>
        gaine anti-rongeurs
      </Legende>

      {/* La bague de serrage */}
      <Rect
        x={104}
        y={72}
        width={34}
        height={40}
        rx={5}
        fill={couleurs.or}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />
      {[112, 121, 130].map((x) => (
        <Line
          key={x}
          x1={x}
          y1={76}
          x2={x}
          y2={108}
          stroke={couleurs.encre}
          strokeWidth={2}
        />
      ))}
      <Legende x={121} y={134} taille={12} couleur={couleurs.rouge}>
        serrer à la main
      </Legende>

      {/* La prise du boîtier */}
      <Rect
        x={138}
        y={78}
        width={26}
        height={28}
        fill={couleurs.ligne}
        stroke={couleurs.encre}
        strokeWidth={TRAIT_FIN}
      />
      <Boitier x={164} y={62} largeur={110} hauteur={60} />

      {/* Le sens du branchement */}
      <G>
        <Line
          x1={70}
          y1={34}
          x2={186}
          y2={34}
          stroke={couleurs.vert}
          strokeWidth={TRAIT}
          strokeLinecap="round"
        />
        <Polygon points="196,34 182,27 182,41" fill={couleurs.vert} />
      </G>
      <Legende x={128} y={22} taille={12} couleur={couleurs.vertFonce}>
        du panneau vers le boîtier
      </Legende>

      <Legende x={222} y={148} taille={12}>
        connecteur vers le bas
      </Legende>
    </Cadre>
  );
}

// =============================================================================
// 6 — Les trois états du voyant
// =============================================================================
export function SchemaVoyants() {
  const etats: {
    x: number;
    couleur: string;
    halo: boolean;
    titre: string;
    sens: string;
  }[] = [
    { x: 8, couleur: couleurs.rouge, halo: false, titre: "Rouge fixe", sens: "démarrage" },
    {
      x: 108,
      couleur: couleurs.vert,
      halo: true,
      titre: "Vert clignotant",
      sens: "cherche le réseau",
    },
    { x: 208, couleur: couleurs.vert, halo: false, titre: "Vert fixe", sens: "en service" },
  ];

  return (
    <Cadre>
      {etats.map((etat) => (
        <G key={etat.x}>
          <Rect
            x={etat.x}
            y={24}
            width={84}
            height={62}
            rx={10}
            fill={couleurs.blanc}
            stroke={couleurs.encre}
            strokeWidth={TRAIT}
          />
          {/* L'objectif, pour qu'on reconnaisse le boîtier */}
          <Circle
            cx={etat.x + 28}
            cy={55}
            r={15}
            fill={couleurs.papier}
            stroke={couleurs.encre}
            strokeWidth={TRAIT_FIN}
          />
          <Circle cx={etat.x + 28} cy={55} r={6} fill={couleurs.encre} />

          {/* Le voyant. Le clignotement se lit à son halo pointillé : une
              image fixe ne peut pas clignoter, elle doit le dire. */}
          {etat.halo ? (
            <Circle
              cx={etat.x + 62}
              cy={55}
              r={17}
              fill="none"
              stroke={etat.couleur}
              strokeWidth={TRAIT_FIN}
              strokeDasharray="5 5"
            />
          ) : null}
          <Circle
            cx={etat.x + 62}
            cy={55}
            r={9}
            fill={etat.couleur}
            stroke={couleurs.encre}
            strokeWidth={2}
          />

          <Legende x={etat.x + 42} y={112} taille={11} couleur={couleurs.encre}>
            {etat.titre}
          </Legende>
          <Legende x={etat.x + 42} y={132} taille={11}>
            {etat.sens}
          </Legende>
        </G>
      ))}

      {/* La progression attendue */}
      <G>
        <Line
          x1={20}
          y1={166}
          x2={266}
          y2={166}
          stroke={couleurs.attenue}
          strokeWidth={TRAIT_FIN}
        />
        <Polygon points="276,166 262,159 262,173" fill={couleurs.attenue} />
      </G>
      <Legende x={140} y={186} taille={12}>
        quelques minutes
      </Legende>
    </Cadre>
  );
}

// =============================================================================
// 7 — Relever le numéro de série
// =============================================================================
export function SchemaNumeroSerie() {
  return (
    <Cadre>
      {/* Le boîtier retourné, dessous visible */}
      <Rect
        x={16}
        y={40}
        width={140}
        height={94}
        rx={12}
        fill={couleurs.blanc}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />
      {/* L'étiquette collée sous le boîtier */}
      <Rect
        x={34}
        y={62}
        width={104}
        height={48}
        rx={4}
        fill={couleurs.papier}
        stroke={couleurs.encre}
        strokeWidth={TRAIT_FIN}
      />
      {/* Le code-barres */}
      {[42, 47, 55, 60, 68, 76, 81, 89, 97, 102, 110, 118, 123, 128].map((x, i) => (
        <Line
          key={x}
          x1={x}
          y1={70}
          x2={x}
          y2={88}
          stroke={couleurs.encre}
          strokeWidth={i % 3 === 0 ? 4 : 2}
        />
      ))}
      <Legende x={86} y={104} taille={13} couleur={couleurs.encre}>
        AGN-000000
      </Legende>
      <Legende x={86} y={154} taille={12}>
        sous le boîtier
      </Legende>

      {/* Le report vers le téléphone */}
      <G>
        <Line
          x1={166}
          y1={86}
          x2={202}
          y2={86}
          stroke={couleurs.vert}
          strokeWidth={TRAIT}
          strokeLinecap="round"
        />
        <Polygon points="212,86 198,79 198,93" fill={couleurs.vert} />
      </G>

      {/* Le téléphone */}
      <Rect
        x={220}
        y={26}
        width={66}
        height={122}
        rx={12}
        fill={couleurs.blanc}
        stroke={couleurs.encre}
        strokeWidth={TRAIT}
      />
      <Rect
        x={232}
        y={56}
        width={42}
        height={20}
        rx={3}
        fill={couleurs.papier}
        stroke={couleurs.encre}
        strokeWidth={2}
      />
      <Rect
        x={232}
        y={86}
        width={42}
        height={20}
        rx={3}
        fill={couleurs.vert}
        stroke={couleurs.encre}
        strokeWidth={2}
      />
      <Line x1={240} y1={40} x2={266} y2={40} stroke={couleurs.ligne} strokeWidth={4} />
      <Legende x={253} y={168} taille={12}>
        AgriNafa
      </Legende>
    </Cadre>
  );
}
