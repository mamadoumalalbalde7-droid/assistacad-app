# AssistAcad — fabrique TOUTES les icônes de l'application à partir d'un seul fichier :
#   icone/icone.png  (image carrée, 1024 × 1024 conseillé, fond transparent ou plein)
# Lancé automatiquement par GitHub (Actions › « Mettre à jour les icônes ») dès que
# icone/icone.png ou icone/couleur.txt change. Peut aussi se lancer à la main : python icone/generer.py
import hashlib, os, re, sys
from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOS = os.path.join(RACINE, "icone")
SRC = os.path.join(DOS, "icone.png")
FOND_DEFAUT = (6, 46, 26)  # vert forêt AssistAcad, si l'image n'a pas de fond


def chemin(*p):
    return os.path.join(RACINE, *p)


def carre(img):
    """Rend l'image carrée sans la déformer (bords transparents ajoutés)."""
    w, h = img.size
    if w == h:
        return img
    c = max(w, h)
    toile = Image.new("RGBA", (c, c), (0, 0, 0, 0))
    toile.paste(img, ((c - w) // 2, (c - h) // 2))
    return toile


def couleur_fond(img):
    """couleur.txt (#RRGGBB) si présent ; sinon la couleur du haut de l'icône ; sinon le vert forêt."""
    f = os.path.join(DOS, "couleur.txt")
    if os.path.exists(f):
        m = re.search(r"#?([0-9a-fA-F]{6})", open(f, encoding="utf-8").read())
        if m:
            v = m.group(1)
            return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))
    w, h = img.size
    r, g, b, a = img.getpixel((w // 2, max(1, h * 3 // 100)))
    return (r, g, b) if a > 200 else FOND_DEFAUT


def taille(img, n):
    return img.resize((n, n), Image.LANCZOS)


def sur_fond(img, n, fond, echelle=1.0):
    """Icône posée sur un carré plein (iPhone, Android « maskable », photo du bot)."""
    toile = Image.new("RGBA", (n, n), fond + (255,))
    t = max(1, int(round(n * echelle)))
    petit = taille(img, t)
    toile.alpha_composite(petit, ((n - t) // 2, (n - t) // 2))
    return toile.convert("RGB")


def main():
    if not os.path.exists(SRC):
        sys.exit("icone/icone.png introuvable")
    img = carre(Image.open(SRC).convert("RGBA"))
    fond = couleur_fond(img)
    version = hashlib.sha256(open(SRC, "rb").read() + repr(fond).encode()).hexdigest()[:8]

    # Application téléphone / onglet (GitHub Pages)
    taille(img, 192).save(chemin("icone-192.png"), optimize=True)
    taille(img, 512).save(chemin("icone-512.png"), optimize=True)
    sur_fond(img, 180, fond).save(chemin("apple-touch-icon.png"), optimize=True)
    sur_fond(img, 512, fond, 0.8).save(chemin("icone-maskable-512.png"), optimize=True)
    taille(img, 256).save(chemin("favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    # Logiciel ordinateur (Windows, macOS, Linux)
    os.makedirs(chemin("bureau", "build"), exist_ok=True)
    taille(img, 512).save(chemin("bureau", "build", "icon.png"), optimize=True)
    taille(img, 256).save(chemin("icone", "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    # Copies prêtes à l'emploi (photo du bot Telegram, onglet de l'intranet)
    sur_fond(img, 640, fond, 0.86).save(chemin("icone", "photo-bot-640.png"), optimize=True)
    taille(img, 512).save(chemin("icone", "icone-512.png"), optimize=True)
    open(os.path.join(DOS, "version.txt"), "w").write(version + "\n")

    # Les téléphones et navigateurs gardent les anciennes icônes en mémoire :
    # on change le numéro de version dans les liens pour les obliger à recharger.
    for f in ("index.html", "manifest.webmanifest", "sw.js"):
        p = chemin(f)
        if not os.path.exists(p):
            continue
        s = open(p, encoding="utf-8").read()
        s2 = re.sub(r"((?:icone-192|icone-512|icone-maskable-512|apple-touch-icon)\.png)(\?v=[\w-]+)?", r"\1?v=" + version, s)
        s2 = re.sub(r'const CACHE = "assistacad-[\w-]+";', 'const CACHE = "assistacad-' + version + '";', s2)
        s2 = re.sub(r'var MAJ_ACTUELLE = "[\w-]+";', 'var MAJ_ACTUELLE = "' + version + '";', s2)
        if s2 != s:
            open(p, "w", encoding="utf-8").write(s2)
    print("Icônes à jour, version", version, "fond", "#%02X%02X%02X" % fond)


if __name__ == "__main__":
    main()
