"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, Timestamp, DocumentData } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, User } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp;
  isRead: boolean;
}

export default function ChatRoom() {
  const { id } = useParams();
  const receiverId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [receiver, setReceiver] = useState<{ name: string; photoURL: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const chatId = [currentUser?.uid, receiverId].sort().join("_");

  useEffect(() => {
    if (!receiverId) return;

    const fetchReceiver = async () => {
      const userDoc = await getDoc(doc(db, "users", receiverId));
      if (userDoc.exists()) {
        setReceiver(userDoc.data() as { name: string; photoURL: string });
      }
    };

    fetchReceiver();
  }, [receiverId]);

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        return {
          id: doc.id,
          text: data.text || "",
          sender: data.sender || "Unknown",
          createdAt: data.createdAt || Timestamp.now(),
          isRead: data.isRead || false,
        };
      });

      setMessages(fetchedMessages);

      fetchedMessages.forEach(async (msg) => {
        if (msg.sender !== currentUser?.uid && !msg.isRead) {
          await updateDoc(doc(db, "messages", msg.id), { isRead: true });
        }
      });
    });

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser) return;

    await addDoc(collection(db, "messages"), {
      text: newMessage,
      sender: currentUser.uid,
      chatId,
      createdAt: Timestamp.now(),
      isRead: false,
    });

    setNewMessage("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col">
      {/* Fixed Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="fixed top-0 left-0 right-0 z-20 px-4 py-3 md:px-6 md:py-4 bg-gray-900/90 backdrop-blur-xl shadow-lg border-b border-gray-700/50 flex items-center"
      >
        <button
          onClick={() => router.push("/")}
          className="p-2 md:p-3 rounded-full bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        {receiver && (
          <div className="flex items-center gap-3 mx-auto">
            {receiver.photoURL ? (
              <motion.img
                src={receiver.photoURL}
                alt="Profile"
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-indigo-500 shadow-lg glow-sm"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 200 }}
              />
            ) : (
              <User className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-indigo-500 bg-gray-700 p-2 shadow-lg glow-sm" />
            )}
            <h1 className="text-lg md:text-xl font-extrabold tracking-tight text-indigo-100 drop-shadow-md">
              {receiver.name || "Unknown User"}
            </h1>
          </div>
        )}
      </motion.header>

      {/* Scrollable Chat Messages */}
      <div className="flex-1 pt-20 pb-20 overflow-y-auto" style={{ perspective: "1000px" }}>
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 30, rotateX: "-90deg" }}
                animate={{ opacity: 1, y: 0, rotateX: "0deg" }}
                exit={{ opacity: 0, y: -30, rotateX: "90deg" }}
                transition={{ type: "spring", stiffness: 150 }}
                className={`flex items-end ${msg.sender === currentUser?.uid ? "justify-end" : "justify-start"}`}
              >
                {msg.sender !== currentUser?.uid && receiver && (
                  receiver.photoURL ? (
                    <motion.img
                      src={receiver.photoURL}
                      alt="User"
                      className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-gray-700 shadow-md mr-2 md:mr-3 glow-xs"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    />
                  ) : (
                    <User className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-gray-700 bg-gray-700 p-2 mr-2 md:mr-3 shadow-md glow-xs" />
                  )
                )}
                <motion.div
                  className={`p-3 md:p-4 rounded-2xl max-w-xs md:max-w-md shadow-lg hover:shadow-xl transition-all ${
                    msg.sender === currentUser?.uid
                      ? "bg-gradient-to-r from-indigo-600 to-blue-500 text-white glow-sm"
                      : "bg-gradient-to-r from-gray-700 to-gray-600 text-gray-100 glow-xs"
                  } text-sm md:text-base font-medium`}
                  whileHover={{ scale: 1.03, zIndex: 10 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  {msg.text}
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Message Input */}
      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="fixed bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gray-900/90 backdrop-blur-xl shadow-lg border-t border-gray-700/50 flex items-center gap-3"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 p-3 md:p-4 bg-gray-800/80 text-white rounded-xl outline-none shadow-md focus:ring-2 focus:ring-indigo-400 transition-all placeholder-gray-400 text-sm md:text-base glow-xs"
          placeholder="Type a message..."
        />
        <motion.button
          onClick={sendMessage}
          className="p-2 md:p-3 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full hover:from-indigo-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg glow-sm"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <Send size={20} className="text-white" />
        </motion.button>
      </motion.footer>
    </div>
  );
}