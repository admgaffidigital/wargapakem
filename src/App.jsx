// ============================================================
// App.jsx - Portal Warga RT PAKEM
// Dikonversi dari index.html (Babel CDN) ke Vite build system
// ============================================================
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    db, auth, doc, onSnapshot, setDoc, getDoc, deleteDoc,
    collection, query, where,
    signInWithEmailAndPassword, signOut, onAuthStateChanged
} from './firebase.js';

const RobotGuide = React.lazy(() => import('./RobotGuide.jsx'));

        const getDirectImgUrl = (url) => {
            if (!url) return '';
            const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch) {
                return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
            }
            return url;
        };

        const getLocalDate = () => { const offset = new Date().getTimezoneOffset() * 60000; return new Date(Date.now() - offset).toISOString().split('T')[0]; };
        
        function Icon({ name, className = "text-[17px]", fill = "false" }) {
            return <span className={`material-symbols-rounded shrink-0 select-none flex items-center justify-center ${className}`} style={{ fontVariationSettings: fill === 'true' ? "'FILL' 1" : "'FILL' 0", lineHeight: '1em', width: '1em', height: '1em' }} aria-hidden="true">{name}</span>;
        }

        const GOOGLE_DRIVE_API_URL = "https://script.google.com/macros/s/AKfycbxYi3xmw3jsotb-pcipK4uRITqrIcNf-9CJ66Oa_ZjFpVw9R2q6w1zX7UlabKHAK_m0/exec";

        const uploadToGoogleDrive = async (file, maxSize = 1200, quality = 0.82) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.onload = async () => {
                        const canvas = document.createElement('canvas');
                        let w = img.width, h = img.height;
                        if (w > h && w > maxSize) { h *= maxSize / w; w = maxSize; }
                        else if (h >= w && h > maxSize) { w *= maxSize / h; h = maxSize; }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        const compressedBase64 = canvas.toDataURL('image/webp', quality);
                        
                        try {
                            const response = await fetch(GOOGLE_DRIVE_API_URL, {
                                method: 'POST',
                                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                                body: JSON.stringify({
                                    filename: file.name.split('.')[0] + '.webp',
                                    mimeType: 'image/webp',
                                    fileData: compressedBase64
                                })
                            });
                            const data = await response.json();
                            if (data.status === 'success') {
                                resolve(data.url);
                            } else {
                                reject(data.message || 'Gagal upload ke Google Drive');
                            }
                        } catch (error) {
                            reject('Koneksi upload gagal: ' + error.message);
                        }
                    };
                    img.onerror = () => reject('Gagal memproses gambar');
                    img.src = reader.result;
                };
                reader.onerror = () => reject('Gagal membaca file');
                reader.readAsDataURL(file);
            });
        };

        /* ================= TOAST NOTIFICATION (GLOBAL) ================= */
        function showToast(message, type = 'success') {
            window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
        }

        function ToastContainer() {
            const [toasts, setToasts] = useState([]);

            useEffect(() => {
                const timers = [];
                const handler = (e) => {
                    const id = Date.now() + Math.random();
                    setToasts(prev => [...prev, { id, message: e.detail.message, type: e.detail.type || 'success', closing: false }]);
                    timers.push(setTimeout(() => {
                        setToasts(prev => prev.map(t => t.id === id ? { ...t, closing: true } : t));
                    }, 2700));
                    timers.push(setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3100));
                };
                window.addEventListener('app:toast', handler);
                return () => { window.removeEventListener('app:toast', handler); timers.forEach(clearTimeout); };
            }, []);

            if (toasts.length === 0) return null;

            const configs = {
                success: { icon: 'task_alt', bg: 'bg-google-red', iconBg: 'bg-white/20', shadow: 'shadow-md' },
                error:   { icon: 'error',    bg: 'bg-google-red', iconBg: 'bg-white/20', shadow: 'shadow-md' },
                info:    { icon: 'info',     bg: 'bg-google-red', iconBg: 'bg-white/20', shadow: 'shadow-md' },
                warning: { icon: 'warning',  bg: 'bg-google-yellow', iconBg: 'bg-white/20', shadow: 'shadow-md' },
            };

            return (
                <div
                    className="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col-reverse gap-2.5 no-print items-center pointer-events-none"
                    style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))', width: 'min(92vw, 400px)' }}
                >
                    {toasts.map(t => {
                        const cfg = configs[t.type] || configs.success;
                        return (
                            <div
                                key={t.id}
                                className={`w-full flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl border border-white/20 ${cfg.bg} shadow-2xl ${cfg.shadow} text-white`}
                                style={{ animation: t.closing ? 'toastPopOut 0.35s cubic-bezier(0.4,0,1,1) forwards' : 'toastPopIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards' }}
                            >
                                <div className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                                    <Icon name={cfg.icon} className="text-[18px] text-white" fill="true" />
                                </div>
                                <p className="flex-1 text-[13px] font-medium leading-snug tracking-wide">{t.message}</p>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                            </div>
                        );
                    })}
                </div>
            );
        }

        function useFirebaseSync(key, initialValue) {
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

        function useFirebaseArticlesSync(isAdmin) {
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
                                console.log(`[Migration] Ditemukan ${oldData.value.length} data blog lama. Memulai migrasi...`);
                                
                                const migrationPromises = oldData.value.map(article => {
                                    const articleDocRef = doc(db, 'arisan_rt', 'blog_article_' + article.id);
                                    return setDoc(articleDocRef, {
                                        ...article,
                                        type: 'blog_article'
                                    }, { merge: false });
                                });

                                Promise.all(migrationPromises).then(() => {
                                    console.log('[Migration] Migrasi data blog berhasil. Menghapus dokumen blog lama...');
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

        const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
        const formatBulanTahun = (yyyy_mm) => {
            if (!yyyy_mm) return '-'; const [year, month] = yyyy_mm.split('-'); return new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        };
        const safeNumber = (val) => val === '' ? '' : (isNaN(Math.abs(Number(val))) ? 0 : Math.abs(Number(val)));
        // FIX LOGIKA-2: Helper parse tanggal lokal (hindari timezone off-by-one UTC)
        const parseLocalDate = (dateStr) => { if (!dateStr) return new Date(); const [y, m, d] = dateStr.split('-'); return new Date(+y, +m - 1, +d); };
        // Helper: cek apakah warga nonaktif (Meninggal ATAU Nonaktif/Pindah) - bebas dari arisan
        const isNonaktif = (member) => member && (member.status === 'Meninggal' || member.status === 'Nonaktif');


        /* ================= PWA INSTALL BANNER COMPONENT ================= */
        function PWAInstallBanner() {
            const [deferredPrompt, setDeferredPrompt] = useState(null);
            const [showBanner, setShowBanner] = useState(false);
            const [isIOS, setIsIOS] = useState(false);
            const [isInstalled, setIsInstalled] = useState(false);
            const [dismissed, setDismissed] = useState(false);

            useEffect(() => {
                // Cek sudah diinstall (standalone mode)
                const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches 
                    || window.navigator.standalone === true;
                if (alreadyInstalled) { setIsInstalled(true); return; }

                // Cek sudah pernah dismiss
                try {
                    if (sessionStorage.getItem('pwa_banner_dismissed')) { setDismissed(true); return; }
                } catch(e) { /* incognito mode - lanjut tampil banner */ }

                // Deteksi iOS
                const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
                const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
                if (ios && isSafari) {
                    setIsIOS(true);
                    const t = setTimeout(() => setShowBanner(true), 2500);
                    return () => clearTimeout(t);
                }

                // Android/Chrome: tangkap event beforeinstallprompt
                let bannerTimer = null;
                const handler = (e) => {
                    e.preventDefault();
                    setDeferredPrompt(e);
                    bannerTimer = setTimeout(() => setShowBanner(true), 2500);
                };
                const onInstalled = () => { setShowBanner(false); setIsInstalled(true); };
                window.addEventListener('beforeinstallprompt', handler);
                window.addEventListener('appinstalled', onInstalled);
                return () => {
                    window.removeEventListener('beforeinstallprompt', handler);
                    window.removeEventListener('appinstalled', onInstalled);
                    if (bannerTimer) clearTimeout(bannerTimer);
                };
            }, []);

            const handleInstall = async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') setShowBanner(false);
                setDeferredPrompt(null);
            };

            const handleDismiss = () => {
                setShowBanner(false);
                try { sessionStorage.setItem('pwa_banner_dismissed', '1'); } catch(e) {}
            };

            if (isInstalled || dismissed || !showBanner) return null;

            return (
                <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4 no-print"
                     style={{ animation: 'slideUpFade 0.4s ease-out', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
                    <style>{`
                        @keyframes slideUpFade {
                            from { opacity: 0; transform: translateY(20px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 flex flex-wrap items-center gap-4 max-w-lg mx-auto">
                        {/* Ikon */}
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-google-red to-google-redDark flex items-center justify-center shrink-0 shadow-md text-white font-medium text-[18px]">
                            RT
                        </div>
                        {/* Teks */}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-[13px] text-google-text leading-tight tracking-tight">
                                Pasang Aplikasi Ini
                            </p>
                            {isIOS ? (
                                <p className="text-[11px] font-medium text-google-textVariant mt-0.5 leading-snug">
                                    Tap <span className="inline-flex items-center gap-0.5 font-medium text-google-blue">
                                        <Icon name="ios_share" className="text-[13px]"/> Bagikan
                                    </span> lalu pilih <b>"Tambah ke Layar Utama"</b>
                                </p>
                            ) : (
                                <p className="text-[11px] font-medium text-google-textVariant mt-0.5 leading-snug">
                                    Install ke homescreen untuk akses lebih cepat
                                </p>
                            )}
                        </div>
                        {/* Tombol */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {!isIOS && (
                                <button onClick={handleInstall}
                                    className="bg-google-blue text-white text-[12px] font-medium px-4 py-2.5 rounded-full border border-google-blueDark hover:bg-google-blueDark active:scale-95 transition-all duration-200 shadow-md whitespace-nowrap">
                                    Install
                                </button>
                            )}
                            <button onClick={handleDismiss}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all duration-200">
                                <Icon name="close" className="text-[16px] text-google-textVariant"/>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        /* ================= ROBOT ASISTEN COMPONENT ================= */

        // RobotGuide is loaded dynamically via React.lazy


        /* ===== HELPER: Normalisasi URL Audio untuk Streaming ===== */
        function normalizeAudioUrl(url) {
            if (!url) return '';
            try {
                // Dropbox share link G dl.dropboxusercontent.com (direct stream, CORS OK)
                // Contoh: https://www.dropbox.com/s/XXXXX/file.mp3?dl=0
                //   G https://dl.dropboxusercontent.com/s/XXXXX/file.mp3
                if (url.includes('dropbox.com')) {
                    // Format baru Dropbox: /scl/fi/ atau /s/
                    let normalized = url
                        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                        .replace('?dl=0', '')
                        .replace('?dl=1', '')
                        .replace('&dl=0', '')
                        .replace('&dl=1', '');
                    // Hapus parameter rlkey jika ada (untuk URL baru Dropbox)
                    // dl.dropboxusercontent.com tidak butuh rlkey
                    return normalized;
                }
                // Google Drive viewer G langsung (catatan: GDrive sering CORS issue, tapi kita coba convert)
                // https://drive.google.com/file/d/ID/view G https://drive.google.com/uc?export=download&id=ID
                const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (gdriveMatch) {
                    return `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
                }
                return url;
            } catch(e) {
                return url;
            }
        }

        /* ================= FLOATING MUSIC PLAYER (WARGA ONLY) ================= */
        /* ================= BACKGROUND MUSIC PLAYER (WARGA ONLY - INVISIBLE) ================= */
        function FloatingMusicPlayer({ musicData }) {
            const audioRef = useRef(null);

            const streamUrl = normalizeAudioUrl(musicData?.url);

            useEffect(() => {
                if (!streamUrl) return;
                const audio = audioRef.current;
                if (!audio) return;

                audio.volume = 0.6;
                audio.loop = true;

                const attemptPlay = () => {
                    audio.play().catch(() => {
                        // Browser blokir autoplay G tunggu interaksi user
                    });
                };

                // Coba autoplay saat audio siap
                audio.addEventListener('canplay', attemptPlay, { once: true });
                audio.load();

                // Fallback: langsung play saat user pertama kali klik/tap layar
                const handleFirstInteraction = () => {
                    if (audio.paused) audio.play().catch(() => {});
                    document.removeEventListener('click', handleFirstInteraction, true);
                    document.removeEventListener('touchstart', handleFirstInteraction, true);
                };
                document.addEventListener('click', handleFirstInteraction, true);
                document.addEventListener('touchstart', handleFirstInteraction, true);

                // Cleanup: hentikan musik saat warga logout (komponen di-unmount)
                return () => {
                    audio.pause();
                    audio.src = '';
                    document.removeEventListener('click', handleFirstInteraction, true);
                    document.removeEventListener('touchstart', handleFirstInteraction, true);
                };
            }, [streamUrl]);

            // Render hanya elemen audio tersembunyi G tidak ada UI yang terlihat
            return <audio ref={audioRef} src={streamUrl} preload="auto" style={{ display: 'none' }} />;
        }


        /* ================= MUSIC ADMIN (ADMIN ONLY) ================= */
        function MusicAdmin({ musicData, setMusicData }) {
            const [urlInput, setUrlInput] = useState('');
            const [nameInput, setNameInput] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            const [previewUrl, setPreviewUrl] = useState('');
            const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'testing' | 'ok' | 'fail'
            const previewAudioRef = useRef(null);

            const currentUrl = musicData?.url || '';
            const currentName = musicData?.name || '';
            const isEnabled = musicData?.enabled !== false;

            const handlePreviewTest = () => {
                if (!urlInput.trim()) return setErrorMsg('Masukkan URL terlebih dahulu.');
                const normalized = normalizeAudioUrl(urlInput.trim());
                setPreviewUrl(normalized);
                setTestStatus('testing');
                setErrorMsg('');
            };

            // Ketika previewUrl berubah, coba load audio
            useEffect(() => {
                if (!previewUrl || !previewAudioRef.current) return;
                const audio = previewAudioRef.current;
                audio.src = previewUrl;
                audio.load();
                const onCanPlay = () => setTestStatus('ok');
                const onError = () => setTestStatus('fail');
                audio.addEventListener('canplay', onCanPlay);
                audio.addEventListener('error', onError);
                return () => {
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.removeEventListener('error', onError);
                };
            }, [previewUrl]);

            const handleSaveUrl = () => {
                if (!urlInput.trim()) return setErrorMsg('URL musik tidak boleh kosong.');
                if (!urlInput.startsWith('http')) return setErrorMsg('URL harus dimulai dengan http:// atau https://');
                const normalized = normalizeAudioUrl(urlInput.trim());
                setMusicData({ url: normalized, name: nameInput.trim() || 'Musik RT', enabled: true });
                setUrlInput('');
                setNameInput('');
                setErrorMsg('');
                setPreviewUrl('');
                setTestStatus('idle');
                showToast('Musik berhasil disimpan!');
            };

            const handleDeleteMusic = () => {
                setMusicData({ url: '', name: '', enabled: false });
                showToast('Musik berhasil dihapus.', 'error');
            };

            const handleToggleEnabled = () => {
                setMusicData({ ...musicData, enabled: !isEnabled });
                showToast(isEnabled ? 'Musik dinonaktifkan.' : 'Musik diaktifkan.');
            };

            return (
                <div className="space-y-8 w-full">
                    {/* Hidden audio for test */}
                    <audio ref={previewAudioRef} preload="auto" style={{ display: 'none' }} />

                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-google-yellowLight flex items-center justify-center border border-google-yellow/40 shrink-0">
                                <Icon name="music_note" className="text-[32px] text-google-yellowDark" fill="true" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-medium text-google-text tracking-tight">Musik Warga</h2>
                                <p className="text-[12px] font-medium text-google-textVariant mt-0.5">Musik otomatis memutar untuk semua pengunjung Warga.</p>
                            </div>
                        </div>
                    </div>

                    {/* Status Musik Terpasang */}
                    {currentUrl ? (
                        <div className={`rounded-3xl p-6 border ${isEnabled ? 'bg-google-greenLight border-google-green/40' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border ${isEnabled ? 'bg-google-green border-google-greenDark' : 'bg-slate-300 border-slate-400'}`}>
                                        <Icon name={isEnabled ? 'graphic_eq' : 'music_off'} className="text-white text-[17px]" fill="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-medium uppercase tracking-widest text-google-textVariant">{isEnabled ? 'Aktif' : 'Nonaktif'}</p>
                                        <p className="font-medium text-[13px] text-google-text truncate">{currentName || 'Musik RT'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <button onClick={handleToggleEnabled}
                                            className={`px-3 py-2 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${isEnabled ? 'bg-white text-google-greenDark border-google-green/40 hover:bg-google-greenLight' : 'bg-google-green text-white border-google-greenDark'}`}>
                                        {isEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                                    </button>
                                    <button onClick={handleDeleteMusic}
                                            className="px-3 py-2 rounded-full font-medium text-[11px] bg-google-redLight text-google-redDark border border-google-red/30 hover:bg-google-red hover:text-white active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                        <Icon name="delete" className="text-[12px]" /> Hapus
                                    </button>
                                </div>
                            </div>
                            {/* Preview player native browser */}
                            {isEnabled && (
                                <div className="bg-white/80 rounded-xl p-3 border border-google-green/30">
                                    <p className="text-[9px] font-medium text-google-greenDark mb-2 uppercase tracking-widest">Preview</p>
                                    <audio controls src={currentUrl} className="w-full" style={{ height: '36px' }}>
                                        Browser Anda tidak mendukung audio.
                                    </audio>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-3xl p-8 border border-dashed border-slate-400 text-center">
                            <Icon name="music_off" className="text-[40px] text-slate-300 mb-3" />
                            <p className="font-medium text-[14px] text-slate-500">Belum Ada Musik</p>
                            <p className="text-[12px] font-medium text-slate-400 mt-1">Masukkan URL Dropbox di bawah.</p>
                        </div>
                    )}

                    {/* Panduan Dropbox */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-blue-600 px-6 py-4 flex flex-wrap items-center gap-3">
                            <Icon name="cloud_upload" className="text-white text-[20px]" fill="true" />
                            <div>
                                <p className="text-white font-medium text-[13px]">Upload via Dropbox</p>
                                <p className="text-blue-100 text-[10px] font-medium">Cara terbaik G gratis, cepat, dan bebas CORS</p>
                            </div>
                        </div>
                        <div className="p-6 sm:p-8 md:p-6">
                            <ol className="space-y-5 mb-5">
                                {[
                                    { step: '1', text: 'Buka dropbox.com dan login (atau daftar gratis).', icon: 'open_in_new' },
                                    { step: '2', text: 'Upload file MP3/WAV/OGG ke Dropbox Anda.', icon: 'upload' },
                                    { step: '3', text: 'Klik kanan file G "Share" G "Copy Link" G salin link yang muncul.', icon: 'share' },
                                    { step: '4', text: 'Paste link di kolom URL di bawah. Sistem otomatis mengkonversi ke link streaming.', icon: 'paste' },
                                ].map(item => (
                                    <li key={item.step} className="flex flex-wrap items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center shrink-0 mt-0.5">{item.step}</div>
                                        <p className="text-[12px] font-medium text-google-textVariant leading-snug">{item.text}</p>
                                    </li>
                                ))}
                            </ol>

                            {/* Form Input */}
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-1.5 ml-1 uppercase tracking-widest">Nama Lagu</label>
                                    <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                                           placeholder="Contoh: Indonesia Raya Instrumental"
                                           className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-google-text rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-1.5 ml-1 uppercase tracking-widest">URL Dropbox / Link Audio Langsung</label>
                                    <input type="url" value={urlInput} onChange={e => { setUrlInput(e.target.value); setTestStatus('idle'); setErrorMsg(''); }}
                                           placeholder="https://www.dropbox.com/s/xxxxx/lagu.mp3?dl=0"
                                           className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-google-text rounded-xl px-4 py-3 text-[12px] font-medium outline-none transition-all placeholder:text-slate-400" />
                                </div>

                                {/* Test button */}
                                <button onClick={handlePreviewTest}
                                        className="w-full bg-slate-100 text-google-textVariant py-2.5 rounded-full font-medium text-[11px] border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2">
                                    <Icon name="play_circle" className="text-[14px]" /> Test Apakah URL Bisa Diputar
                                </button>

                                {/* Test result */}
                                {testStatus === 'testing' && (
                                    <div className="flex flex-wrap items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl text-[11px] font-medium border border-blue-200">
                                        <div className="w-3.5 h-3.5 border border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                        Mengecek URL...
                                    </div>
                                )}
                                {testStatus === 'ok' && (
                                    <div className="bg-google-greenLight border border-google-green/40 rounded-xl p-3">
                                        <p className="text-[11px] font-medium text-google-greenDark mb-2 flex flex-wrap items-center gap-1.5">
                                            <Icon name="check_circle" className="text-[13px]" fill="true" /> URL Valid Preview:
                                        </p>
                                        <audio controls src={previewUrl} className="w-full" style={{ height: '34px' }} />
                                    </div>
                                )}
                                {testStatus === 'fail' && (
                                    <div className="flex flex-wrap items-center gap-2 bg-google-redLight text-google-redDark px-4 py-2.5 rounded-xl text-[11px] font-medium border border-google-red/30">
                                        <Icon name="error" className="text-[13px]" fill="true" />
                                        URL gagal dimuat. Pastikan link Dropbox sudah benar dan file publik (tidak private).
                                    </div>
                                )}

                                {errorMsg && (
                                    <div className="flex flex-wrap items-center gap-2 bg-google-redLight text-google-redDark px-4 py-2.5 rounded-xl font-medium text-[11px] border border-google-red/30">
                                        <Icon name="error" className="text-[13px]" fill="true" /> {errorMsg}
                                    </div>
                                )}

                                <button onClick={handleSaveUrl}
                                        className="w-full bg-google-green text-white py-3.5 rounded-full font-medium text-[13px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2">
                                    <Icon name="save" className="text-[17px]" /> Simpan & Aktifkan Musik
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-google-yellowLight rounded-3xl p-6 sm:p-8 md:p-8 border border-google-yellow/40 flex flex-wrap items-start gap-3">
                        <Icon name="info" className="text-[17px] text-google-yellowDark shrink-0 mt-0.5" fill="true" />
                        <ul className="text-[11px] font-medium text-google-yellowDark/90 space-y-1 list-disc list-inside">
                            <li>Musik <span className="underline decoration-dotted">hanya memutar</span> untuk pengguna login sebagai <span className="underline decoration-dotted">Warga</span>.</li>
                            <li>Admin tidak mendengar musik saat login sebagai Admin.</li>
                            <li>Browser mobile kadang memblokir autoplay G warga cukup tap layar sekali.</li>
                            <li>Gunakan file audio bebas hak cipta atau milik sendiri.</li>
                        </ul>
                    </div>
                </div>
            );
        }


        
        function Umkm({ umkmData, setUmkmData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [formData, setFormData] = useState({ name: '', owner: '', phone: '', category: 'Lainnya', description: '', imageUrl: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [searchQuery, setSearchQuery] = useState('');
            const [selectedCategory, setSelectedCategory] = useState('Semua');
            // Deklarasi di atas agar dapat diakses oleh semua handler
            const [modalConfig, setModalConfig] = useState(null);

            const categories = ['Semua', 'Makanan & Minuman', 'Jasa', 'Toko/Warung', 'Pakaian', 'Kesehatan', 'Lainnya'];

            const handleSave = () => {
                if (!formData.name || !formData.phone) return setErrorMsg("Nama Usaha dan Nomor WhatsApp wajib diisi!");
                
                // Format phone number (ensure starts with 62)
                let formattedPhone = formData.phone.replace(/\D/g, '');
                if (formattedPhone.startsWith('0')) {
                    formattedPhone = '62' + formattedPhone.substring(1);
                } else if (!formattedPhone.startsWith('62')) {
                    formattedPhone = '62' + formattedPhone;
                }

                const newFormData = { ...formData, phone: formattedPhone };

                if (editingId) {
                    setUmkmData(umkmData.map(item => item.id === editingId ? { ...item, ...newFormData } : item));
                    setModalConfig && setModalConfig({ message: 'Data UMKM berhasil diperbarui.' });
                } else {
                    setUmkmData([{ id: Date.now(), ...newFormData }, ...umkmData]);
                    setModalConfig && setModalConfig({ message: 'Data UMKM berhasil ditambahkan.' });
                }
                setIsFormOpen(false);
                setEditingId(null);
            };

            const handleEdit = (item) => {
                setFormData({
                    name: item.name || '',
                    owner: item.owner || '',
                    phone: item.phone || '',
                    category: item.category || 'Lainnya',
                    description: item.description || '',
                    imageUrl: item.imageUrl || ''
                });
                setEditingId(item.id);
                setErrorMsg('');
                setIsUploading(false);
                setIsFormOpen(true);
            };

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.6);
                    setFormData({ ...formData, imageUrl: url });
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const filteredData = (umkmData || []).filter(item => {
                const matchSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                    (item.owner || '').toLowerCase().includes(searchQuery.toLowerCase());
                const matchCategory = selectedCategory === 'Semua' || item.category === selectedCategory;
                return matchSearch && matchCategory;
            });

            // Sudah dideklarasikan di atas (dipindah agar hoisting bersih)

            return (
                <div className="animate-fade-in pb-24 w-full">
                    {modalConfig && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 max-w-sm w-full text-center modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-green-100 dark:bg-emerald-950/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check_circle" className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 dark:text-white mb-2">Berhasil</h3>
                                <p className="text-slate-600 dark:text-slate-300 mb-8">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-4 rounded-full transition-all">Tutup</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-green-50 p-6 sm:p-10 rounded-3xl border border-green-200/60 shadow-md shadow-green-500/10 mb-8 relative overflow-hidden">
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 text-white rounded-xl mb-4 shadow-lg">
                                    <Icon name="storefront" />
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-medium text-slate-800 tracking-tight mb-2">Pasar Warga RT</h1>
                                <p className="text-slate-600 text-[13px] sm:text-[14px] max-w-xl font-medium leading-relaxed">Direktori usaha milik warga RT. Dukung UMKM lokal dengan berbelanja dari tetangga sendiri.</p>
                            </div>
                            {userRole === 'admin' && (
                                <button onClick={() => { setFormData({ name: '', owner: '', phone: '', category: 'Lainnya', description: '', imageUrl: '' }); setEditingId(null); setIsFormOpen(true); }} className="w-full md:w-auto bg-green-600 text-white px-8 py-4 rounded-full font-medium text-[13px] shadow-lg shadow-green-600/30 hover:bg-green-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2 group">
                                    <Icon name="add_circle" className="group-hover:rotate-90 transition-transform duration-300" /> Tambah Usaha
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mb-6 flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <input type="text" placeholder="Cari nama usaha atau pemilik..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-green-500 outline-none transition-all font-medium text-slate-700" />
                        </div>
                        <div className="relative min-w-[200px]">
                            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full px-4 pr-9 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-green-500 outline-none transition-all font-medium text-slate-700 appearance-none cursor-pointer">
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <Icon name="expand_more" style={{ fontSize: '20px' }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {filteredData.length === 0 ? (
                        <div className="bg-white/80  rounded-3xl p-12 text-center border border-dashed border-slate-200 shadow-sm">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Icon name="store_off" className="text-[48px] text-slate-300" />
                            </div>
                            <h3 className="text-xl font-medium text-slate-700 mb-2">Belum Ada UMKM</h3>
                            <p className="text-slate-500 font-medium">Daftar usaha warga masih kosong atau tidak ditemukan.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredData.map(item => (
                                <div key={item.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full">
                                    <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                                <Icon name="image" className="text-4xl mb-2" />
                                                <span className="text-sm font-medium">Tidak ada foto</span>
                                            </div>
                                        )}
                                        <div className="absolute top-4 left-4 bg-white/90  px-3 py-1.5 rounded-full text-[11px] font-medium text-green-700 shadow-sm border border-green-100 flex items-center gap-1">
                                            <Icon name="sell" className="text-[13px]" /> {item.category}
                                        </div>
                                        {userRole === 'admin' && (
                                            <div className="absolute top-4 right-4 flex gap-2">
                                                <button onClick={() => handleEdit(item)} className="w-10 h-10 bg-white/95 text-blue-600 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50 transition-colors">
                                                    <Icon name="edit" className="text-[17px]" />
                                                </button>
                                                <button onClick={() => setDeleteConfirmId(item.id)} className="w-10 h-10 bg-white/95 text-red-500 rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                                                    <Icon name="delete" className="text-[17px]" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 flex flex-col flex-1">
                                        <h3 className="font-medium text-xl text-slate-800 dark:text-white mb-1 line-clamp-1">{item.name}</h3>
                                        <div className="flex items-center text-slate-500 dark:text-slate-400 text-sm mb-4 font-medium">
                                            <Icon name="person" className="text-[14px] mr-1" /> {item.owner}
                                        </div>
                                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-6 line-clamp-3 leading-relaxed flex-1">
                                            {item.description || 'Tidak ada deskripsi.'}
                                        </p>
                                        <a href={`https://wa.me/${item.phone}?text=Halo%20${encodeURIComponent(item.owner)},%20saya%20melihat%20usaha%20Anda%20di%20Portal%20Warga.%20Bisa%20tanya-tanya?`} target="_blank" rel="noopener noreferrer" className="mt-auto w-full bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 hover:bg-green-600 hover:text-white border border-green-200 dark:border-green-800 hover:border-green-600 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all active:scale-95">
                                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                            Hubungi Penjual
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {isFormOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="w-full max-w-lg rounded-3xl flex flex-col max-h-[90vh] modal-card animate-modal-in">
                                <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-green-50 dark:bg-slate-900 rounded-t-[32px]">
                                    <h2 className="text-2xl font-medium text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                        <Icon name="storefront" className="text-green-600" />
                                        {editingId ? 'Edit Data UMKM' : 'Tambah UMKM Baru'}
                                    </h2>
                                    <button onClick={() => setIsFormOpen(false)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-slate-200 dark:border-slate-700 transition-all">
                                        <Icon name="close" />
                                    </button>
                                </div>
                                <div className="p-6 sm:p-8 overflow-y-auto space-y-7">
                                    {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[13px] font-medium border border-red-100 flex items-center gap-2"><Icon name="error" /> {errorMsg}</div>}
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Usaha / Toko</label>
                                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700 dark:text-white" placeholder="Contoh: Warung Barokah" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Pemilik</label>
                                        <input type="text" value={formData.owner} onChange={e => setFormData({...formData, owner: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700 dark:text-white" placeholder="Contoh: Bpk. Budi" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nomor WhatsApp</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-500 dark:text-slate-400">+62</div>
                                            <input type="number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700 dark:text-white" placeholder="81234567890" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700 dark:text-white appearance-none bg-white dark:bg-slate-800">
                                            {categories.filter(c => c !== 'Semua').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Deskripsi Usaha</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700 dark:text-white resize-none" placeholder="Menjual berbagai macam kebutuhan..."></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Foto (Opsional)</label>
                                        <div className="border border-dashed border-slate-400 dark:border-slate-600 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative bg-white dark:bg-slate-800/40">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            {isUploading ? (
                                                <div className="flex flex-col items-center justify-center text-slate-500 py-4"><Icon name="sync" className="animate-spin text-[32px] mb-2 text-green-500" /><span className="font-medium">Memproses gambar...</span></div>
                                            ) : formData.imageUrl ? (
                                                <div className="relative inline-block">
                                                    <img src={formData.imageUrl} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                                                    <div className="absolute top-2 right-2 bg-slate-900/60 text-white text-[10px] px-2 py-1 rounded-md font-medium">Ganti</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-4"><Icon name="add_a_photo" className="text-[36px] mb-3 text-slate-400 dark:text-slate-500" /><span className="font-medium text-sm">Upload foto</span></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-800 flex gap-3 shrink-0 bg-slate-50 dark:bg-slate-950 rounded-b-[32px]">
                                    <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-200 font-medium py-4 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 bg-green-600 text-white font-medium py-4 rounded-full shadow-lg shadow-green-600/30 hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50">Simpan Data</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="max-w-sm w-full rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-5">
                                    <Icon name="warning" className="text-[40px] text-red-500" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 dark:text-white mb-2">Hapus UMKM?</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">Data usaha yang dihapus tidak dapat dikembalikan. Yakin?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full font-medium hover:bg-slate-200 dark:hover:bg-slate-700">Batal</button>
                                    <button onClick={() => {
                                        setUmkmData(umkmData.filter(item => item.id !== deleteConfirmId));
                                        setModalConfig && setModalConfig({ message: 'Data UMKM dihapus.' });
                                        setDeleteConfirmId(null);
                                    }} className="flex-1 py-3.5 bg-red-500 text-white rounded-full font-medium shadow-md hover:bg-red-600 active:scale-95">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        
        function Pengaduan({ laporanData, setLaporanData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [formData, setFormData] = useState({ title: '', category: 'Infrastruktur', description: '', reporter: '', imageUrl: '', status: 'Menunggu' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [filterStatus, setFilterStatus] = useState('Semua');
            // Deklarasi di atas agar dapat diakses oleh semua handler
            const [modalConfig, setModalConfig] = useState(null);

            const categories = ['Infrastruktur', 'Keamanan', 'Kebersihan', 'Sosial', 'Lainnya'];
            const statuses = ['Menunggu', 'Diproses', 'Selesai'];

            const handleSave = () => {
                if (!formData.title || !formData.description) return setErrorMsg("Judul dan Deskripsi wajib diisi!");
                const newLaporan = { id: Date.now(), date: new Date().toISOString(), ...formData };
                setLaporanData([newLaporan, ...(laporanData || [])]);
                setIsFormOpen(false);
                setFormData({ title: '', category: 'Infrastruktur', description: '', reporter: '', imageUrl: '', status: 'Menunggu' });
                setModalConfig && setModalConfig({ message: 'Laporan berhasil dikirim.' });
            };

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.6);
                    setFormData({ ...formData, imageUrl: url });
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const changeStatus = (id, newStatus) => {
                setLaporanData((laporanData || []).map(item => item.id === id ? { ...item, status: newStatus } : item));
            };

            const filteredData = (laporanData || []).filter(item => filterStatus === 'Semua' || item.status === filterStatus);

            const getStatusColor = (status) => {
                switch(status) {
                    case 'Menunggu': return 'bg-red-100 text-red-700 border-red-200';
                    case 'Diproses': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
                    case 'Selesai': return 'bg-green-100 text-green-700 border-green-200';
                    default: return 'bg-slate-100 text-slate-700 border-slate-200';
                }
            };

            const formatDate = (isoString) => {
                const date = new Date(isoString);
                return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            };

            return (
                <div className="animate-fade-in pb-24 w-full">
                    {modalConfig && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-2xl p-8 max-w-sm w-full text-center modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check_circle" className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 mb-2">Berhasil</h3>
                                <p className="text-slate-600 mb-8">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-4 rounded-full transition-all">Tutup</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 p-6 sm:p-10 rounded-3xl border border-blue-200/60 shadow-md shadow-blue-500/10 mb-8 relative overflow-hidden">
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 text-white rounded-xl mb-4 shadow-lg">
                                    <Icon name="campaign" />
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-medium text-slate-800 tracking-tight mb-2">Lapor</h1>
                                <p className="text-slate-600 text-[13px] sm:text-[14px] max-w-xl font-medium leading-relaxed">Sistem Pengaduan dan Aspirasi Warga. Laporkan keluhan atau berikan saran untuk lingkungan kita.</p>
                            </div>
                            <button onClick={() => setIsFormOpen(true)} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-full font-medium text-[13px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2 group">
                                <Icon name="add_circle" className="group-hover:rotate-90 transition-transform duration-300" /> Buat Laporan
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {['Semua', ...statuses].map(status => (
                            <button key={status} onClick={() => setFilterStatus(status)} className={`px-5 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all ${filterStatus === status ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                                {status}
                            </button>
                        ))}
                    </div>

                    {filteredData.length === 0 ? (
                        <div className="bg-white/80  rounded-3xl p-12 text-center border border-dashed border-slate-200 shadow-sm">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Icon name="task_alt" className="text-[48px] text-slate-300" />
                            </div>
                            <h3 className="text-xl font-medium text-slate-700 mb-2">Belum Ada Laporan</h3>
                            <p className="text-slate-500 font-medium">Lingkungan aman terkendali. Belum ada pengaduan warga.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredData.map(item => (
                                <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-medium">{item.category}</span>
                                            <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getStatusColor(item.status)}`}>{item.status}</span>
                                        </div>
                                        {userRole === 'admin' && (
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                                <Icon name="delete" className="text-[14px]" />
                                            </button>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-medium text-slate-800 mb-2">{item.title}</h3>
                                    <p className="text-slate-600 text-sm mb-4 leading-relaxed line-clamp-4">{item.description}</p>
                                    
                                    {item.imageUrl && (
                                        <div className="mb-4 rounded-lg overflow-hidden bg-slate-100 h-48 border border-slate-200">
                                            <img src={item.imageUrl} alt="Lampiran Laporan" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-slate-200 flex items-center justify-between text-xs font-medium text-slate-500">
                                        <div className="flex items-center gap-1.5"><Icon name="person" className="text-[14px]" /> {item.reporter || 'Warga'}</div>
                                        <div className="flex items-center gap-1.5"><Icon name="schedule" className="text-[14px]" /> {formatDate(item.date)}</div>
                                    </div>

                                    {userRole === 'admin' && (
                                        <div className="mt-4 flex gap-2">
                                            {statuses.map(st => (
                                                item.status !== st && (
                                                    <button key={st} onClick={() => changeStatus(item.id, st)} className={`flex-1 py-2 rounded-full text-xs font-medium border transition-colors ${st === 'Menunggu' ? 'border-red-200 text-red-600 hover:bg-red-50' : st === 'Diproses' ? 'border-yellow-200 text-yellow-600 hover:bg-yellow-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                                                        Set {st}
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {isFormOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="w-full max-w-lg rounded-3xl flex flex-col max-h-[90vh] modal-card animate-modal-in">
                                <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-blue-50 dark:bg-slate-900 rounded-t-[32px]">
                                    <h2 className="text-2xl font-medium text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                        <Icon name="campaign" className="text-blue-600" /> Buat Laporan
                                    </h2>
                                    <button onClick={() => setIsFormOpen(false)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-slate-200 dark:border-slate-700 transition-all"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 sm:p-8 overflow-y-auto space-y-7">
                                    {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[13px] font-medium border border-red-100 flex items-center gap-2"><Icon name="error" /> {errorMsg}</div>}
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Judul Laporan</label>
                                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white" placeholder="Cth: Lampu jalan mati di Blok A" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white appearance-none bg-white dark:bg-slate-800">
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Isi Laporan / Detail</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="4" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white resize-none" placeholder="Ceritakan detail masalah..."></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Pelapor (Opsional)</label>
                                        <input type="text" value={formData.reporter} onChange={e => setFormData({...formData, reporter: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white" placeholder="Kosongkan jika ingin anonim" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Lampiran Foto (Opsional)</label>
                                        <div className="border border-dashed border-slate-400 dark:border-slate-650 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative bg-white dark:bg-slate-800/40">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            {isUploading ? (
                                                <div className="flex flex-col items-center justify-center text-slate-500 py-4"><Icon name="sync" className="animate-spin text-[32px] mb-2 text-blue-500" /><span className="font-medium">Memproses gambar...</span></div>
                                            ) : formData.imageUrl ? (
                                                <div className="relative inline-block">
                                                    <img src={formData.imageUrl} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                                                    <div className="absolute top-2 right-2 bg-slate-900/60 text-white text-[10px] px-2 py-1 rounded-md font-medium">Ganti</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-4"><Icon name="add_a_photo" className="text-[36px] mb-3 text-slate-400 dark:text-slate-500" /><span className="font-medium text-sm">Upload foto bukti</span></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-800 flex gap-3 shrink-0 bg-slate-50 dark:bg-slate-950 rounded-b-[32px]">
                                    <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-200 font-medium py-4 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 bg-blue-600 text-white font-medium py-4 rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">Kirim Laporan</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="max-w-sm w-full rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-5"><Icon name="warning" className="text-[40px] text-red-500" /></div>
                                <h3 className="text-xl font-medium text-slate-800 dark:text-white mb-2">Hapus Laporan?</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">Laporan yang dihapus tidak dapat dikembalikan. Yakin?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full font-medium hover:bg-slate-200 dark:hover:bg-slate-700">Batal</button>
                                    <button onClick={() => {
                                        setLaporanData((laporanData || []).filter(item => item.id !== deleteConfirmId));
                                        setModalConfig && setModalConfig({ message: 'Laporan dihapus.' });
                                        setDeleteConfirmId(null);
                                    }} className="flex-1 py-3.5 bg-red-500 text-white rounded-full font-medium shadow-md hover:bg-red-600 active:scale-95">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function App() {

            

            
            // Inisialisasi langsung dari URL - link produk tiket / artikel blog bypass landing page
            const [isLoggedIn, setIsLoggedIn] = useState(() => {
                const p = new URLSearchParams(window.location.search);
                const isTicket = p.get('page') === 'tiket' && p.has('product');
                const isBlog = p.get('page') === 'blog' && p.has('article');
                return isTicket || isBlog;
            });
            const [userRoleInit] = useState(() => {
                const p = new URLSearchParams(window.location.search);
                const isTicket = p.get('page') === 'tiket' && p.has('product');
                const isBlog = p.get('page') === 'blog' && p.has('article');
                return (isTicket || isBlog) ? 'warga' : null;
            });
            const [isCheckingAuth, setIsCheckingAuth] = useState(true);
            const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

            useEffect(() => {
                const root = window.document.documentElement;
                if (theme === 'dark') {
                    root.classList.add('dark');
                    document.body.style.backgroundColor = '#0f172a';
                } else {
                    root.classList.remove('dark');
                    document.body.style.backgroundColor = '#f8fafc';
                }
                localStorage.setItem('theme', theme);
            }, [theme]);
            const [userRole, setUserRole] = useState(() => {
                const p = new URLSearchParams(window.location.search);
                const isTicket = p.get('page') === 'tiket' && p.has('product');
                const isBlog = p.get('page') === 'blog' && p.has('article');
                return (isTicket || isBlog) ? 'warga' : null;
            }); 
            const [activeTab, setActiveTab] = useState(() => {
                const p = new URLSearchParams(window.location.search);
                const isTicket = p.get('page') === 'tiket' && p.has('product');
                const isBlog = p.get('page') === 'blog' && p.has('article');
                if (isTicket) return 'tiket';
                if (isBlog) return 'blog';
                return 'menu';
            }); 
            const [showLogoutModal, setShowLogoutModal] = useState(false);
            const [showLicenseModal, setShowLicenseModal] = useState(false);
            const [isOffline, setIsOffline] = useState(!navigator.onLine); 
            
            // Core Database States
            const [members, setMembers, l1] = useFirebaseSync('members', []);
            const [currentRound, setCurrentRound, l2] = useFirebaseSync('round', 1);
            const [cycleNumber, setCycleNumber, l3] = useFirebaseSync('cycle', 1);
            const [arisanPeriod, setArisanPeriod, l4] = useFirebaseSync('period', () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
            const [jimpitanBalance, setJimpitanBalance, l5] = useFirebaseSync('jimpitan', 0);
            const [meetingHistory, setMeetingHistory, l6] = useFirebaseSync('history', []);
            const [kasRtBalance, setKasRtBalance, l7] = useFirebaseSync('kas_rt_balance', 0);
            const [kasRtTransactions, setKasRtTransactions, l8] = useFirebaseSync('kas_rt_trx', []);
            const [nominalArisan, setNominalArisan, l10] = useFirebaseSync('nominal_arisan', 10000);
            const [nominalJimpitan, setNominalJimpitan, l11] = useFirebaseSync('nominal_jimpitan', 10000);
            const [identity, setIdentity, l12] = useFirebaseSync('identity', { name: 'Aplikasi Arisan RT', subtitle: 'Wilayah Kependudukan Anda' });


            useEffect(() => {
                if (identity?.logoApp) {
                    let link = document.querySelector("link[rel~='icon']");
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = 'icon';
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    link.href = identity.logoApp;
                }
            }, [identity?.logoApp]);
            const [nextMeeting, setNextMeeting, l13] = useFirebaseSync('next_meeting', { date: 'Belum dijadwalkan', time: '-', location: '-', notes: '-' });
            const [informasi, setInformasi, l14] = useFirebaseSync('informasi', []);
            const [blogData, setBlogData] = useFirebaseArticlesSync(userRole === 'admin');
            const defaultLegal = {
                enabled: true,
                terms: "1. Akses Portal: Portal ini hanya diperuntukkan bagi warga lingkungan yang terdaftar sah. Dilarang membagikan akses login kepada pihak luar.\n2. Penggunaan Fitur: Warga dilarang menyalahgunakan fitur portal untuk menyebarkan hoaks, ujaran kebencian, atau pelanggaran hukum.\n3. Hak Admin: Admin (Pengurus Lingkungan) berhak memblokir akun warga yang terbukti melanggar aturan atau memalsukan data.\n4. Validitas Data: Warga bertanggung jawab penuh atas kebenaran data yang diunggah.",
                privacy: "1. Pengumpulan Data: Sistem mengumpulkan data (seperti Nama, NIK, Alamat) murni untuk keperluan administrasi rukun tetangga.\n2. Keamanan Data: Data disimpan di server cloud secara aman dengan sistem database modern.\n3. Anti Jual-Beli Data: Kami menjamin 100% bahwa data warga tidak akan pernah dijual atau diberikan ke pihak ketiga untuk tujuan komersial.\n4. Keterbukaan Data Kas: Informasi keuangan diproses secara transparan demi akuntabilitas lingkungan."
            };
            const [legalData, setLegalData, l_legal] = useFirebaseSync('legal', defaultLegal);
            const [showLegalModal, setShowLegalModal] = useState(null); // 'terms' | 'privacy' | null
            const [iuranData, setIuranData, l15] = useFirebaseSync('iuran_umum', []);
            const [galeriData, setGaleriData, l17] = useFirebaseSync('galeri_warga', []);
            const [umkmData, setUmkmData, l_umkm] = useFirebaseSync('umkm', []);
        const [laporanData, setLaporanData] = useFirebaseSync('laporan', []);
            const [inventarisData, setInventarisData, l18] = useFirebaseSync('inventaris_rt', []);
            const [bannerImage, setBannerImage, l19] = useFirebaseSync('banner_image', '');
            const [pinjamData, setPinjamData, l21] = useFirebaseSync('pinjam_inventaris', []);
            const [infaqData, setInfaqData, l22] = useFirebaseSync('infaq_data', []);
            const [musicData, setMusicData, l23] = useFirebaseSync('music_config', { url: '', name: '', enabled: true });
            const [tokoProducts, setTokoProducts, l_tokoProd] = useFirebaseSync('toko_products', []);
            const [tokoOrders, setTokoOrders, l_tokoOrd] = useFirebaseSync('toko_orders', []);
            
            const defaultLandingConfig = {
                servicesSubtitle: 'Layanan Utama Portal Kami',
                newsSubtitle: 'Informasi Lingkungan',
                newsTitle: 'KABAR WARGA & PENGUMUMAN',
                newsEmptyTitle: 'Belum Ada Pengumuman',
                newsEmptyDesc: 'Pengumuman penting dan kabar warga RT akan muncul di halaman ini.',
                blogSubtitle: 'Artikel & Konten Warga',
                blogTitle: 'BLOG WARGA RT',
                umkmSubtitle: 'Produk & Usaha Lokal',
                umkmTitle: 'UMKM WARGA RT',
                umkmEmptyTitle: 'Belum Ada UMKM Terdaftar',
                umkmEmptyDesc: 'Daftar usaha milik warga RT akan tampil di sini. Login sebagai Admin untuk menambahkan UMKM.',
                mapSubtitle: 'Cakupan Wilayah & Kontak Darurat',
                mapTitle: 'PETA DESA & LAYANAN',
                sponsorSubtitle: 'Didukung Oleh',
                footerInfoTitle: 'Informasi Layanan Digital Terverifikasi',
                footerInfoDesc: 'Layanan Resmi RT Pakem, Banyuanyar, Gurah, Kediri.',
                footerTagline: 'sistem informasi manajemen kerukunan lingkungan digital.',
                adsenseClientId: 'ca-pub-2636322336243340',
                whatsappGroupLink: ''
            };
            const [landingConfig, setLandingConfig, l_landing] = useFirebaseSync('landing_config', defaultLandingConfig);
            const [sponsorsData, setSponsorsData, l24] = useFirebaseSync('sponsors_data', { enabled: false, sponsors: [] });
            const [infoDesa, setInfoDesa, l25] = useFirebaseSync('info_desa', {
                enabled: true,
                batas: { utara: 'Desa Adan-adan', selatan: 'Desa Gurah', timur: 'Desa Tumpang', barat: 'Desa Sukorejo' },
                kontak: [
                    { id: 1, nama: 'Ambulans Siaga Desa', telepon: '0812-3456-7890', icon: 'local_hospital', color: 'red' },
                    { id: 2, nama: 'Kantor Balai Desa', telepon: '(0354) 689123', icon: 'business', color: 'slate' },
                    { id: 3, nama: 'Bhabinkamtibmas', telepon: '0821-4455-6677', icon: 'security', color: 'blue' },
                    { id: 4, nama: 'Babinsa Desa', telepon: '0857-8899-0011', icon: 'military_tech', color: 'green' }
                ]
            });
            const [ticketProducts, setTicketProducts, lTicketProducts] = useFirebaseSync('ticket_products', []);
            const [ticketOrders, setTicketOrders, lTicketOrders] = useFirebaseSync('ticket_orders', []);
            const [waRequests, setWaRequests, l_waRequests] = useFirebaseSync('wa_group_requests', []);

            // State khusus UI tambahan
            const [showPwaGuide, setShowPwaGuide] = useState(false);

            // Jika Firebase tidak tersedia (offline total / gagal init), anggap semua loaded
            const firebaseUnavailable = !db;
            const isAppReady = firebaseUnavailable || (l1 && l2 && l3 && l4 && l5 && l6 && l7 && l8 && l10 && l11 && l12 && l13 && l14 && l15 && l17 && l18 && l19 && l21 && l22 && l23 && l24 && l25 && l_tokoProd && l_tokoOrd && lTicketProducts && lTicketOrders && l_waRequests);


            useEffect(() => {
                if (auth && onAuthStateChanged) {
                    const unsubscribe = onAuthStateChanged(auth, (user) => {
                        if (user && user.uid === '7kGABJkj7APXHPtyVQUHQeoz0Cy1') {
                            setUserRole('admin');
                            setIsLoggedIn(true);
                            if (window.location.hash === '') if (sessionStorage.getItem('openInfaqId')) { window.location.hash = 'infaq'; } else { window.location.hash = 'menu'; }
                        }
                        setIsCheckingAuth(false);
                    });
                    return () => unsubscribe();
                } else {
                    setIsCheckingAuth(false);
                }
            }, []);

            useEffect(() => {
                const handleOnline = () => setIsOffline(false);
                const handleOffline = () => setIsOffline(true);
                window.addEventListener('online', handleOnline);
                window.addEventListener('offline', handleOffline);

                const handleAppInstalled = () => {
                    try { sessionStorage.setItem('pwa_banner_dismissed', '1'); } catch(e) {}
                };
                window.addEventListener('appinstalled', handleAppInstalled);
                
                const handleHashChange = () => {
                    const hash = window.location.hash.replace('#', '');
                    if (hash) {
                        setActiveTab(hash);
                    }
                };
                window.addEventListener('hashchange', handleHashChange);
                
                const p = new URLSearchParams(window.location.search);
                const hasNocache = p.has('nocache');
                const hasV = p.has('v');
                const hasPage = p.has('page');
                
                if (p.get('page') === 'toko' && p.has('product')) {
                    sessionStorage.setItem('openTokoProductId', p.get('product'));
                    setIsLoggedIn(true);
                    setUserRole('warga');
                    setActiveTab('toko');
                    window.location.hash = 'toko';
                }
                
                if (hasNocache || hasV || hasPage) {
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('nocache');
                    cleanUrl.searchParams.delete('v');
                    cleanUrl.searchParams.delete('page');
                    cleanUrl.searchParams.delete('product');
                    window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
                }
                
                // Cek awal hash
                if (window.location.hash) {
                    handleHashChange();
                }
                
                return () => {
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                    window.removeEventListener('appinstalled', handleAppInstalled);
                    window.removeEventListener('hashchange', handleHashChange);
                };
            }, []);

            useEffect(() => {
                const clientId = landingConfig?.adsenseClientId || 'ca-pub-2636322336243340';
                if (clientId) {
                    const injectScript = () => {
                        const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
                        if (!existingScript) {
                            const script = document.createElement('script');
                            script.async = true;
                            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
                            script.crossOrigin = 'anonymous';
                            document.head.appendChild(script);
                        }
                    };

                    // Defer loading to improve initial load time (FCP/LCP)
                    if (window.requestIdleCallback) {
                        const idleId = window.requestIdleCallback(() => {
                            setTimeout(injectScript, 2500);
                        });
                        return () => window.cancelIdleCallback(idleId);
                    } else {
                        const timeoutId = setTimeout(injectScript, 3500);
                        return () => clearTimeout(timeoutId);
                    }
                }
            }, [landingConfig?.adsenseClientId]);

            const changeTab = (tabId) => { 
                window.scrollTo({ top: 0, behavior: 'smooth' });
                window.location.hash = tabId; 
            };

            const SpinnerComponent = (
                <div className="fixed inset-0 z-[999] flex justify-center items-center modal-backdrop animate-backdrop-in">
                    <div className="p-8 sm:p-10 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center max-w-[300px] max-w-full w-[90%] relative overflow-hidden modal-card animate-modal-in">
                        <div className="flex h-2 w-full absolute top-0 left-0">
                            <div className="w-1/4 bg-google-blue"></div>
                            <div className="w-1/4 bg-google-red"></div>
                            <div className="w-1/4 bg-google-yellow"></div>
                            <div className="w-1/4 bg-google-green"></div>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4 mb-6 h-8">
                            <div className="w-4 h-4 rounded-full bg-google-blue animate-bounce" style={{ animationDelay: '0s', animationDuration: '0.9s' }}></div>
                            <div className="w-4 h-4 rounded-full bg-google-red animate-bounce" style={{ animationDelay: '0.15s', animationDuration: '0.9s' }}></div>
                            <div className="w-4 h-4 rounded-full bg-google-yellow animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.9s' }}></div>
                            <div className="w-4 h-4 rounded-full bg-google-green animate-bounce" style={{ animationDelay: '0.45s', animationDuration: '0.9s' }}></div>
                        </div>
                        <h2 className="text-google-text font-medium text-[16px] mb-3 tracking-tight text-center">Memuat Portal</h2>
                        <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                            <div className="w-2 h-2 bg-google-blue rounded-full animate-pulse"></div>
                            <p className="text-[9px] font-medium text-google-textVariant uppercase tracking-widest">Sinkronisasi Data</p>
                        </div>
                    </div>
                </div>
            );

            if (isCheckingAuth) {
                return SpinnerComponent;
            }

            if (!isLoggedIn) {
                if (!firebaseUnavailable && (!l12 || !l_legal)) {
                    return SpinnerComponent;
                }
                return (
                    <>
                        <LoginScreen theme={theme} setTheme={setTheme} legalData={legalData} setShowLegalModal={setShowLegalModal} setShowLicenseModal={setShowLicenseModal} informasi={informasi} blogData={blogData} bannerImage={bannerImage} sponsorsData={sponsorsData} members={members} umkmData={umkmData} infoDesa={infoDesa} landingConfig={landingConfig} nextMeeting={nextMeeting} cycleNumber={cycleNumber} infaqData={infaqData} tokoProducts={tokoProducts} onLogin={(role) => { 
                            setIsLoggedIn(true); setUserRole(role); 
                            const params = new URLSearchParams(window.location.search);
                            if (params.get('page') === 'tiket') {
                                window.location.hash = 'tiket';
                            } else if (sessionStorage.getItem('openTokoProductId') || sessionStorage.getItem('addToCartProductId')) {
                                window.location.hash = 'toko';
                            } else if (sessionStorage.getItem('openTab')) {
                                window.location.hash = sessionStorage.getItem('openTab');
                                sessionStorage.removeItem('openTab');
                            } else {
                                if (sessionStorage.getItem('openInfaqId')) { window.location.hash = 'infaq'; } else { window.location.hash = 'menu'; }
                            }
                            // Bersihkan URL dari query params tanpa reload
                            const cleanUrl = new URL(window.location.href);
                            cleanUrl.searchParams.delete('page');
                            cleanUrl.searchParams.delete('product');
                            window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
                        }} identity={identity} setShowPwaGuide={setShowPwaGuide} />
                        <React.Suspense fallback={null}>
                            <RobotGuide userRole={userRole} nominalArisan={nominalArisan} nominalJimpitan={nominalJimpitan} identity={identity} members={members} arisanPeriod={arisanPeriod} currentRound={currentRound} cycleNumber={cycleNumber} jimpitanBalance={jimpitanBalance} kasRtBalance={kasRtBalance} meetingHistory={meetingHistory} inventarisData={inventarisData} pinjamData={pinjamData} infaqData={infaqData} />
                        </React.Suspense>
                        {showPwaGuide && <PwaGuideModal onClose={() => setShowPwaGuide(false)} />}
                        {showLegalModal && (
                        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4 animate-fade-in modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200/50 max-h-[80vh] modal-card animate-modal-in">
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
                                    <h3 className="text-[14px] font-medium text-slate-800 flex items-center gap-2">
                                        <Icon name={showLegalModal === 'terms' ? 'gavel' : 'privacy_tip'} className="text-google-blue" /> 
                                        {showLegalModal === 'terms' ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'}
                                    </h3>
                                    <button onClick={() => setShowLegalModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar">
                                    <div className="prose prose-sm text-slate-600 text-justify leading-relaxed whitespace-pre-wrap">
                                        {showLegalModal === 'terms' ? legalData?.terms : legalData?.privacy}
                                    </div>
                                </div>
                                <div className="p-4 border-t border-slate-200 shrink-0">
                                    <button onClick={() => setShowLegalModal(null)} className="w-full bg-google-blue hover:bg-google-blueDark text-white py-3.5 rounded-full font-medium text-[13px] transition-colors active:scale-95">Tutup & Lanjutkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {showLicenseModal && (
                        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4 animate-fade-in modal-backdrop animate-backdrop-in">
                            <div className="rounded-2xl w-full max-w-lg overflow-hidden border border-red-500/30 dark:border-red-950/40 flex flex-col max-h-[85vh] modal-card animate-modal-in">
                                <div className="bg-red-50 dark:bg-red-950/20 px-6 py-5 border-b border-red-500/20 dark:border-red-900/30 flex items-center justify-between shrink-0">
                                    <h3 className="text-[14px] font-medium text-red-700 dark:text-red-400 flex items-center gap-2"><Icon name="verified_user" /> KEAMANAN DATA & LISENSI</h3>
                                    <button onClick={() => setShowLicenseModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition-colors"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 md:p-8 overflow-y-auto hide-scrollbar">
                                    <div className="prose prose-sm text-slate-600 dark:text-slate-350 text-justify leading-relaxed max-w-none">
                                        <p className="font-medium text-slate-800 dark:text-slate-200 text-[13px] mb-3">Website ini <span className="text-red-600 uppercase underline decoration-red-300 underline-offset-4">tidak diperjualbelikan</span>.</p>
                                        <p className="mb-3">Seluruh data di dalam sistem ini dilindungi secara ketat dan dikelola secara eksklusif oleh Admin Lingkungan.</p>
                                        <p className="mb-4 text-red-600 font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30-100">Segala bentuk pencurian data, penyalahgunaan akses, atau tindak kriminal digital lainnya akan ditelusuri dan <span className="underline underline-offset-2 decoration-red-400">dilaporkan kepada pihak yang berwajib</span> sesuai perundang-undangan yang berlaku.</p>
                                        <p className="mb-6">Sistem ini diperuntukkan khusus untuk keperluan digitalisasi guna menunjang tata kelola lingkungan desa yang transparan dan akuntabel.</p>
                                        
                                        <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-4 text-center">
                                            <p className="text-[11px] font-medium text-slate-400 mb-1">COPYRIGHT &copy; 2026</p>
                                            <p className="text-[10px] text-slate-400 mb-2">Sistem & lisensi ditandatangani secara digital oleh pengembang resmi:</p>
                                            <p className="text-[16px] font-medium tracking-widest text-google-red uppercase">Novan Restu Utomo</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 md:px-8 md:pb-8 pt-0 shrink-0">
                                    <button onClick={() => setShowLicenseModal(false)} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-4 rounded-full font-medium text-[13px] transition-colors active:scale-95">Saya Mengerti</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <ToastContainer />
                    </>
                );
            }

            const executeLogout = () => {
                if (auth && signOut && userRole === 'admin') {
                    signOut(auth).then(() => {
                        setIsLoggedIn(false); setUserRole(null); setActiveTab('menu'); 
                        window.history.replaceState({}, document.title, window.location.pathname);
                        setShowLogoutModal(false);
                    }).catch(console.error);
                } else {
                    setIsLoggedIn(false); setUserRole(null); setActiveTab('menu'); 
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setShowLogoutModal(false);
                }
            };

            const NavItems = [
                { id: 'dashboard', icon: 'dashboard', label: 'Ringkasan', bg: 'bg-google-blueLight', color: 'text-google-blueDark border border-google-blue' },
                { id: 'informasi', icon: 'campaign', label: 'Info Warga', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border border-google-yellow' },
                { id: 'warga', icon: 'group', label: 'Buku Warga', bg: 'bg-google-greenLight', color: 'text-google-greenDark border border-google-green' },
                { id: 'galery', icon: 'photo_library', label: 'Galeri', bg: 'bg-slate-100', color: 'text-google-text border border-slate-400' },
                { id: 'inventaris', icon: 'inventory_2', label: 'Inventaris', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border border-google-yellow' },
                { id: 'umkm', icon: 'storefront', label: 'UMKM Warga', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border border-google-yellow' },
                { id: 'toko', icon: 'local_mall', label: 'Official Store', bg: 'bg-google-greenLight', color: 'text-google-greenDark border border-google-green' },
                { id: 'pengaduan', icon: 'report_problem', label: 'Lapor', bg: 'bg-blue-100', color: 'text-blue-700 border border-blue-500' },
                { id: 'blog', icon: 'article', label: 'Blog Warga', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border border-google-yellow' },
                { id: 'pinjam', icon: 'handshake', label: 'Pinjam Inventaris', bg: 'bg-google-greenLight', color: 'text-google-greenDark border border-google-green' },
                { id: 'iuran', icon: 'volunteer_activism', label: 'Iuran Umum', bg: 'bg-google-redLight', color: 'text-google-redDark border border-google-red' },
                { id: 'kas', icon: 'account_balance_wallet', label: 'Kas Warga', bg: 'bg-google-blueLight', color: 'text-google-blueDark border border-google-blue' },
                { id: 'tiket', icon: 'local_activity', label: 'Beli Tiket', bg: 'bg-google-blueLight', color: 'text-google-blueDark border border-google-blue' },
                { id: 'laporan', icon: 'history', label: 'Arsip Riwayat', bg: 'bg-slate-100', color: 'text-google-text border border-slate-400' },
                { id: 'infaq', icon: 'volunteer_activism', label: 'Infaq', bg: 'bg-google-greenLight', color: 'text-google-greenDark border border-google-green' },
                { id: 'pemenang', icon: 'emoji_events', label: 'Pemenang', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border border-google-yellow' },
                { id: 'kegiatan', icon: 'event', label: 'Jadwal', bg: 'bg-google-blueLight', color: 'text-google-blueDark border border-google-blue' },
                { id: 'kalender', icon: 'calendar_month', label: 'Kalender', bg: 'bg-google-redLight', color: 'text-google-redDark border border-google-red' },
                { id: 'peta', icon: 'map', label: 'Peta Lokasi', bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700' },
                { id: 'wagroup', icon: 'forum', label: 'Grup WA', bg: 'bg-google-greenLight', color: 'text-google-greenDark border border-google-green' },
                ...(userRole === 'admin' ? [
                    { id: 'pertemuan', icon: 'checklist', label: 'Absen Arisan', bg: 'bg-google-greenLight', color: 'text-google-greenDark border border-google-green' },
                    { id: 'musik', icon: 'music_note', label: 'Musik Warga', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border border-google-yellow' },
                    { id: 'pengaturan', icon: 'settings', label: 'Setelan Admin', bg: 'bg-slate-100', color: 'text-google-text border border-slate-400' }
                ] : [])
            ];

            const renderContent = () => {
                switch(activeTab) {
                    case 'menu': return <MainMenu userRole={userRole} NavItems={NavItems} changeTab={changeTab} identity={identity} bannerImage={bannerImage} setShowPwaGuide={setShowPwaGuide} sponsorsData={sponsorsData} nextMeeting={nextMeeting} />;
                    case 'dashboard': return <Dashboard members={members} setMembers={setMembers} jimpitanBalance={jimpitanBalance} kasRtBalance={kasRtBalance} currentRound={currentRound} setCurrentRound={setCurrentRound} userRole={userRole} cycleNumber={cycleNumber} setCycleNumber={setCycleNumber} changeTab={changeTab} arisanPeriod={arisanPeriod} />;
                    case 'informasi': return <Informasi data={informasi} setData={setInformasi} userRole={userRole} />;
                    case 'blog': return <Blog blogData={blogData} setBlogData={setBlogData} userRole={userRole} identity={identity} initialArticleId={new URLSearchParams(window.location.search).get('article')} />;
                    case 'warga': return <WargaList members={members} setMembers={setMembers} userRole={userRole} identity={identity} cycleNumber={cycleNumber} currentRound={currentRound} arisanPeriod={arisanPeriod} />;
                    case 'galery': return <Galeri data={galeriData} setData={setGaleriData} userRole={userRole} />;
                    case 'inventaris': return <Inventaris data={inventarisData} setData={setInventarisData} userRole={userRole} pinjamData={pinjamData} />;
                    case 'umkm': return <Umkm umkmData={umkmData} setUmkmData={setUmkmData} userRole={userRole} />;
                    case 'toko': return <Toko tokoProducts={tokoProducts} setTokoProducts={setTokoProducts} tokoOrders={tokoOrders} setTokoOrders={setTokoOrders} userRole={userRole} identity={identity} changeTab={changeTab} />;
                    case 'pengaduan': return <Pengaduan laporanData={laporanData} setLaporanData={setLaporanData} userRole={userRole} />;
                    case 'pinjam': return <PinjamInventaris inventarisData={inventarisData} setInventarisData={setInventarisData} pinjamData={pinjamData} setPinjamData={setPinjamData} members={members} userRole={userRole} />;
                    case 'iuran': return <IuranUmum iuranData={iuranData} setIuranData={setIuranData} members={members} userRole={userRole} kasRtBalance={kasRtBalance} setKasRtBalance={setKasRtBalance} kasRtTransactions={kasRtTransactions} setKasRtTransactions={setKasRtTransactions} identity={identity} />;
                    case 'kas': return <BukuKas balance={kasRtBalance} setBalance={setKasRtBalance} transactions={kasRtTransactions} setTransactions={setKasRtTransactions} userRole={userRole} identity={identity} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} />;
                    case 'tiket': return <Tiket products={ticketProducts} setProducts={setTicketProducts} orders={ticketOrders} setOrders={setTicketOrders} userRole={userRole} identity={identity} isProductsLoaded={lTicketProducts} />;
                    case 'laporan': return <Laporan history={meetingHistory} setMeetingHistory={setMeetingHistory} members={members} setMembers={setMembers} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} nominalArisan={nominalArisan} nominalJimpitan={nominalJimpitan} cycleNumber={cycleNumber} identity={identity} userRole={userRole} />;
                    case 'pertemuan': return userRole === 'admin' ? <Pertemuan members={members} setMembers={setMembers} currentRound={currentRound} setCurrentRound={setCurrentRound} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} setMeetingHistory={setMeetingHistory} onFinish={() => changeTab('menu')} nominalArisan={nominalArisan} nominalJimpitan={nominalJimpitan} arisanPeriod={arisanPeriod} setArisanPeriod={setArisanPeriod} identity={identity} cycleNumber={cycleNumber} /> : null;
                    case 'pengaturan': return userRole === 'admin' ? <Pengaturan nominalArisan={nominalArisan} setNominalArisan={setNominalArisan} nominalJimpitan={nominalJimpitan} setNominalJimpitan={setNominalJimpitan} identity={identity} setIdentity={setIdentity} setMembers={setMembers} setMeetingHistory={setMeetingHistory} currentRound={currentRound} setCurrentRound={setCurrentRound} cycleNumber={cycleNumber} setCycleNumber={setCycleNumber} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} kasRtBalance={kasRtBalance} setKasRtBalance={setKasRtBalance} kasRtTransactions={kasRtTransactions} setKasRtTransactions={setKasRtTransactions} arisanPeriod={arisanPeriod} setArisanPeriod={setArisanPeriod} bannerImage={bannerImage} setBannerImage={setBannerImage} setIuranData={setIuranData} setGaleriData={setGaleriData} setInventarisData={setInventarisData} setInformasi={setInformasi} setNextMeeting={setNextMeeting} sponsorsData={sponsorsData} setSponsorsData={setSponsorsData} infoDesa={infoDesa} setInfoDesa={setInfoDesa} legalData={legalData} setLegalData={setLegalData} landingConfig={landingConfig} setLandingConfig={setLandingConfig} /> : null;
                    case 'infaq': return <Infaq infaqData={infaqData} setInfaqData={setInfaqData} userRole={userRole} identity={identity} />;
                    case 'pemenang': return <Pemenang members={members} />;
                    case 'kegiatan': return <Kegiatan nextMeeting={nextMeeting} setNextMeeting={setNextMeeting} userRole={userRole} />;
                    case 'kalender': return <Kalender />;
                    case 'peta': return <PetaDesa infoDesa={infoDesa} />;
                    case 'musik': return userRole === 'admin' ? <MusicAdmin musicData={musicData} setMusicData={setMusicData} /> : null;
                    case 'wagroup': return <WaGroup requests={waRequests} setRequests={setWaRequests} userRole={userRole} inviteLink={landingConfig.whatsappGroupLink || ''} />;
                    default: return <MainMenu userRole={userRole} NavItems={NavItems} changeTab={changeTab} identity={identity} sponsorsData={sponsorsData} nextMeeting={nextMeeting} />;
                }
            };

            const activeTabTitle = NavItems.find(i => i.id === activeTab)?.label || identity.name;

            return (
                <div className="min-h-screen bg-transparent print:bg-white font-sans text-google-text flex flex-col relative">
                    <FlagWavingBackground theme={theme} />


                    {/* ANIMASI WAYANG KULIT GLOBAL (DASHBOARD) */}
                    <div className="fixed bottom-0 sm:bottom-4 -left-4 sm:left-4 z-0 pointer-events-none opacity-80 dark:opacity-60 transition-all duration-1000 no-print scale-x-[-1]">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kiri" className="w-64 sm:w-80 h-auto max-h-[35vh] object-contain object-bottom animate-wayang dark:invert drop-shadow-2xl" loading="lazy" />
                    </div>
                    <div className="fixed bottom-0 sm:bottom-4 -right-4 sm:right-4 z-0 pointer-events-none opacity-80 dark:opacity-60 transition-all duration-1000 no-print">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kanan" className="w-64 sm:w-80 h-auto max-h-[35vh] object-contain object-bottom animate-wayang dark:invert drop-shadow-2xl" loading="lazy" style={{ animationDelay: '1.5s' }} />
                    </div>

                    <div className="sticky top-0 z-40 no-print w-full">
                        {isOffline && (
                            <div className="bg-google-redDark text-white text-center py-2.5 px-4 text-[12px] font-medium flex flex-wrap items-center justify-center gap-2 w-full shadow-md">
                                <Icon name="wifi_off" className="text-[16px]" /> Koneksi terputus. Anda masuk ke mode offline.
                            </div>
                        )}

                        <header className="bg-white/95 text-google-text py-3 px-3 sm:py-4 sm:px-6 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-7xl mx-auto mt-4 sm:mt-6 rounded-2xl sm:rounded-3xl border border-red-500/20 shadow-lg shadow-red-500/10 relative z-20 overflow-hidden">
                            {/* ORNAMEN JOGLO - watermark di bawah tengah header */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 sm:w-32 pointer-events-none opacity-20 dark:opacity-10">
                                <img src="./joglo_transparent.png?v=2" alt="Ornamen Joglo" className="w-full h-auto" />
                            </div>
                            <div className="max-w-7xl mx-auto flex items-center justify-between">
                                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                                    {activeTab === 'menu' ? (
                                        <div className="bg-google-red text-white w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 flex justify-center items-center shadow-md shadow-red-500/20 border border-red-400/40"><Icon name="home" className="text-[15px] sm:text-[17px]" fill="true" /></div>
                                    ) : (
                                        <button onClick={() => changeTab('menu')} className="w-9 h-9 sm:w-10 sm:h-10 bg-white text-google-text border border-slate-200 hover:text-red-600 hover:border-red-500/40 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[15px] sm:text-[17px]" /></button>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                                        <h1 className="text-[13px] sm:text-[16px] font-medium truncate leading-tight tracking-tight text-slate-800">{activeTab === 'menu' ? identity.name : activeTabTitle}</h1>
                                        {activeTab === 'menu' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0"></span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 pl-1.5">
                                    <span className={`text-[8px] sm:text-[9px] font-medium px-2 py-1 sm:px-3 py-1.5 rounded-md uppercase tracking-widest border ${userRole === 'admin' ? 'bg-red-50 text-red-700 border-red-500/30' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{userRole === 'admin' ? 'Admin' : 'Warga'}</span>
                                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-50 hover:bg-slate-200 text-slate-600 rounded-full flex justify-center items-center transition-all duration-300 active:scale-95 border border-slate-200 shadow-sm" title="Toggle Tema"><Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[15px] sm:text-[16px]" /></button>
                                    <button onClick={() => setShowLogoutModal(true)} className="w-9 h-9 sm:w-10 sm:h-10 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex justify-center items-center transition-all duration-300 active:scale-95 border border-red-500/30 shadow-sm"><Icon name="logout" className="text-[15px] sm:text-[16px]" /></button>
                                </div>
                            </div>
                        </header>
                    </div>

                    <main className="flex-1 w-full pt-5 md:pt-8 pb-40 print:pb-0 print:pt-0">
                        <div key={activeTab} className="max-w-7xl mx-auto px-4 sm:px-6 tab-fade-in pb-10">
                            {renderContent()}
                        </div>
                    </main>

                    <footer className="w-full text-center py-8 no-print border-t border-red-500/20 bg-white text-[12.5px] font-medium text-slate-500">
                        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                            <p className="flex flex-wrap items-center gap-1.5 justify-center">
                                <Icon name="flag" className="text-red-500 text-[14px] animate-pulse" fill="true" />
                                - {new Date().getFullYear()} <span className="text-red-600 font-medium">WP LINGKUNGAN</span>. All rights reserved.
                            </p>
                            <button onClick={() => setShowLicenseModal(true)} className="flex flex-wrap items-center justify-center gap-1.5 hover:text-red-500 transition-colors active:scale-95 group">
                                <Icon name="lock" className="text-[13px] group-hover:scale-110 transition-transform" /> <span className="underline decoration-dashed underline-offset-4">&copy; 2026 Keamanan Data & Hak Cipta</span>
                            </button>
                        </div>
                    </footer>
{legalData?.enabled && (
                        <div className="w-full text-center pb-6 no-print bg-white">
                            <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-medium text-google-blue">
                                <button onClick={() => setShowLegalModal('terms')} className="hover:underline">Syarat & Ketentuan</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={() => setShowLegalModal('privacy')} className="hover:underline">Kebijakan Privasi</button>
                            </div>
                        </div>
                    )}
                    


                    <React.Suspense fallback={null}>
                        <RobotGuide userRole={userRole} nominalArisan={nominalArisan} nominalJimpitan={nominalJimpitan} identity={identity} members={members} arisanPeriod={arisanPeriod} currentRound={currentRound} cycleNumber={cycleNumber} jimpitanBalance={jimpitanBalance} kasRtBalance={kasRtBalance} meetingHistory={meetingHistory} inventarisData={inventarisData} pinjamData={pinjamData} infaqData={infaqData} />
                    </React.Suspense>
                    <PWAInstallBanner />
                    {showLicenseModal && (
                        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4 animate-fade-in modal-backdrop animate-backdrop-in">
                            <div className="rounded-2xl w-full max-w-lg overflow-hidden border border-red-500/30 dark:border-red-950/40 flex flex-col max-h-[85vh] modal-card animate-modal-in">
                                <div className="bg-red-50 dark:bg-red-950/20 px-6 py-5 border-b border-red-500/20 dark:border-red-900/30 flex items-center justify-between shrink-0">
                                    <h3 className="text-[14px] font-medium text-red-700 dark:text-red-400 flex items-center gap-2"><Icon name="verified_user" /> KEAMANAN DATA & LISENSI</h3>
                                    <button onClick={() => setShowLicenseModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition-colors"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 md:p-8 overflow-y-auto hide-scrollbar">
                                    <div className="prose prose-sm text-slate-600 dark:text-slate-350 text-justify leading-relaxed max-w-none">
                                        <p className="font-medium text-slate-800 dark:text-slate-200 text-[13px] mb-3">Website ini <span className="text-red-600 uppercase underline decoration-red-300 underline-offset-4">tidak diperjualbelikan</span>.</p>
                                        <p className="mb-3">Seluruh data di dalam sistem ini dilindungi secara ketat dan dikelola secara eksklusif oleh Admin Lingkungan.</p>
                                        <p className="mb-4 text-red-600 font-medium bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30-100">Segala bentuk pencurian data, penyalahgunaan akses, atau tindak kriminal digital lainnya akan ditelusuri dan <span className="underline underline-offset-2 decoration-red-400">dilaporkan kepada pihak yang berwajib</span> sesuai perundang-undangan yang berlaku.</p>
                                        <p className="mb-6">Sistem ini diperuntukkan khusus untuk keperluan digitalisasi guna menunjang tata kelola lingkungan desa yang transparan dan akuntabel.</p>
                                        
                                        <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-4 text-center">
                                            <p className="text-[11px] font-medium text-slate-400 mb-1">COPYRIGHT &copy; 2026</p>
                                            <p className="text-[10px] text-slate-400 mb-2">Sistem & lisensi ditandatangani secara digital oleh pengembang resmi:</p>
                                            <p className="text-[16px] font-medium tracking-widest text-google-red uppercase">Novan Restu Utomo</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 md:px-8 md:pb-8 pt-0 shrink-0">
                                    <button onClick={() => setShowLicenseModal(false)} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-4 rounded-full font-medium text-[13px] transition-colors active:scale-95">Saya Mengerti</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {showLegalModal && (
                        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4 animate-fade-in modal-backdrop animate-backdrop-in">
                            <div className="rounded-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200/50 dark:border-slate-850 max-h-[85vh] modal-card animate-modal-in">
                                <div className="bg-slate-50 dark:bg-slate-950 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                                    <h3 className="text-[14px] font-medium text-slate-800 dark:text-white flex items-center gap-2">
                                        <Icon name={showLegalModal === 'terms' ? 'gavel' : 'privacy_tip'} className="text-google-blue" /> 
                                        {showLegalModal === 'terms' ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'}
                                    </h3>
                                    <button onClick={() => setShowLegalModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar">
                                    <div className="prose prose-sm text-slate-600 dark:text-slate-300 text-justify leading-relaxed whitespace-pre-wrap">
                                        {showLegalModal === 'terms' ? legalData?.terms : legalData?.privacy}
                                    </div>
                                </div>
                                <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
                                    <button onClick={() => setShowLegalModal(null)} className="w-full bg-google-blue hover:bg-google-blueDark text-white py-3.5 rounded-full font-medium text-[13px] transition-colors active:scale-95">Tutup & Lanjutkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <ToastContainer />
                    {/* Floating Music Player - hanya untuk warga */}
                    {userRole === 'warga' && musicData?.url && musicData?.enabled && <FloatingMusicPlayer musicData={musicData} />}

                    {showPwaGuide && <PwaGuideModal onClose={() => setShowPwaGuide(false)} />}

                    {showLogoutModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 w-full max-w-sm text-center modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight dark:bg-red-950/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30 dark:border-red-900/20"><Icon name="logout" className="text-[40px] text-google-red" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text dark:text-white mb-2">Keluar Sesi?</h3>
                                <p className="text-[13px] text-google-textVariant dark:text-slate-300 mb-8 leading-relaxed font-medium">Sesi portal akan diakhiri. Anda akan kembali ke layar otorisasi.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setShowLogoutModal(false)} className="w-full sm:w-auto bg-white dark:bg-slate-800 text-google-text dark:text-slate-200 py-3.5 px-6 rounded-full font-medium text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all shadow-sm">Batal</button>
                                    <button onClick={executeLogout} className="flex-1 bg-google-red text-white py-3.5 px-6 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-redDark border border-google-redDark active:scale-95 transition-all">Ya, Keluar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        /* ================= COMPONENTS (VIEWS) ================= */

        function PwaGuideModal({ onClose }) {
            const [tab, setTab] = useState('android');
            return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                    <div className="rounded-3xl w-full max-w-xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 dark:border-slate-700 modal-card animate-modal-in" style={{ animation: 'slideUp 0.3s ease-out' }}>
                        <div className="p-6 sm:p-8 md:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-[30px]">
                            <h3 className="text-xl font-medium text-google-text dark:text-white flex flex-wrap items-center gap-2"><Icon name="install_mobile" className="text-google-blue" /> Panduan Install Aplikasi</h3>
                            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-google-text dark:hover:text-white transition-all active:scale-95"><Icon name="close" /></button>
                        </div>
                        <div className="p-6 sm:p-8 md:p-6 overflow-y-auto flex-1">
                            <p className="text-[13px] text-google-textVariant dark:text-slate-300 mb-6 font-medium">Aplikasi ini bisa diinstal langsung ke perangkat Anda (Android, iOS, maupun PC/Laptop) tanpa melalui App Store atau Play Store. Hemat memori dan cepat!</p>
                            
                            <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl mb-6 border border-slate-200 dark:border-slate-850 shadow-inner">
                                <button onClick={() => setTab('android')} className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'android' ? 'bg-white dark:bg-slate-900 text-google-blue border border-google-blue/30 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}><Icon name="android" className="text-[16px]" /> Android</button>
                                <button onClick={() => setTab('ios')} className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'ios' ? 'bg-white dark:bg-slate-900 text-google-text dark:text-white border border-slate-400 dark:border-slate-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}><Icon name="apple" className="text-[16px]" /> iOS</button>
                                <button onClick={() => setTab('pc')} className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'pc' ? 'bg-white dark:bg-slate-900 text-google-blue border border-google-blue/30 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}><Icon name="laptop_mac" className="text-[16px]" /> PC/Laptop</button>
                            </div>

                            {tab === 'android' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <h4 className="font-medium text-google-text dark:text-white text-[13px]">Pengguna Google Chrome</h4>
                                    <ol className="list-decimal pl-5 space-y-5 text-[13px] text-google-textVariant dark:text-slate-300 font-medium">
                                        <li>Buka website ini di browser <b>Google Chrome</b>.</li>
                                        <li>Tunggu beberapa detik, akan muncul banner <b>"Pasang Aplikasi Ini"</b> di bagian bawah layar. Klik tombol <b>Install</b>.</li>
                                        <li>Atau, klik ikon <b>titik tiga</b> (G) di pojok kanan atas browser.</li>
                                        <li>Pilih menu <b>"Tambahkan ke Layar Utama"</b> (Add to Home screen) atau <b>"Instal Aplikasi"</b>.</li>
                                        <li>Klik <b>Instal</b> pada pop-up yang muncul. Aplikasi siap digunakan!</li>
                                    </ol>
                                </div>
                            )}

                            {tab === 'ios' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <h4 className="font-medium text-google-text dark:text-white text-[13px]">Pengguna iPhone & iPad (Safari)</h4>
                                    <ol className="list-decimal pl-5 space-y-5 text-[13px] text-google-textVariant dark:text-slate-300 font-medium">
                                        <li>Buka website ini menggunakan browser <b>Safari</b> (wajib).</li>
                                        <li>Ketuk ikon <b>Bagikan</b> <Icon name="ios_share" className="text-[14px] inline text-google-blue" /> (kotak dengan panah ke atas) di bagian bawah layar.</li>
                                        <li>Geser menu ke atas atau ke samping, cari dan ketuk <b>"Tambah ke Layar Utama"</b> (Add to Home Screen) <Icon name="add_box" className="text-[14px] inline text-slate-500" />.</li>
                                        <li>Ketuk tombol <b>Tambah</b> di pojok kanan atas.</li>
                                        <li>Aplikasi kini ada di daftar aplikasi Anda dan siap digunakan!</li>
                                    </ol>
                                </div>
                            )}

                            {tab === 'pc' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <h4 className="font-medium text-google-text dark:text-white text-[13px]">Pengguna PC/Laptop (Chrome / Edge)</h4>
                                    <ol className="list-decimal pl-5 space-y-5 text-[13px] text-google-textVariant dark:text-slate-300 font-medium">
                                        <li>Buka website ini di <b>Google Chrome</b> atau <b>Microsoft Edge</b>.</li>
                                        <li>Perhatikan ujung kanan bilah alamat web (address bar).</li>
                                        <li>Klik ikon <b>Install</b> <Icon name="install_desktop" className="text-[14px] inline text-google-blue" /> yang muncul di sana.</li>
                                        <li>Pada Chrome, Anda juga bisa klik ikon <b>titik tiga</b> (G) &rarr; <b>"Save and share"</b> &rarr; <b>"Install page as app"</b>.</li>
                                        <li>Aplikasi akan terinstal, dapat di-pin ke Taskbar, dan dibuka layaknya program desktop biasa.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                        <div className="p-6 sm:p-8 md:p-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-b-[30px] flex justify-end">
                            <button onClick={onClose} className="bg-google-blue text-white px-6 py-3 rounded-full font-medium text-[13px] shadow-md hover:bg-google-blueDark transition-all active:scale-95">Tutup Panduan</button>
                        </div>
                    </div>
                </div>
            );
        }

        function FlagWavingBackground({ theme }) {
            const canvasRef = useRef(null);
            const themeRef = useRef(theme);

            useEffect(() => {
                themeRef.current = theme;
            }, [theme]);

            useEffect(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                let animFrame;
                let t = 0;
                let W, H;
                let isAnimating = true;

                function resize() {
                    W = window.innerWidth;
                    H = window.innerHeight;
                    canvas.width = W;
                    canvas.height = H;
                }
                resize();
                window.addEventListener('resize', resize);

                function drawFrame(time) {
                    const isDark = themeRef.current === 'dark';
                    ctx.clearRect(0, 0, W, H);

                    // 1. Gambar latar belakang MERAH solid
                    ctx.fillStyle = isDark ? '#4c0519' : '#dc2626'; // Rose-950 atau Merah standar
                    ctx.fillRect(0, 0, W, H);

                    // 2. Gambar area PUTIH menggunakan kurva mulus (Polygon Path)
                    ctx.fillStyle = isDark ? '#0f172a' : '#f8fafc'; // Slate-900 atau Putih salju
                    ctx.beginPath();
                    
                    // Mulai dari sisi kiri (Tiang)
                    const startPhase = 0 * Math.PI * 3.5 - time * 1.8;
                    ctx.moveTo(0, H * 0.5 + Math.sin(startPhase) * 0);

                    // Loop untuk menggambar kurva batas bendera
                    // Optimasi: Gunakan resolusi 15px di layar kecil (mobile) agar ringan
                    const step = W < 768 ? 15 : 5;
                    for (let x = 0; x <= W; x += step) {
                        const xProgress = x / W;
                        const amplitude = H * 0.08 * xProgress * xProgress;
                        const wavePhase = xProgress * Math.PI * 3.5 - time * 1.8;
                        const midY = H * 0.5 + Math.sin(wavePhase) * amplitude;
                        ctx.lineTo(x, midY);
                    }
                    
                    const endAmp = H * 0.08;
                    const endPhase = Math.PI * 3.5 - time * 1.8;
                    ctx.lineTo(W, H * 0.5 + Math.sin(endPhase) * endAmp);

                    ctx.lineTo(W, H);
                    ctx.lineTo(0, H);
                    ctx.closePath();
                    ctx.fill();

                    // 3. Tambahkan bayangan kain 3D dengan Linear Gradient yang sangat halus
                    const shadeGrad = ctx.createLinearGradient(0, 0, W, 0);
                    const shadeStops = W < 768 ? 10 : 20; 
                    for (let i = 0; i <= shadeStops; i++) {
                        const xProgress = i / shadeStops;
                        const wavePhase = xProgress * Math.PI * 3.5 - time * 1.8;
                        const curvature = Math.cos(wavePhase); // -1 sampai 1
                        
                        if (curvature > 0) {
                            // Diperhalus signifikan (dari 0.15 ke 0.03) agar elegan dan bersih
                            const alpha = curvature * 0.03; 
                            shadeGrad.addColorStop(xProgress, `rgba(255,255,255,${alpha})`);
                        } else {
                            // Diperhalus signifikan (dari 0.25 ke 0.04) agar tidak seperti noda/smudge abu-abu di background putih
                            const alpha = -curvature * 0.04; 
                            shadeGrad.addColorStop(xProgress, `rgba(0,0,0,${alpha})`);
                        }
                    }
                    ctx.fillStyle = shadeGrad;
                    ctx.fillRect(0, 0, W, H);

                    // 4. Efek kilau satin yang bergerak (Shimmer)
                    const shimX = W * (0.3 + Math.sin(time * 0.4) * 0.25);
                    const shimY = H * (0.3 + Math.cos(time * 0.3) * 0.15);
                    const grad = ctx.createRadialGradient(shimX, shimY, 0, shimX, shimY, W * 0.45);
                    grad.addColorStop(0, 'rgba(255,255,255,0.04)'); // Lebih halus
                    grad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, W, H);
                }

                function loop() {
                    if (!isAnimating) return;
                    animFrame = requestAnimationFrame(loop);
                    if (document.hidden) return;
                    drawFrame(t);
                    t += 0.045;
                }

                // Render frame pertama langsung agar layar tidak kosong
                drawFrame(0);

                // Tunda animasi 2 detik agar PageSpeed selesai menghitung LCP dan TTI tanpa gangguan
                const startDelay = setTimeout(() => {
                    loop();
                }, 2000);

                return () => {
                    isAnimating = false;
                    clearTimeout(startDelay);
                    cancelAnimationFrame(animFrame);
                    window.removeEventListener('resize', resize);
                };
            }, []);

            return (
                                <canvas
                    ref={canvasRef}
                    className="fixed inset-0 pointer-events-none no-print modal-backdrop animate-backdrop-in"
                    style={{ zIndex: -1, width: '100%', height: '100%' }}
                />
            );
        }

        function LoginScreen({ onLogin, identity, setShowPwaGuide, legalData, setShowLegalModal, setShowLicenseModal, theme, setTheme, informasi = [], blogData = [], bannerImage = '', sponsorsData, members = [], umkmData = [], infoDesa = null, landingConfig, nextMeeting, cycleNumber, infaqData = [], tokoProducts = [] }) {
            const [email, setEmail] = useState('');
            const [password, setPassword] = useState('');
            const [isLoading, setIsLoading] = useState(false);
            const [mode, setMode] = useState('select');
            const [selectedArticle, setSelectedArticle] = useState(null); // modal detail informasi/blog
            const [error, setError] = useState('');
            const [showMap, setShowMap] = useState(false); // Lazy-load Google Maps
            const [limitInformasi, setLimitInformasi] = useState(6);
            const [limitBlog, setLimitBlog] = useState(6);
            const [limitUmkm, setLimitUmkm] = useState(6);
            const [limitInfaq, setLimitInfaq] = useState(3);
            const [limitToko, setLimitToko] = useState(8);
            
            const latestWinner = useMemo(() => {
                return (members || [])
                    .filter(m => m.hasWon && m.wonRound)
                    .sort((a, b) => Number(b.wonRound) - Number(a.wonRound))[0];
            }, [members]);
            
            useEffect(() => {
                const structuredData = [];
                const baseUrl = window.location.origin;

                if (tokoProducts && tokoProducts.length > 0) {
                    const productsSchema = {
                        "@context": "https://schema.org",
                        "@type": "ItemList",
                        "itemListElement": tokoProducts.filter(p => p.isPublished).map((item, index) => {
                            const minPrice = item.variants && item.variants.length > 0 ? Math.min(...item.variants.map(v => v.price)) : 0;
                            return {
                                "@type": "ListItem",
                                "position": index + 1,
                                "item": {
                                    "@type": "Product",
                                    "name": item.name,
                                    "description": item.description || `Produk ${item.name}`,
                                    "image": item.imageUrl || `${baseUrl}/National_emblem_of_Indonesia_Garuda_Pancasila.svg`,
                                    "url": `${baseUrl}/?page=toko&product=${item.sku || item.id}`,
                                    "offers": {
                                        "@type": "Offer",
                                        "price": minPrice,
                                        "priceCurrency": "IDR",
                                        "availability": "https://schema.org/InStock"
                                    }
                                }
                            };
                        })
                    };
                    structuredData.push(productsSchema);
                }

                if (blogData && blogData.length > 0) {
                    const blogSchema = {
                        "@context": "https://schema.org",
                        "@type": "ItemList",
                        "itemListElement": blogData.map((article, index) => ({
                            "@type": "ListItem",
                            "position": index + 1,
                            "item": {
                                "@type": "BlogPosting",
                                "headline": article.title,
                                "description": article.content ? article.content.substring(0, 150) : `Artikel: ${article.title}`,
                                "image": article.imageUrl || `${baseUrl}/National_emblem_of_Indonesia_Garuda_Pancasila.svg`,
                                "url": `${baseUrl}/?page=blog&article=${article.id}`,
                                "datePublished": article.date ? new Date(article.date).toISOString() : new Date().toISOString()
                            }
                        }))
                    };
                    structuredData.push(blogSchema);
                }

                if (informasi && informasi.length > 0) {
                    const infoSchema = {
                        "@context": "https://schema.org",
                        "@type": "ItemList",
                        "itemListElement": informasi.map((info, index) => ({
                            "@type": "ListItem",
                            "position": index + 1,
                            "item": {
                                "@type": "NewsArticle",
                                "headline": info.title,
                                "description": info.content ? info.content.substring(0, 150) : `Pengumuman: ${info.title}`,
                                "image": info.imageUrl || `${baseUrl}/National_emblem_of_Indonesia_Garuda_Pancasila.svg`,
                                "datePublished": info.date ? new Date(info.date).toISOString() : new Date().toISOString()
                            }
                        }))
                    };
                    structuredData.push(infoSchema);
                }

                if (structuredData.length > 0) {
                    const scriptEl = document.createElement('script');
                    scriptEl.type = 'application/ld+json';
                    scriptEl.id = 'seo-structured-data';
                    scriptEl.text = JSON.stringify(structuredData);
                    
                    const existingScript = document.getElementById('seo-structured-data');
                    if (existingScript) existingScript.remove();
                    document.head.appendChild(scriptEl);
                }

                return () => {
                    const scriptToRemove = document.getElementById('seo-structured-data');
                    if (scriptToRemove) scriptToRemove.remove();
                };
            }, [tokoProducts, blogData, informasi]);
            
            const handleAdminLogin = async () => {
                if (!email || !password) return setError('Email dan Password wajib diisi.');
                setIsLoading(true); setError('');
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    if (userCredential.user.uid === '7kGABJkj7APXHPtyVQUHQeoz0Cy1') {
                        onLogin('admin');
                    } else {
                        await signOut(auth);
                        setError('Akses ditolak. UID tidak sesuai.');
                    }
                } catch (err) {
                    setError('Login gagal. Periksa kembali email dan password Anda.');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            };
            
            return (
                <>
                <div className="w-full min-h-screen flex flex-col bg-transparent text-slate-800 relative overflow-x-hidden font-sans">
                    <FlagWavingBackground theme={theme} />


                    {/* ANIMASI WAYANG KULIT GLOBAL (LANDING) */}
                    <div className="fixed bottom-0 sm:bottom-4 -left-4 sm:left-4 z-0 pointer-events-none opacity-80 dark:opacity-60 transition-all duration-1000 no-print scale-x-[-1]">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kiri" className="w-64 sm:w-80 h-auto max-h-[35vh] object-contain object-bottom animate-wayang dark:invert drop-shadow-2xl" loading="lazy" />
                    </div>
                    <div className="fixed bottom-0 sm:bottom-4 -right-4 sm:right-4 z-0 pointer-events-none opacity-80 dark:opacity-60 transition-all duration-1000 no-print">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kanan" className="w-64 sm:w-80 h-auto max-h-[35vh] object-contain object-bottom animate-wayang dark:invert drop-shadow-2xl" loading="lazy" style={{ animationDelay: '1.5s' }} />
                    </div>

                    {/* FLOATING TOP NAVBAR */}
                    <div className="sticky top-0 z-50 no-print w-full">
                        <header className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 py-3 px-3 sm:py-4 sm:px-6 w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-7xl mx-auto mt-4 sm:mt-6 rounded-2xl sm:rounded-3xl border border-red-500/20 dark:border-red-900/40 shadow-lg shadow-red-500/10 relative z-20 overflow-hidden">
                            {/* ORNAMEN JOGLO - watermark di bawah tengah header */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 sm:w-32 pointer-events-none opacity-20 dark:opacity-10">
                                <img src="./joglo_transparent.png?v=2" alt="Ornamen Joglo" className="w-full h-auto dark:invert" />
                            </div>
                            <div className="max-w-7xl mx-auto flex items-center justify-between">
                                <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                                    <div className="bg-google-red text-white w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 flex justify-center items-center shadow-md shadow-red-500/20 border border-red-400/40">
                                        <img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" className="w-6 h-6 object-contain" fetchpriority="high"/>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                                        <h1 className="text-[13px] sm:text-[16px] font-medium truncate leading-tight tracking-tight text-slate-800 dark:text-slate-100">{identity.name || 'Portal RT'}</h1>
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0"></span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 pl-1.5">
                                    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-50 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full flex justify-center items-center transition-all duration-300 active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm" title="Toggle Tema">
                                        <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[15px] sm:text-[16px]" />
                                    </button>
                                    <button onClick={() => setMode(mode === 'admin_login' ? 'select' : 'admin_login')} className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-50 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full flex justify-center items-center transition-all duration-300 active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm" title="Otorisasi Admin">
                                        <Icon name="lock" className="text-[15px] sm:text-[16px]" />
                                    </button>
                                    <button onClick={() => onLogin('warga')} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-google-red hover:bg-google-redDark text-white rounded-full text-[10.5px] sm:text-[12px] font-medium flex items-center gap-1.5 shadow-md shadow-red-500/20 border border-red-400/40 transition-all duration-300 active:scale-95">
                                        <Icon name="person" className="text-[14px] sm:text-[16px]" />
                                        <span>Masuk Warga</span>
                                    </button>
                                </div>
                            </div>
                        </header>
                    </div>

                    {/* MAIN LANDING CONTENT */}
                    {mode === 'select' ? (
                        <>
                            <main className="flex-1 w-full max-w-7xl mx-auto px-4 pt-6 pb-12 space-y-10 z-10 relative">
                            {/* HERO BANNER SECTION - menggunakan bannerImage dari Firebase jika ada */}
                            <div className={`relative rounded-3xl sm:rounded-3xl p-6 sm:p-10 text-white border border-red-400/20 shadow-xl shadow-red-500/20 dark:border-red-900/30 overflow-hidden group min-h-[280px] sm:min-h-[360px] flex items-end ${!bannerImage ? 'bg-red-600' : 'bg-slate-900'}`}>
                                {bannerImage && (
                                    <>
                                        <img src={bannerImage} alt="Banner Lingkungan" className="absolute inset-0 w-full h-full object-cover object-center z-0 group-hover:scale-105 transition-transform duration-1000" fetchpriority="high"/>
                                        <div className="absolute inset-0 bg-slate-950/65 z-0"></div>
                                    </>
                                )}

                                <div className="relative z-10 w-full text-left space-y-5 max-w-2xl pb-2">
                                    <div className="inline-flex items-center gap-1.5 bg-red-800 px-3.5 py-1.5 rounded-full border border-white/20 shadow-sm w-fit">
                                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                        <span className="text-[9px] font-medium uppercase tracking-widest text-white/90">Portal Resmi Warga</span>
                                    </div>
                                    
                                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight leading-tight uppercase text-white [text-shadow:_0_4px_12px_rgba(0,0,0,0.4)]">
                                        Portal Layanan &amp; <br />
                                        {identity.name || 'Informasi Warga'}
                                    </h2>
                                    <p className="text-[12.5px] sm:text-[13.5px] font-medium text-white/95 leading-relaxed [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
                                        {identity.subtitle ? `Selamat datang di sistem informasi pelayanan warga digital ${identity.name}. ${identity.subtitle}` : `Selamat datang di sistem informasi pelayanan warga digital ${identity.name || 'RT Anda'}. Menghadirkan transparansi data kas, arisan bulanan online, administrasi lingkungan, dan kabar berita warga.`}
                                    </p>
                                    {/* Info jumlah warga aktif */}
                                    {members.length > 0 && (
                                        <div className="flex flex-wrap gap-3">
                                            <div className="inline-flex items-center gap-1.5 bg-white/15  px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-medium text-white/90">
                                                <Icon name="groups" className="text-[13px]" />
                                                {members.filter(m => m.status !== 'Meninggal' && m.status !== 'Nonaktif').length} Warga Aktif
                                            </div>
                                            {informasi.length > 0 && (
                                                <div className="inline-flex items-center gap-1.5 bg-white/15  px-3 py-1.5 rounded-full border border-white/20 text-[10px] font-medium text-white/90">
                                                    <Icon name="campaign" className="text-[13px]" />
                                                    {informasi.length} Pengumuman
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="pt-2 flex flex-wrap gap-2.5">
                                        <button onClick={() => onLogin('warga')} className="px-4 py-2.5 sm:px-5 sm:py-3 bg-white hover:bg-slate-50 rounded-full font-medium text-[11px] sm:text-[12px] shadow-md flex items-center gap-2 active:scale-95 transition-all text-red-600 hover:text-red-700">
                                            <Icon name="login" className="text-[15px] sm:text-[16px]" fill="true" />
                                            <span>Portal Warga</span>
                                        </button>
                                        <a href="#berita" className="px-4 py-2.5 sm:px-5 sm:py-3 bg-white/15 hover:bg-white/25 text-white rounded-xl font-medium text-[11px] sm:text-[12px] border border-white/20 flex items-center gap-2 active:scale-95 transition-all">
                                            <Icon name="campaign" className="text-[15px] sm:text-[16px]" />
                                            <span>Kabar Warga</span>
                                        </a>
                                         {umkmData && umkmData.length > 0 && (
                                            <a href="#umkm" className="px-4 py-2.5 sm:px-5 sm:py-3 bg-white/15 hover:bg-white/25 text-white rounded-xl font-medium text-[11px] sm:text-[12px] border border-white/20 flex items-center gap-2 active:scale-95 transition-all">
                                                <Icon name="storefront" className="text-[15px] sm:text-[16px]" />
                                                <span>UMKM Warga</span>
                                            </a>
                                         )}
                                         {infoDesa?.enabled && (
                                            <a href="#peta" className="px-4 py-2.5 sm:px-5 sm:py-3 bg-white/15 hover:bg-white/25 text-white rounded-xl font-medium text-[11px] sm:text-[12px] border border-white/20 flex items-center gap-2 active:scale-95 transition-all">
                                                <Icon name="map" className="text-[15px] sm:text-[16px]" />
                                                <span>Peta &amp; Kontak</span>
                                            </a>
                                         )}
                                    </div>
                                </div>
                            </div>

                            {/* SERVICES GRID SECTION (SPACIOUS 4 COLUMNS) */}
                            <section className="space-y-6 max-w-7xl mx-auto w-full">
                                <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-widest text-center">{landingConfig.servicesSubtitle}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-md flex flex-col items-center text-center justify-between space-y-6 hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-700 hover:-translate-y-1.5 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-google-yellowLight border border-google-yellow/20 flex items-center justify-center shrink-0 text-google-yellowDark">
                                            <Icon name="campaign" className="text-[24px]" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-[15px] text-slate-900 dark:text-white">Info Pengumuman Resmi</h4>
                                            <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5">Papan pengumuman penting, info rapat warga, &amp; berita lingkungan terkini dari pengurus RT.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-md flex flex-col items-center text-center justify-between space-y-6 hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-700 hover:-translate-y-1.5 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-google-greenLight border border-google-green/20 flex items-center justify-center shrink-0 text-google-greenDark">
                                            <Icon name="payments" className="text-[24px]" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-[15px] text-slate-900 dark:text-white">Transparansi Uang Kas</h4>
                                            <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5">Laporan kas masuk dan keluar RT yang dicatat rinci, terbuka, &amp; dipantau warga kapan saja.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-md flex flex-col items-center text-center justify-between space-y-6 hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-700 hover:-translate-y-1.5 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-google-blueLight border border-google-blue/20 flex items-center justify-center shrink-0 text-google-blueDark">
                                            <Icon name="local_activity" className="text-[24px]" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-[15px] text-slate-900 dark:text-white">Katalog Tiket &amp; Event (COD)</h4>
                                            <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5">Pembelian tiket jalan santai dan kegiatan RT secara online dengan metode COD.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-md flex flex-col items-center text-center justify-between space-y-6 hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-700 hover:-translate-y-1.5 transition-all duration-300">
                                        <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-550 flex items-center justify-center border border-rose-100 dark:border-rose-900/30">
                                            <Icon name="casino" className="text-[24px]" />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-[15px] text-slate-900 dark:text-white">Sistem Arisan RT Digital</h4>
                                            <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed mt-1.5">Pengundian berkala bulanan dan daftar riwayat pemenang arisan secara digital transparan.</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* BOARD OF INFORMATION (SPACIOUS 3 COLUMNS) */}
                            {informasi && informasi.length > 0 && (
                                <section id="berita" className="space-y-8 pt-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-red-600 dark:text-red-400 uppercase tracking-widest">{landingConfig.newsSubtitle}</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">{landingConfig.newsTitle}</h2>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {informasi.slice(0, limitInformasi).map(item => (
                                            <article key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden flex flex-col justify-between hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group" onClick={() => setSelectedArticle({ ...item, type: 'informasi' })}>
                                                <div>
                                                    {item.imageUrl ? (
                                                        <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full h-40 bg-red-50 dark:bg-red-950/20 flex items-center justify-center shrink-0">
                                                            <Icon name="campaign" className="text-[40px] text-red-500/20" />
                                                        </div>
                                                    )}
                                                    <div className="p-6 sm:p-8 flex flex-col gap-2">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                            <Icon name="event" className="text-[12px]" />
                                                            <span>{item.date ? new Date(item.date).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '-'}</span>
                                                        </div>
                                                        <h4 className="font-medium text-[14px] text-slate-900 dark:text-white tracking-tight leading-snug line-clamp-2 flex-1">{item.title}</h4>
                                                        <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">{item.description}</p>
                                                    </div>
                                                </div>
                                                <div className="p-6 sm:p-8 pt-0 mt-auto">
                                                    <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 font-medium text-[12.5px] transition-all">
                                                        <span>Baca Selengkapnya</span>
                                                        <Icon name="arrow_forward" className="text-[14px] group-hover:translate-x-1 transition-transform" />
                                                    </span>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                    {informasi.length > limitInformasi && (
                                        <div className="flex justify-center pt-6">
                                            <button onClick={() => setLimitInformasi(prev => prev + 6)} className="bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium py-3 px-6 rounded-full text-[12px] border border-slate-200 dark:border-slate-750 shadow-sm active:scale-95 transition-all flex items-center gap-1.5">
                                                <Icon name="expand_more" />
                                                <span>Lihat Lebih Banyak Pengumuman</span>
                                            </button>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* BLOG / ARTIKEL WARGA SECTION */}
                            {blogData && blogData.length > 0 && (
                                <section id="blog" className="space-y-8 pt-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-google-blue dark:text-blue-400 uppercase tracking-widest">{landingConfig.blogSubtitle}</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">{landingConfig.blogTitle}</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {blogData.slice(0, limitBlog).map(article => (
                                            <article key={article.id} className="h-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden flex flex-col hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 cursor-pointer group" onClick={() => setSelectedArticle({ ...article, type: 'blog' })}>
                                                {article.imageUrl ? (
                                                    <div className="w-full h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                                        <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-40 bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center shrink-0">
                                                        <Icon name="article" className="text-[40px] text-google-blue/20" />
                                                    </div>
                                                )}
                                                <div className="p-6 sm:p-8 flex flex-col flex-1">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-2">
                                                        <Icon name="event" className="text-[12px]" />
                                                        <span>{article.date ? new Date(article.date).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '-'}</span>
                                                        {article.likes > 0 && (
                                                            <span className="ml-auto flex items-center gap-1 text-red-400"><Icon name="favorite" className="text-[11px]" fill="true" />{article.likes}</span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-medium text-[14px] text-slate-900 dark:text-white tracking-tight leading-snug line-clamp-2 flex-1 mb-3">{article.title}</h4>
                                                    <p className="text-[12px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">{article.content && article.content.length > 120 ? article.content.substring(0, 120) + '...' : article.content}</p>
                                                    <span className="inline-flex items-center gap-1 text-google-blue font-medium text-[11.5px] group-hover:gap-2 transition-all">
                                                        Baca Artikel <Icon name="arrow_forward" className="text-[13px] group-hover:translate-x-1 transition-transform" />
                                                    </span>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                    {blogData.length > limitBlog && (
                                        <div className="flex justify-center pt-6">
                                            <button onClick={() => setLimitBlog(prev => prev + 6)} className="bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium py-3 px-6 rounded-full text-[12px] border border-slate-200 dark:border-slate-750 shadow-sm active:scale-95 transition-all flex items-center gap-1.5">
                                                <Icon name="expand_more" />
                                                <span>Lihat Lebih Banyak Artikel</span>
                                            </button>
                                        </div>
                                    )}
                                </section>
                            )}

                                                        {/* INFAQ SECTION */}
                            {infaqData && infaqData.length > 0 && (
                                <section id="infaq" className="space-y-8 pt-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-google-green dark:text-green-400 uppercase tracking-widest">Program Amal & Sosial</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">SALURKAN INFAQ ANDA</h2>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {infaqData.slice(0, limitInfaq).map(item => {
                                            const p = item.danaTarget ? Math.min(100, Math.round(((item.danaTerkumpul || 0) / item.danaTarget) * 100)) : null;
                                            return (
                                                <article key={item.id} onClick={() => { sessionStorage.setItem('openInfaqId', item.id); onLogin('warga'); }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl overflow-hidden flex flex-col justify-between hover:border-google-green/50 hover:-translate-y-1.5 transition-all duration-300 group cursor-pointer">
                                                    <div>
                                                        <div className="relative h-40 w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                            {item.imageUrl ? (
                                                                <img src={item.imageUrl} alt={item.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                            ) : (
                                                                <Icon name="volunteer_activism" className="text-[48px] text-google-green/30" fill="true" />
                                                            )}
                                                        </div>
                                                        <div className="p-5 space-y-5">
                                                            <h4 className="font-medium text-[16px] text-slate-900 dark:text-white tracking-tight leading-tight line-clamp-2 group-hover:text-google-green transition-colors">{item.judul}</h4>
                                                            <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">{item.deskripsi}</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-5 pt-0 space-y-6">
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Terkumpul</span>
                                                                {p !== null && <span className="text-[11px] font-medium text-google-green">{p}%</span>}
                                                            </div>
                                                            <p className="text-[15px] font-medium text-google-green tracking-tight">Rp {(item.danaTerkumpul || 0).toLocaleString('id-ID')}</p>
                                                            {item.danaTarget > 0 && (
                                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                                                                    <div className="h-full bg-google-green rounded-full transition-all duration-700" style={{width: `${p}%`}} />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button className="w-full bg-google-green/10 text-google-green hover:bg-google-green hover:text-white border border-google-green/20 hover:border-google-green py-2.5 rounded-full font-medium text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
                                                            <Icon name="volunteer_activism" className="text-[16px]" fill="true" /> Donasi Sekarang
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                    {infaqData.length > limitInfaq && (
                                        <div className="flex justify-center pt-2">
                                            <button onClick={() => setLimitInfaq(prev => prev + 3)} className="bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium py-3 px-6 rounded-full text-[12px] border border-slate-200 dark:border-slate-750 shadow-sm active:scale-95 transition-all flex items-center gap-1.5">
                                                <Icon name="expand_more" /> Lihat Semua Program
                                            </button>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* UMKM WARGA SECTION */}
                            {umkmData && umkmData.length > 0 && (
                                <section id="umkm" className="space-y-8 pt-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-green-600 dark:text-green-400 uppercase tracking-widest">{landingConfig.umkmSubtitle}</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">{landingConfig.umkmTitle}</h2>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {umkmData.slice(0, limitUmkm).map(item => (
                                            <article key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden flex flex-col justify-between hover:border-green-300 dark:hover:border-green-600 hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 group">
                                                <div>
                                                    <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="w-full h-full bg-green-50 dark:bg-green-950/20 flex items-center justify-center">
                                                                <Icon name="storefront" className="text-[48px] text-green-500/20" />
                                                            </div>
                                                        )}
                                                        <span className="absolute top-3 left-3 bg-green-500 text-white text-[9.5px] font-medium uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">{item.category}</span>
                                                    </div>
                                                    <div className="p-5 space-y-2.5">
                                                        <h4 className="font-medium text-[16px] text-slate-900 dark:text-white tracking-tight leading-tight line-clamp-1">{item.name}</h4>
                                                        <div className="flex items-center text-slate-500 dark:text-slate-400 text-[12px] font-medium">
                                                            <Icon name="person" className="text-[14px] mr-1 text-slate-400" />
                                                            <span>Pemilik: {item.owner}</span>
                                                        </div>
                                                        <p className="text-[12.5px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">{item.description || 'Tidak ada deskripsi usaha.'}</p>
                                                    </div>
                                                </div>
                                                <div className="p-5 pt-0">
                                                    <a href={`https://wa.me/${item.phone}?text=Halo%20${encodeURIComponent(item.owner)},%20saya%2520tertarik%2520dengan%2520usaha%2520Anda%2520di%2520Portal%2520Warga.`} target="_blank" rel="noopener noreferrer" className="w-full bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 hover:bg-green-600 hover:text-white border border-green-200 dark:border-green-800 hover:border-green-600 py-3 rounded-xl font-medium text-[12px] flex items-center justify-center gap-1.5 transition-all active:scale-95">
                                                        <Icon name="chat" className="text-[16px]" />
                                                        <span>Hubungi via WhatsApp</span>
                                                    </a>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                    {umkmData.length > limitUmkm && (
                                        <div className="flex justify-center pt-6">
                                            <button onClick={() => setLimitUmkm(prev => prev + 6)} className="bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium py-3 px-6 rounded-full text-[12px] border border-slate-200 dark:border-slate-750 shadow-sm active:scale-95 transition-all flex items-center gap-1.5">
                                                <Icon name="expand_more" />
                                                <span>Lihat Lebih Banyak Usaha</span>
                                            </button>
                                        </div>
                                    )}
                                </section>
                            )}
                            {/* TOKO OFFICIAL SECTION */}
                            <section id="toko" className="space-y-8 pt-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-google-blue dark:text-google-blueLight uppercase tracking-widest">Layanan E-Commerce RT</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">Official Store</h2>
                                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">Layanan belanja hemat, gratis ongkir, bayar di tempat (COD).</p>
                                    </div>
                                    {tokoProducts && tokoProducts.filter(p => p.isPublished).length > 0 ? (
                                        <>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                                            {tokoProducts.filter(p => p.isPublished).slice(0, limitToko).map(item => (
                                                <article key={item.id} onClick={() => {
                                                    sessionStorage.setItem('openTokoProductId', item.id);
                                                    onLogin('warga');
                                                }} className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden flex flex-col justify-between hover:border-google-blue dark:hover:border-google-blue hover:shadow-lg hover:-translate-y-1.5 transition-all duration-300 group cursor-pointer">
                                                    <div>
                                                        <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                            {item.imageUrl ? (
                                                                <img src={item.imageUrl} alt={item.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                                            ) : (
                                                                <Icon name="storefront" className="text-[32px] sm:text-[48px] text-slate-300 dark:text-slate-600" />
                                                            )}
                                                            {item.grosirMinQty > 0 && <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-yellow-400 text-yellow-900 text-[8px] sm:text-[9.5px] font-medium uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-sm">Grosir</span>}
                                                            <button onClick={(e) => {
                                                                e.stopPropagation();
                                                                const url = new URL(window.location.href);
                                                                url.searchParams.set('page', 'toko');
                                                                url.searchParams.set('product', item.sku || item.id);
                                                                navigator.clipboard.writeText(url.toString());
                                                                showToast('Tautan produk berhasil disalin!');
                                                            }} className="absolute top-2 right-2 sm:top-3 sm:right-3 w-7 h-7 sm:w-8 sm:h-8 bg-white/90 rounded-full flex items-center justify-center text-slate-600 hover:text-google-blue hover:bg-white transition-colors shadow-sm" title="Bagikan Produk">
                                                                <Icon name="share" className="text-[12px] sm:text-[14px]" />
                                                            </button>
                                                        </div>
                                                        <div className="p-3 sm:p-5 space-y-1 sm:space-y-2 flex-1 flex flex-col">
                                                            <h4 className="font-medium text-[13px] sm:text-[15px] text-slate-800 dark:text-white tracking-tight leading-tight line-clamp-2 group-hover:text-google-blue transition-colors">{item.judul || item.name}</h4>
                                                            <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-auto">
                                                                <span className="flex items-center gap-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800 uppercase tracking-wider"><Icon name="verified" className="text-[11px]" /> Official</span>
                                                                <span className="flex items-center gap-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800 uppercase tracking-wider"><Icon name="local_shipping" className="text-[11px]" /> Gratis Ongkir</span>
                                                                <span className="flex items-center gap-0.5 bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-orange-200/60 dark:border-orange-800 uppercase tracking-wider"><Icon name="payments" className="text-[11px]" /> COD</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="px-3 sm:px-5 pb-3 sm:pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto flex justify-between items-center gap-2">
                                                        <div>
                                                            <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 uppercase tracking-widest">Mulai dari</p>
                                                            <p className="text-[12px] sm:text-[14px] font-medium text-google-blue dark:text-google-blueLight">{new Intl.NumberFormat('id-ID', {style: 'currency', currency: 'IDR', maximumFractionDigits: 0}).format(Math.min(...item.variants.map(v => v.price)))}</p>
                                                        </div>
                                                        <button onClick={(e) => {
                                                            e.stopPropagation();
                                                            sessionStorage.setItem('addToCartProductId', item.id);
                                                            onLogin('warga');
                                                        }} className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 dark:bg-slate-800 text-google-blue dark:text-google-blueLight border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center hover:bg-google-blue hover:text-white transition-colors shrink-0 cursor-pointer shadow-sm active:scale-95">
                                                            <Icon name="shopping_bag" className="text-[15px] sm:text-[18px]" />
                                                        </button>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                        {tokoProducts.filter(p => p.isPublished).length > limitToko && (
                                            <div className="flex justify-center pt-6">
                                                <button onClick={() => setLimitToko(prev => prev + 8)} className="bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium py-3 px-6 rounded-full text-[12px] border border-slate-200 dark:border-slate-750 shadow-sm active:scale-95 transition-all flex items-center gap-1.5">
                                                    <Icon name="expand_more" />
                                                    <span>Lihat Lebih Banyak Produk</span>
                                                </button>
                                            </div>
                                        )}
                                        </>
                                    ) : (
                                        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Icon name="storefront" className="text-[32px] text-slate-400 dark:text-slate-500" />
                                            </div>
                                            <h4 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Toko Masih Kosong</h4>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">Belum ada produk yang dijual saat ini. Pengurus RT akan segera menambahkan produk menarik di sini.</p>
                                        </div>
                                    )}
                                </section>

                            {/* JADWAL AGENDA RT MENDATANG */}
                            {nextMeeting && nextMeeting.date && nextMeeting.date !== 'Belum dijadwalkan' && (
                                <section className="space-y-8 pt-10 pb-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-google-blue dark:text-blue-400 uppercase tracking-widest">Jadwal & Agenda RT</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">KEGIATAN WARGA RT</h2>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300">
                                        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                                            <div className="space-y-6 flex-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="bg-blue-50 dark:bg-blue-950/20 text-google-blue border border-blue-100 dark:border-blue-900/40 rounded-xl px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider flex items-center gap-1.5">
                                                        <Icon name="event" className="text-[14px]" />
                                                        <span>Pertemuan RT Terdekat</span>
                                                    </div>
                                                </div>
                                                <h3 className="text-lg sm:text-xl font-medium text-slate-800 dark:text-white leading-snug">{nextMeeting.notes || 'Pertemuan Rutin Warga RT Pakem'}</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12.5px] font-medium text-slate-600 dark:text-slate-400">
                                                    <div className="flex items-center gap-2">
                                                        <Icon name="calendar_today" className="text-google-blue text-[16px]" />
                                                        <span>Hari/Tanggal: <strong className="font-medium text-slate-850 dark:text-slate-100">{nextMeeting.date}</strong></span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Icon name="schedule" className="text-google-blue text-[16px]" />
                                                        <span>Waktu/Jam: <strong className="font-medium text-slate-850 dark:text-slate-100">{nextMeeting.time} WIB</strong></span>
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:col-span-2">
                                                        <Icon name="location_on" className="text-google-blue text-[16px]" />
                                                        <span>Tempat/Lokasi: <strong className="font-medium text-slate-850 dark:text-slate-100">{nextMeeting.location}</strong></span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex items-center justify-center">
                                                <button onClick={() => onLogin('warga')} className="w-full md:w-auto bg-google-blue hover:bg-google-blueDark text-white font-medium py-3.5 px-6 rounded-full text-[12px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                                                    <Icon name="login" />
                                                    <span>Masuk Untuk Absen</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* SPOTLIGHT PEMENANG ARISAN TERBARU */}
                            {latestWinner && (
                                <section className="space-y-8 pt-10 pb-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-google-yellowDark dark:text-yellow-400 uppercase tracking-widest">Selamat Kepada Pemenang</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">PEMENANG ARISAN PUTARAN TERBARU</h2>
                                    </div>
                                    <div className="relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm transition-all duration-300 overflow-hidden flex flex-col md:flex-row gap-6 items-center justify-between">
                                        {/* Background decoration */}
                                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-google-yellow opacity-10 rounded-full blur-2xl"></div>
                                        
                                        <div className="flex items-center gap-5 relative z-10 w-full md:w-auto">
                                            <div className="w-16 h-16 rounded-2xl bg-google-yellow text-white flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 animate-bounce-slow">
                                                <Icon name="emoji_events" className="text-[32px]" fill="true" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-medium text-google-yellowDark uppercase tracking-widest">Putaran Ke-{latestWinner.wonRound}</p>
                                                <h3 className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-100 tracking-tight">{latestWinner.name}</h3>
                                                <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Ditetapkan sebagai pemenang arisan pada siklus ke-{cycleNumber || 1}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="shrink-0 relative z-10 w-full md:w-auto flex items-center justify-center">
                                            <button onClick={() => {
                                                sessionStorage.setItem('openTab', 'pemenang');
                                                onLogin('warga');
                                            }} className="w-full md:w-auto bg-white hover:bg-slate-50 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium py-3.5 px-6 rounded-full text-[12px] border border-slate-200 dark:border-slate-750 shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <Icon name="groups" />
                                                <span>Lihat Semua Pemenang</span>
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* PETA DESA & LAYANAN KELURAHAN - dikontrol sesuai pengaturan admin */}
                            {infoDesa?.enabled && (
                                <section id="peta" className="space-y-8 pt-4 max-w-7xl mx-auto w-full">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-[11px] font-medium text-red-600 dark:text-red-400 uppercase tracking-widest">{landingConfig.mapSubtitle}</h3>
                                        <h2 className="text-2xl font-medium text-slate-900 dark:text-white tracking-tight">{landingConfig.mapTitle}</h2>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Peta Google Maps (Optimized Dynamic Load) */}
                                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm overflow-hidden flex flex-col justify-between min-h-[380px]">
                                            {showMap ? (
                                                <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15810.734045472811!2d112.0831012336427!3d-7.82328387515901!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e7859a9896e1c3d%3A0x750afa04649cafb0!2sBanyuanyar%2C%20Kec.%20Gurah%2C%20Kabupaten%20Kediri%2C%20Jawa%20Timur!5e0!3m2!1sid!2sid!4v1783910401380!5m2!1sid!2sid" className="w-full h-[320px] rounded-2xl border border-slate-200 dark:border-slate-800" style={{border:0}} allowFullScreen="" referrerPolicy="strict-origin-when-cross-origin"></iframe>
                                            ) : (
                                                <div className="w-full h-[320px] rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
                                                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" style={{
                                                        backgroundImage: `radial-gradient(circle, #000 10%, transparent 11%), radial-gradient(circle, #000 10%, transparent 11%)`,
                                                        backgroundSize: '20px 20px',
                                                        backgroundPosition: '0 0, 10px 10px'
                                                    }}></div>
                                                    <Icon name="map" className="text-[44px] text-red-500/40 mb-3" />
                                                    <h4 className="font-medium text-[14px] text-slate-800 dark:text-white">Peta Wilayah Desa Banyuanyar</h4>
                                                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">Klik tombol di bawah untuk memuat Peta Google Maps secara interaktif tanpa memperlambat loading awal web.</p>
                                                    <button onClick={() => setShowMap(true)} className="mt-4 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full text-[11.5px] font-medium flex items-center gap-1.5 shadow-md transition-all active:scale-95">
                                                        <Icon name="location_on" className="text-[14px]" />
                                                        <span>Muat Peta Interaktif</span>
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-3 mt-4 items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400 px-1">
                                                <span className="flex items-center gap-1.5"><Icon name="explore" className="text-[14px]" /> Kode Pos: 64181</span>
                                                <span className="flex items-center gap-1.5"><Icon name="info" className="text-[14px]" /> Google Maps Interaktif</span>
                                            </div>
                                        </div>

                                        {/* Batas & Kontak */}
                                        <div className="space-y-6 flex flex-col">
                                            {/* Batas Administrasi */}
                                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                                                <h4 className="font-medium text-[13px] text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5"><Icon name="border_outer" className="text-red-500 text-[16px]"/> Batas Administrasi</h4>
                                                <div className="grid grid-cols-2 gap-2.5">
                                                    {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                                        <div key={arah} className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                                                            <p className="text-[8px] uppercase tracking-wider font-medium text-slate-400 mb-0.5">{arah}</p>
                                                            <p className="font-medium text-[11px] text-slate-700 dark:text-slate-200 truncate">{infoDesa?.batas?.[arah] || '-'}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Kontak Darurat */}
                                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex-1 flex flex-col">
                                                <h4 className="font-medium text-[13px] text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-1.5"><Icon name="contact_phone" className="text-red-500 text-[16px]"/> Layanan &amp; Kontak</h4>
                                                {infoDesa?.kontak && infoDesa?.kontak?.length > 0 ? (
                                                    <div className="space-y-2 max-h-48 overflow-y-auto hide-scrollbar pr-0.5">
                                                        {infoDesa?.kontak?.map((k, i) => (
                                                            <div key={k.id || i} className={`flex justify-between items-center bg-${k.color}-50/50 dark:bg-${k.color}-950/20 border border-${k.color}-500/10 dark:border-${k.color}-800/20 px-3.5 py-2.5 rounded-xl`}>
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <Icon name={k.icon || 'contact_phone'} className={`text-[15px] text-${k.color}-600 shrink-0`} fill="true"/>
                                                                    <span className={`text-[11px] font-medium text-${k.color}-800 dark:text-${k.color}-300 truncate`}>{k.nama}</span>
                                                                </div>
                                                                <span className={`text-[11px] font-medium text-${k.color}-750 dark:text-${k.color}-400 shrink-0`}>{k.telepon}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                                                        <Icon name="contact_phone" className="text-[28px] text-slate-300 dark:text-slate-600 mb-2" />
                                                        <p className="text-[11.5px] font-medium text-slate-600 dark:text-slate-400">Kontak Darurat</p>
                                                        <p className="text-[10.5px] text-slate-400 mt-0.5">Belum ada kontak darurat. Login Admin untuk menambahkan.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* SPONSOR SECTION DI LANDING PAGE */}
                            {sponsorsData?.enabled && sponsorsData?.sponsors?.length > 0 && (
                                <section className="space-y-6 pt-4 max-w-7xl mx-auto w-full">
                                    <p className="text-[9px] uppercase tracking-widest font-medium text-slate-400 text-center">{landingConfig.sponsorSubtitle}</p>
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 items-center justify-items-center">
                                            {sponsorsData.sponsors.map((s, i) => (
                                                <img key={i} src={s.url} alt={s.name} className="h-9 sm:h-11 md:h-14 w-auto max-w-[100px] sm:max-w-[120px] md:max-w-[150px] object-contain opacity-70 hover:opacity-100 transition-all duration-300 hover:scale-110 grayscale hover:grayscale-0" title={s.name} />
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ADSENSE PLACEHOLDER */}
                            <section className="py-4 text-center border-t border-slate-200/30 max-w-xl mx-auto w-full px-4">
                                <p className="text-[9px] font-medium tracking-widest text-slate-500 dark:text-slate-400 uppercase mb-2">{landingConfig.footerInfoTitle}</p>
                                <div className="w-full py-2.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-550 dark:text-slate-400 text-[10.5px] font-medium px-4 shadow-sm ">
                                    <Icon name="verified_user" className="text-[13px] mr-2 text-emerald-500" fill="true" />
                                    <span>{landingConfig.footerInfoDesc}</span>
                                </div>
                            </section>
                        </main>
                        </>

                    ) : (
                        /* ADMIN PASSWORD LOGIN FORM */
                        <div className="flex-1 flex flex-col justify-center items-center p-4 z-10">
                            <div className="relative overflow-hidden bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm w-full max-w-sm text-center">
                                <div className="h-1.5 w-full absolute top-0 left-0 bg-red-600"></div>
                                <div className="mx-auto mt-4 mb-5 bg-red-50/50 w-24 h-24 rounded-full flex items-center justify-center border border-red-500/20 shadow-inner overflow-hidden">
                                    <img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Garuda Pancasila" className={identity?.logoApp ? "w-full h-full object-cover" : "w-16 h-16 object-contain"} />
                                </div>
                                <h1 className="text-[18px] font-medium text-google-red mb-1 tracking-tight">Otorisasi Admin</h1>
                                <p className="text-[12.5px] font-medium text-slate-600 mb-6 leading-snug">{identity.name}</p>
                                
                                <form onSubmit={handleAdminLogin} className="space-y-7 mt-2">
                                    <div className="space-y-6">
                                        <input type="email" placeholder="Email Akses Admin" value={email} onChange={e => {setEmail(e.target.value); setError('');}} className="w-full bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-[13.5px] font-medium outline-none rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:border-google-blue dark:focus:border-google-blue focus:shadow-sm transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100" />
                                        <input type="password" placeholder="Kata Sandi Admin" value={password} onChange={e => {setPassword(e.target.value); setError('');}} className="w-full bg-slate-50/50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 text-[13.5px] font-medium outline-none rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:border-google-blue dark:focus:border-google-blue focus:shadow-sm transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100" />
                                    </div>
                                    <div className="mt-6 pt-3.5 border-t border-slate-200/50 text-center">
                                        <p className="text-[9px] text-slate-400 font-medium px-2 leading-relaxed">
                                            <Icon name="shield" className="text-[11px] inline mr-1" />
                                            Dilindungi enkripsi & keamanan tingkat lanjut. <br /> Segala bentuk pencurian data akan dipidanakan.
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-medium mt-1">&copy; 2026 Novan Restu Utomo</p>
                                    </div>
                                    {error && <p className="text-[11px] text-red-700 font-medium bg-red-50 py-2.5 rounded-xl border border-red-200 shadow-sm flex items-center justify-center gap-1.5 mt-2"><Icon name="error" className="text-[14px]"/> {error}</p>}
                                    <div className="flex gap-3 pt-3">
                                        <button onClick={() => {setMode('select'); setError(''); setEmail(''); setPassword('');}} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-full font-medium text-[12.5px] hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center" disabled={isLoading}>Kembali</button>
                                        <button onClick={handleAdminLogin} className="flex-1 bg-google-blue border border-google-blueDark text-white py-3.5 rounded-full font-medium text-[12.5px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all duration-300 flex items-center justify-center disabled:opacity-70" disabled={isLoading}>{isLoading ? 'Memeriksa...' : 'Masuk Admin'}</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* LANDING FOOTER (MATCHES GLOBAL FOOTER) */}
                    <footer className="w-full text-center py-8 no-print border-t border-red-500/20 bg-white dark:bg-slate-900 text-[12.5px] font-medium text-slate-500 mt-10 z-10 relative">
                        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                            <p className="flex flex-wrap items-center gap-1.5 justify-center">
                                <Icon name="flag" className="text-red-500 text-[14px] animate-pulse" fill="true" />
                                - {new Date().getFullYear()} <span className="text-red-600 font-medium">WP LINGKUNGAN</span>. All rights reserved.
                            </p>
                            <button onClick={() => setShowLicenseModal && setShowLicenseModal(true)} className="flex flex-wrap items-center justify-center gap-1.5 hover:text-red-500 transition-colors active:scale-95 group">
                                <Icon name="lock" className="text-[13px] group-hover:scale-110 transition-transform" /> <span className="underline decoration-dashed underline-offset-4">&copy; 2026 Keamanan Data & Hak Cipta</span>
                            </button>
                        </div>
                    </footer>
                    {legalData?.enabled && (
                        <div className="w-full text-center pb-6 no-print bg-white dark:bg-slate-950 z-10 relative">
                            <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-medium text-google-blue dark:text-blue-400">
                                <button onClick={() => setShowLegalModal('terms')} className="hover:underline">Syarat & Ketentuan</button>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button onClick={() => setShowLegalModal('privacy')} className="hover:underline">Kebijakan Privasi</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL DETAIL ARTIKEL / INFORMASI */}
                {selectedArticle && (
                    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) setSelectedArticle(null); }}>
                        <div className="w-full sm:max-w-2xl sm:rounded-3xl rounded-t-[32px] border border-slate-200 dark:border-slate-700 flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden modal-card animate-modal-in">
                            {/* Header modal */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${selectedArticle.type === 'blog' ? 'bg-google-blueLight text-google-blueDark' : 'bg-red-50 text-red-600'}`}>
                                        <Icon name={selectedArticle.type === 'blog' ? 'article' : 'campaign'} className="text-[14px]" fill="true" />
                                    </div>
                                    <span className="text-[11px] font-medium uppercase tracking-widest text-slate-500">{selectedArticle.type === 'blog' ? 'Blog Warga' : 'Pengumuman'}</span>
                                </div>
                                <button onClick={() => setSelectedArticle(null)} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all active:scale-95">
                                    <Icon name="close" className="text-[18px] text-slate-600 dark:text-slate-300" />
                                </button>
                            </div>
                            {/* Gambar */}
                            {selectedArticle.imageUrl && (
                                <div className="w-full h-52 bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
                                    <img src={selectedArticle.imageUrl} alt={selectedArticle.title} className="w-full h-full object-cover" />
                                </div>
                            )}
                            {/* Konten */}
                            <div className="overflow-y-auto flex-1 p-6 sm:p-8 space-y-6">
                                <div className="flex items-center gap-2 text-[10.5px] font-medium text-slate-400">
                                    <Icon name="event" className="text-[13px]" />
                                    <span>{selectedArticle.date ? new Date(selectedArticle.date).toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '-'}</span>
                                    {selectedArticle.likes > 0 && (
                                        <span className="ml-auto flex items-center gap-1 text-red-400"><Icon name="favorite" className="text-[12px]" fill="true" />{selectedArticle.likes} suka</span>
                                    )}
                                </div>
                                <h2 className="text-xl sm:text-2xl font-medium text-slate-900 dark:text-white tracking-tight leading-tight">{selectedArticle.title}</h2>
                                <div className="w-12 h-1 rounded-full bg-google-red"></div>
                                <p className="text-[13.5px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                    {selectedArticle.type === 'blog' ? selectedArticle.content : selectedArticle.description}
                                </p>
                                {/* Komentar blog */}
                                {selectedArticle.type === 'blog' && selectedArticle.comments && selectedArticle.comments.length > 0 && (
                                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mb-3">{selectedArticle.comments.length} Komentar</p>
                                        <div className="space-y-5">
                                            {selectedArticle.comments.map(c => (
                                                <div key={c.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200">{c.name}</span>
                                                        {c.role === 'Admin' && <span className="text-[9px] font-medium bg-google-blue text-white px-1.5 py-0.5 rounded-full">Admin</span>}
                                                    </div>
                                                    <p className="text-[12px] text-slate-600 dark:text-slate-400">{c.text}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Footer modal */}
                            <div className="px-6 sm:px-8 py-5 border-t border-slate-200 dark:border-slate-700 shrink-0">
                                <button onClick={() => onLogin('warga')} className="w-full bg-google-red hover:bg-google-redDark text-white py-3.5 rounded-full font-medium text-[13px] flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all">
                                    <Icon name="login" className="text-[16px]" fill="true" />
                                    Masuk ke Portal Warga untuk Interaksi Lebih
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                </>
            );
        }

        function MainMenu({ userRole, NavItems, changeTab, identity, bannerImage, setShowPwaGuide, sponsorsData, nextMeeting }) {
            return (
                <div className="space-y-8 sm:space-y-8 max-w-7xl mx-auto mt-2">
                    
                    {/* --- AREA BANNER UTAMA --- */}
                    <div className={`relative rounded-3xl sm:rounded-3xl p-6 sm:p-10 text-white border border-red-400/20 shadow-xl shadow-red-500/20 dark:border-red-900/30 overflow-hidden group min-h-[220px] sm:min-h-[280px] flex items-end ${!bannerImage ? 'bg-red-600' : 'bg-slate-900'}`}>
                        {bannerImage && (
                            <>
                                <img src={bannerImage} alt="Banner Lingkungan" className="absolute inset-0 w-full h-full object-cover object-center z-0 group-hover:scale-105 transition-transform duration-1000" />
                                <div className="absolute inset-0 bg-slate-950/65 z-0"></div>
                            </>
                        )}

                        <div className="relative z-10 w-full text-left pb-2">
                            <div className="inline-flex items-center gap-1.5 bg-red-800 px-3.5 py-1.5 rounded-full mb-3 border border-white/20 shadow-sm w-fit">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-medium uppercase tracking-widest text-white/90">Sistem Aktif</span>
                            </div>
                            
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-2 tracking-tight text-white uppercase [text-shadow:_0_4px_12px_rgba(0,0,0,0.4)]">
                                Halo, {userRole === 'admin' ? 'Admin!' : 'Warga!'}
                            </h2>
                            <p className="text-[12.5px] sm:text-[13px] font-medium text-white/95 leading-relaxed max-w-2xl [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
                                {identity.subtitle}
                            </p>
                        </div>
                    </div>
                    {/* --- AKHIR AREA BANNER --- */}

                    {/* --- AREA RUNNING TEXT AGENDA --- */}
                    {nextMeeting && nextMeeting.date && nextMeeting.date !== 'Belum dijadwalkan' && (
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded-full px-4 py-2 flex items-center gap-3 overflow-hidden shadow-sm mt-4">
                            <Icon name="campaign" className="text-red-600 shrink-0 animate-pulse text-[17px]" />
                            <marquee className="text-[12px] font-medium tracking-wide whitespace-nowrap uppercase">
                                Info Agenda Mendatang: <span className="font-medium text-red-700">{nextMeeting.date}</span> jam <span className="font-medium text-red-700">{nextMeeting.time}</span> di <span className="font-medium text-red-700">{nextMeeting.location}</span>. Agenda: {nextMeeting.notes}
                            </marquee>
                        </div>
                    )}

                    {/* AREA GRID MENU */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 mt-6">
                            {NavItems.map((item, idx) => (
                            <button key={item.id} onClick={() => changeTab(item.id)} style={{ animationDelay: `${idx * 0.05}s` }} className="menu-item-in relative overflow-hidden bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-600 hover:-translate-y-1.5 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3 active:scale-95 group">
                                <div className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 shadow-sm group-hover:shadow-md border border-white/60 ${item.bg} ${item.color.replace('border', '')}`}>
                                    <Icon name={item.icon} className="relative z-10 text-[26px] sm:text-[30px] drop-shadow-sm" fill="true" />
                                </div>
                                
                                <span className="relative z-10 text-[12.5px] sm:text-[13px] font-medium text-google-textVariant group-hover:text-google-blueDark transition-colors tracking-tight">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* ORNAMEN PEMBATAS KERATON */}
                    <div className="w-full flex justify-center py-6 sm:py-8 opacity-40 dark:opacity-30 dark:invert pointer-events-none no-print">
                        <img src="./keraton_divider_transparent.png?v=2" alt="Pembatas Keraton" className="w-full max-w-sm h-auto" />
                    </div>


    
                    {userRole !== 'admin' && (
                        <div className="flex justify-center mt-16 mb-4">
                            <div className="bg-white py-2 px-4 rounded-full text-center border border-slate-200 shadow-sm flex items-center justify-center">
                                <p className="text-[10px] font-medium text-google-textVariant flex flex-wrap items-center justify-center gap-1.5"><Icon name="info" className="text-[13px]" /> Mode Warga (akses terbatas).</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function WaktuSholatWidget() {
            const DEFAULT_LAT = -7.8246;
            const DEFAULT_LNG = 112.0792;
            const DEFAULT_CITY = 'Gurah, Kediri';

            const [city, setCity] = useState(() => localStorage.getItem('sholat_city_name') || DEFAULT_CITY);
            const [coords, setCoords] = useState(() => {
                const lat = localStorage.getItem('sholat_lat');
                const lng = localStorage.getItem('sholat_lng');
                return lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
            });
            const [isGPS, setIsGPS] = useState(() => localStorage.getItem('sholat_is_gps') === 'true');

            const [schedule, setSchedule] = useState(() => {
                try {
                    const cached = localStorage.getItem('sholat_schedule_today');
                    return cached ? JSON.parse(cached) : null;
                } catch(e) { return null; }
            });
            const [searchQuery, setSearchQuery] = useState('');
            const [searchResults, setSearchResults] = useState([]);
            const [isSearching, setIsSearching] = useState(false);
            const [loading, setLoading] = useState(false);
            const [nextPrayer, setNextPrayer] = useState(null);
            const [timeRemaining, setTimeRemaining] = useState('');
            const [adzanEnabled, setAdzanEnabled] = useState(() => localStorage.getItem('sholat_adzan_enabled') === 'true');
            const lastAdzanPlayed = useRef(null);

            const fetchByCoords = useCallback(async (lat, lng) => {
                setLoading(true);
                const now = new Date();
                const d = String(now.getDate()).padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = now.getFullYear();

                try {
                    const res = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${lat}&longitude=${lng}&method=11`);
                    const data = await res.json();
                    if (data && data.code === 200 && data.data && data.data.timings) {
                        const t = data.data.timings;
                        const todayJadwal = {
                            tanggal: `${d}/${m}/${y}`,
                            imsak: t.Imsak,
                            subuh: t.Fajr,
                            dzuhur: t.Dhuhr,
                            ashar: t.Asr,
                            maghrib: t.Maghrib,
                            isya: t.Isha
                        };
                        setSchedule(todayJadwal);
                        localStorage.setItem('sholat_schedule_today', JSON.stringify(todayJadwal));
                    }
                } catch (e) {
                    console.warn("Gagal mengambil jadwal sholat Aladhan:", e);
                } finally {
                    setLoading(false);
                }
            }, []);

            const fetchByCityId = useCallback(async (cId) => {
                setLoading(true);
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                
                try {
                    const res = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cId}/${y}/${m}/${d}`);
                    const data = await res.json();
                    if (data && data.status && data.data && data.data.jadwal) {
                        const todayJadwal = data.data.jadwal;
                        setSchedule(todayJadwal);
                        localStorage.setItem('sholat_schedule_today', JSON.stringify(todayJadwal));
                    }
                } catch (e) {
                    console.warn("Gagal mengambil jadwal sholat Kemenag:", e);
                } finally {
                    setLoading(false);
                }
            }, []);

            const handleGPSDetection = () => {
                if (!navigator.geolocation) {
                    showToast('Geolokasi tidak didukung oleh browser Anda.', 'error');
                    return;
                }
                setLoading(true);
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        setCoords({ lat, lng });
                        setIsGPS(true);
                        setCity('Lokasi GPS Aktif');
                        localStorage.setItem('sholat_lat', lat);
                        localStorage.setItem('sholat_lng', lng);
                        localStorage.setItem('sholat_is_gps', 'true');
                        localStorage.setItem('sholat_city_name', 'Lokasi GPS Aktif');
                        fetchByCoords(lat, lng);
                        showToast('Berhasil mendeteksi lokasi GPS perangkat.');
                    },
                    (error) => {
                        console.error(error);
                        showToast('Gagal mengakses GPS. Pastikan izin lokasi aktif.', 'error');
                        setLoading(false);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            };

            const handleSearchCity = async (e) => {
                e.preventDefault();
                if (!searchQuery.trim()) return;
                setIsSearching(true);
                try {
                    const res = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${searchQuery.trim()}`);
                    const data = await res.json();
                    if (data && data.status && Array.isArray(data.data)) {
                        setSearchResults(data.data);
                    } else {
                        setSearchResults([]);
                    }
                } catch (e) {
                    console.error(e);
                    showToast('Gagal mencari kota. Coba lagi.', 'error');
                } finally {
                    setIsSearching(false);
                }
            };

            const selectCity = (selectedCity) => {
                setCity(selectedCity.lokasi);
                setIsGPS(false);
                localStorage.setItem('sholat_city_name', selectedCity.lokasi);
                localStorage.setItem('sholat_is_gps', 'false');
                localStorage.removeItem('sholat_lat');
                localStorage.removeItem('sholat_lng');
                setSearchResults([]);
                setSearchQuery('');
                fetchByCityId(selectedCity.id);
            };

            useEffect(() => {
                if (isGPS) {
                    fetchByCoords(coords.lat, coords.lng);
                } else {
                    if (city === DEFAULT_CITY) {
                        fetchByCoords(DEFAULT_LAT, DEFAULT_LNG);
                    } else {
                        const savedCityId = localStorage.getItem('sholat_city_id') || '1609';
                        fetchByCityId(savedCityId);
                    }
                }
            }, [isGPS, coords, fetchByCoords, fetchByCityId, city]);

            useEffect(() => {
                if (!schedule) return;

                const timer = setInterval(() => {
                    const now = new Date();
                    const prayerTimes = [
                        { name: 'Imsak', time: schedule.imsak },
                        { name: 'Subuh', time: schedule.subuh },
                        { name: 'Dzuhur', time: schedule.dzuhur },
                        { name: 'Ashar', time: schedule.ashar },
                        { name: 'Maghrib', time: schedule.maghrib },
                        { name: 'Isya', time: schedule.isya }
                    ];

                    let upcoming = null;
                    let minDiff = Infinity;

                    prayerTimes.forEach(p => {
                        if (!p.time) return;
                        const [hours, minutes] = p.time.split(':').map(Number);
                        const pDate = new Date();
                        pDate.setHours(hours, minutes, 0, 0);

                        const diff = pDate - now;
                        if (diff > 0 && diff < minDiff) {
                            minDiff = diff;
                            upcoming = { ...p, timeObj: pDate, diff };
                        }
                    });

                    if (!upcoming) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const [hours, minutes] = schedule.imsak.split(':').map(Number);
                        const pDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), hours, minutes, 0, 0);
                        const diff = pDate - now;
                        upcoming = { name: 'Imsak (Besok)', time: schedule.imsak, timeObj: pDate, diff };
                    }

                    setNextPrayer(upcoming);

                    const totalSecs = Math.floor(upcoming.diff / 1000);
                    const hrs = Math.floor(totalSecs / 3600);
                    const mins = Math.floor((totalSecs % 3600) / 60);
                    const secs = totalSecs % 60;
                    
                    const timeStr = `${hrs > 0 ? hrs + 'j ' : ''}${mins}m ${secs}s`;
                    setTimeRemaining(timeStr);

                    // Cek Notifikasi Adzan
                    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const currentPrayer = prayerTimes.find(p => p.time === nowTimeStr && p.name !== 'Imsak');
                    if (currentPrayer) {
                        const adzanKey = `${schedule.tanggal}-${currentPrayer.name}`;
                        if (lastAdzanPlayed.current !== adzanKey) {
                            lastAdzanPlayed.current = adzanKey;
                            const isAdzanActive = localStorage.getItem('sholat_adzan_enabled') === 'true';
                            if (isAdzanActive) {
                                try {
                                    const audio = new Audio('https://www.islamcan.com/audio/adhan/azan1.mp3');
                                    audio.play().catch(e => console.warn("Auto-play Adzan diblokir browser:", e));
                                    
                                    if ("Notification" in window && Notification.permission === "granted") {
                                        new Notification("Waktu Sholat", {
                                            body: `Telah masuk waktu sholat ${currentPrayer.name} untuk wilayah ${city}`
                                        });
                                    }
                                } catch(err) {
                                    console.error("Gagal memutar adzan:", err);
                                }
                            }
                        }
                    }
                }, 1000);

                return () => clearInterval(timer);
            }, [schedule]);

            if (!schedule) {
                return (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[13px] font-medium text-google-textVariant">Memuat Jadwal Sholat...</p>
                        </div>
                    </div>
                );
            }

            const prayers = [
                { id: 'imsak', name: 'Imsak', time: schedule.imsak, icon: 'wb_twilight' },
                { id: 'subuh', name: 'Subuh', time: schedule.subuh, icon: 'nights_stay' },
                { id: 'dzuhur', name: 'Dzuhur', time: schedule.dzuhur, icon: 'wb_sunny' },
                { id: 'ashar', name: 'Ashar', time: schedule.ashar, icon: 'light_mode' },
                { id: 'maghrib', name: 'Maghrib', time: schedule.maghrib, icon: 'wb_twilight' },
                { id: 'isya', name: 'Isya', time: schedule.isya, icon: 'dark_mode' }
            ];

            return (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Icon name="mosque" className="text-red-600 text-[20px]" fill="true"/>
                                <h3 className="text-[16px] font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                    Jadwal Sholat {city}
                                    {isGPS && <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-lg font-medium border border-red-200">GPS</span>}
                                </h3>
                            </div>
                            <p className="text-[11px] font-medium text-google-textVariant mt-0.5">Metode Kemenag RI G Hari ini: {schedule.tanggal}</p>
                        </div>

                        <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    const newVal = !adzanEnabled;
                                    setAdzanEnabled(newVal);
                                    localStorage.setItem('sholat_adzan_enabled', newVal ? 'true' : 'false');
                                    if (newVal) {
                                        if ("Notification" in window && Notification.permission !== "granted") {
                                            Notification.requestPermission();
                                        }
                                        // window.showToast defined globally? The component uses showToast
                                        if (typeof showToast === 'function') {
                                            showToast('Notifikasi & Suara Adzan diaktifkan');
                                        }
                                    } else {
                                        if (typeof showToast === 'function') {
                                            showToast('Notifikasi Adzan dinonaktifkan');
                                        }
                                    }
                                }}
                                className={`flex items-center gap-1.5 font-medium text-[11px] px-5 py-2.5 rounded-full border transition-all active:scale-95 ${
                                    adzanEnabled 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-500/30' 
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <Icon name={adzanEnabled ? "notifications_active" : "notifications_off"} className="text-[14px]"/>
                                {adzanEnabled ? 'Adzan Aktif' : 'Adzan Mati'}
                            </button>

                            <button 
                                type="button" 
                                onClick={handleGPSDetection}
                                className={`flex items-center gap-1.5 font-medium text-[11px] px-5 py-2.5 rounded-full border transition-all active:scale-95 ${
                                    isGPS 
                                        ? 'bg-red-50 text-red-600 border-red-500/40' 
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <Icon name="my_location" className="text-[14px]"/>
                                {loading ? 'GPS...' : 'Gunakan GPS'}
                            </button>

                            <form onSubmit={handleSearchCity} className="flex flex-wrap items-center gap-2 md:flex-initial">
                                <div className="bg-slate-50 border border-slate-200 focus-within:border-red-500 rounded-full px-4 py-1.5 flex items-center gap-2 flex-1 md:w-56 shadow-sm">
                                    <Icon name="search" className="text-[14px] text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Cari Kota..."
                                        className="bg-transparent border-none outline-none text-[12.5px] font-medium w-full text-google-text placeholder:text-slate-400"
                                    />
                                </div>
                                <button type="submit" disabled={isSearching} className="bg-red-600 text-white font-medium text-[11px] px-5 py-2.5 rounded-full border border-red-700 hover:bg-red-700 shadow-sm active:scale-95 transition-all">
                                    {isSearching ? '...' : 'Cari'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="relative">
                            <div className="absolute top-0 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 max-h-48 overflow-y-auto hide-scrollbar p-2 space-y-1">
                                {searchResults.map(res => (
                                    <button 
                                        key={res.id} 
                                        onClick={() => selectCity(res)}
                                        className="w-full text-left px-4 py-2.5 rounded-full hover:bg-red-50 hover:text-red-700 font-medium text-[12px] text-google-text transition-colors"
                                    >
                                        {res.lokasi}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {nextPrayer && (
                        <div className="bg-red-50/70 dark:bg-red-950/40 border border-red-500/30 dark:border-red-500/20 p-6 sm:p-8 md:p-8 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="w-11 h-11 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"><Icon name="alarm" className="text-[18px]"/></div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-medium text-red-800 dark:text-red-200">Sholat Berikutnya</p>
                                    <h4 className="text-[14px] font-medium text-red-700 dark:text-red-300 mt-0.5">{nextPrayer.name} pukul {nextPrayer.time}</h4>
                                </div>
                            </div>
                            <div className="bg-white/80 dark:bg-red-900/40 border border-red-500/30 dark:border-red-500/30 px-5 py-2.5 rounded-xl shadow-sm text-center">
                                <span className="text-[11px] font-medium text-red-800 dark:text-red-200 uppercase tracking-wider block">Waktu Mundur</span>
                                <span className="text-[13px] font-medium text-red-600 dark:text-red-300 font-mono">{timeRemaining}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
                        {prayers.map(p => {
                            const isUpcoming = nextPrayer && nextPrayer.name.includes(p.name);
                            return (
                                <div 
                                    key={p.id}
                                    className={`p-4 rounded-2xl border text-center transition-all duration-300 ${
                                        isUpcoming 
                                            ? 'bg-red-600 border-red-700 text-white shadow-lg scale-105 z-10' 
                                            : 'bg-slate-50 border-slate-200/60 hover:bg-white hover:border-red-500/40 text-google-text'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-3 ${isUpcoming ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-200 shadow-sm'}`}>
                                        <Icon name={p.icon} className="text-[17px]" fill="true"/>
                                    </div>
                                    <p className={`text-[11px] font-medium ${isUpcoming ? 'text-white' : 'text-google-textVariant'}`}>{p.name}</p>
                                    <p className={`text-[14px] font-medium mt-1 font-mono ${isUpcoming ? 'text-white' : 'text-google-text'}`}>{p.time}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        function Dashboard({ members, setMembers, jimpitanBalance, kasRtBalance, currentRound, setCurrentRound, userRole, cycleNumber, setCycleNumber, changeTab, arisanPeriod }) {
            const [showResetModal, setShowResetModal] = useState(false);
            const totalDebt = members.reduce((sum, m) => sum + Number(m.debt || 0), 0);
            const redRecords = members.filter(m => m.redRecord).length;
            const arisanMembers = members.filter(m => m.status === 'Normal' && m.program !== 'IuranOnly');
            const winnersCount = arisanMembers.filter(m => m.hasWon).length;
            const isCycleComplete = winnersCount >= arisanMembers.length && arisanMembers.length > 0;
            const saldoEfektifJimpitan = Number(jimpitanBalance || 0) + totalDebt;

            return (
                <div className="space-y-7 sm:space-y-8">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
                        <div>
                            <span className="inline-flex items-center px-3.5 py-1.5 rounded-md text-[9px] font-medium uppercase tracking-widest bg-google-blueLight text-google-blueDark mb-3 border border-google-blue/30">Siklus {cycleNumber}</span>
                            <h2 className="text-3xl sm:text-4xl font-medium text-google-text leading-tight tracking-tight">Putaran {currentRound}</h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-2 flex flex-wrap items-center gap-1.5"><Icon name="event" className="text-[16px]" /> {formatBulanTahun(arisanPeriod)}</p>
                        </div>
                        <div className="bg-slate-50 px-6 py-5 rounded-3xl w-full sm:w-72 max-w-full border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-end mb-3">
                                <p className="text-[11px] text-google-textVariant font-medium uppercase tracking-wider">Progres Pemenang</p>
                                <p className="text-xl font-medium text-google-blueDark leading-none">{winnersCount} <span className="text-[13px] text-google-textVariant">/ {arisanMembers.length}</span></p>
                            </div>
                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-google-blue h-full rounded-full transition-all duration-1000" style={{ width: `${(winnersCount / (arisanMembers.length || 1)) * 100}%` }}></div></div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-700 relative overflow-hidden group cursor-default">
                        
                        

                        <div className="relative z-10 w-full text-center sm:text-left">
                            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[9px] font-medium uppercase tracking-widest bg-white/10 text-slate-200 mb-3 border border-white/20 shadow-sm">
                                <Icon name="account_balance_wallet" className="text-[13px]" /> Total Dana Kelolaan Global
                            </span>
                            <p className="text-4xl sm:text-5xl font-medium text-white tracking-tight drop-shadow-md">{formatRp(Number(kasRtBalance || 0) + Number(jimpitanBalance || 0))}</p>
                            <p className="text-[12px] text-slate-400 font-medium mt-2">Gabungan Total Saldo Aktif Kas Utama RT + Kas Jimpitan Tunai.</p>
                        </div>
                    </div>
                    
                    {isCycleComplete && userRole === 'admin' && (
                        <div className="bg-google-blueLight p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:text-left text-center gap-6 border border-google-blue shadow-sm">
                            <div className="bg-google-blue text-white w-16 h-16 rounded-full flex items-center justify-center shadow-md border border-google-blueDark shrink-0"><Icon name="task_alt" className="text-[32px]" fill="true" /></div>
                            <div className="flex-1"><h3 className="font-medium text-google-blueDark text-xl mb-1.5">Siklus Telah Selesai</h3><p className="text-[13px] font-medium text-google-blue">Seluruh warga arisan telah memenangkan putaran. Silakan mulai siklus baru.</p></div>
                            <button onClick={() => setShowResetModal(true)} className="w-full sm:w-auto px-8 py-3.5 bg-google-blue text-white font-medium rounded-full text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="refresh" className="text-[17px]"/> Mulai Baru</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-blue/50 transition-all duration-300 group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[10px] font-medium uppercase tracking-widest text-google-textVariant block mb-2">Kas Utama RT</span><p className="text-3xl font-medium text-google-text group-hover:text-google-blue transition-colors tracking-tight">{formatRp(kasRtBalance)}</p></div>
                                <div className="bg-google-blueLight text-google-blueDark w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border border-google-blue/30"><Icon name="account_balance" className="text-[24px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('kas')} className="w-full bg-white text-google-text border border-slate-200 font-medium py-3.5 rounded-full text-[12px] hover:bg-slate-50 hover:border-google-blue hover:text-google-blue transition-all duration-300 active:scale-95 shadow-sm flex flex-wrap items-center justify-center gap-2">Rincian Kas</button>
                        </div>
                        
                        <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-green/50 transition-all duration-300 group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[10px] font-medium uppercase tracking-widest text-google-textVariant block mb-2">Kas Jimpitan Tunai</span><p className="text-3xl font-medium text-google-text group-hover:text-google-green transition-colors tracking-tight">{formatRp(jimpitanBalance)}</p></div>
                                <div className="bg-google-greenLight text-google-greenDark w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border border-google-green/30"><Icon name="savings" className="text-[24px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('laporan')} className="w-full bg-white text-google-text border border-slate-200 font-medium py-3.5 rounded-full text-[12px] hover:bg-slate-50 hover:border-google-green hover:text-google-green transition-all duration-300 active:scale-95 shadow-sm flex flex-wrap items-center justify-center gap-2">Riwayat Arisan</button>
                        </div>

                        <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-red/50 transition-all duration-300 group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[10px] font-medium uppercase tracking-widest text-google-textVariant block mb-2">Tunggakan Total</span><p className="text-3xl font-medium text-google-text group-hover:text-google-red transition-colors tracking-tight">{formatRp(totalDebt)}</p></div>
                                <div className="bg-google-redLight text-google-redDark w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border border-google-red/30"><Icon name="money_off" className="text-[24px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('warga')} className="w-full bg-white text-google-text border border-slate-200 font-medium py-3.5 rounded-full text-[12px] hover:bg-slate-50 hover:border-google-red hover:text-google-red transition-all duration-300 active:scale-95 shadow-sm flex flex-wrap items-center justify-center gap-2">Cek Penunggak</button>
                        </div>
                    </div>

                    <div className="bg-google-yellowLight border border-google-yellow/40 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm hover:shadow-md transition-shadow">
                        <div><p className="text-[10px] font-medium text-google-yellowDark uppercase tracking-widest mb-1.5">Total Saldo Efektif Jimpitan</p><p className="text-3xl font-medium text-google-yellowDark tracking-tight">{formatRp(saldoEfektifJimpitan)}</p></div>
                        <div className="flex flex-wrap items-center gap-3 bg-white/80  px-5 py-4 rounded-3xl border border-google-yellow/30 shadow-sm"><Icon name="info" className="text-[20px] text-google-yellowDark shrink-0" /><p className="text-[12px] font-medium text-google-yellowDark max-w-[220px] max-w-full leading-relaxed">Akumulasi aset utuh (Kas Tunai + Piutang Warga).</p></div>
                    </div>

                    {redRecords > 0 && (
                        <div className="bg-google-red text-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl flex items-start space-x-5 border border-google-redDark shadow-lg hover:shadow-xl transition-shadow animate-pulse" style={{ animationDuration: '3s' }}>
                            <Icon name="warning" className="text-[36px] shrink-0 drop-shadow-md" fill="true" />
                            <div><h4 className="text-[16px] font-medium mb-1.5 tracking-tight">Peringatan: Tunggakan Terdeteksi</h4><p className="text-[13px] font-medium text-red-50 leading-relaxed">Terdapat <span className="underline underline-offset-2">{redRecords} warga</span> dengan catatan rapor merah.</p></div>
                        </div>
                    )}

                    {showResetModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-left border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-blueLight w-16 h-16 rounded-full flex items-center justify-center border border-google-blue/30"><Icon name="refresh" className="text-[32px] text-google-blue" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2">Mulai Siklus Baru?</h3>
                                <div className="text-[13px] font-medium text-google-textVariant mb-8 space-y-5 bg-slate-50 p-6 sm:p-8 md:p-8 rounded-3xl border border-slate-200"><p className="flex flex-wrap gap-2.5 items-start"><Icon name="check_circle" className="text-[16px] text-google-green shrink-0 mt-0.5"/><span className="leading-relaxed">Saldo Kas & Tunggakan <b className="text-google-text">TIDAK DIRESET</b>.</span></p><p className="flex flex-wrap gap-2.5 items-start"><Icon name="check_circle" className="text-[16px] text-google-green shrink-0 mt-0.5"/><span className="leading-relaxed">Status menang warga akan dibersihkan ke awal.</span></p></div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setShowResetModal(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { 
                                        setMembers(members.map(m => m.program === 'IuranOnly' ? m : { ...m, hasWon: false, wonRound: null })); 
                                        setCurrentRound(1); 
                                        setCycleNumber(prev => (prev || 1) + 1); 
                                        setShowResetModal(false); 
                                        showToast('Siklus baru berhasil dimulai.'); 
                                    }} className="flex-1 bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300">Bersihkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        function Inventaris({ data, setData, userRole, pinjamData }) {
            // formData kini punya kondisi per tipe: qty_baru, qty_bekas, qty_rusak
            const [formData, setFormData] = useState({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' });
            const [editingId, setEditingId] = useState(null);
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);

            // Helper: hitung total stok dari kondisi
            const getTotalStok = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0) + (item.kondisi?.rusak || 0);
            // Helper: hitung stok yang bisa dipinjam (baru + bekas saja)
            const getStokPinjam = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0);

            const handleSave = () => {
                if (!formData.name.trim()) return setErrorMsg('Nama barang wajib diisi!');
                const k = formData.kondisi;
                const totalQty = (k.baru || 0) + (k.bekas || 0) + (k.rusak || 0);
                if (totalQty <= 0) return setErrorMsg('Jumlah barang minimal 1 unit (isi salah satu kondisi)!');

                const imgUrl = formData.imageUrl || '';

                const itemData = {
                    name: formData.name.trim(),
                    kondisi: { baru: k.baru || 0, bekas: k.bekas || 0, rusak: k.rusak || 0 },
                    qty: totalQty,
                    qtyPinjam: (k.baru || 0) + (k.bekas || 0),
                    imageUrl: imgUrl,
                };

                const savedId = editingId;
                if (savedId) {
                    // Gunakan functional updater agar selalu pakai state terbaru
                    setData(prev => prev.map(item => item.id === savedId ? { ...item, ...itemData } : item));
                    showToast('Data inventaris berhasil diperbarui.');
                } else {
                    const newId = Date.now();
                    // Gunakan functional updater agar selalu pakai state terbaru
                    setData(prev => [{ id: newId, ...itemData }, ...prev]);
                    showToast('Barang baru berhasil ditambahkan.');
                }
                setIsFormOpen(false);
                setErrorMsg('');
            };

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return setErrorMsg('Ukuran foto maksimal 2MB!');
                setIsUploading(true);
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.85);
                    setFormData(prev => ({...prev, imageUrl: url}));
                } catch (error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const openEditForm = (item) => {
                setFormData({
                    name: item.name,
                    kondisi: item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 }, // backward compat data lama
                    imageUrl: item.imageUrl || '',
                });
                setEditingId(item.id);
                setIsFormOpen(true);
                setErrorMsg('');
                setIsUploading(false);
            };

            const KondisiInput = ({ label, field, color, icon }) => (
                <div className={`flex items-center justify-between bg-slate-50 border ${color} rounded-xl px-4 py-3`}>
                    <div className="flex flex-wrap items-center gap-2">
                        <Icon name={icon} className="text-[16px]" />
                        <span className="text-[12px] font-medium text-google-text">{label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setFormData(p => ({...p, kondisi: {...p.kondisi, [field]: Math.max(0, (p.kondisi[field]||0)-1)}}))}
                            className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-medium text-[16px] text-google-text hover:bg-slate-100 active:scale-95 transition-all">G</button>
                        <span className="w-8 text-center font-medium text-[14px] text-google-text">{formData.kondisi[field] || 0}</span>
                        <button type="button" onClick={() => setFormData(p => ({...p, kondisi: {...p.kondisi, [field]: (p.kondisi[field]||0)+1}}))}
                            className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-medium text-[16px] text-google-text hover:bg-slate-100 active:scale-95 transition-all">+</button>
                    </div>
                </div>
            );

            return (
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 no-print">
                        <div>
                            <h2 className="text-2xl font-medium text-google-text tracking-tight">Aset &amp; Inventaris</h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1.5">Daftar barang fasilitas RT beserta kondisi dan stok pinjam.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setFormData({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="flex flex-wrap items-center gap-2 bg-google-yellow text-white px-6 py-3 rounded-full font-medium text-[13px] border border-google-yellowDark shadow-md hover:bg-google-yellowDark active:scale-95 transition-all shrink-0">
                                <Icon name="add" className="text-[17px]" />Tambah Barang
                            </button>
                        )}
                    </div>

                    {/* Grid kartu barang */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                        {data.map(item => {
                            const kondisi = item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 };
                            const totalStok   = getTotalStok({kondisi});
                            const stokPinjam  = getStokPinjam({kondisi});
                            const sedangDipinjam = pinjamData ? pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').length : 0;
                            const tersedia    = Math.max(0, stokPinjam - sedangDipinjam);
                            return (
                                <div key={item.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-google-yellow/40 transition-all duration-300 flex flex-col group relative">
                                    {/* Foto */}
                                    <div className="w-full relative shrink-0 border-b border-slate-200 overflow-hidden" style={{height:'200px'}}>
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" alt={item.name} onError={(e) => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }} />
                                            : <div className="w-full h-full bg-slate-50 flex items-center justify-center"><Icon name="inventory_2" className="text-[64px] text-slate-300" /></div>
                                        }
                                        {/* Badge status pinjam */}
                                        {sedangDipinjam > 0 && (
                                            <div className="absolute top-3 left-3 bg-google-red text-white px-2.5 py-1 rounded-lg font-medium text-[9px] shadow-sm flex flex-wrap items-center gap-1 uppercase tracking-wider"><Icon name="handshake" className="text-[11px]" />{sedangDipinjam} Dipinjam</div>
                                        )}
                                        {/* Badge total stok */}
                                        <div className="absolute top-3 right-3 bg-white/95  text-google-text px-3 py-1.5 rounded-lg font-medium text-[11px] shadow-sm border border-slate-200 flex flex-wrap items-center gap-1.5">
                                            <Icon name="tag" className="text-[13px] text-google-yellowDark" />{totalStok} unit
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-6 sm:p-8 md:p-8 flex flex-col gap-3">
                                        <h3 className="text-[15px] font-medium text-google-text leading-snug tracking-tight group-hover:text-google-yellowDark transition-colors">{item.name}</h3>

                                        {/* Kondisi chips */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {kondisi.baru > 0 && <span className="text-[10px] font-medium bg-google-greenLight text-google-greenDark border border-google-green/30 px-2.5 py-1 rounded-lg flex flex-wrap items-center gap-1"><Icon name="verified" className="text-[11px]" />Baru: {kondisi.baru}</span>}
                                            {kondisi.bekas > 0 && <span className="text-[10px] font-medium bg-google-yellowLight text-google-yellowDark border border-google-yellow/30 px-2.5 py-1 rounded-lg flex flex-wrap items-center gap-1"><Icon name="refresh" className="text-[11px]" />Bekas: {kondisi.bekas}</span>}
                                            {kondisi.rusak > 0 && <span className="text-[10px] font-medium bg-google-redLight text-google-redDark border border-google-red/30 px-2.5 py-1 rounded-lg flex flex-wrap items-center gap-1"><Icon name="report" className="text-[11px]" />Rusak: {kondisi.rusak}</span>}
                                        </div>

                                        {/* Stok pinjam */}
                                        <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${tersedia > 0 ? 'bg-google-greenLight/60 border-google-green/30' : 'bg-google-redLight/60 border-google-red/30'}`}>
                                            <span className="text-[11px] font-medium text-google-textVariant">Dapat Dipinjam</span>
                                            <span className={`text-[12px] font-medium ${tersedia > 0 ? 'text-google-greenDark' : 'text-google-red'}`}>{tersedia > 0 ? `${tersedia} tersedia` : 'Tidak tersedia'}</span>
                                        </div>
                                        {/* Detail daftar peminjam aktif */}
                                        {pinjamData && pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').length > 0 && (
                                            <div className="bg-google-redLight/40 border border-google-red/30 rounded-xl px-3.5 py-2.5 space-y-1.5">
                                                <p className="text-[10px] font-medium text-google-redDark uppercase tracking-wider flex flex-wrap items-center gap-1"><Icon name="handshake" className="text-[12px]" />Sedang Dipinjam:</p>
                                                {pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').map((p, i) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <span className="text-[11px] font-medium text-google-text truncate flex flex-wrap items-center gap-1.5"><Icon name="person" className="text-[12px] text-google-textVariant" />{p.namaWarga}</span>
                                                        <span className="text-[10px] font-medium text-google-red shrink-0 ml-2 bg-white px-2 py-0.5 rounded-lg border border-google-red/30">{p.qty || 1} unit</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tombol admin */}
                                        {userRole === 'admin' && (
                                            <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
                                                <button onClick={() => openEditForm(item)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95"><Icon name="edit" className="text-[14px]" /> Edit</button>
                                                <button onClick={() => setDeleteConfirmId(item.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95"><Icon name="delete" className="text-[14px]" /> Hapus</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {data.length === 0 && (
                            <div className="col-span-full bg-white border border-slate-200 p-12 text-center rounded-3xl shadow-sm">
                                <Icon name="inventory_2" className="text-[56px] text-slate-300 mb-4 mx-auto" />
                                <h3 className="text-[17px] font-medium text-google-text mb-2">Belum Ada Inventaris</h3>
                                <p className="text-[13px] font-medium text-google-textVariant">Tambahkan barang inventaris RT yang pertama.</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Form Tambah/Edit */}
                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 my-4 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit Inventaris' : 'Tambah Inventaris'}</h3>
                                <div className="space-y-7">

                                    {/* Nama barang */}
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Nama Barang *</label>
                                        <input type="text" value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setErrorMsg(''); }} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Contoh: Speaker Aktif, Tenda Hajatan..." />
                                    </div>

                                    {/* Kondisi barang */}
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Jumlah per Kondisi</label>
                                        <div className="space-y-2.5">
                                            <KondisiInput label="= Kondisi Baru" field="baru" color="border-google-green/40 focus-within:border-google-green" icon="verified" />
                                            <KondisiInput label="= Kondisi Bekas" field="bekas" color="border-google-yellow/40 focus-within:border-google-yellow" icon="refresh" />
                                            <KondisiInput label="= Kondisi Rusak" field="rusak" color="border-google-red/40 focus-within:border-google-red" icon="report" />
                                        </div>
                                        {/* Ringkasan */}
                                        {((formData.kondisi.baru||0)+(formData.kondisi.bekas||0)+(formData.kondisi.rusak||0)) > 0 && (
                                            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap gap-x-4 gap-y-1">
                                                <span className="text-[11px] font-medium text-google-text">Total: {(formData.kondisi.baru||0)+(formData.kondisi.bekas||0)+(formData.kondisi.rusak||0)} unit</span>
                                                <span className="text-[11px] font-medium text-google-greenDark">Bisa dipinjam: {(formData.kondisi.baru||0)+(formData.kondisi.bekas||0)} unit</span>
                                                {(formData.kondisi.rusak||0) > 0 && <span className="text-[11px] font-medium text-google-red">Tidak dipinjamkan: {formData.kondisi.rusak} unit (rusak)</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Foto (opsional) */}
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Foto Aset <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : formData.imageUrl ? <img src={formData.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="preview" /> : <Icon name="cloud_upload" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text">{isUploading ? 'Mengunggah...' : formData.imageUrl ? 'Foto Tersimpan G' : 'Pilih Gambar'}</p>
                                                <p className="text-[11px] text-google-textVariant">{formData.imageUrl ? 'Klik untuk ganti foto' : 'Maks. 2MB G JPG, PNG, WEBP'}</p>
                                            </div>
                                            {formData.imageUrl && <button type="button" onClick={e => { e.stopPropagation(); setFormData(p=>({...p,imageUrl:''})); }} className="relative z-20 text-google-red bg-white border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center text-[14px] hover:bg-google-redLight active:scale-95 shrink-0">+</button>}
                                        </div>
                                    </div>

                                    {errorMsg && <div className="bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-xl text-[12px] font-medium flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px]" />{errorMsg}</div>}
                                </div>

                                <div className="flex flex-wrap gap-3 mt-6">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 bg-google-yellow text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-yellowDark shadow-md hover:bg-google-yellowDark active:scale-95 transition-all disabled:opacity-50">Simpan</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal konfirmasi hapus */}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Barang?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Barang ini akan dihapus permanen dari daftar inventaris RT.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { const idToDelete = deleteConfirmId; setData(prev => prev.filter(item => item.id !== idToDelete)); setDeleteConfirmId(null); showToast('Barang berhasil dihapus.'); }} className="flex-1 bg-google-red text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function PinjamInventaris({ inventarisData, setInventarisData, pinjamData, setPinjamData, members, userRole }) {
            const [view, setView] = useState('list');          // 'list' | 'form' | 'admin'
            const [formData, setFormData] = useState({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [konfirmReturnId, setKonfirmReturnId] = useState(null);
            const [konfirmRejectId, setKonfirmRejectId] = useState(null);

            // Hitung stok tersedia untuk dipinjam (hanya Baru + Bekas, minus total qty yang sudah dipinjam)
            const getStokTersedia = (itemId) => {
                const item = inventarisData.find(i => i.id === itemId);
                if (!item) return 0;
                // qtyPinjam = baru + bekas (rusak tidak dipinjamkan)
                const stokPinjam = item.qtyPinjam !== undefined
                    ? item.qtyPinjam
                    : ((item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0)) || (item.qty || 1);
                // Kurangi berdasarkan JUMLAH (qty) yang dipinjam, bukan jumlah record
                const totalDipinjam = pinjamData
                    .filter(p => p.itemId === itemId && p.status === 'approved')
                    .reduce((sum, p) => sum + (p.qty || 1), 0);
                return Math.max(0, stokPinjam - totalDipinjam);
            };

            const handleSubmitPinjam = () => {
                if (!formData.namaWarga.trim()) return setErrorMsg('Nama warga wajib diisi!');
                if (!formData.itemId) return setErrorMsg('Pilih barang yang akan dipinjam!');
                if (!formData.keperluan.trim()) return setErrorMsg('Keperluan / nama acara wajib diisi!');
                if (!formData.tanggalPinjam) return setErrorMsg('Tanggal pinjam wajib diisi!');
                if (!formData.tanggalKembali) return setErrorMsg('Perkiraan tanggal kembali wajib diisi!');
                if (formData.tanggalKembali < formData.tanggalPinjam) return setErrorMsg('Tanggal kembali tidak boleh sebelum tanggal pinjam!');
                // Validasi nama warga terdaftar
                const wargaValid = members.find(m => m.name.toLowerCase() === formData.namaWarga.trim().toLowerCase());
                if (!wargaValid) return setErrorMsg(`Nama "${formData.namaWarga}" tidak terdaftar di sistem. Pastikan nama sesuai data warga.`);
                // Cek stok
                const qtyMinta = Math.max(1, safeNumber(formData.qty) || 1);
                const stokTersedia = getStokTersedia(Number(formData.itemId));
                if (stokTersedia <= 0) return setErrorMsg('Stok barang ini sedang habis / semua sedang dipinjam!');
                if (qtyMinta > stokTersedia) return setErrorMsg(`Jumlah yang diminta (${qtyMinta}) melebihi stok tersedia (${stokTersedia} unit)!`);
                // Cek apakah warga sudah punya pengajuan aktif untuk barang ini
                const sudahAjukan = pinjamData.find(p => p.itemId === Number(formData.itemId) && p.namaWarga.toLowerCase() === formData.namaWarga.trim().toLowerCase() && (p.status === 'pending' || p.status === 'approved'));
                if (sudahAjukan) return setErrorMsg('Anda sudah memiliki pengajuan aktif untuk barang ini!');

                const item = inventarisData.find(i => i.id === Number(formData.itemId));
                const newPinjam = {
                    id: Date.now(),
                    itemId: Number(formData.itemId),
                    namaBarang: item.name,
                    namaWarga: formData.namaWarga.trim(),
                    keperluan: formData.keperluan.trim(),
                    qty: qtyMinta,
                    tanggalPinjam: formData.tanggalPinjam,
                    tanggalKembali: formData.tanggalKembali,
                    catatan: formData.catatan.trim(),
                    status: 'pending',       // pending | approved | returned | rejected
                    tanggalAjuan: getLocalDate(),
                    tanggalApprove: null,
                    tanggalKembaliAktual: null,
                };
                setPinjamData([newPinjam, ...pinjamData]);
                showToast(`Pengajuan pinjam ${item.name} berhasil dikirim! Tunggu persetujuan admin.`);
                setFormData({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
                setView('list');
                setErrorMsg('');
            };

            const handleApprove = (id) => {
                setPinjamData(pinjamData.map(p => p.id === id ? { ...p, status: 'approved', tanggalApprove: getLocalDate() } : p));
                showToast('Pengajuan disetujui. Barang siap dipinjam.');
            };

            const handleReject = (id) => {
                setPinjamData(pinjamData.filter(p => p.id !== id));
                setKonfirmRejectId(null);
                showToast('Pengajuan ditolak dan dihapus.');
            };

            const handleReturn = (id) => {
                // Hapus record pinjam (stok otomatis pulih karena hitung dari filter)
                setPinjamData(pinjamData.filter(p => p.id !== id));
                setKonfirmReturnId(null);
                showToast('Barang berhasil dicatat kembali. Stok inventaris sudah pulih.');
            };

            const pendingList  = pinjamData.filter(p => p.status === 'pending');
            const approvedList = pinjamData.filter(p => p.status === 'approved');
            const allActive    = [...pendingList, ...approvedList];

            return (
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2"><Icon name="handshake" className="text-[24px] text-google-green" />Pinjam Inventaris</h2>
                                <p className="text-[13px] font-medium text-google-textVariant mt-1">Ajukan peminjaman barang inventaris RT untuk keperluan kegiatan warga.</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {userRole === 'admin' && (
                                    <button onClick={() => setView(view === 'admin' ? 'list' : 'admin')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-[12px] border transition-all active:scale-95 ${view === 'admin' ? 'bg-google-blue text-white border-google-blueDark' : 'bg-white text-google-text border-slate-200 hover:border-google-blue'}`}>
                                        <Icon name="admin_panel_settings" className="text-[16px]" />Panel Admin
                                        {pendingList.length > 0 && <span className="bg-google-red text-white text-[9px] font-medium px-2 py-0.5 rounded-full">{pendingList.length}</span>}
                                    </button>
                                )}
                                <button onClick={() => { setView('form'); setErrorMsg(''); }} className="flex flex-wrap items-center gap-2 bg-google-green text-white px-5 py-2.5 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all">
                                    <Icon name="add" className="text-[16px]" />Ajukan Pinjam
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Form Pengajuan */}
                    {view === 'form' && (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <h3 className="text-[16px] font-medium text-google-text mb-6 flex flex-wrap items-center gap-2"><Icon name="edit_document" className="text-[18px] text-google-green" />Form Pengajuan Pinjam</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Nama warga */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Nama Warga *</label>
                                    <input type="text" value={formData.namaWarga} onChange={e => setFormData(p => ({...p, namaWarga: e.target.value}))} placeholder="Ketik nama sesuai data di Buku Warga..." list="warga-list-pinjam" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                    <datalist id="warga-list-pinjam">{members.map(m => <option key={m.id} value={m.name} />)}</datalist>
                                    <p className="text-[10px] text-google-textVariant mt-1">Nama harus sesuai data warga yang terdaftar di sistem.</p>
                                </div>
                                {/* Pilih barang */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Barang yang Dipinjam *</label>
                                    <select value={formData.itemId} onChange={e => setFormData(p => ({...p, itemId: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors">
                                        <option value="">-- Pilih Barang --</option>
                                        {inventarisData.map(item => {
                                            const stok = getStokTersedia(item.id);
                                            return <option key={item.id} value={item.id} disabled={stok <= 0}>{item.name} - Stok tersedia: {stok} dari {item.qty}{stok <= 0 ? ' (Habis)' : ''}</option>;
                                        })}
                                    </select>
                                </div>
                                {/* Jumlah yang dipinjam */}
                                <div>
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Jumlah Dipinjam *</label>
                                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 focus-within:border-google-green rounded-xl px-4 py-3">
                                        <button type="button" onClick={() => setFormData(p => ({...p, qty: Math.max(1, (p.qty||1)-1)}))}
                                            className="w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center font-medium text-[17px] text-google-text hover:bg-slate-100 active:scale-95 transition-all shrink-0">G</button>
                                        <div className="flex-1 text-center">
                                            <span className="font-medium text-[17px] text-google-text">{formData.qty || 1}</span>
                                            <span className="text-[11px] text-google-textVariant ml-2">unit</span>
                                        </div>
                                        <button type="button" onClick={() => {
                                            const stok = formData.itemId ? getStokTersedia(Number(formData.itemId)) : 99;
                                            setFormData(p => ({...p, qty: Math.min(stok, (p.qty||1)+1)}));
                                        }} className="w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center font-medium text-[17px] text-google-text hover:bg-slate-100 active:scale-95 transition-all shrink-0">+</button>
                                    </div>
                                    {formData.itemId && (
                                        <p className="text-[10px] text-google-textVariant mt-1">
                                            Stok tersedia: <span className="font-medium text-google-green">{getStokTersedia(Number(formData.itemId))} unit</span>
                                        </p>
                                    )}
                                </div>
                                {/* Keperluan */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Keperluan / Nama Acara *</label>
                                    <input type="text" value={formData.keperluan} onChange={e => setFormData(p => ({...p, keperluan: e.target.value}))} placeholder="contoh: Tahlilan di rumah Pak Hadi, 7 Muharram" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                                {/* Tanggal pinjam & kembali */}
                                <div>
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Tanggal Pinjam *</label>
                                    <input type="date" value={formData.tanggalPinjam} onChange={e => setFormData(p => ({...p, tanggalPinjam: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Perkiraan Tanggal Kembali *</label>
                                    <input type="date" value={formData.tanggalKembali} min={formData.tanggalPinjam} onChange={e => setFormData(p => ({...p, tanggalKembali: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                                {/* Catatan opsional */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Catatan Tambahan (opsional)</label>
                                    <textarea value={formData.catatan} onChange={e => setFormData(p => ({...p, catatan: e.target.value}))} rows={2} placeholder="Keterangan tambahan jika perlu..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors resize-none" />
                                </div>
                            </div>
                            {errorMsg && <div className="mt-4 bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-xl text-[12px] font-medium flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px]" />{errorMsg}</div>}
                            <div className="flex flex-wrap gap-3 mt-6">
                                <button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">Batal</button>
                                <button onClick={handleSubmitPinjam} className="flex flex-wrap bg-google-green text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2"><Icon name="send" className="text-[16px]" />Kirim Pengajuan</button>
                            </div>
                        </div>
                    )}

                    {/* Panel Admin */}
                    {view === 'admin' && userRole === 'admin' && (
                        <div className="space-y-6">
                            {/* Pending */}
                            {pendingList.length > 0 && (
                                <div className="bg-white rounded-3xl border border-google-yellow/40 shadow-sm p-6 sm:p-8 md:p-6">
                                    <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2"><Icon name="pending" className="text-[17px] text-google-yellow" />Menunggu Persetujuan ({pendingList.length})</h3>
                                    <div className="space-y-5">
                                        {pendingList.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-google-yellowLight/40 border border-google-yellow/40 rounded-2xl p-6 sm:p-8 md:p-8">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{p.namaWarga}</p>
                                                    <p className="text-[12px] font-medium text-google-yellowDark mt-0.5 flex flex-wrap items-center gap-1"><Icon name="inventory_2" className="text-[13px]" />{p.namaBarang} <span className="ml-1 bg-google-yellow/20 text-google-yellowDark border border-google-yellow/40 px-2 py-0.5 rounded-lg font-medium text-[10px]">{p.qty || 1} unit</span></p>
                                                    <p className="text-[11px] text-google-textVariant mt-1 flex flex-wrap items-center gap-1"><Icon name="event" className="text-[12px]" />Pinjam: {parseLocalDate(p.tanggalPinjam).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} G Kembali: {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
                                                    <p className="text-[11px] text-google-textVariant mt-0.5 italic">"{p.keperluan}"</p>
                                                    {p.catatan && <p className="text-[10px] text-slate-500 mt-0.5">= {p.catatan}</p>}
                                                </div>
                                                <div className="flex flex-wrap gap-2 shrink-0">
                                                    <button onClick={() => setKonfirmRejectId(p.id)} className="px-4 py-2.5 bg-white text-google-red border border-google-red/30 rounded-full font-medium text-[11px] hover:bg-google-redLight active:scale-95 transition-all">Tolak</button>
                                                    <button onClick={() => handleApprove(p.id)} className="px-4 py-2.5 bg-google-green text-white border border-google-greenDark rounded-full font-medium text-[11px] hover:bg-google-greenDark active:scale-95 transition-all shadow-md flex flex-wrap items-center gap-1"><Icon name="check" className="text-[13px]" />Setujui</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Approved / sedang dipinjam */}
                            {approvedList.length > 0 && (
                                <div className="bg-white rounded-3xl border border-google-blue/30 shadow-sm p-6 sm:p-8 md:p-6">
                                    <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2"><Icon name="handshake" className="text-[17px] text-google-blue" />Sedang Dipinjam ({approvedList.length})</h3>
                                    <div className="space-y-5">
                                        {approvedList.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-google-blueLight/30 border border-google-blue/30 rounded-2xl p-6 sm:p-8 md:p-8">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{p.namaWarga}</p>
                                                    <p className="text-[12px] font-medium text-google-blueDark mt-0.5 flex flex-wrap items-center gap-1"><Icon name="inventory_2" className="text-[13px]" />{p.namaBarang} <span className="ml-1 bg-google-blue/10 text-google-blueDark border border-google-blue/30 px-2 py-0.5 rounded-lg font-medium text-[10px]">{p.qty || 1} unit</span></p>
                                                    <p className="text-[11px] text-google-textVariant mt-1 flex flex-wrap items-center gap-1"><Icon name="event" className="text-[12px]" />Pinjam: {parseLocalDate(p.tanggalPinjam).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} G Estimasi Kembali: {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
                                                    <p className="text-[11px] text-google-textVariant mt-0.5 italic">"{p.keperluan}"</p>
                                                    {/* Cek apakah sudah lewat tanggal kembali */}
                                                    {p.tanggalKembali < getLocalDate() && (
                                                        <p className="text-[10px] font-medium text-google-red mt-1 flex flex-wrap items-center gap-1"><Icon name="warning" className="text-[12px]" />Melewati estimasi tanggal kembali!</p>
                                                    )}
                                                </div>
                                                <button onClick={() => setKonfirmReturnId(p.id)} className="px-4 py-2.5 bg-google-blue text-white border border-google-blueDark rounded-full font-medium text-[11px] hover:bg-google-blueDark active:scale-95 transition-all shadow-md flex flex-wrap items-center gap-1 shrink-0"><Icon name="assignment_return" className="text-[13px]" />Barang Kembali</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {allActive.length === 0 && (
                                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                                    <Icon name="check_circle" className="text-[56px] text-google-green mx-auto mb-4" fill="true" />
                                    <h3 className="text-[17px] font-medium text-google-text mb-2">Semua Bersih!</h3>
                                    <p className="text-[13px] text-google-textVariant font-medium">Tidak ada pengajuan pinjam yang aktif saat ini.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Daftar Status untuk Warga */}
                    {view === 'list' && (
                        <div className="space-y-6">
                            {/* Info stok tersedia */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {inventarisData.map(item => {
                                    const stok = getStokTersedia(item.id);
                                    const sedangDipinjam = pinjamData.filter(p => p.itemId === item.id && p.status === 'approved');
                                    return (
                                        <div key={item.id} className={`bg-white rounded-3xl border p-5 shadow-sm flex items-center gap-4 ${stok <= 0 ? 'border-google-red/40 bg-google-redLight/20' : 'border-slate-200'}`}>
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${stok <= 0 ? 'bg-google-redLight border-google-red/30' : 'bg-google-greenLight border-google-green/30'}`}>
                                                <Icon name="inventory_2" className={`text-[24px] ${stok <= 0 ? 'text-google-red' : 'text-google-green'}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{item.name}</p>
                                                <p className={`text-[11px] font-medium mt-0.5 ${stok <= 0 ? 'text-google-red' : 'text-google-greenDark'}`}>{stok <= 0 ? 'G Semua sedang dipinjam' : `G ${stok} dari ${item.qty} tersedia`}</p>
                                                {sedangDipinjam.length > 0 && (
                                                    <div className="mt-1.5 bg-google-redLight/50 border border-google-red/30 rounded-lg px-3 py-1.5 space-y-1">
                                                        {sedangDipinjam.map((p, i) => (
                                                            <div key={i} className="flex items-center justify-between">
                                                                <span className="text-[10px] font-medium text-google-text flex flex-wrap items-center gap-1"><Icon name="person" className="text-[11px] text-google-textVariant" />{p.namaWarga}</span>
                                                                <span className="text-[9px] font-medium text-google-red bg-white px-2 py-0.5 rounded-lg border border-google-red/30 shrink-0 ml-1">{p.qty || 1} unit</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {inventarisData.length === 0 && (
                                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                                    <Icon name="inventory_2" className="text-[56px] text-slate-300 mx-auto mb-4" />
                                    <p className="text-[13px] text-google-textVariant font-medium">Belum ada barang inventaris yang terdaftar.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Modal konfirmasi kembali */}
                    {konfirmReturnId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                {(() => { const p = pinjamData.find(x => x.id === konfirmReturnId); return p ? (<>
                                    <div className="mb-5 bg-google-greenLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-green/30"><Icon name="assignment_return" className="text-[40px] text-google-green" /></div>
                                    <h3 className="text-xl font-medium text-google-text mb-2">Konfirmasi Pengembalian</h3>
                                    <p className="text-[13px] text-google-textVariant mb-2"><span className="font-medium text-google-text">{p.namaBarang}</span><br/>dikembalikan oleh <span className="font-medium text-google-blueDark">{p.namaWarga}</span></p>
                                    <p className="text-[12px] font-medium text-google-green mb-6">Stok inventaris akan otomatis pulih setelah konfirmasi.</p>
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => setKonfirmReturnId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3 rounded-full font-medium text-[12px] border border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                        <button onClick={() => handleReturn(konfirmReturnId)} className="flex-1 bg-google-green text-white px-4 py-3 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95">G Konfirmasi Kembali</button>
                                    </div>
                                </>) : null; })()}
                            </div>
                        </div>
                    )}

                    {/* Modal konfirmasi tolak */}
                    {konfirmRejectId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="cancel" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-xl font-medium text-google-text mb-2">Tolak Pengajuan?</h3>
                                <p className="text-[13px] text-google-textVariant mb-6">Pengajuan pinjam ini akan dihapus dari daftar.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setKonfirmRejectId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3 rounded-full font-medium text-[12px] border border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                    <button onClick={() => handleReject(konfirmRejectId)} className="flex-1 bg-google-red text-white px-4 py-3 rounded-full font-medium text-[12px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95">Tolak & Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        // =====================================================
        // KOMPONEN INFAQ
        // =====================================================
        function Infaq({ infaqData, setInfaqData, userRole, identity }) {
            // view: 'list' = daftar program, 'detail' = detail 1 program, 'form' = admin buat/edit
            const [view, setView]               = useState('list');
            const [selected, setSelected]       = useState(null);
            const [editingId, setEditingId]     = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [errorMsg, setErrorMsg]       = useState('');
            const [isUploading, setIsUploading] = useState(false);

            // Form admin: buat/edit program infaq
            const emptyForm = {
                judul: '', deskripsi: '', tujuan: '', manfaat: '', imageUrl: '',
                danaTarget: 0, danaTerkumpul: 0,
                rekening: [{ bank: '', norek: '', atasNama: '' }],
            };
            const [form, setForm] = useState(emptyForm);

            // Nominal infaq yang dipilih warga (tampilan detail)
            const [nominalInput, setNominalInput]   = useState('');
            const [namaInfaq, setNamaInfaq]         = useState('');
            const [tipeNama, setTipeNama]            = useState('nama'); // 'nama' | 'tanpanama' | 'hambaalah'
            const [showPayModal, setShowPayModal]   = useState(false);
            const [selectedRek, setSelectedRek]     = useState(0);

            // Cek jika ada perintah buka Infaq dari Landing Page
            useEffect(() => {
                const openId = sessionStorage.getItem('openInfaqId');
                if (openId && infaqData.length > 0) {
                    const prog = infaqData.find(i => i.id === openId);
                    if (prog) {
                        setSelected(prog);
                        setView('detail');
                        setNominalInput('');
                        setNamaInfaq('');
                        setTipeNama('nama');
                        setSelectedRek(0);
                    }
                    sessionStorage.removeItem('openInfaqId');
                }
            }, [infaqData]);

            // Tambahan State Warga: Upload Bukti
            const [buktiUrl, setBuktiUrl]           = useState('');
            const [isUploadingBukti, setIsUploadingBukti] = useState(false);

            const NOMINAL_CEPAT = [10000, 25000, 50000, 100000, 250000, 500000];

            // ---- Handler Warga: Upload Bukti ----
            const handleBuktiUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return showToast('Ukuran foto maks 2MB!', 'error');
                setIsUploadingBukti(true);
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.8);
                    setBuktiUrl(url);
                } catch(error) {
                    showToast(error, 'error');
                } finally {
                    setIsUploadingBukti(false);
                }
            };

            // ---- Handler Admin ----
            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return setErrorMsg('Ukuran foto maks 2MB!');
                setIsUploading(true);
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.8);
                    setForm(p => ({...p, imageUrl: url}));
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleSaveProgram = () => {
                if (!form.judul.trim())     return setErrorMsg('Judul program wajib diisi!');
                if (!form.deskripsi.trim()) return setErrorMsg('Deskripsi wajib diisi!');
                if (form.rekening.some(r => !r.bank.trim() || !r.norek.trim() || !r.atasNama.trim()))
                    return setErrorMsg('Lengkapi semua data rekening pembayaran!');

                const data = {
                    ...form,
                    judul: form.judul.trim(),
                    deskripsi: form.deskripsi.trim(),
                    tujuan: form.tujuan.trim(),
                    manfaat: form.manfaat.trim(),
                    danaTarget: safeNumber(form.danaTarget),
                    danaTerkumpul: safeNumber(form.danaTerkumpul),
                };
                if (editingId) {
                    setInfaqData(infaqData.map(i => i.id === editingId ? { ...i, ...data } : i));
                    showToast('Program infaq berhasil diperbarui.');
                } else {
                    setInfaqData([{ id: Date.now(), ...data, createdAt: getLocalDate() }, ...infaqData]);
                    showToast('Program infaq baru berhasil dibuat.');
                }
                setView('list'); setEditingId(null); setForm(emptyForm); setErrorMsg('');
            };

            const addRek = () => setForm(p => ({ ...p, rekening: [...p.rekening, { bank: '', norek: '', atasNama: '' }] }));
            const removeRek = (i) => setForm(p => ({ ...p, rekening: p.rekening.filter((_, idx) => idx !== i) }));
            const updateRek = (i, field, val) => setForm(p => ({
                ...p, rekening: p.rekening.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
            }));

            // ---- Helper ----
            const pct = (item) => item.danaTarget > 0
                ? Math.min(100, Math.round((item.danaTerkumpul / item.danaTarget) * 100))
                : null;

            const namaDisplay = tipeNama === 'tanpanama' ? 'Tanpa Nama'
                : tipeNama === 'hambaalah' ? 'Hamba Allah'
                : namaInfaq.trim() || 'Anonim';

            // ---- RENDER: LIST ----
            if (view === 'list') return (
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                <Icon name="volunteer_activism" className="text-[24px] text-google-green" fill="true" />Program Infaq
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1">Salurkan infaq untuk kebaikan bersama warga {identity?.name || 'RT'}.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setForm(emptyForm); setEditingId(null); setErrorMsg(''); setView('form'); }}
                                className="flex flex-wrap items-center gap-2 bg-google-green text-white px-5 py-2.5 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all shrink-0">
                                <Icon name="add" className="text-[16px]" />Buat Program Infaq
                            </button>
                        )}
                    </div>

                    {/* Grid program */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {infaqData.map(item => {
                            const p = pct(item);
                            return (
                                <div key={item.id} onClick={() => { setSelected(item); setView('detail'); setNominalInput(''); setNamaInfaq(''); setTipeNama('nama'); setSelectedRek(0); }}
                                    className="bg-white rounded-3xl sm:rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-google-green/50 transition-all duration-300 cursor-pointer group flex flex-col">
                                    {/* Foto */}
                                    <div className="w-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0" style={{minHeight:'160px', maxHeight:'220px'}}>
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} className="w-full object-contain group-hover:scale-105 transition-transform duration-700" style={{maxHeight:'220px'}} alt={item.judul} />
                                            : <div className="flex items-center justify-center p-10"><Icon name="volunteer_activism" className="text-[64px] text-slate-300" fill="true" /></div>
                                        }
                                    </div>
                                    {/* Info */}
                                    <div className="p-6 sm:p-8 md:p-8 flex flex-col gap-3">
                                        <h3 className="text-[15px] font-medium text-google-text leading-snug tracking-tight group-hover:text-google-greenDark transition-colors">{item.judul}</h3>
                                        <p className="text-[12px] text-google-textVariant font-medium leading-relaxed line-clamp-2">{item.deskripsi}</p>
                                        {/* Dana progress */}
                                        <div className="mt-auto space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-google-textVariant">Dana Terkumpul</span>
                                                {p !== null && <span className="text-[11px] font-medium text-google-green">{p}%</span>}
                                            </div>
                                            <p className="text-[16px] font-medium text-google-green tracking-tight">{formatRp(item.danaTerkumpul || 0)}</p>
                                            {item.danaTarget > 0 && (
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-google-green rounded-full transition-all duration-700" style={{width: `${p}%`}} />
                                                </div>
                                            )}
                                            {item.danaTarget > 0 && (
                                                <p className="text-[10px] text-google-textVariant font-medium">Target: {formatRp(item.danaTarget)}</p>
                                            )}
                                        </div>
                                        {/* Admin actions */}
                                        {userRole === 'admin' && (
                                            <div className="flex gap-2 pt-3 border-t border-slate-100 mt-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => { setForm({...item}); setEditingId(item.id); setErrorMsg(''); setView('form'); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95">
                                                    <Icon name="edit" className="text-[14px]" /> Edit
                                                </button>
                                                <button onClick={() => setDeleteConfirmId(item.id)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95">
                                                    <Icon name="delete" className="text-[14px]" /> Hapus
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {infaqData.length === 0 && (
                            <div className="col-span-full bg-white border border-slate-200 p-14 text-center rounded-3xl shadow-sm">
                                <Icon name="volunteer_activism" className="text-[64px] text-slate-300 mx-auto mb-4" fill="true" />
                                <h3 className="text-[17px] font-medium text-google-text mb-2">Belum Ada Program Infaq</h3>
                                <p className="text-[13px] text-google-textVariant font-medium">{userRole === 'admin' ? 'Klik "Buat Program Infaq" untuk menambahkan.' : 'Program infaq akan tampil di sini.'}</p>
                            </div>
                        )}
                    </div>

                    {/* Modal hapus */}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30">
                                    <Icon name="delete" className="text-[40px] text-google-red" />
                                </div>
                                <h3 className="text-xl font-medium text-google-text mb-2">Hapus Program Infaq?</h3>
                                <p className="text-[13px] text-google-textVariant mb-8">Program beserta data rekening akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                    <button onClick={() => { setInfaqData(infaqData.filter(i => i.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Program infaq dihapus.'); }}
                                        className="flex-1 bg-google-red text-white px-4 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );

            // ---- RENDER: DETAIL ----
            if (view === 'detail' && selected) {
                const prog = infaqData.find(i => i.id === selected.id) || selected;
                const p = pct(prog);
                return (
                    <div className="space-y-7 w-full">
                        {/* Back */}
                        <button onClick={() => setView('list')} className="flex flex-wrap items-center gap-2 text-google-textVariant font-medium text-[13px] hover:text-google-text transition-colors active:scale-95">
                            <Icon name="arrow_back" className="text-[17px]" />Kembali ke Daftar
                        </button>

                        {/* Foto */}
                        {prog.imageUrl && (
                            <div className="w-full bg-slate-100 rounded-3xl sm:rounded-3xl overflow-hidden border border-slate-200 flex items-center justify-center" style={{maxHeight:'300px'}}>
                                <img src={prog.imageUrl} className="w-full object-contain" style={{maxHeight:'300px'}} alt={prog.judul} />
                            </div>
                        )}

                        {/* Judul & dana */}
                        <div className="bg-white rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 md:p-6">
                            <h2 className="text-[18px] font-medium text-google-text mb-2 tracking-tight">{prog.judul}</h2>
                            <p className="text-[13px] text-google-textVariant font-medium leading-relaxed mb-4">{prog.deskripsi}</p>
                            {/* Progress dana */}
                            <div className="bg-google-greenLight/50 border border-google-green/30 rounded-2xl p-6 sm:p-8 md:p-8">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider">Dana Terkumpul</p>
                                        <p className="text-[24px] font-medium text-google-green tracking-tight">{formatRp(prog.danaTerkumpul || 0)}</p>
                                    </div>
                                    {p !== null && (
                                        <div className="text-right">
                                            <p className="text-[11px] font-medium text-google-textVariant">Target</p>
                                            <p className="text-[13px] font-medium text-google-text">{formatRp(prog.danaTarget)}</p>
                                        </div>
                                    )}
                                </div>
                                {prog.danaTarget > 0 && (
                                    <>
                                        <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-google-green/30">
                                            <div className="h-full bg-google-green rounded-full transition-all duration-700" style={{width:`${p}%`}} />
                                        </div>
                                        <p className="text-[11px] font-medium text-google-greenDark mt-1.5">{p}% dari target tercapai</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Admin: update dana */}
                        {userRole === 'admin' && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-google-blue/30 shadow-sm p-6 sm:p-8 md:p-6">
                                <h3 className="text-[13px] font-medium text-google-text mb-3 flex flex-wrap items-center gap-2">
                                    <Icon name="edit" className="text-[16px] text-google-blue" />Perbarui Dana Terkumpul
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    <input type="number" min="0" defaultValue={prog.danaTerkumpul || 0}
                                        id="update-dana-input"
                                        className="flex-1 bg-slate-50 border border-slate-200 focus:border-google-blue rounded-full px-4 py-3 text-[13px] font-medium outline-none transition-colors"
                                        placeholder="Nominal dana terkumpul..." />
                                    <button onClick={() => {
                                        const val = safeNumber(document.getElementById('update-dana-input').value);
                                        setInfaqData(infaqData.map(i => i.id === prog.id ? {...i, danaTerkumpul: val} : i));
                                        setSelected(prev => ({...prev, danaTerkumpul: val}));
                                        showToast('Dana terkumpul berhasil diperbarui.');
                                    }} className="bg-google-blue text-white px-5 py-3 rounded-full font-medium text-[12px] border border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all whitespace-nowrap">
                                        Simpan
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Admin: Panel Approval Bukti Transfer */}
                        {userRole === 'admin' && (prog.donasi || []).length > 0 && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-google-yellow/30 shadow-sm p-6 sm:p-8 md:p-6">
                                <h3 className="text-[15px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2">
                                    <Icon name="verified_user" className="text-[18px] text-google-yellow" fill="true" />Persetujuan Bukti Bayar
                                </h3>
                                <div className="space-y-6">
                                    {(prog.donasi || []).map(donasi => (
                                        <div key={donasi.id} className="bg-slate-50 rounded-2xl p-6 sm:p-8 md:p-6 border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                            <div className="flex flex-wrap items-center gap-4 w-full">
                                                {donasi.imageUrl ? (
                                                    <a href={donasi.imageUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 shrink-0 bg-slate-200 rounded-xl overflow-hidden hover:opacity-80 transition-opacity">
                                                        <img src={donasi.imageUrl} className="w-full h-full object-cover" alt="Bukti Transfer" />
                                                    </a>
                                                ) : (
                                                    <div className="w-16 h-16 shrink-0 bg-slate-200 rounded-xl flex items-center justify-center">
                                                        <Icon name="receipt" className="text-[20px] text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{donasi.nama}</p>
                                                    <p className="text-[13px] font-medium text-google-green">{formatRp(donasi.nominal)}</p>
                                                    <p className="text-[10px] text-google-textVariant mt-0.5">{parseLocalDate(donasi.tanggal).toLocaleDateString('id-ID')}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                                                {donasi.status === 'PENDING' ? (
                                                    <>
                                                        <button onClick={() => {
                                                            const updatedDonasi = (prog.donasi || []).map(d => d.id === donasi.id ? {...d, status: 'APPROVED'} : d);
                                                            const newDana = (prog.danaTerkumpul || 0) + donasi.nominal;
                                                            const updatedProg = { ...prog, donasi: updatedDonasi, danaTerkumpul: newDana };
                                                            setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                            setSelected(updatedProg);
                                                            showToast('Bukti disetujui. Dana bertambah otomatis!');
                                                        }} className="bg-google-green text-white px-4 py-2 rounded-full font-medium text-[11px] border border-google-greenDark shadow-sm hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                                            <Icon name="check" className="text-[13px]"/>Setujui
                                                        </button>
                                                        <button onClick={() => {
                                                            const updatedDonasi = (prog.donasi || []).map(d => d.id === donasi.id ? {...d, status: 'REJECTED'} : d);
                                                            const updatedProg = { ...prog, donasi: updatedDonasi };
                                                            setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                            setSelected(updatedProg);
                                                            showToast('Bukti ditolak.', 'error');
                                                        }} className="bg-white text-google-red px-4 py-2 rounded-full font-medium text-[11px] border border-google-red/30 shadow-sm hover:bg-google-redLight active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                                            <Icon name="close" className="text-[13px]"/>Tolak
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={`px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-widest ${
                                                        donasi.status === 'APPROVED' ? 'bg-google-greenLight text-google-greenDark border border-google-green/30' :
                                                        donasi.status === 'REJECTED' ? 'bg-google-redLight text-google-redDark border border-google-red/30' :
                                                        'bg-google-yellowLight text-google-yellowDark border border-google-yellow/30'
                                                    }`}>
                                                        {donasi.status === 'APPROVED' ? 'Disetujui' : donasi.status === 'REJECTED' ? 'Œ Ditolak' : ' Menunggu'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Riwayat Donasi G Tampil untuk SEMUA user (Warga & Admin) */}
                        {(prog.donasi || []).length > 0 && userRole !== 'admin' && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 md:p-6">
                                <h3 className="text-[15px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2">
                                    <Icon name="receipt_long" className="text-[18px] text-google-blue" fill="true" />Riwayat Donasi Anda
                                </h3>
                                <div className="space-y-5">
                                    {(prog.donasi || []).map(donasi => (
                                        <div key={donasi.id} className="bg-slate-50 rounded-2xl p-6 sm:p-8 md:p-6 border border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                                            <div className="flex flex-wrap items-center gap-3 w-full">
                                                {donasi.imageUrl ? (
                                                    <a href={donasi.imageUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 shrink-0 bg-slate-200 rounded-lg overflow-hidden hover:opacity-80 transition-opacity">
                                                        <img src={donasi.imageUrl} className="w-full h-full object-cover" alt="Bukti" />
                                                    </a>
                                                ) : (
                                                    <div className="w-12 h-12 shrink-0 bg-slate-200 rounded-lg flex items-center justify-center">
                                                        <Icon name="receipt" className="text-[17px] text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{donasi.nama}</p>
                                                    <p className="text-[12px] font-medium text-google-green">{formatRp(donasi.nominal)}</p>
                                                    <p className="text-[10px] text-google-textVariant">{parseLocalDate(donasi.tanggal).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-widest shrink-0 ${
                                                donasi.status === 'APPROVED' ? 'bg-google-greenLight text-google-greenDark border border-google-green/30' :
                                                donasi.status === 'REJECTED' ? 'bg-google-redLight text-google-redDark border border-google-red/30' :
                                                'bg-google-yellowLight text-google-yellowDark border border-google-yellow/30'
                                            }`}>
                                                {donasi.status === 'APPROVED' ? 'Disetujui' : donasi.status === 'REJECTED' ? 'Œ Ditolak' : ' Menunggu'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tujuan & manfaat */}
                        {(prog.tujuan || prog.manfaat) && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 md:p-6 space-y-6">
                                {prog.tujuan && (
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 flex flex-wrap items-center gap-1.5"><Icon name="flag" className="text-[13px] text-google-blue" />Tujuan Program</p>
                                        <p className="text-[13px] text-google-text font-medium leading-relaxed">{prog.tujuan}</p>
                                    </div>
                                )}
                                {prog.manfaat && (
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 flex flex-wrap items-center gap-1.5"><Icon name="star" className="text-[13px] text-google-yellow" />Manfaat</p>
                                        <p className="text-[13px] text-google-text font-medium leading-relaxed">{prog.manfaat}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Form infaq warga */}
                        <div className="bg-white rounded-3xl sm:rounded-3xl border border-google-green/30 shadow-sm p-6 sm:p-8 md:p-6 space-y-7">
                            <h3 className="text-[15px] font-medium text-google-text flex flex-wrap items-center gap-2">
                                <Icon name="volunteer_activism" className="text-[18px] text-google-green" fill="true" />Tunaikan Infaq
                            </h3>

                            {/* Pilih nominal */}
                            <div>
                                <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-2">Nominal Infaq</p>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {NOMINAL_CEPAT.map(n => (
                                        <button key={n} onClick={() => setNominalInput(String(n))}
                                            className={`py-2.5 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${nominalInput === String(n) ? 'bg-google-green text-white border-google-greenDark shadow-md' : 'bg-slate-50 text-google-text border-slate-200 hover:border-google-green/50'}`}>
                                            {formatRp(n)}
                                        </button>
                                    ))}
                                </div>
                                <input type="number" min="1000" value={nominalInput} onChange={e => setNominalInput(e.target.value)}
                                    placeholder="Atau ketik nominal lain (Rp)..."
                                    className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                            </div>

                            {/* Nama penginfaq */}
                            <div>
                                <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-2">Atas Nama</p>
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {[['nama','Nama Saya'],['tanpanama','Tanpa Nama'],['hambaalah','Hamba Allah']].map(([val, label]) => (
                                        <button key={val} onClick={() => setTipeNama(val)}
                                            className={`px-4 py-2 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${tipeNama === val ? 'bg-google-green text-white border-google-greenDark' : 'bg-slate-50 text-google-text border-slate-200 hover:border-google-green/40'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {tipeNama === 'nama' && (
                                    <input type="text" value={namaInfaq} onChange={e => setNamaInfaq(e.target.value)}
                                        placeholder="Ketik nama Anda..."
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                )}
                            </div>

                            {/* Ringkasan sebelum bayar */}
                            {nominalInput && safeNumber(nominalInput) >= 1000 && (
                                <div className="bg-google-greenLight border border-google-green/40 rounded-xl px-4 py-3.5 flex justify-between items-center">
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant">Infaq atas nama: <span className="text-google-greenDark">{namaDisplay}</span></p>
                                        <p className="text-[16px] font-medium text-google-green mt-0.5">{formatRp(safeNumber(nominalInput))}</p>
                                    </div>
                                    <button onClick={() => setShowPayModal(true)}
                                        className="bg-google-green text-white px-5 py-3 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center gap-1.5 shrink-0">
                                        <Icon name="payments" className="text-[16px]" />Bayar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal pembayaran */}
                        {showPayModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                                <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl sm:rounded-3xl p-6 sm:p-8 md:p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 my-4 modal-card animate-modal-in">
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="text-[16px] font-medium text-google-text">Cara Pembayaran</h3>
                                        <button onClick={() => setShowPayModal(false)} className="w-9 h-9 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all">
                                            <Icon name="close" className="text-[16px]" />
                                        </button>
                                    </div>

                                    {/* Ringkasan */}
                                    <div className="bg-google-greenLight border border-google-green/30 rounded-2xl p-6 sm:p-8 md:p-6 mb-4">
                                        <p className="text-[11px] font-medium text-google-textVariant">Nominal Infaq</p>
                                        <p className="text-[18px] font-medium text-google-green">{formatRp(safeNumber(nominalInput))}</p>
                                        <p className="text-[11px] font-medium text-google-textVariant mt-1">Atas nama: <span className="text-google-greenDark font-medium">{namaDisplay}</span></p>
                                    </div>

                                    {/* Pilih rekening */}
                                    {(prog.rekening || []).length > 1 && (
                                        <div className="flex gap-2 flex-wrap mb-3">
                                            {(prog.rekening || []).map((r, i) => (
                                                <button key={i} onClick={() => setSelectedRek(i)}
                                                    className={`px-3 py-1.5 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${selectedRek === i ? 'bg-google-blue text-white border-google-blueDark' : 'bg-slate-50 text-google-text border-slate-200'}`}>
                                                    {r.bank}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Detail rekening */}
                                    {(prog.rekening || []).length > 0 && (() => {
                                        const r = prog.rekening[selectedRek] || prog.rekening[0];
                                        return (
                                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 md:p-8 space-y-5.5">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="w-10 h-10 bg-google-blueLight rounded-xl flex items-center justify-center border border-google-blue/30 shrink-0">
                                                        <Icon name="account_balance" className="text-[17px] text-google-blue" />
                                                    </div>
                                                    <p className="font-medium text-[14px] text-google-text">{r.bank}</p>
                                                </div>
                                                {[['Nomor Rekening', r.norek], ['Atas Nama', r.atasNama]].map(([label, val]) => (
                                                    <div key={label} className="flex items-center justify-between">
                                                        <span className="text-[11px] font-medium text-google-textVariant">{label}</span>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-medium text-[13px] text-google-text">{val}</span>
                                                            <button onClick={() => { navigator.clipboard?.writeText(val); showToast(`${label} disalin!`); }}
                                                                className="w-7 h-7 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-google-blueLight hover:border-google-blue/40 active:scale-95 transition-all">
                                                                <Icon name="content_copy" className="text-[12px] text-google-textVariant" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] font-medium text-google-textVariant bg-white border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                                                    = Cantumkan nominal <span className="text-google-green font-medium">{formatRp(safeNumber(nominalInput))}</span> dan nama <span className="text-google-greenDark font-medium">{namaDisplay}</span> saat transfer.
                                                </p>
                                            </div>
                                        );
                                    })()}

                                        {/* Upload Bukti */}
                                        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 md:p-6 text-center relative overflow-hidden transition-all focus-within:border-google-green group hover:border-google-green/40 cursor-pointer">
                                            <p className="text-[11px] font-medium text-google-textVariant mb-2 uppercase tracking-wider">Upload Bukti Transfer</p>
                                            <input type="file" accept="image/*" onChange={handleBuktiUpload} disabled={isUploadingBukti} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                            {isUploadingBukti ? (
                                                <div className="w-8 h-8 border border-google-green border-t-transparent rounded-full animate-spin mx-auto my-3" />
                                            ) : buktiUrl ? (
                                                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                                                    <img src={buktiUrl} className="w-full h-32 object-cover" alt="Bukti Transfer" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white font-medium text-[11px] flex flex-wrap items-center gap-1"><Icon name="edit" className="text-[14px]"/> Ganti Foto</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-2 flex flex-col items-center bg-white rounded-xl border border-slate-200 shadow-sm group-hover:bg-google-greenLight transition-colors">
                                                    <Icon name="add_photo_alternate" className="text-[32px] text-slate-300 group-hover:text-google-green transition-colors" />
                                                    <span className="text-[10px] text-google-textVariant mt-1">Ketuk untuk unggah (Maks 2MB)</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-4">
                                            <button onClick={() => { setShowPayModal(false); setBuktiUrl(''); }}
                                                className="w-full sm:w-auto bg-white text-google-text py-3.5 rounded-full font-medium text-[12px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">
                                                Batal
                                            </button>
                                            <button onClick={() => { 
                                                if (!buktiUrl) return showToast('Mohon unggah bukti transfer terlebih dahulu!', 'error');
                                                const newDonasi = {
                                                    id: Date.now(),
                                                    nama: namaDisplay,
                                                    nominal: safeNumber(nominalInput),
                                                    imageUrl: buktiUrl,
                                                    status: 'PENDING',
                                                    tanggal: getLocalDate()
                                                };
                                                const updatedProg = {
                                                    ...prog,
                                                    donasi: [newDonasi, ...(prog.donasi || [])]
                                                };
                                                setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                setSelected(updatedProg); // update view detail
                                                setShowPayModal(false);
                                                setBuktiUrl('');
                                                showToast('Terima kasih! Bukti transfer Anda telah dikirim dan menunggu verifikasi Admin.');
                                            }}
                                                className="flex flex-wrap bg-google-green text-white py-3.5 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-1.5">
                                                <Icon name="send" className="text-[16px]"/> Kirim Bukti
                                            </button>
                                        </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            // ---- RENDER: FORM ADMIN ----
            if (view === 'form') return (
                <div className="space-y-7 w-full">
                    <button onClick={() => { setView('list'); setErrorMsg(''); }} className="flex flex-wrap items-center gap-2 text-google-textVariant font-medium text-[13px] hover:text-google-text transition-colors active:scale-95">
                        <Icon name="arrow_back" className="text-[17px]" />Kembali
                    </button>

                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                        <h3 className="text-[17px] font-medium text-google-text mb-6 tracking-tight">
                            {editingId ? ' Edit Program Infaq' : '+ Buat Program Infaq Baru'}
                        </h3>
                        <div className="space-y-7">

                            {/* Gambar */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Foto Program <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-green transition-all`}>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 z-0">
                                        {isUploading ? <div className="w-5 h-5 border border-google-green border-t-transparent rounded-full animate-spin" />
                                            : form.imageUrl ? <img src={form.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="preview" />
                                            : <Icon name="cloud_upload" className="text-[20px] text-google-textVariant" />}
                                    </div>
                                    <div className="flex-1 z-0">
                                        <p className="font-medium text-[13px] text-google-text">{isUploading ? 'Mengunggah...' : form.imageUrl ? 'Foto Tersimpan G' : 'Pilih Foto Program'}</p>
                                        <p className="text-[11px] text-google-textVariant">Maks. 2MB</p>
                                    </div>
                                    {form.imageUrl && <button type="button" onClick={e => { e.stopPropagation(); setForm(p=>({...p,imageUrl:''})); }} className="relative z-20 text-google-red bg-white border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center text-[14px] hover:bg-google-redLight active:scale-95 shrink-0">+</button>}
                                </div>
                            </div>

                            {/* Judul */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Judul Program *</label>
                                <input type="text" value={form.judul} onChange={e => setForm(p=>({...p,judul:e.target.value}))}
                                    placeholder="contoh: Infaq Pembangunan Mushola RT" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                            </div>

                            {/* Deskripsi */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Deskripsi Program *</label>
                                <textarea value={form.deskripsi} onChange={e => setForm(p=>({...p,deskripsi:e.target.value}))} rows={3}
                                    placeholder="Jelaskan program infaq ini secara singkat..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors resize-none" />
                            </div>

                            {/* Tujuan & Manfaat */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Tujuan <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                    <textarea value={form.tujuan} onChange={e => setForm(p=>({...p,tujuan:e.target.value}))} rows={2}
                                        placeholder="Tujuan program infaq ini..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[12px] font-medium outline-none transition-colors resize-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Manfaat <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                    <textarea value={form.manfaat} onChange={e => setForm(p=>({...p,manfaat:e.target.value}))} rows={2}
                                        placeholder="Manfaat bagi warga..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[12px] font-medium outline-none transition-colors resize-none" />
                                </div>
                            </div>

                            {/* Dana target (opsional) */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Target Dana <span className="text-slate-400 normal-case font-normal">(opsional, 0 = tanpa target)</span></label>
                                <input type="number" min="0" value={form.danaTarget || ''} onChange={e => setForm(p=>({...p,danaTarget:safeNumber(e.target.value)}))}
                                    placeholder="0" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                            </div>

                            {/* Dana terkumpul (edit saja) */}
                            {editingId && (
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Dana Terkumpul Saat Ini</label>
                                    <input type="number" min="0" value={form.danaTerkumpul || ''} onChange={e => setForm(p=>({...p,danaTerkumpul:safeNumber(e.target.value)}))}
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                            )}

                            {/* Rekening pembayaran */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest">Rekening Pembayaran *</label>
                                    <button type="button" onClick={addRek} className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-google-blue bg-google-blueLight border border-google-blue/30 px-3 py-1.5 rounded-full hover:bg-google-blue hover:text-white active:scale-95 transition-all">
                                        <Icon name="add" className="text-[13px]" />Tambah Rekening
                                    </button>
                                </div>
                                <div className="space-y-5">
                                    {form.rekening.map((r, i) => (
                                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 md:p-4 sm:p-6 space-y-5">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider">Rekening {i+1}</p>
                                                {form.rekening.length > 1 && (
                                                    <button type="button" onClick={() => removeRek(i)} className="text-google-red hover:bg-google-redLight w-7 h-7 flex items-center justify-center rounded-full border border-google-red/30 active:scale-95 transition-all">
                                                        <Icon name="close" className="text-[13px]" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <input type="text" value={r.bank} onChange={e => updateRek(i,'bank',e.target.value)}
                                                    placeholder="Nama Bank (BRI, BCA...)" className="bg-white border border-slate-200 focus:border-google-blue rounded-xl px-3 py-2.5 text-[12px] font-medium outline-none transition-colors" />
                                                <input type="text" value={r.norek} onChange={e => updateRek(i,'norek',e.target.value)}
                                                    placeholder="Nomor Rekening" className="bg-white border border-slate-200 focus:border-google-blue rounded-xl px-3 py-2.5 text-[12px] font-medium outline-none transition-colors" />
                                                <input type="text" value={r.atasNama} onChange={e => updateRek(i,'atasNama',e.target.value)}
                                                    placeholder="Atas Nama" className="bg-white border border-slate-200 focus:border-google-blue rounded-xl px-3 py-2.5 text-[12px] font-medium outline-none transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-xl text-[12px] font-medium flex flex-wrap items-center gap-2">
                                    <Icon name="error" className="text-[16px]" />{errorMsg}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3 mt-6">
                            <button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">Batal</button>
                            <button onClick={handleSaveProgram} disabled={isUploading} className="flex-1 bg-google-green text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all disabled:opacity-50">
                                {editingId ? 'Simpan Perubahan' : 'Buat Program'}
                            </button>
                        </div>
                    </div>
                </div>
            );

            return null;
        }


        function Galeri({ data, setData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [formData, setFormData] = useState({ title: '', date: getLocalDate(), imageUrl: '', description: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [selectedPhoto, setSelectedPhoto] = useState(null); // Lightbox viewer state

            const handleSave = () => {
                if (!formData.title || !formData.imageUrl) return setErrorMsg("Judul dan Foto wajib diisi!");
                if (editingId) {
                    setData(data.map(item => item.id === editingId ? { ...item, ...formData } : item));
                    showToast('Dokumentasi berhasil diperbarui.');
                } else {
                    setData([{ id: Date.now(), ...formData }, ...data]);
                    showToast('Foto berhasil ditambahkan ke galeri.');
                }
                setIsFormOpen(false);
                setEditingId(null);
            };

            const handleEdit = (item) => {
                setFormData({
                    title: item.title,
                    date: item.date || getLocalDate(),
                    imageUrl: item.imageUrl,
                    description: item.description || ''
                });
                setEditingId(item.id);
                setErrorMsg('');
                setIsUploading(false);
                setIsFormOpen(true);
            };

            // Upload Galeri: Canvas compress G base64 G Firestore (tanpa GAS)
            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 1200, 0.82);
                    setFormData(prev => ({ ...prev, imageUrl: url }));
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            return (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div>
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                <Icon name="photo_library" className="text-[24px] text-red-600"/>
                                Galeri Lingkungan
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1.5">Album dokumentasi digital dan catatan kegiatan warga.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setFormData({ title: '', date: getLocalDate(), imageUrl: '', description: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-google-blue border border-google-blueDark text-white px-6 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2">
                                <Icon name="add_a_photo" className="text-[17px]" />
                                <span>Unggah Foto</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.map(item => (
                            <div key={item.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-1.5 hover:border-red-500/30 transition-all duration-300 flex flex-col group relative">
                                <div onClick={() => setSelectedPhoto(item)} className="w-full aspect-[4/3] bg-slate-100 relative shrink-0 border-b border-slate-200 overflow-hidden flex items-center justify-center cursor-zoom-in">
                                    <img src={item.imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" alt={item.title} onError={(e) => { e.target.style.display = 'none'; }} />
                                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        <div className="bg-white/90  p-3 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                            <Icon name="zoom_in" className="text-slate-800 text-[17px]"/>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 sm:p-8 md:p-8 flex flex-col justify-between flex-1">
                                    <div>
                                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1.5">
                                            <span className="text-[9px] font-medium text-red-600 bg-red-50 border border-red-500/15 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                                {parseLocalDate(item.date).toLocaleDateString('id-ID', {month: 'long', year:'numeric'})}
                                            </span>
                                            <span className="text-[10px] font-medium text-google-textVariant flex flex-wrap items-center gap-0.5">
                                                <Icon name="event" className="text-[12px]" />
                                                {parseLocalDate(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                            </span>
                                        </div>
                                        <h3 onClick={() => setSelectedPhoto(item)} className="text-[14px] font-medium text-google-text leading-snug tracking-tight mb-2 group-hover:text-red-600 transition-colors cursor-pointer line-clamp-1">{item.title}</h3>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
                                            <p className="text-[12.5px] font-medium text-google-textVariant leading-relaxed line-clamp-3">
                                                {item.description || 'Tidak ada deskripsi.'}
                                            </p>
                                        </div>
                                    </div>
                                    {userRole === 'admin' && (
                                        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                                            <button onClick={() => handleEdit(item)} className="bg-white text-google-blue w-9 h-9 rounded-full font-medium flex items-center justify-center hover:bg-google-blueLight border border-slate-200 hover:border-google-blue/30 transition-all duration-300">
                                                <Icon name="edit" className="text-[14px]" />
                                            </button>
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="bg-white text-google-red w-9 h-9 rounded-full font-medium flex items-center justify-center hover:bg-google-redLight border border-slate-200 hover:border-google-red/30 transition-all duration-300">
                                                <Icon name="delete" className="text-[14px]" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.length === 0 && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                            <div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border border-slate-200">
                                <Icon name="photo_library" className="text-[48px] text-slate-400" fill="true" />
                            </div>
                            <h3 className="font-medium text-[17px] mb-2 text-google-text">Belum Ada Foto</h3>
                            <p className="text-google-textVariant font-medium text-[13px]">Album dokumentasi warga masih kosong.</p>
                        </div>
                    )}

                    {/* Lightbox / Detail Viewer Modal */}
                    {selectedPhoto && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 overflow-hidden modal-card animate-modal-in" style={{ animation: 'slideUp 0.3s ease-out' }}>
                                <div className="p-6 sm:p-8 md:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Icon name="image" className="text-red-600" />
                                        <span className="text-[12px] font-medium text-google-text">Detail Dokumentasi</span>
                                    </div>
                                    <button onClick={() => setSelectedPhoto(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-all active:scale-95">
                                        <Icon name="close" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 hide-scrollbar">
                                    <div className="w-full bg-slate-900 aspect-video flex items-center justify-center relative">
                                        <img src={selectedPhoto.imageUrl} alt={selectedPhoto.title} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="p-6 sm:p-8 space-y-6">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-500/15 px-3 py-1.5 rounded-lg flex flex-wrap items-center gap-1">
                                                <Icon name="event" className="text-[13px]" />
                                                {parseLocalDate(selectedPhoto.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-medium text-google-text leading-tight tracking-tight">{selectedPhoto.title}</h3>
                                        <div className="bg-slate-50 border border-slate-200/60 p-6 sm:p-8 md:p-8 rounded-2xl text-google-textVariant text-[13px] leading-relaxed font-medium whitespace-pre-line">
                                            {selectedPhoto.description || 'Tidak ada deskripsi rinci untuk kegiatan ini.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upload / Edit Form Modal */}
                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">
                                    {editingId ? 'Edit Dokumentasi' : 'Unggah Dokumentasi'}
                                </h3>
                                <div className="space-y-7">
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Judul / Kegiatan</label>
                                        <input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Contoh: Kerja Bakti 17an" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal</label>
                                        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Deskripsi Rinci</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl resize-none min-h-[100px] leading-relaxed transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Tuliskan keterangan lengkap kegiatan di sini..."></textarea>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">File Foto</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="cloud_upload" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.imageUrl ? "Foto Siap" : "Pilih File")}</p>
                                                <p className="text-[10px] text-google-textVariant truncate">{formData.imageUrl ? "Klik untuk mengganti foto" : "Maksimal 2MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200">
                                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-4 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); setEditingId(null); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex flex-wrap bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all duration-300 disabled:opacity-50 flex flex-wrap items-center justify-center gap-2">
                                        {editingId ? 'Simpan' : 'Unggah'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Foto?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Foto ini akan dihapus dari galeri warga.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { setData(data.filter(item => item.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Foto berhasil dihapus.'); }} className="flex-1 bg-google-red text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function Informasi({ data, setData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [formData, setFormData] = useState({ title: '', date: getLocalDate(), imageUrl: '', description: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            
            const handleSave = () => {
                if (!formData.title || !formData.description) return setErrorMsg("Judul dan deskripsi wajib diisi!");
                if (editingId) { setData(data.map(item => item.id === editingId ? { ...item, ...formData } : item)); showToast('Informasi berhasil diperbarui.'); }
                else { setData([{ id: Date.now(), ...formData }, ...data]); showToast('Informasi berhasil dipublikasikan.'); }
                setIsFormOpen(false);
            };

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) { setErrorMsg('File harus berupa gambar!'); return; }
                if (file.size > 10 * 1024 * 1024) { setErrorMsg('Ukuran file maksimal 10MB!'); return; }
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 1200, 0.82);
                    setFormData(prev => ({ ...prev, imageUrl: url }));
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            return (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Papan Informasi & Kegiatan</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Pengumuman dan dokumentasi lingkungan RT.</p></div>
                        {userRole === 'admin' && <button onClick={() => { setFormData({ title: '', date: getLocalDate(), imageUrl: '', description: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2"><Icon name="add" className="text-[17px]" /><span>Buat Info Baru</span></button>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        {data.map(item => (
                            <div key={item.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-google-blue/40 transition-all duration-300 flex flex-col group">
                                {item.imageUrl && <div className="w-full h-48 sm:h-56 bg-slate-100 relative shrink-0 border-b border-slate-200 overflow-hidden"><img src={item.imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" onError={(e) => { e.target.style.display = 'none'; }} /></div>}

                                <div className="p-6 sm:p-8 flex flex-col">
                                    <h3 className="text-[17px] sm:text-[18px] font-medium text-google-text leading-snug mb-4 group-hover:text-google-blue transition-colors tracking-tight">{item.title}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mb-5 text-google-blueDark bg-google-blueLight self-start px-4 py-2 rounded-lg text-[11px] font-medium uppercase tracking-widest border border-google-blue/30"><Icon name="calendar_today" className="text-[14px]" /><span>{parseLocalDate(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}</span></div>
                                    <p className="text-[13px] font-medium text-google-textVariant leading-relaxed mb-6 whitespace-pre-line flex-1">{item.description}</p>
                                    
                                    {userRole === 'admin' && (
                                        <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                                            <button onClick={() => { setFormData(item); setEditingId(item.id); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95"><Icon name="edit" className="text-[14px]" /> Edit</button>
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95"><Icon name="delete" className="text-[14px]" /> Hapus</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border border-slate-200"><Icon name="campaign" className="text-[48px] text-slate-400" fill="true" /></div><h3 className="font-medium text-[17px] mb-2 text-google-text">Belum Ada Informasi</h3><p className="text-google-textVariant font-medium text-[13px]">Papan informasi warga masih kosong saat ini.</p></div>}

                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
<div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 shrink-0 tracking-tight">{editingId ? 'Edit Info Kegiatan' : 'Buat Info Baru'}</h3>
                                <div className="space-y-7 overflow-y-auto pr-2 pb-2 hide-scrollbar">
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Judul Utama</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Masukkan judul..." /></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text" /></div>
                                    
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Gambar Banner (Upload ke GDrive)</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="cloud_upload" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah ke Drive..." : (formData.imageUrl ? "Gambar Siap" : "Pilih File Gambar")}</p>
                                                <p className="text-[10px] text-google-textVariant truncate">{formData.imageUrl ? "Klik area ini untuk mengganti gambar" : "Format JPG/PNG, Maksimal 2MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200 group">
                                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({...prev, imageUrl: ''})); }} className="absolute top-0 right-0 bg-google-red/90 text-white w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="delete" className="text-[14px]"/></button>
                                                </div>
                                            )}
                                        </div>
                                        <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="mt-2 w-full bg-transparent border-b border-slate-200 focus:border-google-blue p-2 text-[11px] font-medium outline-none transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Atau paste URL gambar manual secara langsung di sini..." />
                                    </div>

                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Deskripsi Lengkap</label><textarea value={formData.description} onChange={e => {setFormData({...formData, description: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl min-h-[160px] resize-none transition-all duration-300 text-google-text leading-relaxed placeholder:text-slate-400" placeholder="Tuliskan detail informasi di sini..."></textarea></div>
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-4 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200 shrink-0">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex flex-wrap bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">Publikasikan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Informasi?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Konten ini akan dihapus secara permanen dari layar warga.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={() => { setData(data.filter(item => item.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Informasi berhasil dihapus.'); }} className="flex flex-wrap bg-google-red text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function WargaList({ members, setMembers, userRole, identity, cycleNumber, currentRound, arisanPeriod }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [formData, setFormData] = useState({ name: '', status: 'Normal', program: 'Arisan', debt: 0, hasWon: false, wonRound: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [printMode, setPrintMode] = useState('');
            const [searchQuery, setSearchQuery] = useState('');
            const [previewMember, setPreviewMember] = useState(null);

            useEffect(() => {
                if (previewMember) {
                    import('jsbarcode').then((module) => {
                        const JsBarcode = module.default;
                    JsBarcode("#preview-barcode", `M-${previewMember.id}`, { width: 2, height: 60, fontSize: 16 });
                    });
                }
            }, [previewMember]);

            const handleDownloadBarcode = () => {
                const canvas = document.getElementById("preview-barcode");
                if (!canvas) return;
                const url = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                link.href = url;
                link.download = `Barcode_${previewMember.name.replace(/\s+/g, '_')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
            
            const handlePrintBarcode = () => {
                setPrintMode('barcode');
                setTimeout(() => {
                    
                    import('jsbarcode').then((module) => {
                        const JsBarcode = module.default;
                        JsBarcode(".barcode-element").init();
                    });
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => setPrintMode(''), 1000);
                    }, 200);
                }, 200);
            };
            
            const handleSave = () => {
                const trimmedName = formData.name ? formData.name.trim() : '';
                if (!trimmedName) return setErrorMsg("Nama wajib diisi!");
                // Validasi duplikat nama (kecuali saat edit dirinya sendiri)
                const isDuplicate = members.some(m => m.name.trim().toLowerCase() === trimmedName.toLowerCase() && m.id !== editingId);
                if (isDuplicate) return setErrorMsg("Nama warga sudah terdaftar di sistem!");
                const nominalDebt = safeNumber(formData.debt);
                const finalWonRound = formData.hasWon ? safeNumber(formData.wonRound || 1) : null;
                const newObj = { name: trimmedName, status: formData.status, program: formData.program, debt: nominalDebt, redRecord: nominalDebt > 0, hasWon: formData.hasWon, wonRound: finalWonRound };
                if (editingId) { setMembers(members.map(m => m.id === editingId ? { ...m, ...newObj } : m)); showToast('Data warga berhasil diperbarui.'); }
                else { setMembers([...members, { id: Date.now(), ...newObj }]); showToast('Warga baru berhasil ditambahkan.'); }
                setIsFormOpen(false);
            };

            const executeDelete = () => { setMembers(members.filter(m => m.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Data warga berhasil dihapus.'); };

            return (
                <div className="space-y-7">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Buku Induk Warga</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Total <span className="font-medium text-google-blue">{members.length} Warga</span> Terdaftar</p></div>
                        <div className="flex gap-3 w-full sm:w-auto overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
                            <button onClick={() => { setPrintMode('buku'); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(''), 1000); }, 100); }} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="print" className="text-[16px]" /><span>Cetak Form</span></button>
                            {userRole === 'admin' && <button onClick={handlePrintBarcode} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="qr_code_scanner" className="text-[16px]" /><span>Cetak Barcode</span></button>}
                            {userRole === 'admin' && <button onClick={() => { setFormData({ name: '', status: 'Normal', program: 'Arisan', debt: 0, hasWon: false, wonRound: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); }} className="bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="person_add" className="text-[17px]" /><span>Tambah Data</span></button>}
                        </div>
                    </div>

                    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 no-print">
                        <Icon name="search" className="text-[20px] text-slate-400 shrink-0 ml-2" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama warga..." className="w-full bg-transparent outline-none font-medium text-[13px] text-google-text placeholder:text-slate-400 placeholder:font-medium" />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 shrink-0 active:scale-95 transition-all"><Icon name="close" className="text-[16px]" /></button>}
                    </div>

                    {printMode === 'buku' && (
                        <div className="hidden print-only">
                            <div className="kop-surat">
                                <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                                <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                                <div className="kop-surat-logo-right"></div>
                            </div>
                            <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Buku Induk &amp; Evaluasi Warga</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber || 1} | Putaran Ke-{currentRound} | Periode: {formatBulanTahun(arisanPeriod)}</p></div>
                            <table className="print-table">
                                <thead><tr><th width="5%">No</th><th width="30%">Nama Warga</th><th width="15%">Program</th><th width="15%">Status Arisan</th><th width="15%">Tunggakan</th><th width="20%">Keterangan</th></tr></thead>
                                <tbody>
                                    {members.length === 0 ? <tr><td colSpan="6" className="text-center font-medium">Belum ada data.</td></tr> : members.map((m, idx) => (
                                        <tr key={m.id}>
                                            <td className="text-center font-medium">{idx + 1}</td>
                                            <td className="font-medium">{m.name} {m.status === 'Meninggal' && <span className="text-[9px] bg-slate-200 px-1 rounded-sm text-slate-600">Wafat</span>}{m.status === 'Nonaktif' && <span className="text-[9px] bg-slate-200 px-1 rounded-sm text-slate-600">Nonaktif</span>}</td>
                                            <td className="text-center font-medium">{m.program === 'IuranOnly' ? 'Iuran Saja' : (m.program === 'ArisanOnly' ? 'Arisan Saja (Bebas Jimpitan)' : (m.program === 'JimpitanOnly' ? 'Jimpitan & Iuran Umum' : 'Arisan, Iuran & Jimpitan'))}</td>
                                            <td className="text-center font-medium">{m.program === 'IuranOnly' || m.program === 'JimpitanOnly' ? '-' : (m.hasWon ? `Menang (Put.${m.wonRound})` : 'Belum')}</td>
                                            <td className="text-right font-medium">{m.debt > 0 ? formatRp(m.debt) : '-'}</td><td></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="ttd-container">
                                <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                                <div className="ttd-box"><p>Dibuat Oleh,</p><p>Sekretaris / Admin</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                            </div>
                        </div>
                    )}
                    
                    {printMode === 'barcode' && (
                        <div className="hidden print-only">
                            <div className="text-center mb-8"><h2 className="text-[18pt] font-medium uppercase mb-1">Kartu Barcode Warga</h2><p className="text-[12pt]">{identity?.name || 'Aplikasi Arisan'}</p></div>
                            <div className="grid grid-cols-2 gap-8" style={{ pageBreakInside: 'avoid' }}>
                                {members.map(m => (
                                    <div key={m.id} className="border border-black p-6 rounded-xl flex flex-col items-center justify-center text-center" style={{ pageBreakInside: 'avoid' }}>
                                        <h3 className="font-medium text-[12pt] mb-2 uppercase">{identity?.name || 'RT/RW'}</h3>
                                        <p className="font-medium text-[16pt] uppercase mb-1 leading-tight">{m.name}</p>
                                        <p className="font-medium text-[11pt] mb-4 text-gray-700">No. Anggota: M-{m.id}</p>
                                        <svg className="barcode-element" data-value={`M-${m.id}`} data-text={`M-${m.id}`} data-height="50" data-width="1.8" data-fontSize="14"></svg>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6 no-print">
                        {(() => {
                            const filteredMembers = members.filter(m => (m.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()));
                            return (
                                <>
                                    {filteredMembers.map((member) => (
                                        <div key={member.id} onClick={(e) => { if(!e.target.closest('button')) setPreviewMember(member); }} className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-google-blue/40 transition-all duration-300 gap-5 group cursor-pointer">
                                <div className="flex flex-wrap items-center gap-5">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-medium text-[20px] shrink-0 border transition-colors duration-300 ${isNonaktif(member) ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-google-blueLight text-google-blueDark border-google-blue/30 group-hover:bg-google-blue group-hover:text-white group-hover:border-google-blueDark'}`}>{member.name.charAt(0).toUpperCase()}</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-medium text-[16px] truncate transition-colors tracking-tight ${isNonaktif(member) ? 'text-slate-400 line-through' : 'text-google-text group-hover:text-google-blueDark'}`}>{member.name} {isNonaktif(member) && <span className="text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md ml-2 font-medium border border-slate-200 align-middle">{member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</h3>
                                        <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-[10px] uppercase tracking-wider">
                                            <span className={`px-3 py-1.5 rounded-md font-medium border ${member.program === 'IuranOnly' ? 'bg-slate-50 text-google-textVariant border-slate-200' : (member.program === 'ArisanOnly' ? 'bg-google-yellowLight text-google-yellowDark border-google-yellow/40' : (member.program === 'JimpitanOnly' ? 'bg-google-greenLight text-google-greenDark border-google-green/40' : 'bg-google-blue/10 text-google-blueDark border-google-blue/30'))}`}>{member.program === 'IuranOnly' ? 'Hanya Iuran' : (member.program === 'ArisanOnly' ? 'Arisan Saja (Bebas Jimpitan)' : (member.program === 'JimpitanOnly' ? 'Jimpitan & Iuran Umum' : 'Arisan, Iuran & Jimpitan'))}</span>
                                            {member.program !== 'IuranOnly' && member.program !== 'JimpitanOnly' && (member.hasWon ? <span className="bg-google-blue text-white px-3 py-1.5 rounded-md font-medium shadow-sm border border-google-blueDark flex flex-wrap items-center gap-1"><Icon name="emoji_events" className="text-[13px]"/> Menang Put. {member.wonRound}</span> : <span className="text-google-textVariant px-3 py-1.5 rounded-md bg-slate-100 font-medium border border-slate-200">Belum Menang</span>)}
                                            {member.debt > 0 ? <span className="bg-google-redLight text-google-redDark px-3 py-1.5 rounded-md font-medium border border-google-red/40 animate-pulse flex flex-wrap items-center gap-1.5"><Icon name="warning" className="text-[13px]"/> Tunggakan {formatRp(member.debt)}</span> : <span className="bg-google-greenLight text-google-greenDark px-3 py-1.5 rounded-md font-medium border border-google-green/40 flex flex-wrap items-center gap-1.5"><Icon name="check_circle" className="text-[13px]"/> Aman</span>}
                                        </div>
                                    </div>
                                </div>
                                {userRole === 'admin' && (
                                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 border-t sm:border-t-0 border-slate-200 pt-5 sm:pt-0 justify-end w-full sm:w-auto opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <button onClick={() => { setFormData(member); setEditingId(member.id); setIsFormOpen(true); setErrorMsg(''); }} className="bg-google-blue text-white px-5 py-2 rounded-full font-medium text-[12px] hover:bg-google-blueDark shadow-sm active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5"><Icon name="edit" className="text-[14px]" /><span className="sm:hidden">Edit</span></button>
                                        <button onClick={() => setDeleteConfirmId(member.id)} className="bg-google-red/10 text-google-red px-5 py-2 rounded-full font-medium text-[12px] hover:bg-google-red hover:text-white shadow-sm active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5"><Icon name="delete" className="text-[14px]" /><span className="sm:hidden">Hapus</span></button>
                                    </div>
                                )}
                            </div>
                                    ))}
                                    {filteredMembers.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border border-slate-200"><Icon name="search_off" className="text-[48px] text-slate-400" fill="true" /></div><p className="text-google-text font-medium text-[17px] tracking-tight">Tidak Ditemukan</p><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Tidak ada warga yang cocok dengan pencarian.</p></div>}
                                </>
                            );
                        })()}
                    </div>

                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit Data Warga' : 'Tambah Warga Baru'}</h3>
                                <div className="space-y-7">
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nama Lengkap</label><input type="text" value={formData.name} onChange={e => {setFormData({...formData, name: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Masukkan nama..." /></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Program Keikutsertaan</label><select value={formData.program || 'Arisan'} onChange={e => setFormData({...formData, program: e.target.value, hasWon: false, wonRound: ''})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text cursor-pointer"><option value="Arisan">Full (Arisan, Iuran &amp; Jimpitan)</option><option value="IuranOnly">Hanya Iuran Umum Saja</option><option value="ArisanOnly">Arisan Saja (Bebas Jimpitan)</option><option value="JimpitanOnly">Jimpitan &amp; Iuran Umum (Tanpa Arisan)</option></select></div>
                                    <div className="flex flex-wrap gap-5">
                                        <div className="flex-1"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text cursor-pointer"><option value="Normal">Aktif</option><option value="Meninggal">Meninggal / Wafat</option><option value="Nonaktif">Nonaktif / Pindah</option></select></div>
                                        <div className="flex-1"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tunggakan (Rp)</label><input type="number" min="0" value={formData.debt} onChange={e => {setFormData({...formData, debt: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                    </div>
                                    {formData.program !== 'IuranOnly' && formData.program !== 'JimpitanOnly' && (
                                        <div className="pt-5 border-t border-slate-200">
                                            <label className="flex flex-wrap items-center gap-3 mb-5 cursor-pointer group"><div className="relative flex items-center justify-center"><input type="checkbox" checked={formData.hasWon} onChange={e => setFormData({...formData, hasWon: e.target.checked})} className="peer appearance-none w-6 h-6 border border-slate-400 rounded-lg checked:bg-google-blue checked:border-google-blue transition-colors cursor-pointer" /><Icon name="check" className="absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth="4"/></div><span className="text-[13px] font-medium text-google-text group-hover:text-google-blue transition-colors">Warga Sudah Menang Arisan</span></label>
                                            {formData.hasWon && <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Di Putaran Ke-</label><input type="number" min="1" value={formData.wonRound} onChange={e => {setFormData({...formData, wonRound: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Misal: 3" /></div>}
                                        </div>
                                    )}
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-5 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} className="flex flex-wrap bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Simpan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="person_remove" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Warga?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Data warga dan riwayatnya akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={executeDelete} className="flex flex-wrap bg-google-red text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {previewMember && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in" onClick={() => setPreviewMember(null)}>
                            <div className="max-h-[90vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 relative modal-card animate-modal-in" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setPreviewMember(null)} className="absolute top-4 right-4 w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-all"><Icon name="close" className="text-[17px]" /></button>
                                
                                <div className="mb-4">
                                    <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center font-medium text-[32px] border shadow-sm ${isNonaktif(previewMember) ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-google-blueLight text-google-blueDark border-google-blue/30'}`}>{previewMember.name.charAt(0).toUpperCase()}</div>
                                </div>
                                <h3 className={`font-medium text-[18px] tracking-tight mb-1 ${isNonaktif(previewMember) ? 'text-slate-400 line-through' : 'text-google-text'}`}>{previewMember.name}</h3>
                                <p className="text-[12px] font-medium text-google-textVariant mb-6 bg-slate-50 inline-block px-4 py-1.5 rounded-lg border border-slate-200">No. Anggota: M-{previewMember.id}</p>

                                <div className="space-y-5 text-left mb-6 bg-slate-50 p-5 rounded-3xl border border-slate-200">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Status</span><span className="font-medium text-[13px] text-google-text">{previewMember.status}</span></div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Program</span><span className="font-medium text-[13px] text-google-text">{previewMember.program === 'IuranOnly' ? 'Hanya Iuran' : (previewMember.program === 'ArisanOnly' ? 'Arisan Saja (Bebas Jimpitan)' : (previewMember.program === 'JimpitanOnly' ? 'Jimpitan & Iuran Umum' : 'Arisan, Iuran & Jimpitan'))}</span></div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Tunggakan</span><span className={`font-medium text-[13px] ${previewMember.debt > 0 ? 'text-google-red' : 'text-google-green'}`}>{previewMember.debt > 0 ? formatRp(previewMember.debt) : 'Rp 0 (Aman)'}</span></div>
                                    {previewMember.program !== 'IuranOnly' && (
                                        <div className="flex justify-between items-center"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Arisan</span><span className={`font-medium text-[13px] ${previewMember.hasWon ? 'text-google-blue' : 'text-google-textVariant'}`}>{previewMember.hasWon ? `Menang (Put. ${previewMember.wonRound})` : 'Belum Menang'}</span></div>
                                    )}
                                </div>
                                
                                <div className="border border-dashed border-slate-400 rounded-3xl p-5 bg-white mb-2 relative">
                                    <p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-3">Barcode Resmi</p>
                                    <canvas id="preview-barcode" className="mx-auto w-full max-w-[200px]"></canvas>
                                    <button onClick={handleDownloadBarcode} className="mt-4 bg-slate-100 hover:bg-slate-200 text-google-text font-medium text-[11px] px-4 py-2 rounded-full transition-all flex items-center justify-center gap-1 mx-auto border border-slate-200 active:scale-95"><Icon name="download" className="text-[14px]"/> Simpan Gambar (PNG)</button>
                                </div>
                                <p className="text-[10px] font-medium text-slate-400 mt-4">Tunjukkan barcode ini kepada petugas jika diperlukan.</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function IuranUmum({ iuranData, setIuranData, members, userRole, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions, identity }) {
            const [view, setView] = useState('list');
            const [selectedAgenda, setSelectedAgenda] = useState(null);
            const [formData, setFormData] = useState({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 });
            const [tempPayments, setTempPayments] = useState({});
            const [transferAmount, setTransferAmount] = useState('');
            const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
            const [errorMsg, setErrorMsg] = useState('');
            // FIX: Tambah state untuk konfirmasi hapus agenda
            const [deleteConfirmAgendaId, setDeleteConfirmAgendaId] = useState(null);

            const activeMembers = useMemo(() => members.filter(m => m.status === 'Normal'), [members]);

            const handleSaveAgenda = () => {
                if (!formData.title || !formData.title.trim()) return setErrorMsg("Judul Agenda Wajib!");
                const safeMinAmount = safeNumber(formData.minAmount);
                if (safeMinAmount <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
                if (selectedAgenda) { setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate } : item)); showToast('Agenda iuran berhasil diperbarui.'); }
                else { setIuranData([{ id: Date.now(), title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate, payments: {}, transferredToKas: 0 }, ...iuranData]); showToast('Agenda iuran baru berhasil dibuat.'); }
                setView('list');
            };

            const handleSavePayments = () => {
                const cleanPayments = {};
                // FIX: Gunakan parseInt untuk memastikan key tersimpan sebagai angka konsisten
                for (let memberId in tempPayments) {
                    const numId = parseInt(memberId);
                    if (tempPayments[memberId] >= selectedAgenda.minAmount) cleanPayments[numId] = safeNumber(tempPayments[memberId]);
                }
                setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, payments: cleanPayments } : item));
                setView('list');
                showToast('Rekap pembayaran warga berhasil disimpan.');
            };

            const executeTransferToKas = () => {
                const nominal = safeNumber(transferAmount);
                const sisa = calculateTotal(selectedAgenda.payments || {}) - (selectedAgenda.transferredToKas || 0);
                if (nominal <= 0 || nominal > sisa) return setErrorMsg(`Nominal penarikan maksimal ${formatRp(sisa)}!`);
                setKasRtBalance(prev => prev + nominal);
                setKasRtTransactions(prev => [{ id: Date.now(), date: getLocalDate(), type: 'Pemasukan', category: 'Iuran Umum', description: `Mutasi Iuran: ${selectedAgenda.title}`, amount: nominal }, ...prev]);
                setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, transferredToKas: (selectedAgenda.transferredToKas || 0) + nominal } : item));
                setIsTransferModalOpen(false); setView('list');
                showToast(`Berhasil menyetor ${formatRp(nominal)} ke Kas Warga.`);
            };

            const calculateTotal = (obj) => { let total = 0; for(let k in obj) total += Number(obj[k] || 0); return total; };

            if (view === 'form') {
                return (
                    <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 max-w-2xl mx-auto shadow-xl">
                        <div className="flex flex-wrap items-center gap-5 mb-8 border-b border-slate-200 pb-6"><button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-12 h-12 bg-white text-google-text border border-slate-200 hover:bg-slate-50 hover:border-slate-400 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[17px] font-medium text-google-text" /></button><h2 className="text-[18px] sm:text-[20px] font-medium text-google-text leading-tight tracking-tight">{selectedAgenda ? 'Edit Agenda' : 'Buat Agenda Iuran'}</h2></div>
                        <div className="space-y-8">
                            <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nama / Keperluan Iuran</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Misal: Dana 17 Agustus" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Batas Akhir Waktu</label><input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text cursor-pointer" /></div>
                                <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tarif Minimal (Rp)</label><input type="number" min="0" value={formData.minAmount} onChange={e => {setFormData({...formData, minAmount: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                            </div>
                        </div>
                        {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-6 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                        <div className="flex justify-end mt-10 pt-6 border-t border-slate-200">
                            <button onClick={handleSaveAgenda} className="bg-google-blue text-white px-8 py-4 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2"><Icon name="save" className="text-[17px]"/> Simpan Agenda</button>
                        </div>
                    </div>
                );
            }

            if (view === 'manage') {
                const totalTerkumpul = calculateTotal(tempPayments);
                const lunasCount = activeMembers.filter(m => (tempPayments[m.id] || 0) >= selectedAgenda.minAmount).length;
                const transferred = selectedAgenda.transferredToKas || 0;
                const sisa = totalTerkumpul - transferred;

                return (
                    <div className="space-y-8 max-w-7xl mx-auto">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 no-print bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex flex-wrap items-center gap-5"><button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-12 h-12 bg-white text-google-text border border-slate-200 hover:bg-slate-50 hover:border-slate-400 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[17px] font-medium text-google-text" /></button><div><h2 className="text-[18px] sm:text-[20px] font-medium text-google-text leading-tight tracking-tight">{selectedAgenda.title}</h2><p className="text-[13px] font-medium text-google-textVariant mt-1">Kelola Penyetoran Warga</p></div></div>
                            {userRole === 'admin' && <button onClick={() => window.print()} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="print" className="text-[16px]" /> <span className="hidden sm:inline">Cetak Laporan</span></button>}
                        </div>

                        <div className="hidden print-only">
                            <div className="kop-surat">
                                <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                                <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                                <div className="kop-surat-logo-right"></div>
                            </div>
                            <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Penerimaan Iuran Umum</h2><p className="text-[11pt]">Agenda: <strong>{selectedAgenda.title}</strong></p></div>
                            <div style={{marginBottom:'15px', fontSize:'11pt'}}><p>Target Minimal per Warga: <strong>{formatRp(selectedAgenda.minAmount)}</strong></p><p>Total Terkumpul: <strong>{formatRp(totalTerkumpul)}</strong></p></div>
                            <table className="print-table">
                                <thead><tr><th width="5%">No</th><th width="35%">Nama Warga</th><th width="20%">Status</th><th width="20%">Nominal Bayar</th><th width="20%">TTD</th></tr></thead>
                                <tbody>
                                    {activeMembers.map((m, idx) => {
                                        const amt = tempPayments[m.id] || 0;
                                        return <tr key={m.id}><td className="text-center font-medium">{idx + 1}</td><td className="font-medium">{m.name}</td><td className="text-center font-medium">{amt >= selectedAgenda.minAmount ? 'LUNAS' : '-'}</td><td className="text-right font-medium">{amt > 0 ? formatRp(amt) : ''}</td><td></td></tr>
                                    })}
                                </tbody>
                            </table>
                            <div className="ttd-container">
                                <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                                <div className="ttd-box"><p>Penerima / Bendahara,</p><br/><div className="ttd-space" style={{height:'60px'}}></div><p className="ttd-name">( ................................... )</p></div>
                            </div>
                        </div>

                        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm no-print">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
                                <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl border border-slate-200 text-center shadow-sm"><p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-2">Target / Warga</p><p className="text-[20px] font-medium text-google-text tracking-tight">{formatRp(selectedAgenda.minAmount)}</p></div>
                                <div className="bg-google-greenLight p-6 sm:p-8 md:p-6 rounded-3xl border border-google-green/30 text-center shadow-sm"><p className="text-[10px] font-medium text-google-greenDark uppercase tracking-widest mb-2">Dana Terkumpul</p><p className="text-[20px] font-medium text-google-greenDark tracking-tight">{formatRp(totalTerkumpul)}</p></div>
                                <div className="bg-google-blueLight p-6 sm:p-8 md:p-6 rounded-3xl border border-google-blue/30 text-center flex flex-col items-center relative shadow-sm hover:shadow-md transition-shadow group"><p className="text-[10px] font-medium text-google-blueDark uppercase tracking-widest mb-2">Sisa (Belum Disetor)</p><p className="text-[20px] font-medium text-google-blueDark group-hover:scale-105 transition-transform tracking-tight">{formatRp(sisa)}</p>
                                    {userRole === 'admin' && sisa > 0 && <button onClick={() => { 
                                            const savedTotal = calculateTotal(selectedAgenda.payments || {});
                                            const currentTotal = calculateTotal(tempPayments);
                                            if (savedTotal !== currentTotal) { setErrorMsg('Simpan Rekap Warga dulu sebelum menyetor dana!'); return; }
                                            setIsTransferModalOpen(true); setErrorMsg(''); 
                                        }} className="absolute -bottom-5 bg-google-blue text-white text-[12px] font-medium px-6 py-2.5 rounded-full border border-google-blueDark shadow-lg hover:bg-google-blueDark hover:-translate-y-1 active:scale-95 transition-all flex flex-wrap items-center gap-1.5"><Icon name="sync_alt" className="text-[14px]" /> Setor ke Kas Utama</button>}
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 border border-slate-200 p-6 sm:p-8 md:p-6 rounded-3xl mb-10 shadow-sm">
                                <div className="flex justify-between items-end mb-4"><span className="text-[13px] font-medium text-google-textVariant">Progres Pelunasan Warga</span><span className="text-[17px] font-medium text-google-blueDark leading-none">{lunasCount} <span className="text-[13px] text-google-textVariant">/ {activeMembers.length}</span></span></div>
                                <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-google-blue h-full rounded-full transition-all duration-1000" style={{ width: `${activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100}%` }}></div></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {activeMembers.map(member => {
                                    const amountPaid = tempPayments[member.id] || 0;
                                    const isLunas = amountPaid >= selectedAgenda.minAmount;
                                    const isError = amountPaid > 0 && amountPaid < selectedAgenda.minAmount;
                                    return (
                                        <div key={member.id} className={`p-6 rounded-3xl border flex flex-col justify-between transition-all duration-300 group ${userRole === 'admin' ? (isError ? 'bg-google-redLight border-google-red hover:shadow-lg' : 'bg-white border-slate-200 hover:border-google-blue hover:shadow-xl hover:-translate-y-1') : (isLunas ? 'bg-google-greenLight border-google-green shadow-sm' : 'bg-slate-50 border-slate-200')}`}>
                                            <div className="flex justify-between items-start mb-6">
                                                <h3 className="font-medium text-[14px] text-google-text truncate pr-3 group-hover:text-google-blue transition-colors leading-tight">{member.name}</h3>
                                                {isLunas ? <span className="text-[9px] bg-google-green text-white px-3 py-1.5 rounded-md font-medium uppercase tracking-widest shadow-sm flex flex-wrap items-center gap-1 shrink-0 border border-google-greenDark"><Icon name="check" className="text-[11px]"/> LUNAS</span> : <span className="text-[9px] bg-slate-200 text-google-textVariant px-3 py-1.5 rounded-md font-medium uppercase tracking-widest shrink-0 border border-slate-400">BELUM</span>}
                                            </div>
                                            {userRole === 'admin' ? (
                                                <div>
                                                    <div className={`flex items-center bg-slate-50 rounded-2xl px-4 py-3 border transition-colors duration-300 ${isError ? 'border-google-red' : 'border-slate-200 focus-within:border-google-blue focus-within:bg-white focus-within:shadow-md'}`}>
                                                        <span className="text-[13px] font-medium text-google-textVariant mr-2">Rp</span>
                                                        <input type="number" min="0" value={tempPayments[member.id] || ''} onChange={(e) => { setTempPayments(prev => ({...prev, [member.id]: safeNumber(e.target.value)})); setErrorMsg(''); }} className="w-full bg-transparent border-none text-[14px] font-medium outline-none p-0 text-google-text placeholder:text-slate-300" placeholder="0" />
                                                    </div>
                                                    {isError && <p className="text-[10px] font-medium text-google-redDark mt-2.5 ml-1 flex flex-wrap items-center gap-1.5"><Icon name="info" className="text-[13px]" /> Kurang dari {formatRp(selectedAgenda.minAmount)}</p>}
                                                </div>
                                            ) : (
                                                <div className="text-[12px] font-medium mt-2 bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-2.5 shadow-sm">
                                                    {isLunas ? <><Icon name="task_alt" className="text-[17px] text-google-greenDark" /><span className="text-google-greenDark">Memenuhi Syarat</span></> : <><Icon name="pending" className="text-[17px] text-google-textVariant" /><span className="text-google-textVariant">Menunggu Penyetoran</span></>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {userRole === 'admin' && (
                                <div className="mt-10 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-5">
                                    {errorMsg ? <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-5 py-4 rounded-2xl w-full sm:w-auto flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div> : <div></div>}
                                    <button onClick={handleSavePayments} className="w-full sm:w-auto bg-google-blue text-white px-10 py-4 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="save" className="text-[17px]" /> Simpan Rekap Warga</button>
                                </div>
                            )}
                        </div>

                        {isTransferModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                                <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                    <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-yellow/30"><Icon name="move_to_inbox" className="text-[48px] text-google-yellowDark" fill="true" /></div>
                                    <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Setor ke Kas Warga</h3>
                                    <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Mutasi dana fisik dari Iuran ke Saldo Buku Kas Utama.</p>
                                    
                                    <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl mb-8 border border-slate-200 shadow-sm"><p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-2">Batas Maksimal Tarik</p><p className="text-[24px] font-medium text-google-text tracking-tight">{formatRp(sisa)}</p></div>
                                    
                                    <div className="text-left mb-8"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal Disetor (Rp)</label><input type="number" min="0" value={transferAmount} onChange={e => {setTransferAmount(safeNumber(e.target.value)); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[16px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                    
                                    {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mb-8 flex flex-wrap items-center gap-2 text-left"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                    
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => { setIsTransferModalOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                        <button onClick={executeTransferToKas} className="flex flex-wrap bg-google-yellow text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-yellowDark shadow-md hover:bg-google-yellowDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Setor Dana</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Agenda Iuran Umum</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Penggalangan dana non-arisan (berlaku untuk semua warga).</p></div>
                        {userRole === 'admin' && <button onClick={() => { setFormData({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 }); setSelectedAgenda(null); setView('form'); setErrorMsg(''); }} className="shrink-0 bg-google-blue text-white px-8 py-3.5 rounded-full font-medium flex flex-wrap items-center gap-2 text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto justify-center"><Icon name="add_task" className="text-[17px]" /><span>Buat Agenda Baru</span></button>}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                        {iuranData.map(agenda => {
                            const payments = agenda.payments || {};
                            const totalTerkumpul = calculateTotal(payments);
                            const lunasCount = activeMembers.filter(m => payments[m.id] >= agenda.minAmount).length;
                            const progressPercent = activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100;

                            return (
                                <div key={agenda.id} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1.5 hover:border-google-blue/40 transition-all duration-300 group">
                                    <div>
                                        <h3 className="text-[20px] font-medium text-google-text leading-snug mb-6 group-hover:text-google-blue transition-colors tracking-tight">{agenda.title}</h3>
                                        <div className="flex flex-col sm:flex-row gap-4 mb-8">
                                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-6 sm:p-8 md:p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="w-12 h-12 rounded-full bg-google-blueLight flex items-center justify-center text-google-blue border border-google-blue/30"><Icon name="event" className="text-[20px]" fill="true"/></div><div><p className="text-[9px] font-medium text-google-textVariant uppercase tracking-widest mb-1">Batas Akhir</p><p className="text-[13px] font-medium text-google-text">{parseLocalDate(agenda.dueDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p></div></div>
                                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-6 sm:p-8 md:p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="w-12 h-12 rounded-full bg-google-greenLight flex items-center justify-center text-google-green border border-google-green/30"><Icon name="payments" className="text-[20px]" fill="true"/></div><div><p className="text-[9px] font-medium text-google-textVariant uppercase tracking-widest mb-1">Target Minimal</p><p className="text-[13px] font-medium text-google-text">{formatRp(agenda.minAmount)}</p></div></div>
                                        </div>
                                        <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl border border-slate-200 mb-8 shadow-sm">
                                            <div className="flex justify-between items-end mb-4"><span className="text-[12px] font-medium text-google-textVariant">Progres Warga Lunas</span><span className="text-[16px] font-medium text-google-blueDark leading-none">{lunasCount} <span className="text-[12px] text-google-textVariant">/ {activeMembers.length}</span></span></div>
                                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-google-blue h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pt-6 border-t border-slate-200">
                                        <div className="bg-google-greenLight/50 px-5 py-3.5 rounded-2xl border border-google-green/30"><p className="text-[9px] text-google-greenDark uppercase tracking-widest font-medium mb-1">Total Dana Terkumpul</p><p className="text-[18px] font-medium text-google-greenDark tracking-tight truncate">{userRole === 'admin' ? formatRp(totalTerkumpul) : '= Disembunyikan'}</p></div>
                                        {userRole === 'admin' ? (
                                            <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-auto">
                                                <button onClick={() => { setSelectedAgenda(agenda); setTempPayments(agenda.payments || {}); setView('manage'); }} className="px-6 py-3.5 bg-google-blueLight text-google-blueDark border border-google-blue/30 rounded-full text-[13px] font-medium hover:bg-google-blue hover:text-white transition-all duration-300 hover:shadow-md active:scale-95 flex flex-wrap items-center gap-1.5"><Icon name="edit_document" className="text-[16px]"/> Kelola</button>
                                                <button onClick={() => { setFormData({ title: agenda.title, minAmount: agenda.minAmount, dueDate: agenda.dueDate, payments: agenda.payments || {}, transferredToKas: agenda.transferredToKas || 0 }); setSelectedAgenda(agenda); setView('form'); setErrorMsg(''); }} className="w-12 h-12 flex items-center justify-center bg-white text-google-text hover:bg-slate-50 hover:border-slate-400 rounded-full border border-slate-200 active:scale-95 transition-all duration-300 shadow-sm"><Icon name="settings" className="text-[17px]" /></button>
                                                <button onClick={() => setDeleteConfirmAgendaId(agenda.id)} className="w-12 h-12 flex items-center justify-center bg-white text-google-red hover:bg-google-redLight hover:border-google-red/40 rounded-full border border-slate-200 active:scale-95 transition-all duration-300 shadow-sm"><Icon name="delete" className="text-[17px]" /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setSelectedAgenda(agenda); setTempPayments(agenda.payments || {}); setView('manage'); }} className="px-8 py-3.5 bg-white border border-slate-200 text-google-text rounded-full text-[13px] font-medium hover:bg-slate-50 hover:border-slate-400 shadow-sm shrink-0 active:scale-95 transition-all duration-300 self-end sm:self-auto flex flex-wrap items-center gap-2"><Icon name="visibility" className="text-[16px]"/> Cek Status Saya</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {iuranData.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="volunteer_activism" className="text-[48px] text-google-red" fill="true" /></div><h3 className="text-google-text font-medium text-[18px] mb-2 tracking-tight">Belum Ada Agenda Iuran</h3><p className="text-google-textVariant font-medium text-[13px]">Daftar donasi atau tagihan umum akan tampil di sini.</p></div>}

                    {/* FIX: Modal konfirmasi hapus agenda */}
                    {deleteConfirmAgendaId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Agenda?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Agenda iuran beserta seluruh data pembayaran warga akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmAgendaId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { setIuranData(iuranData.filter(i => i.id !== deleteConfirmAgendaId)); setDeleteConfirmAgendaId(null); showToast('Agenda iuran berhasil dihapus.'); }} className="flex-1 bg-google-red text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function BukuKas({ balance, setBalance, transactions, setTransactions, userRole, identity, jimpitanBalance, setJimpitanBalance }) {
            // Komponen BukuKas untuk pencatatan transaksi Kas RT Utama
            const [filterMonth, setFilterMonth] = useState('Semua');
            const [isModalOpen, setIsModalOpen] = useState(false);
            const [selectedImage, setSelectedImage] = useState(null);
            const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
            const [transferAmount, setTransferAmount] = useState('');
            const [formData, setFormData] = useState({ type: 'Pengeluaran', category: 'Pembelian Barang', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [editingId, setEditingId] = useState(null);

            const groupedTransactions = useMemo(() => {
                const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
                const groups = {};
                sorted.forEach(t => {
                    const dateObj = parseLocalDate(t.date);
                    const monthYear = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    if (!groups[monthYear]) groups[monthYear] = [];
                    groups[monthYear].push(t);
                });
                return groups;
            }, [transactions]);

            const availableMonths = Object.keys(groupedTransactions);
            const displayedTransactions = useMemo(() => {
                if (filterMonth === 'Semua') return transactions;
                return groupedTransactions[filterMonth] || [];
            }, [filterMonth, transactions, groupedTransactions]);

            // Upload Nota Kas RT: Canvas compress G base64 G Firestore (tanpa GAS)
            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 1200, 0.82);
                    setFormData(prev => ({ ...prev, receiptUrl: url }));
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleSave = () => {
                if (!formData.description) return setErrorMsg("Keterangan wajib diisi!");
                const nominal = safeNumber(formData.amount);
                if (nominal <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
                
                if (editingId) {
                    const oldTx = transactions.find(t => t.id === editingId);
                    let tempBalance = balance;
                    if (oldTx.type === 'Pemasukan') tempBalance -= oldTx.amount;
                    else tempBalance += oldTx.amount;
                    
                    if (formData.type === 'Pengeluaran' && nominal > tempBalance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(tempBalance)}`);
                    
                    if (formData.type === 'Pemasukan') tempBalance += nominal;
                    else tempBalance -= nominal;
                    
                    // Koreksi kas jimpitan jika ini transaksi Mutasi Jimpitan
                    if (oldTx.category === 'Mutasi Jimpitan') {
                        const diffJimpitan = oldTx.amount - nominal;
                        setJimpitanBalance(prev => prev + diffJimpitan);
                    }
                    
                    setBalance(tempBalance);
                    setTransactions(transactions.map(t => t.id === editingId ? { ...formData, amount: nominal } : t));
                    setEditingId(null);
                    showToast(`Transaksi berhasil diperbarui.`);
                } else {
                    if (formData.type === 'Pengeluaran' && nominal > balance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(balance)}`);
                    if (formData.type === 'Pemasukan') setBalance(prev => prev + nominal); else setBalance(prev => prev - nominal);
                    setTransactions([{ id: Date.now(), ...formData, amount: nominal }, ...transactions]);
                    showToast(`Transaksi ${formData.type.toLowerCase()} berhasil dicatat.`);
                }
                
                setIsModalOpen(false); setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
                setIsUploading(false);
            };

            const handleTransferJimpitan = () => {
                const nominal = safeNumber(transferAmount);
                if (nominal <= 0 || nominal > jimpitanBalance) return setErrorMsg(`Penarikan tidak valid! Maksimal ${formatRp(jimpitanBalance)}`);
                setJimpitanBalance(prev => prev - nominal); setBalance(prev => prev + nominal);
                setTransactions([{ id: Date.now(), type: 'Pemasukan', category: 'Mutasi Jimpitan', description: 'Pencairan Kas Jimpitan', amount: nominal, date: getLocalDate() }, ...transactions]);
                setIsTransferModalOpen(false); setTransferAmount('');
                showToast(`Berhasil mencairkan ${formatRp(nominal)} dari Kas Jimpitan.`);
            };

            return (
                <div className="space-y-8 print:p-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Buku Kas Utama</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Catatan riwayat transaksi operasional RT.</p></div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-slate-50 border border-slate-200 text-google-text text-[13px] font-medium rounded-xl px-4 py-3.5 outline-none focus:border-google-blue w-full sm:w-auto cursor-pointer">
                                <option value="Semua">Semua Bulan</option>
                                {availableMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                            </select>
                            <button onClick={() => window.print()} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center gap-2 text-[13px] border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 w-full sm:w-auto"><Icon name="print" className="text-[16px]" /> <span>Cetak Laporan</span></button>
                        </div>
                    </div>

                    <div className="hidden print-only">
                        <div className="kop-surat">
                            <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                            <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                            <div className="kop-surat-logo-right"></div>
                        </div>
                        <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Buku Kas Umum</h2><p className="text-[11pt]">{filterMonth !== 'Semua' ? `Periode: ${filterMonth}` : `Per Tanggal: ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}`}</p></div>
                        <table className="print-table">
                            <thead><tr><th width="5%">No</th><th width="15%">Tanggal</th><th width="40%">Uraian Transaksi</th><th width="20%">Pemasukan</th><th width="20%">Pengeluaran</th></tr></thead>
                            <tbody>
                                {displayedTransactions.length === 0 ? <tr><td colSpan="5" className="text-center font-medium">Nihil / Belum ada transaksi</td></tr> : displayedTransactions.map((t, idx) => (
                                    <tr key={t.id}><td className="text-center font-medium">{idx + 1}</td><td className="text-center font-medium">{parseLocalDate(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}</td><td className="font-medium">{t.description} {t.category ? `(${t.category})` : ''}</td><td className="text-right font-medium">{t.type === 'Pemasukan' ? formatRp(t.amount) : '-'}</td><td className="text-right font-medium">{t.type === 'Pengeluaran' ? formatRp(t.amount) : '-'}</td></tr>
                                ))}
                            </tbody>
                            <tfoot><tr><th colSpan="3" className="text-right">SALDO TOTAL KAS WARGA SAAT INI</th><th colSpan="2" className="text-center" style={{fontSize: '12pt'}}>{formatRp(balance)}</th></tr></tfoot>
                        </table>
                        <div className="ttd-container">
                            <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                            <div className="ttd-box"><p>Dibuat Oleh,</p><p>Bendahara / Admin</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                        </div>
                    </div>

                    <div className="bg-google-blue text-white p-8 sm:p-12 rounded-3xl border border-google-blueDark shadow-xl relative overflow-hidden no-print group cursor-default">
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-2xl mb-5 shadow-sm">
                                    <Icon name="account_balance_wallet" className="text-[16px]"/>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-50">Total Saldo Aktif</span>
                                </div>
                                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight drop-shadow-md">{formatRp(balance)}</h2>
                            </div>
                            <div className="hidden lg:flex items-center justify-center w-24 h-24 bg-white/10 rounded-full border border-white/20 shadow-inner">
                                <Icon name="savings" className="text-5xl text-white/90 drop-shadow-md" />
                            </div>
                        </div>
                    </div>

                    {userRole === 'admin' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 no-print">
                            <button onClick={() => { setEditingId(null); setFormData({ type: 'Pemasukan', category: 'Iuran Opsional', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); setIsModalOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-4 hover:border-google-green hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-google-green/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                                <div className="bg-google-greenLight text-google-greenDark w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:bg-google-green group-hover:text-white transition-colors duration-300 shadow-sm border border-google-green/30"><Icon name="add" className="text-[24px] group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" /></div>
                                <span className="text-[13px] font-medium text-google-text">Catat Pemasukan</span>
                            </button>
                            <button onClick={() => { setEditingId(null); setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); setIsModalOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-4 hover:border-google-red hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-google-red/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                                <div className="bg-google-redLight text-google-redDark w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:bg-google-red group-hover:text-white transition-colors duration-300 shadow-sm border border-google-red/30"><Icon name="remove" className="text-[24px] group-hover:scale-110 group-hover:-rotate-90 transition-all duration-300" /></div>
                                <span className="text-[13px] font-medium text-google-text">Catat Pengeluaran</span>
                            </button>
                            <button onClick={() => { setIsTransferModalOpen(true); setErrorMsg(''); }} className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-4 hover:border-google-yellow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-google-yellow/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                                <div className="bg-google-yellowLight text-google-yellowDark w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:bg-google-yellow group-hover:text-white transition-colors duration-300 shadow-sm border border-google-yellow/30"><Icon name="move_to_inbox" className="text-[24px] group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300" /></div>
                                <span className="text-[13px] font-medium text-google-text leading-tight">Cairkan Kas Jimpitan</span>
                            </button>
                        </div>
                    )}

                    <div className="space-y-8 no-print">
                        <h3 className="text-xl font-medium text-google-text mb-3 px-2 tracking-tight">Riwayat Transaksi Terkini</h3>
                        {Object.keys(groupedTransactions).map((monthYear) => (
                            <div key={monthYear} className="space-y-6">
                                <div className="flex items-center gap-3 mb-2 px-2 pt-2">
                                    <h4 className="text-[12px] font-medium text-slate-800 uppercase tracking-widest">{monthYear}</h4>
                                    <div className="h-px bg-slate-300 flex-1"></div>
                                </div>
                                {groupedTransactions[monthYear].map((t) => (
                                    <div key={t.id} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-google-blue/30 transition-all duration-300 gap-4 group">
                                        <div className="flex items-center gap-5 flex-1 overflow-hidden">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-colors duration-300 ${t.type === 'Pemasukan' ? 'bg-google-greenLight text-google-greenDark border-google-green/30 group-hover:bg-google-green group-hover:text-white' : 'bg-google-redLight text-google-redDark border-google-red/30 group-hover:bg-google-red group-hover:text-white'}`}><Icon name={t.type === 'Pemasukan' ? "arrow_downward" : "arrow_upward"} className="text-[24px]" fill="true" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-[14px] text-google-text truncate mb-1.5">{t.description}</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-[11px] font-medium text-google-textVariant bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md inline-flex items-center gap-1.5"><Icon name="label" className="text-[13px]" /> {t.category} &bull; {parseLocalDate(t.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p>
                                                    {t.receiptUrl && <button onClick={() => setSelectedImage(t.receiptUrl)} className="text-[11px] font-medium text-google-blue bg-google-blueLight border border-google-blue/30 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 hover:bg-google-blue hover:text-white transition-colors duration-300"><Icon name="receipt" className="text-[13px]" /> Lihat Bukti</button>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-200 pt-4 sm:pt-0 w-full sm:w-auto">
                                            <span className={`font-medium text-[17px] ${t.type === 'Pemasukan' ? 'text-google-greenDark' : 'text-google-redDark'} tracking-tight`}>{t.type === 'Pemasukan' ? '+' : '-'}{formatRp(t.amount)}</span>
                                            {userRole === 'admin' && t.category !== 'Saldo Awal' && (
                                                <div className="flex flex-wrap gap-2 mt-0 sm:mt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                    <button onClick={() => {
                                                        setEditingId(t.id);
                                                        setFormData(t);
                                                        setIsModalOpen(true);
                                                        setErrorMsg('');
                                                    }} className="text-google-blue bg-white hover:bg-google-blueLight border border-slate-200 hover:border-google-blue/40 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all duration-300 active:scale-95 flex flex-wrap items-center gap-1 uppercase tracking-widest"><Icon name="edit" className="text-[14px]" /><span className="hidden sm:inline">Edit</span></button>
                                                    <button onClick={() => { 
                                                        if (t.type === 'Pemasukan') setBalance(prev => prev - t.amount); 
                                                        else setBalance(prev => prev + t.amount);
                                                        if (t.category === 'Mutasi Jimpitan') setJimpitanBalance(prev => prev + t.amount);
                                                        setTransactions(transactions.filter(x => x.id !== t.id)); 
                                                    }} className="text-google-red bg-white hover:bg-google-redLight border border-slate-200 hover:border-google-red/40 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all duration-300 active:scale-95 flex flex-wrap items-center gap-1 uppercase tracking-widest"><Icon name="delete" className="text-[14px]" /><span className="hidden sm:inline">Hapus</span></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {transactions.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="receipt_long" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2 tracking-tight">Belum Ada Transaksi</h3><p className="text-google-textVariant font-medium text-[13px]">Buku kas masih dalam keadaan kosong.</p></div>}
                    </div>

                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-sm text-left border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className={`mb-6 w-20 h-20 rounded-full flex items-center justify-center border ${formData.type === 'Pemasukan' ? 'bg-google-greenLight text-google-green border-google-green/30' : 'bg-google-redLight text-google-red border-google-red/30'}`}><Icon name={formData.type === 'Pemasukan' ? 'arrow_downward' : 'arrow_upward'} className="text-[36px]" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit' : 'Catat'} {formData.type}</h3>
                                <div className="space-y-7">
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal Transaksi</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} /></div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md cursor-pointer ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`}>
                                            {formData.type === 'Pengeluaran' ? <><option>Belanja Barang/Alat</option><option>Honor Jasa</option><option>Konsumsi</option><option>Bantuan Sosial</option><option>Lain-lain</option></> : <><option>Iuran Opsional</option><option>Donasi</option><option>Pemasukan Jasa</option><option>Lain-lain</option></>}
                                        </select>
                                    </div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Keterangan / Uraian</label><input type="text" value={formData.description} onChange={e => {setFormData({...formData, description: e.target.value}); setErrorMsg('');}} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md placeholder:text-slate-400 ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} placeholder="Misal: Beli Sapu Lidi" /></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal (Rp)</label><input type="number" min="0" value={formData.amount} onChange={e => {setFormData({...formData, amount: safeNumber(e.target.value)}); setErrorMsg('');}} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md placeholder:text-slate-400 ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} placeholder="0" /></div>
                                    
                                    {formData.type === 'Pengeluaran' && (
                                        <div>
                                            <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Upload Bukti / Nota (Opsional)</label>
                                            <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-red shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-red transition-all`}>
                                                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                                <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                    {isUploading ? <div className="w-5 h-5 border border-google-red border-t-transparent rounded-full animate-spin"></div> : <Icon name="receipt" className="text-[20px]" />}
                                                </div>
                                                <div className="relative z-0 flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.receiptUrl ? "Nota Siap" : "Pilih File Nota")}</p>
                                                    <p className="text-[10px] text-google-textVariant truncate">{formData.receiptUrl ? "Klik untuk mengganti nota" : "Maksimal 2MB"}</p>
                                                </div>
                                                {formData.receiptUrl && !isUploading && (
                                                    <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200 group">
                                                        <img src={formData.receiptUrl} alt="Nota Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-6 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button onClick={() => { setIsModalOpen(false); setErrorMsg(''); setIsUploading(false); setEditingId(null); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className={`flex-1 text-white px-6 py-3.5 rounded-full font-medium text-[13px] border shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 ${formData.type === 'Pemasukan' ? 'bg-google-green border-google-greenDark hover:bg-google-greenDark' : 'bg-google-red border-google-redDark hover:bg-google-redDark'}`}>Simpan Data</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isTransferModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-yellow/30"><Icon name="move_to_inbox" className="text-[48px] text-google-yellowDark" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Pencairan Jimpitan</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Tarik dana dari kas Jimpitan Fisik ke Kas Utama RT.</p>
                                
                                <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl mb-8 border border-slate-200 shadow-sm"><p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-2">Saldo Jimpitan Saat Ini</p><p className="text-[24px] font-medium text-google-text tracking-tight">{formatRp(jimpitanBalance)}</p></div>
                                
                                <div className="text-left mb-8"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal Disetor (Rp)</label><input type="number" min="0" value={transferAmount} onChange={e => {setTransferAmount(safeNumber(e.target.value)); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[16px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mb-8 flex flex-wrap items-center gap-2 text-left"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <button onClick={() => { setIsTransferModalOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleTransferJimpitan} className="flex flex-wrap bg-google-yellow text-white px-6 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-yellowDark border border-google-yellowDark active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Mutasi Dana</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* IMAGE VIEWER MODAL */}
                    {selectedImage && (
                        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 transition-opacity modal-backdrop animate-backdrop-in" onClick={() => setSelectedImage(null)}>
                            <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center animate-fadeIn modal-card animate-modal-in" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setSelectedImage(null)} className="absolute -top-12 right-0 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors border border-white/20"><Icon name="close" className="text-[24px]" /></button>
                                <img src={selectedImage} alt="Bukti Transaksi" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function Pertemuan({ members, setMembers, currentRound, setCurrentRound, jimpitanBalance, setJimpitanBalance, setMeetingHistory, onFinish, nominalArisan, nominalJimpitan, arisanPeriod, setArisanPeriod, identity, cycleNumber }) {
            const [step, setStep] = useState(1);
            const [showHolidayModal, setShowHolidayModal] = useState(false);
            const [meetingDate, setMeetingDate] = useState(getLocalDate());
            const arisanMembers = useMemo(() => members.filter(m => m.program !== 'IuranOnly'), [members]);
            
            const eligibleWinners = useMemo(() => arisanMembers.filter(m => !m.hasWon && !isNonaktif(m) && m.program !== 'JimpitanOnly'), [arisanMembers]);
            const isCycleAlreadyComplete = arisanMembers.length > 0 && eligibleWinners.length === 0;

            const [attendance, setAttendance] = useState(() => {
                const init = {}; arisanMembers.forEach(m => init[m.id] = { status: 'Hadir', payDebt: false }); return init;
            });
            
            // FIX: Sinkronisasi attendance jika ada warga baru yang ditambahkan saat form Pertemuan terbuka
            useEffect(() => {
                setAttendance(prev => {
                    const updated = { ...prev };
                    arisanMembers.forEach(m => {
                        if (!updated[m.id]) {
                            updated[m.id] = { status: 'Hadir', payDebt: false };
                        }
                    });
                    return updated;
                });
            }, [arisanMembers]);

            const [isScannerOpen, setIsScannerOpen] = useState(false);
            const [scannedMembers, setScannedMembers] = useState([]);
            const [cashReceived, setCashReceived] = useState('');
            const [cashierStatus, setCashierStatus] = useState('Hadir');
            const [showCashierModal, setShowCashierModal] = useState(false);
            const scannerRef = useRef(null);
            
            const scannedMembersRef = useRef(scannedMembers);
            useEffect(() => { scannedMembersRef.current = scannedMembers; }, [scannedMembers]);

            useEffect(() => {
                if (isScannerOpen) {
                    if (!scannerRef.current) {
                        import('html5-qrcode').then((module) => {
                            const Html5QrcodeScanner = module.Html5QrcodeScanner;
                        scannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 150} }, false);
                        scannerRef.current.render((decodedText) => {
                            const memberIdStr = decodedText.replace('M-', '');
                            const m = arisanMembers.find(x => x.id.toString() === memberIdStr);
                            if (m) {
                                if (!scannedMembersRef.current.some(x => x.id === m.id)) {
                                    setScannedMembers(prev => [...prev, m]);
                                    showToast(`${m.name} masuk keranjang!`);
                                }
                            } else {
                                showToast('Warga tidak ditemukan!');
                            }
                        }, (error) => {});
                        });
                    }
                } else {
                    if (scannerRef.current) {
                        scannerRef.current.clear().catch(e => console.error(e));
                        scannerRef.current = null;
                    }
                }
                return () => {
                    if (scannerRef.current) {
                        scannerRef.current.clear().catch(e => console.error(e));
                        scannerRef.current = null;
                    }
                };
            }, [isScannerOpen, arisanMembers]);
            
            const handleOpenCashier = () => {
                if (scannedMembers.length === 0) return;
                setIsScannerOpen(false);
                setShowCashierModal(true);
                setCashReceived('');
                setCashierStatus('Hadir');
            };

            const handleCashierSave = () => {
                if (scannedMembers.length === 0) return;
                
                let totalTagihanGabungan = 0;
                scannedMembers.forEach(m => {
                    let tagihanBulanIni = 0;
                    if (m.program === 'Arisan') tagihanBulanIni = nominalArisan + nominalJimpitan;
                    else if (m.program === 'ArisanOnly') tagihanBulanIni = nominalArisan;
                    else if (m.program === 'JimpitanOnly') tagihanBulanIni = nominalJimpitan;
                    else if (m.program === 'IuranOnly') tagihanBulanIni = nominalJimpitan;
                    totalTagihanGabungan += tagihanBulanIni + (m.debt || 0);
                });
                
                const received = safeNumber(cashReceived);
                const isPaidFull = received >= totalTagihanGabungan;

                setAttendance(prev => {
                    const updated = { ...prev };
                    scannedMembers.forEach(m => {
                        updated[m.id] = {
                            status: cashierStatus,
                            payDebt: (cashierStatus === 'Hadir' && isPaidFull && m.debt > 0)
                        };
                    });
                    return updated;
                });

                showToast(`Presensi ${scannedMembers.length} warga disimpan!`);
                setShowCashierModal(false);
                setScannedMembers([]);
                
                setTimeout(() => setIsScannerOpen(true), 300);
            };
            const [selectedWinnerId, setSelectedWinnerId] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            
            const calculations = useMemo(() => {
                let kasArisanTerkumpul = 0, kasJimpitanTerkumpul = 0, talanganJimpitan = 0, pelunasanTunggakan = 0, tunggakanBaru = 0;
                arisanMembers.forEach(m => {
                    const att = attendance[m.id];
                    if (!att) return; // guard: warga belum ada di attendance (ditambah setelah form buka)
                    if (isNonaktif(m)) { if (att.status === 'Hadir') kasJimpitanTerkumpul += nominalJimpitan; return; } // Nonaktif/Meninggal: hanya jimpitan
                    if (att.status === 'Hadir') { 
                        if (m.program !== 'JimpitanOnly') kasArisanTerkumpul += nominalArisan; 
                        if (m.program !== 'ArisanOnly') kasJimpitanTerkumpul += nominalJimpitan; 
                        if (m.debt > 0 && att.payDebt) pelunasanTunggakan += m.debt; 
                    } 
                    else if (att.status === 'Alfa' || att.status === 'Musibah') { 
                        if (m.program !== 'JimpitanOnly') { talanganJimpitan += nominalArisan; kasArisanTerkumpul += nominalArisan; }
                        tunggakanBaru += (m.program === 'ArisanOnly' ? nominalArisan : (m.program === 'JimpitanOnly' ? nominalJimpitan : (nominalArisan + nominalJimpitan))); 
                    }
                });
                // LOGIKA ARISAN: Pemenang tidak membayar ke dirinya sendiri.
                // Kurangi nominalArisan pemenang dari total yang diserahkan, KECUALI
                // pemenang tidak hadir (sudah tidak terhitung di kasArisanTerkumpul via Hadir).
                const winnerMember = selectedWinnerId ? arisanMembers.find(m => m.id === Number(selectedWinnerId)) : null;
                const winnerAtt = winnerMember ? attendance[winnerMember.id] : null;
                const winnerIsPresent = winnerAtt && winnerAtt.status === 'Hadir' && !isNonaktif(winnerMember);
                if (!isCycleAlreadyComplete && winnerIsPresent) {
                    kasArisanTerkumpul -= nominalArisan;
                }
                return { kasArisanTerkumpul, kasJimpitanTerkumpul, talanganJimpitan, pelunasanTunggakan, tunggakanBaru };
            }, [arisanMembers, attendance, nominalArisan, nominalJimpitan, selectedWinnerId, isCycleAlreadyComplete]);

            const currentTotalDebt = useMemo(() => members.reduce((sum, m) => sum + Number(m.debt || 0), 0), [members]);
            const deltaJimpitan = calculations.kasJimpitanTerkumpul + calculations.pelunasanTunggakan - calculations.talanganJimpitan;
            const projectedJimpitanCash = jimpitanBalance + deltaJimpitan;
            const projectedTotalDebt = currentTotalDebt + calculations.tunggakanBaru - calculations.pelunasanTunggakan;

            const handleAttendanceChange = (id, status) => setAttendance(prev => ({...prev, [id]: { ...prev[id], status }}));
            const togglePayDebt = (id) => setAttendance(prev => ({...prev, [id]: { ...prev[id], payDebt: !prev[id].payDebt }}));

            const submitPertemuan = () => {
                if (!isCycleAlreadyComplete && !selectedWinnerId) return setErrorMsg("Pilih pemenang arisan terlebih dahulu!");
                
                setJimpitanBalance(prev => prev + deltaJimpitan); // FIX KRITIS-3: functional update untuk hindari race condition
                let winnerName = "", absensiDetails = [];
                const updatedMembers = members.map(m => {
                    if (m.program === 'IuranOnly') return m;
                    let updatedM = { ...m };
                    const att = attendance[m.id];
                    // Guard: jika warga arisan tidak ada di attendance (baru ditambah setelah form dibuka)
                    if (!att) { absensiDetails.push({ name: m.name, status: 'Hadir' }); return updatedM; }
                    if (!isCycleAlreadyComplete && m.id === Number(selectedWinnerId)) { 
                        updatedM.hasWon = true; updatedM.wonRound = currentRound; winnerName = m.name; 
                    }
                    // FIX CELAH-1: Guard Meninggal SEBELUM push absensiDetails
                    // Warga Meninggal dicatat dengan status khusus 'Meninggal', bebas dari arisan
                    if (isNonaktif(m)) {
                        absensiDetails.push({ name: m.name, status: m.status });
                        return updatedM;
                    } // Nonaktif/Meninggal: catat status asli, bebas arisan
                    absensiDetails.push({ name: m.name, status: att.status });
                    const tagihanBaru = m.program === 'ArisanOnly' ? nominalArisan : (m.program === 'JimpitanOnly' ? nominalJimpitan : (nominalArisan + nominalJimpitan));
                    if (att.status === 'Hadir') { updatedM.redRecord = false; if (att.payDebt) updatedM.debt = 0; } 
                    else if (att.status === 'Alfa') { updatedM.debt = (updatedM.debt || 0) + tagihanBaru; updatedM.redRecord = true; } 
                    // Musibah = halangan valid (sakit/musibah), punya tunggakan tapi TIDAK masuk rapor merah
                    else if (att.status === 'Musibah') { updatedM.debt = (updatedM.debt || 0) + tagihanBaru; }
                    return updatedM;
                });
                
                if(isCycleAlreadyComplete) { winnerName = "G SIKLUS SELESAI (TIDAK ADA UNDIAN)"; }

                const formattedDate = parseLocalDate(meetingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

                setMembers(updatedMembers);
                setMeetingHistory(prev => [{ id: Date.now(), round: currentRound, periode: formatBulanTahun(arisanPeriod), date: formattedDate, winner: winnerName, kasArisanTerkumpul: calculations.kasArisanTerkumpul, kasJimpitanMasuk: calculations.kasJimpitanTerkumpul, pelunasanTunggakan: calculations.pelunasanTunggakan, talanganJimpitan: calculations.talanganJimpitan, tunggakanBaru: calculations.tunggakanBaru, saldoAkhirJimpitan: projectedJimpitanCash, totalTunggakanAkhir: projectedTotalDebt, absensiDetails }, ...prev]);
                setCurrentRound(prev => prev + 1);
                const [year, month] = arisanPeriod.split('-'); let d = new Date(year, month - 1); d.setMonth(d.getMonth() + 1);
                setArisanPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                onFinish();
                showToast('Absensi & hasil arisan berhasil disimpan.');
            };

            const handleSetHoliday = () => {
                const totalDebtSnapshot = members.reduce((sum, m) => sum + Number(m.debt || 0), 0);
                const formattedDate = parseLocalDate(meetingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                
                setMeetingHistory(prev => [{ id: Date.now(), round: currentRound, periode: formatBulanTahun(arisanPeriod), date: formattedDate, winner: '=n+ LIBUR (TIDAK ADA ARISAN)', kasArisanTerkumpul: 0, kasJimpitanMasuk: 0, pelunasanTunggakan: 0, talanganJimpitan: 0, tunggakanBaru: 0, saldoAkhirJimpitan: jimpitanBalance, totalTunggakanAkhir: totalDebtSnapshot, absensiDetails: [] }, ...prev]);
                
                const [year, month] = arisanPeriod.split('-'); let d = new Date(year, month - 1); d.setMonth(d.getMonth() + 1);
                setArisanPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                
                setShowHolidayModal(false);
                onFinish();
                showToast('Bulan ini ditandai libur, periode lanjut otomatis.');
            };

            return (
                <div className="bg-white rounded-3xl overflow-hidden max-w-7xl mx-auto border border-slate-200 shadow-xl">
                    <div className="bg-slate-50 px-8 py-6 flex items-center justify-between no-print border-b border-slate-200 relative">
                        {[1, 2, 3].map(num => (<div key={num} className="flex flex-col items-center relative z-10"><div className={`w-12 h-12 rounded-full flex items-center justify-center font-medium text-[16px] border transition-all duration-500 ${step >= num ? 'bg-google-blue text-white border-google-blueDark shadow-md scale-110' : 'bg-white text-slate-400 border-slate-400'}`}>{num}</div></div>))}
                        <div className="absolute left-16 right-16 h-2 bg-slate-200 top-[45px] z-0 rounded-full overflow-hidden"><div className="h-full bg-google-blue transition-all duration-700 ease-in-out" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div></div>
                    </div>
                    <div className="p-5 sm:p-8 bg-white">
                        {step === 1 && (
                            <div className="space-y-8">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-8 no-print border-b border-slate-200 pb-8">
                                    <div className="flex flex-col w-full lg:w-auto">
                                        <h3 className="text-3xl font-medium text-google-text tracking-tight">Sesi Presensi Arisan</h3>
                                        <div className="flex flex-wrap items-center gap-3 mt-4 bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 w-full sm:w-fit focus-within:border-google-blue focus-within:bg-white focus-within:shadow-md transition-all">
                                            <Icon name="edit_calendar" className="text-[17px] text-google-blue shrink-0" />
                                            <label className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest shrink-0 mr-1">Tgl Pelaksanaan:</label>
                                            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="bg-transparent border-none text-[13px] font-medium outline-none text-google-blueDark cursor-pointer w-full" />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                                        <button onClick={() => setIsScannerOpen(true)} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-google-blue text-white px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all duration-300"><Icon name="qr_code_scanner" className="text-[17px]" /><span>Kasir Scan</span></button>
                                        <button onClick={() => setShowHolidayModal(true)} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-white text-google-yellowDark px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] border border-google-yellow hover:bg-google-yellowLight hover:shadow-md active:scale-95 transition-all duration-300"><Icon name="event_busy" className="text-[17px]" /><span>Bulan Libur</span></button>
                                        <button onClick={() => window.print()} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-white text-google-text px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 hover:shadow-md active:scale-95 transition-all duration-300"><Icon name="print" className="text-[17px]" /><span>Cetak Blanko Absen</span></button>
                                    </div>
                                </div>
                                <div className="hidden print-only">
                                    <div className="kop-surat"><div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div><div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || "Aplikasi Arisan"}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div><div className="kop-surat-logo-right"></div></div>
                                    <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Daftar Hadir Pertemuan Arisan</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber || 1} | Putaran Ke-{currentRound} | Periode: {formatBulanTahun(arisanPeriod)}</p></div>
                                    <table className="print-table">
                                        <thead><tr><th width="5%">No</th><th width="35%">Nama Warga</th><th width="20%">Status Arisan</th><th width="20%">Tunggakan Sebelumnya</th><th width="20%">Tanda Tangan</th></tr></thead>
                                        <tbody>
                                            {arisanMembers.length === 0 ? <tr><td colSpan="5" className="text-center font-medium">Belum ada data warga.</td></tr> : arisanMembers.map((m, idx) => (
                                                <tr key={m.id}><td className="text-center font-medium">{idx + 1}</td><td className="font-medium">{m.name}</td><td className="text-center font-medium">{m.hasWon ? `Menang (Put.${m.wonRound})` : 'Belum'}</td><td className="text-right font-medium">{m.debt > 0 ? formatRp(m.debt) : '-'}</td><td></td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 no-print">
                                    {arisanMembers.map(member => {
                                        const isMeninggal = isNonaktif(member); // Meninggal ATAU Nonaktif/Pindah
                                        const attStatus = isMeninggal ? 'Meninggal' : (attendance[member.id]?.status || 'Hadir');
                                        return (
                                        <div key={member.id} className={`border rounded-3xl p-6 flex flex-col gap-4 transition-all duration-300 ${isMeninggal ? 'bg-slate-100 border-slate-400 opacity-75' : attStatus === 'Hadir' ? 'bg-white border-slate-200 hover:border-google-blue/50 hover:shadow-xl hover:-translate-y-1 shadow-sm' : attStatus === 'Musibah' ? 'bg-google-yellowLight/50 border-google-yellow shadow-md' : 'bg-google-redLight/50 border-google-red shadow-md'}`}>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex flex-wrap items-center gap-4 min-w-0">
                                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-medium text-[17px] shrink-0 border transition-colors ${isMeninggal ? 'bg-slate-200 text-slate-400 border-slate-400' : attStatus === 'Hadir' ? 'bg-slate-50 text-google-text border-slate-200' : attStatus === 'Musibah' ? 'bg-google-yellow text-white border-google-yellowDark' : 'bg-google-red text-white border-google-redDark'}`}>{member.name.charAt(0).toUpperCase()}</div>
                                                    <div className="min-w-0">
                                                        <h3 className={`font-medium text-[14px] truncate tracking-tight ${isMeninggal ? 'text-slate-400 line-through' : 'text-google-text'}`}>{member.name}</h3>
                                                        {isMeninggal
                                                            ? <span className="text-[9px] text-slate-500 font-medium border border-slate-400 px-2.5 py-1 rounded-md bg-slate-200 mt-1.5 inline-flex items-center gap-1 uppercase tracking-widest"><Icon name="sentiment_very_dissatisfied" className="text-[12px]" /> Wafat / Nonaktif</span>
                                                            : member.debt > 0
                                                                ? <span className="text-[10px] bg-google-redLight text-google-redDark px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 mt-1.5 border border-google-red/40 uppercase tracking-wider"><Icon name="warning" className="text-[13px]"/> Hutang {formatRp(member.debt)}</span>
                                                                : <span className="text-[10px] bg-google-greenLight text-google-greenDark font-medium px-3 py-1.5 rounded-md mt-1.5 inline-flex items-center gap-1.5 border border-google-green/40 uppercase tracking-wider"><Icon name="check_circle" className="text-[13px]"/> Bersih</span>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            {isMeninggal ? (
                                                <div className="flex flex-col gap-2.5">
                                                    {/* Info banner: bebas arisan, wajib jimpitan */}
                                                    <div className="flex flex-wrap items-center gap-3 bg-slate-200 border border-slate-400 rounded-xl px-4 py-3">
                                                        <Icon name="do_not_disturb_on" className="text-[18px] text-slate-500 shrink-0" />
                                                        <div>
                                                            <p className="text-[11px] font-medium text-slate-600 uppercase tracking-widest leading-tight">Bebas Iuran Arisan</p>
                                                            <p className="text-[10px] font-normal text-slate-500 leading-tight mt-0.5">Anggota wafat tidak dikenakan setoran arisan</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 bg-google-blueLight border border-google-blue/30 rounded-xl px-4 py-3">
                                                        <Icon name="volunteer_activism" className="text-[18px] text-google-blue shrink-0" fill="true" />
                                                        <div>
                                                            <p className="text-[11px] font-medium text-google-blueDark uppercase tracking-widest leading-tight">Wajib Jimpitan</p>
                                                            <p className="text-[10px] font-normal text-google-blue leading-tight mt-0.5">{formatRp(nominalJimpitan)} per pertemuan tetap berjalan</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap rounded-2xl bg-slate-100 p-2 gap-2 border border-slate-200 inset-shadow-sm">
                                                    {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                        <button key={stat} onClick={() => handleAttendanceChange(member.id, stat)} className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-widest rounded-full transition-all duration-300 border ${attendance[member.id].status === stat ? (stat === 'Hadir' ? 'bg-google-green text-white border-google-greenDark shadow-md scale-105' : stat === 'Musibah' ? 'bg-google-yellow text-white border-google-yellowDark shadow-md scale-105' : 'bg-google-red text-white border-google-redDark shadow-md scale-105') : 'bg-transparent text-google-textVariant border-transparent hover:bg-slate-200/50'}`}>{stat}</button>
                                                    ))}
                                                </div>
                                            )}
                                            {attendance[member.id]?.status === 'Hadir' && member.debt > 0 && !isMeninggal && (
                                                <label className="flex items-center justify-between bg-google-blueLight px-5 py-4 rounded-2xl cursor-pointer border border-google-blue/30 shadow-sm hover:bg-google-blue/20 transition-colors group mt-2">
                                                    <div><span className="text-[13px] font-medium text-google-blueDark block mb-0.5">Lunasi Tunggakan?</span><span className="text-[11px] font-medium text-google-blue">Centang potong saldo</span></div>
                                                    <div className="relative flex items-center justify-center"><input type="checkbox" checked={attendance[member.id].payDebt} onChange={() => togglePayDebt(member.id)} className="peer appearance-none w-7 h-7 border border-google-blue/50 rounded-lg checked:bg-google-blue checked:border-google-blue transition-colors cursor-pointer" /><Icon name="check" className="absolute text-white text-[16px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth="4"/></div>
                                                </label>
                                            )}
                                        </div>
                                        );
                                    })}

                                    {arisanMembers.length === 0 && <div className="col-span-full bg-slate-50 border border-slate-200 p-12 text-center rounded-3xl shadow-sm"><Icon name="group_off" className="text-[48px] text-slate-400 mb-4 mx-auto" fill="true" /><p className="font-medium text-[16px] text-google-text">Belum ada warga arisan terdaftar.</p></div>}
                                </div>
                                <div className="pt-8 flex justify-end no-print border-t border-slate-200 mt-10"><button onClick={() => setStep(2)} className="bg-google-blue text-white px-10 py-4 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center gap-2">Lanjut Ke Rekapitulasi <Icon name="arrow_forward" className="text-[17px]"/></button></div>
                                
                                {showHolidayModal && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                                        <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                            <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-yellow/30"><Icon name="event_busy" className="text-[48px] text-google-yellowDark" /></div>
                                            <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Liburkan Bulan Ini?</h3>
                                            <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Periode <b className="text-google-text">{formatBulanTahun(arisanPeriod)}</b> akan ditandai sebagai bulan libur.</p>
                                            <div className="text-[12px] font-medium text-google-textVariant mb-8 space-y-5 bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl border border-slate-200 text-left"><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[16px] text-google-blue shrink-0"/><span>Tidak ada penarikan kas/jimpitan sama sekali.</span></p><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[16px] text-google-blue shrink-0"/><span>Putaran ke-{currentRound} tidak akan dihitung.</span></p><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[16px] text-google-blue shrink-0"/><span>Periode akan melompat ke bulan berikutnya.</span></p></div>
                                            <div className="flex flex-wrap gap-3">
                                                <button onClick={() => setShowHolidayModal(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                                <button onClick={handleSetHoliday} className="flex-1 bg-google-yellow text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-yellowDark shadow-md hover:bg-google-yellowDark hover:shadow-lg active:scale-95 transition-all duration-300">Setuju, Libur</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {isScannerOpen && (
                                    <div className="fixed inset-0 z-50 flex flex-col p-4 sm:p-6 no-print overflow-y-auto hide-scrollbar modal-backdrop animate-backdrop-in">
                                        <div className="absolute top-4 right-4 z-50">
                                            <button onClick={() => setIsScannerOpen(false)} className="bg-white/20 text-white w-9 h-9 flex items-center justify-center shrink-0 rounded-full hover:bg-white/40"><Icon name="close" className="text-[20px]" /></button>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center pt-2 pb-10">
                                            <div id="reader" className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl shrink-0"></div>
                                            
                                            {scannedMembers.length > 0 && (
                                                <div className="mt-6 w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-google-blue shrink-0">
                                                    <h4 className="font-medium text-google-text mb-3 text-[13px] uppercase tracking-widest">Keranjang Scan ({scannedMembers.length} Warga)</h4>
                                                    <div className="flex flex-wrap gap-2 mb-4 max-h-[150px] overflow-y-auto hide-scrollbar">
                                                        {scannedMembers.map(m => (
                                                            <span key={m.id} className="bg-google-blueLight text-google-blueDark px-3 py-1.5 rounded-lg text-[12px] font-medium border border-google-blue/30">{m.name}</span>
                                                        ))}
                                                    </div>
                                                    <button onClick={handleOpenCashier} className="w-full bg-google-blue text-white py-3.5 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-google-blueDark transition-colors shadow-md">Proses Pembayaran <Icon name="arrow_forward" className="text-[16px]" /></button>
                                                </div>
                                            )}
                                            {scannedMembers.length === 0 && <p className="text-white/60 text-center font-medium mt-6 shrink-0">Arahkan kamera ke barcode warga untuk memindai.</p>}
                                        </div>
                                    </div>
                                )}
                                
                                {showCashierModal && scannedMembers.length > 0 && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print modal-backdrop animate-backdrop-in">
                                        <div className="rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 max-h-[95vh] flex flex-col modal-card animate-modal-in">
                                            <h3 className="text-xl font-medium text-google-text mb-2 text-center">Kasir Pembayaran</h3>
                                            <div className="text-center mb-4">
                                                <p className="text-[13px] text-google-textVariant font-medium">{scannedMembers.length} Warga (Gandengan)</p>
                                                <p className="text-[13px] font-medium text-google-text truncate">{scannedMembers.map(m => m.name).join(', ')}</p>
                                            </div>
                                            
                                            <div className="overflow-y-auto hide-scrollbar flex-1 mb-4">
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                    {(() => {
                                                        let totalTagihanBulanIni = 0;
                                                        let totalTunggakan = 0;
                                                        scannedMembers.forEach(m => {
                                                            totalTagihanBulanIni += (m.program === 'IuranOnly' ? 0 : nominalArisan) + nominalJimpitan;
                                                            totalTunggakan += (m.debt || 0);
                                                        });
                                                        const totalGabungan = totalTagihanBulanIni + totalTunggakan;
                                                        return (
                                                            <>
                                                                <div className="flex justify-between text-[13px] mb-1"><span className="text-google-textVariant font-medium">Total Tagihan Bulan Ini</span><span className="font-medium text-google-text">{formatRp(totalTagihanBulanIni)}</span></div>
                                                                {totalTunggakan > 0 && <div className="flex justify-between text-[13px] mb-1"><span className="text-google-red font-medium">Total Tunggakan</span><span className="font-medium text-google-red">{formatRp(totalTunggakan)}</span></div>}
                                                                <div className="border-t border-slate-200 my-2"></div>
                                                                <div className="flex justify-between text-[14px]"><span className="font-medium text-google-text">Total Harus Dibayar</span><span className="font-medium text-google-blue">{formatRp(totalGabungan)}</span></div>
                                                            </>
                                                        )
                                                    })()}
                                                </div>

                                                <div className="mb-4 mt-4">
                                                    <label className="text-[10px] uppercase tracking-widest font-medium text-google-textVariant block mb-2">Status Kehadiran (Semua Warga)</label>
                                                    <div className="flex gap-2">
                                                        {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                            <button key={stat} onClick={() => setCashierStatus(stat)} className={`flex-1 py-2.5 text-[11px] font-medium uppercase tracking-widest rounded-full border transition-all ${cashierStatus === stat ? 'bg-google-blue text-white border-google-blueDark shadow-md' : 'bg-transparent text-google-textVariant border-slate-200 hover:bg-slate-50'}`}>{stat}</button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="text-[10px] uppercase tracking-widest font-medium text-google-textVariant block mb-2">Uang Diterima (Rp)</label>
                                                    <input type="number" min="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[16px] font-medium outline-none rounded-xl text-google-text placeholder:text-slate-300 transition-all" placeholder="0" />
                                                </div>

                                                {(() => {
                                                    let totalGabungan = 0;
                                                    scannedMembers.forEach(m => {
                                                        totalGabungan += (m.program === 'IuranOnly' ? 0 : nominalArisan) + nominalJimpitan + (m.debt || 0);
                                                    });
                                                    const received = safeNumber(cashReceived);
                                                    const kembalian = received - totalGabungan;
                                                    return received > 0 ? (
                                                        <div className={`p-4 rounded-xl border shadow-sm ${kembalian >= 0 ? 'bg-google-greenLight border-google-green/40 text-google-greenDark' : 'bg-google-redLight border-google-red/40 text-google-redDark'}`}>
                                                            <p className="text-[10px] font-medium uppercase tracking-widest mb-1">{kembalian >= 0 ? 'Kembalian' : 'Status'}</p>
                                                            <p className="text-[17px] font-medium">{kembalian >= 0 ? formatRp(kembalian) : 'Uang Kurang!'}</p>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            <div className="flex gap-3 mt-auto shrink-0 pt-2 border-t border-slate-200">
                                                <button onClick={() => { setShowCashierModal(false); setScannedMembers([]); setTimeout(() => setIsScannerOpen(true), 300); }} className="flex-1 bg-white border border-slate-200 text-google-text font-medium py-3.5 rounded-full hover:bg-slate-50 hover:border-slate-400 transition-all text-[13px]">Batal</button>
                                                <button onClick={handleCashierSave} className="flex-1 bg-google-blue border border-google-blueDark text-white font-medium py-3.5 rounded-full hover:bg-google-blueDark hover:shadow-md transition-all text-[13px] flex justify-center items-center gap-2"><Icon name="save" className="text-[16px]" />Simpan</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {step === 2 && (
                            <div className="space-y-8 no-print">
                                <h3 className="text-3xl font-medium text-google-text mb-2 tracking-tight">Rekapitulasi Sementara</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8">Periksa kembali rincian aliran dana sebelum mengundi pemenang.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-google-greenLight border border-google-green/40 rounded-3xl p-8 sm:p-10 flex flex-col justify-center text-center shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                        <Icon name="payments" className="absolute -right-4 -bottom-4 text-[140px] text-google-green opacity-10 group-hover:scale-110 transition-transform duration-700" fill="true" />
                                        <div className="relative z-10">
                                            <p className="text-[11px] uppercase font-medium tracking-widest mb-3 text-google-greenDark">Arisan Diserahkan Ke Pemenang</p>
                                            <p className="text-4xl lg:text-5xl font-medium text-google-greenDark drop-shadow-sm tracking-tight">{formatRp(calculations.kasArisanTerkumpul)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 space-y-7 shadow-sm">
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="add_circle" className="text-[17px] text-google-green"/> Tunai Masuk</span><span className="text-google-greenDark font-medium">+{formatRp(calculations.kasJimpitanTerkumpul)}</span></div>
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="add_circle" className="text-[17px] text-google-green"/> Bayar Tunggakan</span><span className="text-google-greenDark font-medium">+{formatRp(calculations.pelunasanTunggakan)}</span></div>
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="remove_circle" className="text-[17px] text-google-red"/> Talangan (Keluar)</span><span className="text-google-redDark font-medium">-{formatRp(calculations.talanganJimpitan)}</span></div>
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="info" className="text-[17px] text-google-yellowDark"/> Tunggakan Baru</span><span className="text-google-redDark font-medium">+{formatRp(calculations.tunggakanBaru)}</span></div>
                                        <div className="w-full h-px bg-slate-200 my-5"></div>
                                        <div className="flex justify-between items-center font-medium text-[16px] bg-slate-50 p-6 sm:p-8 md:p-8 rounded-2xl border border-slate-200 shadow-sm"><span className="text-[13px] uppercase tracking-widest text-google-textVariant">Saldo Tunai Berjalan</span><span className="text-[18px] text-google-blueDark tracking-tight">{formatRp(projectedJimpitanCash)}</span></div>
                                    </div>
                                </div>
                                <div className="pt-8 flex flex-col sm:flex-row justify-between border-t border-slate-200 mt-10 gap-4">
                                    <button onClick={() => setStep(1)} className="w-full sm:w-auto bg-white text-google-text border border-slate-200 px-8 py-4 rounded-full font-medium text-[13px] hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2 shadow-sm"><Icon name="arrow_back" className="text-[17px]"/> Kembali</button>
                                    <button onClick={() => setStep(3)} className="w-full sm:w-auto bg-google-blue text-white border border-google-blueDark px-10 py-4 rounded-full font-medium text-[13px] shadow-md hover:bg-google-blueDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2">Lanjut Undi Pemenang <Icon name="celebration" className="text-[17px]"/></button>
                                </div>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-8 no-print">
                                <h3 className="text-3xl font-medium text-google-text mb-2 text-center tracking-tight">Tentukan Pemenang</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 text-center">Pilih warga yang akan menerima dana arisan putaran ini.</p>
                                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-14 text-center shadow-lg relative overflow-hidden max-w-2xl mx-auto">
                                    
                                    
                                    
                                    <div className="mb-8 relative z-10 animate-bounce" style={{ animationDuration: '2s' }}><Icon name="emoji_events" className="text-[100px] text-google-yellow drop-shadow-2xl" fill="true" /></div>
                                    
                                    {isCycleAlreadyComplete ? (
                                        <div className="text-center bg-google-greenLight text-google-greenDark p-6 sm:p-8 md:p-6 rounded-3xl border border-google-green max-w-sm mx-auto relative z-10 shadow-sm">
                                            <Icon name="verified" className="text-[40px] mb-3 mx-auto" fill="true" />
                                            <p className="font-medium text-[14px]">Semua warga sudah menang (Siklus Selesai).</p>
                                        </div>
                                    ) : (
                                        <div className="text-left bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 focus-within:border-google-blue focus-within:shadow-lg transition-all max-w-sm mx-auto relative z-10 shadow-md">
                                            <label className="text-[10px] font-medium text-google-textVariant block mb-3 uppercase tracking-widest text-center">Pilih Warga Pemenang</label>
                                            <select className="w-full bg-slate-50 rounded-full border border-slate-200 text-[16px] font-medium outline-none px-5 py-3.5 text-google-blueDark cursor-pointer focus:bg-white transition-colors" value={selectedWinnerId} onChange={(e) => {setSelectedWinnerId(e.target.value); setErrorMsg('');}}>
                                                <option value="" disabled>-- Klik untuk memilih --</option>
                                                {eligibleWinners.map(m => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                                            </select>
                                        </div>
                                    )}
                                    {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-5 py-4 rounded-2xl mt-6 flex flex-wrap items-center justify-center gap-2 max-w-sm mx-auto relative z-10"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                </div>
                                <div className="pt-8 flex flex-col sm:flex-row justify-between border-t border-slate-200 mt-10 gap-4">
                                    <button onClick={() => setStep(2)} className="w-full sm:w-auto bg-white text-google-text border border-slate-200 px-8 py-4 rounded-full font-medium text-[13px] hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2 shadow-sm"><Icon name="arrow_back" className="text-[17px]"/> Kembali</button>
                                    <button onClick={submitPertemuan} className="w-full sm:w-auto bg-google-green text-white border border-google-greenDark px-12 py-4 rounded-full font-medium text-[13px] shadow-md hover:bg-google-greenDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2"><Icon name="check_circle" className="text-[17px]"/> Selesai &amp; Simpan</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        function Laporan({ history, setMeetingHistory, members, setMembers, jimpitanBalance, setJimpitanBalance, nominalArisan, nominalJimpitan, cycleNumber, identity, userRole }) {
            const [filterMonth, setFilterMonth] = useState('Semua');
            const availableMonths = [...new Set(history.map(item => item.periode))];
            const displayedHistory = filterMonth === 'Semua' ? history : history.filter(item => item.periode === filterMonth);
const [editingHistoryId, setEditingHistoryId] = useState(null);
const [tempAttendance, setTempAttendance] = useState({});
const chartRef = useRef(null);
const canvasRef = useRef(null);

useEffect(() => {
if (!canvasRef.current || history.length === 0) return;
const chronological = [...history].reverse();
const labels = chronological.map(h => h.periode);
const dataPoints = chronological.map(h => h.saldoAkhirJimpitan || 0);

if (chartRef.current) chartRef.current.destroy();

import('chart.js/auto').then((module) => {
const Chart = module.default;
const ctx = canvasRef.current.getContext('2d');
chartRef.current = new Chart(ctx, {
type: 'line',
data: {
labels: labels,
datasets: [{
label: 'Saldo Jimpitan (Rp)',
data: dataPoints,
borderColor: '#e11d48',
backgroundColor: 'rgba(225, 29, 72, 0.1)',
borderWidth: 3,
pointBackgroundColor: '#e11d48',
pointBorderColor: '#fff',
pointBorderWidth: 2,
pointRadius: 5,
pointHoverRadius: 7,
fill: true,
tension: 0.4
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
plugins: { legend: { display: false } },
scales: {
y: {
beginAtZero: true,
ticks: { callback: function(value) { return 'Rp ' + (value/1000) + 'k'; } }
}
}
}
});

}); return () => { if (chartRef.current) chartRef.current.destroy(); };
}, [history]);

let growthStatus = null;
let growthAmount = 0;
if (history.length >= 2) {
const latest = history[0].saldoAkhirJimpitan || 0;
const previous = history[1].saldoAkhirJimpitan || 0;
growthAmount = latest - previous;
if (growthAmount > 0) growthStatus = 'tumbuh';
else if (growthAmount < 0) growthStatus = 'turun';
else growthStatus = 'stagnan';
} else if (history.length === 1) {
growthStatus = 'tumbuh';
growthAmount = history[0].saldoAkhirJimpitan || 0;
}

            const handleOpenEdit = (record) => { const attMap = {}; record.absensiDetails.forEach(a => { attMap[a.name] = a.status; }); setTempAttendance(attMap); setEditingHistoryId(record.id); };
            const handleAttendanceChange = (name, status) => { setTempAttendance(prev => ({ ...prev, [name]: status })); };

            const saveEditHistory = () => {
                const record = history.find(h => h.id === editingHistoryId);
                if (!record) return;
                let deltaGlobalJimpitan = 0, deltaRecordKasJimpitan = 0, deltaRecordTalangan = 0, deltaTunggakan = 0, deltaArisan = 0;
                const updatedMembers = [...members];
                // Cek apakah pemenang record ini berubah kehadirannya (affects kasArisanTerkumpul)
                const isWinnerRecord = (name) => record.winner && record.winner.includes(name);

                record.absensiDetails.forEach(oldAtt => {
                    const newStatus = tempAttendance[oldAtt.name];
                    if (!newStatus || oldAtt.status === newStatus) return; // tidak ada perubahan
                    // Cari berdasarkan nama (limitasi desain: nama harus unik)
                    const memberIndex = updatedMembers.findIndex(m => m.name === oldAtt.name);
                    if (memberIndex === -1) return;
                    // FIX CELAH-2: Warga Meninggal bebas dari arisan - skip perubahan debt/talangan
                    if (isNonaktif(updatedMembers[memberIndex])) return; // Nonaktif/Meninggal: bebas dari arisan
                    const member = { ...updatedMembers[memberIndex] };
                    const debtAmount = nominalArisan + nominalJimpitan;
                    
                    // Batalkan efek status lama
                    if (oldAtt.status === 'Hadir') {
                        deltaRecordKasJimpitan -= nominalJimpitan;
                        deltaGlobalJimpitan -= nominalJimpitan;
                    } else if (oldAtt.status === 'Alfa' || oldAtt.status === 'Musibah') {
                        deltaRecordTalangan -= nominalArisan;
                        deltaGlobalJimpitan += nominalArisan; // kembalikan talangan ke jimpitan
                        member.debt = Math.max(0, member.debt - debtAmount);
                        deltaTunggakan -= debtAmount;
                    }
                    
                    // Terapkan efek status baru
                    if (newStatus === 'Hadir') {
                        deltaRecordKasJimpitan += nominalJimpitan;
                        deltaGlobalJimpitan += nominalJimpitan;
                        // FIX: Jika ini pemenang, kasArisan berkurang karena pemenang hadir (tidak bayar ke diri sendiri)
                        if (isWinnerRecord(oldAtt.name)) deltaArisan -= nominalArisan;
                    } else if (newStatus === 'Alfa' || newStatus === 'Musibah') {
                        deltaRecordTalangan += nominalArisan;
                        deltaGlobalJimpitan -= nominalArisan;
                        member.debt += debtAmount;
                        deltaTunggakan += debtAmount;
                        // FIX: Jika ini pemenang tidak hadir, kasArisan bertambah (pemenang kini bayar)
                        if (isWinnerRecord(oldAtt.name)) deltaArisan += nominalArisan;
                    }
                    member.redRecord = member.debt > 0;
                    updatedMembers[memberIndex] = member;
                });
                
                setMembers(updatedMembers);
                setJimpitanBalance(prev => prev + deltaGlobalJimpitan);
                const updatedHistory = history.map(h => {
                    if (h.id === editingHistoryId) {
                        return {
                            ...h,
                            // FIX: Update kasArisanTerkumpul jika kehadiran pemenang berubah
                            kasArisanTerkumpul: Math.max(0, h.kasArisanTerkumpul + deltaArisan),
                            kasJimpitanMasuk: Math.max(0, h.kasJimpitanMasuk + deltaRecordKasJimpitan),
                            talanganJimpitan: Math.max(0, h.talanganJimpitan + deltaRecordTalangan),
                            tunggakanBaru: Math.max(0, (h.tunggakanBaru || 0) + deltaTunggakan),
                            totalTunggakanAkhir: Math.max(0, (h.totalTunggakanAkhir || 0) + deltaTunggakan),
                            // FIX KRITIS-4: Update saldoAkhirJimpitan di record sesuai delta global
                            saldoAkhirJimpitan: Math.max(0, (h.saldoAkhirJimpitan || 0) + deltaGlobalJimpitan),
                            absensiDetails: h.absensiDetails.map(a => ({ ...a, status: tempAttendance[a.name] || a.status }))
                        };
                    }
                    return h;
                });
                setMeetingHistory(updatedHistory); 
                setEditingHistoryId(null);
                showToast('Koreksi riwayat absensi berhasil disimpan.');
            };

            return (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 no-print shadow-sm">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Riwayat Pertemuan Arisan</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Arsip resmi presensi dan sirkulasi dana bulanan.</p></div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-slate-50 border border-slate-200 text-google-text text-[13px] font-medium rounded-full px-4 py-3.5 outline-none focus:border-google-blue w-full sm:w-auto cursor-pointer">
                                <option value="Semua">Tampilkan Semua Bulan</option>
                                {availableMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                            </select>
                            <button onClick={() => window.print()} className="bg-white border border-slate-200 text-google-text px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] hover:bg-slate-50 hover:border-slate-400 hover:shadow-md active:scale-95 transition-all duration-300 shadow-sm w-full sm:w-auto"><Icon name="print" className="text-[16px]" /><span>Cetak Laporan</span></button>
                        </div>
                    </div>

                    {history.length > 0 && (
<div className="no-print mb-8 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
<div>
<h3 className="text-xl font-medium text-google-text tracking-tight">Tren Saldo Jimpitan</h3>
<p className="text-[12px] font-medium text-google-textVariant mt-1">Pertumbuhan saldo tunai dari setiap pertemuan.</p>
</div>
{growthStatus && (
<div className={`px-4 py-2 rounded-2xl flex items-center gap-3 border ${
growthStatus === 'tumbuh' ? 'bg-google-greenLight border-google-green/40 text-google-greenDark' :
growthStatus === 'turun' ? 'bg-google-redLight border-google-red/40 text-google-redDark' :
'bg-slate-100 border-slate-400 text-slate-600'
}`}>
<Icon name={growthStatus === 'tumbuh' ? 'trending_up' : growthStatus === 'turun' ? 'trending_down' : 'trending_flat'} className="text-[24px]" />
<div className="flex flex-col">
<span className="text-[9px] uppercase font-medium tracking-widest">{growthStatus === 'tumbuh' ? 'Status: Tumbuh' : growthStatus === 'turun' ? 'Status: Menurun' : 'Status: Stagnan / Stack'}</span>
<span className="font-medium text-[13px] leading-tight">{growthStatus !== 'stagnan' ? (growthAmount > 0 ? '+' : '') + formatRp(Math.abs(growthAmount)) : 'Tidak ada pertumbuhan'}</span>
</div>
</div>
)}
</div>
<div className="w-full h-[250px] relative">
<canvas ref={canvasRef}></canvas>
</div>
</div>
)}

                    <div className="hidden print-only">
                        <div className="kop-surat">
                            <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                            <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                            <div className="kop-surat-logo-right"></div>
                        </div>
                        <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Laporan Pertemuan &amp; Arisan</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber} {filterMonth !== 'Semua' ? `| Bulan: ${filterMonth}` : ''}</p></div>
                        {displayedHistory.length === 0 ? <p className="text-center italic font-medium">Belum ada arsip pada filter ini.</p> : displayedHistory.map((record, idx) => (
                            <div key={record.id} style={{ marginBottom: '30px' }}>
                                <h3 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '2px solid black', paddingBottom: '4px', marginBottom: '10px' }}>Putaran Ke-{record.round} ({record.periode})</h3>
                                <table className="print-table" style={{ marginTop: '0', marginBottom: '10px' }}>
                                    <tbody>
                                        <tr><td width="40%"><strong>Tanggal Pelaksanaan</strong></td><td>{record.date}</td></tr>
                                        <tr><td><strong>Pemenang Arisan</strong></td><td>{record.winner}</td></tr>
                                        <tr><td><strong>Arisan Terkumpul/Diserahkan</strong></td><td>{formatRp(record.kasArisanTerkumpul)}</td></tr>
                                        <tr><td><strong>Jimpitan Tunai Masuk</strong></td><td>{formatRp(record.kasJimpitanMasuk)}</td></tr>
                                        <tr><td><strong>Pelunasan Tunggakan Masuk</strong></td><td>{formatRp(record.pelunasanTunggakan)}</td></tr>
                                        <tr><td><strong>Talangan Arisan (Tunai Keluar)</strong></td><td>{formatRp(record.talanganJimpitan)}</td></tr>
                                        <tr><td><strong>Tunggakan Warga (Dicatat Baru)</strong></td><td>{formatRp(record.tunggakanBaru || 0)}</td></tr>
                                        <tr><td><strong>Saldo Tunai Jimpitan Berjalan</strong></td><td style={{fontSize: '12pt'}}><strong>{formatRp(record.saldoAkhirJimpitan)}</strong></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-8 no-print">
                        {displayedHistory.map((record) => {
                            const isHoliday = record.winner.includes('LIBUR');
                            return (
                                <div key={record.id} className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-blue/30 transition-all duration-300">
                                    <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 bg-slate-50">
                                        <div><h3 className="font-medium text-2xl text-google-text tracking-tight">Putaran Ke-{record.round}</h3><p className="text-[13px] font-medium text-google-textVariant mt-2 flex flex-wrap items-center gap-1.5"><Icon name="event" className="text-[16px]"/> {record.periode} G {record.date}</p></div>
                                        <div className="mt-5 sm:mt-0 flex flex-col sm:items-end"><span className="text-[10px] uppercase font-medium text-google-textVariant tracking-widest mb-2">{isHoliday ? 'Status Kegiatan' : 'Pemenang Arisan'}</span><div className={`${isHoliday ? 'bg-google-yellow text-white border-google-yellowDark' : 'bg-google-blue text-white border-google-blueDark'} px-6 py-3 rounded-full font-medium text-[13px] shadow-md inline-flex items-center gap-2 border`}><Icon name={isHoliday ? "event_busy" : "emoji_events"} className="text-[17px]" fill="true" /> {record.winner}</div></div>
                                    </div>
                                    <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-google-greenLight border border-google-green/30 rounded-3xl p-8 flex flex-col justify-center text-center shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                            <Icon name="payments" className="absolute -right-2 -bottom-2 text-[100px] text-google-green opacity-10 group-hover:scale-110 transition-transform duration-500" fill="true" />
                                            <p className="text-[10px] uppercase font-medium tracking-widest mb-3 text-google-greenDark relative z-10">Arisan Diserahkan</p>
                                            <p className="text-4xl font-medium text-google-green relative z-10 drop-shadow-sm tracking-tight">{formatRp(record.kasArisanTerkumpul)}</p>
                                        </div>
                                        <div className="space-y-6 bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200">
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="add_circle" className="text-[16px] text-google-green"/> Jimpitan Masuk</span><span className="text-google-greenDark">+{formatRp(record.kasJimpitanMasuk)}</span></div>
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="add_circle" className="text-[16px] text-google-green"/> Bayar Tunggakan</span><span className="text-google-greenDark">+{formatRp(record.pelunasanTunggakan)}</span></div>
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="remove_circle" className="text-[16px] text-google-red"/> Talangan (Keluar)</span><span className="text-google-redDark">-{formatRp(record.talanganJimpitan)}</span></div>
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="info" className="text-[16px] text-google-yellowDark"/> Tunggakan Baru</span><span className="text-google-redDark">+{formatRp(record.tunggakanBaru || 0)}</span></div>
                                            <div className="w-full h-px bg-slate-200 my-4"></div>
                                            <div className="flex justify-between items-center text-[16px] font-medium tracking-tight"><span>Saldo Tunai Berjalan</span><span className="text-google-blueDark">{formatRp(record.saldoAkhirJimpitan)}</span></div>
                                        </div>
                                    </div>
                                    {!isHoliday && (
                                        <div className="p-6 sm:p-8 border-t border-slate-200 bg-white">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                                <h4 className="font-medium text-[16px] text-google-text tracking-tight">Detail Presensi Warga</h4>
                                                {userRole === 'admin' && <button onClick={() => handleOpenEdit(record)} className="text-[12px] bg-white text-google-text font-medium px-6 py-3.5 rounded-full hover:bg-slate-50 hover:border-slate-400 no-print transition-all duration-300 active:scale-95 border border-slate-200 flex flex-wrap items-center gap-2 shadow-sm"><Icon name="edit" className="text-[16px]" /> Revisi Data</button>}
                                            </div>
                                            <div className="flex flex-wrap gap-3 no-print text-[13px]">
                                                {record.absensiDetails.map((a, i) => {
                                                    const isHadir = a.status === 'Hadir'; const isAlfa = a.status === 'Alfa'; const isMeninggal = (a.status === 'Meninggal' || a.status === 'Nonaktif');
                                                    // FIX: Status Meninggal ditampilkan abu-abu (bebas arisan)
                                                    return <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-colors ${isMeninggal ? 'bg-slate-100 border-slate-400' : isHadir ? 'bg-slate-50 border-slate-200' : isAlfa ? 'bg-google-redLight border-google-red/40' : 'bg-google-yellowLight border-google-yellow/40'}`}><div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isMeninggal ? 'bg-slate-400' : isHadir ? 'bg-google-green' : isAlfa ? 'bg-google-red' : 'bg-google-yellow'}`}></div><span className={`font-medium text-[13px] ${isMeninggal ? 'text-slate-400 line-through' : 'text-google-text'}`}>{a.name}{isMeninggal && <span className="text-[9px] ml-1.5 bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider">{a.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</span></div>
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {displayedHistory.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="history" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2 tracking-tight">Belum Ada Riwayat</h3><p className="text-google-textVariant font-medium text-[13px]">Tidak ada catatan pertemuan untuk bulan yang dipilih.</p></div>}
                    </div>

                    {editingHistoryId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-sm text-left max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 dark:border-slate-700 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text dark:text-white mb-1 shrink-0 tracking-tight">Revisi Kehadiran</h3><p className="text-[13px] font-medium text-google-textVariant dark:text-slate-300 mb-6 shrink-0 leading-relaxed">Saldo akan disesuaikan otomatis mengikuti perubahan presensi ini.</p>
                                <div className="overflow-y-auto space-y-6 flex-1 pb-4 pr-1 hide-scrollbar">
                                    {history.find(h => h.id === editingHistoryId)?.absensiDetails.map((member, idx) => (
                                        <div key={idx} className={`flex flex-col gap-3 border p-5 rounded-3xl shadow-sm ${isNonaktif(member) ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 opacity-60' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40'}`}>
                                            <p className={`text-[14px] font-medium truncate tracking-tight ${isNonaktif(member) ? 'text-slate-400 line-through' : 'text-google-text dark:text-white'}`}>{member.name}{isNonaktif(member) && <span className="text-[9px] ml-2 bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded font-medium uppercase tracking-wider no-underline">{member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</p>
                                            {/* FIX BONUS-B: Warga Meninggal tidak punya toggle - bebas dari arisan */}
                                            {isNonaktif(member) ? (
                                                <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-400 dark:border-slate-700">
                                                    <Icon name="do_not_disturb" className="text-[16px] text-slate-400 dark:text-slate-500" />
                                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Bebas Arisan - Jimpitan saja</span>
                                                </div>
                                            ) : (
                                            <div className="flex flex-wrap rounded-2xl bg-slate-200/60 dark:bg-slate-850 p-2 gap-2 border border-slate-200 dark:border-slate-700 inset-shadow-sm">
                                                {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                    <button key={stat} onClick={() => handleAttendanceChange(member.name, stat)} className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-medium rounded-full transition-all duration-300 border ${tempAttendance[member.name] === stat ? (stat === 'Hadir' ? 'bg-google-green text-white shadow-md border-google-greenDark scale-105' : stat === 'Musibah' ? 'bg-google-yellowDark text-white shadow-md border-google-yellowDark scale-105' : 'bg-google-red text-white shadow-md border-google-redDark scale-105') : 'text-google-textVariant dark:text-slate-400 bg-transparent hover:bg-white dark:hover:bg-slate-800 border-transparent'}`}>{stat}</button>
                                                ))}
                                            </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 mt-2 shrink-0"><button onClick={() => setEditingHistoryId(null)} className="w-full sm:w-auto bg-white dark:bg-slate-800 text-google-text dark:text-white px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button><button onClick={saveEditHistory} className="flex-1 bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex items-center justify-center">Simpan Revisi</button></div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        function InfoDesaSection({ infoDesa, setInfoDesa, showAlert }) {
            const [localInfo, setLocalInfo] = useState(infoDesa || { enabled: true, batas: {}, kontak: [] });
            
            useEffect(() => {
                if (infoDesa) setLocalInfo(infoDesa);
            }, [infoDesa]);

            const handleSave = () => {
                setInfoDesa(localInfo);
                showAlert('Pengaturan Info Desa berhasil disimpan.');
            };

            const updateBatas = (arah, val) => {
                setLocalInfo(prev => ({
                    ...prev,
                    batas: { ...prev.batas, [arah]: val }
                }));
            };

            const addKontak = () => {
                setLocalInfo(prev => ({
                    ...prev,
                    kontak: [...(prev.kontak || []), { id: Date.now(), nama: 'Kontak Baru', telepon: '0800-0000-0000', icon: 'contact_phone', color: 'slate' }]
                }));
            };

            const removeKontak = (index) => {
                setLocalInfo(prev => ({
                    ...prev,
                    kontak: prev.kontak.filter((k, i) => i !== index)
                }));
            };

            const updateKontak = (index, field, val) => {
                setLocalInfo(prev => ({
                    ...prev,
                    kontak: prev.kontak.map((k, i) => i === index ? { ...k, [field]: val } : k)
                }));
            };

            return (
                <PengaturanSection title="Manajemen Info Layanan Desa" onSave={handleSave}>
                    <div className="space-y-8">
                        {/* Toggle Aktif */}
                        <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 cursor-pointer hover:bg-google-blueLight/20 hover:border-google-blue/40 dark:hover:bg-slate-850/20 transition-all duration-200">
                            <div>
                                <p className="text-[13px] font-medium text-google-text dark:text-white">Aktifkan Info Desa</p>
                                <p className="text-[11px] text-google-textVariant dark:text-slate-350 font-medium mt-0.5">Tampilkan bagian batas & kontak di Peta Desa</p>
                            </div>
                            <div className="relative">
                                <input type="checkbox" className="sr-only peer" checked={localInfo.enabled} onChange={e => setLocalInfo({...localInfo, enabled: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-google-blue after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                            </div>
                        </label>

                        {localInfo.enabled && (
                            <>
                                {/* Batas Administrasi */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                    <h4 className="font-medium text-[13px] text-google-text dark:text-white mb-4">Batas Administrasi</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                            <div key={arah} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-700 focus-within:border-google-blue transition-all">
                                                <label className="text-[9px] font-medium text-google-textVariant dark:text-slate-400 block mb-1 uppercase tracking-widest">{arah}</label>
                                                <input type="text" value={localInfo.batas?.[arah] || ''} onChange={e => updateBatas(arah, e.target.value)} className="w-full bg-transparent border-none text-[12px] font-medium outline-none p-0 text-google-text dark:text-white" placeholder={`Batas ${arah}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Kontak Penting */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                    <h4 className="font-medium text-[13px] text-google-text dark:text-white mb-4">Kontak Penting</h4>
                                    <div className="space-y-5 mb-4">
                                        {localInfo.kontak?.map((k, idx) => {
                                            const idKey = k.id || k.nama;
                                            return (
                                            <div key={idKey} className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-750 relative group">
                                                <div className="flex-1">
                                                    <input type="text" value={k.nama} onChange={e => updateKontak(idKey, 'nama', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[12px] font-medium outline-none focus:border-google-blue text-google-text dark:text-white mb-2" placeholder="Nama Layanan" />
                                                    <input type="text" value={k.telepon} onChange={e => updateKontak(idKey, 'telepon', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[12px] font-medium outline-none focus:border-google-blue text-google-text dark:text-white" placeholder="Nomor Telepon" />
                                                </div>
                                                <button onClick={() => removeKontak(idKey)} className="self-end sm:self-center bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-2 rounded-full hover:bg-red-100 transition-colors">
                                                    <Icon name="delete" className="text-[17px]" />
                                                </button>
                                            </div>
                                        )})}
                                    </div>
                                    <button onClick={addKontak} className="w-full py-3 border border-dashed border-slate-400 dark:border-slate-650 rounded-full text-google-textVariant dark:text-slate-400 font-medium text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-google-blue hover:border-google-blue transition-all flex items-center justify-center gap-2">
                                        <Icon name="add" className="text-[16px]" /> Tambah Kontak
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </PengaturanSection>
            );
        }

        function SponsorSection({ sponsorsData, setSponsorsData, showAlert }) {
            const [newName, setNewName] = useState('');
            const [newUrl, setNewUrl] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [previewUrl, setPreviewUrl] = useState('');
            const [uploadError, setUploadError] = useState('');

            // Gunakan base64 dengan kompresi Canvas agar ukuran sangat kecil (< 50KB) dan aman masuk Firestore
            const uploadLogo = async (file) => {
                if (!file) return;
                if (!file.type.match('image.*')) { showAlert('Gagal: File harus berupa gambar!'); return; }
                if (file.size > 5 * 1024 * 1024) { showAlert('Gagal: Ukuran gambar awal maksimal 5MB!'); return; }
                setIsUploading(true); setUploadError('');
                try {
                    const url = await uploadToGoogleDrive(file, 400, 0.8);
                    setNewUrl(url);
                    setPreviewUrl(url);
                    setUploadError('');
                } catch(error) {
                    setUploadError(error);
                    showAlert(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleAdd = () => {
                if (!newName.trim()) { showAlert('Nama sponsor harus diisi!'); return; }
                if (!newUrl.trim()) { showAlert('Logo harus diunggah atau URL dimasukkan!'); return; }
                const nameToSave = newName.trim();
                const urlToSave = newUrl.trim();
                // Gunakan functional update agar tidak terkena stale closure saat onSnapshot Firebase tiba
                setSponsorsData(prev => {
                    const current = prev?.sponsors || [];
                    return { ...prev, sponsors: [...current, { name: nameToSave, url: urlToSave }] };
                });
                setNewName(''); setNewUrl(''); setPreviewUrl(''); setUploadError('');
                showAlert('Sponsor berhasil ditambahkan dan disimpan!');
            };

            return (
            <PengaturanSection title="Manajemen Sponsor" onSave={() => showAlert('Pengaturan Sponsor berhasil disimpan.')}>
                <div className="space-y-6">
                 <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 cursor-pointer hover:bg-google-blueLight/20 hover:border-google-blue/40 dark:hover:bg-slate-850/20 transition-all duration-200">
                    <div>
                    <p className="text-[13px] font-medium text-google-text dark:text-white">Aktifkan Tampilan Sponsor</p>
                    <p className="text-[11px] text-google-textVariant dark:text-slate-350 font-medium mt-0.5">Tampilkan logo-logo sponsor di halaman utama</p>
                    </div>
                    <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={sponsorsData?.enabled || false} onChange={e => {
                        const checked = e.target.checked;
                        // Functional update agar enabled tidak hilang saat onSnapshot tiba
                        setSponsorsData(prev => ({ ...prev, enabled: checked }));
                    }} />
                    <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 peer-checked:bg-google-blue rounded-full transition-colors peer"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-6 peer"></div>
                    </div>
                 </label>
                 {sponsorsData?.enabled && (
                    <div className="mt-2 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-7">
                    <div>
                        <p className="text-[10px] font-medium text-google-textVariant dark:text-slate-400 uppercase tracking-widest mb-3">Daftar Sponsor</p>
                        <div className="space-y-2">
                        {sponsorsData?.sponsors?.map((s, i) => (
                            <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-850 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-750 gap-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <img src={s.url} alt={s.name} className="h-9 w-16 object-contain shrink-0 rounded bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" onError={(e) => { e.target.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>=+n+</text></svg>'; }} />
                                <span className="text-[12px] font-medium text-google-text dark:text-white truncate">{s.name}</span>
                            </div>
                            <button onClick={() => {
                                const idx = i;
                                // Functional update agar hapus tidak terkena stale closure
                                setSponsorsData(prev => {
                                    const ns = [...(prev?.sponsors || [])]; ns.splice(idx, 1);
                                    return { ...prev, sponsors: ns };
                                });
                            }} className="text-google-red hover:bg-red-50 dark:hover:bg-red-950/20 w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0"><Icon name="delete" className="text-[17px]" /></button>
                            </div>
                        ))}
                        {(!sponsorsData?.sponsors || sponsorsData.sponsors.length === 0) && (
                            <p className="text-[11px] italic text-slate-400 dark:text-slate-500 text-center py-3">Belum ada sponsor. Tambahkan di bawah.</p>
                        )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-6">
                        <p className="text-[10px] font-medium text-google-textVariant dark:text-slate-400 uppercase tracking-widest">Tambah Sponsor Baru</p>

                        <div className="bg-white dark:bg-slate-850 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-google-blue transition-all shadow-sm">
                        <label className="text-[9px] font-medium text-google-textVariant dark:text-slate-400 block mb-1 uppercase tracking-widest">Nama Sponsor</label>
                        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Misal: Bank BRI Cabang Pakem" className="w-full bg-transparent text-[13px] font-medium text-google-text dark:text-white placeholder:text-slate-350 dark:placeholder:text-slate-550 outline-none" />
                        </div>

                        <div>
                        <p className="text-[9px] font-medium text-google-textVariant dark:text-slate-400 uppercase tracking-widest mb-2">Logo / Gambar Sponsor</p>
                        <label className={`relative w-full h-16 bg-white dark:bg-slate-850 border ${isUploading ? 'border-google-blue bg-google-blueLight/20 dark:bg-google-blueLight/10' : 'border-slate-200 dark:border-slate-700 hover:border-google-blue/50'} rounded-xl flex items-center justify-center px-4 cursor-pointer transition-all duration-200 overflow-hidden`}>
                            <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                            {isUploading ? (
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin shrink-0"></div>
                                <span className="font-medium text-[12px] text-google-blue">Mengunggah logo...</span>
                            </div>
                            ) : (
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-10 h-10 bg-google-blueLight dark:bg-slate-800 rounded-xl flex items-center justify-center border border-google-blue/30 dark:border-slate-700 shrink-0">
                                <Icon name="add_photo_alternate" className="text-google-blue text-[17px]" />
                                </div>
                                <div>
                                <p className="font-medium text-[12px] text-google-text dark:text-white">{previewUrl ? 'Ganti Gambar Logo' : 'Pilih File Logo (Maks 2MB)'}</p>
                                <p className="text-[10px] text-google-textVariant dark:text-slate-400 font-medium">PNG, JPG, SVG, WEBP G upload ke Google Drive</p>
                                </div>
                            </div>
                            )}
                        </label>
                        {uploadError && <p className="text-[10px] text-google-red font-medium mt-2 px-1">{uploadError}</p>}
                        </div>

                        {/* Preview */}
                        {previewUrl && !isUploading && (
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-850 border border-google-green/30 dark:border-google-green/45 rounded-xl p-3 shadow-sm">
                            <img src={previewUrl} alt="preview" className="h-10 max-w-[80px] object-contain rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1" onError={(e) => e.target.style.display='none'} />
                            <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-google-green flex items-center gap-1"><Icon name="check_circle" className="text-[13px]"/>Logo siap disimpan</p>
                            <p className="text-[9px] text-google-textVariant dark:text-slate-400 truncate font-mono mt-0.5">{previewUrl.slice(0,60)}</p>
                            </div>
                            <button onClick={() => { setNewUrl(''); setPreviewUrl(''); setUploadError(''); }} className="text-google-red hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-full transition-colors shrink-0"><Icon name="close" className="text-[14px]" /></button>
                        </div>
                        )}

                        {/* Fallback URL manual */}
                        <details className="mt-1">
                        <summary className="text-[10px] font-medium text-google-textVariant dark:text-slate-400 cursor-pointer select-none hover:text-google-blue transition-colors flex items-center gap-1.5">
                            <Icon name="link" className="text-[13px]" /> Atau masukkan URL gambar secara manual
                        </summary>
                        <div className="mt-2 bg-white dark:bg-slate-850 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-google-blue transition-all shadow-sm">
                            <input type="text" value={newUrl} onChange={e => { setNewUrl(e.target.value); setPreviewUrl(e.target.value); }} placeholder="https://contoh.com/logo.png" className="w-full bg-transparent text-[12px] font-mono text-google-text dark:text-white placeholder:text-slate-350 dark:placeholder:text-slate-550 outline-none" />
                        </div>
                        </details>
                    </div>

                    <button onClick={handleAdd} disabled={isUploading || !newName.trim() || !newUrl.trim()} className="w-full bg-google-blue border border-google-blueDark text-white py-4 rounded-full font-medium text-[13px] hover:bg-google-blueDark active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                        <Icon name="add_circle" className="text-[17px]" />Tambah &amp; Simpan Sponsor
                    </button>
                    </div>
                )}
                </div>
            </PengaturanSection>
            );
        }


        function PengaturanSection({ title, onSave, children }) {
            return (
                <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <h3 className="font-medium text-[17px] text-google-text mb-6 border-b border-slate-200 pb-4 group-hover:text-google-blue transition-colors tracking-tight">{title}</h3>
                    <div className="space-y-8 mb-8">{children}</div>
                    <button onClick={onSave} className="w-full bg-slate-50 border border-slate-200 text-google-blueDark py-4 rounded-full font-medium text-[13px] hover:bg-google-blue hover:border-google-blue hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95">Simpan {title}</button>
                </div>
            );
        }

        function Pengaturan(props) {
            const { nominalArisan, setNominalArisan, nominalJimpitan, setNominalJimpitan, identity, setIdentity, setMembers, setMeetingHistory, currentRound, setCurrentRound, cycleNumber, setCycleNumber, jimpitanBalance, setJimpitanBalance, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions, arisanPeriod, setArisanPeriod, bannerImage, setBannerImage,
            // State tambahan untuk reset menyeluruh (diteruskan dari App)
            setIuranData, setGaleriData, setInventarisData, setInformasi, setNextMeeting, infoDesa, setInfoDesa, umkmData, setUmkmData, landingConfig, setLandingConfig } = props;
            
            const [formIdentity, setFormIdentity] = useState(identity);
            const [formLanding, setFormLanding] = useState(landingConfig);
            const [formNominal, setFormNominal] = useState({ arisan: nominalArisan, jimpitan: nominalJimpitan });
            const [formPeriod, setFormPeriod] = useState(arisanPeriod);
            const [formSaldo, setFormSaldo] = useState({ jimpitan: jimpitanBalance, kasRt: kasRtBalance });
            const [formRound, setFormRound] = useState({ round: currentRound, cycle: cycleNumber });
            const [modalConfig, setModalConfig] = useState(null); 
            const [confirmResetModal, setConfirmResetModal] = useState(false);
            const [resetPromptInput, setResetPromptInput] = useState('');
            const [formBanner, setFormBanner] = useState(bannerImage || '');
            const [isUploadingLogo, setIsUploadingLogo] = useState(false);
            const [isUploadingBanner, setIsUploadingBanner] = useState(false);
            const [activeMenu, setActiveMenu] = useState(null);
            
            const pengaturanMenus = [
                { id: 'profil', title: 'Profil Aplikasi', icon: 'badge', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', hoverBorder: 'hover:border-blue-500', groupHoverBg: 'group-hover:bg-blue-500', groupHoverText: 'group-hover:text-blue-600', desc: 'Nama & Kop Surat Aplikasi' },
                { id: 'nominal', title: 'Iuran Wajib', icon: 'payments', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', hoverBorder: 'hover:border-emerald-500', groupHoverBg: 'group-hover:bg-emerald-500', groupHoverText: 'group-hover:text-emerald-600', desc: 'Besaran Arisan & Jimpitan' },
                { id: 'kalibrasi', title: 'Kalibrasi Siklus', icon: 'build', bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', hoverBorder: 'hover:border-orange-500', groupHoverBg: 'group-hover:bg-orange-500', groupHoverText: 'group-hover:text-orange-600', desc: 'Atur Putaran & Siklus' },
                { id: 'saldo', title: 'Koreksi Saldo', icon: 'account_balance_wallet', bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', hoverBorder: 'hover:border-indigo-500', groupHoverBg: 'group-hover:bg-indigo-500', groupHoverText: 'group-hover:text-indigo-600', desc: 'Edit Saldo Kas Utama' },
                { id: 'banner', title: 'Banner Utama', icon: 'image', bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', hoverBorder: 'hover:border-purple-500', groupHoverBg: 'group-hover:bg-purple-500', groupHoverText: 'group-hover:text-purple-600', desc: 'Gambar Latar Halaman Depan' },
                { id: 'sponsor', title: 'Sponsor', icon: 'handshake', bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200', hoverBorder: 'hover:border-teal-500', groupHoverBg: 'group-hover:bg-teal-500', groupHoverText: 'group-hover:text-teal-600', desc: 'Logo Sponsor RT' },
                { id: 'legal', title: 'Kebijakan', icon: 'gavel', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', hoverBorder: 'hover:border-slate-500', groupHoverBg: 'group-hover:bg-slate-500', groupHoverText: 'group-hover:text-slate-600', desc: 'Syarat & Privasi' },
                { id: 'infodesa', title: 'Info Desa', icon: 'map', bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200', hoverBorder: 'hover:border-rose-500', groupHoverBg: 'group-hover:bg-rose-500', groupHoverText: 'group-hover:text-rose-600', desc: 'Kontak & Batas Wilayah' },
                { id: 'landing', title: 'Teks Beranda', icon: 'view_quilt', bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200', hoverBorder: 'hover:border-pink-500', groupHoverBg: 'group-hover:bg-pink-500', groupHoverText: 'group-hover:text-pink-600', desc: 'Ubah teks landing page' },
                { id: 'whatsapp', title: 'Grup WhatsApp', icon: 'chat', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', hoverBorder: 'hover:border-emerald-500', groupHoverBg: 'group-hover:bg-emerald-500', groupHoverText: 'group-hover:text-emerald-600', desc: 'Link & Akses Grup WA' },
                { id: 'reset', title: 'Reset Sistem', icon: 'warning', bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', hoverBorder: 'hover:border-red-500', groupHoverBg: 'group-hover:bg-red-500', groupHoverText: 'group-hover:text-red-600', desc: 'Hapus Semua Data' }
            ];

            useEffect(() => { setFormSaldo({ jimpitan: jimpitanBalance, kasRt: kasRtBalance }); }, [jimpitanBalance, kasRtBalance]);
            useEffect(() => { setFormRound({ round: currentRound, cycle: cycleNumber }); setFormPeriod(arisanPeriod); }, [currentRound, cycleNumber, arisanPeriod]);

            const showAlert = (message) => setModalConfig({ message });

            const handleSaveAll = (type) => {
                if(type === 'saldo') {
                    const newKasRt = safeNumber(formSaldo.kasRt);
                    const newJimpitan = safeNumber(formSaldo.jimpitan);
                    const diff = newKasRt - kasRtBalance;
                    setJimpitanBalance(newJimpitan);
                    if(diff !== 0) {
                        setKasRtBalance(newKasRt);
                        // Gunakan functional update untuk hindari stale closure
                        setKasRtTransactions(prev => [{ id: Date.now(), date: getLocalDate(), type: diff > 0 ? 'Pemasukan' : 'Pengeluaran', category: 'Saldo Awal', description: 'Penyesuaian Saldo Awal', amount: Math.abs(diff) }, ...prev]);
                    }
                }
                if(type === 'id') { if (!formIdentity.name || !formIdentity.name.trim()) return showAlert("Nama aplikasi tidak boleh kosong!"); setIdentity(formIdentity); }
                if(type === 'nominal') {
                    const newArisan = safeNumber(formNominal.arisan);
                    const newJimpitan = safeNumber(formNominal.jimpitan);
                    if (newArisan <= 0 || newJimpitan <= 0) return showAlert("Nominal arisan dan jimpitan harus lebih dari Rp 0!");
                    setNominalArisan(newArisan); setNominalJimpitan(newJimpitan);
                }
                if(type === 'kalibrasi') { 
                    setArisanPeriod(formPeriod); 
                    setCurrentRound(Math.max(1, safeNumber(formRound.round))); 
                    setCycleNumber(Math.max(1, safeNumber(formRound.cycle))); 
                }
                if(type === 'banner') { setBannerImage(formBanner); }
                if(type === 'landing') { setLandingConfig(formLanding); }
                if(type === 'whatsapp') { setLandingConfig(formLanding); }
                showAlert("Perubahan berhasil disimpan.");
            };

            const executeFactoryReset = () => {
                if (resetPromptInput.toUpperCase() === 'RESET') {
                    const nowPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    setMembers([]); setMeetingHistory([]); setCurrentRound(1); setCycleNumber(1);
                    setJimpitanBalance(0); setKasRtBalance(0); setKasRtTransactions([]);
                    setArisanPeriod(nowPeriod);
                    // Reset data konten yang sering terlupakan
                    if (setIuranData) setIuranData([]);
                    if (setGaleriData) setGaleriData([]);
                    if (setInventarisData) setInventarisData([]);
                    if (setUmkmData) setUmkmData([]);
                    if (setLaporanData) setLaporanData([]);
                    if (setInformasi) setInformasi([]);
                    if (setNextMeeting) setNextMeeting({ date: 'Belum dijadwalkan', time: '-', location: '-', notes: '-' });
                    setBannerImage('');
                    // Bersihkan localStorage cache
                    try {
                        const keys = ['members','history','round','cycle','jimpitan','kas_rt_balance','kas_rt_trx','period','iuran_umum','galeri_warga','inventaris_rt','informasi','next_meeting','banner_image','umkm', 'laporan'];
                        keys.forEach(k => localStorage.removeItem('arisan_rt_' + k));
                    } catch(e) {}
                    setConfirmResetModal(false); setResetPromptInput(''); showAlert("Sistem berhasil di-reset total.");
                } else {
                    showAlert("Kode salah. Gagal reset."); setConfirmResetModal(false); setResetPromptInput('');
                }
            };

            // Upload Banner: Canvas compress G base64 G Firestore (tanpa GAS)
            const handleLogoUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return showAlert('Gagal: File harus berupa gambar!');
                if (file.size > 2 * 1024 * 1024) return showAlert('Gagal: Ukuran file maksimal 2MB!');
                setIsUploadingLogo(true);
                try {
                    const url = await uploadToGoogleDrive(file, 400, 0.9);
                    setFormIdentity({...formIdentity, logoApp: url});
                    showAlert('Logo berhasil diunggah! Klik "Simpan Profil" untuk menerapkan.');
                } catch(error) {
                    showAlert(error);
                } finally {
                    setIsUploadingLogo(false);
                }
            };

            const handleBannerUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return showAlert('Gagal: File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return showAlert('Gagal: Ukuran file maksimal 10MB!');
                setIsUploadingBanner(true);
                try {
                    const url = await uploadToGoogleDrive(file, 1600, 0.85);
                    setFormBanner(url);
                    showAlert('Gambar berhasil diproses! Klik "Simpan Banner" untuk menerapkan.');
                } catch(error) {
                    showAlert(error);
                } finally {
                    setIsUploadingBanner(false);
                }
            };
            const renderGridMenu = () => (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {pengaturanMenus.map(menu => (
                        <div key={menu.id} onClick={() => setActiveMenu(menu.id)} className={`bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg hover:-translate-y-1.5 cursor-pointer transition-all duration-300 group flex flex-col items-center text-center gap-4`}>
                            <div className={`w-14 h-14 ${menu.bg} ${menu.text} rounded-2xl flex items-center justify-center border ${menu.border} group-hover:scale-110 ${menu.groupHoverBg} group-hover:text-white transition-all duration-300`}>
                                <Icon name={menu.icon} className="text-[24px]" fill="true" />
                            </div>
                            <div>
                                <h3 className={`font-medium text-[14px] text-google-text tracking-tight ${menu.groupHoverText} transition-colors`}>{menu.title}</h3>
                                <p className="text-[11px] font-medium text-google-textVariant mt-1">{menu.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            );

            const renderHeader = (menuId) => {
                const menu = pengaturanMenus.find(m => m.id === menuId);
                if (!menu) return null;
                return (
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <button onClick={() => setActiveMenu(null)} className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all text-google-textVariant shrink-0 shadow-sm hover:shadow-md">
                            <Icon name="arrow_back" className="text-[20px]" />
                        </button>
                        <div className={`w-12 h-12 ${menu.bg} ${menu.text} rounded-full flex items-center justify-center border ${menu.border} shrink-0`}>
                            <Icon name={menu.icon} className="text-[20px]" fill="true" />
                        </div>
                        <h2 className="text-[17px] font-medium text-google-text tracking-tight">{menu.title}</h2>
                    </div>
                );
            };

            return (
                <div className="space-y-8 tab-fade-in">
                    {activeMenu === null && (
                        <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-5">
                            <div className="bg-google-blueLight text-google-blue w-16 h-16 rounded-2xl flex items-center justify-center border border-google-blue/30 shrink-0"><Icon name="admin_panel_settings" className="text-[32px]" fill="true"/></div>
                            <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Setelan Portal Admin</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Ubah konfigurasi fundamental aplikasi RT.</p></div>
                        </div>
                    )}

                    {activeMenu === null ? renderGridMenu() : (
                        <div className="w-full">
                            {renderHeader(activeMenu)}
                            
                            {activeMenu === 'profil' && (
                                <PengaturanSection title="Profil Utama Aplikasi" onSave={() => handleSaveAll('id')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Kop Surat (Baris 1)</label><input type="text" value={formIdentity.name} onChange={e => setFormIdentity({...formIdentity, name: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Sub Judul (Baris 2)</label><input type="text" value={formIdentity.subtitle} onChange={e => setFormIdentity({...formIdentity, subtitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Logo Aplikasi</label>
                                            <p className="text-[11px] text-slate-500 font-medium leading-snug">Format disarankan PNG transparan (maks 2MB). Kosongkan untuk pakai lambang Garuda bawaan.</p>
                                            {formIdentity.logoApp && (
                                                <button onClick={() => setFormIdentity({...formIdentity, logoApp: null})} className="text-[12px] font-medium text-google-red hover:underline mt-2 flex items-center gap-1"><Icon name="delete" className="text-[14px]" /> Hapus Logo Custom</button>
                                            )}
                                        </div>
                                        <div className="relative w-20 h-20 shrink-0 bg-slate-50 border border-dashed border-slate-400 rounded-2xl flex items-center justify-center hover:bg-google-blueLight/20 hover:border-google-blue/50 transition-all cursor-pointer overflow-hidden group">
                                            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            {isUploadingLogo ? (
                                                <div className="w-6 h-6 border border-google-blue border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                formIdentity.logoApp ? <img src={formIdentity.logoApp} className="w-full h-full object-contain p-2" alt="Logo" /> : <div className="flex flex-col items-center text-slate-400 group-hover:text-google-blue transition-colors"><Icon name="add_photo_alternate" className="text-[24px]" /><span className="text-[9px] font-medium mt-1">Upload</span></div>
                                            )}
                                        </div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'nominal' && (
                                <PengaturanSection title="Iuran Wajib" onSave={() => handleSaveAll('nominal')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Nominal Arisan (Rp)</label><input type="number" min="0" value={formNominal.arisan} onChange={e => setFormNominal({...formNominal, arisan: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Nominal Jimpitan (Rp)</label><input type="number" min="0" value={formNominal.jimpitan} onChange={e => setFormNominal({...formNominal, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'kalibrasi' && (
                                <PengaturanSection title="Kalibrasi Siklus & Bulan" onSave={() => handleSaveAll('kalibrasi')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Bulan & Tahun Arisan</label><input type="month" value={formPeriod} onChange={e => setFormPeriod(e.target.value)} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text cursor-pointer" /></div>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex-1 bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[9px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Putaran Ke-</label><input type="number" min="1" value={formRound.round} onChange={e => setFormRound({...formRound, round: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                        <div className="flex-1 bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[9px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Siklus Ke-</label><input type="number" min="1" value={formRound.cycle} onChange={e => setFormRound({...formRound, cycle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'saldo' && (
                                <PengaturanSection title="Koreksi Saldo Manual" onSave={() => handleSaveAll('saldo')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Saldo Kas Warga Utama (Rp)</label><input type="number" min="0" value={formSaldo.kasRt} onChange={e => setFormSaldo({...formSaldo, kasRt: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Saldo Jimpitan Berjalan (Rp)</label><input type="number" min="0" value={formSaldo.jimpitan} onChange={e => setFormSaldo({...formSaldo, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'banner' && (
                                <PengaturanSection title="Gambar Latar Banner Utama" onSave={() => handleSaveAll('banner')}>
                                    <div className={`flex flex-col gap-4 bg-white border ${isUploadingBanner ? 'border-google-blue shadow-md' : 'border-slate-200'} p-4 rounded-2xl transition-all`}>
                                        <label className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest">Unggah Foto (Orientasi Lebar/Landscape direkomendasikan)</label>
                                        <div className="relative overflow-hidden w-full h-14 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-4 hover:border-google-blue transition-colors cursor-pointer">
                                            <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={isUploadingBanner} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            {isUploadingBanner ? (
                                                <div className="flex flex-wrap items-center gap-3"><div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div><span className="font-medium text-[12px] text-google-blue">Mengunggah...</span></div>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-3"><Icon name="add_photo_alternate" className="text-google-textVariant text-[20px]" /><span className="font-medium text-[12px] text-google-text">{formBanner ? "Ganti Gambar Baru" : "Pilih File Gambar (Maks 2MB)"}</span></div>
                                            )}
                                        </div>
                                        {formBanner && !isUploadingBanner && (
                                            <div className="relative mt-2 h-24 w-full rounded-xl overflow-hidden border border-slate-200 group">
                                                <img src={formBanner} alt="Preview Banner" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button onClick={(e) => { e.preventDefault(); setFormBanner(''); }} className="bg-google-red text-white text-[11px] font-medium px-4 py-2 rounded-full flex flex-wrap items-center gap-1"><Icon name="delete" className="text-[14px]"/> Hapus</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </PengaturanSection>
                            )}
                            {activeMenu === 'landing' && (
                                <PengaturanSection title="Teks Halaman Depan" onSave={() => handleSaveAll('landing')}>
                                    <div className="space-y-8">
                                        <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
                                            <h4 className="text-[13px] font-medium text-google-text">Seksi Berita &amp; Pengumuman</h4>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Subjudul</label><input type="text" value={formLanding.newsSubtitle} onChange={e => setFormLanding({...formLanding, newsSubtitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Judul Utama</label><input type="text" value={formLanding.newsTitle} onChange={e => setFormLanding({...formLanding, newsTitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                        </div>

                                        <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
                                            <h4 className="text-[13px] font-medium text-google-text">Seksi UMKM</h4>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Subjudul</label><input type="text" value={formLanding.umkmSubtitle} onChange={e => setFormLanding({...formLanding, umkmSubtitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Judul Utama</label><input type="text" value={formLanding.umkmTitle} onChange={e => setFormLanding({...formLanding, umkmTitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                        </div>
                                        
                                        <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
                                            <h4 className="text-[13px] font-medium text-google-text">Bagian Footer (Bawah)</h4>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Slogan / Tagline</label><input type="text" value={formLanding.footerTagline} onChange={e => setFormLanding({...formLanding, footerTagline: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Judul Info Resmi</label><input type="text" value={formLanding.footerInfoTitle} onChange={e => setFormLanding({...formLanding, footerInfoTitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Teks Bukti Verifikasi</label><input type="text" value={formLanding.footerInfoDesc} onChange={e => setFormLanding({...formLanding, footerInfoDesc: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                        </div>

                                        <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
                                            <h4 className="text-[13px] font-medium text-google-text">Integrasi Google AdSense</h4>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Google AdSense Publisher ID</label><input type="text" value={formLanding.adsenseClientId || ''} onChange={e => setFormLanding({...formLanding, adsenseClientId: e.target.value})} placeholder="Contoh: ca-pub-XXXXXXXXXXXXXXXX" className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <p className="text-[11px] text-slate-500 leading-normal flex items-start gap-1">
                                                <Icon name="info" className="text-[13px] text-google-blue shrink-0 mt-0.5" /> Masukkan Publisher ID Anda untuk mengaktifkan iklan otomatis (Auto Ads). Pastikan Anda menyetujui penempatan iklan di dasbor Google AdSense Anda.
                                            </p>
                                        </div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'whatsapp' && (
                                <PengaturanSection title="Setelan Grup WhatsApp" onSave={() => handleSaveAll('whatsapp')}>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm">
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Link Undangan Grup WhatsApp (Invite Link)</label>
                                        <input type="text" value={formLanding.whatsappGroupLink || ''} onChange={e => setFormLanding({...formLanding, whatsappGroupLink: e.target.value})} placeholder="Contoh: https://chat.whatsapp.com/..." className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-normal flex items-start gap-1">
                                        <Icon name="info" className="text-[13px] text-google-blue shrink-0 mt-0.5" /> Link grup WhatsApp ini akan dibagikan secara otomatis kepada warga setelah pengajuan gabung mereka disetujui oleh Admin.
                                    </p>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'sponsor' && (
                                <SponsorSection sponsorsData={props.sponsorsData} setSponsorsData={props.setSponsorsData} showAlert={showAlert} />
                            )}
                            
                            {activeMenu === 'legal' && (
                                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm relative overflow-hidden animate-fade-in">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-10"></div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200"><Icon name="gavel" className="text-[20px]" /></div>
                                        <div>
                                            <h2 className="text-[16px] md:text-[17px] font-medium text-slate-800 tracking-tight">Hukum & Kebijakan</h2>
                                            <p className="text-[12px] text-slate-500 font-medium">Syarat & Ketentuan serta Privasi</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                            <div>
                                                <p className="text-[13px] font-medium text-slate-800">Aktifkan Halaman Kebijakan</p>
                                                <p className="text-[11px] text-slate-500">Tampilkan link di menu dan layar login</p>
                                            </div>
                                            <button onClick={() => props.setLegalData(p => ({...p, enabled: !p?.enabled}))} className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${props.legalData?.enabled ? 'bg-google-green' : 'bg-slate-300'}`}>
                                                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${props.legalData?.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>

                                        {props.legalData?.enabled && (
                                            <div className="space-y-8 animate-fade-in">
                                                <div>
                                                    <label className="text-[11px] font-medium text-slate-500 block mb-2 ml-1 uppercase tracking-widest">Syarat & Ketentuan</label>
                                                    <textarea value={props.legalData?.terms || ''} onChange={(e) => props.setLegalData(p => ({...p, terms: e.target.value}))} rows="6" className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white text-slate-700 rounded-xl px-5 py-4 text-[13px] font-medium outline-none transition-all resize-y custom-scrollbar" placeholder="Isi Syarat dan Ketentuan..."></textarea>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-medium text-slate-500 block mb-2 ml-1 uppercase tracking-widest">Kebijakan Privasi</label>
                                                    <textarea value={props.legalData?.privacy || ''} onChange={(e) => props.setLegalData(p => ({...p, privacy: e.target.value}))} rows="6" className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white text-slate-700 rounded-xl px-5 py-4 text-[13px] font-medium outline-none transition-all resize-y custom-scrollbar" placeholder="Isi Kebijakan Privasi..."></textarea>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => { showAlert('Kebijakan Hukum & Privasi berhasil disimpan!') }} className="w-full mt-8 bg-slate-50 border border-slate-200 text-google-blueDark py-4 rounded-full font-medium text-[13px] hover:bg-google-blue hover:border-google-blue hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95">Simpan Kebijakan</button>
                                </div>
                            )}
                            {activeMenu === 'infodesa' && (
                                <InfoDesaSection infoDesa={props.infoDesa} setInfoDesa={props.setInfoDesa} showAlert={showAlert} />
                            )}

                            {activeMenu === 'reset' && (
                                <div className="bg-google-red text-white p-8 sm:p-10 rounded-3xl border border-google-redDark shadow-xl relative overflow-hidden group">
                                    <Icon name="warning" className="absolute -right-5 -top-5 text-[160px] text-white opacity-10 group-hover:scale-110 transition-transform duration-700" fill="true" />
                                    <div className="relative z-10">
                                        <div className="flex items-center space-x-3 mb-4"><Icon name="report" className="text-[36px] text-white" fill="true" /><h3 className="font-medium text-[20px] tracking-tight">Bahaya: Hapus Semua Database</h3></div>
                                        <p className="text-[13px] font-medium mb-8 text-white/90 max-w-xl leading-relaxed">Tindakan ini akan menghapus seluruh data warga, riwayat keuangan, tunggakan, dan mengembalikan saldo kas menjadi nol kembali seperti baru (Setelan Pabrik).</p>
                                        <button onClick={() => setConfirmResetModal(true)} className="bg-white text-google-redDark px-8 py-4 rounded-full font-medium text-[13px] shadow-lg hover:shadow-xl active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto hover:bg-slate-50 border border-transparent hover:border-google-red"><Icon name="delete_forever" className="text-[17px]"/> Format Database Sekarang</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {modalConfig && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-6 bg-google-greenLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-green/30"><Icon name="check_circle" className="text-[48px] text-google-green" fill="true" /></div>
                                <p className="text-google-text text-[17px] font-medium mb-8 leading-snug tracking-tight">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-google-blue text-white px-8 py-4 rounded-full font-medium text-[13px] border border-google-blueDark hover:bg-google-blueDark active:scale-95 transition-all duration-300 shadow-md">Tutup Pesan</button>
                            </div>
                        </div>
                    )}
                    {confirmResetModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-left border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <h3 className="text-3xl font-medium text-google-red mb-2 tracking-tight">Reset Total?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Tindakan ini permanen dan tidak bisa dibatalkan. Ketik kata <b className="text-google-red">RESET</b> di bawah ini.</p>
                                <div className="bg-slate-50 rounded-2xl px-5 py-4 border border-google-red/40 focus-within:border-google-red focus-within:bg-white focus-within:shadow-md transition-all mb-8"><input type="text" value={resetPromptInput} onChange={e => setResetPromptInput(e.target.value)} className="w-full bg-transparent border-none text-[18px] outline-none p-0 text-google-redDark uppercase tracking-widest font-medium placeholder:text-google-red/30" placeholder="RESET" /></div>
                                <div className="flex flex-wrap gap-3"><button onClick={() => {setConfirmResetModal(false); setResetPromptInput('');}} className="w-full sm:w-auto bg-white text-google-text py-4 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button><button onClick={executeFactoryReset} className="flex flex-wrap bg-google-red text-white border border-google-redDark py-4 rounded-full font-medium text-[13px] shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2">Eksekusi</button></div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        function Pemenang({ members }) {
            // FIX: Urutkan dari putaran terbaru ke terlama agar urutannya sama dengan Riwayat Pertemuan Arisan
            const winners = members.filter(m => m.hasWon).sort((a, b) => b.wonRound - a.wonRound);
            return (
                <div className="space-y-8 max-w-7xl mx-auto">
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl flex flex-col sm:flex-row justify-between items-center border border-slate-200 shadow-sm text-center sm:text-left gap-5">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Daftar Pemenang Arisan</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Warga yang telah menerima dana pada siklus aktif saat ini.</p></div>
                        <div className="w-16 h-16 bg-google-yellowLight rounded-2xl flex items-center justify-center border border-google-yellow/40 shrink-0 shadow-sm"><Icon name="emoji_events" className="text-[32px] text-google-yellowDark" fill="true" /></div>
                    </div>
                    {winners.length === 0 ? <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="military_tech" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2 tracking-tight">Belum Ada Pemenang</h3><p className="text-google-textVariant font-medium text-[13px]">Data penerima arisan akan tampil di sini setelah diundi.</p></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                            {winners.map((winner) => (
                                <div key={winner.id} className="bg-white p-6 sm:p-8 md:p-6 rounded-3xl flex items-center space-x-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-yellow/60 transition-all duration-300 group">
                                    <div className="bg-google-yellowLight border border-google-yellow/40 text-google-yellowDark font-medium w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-[17px] group-hover:bg-google-yellow group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm">#{winner.wonRound}</div>
                                    <div className="flex-1 min-w-0"><h3 className="font-medium text-google-text text-[16px] truncate group-hover:text-google-yellowDark transition-colors tracking-tight">{winner.name}</h3><p className="text-[13px] font-medium text-google-textVariant mt-1">Menang di Putaran {winner.wonRound}</p></div>
                                    <Icon name="check_circle" className="text-[32px] text-google-green group-hover:scale-110 transition-transform" fill="true" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        function Kegiatan({ nextMeeting, setNextMeeting, userRole }) {
            const [isEditing, setIsEditing] = useState(false);
            const [formData, setFormData] = useState(nextMeeting);
            useEffect(() => { if (!isEditing) setFormData(nextMeeting); }, [nextMeeting, isEditing]);
            
            return (
                <div className="space-y-8 tab-fade-in">
                    {userRole === 'admin' && (
                        <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
                                <div><h2 className="text-xl font-medium text-google-text tracking-tight">Pengaturan Agenda</h2><p className="text-[12px] font-medium text-google-textVariant mt-1">Agenda tampil sebagai teks berjalan (marquee) di Halaman Utama.</p></div>
                                {!isEditing && <button onClick={() => setIsEditing(true)} className="shrink-0 bg-white border border-slate-200 text-google-text px-6 py-2.5 rounded-full font-medium flex items-center justify-center gap-2 text-[12px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm w-full sm:w-auto"><Icon name="edit" className="text-[14px]" /><span>Ubah Agenda</span></button>}
                            </div>

                            {isEditing && (
                                <div className="mt-6 pt-6 border-t border-slate-200 space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Hari &amp; Tanggal</label><input type="text" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: Sabtu, 10 Agustus 2026"/></div>
                                        <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Jam Pelaksanaan</label><input type="text" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: 19.30 WIB - Selesai"/></div>
                                    </div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Lokasi Pertemuan</label><input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: Rumah Bpk. Budi (RT 01)"/></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Agenda Utama Kegiatan</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl resize-none min-h-[100px] leading-relaxed transition-all text-google-text placeholder:text-slate-400" placeholder="Tulis rincian acara di sini..."></textarea></div>
                                    <div className="flex flex-wrap gap-3 pt-6 mt-6 border-t border-slate-200">
                                        <button onClick={() => setIsEditing(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3 rounded-full font-medium text-[12px] hover:bg-slate-50 border border-slate-200 active:scale-95 transition-all shadow-sm flex items-center justify-center">Batal</button>
                                        <button onClick={() => { setNextMeeting(formData); setIsEditing(false); showToast('Jadwal kegiatan berhasil diperbarui.'); }} className="flex bg-google-blue border border-google-blueDark text-white px-6 py-3 rounded-full font-medium text-[12px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all items-center justify-center gap-2"><Icon name="save" className="text-[14px]"/> Simpan Agenda</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <WaktuSholatWidget />
                </div>
            );
        }

        function Kalender() {
            const [currentDate, setCurrentDate] = useState(new Date());
            const [selectedDate, setSelectedDate] = useState(new Date());
            const [checkDateStr, setCheckDateStr] = useState('');
            const [checkResult, setCheckResult] = useState(null);

            const JAVANESE_MONTHS = [
                'Sura', 'Sapar', 'Mulud', 'Bakda Mulud', 
                'Jumadilawal', 'Jumadilakhir', 'Rejeb', 'Ruwah', 
                'Pasa', 'Sawal', 'Sela', 'Besar'
            ];

            const ISLAMIC_MONTHS = [
                'Muharram', 'Safar', 'Rabi\'ul Awal', 'Rabi\'ul Akhir',
                'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
                'Ramadhan', 'Syawal', 'Dzulqa\'dah', 'Dzulhijjah'
            ];

            // Pasaran Javanese 5-day cycle
            const getPasaran = (date) => {
                const epoch = new Date('1936-03-24T00:00:00');
                const pasaranDays = ['Pon', 'Wage', 'Kliwon', 'Legi', 'Pahing'];
                const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const d2 = new Date(epoch.getFullYear(), epoch.getMonth(), epoch.getDate());
                const diffInDays = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
                let index = diffInDays % 5;
                if (index < 0) index += 5;
                return pasaranDays[index];
            };

            // Javanese Day name (7-day cycle)
            const getJavaneseDayName = (date) => {
                const days = ['Akad', 'Senen', 'Selasa', 'Rebo', 'Kemis', 'Jemuwah', 'Setu'];
                return days[date.getDay()];
            };

            // Hijri and Javanese complete date object converter
            const getHijriAndJawaDetails = (date) => {
                try {
                    const hijriFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric'
                    });
                    const parts = hijriFormatter.formatToParts(date);
                    const hijriDay = parseInt(parts.find(p => p.type === 'day').value, 10);
                    const hijriMonthNum = parseInt(parts.find(p => p.type === 'month').value, 10);
                    const hijriYear = parseInt(parts.find(p => p.type === 'year').value, 10);

                    const hijriMonthName = ISLAMIC_MONTHS[hijriMonthNum - 1] || 'Muharram';
                    const javaneseMonthName = JAVANESE_MONTHS[hijriMonthNum - 1] || 'Sura';
                    const javaneseYear = hijriYear + 512;
                    const pasaran = getPasaran(date);
                    const javaneseDay = getJavaneseDayName(date);

                    return {
                        hijri: `${hijriDay} ${hijriMonthName} ${hijriYear} H`,
                        hijriDay,
                        jawa: `${javaneseDay} ${pasaran}, ${hijriDay} ${javaneseMonthName} ${javaneseYear} AJ`,
                        pasaran,
                        jawaDay: javaneseDay,
                        jawaMonth: javaneseMonthName,
                        jawaYear: javaneseYear,
                        hijriMonthNum,
                        hijriYear
                    };
                } catch (e) {
                    const pasaran = getPasaran(date);
                    const javaneseDay = getJavaneseDayName(date);
                    return {
                        hijri: `${date.getDate()} - H`,
                        jawa: `${javaneseDay} ${pasaran}, ${date.getDate()} AJ`,
                        pasaran,
                        jawaDay: javaneseDay,
                        jawaMonth: 'Sura',
                        jawaYear: '-'
                    };
                }
            };

            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const startDayOfWeek = new Date(year, month, 1).getDay();

            const prevMonthDays = new Date(year, month, 0).getDate();

            const handlePrevMonth = () => {
                setCurrentDate(new Date(year, month - 1, 1));
            };

            const handleNextMonth = () => {
                setCurrentDate(new Date(year, month + 1, 1));
            };

            const handleCheckWeton = (e) => {
                e.preventDefault();
                if (!checkDateStr) return;
                const d = new Date(checkDateStr);
                if (isNaN(d.getTime())) return;
                const details = getHijriAndJawaDetails(d);
                setCheckResult({
                    gregorian: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                    jawa: details.jawa,
                    hijri: details.hijri,
                    weton: `${details.jawaDay} ${details.pasaran}`
                });
            };

            const monthNames = [
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ];

            const selectedDetails = getHijriAndJawaDetails(selectedDate);

            // Generate Calendar cells
            const cells = [];
            
            // Previous month padding
            for (let i = startDayOfWeek - 1; i >= 0; i--) {
                const d = new Date(year, month - 1, prevMonthDays - i);
                cells.push({ date: d, isCurrentMonth: false });
            }

            // Current month days
            for (let i = 1; i <= daysInMonth; i++) {
                const d = new Date(year, month, i);
                cells.push({ date: d, isCurrentMonth: true });
            }

            // Next month padding
            const totalCells = 42;
            const remaining = totalCells - cells.length;
            for (let i = 1; i <= remaining; i++) {
                const d = new Date(year, month + 1, i);
                cells.push({ date: d, isCurrentMonth: false });
            }

            return (
                <div className="space-y-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-5">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2 justify-center md:justify-start">
                                <Icon name="calendar_month" className="text-[24px] text-red-600"/>
                                Kalender Tiga Dimensi Waktu
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1.5">Penanggalan Nasional (Masehi), Jawa (Pasaran), dan Hijriah (Islam).</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 bg-red-50 border border-red-500/30 px-4 py-2.5 rounded-2xl shadow-sm">
                            <Icon name="today" className="text-[17px] text-red-600 animate-pulse" fill="true"/>
                            <div className="text-[11px] font-medium text-red-800">
                                Hari Ini: {getJavaneseDayName(new Date())} {getPasaran(new Date())}, {new Date().getDate()} {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Detail Day Card & Weton Checker */}
                        <div className="space-y-8">
                            {/* Hari Ini / Selected Day Info */}
                            <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                                
                                <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                    <Icon name="info" className="text-[16px] text-red-600" />
                                    Detail Tanggal
                                </h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="bg-slate-50 border border-slate-200/60 p-6 sm:p-8 md:p-6 rounded-2xl shadow-sm">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-google-textVariant mb-1">Masehi / Nasional</p>
                                        <p className="font-medium text-[14px] text-google-text">
                                            {selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="bg-red-50/50 border border-red-500/20 p-6 sm:p-8 md:p-6 rounded-2xl shadow-sm">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-red-800 mb-1">Jawa / Pasaran</p>
                                        <p className="font-medium text-[14px] text-red-700">
                                            {selectedDetails.jawa}
                                        </p>
                                        <p className="text-[10px] font-medium text-red-600/80 mt-1">
                                            Weton: <span className="underline decoration-dotted">{selectedDetails.jawaDay} {selectedDetails.pasaran}</span>
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200/60 p-6 sm:p-8 md:p-6 rounded-2xl shadow-sm">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-google-textVariant mb-1">Hijriah / Kalender Islam</p>
                                        <p className="font-medium text-[14px] text-google-text">
                                            {selectedDetails.hijri}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Weton Checker Tool */}
                            <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm">
                                <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                    <Icon name="search" className="text-[16px] text-red-600" />
                                    Cek Weton & Pasaran Lahir
                                </h3>
                                <form onSubmit={handleCheckWeton} className="space-y-6">
                                    <div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-red-500 focus-within:bg-white transition-all shadow-sm">
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Pilih Tanggal</label>
                                        <input type="date" value={checkDateStr} onChange={e => { setCheckDateStr(e.target.value); setCheckResult(null); }} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text cursor-pointer animate-none" />
                                    </div>
                                    <button type="submit" className="w-full bg-red-600 text-white py-3.5 rounded-full font-medium text-[12px] border border-red-700 hover:bg-red-700 active:scale-95 transition-all duration-300 shadow-md flex flex-wrap justify-center items-center gap-1.5">
                                        <Icon name="explore" className="text-[14px]"/>
                                        Cek Sekarang
                                    </button>
                                </form>

                                {checkResult && (
                                    <div className="mt-5 p-6 sm:p-8 md:p-6 rounded-2xl bg-red-50 border border-red-500/30 space-y-2.5 tab-fade-in">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest font-medium text-red-800">Hasil Analisis</p>
                                            <p className="text-[11px] font-medium text-slate-600 mt-1">Masehi: {checkResult.gregorian}</p>
                                        </div>
                                        <div className="h-px bg-red-500/10"></div>
                                        <div>
                                            <p className="text-[12px] font-medium text-red-700">Weton: {checkResult.weton}</p>
                                            <p className="text-[11px] font-medium text-red-800 mt-0.5">Jawa: {checkResult.jawa}</p>
                                            <p className="text-[11px] font-medium text-slate-700 mt-0.5">Hijriah: {checkResult.hijri}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Calendar Grid Sheet */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm flex flex-col">
                            {/* Navigation */}
                            <div className="flex justify-between items-center mb-6">
                                <button onClick={handlePrevMonth} className="w-10 h-10 bg-slate-50 border border-slate-200 text-google-text hover:bg-slate-100 hover:border-slate-400 rounded-full flex justify-center items-center active:scale-95 transition-all shadow-sm">
                                    <Icon name="chevron_left" className="text-[17px]" />
                                </button>
                                <h3 className="text-xl font-medium text-google-text tracking-tight uppercase">
                                    {monthNames[month]} {year}
                                </h3>
                                <button onClick={handleNextMonth} className="w-10 h-10 bg-slate-50 border border-slate-200 text-google-text hover:bg-slate-100 hover:border-slate-400 rounded-full flex justify-center items-center active:scale-95 transition-all shadow-sm">
                                    <Icon name="chevron_right" className="text-[17px]" />
                                </button>
                            </div>

                            {/* Day names of the week */}
                            <div className="grid grid-cols-7 gap-1 text-center font-medium text-[10px] uppercase tracking-wider text-google-textVariant mb-2 pb-2 border-b border-slate-200">
                                <div className="text-red-600">Ahad</div>
                                <div>Senin</div>
                                <div>Selasa</div>
                                <div>Rabu</div>
                                <div>Kamis</div>
                                <div className="text-emerald-600">Jumat</div>
                                <div>Sabtu</div>
                            </div>

                            {/* Month Grid Cells */}
                            <div className="grid grid-cols-7 gap-1.5 flex-1">
                                {cells.map((cell, idx) => {
                                    const isSelected = selectedDate.getDate() === cell.date.getDate() && 
                                                       selectedDate.getMonth() === cell.date.getMonth() && 
                                                       selectedDate.getFullYear() === cell.date.getFullYear();
                                    
                                    const isToday = new Date().getDate() === cell.date.getDate() && 
                                                    new Date().getMonth() === cell.date.getMonth() && 
                                                    new Date().getFullYear() === cell.date.getFullYear();

                                    const dayDetails = getHijriAndJawaDetails(cell.date);
                                    
                                    return (
                                        <button 
                                            key={idx} 
                                            onClick={() => setSelectedDate(cell.date)}
                                            className={`relative min-h-[64px] p-2 rounded-full border flex flex-col justify-between items-stretch text-left transition-all active:scale-95 ${
                                                !cell.isCurrentMonth ? 'opacity-30 border-transparent hover:border-slate-200' : ''
                                            } ${
                                                isSelected 
                                                    ? 'bg-red-600 text-white border-red-700 shadow-md scale-105 z-10' 
                                                    : isToday 
                                                        ? 'bg-red-50 border-red-500 text-red-700 shadow-sm font-medium' 
                                                        : 'bg-slate-50/50 border-slate-200/70 hover:border-red-500/40 hover:bg-white text-google-text'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-[12px] sm:text-[13px] font-medium leading-none">{cell.date.getDate()}</span>
                                                <span className={`text-[8px] sm:text-[9px] font-medium opacity-80 leading-none ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                                                    {dayDetails.hijriDay}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-col items-stretch leading-tight">
                                                <span className={`text-[8px] sm:text-[9.5px] font-medium truncate ${
                                                    isSelected 
                                                        ? 'text-white' 
                                                        : dayDetails.pasaran === 'Kliwon' 
                                                            ? 'text-red-600' 
                                                            : 'text-emerald-700'
                                                }`}>
                                                    {dayDetails.pasaran}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        function PetaDesa({ infoDesa }) {

            return (
                <div className="space-y-8 max-w-7xl mx-auto tab-fade-in">
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-5">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2 justify-center md:justify-start">
                                <Icon name="map" className="text-[24px] text-red-600"/>
                                Area Cakupan Desa Banyuanyar
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1.5">Peta interaktif wilayah Desa Banyuanyar, Kecamatan Gurah, Kabupaten Kediri.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-500/30 px-4 py-2.5 rounded-2xl shadow-sm">
                            <Icon name="explore" className="text-[17px] text-red-600" fill="true"/>
                            <div className="text-[12.5px] font-medium text-red-800">
                                Kode Pos: 64181
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm overflow-hidden">
                        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15810.734045472811!2d112.0831012336427!3d-7.82328387515901!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e7859a9896e1c3d%3A0x750afa04649cafb0!2sBanyuanyar%2C%20Kec.%20Gurah%2C%20Kabupaten%20Kediri%2C%20Jawa%20Timur!5e0!3m2!1sid!2sid!4v1783910401380!5m2!1sid!2sid" className="w-full h-[450px] rounded-3xl z-10 border border-slate-200/80" style={{border:0}} allowFullScreen="" referrerPolicy="strict-origin-when-cross-origin"></iframe>
                        <p className="text-[10px] font-medium text-center text-google-textVariant mt-3 flex flex-wrap items-center justify-center gap-1"><Icon name="info" className="text-[13px]" /> Peta interaktif dari Google Maps.</p>
                    </div>

                    {infoDesa?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                <Icon name="border_outer" className="text-[16px] text-red-600" />
                                Batas Administrasi Desa
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                    <div key={arah} className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-2xl border border-slate-200/50">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-slate-500 mb-0.5">{arah}</p>
                                        <p className="font-medium text-[13px] text-google-text">{infoDesa.batas?.[arah] || '-'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                <Icon name="contact_phone" className="text-[16px] text-red-600" />
                                Kontak Penting Layanan Desa
                            </h3>
                            <div className="space-y-5">
                                {infoDesa.kontak?.map((k, i) => (
                                    <div key={k.id || i} className={`flex justify-between items-center bg-${k.color}-50/50 border border-${k.color}-500/10 px-4 py-3 rounded-2xl`}>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <Icon name={k.icon || 'contact_phone'} className={`text-[16px] text-${k.color}-600`} fill="true"/>
                                            <span className={`text-[12px] font-medium text-${k.color}-800`}>{k.nama}</span>
                                        </div>
                                        <span className={`text-[12px] font-medium text-${k.color}-700`}>{k.telepon}</span>
                                    </div>
                                ))}
                                {(!infoDesa.kontak || infoDesa.kontak.length === 0) && (
                                    <div className="text-center p-4 text-slate-500 text-sm">Belum ada kontak penting</div>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            );
        }

        function Blog({ blogData, setBlogData, userRole, identity, initialArticleId }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [formData, setFormData] = useState({ title: '', content: '', imageUrl: '', date: getLocalDate() });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [viewArticleId, setViewArticleId] = useState(initialArticleId || null);
            const [commentName, setCommentName] = useState('');
            const [commentText, setCommentText] = useState('');
            const [replyText, setReplyText] = useState('');
            const [replyToId, setReplyToId] = useState(null);

            useEffect(() => {
                if (initialArticleId) {
                    setViewArticleId(initialArticleId);
                }
            }, [initialArticleId]);

            const handleShareBlog = (article) => {
                const shareUrl = `${window.location.origin}${window.location.pathname}?page=blog&article=${article.id}`;
                const shareText = `Baca artikel menarik: *${article.title}* di Portal Warga RT Pakem!\n\nLink: ${shareUrl}`;
                
                if (navigator.share) {
                    navigator.share({
                        title: article.title,
                        text: `Baca artikel: ${article.title}`,
                        url: shareUrl
                    }).catch(() => {});
                } else {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        showToast('Tautan artikel berhasil disalin ke papan klip!');
                    }).catch(() => {
                        showToast('Gagal menyalin tautan.', 'error');
                    });
                }
            };

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.6);
                    setFormData({ ...formData, imageUrl: url });
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleSave = () => {
                if (!formData.title.trim() || !formData.content.trim()) return setErrorMsg('Judul dan Konten harus diisi!');
                const newArticle = {
                    id: editingId || Date.now().toString(),
                    ...formData,
                    likes: editingId ? (blogData.find(b => b.id === editingId)?.likes || 0) : 0,
                    comments: editingId ? (blogData.find(b => b.id === editingId)?.comments || []) : []
                };

                if (editingId) {
                    setBlogData(blogData.map(b => b.id === editingId ? newArticle : b));
                } else {
                    setBlogData([newArticle, ...blogData]);
                }
                setIsFormOpen(false); setEditingId(null); setFormData({ title: '', content: '', imageUrl: '', date: getLocalDate() });
            };

            const handleDelete = (id) => {
                setBlogData(blogData.filter(b => b.id !== id));
                setDeleteConfirmId(null);
                if (viewArticleId === id) setViewArticleId(null);
            };

            const handleLike = (id) => {
                setBlogData(blogData.map(b => {
                    if (b.id === id) {
                        return { ...b, likes: (b.likes || 0) + 1 };
                    }
                    return b;
                }));
            };

            const handleComment = (id) => {
                if (!commentName.trim() || !commentText.trim()) return setErrorMsg('Nama dan Komentar harus diisi!');
                const newComment = { id: Date.now().toString(), name: commentName, text: commentText, date: new Date().toISOString(), role: userRole === 'admin' ? 'Admin' : 'Warga' };
                setBlogData(blogData.map(b => {
                    if (b.id === id) {
                        return { ...b, comments: [...(b.comments || []), newComment] };
                    }
                    return b;
                }));
                setCommentText(''); setErrorMsg('');
            };

            const handleReply = (articleId, commentId) => {
                if (!replyText.trim()) return;
                const reply = { id: Date.now().toString(), text: replyText, date: new Date().toISOString(), role: 'Admin' };
                setBlogData(blogData.map(b => {
                    if (b.id === articleId) {
                        return {
                            ...b, comments: (b.comments || []).map(c => {
                                if (c.id === commentId) {
                                    return { ...c, replies: [...(c.replies || []), reply] };
                                }
                                return c;
                            })
                        };
                    }
                    return b;
                }));
                setReplyText(''); setReplyToId(null);
            };

            if (viewArticleId) {
                const article = blogData.find(b => b.id === viewArticleId);
                if (!article) return <div className="p-8 text-center">Artikel tidak ditemukan <button onClick={() => setViewArticleId(null)} className="text-google-blue underline ml-2">Kembali</button></div>;
                
                return (
                    <div className="space-y-8 tab-fade-in relative z-10 w-full animate-slide-up no-print">
                        <button onClick={() => { setViewArticleId(null); const url = new URL(window.location.href); url.searchParams.delete('page'); url.searchParams.delete('article'); window.history.replaceState({}, document.title, url.pathname + url.hash); }} className="bg-white border border-slate-200 text-google-text px-4 py-2 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm w-fit active:scale-95"><Icon name="arrow_back" /> Kembali</button>
                        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200">
                            {article.imageUrl && <img src={article.imageUrl} alt={article.title} className="w-full h-64 sm:h-80 object-cover" />}
                            <div className="p-6 sm:p-8">
                                <h2 className="text-2xl sm:text-3xl font-medium text-google-text mb-4 tracking-tight leading-tight">{article.title}</h2>
                                <div className="flex items-center gap-4 text-[12px] font-medium text-google-textVariant mb-8 pb-6 border-b border-slate-100">
                                    <span className="flex items-center gap-1.5"><Icon name="calendar_today" className="text-[14px]"/> {parseLocalDate(article.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}</span>
                                    <span className="flex items-center gap-1.5"><Icon name="person" className="text-[14px]"/> Ditulis oleh Admin</span>
                                </div>
                                <div className="prose prose-sm sm:prose-base max-w-none text-slate-700 leading-relaxed text-justify whitespace-pre-wrap">
                                    {article.content}
                                </div>
                                
                                <div className="mt-10 pt-6 border-t border-slate-100 flex items-center gap-3">
                                    <button onClick={() => handleLike(article.id)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors active:scale-95"><Icon name="favorite" fill="true" className="text-[20px]" /> <span className="font-medium">{article.likes || 0} Suka</span></button>
                                    <button onClick={() => handleShareBlog(article)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors active:scale-95"><Icon name="share" className="text-[20px]" /> <span className="font-medium">Bagikan</span></button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                            <h3 className="text-xl font-medium text-google-text mb-6">Komentar Warga ({article.comments?.length || 0})</h3>
                            
                            <div className="mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <h4 className="text-[13px] font-medium text-google-text mb-3">Tulis Komentar</h4>
                                <input type="text" value={commentName} onChange={e => setCommentName(e.target.value)} placeholder="Nama Anda (Misal: Budi RT 01)" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-[13px] mb-3 outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 transition-all" />
                                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Tulis pendapat atau pertanyaan Anda..." className="w-full bg-white border border-slate-200 p-3 rounded-xl text-[13px] mb-3 outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 transition-all resize-none h-24"></textarea>
                                {errorMsg && <p className="text-red-500 text-[12px] font-medium mb-3">{errorMsg}</p>}
                                <button onClick={() => handleComment(article.id)} className="bg-google-blue text-white px-5 py-2.5 rounded-full font-medium text-[13px] hover:bg-google-blueDark transition-colors active:scale-95 flex items-center gap-2"><Icon name="send" /> Kirim Komentar</button>
                            </div>

                            <div className="space-y-7">
                                {(article.comments || []).map(c => (
                                    <div key={c.id} className="bg-white border border-slate-100 p-5 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-medium">{c.name.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <p className="font-medium text-[14px] text-google-text">{c.name} {c.role === 'Admin' && <span className="bg-google-blueLight text-google-blueDark px-2 py-0.5 rounded-md text-[10px] ml-2">Admin</span>}</p>
                                                <p className="text-[11px] text-google-textVariant">{new Date(c.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric', hour: '2-digit', minute:'2-digit'})}</p>
                                            </div>
                                        </div>
                                        <p className="text-[13px] text-slate-700 mt-2 whitespace-pre-wrap">{c.text}</p>
                                        
                                        {(c.replies || []).map(r => (
                                            <div key={r.id} className="mt-3 ml-6 pl-4 border-l border-google-blue/30 bg-google-blueLight/30 p-3 rounded-r-[12px]">
                                                <p className="font-medium text-[12px] text-google-blueDark flex items-center gap-1.5"><Icon name="admin_panel_settings" className="text-[14px]" /> Balasan Admin</p>
                                                <p className="text-[13px] text-slate-700 mt-1 whitespace-pre-wrap">{r.text}</p>
                                            </div>
                                        ))}

                                        {userRole === 'admin' && replyToId !== c.id && (
                                            <button onClick={() => setReplyToId(c.id)} className="mt-3 text-[12px] font-medium text-google-blue flex items-center gap-1 hover:underline"><Icon name="reply" className="text-[14px]" /> Balas sebagai Admin</button>
                                        )}

                                        {replyToId === c.id && (
                                            <div className="mt-3 ml-6">
                                                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Tulis balasan..." className="w-full bg-white border border-slate-200 p-3 rounded-lg text-[12px] mb-2 outline-none focus:border-google-blue resize-none h-20"></textarea>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleReply(article.id, c.id)} className="bg-google-blue text-white px-4 py-2 rounded-full text-[11px] font-medium hover:bg-google-blueDark active:scale-95 transition-all">Kirim Balasan</button>
                                                    <button onClick={() => setReplyToId(null)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-full text-[11px] font-medium hover:bg-slate-300 active:scale-95 transition-all">Batal</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!article.comments || article.comments.length === 0) && <p className="text-[13px] text-center text-slate-500 py-6">Belum ada komentar. Jadilah yang pertama berkomentar!</p>}
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <>
                <div className="space-y-8 tab-fade-in relative z-10 w-full animate-slide-up no-print">
                    <div className="bg-google-yellow text-white p-8 sm:p-10 rounded-3xl border border-orange-600/20 shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 bg-white/20  px-3.5 py-1.5 rounded-full mb-4 border border-white/30 shadow-sm">
                                <Icon name="article" className="text-[14px] sm:text-[16px]" fill="true"/>
                                <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-widest">Warta Warga</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-medium mb-3 tracking-tight [text-shadow:_0_2px_10px_rgba(0,0,0,0.2)]">Blog & Artikel</h2>
                            <p className="text-[13px] sm:text-[14px] font-medium text-white/90 max-w-lg leading-relaxed">Berita, pengumuman, dan cerita menarik dari lingkungan kita.</p>
                        </div>
                        <Icon name="newspaper" className="absolute -bottom-6 -right-6 text-[140px] text-white opacity-20 transform -rotate-12" fill="true" />
                    </div>

                    {userRole === 'admin' && (
                        <div className="flex justify-end">
                            <button onClick={() => { setIsFormOpen(true); setEditingId(null); setFormData({ title: '', content: '', imageUrl: '', date: getLocalDate() }); }} className="bg-google-blue text-white px-5 py-3 rounded-full font-medium text-[13px] hover:bg-google-blueDark transition-colors active:scale-95 flex items-center gap-2 shadow-md"><Icon name="add" className="text-[18px]"/> Tulis Artikel Baru</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {blogData.map(article => (
                            <a href={`/?page=blog&article=${article.id}`} key={article.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-yellow/40 transition-all duration-300 group flex flex-col cursor-pointer" onClick={(e) => { e.preventDefault(); setViewArticleId(article.id); }}>
                                {article.imageUrl ? (
                                    <div className="w-full h-48 bg-slate-100 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300 z-10"></div>
                                        <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                ) : (
                                    <div className="w-full h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                                        <Icon name="article" className="text-[64px] text-slate-300" />
                                    </div>
                                )}
                                <div className="p-6 flex flex-col flex-1">
                                    <p className="text-[11px] font-medium text-google-textVariant mb-2 flex items-center gap-1.5"><Icon name="calendar_today" className="text-[13px]"/> {parseLocalDate(article.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p>
                                    <h3 className="font-medium text-[16px] text-google-text mb-3 line-clamp-2 leading-snug group-hover:text-google-blue transition-colors">{article.title}</h3>
                                    <p className="text-[13px] text-slate-500 line-clamp-3 flex-1 mb-4 leading-relaxed whitespace-pre-wrap">{article.content && article.content.length > 150 ? article.content.substring(0, 150) + '...' : article.content}</p>
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                                        <div className="flex gap-4">
                                            <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500"><Icon name="favorite" className="text-[14px]" /> {article.likes || 0}</span>
                                            <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500"><Icon name="chat_bubble" className="text-[14px]" /> {article.comments?.length || 0}</span>
                                        </div>
                                    </div>
                                    
                                    {userRole === 'admin' && (
                                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { setEditingId(article.id); setFormData({ title: article.title, content: article.content, imageUrl: article.imageUrl, date: article.date }); setIsFormOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95"><Icon name="edit" className="text-[14px]" /> Edit</button>
                                            <button onClick={() => setDeleteConfirmId(article.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95"><Icon name="delete" className="text-[14px]" /> Hapus</button>
                                        </div>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                    {blogData.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="article" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2">Belum Ada Artikel</h3><p className="text-google-textVariant font-medium text-[13px]">Artikel atau blog yang diterbitkan oleh Admin akan muncul di sini.</p></div>}
                </div>

                    {isFormOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto hide-scrollbar border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit Artikel' : 'Tulis Artikel Baru'}</h3>
                                <div className="space-y-7">
                                    <div><label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest block mb-2 ml-1">Judul Artikel</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue focus:shadow-md transition-all" placeholder="Tulis judul yang menarik..." /></div>
                                    <div><label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest block mb-2 ml-1">Isi Konten</label><textarea value={formData.content} onChange={e => {setFormData({...formData, content: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue focus:shadow-md transition-all h-48 resize-y" placeholder="Tulis cerita atau informasi lengkap di sini..."></textarea></div>
                                    <div>
                                        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest block mb-2 ml-1">Upload Gambar Cover (Opsional)</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="image" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.imageUrl ? "Gambar Siap" : "Pilih Gambar")}</p>
                                                <p className="text-[11px] text-google-textVariant truncate">{formData.imageUrl ? "Klik untuk mengganti gambar" : "Maksimal 10MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200"><img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" /></div>
                                            )}
                                        </div>
                                    </div>
                                    {errorMsg && <div className="bg-red-50 text-red-600 px-4 py-3.5 rounded-xl text-[12px] font-medium flex items-center gap-2 border border-red-200"><Icon name="error" /> {errorMsg}</div>}
                                </div>
                                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); }} className="w-1/3 bg-white text-google-text border border-slate-200 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all active:scale-95 shadow-sm">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="w-2/3 bg-google-blue text-white px-4 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"><Icon name="save" className="text-[16px]"/> Terbitkan</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 text-red-500"><Icon name="delete_forever" className="text-[48px]" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2">Hapus Artikel?</h3>
                                <p className="text-[13px] text-slate-500 mb-8 leading-relaxed">Artikel ini dan semua komentar di dalamnya akan dihapus secara permanen. Anda yakin?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-white border border-slate-200 text-google-text px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm">Batal</button>
                                    <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 bg-red-500 text-white border border-red-600 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-red-600 active:scale-95 transition-all shadow-md">Hapus Permanen</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            );
        }

        /* ================= COUNTDOWN TIMER COMPONENT ================= */
        function CountdownTimer({ deadline }) {
            const [timeLeft, setTimeLeft] = useState(null);

            useEffect(() => {
                if (!deadline) { setTimeLeft(null); return; }
                const calc = () => {
                    const diff = new Date(deadline) - new Date();
                    if (diff <= 0) { setTimeLeft({ expired: true }); return; }
                    const days = Math.floor(diff / 86400000);
                    const hours = Math.floor((diff % 86400000) / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    setTimeLeft({ days, hours, mins, secs, expired: false });
                };
                calc();
                const id = setInterval(calc, 1000);
                return () => clearInterval(id);
            }, [deadline]);

            if (!timeLeft) return null;

            if (timeLeft.expired) {
                return (
                    <div className="flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-medium px-3 py-1.5 rounded-full shadow-md">
                        <Icon name="timer_off" className="text-[13px]" fill="true" />
                        Pembelian Ditutup
                    </div>
                );
            }

            const urgent = timeLeft.days === 0;
            return (
                <div className={`flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-full shadow-md ${urgent ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-400 text-amber-950'}`}>
                    <Icon name="timer" className="text-[13px]" fill="true" />
                    {timeLeft.days > 0 && <span>{timeLeft.days}h </span>}
                    <span>{String(timeLeft.hours).padStart(2,'0')}:{String(timeLeft.mins).padStart(2,'0')}:{String(timeLeft.secs).padStart(2,'0')}</span>
                </div>
            );
        }

        /* ================= TIKET EVENTS / JALAN SANTAI COMPONENT ================= */
        function Tiket({ products = [], setProducts, orders = [], setOrders, userRole, isProductsLoaded = false }) {
            const [activeSubTab, setActiveSubTab] = useState(userRole === 'admin' ? 'orders' : 'shop');
            const [modalConfig, setModalConfig] = useState(null);
            const [sharingProduct, setSharingProduct] = useState(null);

            useEffect(() => {
                const params = new URLSearchParams(window.location.search);
                const productId = params.get('product');
                if (productId && products.length > 0) {
                    const prod = products.find(p => String(p.sku) === productId || String(p.id) === productId || ('TKT-' + String(p.id).substring(8)) === productId);
                    if (prod && prod.stock > 0) {
                        handleOpenBuyModal(prod);
                        // Hapus query params dari URL agar tidak memicu terus menerus
                        const newUrl = window.location.pathname + window.location.hash;
                        window.history.replaceState({}, document.title, newUrl);
                    }
                }
            }, [products]);

            const handleShareToSocial = (platform) => {
                if (!sharingProduct) return;
                const skuOrId = sharingProduct.sku || ('TKT-' + String(sharingProduct.id).substring(8));
                const shareUrl = `${window.location.origin}${window.location.pathname}?page=tiket&product=${skuOrId}`;
                
                // Teks pesan yang akan dibagikan
                const shareText = `Yuk beli tiket *${sharingProduct.name}* Jalan Santai RT Pakem!\nHarga: *${formatRp(sharingProduct.price)}*\nLokasi Pengambilan: *${sharingProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}*\n\nPesan online di sini: ${shareUrl}`;

                switch (platform) {
                    case 'whatsapp':
                        // PENTING: encodeURIComponent agar & dalam URL tidak dipotong oleh WhatsApp API
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
                        break;
                    case 'telegram':
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Yuk beli tiket ${sharingProduct.name} Jalan Santai RT Pakem!`)}`, '_blank');
                        break;
                    case 'facebook':
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                        break;
                    case 'twitter':
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Yuk beli tiket ${sharingProduct.name} Jalan Santai RT Pakem! ${shareUrl}`)}`, '_blank');
                        break;
                    case 'copy':
                        navigator.clipboard.writeText(shareUrl)
                            .then(() => {
                                showToast("Tautan berhasil disalin!");
                                setSharingProduct(null);
                            })
                            .catch(() => {
                                showToast("Gagal menyalin tautan.");
                            });
                        break;
                    default:
                        break;
                }
            };

            // Custom Confirm Dialog State
            const [confirmModal, setConfirmModal] = useState(null);

            // Warga State
            const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
            const [selectedProduct, setSelectedProduct] = useState(null);
            const [buyForm, setBuyForm] = useState({ name: '', quantity: 1, notes: '', deliveryMethod: 'pickup', deliveryDay: '', deliveryTime: '' });
            const [wargaError, setWargaError] = useState('');
            const [myTicketsSearch, setMyTicketsSearch] = useState('');
            const [buyersSearch, setBuyersSearch] = useState('');
            const [localSavedOrderIds, setLocalSavedOrderIds] = useState(() => {
                try {
                    const saved = localStorage.getItem('wargapakem_my_tickets');
                    return saved ? JSON.parse(saved) : [];
                } catch (e) {
                    return [];
                }
            });

            // Admin State
            const [isProductModalOpen, setIsProductModalOpen] = useState(false);
            const [editingProduct, setEditingProduct] = useState(null);
            const [productForm, setProductForm] = useState({ name: '', price: '', stock: '', description: '', imageUrl: '', pickupLocationName: '', pickupGeoUrl: '', deadline: '' });
            const [productError, setProductError] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [adminOrderFilter, setAdminOrderFilter] = useState('all');
            const [adminSearchQuery, setAdminSearchQuery] = useState('');
            // Inline edit nama pemesan (admin)
            const [editingBuyerName, setEditingBuyerName] = useState(null); // { orderId, value }
            // Track which product card has its description expanded
            const [expandedDescId, setExpandedDescId] = useState(null);

            const handleProductImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setProductError('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setProductError('Ukuran file maksimal 10MB!');
                setIsUploading(true); setProductError('');
                try {
                    const url = await uploadToGoogleDrive(file, 600, 0.6);
                    setProductForm(prev => ({ ...prev, imageUrl: url }));
                } catch (error) {
                    setProductError(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleSaveProduct = () => {
                if (!productForm.name || !productForm.price || productForm.stock === '') {
                    return setProductError("Nama Tiket, Harga, dan Stok wajib diisi!");
                }
                const price = Number(productForm.price);
                const stock = Number(productForm.stock);
                if (isNaN(price) || price < 0) return setProductError("Harga harus berupa angka positif!");
                if (isNaN(stock) || stock < 0) return setProductError("Stok harus berupa angka positif!");

                const productData = {
                    name: productForm.name,
                    price: price,
                    stock: stock,
                    description: productForm.description,
                    imageUrl: productForm.imageUrl,
                    pickupLocationName: productForm.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT',
                    pickupGeoUrl: productForm.pickupGeoUrl || 'https://maps.google.com',
                    deadline: productForm.deadline || ''
                };

                if (editingProduct) {
                    // Capture editingProduct.id to avoid stale closure
                    const editId = editingProduct.id;
                    const fallbackSku = editingProduct.sku || ('TKT-' + String(editId).substring(8));
                    setProducts(prev => (prev || []).map(p => p.id === editId ? { ...p, ...productData, sku: fallbackSku } : p));
                    setModalConfig({ message: 'Produk tiket berhasil diperbarui.' });
                } else {
                    const sku = 'TKT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                    const newProduct = { id: Date.now(), sku, sold: 0, ...productData };
                    setProducts(prev => [newProduct, ...(prev || [])]);
                    setModalConfig({ message: 'Produk tiket baru berhasil ditambahkan.' });
                }
                setIsProductModalOpen(false);
                setEditingProduct(null);
                setProductForm({ name: '', price: '', stock: '', description: '', imageUrl: '', pickupLocationName: '', pickupGeoUrl: '', deadline: '' });
            };

            const handleSaveBuyerName = (orderId) => {
                if (!editingBuyerName || editingBuyerName.orderId !== orderId) return;
                const newName = editingBuyerName.value.trim().toUpperCase();
                if (!newName) { setEditingBuyerName(null); return; }
                setOrders(prev => (prev || []).map(o => o.id === orderId ? { ...o, buyerName: newName } : o));
                setEditingBuyerName(null);
                showToast('Nama pemesan berhasil diperbarui.');
            };

            const handleEditProduct = (product) => {
                setEditingProduct(product);
                setProductForm({
                    name: product.name || '',
                    price: product.price || '',
                    stock: product.stock || 0,
                    description: product.description || '',
                    imageUrl: product.imageUrl || '',
                    pickupLocationName: product.pickupLocationName || '',
                    pickupGeoUrl: product.pickupGeoUrl || '',
                    deadline: product.deadline || ''
                });
                setProductError('');
                setIsProductModalOpen(true);
            };

            const handleDeleteProduct = (productId) => {
                setConfirmModal({
                    title: "Hapus Produk?",
                    message: "Yakin ingin menghapus produk tiket ini? Tindakan ini tidak bisa dibatalkan.",
                    confirmText: "Hapus",
                    onConfirm: () => {
                        setProducts(prev => prev.filter(p => p.id !== productId));
                        setModalConfig({ message: 'Produk tiket berhasil dihapus.' });
                        setConfirmModal(null);
                    }
                });
            };

            const handleResetSales = (productId) => {
                setConfirmModal({
                    title: "Reset Penjualan?",
                    message: "Yakin ingin mereset jumlah terjual menjadi 0 dan menghapus seluruh riwayat pesanan tiket ini? Tindakan ini tidak bisa dibatalkan.",
                    confirmText: "Reset",
                    onConfirm: () => {
                        // Reset product sold count
                        setProducts(prev => (prev || []).map(p => p.id === productId ? { ...p, sold: 0 } : p));
                        // Delete orders of this product
                        setOrders(prev => (prev || []).filter(o => o.productId !== productId));
                        setModalConfig({ message: 'Data penjualan berhasil di-reset.' });
                        setConfirmModal(null);
                        setIsProductModalOpen(false);
                    }
                });
            };


            // Order actions (Admin)
            const handleUpdateOrderStatus = (orderId, newStatus) => {
                // Snapshot current values to avoid stale closure
                const order = (orders || []).find(o => o.id === orderId);
                if (!order) return;
                // Guard: prevent re-cancellation
                if (order.status === newStatus) return;

                // Restock & un-sold if transitioning TO cancelled
                if (newStatus === 'cancelled' && order.status !== 'cancelled') {
                    setProducts(prev => (prev || []).map(p => {
                        if (p.id === order.productId) {
                            return { ...p, stock: p.stock + order.quantity, sold: Math.max(0, (p.sold || 0) - order.quantity) };
                        }
                        return p;
                    }));
                }
                // If reverting FROM cancelled back to active - deduct stock again
                if (order.status === 'cancelled' && newStatus !== 'cancelled') {
                    setProducts(prev => (prev || []).map(p => {
                        if (p.id === order.productId) {
                            return { ...p, stock: Math.max(0, p.stock - order.quantity), sold: (p.sold || 0) + order.quantity };
                        }
                        return p;
                    }));
                }

                setOrders(prev => (prev || []).map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                showToast(`Status pesanan diubah ke: ${getStatusLabel(newStatus)}`);
            };

            const getStatusLabel = (status) => {
                switch(status) {
                    case 'pending': return 'Menunggu Konfirmasi';
                    case 'processed': return 'Diproses';
                    case 'completed': return 'Selesai';
                    case 'cancelled': return 'Dibatalkan';
                    default: return status;
                }
            };

            const getStatusColor = (status) => {
                switch(status) {
                    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40';
                    case 'processed': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40';
                    case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40';
                    case 'cancelled': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40';
                    default: return 'bg-slate-50 text-slate-700 border-slate-200';
                }
            };

            // Order placing (Warga)
            const handleOpenBuyModal = (product) => {
                setSelectedProduct(product);
                setBuyForm({
                    name: '',
                    quantity: 1,
                    notes: '',
                    deliveryMethod: 'pickup',
                    deliveryDay: '',
                    deliveryTime: ''
                });
                setWargaError('');
                setIsBuyModalOpen(true);
            };

            const handlePlaceOrder = () => {
                if (!buyForm.name.trim()) return setWargaError("Nama lengkap wajib diisi!");
                const qty = Number(buyForm.quantity);
                if (isNaN(qty) || qty < 1) return setWargaError("Jumlah pembelian minimal 1 tiket!");
                if (qty > selectedProduct.stock) return setWargaError(`Stok tidak mencukupi! Hanya tersisa ${selectedProduct.stock} tiket.`);
                if (buyForm.deliveryMethod === 'delivery') {
                    if (!buyForm.deliveryDay.trim()) return setWargaError("Hari pengantaran wajib diisi!");
                    if (!buyForm.deliveryTime.trim()) return setWargaError("Jam pengantaran wajib diisi!");
                }

                const newOrder = {
                    id: Date.now(),
                    productId: selectedProduct.id,
                    productName: selectedProduct.name,
                    buyerName: buyForm.name.trim(),
                    quantity: qty,
                    totalPrice: qty * selectedProduct.price,
                    notes: buyForm.notes.trim(),
                    pickupLocation: selectedProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT',
                    pickupGeoUrl: selectedProduct.pickupGeoUrl || 'https://maps.google.com',
                    deliveryMethod: buyForm.deliveryMethod,
                    deliveryDay: buyForm.deliveryMethod === 'delivery' ? buyForm.deliveryDay.trim() : '',
                    deliveryTime: buyForm.deliveryMethod === 'delivery' ? buyForm.deliveryTime.trim() : '',
                    status: 'pending',
                    timestamp: getLocalDate()
                };

                // Deduct stock - functional update avoids stale closure
                const targetProductId = selectedProduct.id;
                setProducts(prev => (prev || []).map(p => {
                    if (p.id === targetProductId) {
                        return { ...p, stock: Math.max(0, p.stock - qty), sold: (p.sold || 0) + qty };
                    }
                    return p;
                }));

                // Add order - functional update
                setOrders(prev => [newOrder, ...(prev || [])]);

                // Save locally - functional update
                setLocalSavedOrderIds(prev => {
                    const newLocalIds = [newOrder.id, ...(prev || [])];
                    try {
                        localStorage.setItem('wargapakem_my_tickets', JSON.stringify(newLocalIds));
                    } catch(e) {}
                    return newLocalIds;
                });

                setIsBuyModalOpen(false);
                setModalConfig({ message: 'Pesanan tiket Anda berhasil diajukan! Pembayaran dilakukan secara COD.' });
            };

            const handleCancelOrderByWarga = (order) => {
                if (!order || order.status === 'cancelled') return;
                // Return stock - functional update
                setProducts(prev => (prev || []).map(p => {
                    if (p.id === order.productId) {
                        return { ...p, stock: p.stock + order.quantity, sold: Math.max(0, (p.sold || 0) - order.quantity) };
                    }
                    return p;
                }));
                // Update order status - functional update
                setOrders(prev => (prev || []).map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o));
                showToast("Pesanan berhasil dibatalkan.");
            };

            const handleDeleteOrderLog = (orderId) => {
                setConfirmModal({
                    title: "Hapus Log Pesanan?",
                    message: "Yakin ingin menghapus riwayat/log pesanan ini dari sistem secara permanen?",
                    confirmText: "Hapus",
                    onConfirm: () => {
                        setOrders(prev => (prev || []).filter(o => o.id !== orderId));
                        setLocalSavedOrderIds(prev => {
                            const newLocalIds = (prev || []).filter(id => id !== orderId);
                            try {
                                localStorage.setItem('wargapakem_my_tickets', JSON.stringify(newLocalIds));
                            } catch(e) {}
                            return newLocalIds;
                        });
                        showToast("Riwayat pesanan berhasil dihapus.");
                        setConfirmModal(null);
                    }
                });
            };

            // Filters
            const filteredOrders = (orders || []).filter(o => {
                if (!o || !o.id) return false;
                const matchStatus = adminOrderFilter === 'all' || o.status === adminOrderFilter;
                const buyerName = (o.buyerName || '').toLowerCase();
                const productName = (o.productName || '').toLowerCase();
                const query = adminSearchQuery.toLowerCase();
                const matchSearch = buyerName.includes(query) || productName.includes(query);
                return matchStatus && matchSearch;
            });

            const myTicketsFiltered = (orders || []).filter(o => {
                if (!o || !o.id) return false;
                const isMyOrder = localSavedOrderIds.includes(o.id);
                const buyerName = (o.buyerName || '').toLowerCase();
                const isSearchMatch = myTicketsSearch ? buyerName.includes(myTicketsSearch.toLowerCase()) : false;
                return isMyOrder || isSearchMatch;
            });

            // Daftar Pembeli (semua order non-cancelled, diurutkan terbaru)
            const buyersList = (orders || []).filter(o => o && o.id && o.status !== 'cancelled');
            const buyersTotalTickets = buyersList.reduce((sum, o) => sum + (o.quantity || 0), 0);
            const buyersListFiltered = buyersSearch
                ? buyersList.filter(o => (o.buyerName || '').toLowerCase().includes(buyersSearch.toLowerCase()))
                : buyersList;

            // Filter produk aktif dan arsip
            const activeProducts = (products || []).filter(p => !p.archived && !(p.deadline && new Date(p.deadline) <= new Date()));
            const archivedProducts = (products || []).filter(p => p.archived || (p.deadline && new Date(p.deadline) <= new Date()));


            // Statistics (Admin)
            const stats = useMemo(() => {
                let totalSold = 0;
                let revenue = 0;
                let pendingCount = 0;

                (orders || []).forEach(o => {
                    if (o.status !== 'cancelled') {
                        totalSold += o.quantity;
                        if (o.status === 'completed' || o.status === 'processed') {
                            revenue += o.totalPrice;
                        }
                    }
                    if (o.status === 'pending') {
                        pendingCount++;
                    }
                });

                return { totalSold, revenue, pendingCount };
            }, [orders]);

            return (
                <div className="animate-fade-in pb-24 w-full">
                    {modalConfig && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-8 max-w-sm w-full text-center modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check_circle" className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 mb-2">Berhasil</h3>
                                <p className="text-slate-650 font-medium mb-8 text-[13px]">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-google-blue hover:bg-google-blueDark text-white font-medium py-3.5 rounded-full transition-all">Tutup</button>
                            </div>
                        </div>
                    )}

                    {userRole === 'admin' ? (
                        /* ================== VIEW ADMIN ================== */
                        <div className="space-y-8">
                            {/* Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-google-blueLight border border-google-blue/30 text-google-blueDark flex items-center justify-center shrink-0"><Icon name="trending_up" className="text-[24px]" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Total Tiket Terjual</p>
                                        <h4 className="text-xl font-medium text-slate-800">{stats.totalSold} <span className="text-[11px] font-medium text-slate-500">Tiket</span></h4>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-500 flex items-center justify-center shrink-0"><Icon name="payments" className="text-[24px]" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Total Pendapatan</p>
                                        <h4 className="text-xl font-medium text-slate-800">{formatRp(stats.revenue)}</h4>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-205 text-amber-500 flex items-center justify-center shrink-0"><Icon name="schedule" className="text-[24px]" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Pesanan Pending</p>
                                        <h4 className="text-xl font-medium text-slate-800">{stats.pendingCount} <span className="text-[11px] font-medium text-slate-500">Pesanan</span></h4>
                                    </div>
                                </div>
                            </div>

                            {/* Sub Navigation */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                                <div className="flex gap-2">
                                    <button onClick={() => setActiveSubTab('orders')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-2 ${activeSubTab === 'orders' ? 'bg-slate-850 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon name="receipt_long" /> Pesanan Masuk</button>
                                    <button onClick={() => setActiveSubTab('products')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-2 ${activeSubTab === 'products' ? 'bg-slate-850 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon name="inventory_2" /> Kelola Produk</button>
                                </div>
                                {activeSubTab === 'products' && (
                                    <button onClick={() => { setEditingProduct(null); setProductForm({ name: '', price: '', stock: '', description: '', imageUrl: '', pickupLocationName: '', pickupGeoUrl: '' }); setProductError(''); setIsProductModalOpen(true); }} className="bg-google-blue hover:bg-google-blueDark text-white px-4 py-2.5 rounded-full font-medium text-[12px] shadow-md hover:shadow-lg transition-all flex items-center gap-2"><Icon name="add" /> Tambah Produk Tiket</button>
                                )}
                            </div>

                            {/* Panel Pesanan */}
                            {activeSubTab === 'orders' && (
                                <div className="space-y-7">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 relative">
                                            <input type="text" placeholder="Cari nama pembeli atau tiket..." value={adminSearchQuery} onChange={e => setAdminSearchQuery(e.target.value)} style={{ paddingLeft: '1.25rem' }} className="w-full bg-white border border-slate-200 pr-5 py-3 rounded-2xl text-[13px] font-medium outline-none focus:border-google-blue/40" />
                                        </div>
                                        <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 shrink-0">
                                            {['all', 'pending', 'processed', 'completed', 'cancelled'].map(status => (
                                                <button key={status} onClick={() => setAdminOrderFilter(status)} className={`px-4 py-2.5 rounded-full text-[11px] font-medium border transition-all capitalize whitespace-nowrap ${adminOrderFilter === status ? 'bg-google-blueLight text-google-blueDark border-google-blue/30' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{status === 'all' ? 'Semua' : getStatusLabel(status)}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {filteredOrders.length === 0 ? (
                                        <div className="bg-white border border-slate-200 p-12 text-center rounded-3xl"><div className="w-16 h-16 bg-slate-50 border border-slate-200 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400"><Icon name="receipt" className="text-[28px]" /></div><p className="text-[13px] font-medium text-slate-800">Tidak ada pesanan ditemukan.</p></div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {filteredOrders.map(order => (
                                                <div key={order.id} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-7 hover:shadow-md transition-shadow">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8.5 h-8.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                                    <Icon name="receipt_long" className="text-[17px]" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">ID Pesanan</p>
                                                                    <p className="text-[12px] font-medium text-slate-700">#TKT-{String(order.id).slice(-6)}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-medium px-3.5 py-2 rounded-lg border ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                                                        </div>

                                                        <div className="bg-slate-50 rounded-xl p-5 sm:p-6 border border-slate-100 space-y-6">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1">
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Pemesan</p>
                                                                    {/* Nama Pemesan - inline edit oleh admin */}
                                                                    {editingBuyerName && editingBuyerName.orderId === order.id ? (
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <input
                                                                                autoFocus
                                                                                type="text"
                                                                                value={editingBuyerName.value}
                                                                                onChange={e => setEditingBuyerName({ orderId: order.id, value: e.target.value.toUpperCase() })}
                                                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveBuyerName(order.id); if (e.key === 'Escape') setEditingBuyerName(null); }}
                                                                                className="flex-1 bg-amber-50 border border-amber-400 rounded-lg px-3 py-1.5 text-[14px] font-medium text-slate-800 uppercase outline-none focus:shadow-md tracking-wide"
                                                                            />
                                                                            <button onClick={() => handleSaveBuyerName(order.id)} className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors" title="Simpan">
                                                                                <Icon name="check" className="text-[14px]" />
                                                                            </button>
                                                                            <button onClick={() => setEditingBuyerName(null)} className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center shrink-0 transition-colors" title="Batal">
                                                                                <Icon name="close" className="text-[14px]" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 group mt-0.5">
                                                                            <h4 className="font-medium text-[15px] text-slate-800 uppercase tracking-wide">{order.buyerName}</h4>
                                                                            <button
                                                                                onClick={() => setEditingBuyerName({ orderId: order.id, value: order.buyerName })}
                                                                                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0 transition-all"
                                                                                title="Edit nama pemesan"
                                                                            >
                                                                                <Icon name="edit" className="text-[12px]" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-right ml-2 shrink-0">
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Total</p>
                                                                    <p className="text-[14px] font-medium text-rose-600">{formatRp(order.totalPrice)}</p>
                                                                </div>
                                                            </div>

                                                            <div className="pt-2 border-t border-slate-200">
                                                                <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Rincian Tiket</p>
                                                                <p className="text-[12.5px] font-medium text-slate-700">{order.productName} <span className="text-slate-500 font-medium">x{order.quantity} Pcs</span></p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-6 space-y-3.5">
                                                            {order.deliveryMethod === 'delivery' ? (
                                                                <div className="flex items-start gap-3.5 text-[11.5px] text-slate-600 font-medium bg-white p-4.5 rounded-xl border border-slate-200">
                                                                    <div className="w-6.5 h-6.5 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="local_shipping" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Diantar ke Rumah</span>
                                                                        <p className="text-[11px] text-slate-500 mt-1">Waktu: {order.deliveryDay || '-'}, {order.deliveryTime || '-'}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-start gap-3.5 text-[11.5px] text-slate-600 font-medium bg-white p-4.5 rounded-xl border border-slate-200">
                                                                    <div className="w-6.5 h-6.5 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="location_on" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Ambil Sendiri</span>
                                                                        <p className="text-[11px] text-slate-500 mt-1">{order.pickupLocation || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                                                        {order.pickupGeoUrl && (
                                                                            <a href={order.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 text-rose-600 hover:underline inline-flex items-center gap-1 font-medium"><Icon name="map" className="text-[11px]" /> Buka Peta</a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {order.notes && (
                                                                <div className="flex items-start gap-3 text-[11.5px] text-slate-600 font-medium bg-amber-50 p-4.5 rounded-xl border border-amber-100">
                                                                    <Icon name="chat_bubble" className="text-[14px] mt-0.5 shrink-0 text-amber-500" />
                                                                    <span><span className="font-medium text-slate-800">Catatan:</span> {order.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between mt-6">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                                                <Icon name="event" className="text-[13px]" /> {order.timestamp}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    {order.status !== 'completed' && order.status !== 'cancelled' ? (
                                                        <div className="flex gap-2 border-t border-slate-200 pt-5 mt-4">
                                                            {order.status === 'pending' && (
                                                                <button onClick={() => handleUpdateOrderStatus(order.id, 'processed')} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="task_alt" className="text-[14px]" /> Terima & Proses</button>
                                                            )}
                                                            {order.status === 'processed' && (
                                                                <button onClick={() => handleUpdateOrderStatus(order.id, 'completed')} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="check" className="text-[14px]" /> Selesai</button>
                                                            )}
                                                            <button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="cancel" className="text-[14px]" /> Tolak / Batalkan</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 border-t border-slate-200 pt-5 mt-4">
                                                            <button onClick={() => handleDeleteOrderLog(order.id)} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="delete" className="text-[14px]" /> Hapus Log Pesanan</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Panel Kelola Produk */}
                            {activeSubTab === 'products' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                    {products.map(prod => (
                                        <div key={prod.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                                            <div className="relative h-44 bg-slate-100 flex items-center justify-center border-b border-slate-200">
                                                {prod.imageUrl ? (
                                                    <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-slate-400 flex flex-col items-center"><Icon name="local_activity" className="text-[48px] mb-2" /><span className="text-[11px] font-medium">Tidak ada foto</span></div>
                                                )}
                                                <div className="absolute top-3 right-3 bg-slate-900/75 text-white text-[10px] font-medium px-3 py-1.5 rounded-full ">Stok: {prod.stock}</div>
                                            </div>
                                            <div className="p-5 flex-1 flex flex-col justify-between space-y-6">
                                                <div>
                                                    <h4 className="font-medium text-[15px] text-slate-800 line-clamp-1">{prod.name}</h4>
                                                    <p className="text-[12px] font-medium text-google-blue mt-1">{formatRp(prod.price)}</p>
                                                    <p className={`text-[11.5px] font-medium text-slate-500 mt-2 leading-relaxed ${expandedDescId === prod.id ? '' : 'line-clamp-3'}`}>{prod.description || 'Tidak ada deskripsi.'}</p>
                                                    {(prod.description || '').length > 80 && (
                                                        <button onClick={() => setExpandedDescId(expandedDescId === prod.id ? null : prod.id)} className="mt-1 text-[10.5px] font-medium text-google-blue hover:underline">
                                                            {expandedDescId === prod.id ? '↑ Tutup' : '↓ Selengkapnya'}
                                                        </button>
                                                    )}
                                                    
                                                    <div className="mt-3 space-y-1.5">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg w-fit border border-slate-200"><Icon name="shopping_bag" className="text-[13px]" /> Terjual: {prod.sold || 0} Pcs</div>
                                                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500"><Icon name="location_on" className="text-[13px] text-google-blue" /> {prod.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 pt-3 border-t border-slate-100 mt-1">
                                                    <button onClick={() => handleEditProduct(prod)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95"><Icon name="edit" className="text-[14px]" /> Edit</button>
                                                    <button onClick={() => setSharingProduct(prod)} className="flex items-center justify-center px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-full py-2 transition-all active:scale-95 shadow-sm" title="Bagikan"><Icon name="share" className="text-[14px]" /></button>
                                                    <button onClick={() => handleDeleteProduct(prod.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95"><Icon name="delete" className="text-[14px]" /> Hapus</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Modal Kelola Produk */}
                            {isProductModalOpen && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                                    <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                        <h3 className="text-xl font-medium text-slate-800 mb-6 tracking-tight">{editingProduct ? 'Edit Produk Tiket' : 'Tambah Produk Tiket Baru'}</h3>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Nama Tiket / Produk</label>
                                                <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Tiket Jalan Santai RT Pakem" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Harga (Rp)</label>
                                                    <input type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: 5000" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Stok Tiket</label>
                                                    <input type="number" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: 100" />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Nama Lokasi Pengambilan</label>
                                                    <input type="text" value={productForm.pickupLocationName} onChange={e => setProductForm({...productForm, pickupLocationName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Rumah Mas Novan / Rumah Pak RT" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Link Google Maps Lokasi</label>
                                                    <input type="text" value={productForm.pickupGeoUrl} onChange={e => setProductForm({...productForm, pickupGeoUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: https://maps.google.com/..." />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Deskripsi Tiket</label>
                                                <textarea value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all h-24 resize-none" placeholder="Tuliskan info doorprize, aturan, jadwal, dll..."></textarea>
                                            </div>
                                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                                                <label className="text-[10px] font-medium text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Icon name="timer" className="text-[14px]" fill="true" /> Batas Waktu Pembelian (Deadline)
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={productForm.deadline}
                                                    onChange={e => setProductForm({...productForm, deadline: e.target.value})}
                                                    className="w-full bg-white border border-rose-300 p-3.5 text-[13px] font-medium outline-none rounded-xl focus:border-rose-400 focus:shadow-sm transition-all"
                                                />
                                                <p className="text-[10.5px] text-rose-400 font-medium flex items-start gap-1">
                                                    <Icon name="info" className="text-[12px] shrink-0 mt-0.5" /> Setelah waktu ini terlewati, tombol beli akan otomatis dikunci. Kosongkan jika tidak ada batas waktu.
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Upload Foto Cover (Opsional)</label>
                                                <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                                    <input type="file" accept="image/*" onChange={handleProductImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                                    <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                        {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="image" className="text-[20px]" />}
                                                    </div>
                                                    <div className="relative z-0 flex-1 min-w-0">
                                                        <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (productForm.imageUrl ? "Gambar Siap" : "Pilih Gambar")}</p>
                                                        <p className="text-[11px] text-google-textVariant truncate">{productForm.imageUrl ? "Klik untuk mengganti" : "Maksimal 10MB"}</p>
                                                    </div>
                                                    {productForm.imageUrl && !isUploading && (
                                                        <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200"><img src={productForm.imageUrl} alt="Preview" className="w-full h-full object-cover" /></div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Arsipkan Event Checkbox */}
                                            <div className="pt-2">
                                                <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-200 p-3.5 rounded-2xl hover:bg-slate-100 transition-all select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!productForm.archived}
                                                        onChange={e => setProductForm({...productForm, archived: e.target.checked})}
                                                        className="w-4.5 h-4.5 text-google-blue rounded border-slate-200 focus:ring-google-blue"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="text-[12.5px] font-medium text-slate-800">Arsipkan Event ini</span>
                                                        <p className="text-[10px] text-slate-500 font-medium leading-tight">Pindahkan event ini dari daftar aktif ke riwayat arsip event</p>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* Reset Data Penjualan (Hanya untuk Edit) */}
                                            {editingProduct && (
                                                <div className="pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResetSales(editingProduct.id)}
                                                        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 py-3 rounded-full text-[11.5px] font-medium transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <Icon name="restart_alt" className="text-[16px]" />
                                                        Reset Penjualan & Pembelian (Hapus Riwayat)
                                                    </button>
                                                    <p className="text-[9px] text-slate-400 font-medium ml-1 mt-1 flex items-start gap-1">
                                                        <Icon name="warning" className="text-[11px] text-amber-500 shrink-0" />
                                                        PENTING: Seluruh pesanan masuk (order) untuk produk ini akan dihapus permanen dari sistem.
                                                    </p>
                                                </div>
                                            )}

                                            {productError && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[12px] font-medium border border-red-200 flex items-center gap-2"><Icon name="error" /> {productError}</div>}
                                        </div>
                                        <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                                            <button onClick={() => setIsProductModalOpen(false)} className="w-1/3 bg-white text-slate-700 border border-slate-200 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all shadow-sm">Batal</button>
                                            <button onClick={handleSaveProduct} disabled={isUploading} className="w-2/3 bg-google-blue text-white px-4 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark transition-all flex items-center justify-center gap-2"><Icon name="save" className="text-[16px]"/> Simpan Produk</button>
                                        </div>

                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ================== VIEW WARGA ================== */
                        <div className="space-y-8">
                            {/* Banner Header */}
                            <div className="bg-google-blue rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
                                <div className="absolute inset-0 bg-black/10"></div>
                                <div className="relative z-10">
                                    <span className="bg-white/25  px-3 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase border border-white/20">EVENT RT PAKEM</span>
                                    <h2 className="text-2xl sm:text-3xl font-medium mt-3 tracking-tight">Katalog Tiket Jalan Santai</h2>
                                    <p className="text-[12px] sm:text-[13px] text-white/95 mt-1.5 max-w-xl leading-relaxed font-medium">
                                        Beli tiket jalan santai Anda secara online di sini! Silakan lakukan pembayaran di tempat (COD) langsung saat mengambil tiket di lokasi pengambilan yang telah ditentukan.
                                    </p>
                                </div>
                            </div>

                            {/* Warga Sub Tabs */}
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-3xl shadow-sm flex gap-2 overflow-x-auto scrollbar-none whitespace-nowrap items-center">
                                <button onClick={() => setActiveSubTab('shop')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeSubTab === 'shop' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="shopping_bag" className="text-[15px]" />
                                    <span>Beli Tiket</span>
                                </button>
                                <button onClick={() => setActiveSubTab('my_tickets')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 relative whitespace-nowrap shrink-0 ${activeSubTab === 'my_tickets' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="confirmation_number" className="text-[15px]" />
                                    <span>Tiket Saya</span>
                                    {myTicketsFiltered.length > 0 && <span className="bg-rose-500 text-white text-[8.5px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-1 leading-none">{myTicketsFiltered.length}</span>}
                                </button>
                                <button onClick={() => setActiveSubTab('buyers_list')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 relative whitespace-nowrap shrink-0 ${activeSubTab === 'buyers_list' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="groups" className="text-[15px]" />
                                    <span>Daftar Pembeli</span>
                                    {buyersList.length > 0 && <span className="bg-rose-500 text-white text-[8.5px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-1 leading-none">{buyersList.length}</span>}
                                </button>
                                <button onClick={() => setActiveSubTab('archive')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeSubTab === 'archive' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="archive" className="text-[15px]" />
                                    <span>Arsip Event</span>
                                </button>
                            </div>






                            {/* Sub Tab: Beli Tiket */}
                            {activeSubTab === 'shop' && (
                                activeProducts.length === 0 ? (
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center rounded-3xl">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400">
                                            <Icon name="local_activity" className="text-[28px]" />
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">Tidak ada event tiket aktif saat ini.</p>
                                        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Silakan kunjungi tab "Arsip Event" untuk melihat riwayat event sebelumnya.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {activeProducts.map(prod => (
                                            <div key={prod.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/85 dark:border-slate-800/85 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                                                {/* Image Cover with Aspect-Ratio and overlays */}
                                                <div className="relative w-full h-48 sm:h-52 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-b border-slate-200/80 dark:border-slate-850">
                                                    {prod.imageUrl ? (
                                                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
                                                            <div className="w-14 h-14 rounded-2xl bg-google-blue text-white flex items-center justify-center shadow-md mb-2">
                                                                <Icon name="local_activity" className="text-[26px]" />
                                                            </div>
                                                            <span className="text-[10px] font-medium uppercase tracking-widest text-google-blue dark:text-google-blueLight">Tiket Jalan Santai</span>
                                                        </div>
                                                    )}
                                                    {/* Official Store Badge - top left */}
                                                    <div className="absolute top-3.5 left-3.5 flex items-center gap-1 bg-google-yellow text-white text-[9px] font-medium px-2.5 py-1 rounded-lg shadow-md shadow-amber-500/20  border border-white/20 tracking-wide">
                                                        <Icon name="verified" className="text-[12px]" fill="true" />
                                                        OFFICIAL
                                                    </div>
                                                    {/* Stock Pill - top right */}
                                                    <div className={`absolute top-3.5 right-3.5 text-[9.5px] font-medium px-2.5 py-1 rounded-lg  shadow-md border ${prod.stock > 0 ? 'bg-slate-900/75 dark:bg-slate-950/75 text-white border-white/10' : 'bg-red-500/90 text-white border-red-400/20'}`}>
                                                        {prod.stock > 0 ? `Stok: ${prod.stock}` : 'Stok Habis'}
                                                    </div>
                                                    {/* Countdown Timer overlay - bottom right */}
                                                    {prod.deadline && (
                                                        <div className="absolute bottom-3 right-3 z-10 scale-90 origin-bottom-right">
                                                            <CountdownTimer deadline={prod.deadline} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Details */}
                                                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                                                    <div className="space-y-5">
                                                        <p className="text-[10.5px] font-medium text-google-blue mb-[-4px] uppercase tracking-wider">SKU: {prod.sku || ('TKT-' + String(prod.id).substring(8))}</p>
                                                        <h4 className="font-medium text-[15px] text-slate-800 dark:text-slate-100 tracking-tight leading-snug line-clamp-1">{prod.name}</h4>
                                                        
                                                        {/* Price and Sold Row */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-base sm:text-lg font-medium text-rose-550 dark:text-rose-450">{formatRp(prod.price)}</span>
                                                            {(prod.sold || 0) > 0 && (
                                                                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-medium px-2.5 py-1 rounded-lg">
                                                                    <Icon name="trending_up" className="text-[11px]" />
                                                                    {prod.sold} Terjual
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Batas Pembelian Box */}
                                                        {prod.deadline && (() => {
                                                            const isExp = new Date(prod.deadline) <= new Date();
                                                            return (
                                                                <div className={`text-[10.5px] font-medium flex items-center gap-1.5 p-2.5 rounded-lg border ${isExp ? 'bg-rose-50/50 border-rose-100 text-rose-600 dark:bg-rose-950/10 dark:border-rose-900/30' : 'bg-amber-50/50 border-amber-100 text-amber-600 dark:bg-amber-950/10 dark:border-amber-900/30'}`}>
                                                                    <Icon name={isExp ? 'timer_off' : 'event'} className="text-[14px]" />
                                                                    <span>{isExp ? 'Pembelian telah ditutup' : `Batas pembelian: ${new Date(prod.deadline).toLocaleString('id-ID', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}`}</span>
                                                                </div>
                                                            );
                                                        })()}

                                                        <p className={`text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed ${expandedDescId === prod.id ? '' : 'line-clamp-2'}`}>{prod.description || 'Tidak ada deskripsi.'}</p>
                                                        {(prod.description || '').length > 80 && (
                                                            <button onClick={() => setExpandedDescId(expandedDescId === prod.id ? null : prod.id)} className="mt-1 text-[10.5px] font-medium text-google-blue dark:text-blue-400 hover:underline flex items-center gap-0.5">
                                                                <Icon name={expandedDescId === prod.id ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                                                                {expandedDescId === prod.id ? 'Tutup' : 'Selengkapnya'}
                                                            </button>
                                                        )}
                                                        
                                                        {/* Pickup Location Box */}
                                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl">
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-550 dark:text-rose-450 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
                                                                    <Icon name="location_on" className="text-[16px]" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[8px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lokasi Pengambilan</p>
                                                                    <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300 truncate leading-tight mt-0.5">{prod.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                                                </div>
                                                            </div>
                                                            {prod.pickupGeoUrl && (
                                                                <a href={prod.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-google-blueLight hover:bg-google-blueLight/85 text-google-blueDark dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0 border border-google-blue/20 dark:border-blue-900/30 transition-all hover:scale-105" title="Buka Google Maps">
                                                                    <Icon name="map" className="text-[14px]" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    {(() => {
                                                        const isDeadlinePassed = prod.deadline && new Date(prod.deadline) <= new Date();
                                                        const canBuy = prod.stock > 0 && !isDeadlinePassed;
                                                        return (
                                                            <div className="flex gap-2.5 pt-2">
                                                                <button
                                                                    onClick={() => handleOpenBuyModal(prod)}
                                                                    disabled={!canBuy}
                                                                    className={`flex-1 py-3 rounded-full font-medium text-[12.5px] transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md ${canBuy ? 'bg-google-blue hover:bg-google-blueDark text-white shadow-google-blue/15' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'}`}
                                                                >
                                                                    <Icon name={isDeadlinePassed ? 'timer_off' : 'add_shopping_cart'} className="text-[16px]" />
                                                                    {isDeadlinePassed ? 'Pembelian Ditutup' : prod.stock > 0 ? 'Beli Tiket Sekarang' : 'Stok Habis'}
                                                                </button>
                                                                <button onClick={() => setSharingProduct(prod)} className="w-11 h-11 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-850 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-750 rounded-full transition-all flex items-center justify-center active:scale-95" title="Bagikan">
                                                                    <Icon name="share" className="text-[16px]" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {/* Sub Tab: Arsip Event */}
                            {activeSubTab === 'archive' && (
                                archivedProducts.length === 0 ? (
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center rounded-3xl">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400">
                                            <Icon name="archive" className="text-[28px]" />
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">Tidak ada arsip event saat ini.</p>
                                        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Seluruh event yang telah selesai atau diarsipkan akan muncul di sini sebagai riwayat kegiatan.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {archivedProducts.map(prod => (
                                            <div key={prod.id} className="bg-slate-50/50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/85 dark:border-slate-800/85 shadow-sm overflow-hidden flex flex-col justify-between opacity-90 hover:opacity-100 transition-all duration-300">
                                                {/* Image Cover with Aspect-Ratio and overlays */}
                                                <div className="relative w-full h-48 sm:h-52 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-b border-slate-200/80 dark:border-slate-850 grayscale">
                                                    {prod.imageUrl ? (
                                                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-850 flex flex-col items-center justify-center p-6 text-center">
                                                            <div className="w-14 h-14 rounded-2xl bg-slate-300 dark:bg-slate-700 text-slate-550 dark:text-slate-400 flex items-center justify-center shadow-md mb-2">
                                                                <Icon name="local_activity" className="text-[26px]" />
                                                            </div>
                                                            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-450 dark:text-slate-500">Tiket Jalan Santai</span>
                                                        </div>
                                                    )}
                                                    {/* Archive Badge - top left */}
                                                    <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 bg-slate-700/90 text-white text-[9px] font-medium px-2.5 py-1 rounded-lg shadow-md  tracking-wide">
                                                        <Icon name="archive" className="text-[12px]" fill="true" />
                                                        ARSIP
                                                    </div>
                                                </div>

                                                {/* Details */}
                                                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                                                    <div className="space-y-5">
                                                        <h4 className="font-medium text-[15px] text-slate-650 dark:text-slate-350 tracking-tight leading-snug line-clamp-1 uppercase">{prod.name}</h4>
                                                        
                                                        {/* Price and Sold Row */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-base sm:text-lg font-medium text-slate-400 line-through">{formatRp(prod.price)}</span>
                                                            {(prod.sold || 0) > 0 && (
                                                                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-400 dark:text-slate-500 text-[10px] font-medium px-2.5 py-1 rounded-lg">
                                                                    <Icon name="trending_up" className="text-[11px]" />
                                                                    {prod.sold} Terjual
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Status selesai box */}
                                                        <div className="text-[10.5px] font-medium flex items-center gap-1.5 p-2.5 rounded-lg border bg-rose-50/50 border-rose-100 text-rose-600 dark:bg-rose-950/10 dark:border-rose-900/30">
                                                            <Icon name="timer_off" className="text-[14px]" />
                                                            <span>Event Selesai / Pembelian Ditutup</span>
                                                        </div>

                                                        <p className={`text-[12px] font-medium text-slate-550 dark:text-slate-455 leading-relaxed ${expandedDescId === prod.id ? '' : 'line-clamp-2'}`}>{prod.description || 'Tidak ada deskripsi.'}</p>
                                                    </div>

                                                    {/* Action Buttons (Disabled) */}
                                                    <div className="flex gap-2.5 pt-2">
                                                        <button
                                                            disabled
                                                            className="flex-1 py-3 rounded-full font-medium text-[12.5px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center justify-center gap-1.5"
                                                        >
                                                            <Icon name="lock" className="text-[16px]" />
                                                            Event Selesai / Diarsipkan
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}


                            {/* Sub Tab: Tiket Saya */}
                            {activeSubTab === 'my_tickets' && (
                                <div className="space-y-7">
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 relative">
                                            <input type="text" placeholder="Cari pesanan berdasarkan nama pembeli..." value={myTicketsSearch} onChange={e => setMyTicketsSearch(e.target.value)} style={{ paddingLeft: '1.25rem' }} className="w-full bg-white border border-slate-200 pr-5 py-3 rounded-2xl text-[13px] font-medium outline-none focus:border-google-blue/40" />
                                        </div>
                                        {myTicketsSearch && (
                                            <button onClick={() => setMyTicketsSearch('')} className="bg-white border border-slate-200 text-slate-650 hover:bg-slate-100 px-4 py-3 rounded-full text-[11px] font-medium transition-all">Reset</button>
                                        )}
                                    </div>

                                    {myTicketsFiltered.length === 0 ? (
                                        <div className="bg-white border border-slate-200 p-12 text-center rounded-3xl">
                                            <div className="w-16 h-16 bg-slate-50 border border-slate-200 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400"><Icon name="confirmation_number" className="text-[28px]" /></div>
                                            <p className="text-[13px] font-medium text-slate-800">Belum ada tiket yang terdaftar.</p>
                                            <p className="text-[11.5px] font-medium text-slate-400 mt-1 max-w-sm mx-auto">Silakan beli tiket di tab "Beli Tiket" atau gunakan pencarian nama jika Anda membuat pesanan di perangkat lain.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {myTicketsFiltered.map(order => (
                                                <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                                    <Icon name="receipt_long" className="text-[16px]" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">ID Pesanan</p>
                                                                    <p className="text-[12px] font-medium text-slate-700">#TKT-{String(order.id).slice(-6)}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-medium px-3 py-1.5 rounded-lg border ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                                                        </div>
                                                        
                                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-5">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Pemesan</p>
                                                                    <h4 className="font-medium text-[15px] text-slate-800">{order.buyerName}</h4>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Total Harga</p>
                                                                    <p className="text-[14px] font-medium text-rose-600">{formatRp(order.totalPrice)}</p>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="pt-2 border-t border-slate-200">
                                                                <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Rincian Tiket</p>
                                                                <p className="text-[13px] font-medium text-slate-700">{order.productName} <span className="text-slate-500 font-medium">x{order.quantity} Pcs</span></p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="mt-4 space-y-2">
                                                            {order.deliveryMethod === 'delivery' ? (
                                                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-white p-3 rounded-xl border border-slate-200">
                                                                    <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="local_shipping" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Diantar ke Rumah</span>
                                                                        <p className="text-[11px] text-slate-500 mt-0.5">Waktu: {order.deliveryDay || '-'}, {order.deliveryTime || '-'}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-white p-3 rounded-xl border border-slate-200">
                                                                    <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="location_on" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Ambil Sendiri</span>
                                                                        <p className="text-[11px] text-slate-500 mt-0.5">{order.pickupLocation || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                                                        {order.pickupGeoUrl && (
                                                                            <a href={order.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-rose-600 hover:underline inline-flex items-center gap-1 font-medium"><Icon name="map" className="text-[11px]" /> Buka Peta</a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {order.notes && (
                                                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-amber-50 p-3 rounded-xl border border-amber-100">
                                                                    <Icon name="chat_bubble" className="text-[14px] mt-0.5 shrink-0 text-amber-500" />
                                                                    <span><span className="font-medium text-slate-800">Catatan Anda:</span> {order.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between mt-4">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                                                <Icon name="event" className="text-[13px]" /> {order.timestamp}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                                                <Icon name="payments" className="text-[13px]" /> Bayar COD
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {order.status === 'pending' && (
                                                        <div className="border-t border-slate-100 pt-3">
                                                            <button onClick={() => {
                                                                setConfirmModal({
                                                                    title: "Batalkan Pesanan?",
                                                                    message: "Apakah Anda yakin ingin membatalkan pesanan tiket ini?",
                                                                    confirmText: "Batalkan",
                                                                    onConfirm: () => {
                                                                        handleCancelOrderByWarga(order);
                                                                        setConfirmModal(null);
                                                                    }
                                                                });
                                                            }} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium py-2.5 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="cancel" className="text-[14px]" /> Batalkan Pesanan</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sub Tab: Daftar Pembeli */}
                            {activeSubTab === 'buyers_list' && (
                                <div className="space-y-7">
                                    {/* Info Banner */}
                                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 flex items-start gap-3">
                                        <Icon name="info" className="text-[18px] text-google-blue shrink-0 mt-0.5" />
                                        <p className="text-[12px] font-medium text-blue-800 dark:text-blue-300 leading-relaxed">
                                            Daftar ini menampilkan semua warga yang telah memesan tiket (tidak termasuk yang dibatalkan). Total <span className="font-medium">{buyersList.length} pembeli</span> dengan <span className="font-medium">{buyersTotalTickets} tiket</span> telah dipesan.
                                        </p>
                                    </div>

                                    {/* Search */}
                                    <div className="relative">
                                        <input type="text" placeholder="Cari nama pembeli..." value={buyersSearch} onChange={e => setBuyersSearch(e.target.value)} style={{ paddingLeft: '1.25rem' }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pr-5 py-3 rounded-2xl text-[13px] font-medium outline-none focus:border-google-blue/40 dark:text-slate-200" />
                                        {buyersSearch && (
                                            <button onClick={() => setBuyersSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><Icon name="close" className="text-[16px]" /></button>
                                        )}
                                    </div>

                                    {buyersListFiltered.length === 0 ? (
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center rounded-3xl">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400">
                                                <Icon name="groups" className="text-[28px]" />
                                            </div>
                                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">{buyersSearch ? 'Tidak ada pembeli ditemukan.' : 'Belum ada yang memesan tiket.'}</p>
                                            <p className="text-[11.5px] font-medium text-slate-400 mt-1">Jadilah yang pertama memesan tiket!</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                            {/* Header Tabel */}
                                            <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
                                                <div className="col-span-1 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center">#</div>
                                                <div className="col-span-6 text-[9px] font-medium text-slate-400 uppercase tracking-wider">Nama Pembeli</div>
                                                <div className="col-span-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center">Jumlah</div>
                                                <div className="col-span-2 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center">Tgl</div>
                                            </div>
                                            {/* Baris Pembeli */}
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                                {buyersListFiltered.map((order, idx) => (
                                                    <div key={order.id} className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${order.status === 'completed' ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}`}>
                                                        <div className="col-span-1 text-[10px] font-medium text-slate-400 text-center tabular-nums">{idx + 1}</div>
                                                        <div className="col-span-6 min-w-0">
                                                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 truncate leading-tight uppercase tracking-wide">{order.buyerName}</p>
                                                            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">{order.productName}</p>
                                                        </div>
                                                        <div className="col-span-3 text-center">
                                                            <span className="inline-flex items-center gap-1 bg-google-blueLight dark:bg-blue-950/40 text-google-blueDark dark:text-blue-400 border border-google-blue/20 dark:border-blue-900/40 text-[11px] font-medium px-2.5 py-1 rounded-full">
                                                                <Icon name="confirmation_number" className="text-[11px]" />
                                                                {order.quantity}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-2 text-[9.5px] font-medium text-slate-400 text-center leading-tight">
                                                            {order.timestamp ? order.timestamp.slice(5) : '-'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Footer Ringkasan */}
                                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total {buyersListFiltered.length} pembeli</span>
                                                <span className="inline-flex items-center gap-1.5 bg-google-blue text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                                    <Icon name="confirmation_number" className="text-[12px]" />
                                                    {buyersListFiltered.reduce((sum, o) => sum + (o.quantity || 0), 0)} Tiket Dipesan
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Modal Beli Tiket (Warga) */}
                            {isBuyModalOpen && selectedProduct && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                                    <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                                            <h3 className="text-lg font-medium text-slate-800">Formulir Beli Tiket</h3>
                                            <button onClick={() => setIsBuyModalOpen(false)} className="w-8 h-8 rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 flex items-center justify-center"><Icon name="close" /></button>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="bg-google-blueLight border border-google-blue/20 rounded-2xl p-4 text-[12px] text-google-blueDark">
                                                <p className="font-medium">{selectedProduct.name}</p>
                                                <p className="font-medium text-slate-500 mt-0.5">Harga: {formatRp(selectedProduct.price)} / tiket</p>
                                                <p className="font-medium text-slate-500">Tersedia: {selectedProduct.stock} tiket</p>
                                            </div>

                                            {/* Pilihan Metode Penerimaan Tiket */}
                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Metode Penerimaan Tiket</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button type="button" onClick={() => setBuyForm({ ...buyForm, deliveryMethod: 'pickup' })} className={`p-4 rounded-full border font-medium text-[12px] text-center flex flex-col items-center justify-center gap-2 transition-all ${buyForm.deliveryMethod === 'pickup' ? 'border-google-blue bg-google-blueLight text-google-blueDark shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                                        <Icon name="store" className="text-[20px]" />
                                                        <span>Ambil Sendiri (COD)</span>
                                                    </button>
                                                    <button type="button" onClick={() => setBuyForm({ ...buyForm, deliveryMethod: 'delivery' })} className={`p-4 rounded-full border font-medium text-[12px] text-center flex flex-col items-center justify-center gap-2 transition-all ${buyForm.deliveryMethod === 'delivery' ? 'border-google-blue bg-google-blueLight text-google-blueDark shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-105'}`}>
                                                        <Icon name="local_shipping" className="text-[20px]" />
                                                        <span>Antar ke Rumah (COD)</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tampilkan Input Waktu atau Info Lokasi */}
                                            {buyForm.deliveryMethod === 'delivery' ? (
                                                <div className="animate-fade-in bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-5">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Hari Pengantaran</label>
                                                            <input type="text" value={buyForm.deliveryDay} onChange={e => setBuyForm({...buyForm, deliveryDay: e.target.value})} className="w-full bg-white border border-slate-200 p-3.5 text-[13px] font-medium outline-none rounded-xl focus:border-google-blue/50 focus:shadow-sm transition-all" placeholder="Cth: Sabtu / Hari ini" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Jam Pengantaran</label>
                                                            <input type="text" value={buyForm.deliveryTime} onChange={e => setBuyForm({...buyForm, deliveryTime: e.target.value})} className="w-full bg-white border border-slate-200 p-3.5 text-[13px] font-medium outline-none rounded-xl focus:border-google-blue/50 focus:shadow-sm transition-all" placeholder="Cth: Jam 4 Sore / Malam" />
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-550 leading-normal flex items-start gap-1"><Icon name="info" className="text-[13px] text-google-blue shrink-0 mt-0.5" /> Karena lingkungan RT sama, alamat tidak diperlukan. Cukup atur waktu agar pengurus RT bisa mengantarkan tiket ke rumah Anda.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 p-4 rounded-2xl text-[12px] text-emerald-800 dark:text-emerald-400 animate-fade-in">
                                                    <div className="flex items-start gap-2">
                                                        <Icon name="info" className="text-[18px] shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="font-medium">Informasi Pengambilan & Pembayaran:</p>
                                                            <p className="font-medium mt-1">Pembayaran dilakukan secara tunai / bayar di tempat (COD) saat mengambil tiket langsung di:</p>
                                                            <p className="font-medium mt-1 text-[13px] flex items-center gap-1">
                                                                <Icon name="location_on" className="text-[14px]" /> {selectedProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}
                                                            </p>
                                                            {selectedProduct.pickupGeoUrl && (
                                                                <a href={selectedProduct.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium underline hover:text-emerald-900"><Icon name="map" className="text-[13px]" /> Petunjuk Arah Google Maps</a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Nama Lengkap Pembeli</label>
                                                <input type="text" value={buyForm.name} onChange={e => setBuyForm({...buyForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Budi RT 02" />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Jumlah Tiket</label>
                                                    <div className="flex items-center gap-0 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-google-blue/50 focus-within:shadow-md transition-all">
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuyForm(f => ({ ...f, quantity: Math.max(1, (f.quantity || 1) - 1) }))}
                                                            className="w-14 h-14 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 active:scale-90 transition-all text-xl font-medium flex-shrink-0 select-none"
                                                        >-</button>
                                                        <span className="flex-1 text-center text-[18px] font-medium text-slate-800 select-none tabular-nums">
                                                            {buyForm.quantity || 1}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuyForm(f => ({ ...f, quantity: Math.min(selectedProduct.stock, (f.quantity || 1) + 1) }))}
                                                            disabled={(buyForm.quantity || 1) >= selectedProduct.stock}
                                                            className="w-14 h-14 flex items-center justify-center text-slate-500 hover:bg-green-50 hover:text-google-green active:scale-90 transition-all text-xl font-medium flex-shrink-0 select-none disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >+</button>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">Stok tersedia: <span className="text-google-blue font-medium">{selectedProduct.stock}</span> tiket</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Total Pembayaran</label>
                                                    <div className="w-full bg-google-blueLight border border-google-blue/20 p-4 text-[15px] font-medium text-google-blue rounded-2xl flex items-center justify-center h-14">
                                                        {formatRp(Number(buyForm.quantity || 1) * selectedProduct.price)}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">{formatRp(selectedProduct.price)} × {buyForm.quantity || 1} tiket</p>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Catatan Tambahan (Opsional)</label>
                                                <input type="text" value={buyForm.notes} onChange={e => setBuyForm({...buyForm, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Kaos Ukuran L / Minta diantar sore hari" />
                                            </div>

                                            {wargaError && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[12px] font-medium border border-red-200 flex items-center gap-2"><Icon name="error" /> {wargaError}</div>}
                                        </div>
                                        <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                                            <button onClick={() => setIsBuyModalOpen(false)} className="w-1/3 bg-white text-slate-700 border border-slate-200 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all shadow-sm">Batal</button>
                                            <button onClick={handlePlaceOrder} className="w-2/3 bg-google-blue text-white px-4 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark transition-all flex items-center justify-center gap-2"><Icon name="shopping_cart_checkout" className="text-[16px]"/> Pesan Tiket (COD)</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {confirmModal && (
                        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 text-red-500">
                                    <Icon name="delete_forever" className="text-[40px]" fill="true" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 mb-2">{confirmModal.title}</h3>
                                <p className="text-[12.5px] font-medium text-slate-500 mb-6 leading-relaxed">{confirmModal.message}</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setConfirmModal(null)} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm">Batal</button>
                                    <button onClick={confirmModal.onConfirm} className="flex-1 bg-red-500 hover:bg-red-650 text-white py-3.5 rounded-full font-medium text-[13px] active:scale-95 transition-all shadow-md">{confirmModal.confirmText || 'Hapus'}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {sharingProduct && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2"><Icon name="share" className="text-google-blue" /> Bagikan Tiket</h3>
                                    <button onClick={() => setSharingProduct(null)} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"><Icon name="close" /></button>
                                </div>

                                <div className="mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <h4 className="font-medium text-[14px] text-slate-800 dark:text-slate-200 line-clamp-1">{sharingProduct.name}</h4>
                                    <p className="text-[12px] font-medium text-google-blue mt-0.5">{formatRp(sharingProduct.price)}</p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1"><Icon name="location_on" className="text-[13px] text-google-blue" /> {sharingProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                </div>

                                <div className="space-y-2.5">
                                    <button onClick={() => handleShareToSocial('whatsapp')} className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="chat" className="text-[18px]" /> WhatsApp
                                    </button>
                                    <button onClick={() => handleShareToSocial('telegram')} className="w-full bg-[#0088cc] hover:bg-[#0077b3] text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="send" className="text-[18px] rotate-[-30deg] mt-[-2px]" /> Telegram
                                    </button>
                                    <button onClick={() => handleShareToSocial('facebook')} className="w-full bg-[#1877F2] hover:bg-[#1566d4] text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="facebook" className="text-[18px]" /> Facebook
                                    </button>
                                    <button onClick={() => handleShareToSocial('twitter')} className="w-full bg-slate-900 hover:bg-slate-950 text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="close" className="text-[18px]" /> X (Twitter)
                                    </button>
                                    <button onClick={() => handleShareToSocial('copy')} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 active:scale-95">
                                        <Icon name="content_copy" className="text-[18px]" /> Salin Tautan
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // ============================================================
        // KOMPONEN GRUP WHATSAPP (WARGA & ADMIN PERSATUAN)
        // ============================================================
        function WaGroup({ requests = [], setRequests, userRole, inviteLink }) {
            const safeRequests = Array.isArray(requests) ? requests : [];

            const [name, setName] = useState('');
            const [whatsapp, setWhatsapp] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'history'

            // Baca ID dari localStorage untuk mengenali request Warga di browser ini
            const [myRequestId, setMyRequestId] = useState(() => localStorage.getItem('wa_group_request_id') || '');

            const myRequest = safeRequests.find(r => r.id === myRequestId);

            const handleRequestSubmit = (e) => {
                e.preventDefault();
                if (!name.trim() || !whatsapp.trim()) {
                    setErrorMsg('Nama Lengkap dan Nomor WhatsApp wajib diisi!');
                    return;
                }
                const cleanPhone = whatsapp.replace(/[^0-9]/g, '');
                if (cleanPhone.length < 9) {
                    setErrorMsg('Nomor WhatsApp tidak valid (terlalu pendek)!');
                    return;
                }

                const newId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const newRequest = {
                    id: newId,
                    name: name.trim(),
                    whatsapp: cleanPhone,
                    status: 'pending',
                    timestamp: new Date().toISOString()
                };

                const updatedRequests = [newRequest, ...safeRequests];
                setRequests(updatedRequests);
                localStorage.setItem('wa_group_request_id', newId);
                setMyRequestId(newId);
                setName('');
                setWhatsapp('');
                setErrorMsg('');
                showToast('Permintaan gabung berhasil diajukan! Admin akan meninjau dalam 1x24 jam.');
            };

            const handleCancelRequest = () => {
                const updatedRequests = safeRequests.filter(r => r.id !== myRequestId);
                setRequests(updatedRequests);
                localStorage.removeItem('wa_group_request_id');
                setMyRequestId('');
                showToast('Pengajuan gabung grup dibatalkan.');
            };

            const handleResetRequest = () => {
                localStorage.removeItem('wa_group_request_id');
                setMyRequestId('');
            };

            const handleApprove = (id) => {
                const updatedRequests = safeRequests.map(r => r.id === id ? { ...r, status: 'approved' } : r);
                setRequests(updatedRequests);
                showToast('Permintaan gabung grup WhatsApp disetujui.');
            };

            const handleReject = (id) => {
                const updatedRequests = safeRequests.map(r => r.id === id ? { ...r, status: 'rejected' } : r);
                setRequests(updatedRequests);
                showToast('Permintaan gabung grup WhatsApp ditolak.');
            };

            const handleResetStatus = (id) => {
                const updatedRequests = safeRequests.map(r => r.id === id ? { ...r, status: 'pending' } : r);
                setRequests(updatedRequests);
                showToast('Status permintaan diubah kembali menjadi Menunggu.');
            };

            const handleDeleteRequest = (id) => {
                const updatedRequests = safeRequests.filter(r => r.id !== id);
                setRequests(updatedRequests);
                showToast('Data pengajuan telah dihapus.');
            };

            const formatDate = (isoString) => {
                if (!isoString) return '-';
                const date = new Date(isoString);
                return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            };

            // Render Warga View
            if (userRole !== 'admin') {
                if (!myRequestId || !myRequest) {
                    return (
                        <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-md space-y-8">
                                <div className="text-center space-y-5">
                                    <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/20 text-google-green flex items-center justify-center mx-auto border border-green-100 dark:border-green-900/40">
                                        <Icon name="forum" className="text-[32px]" fill="true" />
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Gabung Grup WhatsApp Warga</h2>
                                    <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Grup resmi WhatsApp digunakan untuk membagikan pengumuman penting, info kegiatan lingkungan, dan koordinasi antar warga secara cepat.
                                    </p>
                                </div>

                                <form onSubmit={handleRequestSubmit} className="space-y-6 pt-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700/60 focus-within:border-google-blue focus-within:ring-1 focus-within:ring-google-blue transition-all">
                                        <label className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Nama Lengkap Sesuai KTP</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            placeholder="Masukkan nama lengkap Anda" 
                                            className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                        />
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700/60 focus-within:border-google-blue focus-within:ring-1 focus-within:ring-google-blue transition-all">
                                        <label className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Nomor WhatsApp Aktif</label>
                                        <input 
                                            type="text" 
                                            value={whatsapp} 
                                            onChange={e => setWhatsapp(e.target.value)} 
                                            placeholder="Contoh: 081234567890" 
                                            className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                        />
                                    </div>

                                    {errorMsg && (
                                        <p className="text-[11px] text-google-red font-medium flex items-center gap-1"><Icon name="error" className="text-[14px]" /> {errorMsg}</p>
                                    )}

                                    <button 
                                        type="submit" 
                                        className="w-full bg-google-green hover:bg-green-600 text-white py-4 rounded-full font-medium text-[13px] flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all mt-4"
                                    >
                                        <Icon name="send" />
                                        <span>Ajukan Gabung Grup</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-md space-y-8 text-center">
                            {myRequest.status === 'pending' && (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-900/40 animate-pulse">
                                        <Icon name="schedule" className="text-[32px]" fill="true" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Pengajuan Sedang Ditinjau </h2>
                                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                                            Halo <strong className="font-medium text-slate-800 dark:text-slate-100">{myRequest.name}</strong> ({myRequest.whatsapp}), pengajuan gabung grup WhatsApp Anda sedang diperiksa oleh Admin RT.
                                        </p>
                                        <p className="text-[11px] text-amber-600 dark:text-amber-500 font-medium bg-amber-50 dark:bg-amber-950/30 py-2.5 px-4 rounded-xl border border-amber-100 dark:border-amber-900/20 inline-block mt-2">
                                            Estimasi verifikasi dalam 1 x 24 jam.
                                        </p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                                        <button 
                                            onClick={handleCancelRequest} 
                                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-350 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3.5 rounded-full font-medium text-[12.5px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                                        >
                                            Batalkan Pengajuan
                                        </button>
                                    </div>
                                </>
                            )}

                            {myRequest.status === 'approved' && (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/20 text-google-green flex items-center justify-center mx-auto border border-green-100 dark:border-green-900/40">
                                        <Icon name="verified" className="text-[32px]" fill="true" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Pengajuan Disetujui! 🛒</h2>
                                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                                            Selamat <strong className="font-medium text-slate-800 dark:text-slate-100">{myRequest.name}</strong>, Admin telah menyetujui akses masuk grup WhatsApp Warga RT.
                                        </p>
                                    </div>
                                    
                                    {inviteLink ? (
                                        <a 
                                            href={inviteLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-full bg-google-green hover:bg-green-600 text-white py-4 rounded-2xl font-medium text-[13px] flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all mt-4"
                                        >
                                            <Icon name="forum" />
                                            <span>Gabung Grup WhatsApp Sekarang</span>
                                        </a>
                                    ) : (
                                        <div className="bg-red-50 dark:bg-red-950/30 text-google-red p-4 rounded-xl border border-red-200 text-[11.5px] font-medium">
                                            Link grup belum diatur oleh Admin. Silakan hubungi pengurus RT Anda.
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <button 
                                            onClick={handleResetRequest} 
                                            className="text-slate-500 hover:text-slate-700 text-[11px] font-medium hover:underline"
                                        >
                                            Gabung dengan Nomor Lain / Daftar Ulang
                                        </button>
                                    </div>
                                </>
                            )}

                            {myRequest.status === 'rejected' && (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 text-google-red flex items-center justify-center mx-auto border border-red-100 dark:border-red-900/40">
                                        <Icon name="cancel" className="text-[32px]" fill="true" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Pengajuan Ditolak 🚚</h2>
                                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                                            Maaf <strong className="font-medium text-slate-800 dark:text-slate-100">{myRequest.name}</strong>, pengajuan Anda untuk bergabung ke grup WhatsApp ditolak oleh Admin. 
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">Pastikan data nama dan nomor Anda valid sesuai keanggotaan warga.</p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                                        <button 
                                            onClick={handleResetRequest} 
                                            className="flex-1 bg-google-blue hover:bg-blue-600 text-white py-3.5 rounded-full font-medium text-[12.5px] active:scale-95 transition-all shadow-sm"
                                        >
                                            Ajukan Ulang / Koreksi Data
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            }

            // Render Admin View
            const pendingRequests = safeRequests.filter(r => r.status === 'pending');
            const processedRequests = safeRequests.filter(r => r.status !== 'pending');

            return (
                <div className="animate-fade-in pb-24 w-full space-y-8">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-medium text-slate-800 dark:text-slate-100 tracking-tight">Verifikasi Grup WhatsApp</h2>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                                Kelola pengajuan gabung grup WhatsApp warga RT. Total {safeRequests.length} pengajuan.
                            </p>
                        </div>
                        {inviteLink ? (
                            <div className="bg-green-50 dark:bg-green-950/20 text-google-green text-[11px] font-medium py-2.5 px-4 rounded-xl border border-green-100 dark:border-green-900/40 flex items-center gap-1.5 shrink-0">
                                <Icon name="check_circle" className="text-[14px]" />
                                Link Grup Aktif: <a href={inviteLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-700">{inviteLink.substring(0, 30)}...</a>
                            </div>
                        ) : (
                            <div className="bg-red-50 dark:bg-red-950/20 text-google-red text-[11px] font-medium py-2.5 px-4 rounded-xl border border-red-100 dark:border-red-900/40 flex items-center gap-1.5 shrink-0">
                                <Icon name="warning" className="text-[14px]" />
                                Link grup belum diset di Setelan Admin!
                            </div>
                        )}
                    </div>

                    <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
                        <button 
                            onClick={() => setActiveSubTab('active')} 
                            className={`pb-3 font-medium text-[13px] relative transition-colors ${activeSubTab === 'active' ? 'text-google-blue' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span>Permintaan Aktif ({pendingRequests.length})</span>
                            {activeSubTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-google-blue rounded-full"></div>}
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('history')} 
                            className={`pb-3 font-medium text-[13px] relative transition-colors ${activeSubTab === 'history' ? 'text-google-blue' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span>Riwayat Proses ({processedRequests.length})</span>
                            {activeSubTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-google-blue rounded-full"></div>}
                        </button>
                    </div>

                    {activeSubTab === 'active' ? (
                        pendingRequests.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-2">
                                <Icon name="inbox" className="text-[48px]" />
                                <p className="text-[13px] font-medium">Tidak ada pengajuan gabung grup yang menunggu persetujuan.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pendingRequests.map(r => (
                                    <div key={r.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md space-y-6 hover:shadow-md transition-shadow">
                                        <div className="space-y-1.5">
                                            <h3 className="font-medium text-slate-800 dark:text-slate-100 text-[14.5px] truncate">{r.name}</h3>
                                            <p className="text-[12px] font-medium text-google-blue flex items-center gap-1">
                                                <Icon name="call" className="text-[13px]" /> {r.whatsapp}
                                            </p>
                                            <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                                <Icon name="event" className="text-[12px]" /> Diajukan: {formatDate(r.timestamp)}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <button 
                                                onClick={() => handleReject(r.id)} 
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-google-red py-2.5 rounded-full text-[11px] font-medium border border-red-200/50 transition-colors active:scale-95"
                                            >
                                                Tolak
                                            </button>
                                            <button 
                                                onClick={() => handleApprove(r.id)} 
                                                className="flex-1 bg-google-green hover:bg-green-600 text-white py-2.5 rounded-full text-[11px] font-medium transition-colors active:scale-95 shadow-md shadow-green-500/20"
                                            >
                                                Setujui
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        processedRequests.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-2">
                                <Icon name="history" className="text-[48px]" />
                                <p className="text-[13px] font-medium">Belum ada riwayat pengajuan yang diproses.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-medium text-slate-400 block-none uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                                                <th className="px-6 sm:px-8 py-5">Nama Lengkap</th>
                                                <th className="px-6 sm:px-8 py-5">Nomor WhatsApp</th>
                                                <th className="px-6 sm:px-8 py-5">Tanggal Diajukan</th>
                                                <th className="px-6 sm:px-8 py-5">Status</th>
                                                <th className="px-6 sm:px-8 py-5 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12.5px] font-medium text-slate-700 dark:text-slate-350">
                                            {processedRequests.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                                                    <td className="px-6 sm:px-8 py-5 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                                                    <td className="px-6 sm:px-8 py-5 text-google-blue font-medium">{r.whatsapp}</td>
                                                    <td className="px-6 sm:px-8 py-5 text-slate-400">{formatDate(r.timestamp)}</td>
                                                    <td className="px-6 sm:px-8 py-5">
                                                        {r.status === 'approved' ? (
                                                            <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-950/20 text-google-green text-[10px] font-medium px-2.5 py-1 rounded-full border border-green-200 dark:border-green-900/40">
                                                                <Icon name="check" className="text-[12px]" /> Disetujui
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-google-red text-[10px] font-medium px-2.5 py-1 rounded-full border border-red-200 dark:border-red-900/40">
                                                                <Icon name="close" className="text-[12px]" /> Ditolak
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 sm:px-8 py-5 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => handleResetStatus(r.id)} 
                                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                                                                title="Ubah keputusan kembali ke pending"
                                                            >
                                                                <Icon name="undo" className="text-[16px]" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteRequest(r.id)} 
                                                                className="p-1.5 hover:bg-red-50/10 rounded-full text-slate-400 hover:text-google-red transition-colors"
                                                                title="Hapus permanen"
                                                            >
                                                                <Icon name="delete" className="text-[16px]" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )}
                </div>
            );
        }

// Default export untuk digunakan di main.jsx
// =====================================================
// =====================================================
// =====================================================
// KOMPONEN TOKO / OFFICIAL STORE - FULLY RESPONSIVE (DARK MODE SUPPORT, 1:1 RATIO, & SKU SYSTEM)
// =====================================================
function Toko({ tokoProducts, setTokoProducts, tokoOrders, setTokoOrders, userRole, identity, changeTab }) {
    const [view, setView] = useState('list');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [orderQty, setOrderQty] = useState(1);
    const [cart, setCart] = useState({});
    const [checkoutForm, setCheckoutForm] = useState({ namaWarga: '', noWa: '', alamat: '', catatan: '' });
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({ judul: '', kategori: '', deskripsi: '', imageUrl: '', isPublished: true, grosirMinQty: '', grosirPrice: '', variants: [{ id: Date.now(), name: 'Default', price: 0 }] });
    const [isUploading, setIsUploading] = useState(false);
    const [activeOrderTab, setActiveOrderTab] = useState('Menunggu');
    const [tokoConfirm, setTokoConfirm] = useState(null); // { message, onConfirm }
    const [selectedCategory, setSelectedCategory] = useState('Semua');

    const cartItemCount = Object.keys(cart).length;
    const cartTotal = Object.values(cart).reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Cek redirect / direct link dari Landing Page atau mount
    useEffect(() => {
        const openIdOrSku = sessionStorage.getItem('openTokoProductId');
        if (openIdOrSku && tokoProducts.length > 0) {
            const p = tokoProducts.find(i => String(i.id) === String(openIdOrSku) || String(i.sku) === String(openIdOrSku));
            if (p) { 
                setSelectedProduct(p); 
                setSelectedVariant(p.variants[0] || null); 
                setOrderQty(1); 
                setView('detail'); 
                sessionStorage.removeItem('openTokoProductId');
            }
        }

        const addIdOrSku = sessionStorage.getItem('addToCartProductId');
        if (addIdOrSku && tokoProducts.length > 0) {
            const p = tokoProducts.find(i => String(i.id) === String(addIdOrSku) || String(i.sku) === String(addIdOrSku));
            if (p) {
                const variant = p.variants[0];
                const qty = 1;
                let price = variant.price;
                if (p.grosirMinQty > 0 && qty >= p.grosirMinQty && p.grosirPrice > 0) price = p.grosirPrice;
                const key = `${p.id}_${variant.id}`;
                setCart(prev => ({ ...prev, [key]: { product: p, variant: variant, qty: (prev[key]?.qty || 0) + 1, price } }));
                showToast('Ditambahkan ke keranjang!');
                setView('cart');
                sessionStorage.removeItem('addToCartProductId');
            }
        }
    }, [tokoProducts]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0]; if (!file) return; setIsUploading(true);
        try {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new Image();
            img.src = URL.createObjectURL(file); await new Promise(r => img.onload = r);
            let width = img.width; let height = img.height; const MAX = 800;
            if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } } else { if (height > MAX) { width *= MAX / height; height = MAX; } }
            canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
            const b64 = canvas.toDataURL('image/webp', 0.8);
            const res = await fetch(GOOGLE_DRIVE_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ filename: file.name.split('.')[0] + '.webp', mimeType: 'image/webp', fileData: b64 }) });
            const json = await res.json();
            if (json.status === 'success') { setProductForm(prev => ({ ...prev, imageUrl: json.url })); showToast('Gambar berhasil diunggah!'); }
            else throw new Error(json.message);
        } catch (err) { showToast('Gagal upload: ' + err.message, 'error'); } finally { setIsUploading(false); }
    };

    const addToCart = () => {
        if (!selectedVariant || orderQty <= 0) return showToast('Pilih varian & kuantitas!', 'error');
        let price = selectedVariant.price;
        if (selectedProduct.grosirMinQty > 0 && orderQty >= selectedProduct.grosirMinQty && selectedProduct.grosirPrice > 0) price = selectedProduct.grosirPrice;
        const key = `${selectedProduct.id}_${selectedVariant.id}`;
        setCart(prev => ({ ...prev, [key]: { product: selectedProduct, variant: selectedVariant, qty: (prev[key]?.qty || 0) + safeNumber(orderQty), price } }));
        showToast('Ditambahkan ke keranjang!'); setView('list');
    };

    const processCheckout = () => {
        if (!checkoutForm.namaWarga || !checkoutForm.noWa || !checkoutForm.alamat) return showToast('Lengkapi nama, No WA, dan alamat!', 'error');
        if (cartItemCount === 0) return showToast('Keranjang kosong.', 'error');
        setTokoOrders([...tokoOrders, { id: Date.now(), wargaName: checkoutForm.namaWarga, phone: checkoutForm.noWa, address: checkoutForm.alamat, notes: checkoutForm.catatan, items: Object.values(cart), totalAmount: cartTotal, status: 'Menunggu', orderDate: new Date().toISOString() }]);
        setCart({}); setCheckoutForm({ namaWarga: '', noWa: '', alamat: '', catatan: '' });
        showToast('Pesanan berhasil dibuat! Tim kami akan menghubungi Anda.'); setView('list');
    };

    const saveProduct = () => {
        if (!productForm.judul || productForm.variants.length === 0) return showToast('Judul & minimal 1 varian wajib diisi.', 'error');
        
        // Generate SKU otomatis jika belum ada
        const sku = productForm.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;

        if (editingProduct) { setTokoProducts(tokoProducts.map(p => p.id === editingProduct.id ? { ...p, ...productForm, sku } : p)); showToast('Produk diperbarui.'); }
        else { setTokoProducts([...tokoProducts, { id: Date.now(), createdAt: new Date().toISOString(), ...productForm, sku }]); showToast('Produk baru ditambahkan.'); }
        setIsFormOpen(false); setEditingProduct(null);
    };

    // ===== HEADER SHARED =====
    const PageHeader = ({ title, subtitle, onBack, children }) => (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-5 sm:pb-6 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 min-w-0">
                <button onClick={onBack} className="w-10 h-10 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 shadow-sm transition-all text-slate-800 dark:text-white">
                    <Icon name="arrow_back" className="text-[18px]" />
                </button>
                <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-medium text-slate-800 dark:text-white tracking-tight truncate">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 hidden sm:block">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );

    // ===== VIEW: KERANJANG =====
    if (view === 'cart') return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <PageHeader title="Keranjang Belanja" subtitle="Review & checkout pesanan Anda" onBack={() => setView('list')} />
            {cartItemCount === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-10 sm:p-16 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                    <Icon name="shopping_cart" className="text-[56px] text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Keranjang masih kosong.</p>
                    <button onClick={() => setView('list')} className="mt-4 px-5 py-2 bg-google-blue hover:bg-google-blueDark dark:bg-blue-600 dark:hover:bg-blue-750 text-white rounded-full font-medium text-xs transition-all">Lihat Produk</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Ringkasan Pesanan */}
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                            <h3 className="font-medium text-slate-800 dark:text-white text-base sm:text-lg border-b border-slate-100 dark:border-slate-800 pb-4">Ringkasan Pesanan</h3>
                            {Object.entries(cart).map(([key, item]) => (
                                <div key={key} className="flex gap-4 justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                                    <div className="flex gap-3 sm:gap-4 items-center flex-1 min-w-0">
                                        {item.product.imageUrl ? <img src={item.product.imageUrl} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover shrink-0" /> : <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0"><Icon name="storefront" className="text-slate-400 text-[16px]" /></div>}
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-white line-clamp-1">{item.product.judul}</p>
                                            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.variant.name} &bull; {item.qty}x {formatRp(item.price)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs sm:text-sm font-medium text-google-green dark:text-google-greenLight">{formatRp(item.price * item.qty)}</p>
                                        <button onClick={() => { const nc = {...cart}; delete nc[key]; setCart(nc); }} className="text-[10px] sm:text-[11px] text-red-505 font-medium hover:underline mt-0.5">Hapus</button>
                                    </div>
                                </div>
                            ))}
                            <div className="bg-slate-50 dark:bg-slate-850 px-5 py-4 rounded-xl flex justify-between items-center border border-slate-200 dark:border-slate-800">
                                <span className="font-medium text-slate-600 dark:text-slate-300 text-sm">Total Belanja</span>
                                <span className="text-base sm:text-lg font-medium text-google-green dark:text-google-greenLight">{formatRp(cartTotal)}</span>
                            </div>
                        </div>
                        <div className="bg-google-greenLight/20 dark:bg-google-greenDark/10 border border-google-green/30 p-5 rounded-2xl flex gap-4 items-start">
                            <Icon name="local_shipping" className="text-google-green text-[20px] shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-google-greenDark dark:text-google-greenLight text-sm">Gratis Ongkir & COD</p>
                                <p className="text-xs text-google-greenDark/80 dark:text-google-greenLight/80 mt-0.5 leading-relaxed">Pesanan diantar langsung ke rumah Anda. Pembayaran tunai saat barang tiba.</p>
                            </div>
                        </div>
                    </div>
                    {/* Form Pengiriman */}
                    <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-7">
                        <h3 className="font-medium text-slate-800 dark:text-white text-base sm:text-lg border-b border-slate-100 dark:border-slate-800 pb-4">Data Pengiriman</h3>
                        {[
                            { label: 'Nama Lengkap Pemesan *', key: 'namaWarga', type: 'text', placeholder: 'Nama Anda...' },
                            { label: 'Nomor WhatsApp *', key: 'noWa', type: 'number', placeholder: '08xx...' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">{f.label}</label>
                                <input type={f.type} value={checkoutForm[f.key]} onChange={e => setCheckoutForm({...checkoutForm, [f.key]: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-google-green dark:focus:border-green-505 text-slate-800 dark:text-white rounded-xl px-5 py-3.5 text-sm font-medium outline-none transition-colors" placeholder={f.placeholder} />
                            </div>
                        ))}
                        {[
                            { label: 'Alamat / Blok RT *', key: 'alamat', placeholder: 'RT 01 / Blok A No. 12...' },
                            { label: 'Catatan (Opsional)', key: 'catatan', placeholder: 'Cth: Diantar sore hari...' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">{f.label}</label>
                                <textarea rows="2" value={checkoutForm[f.key]} onChange={e => setCheckoutForm({...checkoutForm, [f.key]: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-google-green dark:focus:border-green-505 text-slate-800 dark:text-white rounded-xl px-5 py-3.5 text-sm font-medium outline-none transition-colors resize-none" placeholder={f.placeholder} />
                            </div>
                        ))}
                        <button onClick={processCheckout} className="w-full bg-google-green hover:bg-google-greenDark dark:bg-green-600 dark:hover:bg-green-755 text-white font-medium py-3.5 sm:py-4 rounded-full shadow-md shadow-green-500/30 active:scale-95 transition-all text-sm">
                            ✓ Buat Pesanan & Bayar COD
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // ===== VIEW: DETAIL PRODUK =====
    if (view === 'detail' && selectedProduct) {
        const effPrice = selectedProduct.grosirMinQty > 0 && orderQty >= selectedProduct.grosirMinQty && selectedProduct.grosirPrice > 0 ? selectedProduct.grosirPrice : (selectedVariant?.price || 0);
        return (
            <div className="space-y-8 max-w-7xl mx-auto">
                <PageHeader title="Detail Produk" onBack={() => setView('list')} />
                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:flex-row">
                    {/* Gambar Produk - Aspect Square */}
                    <div className="lg:w-1/2 aspect-square bg-slate-100 dark:bg-slate-800 relative">
                        {selectedProduct.imageUrl
                            ? <img src={selectedProduct.imageUrl} className="absolute inset-0 w-full h-full object-cover" alt={selectedProduct.judul} />
                            : <div className="absolute inset-0 flex items-center justify-center"><Icon name="storefront" className="text-[56px] text-slate-300 dark:text-slate-650" /></div>}
                        {selectedProduct.grosirMinQty > 0 && <span className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-[9px] font-medium uppercase px-2.5 py-1 rounded-full shadow">Grosir Tersedia</span>}
                        
                        {/* Tombol Share */}
                        <button onClick={(e) => {
                            e.stopPropagation();
                            const cleanUrl = new URL(window.location.origin + window.location.pathname);
                            cleanUrl.searchParams.set('page', 'toko');
                            cleanUrl.searchParams.set('product', selectedProduct.sku || selectedProduct.id);
                            navigator.clipboard.writeText(cleanUrl.toString());
                            showToast('Tautan produk berhasil disalin!');
                        }} className="absolute top-3 right-3 w-8 h-8 bg-white/95 dark:bg-slate-900/95 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-google-blue hover:bg-white dark:hover:bg-slate-850 transition-colors shadow-sm" title="Bagikan Produk">
                            <Icon name="share" className="text-[14px]" />
                        </button>
                    </div>
                    {/* Info & Aksi */}
                    <div className="lg:w-1/2 p-4 sm:p-6 lg:p-8 space-y-7">
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h1 className="text-lg sm:text-2xl font-medium text-slate-800 dark:text-white tracking-tight">{selectedProduct.judul}</h1>
                                {selectedProduct.sku && (
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                        {selectedProduct.sku}
                                    </span>
                                )}
                            </div>
                            {selectedProduct.kategori && (
                                <span className="inline-block bg-google-blue/10 text-google-blue dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-md text-[10px] font-medium mb-3 uppercase tracking-wider border border-google-blue/20">
                                    {selectedProduct.kategori}
                                </span>
                            )}
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedProduct.deskripsi}</p>
                        </div>
                        {/* Pilih Varian */}
                        <div>
                            <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Pilih Varian</label>
                            <div className="flex flex-wrap gap-2">
                                {selectedProduct.variants.map(v => (
                                    <button key={v.id} onClick={() => setSelectedVariant(v)}
                                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full sm:rounded-full font-medium text-xs sm:text-sm border transition-all active:scale-95 ${selectedVariant?.id === v.id ? 'bg-google-blue text-white border-google-blueDark shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-750 hover:border-google-blue/50'}`}>
                                        {v.name} &bull; {formatRp(v.price)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Qty */}
                        <div>
                            <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Jumlah Beli (Qty)</label>
                            <div className="flex items-center gap-3">
                                <input type="number" step="0.1" min="0.1" value={orderQty} onChange={e => setOrderQty(e.target.value)} className="w-20 sm:w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-google-blue dark:focus:border-blue-500 text-slate-800 dark:text-white rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-center font-medium text-sm outline-none" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bisa desimal (cth: 1.5)</span>
                            </div>
                            {selectedProduct.grosirMinQty > 0 && selectedProduct.grosirPrice > 0 && (
                                <div className="bg-google-yellowLight/20 border border-google-yellow/40 p-3 rounded-xl flex gap-2 items-start mt-3">
                                    <Icon name="sell" className="text-google-yellowDark text-[16px] shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-google-yellowDark dark:text-google-yellowLight font-medium leading-relaxed">
                                        Beli <span className="underline underline-offset-1">{selectedProduct.grosirMinQty}</span>+ dapat harga grosir: <span className="underline underline-offset-1">{formatRp(selectedProduct.grosirPrice)}</span>/varian
                                        {safeNumber(orderQty) >= safeNumber(selectedProduct.grosirMinQty) && <span className="ml-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">✓ Aktif!</span>}
                                    </p>
                                </div>
                            )}
                        </div>
                        {/* Subtotal & CTA */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-medium text-slate-600 dark:text-slate-300 text-sm">Subtotal</span>
                                <span className="text-lg sm:text-xl font-medium text-google-green dark:text-google-greenLight">{formatRp(effPrice * safeNumber(orderQty))}</span>
                            </div>
                            <button onClick={addToCart} className="w-full bg-google-blue hover:bg-google-blueDark dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium py-3 sm:py-3.5 rounded-full shadow-md shadow-blue-500/30 active:scale-95 transition-all text-sm flex justify-center items-center gap-2">
                                <Icon name="add_shopping_cart" className="text-[18px]" /> Tambah ke Keranjang
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ===== VIEW: ADMIN - KELOLA PRODUK =====
    if (view === 'admin-products') return (
        <>
        <div className="space-y-7">
            <PageHeader title="Kelola Katalog Produk" subtitle="Tambah, edit, dan hapus produk toko" onBack={() => setView('list')}>
                <button onClick={() => { setProductForm({ judul: '', kategori: '', deskripsi: '', imageUrl: '', isPublished: true, grosirMinQty: '', grosirPrice: '', variants: [{ id: Date.now(), name: 'Reguler', price: 0 }] }); setEditingProduct(null); setIsFormOpen(true); }} className="bg-google-blue text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-medium text-xs sm:text-[13px] hover:bg-google-blueDark shadow-sm flex items-center gap-1.5 active:scale-95 transition-all">
                    <Icon name="add" className="text-[16px] sm:text-[18px]" /> <span className="hidden sm:inline">Produk</span> Baru
                </button>
            </PageHeader>

            {isFormOpen && (
                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-google-blue dark:border-blue-600 shadow-lg space-y-7">
                    <h3 className="font-medium text-slate-800 dark:text-white text-base sm:text-lg border-b border-slate-200 dark:border-slate-800 pb-3">{editingProduct ? ' Edit Produk' : '+ Produk Baru'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Kolom Kiri */}
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Nama / Judul Produk *</label>
                                <input type="text" value={productForm.judul} onChange={e => setProductForm({...productForm, judul: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 focus:border-google-blue dark:focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-sm font-medium outline-none transition-colors text-slate-800 dark:text-white" placeholder="Beras Premium 5Kg..." />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Kategori Produk</label>
                                <input list="kategori-options" type="text" value={productForm.kategori || ''} onChange={e => setProductForm({...productForm, kategori: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 focus:border-google-blue dark:focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-sm font-medium outline-none transition-colors text-slate-800 dark:text-white" placeholder="Pilih atau Ketik Kategori Baru..." />
                                <datalist id="kategori-options">
                                    <option value="Sembako & Kebutuhan Harian" />
                                    <option value="Makanan & Minuman" />
                                    <option value="Pakaian & Fashion" />
                                    <option value="Elektronik & Gadget" />
                                    <option value="Jasa & Layanan" />
                                    {Array.from(new Set(tokoProducts.map(p => p.kategori).filter(Boolean))).map(kat => (
                                        <option key={kat} value={kat} />
                                    ))}
                                </datalist>
                            </div>
                            {productForm.sku && (
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Kode SKU Produk (Otomatis)</label>
                                    <input type="text" value={productForm.sku} readOnly className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed" />
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-medium text-slate-550 dark:text-slate-400 mb-1.5 block">Deskripsi Produk</label>
                                <textarea rows="3" value={productForm.deskripsi} onChange={e => setProductForm({...productForm, deskripsi: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 focus:border-google-blue dark:focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-colors resize-none text-slate-800 dark:text-white" placeholder="Deskripsi produk..." />
                            </div>
                            {/* Upload Gambar */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Gambar Produk (Auto GDrive)</label>
                                <div className={`flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border ${isUploading ? 'border-google-blue' : productForm.imageUrl ? 'border-google-green' : 'border-slate-200 dark:border-slate-750'} p-3 rounded-2xl relative overflow-hidden transition-all`}>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 dark:border-slate-700 z-0 overflow-hidden">
                                        {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin" />
                                            : productForm.imageUrl ? <img src={productForm.imageUrl} className="w-full h-full object-cover" />
                                            : <Icon name="cloud_upload" className="text-[22px] text-slate-400" />}
                                    </div>
                                    <div className="z-0 flex-1 min-w-0">
                                        <p className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate">{isUploading ? 'Mengunggah...' : productForm.imageUrl ? '✓ Gambar Tersimpan' : 'Ketuk untuk pilih gambar'}</p>
                                        <p className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-0.5">Otomatis diupload & dikompresi</p>
                                    </div>
                                </div>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl hover:border-google-blue transition-colors">
                                <input type="checkbox" checked={productForm.isPublished} onChange={e => setProductForm({...productForm, isPublished: e.target.checked})} className="w-5 h-5 accent-google-blue rounded" />
                                <div>
                                    <p className="font-medium text-sm text-slate-700 dark:text-slate-300">Publikasikan ke Warga</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Produk akan tampil di halaman warga & landing page</p>
                                </div>
                            </label>
                        </div>
                        {/* Kolom Kanan */}
                        <div className="space-y-7">
                            {/* Varian & Harga */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-5">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-slate-700 dark:text-slate-300 text-sm">Varian & Harga</h4>
                                    <button onClick={() => setProductForm({...productForm, variants: [...productForm.variants, { id: Date.now(), name: '', price: 0 }]})} className="text-xs font-medium text-google-blue flex items-center gap-0.5 hover:underline"><Icon name="add" className="text-[14px]" />Tambah</button>
                                </div>
                                {productForm.variants.map((v, i) => (
                                    <div key={v.id} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                        <input type="text" value={v.name} onChange={e => { const nv = [...productForm.variants]; nv[i].name = e.target.value; setProductForm({...productForm, variants: nv}); }} placeholder="Nama Varian" className="w-full sm:flex-1 bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-google-blue dark:focus:border-blue-500 text-slate-800 dark:text-white" />
                                        <div className="flex gap-2 w-full sm:w-auto sm:flex-1 items-center">
                                            <input type="number" value={v.price} onChange={e => { const nv = [...productForm.variants]; nv[i].price = safeNumber(e.target.value); setProductForm({...productForm, variants: nv}); }} placeholder="Harga" className="w-full flex-1 bg-white dark:bg-slate-800 border border-slate-355 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-google-blue dark:focus:border-blue-505 text-slate-800 dark:text-white" />
                                            {productForm.variants.length > 1 && <button onClick={() => setProductForm({...productForm, variants: productForm.variants.filter(va => va.id !== v.id)})} className="w-7 h-7 shrink-0 bg-red-100 dark:bg-red-950/30 text-red-650 rounded-full flex items-center justify-center hover:bg-red-200"><Icon name="close" className="text-[14px]" /></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Grosir */}
                            <div className="bg-yellow-50 dark:bg-yellow-950/10 p-4 rounded-2xl border border-yellow-200 dark:border-yellow-900/30 space-y-5">
                                <h4 className="font-medium text-yellow-800 dark:text-yellow-500 text-sm flex items-center gap-1.5"><Icon name="sell" className="text-[16px]" />Harga Grosir (Opsional)</h4>
                                <p className="text-[11px] text-yellow-700 dark:text-yellow-600 font-medium leading-relaxed">Warga yang membeli  Qty ini akan otomatis mendapat harga grosir.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <div>
                                        <label className="text-[10px] font-medium text-yellow-700 dark:text-yellow-500 mb-1 block">Min. Qty</label>
                                        <input type="number" value={productForm.grosirMinQty} onChange={e => setProductForm({...productForm, grosirMinQty: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-yellow-350 dark:border-yellow-900/40 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-yellow-500 text-slate-800 dark:text-white" placeholder="cth: 5" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-yellow-700 dark:text-yellow-500 mb-1 block">Harga Grosir</label>
                                        <input type="number" value={productForm.grosirPrice} onChange={e => setProductForm({...productForm, grosirPrice: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-yellow-350 dark:border-yellow-900/40 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-yellow-500 text-slate-800 dark:text-white" placeholder="Rp..." />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 justify-end">
                        <button onClick={() => { setIsFormOpen(false); setEditingProduct(null); }} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all border border-slate-350 dark:border-slate-750 text-sm">Batal</button>
                        <button onClick={saveProduct} className="px-5 py-2.5 bg-google-blue text-white font-medium rounded-full hover:bg-google-blueDark active:scale-95 transition-all shadow-md text-sm">Simpan Produk</button>
                    </div>
                </div>
            )}

            {!isFormOpen && (
                <>
                    {/* Mobile Cards (< md) */}
                    <div className="md:hidden space-y-5">
                        {tokoProducts.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">Belum ada produk.</div>
                        ) : tokoProducts.map((p, idx) => (
                            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex gap-3 items-start">
                                {p.imageUrl ? <img src={p.imageUrl} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-850" /> : <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"><Icon name="storefront" className="text-slate-400 dark:text-slate-650" /></div>}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-sm text-slate-800 dark:text-white line-clamp-1">{p.judul}</p>
                                            {p.sku && <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{p.sku}</p>}
                                        </div>
                                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase ${p.isPublished ? 'bg-green-105 dark:bg-green-950/20 text-green-800 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{p.isPublished ? 'Publik' : 'Draft'}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 space-y-0.5">
                                        {p.variants.slice(0,2).map((v,i) => <div key={i}>&bull; {v.name}: <span className="font-medium text-slate-700 dark:text-slate-355">{formatRp(v.price)}</span></div>)}
                                        {p.variants.length > 2 && <div className="text-slate-400 dark:text-slate-550">+{p.variants.length-2} varian lainnya</div>}
                                    </div>
                                    {p.grosirMinQty > 0 && <span className="inline-block mt-1.5 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-955/20 text-yellow-800 dark:text-yellow-450 text-[9px] font-medium rounded">Grosir</span>}
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => { setEditingProduct(p); setProductForm(p); setIsFormOpen(true); }} className="flex-1 py-1.5 bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium flex items-center justify-center gap-1 hover:bg-blue-100"><Icon name="edit" className="text-[14px]" />Edit</button>
                                        <button onClick={() => { setTokoConfirm({ message: 'Yakin ingin menghapus produk ini?', onConfirm: () => setTokoProducts(tokoProducts.filter(x => x.id !== p.id)) }); }} className="flex-1 py-1.5 bg-red-50 dark:bg-red-955/20 text-red-650 dark:text-red-405 rounded-full text-xs font-medium flex items-center justify-center gap-1 hover:bg-red-100"><Icon name="delete" className="text-[14px]" />Hapus</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Desktop Table (>= md) */}
                    <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[780px]">
                                <thead><tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <th className="p-5 sm:px-6 sm:py-5 w-12 text-center text-slate-500 dark:text-slate-400">No</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-slate-500 dark:text-slate-400">Info Produk</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-slate-500 dark:text-slate-400">Kategori</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-slate-500 dark:text-slate-400">Varian & Harga</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-center text-slate-500 dark:text-slate-400">Status</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-right text-slate-500 dark:text-slate-400">Aksi</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {tokoProducts.length === 0 ? <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-medium">Belum ada produk.</td></tr>
                                    : tokoProducts.map((p, idx) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="p-5 sm:px-6 sm:py-5 text-center font-medium text-slate-400 text-sm">{idx+1}</td>
                                            <td className="p-5 sm:px-6 sm:py-5">
                                                <div className="flex items-center gap-3">
                                                    {p.imageUrl ? <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0" /> : <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"><Icon name="storefront" className="text-slate-400" /></div>}
                                                    <div>
                                                        <p className="font-medium text-sm text-slate-800 dark:text-white">{p.judul}</p>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                            {p.sku && <span className="text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{p.sku}</span>}
                                                            {p.grosirMinQty > 0 && <span className="inline-block px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-450 text-[9px] font-medium rounded uppercase">Grosir Aktif</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5 sm:px-6 sm:py-5">
                                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap inline-block">
                                                    {p.kategori || 'Belum Diatur'}
                                                </span>
                                            </td>
                                            <td className="p-5 sm:px-6 sm:py-5 text-xs font-medium text-slate-600 dark:text-slate-300 space-y-1">{p.variants.map((v,i) => <div key={i}>&bull; {v.name}: <span className="font-medium text-slate-800 dark:text-white">{formatRp(v.price)}</span></div>)}</td>
                                            <td className="p-5 sm:px-6 sm:py-5 text-center"><span className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase ${p.isPublished ? 'bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{p.isPublished ? 'Publik' : 'Draft'}</span></td>
                                            <td className="p-5 sm:px-6 sm:py-5 text-right space-x-2 flex items-center justify-end">
                                                <button onClick={() => { setEditingProduct(p); setProductForm(p); setIsFormOpen(true); }} className="w-8 h-8 flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/20 text-blue-655 dark:text-blue-450 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30"><Icon name="edit" className="text-[15px]" /></button>
                                                <button onClick={() => { setTokoConfirm({ message: 'Yakin ingin menghapus produk ini?', onConfirm: () => setTokoProducts(tokoProducts.filter(x => x.id !== p.id)) }); }} className="w-8 h-8 flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-955/20 text-red-650 dark:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"><Icon name="delete" className="text-[15px]" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* Modern Confirm Modal */}
        {tokoConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                <div className="w-full max-w-xs text-center modal-card animate-modal-in p-7">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="warning" className="text-[32px] text-red-500" fill="true" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Konfirmasi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{tokoConfirm.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setTokoConfirm(null)} className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                        <button onClick={() => { tokoConfirm.onConfirm(); setTokoConfirm(null); }} className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );

    // ===== VIEW: ADMIN - KELOLA PESANAN =====
    if (view === 'admin-orders') return (
        <>
        <div className="space-y-7">
            <PageHeader title="Pesanan Masuk" subtitle="Kelola dan pantau status pesanan warga" onBack={() => setView('list')} />
            {/* Tab Status */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['Menunggu', 'Diproses', 'Diantar', 'Selesai', 'Dibatalkan'].map(tab => (
                    <button key={tab} onClick={() => setActiveOrderTab(tab)} className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-[11px] sm:text-xs transition-all border ${activeOrderTab === tab ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-850 hover:border-slate-400'}`}>
                        {tab} <span className={`${activeOrderTab === tab ? 'opacity-70' : 'opacity-50'}`}>({tokoOrders.filter(o => o.status === tab).length})</span>
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tokoOrders.filter(o => o.status === activeOrderTab).length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-400 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-sm">Tidak ada pesanan di tab ini.</div>
                ) : tokoOrders.filter(o => o.status === activeOrderTab).sort((a,b) => new Date(b.orderDate) - new Date(a.orderDate)).map(order => (
                    <div key={order.id} className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                    <Icon name="receipt_long" className="text-[16px]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Order ID</p>
                                    <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300">#TK-{String(order.id).slice(-6)}</p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-medium uppercase shrink-0 border ${order.status === 'Menunggu' ? 'bg-amber-50 border-amber-200 text-amber-700' : order.status === 'Diproses' ? 'bg-blue-50 border-blue-200 text-blue-700' : order.status === 'Diantar' ? 'bg-purple-50 border-purple-200 text-purple-700' : order.status === 'Selesai' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{order.status}</span>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-5">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Pemesan</p>
                                    <h4 className="font-medium text-[15px] text-slate-800 dark:text-slate-100 mt-0.5">{order.wargaName}</h4>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Total</p>
                                    <p className="text-[14px] font-medium text-rose-600 dark:text-rose-500">{formatRp(order.totalAmount)}</p>
                                </div>
                            </div>
                            
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-750">
                                <p className="text-[10px] font-medium text-slate-400 uppercase mb-2">Rincian Belanja</p>
                                <div className="space-y-2">
                                    {order.items.map((it, idx) => (
                                        <div key={idx} className="flex gap-2 items-start text-xs">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 p-0.5">
                                                {it.product.imageUrl ? <img src={it.product.imageUrl} className="w-full h-full object-cover rounded-md" /> : <Icon name="storefront" className="text-[14px] text-slate-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <p className="font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{it.product.judul}</p>
                                                <p className="text-[10px] font-medium text-slate-500">{it.variant.name} &bull; {it.qty}x {formatRp(it.price)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2 flex-1">
                            <div className="flex items-start gap-2 text-[11.5px] text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-750">
                                <div className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                                    <Icon name="local_shipping" className="text-[13px] text-rose-500" />
                                </div>
                                <div className="flex-1">
                                    <span className="font-medium text-slate-800 dark:text-white">Alamat Pengiriman</span>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-1">{order.address}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-750">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        <Icon name="call" className="text-[13px] text-slate-500" />
                                    </div>
                                    <span className="font-medium text-slate-800 dark:text-white">WhatsApp</span>
                                </div>
                                <a href={`https://wa.me/${order.phone.replace(/^0/,'62')}`} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:underline font-medium">{order.phone}</a>
                            </div>

                            {order.notes && (
                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                    <Icon name="chat_bubble" className="text-[14px] mt-0.5 shrink-0 text-amber-500" />
                                    <span><span className="font-medium text-slate-800 dark:text-white">Catatan:</span> {order.notes}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 mb-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                <Icon name="event" className="text-[13px]" /> {parseLocalDate(order.orderDate).toLocaleString('id-ID', {dateStyle:'short', timeStyle:'short'})}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-auto pt-1">
                            {order.status === 'Menunggu' && <button onClick={() => setTokoOrders(tokoOrders.map(o => o.id === order.id ? {...o, status: 'Diproses'} : o))} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-full text-xs font-medium transition-colors">Proses</button>}
                            {order.status === 'Diproses' && <button onClick={() => setTokoOrders(tokoOrders.map(o => o.id === order.id ? {...o, status: 'Diantar'} : o))} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-full text-xs font-medium transition-colors">Mulai Antar</button>}
                            {order.status === 'Diantar' && <button onClick={() => setTokoOrders(tokoOrders.map(o => o.id === order.id ? {...o, status: 'Selesai'} : o))} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-full text-xs font-medium transition-colors">Selesai ✓</button>}
                            {(order.status === 'Menunggu' || order.status === 'Diproses') && <button onClick={() => { setTokoConfirm({ message: 'Batalkan pesanan ini?', onConfirm: () => setTokoOrders(tokoOrders.map(o => o.id === order.id ? {...o, status: 'Dibatalkan'} : o)) }); }} className="px-3 bg-white dark:bg-slate-800 border border-red-205 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 py-2 rounded-full text-xs font-medium transition-colors">Batal</button>}
                            <button onClick={() => { setTokoConfirm({ message: 'Hapus pesanan ini secara permanen?', onConfirm: () => setTokoOrders(tokoOrders.filter(o => o.id !== order.id)) }); }} className="px-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 py-2 rounded-full text-xs font-medium transition-colors flex items-center justify-center" title="Hapus Permanen">
                                <Icon name="delete" className="text-[15px]" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Modern Confirm Modal */}
        {tokoConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                <div className="w-full max-w-xs text-center modal-card animate-modal-in p-7">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="warning" className="text-[32px] text-red-500" fill="true" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Konfirmasi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{tokoConfirm.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setTokoConfirm(null)} className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                        <button onClick={() => { tokoConfirm.onConfirm(); setTokoConfirm(null); }} className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );

    // ===== DEFAULT VIEW: GRID KATALOG PRODUK =====
    return (
        <>
        <div className="space-y-7">
            {/* Header Toko */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-medium text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                            <Icon name="storefront" className="text-google-green text-[26px] sm:text-3xl" fill="true" /> Official Store
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Layanan belanja hemat, gratis ongkir, bayar di tempat (COD).</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {userRole === 'admin' && (<>
                            <button onClick={() => setView('admin-products')} className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 text-google-blue dark:text-google-blueLight border border-google-blue dark:border-google-blue/40 rounded-full font-medium text-xs hover:bg-google-blue hover:text-white dark:hover:bg-google-blue transition-all">Kelola Katalog</button>
                            <button onClick={() => setView('admin-orders')} className="relative px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 text-yellow-750 dark:text-yellow-450 border border-yellow-405 dark:border-yellow-600/50 rounded-full font-medium text-xs hover:bg-yellow-400 hover:text-white dark:hover:bg-yellow-500 transition-all">
                                Pesanan
                                {tokoOrders.filter(o => o.status === 'Menunggu' || o.status === 'Diproses').length > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-medium animate-bounce">{tokoOrders.filter(o => o.status === 'Menunggu' || o.status === 'Diproses').length}</span>}
                            </button>
                        </>)}
                        <button onClick={() => setView('cart')} className="px-3 sm:px-5 py-2 sm:py-2.5 bg-google-green hover:bg-google-greenDark dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-full font-medium text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5 active:scale-95">
                            <Icon name="shopping_cart" className="text-[16px] sm:text-[18px]" />
                            <span>Keranjang</span>
                            {cartItemCount > 0 && <span className="bg-white text-google-green min-w-[20px] h-[20px] flex items-center justify-center rounded-full text-[10px] sm:text-[11px] font-bold px-1">{cartItemCount}</span>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Kategori Tabs */}
            {Array.from(new Set(tokoProducts.filter(p => p.isPublished).map(p => p.kategori).filter(Boolean))).length > 0 && (
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <button onClick={() => setSelectedCategory('Semua')}
                        className={`shrink-0 px-4 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all border ${selectedCategory === 'Semua' ? 'bg-google-blue text-white border-google-blueDark shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-google-blue/40'}`}>
                        Semua
                    </button>
                    {Array.from(new Set(tokoProducts.filter(p => p.isPublished).map(p => p.kategori).filter(Boolean))).map(kat => (
                        <button key={kat} onClick={() => setSelectedCategory(kat)}
                            className={`shrink-0 px-4 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all border ${selectedCategory === kat ? 'bg-google-blue text-white border-google-blueDark shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-google-blue/40'}`}>
                            {kat}
                        </button>
                    ))}
                </div>
            )}

            {/* Grid Produk - 1:1 Aspect Ratio & SKU Share System */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {tokoProducts.filter(p => p.isPublished && (selectedCategory === 'Semua' || p.kategori === selectedCategory)).length === 0 ? (
                    <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 font-medium text-sm bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">Belum ada produk yang dijual saat ini.</div>
                ) : tokoProducts.filter(p => p.isPublished && (selectedCategory === 'Semua' || p.kategori === selectedCategory)).map(item => (
                    <div key={item.id} onClick={() => { setSelectedProduct(item); setSelectedVariant(item.variants[0] || null); setOrderQty(1); setView('detail'); }}
                        className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm hover:shadow-lg overflow-hidden flex flex-col justify-between hover:border-google-green/60 hover:-translate-y-1 transition-all duration-300 group cursor-pointer font-sans">
                        {/* Gambar - 1:1 Ratio */}
                        <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                            {item.imageUrl
                                ? <img src={item.imageUrl} alt={item.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                : <Icon name="storefront" className="text-[40px] sm:text-[48px] text-slate-300 dark:text-slate-600" />}
                            {item.grosirMinQty > 0 && <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[8px] sm:text-[9px] font-medium uppercase px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow-sm">Grosir</span>}
                            
                            {/* Tombol Share */}
                            <button onClick={(e) => {
                                e.stopPropagation();
                                const cleanUrl = new URL(window.location.origin + window.location.pathname);
                                cleanUrl.searchParams.set('page', 'toko');
                                cleanUrl.searchParams.set('product', item.sku || item.id);
                                navigator.clipboard.writeText(cleanUrl.toString());
                                showToast('Tautan produk berhasil disalin!');
                            }} className="absolute top-2 right-2 w-7 h-7 bg-white/95 dark:bg-slate-900/95 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-google-blue hover:bg-white dark:hover:bg-slate-850 transition-colors shadow-sm" title="Bagikan Produk">
                                <Icon name="share" className="text-[13px]" />
                            </button>
                        </div>
                        {/* Info */}
                        <div className="p-3 sm:p-4 space-y-1 flex-1 flex flex-col">
                            <h4 className="font-medium text-[13px] sm:text-[15px] text-slate-800 dark:text-white tracking-tight leading-tight line-clamp-2 group-hover:text-google-green transition-colors">{item.judul}</h4>
                            <div className="flex flex-wrap items-center gap-1">
                                {item.sku && <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850 px-1 py-0.5 rounded">{item.sku}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-auto">
                                <span className="flex items-center gap-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800 uppercase tracking-wider"><Icon name="verified" className="text-[11px]" /> Official</span>
                                <span className="flex items-center gap-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800 uppercase tracking-wider"><Icon name="local_shipping" className="text-[11px]" /> Gratis Ongkir</span>
                                <span className="flex items-center gap-0.5 bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-orange-200/60 dark:border-orange-800 uppercase tracking-wider"><Icon name="payments" className="text-[11px]" /> COD</span>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center gap-2">
                            <div>
                                <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mulai dari</p>
                                <p className="text-[13px] sm:text-[14px] font-medium text-google-green dark:text-google-greenLight">{formatRp(Math.min(...item.variants.map(v => v.price)))}</p>
                            </div>
                            <div onClick={(e) => {
                                e.stopPropagation();
                                const variant = item.variants[0];
                                const qty = 1;
                                let price = variant.price;
                                if (item.grosirMinQty > 0 && qty >= item.grosirMinQty && item.grosirPrice > 0) price = item.grosirPrice;
                                const key = `${item.id}_${variant.id}`;
                                setCart(prev => ({ ...prev, [key]: { product: item, variant: variant, qty: (prev[key]?.qty || 0) + 1, price } }));
                                showToast('Ditambahkan ke keranjang!');
                                setView('cart');
                            }} className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 dark:bg-slate-800 text-google-green dark:text-google-greenLight border border-slate-200 dark:border-slate-750 rounded-full flex items-center justify-center hover:bg-google-green hover:text-white transition-colors shrink-0 cursor-pointer">
                                <Icon name="shopping_bag" className="text-[15px] sm:text-[18px]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Modern Confirm Modal */}
        {tokoConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                <div className="w-full max-w-xs text-center modal-card animate-modal-in p-7">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="warning" className="text-[32px] text-red-500" fill="true" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Konfirmasi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{tokoConfirm.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setTokoConfirm(null)} className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                        <button onClick={() => { tokoConfirm.onConfirm(); setTokoConfirm(null); }} className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
// =====================================================


export default App;




