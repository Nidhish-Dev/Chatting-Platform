"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, Timestamp, DocumentData } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, User, Reply } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp;
  isRead: boolean;
  replyTo?: string;
}

const themes = {
  love: {
    bg: "bg-gradient-to-br from-red-900 via-pink-800 to-red-700",
    header: "bg-red-900/90",
    input: "bg-pink-800/80",
    sent: "bg-gradient-to-r from-red-600 to-pink-500",
    received: "bg-gradient-to-r from-gray-700 to-gray-600",
    button: "bg-gradient-to-r from-red-500 to-pink-500",
    hoverButton: "hover:from-red-600 hover:to-pink-600",
    accent: "text-red-100",
  },
  dark: {
    bg: "bg-gradient-to-br from-gray-900 via-gray-800 to-black",
    header: "bg-gray-900/90",
    input: "bg-gray-800/80",
    sent: "bg-gradient-to-r from-indigo-600 to-blue-500",
    received: "bg-gradient-to-r from-gray-700 to-gray-600",
    button: "bg-gradient-to-r from-indigo-500 to-blue-500",
    hoverButton: "hover:from-indigo-600 hover:to-blue-600",
    accent: "text-indigo-100",
  },
  ocean: {
    bg: "bg-gradient-to-br from-teal-900 via-blue-800 to-teal-700",
    header: "bg-teal-900/90",
    input: "bg-blue-800/80",
    sent: "bg-gradient-to-r from-teal-600 to-blue-500",
    received: "bg-gradient-to-r from-gray-700 to-gray-600",
    button: "bg-gradient-to-r from-teal-500 to-blue-500",
    hoverButton: "hover:from-teal-600 hover:to-blue-600",
    accent: "text-teal-100",
  },
  forest: {
    bg: "bg-gradient-to-br from-green-900 via-emerald-800 to-green-700",
    header: "bg-green-900/90",
    input: "bg-emerald-800/80",
    sent: "bg-gradient-to-r from-green-600 to-emerald-500",
    received: "bg-gradient-to-r from-gray-700 to-gray-600",
    button: "bg-gradient-to-r from-green-500 to-emerald-500",
    hoverButton: "hover:from-green-600 hover:to-emerald-600",
    accent: "text-green-100",
  },
  sunset: {
    bg: "bg-gradient-to-br from-orange-900 via-pink-800 to-purple-700",
    header: "bg-orange-900/90",
    input: "bg-pink-800/80",
    sent: "bg-gradient-to-r from-orange-600 to-pink-500",
    received: "bg-gradient-to-r from-gray-700 to-gray-600",
    button: "bg-gradient-to-r from-orange-500 to-pink-500",
    hoverButton: "hover:from-orange-600 hover:to-pink-600",
    accent: "text-orange-100",
  },
};

export default function ChatRoom() {
  const { id } = useParams();
  const receiverId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [receiver, setReceiver] = useState<{ name: string; photoURL: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [theme, setTheme] = useState("love");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replyButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
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
          replyTo: data.replyTo || undefined,
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
      ...(replyingTo && { replyTo: replyingTo.id }),
    });

    setNewMessage("");
    setReplyingTo(null);
    inputRef.current?.focus();
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    const messageId = replyingTo?.id;
    setReplyingTo(null);
    if (messageId) {
      replyButtonRefs.current.get(messageId)?.focus();
    }
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      element.focus();
    }
  };

  const currentTheme = themes[theme as keyof typeof themes];

  return (
    <div className={`min-h-screen text-white flex flex-col ${currentTheme.bg}`}>
      {/* Fixed Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className={`fixed top-0 left-0 right-0 z-20 px-4 py-3 md:px-6 md:py-4 ${currentTheme.header} backdrop-blur-xl shadow-lg border-b border-gray-700/50 flex items-center justify-between`}
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
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-red-500 shadow-lg glow-sm"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 200 }}
              />
            ) : (
              <User className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-red-500 bg-pink-700 p-2 shadow-lg glow-sm" />
            )}
            <h1 className={`text-lg md:text-xl font-extrabold tracking-tight ${currentTheme.accent} drop-shadow-md`}>
              {receiver.name || "Unknown User"}
            </h1>
          </div>
        )}
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="p-2 bg-gray-800 text-white rounded-md"
        >
          <option value="love">Love</option>
          <option value="dark">Dark</option>
          <option value="ocean">Ocean</option>
          <option value="forest">Forest</option>
          <option value="sunset">Sunset</option>
        </select>
      </motion.header>

      {/* Scrollable Chat Messages */}
      <div className="flex-1 pt-20 pb-20 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <AnimatePresence>
            {messages.map((msg) => {
              const repliedToMessage = msg.replyTo
                ? messages.find((m) => m.id === msg.replyTo)
                : null;
              return (
                <motion.div
                  id={`message-${msg.id}`}
                  tabIndex={-1}
                  key={msg.id}
                  initial={{ opacity: 0, y: 30, rotateX: "-90deg" }}
                  animate={{ opacity: 1, y: 0, rotateX: "0deg" }}
                  exit={{ opacity: 0, y: -30, rotateX: "90deg" }}
                  transition={{ type: "spring", stiffness: 150 }}
                  className={`flex items-end ${msg.sender === currentUser?.uid ? "justify-end" : "justify-start"} relative`}
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
                  <div className="relative flex items-start gap-2">
                    <motion.div
                      className={`p-3 md:p-4 rounded-2xl max-w-xs md:max-w-md shadow-lg hover:shadow-xl transition-all ${
                        msg.sender === currentUser?.uid ? currentTheme.sent : currentTheme.received
                      } text-sm md:text-base font-medium`}
                      whileHover={{ scale: 1.03, zIndex: 10 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      {repliedToMessage && (
                        <div
                          className="mb-2 p-2 bg-gray-800/80 rounded-lg text-xs border-l-4 border-red-500 cursor-pointer hover:bg-gray-700/80 transition-colors"
                          onClick={() => scrollToMessage(repliedToMessage.id)}
                          onKeyDown={(e) => e.key === "Enter" && scrollToMessage(repliedToMessage.id)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Jump to replied message: ${repliedToMessage.text}`}
                        >
                          <span className="block font-semibold text-red-300">
                            Replying to {msg.sender === currentUser?.uid ? "You" : receiver?.name || "Unknown User"}
                          </span>
                          <span className="block truncate">{repliedToMessage.text}</span>
                        </div>
                      )}
                      {msg.text}
                    </motion.div>
                    <button
                      ref={(el) => {
                        if (el) replyButtonRefs.current.set(msg.id, el);
                      }}
                      onClick={() => handleReply(msg)}
                      className="p-1 bg-gray-600 rounded-full hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
                      aria-label={`Reply to message: ${msg.text}`}
                    >
                      <Reply size={16} className="text-white" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Fixed Message Input */}
      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className={`fixed bottom-0 left-0 right-0 z-20 p-4 md:p-6 ${currentTheme.header} backdrop-blur-xl shadow-lg border-t border-gray-700/50 flex flex-col gap-3`}
      >
        {replyingTo && (
          <div
            role="region"
            aria-live="polite"
            className="flex items-center justify-between p-2 bg-gray-800/80 rounded-xl shadow-md border border-red-500/50"
          >
            <div className="flex items-center gap-2">
              <Reply size={16} className="text-red-400" />
              <span className="text-sm text-gray-300">
                Replying to{" "}
                {replyingTo.sender === currentUser?.uid ? "You" : receiver?.name || "Unknown User"}:{" "}
                {replyingTo.text.length > 30
                  ? replyingTo.text.substring(0, 30) + "..."
                  : replyingTo.text}
              </span>
            </div>
            <button
              onClick={cancelReply}
              className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label="Cancel replying to this message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className={`flex-1 p-3 md:p-4 ${currentTheme.input} text-white rounded-xl outline-none shadow-md focus:ring-2 focus:ring-red-400 transition-all placeholder-gray-400 text-sm md:text-base glow-xs`}
            placeholder="Type a message..."
          />
          <motion.button
            onClick={sendMessage}
            className={`p-2 md:p-3 ${currentTheme.button} rounded-full ${currentTheme.hoverButton} transition-all shadow-md hover:shadow-lg glow-sm`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Send size={20} className="text-white" />
          </motion.button>
        </div>
      </motion.footer>
    </div>
  );
}