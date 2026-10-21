/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var OrbitSettings = {
  FONTS: ["Outfit", "Inter", "Manrope", "Space Grotesk", "DM Sans", "Segoe UI Variable Text"],

  SECTIONS: [
    {
      id: "general", icon: "settings-2",
      items: [
        { kind: "language" },
        { kind: "autostart" },
        { kind: "updates" },
        { kind: "font" },
      ],
    },
    {
      id: "look", icon: "palette",
      items: [
        { kind: "scheme" },
        { kind: "spacecolors" },
        { kind: "background" },
        { kind: "link", label: "quickColors", icon: "palette", action: () => OrbitColors.open(document.getElementById("orbit-space-title")) },
        { kind: "range", pref: "orbit.theme.intensity", label: "intensity", min: 0, max: 80, unit: "%" },
        { kind: "range", pref: "orbit.theme.grain", label: "grainAmount", min: 0, max: 100, unit: "%" },
        { kind: "range", pref: "orbit.theme.grain-size", label: "grainSize", min: 60, max: 600, unit: "px" },
        { kind: "range", pref: "orbit.theme.radius", label: "radius", min: 0, max: 14, unit: "px" },
      ],
    },
    {
      id: "effects", icon: "sparkles",
      items: [
        { kind: "toggle", pref: "orbit.effects.glass", label: "glass", def: false },
        { kind: "toggle", pref: "orbit.effects.nebula", label: "nebula" },
        { kind: "toggle", pref: "orbit.effects.grain", label: "grain" },
        { kind: "toggle", pref: "orbit.effects.animations", label: "animations" },
        { kind: "link", label: "themes", icon: "palette", action: () => BrowserAddonUI.openAddonsMgr("addons://list/theme") },
      ],
    },
    { id: "mods", icon: "sparkles", items: [{ kind: "mods" }] },
    {
      id: "layout", icon: "panel-left",
      items: [
        { kind: "toggle", pref: "orbit.view.compact", label: "compact", def: false },
        { kind: "toggle", pref: "sidebar.position_start", label: "sidebarRight", invert: true },
        { kind: "toggle", pref: "sidebar.verticalTabs", label: "horizontalTabs", invert: true },
        { kind: "toggle", pref: "orbit.split.grid", label: "splitGrid" },
        { kind: "range", pref: "orbit.view.sidebar-width", label: "sidebarWidth", min: 180, max: 480, unit: "px" },
        { kind: "range", pref: "orbit.view.gap", label: "gap", min: 0, max: 20, unit: "px" },
      ],
    },
    {
      id: "browsing", icon: "globe",
      items: [
        { kind: "toggle", pref: "orbit.urlbar.replace-newtab", label: "commandbar" },
        { kind: "toggle", pref: "orbit.glance.enabled", label: "glance" },
                { kind: "toggle", pref: "orbit.media.sidebar-player", label: "mediaPlayer" },
        { kind: "link", label: "advanced", icon: "external-link", action: () => openPreferences() },
        { kind: "link", label: "import", icon: "upload", action: () => OrbitImport.open() },
      ],
    },
    {
      id: "downloads", icon: "download",
      items: [
        { kind: "toggle", pref: "orbit.downloads.turbo", label: "turbo" },
        { kind: "range", pref: "orbit.downloads.connections", label: "turboConn", min: 2, max: 32 },
        { kind: "range", pref: "orbit.downloads.turbo-below-mbps", label: "turboBelow", min: 0, max: 200, unit: () => Orbit.tr(" MB/s", " Mo/s") },
        { kind: "range", pref: "orbit.downloads.turbo-min-mb", label: "turboMin", min: 1, max: 500, unit: () => Orbit.tr(" MB", " Mo") },
        { kind: "link", label: "downloadsFolder", icon: "external-link", action: () => openPreferences("general") },
      ],
    },
    {
      id: "memory", icon: "gauge",
      items: [
        { kind: "presets" },
        { kind: "choice", pref: "orbit.tabs.unload-after-minutes", label: "unload",
          options: [[0, "unload.never"], [5, "5 min"], [20, "20 min"], [60, "1 h"], [-1, "unload.adaptive"]] },
        { kind: "choice", pref: "orbit.memory.budget-mb", label: "budget",
          options: [[0, "budget.off"], [1024, "1 Go"], [2048, "2 Go"], [4096, "4 Go"]] },
        { kind: "eco" },
        { kind: "freeNow" },
        { kind: "choice", pref: "dom.ipc.processCount", label: "processes", options: [[1, "1"], [2, "2"], [4, "4"], [8, "8"]] },
        { kind: "choice", pref: "browser.sessionhistory.max_total_viewers", label: "bfcache", options: [[0, "0"], [1, "1"], [2, "2"], [4, "4"]] },
        { kind: "choice", pref: "image.mem.surfacecache.max_size_kb", label: "imageCache",
          options: [[65536, "64 Mo"], [131072, "128 Mo"], [262144, "256 Mo"], [524288, "512 Mo"]] },
        { kind: "toggle", pref: "browser.tabs.unloadOnLowMemory", label: "lowMemory" },
        { kind: "toggle", pref: "config.trim_on_minimize", label: "trim" },
        { kind: "toggle", pref: "network.prefetch-next", label: "prefetch" },
        { kind: "toggle", pref: "layers.acceleration.disabled", label: "gpu", invert: true, def: false },
        { kind: "link", label: "memoryPage", action: () => OrbitMemory.open() },
      ],
    },
    {
      id: "ai", icon: "bot",
      items: [
        { kind: "choice-str", pref: "browser.ml.chat.provider", label: "aiProvider",
          options: OrbitAI.ENGINES.map(e => [e.home, e.name]) },
        { kind: "link", label: "aiPanel", action: () => OrbitAI.toggleAssistant() },
        { kind: "info", label: "aiSearch" },
      ],
    },
    {
      id: "privacy", icon: "shield",
      items: [
        { kind: "fortress" },
        { kind: "vault" },
        { kind: "link", label: "lockNow", icon: "lock", action: () => OrbitLock.lockAll() },
        { kind: "choice", pref: "orbit.lock.idle-minutes", label: "lockIdle", options: [[0, "lockIdle.off"], [5, "lockIdle.5"], [15, "lockIdle.15"], [60, "lockIdle.60"]] },
        { kind: "toggle", pref: "orbit.lock.on-start", label: "lockStart", def: false },
        { kind: "lockPin" },
        { kind: "addon", id: "orbit-blocker@orbit.app", label: "blocker" },
        { kind: "strict", label: "strict" },
        { kind: "toggle", pref: "privacy.query_stripping.enabled", label: "stripping" },
        { kind: "toggle", pref: "dom.security.https_only_mode", label: "https", def: false },
        { kind: "toggle", pref: "privacy.fingerprintingProtection", label: "fingerprint", def: false },
        { kind: "choice", pref: "network.trr.mode", label: "doh", options: [[0, "doh.off"], [2, "doh.on"], [3, "doh.max"]] },
        { kind: "vpn" },
        { kind: "chrome-allow" },
        { kind: "link", label: "installExt", icon: "puzzle", action: () => OrbitChromeExt.installFromDisk() },
        { kind: "link", label: "privacyAdvanced", icon: "external-link", action: () => openPreferences("privacy") },
      ],
    },
    {
      id: "notify", icon: "bell",
      items: ["pin", "default", "update", "sleep", "tips"].map(k =>
        ({ kind: "toggle", pref: `orbit.notify.${k}`, label: `notify.${k}`, def: k != "tips" })),
    },
    {
      id: "sessions", icon: "history",
      items: [
        { kind: "sessions" },
        { kind: "sync" },
        { kind: "link", label: "syncAccount", icon: "refresh-cw", action: () => openPreferences("sync") },
        { kind: "link", label: "exportSettings", icon: "upload", action: () => OrbitSessions.exportSettings() },
        { kind: "link", label: "importSettings", icon: "download", action: () => OrbitSessions.importSettings() },
      ],
    },
    { id: "shortcuts", icon: "command", items: [{ kind: "shortcuts" }] },
    { id: "about", icon: "info", items: [{ kind: "betaKey" }, { kind: "about" }] },
  ],

  t(key) {
    return Orbit.dict(this.STRINGS)[key] ?? key;
  },

  STRINGS: {
    fr: {
      title: "Paramètres", general: "Général", look: "Apparence", effects: "Effets", layout: "Disposition",
      browsing: "Navigation", about: "À propos",
      unsigned: "Extensions Chrome", "unsigned.d": "Installe celles du Chrome Web Store. Elles ne sont pas vérifiées par Mozilla. Les autres extensions restent signées",
      installExt: "Installer une extension depuis un fichier (.crx, .xpi, .zip)",
      themes: "Thèmes Firefox", "themes.d": "Installe un thème depuis addons.mozilla.org : Orbit prend ses couleurs",
      turbo: "Orbit Turbo", "turbo.d": "Les gros téléchargements utilisent plusieurs connexions : fini les sites bridés par connexion",
      turboConn: "Connexions par téléchargement", "turboConn.d": "Plus de connexions va plus vite sur les serveurs bridés, au prix d'un peu plus de charge",
      turboBelow: "Activer sous cette vitesse", "turboBelow.d": "Turbo ne s'active que si le téléchargement normal est plus lent. 0 = toujours",
      turboMin: "Taille minimale", "turboMin.d": "Les fichiers plus petits se téléchargent normalement",
      downloads: "Téléchargements", downloadsFolder: "Dossier de téléchargement", mods: "Mods",
      autostart: "Lancer Orbit au démarrage de l'ordinateur", "autostart.d": "Orbit s'ouvre quand tu te connectes à Windows",
      "scheme.d": "Clair, sombre ou comme Windows. S'applique aussi aux sites qui le gèrent",
      updates: "Mises à jour", "updates.d": "Automatiques : installées au redémarrage. Me demander : une fenêtre présente les nouveautés au lancement",
      memory: "Mémoire", ai: "Intelligence artificielle", notify: "Notifications", privacy: "Vie privée", shortcuts: "Raccourcis",
      blocker: "Orbit Blocker", "blocker.d": "Bloque pubs, pisteurs, logiciels espions, bannières de cookies et l'accès des sites à ton réseau local",
      strict: "Protection renforcée contre le pistage", "strict.d": "Bloque aussi les cookies tiers et le contenu de pistage dans toutes les fenêtres",
      stripping: "Nettoyer les liens", "stripping.d": "Retire les paramètres de pistage des adresses (utm, fbclid…)",
      https: "HTTPS partout", "https.d": "Toujours une connexion chiffrée, avertissement sinon",
      fingerprint: "Anti-empreinte numérique", "fingerprint.d": "Brouille les informations qui permettent de te reconnaître",
      sync: "Synchroniser les espaces et réglages", "sync.d": "Avec Firefox Sync : tes espaces, ton thème, tes raccourcis et tes réglages sur tous tes PC. Les onglets restent sur chaque PC",
      syncAccount: "Compte de synchronisation",
      sessions: "Sessions", sessionSave: "Enregistrer cette fenêtre", "sessionSave.d": "Ses onglets, espaces et favoris, restaurés dans une nouvelle fenêtre",
      exportSettings: "Exporter les réglages d'Orbit", importSettings: "Importer des réglages d'Orbit",
      lockNow: "Verrouiller Orbit maintenant (Ctrl+Alt+L)",
      lockIdle: "Verrouiller après une inactivité", "lockIdle.d": "Windows (code PIN, visage ou mot de passe) déverrouille Orbit",
      "lockIdle.off": "Jamais", "lockIdle.5": "5 min", "lockIdle.15": "15 min", "lockIdle.60": "1 h",
      "intensity.d": "Force de la couleur de l'espace dans le fond d'Orbit",
      "grainAmount.d": "Texture de grain par-dessus le fond, comme une photo",
      "radius.d": "Arrondi des coins de la page, des cartes et des menus",
      "quickColors.d": "Choisis la couleur de l'espace en un geste, avec le grain",
      "sidebarRight.d": "Place les onglets du côté droit de la fenêtre",
      "sidebarWidth.d": "Largeur de la colonne des onglets",
      "gap.d": "Espace entre la page et les bords de la fenêtre",
      "advanced.d": "Tous les réglages de Firefox, pour aller plus loin",
      "import.d": "Favoris, mots de passe et historique de Chrome, Edge, Brave…",
      "downloadsFolder.d": "Où vont les fichiers téléchargés",
      "memoryPage.d": "Combien chaque onglet utilise, en direct",
      "aiPanel.d": "L'assistant s'ouvre à côté de la page",
      "lockNow.d": "Cache toutes les fenêtres jusqu'à ce que tu confirmes que c'est toi",
      "installExt.d": "Pour les extensions qui ne sont pas sur les boutiques",
      "privacyAdvanced.d": "Cookies, permissions, mots de passe et plus",
      "syncAccount.d": "Connecte-toi pour synchroniser favoris, mots de passe et historique",
      "exportSettings.d": "Un fichier .json avec tous tes réglages d'Orbit",
      "importSettings.d": "Reprends les réglages d'un autre PC",
      horizontalTabs: "Onglets en haut", "horizontalTabs.d": "Une barre d'onglets classique au lieu de la barre latérale. Espaces et réglages avec Ctrl+K",
      splitGrid: "Vue partagée en grille", "splitGrid.d": "À 3 ou 4 pages, une grille 2 × 2 au lieu de colonnes",
      lockPin: "Code PIN Orbit", "lockPin.d": "Déverrouille sans Windows. Obligatoire si ton compte Windows n'a pas de mot de passe",
      lockStart: "Verrouiller au démarrage", "lockStart.d": "Orbit s'ouvre verrouillé",
      doh: "DNS sécurisé", "doh.d": "Chiffre les requêtes DNS (Cloudflare)", "doh.off": "Désactivé", "doh.on": "Activé", "doh.max": "Strict",
      privacyAdvanced: "Tous les réglages de vie privée",
      "unload.adaptive": "Adaptatif", "unload.d": "Un onglet en veille ne consomme presque rien et se recharge au clic",
      budget: "Plafond mémoire", "budget.d": "Au-delà, les onglets les plus anciens passent en veille", "budget.off": "Aucun",
      eco: "Mode éco", "eco.d": "2 processus au lieu de 4 (au prochain démarrage), fond figé, cache d'images réduit",
      memoryPage: "Voir la mémoire par onglet (orbit://memoire)",
      processes: "Processus pour les pages", "processes.d": "Moins = moins de mémoire ; plus = un site lourd gêne moins les autres. Au prochain démarrage",
      bfcache: "Pages précédentes gardées", "bfcache.d": "Retour instantané en arrière, au prix de mémoire. 0 = le plus léger",
      imageCache: "Cache des images", "imageCache.d": "Images décodées gardées en mémoire",
      lowMemory: "Mettre en veille si le PC manque de mémoire", "lowMemory.d": "Windows prévient Orbit, qui endort les onglets les plus anciens",
      trim: "Libérer la mémoire quand Orbit est réduit", "trim.d": "Windows récupère la mémoire d'Orbit quand sa fenêtre est réduite",
      prefetch: "Précharger les liens", "prefetch.d": "Pages plus rapides quand un site le demande, un peu plus de réseau et de mémoire",
      gpu: "Accélération matérielle", "gpu.d": "La carte graphique dessine les pages. Coupée : moins de mémoire graphique, plus de processeur. Au prochain démarrage",
      freeNow: "Libérer la mémoire maintenant", "freeNow.d": "Endort les onglets en arrière-plan et rend la mémoire inutilisée",
      adblock: "Bloqueur de publicités", "adblock.d": "uBlock Origin Lite : bloque pubs et traqueurs, sans coût mémoire",
      mediaPlayer: "Lecteur dans la barre latérale", "mediaPlayer.d": "Contrôle la musique ou la vidéo d'un autre onglet",
      aiProvider: "Assistant du panneau", "aiProvider.d": "Ouvert à côté de la page avec Ctrl+Maj+U",
      aiPanel: "Ouvrir le panneau assistant",
      aiSearch: "Recherche avec l'IA", "aiSearch.d": "Tape @claude, @gpt, @perplexity ou @mistral suivi de ta question dans la barre d'adresse",
      "notify.pin": "Épingler à la barre des tâches", "notify.pin.d": "Proposé une seule fois au début",
      "notify.default": "Navigateur par défaut", "notify.default.d": "Demander si Orbit n'est pas le navigateur par défaut",
      "notify.update": "Mise à jour installée", "notify.update.d": "Prévenir après une mise à jour automatique",
      "notify.sleep": "Onglets mis en veille", "notify.sleep.d": "Quand Orbit libère de la mémoire",
      "notify.tips": "Astuces", "notify.tips.d": "De temps en temps, un raccourci utile",
      language: "Langue", "language.d": "Par défaut, Orbit suit la langue de Windows",
      "lang.auto": "Automatique (système)", restart: "Redémarrer pour appliquer",
      font: "Police", "font.d": "Utilisée dans toute l'interface", "font.add": "Ajouter une police…",
      "font.system": "Police du système",
      spaceColors: "Couleurs de l'espace", custom: "Personnalisées",
      scheme: "Thème", "scheme.dark": "Sombre", "scheme.light": "Clair", "scheme.system": "Système",
      intensity: "Intensité du fond", radius: "Arrondi des coins",
      quickColors: "Couleurs rapides", grainAmount: "Quantité de grain", grainSize: "Taille du grain", "grainSize.d": "Petit = grain fin, grand = grain large",
      glass: "Verre liquide", "glass.d": "Reflets et transparence sur les onglets et les barres",
      nebula: "Mouvement du fond", "nebula.d": "Les rubans de couleur dérivent lentement (en pause quand la fenêtre est inactive)",
      grain: "Grain", "grain.d": "Texture fine sur l'arrière-plan",
      animations: "Animations", "animations.d": "Transitions et effets de mouvement",
      compact: "Mode compact", "compact.d": "Barre latérale cachée, visible au bord de l'écran (Ctrl+Alt+C)",
      sidebarRight: "Barre latérale à droite", sidebarWidth: "Largeur de la barre latérale",
      gap: "Marge autour de la page",
      commandbar: "Barre de commande", "commandbar.d": "Ctrl+T ouvre une recherche flottante au lieu d'un onglet vide",
      glance: "Glance", "glance.d": "Alt+clic sur un lien pour l'ouvrir en aperçu",
      unload: "Mise en veille des onglets",
      "unload.never": "Jamais",
      advanced: "Paramètres avancés", import: "Importer depuis un autre navigateur",
      "about.tagline": "Un navigateur calme, rapide et beau.",
      "about.by": "Conçu et créé par",
      "about.engine": "Basé sur Gecko, le moteur de Firefox (MPL 2.0)",
      "about.credits": "Icônes Lucide (ISC) · Polices Outfit, Inter, Manrope, Space Grotesk, DM Sans (SIL OFL)",
      "about.update": "Rechercher des mises à jour", "about.source": "Code source",
    },
    en: {
      title: "Settings", general: "General", look: "Appearance", effects: "Effects", layout: "Layout",
      browsing: "Browsing", about: "About",
      unsigned: "Chrome extensions", "unsigned.d": "Installs them from the Chrome Web Store. Mozilla does not check them. Other extensions stay signed",
      installExt: "Install an extension from a file (.crx, .xpi, .zip)",
      themes: "Firefox themes", "themes.d": "Install a theme from addons.mozilla.org: Orbit takes its colors",
      turbo: "Orbit Turbo", "turbo.d": "Big downloads use several connections: no more sites throttling each connection",
      turboConn: "Connections per download", "turboConn.d": "More connections are faster on throttled servers, at a slightly higher load",
      turboBelow: "Turn on below this speed", "turboBelow.d": "Turbo only steps in when the normal download is slower. 0 = always",
      turboMin: "Minimum size", "turboMin.d": "Smaller files download normally",
      downloads: "Downloads", downloadsFolder: "Download folder", mods: "Mods",
      autostart: "Start Orbit when the computer starts", "autostart.d": "Orbit opens when you sign in to Windows",
      "scheme.d": "Light, dark or like Windows. Also applies to sites that support it",
      updates: "Updates", "updates.d": "Automatic: installed on restart. Ask me: a window shows what's new at launch",
      memory: "Memory", ai: "Artificial intelligence", notify: "Notifications", privacy: "Privacy", shortcuts: "Shortcuts",
      blocker: "Orbit Blocker", "blocker.d": "Blocks ads, trackers, spyware, cookie banners and sites probing your local network",
      strict: "Strict tracking protection", "strict.d": "Also blocks third-party cookies and tracking content everywhere",
      stripping: "Clean links", "stripping.d": "Removes tracking parameters from addresses (utm, fbclid…)",
      https: "HTTPS everywhere", "https.d": "Always an encrypted connection, warns otherwise",
      fingerprint: "Anti-fingerprinting", "fingerprint.d": "Blurs the details that can identify you",
      sync: "Sync spaces and settings", "sync.d": "With Firefox Sync: your spaces, theme, shortcuts and settings on all your PCs. Tabs stay on each PC",
      syncAccount: "Sync account",
      sessions: "Sessions", sessionSave: "Save this window", "sessionSave.d": "Its tabs, spaces and essentials, restored in a new window",
      exportSettings: "Export Orbit's settings", importSettings: "Import Orbit settings",
      lockNow: "Lock Orbit now (Ctrl+Alt+L)",
      lockIdle: "Lock after inactivity", "lockIdle.d": "Windows (PIN, face or password) unlocks Orbit",
      "lockIdle.off": "Never", "lockIdle.5": "5 min", "lockIdle.15": "15 min", "lockIdle.60": "1 h",
      "intensity.d": "How strongly the space's color tints Orbit's background",
      "grainAmount.d": "A film grain texture over the background",
      "radius.d": "Roundness of the page, cards and menus",
      "quickColors.d": "Pick the space's color in one gesture, with the grain",
      "sidebarRight.d": "Puts the tabs on the right side of the window",
      "sidebarWidth.d": "Width of the tab column",
      "gap.d": "Space between the page and the window's edges",
      "advanced.d": "Every Firefox setting, to go further",
      "import.d": "Bookmarks, passwords and history from Chrome, Edge, Brave…",
      "downloadsFolder.d": "Where downloaded files go",
      "memoryPage.d": "How much each tab uses, live",
      "aiPanel.d": "The assistant opens beside the page",
      "lockNow.d": "Hides every window until you confirm it's you",
      "installExt.d": "For extensions that are not in the stores",
      "privacyAdvanced.d": "Cookies, permissions, passwords and more",
      "syncAccount.d": "Sign in to sync bookmarks, passwords and history",
      "exportSettings.d": "A .json file with all your Orbit settings",
      "importSettings.d": "Bring the settings of another PC",
      horizontalTabs: "Tabs on top", "horizontalTabs.d": "A classic tab bar instead of the sidebar. Spaces and settings with Ctrl+K",
      splitGrid: "Split view as a grid", "splitGrid.d": "With 3 or 4 pages, a 2 × 2 grid instead of columns",
      lockPin: "Orbit PIN", "lockPin.d": "Unlocks without Windows. Required when your Windows account has no password",
      lockStart: "Lock at startup", "lockStart.d": "Orbit opens locked",
      doh: "Secure DNS", "doh.d": "Encrypts DNS lookups (Cloudflare)", "doh.off": "Off", "doh.on": "On", "doh.max": "Strict",
      privacyAdvanced: "All privacy settings",
      "unload.adaptive": "Adaptive", "unload.d": "A sleeping tab uses almost nothing and reloads on click",
      budget: "Memory limit", "budget.d": "Above it, the oldest tabs go to sleep", "budget.off": "None",
      eco: "Eco mode", "eco.d": "2 processes instead of 4 (next start), still background, smaller image cache",
      memoryPage: "Memory per tab (orbit://memory)",
      processes: "Processes for pages", "processes.d": "Fewer = less memory; more = a heavy site slows the others less. Next start",
      bfcache: "Previous pages kept", "bfcache.d": "Instant back navigation, at a memory cost. 0 = lightest",
      imageCache: "Image cache", "imageCache.d": "Decoded images kept in memory",
      lowMemory: "Sleep tabs when the PC runs low on memory", "lowMemory.d": "Windows warns Orbit, which puts the oldest tabs to sleep",
      trim: "Free memory when Orbit is minimized", "trim.d": "Windows takes Orbit's memory back while its window is minimized",
      prefetch: "Preload links", "prefetch.d": "Faster pages when a site asks for it, a bit more network and memory",
      gpu: "Hardware acceleration", "gpu.d": "The graphics card draws pages. Off: less graphics memory, more processor. Next start",
      freeNow: "Free memory now", "freeNow.d": "Puts background tabs to sleep and gives unused memory back",
      adblock: "Ad blocker", "adblock.d": "uBlock Origin Lite: blocks ads and trackers at no memory cost",
      mediaPlayer: "Sidebar media player", "mediaPlayer.d": "Control music or video playing in another tab",
      aiProvider: "Panel assistant", "aiProvider.d": "Opens beside the page with Ctrl+Shift+U",
      aiPanel: "Open the assistant panel",
      aiSearch: "Ask AI from the address bar", "aiSearch.d": "Type @claude, @gpt, @perplexity or @mistral followed by your question",
      "notify.pin": "Pin to taskbar", "notify.pin.d": "Offered once at the start",
      "notify.default": "Default browser", "notify.default.d": "Ask when Orbit is not the default browser",
      "notify.update": "Update installed", "notify.update.d": "Tell me after an automatic update",
      "notify.sleep": "Tabs put to sleep", "notify.sleep.d": "When Orbit frees memory",
      "notify.tips": "Tips", "notify.tips.d": "Now and then, a useful shortcut",
      language: "Language", "language.d": "By default Orbit follows the Windows language",
      "lang.auto": "Automatic (system)", restart: "Restart to apply",
      font: "Font", "font.d": "Used across the whole interface", "font.add": "Add a font…",
      "font.system": "System font",
      spaceColors: "Space colors", custom: "Custom",
      scheme: "Theme", "scheme.dark": "Dark", "scheme.light": "Light", "scheme.system": "System",
      intensity: "Background intensity", radius: "Corner radius",
      quickColors: "Quick colors", grainAmount: "Grain amount", grainSize: "Grain size", "grainSize.d": "Small = fine grain, large = coarse grain",
      glass: "Liquid glass", "glass.d": "Highlights and translucency on tabs and bars",
      nebula: "Background motion", "nebula.d": "Color ribbons drift slowly (paused when the window is inactive)",
      grain: "Grain", "grain.d": "Fine texture on the background",
      animations: "Animations", "animations.d": "Transitions and motion effects",
      compact: "Compact mode", "compact.d": "Sidebar hidden, shown at the screen edge (Ctrl+Alt+C)",
      sidebarRight: "Sidebar on the right", sidebarWidth: "Sidebar width", gap: "Space around the page",
      commandbar: "Command bar", "commandbar.d": "Ctrl+T opens a floating search instead of an empty tab",
      glance: "Glance", "glance.d": "Alt+click a link to preview it",
      unload: "Put idle tabs to sleep",
      "unload.never": "Never",
      advanced: "Advanced settings", import: "Import from another browser",
      "about.tagline": "A calm, fast and beautiful browser.",
      "about.by": "Designed and built by",
      "about.engine": "Built on Gecko, the Firefox engine (MPL 2.0)",
      "about.credits": "Lucide icons (ISC) · Outfit, Inter, Manrope, Space Grotesk, DM Sans fonts (SIL OFL)",
      "about.update": "Check for updates", "about.source": "Source code",
    },
  },

  toggle() {
    if (document.getElementById("orbit-settings")) this.close();
    else this.open();
  },

  GROUPS: [
    ["personal", ["general", "look", "effects", "mods", "layout"]],
    ["web", ["browsing", "downloads", "ai"]],
    ["protection", ["privacy", "memory"]],
    ["system", ["sessions", "notify", "shortcuts"]],
  ],

  DESC() {
    return {
      personal: Orbit.tr("Personalization", "Personnalisation"), web: Orbit.tr("Browsing", "Navigation"),
      protection: Orbit.tr("Protection", "Protection"), system: Orbit.tr("System", "Système"),
      general: Orbit.tr("Language, startup, updates and font.", "Langue, démarrage, mises à jour et police."),
      look: Orbit.tr("Theme, colors and background of Orbit.", "Thème, couleurs et fond d'Orbit."),
      effects: Orbit.tr("Motion, glass and texture. Mods change anything.", "Mouvement, verre et texture. Les mods changent tout le reste."),
      layout: Orbit.tr("Where things sit and how much room they take.", "Où sont les éléments et la place qu'ils prennent."),
      browsing: Orbit.tr("How tabs, links and media behave.", "Le comportement des onglets, des liens et des médias."),
      downloads: Orbit.tr("Orbit Turbo splits big downloads over several connections when it helps.", "Orbit Turbo découpe les gros téléchargements sur plusieurs connexions quand ça aide."),
      ai: Orbit.tr("The assistant beside the page and AI search.", "L'assistant à côté de la page et la recherche par IA."),
      privacy: Orbit.tr("Blocking, encryption and the tunnel. Safe defaults, all adjustable.", "Blocage, chiffrement et tunnel. Des réglages sûrs par défaut, tous modifiables."),
      memory: Orbit.tr("Performance presets and sleeping tabs.", "Préréglages de performances et mise en veille des onglets."),
      notify: Orbit.tr("What Orbit may tell you about.", "Ce qu'Orbit peut te signaler."),
      shortcuts: Orbit.tr("Keyboard shortcuts.", "Les raccourcis clavier."),
      sessions: Orbit.tr("Save your tabs under a name and bring them back later. Move your settings to another PC.",
        "Enregistre tes onglets sous un nom et retrouve-les plus tard. Emporte tes réglages sur un autre PC."),
      mods: Orbit.tr("Change anything in Orbit's look.", "Change tout le style d'Orbit."),
      about: "",
    };
  },

  open(sectionId = this._last ?? "general") {
    this.close(true);
    const h = Orbit.h.bind(Orbit);
    const fr = Orbit.lang() == "fr";
    const nav = h("div", { class: "orbit-settings-nav" });
    const body = h("div", { class: "orbit-settings-body" });
    const title = h("div", { class: "orbit-settings-h" });
    const search = h("input", {
      class: "orbit-settings-search-input", type: "search", placeholder: Orbit.tr("Search settings", "Rechercher un réglage"),
      oninput: () => this.filter(search.value),
    });
    const reset = h("button", { class: "orbit-settings-reset", onclick: () => this.resetSection(this._last) }, Orbit.tr("Reset", "Réinitialiser"));
    const sheet = h("div", { id: "orbit-settings", onmousedown: e => e.target == sheet && this.close() },
      h("div", { class: "orbit-settings-card" },
        h("div", { class: "orbit-settings-side" },
          h("div", { class: "orbit-settings-brand" },
            h("span", { class: "orbit-settings-logo-box" }, h("img", { class: "orbit-settings-logo", src: `${Orbit.BASE}orbit-logo.svg`, alt: "" })),
            h("div", {}, h("span", {}, this.t("title")), h("small", {}, `Orbit ${Services.appinfo.version}`))),
          h("label", { class: "orbit-settings-search" }, Orbit.icon("search"), search),
          nav),
        h("div", { class: "orbit-settings-main" },
          h("div", { class: "orbit-settings-top" },
            h("div", { class: "orbit-settings-heading" }, title),
            reset,
            h("button", { class: "orbit-icon-button", title: "Esc", onclick: () => this.close() }, Orbit.icon("x"))),
          body)
      )
    );
    const sub = h("div", { class: "orbit-settings-sub" });
    title.after(sub);
    const desc = this.DESC();
    const setTitle = id => {
      title.textContent = this.t(id);
      sub.textContent = desc[id] ?? "";
      sub.hidden = !sub.textContent;
    };
    this.show = id => {
      this._last = id;
      search.value = "";
      reset.hidden = !this.SECTIONS.find(s => s.id == id).items.some(i => i.pref);
      for (const b of nav.children) b.toggleAttribute("active", b.dataset.id == id);
      setTitle(id);
      const section = this.SECTIONS.find(s => s.id == id);
      body.replaceChildren(...this.group(section.items.map(item => this.decorate(this.render(item), item, id)).filter(Boolean)));
      body.scrollTop = 0;
      if (!window.gReduceMotion) {
        body.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }],
          { duration: 260, easing: "cubic-bezier(.2,.9,.25,1)" });
      }
    };
    this.filter = q => {
      const norm = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const needle = norm(q.trim());
      if (!needle) return this.show(this._last);
      for (const b of nav.children) b.removeAttribute("active");
      title.textContent = `${Orbit.tr("Results for ", "Résultats pour ")}« ${q.trim()} »`;
      sub.hidden = true;
      reset.hidden = true;
      const out = [];
      for (const section of this.SECTIONS) {
        if (section.id == "about") continue;
        const rows = section.items.map(item => this.decorate(this.render(item), item, section.id))
          .filter(el => el && norm(el.textContent).includes(needle));
        if (rows.length) out.push(h("div", { class: "orbit-settings-group" }, this.t(section.id)), ...this.group(rows));
      }
      body.replaceChildren(...(out.length ? out : [h("div", { class: "orbit-setting-desc orbit-settings-empty" },
        Orbit.tr("No setting matches.", "Aucun réglage ne correspond."))]));
    };
    const tab = s => h("button", { class: "orbit-settings-tab", "data-id": s.id, onclick: () => this.show(s.id) },
      Orbit.icon(s.icon), h("span", {}, this.t(s.id)));
    for (const [gid, ids] of this.GROUPS) {
      nav.append(h("div", { class: "orbit-settings-navlabel" }, desc[gid]));
      for (const id of ids) nav.append(tab(this.SECTIONS.find(s => s.id == id)));
    }
    nav.append(h("div", { class: "orbit-settings-spacer" }), tab(this.SECTIONS.find(s => s.id == "about")));
    document.body.append(sheet);
    this.show(sectionId);
    if (sectionId == "general") search.focus();
    this._onKey = e => {
      if (e.key != "Escape" || OrbitPalette.recording) return;
      e.preventDefault();
      if (search.value) return this.filter((search.value = ""));
      if (!this.closeMenus()) this.close();
    };
    window.addEventListener("keydown", this._onKey, true);
  },

  resetSection(id) {
    for (const item of this.SECTIONS.find(s => s.id == id)?.items ?? []) {
      if (item.pref) Services.prefs.clearUserPref(item.pref);
    }
    this.show(id);
  },

  close(instant = false) {
    const sheet = document.getElementById("orbit-settings");
    window.removeEventListener("keydown", this._onKey, true);
    if (!sheet) return;
    if (instant) return sheet.remove();
    sheet.setAttribute("closing", "true");
    setTimeout(() => sheet.remove(), 180);
  },

  decorate(el, item, sectionId) {
    if (!el) return el;
    if (item.kind == "toggle") {
      el.classList.add("orbit-setting-clickable");
      el.addEventListener("click", e => !e.target.closest(".orbit-switch, button, a") && el.querySelector(".orbit-switch")?.click());
    }
    if (item.pref && Services.prefs.prefHasUserValue(item.pref)) {
      const reset = Orbit.h("button", { class: "orbit-setting-reset", title: Orbit.tr("Back to Orbit's default", "Revenir au réglage d'Orbit") },
        Orbit.icon("rotate-ccw"), Orbit.tr("Reset", "Rétablir"));
      reset.addEventListener("click", e => {
        e.stopPropagation();
        Services.prefs.clearUserPref(item.pref);
        this.show(sectionId);
      });
      el.querySelector(".orbit-setting-label")?.append(reset);
    }
    return el;
  },

  row(control, labelKey, extra = null) {
    const h = Orbit.h.bind(Orbit);
    const desc = this.t(`${labelKey}.d`);
    return h("div", { class: "orbit-setting" },
      h("div", { class: "orbit-setting-text" },
        h("div", { class: "orbit-setting-label" }, this.t(labelKey)),
        desc != `${labelKey}.d` ? h("div", { class: "orbit-setting-desc" }, desc) : null,
        extra),
      control);
  },

  render(item) {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    switch (item.kind) {
      case "toggle": {
        const read = () => Orbit.pref(item.pref, item.def ?? true) != !!item.invert;
        return this.row(this.switch(read(), on => p.setBoolPref(item.pref, on != !!item.invert)), item.label);
      }
      case "range":
        return this.row(this.slider({
          min: item.min, max: item.max, unit: typeof item.unit == "function" ? item.unit() : item.unit, value: Orbit.pref(item.pref, item.min),
          onInput: v => p.setIntPref(item.pref, v),
        }), item.label);
      case "choice":
        return this.row(this.segmented(item.options.map(([v, key]) => [v, this.t(key)]),
          Orbit.pref(item.pref, 0), v => p.setIntPref(item.pref, v)), item.label);
      case "link":
        return h("button", { class: "orbit-setting orbit-setting-link", onclick: () => { this.close(); item.action(); } },
          h("div", { class: "orbit-setting-text" }, h("div", { class: "orbit-setting-label" }, this.t(item.label)),
            this.t(`${item.label}.d`) != `${item.label}.d` ? h("div", { class: "orbit-setting-desc" }, this.t(`${item.label}.d`)) : null),
          Orbit.icon(item.icon ?? "chevron-right"));
      case "choice-str":
        return this.row(this.segmented(item.options, Orbit.pref(item.pref, ""), v => p.setStringPref(item.pref, v)), item.label);
      case "info":
        return this.row(null, item.label);
      case "updates": {
        const fr = Orbit.lang() == "fr";
        const seg = this.segmented([["auto", Orbit.tr("Automatic", "Automatiques")], ["ask", Orbit.tr("Ask me", "Me demander")]], "auto",
          v => OrbitUpdates.setAuto(v == "auto"));
        OrbitUpdates.isAuto().then(auto => !auto && seg.querySelector('[data-v="ask"]')?.click());
        return this.row(seg, "updates");
      }
      case "scheme":
        return this.renderScheme();
      case "autostart": {
        const { LaunchOnLogin } = ChromeUtils.importESModule("resource://gre/modules/LaunchOnLogin.sys.mjs");
        if (!LaunchOnLogin.isSupported()) return null;
        const sw = this.switch(false, on => (on ? LaunchOnLogin.enable() : LaunchOnLogin.disable())
          .catch(e => console.error("Orbit autostart", e)));
        LaunchOnLogin.isEnabled().then(on => {
          sw.toggleAttribute("on", on);
          sw.setAttribute("aria-checked", String(on));
        }).catch(() => {});
        return this.row(sw, "autostart");
      }
      case "fortress": {
        const fr = Orbit.lang() == "fr";
        const h = Orbit.h.bind(Orbit);
        return h("div", { class: "orbit-setting orbit-setting-col orbit-fortress", on: OrbitSecurity.on },
          h("div", { class: "orbit-vpn-head" },
            h("div", { class: "orbit-setting-text" },
              h("div", { class: "orbit-setting-label" }, Orbit.tr("Fortress mode", "Mode forteresse")),
              h("div", { class: "orbit-setting-desc" }, Orbit.tr("Maximum security: JavaScript without JIT compilers, no WebGL or WebRTC, HTTPS only, strict tracking protection and anti-fingerprinting. Some sites get slower or less compatible.", "Sécurité maximale : moteur JavaScript sans compilateur JIT, pas de WebGL ni WebRTC, HTTPS obligatoire, anti-pistage strict et anti-empreinte. Certains sites seront plus lents ou moins compatibles."))),
            this.switch(OrbitSecurity.on, v => { OrbitSecurity.set(v); this.show(this._last); })));
      }
      case "sessions":
        return this.renderSessions();
      case "betaKey": {
        if (!OrbitBeta.site()) return null;
        const key = Orbit.pref(OrbitBeta.KEY, "");
        const status = h("div", { class: "orbit-setting-desc" }, key
          ? `${key.slice(0, 6)}…${key.slice(-4)} · ${OrbitBeta.state == "ok" ? Orbit.tr("active", "active") : OrbitBeta.error || Orbit.tr("not active", "inactive")}`
          : Orbit.tr("No key on this device.", "Aucune clé sur cet appareil."));
        const change = h("button", { class: "orbit-button" }, key ? Orbit.tr("Change", "Changer") : Orbit.tr("Enter a key", "Entrer une clé"));
        change.addEventListener("click", async () => {
          const value = { value: "" };
          if (!Services.prompt.prompt(window, "Orbit", Orbit.tr("Your Orbit beta key:", "Ta clé bêta Orbit :"), value, null, {})) return;
          const r = await OrbitBeta.activate(value.value);
          if (!r.ok) Services.prompt.alert(window, "Orbit", r.error);
          this.show(this._last);
        });
        const remove = key ? h("button", { class: "orbit-icon-button", title: Orbit.tr("Remove the key", "Retirer la clé") }, Orbit.icon("trash-2")) : null;
        remove?.addEventListener("click", () => {
          OrbitBeta.forget();
          this.show(this._last);
        });
        return h("div", { class: "orbit-setting" },
          h("div", { class: "orbit-setting-text" }, h("div", { class: "orbit-setting-label" }, Orbit.tr("Orbit beta key", "Clé bêta d'Orbit")), status),
          h("div", { class: "orbit-session-actions" }, remove, change));
      }
      case "lockPin": {
        const label = () => (OrbitLock.hasPin() ? Orbit.tr("Change", "Changer") : Orbit.tr("Set", "Définir"));
        const set = h("button", { class: "orbit-button" }, label());
        const remove = h("button", { class: "orbit-icon-button", title: Orbit.tr("Remove the PIN", "Retirer le code PIN"), hidden: !OrbitLock.hasPin() },
          Orbit.icon("trash-2"));
        const refresh = () => {
          set.textContent = label();
          remove.hidden = !OrbitLock.hasPin();
        };
        set.addEventListener("click", () => OrbitPalette.ask(Orbit.tr("New Orbit PIN (4 characters or more)", "Nouveau code PIN Orbit (4 caractères ou plus)"),
          async pin => {
            if (pin.length < 4) return;
            await OrbitLock.setPin(pin);
            refresh();
          }, { secret: true }));
        remove.addEventListener("click", async () => {
          await OrbitLock.setPin(null);
          refresh();
        });
        return this.row(h("div", { class: "orbit-session-actions" }, remove, set), "lockPin");
      }
      case "sync":
        return this.row(this.switch(OrbitSessions.isSynced(), on => OrbitSessions.setSynced(on)), "sync");
      case "vault":
        return this.renderVault();
      case "mods":
        return this.renderMods();
      case "presets":
        return this.renderPresets();
      case "background":
        return this.renderBackground();
      case "strict":
        return this.row(this.switch(Orbit.pref("browser.contentblocking.category", "standard") == "strict",
          on => p.setStringPref("browser.contentblocking.category", on ? "strict" : "standard")), "strict");
      case "chrome-allow":
        return this.row(this.switch(Orbit.pref("orbit.chrome.exts.allowed", false), on => {
          Services.prefs.setBoolPref("orbit.chrome.exts.allowed", on);
          if (on) OrbitChromeExt.loadSaved().catch(e => console.error("Orbit: Chrome extension", e));
          else OrbitChromeExt.unloadAll().catch(e => console.error("Orbit: Chrome extension", e));
        }), "unsigned");
      case "vpn":
        return OrbitVPN.AVAILABLE ? this.renderVPN() : null;
      case "shortcuts":
        return this.renderShortcuts();
      case "freeNow": {
        const btn = h("button", { class: "orbit-button", onclick: async () => {
          btn.disabled = true;
          const freed = await OrbitMemory.freeNow();
          btn.disabled = false;
          OrbitNotify.show({ kind: "memory", icon: "gauge", tone: "ok", title: this.t("freeNow"), timeout: 3500,
            text: Orbit.tr("{n} tabs put to sleep, {m} freed", "{n} onglets mis en veille, {m} libérés")
              .replace("{n}", freed.slept).replace("{m}", OrbitMemory.fmt(freed.bytes)) });
        } }, Orbit.icon("zap"), Orbit.tr("Free", "Libérer"));
        return this.row(btn, "freeNow");
      }
      case "eco":
        return this.row(this.switch(Orbit.pref("orbit.memory.eco", false), on => OrbitMemory.setEco(on)), "eco");
      case "addon": {
        const row = this.row(this.switch(true, async on => {
          const addon = await AddonManager.getAddonByID(item.id);
          if (addon) await (on ? addon.enable() : addon.disable());
        }), item.label);
        AddonManager.getAddonByID(item.id).then(a => {
          if (!a) row.remove();
          else if (a.userDisabled) row.lastChild.click();
        });
        return row;
      }
      case "spacecolors":
        return this.renderSpaceColors();
      case "language":
        return this.renderLanguage();
      case "font":
        return this.renderFont();
      case "about":
        return this.renderAbout();
    }
    return null;
  },

  renderVault() {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const fr = Orbit.lang() == "fr";
    const { LoginHelper } = ChromeUtils.importESModule("resource://gre/modules/LoginHelper.sys.mjs");
    const locked = LoginHelper.isPrimaryPasswordSet();
    const status = h("span", { class: "orbit-vault-status", ok: locked },
      locked ? (Orbit.tr("Passwords encrypted", "Mots de passe chiffrés")) : (Orbit.tr("Passwords not protected", "Mots de passe non protégés")));
    const row = (label, desc, on, set) => h("label", { class: "orbit-vpn-toggle orbit-vault-row" },
      h("span", {}, h("b", {}, label), h("small", {}, desc)), this.switch(on, set));
    return h("div", { class: "orbit-setting orbit-setting-col orbit-vault" },
      h("div", { class: "orbit-vpn-head" },
        h("div", { class: "orbit-setting-text" },
          h("div", { class: "orbit-setting-label" }, Orbit.tr("Anti-theft vault", "Coffre-fort anti-vol")),
          h("div", { class: "orbit-setting-desc" }, Orbit.tr("If malware copies your profile, it cannot read anything without your primary password.", "Si un logiciel malveillant copie ton profil, il ne peut rien lire sans ton mot de passe principal."))),
        status),
      h("button", { class: locked ? "orbit-button" : "orbit-button primary", onclick: () => {
        window.openDialog("chrome://mozapps/content/preferences/changemp.xhtml", "", "centerscreen,chrome,modal,titlebar");
        this.show(this._last);
      } }, Orbit.icon("shield"), locked ? (Orbit.tr("Change primary password", "Changer le mot de passe principal"))
        : (Orbit.tr("Create a primary password", "Créer un mot de passe principal"))),
      row(Orbit.tr("Windows Hello to view passwords", "Windows Hello pour voir les mots de passe"),
        Orbit.tr("Your PIN or face before showing or exporting a password", "Ton code PIN ou ton visage avant d'afficher ou d'exporter un mot de passe"),
        Orbit.pref("signon.management.page.os-auth.locked.enabled", true),
        on => p.setBoolPref("signon.management.page.os-auth.locked.enabled", on)),
      row(Orbit.tr("Clear cookies and sessions on close", "Effacer cookies et sessions à la fermeture"),
        Orbit.tr("Stolen cookies become useless. You will sign in to sites again.", "Un vol de cookies ne sert à rien. Tu devras te reconnecter à tes sites."),
        Orbit.pref("privacy.clearOnShutdown_v2.cookiesAndStorage", false) && Orbit.pref("privacy.sanitize.sanitizeOnShutdown", false),
        on => {
          p.setBoolPref("privacy.sanitize.sanitizeOnShutdown", on);
          p.setBoolPref("privacy.clearOnShutdown_v2.cookiesAndStorage", on);
        }));
  },

  renderScheme() {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const cur = Orbit.pref("browser.theme.toolbar-theme", 2);
    const pick = v => {
      p.setIntPref("browser.theme.toolbar-theme", v);
      p.setIntPref("browser.theme.content-theme", v);
      for (const c of cards.children) c.toggleAttribute("active", +c.dataset.v == v);
    };
    const card = (v, cls, label) => h("button", { class: "orbit-scheme", "data-v": String(v), active: v == cur, onclick: () => pick(v) },
      h("span", { class: `orbit-scheme-prev ${cls}` }, h("i"), h("b"), h("u")), h("span", {}, label));
    const cards = h("div", { class: "orbit-schemes" },
      card(2, "p-system", this.t("scheme.system")), card(1, "p-light", this.t("scheme.light")), card(0, "p-dark", this.t("scheme.dark")));
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-setting-text" },
        h("div", { class: "orbit-setting-label" }, this.t("scheme")),
        h("div", { class: "orbit-setting-desc" }, this.t("scheme.d"))),
      cards);
  },

  group(rows) {
    const h = Orbit.h.bind(Orbit);
    const out = [];
    let card = null;
    for (const el of rows) {
      const wide = el.classList.contains("orbit-setting-col") || !el.classList.contains("orbit-setting");
      if (wide || el.classList.contains("orbit-setting-link") != !!card?.dataset.links) card = null;
      if (wide) {
        out.push(el.classList.contains("orbit-setting") ? h("div", { class: "orbit-card" }, el) : el);
        continue;
      }
      if (!card) out.push((card = h("div", { class: "orbit-card", "data-links": el.classList.contains("orbit-setting-link") ? "1" : "" })));
      card.append(el);
    }
    return out;
  },

  renderBackground() {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const fr = Orbit.lang() == "fr";
    const type = Orbit.pref("orbit.background.type", "liquid");
    const extra = h("div", { class: "orbit-bg-extra" });
    const fillExtra = t => {
      const kids = [];
      if (t == "image" || t == "video") {
        kids.push(h("button", { class: "orbit-button", onclick: async () => {
          if (await OrbitBackground.choose()) this.show(this._last);
        } }, Orbit.icon("upload"), Orbit.tr("Choose a file…", "Choisir un fichier…")));
      }
      if (t == "color") {
        kids.push(h("input", { type: "color", class: "orbit-bg-color", value: Orbit.pref("orbit.background.color", "#0b0b14"),
          oninput: e => p.setStringPref("orbit.background.color", e.target.value) }));
      }
      if (t != "liquid") {
        kids.push(h("span", { class: "orbit-setting-desc" }, Orbit.tr("Dim", "Assombrir")),
          this.slider({ min: 0, max: 85, unit: " %", value: Orbit.pref("orbit.background.dim", 35),
            onInput: v => p.setIntPref("orbit.background.dim", v) }));
      }
      extra.replaceChildren(...kids);
    };
    fillExtra(type);
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-vpn-head" },
        h("div", { class: "orbit-setting-text" },
          h("div", { class: "orbit-setting-label" }, Orbit.tr("Background", "Fond")),
          h("div", { class: "orbit-setting-desc" }, Orbit.tr("Orbit's liquid background, your picture, a looping video or a color", "Le fond liquide d'Orbit, ta photo, une vidéo en boucle ou une couleur"))),
        this.segmented([["liquid", Orbit.tr("Liquid", "Liquide")], ["image", "Image"], ["video", Orbit.tr("Video", "Vidéo")], ["color", Orbit.tr("Color", "Couleur")]],
          type, v => {
            fillExtra(v);
            if (v == "liquid" || v == "color" || Orbit.pref("orbit.background.file", "")) p.setStringPref("orbit.background.type", v);
          })),
      extra);
  },

  renderPresets() {
    const h = Orbit.h.bind(Orbit);
    const PLANETS = [
      ["mercure", Orbit.tr("Mercury", "Mercure"), Orbit.tr("Maximum speed", "Vitesse maximale"), "#c9a27e"],
      ["venus", Orbit.tr("Venus", "Vénus"), Orbit.tr("Balanced", "Équilibré"), "#e8c26a"],
      ["saturne", Orbit.tr("Saturn", "Saturne"), Orbit.tr("Light on memory", "Économe"), "#d8b98a"],
      ["neptune", Orbit.tr("Neptune", "Neptune"), Orbit.tr("Ultra light", "Ultra léger"), "#5b7cff"],
    ];
    const current = Orbit.pref("orbit.performance.preset", "venus");
    const note = h("div", { class: "orbit-setting-desc", hidden: true }, this.t("restart"));
    const cards = h("div", { class: "orbit-presets" }, ...PLANETS.map(([id, name, desc, color]) =>
      h("button", { class: "orbit-preset", active: id == current, style: `--planet:${color}`, onclick: e => {
        OrbitMemory.applyPreset(id);
        for (const c of cards.children) c.toggleAttribute("active", c == e.currentTarget);
        note.hidden = false;
      } }, h("span", { class: "orbit-planet" }), h("b", {}, name), h("small", {}, desc))));
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-setting-text" },
        h("div", { class: "orbit-setting-label" }, Orbit.tr("Performance", "Performances")),
        h("div", { class: "orbit-setting-desc" }, Orbit.tr("A preset per planet, from the fastest to the lightest. Every setting below stays adjustable.",
          "Un préréglage par planète, du plus rapide au plus léger. Chaque réglage ci-dessous reste modifiable."))),
      cards, note);
  },

  renderMods() {
    const h = Orbit.h.bind(Orbit);
    const list = h("div", { class: "orbit-mods" });
    const fill = async () => {
      const mods = await OrbitMods.list();
      const off = OrbitMods.disabled();
      list.replaceChildren(...(mods.length ? mods.map(m => this.modCard(m, !off.has(m.id), fill))
        : [h("div", { class: "orbit-mods-empty" }, Orbit.icon("sparkles"),
          h("b", {}, Orbit.tr("No mods yet", "Aucun mod pour l'instant")),
          h("span", {}, Orbit.tr("Browse mods or make your own.", "Parcours les mods ou crée le tien.")))]));
    };
    fill();
    const open = url => { this.close(); gBrowser.selectedTab = gBrowser.addTrustedTab(url); };
    return h("div", { class: "orbit-mods-page" },
      h("div", { class: "orbit-mods-actions" },
        h("button", { class: "orbit-button primary", onclick: () => open(OrbitMods.community() ? `${OrbitMods.community()}/mods` : "https://zen-browser.app/mods/") },
          Orbit.icon("sparkles"), Orbit.tr("Browse mods", "Parcourir les mods")),
        h("button", { class: "orbit-button", onclick: async () => {
          const name = { value: Orbit.tr("My mod", "Mon mod") };
          if (!Services.prompt.prompt(window, "Orbit", Orbit.tr("Name of the new mod:", "Nom du nouveau mod :"), name, null, {})) return;
          await OrbitMods.create(name.value.trim() || "Mod");
          fill();
        } }, Orbit.icon("plus"), Orbit.tr("Create a mod", "Créer un mod")),
        h("button", { class: "orbit-button", onclick: () => OrbitMods.openFolder() }, Orbit.icon("external-link"), Orbit.tr("Folder", "Dossier")),
        h("button", { class: "orbit-button", onclick: async () => { await OrbitMods.apply(); fill(); } },
          Orbit.icon("refresh-cw"), Orbit.tr("Reload", "Recharger"))),
      list);
  },

  modCard(m, on, refresh) {
    const h = Orbit.h.bind(Orbit);
    const prefs = h("div", { class: "orbit-mod-prefs", hidden: true }, ...m.prefs.map(p => this.modPref(p)));
    const img = /^https:\/\/raw\.githubusercontent\.com\//.test(m.image) ? h("img", { src: m.image, alt: "" }) : Orbit.icon("sparkles");
    return h("div", { class: "orbit-card orbit-mod" },
      h("div", { class: "orbit-mod-row" },
        h("span", { class: "orbit-mod-img" }, img),
        h("div", { class: "orbit-mod-text" },
          h("b", {}, m.name, m.version ? h("small", {}, ` ${m.version}`) : null),
          h("span", {}, m.description || (m.author ? Orbit.tr("by ", "par ") + m.author : m.file ? ".css" : ""))),
        m.prefs.length ? h("button", { class: "orbit-icon-button", title: Orbit.tr("Settings", "Réglages"), onclick: () => (prefs.hidden = !prefs.hidden) },
          Orbit.icon("settings-2")) : null,
        m.zen ? h("button", { class: "orbit-icon-button", title: Orbit.tr("Update", "Mettre à jour"), onclick: async e => {
          const b = e.currentTarget;
          b.disabled = true;
          const updated = await OrbitMods.update(m.id).catch(() => false);
          b.disabled = false;
          OrbitNotify.show({ kind: "mod", icon: "sparkles", title: m.name, timeout: 2500,
            text: updated ? Orbit.tr("Updated.", "Mis à jour.") : Orbit.tr("Already up to date.", "Déjà à jour.") });
          if (updated) refresh();
        } }, Orbit.icon("refresh-cw")) : null,
        h("button", { class: "orbit-icon-button", title: Orbit.tr("Remove", "Retirer"), onclick: async () => {
          if (!Services.prompt.confirm(window, m.name, Orbit.tr("Remove this mod?", "Retirer ce mod ?"))) return;
          await OrbitMods.remove(m.id);
          refresh();
        } }, Orbit.icon("trash-2")),
        this.switch(on, v => OrbitMods.toggle(m.id, v))),
      prefs);
  },

  modPref(p) {
    const h = Orbit.h.bind(Orbit);
    const v = OrbitMods.prefValue(p);
    let control;
    if (p.type == "checkbox") control = this.switch(!!v, x => OrbitMods.setPref(p, x));
    else if (p.type == "dropdown") {
      const options = (p.options ?? []).map(o => ({ value: String(o.value), label: o.label ?? String(o.value) }));
      if (p.placeholder) options.unshift({ value: "none", label: p.placeholder });
      control = this.dropdown(options, String(v || "none"), x => OrbitMods.setPref(p, x));
    } else {
      const input = h("input", { class: "orbit-input", value: v, spellcheck: "false", onchange: () => OrbitMods.setPref(p, input.value) });
      control = input;
    }
    return h("div", { class: "orbit-setting" }, h("div", { class: "orbit-setting-text" }, h("div", { class: "orbit-setting-label" }, p.label ?? p.property)), control);
  },

  renderVPN() {
    const h = Orbit.h.bind(Orbit);
    const p = Services.prefs;
    const fr = Orbit.lang() == "fr";
    const input = h("input", {
      class: "orbit-input", placeholder: "socks5://127.0.0.1:9050", spellcheck: "false",
      value: Orbit.pref("orbit.vpn.server", ""),
      onchange: () => {
        const v = input.value.trim();
        const ok = !v || OrbitVPN.parse(v);
        input.toggleAttribute("invalid", !ok);
        if (ok) p.setStringPref("orbit.vpn.server", v);
      },
    });
    const custom = h("div", { class: "orbit-vpn-custom" }, input,
      h("div", { class: "orbit-setting-desc" }, Orbit.tr("Your own SOCKS5 or HTTPS server: a VPS, Tor (socks5://127.0.0.1:9050) or a VPN app's proxy.", "Ton propre serveur SOCKS5 ou HTTPS : un VPS, Tor (socks5://127.0.0.1:9050) ou le proxy d'une appli VPN.")));
    const sync = () => (custom.hidden = Orbit.pref("orbit.vpn.mode", "custom") != "custom");
    sync();
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-vpn-head" },
        h("div", { class: "orbit-setting-text" },
          h("div", { class: "orbit-setting-label" }, "Orbit VPN"),
          h("div", { class: "orbit-setting-desc" }, Orbit.tr("Hides your IP address. DNS goes through the tunnel and WebRTC cannot reveal your real IP.", "Masque ton adresse IP. Les DNS passent par le tunnel et WebRTC ne peut pas révéler ta vraie IP."))),
        this.switch(Orbit.pref("orbit.vpn.enabled", false), on => OrbitVPN.apply(on))),
      custom);
  },

  SHORTCUTS: [
    ["Ctrl T", "Nouvel onglet / barre de commande", "New tab / command bar"],
    ["Ctrl Maj Espace", "Rechercher un onglet", "Search tabs"],
    ["Ctrl Maj U", "Assistant IA", "AI assistant"],
    ["Alt clic", "Aperçu d'un lien (Glance)", "Preview a link (Glance)"],
    ["Ctrl Alt C", "Mode compact", "Compact mode"],
    ["Alt 1 – 9", "Aller à l'espace 1 à 9", "Go to space 1 to 9"],
    ["Ctrl Alt ← →", "Espace précédent / suivant", "Previous / next space"],
    ["Ctrl Maj D", "Dupliquer l'onglet", "Duplicate tab"],
    ["Ctrl Maj T", "Rouvrir l'onglet fermé", "Reopen closed tab"],
    ["Ctrl ,", "Paramètres", "Settings"],
    ["Ctrl K", "Palette de commandes", "Command palette"],
    ["Ctrl Maj F", "Mode concentration", "Focus mode"],
    ["Ctrl Alt L", "Verrouiller Orbit", "Lock Orbit"],
    ["Ctrl Maj ]", "Picture-in-Picture", "Picture-in-Picture"],
  ],

  renderSessions() {
    const h = Orbit.h.bind(Orbit);
    const list = h("div", { class: "orbit-sessions" });
    const fill = async () => {
      const all = await OrbitSessions.list();
      list.replaceChildren(...all.map(s => h("div", { class: "orbit-setting" },
        h("div", { class: "orbit-setting-text" },
          h("div", { class: "orbit-setting-label" }, s.name), h("div", { class: "orbit-setting-desc" }, OrbitSessions.describe(s))),
        h("div", { class: "orbit-session-actions" },
          h("button", { class: "orbit-button", onclick: () => { this.close(); OrbitSessions.restore(s.id); } },
            Orbit.icon("rotate-ccw"), Orbit.tr("Restore", "Restaurer")),
          h("button", { class: "orbit-icon-button", title: Orbit.tr("Delete", "Supprimer"),
            onclick: async () => { await OrbitSessions.remove(s.id); fill(); } }, Orbit.icon("trash-2"))))));
    };
    fill();
    const save = h("button", { class: "orbit-button", onclick: () => OrbitPalette.ask(Orbit.tr("Name of the session", "Nom de la session"),
      async name => { await OrbitSessions.save(name); fill(); }) }, Orbit.icon("download"), Orbit.tr("Save", "Enregistrer"));
    return h("div", {}, this.row(save, "sessionSave"), list);
  },

  renderShortcuts() {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const custom = OrbitPalette.custom();
    const search = h("input", { class: "orbit-input orbit-sc-search", type: "search", spellcheck: "false",
      placeholder: tr("Search a shortcut or an action", "Rechercher un raccourci ou une action") });
    const resetAll = h("button", { class: "orbit-button", hidden: !Object.keys(custom).length },
      Orbit.icon("rotate-ccw"), tr("Reset all", "Tout rétablir"));
    resetAll.addEventListener("click", () => {
      Services.prefs.clearUserPref("orbit.shortcuts");
      this.show("shortcuts");
    });
    const groups = [
      [tr("Orbit basics", "Les bases d'Orbit"), "command", this.SHORTCUTS.map(([keys, frLabel, enLabel]) => ({ label: tr(enLabel, frLabel), keys }))],
      ...OrbitPalette.commands().map(([title, cmds]) => [title, null,
        cmds.filter(c => c[4]).map(([icon, label, , keys, id]) => ({ icon, label, keys, id }))]),
    ];
    const sections = groups.map(([title, icon, rows]) => h("section", { class: "orbit-sc-group" },
      h("div", { class: "orbit-sc-title" }, icon ? Orbit.icon(icon) : null, h("span", {}, title), h("span", { class: "orbit-sc-count" }, String(rows.length))),
      h("div", { class: "orbit-sc-card" }, ...rows.map(r => this.shortcutRow(r)))));
    const empty = h("div", { class: "orbit-setting-desc orbit-settings-empty", hidden: true }, tr("No shortcut matches.", "Aucun raccourci ne correspond."));
    search.addEventListener("input", () => {
      const norm = x => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      const q = norm(search.value.trim());
      let any = false;
      for (const sec of sections) {
        let shown = 0;
        for (const row of sec.querySelectorAll(".orbit-sc-row")) {
          row.hidden = !!q && !norm(row.textContent).includes(q);
          shown += !row.hidden;
        }
        sec.hidden = !shown;
        sec.querySelector(".orbit-sc-count").textContent = String(shown);
        any ||= !!shown;
      }
      empty.hidden = any;
    });
    search.addEventListener("keydown", e => e.key == "Escape" && search.value && (e.stopPropagation(), (search.value = ""), search.dispatchEvent(new Event("input"))));
    return h("div", { class: "orbit-sc" },
      h("div", { class: "orbit-sc-head" }, h("label", { class: "orbit-sc-searchbox" }, Orbit.icon("search"), search), resetAll),
      h("div", { class: "orbit-sc-hint" }, Orbit.icon("info"), tr(
        "Click a shortcut, then press the keys (with Ctrl or Alt). Backspace removes it, Esc cancels.",
        "Clique sur un raccourci puis appuie sur les touches (avec Ctrl ou Alt). Retour arrière le retire, Échap annule.")),
      ...sections, empty);
  },

  shortcutOwner(keys, exceptId) {
    const fixed = this.SHORTCUTS.find(([k]) => k == keys);
    if (fixed) return Orbit.tr(fixed[2], fixed[1]);
    return OrbitPalette.flat().find(c => c[3] == keys && c[4] != exceptId)?.[1] ?? null;
  },

  shortcutRow({ icon, label, keys, id }) {
    const h = Orbit.h.bind(Orbit);
    const tr = Orbit.tr.bind(Orbit);
    const show = k => (k ? k.split(" ").map(x => h("kbd", {}, OrbitPalette.keyName(x))) : [h("span", { class: "orbit-keys-none" }, tr("None", "Aucun"))]);
    const isCustom = id && !!OrbitPalette.custom()[id];
    const row = h("div", { class: "orbit-sc-row" },
      icon ? Orbit.icon(icon) : h("span", { class: "orbit-sc-dot" }),
      h("span", { class: "orbit-sc-label" }, label, isCustom ? h("span", { class: "orbit-sc-badge" }, tr("Custom", "Perso")) : null));
    if (!id) {
      row.append(h("span", { class: "orbit-keys orbit-sc-fixed", title: tr("Orbit's own shortcut", "Raccourci d'Orbit") }, ...show(keys)));
      return row;
    }
    const button = h("button", { class: "orbit-keys orbit-keys-edit", title: tr("Change the shortcut", "Changer le raccourci") }, ...show(keys));
    button.toggleAttribute("custom", isCustom);
    if (isCustom) {
      const reset = h("button", { class: "orbit-icon-button orbit-sc-reset", title: tr("Back to the default", "Revenir au réglage d'origine") }, Orbit.icon("rotate-ccw"));
      reset.addEventListener("click", () => {
        OrbitPalette.setCustom(id, null);
        this.show("shortcuts");
      });
      row.append(reset);
    }
    row.append(button);
    button.addEventListener("click", () => {
      if (OrbitPalette.recording) return;
      OrbitPalette.recording = true;
      row.setAttribute("recording", "true");
      button.replaceChildren(tr("Press the keys…", "Appuie sur les touches…"));
      const done = changed => {
        OrbitPalette.recording = false;
        window.removeEventListener("keydown", onKey, true);
        row.removeAttribute("recording");
        if (changed) return this.show("shortcuts");
        button.replaceChildren(...show(keys));
      };
      const onKey = e => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key == "Escape") return done(false);
        if (e.key == "Backspace" || e.key == "Delete") {
          OrbitPalette.setCustom(id, null);
          return done(true);
        }
        const combo = OrbitPalette.combo(e);
        if (!combo) return;
        const owner = this.shortcutOwner(combo, id);
        OrbitPalette.setCustom(id, combo);
        done(true);
        OrbitNotify.show({ kind: "shortcut", icon: "command", tone: "ok", timeout: 3500,
          title: `${label} · ${combo.split(" ").map(k => OrbitPalette.keyName(k)).join("+")}`,
          text: owner ? tr("Saved. It now replaces “{x}”.", "Enregistré. Il remplace maintenant « {x} ».").replace("{x}", owner)
            : tr("Shortcut saved.", "Raccourci enregistré.") });
      };
      window.addEventListener("keydown", onKey, true);
    });
    return row;
  },

  switch(on, onChange) {
    const h = Orbit.h.bind(Orbit);
    const sw = h("button", {
      class: "orbit-switch", role: "switch", "aria-checked": String(on), on,
      onclick: () => {
        on = !sw.hasAttribute("on");
        sw.toggleAttribute("on", on);
        sw.setAttribute("aria-checked", String(on));
        onChange(on);
      },
    }, h("span", { class: "orbit-switch-knob" }));
    return sw;
  },

  slider({ min, max, value, unit = "", step = 1, onInput }) {
    const h = Orbit.h.bind(Orbit);
    const fill = h("div", { class: "orbit-slider-fill" });
    const thumb = h("div", { class: "orbit-slider-thumb" });
    const out = h("span", { class: "orbit-slider-value" });
    const track = h("div", { class: "orbit-slider-track" }, fill, thumb);
    const el = h("div", { class: "orbit-slider", tabindex: 0, role: "slider", "aria-valuemin": min, "aria-valuemax": max },
      track, out);
    const set = (v, emit) => {
      v = Math.min(max, Math.max(min, Math.round(v / step) * step));
      const pct = ((v - min) / (max - min)) * 100;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      out.textContent = `${v}${unit}`;
      el.setAttribute("aria-valuenow", v);
      if (emit && v != value) onInput(v);
      value = v;
    };
    const fromEvent = e => {
      const r = track.getBoundingClientRect();
      set(min + ((e.clientX - r.left) / r.width) * (max - min), true);
    };
    el.addEventListener("pointerdown", e => {
      if (e.button != 0) return;
      el.setPointerCapture(e.pointerId);
      el.setAttribute("dragging", "true");
      fromEvent(e);
    });
    el.addEventListener("pointermove", e => el.hasPointerCapture(e.pointerId) && fromEvent(e));
    el.addEventListener("pointerup", e => {
      el.releasePointerCapture(e.pointerId);
      el.removeAttribute("dragging");
    });
    el.addEventListener("keydown", e => {
      const d = { ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step }[e.key];
      if (d) {
        e.preventDefault();
        set(value + d * (e.shiftKey ? 5 : 1), true);
      }
    });
    set(value, false);
    return el;
  },

  segmented(options, current, onChange) {
    const h = Orbit.h.bind(Orbit);
    const seg = h("div", { class: "orbit-segmented" });
    const pill = h("div", { class: "orbit-segmented-pill" });
    seg.append(pill);
    const sync = () => {
      const active = [...seg.querySelectorAll("button")].find(b => b.dataset.v == String(current));
      for (const b of seg.querySelectorAll("button")) b.toggleAttribute("active", b == active);
      if (active) {
        pill.style.width = `${active.offsetWidth}px`;
        pill.style.transform = `translateX(${active.offsetLeft - 3}px)`;
      }
    };
    for (const [v, label] of options) {
      seg.append(h("button", { "data-v": String(v), onclick: () => { current = v; sync(); onChange(v); } }, label));
    }
    requestAnimationFrame(sync);
    return seg;
  },

  dropdown(options, current, onChange, footer = null) {
    const h = Orbit.h.bind(Orbit);
    const label = h("span", {});
    const btn = h("button", { class: "orbit-dropdown-button" }, label, Orbit.icon("chevron-down"));
    const wrap = h("div", { class: "orbit-dropdown" }, btn);
    const sync = () => {
      const o = options.find(o => o.value == current) ?? options[0];
      label.textContent = o.label;
      label.style.fontFamily = o.font ? `"${o.font}"` : "";
    };
    btn.addEventListener("click", () => {
      if (this.closeMenus()) return;
      const menu = h("div", { class: "orbit-dropdown-menu" },
        ...options.map(o => h("button", {
          class: "orbit-dropdown-item", active: o.value == current,
          style: o.font ? `font-family: "${o.font}" !important` : null,
          onclick: () => { current = o.value; sync(); this.closeMenus(); onChange(o.value); },
        }, h("span", {}, o.label), o.value == current ? Orbit.icon("check") : null)),
        footer ? h("div", { class: "orbit-dropdown-sep" }) : null,
        footer);
      const host = document.getElementById("orbit-settings") ?? document.body;
      host.append(menu);
      const r = btn.getBoundingClientRect();
      const below = innerHeight - r.bottom - 12;
      const above = r.top - 12;
      const up = menu.offsetHeight > below && above > below;
      menu.style.maxHeight = `${Math.min(320, up ? above : below)}px`;
      menu.style.minWidth = `${r.width}px`;
      menu.style.right = `${innerWidth - r.right}px`;
      menu.style.top = up ? "" : `${r.bottom + 6}px`;
      menu.style.bottom = up ? `${innerHeight - r.top + 6}px` : "";
      menu.toggleAttribute("up", up);
      menu.closest("#orbit-settings")?.querySelector(".orbit-settings-body")
        ?.addEventListener("scroll", () => this.closeMenus(), { once: true });
      const outside = e => {
        if (menu.contains(e.target) || btn.contains(e.target)) return;
        window.removeEventListener("mousedown", outside, true);
        this.closeMenus();
      };
      window.addEventListener("mousedown", outside, true);
    });
    sync();
    return wrap;
  },

  closeMenus() {
    const open = document.querySelectorAll("#orbit-settings .orbit-dropdown-menu");
    for (const m of open) m.remove();
    return open.length > 0;
  },

  renderLanguage() {
    const h = Orbit.h.bind(Orbit);
    const available = Services.locale.availableLocales;
    const names = new Intl.DisplayNames([Services.locale.appLocaleAsBCP47], { type: "language" });
    const options = [{ value: "", label: this.t("lang.auto") }].concat(
      available.map(l => ({ value: l, label: names.of(l).replace(/^./, c => c.toUpperCase()) })));
    const current = Services.prefs.getCharPref("intl.locale.requested", "");
    const restart = h("button", {
      class: "orbit-button primary orbit-restart", hidden: true,
      onclick: () => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart),
    }, Orbit.icon("refresh-cw"), this.t("restart"));
    const dd = this.dropdown(options, current, v => {
      Services.prefs.setCharPref("intl.locale.requested", v);
      restart.hidden = false;
    });
    return this.row(dd, "language", restart);
  },

  renderFont() {
    const custom = OrbitLayout.customFonts();
    const options = this.FONTS.map(f => ({
      value: f, label: f == "Segoe UI Variable Text" ? this.t("font.system") : f, font: f,
    })).concat(custom.map(f => ({ value: f.name, label: f.name, font: f.name })));
    const add = Orbit.h("button", { class: "orbit-dropdown-item orbit-dropdown-add", onclick: () => this.addFont() },
      Orbit.icon("square-plus"), Orbit.h("span", {}, this.t("font.add")));
    return this.row(this.dropdown(options, Orbit.pref("orbit.theme.font", "Outfit"),
      v => Services.prefs.setStringPref("orbit.theme.font", v), add), "font");
  },

  addFont() {
    this.closeMenus();
    const fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
    fp.init(window.browsingContext, this.t("font.add"), Ci.nsIFilePicker.modeOpen);
    fp.appendFilter("Fonts", "*.ttf; *.otf; *.woff; *.woff2");
    fp.open(rv => {
      if (rv != Ci.nsIFilePicker.returnOK || !fp.file) return;
      const dir = Services.dirsvc.get("ProfD", Ci.nsIFile);
      dir.append("orbit-fonts");
      if (!dir.exists()) dir.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
      fp.file.copyTo(dir, null);
      const name = fp.file.leafName.replace(/\.(ttf|otf|woff2?)$/i, "").replace(/[-_]+/g, " ").trim();
      const list = OrbitLayout.customFonts().filter(f => f.name != name);
      list.push({ name, file: fp.file.leafName });
      Services.prefs.setStringPref("orbit.fonts.custom", JSON.stringify(list));
      Services.prefs.setStringPref("orbit.theme.font", name);
      this.show("general");
    });
  },

  renderSpaceColors() {
    const h = Orbit.h.bind(Orbit);
    const space = OrbitSpaces.active;
    const current = OrbitSpaces.theme(space);
    const apply = patch => {
      Object.assign(space, patch);
      OrbitSpaces.save();
      OrbitSpaces.update({ animate: false });
      this.show("look");
    };
    const grid = h("div", { class: "orbit-theme-grid" },
      ...OrbitSpaces.THEMES.map(th => h("button", {
        class: "orbit-pick-theme", active: space.theme == th.id, title: th.id,
        style: `--c1:${th.c1};--c2:${th.c2}`, onclick: () => apply({ theme: th.id }),
      })));
    const picker = key => {
      const input = h("input", {
        type: "color", value: current[key],
        onchange: e => apply({ theme: "custom", c1: current.c1, c2: current.c2, [key]: e.target.value }),
      });
      return h("label", { class: "orbit-swatch", style: `--c:${current[key]}` }, input);
    };
    return h("div", { class: "orbit-setting orbit-setting-col" },
      h("div", { class: "orbit-setting-label" }, `${this.t("spaceColors")} · ${space.name}`),
      grid,
      h("div", { class: "orbit-custom-colors", active: space.theme == "custom" },
        h("span", {}, this.t("custom")), picker("c1"), picker("c2")));
  },

  renderAbout() {
    const h = Orbit.h.bind(Orbit);
    const repo = "https://github.com/realshavkat/orbit";
    const open = url => { this.close(); gBrowser.selectedTab = gBrowser.addTrustedTab(url); };
    const version = Services.appinfo.version;
    return h("div", { class: "orbit-about" },
      h("div", { class: "orbit-about-hero" },
        h("img", { class: "orbit-about-logo", src: "chrome://branding/content/about-logo@2x.png", alt: "" }),
        h("div", {},
          h("div", { class: "orbit-about-name" }, "Orbit"),
          h("div", { class: "orbit-about-version" }, `${Orbit.tr("Version", "Version")} ${version} · ${Services.appinfo.XPCOMABI.includes("64") ? "64 bits" : "32 bits"}`),
          h("div", { class: "orbit-about-tagline" }, this.t("about.tagline")))),
      this.renderUpdater(),
      h("div", { class: "orbit-card orbit-about-links" },
        h("button", { class: "orbit-setting orbit-setting-link", onclick: () => open(`${repo}/releases/tag/${version}`) },
          h("div", { class: "orbit-setting-label" }, Orbit.tr("Release notes", "Notes de version")), Orbit.icon("external-link")),
        h("button", { class: "orbit-setting orbit-setting-link", onclick: () => open(repo) },
          h("div", { class: "orbit-setting-label" }, this.t("about.source")), Orbit.icon("code-xml")),
        h("button", { class: "orbit-setting orbit-setting-link", onclick: () => { this.close(); OrbitWelcome.show(); } },
          h("div", { class: "orbit-setting-label" }, Orbit.tr("Run the setup again", "Refaire la configuration")), Orbit.icon("sparkles"))),
      h("div", { class: "orbit-about-author" }, this.t("about.by"), " ", h("strong", {}, "shavkat"), " ",
        Orbit.icon("heart", "orbit-icon orbit-about-heart")),
      h("div", { class: "orbit-about-fine" }, this.t("about.engine")),
      h("div", { class: "orbit-about-fine" }, this.t("about.credits")));
  },

  renderUpdater() {
    const h = Orbit.h.bind(Orbit);
    const icon = h("span", { class: "orbit-upd-icon" }, Orbit.icon("refresh-cw"));
    const title = h("b", {});
    const sub = h("span", {});
    const bar = h("div", { class: "orbit-update-bar", hidden: true }, h("i"));
    const button = h("button", { class: "orbit-button primary", hidden: true });
    const card = h("div", { class: "orbit-card orbit-upd" },
      h("div", { class: "orbit-upd-row" }, icon, h("div", { class: "orbit-upd-text" }, title, sub), button), bar);
    const set = (state, t, d = "", action = null, label = "") => {
      card.dataset.state = state;
      title.textContent = t;
      sub.textContent = d;
      button.hidden = !action;
      button.textContent = label;
      button.onclick = action;
      if (state != "downloading") bar.hidden = true;
    };
    const { AppUpdater } = ChromeUtils.importESModule("resource://gre/modules/AppUpdater.sys.mjs");
    const updater = new AppUpdater();
    const S = AppUpdater.STATUS;
    const check = () => updater.check();
    const restart = () => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart);
    const listener = (status, ...args) => {
      if (!card.isConnected && card.dataset.state) return updater.removeListener(listener);
      const v = updater.update?.displayVersion || updater.update?.appVersion || "";
      switch (status) {
        case S.CHECKING:
          return set("checking", Orbit.tr("Checking for updates…", "Recherche de mises à jour…"));
        case S.NO_UPDATES_FOUND:
          return set("ok", Orbit.tr("Orbit is up to date", "Orbit est à jour"),
            Orbit.tr("You have the latest version.", "Tu as la dernière version."), check, Orbit.tr("Check again", "Vérifier à nouveau"));
        case S.DOWNLOAD_AND_INSTALL:
          return set("offer", Orbit.tr("Orbit {v} is available", "Orbit {v} est disponible").replace("{v}", v), "",
            () => updater.allowUpdateDownload(), Orbit.tr("Download and install", "Télécharger et installer"));
        case S.DOWNLOADING: {
          set("downloading", Orbit.tr("Downloading Orbit {v}…", "Téléchargement d'Orbit {v}…").replace("{v}", v));
          const [cur, total] = args;
          bar.hidden = false;
          if (total > 0) {
            bar.firstChild.style.transform = `scaleX(${cur / total})`;
            sub.textContent = `${Math.round((cur / total) * 100)} %`;
          }
          return;
        }
        case S.STAGING:
          return set("checking", Orbit.tr("Preparing the update…", "Préparation de la mise à jour…"));
        case S.READY_FOR_RESTART:
          return set("ready", Orbit.tr("Update ready", "Mise à jour prête"),
            Orbit.tr("It applies when Orbit restarts.", "Elle s'applique au redémarrage d'Orbit."), restart, Orbit.tr("Restart Orbit", "Redémarrer Orbit"));
        case S.DOWNLOAD_FAILED:
        case S.CHECKING_FAILED:
        case S.INTERNAL_ERROR:
          return set("error", Orbit.tr("Could not update", "Mise à jour impossible"),
            Orbit.tr("Check your connection and try again.", "Vérifie ta connexion et réessaie."), check, Orbit.tr("Try again", "Réessayer"));
        case S.OTHER_INSTANCE_HANDLING_UPDATES:
          return set("error", Orbit.tr("Another Orbit is updating", "Un autre Orbit fait la mise à jour"));
        case S.UPDATE_DISABLED_BY_POLICY:
        case S.NO_UPDATER:
        case S.UNSUPPORTED_SYSTEM:
          return set("off", Orbit.tr("Updates are off on this copy", "Les mises à jour sont désactivées sur cette copie"));
        case S.MANUAL_UPDATE:
          return set("offer", Orbit.tr("A new version is out", "Une nouvelle version est sortie"), "",
            () => { this.close(); gBrowser.selectedTab = gBrowser.addTrustedTab("https://github.com/realshavkat/orbit/releases/latest"); },
            Orbit.tr("Download", "Télécharger"));
      }
    };
    updater.addListener(listener);
    set("checking", Orbit.tr("Checking for updates…", "Recherche de mises à jour…"));
    setTimeout(check, 0);
    return card;
  },
};
