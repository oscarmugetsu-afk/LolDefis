# All Champions Challenge

Petit site statique **HTML / CSS / JavaScript** pour suivre à deux un défi League of Legends : gagner au moins une partie avec chaque champion.

## Fonctionnalités

- Grille responsive avec portraits des champions.
- Recherche instantanée par nom.
- Filtres : Top, Jungle, Mid, ADC, Support.
- Filtres de progression.
- Tri A→Z, Z→A, à faire d'abord, terminés d'abord.
- Progression séparée pour deux joueurs.
- Un champion passe en "TERMINÉ" lorsque les deux joueurs ont gagné avec.
- Noms des deux joueurs personnalisables.
- Double clic sur une carte pour cocher rapidement le joueur utilisé sur l'appareil.
- Mode local automatique si Firebase n'est pas configuré.
- Synchronisation temps réel entre les deux joueurs avec Firebase.

---

# 1. Tester sans Firebase

Tu peux déjà mettre tous les fichiers sur GitHub Pages.

Sans configuration Firebase, les cases sont enregistrées dans le `localStorage` du navigateur.
La progression ne sera alors **pas partagée** entre vos deux PC.

---

# 2. Configurer Firebase gratuitement

Va sur :

https://console.firebase.google.com/

Puis :

1. **Créer un projet**.
2. Tu peux désactiver Google Analytics, il n'est pas utile ici.
3. Dans le projet, clique sur l'icône **Web `</>`** pour ajouter une application Web.
4. Donne-lui un nom, par exemple `lol-challenge`.
5. Firebase affiche un objet `firebaseConfig`.
6. Ouvre `firebase-config.js` dans ce projet.
7. Remplace les valeurs `YOUR_...` par celles données par Firebase.

Exemple :

```js
export const firebaseConfig = {
  apiKey: "xxxxxxxx",
  authDomain: "mon-projet.firebaseapp.com",
  projectId: "mon-projet",
  storageBucket: "mon-projet.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxxxxx"
};
```

**Ne copie pas cet exemple**, utilise les valeurs de ton projet Firebase.

---

# 3. Activer la connexion anonyme

Dans Firebase :

**Build → Authentication → Get started → Sign-in method → Anonymous → Enable**

Le site connectera automatiquement chaque navigateur anonymement.

Il n'y a donc aucun écran de connexion.

---

# 4. Créer Firestore

Dans Firebase :

**Build → Firestore Database → Create database**

Tu peux choisir une région européenne.

Ensuite ouvre l'onglet **Rules** et remplace les règles par le contenu du fichier `firestore.rules` :

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /challenges/{challengeId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Puis clique sur **Publish**.

> Pour ce petit projet privé, ces règles sont volontairement simples. Toute personne ayant accès au site obtient une session anonyme et peut modifier le défi. Ne mets donc pas de données sensibles dans cette base.

---

# 5. Mettre le site sur GitHub

Dans ton repo vide, mets simplement :

```txt
index.html
style.css
app.js
champion-roles.js
firebase-config.js
firestore.rules
README.md
```

Puis commit/push.

---

# 6. Activer GitHub Pages

Dans ton repo GitHub :

**Settings → Pages**

Dans **Build and deployment** :

- Source : `Deploy from a branch`
- Branch : `main`
- Folder : `/ (root)`

Puis **Save**.

GitHub te donnera une adresse du genre :

```txt
https://TON-PSEUDO.github.io/NOM-DU-REPO/
```

Vous utilisez tous les deux exactement cette adresse.

---

# 7. Choisir vos noms

Sur le site :

1. Clique sur ⚙.
2. Remplace `Joueur 1` et `Joueur 2` par vos pseudos.
3. Sélectionne qui utilise l'appareil.
4. Enregistre.

Les noms sont partagés via Firebase.

Le choix "qui suis-je" reste local à chaque navigateur.

---

# Mise à jour des champions

Le site récupère automatiquement la liste et les portraits depuis **Riot Data Dragon** au chargement.

Les rôles sont dans `champion-roles.js`, car Data Dragon fournit les classes de champions mais pas directement les positions Top/Jungle/Mid/ADC/Support.

Si la méta change, tu peux donc simplement modifier ce fichier.

---

# Fichiers qui doivent être publics

La configuration Firebase côté Web (`apiKey`, `projectId`, etc.) est normalement visible par le navigateur : ce n'est pas un mot de passe serveur.

La sécurité de Firestore doit être assurée par les **Firestore Rules**, pas en essayant de cacher `firebase-config.js`.

---

# Aucun build nécessaire

Pas de Node.js, npm ou framework.

Tu peux même lancer le site localement avec un petit serveur HTTP, par exemple depuis VS Code avec Live Server.

Évite simplement d'ouvrir `index.html` directement en `file://`, car les modules JavaScript ES sont mieux servis via HTTP.


---

# Statut "Joué avant le défi"

Chaque joueur peut maintenant indiquer qu'il avait déjà joué un champion avant le début du défi.

Ce statut est indépendant de la victoire du défi :

- **Joué avant le défi** = historique personnel.
- **Case principale cochée** = victoire obtenue pendant le défi.

Tu peux utiliser le filtre :

- `Jamais joué avant — Joueur 1`
- `Jamais joué avant — Joueur 2`
- `Jamais joué avant — les deux`

et le tri :

- `Jamais joués avant d'abord`

Cela permet de commencer par les champions totalement nouveaux, puis de refaire progressivement les autres.
