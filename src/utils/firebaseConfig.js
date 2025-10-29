import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
let db;
let auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  // Set up anonymous authentication
  signInAnonymously(auth).catch((error) => {
    console.error('Error with anonymous authentication:', error);
  });
  
} catch (error) {
  console.error('Error initializing Firebase:', error);
}

// Helper function to ensure user is authenticated before database operations
export const ensureAuthenticated = () => {
  return new Promise((resolve, reject) => {
    if (auth?.currentUser) {
      resolve(auth.currentUser);
    } else {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          // Try to sign in anonymously if not already authenticated
          signInAnonymously(auth)
            .then((userCredential) => resolve(userCredential.user))
            .catch((error) => reject(error));
        }
      });
    }
  });
};

export { app, db, auth };
