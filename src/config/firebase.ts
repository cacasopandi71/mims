import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Catatan: Kunci di bawah ini masih kosong. 
// Nanti harus diganti dengan kunci asli dari website Firebase Anda.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCOSzz2-BKd6s15sthELQ7pouzfVJzjAOw",
  authDomain: "gen-lang-client-0327804386.firebaseapp.com",
  projectId: "gen-lang-client-0327804386",
  storageBucket: "gen-lang-client-0327804386.firebasestorage.app",
  messagingSenderId: "948263705242",
  appId: "1:948263705242:web:d68ec270bede361af5dd23",
  measurementId: "G-CBQMY9DMNK"
};

// Menghidupkan Firebase
const app = initializeApp(firebaseConfig);

// Mengekspor fitur database dan autentikasi
export const db = getFirestore(app);
export const auth = getAuth(app);