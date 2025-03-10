import { auth, database } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { ref, set, serverTimestamp, update } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

// Check auth state
onAuthStateChanged(auth, (user) => {
    if (user) {
        // If we're on login or signup page and user is logged in, redirect to chat
        if (window.location.pathname.includes('index.html') || 
            window.location.pathname.includes('login.html') || 
            window.location.pathname.includes('signup.html') || 
            window.location.pathname === '/' || 
            window.location.pathname.endsWith('/')) {
            window.location.href = 'chat.html';
        }
    } else {
        // If we're on chat page and user is not logged in, redirect to login
        if (window.location.pathname.includes('chat.html')) {
            window.location.href = 'index.html';
        }
    }
});

// Handle signup
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const username = document.getElementById('username').value.trim();
        const errorMessage = document.getElementById('error-message');
        const submitButton = signupForm.querySelector('button[type="submit"]');
        
        // Disable button to prevent multiple submissions
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Creating account...';
        }
        
        try {
            // Validate input
            if (!email || !password || !username) {
                throw new Error("Please fill in all required fields");
            }
            
            if (username.length < 3) {
                throw new Error("Username must be at least 3 characters long");
            }
            
            console.log("Creating user with username:", username);
            
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Update user profile with display name
            await updateProfile(user, {
                displayName: username
            });
            
            // Create user data object with the username from the form input
            const userData = {
                username: username,
                email: email,
                profile_picture: "",
                bio: "",
                status: "online",
                created_at: serverTimestamp()
            };
            
            console.log("Saving user data:", userData);
            
            // Save user data to Realtime Database
            await set(ref(database, 'users/' + user.uid), userData);
            console.log("User data saved successfully with username:", username);
            
            // Double-check to ensure the username is saved correctly
            await update(ref(database, 'users/' + user.uid), {
                username: username // Ensure this exact value is set
            });
            
            // Add a small delay to allow database writes to complete
            setTimeout(() => {
                // Redirect to chat page
                window.location.href = 'chat.html';
            }, 500);
            
        } catch (error) {
            console.error("Signup error:", error);
            
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
    });
}

// Handle login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('error-message');
        
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Redirect to chat page
            window.location.href = 'chat.html';
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('hidden');
        }
    });
}

// We no longer need this logout handler in auth.js as it's now in chat.js
// The logout button is only accessible on the chat page

export { auth };
