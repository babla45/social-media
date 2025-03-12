# Messenger - Chat Application

A real-time messaging application with friend request functionality built using Firebase.

## Features

- User authentication (signup and login)
- Real-time messaging
- Online/offline status indicators
- Friend request system (send, accept, and reject requests)
- User search functionality
- Chat with friends in real-time

## How to Use

1. **Sign up** with your email, password, and a username
2. **Log in** with your email and password
3. **Search for users** by typing in the search bar (minimum 3 characters)
4. **Send friend requests** by clicking "Add Friend" on a user's profile
5. **Accept/reject friend requests** in the "Requests" tab
6. **Chat with friends** by selecting them from your chats or friends list

## User Guide

### Finding and Adding Friends

1. In the chat interface, type a username (minimum 3 characters) in the search bar
2. The application will display matching users
3. Click "Add Friend" to send a friend request
4. The other user will see your request in their "Requests" tab
5. Once accepted, you can start chatting

### Managing Friend Requests

1. Click on the "Requests" tab to see incoming friend requests
2. Click "Accept" to accept a friend request or "Reject" to decline
3. After accepting, the user will appear in your friends list
4. You can start chatting immediately by clicking "Message"

### Chatting

1. Select a friend from your chats or friends list
2. Type your message in the text input field
3. Press Enter or click the send button to send your message
4. Messages are delivered in real-time

## Technical Details

- Built with HTML, CSS (Tailwind CSS), and JavaScript
- Uses Firebase Authentication for user management
- Uses Firebase Realtime Database for storing messages and user data
- Real-time updates for messages and online status
- Admin panel accessible by triple-clicking the header title (admin@example.com)
- User management capabilities for administrators
