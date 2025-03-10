import { auth, database } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
    ref, 
    push, 
    set, 
    onChildAdded, 
    onValue,
    query,
    orderByChild,
    limitToLast,
    serverTimestamp,
    get
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { searchUsers } from './search.js';

// DOM Elements
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesDiv = document.getElementById('messages');
const userNameSpan = document.getElementById('user-name');
const chatHeader = document.getElementById('current-chat-info');
const chatsContent = document.getElementById('chats-content');
const noChatsMessage = document.getElementById('no-chats-message');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');

// Tabs elements
const chatsTab = document.getElementById('chats-tab');
const friendsTab = document.getElementById('friends-tab');
const requestsTab = document.getElementById('requests-tab');
const chatsTabContent = document.getElementById('chats-content');
const friendsTabContent = document.getElementById('friends-content');
const requestsTabContent = document.getElementById('requests-content');

let currentUser = null;
let username = "";
let currentChatId = null;
let currentChatUser = null;

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        
        // Get user's username from database
        const userRef = ref(database, 'users/' + user.uid);
        onValue(userRef, (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                username = userData.username;
                if (userNameSpan) {
                    userNameSpan.textContent = username;
                }
                
                // Update user status to online
                set(ref(database, `users/${user.uid}/status`), "online");
            } else {
                console.warn("User data not found in database. Creating default profile.");
                // Create default profile if missing
                const defaultProfile = {
                    username: user.email ? user.email.split('@')[0] : 'User',
                    email: user.email,
                    status: "online",
                    created_at: serverTimestamp()
                };
                
                set(ref(database, `users/${user.uid}`), defaultProfile)
                    .then(() => {
                        console.log("Created default profile for user");
                        username = defaultProfile.username;
                        if (userNameSpan) {
                            userNameSpan.textContent = username;
                        }
                    })
                    .catch(error => {
                        console.error("Error creating default profile:", error);
                    });
            }
        });
        
        // Load user's chats
        loadUserChats();
        
        // Set up tab navigation
        setupTabNavigation();
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'index.html';
    }
});

// Add logout event listener
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            if (auth.currentUser) {
                // Update user status to offline
                await set(ref(database, `users/${auth.currentUser.uid}/status`), "offline");
                
                // Sign out
                await signOut(auth);
                
                // Redirect to login page
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Error signing out:', error);
        }
    });
}

// Handle sending a new message
if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentChatId) return;
        
        const messageText = messageInput.value.trim();
        if (!messageText) return;
        
        try {
            const messagesRef = ref(database, `chats/${currentChatId}/messages`);
            const newMessageRef = push(messagesRef);
            
            await set(newMessageRef, {
                text: messageText,
                sender: currentUser.uid,
                senderName: username,
                timestamp: serverTimestamp()
            });
            
            // Update last message in chat
            await set(ref(database, `chats/${currentChatId}/lastMessage`), {
                text: messageText,
                sender: currentUser.uid,
                timestamp: serverTimestamp()
            });

            // Update chat in both users' chat lists
            const participants = currentChatId.split('_');
            for (const participantId of participants) {
                await set(ref(database, `userChats/${participantId}/${currentChatId}`), {
                    lastMessage: messageText,
                    timestamp: serverTimestamp(),
                    unread: participantId !== currentUser.uid ? true : false
                });
            }
            
            // Clear the input after sending
            messageInput.value = '';
            
        } catch (error) {
            console.error('Error sending message:', error);
        }
    });
}

// Load user's chats
function loadUserChats() {
    if (!currentUser) return;
    
    const userChatsRef = ref(database, `userChats/${currentUser.uid}`);
    
    onValue(userChatsRef, async (snapshot) => {
        const chats = snapshot.val();
        
        if (chatsContent) {
            chatsContent.innerHTML = '';
            
            if (!chats) {
                if (noChatsMessage) noChatsMessage.classList.remove('hidden');
                return;
            }
            
            if (noChatsMessage) noChatsMessage.classList.add('hidden');
            
            // Convert to array and sort by timestamp
            const chatArray = Object.entries(chats).map(([chatId, chatData]) => ({
                id: chatId,
                ...chatData
            }));
            
            chatArray.sort((a, b) => {
                const timestampA = a.timestamp ? 
                    (typeof a.timestamp === 'object' ? a.timestamp.seconds * 1000 : a.timestamp) : 0;
                const timestampB = b.timestamp ? 
                    (typeof b.timestamp === 'object' ? b.timestamp.seconds * 1000 : b.timestamp) : 0;
                return timestampB - timestampA;
            });
            
            // Display each chat in sidebar
            for (const chat of chatArray) {
                const chatId = chat.id;
                const otherUserId = chatId.split('_').find(id => id !== currentUser.uid);
                
                if (!otherUserId) continue;
                
                try {
                    // Get other user's data
                    const userSnapshot = await get(ref(database, `users/${otherUserId}`));
                    const userData = userSnapshot.val();
                    
                    if (userData) {
                        // Create chat contact element
                        const chatElement = document.createElement('div');
                        chatElement.className = `p-3 hover:bg-gray-100 cursor-pointer flex items-center border-b ${
                            chat.unread ? 'bg-blue-50' : ''
                        }`;
                        chatElement.dataset.chatId = chatId;
                        chatElement.dataset.userId = otherUserId;
                        chatElement.dataset.username = userData.username;
                        
                        const statusClass = userData.status === "online" ? "bg-green-500" : "bg-gray-300";
                        
                        chatElement.innerHTML = `
                            <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                                <span>${userData.username.charAt(0).toUpperCase()}</span>
                            </div>
                            <div class="flex-1">
                                <div class="flex justify-between">
                                    <h3 class="font-medium">${userData.username}</h3>
                                    <span class="text-xs text-gray-500">${formatMessageTime(chat.timestamp)}</span>
                                </div>
                                <p class="text-sm text-gray-500 truncate">${chat.lastMessage || 'Start a conversation'}</p>
                            </div>
                            <div class="ml-2 w-3 h-3 rounded-full ${statusClass}"></div>
                        `;
                        
                        chatElement.addEventListener('click', () => openChat(chatId, otherUserId, userData.username));
                        
                        chatsContent.appendChild(chatElement);
                    }
                } catch (error) {
                    console.error('Error loading chat:', error);
                }
            }
        }
    });
}

// Open a chat with a user
function openChat(chatId, userId, userName) {
    if (!chatId || !userId || !userName) {
        console.error('Missing parameters for openChat', { chatId, userId, userName });
        return;
    }
    
    // Mark current chat button as selected
    const chatButtons = chatsContent.querySelectorAll('div[data-chat-id]');
    chatButtons.forEach(btn => {
        if (btn.dataset.chatId === chatId) {
            btn.classList.add('bg-blue-100');
            btn.classList.remove('bg-blue-50'); // Remove unread highlight
        } else {
            btn.classList.remove('bg-blue-100');
        }
    });
    
    // Update current chat ID
    currentChatId = chatId;
    currentChatUser = {
        id: userId,
        name: userName
    };
    
    // Update chat header
    if (chatHeader) {
        chatHeader.innerHTML = `
            <div class="flex items-center">
                <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                    <span>${userName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                    <h3 class="font-medium">${userName}</h3>
                </div>
            </div>
        `;
    }
    
    // Clear messages area
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
        
        // Enable message input
        if (messageInput) {
            messageInput.disabled = false;
        }
        
        // Load chat messages
        loadChatMessages(chatId);
        
        // Mark messages as read
        set(ref(database, `userChats/${currentUser.uid}/${chatId}/unread`), false);
    }
}

// Load messages for a specific chat
function loadChatMessages(chatId) {
    const messagesRef = query(
        ref(database, `chats/${chatId}/messages`),
        orderByChild('timestamp'),
        limitToLast(100)
    );
    
    // Clear previous listeners
    const previousListener = window.currentChatListener;
    if (previousListener) {
        previousListener();
    }
    
    // Add new listener
    const newListener = onChildAdded(messagesRef, (snapshot) => {
        const message = snapshot.val();
        displayMessage(message);
        
        // Scroll to the bottom
        if (messagesDiv) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
    });
    
    window.currentChatListener = newListener;
}

// Display a message in the UI
function displayMessage(message) {
    if (!messagesDiv) return;
    
    const messageElement = document.createElement('div');
    const isOwnMessage = message.sender === currentUser.uid;
    
    messageElement.className = isOwnMessage 
        ? 'self-end bg-blue-500 text-white p-3 rounded-lg max-w-xs mb-2'
        : 'self-start bg-gray-200 p-3 rounded-lg max-w-xs mb-2';
    
    const nameElement = document.createElement('div');
    nameElement.className = 'font-bold text-sm mb-1';
    nameElement.textContent = isOwnMessage ? 'You' : message.senderName;
    
    const textElement = document.createElement('div');
    textElement.textContent = message.text;
    
    const timeElement = document.createElement('div');
    timeElement.className = isOwnMessage ? 'text-xs text-blue-200 text-right mt-1' : 'text-xs text-gray-500 mt-1';
    timeElement.textContent = formatMessageTime(message.timestamp);
    
    messageElement.appendChild(nameElement);
    messageElement.appendChild(textElement);
    messageElement.appendChild(timeElement);
    messagesDiv.appendChild(messageElement);
}

// Helper function to format message timestamps
function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    
    let date;
    
    // Check if timestamp is a Firebase server timestamp (object with seconds)
    if (typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Set up tab navigation
function setupTabNavigation() {
    if (!chatsTab || !friendsTab || !requestsTab) return;
    
    const browseTab = document.getElementById('browse-tab');
    const browseContent = document.getElementById('browse-content');
    
    chatsTab.addEventListener('click', () => {
        chatsTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        chatsTab.classList.remove('text-gray-500');
        friendsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        friendsTab.classList.add('text-gray-500');
        requestsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        requestsTab.classList.add('text-gray-500');
        if (browseTab) {
            browseTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            browseTab.classList.add('text-gray-500');
        }
        
        chatsTabContent.classList.remove('hidden');
        friendsTabContent.classList.add('hidden');
        requestsTabContent.classList.add('hidden');
        if (browseContent) {
            browseContent.classList.add('hidden');
        }
    });
    
    friendsTab.addEventListener('click', () => {
        friendsTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        friendsTab.classList.remove('text-gray-500');
        chatsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        chatsTab.classList.add('text-gray-500');
        requestsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        requestsTab.classList.add('text-gray-500');
        if (browseTab) {
            browseTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            browseTab.classList.add('text-gray-500');
        }
        
        friendsTabContent.classList.remove('hidden');
        chatsTabContent.classList.add('hidden');
        requestsTabContent.classList.add('hidden');
        if (browseContent) {
            browseContent.classList.add('hidden');
        }
    });
    
    requestsTab.addEventListener('click', () => {
        requestsTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
        requestsTab.classList.remove('text-gray-500');
        chatsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        chatsTab.classList.add('text-gray-500');
        friendsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
        friendsTab.classList.add('text-gray-500');
        if (browseTab) {
            browseTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            browseTab.classList.add('text-gray-500');
        }
        
        requestsTabContent.classList.remove('hidden');
        chatsTabContent.classList.add('hidden');
        friendsTabContent.classList.add('hidden');
        if (browseContent) {
            browseContent.classList.add('hidden');
        }
    });
    
    // Add event listener for browse tab
    if (browseTab && browseContent) {
        browseTab.addEventListener('click', () => {
            browseTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            browseTab.classList.remove('text-gray-500');
            chatsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            chatsTab.classList.add('text-gray-500');
            friendsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            friendsTab.classList.add('text-gray-500');
            requestsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
            requestsTab.classList.add('text-gray-500');
            
            browseContent.classList.remove('hidden');
            chatsTabContent.classList.add('hidden');
            friendsTabContent.classList.add('hidden');
            requestsTabContent.classList.add('hidden');
            
            // Load all users when the tab is clicked
            try {
                if (typeof window.loadAllUsers === 'function') {
                    window.loadAllUsers(true); // Force refresh when clicking the tab
                }
            } catch (error) {
                console.error("Error loading users:", error);
            }
        });
    }
}

// Utility function: Debounce
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Add search functionality for in-chat user search
if (searchInput) {
    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length >= 2) {
            try {
                const users = await searchUsers(query);
                // Handle search results - this could be wired to a different UI element
                console.log("Search results:", users.length);
                // You can wire this to display results in-line or in a dropdown
            } catch (error) {
                console.error("Search error:", error);
            }
        }
    }, 300));
}

// Helper function to create a chat ID from two user IDs
function createChatId(userId1, userId2) {
    return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
}

// Cleanup function to remove event listeners and references
function cleanup() {
    // Remove chat listeners
    if (window.currentChatListener) {
        window.currentChatListener();
        window.currentChatListener = null;
    }
}

// Make functions available globally for the friends.js file
window.openChat = openChat;
window.createChatId = createChatId;

// Ensure the window is closed with the user marked as offline
window.addEventListener('beforeunload', async () => {
    try {
        // Run cleanup
        cleanup();
        
        // Update status to offline
        if (auth.currentUser) {
            await set(ref(database, `users/${auth.currentUser.uid}/status`), "offline");
        }
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
});

export { currentUser, username, createChatId, openChat };
