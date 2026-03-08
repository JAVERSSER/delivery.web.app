// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [rider, setRider]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    let unsubRider = null;
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (unsubRider) { unsubRider(); unsubRider = null; }
      if (u) {
        unsubRider = onSnapshot(
          doc(db, "riders", u.uid),
          (snap) => {
            setRider({
              uid: u.uid,
              email: u.email,
              ...(snap.exists()
                ? snap.data()
                : { name: u.email, status: "offline", approved: false }),
            });
            setLoading(false);
          },
          () => {
            setRider({ uid: u.uid, email: u.email, name: u.email, status: "offline", approved: false });
            setLoading(false);
          }
        );
      } else {
        setRider(null);
        setLoading(false);
      }
    });
    return () => { unsubAuth(); if (unsubRider) unsubRider(); };
  }, []);

  const login = async (email, password) => {
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      return true;
    } catch (err) {
      const msgs = {
        "auth/invalid-email":      "Invalid email address.",
        "auth/user-not-found":     "No account found with this email.",
        "auth/wrong-password":     "Wrong password.",
        "auth/invalid-credential": "Wrong email or password.",
        "auth/too-many-requests":  "Too many attempts. Try again later.",
      };
      setError(msgs[err.code] || "Login failed. Please try again.");
      return false;
    }
  };

  const register = async ({ name, email, password, phone, vehicle }) => {
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const r = {
        uid:        cred.user.uid,
        name:       name.trim(),
        email:      email.trim().toLowerCase(),
        phone:      phone.trim(),
        vehicle:    vehicle || "Motorbike",
        status:     "offline",
        approved:   false,
        rating:     5.0,
        deliveries: 0,
        earnings:   0,
        createdAt:  new Date().toISOString(),
      };
      await setDoc(doc(db, "riders", cred.user.uid), r);
      return true;
    } catch (err) {
      const msgs = {
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/invalid-email":        "Invalid email address.",
        "auth/weak-password":        "Password should be at least 6 characters.",
      };
      setError(msgs[err.code] || "Registration failed. Please try again.");
      return false;
    }
  };

  const logout = () => signOut(auth);

  const updateProfile = async (data) => {
    const updated = { ...rider, ...data };
    setRider(updated);
    try { await setDoc(doc(db, "riders", rider.uid), updated, { merge: true }); } catch {}
  };

  return (
    <AuthContext.Provider value={{ rider, loading, error, setError, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
