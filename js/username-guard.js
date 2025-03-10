/**
 * Username Guard - Ensures consistent username across the application
 * This is a utility to fix the issue where the email username is used instead of the
 * provided username during signup
 */

import { auth, database } from './firebase-config.js';
import { 
    ref, 
    set, 
    get, 
    update,
    onValue,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

/**
 * Initialize username guard and fix username if needed
 */
export async function initUsernameGuard() {
    if (!auth.currentUser) {
        console.log("Username Guard: No authenticated user");
        return null;
    }
    
    console.log("Username Guard: Initializing for user", auth.currentUser.uid);
    
    // Check for username from various sources
    const urlUsername = new URLSearchParams(window.location.search).get('username');
    const sessionUsername = sessionStorage.getItem('confirmed_username');
    const pendingUsername = sessionStorage.getItem('pending_username');
    
    console.log("Username Guard: Sources", {
        url: urlUsername,
        session: sessionUsername,
        pending: pendingUsername,
        displayName: auth.currentUser.displayName
    });
    
    try {
        // Get user data from database
        const snapshot = await get(ref(database, `users/${auth.currentUser.uid}`));
        const userData = snapshot.exists() ? snapshot.val() : null;
        
        console.log("Username Guard: Current user data", userData);
        
        // Determine the correct username with this priority:
        // 1. URL parameter (highest priority, came from signup)
        // 2. Session storage value (stored from signup)
        // 3. Database username (if it exists)
        // 4. Auth displayName (from Firebase auth)
        // 5. Pending username from session storage (backup)
        // 6. Email username (lowest priority fallback)
        const correctUsername = 
            urlUsername || 
            sessionUsername || 
            (userData && userData.username) || 
            auth.currentUser.displayName || 
            pendingUsername ||
            auth.currentUser.email.split('@')[0];
        
        console.log("Username Guard: Determined correct username", correctUsername);
        
        // Check if database username needs updating
        if (!userData || userData.username !== correctUsername) {
            console.log("Username Guard: Database username needs updating");
            
            // Create or update user data
            const updatedUserData = {
                ...(userData || {}),
                username: correctUsername,
                username_updated_by: "username_guard",
                username_updated_at: serverTimestamp()
            };
            
            if (!userData || !userData.created_at) {
                updatedUserData.created_at = serverTimestamp();
            }
            
            // Update database
            await update(ref(database, `users/${auth.currentUser.uid}`), updatedUserData);
            console.log("Username Guard: Database username updated", correctUsername);
        }
        
        // Check if auth displayName needs updating
        if (!auth.currentUser.displayName || auth.currentUser.displayName !== correctUsername) {
            console.log("Username Guard: Auth displayName needs updating");
            
            // Update auth profile
            await updateProfile(auth.currentUser, { displayName: correctUsername });
            console.log("Username Guard: Auth displayName updated", correctUsername);
        }
        
        // Clear session storage values - we don't need them anymore
        if (urlUsername || sessionUsername) {
            sessionStorage.removeItem('confirmed_username');
            sessionStorage.removeItem('pending_username');
            console.log("Username Guard: Cleared session storage");
        }
        
        return correctUsername;
    } catch (error) {
        console.error("Username Guard: Error", error);
        return null;
    }
}

/**
 * Force fix username with a specific value
 * @param {string} username - Username to set
 */
export async function forceFixUsername(username) {
    if (!auth.currentUser || !username) return false;
    
    console.log("Username Guard: Force fixing username to", username);
    
    try {
        // Update auth profile
        await updateProfile(auth.currentUser, { displayName: username });
        
        // Update database
        await update(ref(database, `users/${auth.currentUser.uid}`), {
            username: username,
            username_updated_by: "force_fix",
            username_updated_at: serverTimestamp()
        });
        
        console.log("Username Guard: Username force fixed successfully");
        return true;
    } catch (error) {
        console.error("Username Guard: Force fix error", error);
        return false;
    }
}

export default { initUsernameGuard, forceFixUsername };
