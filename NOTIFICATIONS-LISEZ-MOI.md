# Envoyer une notification à tous les clients

Tout se passe dans **un seul fichier** : `nouveautes.json` (dépôt `assistacad-app`).
Vous n'avez **jamais** à toucher le lien Apps Script ni à redéployer le script.

Chaque client voit la notification dès qu'il ouvre l'application : une **cloche** 🔔 en haut
avec une pastille rouge, une **bulle** qui apparaît, et le **centre de notifications**.
Les textes s'affichent dans la langue du téléphone (français, anglais, russe, arabe).

## 1. Annoncer une nouveauté
Ajoutez un bloc dans `items` :
```json
{
  "id": "2026-11-01-revision",
  "type": "nouveaute",
  "date": "2026-11-01",
  "titre": { "fr": "Nouveau : révision express", "ru": "Новое: экспресс-повторение" },
  "texte": { "fr": "Essayez la révision de vos cours en 7 jours gratuits.", "ru": "..." },
  "lien": "https://t.me/assisacad"
}
```
- `id` : unique (mettez la date). C'est lui qui évite de re-notifier deux fois.
- `lien` : facultatif ; ajoute un bouton « Voir ».

## 2. Proposer une mise à jour (bouton « Mettre à jour » dans la notification)
Après un changement déployé, mettez `cible` = le nouveau numéro de version
(il est écrit dans `icone/version.txt`) :
```json
{
  "id": "maj-2026-11-01",
  "type": "maj",
  "date": "2026-11-01",
  "cible": "a1b2c3d4",
  "titre": { "fr": "Mise à jour disponible" },
  "texte": { "fr": "Touchez « Mettre à jour » pour installer la nouvelle version." }
}
```
Le bouton **« Mettre à jour »** vide le cache et recharge l'application à neuf.
Les clients déjà à jour ne voient pas la notification (comparaison automatique de version).

## Règles
- Gardez le fichier en JSON valide (virgules, guillemets). Collez-le dans jsonlint.com en cas de doute.
- Le français `fr` est obligatoire ; les autres langues sont facultatives (sinon le français est affiché).
- Notifications du système (hors application) : voir la section « Pour aller plus loin » — nécessite une clé d'envoi (push). L'actuel fonctionne à l'ouverture de l'application, ce qui couvre 100 % des clients qui l'ouvrent.
