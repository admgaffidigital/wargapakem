import React from 'react';
import Icon from '../common/Icon.jsx';

        function Pemenang({ members }) {
            // FIX: Urutkan dari putaran terbaru ke terlama agar urutannya sama dengan Riwayat Pertemuan Arisan
            const winners = members.filter(m => m.hasWon).sort((a, b) => b.wonRound - a.wonRound);
            return (
                <div className="space-y-8 max-w-7xl mx-auto">
                    <div className="bento-header-card bg-white/95 dark:bg-slate-900/95 p-5 sm:p-7 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row justify-between items-center border border-slate-200/80 dark:border-slate-800 shadow-sm text-center sm:text-left gap-4 sm:gap-5">
                        <div><h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Daftar Pemenang Arisan</h2><p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">Warga yang telah menerima dana pada siklus aktif saat ini.</p></div>
                        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/40 rounded-2xl flex items-center justify-center border border-amber-500/30 shrink-0 shadow-sm"><Icon name="emoji_events" className="text-[32px] text-amber-700 dark:text-amber-300" fill="true" /></div>
                    </div>
                    {winners.length === 0 ? <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="military_tech" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-slate-800 dark:text-white mb-2 tracking-tight">Belum Ada Pemenang</h3><p className="text-slate-500 dark:text-slate-400 font-medium text-[13px]">Data penerima arisan akan tampil di sini setelah diundi.</p></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                            {winners.map((winner) => (
                                <div key={winner.id} className="bento-island-card bg-white/95 dark:bg-slate-900/95 p-4 sm:p-5 rounded-2xl flex items-center space-x-4 sm:space-x-5 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium w-13 h-13 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center shrink-0 text-[16px] font-black group-hover:bg-amber-500 group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm">#{winner.wonRound}</div>
                                    <div className="flex-1 min-w-0"><h3 className="font-bold text-slate-800 dark:text-white text-[15px] sm:text-[16px] truncate tracking-tight">{winner.name}</h3><p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Menang di Putaran {winner.wonRound}</p></div>
                                    <Icon name="check_circle" className="text-[32px] text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" fill="true" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }


export default Pemenang;
