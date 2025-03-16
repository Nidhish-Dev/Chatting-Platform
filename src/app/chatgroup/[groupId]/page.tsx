"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "@/app/lib/firebase";
import { doc, getDoc, updateDoc, Timestamp, collection, getDocs } from "firebase/firestore";
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
  const [groupMembers, setGroupMembers] = useState<string[]>([]); // Store member UIDs
  const [memberNames, setMemberNames] = useState<string[]>([]); // Store member display names
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
    const fetchGroupDetails = async () => {
      if (!user || !groupId) return;

      try {
        const groupRef = doc(db, "chatGroups", groupId);
        const groupDoc = await getDoc(groupRef);
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          const members = groupData.members || [];
          setGroupMembers(members);

          // Check if the current user is a member
          if (!members.includes(user.uid)) {
            setNewMessage(""); // Clear input if not a member
          }

          setMessages(
            (groupData.messages || []).map((msg: any) => ({
              id: msg.id || `${msg.timestamp.toMillis()}`,
              text: msg.text,
              sender: msg.sender,
              createdAt: msg.timestamp,
            }))
          );
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Error fetching group details:", error);
      }
    };

    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);
        const usersList = usersSnapshot.docs.map((doc) => {
          const data = doc.data();
          console.log("User Document:", data); // Debug: Log each user document
          return {
            uid: data.uid || doc.id,
            displayName: data.displayName || data.name || "Unknown User", // Check for both displayName and name
            photoURL: data.photoURL,
          };
        });
        setUserList(usersList);
        console.log("User List:", usersList); // Debug: Log the final userList

        // Update member names after setting userList
        updateMemberNames(usersList, groupMembers);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    if (user && groupId) {
      fetchGroupDetails();
      fetchUsers();
    }
  }, [user, groupId, router]);

  // Separate effect to update member names when groupMembers or userList changes
  useEffect(() => {
    updateMemberNames(userList, groupMembers);
  }, [userList, groupMembers]);

  // Helper function to update member names
  const updateMemberNames = (users: User[], members: string[]) => {
    const names = members.map((memberId) => {
      const member = users.find((u) => u.uid === memberId);
      return member?.displayName || "Unknown User"; // Fallback to "Unknown User"
    });
    setMemberNames(names);
    console.log("Member Names:", names); // Debug: Log the member names
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !groupId) return;

    const messageData = {
      sender: user.uid,
      text: newMessage,
      timestamp: Timestamp.now(),
    };

    try {
      const groupRef = doc(db, "chatGroups", groupId);
      const updatedMessages = [...messages, messageData];
      await updateDoc(groupRef, {
        messages: updatedMessages,
      });

      setMessages([
        ...messages,
        { ...messageData, id: `${messageData.timestamp.toMillis()}`, createdAt: messageData.timestamp },
      ]);
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

  // Check if the current user is a member of the group
  const isMember = groupMembers.includes(user.uid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col">
      {/* Fixed Header */}
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

      {/* Scrollable Chat Messages */}
      <div className="flex-1 pt-20 pb-20 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          <AnimatePresence>
            {messages.map((msg) => {
              const sender = userList.find((u) => u.uid === msg.sender);
              const senderName = sender?.displayName || "Unknown User"; // Fallback to "Unknown User"
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

      {/* Fixed Message Input - Only visible to group members */}
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