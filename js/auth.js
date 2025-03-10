import { auth, database } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { ref, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";

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
        const username = document.getElementById('username').value;
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
            
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user data object
            const userData = {
                username: username,
                email: email,
                profile_picture: "",
                status: "online",
                created_at: serverTimestamp()
            };
            
            // Save user data to Realtime Database
            await set(ref(database, 'users/' + user.uid), userData);
            console.log("User data saved successfully");
            
            // Redirect to chat page
            window.location.href = 'chat.html';
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
