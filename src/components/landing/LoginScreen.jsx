import React, { useState, useEffect, useMemo, useRef } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import FlagWavingBackground from '../common/FlagWavingBackground.jsx';
import { auth, signInWithEmailAndPassword, signOut } from '../../firebase.js';

const Qna = React.lazy(() => import('../../Qna.jsx'));

        function LoginScreen({ onLogin, identity, setShowPwaGuide, legalData, setShowLegalModal, setShowLicenseModal, theme, setTheme, informasi = [], blogData = [], bannerImage = '', sponsorsData, members = [], infoDesa = null, landingConfig, nextMeeting, cycleNumber, infaqData = [], tokoProducts = [], nominalArisan, nominalJimpitan, arisanPeriod, currentRound, jimpitanBalance, kasRtBalance, meetingHistory, inventarisData, pinjamData }) {
            const [email, setEmail] = useState('');
            const [password, setPassword] = useState('');
            const [isLoading, setIsLoading] = useState(false);
            const [mode, setMode] = useState('select');
            const [selectedArticle, setSelectedArticle] = useState(null); // modal detail informasi/blog
            const [error, setError] = useState('');
            const [showMap, setShowMap] = useState(false); // Lazy-load Google Maps
            const [limitInformasi, setLimitInformasi] = useState(6);
            const [limitBlog, setLimitBlog] = useState(6);
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
                    <div className="fixed inset-0 z-[-2] bg-batik opacity-50 dark:opacity-30 pointer-events-none no-print"></div>

                    {/* ANIMASI WAYANG KULIT GLOBAL (LANDING) */}
                    <div className="fixed top-[12vh] md:top-[15vh] left-1/2 -translate-x-1/2 z-0 pointer-events-none opacity-10 dark:opacity-5 transition-all duration-1000 no-print">
                        <img src="./gunungan_transparent.png?v=4" alt="Gunungan" className="w-[85vw] md:w-[60vw] lg:w-[45vw] xl:w-[600px] max-w-[800px] h-auto object-contain dark:invert" />
                    </div>
                    <div className="fixed bottom-0 -left-4 sm:left-0 md:left-4 xl:left-8 z-0 pointer-events-none opacity-15 dark:opacity-10 transition-all duration-1000 no-print scale-x-[-1]">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kiri" className="w-[45vw] md:w-[35vw] lg:w-[30vw] xl:w-[450px] h-auto max-h-[45vh] md:max-h-[60vh] xl:max-h-[75vh] object-contain object-bottom animate-wayang dark:invert" />
                    </div>
                    <div className="fixed bottom-0 -right-4 sm:right-0 md:right-4 xl:right-8 z-0 pointer-events-none opacity-15 dark:opacity-10 transition-all duration-1000 no-print">
                        <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kanan" className="w-[45vw] md:w-[35vw] lg:w-[30vw] xl:w-[450px] h-auto max-h-[45vh] md:max-h-[60vh] xl:max-h-[75vh] object-contain object-bottom animate-wayang dark:invert" style={{ animationDelay: '1.5s' }} />
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
                                                            <img src={item.imageUrl} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
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
                                                                <img src={item.imageUrl} alt={item.judul} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                                                                <img src={item.imageUrl} alt={item.judul} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
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
                                                                <span className="flex items-center gap-0.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800 uppercase tracking-wider"><Icon name="payments" className="text-[11px]" /> COD</span>
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
                                        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-8 sm:p-12 text-center w-full">
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

                            {/* Q&A SECTION */}
                            <section className="space-y-6 pt-6 border-t border-slate-200/30 dark:border-slate-800/80 max-w-7xl mx-auto w-full px-4 sm:px-6">
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon name="quiz" className="text-google-blue text-[18px]" fill="true" />
                                    <p className="text-[9px] uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">Pusat Bantuan &amp; Tanya Jawab Warga</p>
                                </div>
                                <React.Suspense fallback={<div className="flex justify-center items-center h-48 text-slate-500 font-medium text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl">Memuat Tanya Jawab...</div>}>
                                    <Qna 
                                        userRole="warga" 
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
                            </section>

                            {/* ADSENSE PLACEHOLDER */}
                            <section className="py-4 text-center border-t border-slate-200/30 max-w-xl mx-auto w-full px-4">
                                <p className="text-[9px] font-medium tracking-widest text-slate-500 dark:text-slate-400 uppercase mb-2">{landingConfig.footerInfoTitle}</p>
                                <div className="w-full py-2.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center text-slate-500 dark:text-slate-400 text-[10.5px] font-medium px-4 shadow-sm ">
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
                            <div className="flex flex-wrap items-center justify-center gap-5">
                                <button onClick={() => setMode(mode === 'admin_login' ? 'select' : 'admin_login')} className="flex flex-wrap items-center justify-center gap-1.5 hover:text-red-500 transition-colors active:scale-95 group">
                                    <Icon name="admin_panel_settings" className="text-[13px] group-hover:scale-110 transition-transform" /> <span className="underline decoration-dashed underline-offset-4">Otorisasi Admin</span>
                                </button>
                                <button onClick={() => setShowLicenseModal && setShowLicenseModal(true)} className="flex flex-wrap items-center justify-center gap-1.5 hover:text-red-500 transition-colors active:scale-95 group">
                                    <Icon name="lock" className="text-[13px] group-hover:scale-110 transition-transform" /> <span className="underline decoration-dashed underline-offset-4">&copy; 2026 Keamanan Data & Hak Cipta</span>
                                </button>
                            </div>
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


export default LoginScreen;
