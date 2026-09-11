// 1) Crée un projet sur https://console.firebase.google.com/
// 2) Ajoute une application Web
// 3) Remplace les valeurs ci-dessous par celles données par Firebase
// 4) Active Authentication > Sign-in method > Anonymous
// 5) Crée une base Firestore
// 6) Copie le contenu de firestore.rules dans l'onglet "Rules" de Firestore
//
// Tant que ce fichier contient YOUR_..., le site fonctionne automatiquement
// en localStorage, donc tu peux tester l'interface sans Firebase.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Permet d'avoir plusieurs défis dans le même projet Firebase plus tard si besoin.
// Pour vous deux, garde simplement cette valeur identique.
export const challengeId = "main";
