// ============================================================
// useFirebaseSync.js - Custom hooks untuk sinkronisasi Firebase Realtime
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    db, doc, onSnapshot, setDoc, getDoc, deleteDoc,
    collection, query, where
} from '../firebase.js';
import { showToast } from '../components/common/Toast.jsx';

export function useFirebaseSync(key, initialValue) {
    const [data, setData] = useState(() => {
        // Fallback: baca localStorage dulu agar data tidak hilang saat Firebase lambat/gagal
        try {
            const cached = localStorage.getItem('arisan_rt_' + key);
            if (cached !== null) return JSON.parse(cached);
        } catch(e) {}
        return typeof initialValue === 'function' ? initialValue() : initialValue;
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const pendingWriteRef = useRef(false);
    const pendingValueRef = useRef(undefined);

    useEffect(() => {
        if (!db) { setIsLoaded(true); return; }
        const docRef = doc(db, 'arisan_rt', key);
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
            if (pendingWriteRef.current && pendingValueRef.current !== undefined) {
                if (snapshot.exists()) {
                    const incoming = snapshot.data().value;
                    const expected = JSON.stringify(pendingValueRef.current);
                    const got      = JSON.stringify(incoming);
                    if (expected === got) {
                        pendingWriteRef.current  = false;
                        pendingValueRef.current  = undefined;
                        try { localStorage.setItem('arisan_rt_' + key, got); } catch(e) {}
                    }
                }
                setIsLoaded(true);
                return;
            }
            if (snapshot.exists()) {
                const val = snapshot.data().value;
                setData(val);
                try { localStorage.setItem('arisan_rt_' + key, JSON.stringify(val)); } catch(e) {}
            } else {
                try {
                    const cached = localStorage.getItem('arisan_rt_' + key);
                    if (cached !== null) { setData(JSON.parse(cached)); setIsLoaded(true); return; }
                } catch(e) {}
                const iv = typeof initialValue === 'function' ? initialValue() : initialValue;
                setData(iv);
            }
            setIsLoaded(true);
        }, (error) => {
            console.warn(`[Sync Error] Gagal memuat koleksi '${key}':`, error.message);
            setIsLoaded(true);
        });
        return () => unsubscribe();
    }, [key]);

    const updateData = useCallback((newValue) => {
        setData(prevData => {
            const valueToStore = typeof newValue === 'function' ? newValue(prevData) : newValue;
            try { localStorage.setItem('arisan_rt_' + key, JSON.stringify(valueToStore)); } catch(e) {}
            if (db) {
                pendingWriteRef.current = true;
                pendingValueRef.current = valueToStore;
                const docRef     = doc(db, 'arisan_rt', key);
                const safeValue  = valueToStore === undefined ? null : valueToStore;
                const sanitized  = JSON.parse(JSON.stringify(safeValue));
                setDoc(docRef, { value: sanitized }, { merge: false })
                    .catch(err => {
                        console.error('[Firebase] setDoc gagal:', err);
                        pendingWriteRef.current = false;
                        pendingValueRef.current = undefined;
                        showToast('Gagal menyimpan ke server. Cek koneksi internet!', 'error');
                    });
            }
            return valueToStore;
        });
    }, [key]);

    return [data, updateData, isLoaded];
}

export function useFirebaseArticlesSync(isAdmin) {
    const [data, setData] = useState(() => {
        try {
            const cached = localStorage.getItem('arisan_rt_blog_articles');
            if (cached !== null) return JSON.parse(cached);
        } catch (e) {}
        return [];
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const dataRef = useRef(data);
    const migrationRunRef = useRef(false);

    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        if (!db) {
            setIsLoaded(true);
            return;
        }

        // 1. Jalankan migrasi data lama sekali saja saat pertama kali dimuat dan terdeteksi sebagai admin
        if (isAdmin && !migrationRunRef.current) {
            migrationRunRef.current = true;
            const oldBlogDocRef = doc(db, 'arisan_rt', 'blog');
            getDoc(oldBlogDocRef).then((oldDocSnap) => {
                if (oldDocSnap.exists()) {
                    const oldData = oldDocSnap.data();
                    if (oldData && Array.isArray(oldData.value) && oldData.value.length > 0) {
                        const migrationPromises = oldData.value.map(article => {
                            const articleDocRef = doc(db, 'arisan_rt', 'blog_article_' + article.id);
                            return setDoc(articleDocRef, {
                                ...article,
                                type: 'blog_article'
                            }, { merge: false });
                        });

                        Promise.all(migrationPromises).then(() => {
                            setDoc(oldBlogDocRef, { value: [] }, { merge: false })
                                .catch(err => console.error('[Migration] Gagal mengosongkan blog lama:', err));
                        }).catch(err => {
                            console.error('[Migration] Gagal memigrasi beberapa blog:', err);
                            showToast(`Gagal migrasi data lama: ${err.message || err}`, 'error');
                        });
                    }
                }
            }).catch(err => {
                console.error('[Migration] Gagal mengecek data blog lama:', err);
            });
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!db) {
            setIsLoaded(true);
            return;
        }

        // 2. Query realtime sync untuk semua dokumen ber-type: 'blog_article'
        const blogQuery = query(collection(db, 'arisan_rt'), where('type', '==', 'blog_article'));
        const unsubscribe = onSnapshot(blogQuery, (querySnapshot) => {
            const articles = [];
            querySnapshot.forEach((docSnap) => {
                articles.push(docSnap.data());
            });

            articles.sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                if (dateB - dateA !== 0) return dateB - dateA;
                return String(b.id).localeCompare(String(a.id));
            });

            setData(articles);
            try { localStorage.setItem('arisan_rt_blog_articles', JSON.stringify(articles)); } catch (e) {}
            setIsLoaded(true);
        }, (error) => {
            console.warn(`[Sync Error] Gagal memuat blog_articles:`, error.message);
            setIsLoaded(true);
        });

        return () => unsubscribe();
    }, []);

    const updateData = useCallback((newValue) => {
        const prevData = dataRef.current;
        const valueToStore = typeof newValue === 'function' ? newValue(prevData) : newValue;

        try { localStorage.setItem('arisan_rt_blog_articles', JSON.stringify(valueToStore)); } catch (e) {}

        setData(valueToStore);

        if (db) {
            // 1. Cari yang ditambahkan atau diubah
            valueToStore.forEach(art => {
                const oldArt = prevData.find(b => b.id === art.id);
                if (!oldArt || JSON.stringify(oldArt) !== JSON.stringify(art)) {
                    const articleDocRef = doc(db, 'arisan_rt', 'blog_article_' + art.id);
                    setDoc(articleDocRef, { ...art, type: 'blog_article' }, { merge: false })
                        .catch(err => {
                            console.error(`[Firebase] Gagal menyimpan blog_article_${art.id}:`, err);
                            showToast(`Gagal menyimpan: ${err.message || err}`, 'error');
                        });
                }
            });

            // 2. Cari yang dihapus
            prevData.forEach(art => {
                const stillExists = valueToStore.some(b => b.id === art.id);
                if (!stillExists) {
                    const articleDocRef = doc(db, 'arisan_rt', 'blog_article_' + art.id);
                    deleteDoc(articleDocRef)
                        .catch(err => {
                            console.error(`[Firebase] Gagal menghapus blog_article_${art.id}:`, err);
                            showToast(`Gagal menghapus: ${err.message || err}`, 'error');
                        });
                }
            });
        }
    }, []);

    return [data, updateData, isLoaded];
}
