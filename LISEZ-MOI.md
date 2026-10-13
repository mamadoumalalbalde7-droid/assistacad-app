# Application AssistAcad pour les CLIENTS

Une seule application pour Android, iPhone et ordinateur. Elle ouvre directement
l'espace client AssistAcad, avec son icône verte, en plein écran, sans barre d'adresse.

- Android / iPhone / ordinateur : application installable depuis un lien (gratuit).
- Ordinateur : en plus, un vrai installateur « AssistAcad Client » (.exe, .dmg, .AppImage).

## A. Mettre l'application en ligne (une seule fois, gratuit)

1. Sur github.com : **New repository** › nom `assistacad-app` › **Public** › Create.
2. **Add file › Upload files** : glissez TOUT le contenu de ce dossier
   (y compris le dossier `.github` et le dossier `bureau`) › Commit changes.
3. Ouvrez `config.json` › ✏️ › remplacez `COLLEZ_ICI_VOTRE_ID` pour obtenir votre adresse
   `https://script.google.com/macros/s/…/exec` (Apps Script › Déployer › Gérer les déploiements) › Commit.
4. **Settings › Pages** › Source : *Deploy from a branch* › Branch : `main` / `(root)` › Save.
   Après 1 à 2 minutes, l'adresse apparaît : `https://VOTRE-NOM.github.io/assistacad-app/`
   C'est **le lien à donner aux clients**.

## B. Autoriser l'application côté Apps Script

Votre script a plus de 50 propriétés : ajoutez temporairement cette fonction, exécutez-la, puis supprimez-la.

```
function autoriserAppClient(){ PropertiesService.getScriptProperties().setProperty("DOMAINE_CADRE","OUI"); }
```

Puis : Déployer › Gérer les déploiements › ✏️ › Nouvelle version › Déployer.

## C. Afficher le bouton « Installer l'application » sur votre lien web

Intranet › Outils › **Logiciel AssistAcad** › champ **« Lien de l'application CLIENT »** ›
collez `https://VOTRE-NOM.github.io/assistacad-app/` › Enregistrer.
Les clients qui ouvrent votre lien web voient alors « 📲 Installer l'application AssistAcad ».

## D. Installateur pour ordinateur (facultatif)

Onglet **Actions** › « Construire AssistAcad Client » › **Run workflow**.
Après environ 10 minutes, en bas de la page : `AssistAcad-Client-Windows`, `-macOS`, `-Linux`.
Pour un lien de téléchargement permanent : créez une Release avec un tag `client-v1.0.0`.

## E. Ce que fait le client

| Appareil | Comment installer |
|---|---|
| **Android** | Ouvrir le lien dans Chrome › bouton « Installer » (ou ⋮ › Installer l'application) |
| **iPhone / iPad** | Ouvrir le lien dans **Safari** › Partager ⬆️ › « Sur l'écran d'accueil » › Ajouter |
| **Ordinateur** | Chrome ou Edge › icône d'installation dans la barre d'adresse, ou l'installateur .exe |

## F. À savoir

- Connexion **Google** : Google interdit sa page de connexion à l'intérieur d'une application
  encadrée. Elle s'ouvre dans le navigateur. La connexion par mot de passe et par Telegram
  fonctionne directement dans l'application.
- Les mises à jour sont automatiques : chaque nouveau déploiement Apps Script apparaît
  dans l'application, rien à réinstaller.
- Pour une application **Play Store / App Store**, il faut des comptes développeur payants
  (Google 25 $ une fois, Apple 99 $ par an) et une validation. Ce dossier peut servir de base.
