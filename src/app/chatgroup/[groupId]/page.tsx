"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { doc, onSnapshot, updateDoc, Timestamp, collection, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, User, LogOut, Reply } from "lucide-react";
import { signOut } from "firebase/auth";

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp;
  replyTo?: string;
}

interface User {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export default function ChatGroupPage() {
  const [user, setUser] = useState(auth.currentUser);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userList, setUserList] = useState<User[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replyButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

        const fetchedMessages = (groupData.messages || []).map((msg: any, index: any) => {
          console.log(`Message ${index} from Firestore:`, msg);
          return {
            id: msg.id || `${msg.createdAt?.toMillis?.() || Date.now()}`,
            text: typeof msg.text === "string" ? msg.text : "",
            sender: typeof msg.sender === "string" ? msg.sender : "unknown",
            createdAt: msg.createdAt instanceof Timestamp ? msg.createdAt : Timestamp.now(),
            replyTo: typeof msg.replyTo === "string" ? msg.replyTo : undefined,
          };
        });

        console.log("Sanitized Fetched Messages:", fetchedMessages);
        setMessages(fetchedMessages);
      } else {
        router.push("/");
      }
    }, (error) => {
      console.error("Error listening to group details:", error);
    });

    const fetchUsers = async () => {
      try {
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
      } catch (error) {
        console.error("Error fetching users:", error);
      }
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !groupId) return;

    const messageData: Message = {
        sender: user.uid || "unknown",
        text: newMessage || "",
        createdAt: Timestamp.now(),
        ...(replyingTo && { replyTo: replyingTo.id }),
        id: ""
    };
    console.log("New Message Data:", messageData);

    try {
      const groupRef = doc(db, "chatGroups", groupId);
      const sanitizedMessages = messages.map((msg, index) => {
        console.log(`Existing Message ${index} before sanitization:`, msg);
        // Explicitly remove undefined values
        const sanitizedMsg: Message = {
          id: msg.id,
          sender: typeof msg.sender === "string" ? msg.sender : "unknown",
          text: typeof msg.text === "string" ? msg.text : "",
          createdAt: msg.createdAt instanceof Timestamp ? msg.createdAt : Timestamp.now(),
        };
        if (msg.replyTo && typeof msg.replyTo === "string") {
          sanitizedMsg.replyTo = msg.replyTo;
        }
        return sanitizedMsg;
      });
      console.log("Sanitized Existing Messages:", sanitizedMessages);

      const updatedMessages = [...sanitizedMessages, messageData];
      console.log("Updated Messages before updateDoc:", updatedMessages);
      await updateDoc(groupRef, {
        messages: updatedMessages,
      });

      setNewMessage("");
      setReplyingTo(null);
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
    }
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
    try {
      await signOut(auth);
      setUser(null);
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Please log in to view the chat.</p>
      </div>
    );
  }

  const isMember = groupMembers.includes(user.uid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col">
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="fixed top-0 left-0 right-0 z-20 px-4 py-3 md:px-6 md:py-4 bg-gray-900/90 backdrop-blur-xl shadow-lg border-b border-gray-700/50 flex items-center justify-between"
      >
        <button
          onClick={() => router.push("/")}
          className="p-2 md:p-3 rounded-full bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 transition-all shadow-md hover:shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Go back to homepage"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
          {memberNames.map((name, index) => (
            <motion.span
              key={index}
              className="text-sm md:text-base font-medium text-indigo-100 drop-shadow-md"
              whileHover={{ scale: 1.1 }}
            >
              {name}
            </motion.span>
          ))}
        </div>
        <motion.button
          onClick={handleLogout}
          className="p-2 md:p-3 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-400"
          whileHover={{ scale: 1.1 }}
          aria-label="Log out"
        >
          <LogOut size={20} className="text-white" />
        </motion.button>
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
                        transition={{ type: "spring", stiffness: 200 }}
                      />
                    ) : (
                      <User
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-gray-700 bg-gray-700 p-2 mr-2 md:mr-3 shadow-md glow-xs"
                        aria-label={`${senderName}'s avatar`}
                      />
                    )
                  )}
                  <div className="relative flex items-start gap-2">
                    <motion.div
                      className={`p-3 md:p-4 rounded-2xl max-w-xs md:max-w-md shadow-lg hover:shadow-xl transition-all ${
                        msg.sender === user.uid
                          ? "bg-gradient-to-r from-indigo-600 to-blue-500 text-white glow-sm"
                          : "bg-gradient-to-r from-gray-700 to-gray-600 text-gray-100 glow-xs"
                      } text-sm md:text-base font-medium`}
                      whileHover={{ scale: 1.03, zIndex: 10 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      {repliedToMessage && (
                        <div
                          className="mb-2 p-2 bg-gray-800/80 rounded-lg text-xs border-l-4 border-indigo-500 cursor-pointer hover:bg-gray-700/80 transition-colors"
                          onClick={() => scrollToMessage(repliedToMessage.id)}
                          onKeyDown={(e) => e.key === "Enter" && scrollToMessage(repliedToMessage.id)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Jump to message by ${repliedToSender}: ${repliedToMessage.text}`}
                        >
                          <span className="block font-semibold text-indigo-300">
                            Replying to {repliedToSender}
                          </span>
                          <span className="block truncate">{repliedToMessage.text}</span>
                        </div>
                      )}
                      <span className="block font-bold">{senderName}</span>
                      <span id={`message-content-${msg.id}`}>{msg.text}</span>
                      {repliedToMessage && (
                        <span className="sr-only" aria-describedby={`message-content-${msg.id}`}>
                          This message is a reply to {repliedToSender}'s message: {repliedToMessage.text}
                        </span>
                      )}
                    </motion.div>
                    <button
                      ref={(el) => {
                        if (el) replyButtonRefs.current.set(msg.id, el);
                      }}
                      onClick={() => handleReply(msg)}
                      className="p-1 bg-gray-600 rounded-full hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                      aria-label={`Reply to ${senderName}'s message: ${msg.text}`}
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
          className="fixed bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gray-900/90 backdrop-blur-xl shadow-lg border-t border-gray-700/50 flex flex-col gap-3"
        >
          {replyingTo && (
            <div
              role="region"
              aria-live="polite"
              className="flex items-center justify-between p-2 bg-gray-800/80 rounded-xl shadow-md border border-indigo-500/50"
            >
              <div className="flex items-center gap-2">
                <Reply size={16} className="text-indigo-400" />
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
                className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="flex-1 p-3 md:p-4 bg-gray-800/80 text-white rounded-xl outline-none shadow-md focus:ring-2 focus:ring-indigo-400 transition-all placeholder-gray-400 text-sm md:text-base glow-xs"
              placeholder="Type a message..."
              aria-label="Type a message to send"
            />
            <motion.button
              onClick={handleSendMessage}
              className="p-2 md:p-3 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full hover:from-indigo-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg glow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              aria-label="Send message"
            >
              <Send size={20} className="text-white" />
            </motion.button>
          </div>
        </motion.footer>
      )}
      {!isMember && (
        <div className="fixed bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gray-900/90 backdrop-blur-xl shadow-lg border-t border-gray-700/50 text-center text-gray-400">
          You are not a member of this group.
        </div>
      )}
    </div>
  );
}