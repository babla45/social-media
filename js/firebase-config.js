// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { getDatabase, connectDatabaseEmulator } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCrMFdofqa66iy9EtOJAF36TmKxzDvPhfU",
  authDomain: "authenticate-app-users.firebaseapp.com",
  databaseURL: "https://authenticate-app-users-default-rtdb.firebaseio.com",
  projectId: "authenticate-app-users",
  storageBucket: "authenticate-app-users.appspot.com",
  messagingSenderId: "241629495766",
  appId: "1:241629495766:web:7b88dd14c421c4a8baa477"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const storage = getStorage(app);

// Set persistence for better user experience
auth.setPersistence && auth.setPersistence('local');

export { app, auth, database, storage };
