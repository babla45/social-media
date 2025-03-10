import { auth, database } from './firebase-config.js';
import { 
    ref, 
    get 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

/**
 * Search for users by username - using subsequence matching
 * @param {string} searchTerm - The search term
 * @param {boolean} excludeCurrentUser - Whether to exclude the current user (default true)
 * @returns {Promise<Array>} - Array of user objects
 */
export async function searchUsers(searchTerm, excludeCurrentUser = true) {
    try {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        // Get current user ID for filtering
        const currentUserId = auth.currentUser ? auth.currentUser.uid : null;
        
        // Normalize search term
        const query = searchTerm.toLowerCase().trim();

        // Get all users and filter client-side for subsequence matching
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        if (!snapshot.exists()) {
            return [];
        }
        
        const users = [];
        snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val();
            const userId = childSnapshot.key;
            
            // Skip the current user if excludeCurrentUser is true
            if (excludeCurrentUser && userId === currentUserId) {
                return;
            }
            
            // Check if username contains the search term (subsequence)
            const username = userData.username?.toLowerCase() || '';
            if (username.includes(query)) {
                users.push({
                    id: userId,
                    ...userData
                });
            }
        });
        
        // Sort results by relevance (exact matches first, then by position of match)
        users.sort((a, b) => {
            const usernameA = a.username.toLowerCase();
            const usernameB = b.username.toLowerCase();
            
            // Exact matches come first
            if (usernameA === query && usernameB !== query) return -1;
            if (usernameB === query && usernameA !== query) return 1;
            
            // Then by position of the match (earlier is better)
            const posA = usernameA.indexOf(query);
            const posB = usernameB.indexOf(query);
            return posA - posB;
        });
        
        return users;
    } catch (error) {
        console.error('Error searching users:', error);
        throw new Error('Failed to search users');
    }
}

/**
 * Filter users by various criteria
 * @param {Array} users - Array of user objects
 * @param {Object} options - Filter options
 * @returns {Array} - Filtered array of users
 */
export function filterUsers(users, options = {}) {
    if (!users || !Array.isArray(users)) return [];
    
    return users.filter(user => {
        // Filter by status (online/offline)
        if (options.status && user.status !== options.status) {
            return false;
        }
        
        // Add more filters as needed
        
        return true;
    });
}
