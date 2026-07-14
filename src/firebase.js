// ============================================================
// Firebase Configuration — Portal Warga RT PAKEM
// ============================================================
import { initializeApp } from 'firebase/app';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    doc,
    onSnapshot,
    setDoc,
    getDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyBEVFGiwKLiH8qMPp_v5swcwtyLwR7Bx8k",
    authDomain: "adminwarga.firebaseapp.com",
    databaseURL: "https://adminwarga-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "adminwarga",
    storageBucket: "adminwarga.firebasestorage.app",
    messagingSenderId: "610184594542",
    appId: "1:610184594542:web:94a5f42ad7941e1221927f",
    measurementId: "G-JMV5EDJWN3"
};

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore dengan offline persistence
let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    console.log("[Firebase] Database berhasil diinisialisasi (offline persistence aktif).");
} catch (offlineError) {
    console.warn("[Firebase] Offline persistence gagal, mencoba tanpa offline cache...", offlineError.message);
    try {
        db = initializeFirestore(app, {});
        console.log("[Firebase] Database berhasil diinisialisasi (mode online-only).");
    } catch (onlineError) {
        console.error("[Firebase Error] Gagal menghubungkan ke Firebase:", onlineError);
        db = null;
    }
}

// Auth
const auth = getAuth(app);

export {
    db,
    auth,
    doc,
    onSnapshot,
    setDoc,
    getDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    where,
    serverTimestamp,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
};
