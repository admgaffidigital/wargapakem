import React from 'react';
import Icon from '../common/Icon.jsx';
import { triggerHaptic } from '../../utils/helpers.js';

export function BottomNavBar({ activeTab, changeTab, userRole = 'warga' }) {
    // Definisi 5 Tab Utama Navigasi Bawah (Native App Mobile Style)
    const navTabs = [
        {
            key: 'menu',
            target: 'menu',
            label: 'Beranda',
            icon: 'home',
            matches: ['menu', 'dashboard']
        },
        {
            key: 'kas',
            target: 'kas',
            label: 'Keuangan',
            icon: 'account_balance_wallet',
            matches: ['kas', 'iuran', 'infaq', 'laporan']
        },
        {
            key: 'layanan',
            target: 'layanan',
            label: 'Layanan',
            icon: 'grid_view',
            matches: ['layanan', 'inventaris', 'pinjam', 'toko', 'tiket', 'pengaduan']
        },
        {
            key: 'agenda',
            target: 'kegiatan',
            label: 'Agenda',
            icon: 'calendar_month',
            matches: ['kegiatan', 'kalender', 'galery', 'blog', 'informasi']
        },
        {
            key: 'warga',
            target: 'warga',
            label: userRole === 'admin' ? 'Kelola' : 'Warga',
            icon: userRole === 'admin' ? 'admin_panel_settings' : 'group',
            matches: ['warga', 'pemenang', 'peta', 'wagroup', 'qna', 'pertemuan', 'musik', 'pengaturan']
        }
    ];

    const isTabActive = (tab) => {
        return tab.matches.includes(activeTab);
    };

    const handleTabClick = (tab) => {
        triggerHaptic(14);
        changeTab(tab.target);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 no-print select-none">
            {/* Soft Ambient Diffuse Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/80 to-transparent dark:from-slate-950/95 dark:via-slate-950/80 pointer-events-none -top-4"></div>

            <nav
                aria-label="Navigasi Utama Ponsel"
                className="relative max-w-lg mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-10px_35px_rgba(0,0,0,0.06)] dark:shadow-[0_-10px_35px_rgba(0,0,0,0.4)] px-2 sm:px-4 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom,0.6rem))] flex items-center justify-around sm:rounded-t-3xl"
            >
                {navTabs.map((tab) => {
                    const active = isTabActive(tab);
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => handleTabClick(tab)}
                            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 group relative ${
                                active
                                    ? 'text-red-600 dark:text-red-400 font-bold'
                                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
                            }`}
                        >
                            {/* Icon Wrapper dengan Active Pill Indicator */}
                            <div className="relative flex items-center justify-center">
                                <div
                                    className={`w-11 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                                        active
                                            ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 scale-105 shadow-xs'
                                            : 'group-hover:bg-slate-100 dark:group-hover:bg-slate-800/60'
                                    }`}
                                >
                                    <Icon
                                        name={tab.icon}
                                        className={`text-[21px] transition-transform duration-200 ${
                                            active ? 'scale-110' : 'group-hover:scale-105'
                                        }`}
                                        fill={active ? "true" : "false"}
                                    />
                                </div>

                                {/* Active Tiny Accent Dot */}
                                {active && (
                                    <span className="absolute -bottom-0.5 w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full animate-pop-in"></span>
                                )}
                            </div>

                            {/* Label Tab */}
                            <span
                                className={`text-[10px] sm:text-[10.5px] mt-0.5 tracking-tight transition-colors duration-200 ${
                                    active ? 'font-black' : 'font-semibold'
                                }`}
                            >
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

export default BottomNavBar;
