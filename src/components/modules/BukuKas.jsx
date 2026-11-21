import React, { useState, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, getLocalDate, parseLocalDate, uploadToGoogleDrive, triggerHaptic } from '../../utils/helpers.js';

export function BukuKas({ balance, setBalance, transactions, setTransactions, userRole, identity, jimpitanBalance, setJimpitanBalance }) {
    const [filterMonth, setFilterMonth] = useState('Semua');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferAmount, setTransferAmount] = useState('');
    const [formData, setFormData] = useState({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
    const [errorMsg, setErrorMsg] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [showSaldo, setShowSaldo] = useState(true);
    const [txTypeFilter, setTxTypeFilter] = useState('Semua');
    const [expandedMonths, setExpandedMonths] = useState(() => {
        const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        if (sorted.length === 0) return [];
        const dateObj = parseLocalDate(sorted[0].date);
        const latestMonth = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        return [latestMonth];
    });

    const toggleMonth = (m) => {
        triggerHaptic(8);
        setExpandedMonths(prev => 
            prev.includes(m) ? prev.filter(item => item !== m) : [...prev, m]
        );
    };

    const toggleAllMonths = (expandAll) => {
        triggerHaptic(10);
        if (expandAll) {
            setExpandedMonths(Object.keys(groupedTransactions));
        } else {
            setExpandedMonths([]);
        }
    };


    const groupedTransactions = useMemo(() => {
        const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
        const groups = {};
        sorted.forEach(t => {
            const dateObj = parseLocalDate(t.date);
            const monthYear = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
            if (!groups[monthYear]) groups[monthYear] = [];
            groups[monthYear].push(t);
        });
        return groups;
    }, [transactions]);

    const availableMonths = Object.keys(groupedTransactions);
    
    const totals = useMemo(() => {
        let inTotal = 0, outTotal = 0;
        transactions.forEach(t => {
            if (t.type === 'Pemasukan') inTotal += Number(t.amount || 0);
            else outTotal += Number(t.amount || 0);
        });
        return { inTotal, outTotal, count: transactions.length };
    }, [transactions]);

    const displayedTransactions = useMemo(() => {
        if (filterMonth === 'Semua') return transactions;
        return groupedTransactions[filterMonth] || [];
    }, [filterMonth, transactions, groupedTransactions]);

    // Upload Nota Kas RT
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
        if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
        setIsUploading(true); setErrorMsg('');
        try {
            const url = await uploadToGoogleDrive(file, 1200, 0.82);
            setFormData(prev => ({ ...prev, receiptUrl: url }));
        } catch(error) {
            setErrorMsg(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = () => {
        triggerHaptic(12);
        if (!formData.description) return setErrorMsg("Keterangan wajib diisi!");
        const nominal = safeNumber(formData.amount);
        if (nominal <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
        
        if (editingId) {
            const oldTx = transactions.find(t => t.id === editingId);
            let tempBalance = balance;
            if (oldTx.type === 'Pemasukan') tempBalance -= oldTx.amount;
            else tempBalance += oldTx.amount;
            
            if (formData.type === 'Pengeluaran' && nominal > tempBalance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(tempBalance)}`);
            
            if (formData.type === 'Pemasukan') tempBalance += nominal;
            else tempBalance -= nominal;
            
            if (oldTx.category === 'Mutasi Jimpitan') {
                const diffJimpitan = oldTx.amount - nominal;
                setJimpitanBalance(prev => prev + diffJimpitan);
            }
            
            setBalance(tempBalance);
            setTransactions(transactions.map(t => t.id === editingId ? { ...formData, amount: nominal } : t));
            setEditingId(null);
            showToast(`Transaksi berhasil diperbarui.`);
        } else {
            if (formData.type === 'Pengeluaran' && nominal > balance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(balance)}`);
            if (formData.type === 'Pemasukan') setBalance(prev => prev + nominal); else setBalance(prev => prev - nominal);
            setTransactions([{ id: Date.now(), ...formData, amount: nominal }, ...transactions]);
            showToast(`Transaksi ${formData.type.toLowerCase()} berhasil dicatat.`);
        }
        
        setIsModalOpen(false); 
        setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
        setIsUploading(false);
    };

    const handleTransferJimpitan = () => {
        triggerHaptic(12);
        const nominal = safeNumber(transferAmount);
        if (nominal <= 0 || nominal > jimpitanBalance) return setErrorMsg(`Penarikan tidak valid! Maksimal ${formatRp(jimpitanBalance)}`);
        setJimpitanBalance(prev => prev - nominal); setBalance(prev => prev + nominal);
        setTransactions([{ id: Date.now(), type: 'Pemasukan', category: 'Mutasi Jimpitan', description: 'Pencairan Kas Jimpitan', amount: nominal, date: getLocalDate() }, ...transactions]);
        setIsTransferModalOpen(false); setTransferAmount('');
        showToast(`Berhasil mencairkan ${formatRp(nominal)} dari Kas Jimpitan.`);
    };

    return (
        <div className="space-y-6 sm:space-y-7 max-w-5xl mx-auto pb-8 print:p-0">
            
            {/* ========================================================
                1. HEADER & FILTER KONTROL NATIVE
               ======================================================== */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs no-print">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/25 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="account_balance_wallet" className="text-[24px]" fill="true" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Buku Kas Utama RT</h2>
                        <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Laporan arus kas operasional lingkungan secara akuntabel
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select 
                        value={filterMonth} 
                        onChange={(e) => { triggerHaptic(8); setFilterMonth(e.target.value); }} 
                        className="flex-1 sm:flex-none bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white text-[12px] font-bold rounded-xl px-3.5 py-2.5 outline-none cursor-pointer"
                    >
                        <option value="Semua">Semua Periode Bulan</option>
                        {availableMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                    </select>

                    <button 
                        onClick={() => { triggerHaptic(10); window.print(); }} 
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[12px] font-bold border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
                        title="Cetak Buku Kas Formal (A4)"
                    >
                        <Icon name="print" className="text-[16px]" />
                        <span className="hidden sm:inline">Cetak</span>
                    </button>
                </div>
            </div>

            {/* ========================================================
                PRINT LAYOUT FORMAL (A4)
               ======================================================== */}
            <div className="hidden print-only">
                <div className="kop-surat">
                    <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                    <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                    <div className="kop-surat-logo-right"></div>
                </div>
                <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Buku Kas Umum</h2><p className="text-[11pt]">{filterMonth !== 'Semua' ? `Periode: ${filterMonth}` : `Per Tanggal: ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}`}</p></div>
                <table className="print-table">
                    <thead><tr><th width="5%">No</th><th width="15%">Tanggal</th><th width="40%">Uraian Transaksi</th><th width="20%">Pemasukan</th><th width="20%">Pengeluaran</th></tr></thead>
                    <tbody>
                        {displayedTransactions.length === 0 ? <tr><td colSpan="5" className="text-center font-medium">Nihil / Belum ada transaksi</td></tr> : displayedTransactions.map((t, idx) => (
                            <tr key={t.id}><td className="text-center font-medium">{idx + 1}</td><td className="text-center font-medium">{parseLocalDate(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}</td><td className="font-medium">{t.description} {t.category ? `(${t.category})` : ''}</td><td className="text-right font-medium">{t.type === 'Pemasukan' ? formatRp(t.amount) : '-'}</td><td className="text-right font-medium">{t.type === 'Pengeluaran' ? formatRp(t.amount) : '-'}</td></tr>
                        ))}
                    </tbody>
                    <tfoot><tr><th colSpan="3" className="text-right">SALDO TOTAL KAS WARGA SAAT INI</th><th colSpan="2" className="text-center" style={{fontSize: '12pt'}}>{formatRp(balance)}</th></tr></tfoot>
                </table>
                <div className="ttd-container">
                    <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                    <div className="ttd-box"><p>Dibuat Oleh,</p><p>Bendahara / Admin</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                </div>
            </div>

            {/* ========================================================
                2. MODERN NATIVE FINANCIAL CARD (Apple Card / Banking Style)
               ======================================================== */}
            <div className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-6 sm:p-8 border border-slate-800 shadow-xl no-print">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/15 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-16 -mb-16"></div>

                <div className="relative z-10 flex flex-col justify-between gap-6">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-white/10 text-white border border-white/15">
                                KAS OPERASIONAL RT
                            </span>
                            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                <Icon name="check_circle" className="text-[14px]" fill="true" />
                                <span>Terverifikasi Real-Time</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-white/50">
                            <Icon name="contactless" className="text-[24px]" />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    Total Saldo Kas Aktif
                                </span>
                                <button
                                    type="button"
                                    onClick={() => { triggerHaptic(8); setShowSaldo(!showSaldo); }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                    title={showSaldo ? "Sembunyikan Saldo" : "Tampilkan Saldo"}
                                >
                                    <Icon name={showSaldo ? "visibility" : "visibility_off"} className="text-[16px]" />
                                </button>
                            </div>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-sm font-sans">
                                {showSaldo ? formatRp(balance) : "Rp ••••••••"}
                            </h2>
                        </div>

                        <div className="bg-white/5 hover:bg-white/10 transition-colors px-4 py-2.5 rounded-2xl border border-white/10">
                            <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Cadangan Kas Jimpitan</span>
                            <span className="text-[14px] font-black text-amber-300">
                                {showSaldo ? formatRp(jimpitanBalance) : "••••••"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================
                3. ACTION PILLS (HANYA PENGURUS/ADMIN)
               ======================================================== */}
            {userRole === 'admin' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
                    <button 
                        onClick={() => { 
                            triggerHaptic(10);
                            setEditingId(null); 
                            setFormData({ type: 'Pemasukan', category: 'Iuran Opsional', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); 
                            setIsModalOpen(true); 
                            setErrorMsg(''); 
                            setIsUploading(false); 
                        }} 
                        className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-emerald-500/40 hover:shadow-md transition-all active:scale-[0.98] flex items-center gap-3 cursor-pointer group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Icon name="arrow_downward" className="text-[20px]" fill="true" />
                        </div>
                        <div className="text-left min-w-0">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 transition-colors">
                                Catat Pemasukan
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                                Iuran, donasi & kas masuk
                            </span>
                        </div>
                    </button>

                    <button 
                        onClick={() => { 
                            triggerHaptic(10);
                            setEditingId(null); 
                            setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); 
                            setIsModalOpen(true); 
                            setErrorMsg(''); 
                            setIsUploading(false); 
                        }} 
                        className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-rose-500/40 hover:shadow-md transition-all active:scale-[0.98] flex items-center gap-3 cursor-pointer group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Icon name="arrow_upward" className="text-[20px]" fill="true" />
                        </div>
                        <div className="text-left min-w-0">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white block group-hover:text-rose-600 transition-colors">
                                Catat Pengeluaran
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                                Belanja alat, konsumsi & biaya
                            </span>
                        </div>
                    </button>

                    <button 
                        onClick={() => { 
                            triggerHaptic(10);
                            setIsTransferModalOpen(true); 
                            setErrorMsg(''); 
                        }} 
                        className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:border-amber-500/40 hover:shadow-md transition-all active:scale-[0.98] flex items-center gap-3 cursor-pointer group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Icon name="sync_alt" className="text-[20px]" fill="true" />
                        </div>
                        <div className="text-left min-w-0">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white block group-hover:text-amber-600 transition-colors">
                                Cairkan Kas Jimpitan
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                                Mutasi jimpitan tunai ke kas utama
                            </span>
                        </div>
                    </button>
                </div>
            )}

            {/* ========================================================
                4. FEED RIWAYAT TRANSAKSI (NATIVE ACCORDION LIST)
               ======================================================== */}
            <div className="space-y-4 no-print">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 px-1">
                    <h3 className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <span>Riwayat Mutasi Transaksi</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {displayedTransactions.length}
                        </span>
                    </h3>

                    <div className="flex items-center gap-2 text-[11px] self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={() => toggleAllMonths(true)}
                            className="font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                        >
                            Buka Semua
                        </button>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <button
                            type="button"
                            onClick={() => toggleAllMonths(false)}
                            className="font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                            Tutup Semua
                        </button>
                    </div>
                </div>

                {/* FILTER TIPE TRANSAKSI (HORIZONTAL CHIPS) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                    {[
                        { id: 'Semua', label: 'Semua Mutasi', count: transactions.length },
                        { id: 'Pemasukan', label: '🟢 Pemasukan (+)', count: transactions.filter(t => t.type === 'Pemasukan').length, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
                        { id: 'Pengeluaran', label: '🔴 Pengeluaran (-)', count: transactions.filter(t => t.type === 'Pengeluaran').length, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' },
                    ].map(tab => {
                        const active = txTypeFilter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => { triggerHaptic(8); setTxTypeFilter(tab.id); }}
                                className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 border ${
                                    active
                                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                    active ? 'bg-white/20 text-white' : (tab.color || 'bg-slate-100 dark:bg-slate-800 text-slate-500')
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {Object.keys(groupedTransactions).map((monthYear) => {
                    let list = filterMonth === 'Semua' ? groupedTransactions[monthYear] : (filterMonth === monthYear ? groupedTransactions[monthYear] : []);
                    if (!list) list = [];
                    // Apply txTypeFilter
                    if (txTypeFilter !== 'Semua') {
                        list = list.filter(t => t.type === txTypeFilter);
                    }
                    if (list.length === 0 && txTypeFilter !== 'Semua') return null;

                    const isExpanded = expandedMonths.includes(monthYear);
                    let monthIn = 0, monthOut = 0;
                    groupedTransactions[monthYear].forEach(t => {
                        if (t.type === 'Pemasukan') monthIn += Number(t.amount || 0);
                        else monthOut += Number(t.amount || 0);
                    });

                    return (
                        <div key={monthYear} className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden transition-all">
                            {/* Collapsible Month Header (Tap to toggle) */}
                            <button
                                type="button"
                                onClick={() => toggleMonth(monthYear)}
                                className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer select-none"
                            >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                    <span className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center font-bold text-[13px] shrink-0">
                                        <Icon name="calendar_month" className="text-[17px]" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13.5px] font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                                {monthYear}
                                            </span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                                {list.length} trx
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10.5px] font-bold mt-0.5">
                                            {monthIn > 0 && (
                                                <span className="text-emerald-600 dark:text-emerald-400">
                                                    +{formatRp(monthIn)}
                                                </span>
                                            )}
                                            {monthIn > 0 && monthOut > 0 && <span className="text-slate-300 dark:text-slate-700">•</span>}
                                            {monthOut > 0 && (
                                                <span className="text-rose-600 dark:text-rose-400">
                                                    -{formatRp(monthOut)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                    <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-[18px]" />
                                </div>
                            </button>

                            {/* Collapsible Month Body */}
                            {isExpanded && (
                                <div className="p-3 sm:p-4 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800/80 animate-fade-in bg-slate-50/40 dark:bg-slate-850/30">

                            {list.map((t) => (
                                <div 
                                    key={t.id} 
                                    className="p-3.5 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0 pr-2">
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                                            t.type === 'Pemasukan'
                                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                        }`}>
                                            <Icon name={t.type === 'Pemasukan' ? "arrow_downward" : "arrow_upward"} className="text-[20px]" fill="true" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-[13.5px] text-slate-900 dark:text-white truncate">
                                                {t.description}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] font-medium text-slate-400">
                                                <span className="text-slate-500 dark:text-slate-400">{t.category}</span>
                                                <span>&bull;</span>
                                                <span>{parseLocalDate(t.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</span>
                                                {t.receiptUrl && (
                                                    <button 
                                                        onClick={() => { triggerHaptic(8); setSelectedImage(t.receiptUrl); }} 
                                                        className="ml-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                                                    >
                                                        <Icon name="receipt" className="text-[12px]" />
                                                        <span>Bukti Nota</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/80 pt-2.5 sm:pt-0">
                                        <span className={`text-[15px] sm:text-[16px] font-black tracking-tight ${
                                            t.type === 'Pemasukan' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {t.type === 'Pemasukan' ? '+' : '-'}{formatRp(t.amount)}
                                        </span>

                                        {userRole === 'admin' && t.category !== 'Saldo Awal' && (
                                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => {
                                                        triggerHaptic(8);
                                                        setEditingId(t.id);
                                                        setFormData(t);
                                                        setIsModalOpen(true);
                                                        setErrorMsg('');
                                                    }} 
                                                    className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors"
                                                    title="Edit Transaksi"
                                                >
                                                    <Icon name="edit" className="text-[13px]" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        triggerHaptic(10);
                                                        if (t.type === 'Pemasukan') setBalance(prev => prev - t.amount); 
                                                        else setBalance(prev => prev + t.amount);
                                                        if (t.category === 'Mutasi Jimpitan') setJimpitanBalance(prev => prev + t.amount);
                                                        setTransactions(transactions.filter(x => x.id !== t.id));
                                                        showToast('Transaksi dihapus.');
                                                    }} 
                                                    className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 flex items-center justify-center transition-colors"
                                                    title="Hapus Transaksi"
                                                >
                                                    <Icon name="delete" className="text-[13px]" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {displayedTransactions.length === 0 && (
                    <div className="bg-white/80 dark:bg-slate-900/80 rounded-3xl p-12 text-center border border-slate-200/90 dark:border-slate-800 space-y-2">
                        <Icon name="receipt_long" className="text-[40px] text-slate-300 dark:text-slate-600 mx-auto" />
                        <h4 className="text-[15px] font-bold text-slate-800 dark:text-white">Belum Ada Transaksi</h4>
                        <p className="text-[12px] text-slate-400">Belum ada catatan mutasi kas pada periode yang dipilih.</p>
                    </div>
                )}
            </div>

            {/* ========================================================
                5. MODAL BOTTOM SHEET INPUT TRANSAKSI (NATIVE SHEET)
               ======================================================== */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 dark:bg-black/80 backdrop-blur-md animate-fade-in no-print">
                    <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 shadow-2xl animate-modal-in max-h-[90vh] overflow-y-auto">
                        {/* Mobile Pull Handle */}
                        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    formData.type === 'Pemasukan' 
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                                        : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                }`}>
                                    <Icon name={formData.type === 'Pemasukan' ? 'arrow_downward' : 'arrow_upward'} className="text-[20px]" fill="true" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                    {editingId ? 'Edit' : 'Catat'} {formData.type}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                            >
                                <Icon name="close" className="text-[16px]" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">Tanggal Transaksi</label>
                                <input 
                                    type="date" 
                                    value={formData.date} 
                                    onChange={e => setFormData({...formData, date: e.target.value})} 
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 text-[13px] font-medium outline-none rounded-xl text-slate-900 dark:text-white focus:border-red-500" 
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">Kategori Transaksi</label>
                                <select 
                                    value={formData.category} 
                                    onChange={e => setFormData({...formData, category: e.target.value})} 
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 text-[13px] font-medium outline-none rounded-xl text-slate-900 dark:text-white focus:border-red-500 cursor-pointer"
                                >
                                    {formData.type === 'Pengeluaran' ? (
                                        <>
                                            <option>Belanja Barang/Alat</option>
                                            <option>Honor Jasa</option>
                                            <option>Konsumsi</option>
                                            <option>Bantuan Sosial</option>
                                            <option>Lain-lain</option>
                                        </>
                                    ) : (
                                        <>
                                            <option>Iuran Opsional</option>
                                            <option>Donasi</option>
                                            <option>Pemasukan Jasa</option>
                                            <option>Lain-lain</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">Keterangan / Uraian</label>
                                <input 
                                    type="text" 
                                    value={formData.description} 
                                    onChange={e => { setFormData({...formData, description: e.target.value}); setErrorMsg(''); }} 
                                    placeholder="Contoh: Beli sapu lidi & plastik sampah" 
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 text-[13px] font-medium outline-none rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-red-500" 
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">Nominal (Rp)</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    value={formData.amount} 
                                    onChange={e => { setFormData({...formData, amount: safeNumber(e.target.value)}); setErrorMsg(''); }} 
                                    placeholder="0" 
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 text-[15px] font-black outline-none rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-red-500" 
                                />
                            </div>

                            {/* Upload Nota Bukti */}
                            {formData.type === 'Pengeluaran' && (
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">Bukti Nota Transaksi (Opsional)</label>
                                    <div className="relative flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3 rounded-xl overflow-hidden">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleImageUpload} 
                                            disabled={isUploading} 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                                        />
                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0 text-slate-500">
                                            {isUploading ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div> : <Icon name="receipt" className="text-[18px]" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate">
                                                {isUploading ? "Mengunggah..." : (formData.receiptUrl ? "Nota Terpasang" : "Pilih Foto Bukti")}
                                            </p>
                                            <p className="text-[10px] text-slate-400">Format gambar maks 10MB</p>
                                        </div>
                                        {formData.receiptUrl && !isUploading && (
                                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                                                <img src={formData.receiptUrl} alt="Nota" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {errorMsg && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-[12px] font-bold flex items-center gap-2">
                                    <Icon name="error" className="text-[16px] shrink-0" fill="true" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div className="flex gap-2.5 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="w-1/3 min-h-[46px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[13px] hover:bg-slate-200 transition-all cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleSave} 
                                    disabled={isUploading} 
                                    className="flex-1 min-h-[46px] rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] shadow-lg shadow-red-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    Simpan Transaksi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================
                6. MODAL CAIRKAN JIMPITAN
               ======================================================== */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 dark:bg-black/80 backdrop-blur-md animate-fade-in no-print">
                    <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 shadow-2xl animate-modal-in">
                        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="text-center mb-5">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center mx-auto mb-3 shadow-xs">
                                <Icon name="sync_alt" className="text-[28px]" fill="true" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Pencairan Kas Jimpitan</h3>
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                                Setorkan fisik dana Jimpitan ke Kas Utama RT
                            </p>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-center mb-4">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Saldo Jimpitan Tersedia</span>
                            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-sans">{formatRp(jimpitanBalance)}</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">Nominal Disetor (Rp)</label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    value={transferAmount} 
                                    onChange={e => { setTransferAmount(safeNumber(e.target.value)); setErrorMsg(''); }} 
                                    placeholder="0" 
                                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-4 py-3 text-[16px] font-black outline-none rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-red-500" 
                                />
                            </div>

                            {errorMsg && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-[12px] font-bold flex items-center gap-2">
                                    <Icon name="error" className="text-[16px] shrink-0" fill="true" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div className="flex gap-2.5 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => { setIsTransferModalOpen(false); setErrorMsg(''); }} 
                                    className="w-1/3 min-h-[46px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[13px] hover:bg-slate-200 transition-all cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleTransferJimpitan} 
                                    className="flex-1 min-h-[46px] rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[13px] shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                                >
                                    Mutasi Dana
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================
                7. IMAGE VIEWER FULLSCREEN
               ======================================================== */}
            {selectedImage && (
                <div 
                    className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in no-print" 
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setSelectedImage(null)} 
                            className="absolute -top-12 right-0 w-9 h-9 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors border border-white/20"
                        >
                            <Icon name="close" className="text-[20px]" />
                        </button>
                        <img src={selectedImage} alt="Bukti Transaksi" className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10" />
                    </div>
                </div>
            )}
        </div>
    );
}

export default BukuKas;
