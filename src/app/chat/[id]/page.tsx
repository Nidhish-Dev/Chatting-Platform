"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, User, Reply, Paperclip, Smile } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp;
  isRead: boolean;
  replyTo?: string;
  imageBase64?: string;
}

const themes = {
  love: {
    bg: "bg-gradient-to-br from-rose-900 via-pink-700 to-rose-600",
    header: "bg-rose-900/95",
    input: "bg-pink-700/90",
    sent: "bg-gradient-to-r from-rose-600 to-pink-500",
    received: "bg-gradient-to-r from-gray-800 to-gray-700",
    button: "bg-gradient-to-r from-rose-500 to-pink-500",
    hoverButton: "hover:from-rose-600 hover:to-pink-600",
    accent: "text-rose-100",
    glow: "shadow-[0_0_15px_rgba(244,63,94,0.5)]",
  },
  dark: {
    bg: "bg-gradient-to-br from-gray-900 via-indigo-900 to-black",
    header: "bg-gray-900/95",
    input: "bg-indigo-900/90",
    sent: "bg-gradient-to-r from-indigo-600 to-blue-500",
    received: "bg-gradient-to-r from-gray-800 to-gray-700",
    button: "bg-gradient-to-r from-indigo-500 to-blue-500",
    hoverButton: "hover:from-indigo-600 hover:to-blue-600",
    accent: "text-indigo-100",
    glow: "shadow-[0_0_15px_rgba(99,102,241,0.5)]",
  },
  ocean: {
    bg: "bg-gradient-to-br from-teal-900 via-cyan-800 to-teal-700",
    header: "bg-teal-900/95",
    input: "bg-cyan-800/90",
    sent: "bg-gradient-to-r from-teal-600 to-cyan-500",
    received: "bg-gradient-to-r from-gray-800 to-gray-700",
    button: "bg-gradient-to-r from-teal-500 to-cyan-500",
    hoverButton: "hover:from-teal-600 hover:to-cyan-600",
    accent: "text-teal-100",
    glow: "shadow-[0_0_15px_rgba(20,184,166,0.5)]",
  },
  forest: {
    bg: "bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-700",
    header: "bg-emerald-900/95",
    input: "bg-green-800/90",
    sent: "bg-gradient-to-r from-emerald-600 to-green-500",
    received: "bg-gradient-to-r from-gray-800 to-gray-700",
    button: "bg-gradient-to-r from-emerald-500 to-green-500",
    hoverButton: "hover:from-emerald-600 hover:to-green-600",
    accent: "text-emerald-100",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.5)]",
  },
  sunset: {
    bg: "bg-gradient-to-br from-orange-900 via-rose-800 to-purple-700",
    header: "bg-orange-900/95",
    input: "bg-rose-800/90",
    sent: "bg-gradient-to-r from-orange-600 to-rose-500",
    received: "bg-gradient-to-r from-gray-800 to-gray-700",
    button: "bg-gradient-to-r from-orange-500 to-rose-500",
    hoverButton: "hover:from-orange-600 hover:to-rose-600",
    accent: "text-orange-100",
    glow: "shadow-[0_0_15px_rgba(251,146,60,0.5)]",
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
  const [theme, setTheme] = useState<keyof typeof themes>("love");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;
  const chatId = [currentUser?.uid, receiverId].sort().join("_");

  const currentTheme = themes[theme] || themes.love;

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
          imageBase64: data.imageBase64 || undefined,
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
  }, [chatId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        let { width, height } = img;

        const maxSize = 1024 * 1024; // 1 MB
        if (file.size > maxSize) {
          const scale = Math.sqrt(maxSize / file.size) * 0.7;
          width = img.width * scale;
          height = img.height * scale;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const base64String = canvas.toDataURL("image/jpeg", 0.7);
        resolve(base64String);
      };

      reader.readAsDataURL(file);
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !fileInputRef.current?.files?.length) return;
    if (!currentUser) return;

    let imageBase64: string | undefined;
    if (fileInputRef.current?.files?.[0]) {
      const file = fileInputRef.current.files[0];
      imageBase64 = await resizeImage(file);
      fileInputRef.current.value = "";
    }

    await addDoc(collection(db, "messages"), {
      text: newMessage,
      sender: currentUser.uid,
      chatId,
      createdAt: Timestamp.now(),
      isRead: false,
      ...(replyingTo && { replyTo: replyingTo.id }),
      ...(imageBase64 && { imageBase64 }),
    });

    setNewMessage("");
    setReplyingTo(null);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleEmojiClick = (emojiObject: { emoji: string }) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageClick = (imageBase64: string) => {
    setZoomedImage(imageBase64);
  };

  const closeZoomedImage = () => {
    setZoomedImage(null);
  };

  if (!currentUser) {
    return (
      <div className={`min-h-screen ${currentTheme.bg} text-white flex items-center justify-center`}>
        <p>Please log in to view the chat.</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${currentTheme.bg} text-white flex flex-col relative overflow-hidden`}>
      {/* Enhanced Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              scale: Math.random() * 0.3 + 0.1,
              backgroundColor: `${currentTheme.accent}33`,
            }}
            animate={{
              y: [null, -100],
              opacity: [0, 0.2, 0],
              transition: { duration: Math.random() * 5 + 3, repeat: Infinity, ease: "easeOut" },
            }}
            style={{ width: 15, height: 15 }}
          />
        ))}
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className={`${currentTheme.header} fixed top-0 left-0 right-0 z-30 p-4 backdrop-blur-md ${currentTheme.glow}`}
      >
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => router.push("/")}
            className="p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <ArrowLeft size={24} />
          </motion.button>

          {receiver && (
            <div className="flex items-center gap-2">
              <motion.img
                src={receiver.photoURL || "/default-avatar.png"}
                alt={`${receiver.name}'s avatar`}
                className="w-10 h-10 rounded-full border-2 border-white/20"
                whileHover={{ scale: 1.1, rotate: 5 }}
                onError={(e) => (e.currentTarget.src = "/default-avatar.png")}
              />
              <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {receiver.name || "Unknown User"}
              </h1>
            </div>
          )}

          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as keyof typeof themes)}
            className="p-2 bg-gray-800/80 text-white rounded-md focus:ring-2 focus:ring-white/50"
          >
            <option value="love">Love</option>
            <option value="dark">Dark</option>
            <option value="ocean">Ocean</option>
            <option value="forest">Forest</option>
            <option value="sunset">Sunset</option>
          </select>
        </div>
      </motion.header>

      {/* Messages Area */}
      <div className="flex-1 pt-20 pb-24 px-4 overflow-y-auto max-w-5xl mx-auto w-full">
        <AnimatePresence>
          {messages.map((msg) => {
            const senderName = msg.sender === currentUser?.uid ? "You" : receiver?.name || "Unknown User";
            const repliedToMessage = msg.replyTo ? messages.find((m) => m.id === msg.replyTo) : null;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 150 }}
                className={`flex ${msg.sender === currentUser?.uid ? "justify-end" : "justify-start"} mb-4`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[70%] group ${
                    msg.sender === currentUser?.uid ? "flex-row-reverse" : ""
                  }`}
                >
                  {msg.sender !== currentUser?.uid && receiver && (
                    <motion.img
                      src={receiver.photoURL || "/default-avatar.png"}
                      alt={`${senderName}'s avatar`}
                      className="w-10 h-10 rounded-full border-2 border-white/20"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      onError={(e) => (e.currentTarget.src = "/default-avatar.png")}
                    />
                  )}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-2xl ${
                      msg.sender === currentUser?.uid ? currentTheme.sent : "bg-white/10"
                    } ${currentTheme.glow} shadow-lg`}
                  >
                    <p className="font-semibold text-sm">{senderName}</p>
                    {repliedToMessage && (
                      <div
                        className="mt-1 mb-2 p-2 bg-gray-800/50 rounded-lg text-xs cursor-pointer hover:bg-gray-700/50 transition-colors"
                        onClick={() =>
                          document.getElementById(`message-${repliedToMessage.id}`)?.scrollIntoView({
                            behavior: "smooth",
                          })
                        }
                      >
                        <span className="block font-semibold text-gray-300">
                          Replying to{" "}
                          {repliedToMessage.sender === currentUser?.uid ? "You" : receiver?.name || "Unknown User"}
                        </span>
                        <span className="block truncate">{repliedToMessage.text}</span>
                      </div>
                    )}
                    {msg.text && <p className="mt-1">{msg.text}</p>}
                    {msg.imageBase64 && (
                      <img
                        src={msg.imageBase64}
                        alt="Attachment"
                        className="mt-2 rounded-lg max-w-full cursor-pointer"
                        onClick={() => handleImageClick(msg.imageBase64!)}
                      />
                    )}
                  </motion.div>
                  <motion.button
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-full"
                    onClick={() => handleReply(msg)}
                  >
                    <Reply size={16} />
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Footer/Input */}
      <motion.footer
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className={`${currentTheme.header} fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-md ${currentTheme.glow}`}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {replyingTo && (
            <div className="absolute bottom-16 left-4 bg-gray-800/90 p-2 rounded-lg w-[calc(100%-2rem)] max-w-5xl flex items-center justify-between">
              <span className="text-sm">
                Replying to{" "}
                {replyingTo.sender === currentUser?.uid ? "You" : receiver?.name || "Unknown User"}: {replyingTo.text}
              </span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                onClick={() => setReplyingTo(null)}
                className="p-1 hover:bg-white/10 rounded-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className={`${currentTheme.input} flex-1 p-3 rounded-full focus:ring-2 focus:ring-white/50 ${currentTheme.glow}`}
            placeholder="Type a message..."
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={handleFileUploadClick}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <Paperclip size={20} />
          </motion.button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={sendMessage}
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <Smile size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={sendMessage}
            className={`${currentTheme.button} p-2 rounded-full ${currentTheme.hoverButton} ${currentTheme.glow}`}
          >
            <Send size={20} />
          </motion.button>
        </div>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 150 }}
            className="absolute bottom-16 right-4"
          >
            <EmojiPicker onEmojiClick={handleEmojiClick} />
          </motion.div>
        )}
      </motion.footer>

      {/* Zoomed Image Modal */}
      {zoomedImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={closeZoomedImage}
        >
          <motion.img
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            src={zoomedImage}
            alt="Zoomed Attachment"
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            onClick={closeZoomedImage}
            className="absolute top-4 right-4 p-2 bg-gray-800 rounded-full hover:bg-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}