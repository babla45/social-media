import { auth, database } from './firebase-config.js';
import { 
    ref, 
    set, 
    get, 
    onValue, 
    update, 
    push, 
    remove, 
    query, 
    orderByChild, 
    equalTo, 
    startAt,
    endAt,
    limitToFirst,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

// Import the improved search functionality
import { searchUsers as performUserSearch } from './search.js';

// Import functions from friends2.js
import { 
    checkFriendshipStatus,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    startChat,
    createChatId
} from './friends2.js';

// DOM Elements
const searchInput = document.getElementById('search-input');
const addFriendModal = document.getElementById('add-friend-modal');
const closeModalBtn = document.getElementById('close-modal');
const searchResults = document.getElementById('search-results');
const modalError = document.getElementById('modal-error');
const friendsContent = document.getElementById('friends-content');
const noFriendsMessage = document.getElementById('no-friends-message');
const requestsContent = document.getElementById('requests-content');
const noRequestsMessage = document.getElementById('no-requests-message');
const requestBadge = document.getElementById('request-badge');
const browseContent = document.getElementById('browse-content');
const allUsersContainer = document.getElementById('all-users-container');
const loadingUsers = document.getElementById('loading-users');
const refreshUsersBtn = document.getElementById('refresh-users');

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 500));
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            addFriendModal.classList.add('hidden');
        });
    }

    // Load friends and requests when auth state changes
    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadFriends();
            loadFriendRequests();
        }
    });

    // Add refresh button event listener
    if (refreshUsersBtn) {
        refreshUsersBtn.addEventListener('click', () => {
            loadAllUsers(true); // Force refresh
        });
    }

    // Load all users when browse tab is clicked
    const browseTab = document.getElementById('browse-tab');
    if (browseTab) {
        browseTab.addEventListener('click', () => {
            loadAllUsers();
        });
    }
    
    // Filter buttons
    const filterAllBtn = document.getElementById('filter-all');
    const filterOnlineBtn = document.getElementById('filter-online');
    
    if (filterAllBtn && filterOnlineBtn) {
        filterAllBtn.addEventListener('click', () => {
            filterAllBtn.classList.remove('bg-gray-200', 'text-gray-700');
            filterAllBtn.classList.add('bg-blue-500', 'text-white');
            filterOnlineBtn.classList.remove('bg-blue-500', 'text-white');
            filterOnlineBtn.classList.add('bg-gray-200', 'text-gray-700');
            
            // Show all users
            const userElements = allUsersContainer.querySelectorAll('.user-item, div[class*="p-3 border-b"]');
            userElements.forEach(el => el.classList.remove('hidden'));
            
            // Update count
            if (document.getElementById('user-count')) {
                document.getElementById('user-count').textContent = userElements.length;
            }
        });
        
        filterOnlineBtn.addEventListener('click', () => {
            filterOnlineBtn.classList.remove('bg-gray-200', 'text-gray-700');
            filterOnlineBtn.classList.add('bg-blue-500', 'text-white');
            filterAllBtn.classList.remove('bg-blue-500', 'text-white');
            filterAllBtn.classList.add('bg-gray-200', 'text-gray-700');
            
            // Filter for online users only
            const userElements = allUsersContainer.querySelectorAll('.user-item, div[class*="p-3 border-b"]');
            let onlineCount = 0;
            
            userElements.forEach(el => {
                const statusDot = el.querySelector('div[class*="bg-green-500"]');
                if (statusDot) {
                    el.classList.remove('hidden');
                    onlineCount++;
                } else {
                    el.classList.add('hidden');
                }
            });
            
            // Update count
            if (document.getElementById('user-count')) {
                document.getElementById('user-count').textContent = onlineCount;
            }
            
            // Show message if no online users
            if (onlineCount === 0 && allUsersContainer.querySelector('.no-online-users') === null) {
                const noOnlineMsg = document.createElement('div');
                noOnlineMsg.className = 'p-4 text-center text-gray-500 no-online-users';
                noOnlineMsg.textContent = 'No users are currently online';
                allUsersContainer.appendChild(noOnlineMsg);
            } else if (onlineCount > 0) {
                const noOnlineMsg = allUsersContainer.querySelector('.no-online-users');
                if (noOnlineMsg) noOnlineMsg.remove();
            }
        });
    }
});

// Handle search input
function handleSearch() {
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        if (addFriendModal.classList.contains('hidden') === false) {
            addFriendModal.classList.add('hidden');
        }
        modalError.textContent = 'Please enter at least 2 characters';
        modalError.classList.remove('hidden');
        return;
    }
    
    searchUsers(query);
}

// Search users by username
async function searchUsers(query) {
    try {
        modalError.textContent = '';
        modalError.classList.add('hidden');
        
        // Use the improved search function from search.js
        const users = await performUserSearch(query, true);
        
        showSearchResults(users);
    } catch (error) {
        console.error('Error searching users:', error);
        modalError.textContent = 'An error occurred while searching. Please try again.';
        modalError.classList.remove('hidden');
    }
}

// Display search results
function showSearchResults(users) {
    addFriendModal.classList.remove('hidden');
    searchResults.innerHTML = '';
    
    if (users.length === 0) {
        searchResults.innerHTML = '<div class="p-4 text-center text-gray-500">No users found</div>';
        return;
    }
    
    // Show search count
    const countElement = document.createElement('div');
    countElement.className = 'px-4 py-2 bg-gray-100 text-sm text-gray-600 border-b';
    countElement.textContent = `Found ${users.length} user${users.length !== 1 ? 's' : ''}`;
    searchResults.appendChild(countElement);
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'p-3 border-b flex items-center justify-between search-result-item'; // Added class
        
        const userInfo = document.createElement('div');
        userInfo.className = 'flex items-center';
        
        // User avatar
        const avatar = document.createElement('div');
        if (user.profile_picture) {
            avatar.className = 'w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3 overflow-hidden';
            avatar.innerHTML = `<img src="${user.profile_picture}" alt="Profile" class="w-full h-full object-cover">`;
        } else {
            avatar.className = 'w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3';
            avatar.innerHTML = `<span>${user.username.charAt(0).toUpperCase()}</span>`;
        }
        
        // User name and status
        const nameContainer = document.createElement('div');
        
        const nameElement = document.createElement('div');
        nameElement.className = 'font-medium';
        nameElement.textContent = user.username;
        
        // Status indicator
        const statusElement = document.createElement('div');
        statusElement.className = 'text-xs text-gray-500 flex items-center';
        
        const statusDot = document.createElement('div');
        statusDot.className = `w-2 h-2 rounded-full mr-1 ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`;
        
        statusElement.appendChild(statusDot);
        statusElement.appendChild(document.createTextNode(user.status === 'online' ? 'Online' : 'Offline'));
        
        nameContainer.appendChild(nameElement);
        nameContainer.appendChild(statusElement);
        
        userInfo.appendChild(avatar);
        userInfo.appendChild(nameContainer);
        
        const actionButton = document.createElement('button');
        
        // Check friendship status and set appropriate button
        checkFriendshipStatus(user.id)
            .then(status => {
                switch(status) {
                    case 'friends':
                        actionButton.textContent = 'Message';
                        actionButton.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 browse-user-action-btn'; // Added class
                        actionButton.onclick = (e) => {
                            e.preventDefault();
                            startChat(user.id, user.username);
                        };
                        break;
                    case 'pending_sent':
                        actionButton.textContent = 'Request Sent';
                        actionButton.className = 'px-4 py-1 bg-gray-300 text-gray-600 rounded-full cursor-default browse-user-action-btn'; // Added class
                        actionButton.disabled = true;
                        break;
                    case 'pending_received':
                        actionButton.textContent = 'Accept';
                        actionButton.className = 'px-4 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 browse-user-action-btn'; // Added class
                        actionButton.onclick = (e) => {
                            e.preventDefault();
                            handleAcceptFriendRequest(user.id);
                        };
                        break;
                    default:
                        actionButton.textContent = 'Add Friend';
                        actionButton.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 browse-user-action-btn'; // Added class
                        actionButton.onclick = (e) => {
                            e.preventDefault();
                            
                            // Immediate feedback by updating button
                            actionButton.textContent = 'Request Sent';
                            actionButton.className = 'px-4 py-1 bg-gray-300 text-gray-600 rounded-full cursor-default browse-user-action-btn'; // Added class
                            actionButton.disabled = true;
                            
                            // Use the function from friends2.js
                            sendFriendRequest(user.id, user.username, actionButton)
                                .then(result => {
                                    if (result.success && modalError) {
                                        modalError.textContent = result.message;
                                        modalError.classList.remove('hidden', 'text-red-500');
                                        modalError.classList.add('text-green-500');
                                        
                                        // Hide confirmation after 3 seconds
                                        setTimeout(() => {
                                            modalError.classList.add('hidden');
                                        }, 3000);
                                    }
                                })
                                .catch(error => {
                                    console.error("Error sending friend request:", error);
                                });
                        };
                }
                
                userElement.appendChild(userInfo);
                userElement.appendChild(actionButton);
                searchResults.appendChild(userElement);
            })
            .catch(error => {
                console.error('Error checking friendship status:', error);
                actionButton.textContent = 'Add Friend';
                actionButton.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 browse-user-action-btn'; // Added class
                actionButton.onclick = (e) => {
                    e.preventDefault();
                    sendFriendRequest(user.id, user.username, actionButton);
                };
                
                userElement.appendChild(userInfo);
                userElement.appendChild(actionButton);
                searchResults.appendChild(userElement);
            });
    });
}

// Helper function to handle accept friend request with UI updates
async function handleAcceptFriendRequest(userId) {
    const result = await acceptFriendRequest(userId);
    
    if (result.success) {
        // If this was from a button click, update the button
        if (event && event.target && event.target.textContent === 'Accept') {
            const button = event.target;
            button.textContent = 'Message';
            button.onclick = () => startChat(userId, result.username);
        }
    }
}

// Add Friend button click handler for browse section
function handleAddFriendClick(userId, username, button) {
    // Immediately update button appearance
    button.textContent = 'Request Sent';
    button.className = 'px-4 py-1 bg-gray-300 text-gray-600 rounded-full cursor-default browse-user-action-btn'; // Added class
    button.disabled = true;
    
    // Use the function from friends2.js
    sendFriendRequest(userId, username, button);
}

// Load friend requests
function loadFriendRequests() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    const requestsRef = ref(database, `friendRequests/${currentUser.uid}`);
    
    onValue(requestsRef, (snapshot) => {
        if (!requestsContent) return;
        
        const requests = snapshot.val();
        requestsContent.innerHTML = '';
        
        if (!requests) {
            if (noRequestsMessage) noRequestsMessage.classList.remove('hidden');
            if (requestBadge) requestBadge.classList.add('hidden');
            return;
        }
        
        if (noRequestsMessage) noRequestsMessage.classList.add('hidden');
        
        // Update the badge
        if (requestBadge) {
            const requestCount = Object.keys(requests).length;
            requestBadge.textContent = requestCount;
            requestBadge.classList.remove('hidden');
        }
        
        // Create requests list
        Object.entries(requests).forEach(([userId, requestData]) => {
            const requestElement = document.createElement('div');
            requestElement.className = 'p-3 border-b flex items-center justify-between';
            
            const userInfo = document.createElement('div');
            userInfo.className = 'flex items-center';
            
            const avatar = document.createElement('div');
            avatar.className = 'w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3';
            avatar.innerHTML = `<span>${requestData.username.charAt(0).toUpperCase()}</span>`;
            
            const nameElement = document.createElement('div');
            nameElement.textContent = requestData.username;
            
            userInfo.appendChild(avatar);
            userInfo.appendChild(nameElement);
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex space-x-2';
            
            const acceptBtn = document.createElement('button');
            acceptBtn.textContent = 'Accept';
            acceptBtn.className = 'px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600';
            acceptBtn.onclick = (e) => {
                e.preventDefault();
                handleAcceptFriendRequest(userId);
            };
            
            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Reject';
            rejectBtn.className = 'px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600';
            rejectBtn.onclick = (e) => {
                e.preventDefault();
                rejectFriendRequest(userId);
            };
            
            actionsDiv.appendChild(acceptBtn);
            actionsDiv.appendChild(rejectBtn);
            
            requestElement.appendChild(userInfo);
            requestElement.appendChild(actionsDiv);
            
            requestsContent.appendChild(requestElement);
        });
    });
}

// Load friends list
function loadFriends() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    const friendsRef = ref(database, `friends/${currentUser.uid}`);
    
    onValue(friendsRef, (snapshot) => {
        const friends = snapshot.val();
        friendsContent.innerHTML = '';
        
        if (!friends) {
            noFriendsMessage.classList.remove('hidden');
            return;
        }
        
        noFriendsMessage.classList.add('hidden');
        
        // Create friends list
        Object.entries(friends).forEach(([friendId, friendData]) => {
            const friendElement = document.createElement('div');
            friendElement.className = 'p-3 border-b flex items-center justify-between hover:bg-gray-100';
            
            const userInfo = document.createElement('div');
            userInfo.className = 'flex items-center';
            
            const avatar = document.createElement('div');
            avatar.className = 'w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3';
            avatar.innerHTML = `<span>${friendData.username.charAt(0).toUpperCase()}</span>`;
            
            const nameElement = document.createElement('div');
            nameElement.textContent = friendData.username;
            
            userInfo.appendChild(avatar);
            userInfo.appendChild(nameElement);
            
            const messageBtn = document.createElement('button');
            messageBtn.textContent = 'Message';
            messageBtn.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600';
            messageBtn.onclick = () => startChat(friendId, friendData.username);
            
            friendElement.appendChild(userInfo);
            friendElement.appendChild(messageBtn);
            
            friendsContent.appendChild(friendElement);
        });
    });
}

// Load all users
async function loadAllUsers(forceRefresh = false) {
    if (!auth.currentUser) return;
    
    // Show loading state
    if (loadingUsers) {
        loadingUsers.classList.remove('hidden');
    }
    
    // Update user count display
    const userCountDisplay = document.getElementById('user-count');
    if (userCountDisplay) {
        userCountDisplay.textContent = '0';
    }
    
    if (allUsersContainer) {
        // Only clear if forcing refresh
        if (forceRefresh) {
            allUsersContainer.innerHTML = '';
        }
        
        // Don't reload if there's already content unless forced
        if (!forceRefresh && allUsersContainer.children.length > 0) {
            if (loadingUsers) loadingUsers.classList.add('hidden');
            return;
        }
        
        try {
            // Get current user's ID for filtering
            const currentUserId = auth.currentUser.uid;
            const currentUserEmail = auth.currentUser.email;
            
            console.log("Current user ID to filter out:", currentUserId);
            console.log("Current user email:", currentUserEmail);
            
            // Get all users - Use direct database ref
            const usersRef = ref(database, 'users');
            const snapshot = await get(usersRef);
            
            if (!snapshot.exists()) {
                allUsersContainer.innerHTML = '<div class="p-4 text-center text-gray-500">No users found</div>';
                if (loadingUsers) loadingUsers.classList.add('hidden');
                return;
            }
            
            // Clear previous content if not already cleared
            allUsersContainer.innerHTML = '';
            
            // Store users in array for filtering and sorting
            const users = [];
            
            // Process each user from the database snapshot
            snapshot.forEach((childSnapshot) => {
                const userData = childSnapshot.val();
                const userId = childSnapshot.key;
                
                // Skip the current user with strict comparison
                if (userId === currentUserId) {
                    console.log("Skipping current user by ID:", userId);
                    return;
                }
                
                // Also skip if the email matches (additional safety)
                if (userData.email && userData.email === currentUserEmail) {
                    console.log("Skipping current user by email:", userData.email);
                    return;
                }
                
                // Skip users with missing or invalid data
                if (!userData.username) {
                    console.log("Skipping user with missing username:", userId);
                    return;
                }
                
                // Add valid users to the array
                users.push({
                    id: userId,
                    ...userData
                });
            });
            
            console.log(`Found ${users.length} users (excluding current user)`);
            
            // Update user count display
            if (userCountDisplay) {
                userCountDisplay.textContent = users.length.toString();
            }
            
            // Sort by username
            users.sort((a, b) => {
                if (a.username && b.username) {
                    return a.username.localeCompare(b.username);
                }
                return 0;
            });
            
            if (users.length === 0) {
                allUsersContainer.innerHTML = '<div class="p-4 text-center text-gray-500">No other users found</div>';
                if (loadingUsers) loadingUsers.classList.add('hidden');
                return;
            }
            
            // Display users, with multiple safety checks to ensure current user is not shown
            for (const user of users) {
                // Triple check to ensure it's not the current user
                if (user.id === currentUserId || 
                    (user.email && user.email === currentUserEmail) || 
                    user.username === 'You') {
                    console.log("Skipping current user in display loop:", user.id);
                    continue;
                }
                
                const userElement = document.createElement('div');
                userElement.className = 'p-3 border-b flex items-center justify-between hover:bg-gray-50';
                userElement.classList.add('user-item'); // Add a class for easy selection
                userElement.dataset.userId = user.id; // Add user ID as data attribute for easy filtering
                
                // User info (avatar + name)
                const userInfo = document.createElement('div');
                userInfo.className = 'flex items-center';
                
                // Avatar - use profile picture if available, otherwise show initial
                const avatar = document.createElement('div');
                if (user.profile_picture) {
                    avatar.className = 'w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3 overflow-hidden';
                    avatar.innerHTML = `<img src="${user.profile_picture}" alt="${user.username}" class="w-full h-full object-cover">`;
                } else {
                    avatar.className = 'w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center mr-3';
                    const initial = user.username.charAt(0).toUpperCase();
                    avatar.innerHTML = `<span>${initial}</span>`;
                }
                
                // User details container
                const nameContainer = document.createElement('div');
                
                // Username
                const nameElement = document.createElement('div');
                nameElement.className = 'font-medium';
                nameElement.textContent = user.username; // Display actual username
                
                // Status indicator
                const statusElement = document.createElement('div');
                statusElement.className = 'text-xs text-gray-500 flex items-center';
                
                const statusDot = document.createElement('div');
                statusDot.className = `w-2 h-2 rounded-full mr-1 ${user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`;
                
                statusElement.appendChild(statusDot);
                statusElement.appendChild(document.createTextNode(user.status === 'online' ? 'Online' : 'Offline'));
                
                nameContainer.appendChild(nameElement);
                nameContainer.appendChild(statusElement);
                
                // Bio (if available)
                if (user.bio) {
                    const bioElement = document.createElement('div');
                    bioElement.className = 'text-xs text-gray-500 mt-1 truncate max-w-[180px]';
                    bioElement.textContent = user.bio;
                    nameContainer.appendChild(bioElement);
                }
                
                userInfo.appendChild(avatar);
                userInfo.appendChild(nameContainer);
                
                // Action button
                const actionButton = document.createElement('button');
                actionButton.className = 'px-4 py-1 rounded-full bg-gray-200 text-gray-700 browse-user-action-btn'; // Added class for Chrome fix
                actionButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
                
                userElement.appendChild(userInfo);
                userElement.appendChild(actionButton);
                
                allUsersContainer.appendChild(userElement);
                
                // Check friendship status asynchronously and update button
                checkFriendshipStatus(user.id).then(status => {
                    switch(status) {
                        case 'friends':
                            actionButton.textContent = 'Message';
                            actionButton.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 browse-user-action-btn'; // Added class
                            actionButton.onclick = () => startChat(user.id, user.username);
                            break;
                        case 'pending_sent':
                            actionButton.textContent = 'Request Sent';
                            actionButton.className = 'px-4 py-1 bg-gray-300 text-gray-600 rounded-full cursor-default browse-user-action-btn'; // Added class
                            actionButton.disabled = true;
                            break;
                        case 'pending_received':
                            actionButton.textContent = 'Accept';
                            actionButton.className = 'px-4 py-1 bg-green-500 text-white rounded-full hover:bg-green-600 browse-user-action-btn'; // Added class
                            actionButton.onclick = () => acceptFriendRequest(user.id);
                            break;
                        default:
                            actionButton.textContent = 'Add Friend';
                            actionButton.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 browse-user-action-btn'; // Added class
                            actionButton.onclick = () => {
                                // Call our new function with needed arguments
                                handleAddFriendClick(user.id, user.username, actionButton);
                            };
                    }
                }).catch(err => {
                    console.error("Error checking friendship status:", err);
                    actionButton.textContent = 'Add Friend';
                    actionButton.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600 browse-user-action-btn'; // Added class
                    actionButton.onclick = () => handleAddFriendClick(user.id, user.username, actionButton);
                });
            }
            
        } catch (error) {
            console.error('Error loading users:', error);
            allUsersContainer.innerHTML = '<div class="p-4 text-center text-red-500">Error loading users. Please try again.</div>';
        } finally {
            // Hide loading state
            if (loadingUsers) {
                loadingUsers.classList.add('hidden');
            }
            
            // Final verification - remove any elements that might be the current user
            const currentUserElements = allUsersContainer.querySelectorAll(`[data-user-id="${auth.currentUser.uid}"]`);
            currentUserElements.forEach(el => el.remove());
            
            // Verify user count is correct
            const actualUserCount = allUsersContainer.querySelectorAll('.user-item').length;
            if (userCountDisplay) {
                userCountDisplay.textContent = actualUserCount.toString();
            }
        }
    }
}

// Utility function: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Global function for opening chat from friend list
window.openChat = function(chatId, userId, username) {
    // This function will be defined in chat.js but we need to expose it globally
    console.log('Opening chat', chatId, userId, username);
};

// Make functions available globally
window.loadAllUsers = loadAllUsers;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
window.startChat = startChat;

// Export functions that might be needed elsewhere
export { loadFriends, loadFriendRequests, loadAllUsers };