"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { doc, onSnapshot, updateDoc, Timestamp, collection, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, User, LogOut, Reply, Paperclip, Smile } from "lucide-react";
import { signOut } from "firebase/auth";

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

const emojiList = ["😊", "😂", "❤️", "👍", "😢", "😡", "🎉", "🙌", "👀", "🤔"];

export default function ChatGroupPage() {
  const [user, setUser] = useState(auth.currentUser);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userList, setUserList] = useState<User[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [theme, setTheme] = useState("love");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replyButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map()); // Reintroduced

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
        const members = groupData.members || [];
        setGroupMembers(members);

        if (!members.includes(user.uid)) {
          setNewMessage("");
        }

        const fetchedMessages = (groupData.messages || []).map((msg: any) => ({
          id: msg.id || `${msg.createdAt?.toMillis?.() || Date.now()}`,
          text: typeof msg.text === "string" ? msg.text : "",
          sender: typeof msg.sender === "string" ? msg.sender : "unknown",
          createdAt: msg.createdAt instanceof Timestamp ? msg.createdAt : Timestamp.now(),
          replyTo: typeof msg.replyTo === "string" ? msg.replyTo : undefined,
          imageBase64: typeof msg.imageBase64 === "string" ? msg.imageBase64 : undefined,
        }));

        setMessages(fetchedMessages);
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
  }, [user, groupId, router]);

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

        // Check if file size exceeds 1 MB (1 MB = 1024 * 1024 bytes)
        const maxSize = 1024 * 1024; // 1 MB
        if (file.size > maxSize) {
          // Calculate scaling factor to reduce size (approximate, as Base64 increases size by ~33%)
          const scale = Math.sqrt(maxSize / file.size) * 0.7; // Target < 1 MB after Base64
          width = img.width * scale;
          height = img.height * scale;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to Base64 with quality reduction if needed
        const base64String = canvas.toDataURL("image/jpeg", 0.7); // 70% quality
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
      imageBase64 = await resizeImage(file); // Resize if needed
      fileInputRef.current.value = "";
    }

    const messageData: Message = {
      sender: user.uid || "unknown",
      text: newMessage || "",
      createdAt: Timestamp.now(),
      ...(replyingTo && { replyTo: replyingTo.id }),
      ...(imageBase64 && { imageBase64 }),
      id: "",
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

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    router.push("/");
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${themes.love.bg} text-white`}>
        <p>Please log in to view the chat.</p>
      </div>
    );
  }

  const isMember = groupMembers.includes(user.uid);
  const currentTheme = themes[theme as keyof typeof themes];

  return (
    <div className={`min-h-screen ${currentTheme.bg} text-white flex flex-col`}>
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
        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
          {memberNames.map((name, index) => (
            <motion.span
              key={index}
              className={`text-sm md:text-base font-medium ${currentTheme.accent} drop-shadow-md`}
              whileHover={{ scale: 1.1 }}
            >
              {name}
            </motion.span>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
          <motion.button
            onClick={handleLogout}
            className="p-2 md:p-3 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
            whileHover={{ scale: 1.1 }}
          >
            <LogOut size={20} className="text-white" />
          </motion.button>
        </div>
      </motion.header>

      <div className="flex-1 pt-20 pb-20 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <AnimatePresence>
            {messages.map((msg) => {
              const sender = userList.find((u) => u.uid === msg.sender);
              const senderName = sender?.displayName || "Unknown User";
              const repliedToMessage = msg.replyTo
                ? messages.find((m) => m.id === msg.replyTo)
                : null;
              const repliedToSender = repliedToMessage
                ? userList.find((u) => u.uid === repliedToMessage.sender)?.displayName || "Unknown User"
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
                  className={`flex items-end ${msg.sender === user.uid ? "justify-end" : "justify-start"} relative`}
                >
                  {msg.sender !== user.uid && (
                    sender?.photoURL ? (
                      <motion.img
                        src={sender.photoURL}
                        alt={`${senderName}'s avatar`}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-gray-700 shadow-md mr-2 md:mr-3 glow-xs"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                      />
                    ) : (
                      <User className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-gray-700 bg-gray-700 p-2 mr-2 md:mr-3 shadow-md glow-xs" />
                    )
                  )}
                  <div className="relative flex items-start gap-2">
                    <motion.div
                      className={`p-3 md:p-4 rounded-2xl max-w-xs md:max-w-md shadow-lg hover:shadow-xl transition-all ${
                        msg.sender === user.uid ? currentTheme.sent : currentTheme.received
                      } text-sm md:text-base font-medium`}
                      whileHover={{ scale: 1.03, zIndex: 10 }}
                    >
                      {repliedToMessage && (
                        <div
                          className="mb-2 p-2 bg-gray-800/80 rounded-lg text-xs border-l-4 border-red-500 cursor-pointer hover:bg-gray-700/80 transition-colors"
                          onClick={() => scrollToMessage(repliedToMessage.id)}
                          onKeyDown={(e) => e.key === "Enter" && scrollToMessage(repliedToMessage.id)}
                          tabIndex={0}
                        >
                          <span className="block font-semibold text-red-300">
                            Replying to {repliedToSender}
                          </span>
                          <span className="block truncate">{repliedToMessage.text}</span>
                        </div>
                      )}
                      <span className="block font-bold">{senderName}</span>
                      {msg.text && <span>{msg.text}</span>}
                      {msg.imageBase64 && (
                        <img
                          src={msg.imageBase64}
                          alt="Attachment"
                          className="mt-2 max-w-full rounded-lg shadow-md"
                        />
                      )}
                    </motion.div>
                    <button
                      ref={(el) => {
                        if (el) replyButtonRefs.current.set(msg.id, el); // Set ref correctly
                      }}
                      onClick={() => handleReply(msg)}
                      className="p-1 bg-gray-600 rounded-full hover:bg-gray-500 transition-colors"
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

      {isMember && (
        <motion.footer
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 120 }}
          className={`fixed bottom-0 left-0 right-0 z-20 p-4 md:p-6 ${currentTheme.header} backdrop-blur-xl shadow-lg border-t border-gray-700/50 flex flex-col gap-3`}
        >
          {replyingTo && (
            <div
              className="flex items-center justify-between p-2 bg-gray-800/80 rounded-xl shadow-md border border-red-500/50"
            >
              <div className="flex items-center gap-2">
                <Reply size={16} className="text-red-400" />
                <span className="text-sm text-gray-300">
                  Replying to{" "}
                  {userList.find((u) => u.uid === replyingTo.sender)?.displayName || "Unknown User"}:{" "}
                  {replyingTo.text.length > 30
                    ? replyingTo.text.substring(0, 30) + "..."
                    : replyingTo.text}
                </span>
              </div>
              <button
                onClick={cancelReply}
                className="text-gray-400 hover:text-white"
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
          <div className="flex items-center gap-3 relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className={`flex-1 p-3 md:p-4 ${currentTheme.input} text-white rounded-xl outline-none shadow-md focus:ring-2 focus:ring-red-400 transition-all placeholder-gray-400 text-sm md:text-base glow-xs`}
              placeholder="Type a message..."
            />
            <motion.button
              onClick={handleFileUploadClick}
              className="p-2 bg-gray-600 rounded-full hover:bg-gray-500 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Paperclip size={20} className="text-white" />
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleSendMessage}
            />
            <motion.button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="p-2 bg-gray-600 rounded-full hover:bg-gray-500 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Smile size={20} className="text-white" />
            </motion.button>
            {showEmojiPicker && (
              <div className="absolute bottom-16 right-16 bg-gray-800 p-2 rounded-lg shadow-lg flex gap-2 flex-wrap z-30">
                {emojiList.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-2xl hover:bg-gray-700 rounded p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <motion.button
              onClick={handleSendMessage}
              className={`p-2 md:p-3 ${currentTheme.button} rounded-full ${currentTheme.hoverButton} transition-all shadow-md hover:shadow-lg glow-sm`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Send size={20} className="text-white" />
            </motion.button>
          </div>
        </motion.footer>
      )}
      {!isMember && (
        <div className={`fixed bottom-0 left-0 right-0 z-20 p-4 md:p-6 ${currentTheme.header} backdrop-blur-xl shadow-lg border-t border-gray-700/50 text-center text-gray-400`}>
          You are not a member of this group.
        </div>
      )}
    </div>
  );
}