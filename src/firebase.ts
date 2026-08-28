import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Fill these in from Firebase console → Project settings → Your apps → SDK setup and config.
// Put the real values in a local .env file (see .env.example) — never commit real keys.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!firebaseConfigured) {
  // Doesn't throw — lets the rest of the app (language, layout, etc.) still run
  // and load in dev before Firebase credentials are in place. See src/firebase.ts
  // usage in App.tsx, which checks firebaseConfigured before calling any auth method.
  console.warn(
    "[firebase] Missing config — copy .env.example to .env and fill in your Firebase project's values."
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
