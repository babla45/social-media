import { auth, database, storage } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    deleteUser,
    signOut
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
    ref as dbRef, 
    get, 
    update, 
    remove,
    serverTimestamp,
    set
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { 
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

// DOM Elements
const userNameSpan = document.getElementById('user-name');
const profilePicture = document.getElementById('profile-picture');
const uploadPhotoBtn = document.getElementById('upload-photo-btn');
const photoInput = document.getElementById('profile-photo-input');
const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const bioInput = document.getElementById('bio');
const successMessage = document.getElementById('success-message');
const errorMessage = document.getElementById('error-message');

// Password change elements
const changePasswordBtn = document.getElementById('change-password-btn');
const changePasswordModal = document.getElementById('change-password-modal');
const changePasswordForm = document.getElementById('change-password-form');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const passwordError = document.getElementById('password-error');
const passwordSuccess = document.getElementById('password-success');

// Delete account elements
const deleteAccountBtn = document.getElementById('delete-account-btn');
const deleteAccountModal = document.getElementById('delete-account-modal');
const deleteConfirmPassword = document.getElementById('delete-confirm-password');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const deleteError = document.getElementById('delete-error');

// Close modal buttons
const closeModalButtons = document.querySelectorAll('.close-modal');

// Add this in the Event Listeners section
const logoutBtn = document.getElementById('logout-btn');

// Add these variables at the top of your file
const profileLoading = document.getElementById('profile-loading');
const profileContainer = document.getElementById('profile-container');
const noProfileMessage = document.getElementById('no-profile-message');

let currentUser = null;
let userProfileData = {};

// Check authentication state
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Set email immediately (since we have it from auth)
        if (emailInput) {
            emailInput.value = user.email || '';
        }
        
        try {
            // Load user profile data
            await loadProfileData();
            
            console.log("Profile loaded successfully:", userProfileData);
        } catch (error) {
            console.error("Error in profile initialization:", error);
            showError("Could not load profile data. Please refresh the page.");
        }
    } else {
        // Redirect to login if not authenticated
        window.location.href = 'index.html';
    }
});

// Load user profile data
async function loadProfileData() {
    // Show loading, hide other elements
    if (profileLoading) profileLoading.classList.remove('hidden');
    if (profileContainer) profileContainer.classList.add('hidden');
    if (noProfileMessage) noProfileMessage.classList.add('hidden');
    
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            // Not logged in, redirect to login
            window.location.href = 'index.html';
            return;
        }
        
        // Fetch user profile data
        const userRef = dbRef(database, 'users/' + user.uid);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        // Hide loading
        if (profileLoading) profileLoading.classList.add('hidden');
        
        if (userData && Object.keys(userData).length > 0) {
            // Profile exists, show profile container
            if (profileContainer) profileContainer.classList.remove('hidden');
            
            // Populate profile data fields
            populateProfileData(userData);
        } else {
            // No profile data, show the no profile message
            if (noProfileMessage) noProfileMessage.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        
        // Hide loading, show error
        if (profileLoading) profileLoading.classList.add('hidden');
        
        // Show no profile with error message
        if (noProfileMessage) {
            noProfileMessage.classList.remove('hidden');
            const errorMsg = noProfileMessage.querySelector('p');
            if (errorMsg) errorMsg.textContent = 'Error loading profile. Please try again.';
        }
    }
}

// Function to populate profile data (modify based on your profile structure)
function populateProfileData(userData) {
    // Store the profile data for use elsewhere in the app
    userProfileData = userData;
    
    // Set form values
    if (usernameInput && userData.username) {
        usernameInput.value = userData.username;
    }
    
    if (emailInput && userData.email) {
        emailInput.value = userData.email;
    }
    
    if (bioInput) {
        bioInput.value = userData.bio || '';
    }
    
    // Update profile picture
    if (profilePicture) {
        if (userData.profile_picture) {
            // If user has a profile picture, display it
            profilePicture.innerHTML = `<img src="${userData.profile_picture}" alt="Profile" class="w-full h-full object-cover">`;
        } else {
            // Otherwise display first letter of username
            profilePicture.innerHTML = `<span>${(userData.username || 'U').charAt(0).toUpperCase()}</span>`;
        }
    }
    
    // Update header username display
    if (userNameSpan) {
        userNameSpan.textContent = userData.username || '';
    }
}

// Event Listeners
// Upload profile photo
if (uploadPhotoBtn && photoInput) {
    uploadPhotoBtn.addEventListener('click', () => {
        photoInput.click();
    });
    
    photoInput.addEventListener('change', async (e) => {
        if (!e.target.files.length) return;
        
        const file = e.target.files[0];
        if (!file.type.match('image.*')) {
            showError("Please select an image file");
            return;
        }
        
        // File size limit: 5MB
        if (file.size > 5 * 1024 * 1024) {
            showError("Image file should be less than 5MB");
            return;
        }
        
        try {
            uploadPhotoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            uploadPhotoBtn.disabled = true;
            
            // Upload image to Firebase Storage
            const fileRef = storageRef(storage, `profile_pictures/${currentUser.uid}`);
            await uploadBytes(fileRef, file);
            
            // Get download URL
            const downloadURL = await getDownloadURL(fileRef);
            
            // Update user profile in database
            await update(dbRef(database, `users/${currentUser.uid}`), {
                profile_picture: downloadURL
            });
            
            // Update profile picture display
            profilePicture.innerHTML = `<img src="${downloadURL}" alt="Profile" class="w-full h-full object-cover">`;
            
            showSuccess("Profile picture updated successfully");
        } catch (error) {
            console.error("Error uploading profile picture:", error);
            showError("Failed to upload profile picture. Please try again.");
        } finally {
            uploadPhotoBtn.innerHTML = '<i class="fas fa-camera mr-1"></i> Change Photo';
            uploadPhotoBtn.disabled = false;
        }
    });
}

// Update profile information
if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const bio = bioInput.value.trim();
        
        if (!username) {
            showError("Username cannot be empty");
            return;
        }
        
        try {
            // Save original button text and disable button
            const submitButton = profileForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
            submitButton.disabled = true;
            
            console.log("Updating profile with username:", username);
            
            // Update user profile in database
            await update(dbRef(database, `users/${currentUser.uid}`), {
                username,
                bio
            });
            
            // Update local data
            userProfileData.username = username;
            userProfileData.bio = bio;
            
            // Update header username
            if (userNameSpan) {
                userNameSpan.textContent = username;
            }
            
            // Update initial in profile picture if no custom image
            if (!userProfileData.profile_picture && profilePicture) {
                profilePicture.textContent = username.charAt(0).toUpperCase();
            }
            
            showSuccess("Profile updated successfully");
            
            // Restore button state
            submitButton.innerHTML = originalButtonText;
            submitButton.disabled = false;
            
        } catch (error) {
            console.error("Error updating profile:", error);
            showError("Failed to update profile. Please try again.");
            
            // Reset button state on error
            const submitButton = profileForm.querySelector('button[type="submit"]');
            submitButton.innerHTML = 'Save Changes';
            submitButton.disabled = false;
        }
    });
}

// Change password
if (changePasswordBtn && changePasswordModal) {
    changePasswordBtn.addEventListener('click', () => {
        changePasswordModal.classList.remove('hidden');
        
        // Reset form and messages
        changePasswordForm.reset();
        hideElement(passwordError);
        hideElement(passwordSuccess);
    });
    
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            hideElement(passwordError);
            hideElement(passwordSuccess);
            
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Simple validation
            if (!currentPassword || !newPassword || !confirmPassword) {
                showPasswordError("All fields are required");
                return;
            }
            
            if (newPassword.length < 6) {
                showPasswordError("Password must be at least 6 characters long");
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showPasswordError("New passwords don't match");
                return;
            }
            
            try {
                // Re-authenticate user
                const credential = EmailAuthProvider.credential(
                    currentUser.email,
                    currentPassword
                );
                
                await reauthenticateWithCredential(currentUser, credential);
                
                // Update password
                await updatePassword(currentUser, newPassword);
                
                // Show success message
                passwordSuccess.textContent = "Password updated successfully!";
                passwordSuccess.classList.remove('hidden');
                
                // Reset form
                changePasswordForm.reset();
                
                // Close modal after 2 seconds
                setTimeout(() => {
                    changePasswordModal.classList.add('hidden');
                }, 2000);
            } catch (error) {
                console.error("Error updating password:", error);
                
                if (error.code === 'auth/wrong-password') {
                    showPasswordError("Current password is incorrect");
                } else {
                    showPasswordError("Failed to update password. Please try again.");
                }
            }
        });
    }
}

// Delete account
if (deleteAccountBtn && deleteAccountModal) {
    deleteAccountBtn.addEventListener('click', () => {
        deleteAccountModal.classList.remove('hidden');
        
        // Reset form and messages
        if (deleteConfirmPassword) deleteConfirmPassword.value = '';
        hideElement(deleteError);
    });
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            const password = deleteConfirmPassword.value;
            
            if (!password) {
                deleteError.textContent = "Password is required to confirm deletion";
                deleteError.classList.remove('hidden');
                return;
            }
            
            try {
                // Disable button to prevent multiple clicks
                confirmDeleteBtn.disabled = true;
                confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Deleting...';
                
                // Re-authenticate user
                const credential = EmailAuthProvider.credential(
                    currentUser.email,
                    password
                );
                
                await reauthenticateWithCredential(currentUser, credential);
                
                // Delete profile picture if exists
                if (userProfileData.profile_picture) {
                    try {
                        const pictureRef = storageRef(storage, `profile_pictures/${currentUser.uid}`);
                        await deleteObject(pictureRef);
                    } catch (error) {
                        console.error("Error deleting profile picture:", error);
                        // Continue with account deletion even if picture deletion fails
                    }
                }
                
                // Delete user data from database
                await remove(dbRef(database, `users/${currentUser.uid}`));
                
                // Delete all chats where user is a participant
                const userChatsRef = dbRef(database, `userChats/${currentUser.uid}`);
                const userChatsSnapshot = await get(userChatsRef);
                
                if (userChatsSnapshot.exists()) {
                    const chats = userChatsSnapshot.val();
                    
                    // For each chat, remove user from participants and delete from user's list
                    for (const chatId in chats) {
                        await remove(dbRef(database, `userChats/${currentUser.uid}/${chatId}`));
                    }
                }
                
                // Delete user account
                await deleteUser(currentUser);
                
                // Redirect to login page
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Error deleting account:", error);
                
                if (error.code === 'auth/wrong-password') {
                    deleteError.textContent = "Password is incorrect";
                } else {
                    deleteError.textContent = "Failed to delete account. Please try again.";
                }
                
                deleteError.classList.remove('hidden');
                
                // Re-enable button
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.innerHTML = 'Delete Account';
            }
        });
    }
}

// Close modals
if (closeModalButtons) {
    closeModalButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (changePasswordModal) changePasswordModal.classList.add('hidden');
            if (deleteAccountModal) deleteAccountModal.classList.add('hidden');
        });
    });
}

// Add this in the Event Listeners section
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                // Update user status to offline
                await set(dbRef(database, `users/${user.uid}/status`), "offline");
                
                // Sign out
                await signOut(auth);
                
                // Force redirect regardless of success
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Logout error details:', error);
            showError(`Logout failed: ${error.message}`);
            // Attempt force logout if normal logout failed
            try {
                await auth.signOut();
                window.location.href = 'index.html';
            } catch (finalError) {
                console.error('Force logout failed:', finalError);
                showError('Could not complete logout. Please clear browser cookies.');
            }
        }
    });
}

// Helper functions
function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.classList.remove('hidden');
    
    // Hide after 3 seconds
    setTimeout(() => {
        successMessage.classList.add('hidden');
    }, 3000);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // Hide after 5 seconds
    setTimeout(() => {
        errorMessage.classList.add('hidden');
    }, 5000);
}

function showPasswordError(message) {
    passwordError.textContent = message;
    passwordError.classList.remove('hidden');
}

function hideElement(element) {
    if (element) element.classList.add('hidden');
}

// Instead, we can keep a simpler DOM ready listener if needed for other initializations
document.addEventListener('DOMContentLoaded', function() {
    console.log("Profile page loaded");
    // Any other DOM-ready initializations can go here
});
