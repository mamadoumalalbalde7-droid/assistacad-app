# Dossier « icone » — une seule image pour toute l'application

**Pour changer l'icône partout :** remplacez `icone.png` par votre nouvelle image, c'est tout.

1. Sur GitHub, ouvrez ce dossier `icone` › **Add file › Upload files**.
2. Glissez votre image **nommée exactement `icone.png`** (carrée, 1024 × 1024 conseillé) › **Commit changes**.
3. Attendez 2 à 3 minutes. GitHub fabrique tout seul :
   - les icônes de l'application téléphone (Android, iPhone) et de l'onglet du navigateur ;
   - l'icône du logiciel ordinateur **AssistAcad Client** (reconstruit automatiquement, onglet *Actions*) ;
   - `photo-bot-640.png` pour la photo du bot Telegram ;
   - le logiciel de l'**équipe** (dépôt `assistacad-logiciel`) prend la nouvelle icône dans les 6 heures.
   - l'onglet du lien Apps Script prend la nouvelle icône dans les 6 heures.

**Couleur de fond** (iPhone, Android, photo du bot) : prise automatiquement en haut de l'image.
Pour la choisir vous-même, créez `couleur.txt` contenant par exemple `#12B347`.

Le logo affiché **à l'intérieur** des pages (connexion, menu) n'est pas touché.

Ce que GitHub ne peut pas faire à votre place :
- la photo du bot : @BotFather › `/setuserpic` › @acades_bot › envoyez `photo-bot-640.png` ;
- un iPhone garde l'ancienne icône déjà posée : supprimez le raccourci et ajoutez-le de nouveau ;
- un logiciel déjà installé sur un PC garde l'ancienne icône jusqu'à l'installation de la nouvelle version.
