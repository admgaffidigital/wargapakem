import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, formatBulanTahun, triggerHaptic } from '../../utils/helpers.js';

export function Dashboard({ members, setMembers, jimpitanBalance, kasRtBalance, currentRound, setCurrentRound, userRole, cycleNumber, setCycleNumber, changeTab, arisanPeriod }) {
    const [showResetModal, setShowResetModal] = useState(false);
    const totalDebt = members.reduce((sum, m) => sum + Number(m.debt || 0), 0);
    const redRecords = members.filter(m => m.redRecord).length;
    const arisanMembers = members.filter(m => m.status === 'Normal' && m.program !== 'IuranOnly');
    const winnersCount = arisanMembers.filter(m => m.hasWon).length;
    const isCycleComplete = winnersCount >= arisanMembers.length && arisanMembers.length > 0;
    const saldoEfektifJimpitan = Number(jimpitanBalance || 0) + totalDebt;
    const totalDanaGlobal = Number(kasRtBalance || 0) + Number(jimpitanBalance || 0);

    return (
        <div className="space-y-6 sm:space-y-7 max-w-5xl mx-auto pb-8">
            
            {/* ========================================================
                1. SIKLUS & PROGRESS ARISAN BENTO CARD
               ======================================================== */}
            <div className="bg-white/95 dark:bg-slate-900/95 p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20">
                            Siklus Ke-{cycleNumber}
                        </span>
                        <span className="text-[12px] font-semibold text-slate-400">
                            {formatBulanTahun(arisanPeriod)}
                        </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Putaran Ke-{currentRound}
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                        <Icon name="groups" className="text-[16px] text-red-500" />
                        <span>Total {arisanMembers.length} warga peserta aktif arisan</span>
                    </p>
                </div>

                {/* Progress Bar Pemenang Arisan */}
                <div className="bg-slate-50 dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl w-full sm:w-80 border border-slate-200/80 dark:border-slate-700">
                    <div className="flex justify-between items-end mb-2.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                            Pemenang Terundi
                        </span>
                        <span className="text-lg font-black text-red-600 dark:text-red-400 leading-none">
                            {winnersCount} <span className="text-[13px] text-slate-400">/ {arisanMembers.length}</span>
                        </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-full transition-all duration-1000 shadow-xs" 
                            style={{ width: `${(winnersCount / (arisanMembers.length || 1)) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* ========================================================
                2. TOTAL DANA KELOLAAN NATIVE HERO
               ======================================================== */}
            <div className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-6 sm:p-8 border border-slate-800 shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16"></div>

                <div className="relative z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-slate-200 mb-3 border border-white/15">
                        <Icon name="account_balance_wallet" className="text-[13px]" /> Total Dana Kas & Jimpitan
                    </span>
                    <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-sm font-sans mb-2">
                        {formatRp(totalDanaGlobal)}
                    </h3>
                    <p className="text-[12px] text-slate-400 font-medium">
                        Akumulasi saldo kas operasional RT aktif ditambah kas fisik jimpitan warga.
                    </p>
                </div>
            </div>

            {/* Siklus Selesai Alert (Pengurus) */}
            {isCycleComplete && userRole === 'admin' && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-5 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-500/30 shadow-xs">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Icon name="task_alt" className="text-[26px]" fill="true" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-[15px]">Siklus Arisan Telah Tuntas</h4>
                            <p className="text-[12px] text-slate-600 dark:text-slate-300">Seluruh anggota arisan telah memenangkan putaran. Anda dapat memulai siklus baru.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { triggerHaptic(10); setShowResetModal(true); }} 
                        className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[13px] shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                        Mulai Siklus Baru
                    </button>
                </div>
            )}

            {/* ========================================================
                3. GRID 3 KARTU KEUANGAN
               ======================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                <div className="bg-white/95 dark:bg-slate-900/95 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Kas Utama RT</span>
                            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-sans">{formatRp(kasRtBalance)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/25 flex items-center justify-center shrink-0">
                            <Icon name="account_balance" className="text-[22px]" fill="true" />
                        </div>
                    </div>
                    <button 
                        onClick={() => { triggerHaptic(8); changeTab('kas'); }} 
                        className="w-full min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                        <span>Buka Buku Kas</span>
                        <Icon name="chevron_right" className="text-[16px]" />
                    </button>
                </div>

                <div className="bg-white/95 dark:bg-slate-900/95 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Kas Jimpitan Tunai</span>
                            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-sans">{formatRp(jimpitanBalance)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
                            <Icon name="savings" className="text-[22px]" fill="true" />
                        </div>
                    </div>
                    <button 
                        onClick={() => { triggerHaptic(8); changeTab('laporan'); }} 
                        className="w-full min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                        <span>Riwayat Jimpitan</span>
                        <Icon name="chevron_right" className="text-[16px]" />
                    </button>
                </div>

                <div className="bg-white/95 dark:bg-slate-900/95 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-5">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Tunggakan Warga</span>
                            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-sans">{formatRp(totalDebt)}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0">
                            <Icon name="money_off" className="text-[22px]" fill="true" />
                        </div>
                    </div>
                    <button 
                        onClick={() => { triggerHaptic(8); changeTab('warga'); }} 
                        className="w-full min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[12px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                        <span>Cek Buku Warga</span>
                        <Icon name="chevron_right" className="text-[16px]" />
                    </button>
                </div>
            </div>

            {/* Total Saldo Efektif */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
                        Total Saldo Efektif Jimpitan
                    </span>
                    <p className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-300 font-sans tracking-tight">
                        {formatRp(saldoEfektifJimpitan)}
                    </p>
                </div>
                <div className="flex items-center gap-2.5 bg-white/80 dark:bg-slate-900/80 px-4 py-2.5 rounded-2xl border border-amber-500/20 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    <Icon name="info" className="text-[17px] text-amber-600 shrink-0" />
                    <span>Akumulasi aset utuh kas jimpitan tunai ditambah piutang tunggakan warga.</span>
                </div>
            </div>

            {/* Peringatan Rapor Merah */}
            {redRecords > 0 && (
                <div className="bg-red-600 text-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl flex items-center gap-4 shadow-lg shadow-red-500/20">
                    <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <Icon name="warning" className="text-[24px]" fill="true" />
                    </div>
                    <div>
                        <h4 className="text-[14px] font-black uppercase tracking-tight">Perhatian: {redRecords} Warga Memiliki Tunggakan</h4>
                        <p className="text-[12px] text-red-100">Silakan koordinasikan dengan warga bersangkutan untuk ketertiban kas lingkungan.</p>
                    </div>
                </div>
            )}

            {/* Modal Bottom Sheet Reset Siklus */}
            {showResetModal && (
                <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 dark:bg-black/80 backdrop-blur-md animate-fade-in no-print">
                    <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 shadow-2xl animate-modal-in">
                        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="text-center mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center mx-auto mb-3">
                                <Icon name="refresh" className="text-[28px]" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Mulai Siklus Arisan Baru?</h3>
                            <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1">
                                Status menang semua warga akan direset untuk putaran 1, namun riwayat kas dan tunggakan tetap aman tersimpan.
                            </p>
                        </div>

                        <div className="flex gap-2.5 pt-2">
                            <button 
                                onClick={() => setShowResetModal(false)} 
                                className="w-1/3 min-h-[46px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[13px] hover:bg-slate-200 transition-all cursor-pointer"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={() => { 
                                    triggerHaptic(14);
                                    setMembers(members.map(m => m.program === 'IuranOnly' ? m : { ...m, hasWon: false, wonRound: null })); 
                                    setCurrentRound(1); 
                                    setCycleNumber(prev => (prev || 1) + 1); 
                                    setShowResetModal(false); 
                                    showToast('Siklus baru berhasil dimulai.'); 
                                }} 
                                className="flex-1 min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                            >
                                Mulai Siklus Baru
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
