import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Masukkan firebaseConfig milik Anda dari Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCOSzz2-BKd6s15sthELQ7pouzfVJzjAOw",
  authDomain: "gen-lang-client-0327804386.firebaseapp.com",
  projectId: "gen-lang-client-0327804386",
  storageBucket: "gen-lang-client-0327804386.firebasestorage.app",
  messagingSenderId: "948263705242",
  appId: "1:948263705242:web:d68ec270bede361af5dd23",
  measurementId: "G-CBQMY9DMNK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);