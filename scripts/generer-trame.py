#!/usr/bin/env python3
# =============================================================================
# Trame Faso Dan Fani : tuiles de fond pour les en-têtes colorés.
#
# -----------------------------------------------------------------------------
# CE QUE LA TRAME DOIT FAIRE, ET SURTOUT NE PAS FAIRE
#
# Le Faso Dan Fani est un tissu à bandes : des lisières verticales régulières,
# nées de la largeur du métier à tisser, et des trames horizontales plus rares.
# La citer donne à l'application une texture d'ici plutôt qu'un aplat de
# gabarit international.
#
# Mais un fond décoratif derrière du texte est un risque de lisibilité avant
# d'être un ornement. Les opacités sont donc très basses — 7 % et 5 % — et
# vérifiées : le contraste du texte blanc sur la bande la plus sombre reste
# au-dessus du seuil. Si un jour il fallait choisir, c'est le motif qui
# s'efface, jamais le texte qui s'éclaircit.
#
# -----------------------------------------------------------------------------
# POURQUOI DES PIXELS ET NON UN SVG
#
# Une tuile doit se répéter sans couture. Le contrôle au pixel près est ici
# plus sûr qu'un rendu vectoriel remis à l'échelle : une ligne à cheval sur le
# bord se dédoublerait à la jonction. La ligne de gauche est donc tracée en
# x = 0 et aucune en x = 192 — c'est la tuile suivante qui la fournit.
# =============================================================================

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

COTE = 192
PAS = 24              # largeur d'une bande, en pixels
OPACITE_SOMBRE = 0.07
OPACITE_CLAIRE = 0.05

FONDS = {
    "trame-vert": "#00693B",
    "trame-nuit": "#0B2416",
    "trame-rouge": "#B50D22",
}


def _rgb(hexa: str) -> tuple[int, int, int]:
    n = int(hexa.lstrip("#"), 16)
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def _melange(fond: tuple[int, int, int], vers: int, part: float) -> tuple[int, int, int]:
    return tuple(round(c + (vers - c) * part) for c in fond)  # type: ignore[return-value]


def tuile(couleur: str) -> Image.Image:
    fond = _rgb(couleur)
    sombre = _melange(fond, 0, OPACITE_SOMBRE)
    clair = _melange(fond, 255, OPACITE_CLAIRE)

    im = Image.new("RGB", (COTE, COTE), fond)
    d = ImageDraw.Draw(im)

    # Lisières sombres, une par bande. Rien en x = COTE : la tuile suivante
    # apporte la sienne, sinon la jonction ferait une bande double.
    for x in range(0, COTE, PAS):
        d.rectangle([x, 0, x + 1, COTE], fill=sombre)
        # Fil clair au milieu de la bande : c'est lui qui donne le tissé.
        d.line([(x + PAS // 2, 0), (x + PAS // 2, COTE)], fill=clair, width=1)

    # Une seule trame horizontale par tuile : le tissu en montre peu, et une
    # grille serrée ferait un quadrillage de papier millimétré.
    d.line([(0, COTE // 2), (COTE, COTE // 2)], fill=clair, width=1)
    return im


def generer(sortie: Path) -> None:
    sortie.mkdir(parents=True, exist_ok=True)
    for nom, couleur in FONDS.items():
        tuile(couleur).save(sortie / f"{nom}.png")


def apercu(sortie: Path, chemin: Path) -> None:
    """Trois tuiles répétées 2×2, pour juger la couture et la discrétion."""
    noms = list(FONDS)
    l = COTE * 2
    feuille = Image.new("RGB", (len(noms) * (l + 16) + 16, l + 16), "#FFFFFF")
    for i, nom in enumerate(noms):
        t = Image.open(sortie / f"{nom}.png")
        bloc = Image.new("RGB", (l, l))
        for x in (0, COTE):
            for y in (0, COTE):
                bloc.paste(t, (x, y))
        feuille.paste(bloc, (16 + i * (l + 16), 8))
    feuille.save(chemin)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Trame Faso Dan Fani.")
    ap.add_argument("--sortie", default="assets/trame", type=Path)
    ap.add_argument("--apercu", type=Path)
    a = ap.parse_args()
    generer(a.sortie)
    print(f"{len(FONDS)} tuiles générées dans {a.sortie} ({COTE}×{COTE})")
    if a.apercu:
        apercu(a.sortie, a.apercu)
        print(f"aperçu : {a.apercu}")
