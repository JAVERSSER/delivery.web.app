import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            "AIzaSyCcYDLdMi53cAxQE6uDSq0hRAQYE5L_X0k",
  authDomain:        "basiclogin-bc302.firebaseapp.com",
  projectId:         "basiclogin-bc302",
  storageBucket:     "basiclogin-bc302.firebasestorage.app",
  messagingSenderId: "7578565990",
  appId:             "1:7578565990:web:37649ccf1c2026d1b9dca7",
};

const app  = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;