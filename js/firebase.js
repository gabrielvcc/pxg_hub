// Importações Firebase (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// CONFIG (SEU ORIGINAL)
const firebaseConfig = {
  apiKey: "AIzaSyDWvNjVjuTqSeUXQQ5qVw0HfvG5E2fJHH8",
  authDomain: "pxg-profit.firebaseapp.com",
  projectId: "pxg-profit",
  storageBucket: "pxg-profit.firebasestorage.app",
  messagingSenderId: "1024957923268",
  appId: "1:1024957923268:web:ef71f7e49958ffe5006e91"
};

// INIT
const app = initializeApp(firebaseConfig);

// AUTH
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export async function login() {
  await signInWithPopup(auth, provider);
}

export function onUserChange(callback) {
  onAuthStateChanged(auth, callback);
}

// FIRESTORE
const db = getFirestore(app);

// EXPORTS
export { auth, db };