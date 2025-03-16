"use client";

import { useEffect, useState } from "react";
import { auth, db, provider } from "@/app/lib/firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { collection, getDocs, setDoc, doc, query, where } from "firebase/firestore";
import { motion } from "framer-motion";
import { LogOut, UserCircle } from "lucide-react";

export default function HomePage() {
  const [user, setUser] = useState(auth.currentUser);
  const [users, setUsers] = useState<{ id: string; name?: string; photoURL?: string; unreadCount: number }[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        await setDoc(
          doc(db, "users", authUser.uid),
          {
            id: authUser.uid,
            name: authUser.displayName || "Unknown User",
            photoURL: authUser.photoURL || "/default-avatar.png",
          },
          { merge: true }
        );
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUsersWithUnreadCount = async () => {
      if (!user) return;

      const querySnapshot = await getDocs(collection(db, "users"));
      const usersData = await Promise.all(
        querySnapshot.docs.map(async (docSnapshot) => {
          const userData = docSnapshot.data();
          if (userData.id === user.uid) return null;

          const chatId = [user.uid, userData.id].sort().join("_");
          const unreadMessagesQuery = query(
            collection(db, "messages"),
            where("chatId", "==", chatId),
            where("receiver", "==", user.uid),
            where("read", "==", false)
          );
          const unreadMessagesSnapshot = await getDocs(unreadMessagesQuery);
          const unreadCount = unreadMessagesSnapshot.size;

          return {
            id: userData.id,
            name: userData.name || "Unknown User",
            photoURL: userData.photoURL || "/default-avatar.png",
            unreadCount,
          };
        })
      );

      setUsers(usersData.filter((u) => u !== null) as any);
    };

    if (user) fetchUsersWithUnreadCount();
  }, [user]);

  const handleLogin = async () => {
    await signInWithPopup(auth, provider);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col">
      {/* Fixed Top Bar */}
      {user && (
        <motion.header
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-20 px-4 py-3 sm:px-6 sm:py-4 bg-gray-900/90 backdrop-blur-lg shadow-lg border-b border-gray-700/50 flex items-center justify-between"
        >
          <div className="flex items-center space-x-3 sm:space-x-4">
            <motion.img
              src={user.photoURL || "/default-avatar.png"}
              alt="User Avatar"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-blue-500 shadow-lg"
              whileHover={{ scale: 1.1 }}
            />
            <div className="truncate">
              <h2 className="text-lg sm:text-xl font-semibold text-blue-100 truncate">{user.displayName}</h2>
              <p className="text-xs sm:text-sm text-gray-400">Welcome back!</p>
            </div>
          </div>
          <motion.button
            onClick={handleLogout}
            className="p-2 sm:p-3 bg-red-500 rounded-full shadow-lg hover:bg-red-600 transition"
            whileHover={{ scale: 1.1 }}
          >
            <LogOut size={20} className="sm:w-6 sm:h-6" />
          </motion.button>
        </motion.header>
      )}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center pt-16 sm:pt-20 px-4 sm:px-6">
        {user ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-4xl bg-gray-900/80 shadow-2xl rounded-3xl backdrop-blur-lg p-4 sm:p-6 max-h-[80vh] overflow-y-auto"
          >
            {/* Chat List */}
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-300">Chat with:</h2>
            <div className="space-y-3">
              {users.map((u) => (
                <motion.div
                  key={u.id}
                  onClick={() => router.push(`/chat/${u.id}`)}
                  className="flex items-center justify-between p-3 sm:p-4 bg-gray-800 rounded-lg shadow-lg hover:bg-gray-700 transition cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="flex items-center space-x-3 sm:space-x-4">
                    <img
                      src={u.photoURL}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-blue-500 shadow-md"
                      alt="Avatar"
                    />
                    <span className="text-base sm:text-lg truncate">{u.name}</span>
                  </div>
                  {u.unreadCount > 0 && (
                    <motion.span
                      className="bg-red-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                    >
                      {u.unreadCount}
                    </motion.span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.button
            onClick={handleLogin}
            className="bg-blue-500 px-4 py-2 sm:px-6 sm:py-3 rounded-full text-base sm:text-lg font-semibold shadow-lg hover:bg-blue-600 transition flex items-center space-x-2"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
          >
            <UserCircle size={20} className="sm:w-6 sm:h-6" />
            <span>Login with Google</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}