import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';

function MainMenu({ userRole, NavItems = [], changeTab, identity = {}, bannerImage, setShowPwaGuide, sponsorsData, nextMeeting }) {
    // Mode tampilan menu: 'auto' (HP = list, Desktop = grid), 'list', atau 'grid'
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('warga_menu_view_mode') || 'auto';
        } catch (e) {
            return 'auto';
        }
    });

    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('warga_menu_view_mode', mode);
        } catch (e) {}
    };

    return (
        <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto mt-2">
            {/* --- AREA BANNER UTAMA --- */}
            <div className={`relative rounded-3xl p-6 sm:p-10 text-white border border-red-400/20 shadow-xl shadow-red-500/20 dark:border-red-900/30 overflow-hidden group min-h-[200px] sm:min-h-[260px] flex items-end ${!bannerImage ? 'bg-red-600' : 'bg-slate-900'}`}>
                {bannerImage && (
                    <>
                        <img src={bannerImage} alt="Banner Lingkungan" className="absolute inset-0 w-full h-full object-cover object-center z-0 group-hover:scale-105 transition-transform duration-1000" />
                        <div className="absolute inset-0 bg-slate-950/65 z-0"></div>
                    </>
                )}

                <div className="relative z-10 w-full text-left pb-1">
                    <div className="inline-flex items-center gap-1.5 bg-red-800/90 backdrop-blur-md px-3.5 py-1.5 rounded-full mb-2.5 border border-white/20 shadow-sm w-fit">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/95">Sistem Aktif</span>
                    </div>
                    
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1.5 tracking-tight text-white uppercase [text-shadow:_0_4px_12px_rgba(0,0,0,0.4)]">
                        Halo, {userRole === 'admin' ? 'Pengurus RT!' : 'Warga!'}
                    </h2>
                    <p className="text-[12.5px] sm:text-[13.5px] font-medium text-white/95 leading-relaxed max-w-2xl [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
                        {identity?.subtitle || 'Sistem Informasi Manajemen Kerukunan Lingkungan'}
                    </p>
                </div>
            </div>

            {/* --- AREA RUNNING TEXT AGENDA --- */}
            {nextMeeting && nextMeeting.date && nextMeeting.date !== 'Belum dijadwalkan' && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-800 dark:text-red-300 rounded-2xl px-4 py-2.5 flex items-center gap-3 overflow-hidden shadow-sm">
                    <Icon name="campaign" className="text-red-600 dark:text-red-400 shrink-0 animate-pulse text-[18px]" />
                    <marquee className="text-[12px] font-semibold tracking-wide whitespace-nowrap uppercase">
                        Info Agenda Mendatang: <span className="font-bold text-red-700 dark:text-red-300">{nextMeeting.date}</span> pukul <span className="font-bold text-red-700 dark:text-red-300">{nextMeeting.time}</span> di <span className="font-bold text-red-700 dark:text-red-300">{nextMeeting.location}</span>. Agenda: {nextMeeting.notes}
                    </marquee>
                </div>
            )}

            {/* --- HEADER SEKSI MENU & VIEW SWITCHER TOGGLE --- */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-6 bg-red-600 rounded-full"></div>
                    <div>
                        <h3 className="text-[15px] sm:text-[17px] font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            <span>Layanan & Fitur Lingkungan</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {NavItems.length}
                            </span>
                        </h3>
                        <p className="text-[11px] sm:text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Pilih modul layanan warga atau pengelolaan administrasi RT
                        </p>
                    </div>
                </div>

                {/* View Switcher: Auto, List, Grid */}
                <div className="inline-flex items-center self-start sm:self-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                    <button
                        type="button"
                        onClick={() => handleSetViewMode('auto')}
                        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                            viewMode === 'auto'
                                ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title="Otomatis: Mode Baris (HP) dan Kotak (Tablet/Desktop)"
                    >
                        <Icon name="tune" className="text-[14px]" />
                        <span>Otomatis</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSetViewMode('list')}
                        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                            viewMode === 'list'
                                ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title="Tampilan Baris (List View)"
                    >
                        <Icon name="view_list" className="text-[15px]" />
                        <span>List</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSetViewMode('grid')}
                        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                            viewMode === 'grid'
                                ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title="Tampilan Kotak (Grid View)"
                    >
                        <Icon name="grid_view" className="text-[15px]" />
                        <span>Grid</span>
                    </button>
                </div>
            </div>

            {/* --- TAMPILAN 1: LIST VIEW (ERGONOMIS UNTUK HP / TOUCHSCREEN) --- */}
            <div
                className={`flex-col gap-2.5 ${
                    viewMode === 'list'
                        ? 'flex'
                        : viewMode === 'grid'
                        ? 'hidden'
                        : 'flex sm:hidden'
                }`}
            >
                {NavItems.map((item, idx) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => changeTab(item.id)}
                        style={{ animationDelay: `${idx * 0.025}s` }}
                        className="menu-item-in w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-red-500/30 dark:hover:border-red-500/30 active:scale-[0.985] transition-all text-left group cursor-pointer"
                    >
                        <div className="flex items-center gap-3.5 min-w-0 pr-2">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 group-hover:-rotate-3 ${item.bg} ${item.color}`}>
                                <Icon name={item.icon} className="text-[22px]" fill="true" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors tracking-tight truncate">
                                        {item.label}
                                    </span>
                                    {item.adminOnly && (
                                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {item.desc || 'Layanan portal warga'}
                                </p>
                            </div>
                        </div>

                        <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-red-600 dark:group-hover:text-red-400 group-hover:border-red-500/30 group-hover:translate-x-0.5 transition-all shrink-0">
                            <Icon name="chevron_right" className="text-[18px]" />
                        </div>
                    </button>
                ))}
            </div>

            {/* --- TAMPILAN 2: GRID VIEW (LAPANG UNTUK TABLET & DESKTOP) --- */}
            <div
                className={`gap-4 sm:gap-6 ${
                    viewMode === 'grid'
                        ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                        : viewMode === 'list'
                        ? 'hidden'
                        : 'hidden sm:grid sm:grid-cols-3 md:grid-cols-4'
                }`}
            >
                {NavItems.map((item, idx) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => changeTab(item.id)}
                        style={{ animationDelay: `${idx * 0.035}s` }}
                        className="menu-item-in relative overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-red-500/30 dark:hover:border-red-500/30 hover:-translate-y-1.5 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3 active:scale-95 group cursor-pointer"
                    >
                        {item.adminOnly && (
                            <span className="absolute top-3.5 right-3.5 text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20">
                                Admin
                            </span>
                        )}

                        <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 shadow-sm group-hover:shadow-md ${item.bg} ${item.color}`}>
                            <Icon name={item.icon} className="relative z-10 text-[26px] sm:text-[30px] drop-shadow-sm" fill="true" />
                        </div>

                        <div className="space-y-1 w-full px-1">
                            <span className="text-[13px] sm:text-[14px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors tracking-tight block truncate">
                                {item.label}
                            </span>
                            <span className="text-[10.5px] sm:text-[11px] font-medium text-slate-400 dark:text-slate-500 line-clamp-1 block">
                                {item.desc || 'Layanan warga'}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Indikator Mode Hak Akses */}
            {userRole !== 'admin' && (
                <div className="flex justify-center mt-12 mb-4">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md py-2 px-4 rounded-full text-center border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-center gap-1.5">
                            <Icon name="verified_user" className="text-[14px] text-green-500" />
                            <span>Portal Warga RT Pakem — Akses Terverifikasi</span>
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MainMenu;
