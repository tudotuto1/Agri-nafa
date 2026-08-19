#!/usr/bin/env python3
# =============================================================================
# Illustrations des spéculations : un SVG et son rendu PNG 256×256 par code.
#
# -----------------------------------------------------------------------------
# PRINCIPE VISUEL
#
# Un disque plein, une silhouette pleine par-dessus, et des détails CREUSÉS
# dans la couleur du disque. Rien n'est dessiné en contour : un trait creux
# disparaît sous 64 px, et ces vignettes sont vues à 48.
#
# La couleur du disque encode la filière. C'est elle qui porte l'information
# la plus rapide : avant même de reconnaître l'animal, on doit savoir qu'on
# regarde de la volaille et non du maraîchage.
#
# -----------------------------------------------------------------------------
# POURQUOI LA FORME DE L'OR EST SOMBRE
#
# Blanc sur #FCD116 donne un contraste de 1,47 — illisible, et pas seulement
# « moins joli ». L'encre #122B1B y monte à 10,29, le meilleur des quatre
# couples. La céréale ne s'uniformise donc pas avec les autres : c'est le
# fond qui commande la couleur de la forme, jamais la cohérence de la série.
#
# -----------------------------------------------------------------------------
# CONTRAINTES DE DESSIN, APPRISES À L'ESSAI
#
# Chaque espèce doit rester reconnaissable à 48 px, seule et parmi ses
# voisines. Les pièges rencontrés sont notés au-dessus de chaque dessin :
# l'aubergine qui passe pour une tomate, la chèvre pour un lapin, le bœuf
# pour un cochon. Un dessin « joli » qui se confond avec son voisin ne vaut
# rien — la vignette sert à distinguer, pas à décorer.
# =============================================================================

import argparse
from pathlib import Path

import cairosvg

# -----------------------------------------------------------------------------
# Référentiel
# -----------------------------------------------------------------------------
# disque, forme. Les codes sont ceux de public.speculations.
FILIERES = {
    "maraichage": ("#007134", "#FFFFFF"),
    "cereale": ("#FCD116", "#122B1B"),
    "avicole": ("#B50D22", "#FFFFFF"),
    "elevage": ("#0B2416", "#FFFFFF"),
}

ESPECES = {
    "aubergine_kalenda": "maraichage",
    "tomate": "maraichage",
    "oignon": "maraichage",
    "chou": "maraichage",
    "mais": "cereale",
    "niebe": "cereale",
    "poulet_chair": "avicole",
    "poulet_goliath": "avicole",
    "pondeuse": "avicole",
    "ovin_engraissement": "elevage",
    "caprin_embouche": "elevage",
    "bovin_embouche": "elevage",
    "tilapia": "elevage",
}

COTE = 168          # viewBox
RAYON = 84          # disque plein, centré, à fond perdu


# =============================================================================
# Dessins. Chaque fonction reçoit (f) la couleur de forme et (d) celle du
# disque, et rend le contenu placé par-dessus le disque.
# =============================================================================

def _feston(cx, cy, r, bosses, ampleur, depart=0.0):
    """Contour rond ondulé : le bord dentelé d'un empilement de feuilles.

    Dessiné plutôt qu'écrit à la main — douze arcs cohérents ne se règlent pas
    au jugé, et la première version du chou a échoué quatre fois faute d'un
    contour qui dise « feuillu » avant même qu'on lise les détails.
    """
    import math

    pts = []
    n = bosses * 2
    for i in range(n):
        angle = depart + 2 * math.pi * i / n
        rayon = r + (ampleur if i % 2 == 0 else -ampleur)
        pts.append((cx + rayon * math.cos(angle), cy + rayon * math.sin(angle)))

    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(1, n + 1):
        x, y = pts[i % n]
        px, py = pts[i - 1]
        mx, my = (px + x) / 2, (py + y) / 2
        d += f" Q{px:.1f},{py:.1f} {mx:.1f},{my:.1f}"
    return d + " Z"


# L'aubergine doit être ALLONGÉE ET PENCHÉE. Ronde et droite, elle passe pour
# une tomate — c'est arrivé au premier jet.
def aubergine(f, d):
    return f'''
  <g transform="translate(86,90) rotate(20)">
    <ellipse cx="0" cy="8" rx="23" ry="43" fill="{f}"/>
    <path d="M-21,-33 Q-34,-49 -6,-41 Z" fill="{f}"/>
    <path d="M21,-33 Q34,-49 6,-41 Z" fill="{f}"/>
    <path d="M-4,-38 L-4,-64 Q0,-70 4,-64 L4,-38 Z" fill="{f}"/>
    <path d="M-23,-27 Q0,-14 23,-27" stroke="{d}" stroke-width="6"
          fill="none" stroke-linecap="round"/>
    <ellipse cx="-9" cy="10" rx="4.5" ry="16" fill="{d}"/>
  </g>'''


# Ronde et large, calice étalé. Les nervures creusées lui faisaient un couvercle
# de marmite au premier jet : il ne reste qu'un reflet, décalé, jamais centré.
def tomate(f, d):
    return f'''
  <circle cx="84" cy="98" r="41" fill="{f}"/>
  <path d="M84,48 L91,62 L107,57 L100,72 L84,68 L68,72 L61,57 L77,62 Z" fill="{f}"/>
  <path d="M84,52 L84,44" stroke="{f}" stroke-width="7" stroke-linecap="round"/>
  <path d="M72,60 Q84,70 96,60" stroke="{d}" stroke-width="5"
        fill="none" stroke-linecap="round"/>
  <path d="M62,88 Q68,74 82,70" stroke="{d}" stroke-width="6"
        fill="none" stroke-linecap="round"/>
'''


# Bulbe large, épaules hautes, pointe en bas. Les nervures ne courent plus sur
# toute la hauteur — pleine longueur, elles en faisaient une cabosse de cacao.
def oignon(f, d):
    return f'''
  <path d="M84,140 C54,124 42,104 42,86 C42,64 61,50 84,50
           C107,50 126,64 126,86 C126,104 114,124 84,140 Z" fill="{f}"/>
  <path d="M82,52 Q72,34 56,26 Q74,32 84,48 Z" fill="{f}"/>
  <path d="M86,52 Q96,32 114,24 Q98,32 88,48 Z" fill="{f}"/>
  <path d="M84,50 L84,26" stroke="{f}" stroke-width="8" stroke-linecap="round"/>
  <path d="M66,74 Q60,96 68,116" stroke="{d}" stroke-width="6"
        fill="none" stroke-linecap="round"/>
  <path d="M102,74 Q108,96 100,116" stroke="{d}" stroke-width="6"
        fill="none" stroke-linecap="round"/>
'''


# Une pomme ronde, deux feuilles qui s'ouvrent vers l'extérieur en haut des
# flancs. Pas de socle en dessous : ça faisait une cloche sur soucoupe.
#
# Le chou a demandé sept essais, chacun raté autrement : feuilles étroites et
# dressées → un chat ; décor creusé symétrique → un visage ; spirale décentrée
# → un escargot ; croissants épousant le contour → une lanterne ; feuilles
# fines et lignes parallèles → un papillon ; volute et bord festonné → encore
# un escargot ; feuilles horizontales → une capsule à ailerons.
#
# Ce qui marche vient de l'oignon, qui se lisait bien du premier coup : deux
# arcs creusés du haut vers le bas, qui découpent la pomme en trois lobes de
# feuilles enroulées. Aucun motif fermé, donc aucun visage ; aucune spirale,
# donc aucun escargot. Ce qui distingue alors le chou de l'oignon, c'est le
# bas ROND — l'oignon pointe — et les deux feuilles larges des flancs.
def chou(f, d):
    return f'''
  <path d="M66,88 C52,74 30,56 17,52 C11,70 32,96 64,102 Z" fill="{f}"/>
  <path d="M104,86 C119,70 142,50 155,47 C160,66 138,92 106,99 Z" fill="{f}"/>
  <path d="M23,58 Q44,78 62,96" stroke="{d}" stroke-width="4.5"
        fill="none" stroke-linecap="round"/>
  <path d="M148,54 Q127,74 108,93" stroke="{d}" stroke-width="4.5"
        fill="none" stroke-linecap="round"/>
  <circle cx="84" cy="101" r="38" fill="{f}"/>
  <path d="M69,68 Q57,102 71,135" stroke="{d}" stroke-width="6"
        fill="none" stroke-linecap="round"/>
  <path d="M99,68 Q111,102 97,135" stroke="{d}" stroke-width="6"
        fill="none" stroke-linecap="round"/>
'''


# Épi : grains creusés en damier, spathes ouvertes vers le bas.
#
# Le damier est volontairement lâche. Serré, il tenait à 256 px mais tournait
# à la texture grise à 48 : un trait de 4,5 dans un cadre de 168 n'y fait plus
# que 1,3 pixel. Six lignes épaisses valent mieux que huit fines.
def mais(f, d):
    return f'''
  <path d="M52,70 Q40,112 62,140 Q66,110 72,92 Z" fill="{f}"/>
  <path d="M116,70 Q128,112 106,140 Q102,110 96,92 Z" fill="{f}"/>
  <path d="M84,26 C102,40 108,62 108,86 C108,116 98,138 84,144
           C70,138 60,116 60,86 C60,62 66,40 84,26 Z" fill="{f}"/>
  <path d="M65,64 H103 M63,88 H105 M63,112 H105 M70,132 H98"
        stroke="{d}" stroke-width="6" stroke-linecap="round"/>
  <path d="M76,44 V136 M92,44 V136"
        stroke="{d}" stroke-width="6" stroke-linecap="round"/>'''


# Gousse renflée, graines bien à l'intérieur. Fine et diagonale, avec des
# graines mordant le bord, elle faisait une chenille au premier jet.
def niebe(f, d):
    return f'''
  <path d="M36,60 Q30,46 44,42 Q58,48 62,62 Z" fill="{f}"/>
  <path d="M44,54 C68,58 96,72 118,92 C132,105 138,120 130,128
           C120,136 104,128 90,114 C70,94 52,76 40,68
           C32,62 36,52 44,54 Z" fill="{f}"/>
  <circle cx="63" cy="70" r="8" fill="{d}"/>
  <circle cx="82" cy="84" r="8" fill="{d}"/>
  <circle cx="100" cy="99" r="8" fill="{d}"/>
  <circle cx="117" cy="114" r="7.5" fill="{d}"/>
'''


def _patte(x, y, h, f):
    return f'<path d="M{x},{y} V{y+h}" stroke="{f}" stroke-width="7" stroke-linecap="round"/>'


# Poulet de chair : trapu, bas sur pattes, poitrine lourde. C'est la masse du
# corps qui le distingue du Goliath, pas les détails.
def poulet_chair(f, d):
    return f'''
  {_patte(74, 118, 18, f)}
  {_patte(94, 118, 18, f)}
  <path d="M62,72 L54,58 L68,62 L66,48 L78,58 Z" fill="{f}"/>
  <ellipse cx="88" cy="98" rx="42" ry="32" fill="{f}"/>
  <circle cx="62" cy="76" r="19" fill="{f}"/>
  <path d="M44,76 L26,84 L44,90 Z" fill="{f}"/>
  <path d="M126,84 Q146,64 148,84 Q146,102 126,100 Z" fill="{f}"/>
  <circle cx="56" cy="72" r="4.5" fill="{d}"/>
  <path d="M78,96 Q98,86 116,100 Q98,110 78,96 Z" fill="{d}"/>
  <path d="M52,90 Q58,98 66,96" stroke="{d}" stroke-width="4"
        fill="none" stroke-linecap="round"/>'''


# Goliath : haut sur pattes, port dressé, queue haute et crête forte. Posé à
# côté du poulet de chair, l'écart doit se voir sans lire l'étiquette.
def poulet_goliath(f, d):
    return f'''
  {_patte(80, 124, 22, f)}
  {_patte(98, 124, 22, f)}
  <path d="M66,54 L56,36 L72,42 L70,26 L84,40 L88,28 L90,46 Z" fill="{f}"/>
  <ellipse cx="94" cy="100" rx="34" ry="30" fill="{f}"/>
  <path d="M74,84 Q66,66 70,58 L86,62 Q90,78 86,92 Z" fill="{f}"/>
  <circle cx="72" cy="58" r="17" fill="{f}"/>
  <path d="M56,58 L38,64 L56,71 Z" fill="{f}"/>
  <path d="M122,90 Q142,52 150,66 Q146,92 128,106 Z" fill="{f}"/>
  <circle cx="67" cy="54" r="4.5" fill="{d}"/>
  <path d="M86,98 Q104,88 120,102 Q102,112 86,98 Z" fill="{d}"/>'''


# Pondeuse : c'est l'ŒUF qui la nomme. Le creux qui l'entoure l'empêche de se
# fondre dans le corps de la poule.
def pondeuse(f, d):
    return f'''
  {_patte(72, 116, 16, f)}
  {_patte(90, 116, 16, f)}
  <path d="M60,70 L52,56 L66,60 L64,46 L76,56 Z" fill="{f}"/>
  <ellipse cx="86" cy="96" rx="38" ry="30" fill="{f}"/>
  <circle cx="60" cy="74" r="18" fill="{f}"/>
  <path d="M43,74 L26,81 L43,88 Z" fill="{f}"/>
  <path d="M120,82 Q140,62 144,80 Q142,98 122,98 Z" fill="{f}"/>
  <circle cx="54" cy="70" r="4.5" fill="{d}"/>
  <path d="M76,94 Q94,84 110,98 Q94,108 76,94 Z" fill="{d}"/>
  <ellipse cx="112" cy="128" rx="19" ry="23" fill="{d}"/>
  <ellipse cx="112" cy="128" rx="14" ry="18" fill="{f}"/>'''


# Mouton : calotte laineuse festonnée et corne enroulée. La laine est le
# signal — un mouton lisse devient une chèvre.
def ovin_engraissement(f, d):
    return f'''
  <path d="M84,30 Q104,26 112,40 Q130,42 130,60 Q140,72 128,84
           Q130,100 112,102 L56,102 Q38,100 40,84 Q28,72 38,60
           Q38,42 56,40 Q64,26 84,30 Z" fill="{f}"/>
  <path d="M40,74 Q22,72 20,88 Q20,104 36,104 Q46,104 46,94
           Q46,86 36,88 Q30,90 32,96" stroke="{f}" stroke-width="11"
        fill="none" stroke-linecap="round"/>
  <path d="M128,74 Q146,72 148,88 Q148,104 132,104 Q122,104 122,94
           Q122,86 132,88 Q138,90 136,96" stroke="{f}" stroke-width="11"
        fill="none" stroke-linecap="round"/>
  <path d="M62,100 Q60,128 84,134 Q108,128 106,100 Z" fill="{f}"/>
  <circle cx="70" cy="86" r="5" fill="{d}"/>
  <circle cx="98" cy="86" r="5" fill="{d}"/>
  <path d="M74,116 Q84,122 94,116" stroke="{d}" stroke-width="4.5"
        fill="none" stroke-linecap="round"/>
  <path d="M84,124 V132" stroke="{d}" stroke-width="4" stroke-linecap="round"/>'''


# Chèvre : cornes COUCHÉES VERS L'ARRIÈRE, oreilles TOMBANTES LATÉRALES,
# barbiche. Sans les oreilles elle passe pour un lapin — vérifié au premier jet.
def caprin_embouche(f, d):
    return f'''
  <path d="M68,50 Q56,30 38,22 Q52,34 58,54 Z" fill="{f}"/>
  <path d="M100,50 Q112,30 130,22 Q116,34 110,54 Z" fill="{f}"/>
  <path d="M56,64 Q30,66 20,84 Q34,96 54,86 Z" fill="{f}"/>
  <path d="M112,64 Q138,66 148,84 Q134,96 114,86 Z" fill="{f}"/>
  <path d="M84,44 Q112,44 114,72 Q114,96 104,112 Q96,126 84,128
           Q72,126 64,112 Q54,96 54,72 Q56,44 84,44 Z" fill="{f}"/>
  <path d="M76,132 Q84,150 92,132 Q84,138 76,132 Z" fill="{f}"/>
  <circle cx="70" cy="80" r="5" fill="{d}"/>
  <circle cx="98" cy="80" r="5" fill="{d}"/>
  <path d="M74,110 Q84,116 94,110" stroke="{d}" stroke-width="4.5"
        fill="none" stroke-linecap="round"/>'''


# Bœuf : cornes LARGEMENT LATÉRALES, et mufle en TRAIT COURBE. Un ovale à deux
# points y faisait un groin de cochon — d'où la courbe seule.
def bovin_embouche(f, d):
    return f'''
  <path d="M62,56 Q36,52 22,36 Q12,24 20,20 Q28,18 32,30
           Q40,46 64,44 Z" fill="{f}"/>
  <path d="M106,56 Q132,52 146,36 Q156,24 148,20 Q140,18 136,30
           Q128,46 104,44 Z" fill="{f}"/>
  <path d="M52,72 Q30,78 26,92 Q42,98 58,88 Z" fill="{f}"/>
  <path d="M116,72 Q138,78 142,92 Q126,98 110,88 Z" fill="{f}"/>
  <path d="M84,48 Q116,48 118,78 Q118,96 110,108 Q100,124 84,126
           Q68,124 58,108 Q50,96 50,78 Q52,48 84,48 Z" fill="{f}"/>
  <circle cx="68" cy="80" r="5.5" fill="{d}"/>
  <circle cx="100" cy="80" r="5.5" fill="{d}"/>
  <path d="M66,104 Q84,112 102,104" stroke="{d}" stroke-width="5.5"
        fill="none" stroke-linecap="round"/>
  <path d="M74,116 Q84,120 94,116" stroke="{d}" stroke-width="4.5"
        fill="none" stroke-linecap="round"/>'''


# Tilapia : corps haut, dorsale épineuse continue, caudale en éventail.
def tilapia(f, d):
    return f'''
  <path d="M52,84 Q40,58 44,44 Q62,52 74,66 Z" fill="{f}"/>
  <path d="M64,120 Q58,138 66,146 Q78,138 82,124 Z" fill="{f}"/>
  <path d="M124,84 Q142,62 152,58 Q148,84 152,110 Q142,106 124,86 Z" fill="{f}"/>
  <path d="M44,84 C50,56 78,42 100,50 C120,58 130,72 130,86
           C130,102 118,118 98,124 C74,131 50,112 44,84 Z" fill="{f}"/>
  <circle cx="62" cy="78" r="6" fill="{d}"/>
  <path d="M78,56 Q70,86 80,116" stroke="{d}" stroke-width="5"
        fill="none" stroke-linecap="round"/>
  <path d="M96,72 Q106,86 96,102" stroke="{d}" stroke-width="4.5"
        fill="none" stroke-linecap="round"/>
  <path d="M112,78 Q120,88 112,100" stroke="{d}" stroke-width="4.5"
        fill="none" stroke-linecap="round"/>'''


DESSINS = {
    "aubergine_kalenda": aubergine,
    "tomate": tomate,
    "oignon": oignon,
    "chou": chou,
    "mais": mais,
    "niebe": niebe,
    "poulet_chair": poulet_chair,
    "poulet_goliath": poulet_goliath,
    "pondeuse": pondeuse,
    "ovin_engraissement": ovin_engraissement,
    "caprin_embouche": caprin_embouche,
    "bovin_embouche": bovin_embouche,
    "tilapia": tilapia,
}


# =============================================================================
def composer(code: str) -> str:
    filiere = ESPECES[code]
    disque, forme = FILIERES[filiere]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {COTE} {COTE}" '
        f'width="{COTE}" height="{COTE}" role="img" '
        f'aria-label="{code} ({filiere})">\n'
        f'  <circle cx="{RAYON}" cy="{RAYON}" r="{RAYON}" fill="{disque}"/>'
        f'{DESSINS[code](forme, disque)}\n'
        f'</svg>\n'
    )


def generer(sortie: Path, taille: int) -> list[Path]:
    sortie.mkdir(parents=True, exist_ok=True)
    pngs = []
    for code in ESPECES:
        svg = composer(code)
        (sortie / f"{code}.svg").write_text(svg, encoding="utf-8")
        png = sortie / f"{code}.png"
        cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            write_to=str(png),
            output_width=taille,
            output_height=taille,
        )
        pngs.append(png)
    return pngs


def planche(sortie: Path, chemin: Path) -> None:
    """Planche de contrôle : chaque espèce à 48 px, la taille réelle d'usage,
    et à 128 px pour juger le dessin lui-même."""
    from PIL import Image, ImageDraw

    codes = list(ESPECES)
    cols, marge, libelle = 7, 16, 14
    largeur = cols * (128 + marge) + marge
    lignes = (len(codes) + cols - 1) // cols
    hauteur = lignes * (128 + 48 + libelle * 2 + marge * 2) + marge

    feuille = Image.new("RGB", (largeur, hauteur), "#FFFFFF")
    dessin = ImageDraw.Draw(feuille)

    for i, code in enumerate(codes):
        col, ligne = i % cols, i // cols
        x = marge + col * (128 + marge)
        y = marge + ligne * (128 + 48 + libelle * 2 + marge * 2)
        grand = Image.open(sortie / f"{code}.png").convert("RGBA").resize((128, 128))
        feuille.paste(grand, (x, y), grand)
        petit = grand.resize((48, 48), Image.LANCZOS)
        feuille.paste(petit, (x + 40, y + 128 + libelle), petit)
        dessin.text((x, y + 128 + 2), "48 px ↓", fill="#5E7263")
        dessin.text((x, y + 128 + 48 + libelle + 2), code[:20], fill="#122B1B")

    feuille.save(chemin)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Illustrations des spéculations.")
    ap.add_argument("--sortie", default="assets/especes", type=Path)
    ap.add_argument("--taille", default=256, type=int)
    ap.add_argument("--planche", type=Path, help="planche de contrôle (PNG)")
    a = ap.parse_args()

    generer(a.sortie, a.taille)
    print(f"{len(ESPECES)} espèces générées dans {a.sortie} ({a.taille}×{a.taille})")
    if a.planche:
        planche(a.sortie, a.planche)
        print(f"planche de contrôle : {a.planche}")
