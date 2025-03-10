/**
 * This is a utility file that re-exports functions from both friends.js and friends2.js
 * for easier importing in other parts of the application
 */

import { loadFriends, loadFriendRequests, loadAllUsers } from './friends.js';
import { 
    createChatId, 
    checkFriendshipStatus, 
    sendFriendRequest, 
    acceptFriendRequest, 
    rejectFriendRequest,
    startChat,
    createAndOpenNewChat
} from './friends2.js';

// Re-export everything
export {
    // From friends.js
    loadFriends,
    loadFriendRequests,
    loadAllUsers,
    
    // From friends2.js
    createChatId,
    checkFriendshipStatus,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    startChat,
    createAndOpenNewChat
};

// Default export with all functions
export default {
    loadFriends,
    loadFriendRequests,
    loadAllUsers,
    createChatId,
    checkFriendshipStatus,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    startChat,
    createAndOpenNewChat
};
