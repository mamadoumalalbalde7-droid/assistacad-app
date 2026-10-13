// ============================================================================
//  AssistAcad Client — application d'ordinateur pour les clients (Windows, macOS, Linux)
//  Ouvre l'espace client AssistAcad dans sa propre fenêtre. Aucune activation :
//  le client se connecte avec son identifiant, Google ou Telegram, comme sur le site.
//  Le lien est lu dans config.json (copié au moment de la construction).
// ============================================================================
const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path"), fs = require("fs");
let win = null, URL_APP = "";
try { URL_APP = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")).url || ""; } catch (e) {}
const URL_OK = /^https:\/\/script\.google\.com\/(a\/[A-Za-z0-9.\-]+\/)?macros\/s\/[A-Za-z0-9_\-]{20,}\/exec$/;

function autorise(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== "https:") return false;
    return x.hostname === "script.google.com" || x.hostname.endsWith(".googleusercontent.com") || x.hostname === "accounts.google.com" || x.hostname.endsWith(".google.com");
  } catch (e) { return false; }
}
function ouvrir() {
  win = new BrowserWindow({ width: 1280, height: 840, minWidth: 380, minHeight: 560, title: "AssistAcad", backgroundColor: "#062E1A", show: false,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: false, spellcheck: true } });
  win.once("ready-to-show", () => win.show());
  win.webContents.on("will-navigate", (e, u) => { if (!autorise(u)) { e.preventDefault(); if (/^https:\/\//.test(u)) shell.openExternal(u); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https:\/\/|tg:)/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("did-fail-load", (e, code, desc, u, principal) => {
    if (principal) win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent('<body style="margin:0;height:100vh;display:grid;place-items:center;background:#062E1A;color:#fff;font-family:system-ui;text-align:center"><div><h2>Pas de connexion Internet</h2><p style="color:#B5D9C1">Vérifiez la connexion, puis appuyez sur Ctrl+R (ou Cmd+R).</p></div></body>'));
  });
  if (!URL_OK.test(URL_APP)) { dialog.showErrorBox("AssistAcad", "Configuration incomplète : le lien de l’espace client n’est pas renseigné (config.json)."); app.quit(); return; }
  win.loadURL(URL_APP + "?app=1");
}
Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
  { label: "AssistAcad", submenu: [{ label: "Accueil", accelerator: "CmdOrCtrl+R", click: () => win && URL_OK.test(URL_APP) && win.loadURL(URL_APP + "?app=1") }, { type: "separator" }, { role: "quit", label: "Quitter" }] },
  { label: "Édition", submenu: [{ role: "undo", label: "Annuler" }, { role: "redo", label: "Rétablir" }, { type: "separator" }, { role: "cut", label: "Couper" }, { role: "copy", label: "Copier" }, { role: "paste", label: "Coller" }, { role: "selectAll", label: "Tout sélectionner" }] },
  { label: "Affichage", submenu: [{ role: "zoomIn", label: "Agrandir" }, { role: "zoomOut", label: "Réduire" }, { role: "resetZoom", label: "Taille normale" }, { role: "togglefullscreen", label: "Plein écran" }] }
]));
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(ouvrir);
app.on("window-all-closed", () => app.quit());
