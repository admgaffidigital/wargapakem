// ============================================================
// App.jsx - Portal Warga RT PAKEM (Modular Architecture)
// Dikonversi dan dimodularisasi untuk performa & maintainability tinggi
// ============================================================
import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import {
    db, auth, signOut, onAuthStateChanged
} from './firebase.js';

// Common Components & Helpers
import Icon from './components/common/Icon.jsx';
import ToastContainer, { showToast } from './components/common/Toast.jsx';
import PWAInstallBanner from './components/common/PWAInstallBanner.jsx';
import PwaGuideModal from './components/common/PwaGuideModal.jsx';
import FlagWavingBackground from './components/common/FlagWavingBackground.jsx';
import { useFirebaseSync, useFirebaseArticlesSync } from './hooks/useFirebaseSync.js';

// Landing Page & Navigation
import LoginScreen from './components/landing/LoginScreen.jsx';
import MainMenu from './components/landing/MainMenu.jsx';

// Modules (Lazy-loaded for optimal initial load & code splitting)
const Dashboard = React.lazy(() => import('./components/modules/Dashboard.jsx'));
const Informasi = React.lazy(() => import('./components/modules/Informasi.jsx'));
const Blog = React.lazy(() => import('./components/modules/Blog.jsx'));
const WargaList = React.lazy(() => import('./components/modules/WargaList.jsx'));
const Galeri = React.lazy(() => import('./components/modules/Galeri.jsx'));
const Inventaris = React.lazy(() => import('./components/modules/Inventaris.jsx'));
const Toko = React.lazy(() => import('./components/modules/Toko.jsx'));
const Pengaduan = React.lazy(() => import('./components/modules/Pengaduan.jsx'));
const PinjamInventaris = React.lazy(() => import('./components/modules/PinjamInventaris.jsx'));
const IuranUmum = React.lazy(() => import('./components/modules/IuranUmum.jsx'));
const BukuKas = React.lazy(() => import('./components/modules/BukuKas.jsx'));
const Tiket = React.lazy(() => import('./components/modules/Tiket.jsx'));
const Laporan = React.lazy(() => import('./components/modules/Laporan.jsx'));
const Pertemuan = React.lazy(() => import('./components/modules/Pertemuan.jsx'));
const Pengaturan = React.lazy(() => import('./components/modules/Pengaturan.jsx'));
const Infaq = React.lazy(() => import('./components/modules/Infaq.jsx'));
const Pemenang = React.lazy(() => import('./components/modules/Pemenang.jsx'));
const Kegiatan = React.lazy(() => import('./components/modules/Kegiatan.jsx'));
const Kalender = React.lazy(() => import('./components/modules/Kalender.jsx'));
const PetaDesa = React.lazy(() => import('./components/modules/PetaDesa.jsx'));
const MusicAdmin = React.lazy(() => import('./components/modules/MusicAdmin.jsx'));
const FloatingMusicPlayer = React.lazy(() => import('./components/modules/FloatingMusicPlayer.jsx'));
const WaGroup = React.lazy(() => import('./components/modules/WaGroup.jsx'));
const Qna = React.lazy(() => import('./Qna.jsx'));

// Loading Fallback Component (Tema Merah-Emas Nusantara)
function ModuleLoadingFallback() {
    return (
        <div className="flex flex-col justify-center items-center min-h-[320px] gap-4 py-16 animate-fade-in text-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-red-500/20 border-t-red-600 border-r-amber-500 animate-orbit-cw"></div>
                <div className="w-10 h-10 bg-red-50 dark:bg-red-950/40 rounded-xl flex items-center justify-center border border-red-500/20 text-red-600 dark:text-red-400 shadow-sm">
                    <Icon name="sync" className="text-[20px] animate-spin" />
                </div>
            </div>
            <div className="space-y-1">
                <h4 className="text-[13.5px] font-bold text-slate-800 dark:text-white tracking-tight">Memuat Modul Layanan...</h4>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Menyiapkan data & tampilan lingkungan</p>
            </div>
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
                privacy: "1. Pengumpulan Data Warga: Sistem mengumpulkan data administrasi (Nama, NIK, Alamat) murni untuk keperluan administrasi rukun tetangga PAKEM.\n2. Keamanan & Kerahasiaan Data: Data disimpan di server cloud secara aman dan kami menjamin 100% data tidak pernah dijual ke pihak ketiga untuk tujuan komersial.\n3. Kebijakan Iklan & Cookie Google AdSense: Portal ini menggunakan Google AdSense untuk menayangkan iklan. Google sebagai vendor pihak ketiga menggunakan cookie (termasuk DART cookie) untuk menayangkan iklan kepada pengguna berdasarkan kunjungan pengguna ke situs ini atau situs lain di internet.\n4. Opsi Pengguna (Opt-Out): Pengguna dapat menonaktifkan penggunaan DART cookie atau iklan yang dipersonalisasi dengan mengunjungi Setelan Iklan Google di https://www.google.com/settings/ads atau melalui www.aboutads.info.\n5. Keterbukaan Data Kas: Informasi laporan keuangan diproses secara terbuka demi akuntabilitas dan transparansi lingkungan RT PAKEM."
            };
            const [legalData, setLegalData, l_legal] = useFirebaseSync('legal', defaultLegal);
            const [showLegalModal, setShowLegalModal] = useState(null); // 'terms' | 'privacy' | null
            const [iuranData, setIuranData, l15] = useFirebaseSync('iuran_umum', []);
            const [galeriData, setGaleriData, l17] = useFirebaseSync('galeri_warga', []);
            const [laporanData, setLaporanData, l19] = useFirebaseSync('laporan', []);
            const [inventarisData, setInventarisData, l18] = useFirebaseSync('inventaris_rt', []);
            const [bannerImage, setBannerImage, l19_banner] = useFirebaseSync('banner_image', '');
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
            const isAppReady = firebaseUnavailable || (l1 && l2 && l3 && l4 && l5 && l6 && l7 && l8 && l10 && l11 && l12 && l13 && l14 && l15 && l17 && l18 && l19_banner && l21 && l22 && l23 && l24 && l25 && l_tokoProd && l_tokoOrd && lTicketProducts && lTicketOrders && l_waRequests);


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
                    if (hash === 'privacy') {
                        setShowLegalModal('privacy');
                    } else if (hash === 'terms') {
                        setShowLegalModal('terms');
                    } else if (hash) {
                        setActiveTab(hash);
                    }
                };
                window.addEventListener('hashchange', handleHashChange);
                
                const p = new URLSearchParams(window.location.search);
                const pageParam = p.get('page');
                if (pageParam === 'privacy') {
                    setShowLegalModal('privacy');
                } else if (pageParam === 'terms') {
                    setShowLegalModal('terms');
                }
                
                if (p.get('page') === 'toko' && p.has('product')) {
                    sessionStorage.setItem('openTokoProductId', p.get('product'));
                    setIsLoggedIn(true);
                    setUserRole('warga');
                    setActiveTab('toko');
                    window.location.hash = 'toko';
                }
                
                const hasNocache = p.has('nocache');
                const hasV = p.has('v');
                const hasPage = p.has('page') && pageParam !== 'privacy' && pageParam !== 'terms';
                
                if (hasNocache || hasV || hasPage) {
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('nocache');
                    cleanUrl.searchParams.delete('v');
                    if (pageParam !== 'privacy' && pageParam !== 'terms') cleanUrl.searchParams.delete('page');
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
                <div className="fixed inset-0 z-[999] flex justify-center items-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-[320px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[28px] border border-red-500/20 dark:border-red-900/40 shadow-2xl p-7 flex flex-col items-center relative overflow-hidden text-center animate-modal-in">
                        {/* Header Aksen Merah - Emas Nusantara */}
                        <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>

                        {/* Orbit Animation Centerpiece */}
                        <div className="relative w-24 h-24 mb-5 flex items-center justify-center">
                            {/* Cincin Luar Berputar (Merah) */}
                            <div className="absolute inset-0 rounded-full border-2 border-red-500/20 border-t-red-600 border-r-amber-500 animate-orbit-cw"></div>
                            {/* Cincin Dalam Berputar Terbalik (Emas) */}
                            <div className="absolute inset-2 rounded-full border border-amber-400/30 border-b-amber-500 border-l-red-500 animate-orbit-ccw"></div>
                            {/* Icon Lambang Garuda Berdenyut Halus */}
                            <div className="w-14 h-14 bg-gradient-to-b from-red-50 to-amber-50/50 dark:from-red-950/40 dark:to-slate-800 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-inner overflow-hidden animate-breathing-glow">
                                <img
                                    src="./National_emblem_of_Indonesia_Garuda_Pancasila.svg"
                                    alt="Garuda Pancasila"
                                    className="w-9 h-9 object-contain"
                                />
                            </div>
                        </div>

                        {/* Typography */}
                        <h3 className="text-[15px] font-black tracking-tight text-slate-800 dark:text-white uppercase mb-1">
                            {identity?.name || 'WARGA PAKEM'}
                        </h3>
                        <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mb-5">
                            Menghubungkan Portal Lingkungan...
                        </p>

                        {/* Shimmer Progress Track */}
                        <div className="w-40 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden relative mb-4">
                            <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-red-600 via-amber-400 to-red-600 rounded-full animate-shimmer-bar"></div>
                        </div>

                        {/* Status Chip */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-950/40 rounded-full border border-red-500/20">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                Sinkronisasi Real-Time
                            </span>
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
                        <LoginScreen 
                            theme={theme} 
                            setTheme={setTheme} 
                            identity={identity}
                            legalData={legalData} 
                            setShowLegalModal={setShowLegalModal} 
                            setShowLicenseModal={setShowLicenseModal} 
                            setShowPwaGuide={setShowPwaGuide}
                            onLogin={(role) => { 
                                setIsLoggedIn(true); 
                                setUserRole(role); 
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
                                const cleanUrl = new URL(window.location.href);
                                cleanUrl.searchParams.delete('page');
                                cleanUrl.searchParams.delete('product');
                                window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
                            }} 
                        />
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
                                    <button onClick={() => setShowLegalModal(null)} className="w-full bg-google-blue hover:bg-google-blueDark text-white min-h-[44px] py-3 rounded-2xl font-bold text-[13px] transition-all active:scale-95 shadow-md shadow-blue-500/20 cursor-pointer">Tutup & Lanjutkan</button>
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
                                    <div className="prose prose-sm text-slate-600 dark:text-slate-300 text-justify leading-relaxed max-w-none">
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
                                    <button onClick={() => setShowLicenseModal(false)} className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 min-h-[44px] py-3 rounded-2xl font-bold text-[13px] transition-all active:scale-95 cursor-pointer">Saya Mengerti</button>
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
                { id: 'dashboard', icon: 'dashboard', label: 'Ringkasan', desc: 'Kas, arisan & kondisi RT terkini', bg: 'bg-blue-50 dark:bg-blue-950/40', color: 'text-blue-600 dark:text-blue-400 border border-blue-500/20' },
                { id: 'informasi', icon: 'campaign', label: 'Info Warga', desc: 'Pengumuman resmi & kabar lingkungan', bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-600 dark:text-amber-400 border border-amber-500/20' },
                { id: 'warga', icon: 'group', label: 'Buku Warga', desc: 'Daftar kepala keluarga & anggota', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                { id: 'galery', icon: 'photo_library', label: 'Galeri', desc: 'Album dokumentasi foto kegiatan', bg: 'bg-purple-50 dark:bg-purple-950/40', color: 'text-purple-600 dark:text-purple-400 border border-purple-500/20' },
                { id: 'inventaris', icon: 'inventory_2', label: 'Inventaris', desc: 'Daftar aset, tenda & alat milik RT', bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-600 dark:text-amber-400 border border-amber-500/20' },
                { id: 'toko', icon: 'local_mall', label: 'Official Store', desc: 'Lapak produk & UMKM warga sekitar', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                { id: 'pengaduan', icon: 'report_problem', label: 'Lapor Warga', desc: 'Pusat aspirasi & laporan keluhan', bg: 'bg-rose-50 dark:bg-rose-950/40', color: 'text-rose-600 dark:text-rose-400 border border-rose-500/20' },
                { id: 'blog', icon: 'article', label: 'Blog Warga', desc: 'Artikel, kabar terkini & wawasan', bg: 'bg-sky-50 dark:bg-sky-950/40', color: 'text-sky-600 dark:text-sky-400 border border-sky-500/20' },
                { id: 'pinjam', icon: 'handshake', label: 'Pinjam Inventaris', desc: 'Ajukan sewa & pinjam peralatan RT', bg: 'bg-teal-50 dark:bg-teal-950/40', color: 'text-teal-600 dark:text-teal-400 border border-teal-500/20' },
                { id: 'iuran', icon: 'volunteer_activism', label: 'Iuran Umum', desc: 'Iuran sampah, keamanan & lingkungan', bg: 'bg-red-50 dark:bg-red-950/40', color: 'text-red-600 dark:text-red-400 border border-red-500/20' },
                { id: 'kas', icon: 'account_balance_wallet', label: 'Kas Warga', desc: 'Buku kas umum & laporan transparansi', bg: 'bg-indigo-50 dark:bg-indigo-950/40', color: 'text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' },
                { id: 'tiket', icon: 'local_activity', label: 'Beli Tiket', desc: 'Pemesanan tiket kegiatan & bazar', bg: 'bg-violet-50 dark:bg-violet-950/40', color: 'text-violet-600 dark:text-violet-400 border border-violet-500/20' },
                { id: 'laporan', icon: 'history', label: 'Arsip Riwayat', desc: 'Riwayat kocokan & rekap kas arisan', bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700' },
                { id: 'infaq', icon: 'volunteer_activism', label: 'Infaq & Donasi', desc: 'Penyaluran kotak infaq & sedekah', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                { id: 'pemenang', icon: 'emoji_events', label: 'Pemenang', desc: 'Daftar pemenang undian arisan & lomba', bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-600 dark:text-amber-400 border border-amber-500/20' },
                { id: 'kegiatan', icon: 'event', label: 'Jadwal Agenda', desc: 'Jadwal ronda, kerja bakti & rapat', bg: 'bg-blue-50 dark:bg-blue-950/40', color: 'text-blue-600 dark:text-blue-400 border border-blue-500/20' },
                { id: 'kalender', icon: 'calendar_month', label: 'Kalender', desc: 'Kalender agenda bulanan lingkungan', bg: 'bg-rose-50 dark:bg-rose-950/40', color: 'text-rose-600 dark:text-rose-400 border border-rose-500/20' },
                { id: 'peta', icon: 'map', label: 'Peta Lokasi', desc: 'Denah desa & kontak darurat siaga', bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700' },
                { id: 'wagroup', icon: 'forum', label: 'Grup WA', desc: 'Gabung grup WhatsApp resmi warga', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                { id: 'qna', icon: 'quiz', label: 'Tanya Jawab', desc: 'Panduan lengkap & FAQ fitur portal', bg: 'bg-sky-50 dark:bg-sky-950/40', color: 'text-sky-600 dark:text-sky-400 border border-sky-500/20' },
                ...(userRole === 'admin' ? [
                    { id: 'pertemuan', icon: 'checklist', label: 'Absen Arisan', desc: 'Presensi kehadiran & kocokan pemenang', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', adminOnly: true },
                    { id: 'musik', icon: 'music_note', label: 'Musik Warga', desc: 'Atur pemutar audio & lagu latar portal', bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-600 dark:text-amber-400 border border-amber-500/20', adminOnly: true },
                    { id: 'pengaturan', icon: 'settings', label: 'Setelan Admin', desc: 'Konfigurasi akun, backup data & RT', bg: 'bg-red-50 dark:bg-red-950/40', color: 'text-red-600 dark:text-red-400 border border-red-500/20', adminOnly: true }
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
                    case 'toko': return <Toko 
                        tokoProducts={tokoProducts} 
                        setTokoProducts={setTokoProducts} 
                        tokoOrders={tokoOrders} 
                        setTokoOrders={setTokoOrders} 
                        userRole={userRole} 
                        identity={identity} 
                        changeTab={changeTab} 
                        kasRtBalance={kasRtBalance} 
                        setKasRtBalance={setKasRtBalance} 
                        kasRtTransactions={kasRtTransactions} 
                        setKasRtTransactions={setKasRtTransactions} 
                    />;
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
                    case 'qna': return (
                        <React.Suspense fallback={<div className="flex justify-center items-center h-64 text-slate-500 font-medium text-xs">Memuat Tanya Jawab...</div>}>
                            <Qna 
                                userRole={userRole} 
                                nominalArisan={nominalArisan} 
                                nominalJimpitan={nominalJimpitan} 
                                identity={identity} 
                                members={members} 
                                arisanPeriod={arisanPeriod} 
                                currentRound={currentRound} 
                                cycleNumber={cycleNumber} 
                                jimpitanBalance={jimpitanBalance} 
                                kasRtBalance={kasRtBalance} 
                                meetingHistory={meetingHistory} 
                                inventarisData={inventarisData} 
                                pinjamData={pinjamData} 
                                infaqData={infaqData} 
                            />
                        </React.Suspense>
                    );
                    default: return <MainMenu userRole={userRole} NavItems={NavItems} changeTab={changeTab} identity={identity} sponsorsData={sponsorsData} nextMeeting={nextMeeting} />;
                }
            };

            const activeTabTitle = NavItems.find(i => i.id === activeTab)?.label || identity.name;

            return (
                <div className="min-h-screen bg-transparent print:bg-white font-sans text-google-text flex flex-col relative">
                    <FlagWavingBackground theme={theme} />
                    <div className="fixed inset-0 z-[-2] bg-batik opacity-50 dark:opacity-30 pointer-events-none no-print"></div>

                    {/* ANIMASI WAYANG KULIT GLOBAL (DASHBOARD) */}
                    <div className="fixed top-[12vh] md:top-[15vh] left-1/2 -translate-x-1/2 z-0 pointer-events-none opacity-10 dark:opacity-5 transition-all duration-1000 no-print">
                        <img src="./gunungan_transparent.png?v=4" alt="Gunungan" className="w-[85vw] md:w-[60vw] lg:w-[45vw] xl:w-[600px] max-w-[800px] h-auto object-contain dark:invert" />
                    </div>
                    <div className="fixed bottom-0 -left-4 sm:left-0 md:left-4 xl:left-8 z-0 pointer-events-none opacity-15 dark:opacity-10 transition-all duration-1000 no-print scale-x-[-1]">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kiri" className="w-[45vw] md:w-[35vw] lg:w-[30vw] xl:w-[450px] h-auto max-h-[45vh] md:max-h-[60vh] xl:max-h-[75vh] object-contain object-bottom animate-wayang dark:invert" />
                    </div>
                    <div className="fixed bottom-0 -right-4 sm:right-0 md:right-4 xl:right-8 z-0 pointer-events-none opacity-15 dark:opacity-10 transition-all duration-1000 no-print">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kanan" className="w-[45vw] md:w-[35vw] lg:w-[30vw] xl:w-[450px] h-auto max-h-[45vh] md:max-h-[60vh] xl:max-h-[75vh] object-contain object-bottom animate-wayang dark:invert" style={{ animationDelay: '1.5s' }} />
                    </div>

                    <div className="sticky top-0 z-40 no-print w-full pt-2.5 sm:pt-4 px-3.5 sm:px-6 lg:px-8">
                        {isOffline && (
                            <div className="bg-google-redDark text-white text-center py-2.5 px-4 text-[12px] font-medium flex flex-wrap items-center justify-center gap-2 w-full shadow-md">
                                <Icon name="wifi_off" className="text-[16px]" /> Koneksi terputus. Anda masuk ke mode offline.
                            </div>
                        )}

                        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl text-slate-800 dark:text-slate-100 py-2.5 px-3.5 sm:py-3.5 sm:px-6 w-full max-w-7xl mx-auto rounded-2xl sm:rounded-3xl border border-red-500/20 dark:border-red-900/40 shadow-lg shadow-red-500/10 dark:shadow-black/30 relative z-20 overflow-hidden">
                            {/* Strip Gradasi Aksen Merah-Emas di paling atas header */}
                            <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>

                            {/* ORNAMEN JOGLO - watermark di bawah tengah header */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 sm:w-32 pointer-events-none opacity-15 dark:opacity-5">
                                <img src="./joglo_transparent.png?v=2" alt="Ornamen Joglo" className="w-full h-auto dark:invert" />
                            </div>

                            <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10">
                                {/* Kiri: Identitas / Tombol Kembali */}
                                <div className="flex items-center gap-2.5 sm:gap-3.5 overflow-hidden">
                                    {activeTab === 'menu' ? (
                                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-red-50 to-amber-50/60 dark:from-red-950/50 dark:to-slate-800 border border-red-500/25 dark:border-red-900/40 p-1 flex items-center justify-center shrink-0 shadow-sm">
                                            <img
                                                src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"}
                                                alt="Logo"
                                                className={identity?.logoApp ? "w-full h-full object-cover rounded-xl" : "w-7 h-7 sm:w-8 sm:h-8 object-contain"}
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => changeTab('menu')}
                                            className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/40 rounded-2xl shrink-0 flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm cursor-pointer"
                                            title="Kembali ke Menu Utama"
                                        >
                                            <Icon name="arrow_back" className="text-[18px] sm:text-[20px]" />
                                        </button>
                                    )}

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                            <h1 className="text-[13.5px] sm:text-[16px] font-black uppercase tracking-tight text-slate-800 dark:text-white truncate">
                                                {activeTab === 'menu' ? (identity?.name || 'WARGA PAKEM') : activeTabTitle}
                                            </h1>
                                            {activeTab === 'menu' && (
                                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" title="Portal Online"></span>
                                            )}
                                        </div>
                                        <p className="text-[10.5px] sm:text-[11.5px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                            {activeTab === 'menu' ? (identity?.subtitle || 'RT Pakem, Banyuanyar, Gurah') : (identity?.name || 'Portal RT')}
                                        </p>
                                    </div>
                                </div>

                                {/* Kanan: Badge Peran, Toggle Tema, & Keluar */}
                                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 pl-1.5">
                                    <span className={`text-[8.5px] sm:text-[9.5px] font-black px-2.5 py-1 rounded-xl uppercase tracking-wider border shadow-xs ${
                                        userRole === 'admin'
                                            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-500/30'
                                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                    }`}>
                                        {userRole === 'admin' ? 'Pengurus' : 'Warga'}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                        className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center transition-all active:scale-95 border border-slate-200/80 dark:border-slate-700 shadow-sm cursor-pointer"
                                        title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
                                    >
                                        <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[17px] sm:text-[18px]" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowLogoutModal(true)}
                                        className="w-9 h-9 sm:w-10 sm:h-10 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white rounded-xl flex items-center justify-center transition-all active:scale-95 border border-red-500/30 shadow-sm cursor-pointer group"
                                        title="Keluar Sesi"
                                    >
                                        <Icon name="logout" className="text-[17px] sm:text-[18px] group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </header>
                    </div>

                    <main className="flex-1 w-full pt-5 md:pt-8 pb-40 print:pb-0 print:pt-0">
                        <div key={activeTab} className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 tab-fade-in pb-10">
                            <Suspense fallback={<ModuleLoadingFallback />}>
                                {renderContent()}
                            </Suspense>
                        </div>
                    </main>

                    <footer className="w-full no-print mt-auto border-t border-red-500/20 dark:border-red-900/40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl text-[12px] font-medium text-slate-600 dark:text-slate-400 py-8 relative overflow-hidden">
                        {/* Strip Aksen Merah - Emas */}
                        <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 opacity-80"></div>

                        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
                            {/* Identitas RT & Copyright */}
                            <div className="space-y-1 flex flex-col items-center md:items-start">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-500/30 flex items-center justify-center">
                                        <Icon name="flag" className="text-red-600 text-[14px]" fill="true" />
                                    </div>
                                    <span className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-[13px]">
                                        {identity?.name || 'PORTAL WARGA PAKEM'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    &copy; {new Date().getFullYear()} Lingkungan RT Pakem, Desa Banyuanyar, Gurah, Kediri. Hak cipta dilindungi.
                                </p>
                            </div>

                            {/* Navigasi Legal & Lisensi */}
                            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {legalData?.enabled && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowLegalModal('terms')}
                                            className="hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                                        >
                                            Syarat & Ketentuan
                                        </button>
                                        <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowLegalModal('privacy')}
                                            className="hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                                        >
                                            Kebijakan Privasi
                                        </button>
                                        <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowLicenseModal(true)}
                                    className="flex items-center gap-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors cursor-pointer"
                                >
                                    <Icon name="verified_user" className="text-[13px]" />
                                    <span>Keamanan & Lisensi</span>
                                </button>
                            </div>
                        </div>
                    </footer>
                    


                    <PWAInstallBanner />
                    {showLicenseModal && (
                        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-center items-center p-4 animate-fade-in modal-backdrop animate-backdrop-in">
                            <div className="rounded-2xl w-full max-w-lg overflow-hidden border border-red-500/30 dark:border-red-950/40 flex flex-col max-h-[85vh] modal-card animate-modal-in">
                                <div className="bg-red-50 dark:bg-red-950/20 px-6 py-5 border-b border-red-500/20 dark:border-red-900/30 flex items-center justify-between shrink-0">
                                    <h3 className="text-[14px] font-medium text-red-700 dark:text-red-400 flex items-center gap-2"><Icon name="verified_user" /> KEAMANAN DATA & LISENSI</h3>
                                    <button onClick={() => setShowLicenseModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-950/40 text-red-500 dark:text-red-400 transition-colors"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 md:p-8 overflow-y-auto hide-scrollbar">
                                    <div className="prose prose-sm text-slate-600 dark:text-slate-300 text-justify leading-relaxed max-w-none">
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
                    {userRole === 'warga' && musicData?.url && musicData?.enabled && <Suspense fallback={null}><FloatingMusicPlayer musicData={musicData} /></Suspense>}

                    {showPwaGuide && <PwaGuideModal onClose={() => setShowPwaGuide(false)} />}

                    {showLogoutModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 w-full max-w-sm text-center modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight dark:bg-red-950/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30 dark:border-red-900/20"><Icon name="logout" className="text-[40px] text-google-red" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text dark:text-white mb-2">Keluar Sesi?</h3>
                                <p className="text-[13px] text-google-textVariant dark:text-slate-300 mb-8 leading-relaxed font-medium">Sesi portal akan diakhiri. Anda akan kembali ke layar otorisasi.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setShowLogoutModal(false)} className="w-full sm:w-auto bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 min-h-[44px] py-2.5 px-6 rounded-2xl font-bold text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 active:scale-95 transition-all shadow-sm cursor-pointer">Batal</button>
                                    <button onClick={executeLogout} className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 text-white min-h-[44px] py-2.5 px-6 rounded-2xl font-bold text-[13px] shadow-md shadow-red-500/20 hover:from-red-700 hover:to-rose-700 border border-red-500/30 active:scale-95 transition-all cursor-pointer">Ya, Keluar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default App;
