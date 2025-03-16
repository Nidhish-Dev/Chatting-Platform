"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/app/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, setDoc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await saveUserToFirestore(currentUser);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const saveUserToFirestore = async (user: any) => {
    if (!user) return;
    
    const userRef = doc(collection(db, "users"), user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        name: user.displayName || "Anonymous",
        email: user.email,
        uid: user.uid,
        photoURL: user.photoURL || "", // Store Profile Image
      });
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;

      setUser(loggedUser);
      await saveUserToFirestore(loggedUser);
      router.push("/chat"); // Redirect to chat after login
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100">
      {user ? (
        <>
          <img src={user.photoURL} alt="Profile" className="w-16 h-16 rounded-full mb-4" />
          <h1 className="text-2xl font-bold mb-6">Welcome, {user.displayName}</h1>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-6">Login</h1>
          <button onClick={handleGoogleLogin} className="bg-blue-500 text-white px-4 py-2 rounded">
            Sign in with Google
          </button>
        </>
      )}
    </div>
  );
}
