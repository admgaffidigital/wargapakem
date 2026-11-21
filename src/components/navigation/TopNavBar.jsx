import React from 'react';
import Icon from '../common/Icon.jsx';
import { triggerHaptic } from '../../utils/helpers.js';

export function TopNavBar({
    activeTab,
    changeTab,
    identity = {},
    userRole = 'warga',
    theme,
    setTheme,
    onOpenSearch,
    onOpenLogout,
    activeTabTitle = '',
    isOffline = false
}) {
    const isHome = activeTab === 'menu';
    const isLayanan = activeTab === 'layanan';

    // Desktop Segmented Links
    const desktopLinks = [
        { key: 'menu', target: 'menu', label: 'Beranda', icon: 'home', matches: ['menu', 'dashboard'] },
        { key: 'kas', target: 'kas', label: 'Keuangan', icon: 'account_balance_wallet', matches: ['kas', 'iuran', 'infaq', 'laporan'] },
        { key: 'layanan', target: 'layanan', label: 'Layanan', icon: 'grid_view', matches: ['layanan', 'inventaris', 'pinjam', 'toko', 'tiket', 'pengaduan'] },
        { key: 'agenda', target: 'kegiatan', label: 'Agenda', icon: 'calendar_month', matches: ['kegiatan', 'kalender', 'galery', 'blog', 'informasi'] },
        { key: 'warga', target: 'warga', label: userRole === 'admin' ? 'Pengurus' : 'Buku Warga', icon: 'group', matches: ['warga', 'pemenang', 'peta', 'wagroup', 'qna', 'pertemuan', 'musik', 'pengaturan'] }
    ];

    const handleBack = () => {
        triggerHaptic(10);
        changeTab('menu');
    };

    return (
        <div className="sticky top-0 z-40 no-print w-full pt-2 sm:pt-3 px-3 sm:px-6 lg:px-8 select-none">
            {/* Offline Alert Strip */}
            {isOffline && (
                <div className="mb-2 bg-red-600 text-white text-center py-1.5 px-4 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 shadow-sm animate-pulse">
                    <Icon name="wifi_off" className="text-[14px]" />
                    <span>Mode Offline Aktif — Menampilkan data tersimpan di perangkat</span>
                </div>
            )}

            <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm rounded-2xl sm:rounded-3xl relative overflow-hidden transition-all duration-300">
                {/* Aksen Strip Merah-Emas Nusantara */}
                <div className="h-1 w-full absolute top-0 left-0 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>

                <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3">
                    {/* BAGIAN KIRI: Logo/Identitas ATAU Tombol Kembali */}
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        {isHome || isLayanan ? (
                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-red-50 to-amber-50 dark:from-red-950/60 dark:to-slate-800 border border-red-500/20 p-1 flex items-center justify-center shrink-0 shadow-xs">
                                    <img
                                        src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"}
                                        alt="Logo RT"
                                        className={identity?.logoApp ? "w-full h-full object-cover rounded-xl" : "w-7 h-7 sm:w-8 sm:h-8 object-contain"}
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-[14px] sm:text-[15.5px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                                            {identity?.name || 'WARGA PAKEM'}
                                        </h1>
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Portal Real-Time Online"></span>
                                    </div>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                        {identity?.subtitle || 'RT Pakem, Banyuanyar, Gurah'}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-100/80 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 rounded-2xl flex items-center justify-center border border-slate-200/80 dark:border-slate-700 transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs"
                                    title="Kembali ke Beranda"
                                >
                                    <Icon name="arrow_back" className="text-[19px] sm:text-[20px]" />
                                </button>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        <h2 className="text-[14px] sm:text-[16px] font-black text-slate-900 dark:text-white tracking-tight uppercase truncate">
                                            {activeTabTitle || 'Layanan Warga'}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="text-[10.5px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors truncate"
                                    >
                                        <span>Beranda</span>
                                        <span>&bull;</span>
                                        <span className="text-red-600 dark:text-red-400">Kembali</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* BAGIAN TENGAH: Desktop Segmented Links (Hanya muncul di Desktop / Layar Lebar) */}
                    <div className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                        {desktopLinks.map((link) => {
                            const isMatch = link.matches.includes(activeTab);
                            return (
                                <button
                                    key={link.key}
                                    type="button"
                                    onClick={() => { triggerHaptic(10); changeTab(link.target); }}
                                    className={`px-3.5 py-1.5 rounded-xl font-bold text-[12px] flex items-center gap-1.5 transition-all cursor-pointer ${
                                        isMatch
                                            ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    <Icon name={link.icon} className="text-[15px]" fill={isMatch ? "true" : "false"} />
                                    <span>{link.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* BAGIAN KANAN: Search, Status, Tema, & Logout */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {/* Tombol Pencarian Cepat Spotlight (Ctrl+K) */}
                        <button
                            type="button"
                            onClick={() => { triggerHaptic(8); onOpenSearch(); }}
                            className="h-9 sm:h-10 px-2.5 sm:px-3 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl flex items-center gap-1.5 text-[12px] font-bold border border-slate-200/70 dark:border-slate-700 transition-all active:scale-95 cursor-pointer shadow-xs"
                            title="Cari Layanan (Ctrl+K)"
                        >
                            <Icon name="search" className="text-[17px] text-red-500 dark:text-red-400" />
                            <span className="hidden sm:inline">Cari</span>
                            <span className="hidden sm:inline text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                ⌘K
                            </span>
                        </button>

                        {/* Badge Peran */}
                        <span
                            className={`hidden sm:inline-flex text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border shadow-2xs ${
                                userRole === 'admin'
                                    ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-500/30'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            }`}
                        >
                            {userRole === 'admin' ? 'Pengurus' : 'Warga'}
                        </span>

                        {/* Toggle Tema (Dark / Light) */}
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic(8);
                                setTheme(theme === 'dark' ? 'light' : 'dark');
                            }}
                            className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl flex items-center justify-center transition-all active:scale-95 border border-slate-200/70 dark:border-slate-700 shadow-xs cursor-pointer"
                            title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
                        >
                            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[17px] sm:text-[18px]" />
                        </button>

                        {/* Tombol Logout */}
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic(8);
                                onOpenLogout();
                            }}
                            className="w-9 h-9 sm:w-10 sm:h-10 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white rounded-xl flex items-center justify-center transition-all active:scale-95 border border-red-500/25 shadow-xs cursor-pointer group"
                            title="Keluar Sesi"
                        >
                            <Icon name="logout" className="text-[17px] sm:text-[18px] group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>
            </header>
        </div>
    );
}

export default TopNavBar;
