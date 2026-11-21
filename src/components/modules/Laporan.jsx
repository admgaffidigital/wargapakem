import React, { useState, useEffect, useRef, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, isNonaktif, triggerHaptic } from '../../utils/helpers.js';

function Laporan({
    history = [],
    setMeetingHistory,
    members = [],
    setMembers,
    jimpitanBalance,
    setJimpitanBalance,
    nominalArisan,
    nominalJimpitan,
    cycleNumber,
    identity,
    userRole
}) {
    const [filterMonth, setFilterMonth] = useState('Semua');
    const availableMonths = useMemo(() => [...new Set(history.map(item => item.periode))], [history]);
    const displayedHistory = useMemo(() => {
        return filterMonth === 'Semua' ? history : history.filter(item => item.periode === filterMonth);
    }, [history, filterMonth]);

    // Accordion State: Default putaran terbaru terbuka
    const [expandedPutaran, setExpandedPutaran] = useState(() => {
        return history.length > 0 ? [history[0].id] : [];
    });

    // Collapsible Presensi Warga per Putaran: { [recordId]: boolean }
    const [expandedAttendance, setExpandedAttendance] = useState({});

    const [editingHistoryId, setEditingHistoryId] = useState(null);
    const [tempAttendance, setTempAttendance] = useState({});
    const chartRef = useRef(null);
    const canvasRef = useRef(null);

    const togglePutaran = (id) => {
        triggerHaptic(10);
        setExpandedPutaran(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const toggleAllPutaran = (expandAll) => {
        triggerHaptic(12);
        if (expandAll) {
            setExpandedPutaran(displayedHistory.map(h => h.id));
        } else {
            setExpandedPutaran([]);
        }
    };

    const toggleAttendance = (recordId) => {
        triggerHaptic(8);
        setExpandedAttendance(prev => ({
            ...prev,
            [recordId]: !prev[recordId]
        }));
    };

    const getAttendanceCounts = (absensiDetails = []) => {
        let hadir = 0, musibah = 0, alfa = 0, nonaktif = 0;
        absensiDetails.forEach(a => {
            if (a.status === 'Hadir') hadir++;
            else if (a.status === 'Musibah') musibah++;
            else if (a.status === 'Alfa') alfa++;
            else if (a.status === 'Meninggal' || a.status === 'Nonaktif') nonaktif++;
        });
        return { hadir, musibah, alfa, nonaktif, total: absensiDetails.length };
    };

    // Tren Grafik Saldo Jimpitan
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
                            ticks: { callback: function(value) { return 'Rp ' + (value / 1000) + 'k'; } }
                        }
                    }
                }
            });
        });

        return () => { if (chartRef.current) chartRef.current.destroy(); };
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

    const handleOpenEdit = (record) => {
        const attMap = {};
        record.absensiDetails.forEach(a => { attMap[a.name] = a.status; });
        setTempAttendance(attMap);
        setEditingHistoryId(record.id);
    };

    const handleAttendanceChange = (name, status) => {
        setTempAttendance(prev => ({ ...prev, [name]: status }));
    };

    const saveEditHistory = () => {
        const record = history.find(h => h.id === editingHistoryId);
        if (!record) return;
        let deltaGlobalJimpitan = 0, deltaRecordKasJimpitan = 0, deltaRecordTalangan = 0, deltaTunggakan = 0, deltaArisan = 0;
        const updatedMembers = [...members];
        const isWinnerRecord = (name) => record.winner && record.winner.includes(name);

        record.absensiDetails.forEach(oldAtt => {
            const newStatus = tempAttendance[oldAtt.name];
            if (!newStatus || oldAtt.status === newStatus) return;
            const memberIndex = updatedMembers.findIndex(m => m.name === oldAtt.name);
            if (memberIndex === -1) return;
            if (isNonaktif(updatedMembers[memberIndex])) return;
            const member = { ...updatedMembers[memberIndex] };
            const debtAmount = nominalArisan + nominalJimpitan;

            // Batalkan efek status lama
            if (oldAtt.status === 'Hadir') {
                deltaRecordKasJimpitan -= nominalJimpitan;
                deltaGlobalJimpitan -= nominalJimpitan;
            } else if (oldAtt.status === 'Alfa' || oldAtt.status === 'Musibah') {
                deltaRecordTalangan -= nominalArisan;
                deltaGlobalJimpitan += nominalArisan;
                member.debt = Math.max(0, member.debt - debtAmount);
                deltaTunggakan -= debtAmount;
            }

            // Terapkan efek status baru
            if (newStatus === 'Hadir') {
                deltaRecordKasJimpitan += nominalJimpitan;
                deltaGlobalJimpitan += nominalJimpitan;
                if (isWinnerRecord(oldAtt.name)) deltaArisan -= nominalArisan;
            } else if (newStatus === 'Alfa' || newStatus === 'Musibah') {
                deltaRecordTalangan += nominalArisan;
                deltaGlobalJimpitan -= nominalArisan;
                member.debt += debtAmount;
                deltaTunggakan += debtAmount;
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
                    kasArisanTerkumpul: Math.max(0, h.kasArisanTerkumpul + deltaArisan),
                    kasJimpitanMasuk: Math.max(0, h.kasJimpitanMasuk + deltaRecordKasJimpitan),
                    talanganJimpitan: Math.max(0, h.talanganJimpitan + deltaRecordTalangan),
                    tunggakanBaru: Math.max(0, (h.tunggakanBaru || 0) + deltaTunggakan),
                    totalTunggakanAkhir: Math.max(0, (h.totalTunggakanAkhir || 0) + deltaTunggakan),
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
        <div className="space-y-6">
            {/* Header Modul */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-5 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs no-print">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                            <Icon name="history" className="text-[22px]" />
                        </span>
                        <span>Riwayat Pertemuan Arisan</span>
                    </h2>
                    <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                        Arsip presensi kehadiran, sirkulasi uang jimpitan &amp; kas lingkungan RT.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-2xl font-bold text-[12px] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer border border-slate-200 dark:border-slate-700"
                    >
                        <Icon name="print" className="text-[16px]" />
                        <span>Cetak Laporan</span>
                    </button>
                </div>
            </div>

            {/* Filter Horizontal Pill (Native Segmented Chips) */}
            {availableMonths.length > 0 && (
                <div className="no-print space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Icon name="filter_list" className="text-[14px]" /> Filter Periode
                        </span>
                        <div className="flex items-center gap-2 text-[11px]">
                            <button
                                type="button"
                                onClick={() => toggleAllPutaran(true)}
                                className="font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                            >
                                Buka Semua
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <button
                                type="button"
                                onClick={() => toggleAllPutaran(false)}
                                className="font-bold text-slate-500 hover:underline cursor-pointer"
                            >
                                Tutup Semua
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        <button
                            type="button"
                            onClick={() => { triggerHaptic(8); setFilterMonth('Semua'); }}
                            className={`px-4 py-2 rounded-xl text-[12px] font-bold shrink-0 transition-all cursor-pointer border ${
                                filterMonth === 'Semua'
                                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                            }`}
                        >
                            Semua Periode ({history.length})
                        </button>
                        {availableMonths.map((m) => {
                            const count = history.filter(h => h.periode === m).length;
                            const active = filterMonth === m;
                            return (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => { triggerHaptic(8); setFilterMonth(m); }}
                                    className={`px-4 py-2 rounded-xl text-[12px] font-bold shrink-0 transition-all cursor-pointer border ${
                                        active
                                            ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                                    }`}
                                >
                                    {m} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tren Grafik Saldo Jimpitan */}
            {history.length > 0 && (
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xs no-print">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                        <div>
                            <h3 className="text-[16px] font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                <Icon name="trending_up" className="text-red-500 text-[18px]" />
                                <span>Tren Saldo Kas Jimpitan</span>
                            </h3>
                            <p className="text-[11.5px] font-medium text-slate-400 mt-0.5">Pertumbuhan saldo tunai dari setiap putaran pertemuan.</p>
                        </div>
                        {growthStatus && (
                            <div className={`px-3.5 py-1.5 rounded-2xl flex items-center gap-2.5 border shrink-0 ${
                                growthStatus === 'tumbuh'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                                    : growthStatus === 'turun'
                                    ? 'bg-red-50 dark:bg-red-950/40 border-red-500/25 text-red-700 dark:text-red-300'
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                                <Icon name={growthStatus === 'tumbuh' ? 'trending_up' : growthStatus === 'turun' ? 'trending_down' : 'trending_flat'} className="text-[18px]" />
                                <div className="text-right">
                                    <span className="text-[9px] uppercase font-bold tracking-wider block">
                                        {growthStatus === 'tumbuh' ? 'Tumbuh' : growthStatus === 'turun' ? 'Menurun' : 'Stagnan'}
                                    </span>
                                    <span className="font-black text-[12px] leading-tight block">
                                        {growthStatus !== 'stagnan' ? (growthAmount > 0 ? '+' : '') + formatRp(Math.abs(growthAmount)) : 'Tetap'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="w-full h-[200px] sm:h-[240px] relative">
                        <canvas ref={canvasRef}></canvas>
                    </div>
                </div>
            )}

            {/* Print Only Official Document Header */}
            <div className="hidden print-only">
                <div className="kop-surat">
                    <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                    <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                    <div className="kop-surat-logo-right"></div>
                </div>
                <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Laporan Pertemuan &amp; Arisan</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber} {filterMonth !== 'Semua' ? `| Bulan: ${filterMonth}` : ''}</p></div>
                {displayedHistory.length === 0 ? <p className="text-center italic font-medium">Belum ada arsip pada filter ini.</p> : displayedHistory.map((record) => (
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

            {/* Daftar Riwayat Putaran (Smart Accordion Style) */}
            <div className="space-y-3.5 no-print">
                {displayedHistory.map((record) => {
                    const isHoliday = record.winner && record.winner.includes('LIBUR');
                    const isExpanded = expandedPutaran.includes(record.id);
                    const isAttendanceOpen = expandedAttendance[record.id];
                    const counts = getAttendanceCounts(record.absensiDetails);

                    return (
                        <div
                            key={record.id}
                            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-red-500/30 transition-all overflow-hidden"
                        >
                            {/* Accordion Header (Tap to toggle) */}
                            <button
                                type="button"
                                onClick={() => togglePutaran(record.id)}
                                className="w-full p-4 sm:p-5 flex items-center justify-between text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer select-none"
                            >
                                <div className="flex items-center gap-3 min-w-0 pr-2">
                                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500/10 to-amber-500/10 dark:from-red-500/20 dark:to-amber-500/20 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center font-black text-[15px] shrink-0">
                                        P{record.round}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-[14.5px] font-black text-slate-900 dark:text-white tracking-tight truncate">
                                                Putaran Ke-{record.round}
                                            </h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                                {record.periode}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                            <span className="flex items-center gap-1">
                                                <Icon name="event" className="text-[13px] text-slate-400" /> {record.date}
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-700">•</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-bold truncate">
                                                {isHoliday ? 'Libur Arisan' : `Pemenang: ${record.winner}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Saldo Akhir</span>
                                        <span className="text-[13px] font-black text-slate-900 dark:text-white block">
                                            {formatRp(record.saldoAkhirJimpitan)}
                                        </span>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 transition-transform duration-200">
                                        <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-[20px]" />
                                    </div>
                                </div>
                            </button>

                            {/* Accordion Body (Detail Putaran) */}
                            {isExpanded && (
                                <div className="border-t border-slate-100 dark:border-slate-800/80 p-4 sm:p-6 space-y-5 animate-fade-in">
                                    {/* Pemenang & Kas Diserahkan */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 border border-emerald-500/25 rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden">
                                            <Icon name="payments" className="absolute -right-3 -bottom-3 text-[90px] text-emerald-600 dark:text-emerald-400 opacity-10 pointer-events-none" fill="true" />
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                                    Uang Arisan Diserahkan
                                                </span>
                                                <h3 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
                                                    {formatRp(record.kasArisanTerkumpul)}
                                                </h3>
                                            </div>
                                            <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center gap-2 text-[12px] font-bold text-slate-700 dark:text-slate-200">
                                                <Icon name="emoji_events" className="text-[16px] text-amber-500" fill="true" />
                                                <span className="truncate">{record.winner}</span>
                                            </div>
                                        </div>

                                        {/* Rekap Saldo & Transaksi Jimpitan */}
                                        <div className="bg-slate-50 dark:bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                                            <div className="flex justify-between items-center text-[12px] font-medium">
                                                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                    <Icon name="add_circle" className="text-[15px] text-emerald-500" /> Jimpitan Masuk
                                                </span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    +{formatRp(record.kasJimpitanMasuk)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center text-[12px] font-medium">
                                                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                    <Icon name="add_circle" className="text-[15px] text-emerald-500" /> Pelunasan Tunggakan
                                                </span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                    +{formatRp(record.pelunasanTunggakan || 0)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center text-[12px] font-medium">
                                                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                    <Icon name="remove_circle" className="text-[15px] text-red-500" /> Talangan Tunai Keluar
                                                </span>
                                                <span className="font-bold text-red-600 dark:text-red-400">
                                                    -{formatRp(record.talanganJimpitan)}
                                                </span>
                                            </div>

                                            {Number(record.tunggakanBaru || 0) > 0 && (
                                                <div className="flex justify-between items-center text-[12px] font-medium">
                                                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                        <Icon name="info" className="text-[15px] text-amber-500" /> Tunggakan Dicatat Baru
                                                    </span>
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                                        +{formatRp(record.tunggakanBaru)}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>

                                            <div className="flex justify-between items-center">
                                                <span className="text-[12.5px] font-bold text-slate-800 dark:text-white">
                                                    Saldo Kas Jimpitan Berjalan
                                                </span>
                                                <span className="text-[14px] font-black text-blue-600 dark:text-blue-400">
                                                    {formatRp(record.saldoAkhirJimpitan)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Presensi Warga (Collapsible Section) */}
                                    {!isHoliday && record.absensiDetails && record.absensiDetails.length > 0 && (
                                        <div className="bg-slate-50/70 dark:bg-slate-850/50 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 space-y-3">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Icon name="group" className="text-[16px] text-slate-400" />
                                                        <span className="text-[13px] font-bold text-slate-800 dark:text-white">
                                                            Presensi Pertemuan ({counts.total} Warga)
                                                        </span>
                                                    </div>
                                                    {/* Badge Ringkasan Hadir / Alfa */}
                                                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] font-bold">
                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            {counts.hadir} Hadir
                                                        </span>
                                                        {counts.musibah > 0 && (
                                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                                {counts.musibah} Izin/Musibah
                                                            </span>
                                                        )}
                                                        {counts.alfa > 0 && (
                                                            <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20">
                                                                {counts.alfa} Alfa
                                                            </span>
                                                        )}
                                                        {counts.nonaktif > 0 && (
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
                                                                {counts.nonaktif} Nonaktif
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                                    {userRole === 'admin' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(record)}
                                                            className="flex-1 sm:flex-none text-[11px] font-bold px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-100 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                                                        >
                                                            <Icon name="edit" className="text-[14px]" />
                                                            <span>Revisi Presensi</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAttendance(record.id)}
                                                        className="flex-1 sm:flex-none text-[11px] font-bold px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-2xs"
                                                    >
                                                        <span>{isAttendanceOpen ? 'Sembunyikan' : 'Buka Rincian'}</span>
                                                        <Icon name={isAttendanceOpen ? 'expand_less' : 'expand_more'} className="text-[15px]" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Rincian Nama (Hanya terbuka jika ditap) */}
                                            {isAttendanceOpen && (
                                                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-2 animate-fade-in">
                                                    {record.absensiDetails.map((a, i) => {
                                                        const isHadir = a.status === 'Hadir';
                                                        const isAlfa = a.status === 'Alfa';
                                                        const isMeninggal = (a.status === 'Meninggal' || a.status === 'Nonaktif');

                                                        return (
                                                            <div
                                                                key={i}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11.5px] font-semibold border transition-all ${
                                                                    isMeninggal
                                                                        ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 line-through border-slate-200 dark:border-slate-700'
                                                                        : isHadir
                                                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500/20'
                                                                        : isAlfa
                                                                        ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-500/20'
                                                                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-500/20'
                                                                }`}
                                                            >
                                                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                                    isMeninggal
                                                                        ? 'bg-slate-400'
                                                                        : isHadir
                                                                        ? 'bg-emerald-500'
                                                                        : isAlfa
                                                                        ? 'bg-red-500'
                                                                        : 'bg-amber-500'
                                                                }`}></span>
                                                                <span className="truncate">{a.name}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {displayedHistory.length === 0 && (
                    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-2xs space-y-3">
                        <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-full mx-auto text-slate-400">
                            <Icon name="history" className="text-[36px]" />
                        </div>
                        <h3 className="text-[16px] font-black text-slate-800 dark:text-white">Belum Ada Riwayat</h3>
                        <p className="text-[12px] font-medium text-slate-400">Tidak ada catatan pertemuan untuk filter periode yang dipilih.</p>
                    </div>
                )}
            </div>

            {/* Modal Revisi Presensi (Admin Only) */}
            {editingHistoryId && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print bg-slate-950/65 dark:bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-t-[32px] sm:rounded-[28px] p-5 sm:p-7 text-left max-h-[85vh] flex flex-col shadow-2xl animate-modal-in">
                        {/* Mobile handle bar */}
                        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 sm:hidden"></div>

                        <div className="mb-4 shrink-0">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Revisi Kehadiran Warga</h3>
                            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Saldo kas jimpitan &amp; tunggakan warga akan dihitung ulang secara otomatis.</p>
                        </div>

                        <div className="overflow-y-auto space-y-3 flex-1 pb-3 pr-1 hide-scrollbar">
                            {history.find(h => h.id === editingHistoryId)?.absensiDetails.map((member, idx) => (
                                <div key={member.id || member.name || idx} className={`p-3.5 rounded-2xl border transition-all ${isNonaktif(member) ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 opacity-60' : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850'}`}>
                                    <p className={`text-[13px] font-bold truncate mb-2 ${isNonaktif(member) ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                                        {member.name}
                                        {isNonaktif(member) && (
                                            <span className="text-[9px] ml-2 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 font-bold uppercase no-underline">
                                                {member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}
                                            </span>
                                        )}
                                    </p>

                                    {isNonaktif(member) ? (
                                        <div className="text-[11px] font-medium text-slate-400 italic">Bebas arisan (anggota nonaktif)</div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-1.5 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl">
                                            {['Hadir', 'Musibah', 'Alfa'].map(stat => {
                                                const active = tempAttendance[member.name] === stat;
                                                return (
                                                    <button
                                                        key={stat}
                                                        type="button"
                                                        onClick={() => handleAttendanceChange(member.name, stat)}
                                                        className={`py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                                            active
                                                                ? stat === 'Hadir'
                                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                                    : stat === 'Musibah'
                                                                    ? 'bg-amber-500 text-white shadow-xs'
                                                                    : 'bg-red-600 text-white shadow-xs'
                                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        {stat}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-800 mt-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setEditingHistoryId(null)}
                                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[12.5px] transition-all cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={saveEditHistory}
                                className="w-1/2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[12.5px] shadow-md shadow-red-500/25 transition-all cursor-pointer"
                            >
                                Simpan Revisi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Laporan;
