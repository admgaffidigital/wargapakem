import React from 'react';
import Icon from '../common/Icon.jsx';

        function Pemenang({ members }) {
            // FIX: Urutkan dari putaran terbaru ke terlama agar urutannya sama dengan Riwayat Pertemuan Arisan
            const winners = members.filter(m => m.hasWon).sort((a, b) => b.wonRound - a.wonRound);
            return (
                <div className="space-y-8 max-w-7xl mx-auto">
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl flex flex-col sm:flex-row justify-between items-center border border-slate-200 shadow-sm text-center sm:text-left gap-5">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Daftar Pemenang Arisan</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Warga yang telah menerima dana pada siklus aktif saat ini.</p></div>
                        <div className="w-16 h-16 bg-google-yellowLight rounded-2xl flex items-center justify-center border border-google-yellow/40 shrink-0 shadow-sm"><Icon name="emoji_events" className="text-[32px] text-google-yellowDark" fill="true" /></div>
                    </div>
                    {winners.length === 0 ? <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="military_tech" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2 tracking-tight">Belum Ada Pemenang</h3><p className="text-google-textVariant font-medium text-[13px]">Data penerima arisan akan tampil di sini setelah diundi.</p></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                            {winners.map((winner) => (
                                <div key={winner.id} className="bg-white p-6 sm:p-8 md:p-6 rounded-3xl flex items-center space-x-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-yellow/60 transition-all duration-300 group">
                                    <div className="bg-google-yellowLight border border-google-yellow/40 text-google-yellowDark font-medium w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-[17px] group-hover:bg-google-yellow group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm">#{winner.wonRound}</div>
                                    <div className="flex-1 min-w-0"><h3 className="font-medium text-google-text text-[16px] truncate group-hover:text-google-yellowDark transition-colors tracking-tight">{winner.name}</h3><p className="text-[13px] font-medium text-google-textVariant mt-1">Menang di Putaran {winner.wonRound}</p></div>
                                    <Icon name="check_circle" className="text-[32px] text-google-green group-hover:scale-110 transition-transform" fill="true" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }


export default Pemenang;
