import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, formatBulanTahun } from '../../utils/helpers.js';

        function Dashboard({ members, setMembers, jimpitanBalance, kasRtBalance, currentRound, setCurrentRound, userRole, cycleNumber, setCycleNumber, changeTab, arisanPeriod }) {
            const [showResetModal, setShowResetModal] = useState(false);
            const totalDebt = members.reduce((sum, m) => sum + Number(m.debt || 0), 0);
            const redRecords = members.filter(m => m.redRecord).length;
            const arisanMembers = members.filter(m => m.status === 'Normal' && m.program !== 'IuranOnly');
            const winnersCount = arisanMembers.filter(m => m.hasWon).length;
            const isCycleComplete = winnersCount >= arisanMembers.length && arisanMembers.length > 0;
            const saldoEfektifJimpitan = Number(jimpitanBalance || 0) + totalDebt;

            return (
                <div className="space-y-7 sm:space-y-8">
                    <div className="bento-header-card bg-white/95 dark:bg-slate-900/95 p-5 sm:p-7 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 sm:gap-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        <div>
                            <span className="inline-flex items-center px-3.5 py-1.5 rounded-md text-[9px] font-medium uppercase tracking-widest bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-2.5 sm:mb-3 border border-red-500/20 rounded-lg">Siklus {cycleNumber}</span>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-800 dark:text-white leading-tight tracking-tight">Putaran {currentRound}</h2>
                            <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-1.5"><Icon name="event" className="text-[16px]" /> {formatBulanTahun(arisanPeriod)}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/80 px-5 sm:px-6 py-4 sm:py-5 rounded-2xl w-full sm:w-72 max-w-full border border-slate-200/80 dark:border-slate-700 shadow-sm">
                            <div className="flex justify-between items-end mb-3">
                                <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Progres Pemenang</p>
                                <p className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400 leading-none">{winnersCount} <span className="text-[13px] text-google-textVariant">/ {arisanMembers.length}</span></p>
                            </div>
                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-gradient-to-r from-red-600 to-rose-500 h-full rounded-full transition-all duration-1000" style={{ width: `${(winnersCount / (arisanMembers.length || 1)) * 100}%` }}></div></div>
                        </div>
                    </div>

                    <div className="bento-island-card bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6 border border-slate-800 relative overflow-hidden group cursor-default">
                        
                        

                        <div className="relative z-10 w-full text-center sm:text-left">
                            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[9px] font-medium uppercase tracking-widest bg-white/10 text-slate-200 mb-3 border border-white/20 shadow-sm">
                                <Icon name="account_balance_wallet" className="text-[13px]" /> Total Dana Kelolaan Global
                            </span>
                            <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-md">{formatRp(Number(kasRtBalance || 0) + Number(jimpitanBalance || 0))}</p>
                            <p className="text-[12px] text-slate-400 font-medium mt-2">Gabungan Total Saldo Aktif Kas Utama RT + Kas Jimpitan Tunai.</p>
                        </div>
                    </div>
                    
                    {isCycleComplete && userRole === 'admin' && (
                        <div className="bg-google-blueLight p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:text-left text-center gap-6 border border-google-blue shadow-sm">
                            <div className="bg-google-blue text-white w-16 h-16 rounded-full flex items-center justify-center shadow-md border border-google-blueDark shrink-0"><Icon name="task_alt" className="text-[32px]" fill="true" /></div>
                            <div className="flex-1"><h3 className="font-medium text-google-blueDark text-xl mb-1.5">Siklus Telah Selesai</h3><p className="text-[13px] font-medium text-google-blue">Seluruh warga arisan telah memenangkan putaran. Silakan mulai siklus baru.</p></div>
                            <button onClick={() => setShowResetModal(true)} className="w-full sm:w-auto px-8 py-3.5 bg-google-blue text-white font-medium rounded-full text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="refresh" className="text-[17px]"/> Mulai Baru</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bento-island-card bg-white/95 dark:bg-slate-900/95 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[10px] font-medium uppercase tracking-widest text-google-textVariant block mb-2">Kas Utama RT</span><p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">{formatRp(kasRtBalance)}</p></div>
                                <div className="bg-google-blueLight text-google-blueDark w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border border-google-blue/30"><Icon name="account_balance" className="text-[24px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('kas')} className="btn-native-secondary w-full min-h-[44px] rounded-xl font-bold text-[12.5px] sm:text-[13px] flex items-center justify-center gap-2 shadow-sm">Rincian Kas</button>
                        </div>
                        
                        <div className="bento-island-card bg-white/95 dark:bg-slate-900/95 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[10px] font-medium uppercase tracking-widest text-google-textVariant block mb-2">Kas Jimpitan Tunai</span><p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">{formatRp(jimpitanBalance)}</p></div>
                                <div className="bg-google-greenLight text-google-greenDark w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border border-google-green/30"><Icon name="savings" className="text-[24px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('laporan')} className="btn-native-secondary w-full min-h-[44px] rounded-xl font-bold text-[12.5px] sm:text-[13px] flex items-center justify-center gap-2 shadow-sm">Riwayat Arisan</button>
                        </div>

                        <div className="bento-island-card bg-white/95 dark:bg-slate-900/95 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[10px] font-medium uppercase tracking-widest text-google-textVariant block mb-2">Tunggakan Total</span><p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight">{formatRp(totalDebt)}</p></div>
                                <div className="bg-google-redLight text-google-redDark w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border border-google-red/30"><Icon name="money_off" className="text-[24px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('warga')} className="btn-native-secondary w-full min-h-[44px] rounded-xl font-bold text-[12.5px] sm:text-[13px] flex items-center justify-center gap-2 shadow-sm">Cek Penunggak</button>
                        </div>
                    </div>

                    <div className="bento-island-card bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-5 shadow-sm">
                        <div><p className="text-[10px] font-medium text-google-yellowDark uppercase tracking-widest mb-1.5">Total Saldo Efektif Jimpitan</p><p className="text-3xl font-medium text-google-yellowDark tracking-tight">{formatRp(saldoEfektifJimpitan)}</p></div>
                        <div className="flex flex-wrap items-center gap-3 bg-white/80  px-5 py-4 rounded-3xl border border-google-yellow/30 shadow-sm"><Icon name="info" className="text-[20px] text-google-yellowDark shrink-0" /><p className="text-[12px] font-medium text-google-yellowDark max-w-[220px] max-w-full leading-relaxed">Akumulasi aset utuh (Kas Tunai + Piutang Warga).</p></div>
                    </div>

                    {redRecords > 0 && (
                        <div className="bg-google-red text-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl flex items-start space-x-5 border border-google-redDark shadow-lg hover:shadow-xl transition-shadow animate-pulse" style={{ animationDuration: '3s' }}>
                            <Icon name="warning" className="text-[36px] shrink-0 drop-shadow-md" fill="true" />
                            <div><h4 className="text-[16px] font-medium mb-1.5 tracking-tight">Peringatan: Tunggakan Terdeteksi</h4><p className="text-[13px] font-medium text-red-50 leading-relaxed">Terdapat <span className="underline underline-offset-2">{redRecords} warga</span> dengan catatan rapor merah.</p></div>
                        </div>
                    )}

                    {showResetModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-left border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-blueLight w-16 h-16 rounded-full flex items-center justify-center border border-google-blue/30"><Icon name="refresh" className="text-[32px] text-google-blue" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2">Mulai Siklus Baru?</h3>
                                <div className="text-[13px] font-medium text-google-textVariant mb-8 space-y-5 bg-slate-50 p-6 sm:p-8 md:p-8 rounded-3xl border border-slate-200"><p className="flex flex-wrap gap-2.5 items-start"><Icon name="check_circle" className="text-[16px] text-google-green shrink-0 mt-0.5"/><span className="leading-relaxed">Saldo Kas & Tunggakan <b className="text-google-text">TIDAK DIRESET</b>.</span></p><p className="flex flex-wrap gap-2.5 items-start"><Icon name="check_circle" className="text-[16px] text-google-green shrink-0 mt-0.5"/><span className="leading-relaxed">Status menang warga akan dibersihkan ke awal.</span></p></div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setShowResetModal(false)} className="btn-native-secondary flex-1 min-h-[44px] rounded-xl font-bold text-[13px] flex items-center justify-center shadow-sm">Batal</button>
                                    <button onClick={() => { 
                                        setMembers(members.map(m => m.program === 'IuranOnly' ? m : { ...m, hasWon: false, wonRound: null })); 
                                        setCurrentRound(1); 
                                        setCycleNumber(prev => (prev || 1) + 1); 
                                        setShowResetModal(false); 
                                        showToast('Siklus baru berhasil dimulai.'); 
                                    }} className="btn-native-primary flex-1 min-h-[44px] rounded-xl font-bold text-[13px] flex items-center justify-center shadow-md">Bersihkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


export default Dashboard;
