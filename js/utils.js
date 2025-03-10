/**
 * Utility functions for the application
 */

/**
 * Set a button to loading state
 * @param {HTMLButtonElement} button - The button element
 * @param {boolean} isLoading - Whether to show loading state
 * @param {string} defaultText - Default text to show when not loading
 */
export function setButtonLoading(button, isLoading, defaultText = null) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button._originalText = button.textContent || button.innerText;
        button.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
        button.classList.add('button-loading');
    } else {
        button.disabled = false;
        button.innerHTML = defaultText || button._originalText || '';
        button.classList.remove('button-loading');
    }
}

/**
 * Set button state for friend requests
 * @param {HTMLButtonElement} button - The button element
 * @param {string} state - 'add', 'sent', 'accept', 'message'
 */
export function setFriendButtonState(button, state) {
    if (!button) return;
    
    switch (state) {
        case 'add':
            button.textContent = 'Add Friend';
            button.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600';
            button.disabled = false;
            break;
            
        case 'sent':
            button.textContent = 'Request Sent';
            button.className = 'px-4 py-1 bg-gray-300 text-gray-600 rounded-full cursor-default';
            button.disabled = true;
            break;
            
        case 'accept':
            button.textContent = 'Accept';
            button.className = 'px-4 py-1 bg-green-500 text-white rounded-full hover:bg-green-600';
            button.disabled = false;
            break;
            
        case 'message':
            button.textContent = 'Message';
            button.className = 'px-4 py-1 bg-blue-500 text-white rounded-full hover:bg-blue-600';
            button.disabled = false;
            break;
            
        default:
            console.warn('Unknown button state:', state);
    }
}

/**
 * Debounce a function to prevent multiple rapid executions
 * @param {Function} func - The function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Format relative time (e.g., "2 minutes ago")
 * @param {number|object} timestamp - Timestamp or Firebase server timestamp
 * @returns {string} - Formatted time string
 */
export function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    let date;
    
    // Check if timestamp is a Firebase server timestamp (object with seconds)
    if (typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);
    
    if (diffSec < 60) {
        return 'just now';
    } else if (diffMin < 60) {
        return `${diffMin}m ago`;
    } else if (diffHr < 24) {
        return `${diffHr}h ago`;
    } else if (diffDays === 1) {
        return 'yesterday';
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString();
    }
}

/**
 * Get user's initial letter for avatar
 * @param {string} username - Username
 * @returns {string} - Initial letter (uppercase)
 */
export function getUserInitial(username) {
    if (!username) return '?';
    return username.charAt(0).toUpperCase();
}

/**
 * Check if a user is the current logged-in user
 * @param {Object|string} user - User object or user ID
 * @returns {boolean} - True if it's the current user
 */
export function isCurrentUser(user) {
    if (!auth.currentUser) return false;
    
    // If user is a string, assume it's a user ID
    if (typeof user === 'string') {
        return auth.currentUser.uid === user;
    }
    
    // If user is an object
    if (user && typeof user === 'object') {
        // Check by ID
        if (user.id && user.id === auth.currentUser.uid) {
            return true;
        }
        
        // Check by email
        if (user.email && user.email === auth.currentUser.email) {
            return true;
        }
        
        // Check if username is "You" (special case)
        if (user.username === "You") {
            return true;
        }
    }
    
    return false;
}

export default {
    setButtonLoading,
    setFriendButtonState,
    debounce,
    formatRelativeTime,
    getUserInitial,
    isCurrentUser
};
