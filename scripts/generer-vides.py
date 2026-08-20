#!/usr/bin/env python3
# =============================================================================
# Illustrations des états vides : un SVG et son rendu PNG 400×380 par écran.
#
# -----------------------------------------------------------------------------
# LE TON EST LE SUJET
#
# Un état vide n'est pas une erreur, c'est un début. Un producteur qui ouvre
# « Mes acheteurs » pour la première fois n'a rien fait de mal — il n'a pas
# encore commencé. Une croix rouge ou un panneau d'interdiction le lui
# reprocherait, et c'est exactement ce qu'il ne faut pas.
#
# D'où trois règles tenues partout ici :
#   – traits fins et tons doux, jamais de masse sombre ;
#   – UN SEUL élément coloré par dessin, pour accrocher le regard sans crier ;
#   – aucune croix, aucun panneau, aucun symbole de refus.
#
# Le vert dit ce qui existe déjà, l'or ce qui reste à faire : le sommet à
# poser, l'acheteur à ajouter, l'onde à capter. C'est une invitation, pas un
# constat de manque.
# =============================================================================

import argparse
from pathlib import Path

import cairosvg

TRAIT = "#D8E4D0"   # traits clairs : la structure, sans poids
VERT = "#007134"    # ce qui est acquis
OR = "#FCD116"      # ce qui appelle un geste

LARGEUR, HAUTEUR = 200, 190
SORTIE_L, SORTIE_H = 400, 380


# -----------------------------------------------------------------------------
# Un sillon en traits clairs, une pousse verte qui en sort, une étoile d'or.
# Le sillon est vide et labouré : tout est prêt, il ne manque que la mise en
# terre. C'est le seul dessin de la série qui montre déjà une pousse — l'écran
# d'accueil est le premier vu, et il doit promettre quelque chose.
# -----------------------------------------------------------------------------
def aucun_cycle():
    return f'''
  <path d="M20,150 Q100,138 180,150" stroke="{TRAIT}" stroke-width="3"
        fill="none" stroke-linecap="round"/>
  <path d="M26,162 Q100,150 174,162" stroke="{TRAIT}" stroke-width="3"
        fill="none" stroke-linecap="round"/>
  <path d="M34,174 Q100,163 166,174" stroke="{TRAIT}" stroke-width="3"
        fill="none" stroke-linecap="round"/>
  <path d="M100,146 V96" stroke="{VERT}" stroke-width="6" stroke-linecap="round"/>
  <path d="M100,124 C84,120 74,108 74,96 C90,96 100,108 100,124 Z" fill="{VERT}"/>
  <path d="M100,116 C116,112 126,100 126,88 C110,88 100,100 100,116 Z" fill="{VERT}"/>
  <path d="M100,26 L108,50 L133,50 L113,65 L120,89 L100,74 L80,89 L87,65
           L67,50 L92,50 Z" fill="{OR}"/>'''


# -----------------------------------------------------------------------------
# Un cercle clair, une coche verte épaisse, quelques rayons courts.
# La coche dit « rien ne réclame votre attention », pas « rien ne s'est passé ».
# Les rayons sont ceux d'un calme qui rayonne, pas d'une alarme.
# -----------------------------------------------------------------------------
def aucune_alerte():
    rayons = []
    import math

    for i in range(8):
        a = math.radians(i * 45 + 22.5)
        x1, y1 = 100 + 66 * math.cos(a), 100 + 66 * math.sin(a)
        x2, y2 = 100 + 80 * math.cos(a), 100 + 80 * math.sin(a)
        rayons.append(
            f'<path d="M{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f}" stroke="{TRAIT}" '
            f'stroke-width="4" stroke-linecap="round"/>'
        )
    return f'''
  <circle cx="100" cy="100" r="54" stroke="{TRAIT}" stroke-width="4" fill="none"/>
  {"".join(rayons)}
  <path d="M76,100 L94,118 L126,84" stroke="{VERT}" stroke-width="11"
        fill="none" stroke-linecap="round" stroke-linejoin="round"/>'''


# -----------------------------------------------------------------------------
# Une silhouette pleine, une seconde en pointillés avec un point d'or.
# La place vide à côté de quelqu'un se lit comme une invitation ; une seule
# silhouette esseulée se serait lue comme un manque.
# -----------------------------------------------------------------------------
def aucun_acheteur():
    return f'''
  <circle cx="72" cy="76" r="24" fill="{TRAIT}"/>
  <path d="M34,150 C34,120 52,108 72,108 C92,108 110,120 110,150 Z" fill="{TRAIT}"/>
  <circle cx="140" cy="80" r="20" stroke="{TRAIT}" stroke-width="4"
          fill="none" stroke-dasharray="7 7"/>
  <path d="M110,148 C110,122 124,110 140,110 C156,110 170,122 170,148"
        stroke="{TRAIT}" stroke-width="4" fill="none" stroke-dasharray="7 7"
        stroke-linecap="round"/>
  <circle cx="140" cy="80" r="9" fill="{OR}"/>'''


# -----------------------------------------------------------------------------
# Un polygone à cinq sommets en pointillés, sommets verts, un sommet d'or.
# Le sommet d'or est celui qu'on n'a pas encore posé : le tracé s'interrompt
# là où le producteur doit reprendre.
# -----------------------------------------------------------------------------
def aucune_parcelle():
    pts = [(100, 38), (166, 84), (142, 158), (58, 158), (34, 84)]
    contour = " ".join(f"{x},{y}" for x, y in pts)
    sommets = "".join(
        f'<circle cx="{x}" cy="{y}" r="9" fill="{VERT}"/>' for x, y in pts[1:]
    )
    return f'''
  <polygon points="{contour}" stroke="{TRAIT}" stroke-width="4" fill="none"
           stroke-dasharray="9 8" stroke-linejoin="round"/>
  {sommets}
  <circle cx="{pts[0][0]}" cy="{pts[0][1]}" r="11" fill="{OR}"/>'''


# -----------------------------------------------------------------------------
# Un boîtier en traits clairs, deux arcs d'onde en or vers la droite.
# Les ondes montent : la caméra n'est pas en panne, elle attend d'être posée.
# -----------------------------------------------------------------------------
def aucune_camera():
    return f'''
  <rect x="30" y="76" width="94" height="66" rx="12"
        stroke="{TRAIT}" stroke-width="4" fill="none"/>
  <path d="M54,76 L62,60 L92,60 L100,76" stroke="{TRAIT}" stroke-width="4"
        fill="none" stroke-linejoin="round"/>
  <circle cx="77" cy="109" r="20" stroke="{TRAIT}" stroke-width="4" fill="none"/>
  <circle cx="77" cy="109" r="7" fill="{TRAIT}"/>
  <path d="M136,104 Q150,88 150,68" stroke="{OR}" stroke-width="6"
        fill="none" stroke-linecap="round"/>
  <path d="M152,112 Q174,88 174,54" stroke="{OR}" stroke-width="6"
        fill="none" stroke-linecap="round"/>'''


# -----------------------------------------------------------------------------
# Un panier en traits clairs, une flèche verte qui monte et en sort, un point
# d'or au fond. La flèche PART : la file s'est vidée, rien n'est resté.
# -----------------------------------------------------------------------------
def file_vide():
    return f'''
  <path d="M46,106 L154,106 L138,166 L62,166 Z" stroke="{TRAIT}"
        stroke-width="4" fill="none" stroke-linejoin="round"/>
  <path d="M36,106 L164,106" stroke="{TRAIT}" stroke-width="5"
        stroke-linecap="round"/>
  <path d="M74,120 L82,152 M126,120 L118,152" stroke="{TRAIT}"
        stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="150" r="8" fill="{OR}"/>
  <path d="M100,96 V38" stroke="{VERT}" stroke-width="8" stroke-linecap="round"/>
  <path d="M100,28 L124,56 L76,56 Z" fill="{VERT}"/>'''


VIDES = {
    "aucun_cycle": aucun_cycle,
    "aucune_alerte": aucune_alerte,
    "aucun_acheteur": aucun_acheteur,
    "aucune_parcelle": aucune_parcelle,
    "aucune_camera": aucune_camera,
    "file_vide": file_vide,
}


def composer(nom: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {LARGEUR} {HAUTEUR}" '
        f'width="{LARGEUR}" height="{HAUTEUR}" role="img" aria-label="{nom}">'
        f'{VIDES[nom]()}\n</svg>\n'
    )


def generer(sortie: Path) -> None:
    sortie.mkdir(parents=True, exist_ok=True)
    for nom in VIDES:
        svg = composer(nom)
        (sortie / f"{nom}.svg").write_text(svg, encoding="utf-8")
        cairosvg.svg2png(
            bytestring=svg.encode("utf-8"),
            write_to=str(sortie / f"{nom}.png"),
            output_width=SORTIE_L,
            output_height=SORTIE_H,
        )


def planche(sortie: Path, chemin: Path) -> None:
    from PIL import Image, ImageDraw

    noms = list(VIDES)
    cols, marge, libelle = 3, 18, 18
    l, h = 260, 247
    feuille = Image.new(
        "RGB",
        (cols * (l + marge) + marge, ((len(noms) + cols - 1) // cols) * (h + libelle + marge) + marge),
        "#FFFFFF",
    )
    d = ImageDraw.Draw(feuille)
    for i, nom in enumerate(noms):
        x = marge + (i % cols) * (l + marge)
        y = marge + (i // cols) * (h + libelle + marge)
        im = Image.open(sortie / f"{nom}.png").convert("RGBA").resize((l, h))
        feuille.paste(im, (x, y), im)
        d.text((x, y + h + 4), nom, fill="#122B1B")
    feuille.save(chemin)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Illustrations des états vides.")
    ap.add_argument("--sortie", default="assets/vides", type=Path)
    ap.add_argument("--planche", type=Path)
    a = ap.parse_args()
    generer(a.sortie)
    print(f"{len(VIDES)} états vides générés dans {a.sortie} ({SORTIE_L}×{SORTIE_H})")
    if a.planche:
        planche(a.sortie, a.planche)
        print(f"planche : {a.planche}")
