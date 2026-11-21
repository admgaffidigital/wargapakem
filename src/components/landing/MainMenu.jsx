import React, { useState, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { formatRp, triggerHaptic, formatBulanTahun } from '../../utils/helpers.js';

export function MainMenu({
    userRole,
    NavItems = [],
    changeTab,
    identity = {},
    bannerImage,
    setShowPwaGuide,
    sponsorsData,
    nextMeeting,
    kasRtBalance = 0,
    jimpitanBalance = 0,
    members = [],
    currentRound = 1,
    cycleNumber = 1,
    arisanPeriod = ''
}) {
    // State untuk menyembunyikan/menampilkan saldo (Fitur Privasi Native App)
    const [showBalance, setShowBalance] = useState(() => {
        try {
            return localStorage.getItem('warga_show_balance') !== 'false';
        } catch (e) {
            return true;
        }
    });

    const toggleBalance = () => {
        triggerHaptic(10);
        setShowBalance(prev => {
            const next = !prev;
            try { localStorage.setItem('warga_show_balance', String(next)); } catch (e) {}
            return next;
        });
    };

    // Filter Kategori Layanan
    const [selectedCategory, setSelectedCategory] = useState('semua');
    const [searchFilter, setSearchFilter] = useState('');

    // Mode tampilan menu: 'auto' (HP = list, Desktop = grid), 'list', atau 'grid'
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('warga_menu_view_mode') || 'auto';
        } catch (e) {
            return 'auto';
        }
    });

    const handleSetViewMode = (mode) => {
        triggerHaptic(8);
        setViewMode(mode);
        try {
            localStorage.setItem('warga_menu_view_mode', mode);
        } catch (e) {}
    };

    // Total dana kelolaan
    const totalDana = Number(kasRtBalance || 0) + Number(jimpitanBalance || 0);

    // Kategori Map
    const categoryMap = {
        keuangan: ['kas', 'iuran', 'infaq', 'laporan', 'dashboard'],
        warga: ['warga', 'pemenang', 'pertemuan'],
        fasilitas: ['inventaris', 'pinjam', 'toko', 'tiket'],
        informasi: ['informasi', 'pengaduan', 'kegiatan', 'kalender', 'wagroup', 'qna', 'pengaturan']
    };

    const categories = [
        { id: 'semua', label: 'Semua Fitur', icon: 'apps' },
        { id: 'keuangan', label: '💰 Keuangan', icon: 'account_balance_wallet' },
        { id: 'warga', label: '👥 Warga & Arisan', icon: 'group' },
        { id: 'fasilitas', label: '🏪 Fasilitas & UMKM', icon: 'storefront' },
        { id: 'informasi', label: '📢 Informasi & Lapor', icon: 'campaign' },
    ];

    const filteredItems = useMemo(() => {
        return NavItems.filter(item => {
            const matchesCategory = selectedCategory === 'semua' || (categoryMap[selectedCategory] && categoryMap[selectedCategory].includes(item.id));
            const matchesSearch = searchFilter.trim() === '' || 
                item.label.toLowerCase().includes(searchFilter.toLowerCase()) || 
                (item.desc && item.desc.toLowerCase().includes(searchFilter.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [NavItems, selectedCategory, searchFilter]);

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12">
            
            {/* ========================================================
                1. BENTO HERO CARD — STATUS KEUANGAN & ARISAN NATIVE APP
               ======================================================== */}
            <div className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-5 sm:p-8 border border-slate-800 shadow-xl shadow-slate-950/20">
                {/* Aksen Latar Belakang Gradien Bersih */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-red-600/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-12 -mb-12"></div>

                <div className="relative z-10 flex flex-col gap-6">
                    {/* Header Bento: Sapaan & Status Lingkungan */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/15">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                RT 02 / RW 01 PAKEM
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                                {formatBulanTahun(arisanPeriod) || 'Periode Berjalan'}
                            </span>
                        </div>

                        {/* Indikator Siklus Arisan */}
                        <div className="flex items-center gap-2 text-[11px] font-bold text-amber-300 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30">
                            <Icon name="event_repeat" className="text-[14px]" />
                            <span>Siklus {cycleNumber} • Putaran {currentRound}</span>
                        </div>
                    </div>

                    {/* Nominal Kas Global & Intip Saldo */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Total Dana Kas & Jimpitan
                                </span>
                                <button
                                    type="button"
                                    onClick={toggleBalance}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                    title={showBalance ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
                                >
                                    <Icon name={showBalance ? "visibility" : "visibility_off"} className="text-[16px]" />
                                </button>
                            </div>
                            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-sm font-sans">
                                {showBalance ? formatRp(totalDana) : "Rp ••••••••"}
                            </div>
                        </div>

                        {/* Sub Saldo Badges */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <div className="bg-white/5 hover:bg-white/10 transition-colors px-3.5 py-2 rounded-2xl border border-white/10">
                                <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Kas Utama RT</span>
                                <span className="text-[13px] font-black text-emerald-400">
                                    {showBalance ? formatRp(kasRtBalance) : "••••••"}
                                </span>
                            </div>
                            <div className="bg-white/5 hover:bg-white/10 transition-colors px-3.5 py-2 rounded-2xl border border-white/10">
                                <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Kas Jimpitan</span>
                                <span className="text-[13px] font-black text-amber-300">
                                    {showBalance ? formatRp(jimpitanBalance) : "••••••"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 4 QUICK ACTION SHORTCUTS (Aksi Tercepat Warga) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 pt-2">
                        {[
                            { label: 'Kas RT', desc: 'Arus Kas', icon: 'account_balance_wallet', tab: 'kas', bg: 'bg-red-500/20 text-red-300 border-red-500/30' },
                            { label: 'Iuran RT', desc: 'Bayar Iuran', icon: 'volunteer_activism', tab: 'iuran', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                            { label: 'Pinjam Alat', desc: 'Tenda & Kursi', icon: 'handshake', tab: 'pinjam', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
                            { label: 'Lapor RT', desc: 'Pengaduan', icon: 'report_problem', tab: 'pengaduan', bg: 'bg-sky-500/20 text-sky-300 border-sky-500/30' }
                        ].map((action) => (
                            <button
                                key={action.tab}
                                type="button"
                                onClick={() => { triggerHaptic(12); changeTab(action.tab); }}
                                className="flex items-center sm:flex-col sm:justify-center gap-3 sm:gap-1.5 p-3 sm:p-3.5 rounded-2xl bg-white/10 hover:bg-white/18 border border-white/15 backdrop-blur-md transition-all duration-200 active:scale-95 group cursor-pointer shadow-xs"
                            >
                                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border shadow-xs transition-transform group-hover:scale-105 shrink-0 ${action.bg}`}>
                                    <Icon name={action.icon} className="text-[20px] sm:text-[22px]" fill="true" />
                                </div>
                                <div className="min-w-0 text-left sm:text-center">
                                    <span className="text-[12.5px] sm:text-[13px] font-bold text-white block truncate">
                                        {action.label}
                                    </span>
                                    <span className="text-[10px] text-slate-300 block truncate">
                                        {action.desc}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================================================
                2. LIVE AGENDA & PENGUMUMAN BERJALAN
               ======================================================== */}
            {nextMeeting && nextMeeting.date && nextMeeting.date !== 'Belum dijadwalkan' && (
                <div 
                    onClick={() => { triggerHaptic(8); changeTab('kegiatan'); }}
                    className="cursor-pointer bg-gradient-to-r from-red-50 via-rose-50/50 to-red-50 dark:from-red-950/40 dark:via-slate-900 dark:to-red-950/40 border border-red-200/80 dark:border-red-900/40 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs hover:border-red-500/40 transition-all active:scale-[0.99]"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                            <Icon name="campaign" className="text-[20px]" fill="true" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-red-600 text-white">
                                    Agenda Mendatang
                                </span>
                                <span className="text-[12px] font-bold text-slate-900 dark:text-white truncate">
                                    {nextMeeting.date} ({nextMeeting.time})
                                </span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate mt-0.5">
                                Lokasi: {nextMeeting.location} • {nextMeeting.notes}
                            </p>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Icon name="chevron_right" className="text-[18px]" />
                    </div>
                </div>
            )}

            {/* ========================================================
                3. HUB LAYANAN WARGA — HEADER, FILTER, & SEARCH
               ======================================================== */}
            <div className="space-y-4 pt-1">
                {/* Search & Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-6 bg-red-600 rounded-full"></div>
                        <div>
                            <h3 className="text-[16px] sm:text-[18px] font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                <span>Katalog Layanan Digital</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-500/20">
                                    {filteredItems.length}
                                </span>
                            </h3>
                            <p className="text-[11px] sm:text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                Akses lengkap seluruh modul administrasi & fasilitas warga RT Pakem
                            </p>
                        </div>
                    </div>

                    {/* View Switcher: Auto, List, Grid */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                            <button
                                type="button"
                                onClick={() => handleSetViewMode('auto')}
                                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === 'auto'
                                        ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                                title="Otomatis: Mode Baris di HP & Grid di Layar Lebar"
                            >
                                <Icon name="tune" className="text-[14px]" />
                                <span className="hidden sm:inline">Auto</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('list')}
                                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === 'list'
                                        ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                                title="Tampilan Baris"
                            >
                                <Icon name="view_list" className="text-[15px]" />
                                <span>List</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSetViewMode('grid')}
                                className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                    viewMode === 'grid'
                                        ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                                title="Tampilan Kotak"
                            >
                                <Icon name="grid_view" className="text-[15px]" />
                                <span>Grid</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Inline Search Bar */}
                <div className="relative">
                    <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" />
                    <input
                        type="text"
                        value={searchFilter}
                        onChange={e => setSearchFilter(e.target.value)}
                        placeholder="Ketik untuk memfilter layanan (misal: kas, buku warga, toko, arisan)..."
                        className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-[13px] font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-red-500 dark:focus:border-red-500 shadow-2xs"
                    />
                    {searchFilter && (
                        <button
                            type="button"
                            onClick={() => setSearchFilter('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center"
                        >
                            <Icon name="close" className="text-[13px]" />
                        </button>
                    )}
                </div>

                {/* Category Pills Slider */}
                <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 text-[12px] font-bold">
                    {categories.map((cat) => {
                        const active = selectedCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => { triggerHaptic(8); setSelectedCategory(cat.id); }}
                                className={`px-3.5 py-2 rounded-xl shrink-0 transition-all cursor-pointer border ${
                                    active
                                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <span>{cat.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ========================================================
                4. DAFTAR MODUL — LIST VIEW ATAU GRID VIEW
               ======================================================== */}
            {filteredItems.length === 0 ? (
                <div className="bg-white/80 dark:bg-slate-900/80 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-2">
                    <Icon name="search_off" className="text-[40px] text-slate-300 dark:text-slate-600 mx-auto" />
                    <h4 className="text-[15px] font-bold text-slate-800 dark:text-white">Tidak Ada Layanan yang Cocok</h4>
                    <p className="text-[12px] text-slate-400">Silakan bersihkan kolom pencarian atau ganti kategori di atas.</p>
                </div>
            ) : (
                <>
                    {/* TAMPILAN 1: LIST VIEW (ERGONOMIS SATU JEMPOL UNTUK HP) */}
                    <div
                        className={`flex-col gap-2.5 ${
                            viewMode === 'list'
                                ? 'flex'
                                : viewMode === 'grid'
                                ? 'hidden'
                                : 'flex sm:hidden'
                        }`}
                    >
                        {filteredItems.map((item, idx) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => { triggerHaptic(10); changeTab(item.id); }}
                                style={{ animationDelay: `${idx * 0.02}s` }}
                                className="menu-item-in w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-red-500/30 dark:hover:border-red-500/30 active:scale-[0.985] transition-all text-left group cursor-pointer"
                            >
                                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 group-hover:-rotate-2 ${item.bg} ${item.color}`}>
                                        <Icon name={item.icon} className="text-[22px]" fill="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors tracking-tight truncate">
                                                {item.label}
                                            </span>
                                            {item.adminOnly && (
                                                <span className="text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                            {item.desc || 'Layanan digital lingkungan'}
                                        </p>
                                    </div>
                                </div>

                                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400 group-hover:border-red-500/30 group-hover:translate-x-0.5 transition-all shrink-0">
                                    <Icon name="chevron_right" className="text-[18px]" />
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* TAMPILAN 2: GRID VIEW (BENTO LAPANG UNTUK TABLET & DESKTOP) */}
                    <div
                        className={`gap-3.5 sm:gap-5 ${
                            viewMode === 'grid'
                                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                                : viewMode === 'list'
                                ? 'hidden'
                                : 'hidden sm:grid sm:grid-cols-3 md:grid-cols-4'
                        }`}
                    >
                        {filteredItems.map((item, idx) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => { triggerHaptic(10); changeTab(item.id); }}
                                style={{ animationDelay: `${idx * 0.025}s` }}
                                className="menu-item-in relative overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-lg hover:border-red-500/40 dark:hover:border-red-500/40 hover:-translate-y-1 transition-all duration-300 flex flex-col items-center justify-center text-center gap-2.5 active:scale-95 group cursor-pointer"
                            >
                                {item.adminOnly && (
                                    <span className="absolute top-3 right-3 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20">
                                        Admin
                                    </span>
                                )}

                                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 shadow-xs group-hover:shadow-md ${item.bg} ${item.color}`}>
                                    <Icon name={item.icon} className="text-[24px] sm:text-[26px]" fill="true" />
                                </div>

                                <div className="space-y-0.5 w-full px-1">
                                    <span className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors tracking-tight block truncate">
                                        {item.label}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 line-clamp-1 block">
                                        {item.desc || 'Layanan warga'}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </>
            )}


            {/* Verifikasi Keaslian & Lisensi Lingkungan */}
            <div className="flex justify-center pt-2">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md py-2 px-5 rounded-full text-center border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-center gap-2">
                    <Icon name="verified" className="text-[15px] text-emerald-500" fill="true" />
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Portal Warga RT Pakem • Sistem Terverifikasi Digital
                    </span>
                </div>
            </div>
        </div>
    );
}

export default MainMenu;
