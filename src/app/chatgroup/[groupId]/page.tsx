"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { doc, onSnapshot, updateDoc, Timestamp, collection, getDocs } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, User, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";

interface Message {
  id: string;
  text: string;
  sender: string;
  createdAt: Timestamp;
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
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((authUser) => {
      setUser(authUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !groupId) return;

    // Set up real-time listener for group details
    const groupRef = doc(db, "chatGroups", groupId);
    const unsubscribe = onSnapshot(groupRef, (groupDoc) => {
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const members = groupData.members || [];
        setGroupMembers(members);

        if (!members.includes(user.uid)) {
          setNewMessage("");
        }

        // Sanitize and log messages from Firestore
        const fetchedMessages = (groupData.messages || []).map((msg: any, index: any) => {
          console.log(`Message ${index} from Firestore:`, msg); // Debug log
          return {
            id: msg.id || `${msg.timestamp?.toMillis?.() || Date.now()}`,
            text: typeof msg.text === "string" ? msg.text : "",
            sender: typeof msg.sender === "string" ? msg.sender : "unknown",
            createdAt: msg.timestamp instanceof Timestamp ? msg.timestamp : Timestamp.now(),
          };
        });

        console.log("Sanitized Fetched Messages:", fetchedMessages); // Debug log
        setMessages(fetchedMessages);
      } else {
        router.push("/");
      }
    }, (error) => {
      console.error("Error listening to group details:", error);
    });

    // Fetch users (one-time fetch is fine since user data doesn't change often)
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

    // Clean up the listener on unmount
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

    // Sanitize and log new message data
    const messageData = {
      sender: user.uid || "unknown",
      text: newMessage || "",
      timestamp: Timestamp.now(),
    };
    console.log("New Message Data:", messageData); // Debug log

    try {
      const groupRef = doc(db, "chatGroups", groupId);
      // Sanitize existing messages before adding the new one
      const sanitizedMessages = messages.map((msg, index) => {
        console.log(`Existing Message ${index} before sanitization:`, msg); // Debug log
        return {
          id: msg.id,
          sender: typeof msg.sender === "string" ? msg.sender : "unknown",
          text: typeof msg.text === "string" ? msg.text : "",
          createdAt: msg.createdAt instanceof Timestamp ? msg.createdAt : Timestamp.now(),
        };
      });
      console.log("Sanitized Existing Messages:", sanitizedMessages); // Debug log

      const updatedMessages = [...sanitizedMessages, messageData];
      console.log("Updated Messages before updateDoc:", updatedMessages); // Debug log
      await updateDoc(groupRef, {
        messages: updatedMessages,
      });

      // No need to call setMessages here since onSnapshot will handle the update
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
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
          className="p-2 md:p-3 rounded-full bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 transition-all shadow-md hover:shadow-lg transform hover:scale-105"
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
          className="p-2 md:p-3 bg-red-500 rounded-full hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
          whileHover={{ scale: 1.1 }}
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
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 30, rotateX: "-90deg" }}
                  animate={{ opacity: 1, y: 0, rotateX: "0deg" }}
                  exit={{ opacity: 0, y: -30, rotateX: "90deg" }}
                  transition={{ type: "spring", stiffness: 150 }}
                  className={`flex items-end ${msg.sender === user.uid ? "justify-end" : "justify-start"}`}
                >
                  {msg.sender !== user.uid && (
                    sender?.photoURL ? (
                      <motion.img
                        src={sender.photoURL}
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
                      msg.sender === user.uid
                        ? "bg-gradient-to-r from-indigo-600 to-blue-500 text-white glow-sm"
                        : "bg-gradient-to-r from-gray-700 to-gray-600 text-gray-100 glow-xs"
                    } text-sm md:text-base font-medium`}
                    whileHover={{ scale: 1.03, zIndex: 10 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <span className="block font-bold">{senderName}</span>
                    {msg.text}
                  </motion.div>
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
          className="fixed bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gray-900/90 backdrop-blur-xl shadow-lg border-t border-gray-700/50 flex items-center gap-3"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 p-3 md:p-4 bg-gray-800/80 text-white rounded-xl outline-none shadow-md focus:ring-2 focus:ring-indigo-400 transition-all placeholder-gray-400 text-sm md:text-base glow-xs"
            placeholder="Type a message..."
          />
          <motion.button
            onClick={handleSendMessage}
            className="p-2 md:p-3 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full hover:from-indigo-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg glow-sm"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Send size={20} className="text-white" />
          </motion.button>
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