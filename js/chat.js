import { auth, database } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
    ref, 
    push, 
    set, 
    onChildAdded, 
    onChildRemoved,
    onValue,
    query,
    orderByChild,
    limitToLast,
    serverTimestamp,
    get
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { searchUsers } from './search.js';

// Import functions from friends2.js
import { createChatId } from './friends2.js';

// Add import for username guard
import { initUsernameGuard } from './username-guard.js';

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
let userChatsListener = null;
let currentChatListener = null;
let userRefListener = null;

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("Auth state changed - user logged in:", user.uid);
        
        try {
            // Initialize username guard to ensure username is consistent
            const guardedUsername = await initUsernameGuard();
            
            if (guardedUsername) {
                console.log("Using guarded username:", guardedUsername);
                username = guardedUsername;
                
                // Update UI immediately with the guarded username
                if (userNameSpan) {
                    userNameSpan.textContent = username;
                }
            }
        } catch (guardError) {
            console.error("Error in username guard:", guardError);
        }
        
        // Continue with existing code but use the username from guard first
        const userRef = ref(database, 'users/' + user.uid);
        onValue(userRef, async (snapshot) => {
            const userData = snapshot.val();
            
            if (userData && userData.username) {
                // Only update username if we don't have a guarded one yet
                if (!username) {
                    console.log("Using username from database:", userData.username);
                    username = userData.username;
                    
                    // Update UI
                    if (userNameSpan) {
                        userNameSpan.textContent = username;
                    }
                }
                
                // Always update online status
                await set(ref(database, `users/${user.uid}/status`), "online");
            } else {
                console.warn("User data missing or invalid username:", userData);
                
                // If we already have a username from the guard, use that
                if (username) {
                    console.log("Using existing username:", username);
                    
                    // Ensure it's saved in the database
                    try {
                        const profileUpdate = {
                            username: username,
                            status: "online",
                        };
                        
                        if (!userData || !userData.created_at) {
                            profileUpdate.created_at = serverTimestamp();
                        }
                        
                        await update(ref(database, `users/${user.uid}`), profileUpdate);
                    } catch (updateError) {
                        console.error("Error updating profile:", updateError);
                    }
                } else {
                    // Fallback to displayName or email
                    username = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
                    console.log("Fallback to username:", username);
                    
                    // Create default profile
                    try {
                        await update(ref(database, `users/${user.uid}`), {
                            username: username,
                            email: user.email || '',
                            status: "online",
                            created_at: serverTimestamp()
                        });
                        
                        // Update UI
                        if (userNameSpan) {
                            userNameSpan.textContent = username;
                        }
                    } catch (err) {
                        console.error("Error creating default profile:", err);
                    }
                }
            }
        });
        
        // Load user's chats
        loadUserChats();
        
        // Set up tab navigation
        setupTabNavigation();
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'index.html';
        // Cleanup listeners
        if (userChatsListener) {
            userChatsListener();
            userChatsListener = null;
        }
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
    
    // Clean up previous listeners
    if (userChatsListener) userChatsListener();
    if (userRefListener) userRefListener();

    const userChatsRef = ref(database, `userChats/${currentUser.uid}`);
    
    // Show loading message
    const loadingChatsMessage = document.getElementById('loading-chats-message');
    const noChatsMessage = document.getElementById('no-chats-message');
    
    if (loadingChatsMessage) loadingChatsMessage.classList.remove('hidden');
    if (noChatsMessage) noChatsMessage.classList.add('hidden');
    
    // Use value listener to get initial data and then child added/removed
    userChatsListener = onValue(userChatsRef, (snapshot) => {
        const chats = snapshot.val();
        
        // Hide loading message
        if (loadingChatsMessage) loadingChatsMessage.classList.add('hidden');
        
        if (chats && Object.keys(chats).length > 0) {
            // Has conversations
            if (noChatsMessage) noChatsMessage.classList.add('hidden');
        } else {
            // No conversations
            if (noChatsMessage) noChatsMessage.classList.remove('hidden');
        }
    });

    // Child added listener
    const addedListener = onChildAdded(userChatsRef, async (snapshot) => {
        const chatId = snapshot.key;
        const chatData = snapshot.val();
        
        if (!chatId || !chatsContent) return;

        const otherUserId = chatId.split('_').find(id => id !== currentUser.uid);
        if (!otherUserId) return;

        try {
            const userSnapshot = await get(ref(database, `users/${otherUserId}`));
            const userData = userSnapshot.val();
            
            if (userData) {
                const existingChat = chatsContent.querySelector(`[data-chat-id="${chatId}"]`);
                if (!existingChat) {
                    const chatElement = createChatElement(chatId, otherUserId, userData, chatData);
                    chatsContent.insertBefore(chatElement, chatsContent.firstChild);
                    noChatsMessage.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Error loading chat:', error);
        }
    });

    // Child removed listener
    const removedListener = onChildRemoved(userChatsRef, (snapshot) => {
        const chatId = snapshot.key;
        const chatElement = chatsContent.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatElement) {
            chatElement.remove();
            // Show no chats message if no chats left
            if (chatsContent.children.length === 1) { // 1 is the noChatsMessage div
                noChatsMessage.classList.remove('hidden');
            }
        }
    });

    // Store all listeners
    userChatsListener = [userChatsListener, addedListener, removedListener];

    // Update user reference listener
    const userRef = ref(database, 'users/' + currentUser.uid);
    userRefListener = onValue(userRef, async (snapshot) => {
        const userData = snapshot.val();
        
        if (userData && userData.username) {
            // Only update username if we don't have a guarded one yet
            if (!username) {
                console.log("Using username from database:", userData.username);
                username = userData.username;
                
                // Update UI
                if (userNameSpan) {
                    userNameSpan.textContent = username;
                }
            }
            
            // Always update online status
            await set(ref(database, `users/${currentUser.uid}/status`), "online");
        } else {
            console.warn("User data missing or invalid username:", userData);
            
            // If we already have a username from the guard, use that
            if (username) {
                console.log("Using existing username:", username);
                
                // Ensure it's saved in the database
                try {
                    const profileUpdate = {
                        username: username,
                        status: "online",
                    };
                    
                    if (!userData || !userData.created_at) {
                        profileUpdate.created_at = serverTimestamp();
                    }
                    
                    await update(ref(database, `users/${currentUser.uid}`), profileUpdate);
                } catch (updateError) {
                    console.error("Error updating profile:", updateError);
                }
            } else {
                // Fallback to displayName or email
                username = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
                console.log("Fallback to username:", username);
                
                // Create default profile
                try {
                    await update(ref(database, `users/${currentUser.uid}`), {
                        username: username,
                        email: currentUser.email || '',
                        status: "online",
                        created_at: serverTimestamp()
                    });
                    
                    // Update UI
                    if (userNameSpan) {
                        userNameSpan.textContent = username;
                    }
                } catch (err) {
                    console.error("Error creating default profile:", err);
                }
            }
        }
    });
}

// Open a chat with a user
function openChat(chatId, userId, username) {
    if (!chatId || !userId || !username) {
        console.error('Missing parameters for openChat', { chatId, userId, username });
        return;
    }
    
    // Remove existing click listeners
    const existingButtons = chatsContent.querySelectorAll(`[data-chat-id="${chatId}"]`);
    existingButtons.forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });

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
        name: username
    };

    // Show close button
    const closeButton = document.getElementById('close-chat');
    if (closeButton) {
        closeButton.classList.remove('hidden');
    }
    
    // Update chat header
    if (chatHeader) {
        chatHeader.innerHTML = `
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center">
                    <div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-2">
                        <span>${currentChatUser.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <h3 class="font-medium text-lg">${currentChatUser.name}</h3>
                </div>
                <button id="close-chat" class="ml-2 text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add close chat handler
        const closeButton = chatHeader.querySelector('#close-chat');
        if (closeButton) {
            closeButton.addEventListener('click', closeActiveChat);
        }
    }
    
    // Hide the sidebar
    const sidebar = document.querySelector('aside');
    if (sidebar) sidebar.classList.add('hidden');
    
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

    // Update new button click listener
    const newButton = chatsContent.querySelector(`[data-chat-id="${chatId}"]`);
    if (newButton) {
        newButton.addEventListener('click', () => openChat(chatId, userId, username));
    }

    // Scroll to bottom and focus input
    setTimeout(() => {
        const messagesContainer = document.getElementById('messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        const messageInput = document.getElementById('message-input');
        messageInput.removeAttribute('disabled');
        messageInput.focus();
        
        // Mobile-specific behavior
        if (window.innerWidth <= 768) {
            messageInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            document.documentElement.style.height = '100vh';
            document.body.style.height = '100vh';
        }
    }, 100);
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
        ? 'self-end bg-blue-500 text-white p-3 rounded-[12px] min-w-[27vw] max-w-[70vw] mb-2'
        : 'self-start bg-gray-200 p-3 rounded-lg min-w-[27vw] max-w-[70vw] mb-2';
    
    const nameElement = document.createElement('div');
    nameElement.className = 'font-bold text-sm mb-1';
    nameElement.textContent = isOwnMessage ? 'You' : message.senderName;
    
    const textElement = document.createElement('div');
    textElement.textContent = message.text;
    
    const timeElement = document.createElement('div');
    timeElement.className = isOwnMessage ? 'text-xs text-blue-200 min-w-[27vw] text-right mt-1' : 'text-xs min-w-[27vw] text-gray-500 mt-1';
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

        // Show the sidebar when chats tab is clicked
        const sidebar = document.querySelector('aside');
        if (sidebar) sidebar.classList.remove('hidden');
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

// Cleanup function to remove event listeners and references
function cleanup() {
    if (currentChatListener) {
        currentChatListener();
        currentChatListener = null;
    }
    if (userChatsListener) {
        userChatsListener();
        userChatsListener = null;
    }
    if (userRefListener) {
        userRefListener();
        userRefListener = null;
    }
}

// Make functions available globally for the friends.js file
window.openChat = openChat;

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

export { currentUser, username, openChat };

// Add this helper function to create chat elements
function createChatElement(chatId, userId, userData, chat) {
    const chatElement = document.createElement('div');
    chatElement.className = `p-2 mt-1 hover:bg-gray-200 bg-gray-100 rounded-lg cursor-pointer flex items-center border-b`;
    chatElement.dataset.chatId = chatId;
    chatElement.dataset.userId = userId;
    chatElement.dataset.username = userData.username;

    const statusClass = userData.status === "online" ? "bg-green-500" : "bg-gray-400";
    
    // Use chat data for timestamp and last message
    const lastMessageTime = formatMessageTime(chat?.timestamp);
    const lastMessageText = chat?.lastMessage || 'Start a conversation';
    
    chatElement.innerHTML = `
        <div class="w-10 h-10 rounded-full  bg-gray-300 flex items-center justify-center mr-3">
            <span>${userData.username.charAt(0).toUpperCase()}</span>
        </div>
        <div class="flex-1">
            <div class="flex justify-between">
                <h3 class="font-medium">${userData.username}</h3>
                <span class="text-xs text-gray-500">Last message at: ${lastMessageTime}</span>
            </div>
        </div>
        <div class="ml-2 w-3 h-3 rounded-full ${statusClass}"></div>
    `;
    // <p class="text-sm text-gray-500 truncate">${lastMessageText}</p>
    //last message removed

    chatElement.addEventListener('click', () => openChat(chatId, userId, userData.username));
    return chatElement;
}

// Add new closeActiveChat function
function closeActiveChat() {
    // Show sidebar
    const sidebar = document.querySelector('aside');
    if (sidebar) sidebar.classList.remove('hidden');
    
    // Clear current chat
    currentChatId = null;
    currentChatUser = null;
    
    // Disable message input
    if (messageInput) {
        messageInput.disabled = true;
    }
    
    // Clear messages
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }
    
    // Reset chat header
    if (chatHeader) {
        chatHeader.innerHTML = `
            <div class="w-full">
                <p class="text-gray-500">Select a conversation to start chatting</p>
            </div>
        `;
    }
    
    // Remove active state from chat buttons
    const chatButtons = chatsContent.querySelectorAll('div[data-chat-id]');
    chatButtons.forEach(btn => {
        btn.classList.remove('bg-blue-100');
    });
    
    // Cleanup chat listener
    if (currentChatListener) {
        currentChatListener();
        currentChatListener = null;
    }
}
