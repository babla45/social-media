import { auth, database } from './firebase-config.js';
import { 
    ref, 
    set, 
    get, 
    onValue, 
    update, 
    push, 
    remove, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

/**
 * Friend management functionality
 * Contains functions for friend requests, accepting/rejecting requests, 
 * and chat creation between friends.
 */

// Helper function to create a chat ID from two user IDs
export function createChatId(userId1, userId2) {
    return userId1 < userId2 ? `${userId1}_${userId2}` : `${userId2}_${userId1}`;
}

/**
 * Check friendship status between current user and another user
 * @param {string} userId - ID of the user to check friendship status with
 * @returns {Promise<string>} - 'none', 'friends', 'pending_sent', 'pending_received', or 'error'
 */
export async function checkFriendshipStatus(userId) {
    try {
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        // Check if they are already friends
        const friendRef = ref(database, `friends/${currentUser.uid}/${userId}`);
        const friendSnapshot = await get(friendRef);
        
        if (friendSnapshot.exists()) {
            return 'friends';
        }
        
        // Check if current user sent a request
        const sentRequestRef = ref(database, `friendRequests/${userId}/${currentUser.uid}`);
        const sentRequestSnapshot = await get(sentRequestRef);
        
        if (sentRequestSnapshot.exists()) {
            return 'pending_sent';
        }
        
        // Check if current user received a request
        const receivedRequestRef = ref(database, `friendRequests/${currentUser.uid}/${userId}`);
        const receivedRequestSnapshot = await get(receivedRequestRef);
        
        if (receivedRequestSnapshot.exists()) {
            return 'pending_received';
        }
        
        return 'none';
    } catch (error) {
        console.error('Error checking friendship status:', error);
        return 'error';
    }
}

/**
 * Send a friend request to another user
 * @param {string} userId - ID of the user to send request to
 * @param {string} username - Username of the recipient (for UI feedback)
 * @param {HTMLElement} [buttonElement] - Optional button element to update UI state
 * @returns {Promise<void>}
 */
export async function sendFriendRequest(userId, username, buttonElement = null) {
    try {
        // Update button state if provided
        if (buttonElement) {
            buttonElement.textContent = 'Request Sent';
            buttonElement.className = 'px-4 py-1 bg-gray-300 text-gray-600 rounded-full cursor-default';
            buttonElement.disabled = true;
        }
        
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        const userSnapshot = await get(ref(database, `users/${currentUser.uid}`));
        const userData = userSnapshot.val();
        
        // Create the friend request in the database
        await set(ref(database, `friendRequests/${userId}/${currentUser.uid}`), {
            username: userData.username,
            timestamp: serverTimestamp()
        });
        
        return { success: true, message: `Friend request sent to ${username}` };
    } catch (error) {
        console.error('Error sending friend request:', error);
        
        // Revert button state on error
        if (buttonElement) {
            buttonElement.textContent = 'Add Friend';
            buttonElement.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600';
            buttonElement.disabled = false;
        }
        
        return { success: false, message: 'Failed to send friend request' };
    }
}

/**
 * Accept a friend request
 * @param {string} userId - ID of the user whose request to accept
 * @returns {Promise<object>} - Result object with success status and message
 */
export async function acceptFriendRequest(userId) {
    try {
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        // Get request data
        const requestRef = ref(database, `friendRequests/${currentUser.uid}/${userId}`);
        const requestSnapshot = await get(requestRef);
        
        if (!requestSnapshot.exists()) {
            return { success: false, message: 'Friend request no longer exists' };
        }
        
        const requestData = requestSnapshot.val();
        
        // Get current user data
        const userSnapshot = await get(ref(database, `users/${currentUser.uid}`));
        const userData = userSnapshot.val();
        
        // Add to both users' friends lists
        const updates = {};
        updates[`friends/${currentUser.uid}/${userId}`] = {
            username: requestData.username,
            timestamp: serverTimestamp()
        };
        
        updates[`friends/${userId}/${currentUser.uid}`] = {
            username: userData.username,
            timestamp: serverTimestamp()
        };
        
        // Create a chat between users if it doesn't exist
        const chatId = createChatId(currentUser.uid, userId);
        updates[`chats/${chatId}/participants`] = {
            [currentUser.uid]: true,
            [userId]: true
        };
        
        updates[`userChats/${currentUser.uid}/${chatId}`] = {
            timestamp: serverTimestamp()
        };
        
        updates[`userChats/${userId}/${chatId}`] = {
            timestamp: serverTimestamp()
        };
        
        // Remove the friend request
        updates[`friendRequests/${currentUser.uid}/${userId}`] = null;
        
        await update(ref(database), updates);
        
        return { success: true, message: 'Friend request accepted', chatId, username: requestData.username };
    } catch (error) {
        console.error('Error accepting friend request:', error);
        return { success: false, message: 'Failed to accept friend request' };
    }
}

/**
 * Reject a friend request
 * @param {string} userId - ID of the user whose request to reject
 * @returns {Promise<object>} - Result object with success status and message
 */
export async function rejectFriendRequest(userId) {
    try {
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        await remove(ref(database, `friendRequests/${currentUser.uid}/${userId}`));
        
        return { success: true, message: 'Friend request rejected' };
    } catch (error) {
        console.error('Error rejecting friend request:', error);
        return { success: false, message: 'Failed to reject friend request' };
    }
}

/**
 * Start or open a chat with another user
 * @param {string} userId - ID of the user to chat with
 * @param {string} username - Username of the user to chat with
 * @returns {string} - The chat ID
 */
export function startChat(userId, username) {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
        console.error('No authenticated user');
        return null;
    }
    
    const chatId = createChatId(currentUser.uid, userId);
    
    // Find and click on existing chat or create it
    const existingChat = document.querySelector(`[data-chat-id="${chatId}"]`);
    
    if (existingChat) {
        existingChat.click();
    } else {
        // Create a new chat
        createAndOpenNewChat(chatId, userId, username);
    }
    
    return chatId;
}

/**
 * Create and open a new chat
 * @param {string} chatId - ID of the chat
 * @param {string} userId - ID of the other user
 * @param {string} username - Username of the other user
 */
export async function createAndOpenNewChat(chatId, userId, username) {
    try {
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
            throw new Error('No authenticated user');
        }
        
        // Create chat in database
        const updates = {};
        updates[`chats/${chatId}/participants`] = {
            [currentUser.uid]: true,
            [userId]: true
        };
        
        updates[`userChats/${currentUser.uid}/${chatId}`] = {
            timestamp: serverTimestamp()
        };
        
        updates[`userChats/${userId}/${chatId}`] = {
            timestamp: serverTimestamp()
        };
        
        await update(ref(database), updates);
        
        // Get user data for status indicator
        const userSnapshot = await get(ref(database, `users/${userId}`));
        const userData = userSnapshot.val();
        
        // Create chat UI element
        const chatElement = createChatElement(chatId, userId, username, userData);
        
        // Add to DOM
        const chatsContent = document.getElementById('chats-content');
        const noChatsMessage = document.getElementById('no-chats-message');
        
        if (noChatsMessage) {
            noChatsMessage.classList.add('hidden');
        }
        
        if (chatsContent) {
            if (chatsContent.firstChild) {
                chatsContent.insertBefore(chatElement, chatsContent.firstChild);
            } else {
                chatsContent.appendChild(chatElement);
            }
            
            // Trigger a click to open this chat
            chatElement.click();
        }
    } catch (error) {
        console.error('Error creating new chat:', error);
    }
}

/**
 * Create a chat element for the UI
 * @param {string} chatId - ID of the chat
 * @param {string} userId - ID of the other user
 * @param {string} username - Username of the other user
 * @param {object} userData - User data object
 * @returns {HTMLElement} - The created chat element
 */
function createChatElement(chatId, userId, username, userData) {
    const chatElement = document.createElement('div');
    chatElement.className = 'p-3 hover:bg-gray-100 cursor-pointer flex items-center border-b';
    chatElement.dataset.chatId = chatId;
    chatElement.dataset.userId = userId;
    chatElement.dataset.username = username;
    
    const statusClass = userData && userData.status === "online" ? "bg-green-500" : "bg-gray-300";
    
    chatElement.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
            <span>${username.charAt(0).toUpperCase()}</span>
        </div>
        <div class="flex-1">
            <div class="flex justify-between">
                <h3 class="font-medium">${username}</h3>
                <span class="text-xs text-gray-500">New</span>
            </div>
            <p class="text-sm text-gray-500 truncate">Start a conversation</p>
        </div>
        <div class="ml-2 w-3 h-3 rounded-full ${statusClass}"></div>
    `;
    
    chatElement.addEventListener('click', () => {
        // Find function to open a chat and call it
        const openChat = window.openChat || (window.chatFunctions && window.chatFunctions.openChat);
        if (typeof openChat === 'function') {
            openChat(chatId, userId, username);
        } else {
            console.error('openChat function not found');
        }
    });
    
    return chatElement;
}

// Export main functionality
export default {
    createChatId,
    checkFriendshipStatus,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    startChat,
    createAndOpenNewChat
};
