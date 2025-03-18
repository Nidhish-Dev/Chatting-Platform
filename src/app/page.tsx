"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db, provider } from "@/app/lib/firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { motion } from "framer-motion";
import { LogOut, UserCircle, PlusCircle, X, SortAsc, SortDesc, Search, Send, Paperclip, Smile, Trash2, Reply } from "lucide-react";
import EmojiPicker from "emoji-picker-react";

interface User {
  id: string;
  name?: string;
  photoURL?: string;
  unreadCount: number;
}

interface ChatGroup {
  id: string;
  name: string;
  members: string[];
  creator: string;
}

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp;
  isRead: boolean;
  replyTo?: string;
  attachment?: string;
}

const themes = {
  dark: {
    bg: "bg-gradient-to-br from-gray-900 via-gray-800 to-black",
    sidebar: "bg-gray-800/95",
    card: "bg-gray-700/80 hover:bg-gray-600",
    accent: "text-gray-100",
    glow: "shadow-[0_4px_15px_rgba(255,255,255,0.1)]",
    button: "bg-gradient-to-r from-blue-600 to-indigo-600",
    buttonHover: "hover:from-blue-700 hover:to-indigo-700",
    chatArea: "bg-gray-900/95",
    messageSent: "bg-blue-600",
    messageReceived: "bg-gray-600",
    inputBg: "bg-gray-800/90",
    searchBg: "bg-gray-700/90",
  },
  love: {
    bg: "bg-gradient-to-br from-pink-900 via-red-800 to-purple-900",
    sidebar: "bg-pink-800/95",
    card: "bg-pink-700/80 hover:bg-pink-600",
    accent: "text-pink-100",
    glow: "shadow-[0_4px_15px_rgba(255,105,180,0.3)]",
    button: "bg-gradient-to-r from-red-500 to-pink-500",
    buttonHover: "hover:from-red-600 hover:to-pink-600",
    chatArea: "bg-pink-900/95",
    messageSent: "bg-red-500",
    messageReceived: "bg-pink-600",
    inputBg: "bg-pink-800/90",
    searchBg: "bg-pink-700/90",
  },
  ocean: {
    bg: "bg-gradient-to-br from-teal-900 via-blue-800 to-cyan-900",
    sidebar: "bg-teal-800/95",
    card: "bg-teal-700/80 hover:bg-teal-600",
    accent: "text-cyan-100",
    glow: "shadow-[0_4px_15px_rgba(0,255,255,0.3)]",
    button: "bg-gradient-to-r from-blue-500 to-teal-500",
    buttonHover: "hover:from-blue-600 hover:to-teal-600",
    chatArea: "bg-teal-900/95",
    messageSent: "bg-blue-500",
    messageReceived: "bg-teal-600",
    inputBg: "bg-teal-800/90",
    searchBg: "bg-teal-700/90",
  },
  forest: {
    bg: "bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900",
    sidebar: "bg-green-800/95",
    card: "bg-green-700/80 hover:bg-green-600",
    accent: "text-emerald-100",
    glow: "shadow-[0_4px_15px_rgba(0,255,127,0.3)]",
    button: "bg-gradient-to-r from-green-500 to-emerald-500",
    buttonHover: "hover:from-green-600 hover:to-emerald-600",
    chatArea: "bg-green-900/95",
    messageSent: "bg-green-500",
    messageReceived: "bg-emerald-600",
    inputBg: "bg-green-800/90",
    searchBg: "bg-green-700/90",
  },
  space: {
    bg: "bg-gradient-to-br from-indigo-900 via-purple-800 to-blue-900",
    sidebar: "bg-indigo-800/95",
    card: "bg-indigo-700/80 hover:bg-indigo-600",
    accent: "text-indigo-100",
    glow: "shadow-[0_4px_15px_rgba(147,112,219,0.3)]",
    button: "bg-gradient-to-r from-purple-500 to-indigo-500",
    buttonHover: "hover:from-purple-600 hover:to-indigo-600",
    chatArea: "bg-indigo-900/95",
    messageSent: "bg-purple-500",
    messageReceived: "bg-indigo-600",
    inputBg: "bg-indigo-800/90",
    searchBg: "bg-indigo-700/90",
  },
};

export default function HomePage() {
  const [user, setUser] = useState(auth.currentUser);
  const [users, setUsers] = useState<User[]>([]);
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [sortChatsBy, setSortChatsBy] = useState<"name" | "unread">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState<{ type: "user" | "group"; id: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [theme, setTheme] = useState<keyof typeof themes>("dark");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      const data = doc.data();
      setTheme((data?.theme as keyof typeof themes) || "dark");
    });
    return () => unsubscribe();
  }, [user]);

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
            theme: "dark",
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
            where("isRead", "==", false)
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

      setUsers(usersData.filter((u) => u !== null) as User[]);
    };

    const fetchChatGroups = async () => {
      if (!user) return;

      try {
        const groupQuerySnapshot = await getDocs(collection(db, "chatGroups"));
        const groupData = groupQuerySnapshot.docs
          .map((doc) => ({
            id: doc.id,
            name: doc.data().name || "Unnamed Group",
            members: doc.data().members || [],
            creator: doc.data().creator || "",
          }))
          .filter((group) => group.members.includes(user.uid) || group.creator === user.uid);

        setChatGroups(groupData);
      } catch (error) {
        console.error("Error fetching chat groups:", error);
      }
    };

    if (user) {
      fetchUsersWithUnreadCount();
      fetchChatGroups();
    }
  }, [user]);

  useEffect(() => {
    if (!selectedChat || !user) return;

    const chatId =
      selectedChat.type === "user"
        ? [user.uid, selectedChat.id].sort().join("_")
        : selectedChat.id;

    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        text: doc.data().text || "",
        sender: doc.data().sender || "Unknown",
        createdAt: doc.data().createdAt || Timestamp.now(),
        isRead: doc.data().isRead || false,
        replyTo: doc.data().replyTo || undefined,
        attachment: doc.data().attachment || undefined,
      }));
      setMessages(fetchedMessages);

      fetchedMessages.forEach(async (msg) => {
        if (msg.sender !== user.uid && !msg.isRead) {
          await setDoc(doc(db, "messages", msg.id), { isRead: true }, { merge: true });
        }
      });
    });

    return () => unsubscribe();
  }, [selectedChat, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = async () => {
    await signInWithPopup(auth, provider);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const createChatGroup = async () => {
    if (!user || selectedMembers.length === 0) return;

    try {
      const newGroupRef = await addDoc(collection(db, "chatGroups"), {
        name: "New Group",
        members: [user.uid, ...selectedMembers],
        creator: user.uid,
      });

      setChatGroups([
        ...chatGroups,
        { id: newGroupRef.id, name: "New Group", members: [user.uid, ...selectedMembers], creator: user.uid },
      ]);
      setShowCreateGroup(false);
      setSelectedMembers([]);
      router.push(`/chatgroup/${newGroupRef.id}`);
    } catch (error) {
      console.error("Error creating chat group:", error);
    }
  };

  const sendMessage = async (text: string = "", attachment: File | null = null) => {
    if ((!text.trim() && !attachment) || !user || !selectedChat) return;

    const chatId =
      selectedChat.type === "user"
        ? [user.uid, selectedChat.id].sort().join("_")
        : selectedChat.id;

    const messageData: any = {
      text,
      sender: user.uid,
      chatId,
      createdAt: Timestamp.now(),
      isRead: false,
    };

    if (replyTo) messageData.replyTo = replyTo;
    if (attachment) messageData.attachment = URL.createObjectURL(attachment); // Use Firebase Storage in production

    await addDoc(collection(db, "messages"), messageData);

    setNewMessage("");
    setReplyTo(null);
    setAttachment(null);
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user && selectedChat) {
      const file = e.target.files[0];
      setAttachment(file);
      sendMessage("", file);
    }
  };

  const handleEmojiClick = (emojiObject: any) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
  };

  const toggleTheme = async (newTheme: keyof typeof themes) => {
    setTheme(newTheme);
    if (user) {
      await setDoc(doc(db, "users", user.uid), { theme: newTheme }, { merge: true });
    }
  };

  const deleteMessage = async (messageId: string) => {
    await deleteDoc(doc(db, "messages", messageId));
  };

  const filteredUsers = searchQuery
    ? users.filter((u) => u.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : users;
  const filteredGroups = searchQuery
    ? chatGroups.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : chatGroups;

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortChatsBy === "name") {
      return sortDirection === "asc"
        ? (a.name || "").localeCompare(b.name || "")
        : (b.name || "").localeCompare(a.name || "");
    }
    return sortDirection === "asc" ? a.unreadCount - b.unreadCount : b.unreadCount - a.unreadCount;
  });

  const sortedGroups = [...filteredGroups].sort((a, b) =>
    sortDirection === "asc"
      ? a.name.localeCompare(b.name)
      : b.name.localeCompare(a.name)
  );

  const handleSortChats = (by: "name" | "unread") => {
    setSortChatsBy(by);
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleSortGroups = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleProfileClick = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleChatSelect = (id: string, type: "user" | "group") => {
    if (type === "user") {
      setSelectedChat({ type, id });
    } else {
      router.push(`/chatgroup/${id}`);
    }
  };

  return (
    <div className={`min-h-screen ${themes[theme].bg} flex flex-col font-sans`}>
      {/* Header */}
      {user && (
        <motion.header
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`fixed top-0 left-0 right-0 z-20 px-6 py-4 ${themes[theme].sidebar} shadow-lg flex items-center justify-between`}
        >
          <div className="flex items-center gap-4">
            <motion.img
              src={user.photoURL || "/default-avatar.png"}
              alt="User Avatar"
              className="w-12 h-12 rounded-full border-2 border-opacity-50 border-white"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={() => handleProfileClick(user.uid)}
            />
            <h2 className={`text-2xl font-bold ${themes[theme].accent}`}>{user.displayName}</h2>
          </div>
          <div className="flex gap-4">
            <motion.select
              value={theme}
              onChange={(e) => toggleTheme(e.target.value as keyof typeof themes)}
              className={`p-3 rounded-xl ${themes[theme].button} text-white ${themes[theme].buttonHover} bg-opacity-95 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50`}
              style={{ minWidth: "140px" }}
            >
              {Object.keys(themes).map((t) => (
                <option key={t} value={t} className={`${themes[theme].inputBg} text-white`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </motion.select>
            <motion.button
              onClick={handleLogout}
              className="p-3 bg-red-500 rounded-full text-white hover:bg-red-600 transition-all"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut size={24} />
            </motion.button>
          </div>
        </motion.header>
      )}

      {/* Main Layout */}
      {user ? (
        <div className="flex flex-1 pt-20">
          {/* Sidebar (Left) - Visible only on large screens */}
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`hidden lg:block fixed left-0 top-20 bottom-0 w-80 ${themes[theme].sidebar} shadow-lg overflow-y-auto p-6 rounded-r-3xl`}
          >
            <motion.div
              className={`flex items-center p-3 mb-8 ${themes[theme].searchBg} rounded-full`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
            >
              <Search size={20} className={`mr-2 ${themes[theme].accent}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats or groups..."
                className={`w-full bg-transparent ${themes[theme].accent} placeholder-${themes[theme].accent.split('-')[1]} placeholder-opacity-60 focus:outline-none`}
              />
            </motion.div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${themes[theme].accent}`}>Chats</h2>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => handleSortChats("name")}
                    className={`p-1 ${themes[theme].accent} text-opacity-70 hover:text-opacity-100`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {sortChatsBy === "name" && sortDirection === "asc" ? <SortAsc /> : <SortDesc />}
                  </motion.button>
                  <motion.button
                    onClick={() => handleSortChats("unread")}
                    className={`p-1 ${themes[theme].accent} text-opacity-70 hover:text-opacity-100`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {sortChatsBy === "unread" && sortDirection === "asc" ? <SortAsc /> : <SortDesc />}
                  </motion.button>
                </div>
              </div>
              <div className="space-y-4">
                {sortedUsers.map((u) => (
                  <motion.div
                    key={u.id}
                    className={`${themes[theme].card} p-4 rounded-xl cursor-pointer transition-all ${themes[theme].glow} ${
                      selectedChat?.type === "user" && selectedChat.id === u.id ? "bg-opacity-90" : ""
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => handleChatSelect(u.id, "user")}
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={u.photoURL}
                        alt={`${u.name}'s avatar`}
                        className="w-12 h-12 rounded-full border-2 border-opacity-50 border-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProfileClick(u.id);
                        }}
                      />
                      <span className="truncate text-lg font-medium">{u.name}</span>
                      {u.unreadCount > 0 && (
                        <span className="ml-auto bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                          {u.unreadCount}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${themes[theme].accent}`}>Groups</h2>
                <motion.button
                  onClick={handleSortGroups}
                  className={`p-1 ${themes[theme].accent} text-opacity-70 hover:text-opacity-100`}
                  whileHover={{ scale: 1.1 }}
                >
                  {sortDirection === "asc" ? <SortAsc /> : <SortDesc />}
                </motion.button>
              </div>
              <div className="space-y-4">
                {sortedGroups.map((group) => (
                  <motion.div
                    key={group.id}
                    className={`${themes[theme].card} p-4 rounded-xl cursor-pointer transition-all ${themes[theme].glow}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => handleChatSelect(group.id, "group")}
                  >
                    <span className="truncate text-lg font-medium">{group.name}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.button
              onClick={() => setShowCreateGroup(true)}
              className={`${themes[theme].button} text-white px-6 py-3 rounded-xl mt-8 w-full ${themes[theme].buttonHover} transition-all text-lg font-medium`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <PlusCircle size={24} className="inline mr-2" />
              New Group
            </motion.button>
          </motion.aside>

          {/* Chat Area (Center) - Visible only on large screens for user chats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="hidden lg:flex flex-1 justify-center items-center ml-80"
          >
            <div className={`w-full max-w-4xl h-[calc(100vh-5rem)] ${themes[theme].chatArea} rounded-2xl shadow-lg flex flex-col`}>
              {selectedChat && selectedChat.type === "user" ? (
                <>
                  <div className="p-6 flex items-center gap-4">
                    <img
                      src={users.find((u) => u.id === selectedChat.id)?.photoURL || "/default-avatar.png"}
                      alt="Chat Avatar"
                      className="w-12 h-12 rounded-full border-2 border-opacity-50 border-white"
                    />
                    <h3 className={`text-2xl font-semibold ${themes[theme].accent}`}>
                      {users.find((u) => u.id === selectedChat.id)?.name || "Unknown User"}
                    </h3>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className={`flex ${
                          msg.sender === user?.uid ? "justify-end" : "justify-start"
                        } mb-6 relative group`}
                      >
                        <div
                          className={`max-w-[70%] p-4 rounded-xl ${
                            msg.sender === user?.uid ? themes[theme].messageSent : themes[theme].messageReceived
                          } ${themes[theme].glow}`}
                        >
                          <p className="text-sm opacity-70 font-medium">
                            {msg.sender === user?.uid
                              ? "You"
                              : users.find((u) => u.id === msg.sender)?.name || "Unknown"}
                          </p>
                          {msg.replyTo && (
                            <div className={`${themes[theme].inputBg} p-2 rounded mb-2 text-sm italic`}>
                              <span className="block truncate">
                                {messages.find((m) => m.id === msg.replyTo)?.text || "Original message not found"}
                              </span>
                            </div>
                          )}
                          <p className="text-base">{msg.text}</p>
                          {msg.attachment && (
                            <img
                              src={msg.attachment}
                              alt="Attachment"
                              className="mt-2 w-full max-w-[200px] h-auto rounded-lg cursor-pointer"
                              onClick={() => setSelectedImage(msg.attachment ?? null)} // Fix: Handle undefined
                            />
                          )}
                          <div
                            className={`absolute top-2 ${
                              msg.sender === user?.uid ? "right-2" : "left-2"
                            } opacity-0 group-hover:opacity-100 transition-opacity flex gap-2`}
                          >
                            <motion.button
                              onClick={() => setReplyTo(msg.id)}
                              className={`${themes[theme].button} text-white p-1 rounded-full ${themes[theme].buttonHover}`}
                              whileHover={{ scale: 1.1 }}
                            >
                              <Reply size={16} />
                            </motion.button>
                            {msg.sender === user?.uid && (
                              <motion.button
                                onClick={() => deleteMessage(msg.id)}
                                className="p-1 text-red-400 bg-opacity-70 bg-gray-800 rounded-full hover:bg-opacity-90"
                                whileHover={{ scale: 1.1 }}
                              >
                                <Trash2 size={16} />
                              </motion.button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-6 flex flex-col gap-4">
                    {replyTo && (
                      <div className={`flex items-center gap-3 text-sm opacity-70 ${themes[theme].accent} ${themes[theme].inputBg} p-2 rounded-xl`}>
                        <span className="truncate">Replying to: {messages.find((m) => m.id === replyTo)?.text || "Message"}</span>
                        <motion.button
                          onClick={() => setReplyTo(null)}
                          className="text-red-400 hover:text-red-600"
                          whileHover={{ scale: 1.1 }}
                        >
                          <X size={16} />
                        </motion.button>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage(newMessage)}
                        placeholder="Type a message..."
                        className={`flex-1 p-3 rounded-xl ${themes[theme].inputBg} ${themes[theme].accent} focus:outline-none focus:ring-2 focus:ring-opacity-50 focus:ring-${themes[theme].accent.split('-')[1]}`}
                      />
                      <motion.button
                        onClick={() => fileInputRef.current?.click()}
                        className={`${themes[theme].button} text-white p-3 rounded-full ${themes[theme].buttonHover}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Paperclip size={20} />
                      </motion.button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <motion.button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`${themes[theme].button} text-white p-3 rounded-full ${themes[theme].buttonHover}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Smile size={20} />
                      </motion.button>
                      <motion.button
                        onClick={() => sendMessage(newMessage)}
                        className={`${themes[theme].button} text-white p-3 rounded-full ${themes[theme].buttonHover}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Send size={20} />
                      </motion.button>
                    </div>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute bottom-20 right-6"
                      >
                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                      </motion.div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className={`text-lg ${themes[theme].accent} opacity-70`}>Select a chat to start messaging</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Mobile Layout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`lg:hidden w-full max-w-4xl mx-auto p-6`}
          >
            <div className={`flex items-center p-3 mb-8 ${themes[theme].searchBg} rounded-full`}>
              <Search size={20} className={`mr-2 ${themes[theme].accent}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats or groups..."
                className={`w-full bg-transparent ${themes[theme].accent} placeholder-${themes[theme].accent.split('-')[1]} placeholder-opacity-60 focus:outline-none`}
              />
            </div>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${themes[theme].accent}`}>Chats</h2>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => handleSortChats("name")}
                    className={`p-1 ${themes[theme].accent} text-opacity-70 hover:text-opacity-100`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {sortChatsBy === "name" && sortDirection === "asc" ? <SortAsc /> : <SortDesc />}
                  </motion.button>
                  <motion.button
                    onClick={() => handleSortChats("unread")}
                    className={`p-1 ${themes[theme].accent} text-opacity-70 hover:text-opacity-100`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {sortChatsBy === "unread" && sortDirection === "asc" ? <SortAsc /> : <SortDesc />}
                  </motion.button>
                </div>
              </div>
              <div className="space-y-4">
                {sortedUsers.map((u) => (
                  <motion.div
                    key={u.id}
                    className={`${themes[theme].card} p-4 rounded-xl cursor-pointer transition-all ${themes[theme].glow}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => router.push(`/chat/${u.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={u.photoURL}
                        alt={`${u.name}'s avatar`}
                        className="w-12 h-12 rounded-full border-2 border-opacity-50 border-white"
                      />
                      <span className="truncate text-lg font-medium">{u.name}</span>
                      {u.unreadCount > 0 && (
                        <span className="ml-auto bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                          {u.unreadCount}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-xl font-semibold ${themes[theme].accent}`}>Groups</h2>
                <motion.button
                  onClick={handleSortGroups}
                  className={`p-1 ${themes[theme].accent} text-opacity-70 hover:text-opacity-100`}
                  whileHover={{ scale: 1.1 }}
                >
                  {sortDirection === "asc" ? <SortAsc /> : <SortDesc />}
                </motion.button>
              </div>
              <div className="space-y-4">
                {sortedGroups.map((group) => (
                  <motion.div
                    key={group.id}
                    className={`${themes[theme].card} p-4 rounded-xl cursor-pointer transition-all ${themes[theme].glow}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => router.push(`/chatgroup/${group.id}`)}
                  >
                    <span className="truncate text-lg font-medium">{group.name}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.button
              onClick={() => setShowCreateGroup(true)}
              className={`${themes[theme].button} text-white px-6 py-3 rounded-xl mt-8 w-full ${themes[theme].buttonHover} transition-all text-lg font-medium`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <PlusCircle size={24} className="inline mr-2" />
              New Group
            </motion.button>
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <motion.button
            onClick={handleLogin}
            className={`${themes[theme].button} text-white px-8 py-4 rounded-xl ${themes[theme].buttonHover} transition-all text-lg font-medium`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Log in with Google
          </motion.button>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowCreateGroup(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`${themes[theme].sidebar} p-6 rounded-2xl w-full max-w-md max-h-[70vh] overflow-y-auto shadow-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-semibold ${themes[theme].accent}`}>Create New Group</h2>
              <motion.button
                onClick={() => setShowCreateGroup(false)}
                whileHover={{ scale: 1.1 }}
                className={`p-2 ${themes[theme].accent} text-opacity-70 hover:text-opacity-100`}
              >
                <X size={24} />
              </motion.button>
            </div>
            <div className="space-y-4">
              {users.map((u) => (
                <motion.div
                  key={u.id}
                  className={`${themes[theme].card} p-4 rounded-xl flex items-center justify-between`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={u.photoURL}
                      alt={`${u.name}'s avatar`}
                      className="w-12 h-12 rounded-full border-2 border-opacity-50 border-white"
                      onClick={() => handleProfileClick(u.id)}
                    />
                    <span className="truncate text-lg font-medium">{u.name}</span>
                  </div>
                  <motion.button
                    onClick={() => toggleMember(u.id)}
                    className={`p-2 rounded-full ${selectedMembers.includes(u.id) ? "bg-red-500" : "bg-green-500"} text-white`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {selectedMembers.includes(u.id) ? <X size={16} /> : <PlusCircle size={16} />}
                  </motion.button>
                </motion.div>
              ))}
            </div>
            <motion.button
              onClick={createChatGroup}
              className={`${themes[theme].button} text-white w-full mt-6 p-3 rounded-xl ${themes[theme].buttonHover} transition-all text-lg font-medium`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={selectedMembers.length === 0}
            >
              Create Group
            </motion.button>
          </motion.div>
        </motion.div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setSelectedImage(null)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt="Full-size attachment"
              className="max-w-[90vw] max-h-[90vh] rounded-lg"
            />
            <motion.button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 bg-gray-800 bg-opacity-70 text-white rounded-full hover:bg-opacity-90"
              whileHover={{ scale: 1.1 }}
            >
              <X size={24} />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}