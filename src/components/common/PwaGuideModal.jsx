import React, { useState } from 'react';
import Icon from './Icon.jsx';
import { triggerHaptic } from '../../utils/helpers.js';

function PwaGuideModal({ onClose }) {
    const [tab, setTab] = useState('android');
    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
            <div className="rounded-t-[32px] sm:rounded-[28px] w-full max-w-xl flex flex-col max-h-[90vh] border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl overflow-hidden">
                {/* Mobile Pull Bar */}
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 sm:hidden"></div>

                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-900/60">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 tracking-tight">
                        <Icon name="install_mobile" className="text-red-600 dark:text-red-400" />
                        <span>Panduan Pasang Aplikasi (PWA)</span>
                    </h3>
                    <button
                        onClick={() => { triggerHaptic(); onClose(); }}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-all active:scale-95"
                    >
                        <Icon name="close" className="text-[17px]" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto hide-scrollbar flex-1 space-y-5">
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                        Aplikasi ini dapat dipasang langsung ke perangkat Anda (Android, iOS/iPhone, maupun PC/Laptop) tanpa melalui Play Store atau App Store. Sangat ringan, hemat memori, dan cepat!
                    </p>

                    <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                        <button
                            onClick={() => { triggerHaptic(); setTab('android'); }}
                            className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                tab === 'android'
                                    ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                            }`}
                        >
                            <Icon name="android" className="text-[16px]" />
                            <span>Android</span>
                        </button>
                        <button
                            onClick={() => { triggerHaptic(); setTab('ios'); }}
                            className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                tab === 'ios'
                                    ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                            }`}
                        >
                            <Icon name="apple" className="text-[16px]" />
                            <span>iOS / iPhone</span>
                        </button>
                        <button
                            onClick={() => { triggerHaptic(); setTab('pc'); }}
                            className={`flex-1 py-2 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                tab === 'pc'
                                    ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                            }`}
                        >
                            <Icon name="laptop_mac" className="text-[16px]" />
                            <span>PC / Laptop</span>
                        </button>
                    </div>

                    {tab === 'android' && (
                        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                            <h4 className="font-bold text-slate-800 dark:text-white text-[13px]">Pengguna Google Chrome (Android):</h4>
                            <ol className="list-decimal pl-5 space-y-2 text-[12.5px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                <li>Buka web ini di browser <b>Google Chrome</b>.</li>
                                <li>Akan muncul banner <b>"Pasang Aplikasi"</b> di bagian bawah layar. Ketuk tombol <b>Install</b>.</li>
                                <li>Atau, ketuk ikon <b>titik tiga</b> di pojok kanan atas browser Chrome.</li>
                                <li>Pilih menu <b>"Tambahkan ke Layar Utama"</b> (Add to Home screen) atau <b>"Instal Aplikasi"</b>.</li>
                                <li>Aplikasi siap digunakan layaknya aplikasi resmi dari layar utama!</li>
                            </ol>
                        </div>
                    )}

                    {tab === 'ios' && (
                        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                            <h4 className="font-bold text-slate-800 dark:text-white text-[13px]">Pengguna iPhone &amp; iPad (Safari):</h4>
                            <ol className="list-decimal pl-5 space-y-2 text-[12.5px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                <li>Buka web ini menggunakan browser bawaan <b>Safari</b>.</li>
                                <li>Ketuk ikon <b>Bagikan</b> (kotak dengan panah ke atas) di bagian bawah layar Safari.</li>
                                <li>Gulir ke bawah dan ketuk <b>"Tambah ke Layar Utama"</b> (Add to Home Screen).</li>
                                <li>Ketuk tombol <b>Tambah</b> di pojok kanan atas.</li>
                                <li>Ikon aplikasi kini tampil di beranda iPhone Anda!</li>
                            </ol>
                        </div>
                    )}

                    {tab === 'pc' && (
                        <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                            <h4 className="font-bold text-slate-800 dark:text-white text-[13px]">Pengguna PC / Laptop (Chrome / Edge):</h4>
                            <ol className="list-decimal pl-5 space-y-2 text-[12.5px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                <li>Buka web ini di <b>Chrome</b> atau <b>Microsoft Edge</b>.</li>
                                <li>Perhatikan ujung kanan bilah alamat (address bar), klik ikon <b>Install</b>.</li>
                                <li>Aplikasi dapat di-pin ke Taskbar Windows dan dibuka layaknya software desktop!</li>
                            </ol>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex justify-end">
                    <button
                        onClick={() => { triggerHaptic(); onClose(); }}
                        className="btn-native-primary w-full sm:w-auto"
                    >
                        Tutup Panduan
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PwaGuideModal;
