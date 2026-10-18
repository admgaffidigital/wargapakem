import React, { useState, useEffect, useRef } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, isNonaktif } from '../../utils/helpers.js';

        function Laporan({ history, setMeetingHistory, members, setMembers, jimpitanBalance, setJimpitanBalance, nominalArisan, nominalJimpitan, cycleNumber, identity, userRole }) {
            const [filterMonth, setFilterMonth] = useState('Semua');
            const availableMonths = [...new Set(history.map(item => item.periode))];
            const displayedHistory = filterMonth === 'Semua' ? history : history.filter(item => item.periode === filterMonth);
const [editingHistoryId, setEditingHistoryId] = useState(null);
const [tempAttendance, setTempAttendance] = useState({});
const chartRef = useRef(null);
const canvasRef = useRef(null);

useEffect(() => {
if (!canvasRef.current || history.length === 0) return;
const chronological = [...history].reverse();
const labels = chronological.map(h => h.periode);
const dataPoints = chronological.map(h => h.saldoAkhirJimpitan || 0);

if (chartRef.current) chartRef.current.destroy();

import('chart.js/auto').then((module) => {
const Chart = module.default;
const ctx = canvasRef.current.getContext('2d');
chartRef.current = new Chart(ctx, {
type: 'line',
data: {
labels: labels,
datasets: [{
label: 'Saldo Jimpitan (Rp)',
data: dataPoints,
borderColor: '#e11d48',
backgroundColor: 'rgba(225, 29, 72, 0.1)',
borderWidth: 3,
pointBackgroundColor: '#e11d48',
pointBorderColor: '#fff',
pointBorderWidth: 2,
pointRadius: 5,
pointHoverRadius: 7,
fill: true,
tension: 0.4
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
plugins: { legend: { display: false } },
scales: {
y: {
beginAtZero: true,
ticks: { callback: function(value) { return 'Rp ' + (value/1000) + 'k'; } }
}
}
}
});

}); return () => { if (chartRef.current) chartRef.current.destroy(); };
}, [history]);

let growthStatus = null;
let growthAmount = 0;
if (history.length >= 2) {
const latest = history[0].saldoAkhirJimpitan || 0;
const previous = history[1].saldoAkhirJimpitan || 0;
growthAmount = latest - previous;
if (growthAmount > 0) growthStatus = 'tumbuh';
else if (growthAmount < 0) growthStatus = 'turun';
else growthStatus = 'stagnan';
} else if (history.length === 1) {
growthStatus = 'tumbuh';
growthAmount = history[0].saldoAkhirJimpitan || 0;
}

            const handleOpenEdit = (record) => { const attMap = {}; record.absensiDetails.forEach(a => { attMap[a.name] = a.status; }); setTempAttendance(attMap); setEditingHistoryId(record.id); };
            const handleAttendanceChange = (name, status) => { setTempAttendance(prev => ({ ...prev, [name]: status })); };

            const saveEditHistory = () => {
                const record = history.find(h => h.id === editingHistoryId);
                if (!record) return;
                let deltaGlobalJimpitan = 0, deltaRecordKasJimpitan = 0, deltaRecordTalangan = 0, deltaTunggakan = 0, deltaArisan = 0;
                const updatedMembers = [...members];
                // Cek apakah pemenang record ini berubah kehadirannya (affects kasArisanTerkumpul)
                const isWinnerRecord = (name) => record.winner && record.winner.includes(name);

                record.absensiDetails.forEach(oldAtt => {
                    const newStatus = tempAttendance[oldAtt.name];
                    if (!newStatus || oldAtt.status === newStatus) return; // tidak ada perubahan
                    // Cari berdasarkan nama (limitasi desain: nama harus unik)
                    const memberIndex = updatedMembers.findIndex(m => m.name === oldAtt.name);
                    if (memberIndex === -1) return;
                    // FIX CELAH-2: Warga Meninggal bebas dari arisan - skip perubahan debt/talangan
                    if (isNonaktif(updatedMembers[memberIndex])) return; // Nonaktif/Meninggal: bebas dari arisan
                    const member = { ...updatedMembers[memberIndex] };
                    const debtAmount = nominalArisan + nominalJimpitan;
                    
                    // Batalkan efek status lama
                    if (oldAtt.status === 'Hadir') {
                        deltaRecordKasJimpitan -= nominalJimpitan;
                        deltaGlobalJimpitan -= nominalJimpitan;
                    } else if (oldAtt.status === 'Alfa' || oldAtt.status === 'Musibah') {
                        deltaRecordTalangan -= nominalArisan;
                        deltaGlobalJimpitan += nominalArisan; // kembalikan talangan ke jimpitan
                        member.debt = Math.max(0, member.debt - debtAmount);
                        deltaTunggakan -= debtAmount;
                    }
                    
                    // Terapkan efek status baru
                    if (newStatus === 'Hadir') {
                        deltaRecordKasJimpitan += nominalJimpitan;
                        deltaGlobalJimpitan += nominalJimpitan;
                        // FIX: Jika ini pemenang, kasArisan berkurang karena pemenang hadir (tidak bayar ke diri sendiri)
                        if (isWinnerRecord(oldAtt.name)) deltaArisan -= nominalArisan;
                    } else if (newStatus === 'Alfa' || newStatus === 'Musibah') {
                        deltaRecordTalangan += nominalArisan;
                        deltaGlobalJimpitan -= nominalArisan;
                        member.debt += debtAmount;
                        deltaTunggakan += debtAmount;
                        // FIX: Jika ini pemenang tidak hadir, kasArisan bertambah (pemenang kini bayar)
                        if (isWinnerRecord(oldAtt.name)) deltaArisan += nominalArisan;
                    }
                    member.redRecord = member.debt > 0;
                    updatedMembers[memberIndex] = member;
                });
                
                setMembers(updatedMembers);
                setJimpitanBalance(prev => prev + deltaGlobalJimpitan);
                const updatedHistory = history.map(h => {
                    if (h.id === editingHistoryId) {
                        return {
                            ...h,
                            // FIX: Update kasArisanTerkumpul jika kehadiran pemenang berubah
                            kasArisanTerkumpul: Math.max(0, h.kasArisanTerkumpul + deltaArisan),
                            kasJimpitanMasuk: Math.max(0, h.kasJimpitanMasuk + deltaRecordKasJimpitan),
                            talanganJimpitan: Math.max(0, h.talanganJimpitan + deltaRecordTalangan),
                            tunggakanBaru: Math.max(0, (h.tunggakanBaru || 0) + deltaTunggakan),
                            totalTunggakanAkhir: Math.max(0, (h.totalTunggakanAkhir || 0) + deltaTunggakan),
                            // FIX KRITIS-4: Update saldoAkhirJimpitan di record sesuai delta global
                            saldoAkhirJimpitan: Math.max(0, (h.saldoAkhirJimpitan || 0) + deltaGlobalJimpitan),
                            absensiDetails: h.absensiDetails.map(a => ({ ...a, status: tempAttendance[a.name] || a.status }))
                        };
                    }
                    return h;
                });
                setMeetingHistory(updatedHistory); 
                setEditingHistoryId(null);
                showToast('Koreksi riwayat absensi berhasil disimpan.');
            };

            return (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 no-print shadow-sm">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Riwayat Pertemuan Arisan</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Arsip resmi presensi dan sirkulasi dana bulanan.</p></div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-slate-50 border border-slate-200 text-google-text text-[13px] font-medium rounded-full px-4 py-3.5 outline-none focus:border-google-blue w-full sm:w-auto cursor-pointer">
                                <option value="Semua">Tampilkan Semua Bulan</option>
                                {availableMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                            </select>
                            <button onClick={() => window.print()} className="bg-white border border-slate-200 text-google-text px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] hover:bg-slate-50 hover:border-slate-400 hover:shadow-md active:scale-95 transition-all duration-300 shadow-sm w-full sm:w-auto"><Icon name="print" className="text-[16px]" /><span>Cetak Laporan</span></button>
                        </div>
                    </div>

                    {history.length > 0 && (
<div className="bento-island-card no-print mb-8 p-5 sm:p-7">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
<div>
<h3 className="text-xl font-medium text-google-text tracking-tight">Tren Saldo Jimpitan</h3>
<p className="text-[12px] font-medium text-google-textVariant mt-1">Pertumbuhan saldo tunai dari setiap pertemuan.</p>
</div>
{growthStatus && (
<div className={`px-4 py-2 rounded-2xl flex items-center gap-3 border ${
growthStatus === 'tumbuh' ? 'bg-google-greenLight border-google-green/40 text-google-greenDark' :
growthStatus === 'turun' ? 'bg-google-redLight border-google-red/40 text-google-redDark' :
'bg-slate-100 border-slate-400 text-slate-600'
}`}>
<Icon name={growthStatus === 'tumbuh' ? 'trending_up' : growthStatus === 'turun' ? 'trending_down' : 'trending_flat'} className="text-[24px]" />
<div className="flex flex-col">
<span className="text-[9px] uppercase font-medium tracking-widest">{growthStatus === 'tumbuh' ? 'Status: Tumbuh' : growthStatus === 'turun' ? 'Status: Menurun' : 'Status: Stagnan / Stack'}</span>
<span className="font-medium text-[13px] leading-tight">{growthStatus !== 'stagnan' ? (growthAmount > 0 ? '+' : '') + formatRp(Math.abs(growthAmount)) : 'Tidak ada pertumbuhan'}</span>
</div>
</div>
)}
</div>
<div className="w-full h-[250px] relative">
<canvas ref={canvasRef}></canvas>
</div>
</div>
)}

                    <div className="hidden print-only">
                        <div className="kop-surat">
                            <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                            <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                            <div className="kop-surat-logo-right"></div>
                        </div>
                        <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Laporan Pertemuan &amp; Arisan</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber} {filterMonth !== 'Semua' ? `| Bulan: ${filterMonth}` : ''}</p></div>
                        {displayedHistory.length === 0 ? <p className="text-center italic font-medium">Belum ada arsip pada filter ini.</p> : displayedHistory.map((record, idx) => (
                            <div key={record.id} style={{ marginBottom: '30px' }}>
                                <h3 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '2px solid black', paddingBottom: '4px', marginBottom: '10px' }}>Putaran Ke-{record.round} ({record.periode})</h3>
                                <table className="print-table" style={{ marginTop: '0', marginBottom: '10px' }}>
                                    <tbody>
                                        <tr><td width="40%"><strong>Tanggal Pelaksanaan</strong></td><td>{record.date}</td></tr>
                                        <tr><td><strong>Pemenang Arisan</strong></td><td>{record.winner}</td></tr>
                                        <tr><td><strong>Arisan Terkumpul/Diserahkan</strong></td><td>{formatRp(record.kasArisanTerkumpul)}</td></tr>
                                        <tr><td><strong>Jimpitan Tunai Masuk</strong></td><td>{formatRp(record.kasJimpitanMasuk)}</td></tr>
                                        <tr><td><strong>Pelunasan Tunggakan Masuk</strong></td><td>{formatRp(record.pelunasanTunggakan)}</td></tr>
                                        <tr><td><strong>Talangan Arisan (Tunai Keluar)</strong></td><td>{formatRp(record.talanganJimpitan)}</td></tr>
                                        <tr><td><strong>Tunggakan Warga (Dicatat Baru)</strong></td><td>{formatRp(record.tunggakanBaru || 0)}</td></tr>
                                        <tr><td><strong>Saldo Tunai Jimpitan Berjalan</strong></td><td style={{fontSize: '12pt'}}><strong>{formatRp(record.saldoAkhirJimpitan)}</strong></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-8 no-print">
                        {displayedHistory.map((record) => {
                            const isHoliday = record.winner.includes('LIBUR');
                            return (
                                <div key={record.id} className="bento-island-card p-0 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 hover:border-red-500/30 transition-all duration-300">
                                    <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-200 bg-slate-50">
                                        <div><h3 className="font-medium text-2xl text-google-text tracking-tight">Putaran Ke-{record.round}</h3><p className="text-[13px] font-medium text-google-textVariant mt-2 flex flex-wrap items-center gap-1.5"><Icon name="event" className="text-[16px]"/> {record.periode} • {record.date}</p></div>
                                        <div className="mt-5 sm:mt-0 flex flex-col sm:items-end"><span className="text-[10px] uppercase font-medium text-google-textVariant tracking-widest mb-2">{isHoliday ? 'Status Kegiatan' : 'Pemenang Arisan'}</span><div className={`${isHoliday ? 'bg-google-yellow text-white border-google-yellowDark' : 'bg-google-blue text-white border-google-blueDark'} px-6 py-3 rounded-full font-medium text-[13px] shadow-md inline-flex items-center gap-2 border`}><Icon name={isHoliday ? "event_busy" : "emoji_events"} className="text-[17px]" fill="true" /> {record.winner}</div></div>
                                    </div>
                                    <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-google-greenLight border border-google-green/30 rounded-3xl p-8 flex flex-col justify-center text-center shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                            <Icon name="payments" className="absolute -right-2 -bottom-2 text-[100px] text-google-green opacity-10 group-hover:scale-110 transition-transform duration-500" fill="true" />
                                            <p className="text-[10px] uppercase font-medium tracking-widest mb-3 text-google-greenDark relative z-10">Arisan Diserahkan</p>
                                            <p className="text-4xl font-medium text-google-green relative z-10 drop-shadow-sm tracking-tight">{formatRp(record.kasArisanTerkumpul)}</p>
                                        </div>
                                        <div className="space-y-6 bg-slate-50 p-6 sm:p-8 rounded-3xl border border-slate-200">
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="add_circle" className="text-[16px] text-google-green"/> Jimpitan Masuk</span><span className="text-google-greenDark">+{formatRp(record.kasJimpitanMasuk)}</span></div>
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="add_circle" className="text-[16px] text-google-green"/> Bayar Tunggakan</span><span className="text-google-greenDark">+{formatRp(record.pelunasanTunggakan)}</span></div>
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="remove_circle" className="text-[16px] text-google-red"/> Talangan (Keluar)</span><span className="text-google-redDark">-{formatRp(record.talanganJimpitan)}</span></div>
                                            <div className="flex justify-between items-center text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="info" className="text-[16px] text-google-yellowDark"/> Tunggakan Baru</span><span className="text-google-redDark">+{formatRp(record.tunggakanBaru || 0)}</span></div>
                                            <div className="w-full h-px bg-slate-200 my-4"></div>
                                            <div className="flex justify-between items-center text-[16px] font-medium tracking-tight"><span>Saldo Tunai Berjalan</span><span className="text-google-blueDark">{formatRp(record.saldoAkhirJimpitan)}</span></div>
                                        </div>
                                    </div>
                                    {!isHoliday && (
                                        <div className="p-6 sm:p-8 border-t border-slate-200 bg-white">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                                <h4 className="font-medium text-[16px] text-google-text tracking-tight">Detail Presensi Warga</h4>
                                                {userRole === 'admin' && <button onClick={() => handleOpenEdit(record)} className="text-[12px] bg-white text-google-text font-medium px-6 py-3.5 rounded-full hover:bg-slate-50 hover:border-slate-400 no-print transition-all duration-300 active:scale-95 border border-slate-200 flex flex-wrap items-center gap-2 shadow-sm"><Icon name="edit" className="text-[16px]" /> Revisi Data</button>}
                                            </div>
                                            <div className="flex flex-wrap gap-3 no-print text-[13px]">
                                                {record.absensiDetails.map((a, i) => {
                                                    const isHadir = a.status === 'Hadir'; const isAlfa = a.status === 'Alfa'; const isMeninggal = (a.status === 'Meninggal' || a.status === 'Nonaktif');
                                                    // FIX: Status Meninggal ditampilkan abu-abu (bebas arisan)
                                                    return <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-colors ${isMeninggal ? 'bg-slate-100 border-slate-400' : isHadir ? 'bg-slate-50 border-slate-200' : isAlfa ? 'bg-google-redLight border-google-red/40' : 'bg-google-yellowLight border-google-yellow/40'}`}><div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isMeninggal ? 'bg-slate-400' : isHadir ? 'bg-google-green' : isAlfa ? 'bg-google-red' : 'bg-google-yellow'}`}></div><span className={`font-medium text-[13px] ${isMeninggal ? 'text-slate-400 line-through' : 'text-google-text'}`}>{a.name}{isMeninggal && <span className="text-[9px] ml-1.5 bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider">{a.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</span></div>
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {displayedHistory.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="history" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2 tracking-tight">Belum Ada Riwayat</h3><p className="text-google-textVariant font-medium text-[13px]">Tidak ada catatan pertemuan untuk bulan yang dipilih.</p></div>}
                    </div>

                    {editingHistoryId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-sm text-left max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 dark:border-slate-700 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text dark:text-white mb-1 shrink-0 tracking-tight">Revisi Kehadiran</h3><p className="text-[13px] font-medium text-google-textVariant dark:text-slate-300 mb-6 shrink-0 leading-relaxed">Saldo akan disesuaikan otomatis mengikuti perubahan presensi ini.</p>
                                <div className="overflow-y-auto space-y-6 flex-1 pb-4 pr-1 hide-scrollbar">
                                    {history.find(h => h.id === editingHistoryId)?.absensiDetails.map((member, idx) => (
                                        <div key={member.id || member.name || idx} className={`flex flex-col gap-3 border p-5 rounded-3xl shadow-sm ${isNonaktif(member) ? 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 opacity-60' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40'}`}>
                                            <p className={`text-[14px] font-medium truncate tracking-tight ${isNonaktif(member) ? 'text-slate-400 line-through' : 'text-google-text dark:text-white'}`}>{member.name}{isNonaktif(member) && <span className="text-[9px] ml-2 bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded font-medium uppercase tracking-wider no-underline">{member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</p>
                                            {/* FIX BONUS-B: Warga Meninggal tidak punya toggle - bebas dari arisan */}
                                            {isNonaktif(member) ? (
                                                <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-400 dark:border-slate-700">
                                                    <Icon name="do_not_disturb" className="text-[16px] text-slate-400 dark:text-slate-500" />
                                                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Bebas Arisan - Jimpitan saja</span>
                                                </div>
                                            ) : (
                                            <div className="flex flex-wrap rounded-2xl bg-slate-200/60 dark:bg-slate-850 p-2 gap-2 border border-slate-200 dark:border-slate-700 inset-shadow-sm">
                                                {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                    <button key={stat} onClick={() => handleAttendanceChange(member.name, stat)} className={`flex-1 py-2.5 text-[10px] uppercase tracking-widest font-medium rounded-full transition-all duration-300 border ${tempAttendance[member.name] === stat ? (stat === 'Hadir' ? 'bg-google-green text-white shadow-md border-google-greenDark scale-105' : stat === 'Musibah' ? 'bg-google-yellowDark text-white shadow-md border-google-yellowDark scale-105' : 'bg-google-red text-white shadow-md border-google-redDark scale-105') : 'text-google-textVariant dark:text-slate-400 bg-transparent hover:bg-white dark:hover:bg-slate-800 border-transparent'}`}>{stat}</button>
                                                ))}
                                            </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 mt-2 shrink-0"><button onClick={() => setEditingHistoryId(null)} className="w-full sm:w-auto bg-white dark:bg-slate-800 text-google-text dark:text-white px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button><button onClick={saveEditHistory} className="flex-1 bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex items-center justify-center">Simpan Revisi</button></div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


export default Laporan;
