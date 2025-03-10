/**
 * Special signup handler to fix username issues
 */
import { auth, database } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
    ref, 
    set, 
    update,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    // Get signup form
    const signupForm = document.getElementById('signupForm');
    
    if (signupForm) {
        console.log("Signup handler attached");
        signupForm.addEventListener('submit', handleSignup);
    } else {
        console.log("Signup form not found");
    }
});

// Handle the signup process
async function handleSignup(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();
    const errorMessage = document.getElementById('error-message');
    const submitButton = document.querySelector('#signupForm button[type="submit"]');
    
    // Store signup username in session storage
    sessionStorage.setItem('pending_username', username);
    console.log("Stored username in sessionStorage:", username);
    
    // Disable submit button
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Creating account...';
    }
    
    try {
        // Validate inputs
        if (!email || !password || !username) {
            throw new Error("Please fill in all required fields");
        }
        
        if (username.length < 3) {
            throw new Error("Username must be at least 3 characters long");
        }
        
        console.log(`Creating account with email: ${email} and username: ${username}`);
        
        // Create the user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update the user profile with the username
        await updateProfile(user, { displayName: username });
        console.log("Auth profile updated with displayName:", username);
        
        // Create user data for the database
        const userData = {
            username: username,
            email: email,
            displayName: username,  // Add a backup field
            profile_picture: "",
            bio: "",
            status: "online",
            created_at: serverTimestamp(),
            last_login: serverTimestamp(),
            username_set_by: "signup_form",
            signup_email: email  // Keep a reference to the signup email
        };
        
        // Save user data to Realtime Database
        await set(ref(database, 'users/' + user.uid), userData);
        console.log("User data saved to database:", userData);
        
        // Add a direct username reference
        await set(ref(database, `usernames/${username.toLowerCase()}`), user.uid);
        console.log("Username reference created");
        
        // Force update the username field
        await update(ref(database, `users/${user.uid}`), {
            username: username,
            username_confirm: username,
            username_updated_at: serverTimestamp()
        });
        console.log("Username field force-updated");
        
        // Wait a moment to ensure database writes complete
        setTimeout(() => {
            // Save username in sessionStorage that persists through redirects
            sessionStorage.setItem('confirmed_username', username);
            console.log("Redirecting to chat.html with username:", username);
            
            // Redirect to the chat page with username as parameter
            window.location.href = `chat.html?username=${encodeURIComponent(username)}&signup=true`;
        }, 1000);
        
    } catch (error) {
        console.error("Signup error:", error);
        sessionStorage.removeItem('pending_username');
        
        // Show error message
        if (errorMessage) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        }
        
        // Re-enable button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Sign Up';
        }
    }
}

export { handleSignup };
