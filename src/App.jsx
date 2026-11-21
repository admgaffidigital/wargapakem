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
import { useFirebaseSync } from './hooks/useFirebaseSync.js';

// Landing Page & Navigation
import LoginScreen from './components/landing/LoginScreen.jsx';
import MainMenu from './components/landing/MainMenu.jsx';
import TopNavBar from './components/navigation/TopNavBar.jsx';
import BottomNavBar from './components/navigation/BottomNavBar.jsx';
import SpotlightSearchModal from './components/navigation/SpotlightSearchModal.jsx';

// Modules (Lazy-loaded for optimal initial load & code splitting)
const Dashboard = React.lazy(() => import('./components/modules/Dashboard.jsx'));
const Informasi = React.lazy(() => import('./components/modules/Informasi.jsx'));
const WargaList = React.lazy(() => import('./components/modules/WargaList.jsx'));
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

            

            
            // Inisialisasi langsung dari URL - link produk tiket bypass landing page
            const [isLoggedIn, setIsLoggedIn] = useState(() => {
                const p = new URLSearchParams(window.location.search);
                return p.get('page') === 'tiket' && p.has('product');
            });
            const [userRoleInit] = useState(() => {
                const p = new URLSearchParams(window.location.search);
                return (p.get('page') === 'tiket' && p.has('product')) ? 'warga' : null;
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
                return (p.get('page') === 'tiket' && p.has('product')) ? 'warga' : null;
            }); 
            const [activeTab, setActiveTab] = useState(() => {
                const p = new URLSearchParams(window.location.search);
                if (p.get('page') === 'tiket' && p.has('product')) return 'tiket';
                return 'menu';
            }); 
            const [showLogoutModal, setShowLogoutModal] = useState(false);
            const [showLicenseModal, setShowLicenseModal] = useState(false);
            const [isOffline, setIsOffline] = useState(!navigator.onLine); 
            const [isSearchOpen, setIsSearchOpen] = useState(false); 
            
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
            const defaultLegal = {
                enabled: true,
                terms: "1. Akses Portal: Portal ini hanya diperuntukkan bagi warga lingkungan yang terdaftar sah. Dilarang membagikan akses login kepada pihak luar.\n2. Penggunaan Fitur: Warga dilarang menyalahgunakan fitur portal untuk menyebarkan hoaks, ujaran kebencian, atau pelanggaran hukum.\n3. Hak Admin: Admin (Pengurus Lingkungan) berhak memblokir akun warga yang terbukti melanggar aturan atau memalsukan data.\n4. Validitas Data: Warga bertanggung jawab penuh atas kebenaran data yang diunggah.",
                privacy: "1. Pengumpulan Data Warga: Sistem mengumpulkan data administrasi (Nama, NIK, Alamat) murni untuk keperluan administrasi rukun tetangga PAKEM.\n2. Keamanan & Kerahasiaan Data: Data disimpan di server cloud secara aman dan kami menjamin 100% data tidak pernah dijual ke pihak ketiga untuk tujuan komersial.\n3. Kebijakan Iklan & Cookie Google AdSense: Portal ini menggunakan Google AdSense untuk menayangkan iklan. Google sebagai vendor pihak ketiga menggunakan cookie (termasuk DART cookie) untuk menayangkan iklan kepada pengguna berdasarkan kunjungan pengguna ke situs ini atau situs lain di internet.\n4. Opsi Pengguna (Opt-Out): Pengguna dapat menonaktifkan penggunaan DART cookie atau iklan yang dipersonalisasi dengan mengunjungi Setelan Iklan Google di https://www.google.com/settings/ads atau melalui www.aboutads.info.\n5. Keterbukaan Data Kas: Informasi laporan keuangan diproses secara terbuka demi akuntabilitas dan transparansi lingkungan RT PAKEM."
            };
            const [legalData, setLegalData, l_legal] = useFirebaseSync('legal', defaultLegal);
            const [showLegalModal, setShowLegalModal] = useState(null); // 'terms' | 'privacy' | null
            const [iuranData, setIuranData, l15] = useFirebaseSync('iuran_umum', []);
            const [laporanData, setLaporanData, l19] = useFirebaseSync('laporan', []);
            const [inventarisData, setInventarisData, l18] = useFirebaseSync('inventaris_rt', []);
            const [bannerImage, setBannerImage, l19_banner] = useFirebaseSync('banner_image', '');
            const [pinjamData, setPinjamData, l21] = useFirebaseSync('pinjam_inventaris', []);
            const [infaqData, setInfaqData, l22] = useFirebaseSync('infaq_data', []);
            const [tokoProducts, setTokoProducts, l_tokoProd] = useFirebaseSync('toko_products', []);
            const [tokoOrders, setTokoOrders, l_tokoOrd] = useFirebaseSync('toko_orders', []);
            
            const defaultLandingConfig = {
                servicesSubtitle: 'Layanan Utama Portal Kami',
                newsSubtitle: 'Informasi Lingkungan',
                newsTitle: 'KABAR WARGA & PENGUMUMAN',
                newsEmptyTitle: 'Belum Ada Pengumuman',
                newsEmptyDesc: 'Pengumuman penting dan kabar warga RT akan muncul di halaman ini.',
                sponsorSubtitle: 'Didukung Oleh',
                footerInfoTitle: 'Informasi Layanan Digital Terverifikasi',
                footerInfoDesc: 'Layanan Resmi RT Pakem, Banyuanyar, Gurah, Kediri.',
                footerTagline: 'sistem informasi manajemen kerukunan lingkungan digital.',
                adsenseClientId: 'ca-pub-2636322336243340',
                whatsappGroupLink: ''
            };
            const [landingConfig, setLandingConfig, l_landing] = useFirebaseSync('landing_config', defaultLandingConfig);
            const [sponsorsData, setSponsorsData, l24] = useFirebaseSync('sponsors_data', { enabled: false, sponsors: [] });
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

            // PERFORMA KILAT: Langsung render antarmuka tanpa memblokir dengan spinner!
            // Pengunjung / warga langsung disajikan gerbang portal dalam waktu < 100ms.
            if (!isLoggedIn) {
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
                { id: 'inventaris', icon: 'inventory_2', label: 'Inventaris', desc: 'Daftar aset, tenda & alat milik RT', bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-600 dark:text-amber-400 border border-amber-500/20' },
                { id: 'toko', icon: 'local_mall', label: 'Official Store', desc: 'Lapak produk & UMKM warga sekitar', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                { id: 'pengaduan', icon: 'report_problem', label: 'Lapor Warga', desc: 'Pusat aspirasi & laporan keluhan', bg: 'bg-rose-50 dark:bg-rose-950/40', color: 'text-rose-600 dark:text-rose-400 border border-rose-500/20' },
                { id: 'pinjam', icon: 'handshake', label: 'Pinjam Inventaris', desc: 'Ajukan sewa & pinjam peralatan RT', bg: 'bg-teal-50 dark:bg-teal-950/40', color: 'text-teal-600 dark:text-teal-400 border border-teal-500/20' },
                { id: 'iuran', icon: 'volunteer_activism', label: 'Iuran Umum', desc: 'Iuran sampah, keamanan & lingkungan', bg: 'bg-red-50 dark:bg-red-950/40', color: 'text-red-600 dark:text-red-400 border border-red-500/20' },
                { id: 'kas', icon: 'account_balance_wallet', label: 'Kas Warga', desc: 'Buku kas umum & laporan transparansi', bg: 'bg-indigo-50 dark:bg-indigo-950/40', color: 'text-indigo-600 dark:text-indigo-400 border border-indigo-500/20' },
                { id: 'tiket', icon: 'local_activity', label: 'Beli Tiket', desc: 'Pemesanan tiket kegiatan & bazar', bg: 'bg-violet-50 dark:bg-violet-950/40', color: 'text-violet-600 dark:text-violet-400 border border-violet-500/20' },
                { id: 'laporan', icon: 'history', label: 'Arsip Riwayat', desc: 'Riwayat kocokan & rekap kas arisan', bg: 'bg-slate-100 dark:bg-slate-800', color: 'text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700' },
                { id: 'infaq', icon: 'volunteer_activism', label: 'Infaq & Donasi', desc: 'Penyaluran kotak infaq & sedekah', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                { id: 'pemenang', icon: 'emoji_events', label: 'Pemenang', desc: 'Daftar pemenang undian arisan & lomba', bg: 'bg-amber-50 dark:bg-amber-950/40', color: 'text-amber-600 dark:text-amber-400 border border-amber-500/20' },
                { id: 'kegiatan', icon: 'event', label: 'Jadwal Agenda', desc: 'Jadwal ronda, kerja bakti & rapat', bg: 'bg-blue-50 dark:bg-blue-950/40', color: 'text-blue-600 dark:text-blue-400 border border-blue-500/20' },
                { id: 'kalender', icon: 'calendar_month', label: 'Kalender', desc: 'Kalender agenda bulanan lingkungan', bg: 'bg-rose-50 dark:bg-rose-950/40', color: 'text-rose-600 dark:text-rose-400 border border-rose-500/20' },
                { id: 'wagroup', icon: 'forum', label: 'Grup WA', desc: 'Gabung grup WhatsApp resmi warga', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' },
                { id: 'qna', icon: 'quiz', label: 'Tanya Jawab', desc: 'Panduan lengkap & FAQ fitur portal', bg: 'bg-sky-50 dark:bg-sky-950/40', color: 'text-sky-600 dark:text-sky-400 border border-sky-500/20' },
                ...(userRole === 'admin' ? [
                    { id: 'pertemuan', icon: 'checklist', label: 'Absen Arisan', desc: 'Presensi kehadiran & kocokan pemenang', bg: 'bg-emerald-50 dark:bg-emerald-950/40', color: 'text-emerald-600 dark:text-emerald-400 border border-emerald-500/20', adminOnly: true },
                    { id: 'pengaturan', icon: 'settings', label: 'Setelan Admin', desc: 'Konfigurasi akun, backup data & RT', bg: 'bg-red-50 dark:bg-red-950/40', color: 'text-red-600 dark:text-red-400 border border-red-500/20', adminOnly: true }
                ] : [])
            ];

            const renderContent = () => {
                switch(activeTab) {
                    case 'menu':
                    case 'layanan':
                        return (
                            <MainMenu 
                                userRole={userRole} 
                                NavItems={NavItems} 
                                changeTab={changeTab} 
                                identity={identity} 
                                bannerImage={bannerImage} 
                                setShowPwaGuide={setShowPwaGuide} 
                                sponsorsData={sponsorsData} 
                                nextMeeting={nextMeeting}
                                kasRtBalance={kasRtBalance}
                                jimpitanBalance={jimpitanBalance}
                                members={members}
                                currentRound={currentRound}
                                cycleNumber={cycleNumber}
                                arisanPeriod={arisanPeriod}
                            />
                        );
                    case 'dashboard': return <Dashboard members={members} setMembers={setMembers} jimpitanBalance={jimpitanBalance} kasRtBalance={kasRtBalance} currentRound={currentRound} setCurrentRound={setCurrentRound} userRole={userRole} cycleNumber={cycleNumber} setCycleNumber={setCycleNumber} changeTab={changeTab} arisanPeriod={arisanPeriod} />;
                    case 'informasi': return <Informasi data={informasi} setData={setInformasi} userRole={userRole} />;
                    case 'warga': return <WargaList members={members} setMembers={setMembers} userRole={userRole} identity={identity} cycleNumber={cycleNumber} currentRound={currentRound} arisanPeriod={arisanPeriod} />;
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
                    case 'pengaturan': return userRole === 'admin' ? <Pengaturan nominalArisan={nominalArisan} setNominalArisan={setNominalArisan} nominalJimpitan={nominalJimpitan} setNominalJimpitan={setNominalJimpitan} identity={identity} setIdentity={setIdentity} setMembers={setMembers} setMeetingHistory={setMeetingHistory} currentRound={currentRound} setCurrentRound={setCurrentRound} cycleNumber={cycleNumber} setCycleNumber={setCycleNumber} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} kasRtBalance={kasRtBalance} setKasRtBalance={setKasRtBalance} kasRtTransactions={kasRtTransactions} setKasRtTransactions={setKasRtTransactions} arisanPeriod={arisanPeriod} setArisanPeriod={setArisanPeriod} bannerImage={bannerImage} setBannerImage={setBannerImage} setIuranData={setIuranData} setInventarisData={setInventarisData} setInformasi={setInformasi} setNextMeeting={setNextMeeting} sponsorsData={sponsorsData} setSponsorsData={setSponsorsData} legalData={legalData} setLegalData={setLegalData} landingConfig={landingConfig} setLandingConfig={setLandingConfig} /> : null;
                    case 'infaq': return <Infaq infaqData={infaqData} setInfaqData={setInfaqData} userRole={userRole} identity={identity} />;
                    case 'pemenang': return <Pemenang members={members} />;
                    case 'kegiatan': return <Kegiatan nextMeeting={nextMeeting} setNextMeeting={setNextMeeting} userRole={userRole} />;
                    case 'kalender': return <Kalender />;
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
                    default: 
                        return (
                            <MainMenu 
                                userRole={userRole} 
                                NavItems={NavItems} 
                                changeTab={changeTab} 
                                identity={identity} 
                                sponsorsData={sponsorsData} 
                                nextMeeting={nextMeeting}
                                kasRtBalance={kasRtBalance}
                                jimpitanBalance={jimpitanBalance}
                                members={members}
                                currentRound={currentRound}
                                cycleNumber={cycleNumber}
                                arisanPeriod={arisanPeriod}
                            />
                        );
                }
            };

            const activeTabTitle = NavItems.find(i => i.id === activeTab)?.label || identity.name;

            return (
                <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 flex flex-col relative antialiased selection:bg-red-500 selection:text-white">
                    <FlagWavingBackground theme={theme} opacity={theme === 'dark' ? 0.05 : 0.03} />

                    {/* Ambient Radial Highlights untuk Kedalaman Native App */}
                    <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-red-600/5 dark:bg-red-600/10 rounded-full blur-[140px] pointer-events-none -mr-48 -mt-48 -z-10"></div>
                    <div className="fixed bottom-0 left-0 w-[450px] h-[450px] bg-amber-500/5 dark:bg-amber-500/5 rounded-full blur-[120px] pointer-events-none -ml-40 -mb-40 -z-10"></div>

                    {/* Modern Native App Top Bar */}
                    <TopNavBar
                        activeTab={activeTab}
                        changeTab={changeTab}
                        identity={identity}
                        userRole={userRole}
                        theme={theme}
                        setTheme={setTheme}
                        onOpenSearch={() => setIsSearchOpen(true)}
                        onOpenLogout={() => setShowLogoutModal(true)}
                        activeTabTitle={activeTabTitle}
                        isOffline={isOffline}
                    />

                    {/* Kontainer Utama dengan Padding Bawah Cukup untuk Bottom Nav */}
                    <main className="flex-1 w-full pt-3 md:pt-6 pb-28 sm:pb-16 print:pb-0 print:pt-0">
                        <div key={activeTab} className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 tab-fade-in pb-6">
                            <Suspense fallback={<ModuleLoadingFallback />}>
                                {renderContent()}
                            </Suspense>
                        </div>
                    </main>

                    {/* Native Floating/Docked Bottom Navigation Bar */}
                    <BottomNavBar
                        activeTab={activeTab}
                        changeTab={changeTab}
                        userRole={userRole}
                    />

                    {/* Spotlight Instant Search Modal (Ctrl+K) */}
                    <SpotlightSearchModal
                        isOpen={isSearchOpen}
                        onClose={() => setIsSearchOpen(false)}
                        NavItems={NavItems}
                        changeTab={changeTab}
                    />

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
                        <div className="fixed inset-0 bg-slate-950/65 dark:bg-black/80 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in no-print">
                            <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-[28px] overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-2xl flex flex-col max-h-[85vh] animate-modal-in">
                                {/* Mobile pull handle */}
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 sm:hidden"></div>
                                <div className="bg-red-50 dark:bg-red-950/30 px-6 py-4 border-b border-red-500/20 flex items-center justify-between shrink-0">
                                    <h3 className="text-[14px] font-bold text-red-700 dark:text-red-400 flex items-center gap-2"><Icon name="verified_user" className="text-[17px]" /> KEAMANAN DATA & LISENSI</h3>
                                    <button onClick={() => setShowLicenseModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-950/50 text-red-500 transition-colors"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 md:p-8 overflow-y-auto hide-scrollbar">
                                    <div className="prose prose-sm text-slate-600 dark:text-slate-300 text-justify leading-relaxed max-w-none">
                                        <p className="font-bold text-slate-800 dark:text-slate-200 text-[13px] mb-3">Website ini <span className="text-red-600 uppercase underline decoration-red-300 underline-offset-4">tidak diperjualbelikan</span>.</p>
                                        <p className="mb-3">Seluruh data di dalam sistem ini dilindungi secara ketat dan dikelola secara eksklusif oleh Admin Lingkungan.</p>
                                        <p className="mb-4 text-red-600 font-medium bg-red-50 dark:bg-red-950/20 p-3.5 rounded-xl border border-red-100 dark:border-red-900/30">Segala bentuk pencurian data, penyalahgunaan akses, atau tindak kriminal digital lainnya akan ditelusuri dan <span className="underline underline-offset-2 decoration-red-400">dilaporkan kepada pihak yang berwajib</span> sesuai perundang-undangan yang berlaku.</p>
                                        <p className="mb-6">Sistem ini diperuntukkan khusus untuk keperluan digitalisasi guna menunjang tata kelola lingkungan desa yang transparan dan akuntabel.</p>
                                        
                                        <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-4 text-center">
                                            <p className="text-[11px] font-medium text-slate-400 mb-1">COPYRIGHT &copy; 2026</p>
                                            <p className="text-[10px] text-slate-400 mb-2">Sistem & lisensi ditandatangani secara digital oleh pengembang resmi:</p>
                                            <p className="text-[16px] font-black tracking-widest text-red-600 uppercase">Novan Restu Utomo</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 sm:px-6 sm:pb-6 pt-0 shrink-0">
                                    <button onClick={() => setShowLicenseModal(false)} className="w-full min-h-[48px] bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-[14px] shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all cursor-pointer">Saya Mengerti</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {showLegalModal && (
                        <div className="fixed inset-0 bg-slate-950/65 dark:bg-black/80 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in no-print">
                            <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-[28px] overflow-hidden flex flex-col border border-slate-200/90 dark:border-slate-800 max-h-[85vh] shadow-2xl animate-modal-in">
                                {/* Mobile pull handle */}
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 sm:hidden"></div>
                                <div className="bg-slate-50 dark:bg-slate-850 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                                    <h3 className="text-[14px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Icon name={showLegalModal === 'terms' ? 'gavel' : 'privacy_tip'} className="text-red-500" /> 
                                        {showLegalModal === 'terms' ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'}
                                    </h3>
                                    <button onClick={() => setShowLegalModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar">
                                    <div className="prose prose-sm text-slate-600 dark:text-slate-300 text-justify leading-relaxed whitespace-pre-wrap">
                                        {showLegalModal === 'terms' ? legalData?.terms : legalData?.privacy}
                                    </div>
                                </div>
                                <div className="p-4 sm:px-6 sm:pb-6 border-t border-slate-200 dark:border-slate-800 shrink-0">
                                    <button onClick={() => setShowLegalModal(null)} className="w-full min-h-[48px] bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-[14px] shadow-lg shadow-red-500/25 active:scale-[0.98] transition-all cursor-pointer">Tutup & Lanjutkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <ToastContainer />
                    
                    {showPwaGuide && <PwaGuideModal onClose={() => setShowPwaGuide(false)} />}

                    {showLogoutModal && (
                        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print bg-slate-950/65 dark:bg-black/80 backdrop-blur-md animate-fade-in">
                            <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 text-center shadow-2xl animate-modal-in">
                                {/* Mobile pull handle */}
                                <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                                <div className="mb-4 bg-red-50 dark:bg-red-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-red-500/20 text-red-600 dark:text-red-400">
                                    <Icon name="logout" className="text-[28px]" fill="true" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1.5 tracking-tight">Keluar Sesi Portal?</h3>
                                <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mb-6 leading-relaxed font-medium">Sesi Anda akan diakhiri secara aman dan kembali ke gerbang masuk warga.</p>
                                <div className="flex flex-col sm:flex-row gap-2.5">
                                    <button onClick={() => setShowLogoutModal(false)} className="w-full sm:w-1/2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 min-h-[46px] py-3 px-5 rounded-2xl font-bold text-[13px] hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer">Batal</button>
                                    <button onClick={executeLogout} className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white min-h-[46px] py-3 px-5 rounded-2xl font-bold text-[13px] shadow-lg shadow-red-500/25 active:scale-95 transition-all cursor-pointer">Ya, Keluar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default App;
