import React, { useState, useEffect, useRef } from 'react';
import Icon from '../common/Icon.jsx';
import { triggerHaptic } from '../../utils/helpers.js';

export function SpotlightSearchModal({ isOpen, onClose, NavItems = [], changeTab }) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [isOpen]);

    // Shortcut Ctrl+K / Cmd+K listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (isOpen) onClose();
            } else if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const filteredItems = query.trim() === ''
        ? NavItems.slice(0, 8) // Tampilkan 8 item populer saat query kosong
        : NavItems.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase()) ||
            (item.desc && item.desc.toLowerCase().includes(query.toLowerCase())) ||
            item.id.toLowerCase().includes(query.toLowerCase())
        );

    const handleSelect = (item) => {
        triggerHaptic(12);
        changeTab(item.id);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-3 sm:p-4 pt-16 sm:pt-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fade-in no-print">
            <div 
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-modal-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Header Input */}
                <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-3 bg-slate-50/60 dark:bg-slate-850/60">
                    <Icon name="search" className="text-[22px] text-red-600 dark:text-red-400 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        placeholder="Cari layanan RT (misal: kas, arisan, tenda, lapor)..."
                        className="w-full bg-transparent text-[14px] sm:text-[15px] font-semibold text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                    />
                    {query ? (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                            <Icon name="close" className="text-[14px]" />
                        </button>
                    ) : (
                        <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                            ESC
                        </span>
                    )}
                </div>

                {/* Quick Filters / Tag Pills */}
                <div className="px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto hide-scrollbar text-[11px] font-semibold text-slate-500">
                    <span className="text-[10px] uppercase font-bold text-slate-400 px-1 shrink-0">Populer:</span>
                    {['Kas RT', 'Iuran', 'Buku Warga', 'Inventaris', 'Lapor'].map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => setQuery(tag)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 border border-slate-200/60 dark:border-slate-700 transition-all shrink-0 cursor-pointer"
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                {/* Results List */}
                <div className="p-2 sm:p-3 overflow-y-auto max-h-[50vh] divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredItems.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                            <Icon name="search_off" className="text-[36px] mx-auto opacity-50" />
                            <p className="text-[13px] font-semibold">Tidak menemukan modul "{query}"</p>
                            <p className="text-[11px]">Coba kata kunci lain seperti: kas, warga, toko, atau infaq.</p>
                        </div>
                    ) : (
                        filteredItems.map((item, idx) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelect(item)}
                                className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-left group ${
                                    selectedIndex === idx
                                        ? 'bg-red-50/70 dark:bg-red-950/30 border border-red-500/20'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0 pr-2">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${item.bg} ${item.color}`}>
                                        <Icon name={item.icon} className="text-[20px]" fill="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors truncate">
                                                {item.label}
                                            </span>
                                            {item.adminOnly && (
                                                <span className="text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                            {item.desc || 'Layanan digital warga'}
                                        </p>
                                    </div>
                                </div>
                                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all shrink-0">
                                    <Icon name="arrow_forward" className="text-[15px]" />
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Footer Guide */}
                <div className="p-3 sm:px-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <Icon name="touch_app" className="text-[14px]" /> Pilih modul untuk membuka instan
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-all"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SpotlightSearchModal;
