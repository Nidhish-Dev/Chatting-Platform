"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/app/lib/firebase";
import { collection, query, getDocs, deleteDoc, doc, where, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import { Trash, User } from "lucide-react";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [password, setPassword] = useState<string>(""); // State to track entered password
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false); // State to track access status

  useEffect(() => {
    if (isAuthenticated) {
      // Real-time listeners for users
      const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
      });

      // Real-time listeners for messages
      const unsubscribeMessages = onSnapshot(collection(db, "messages"), (snapshot) => {
        const messagesList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(), // Ensure it's a Date object
        }));

        // Sort messages by createdAt in descending order (latest to oldest)
        const sortedMessages = messagesList.sort((a, b) => b.createdAt - a.createdAt);
        setMessages(sortedMessages);
      });

      // Cleanup on unmount
      return () => {
        unsubscribeUsers();
        unsubscribeMessages();
      };
    }
  }, [isAuthenticated]); // Re-run the useEffect when authentication status changes

  const deleteMessage = async (messageId: string) => {
    const messageRef = doc(db, "messages", messageId);
    await deleteDoc(messageRef);
  };

  const deleteUser = async (userId: string) => {
    // Assuming you also want to delete the user's chat messages
    const userMessagesRef = query(collection(db, "messages"), where("sender", "==", userId));
    const userMessagesSnapshot = await getDocs(userMessagesRef);
    userMessagesSnapshot.forEach((msg) => {
      deleteMessage(msg.id);  // Deletes the user's messages
    });

    // Now delete the user
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);
  };

  const getSenderName = (senderId: string) => {
    const sender = users.find(user => user.id === senderId);
    return sender ? sender.name : "Unknown";
  };

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD; // Access password from env
    if (password === adminPassword) {
      setIsAuthenticated(true); // Allow access to the dashboard
    } else {
      alert("Incorrect password. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col">
      {!isAuthenticated ? (
        // Show password input form if not authenticated
        <div className="flex justify-center items-center h-full">
          <form onSubmit={handlePasswordSubmit} className="p-6 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-indigo-200 mb-4">Enter Admin Password</h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3 mb-4 bg-gray-700 text-white rounded-lg"
            />
            <button
              type="submit"
              className="w-full p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Submit
            </button>
          </form>
        </div>
      ) : (
        // Admin dashboard content if authenticated
        <>
          <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 120 }}
            className="fixed top-0 left-0 right-0 z-20 px-4 py-3 md:px-6 md:py-4 bg-gray-900/90 backdrop-blur-xl shadow-lg border-b border-gray-700/50 flex items-center"
          >
            <h1 className="text-xl font-bold text-indigo-100">Admin Dashboard</h1>
          </motion.header>

          {/* Users List */}
          <div className="flex-1 pt-20 pb-20 overflow-y-auto">
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              <h2 className="text-lg font-semibold text-indigo-200">Users</h2>
              {users.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 150 }}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded-xl shadow-md mb-4"
                >
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.name}
                        className="w-10 h-10 rounded-full border-2 border-indigo-500 shadow-lg"
                      />
                    ) : (
                      <User className="w-10 h-10 rounded-full border-2 border-indigo-500 bg-gray-700 p-2 shadow-lg" />
                    )}
                    <span className="text-lg text-indigo-100">{user.name}</span>
                  </div>
                  <motion.button
                    onClick={() => deleteUser(user.id)}
                    className="p-2 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-md"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash className="text-white" />
                  </motion.button>
                </motion.div>
              ))}
            </div>

            {/* Messages List */}
            <div className="p-4 md:p-6 space-y-4 md:space-y-6">
              <h2 className="text-lg font-semibold text-indigo-200">Messages</h2>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 150 }}
                  className="p-4 bg-gray-800 rounded-xl shadow-md mb-4 relative"
                >
                  <div className="flex items-start gap-2">
                    <div className="text-sm text-indigo-300 font-bold">{getSenderName(msg.sender)}</div>
                    <div className="text-sm text-gray-100 mt-1">{msg.text}</div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>{msg.createdAt.toLocaleString()}</span>
                    <motion.button
                      onClick={() => deleteMessage(msg.id)}
                      className="p-2 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-md"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Trash className="text-white" />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
