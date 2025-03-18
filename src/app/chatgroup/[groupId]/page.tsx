"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { doc, onSnapshot, updateDoc, Timestamp, collection, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, User, LogOut, Reply, Paperclip, Smile, Edit2, Info } from "lucide-react";
import { signOut } from "firebase/auth";
import EmojiPicker from "emoji-picker-react";

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp;
  replyTo?: string;
  imageBase64?: string;
}

interface User {
  uid: string;
  displayName: string;
  photoURL?: string;
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

export default function ChatGroupPage() {
  const [user, setUser] = useState(auth.currentUser);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userList, setUserList] = useState<User[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [theme, setTheme] = useState<keyof typeof themes>("love");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("Group Chat");
  const [tempGroupName, setTempGroupName] = useState("");
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLength = useRef(0);
  const isInitialLoad = useRef(true);

  const currentTheme = themes[theme] || themes.love;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      setUser(authUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !groupId) return;

    const groupRef = doc(db, "chatGroups", groupId);
    const unsubscribe = onSnapshot(groupRef, (groupDoc) => {
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        setGroupName(groupData.name || "Group Chat");
        const members = groupData.members || [];
        setGroupMembers(members);

        const fetchedMessages = (groupData.messages || []).map((msg: any) => ({
          id: msg.id || `${msg.createdAt?.toMillis?.() || Date.now()}`,
          text: typeof msg.text === "string" ? msg.text : "",
          sender: typeof msg.sender === "string" ? msg.sender : "unknown",
          createdAt: msg.createdAt instanceof Timestamp ? msg.createdAt : Timestamp.now(),
          replyTo: typeof msg.replyTo === "string" ? msg.replyTo : undefined,
          imageBase64: typeof msg.imageBase64 === "string" ? msg.imageBase64 : undefined,
        }));

        setMessages(fetchedMessages);

        // Scroll to bottom on initial load or when new messages arrive
        if (isInitialLoad.current || fetchedMessages.length > prevMessagesLength.current) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100); // Small delay to ensure DOM updates
        }

        // Show notification if tab is not focused
        if (fetchedMessages.length > prevMessagesLength.current && document.hidden) {
          const latestMessage = fetchedMessages[fetchedMessages.length - 1];
          const senderName = userList.find((u) => u.uid === latestMessage.sender)?.displayName || "Unknown";
          setNotifications((prev) => [...prev, `New message from ${senderName}`]);
        }

        prevMessagesLength.current = fetchedMessages.length;
        isInitialLoad.current = false; // Mark initial load as complete
      } else {
        router.push("/");
      }
    });

    const fetchUsers = async () => {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);
      const usersList = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: data.uid || doc.id,
          displayName: data.displayName || data.name || "Unknown User",
          photoURL: data.photoURL,
        };
      });
      setUserList(usersList);
      updateMemberNames(usersList, groupMembers);
    };

    fetchUsers();
    return () => unsubscribe();
  }, [user, groupId, router, userList]);

  useEffect(() => {
    updateMemberNames(userList, groupMembers);
  }, [userList, groupMembers]);

  const updateMemberNames = (users: User[], members: string[]) => {
    const names = members.map((memberId) => {
      const member = users.find((u) => u.uid === memberId);
      return member?.displayName || "Unknown User";
    });
    setMemberNames(names);
  };

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

        const maxSize = 1024 * 1024;
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !fileInputRef.current?.files?.length) return;
    if (!user || !groupId) return;

    let imageBase64: string | undefined;
    if (fileInputRef.current?.files?.[0]) {
      const file = fileInputRef.current.files[0];
      imageBase64 = await resizeImage(file);
      fileInputRef.current.value = "";
    }

    const messageData: Message = {
      sender: user.uid || "unknown",
      text: newMessage || "",
      createdAt: Timestamp.now(),
      ...(replyingTo && { replyTo: replyingTo.id }),
      ...(imageBase64 && { imageBase64 }),
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    };

    const groupRef = doc(db, "chatGroups", groupId);
    const sanitizedMessages = messages.map((msg) => ({
      id: msg.id,
      sender: typeof msg.sender === "string" ? msg.sender : "unknown",
      text: typeof msg.text === "string" ? msg.text : "",
      createdAt: msg.createdAt instanceof Timestamp ? msg.createdAt : Timestamp.now(),
      ...(msg.replyTo && typeof msg.replyTo === "string" && { replyTo: msg.replyTo }),
      ...(msg.imageBase64 && { imageBase64: msg.imageBase64 }),
    }));

    const updatedMessages = [...sanitizedMessages, messageData];
    await updateDoc(groupRef, { messages: updatedMessages });

    setNewMessage("");
    setReplyingTo(null);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleEditGroupName = async () => {
    if (editingGroupName) {
      if (tempGroupName.trim()) {
        const groupRef = doc(db, "chatGroups", groupId);
        await updateDoc(groupRef, { name: tempGroupName });
        setGroupName(tempGroupName);
      }
      setEditingGroupName(false);
    } else {
      setTempGroupName(groupName);
      setEditingGroupName(true);
    }
  };

  const addMember = async (uid: string) => {
    if (!uid || groupMembers.includes(uid)) return;
    const groupRef = doc(db, "chatGroups", groupId);
    const updatedMembers = [...groupMembers, uid];
    await updateDoc(groupRef, { members: updatedMembers });
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    router.push("/");
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

  if (!user) {
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

          <div className="flex items-center gap-2">
            {editingGroupName ? (
              <input
                value={tempGroupName}
                onChange={(e) => setTempGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEditGroupName()}
                className="bg-transparent border-b border-white/50 focus:outline-none text-xl font-semibold text-white"
                autoFocus
              />
            ) : (
              <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {groupName}
              </h1>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={handleEditGroupName}
              className="p-2 hover:bg-white/10 rounded-full"
            >
              <Edit2 size={18} />
            </motion.button>
          </div>

          <div className="flex gap-2">
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
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={() => setShowInfoModal(true)}
              className="p-2 hover:bg-white/10 rounded-full"
            >
              <Info size={24} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-full"
            >
              <LogOut size={24} />
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 pt-20 pb-24 px-4 overflow-y-auto max-w-5xl mx-auto w-full"
      >
        <AnimatePresence>
          {messages.map((msg) => {
            const sender = userList.find((u) => u.uid === msg.sender);
            const senderName = sender?.displayName || "Unknown User";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 150 }}
                className={`flex ${msg.sender === user.uid ? "justify-end" : "justify-start"} mb-4`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[70%] group ${msg.sender === user.uid ? "flex-row-reverse" : ""}`}
                >
                  {msg.sender !== user.uid && (
                    <motion.img
                      src={sender?.photoURL || "/default-avatar.png"}
                      alt={`${senderName}'s avatar`}
                      className="w-10 h-10 rounded-full border-2 border-white/20"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      onError={(e) => (e.currentTarget.src = "/default-avatar.png")}
                    />
                  )}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-2xl ${msg.sender === user.uid ? currentTheme.sent : "bg-white/10"} ${currentTheme.glow} shadow-lg`}
                  >
                    <p className="font-semibold text-sm">{senderName}</p>
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
      {groupMembers.includes(user.uid) && (
        <motion.footer
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 100 }}
          className={`${currentTheme.header} fixed bottom-0 left-0 right-0 z-30 p-4 backdrop-blur-md ${currentTheme.glow}`}
        >
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
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
              onChange={handleSendMessage}
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
              onClick={handleSendMessage}
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
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center"
          onClick={() => setShowInfoModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 150 }}
            className="bg-gray-900 p-6 rounded-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-4">Group Info</h2>
            <p className="mb-2"><strong>Members:</strong></p>
            <ul className="space-y-2 mb-4">
              {memberNames.map((name, i) => (
                <li key={i} className="flex items-center gap-2">
                  <User size={16} /> {name}
                </li>
              ))}
            </ul>
            <p className="mb-2"><strong>Add Member:</strong></p>
            <select
              onChange={(e) => addMember(e.target.value)}
              className="w-full p-2 bg-gray-800 rounded-md mb-4"
            >
              <option value="">Select a user</option>
              {userList
                .filter((u) => !groupMembers.includes(u.uid))
                .map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName}
                  </option>
                ))}
            </select>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setShowInfoModal(false)}
              className="w-full p-2 bg-red-500 rounded-md hover:bg-red-600"
            >
              Close
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Notifications */}
      <div className="fixed top-20 right-4 space-y-2 z-50">
        <AnimatePresence>
          {notifications.map((notif, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ type: "spring", stiffness: 150 }}
              className="bg-gray-800 p-3 rounded-lg shadow-lg cursor-pointer"
              onClick={() => setNotifications((prev) => prev.filter((_, idx) => idx !== i))}
            >
              {notif}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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