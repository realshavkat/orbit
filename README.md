<p align="center"><img src="assets/logoapp.png" width="96" alt="Orbit"></p>

# Orbit

Navigateur calme, rapide et beau, construit sur Gecko (le moteur de Firefox) — dans l'esprit de Zen Browser, en plus léger.

- **Barre latérale verticale** : onglets, « Essentiels » (onglets épinglés en tuiles, partagés entre tous les espaces), barre d'adresse compacte.
- **Espaces** : groupes d'onglets avec icône (Lucide) et dégradé de couleur. Le dégradé de la fenêtre se transforme en douceur quand on change d'espace.
- **Barre de commande** : `Ctrl+T` ouvre une barre flottante au centre au lieu d'une page « nouvel onglet ». Aucun onglet vide n'est créé tant qu'on n'a rien choisi.
- **Glance** : `Alt+clic` sur un lien ouvre un aperçu flottant. `Échap` le ferme, ⤢ l'ouvre en onglet.
- **Mode compact** : `Ctrl+Alt+C`. La barre latérale se cache et réapparaît en panneau flottant quand la souris touche le bord gauche.
- **Vue partagée et dossiers d'onglets** : ceux de Firefox (clic droit sur un onglet).
- **Mémoire** : onglets inactifs déchargés automatiquement après 20 min (`orbit.tabs.unload-after-minutes`), 4 processus de contenu max, pas de processus préchargé, pas de page nouvel onglet, pas d'IA/Pocket, pas de télémétrie.

## Raccourcis

| Raccourci | Action |
| --- | --- |
| `Ctrl+T` | Barre de commande |
| `Alt+1` … `Alt+9` | Aller à l'espace n |
| `Ctrl+Alt+←` / `→` | Espace précédent / suivant (ou glisser horizontalement sur la barre latérale) |
| `Ctrl+Alt+C` | Mode compact |
| `Alt+clic` sur un lien | Glance |
| Clic droit sur un espace | Modifier / supprimer |

## Structure

```
assets/                       logos source
configs/branding/release/     icônes générées (npm run branding)
configs/{common,windows}/     options de compilation (mozconfig)
src/                          fichiers copiés / patches appliqués dans engine/
  browser/base/content/orbit/ toute l'interface Orbit (JS + CSS + icônes Lucide)
  browser/app/profile/orbit.js préférences par défaut
  **/*.patch                  petites modifications du code Firefox
tools/dev.mjs                 boucle de dev rapide (sans compiler)
tools/release.mjs             prépare une release + manifeste de mise à jour
updates/browser/              manifestes lus par les navigateurs installés
engine/                       sources Firefox (téléchargées, ignorées par git)
```

## Développer l'interface (rapide)

Pas besoin de compiler Firefox pour travailler sur l'UI :

```bash
npm install
npm run dev
```

`tools/dev.mjs` lance un moteur Gecko existant (Firefox installé, ou `ORBIT_GECKO=<dossier>`) avec le code de `src/browser/base/content/orbit/` chargé directement. Modifier un fichier, relancer `npm run dev`.

## Compiler Orbit (Windows)

Prérequis : Visual Studio 2022 (C++), [MozillaBuild](https://wiki.mozilla.org/MozillaBuild), Node.js, ~40 Go libres.
Toutes les commandes `mach`/`surfer` passent par le shell MozillaBuild via `tools\mozbuild.cmd` :

```bash
npm install
npm run download        # sources Firefox dans engine/ (ou déjà fait)
tools\mozbuild.cmd npx surfer set brand release
tools\mozbuild.cmd npm run import      # applique src/ + branding
tools\mozbuild.cmd npm run bootstrap   # toolchains (une fois)
tools\mozbuild.cmd npm run build       # 1 à 3 h la première fois
tools\mozbuild.cmd npm run start       # lancer
tools\mozbuild.cmd npm run package     # installeur + .mar de mise à jour
```

Après une modification de l'UI seulement : `tools\mozbuild.cmd npm run build:ui` (quelques secondes).

## Langues

L'interface suit la langue de Windows. Le français est inclus : `python tools/langpack.py fr` télécharge le pack de langue officiel Mozilla (somme SHA256 vérifiée), remplace la marque par « Orbit » et le place dans `src/browser/base/langpacks/`. Ajouter une langue : `python tools/langpack.py de`, puis l'ajouter dans `src/browser/base/moz-build.patch`.

## Mises à jour automatiques

Orbit utilise le système de mise à jour de Firefox (fichiers `.mar`). Chaque copie installée interroge :

```
https://raw.githubusercontent.com/realshavkat/orbit/main/updates/browser/<plateforme>/release/update.xml
```

Pour publier une version :

1. Monter `displayVersion` dans `surfer.json` (schéma : `<version Firefox>.<build Orbit>`, ex. `158.0.2`).
2. `build` puis `package`.
3. `node tools/release.mjs --publish` (crée la release GitHub avec `windows.mar` et l'installeur).
4. Commit + push de `updates/browser/` : tous les Orbit installés se mettent à jour.

Le dépôt GitHub doit être public pour que les navigateurs puissent lire le manifeste.

## Licence

MPL-2.0, comme Firefox. Icônes : [Lucide](https://lucide.dev) (ISC).
