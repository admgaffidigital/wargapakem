import React, { useState, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, getLocalDate, parseLocalDate, triggerHaptic } from '../../utils/helpers.js';

function IuranUmum({ iuranData, setIuranData, members, userRole, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions, identity }) {
    const [view, setView] = useState('list');
    const [selectedAgenda, setSelectedAgenda] = useState(null);
    const [formData, setFormData] = useState({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 });
    const [tempPayments, setTempPayments] = useState({});
    const [transferAmount, setTransferAmount] = useState('');
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [deleteConfirmAgendaId, setDeleteConfirmAgendaId] = useState(null);

    const activeMembers = useMemo(() => members.filter(m => m.status === 'Normal'), [members]);

    const handleSaveAgenda = () => {
        triggerHaptic();
        if (!formData.title || !formData.title.trim()) return setErrorMsg("Judul Agenda Wajib!");
        const safeMinAmount = safeNumber(formData.minAmount);
        if (safeMinAmount <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
        if (selectedAgenda) {
            setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate } : item));
            showToast('Agenda iuran berhasil diperbarui.');
        } else {
            setIuranData([{ id: Date.now(), title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate, payments: {}, transferredToKas: 0 }, ...iuranData]);
            showToast('Agenda iuran baru berhasil dibuat.');
        }
        setView('list');
    };

    const handleSavePayments = () => {
        triggerHaptic();
        const cleanPayments = {};
        for (let memberId in tempPayments) {
            const numId = parseInt(memberId);
            if (tempPayments[memberId] >= selectedAgenda.minAmount) cleanPayments[numId] = safeNumber(tempPayments[memberId]);
        }
        setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, payments: cleanPayments } : item));
        setView('list');
        showToast('Rekap pembayaran warga berhasil disimpan.');
    };

    const executeTransferToKas = () => {
        triggerHaptic();
        const nominal = safeNumber(transferAmount);
        const sisa = calculateTotal(selectedAgenda.payments || {}) - (selectedAgenda.transferredToKas || 0);
        if (nominal <= 0 || nominal > sisa) return setErrorMsg(`Nominal penarikan maksimal ${formatRp(sisa)}!`);
        setKasRtBalance(prev => prev + nominal);
        setKasRtTransactions(prev => [{ id: Date.now(), date: getLocalDate(), type: 'Pemasukan', category: 'Iuran Umum', description: `Mutasi Iuran: ${selectedAgenda.title}`, amount: nominal }, ...prev]);
        setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, transferredToKas: (selectedAgenda.transferredToKas || 0) + nominal } : item));
        setIsTransferModalOpen(false);
        setView('list');
        showToast(`Berhasil menyetor ${formatRp(nominal)} ke Kas Warga.`);
    };

    const calculateTotal = (obj) => {
        let total = 0;
        for (let k in obj) total += Number(obj[k] || 0);
        return total;
    };

    if (view === 'form') {
        return (
            <div className="bento-island-card max-w-2xl mx-auto p-5 sm:p-8 animate-modal-in">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => { triggerHaptic(); setView('list'); setErrorMsg(''); }}
                        className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-all shadow-xs"
                    >
                        <Icon name="arrow_back" className="text-[18px]" />
                    </button>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            {selectedAgenda ? 'Edit Agenda Iuran' : 'Buat Agenda Iuran Baru'}
                        </h2>
                        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                            Atur rincian keperluan iuran dan target pembayaran per warga.
                        </p>
                    </div>
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                            Nama / Keperluan Iuran *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={e => { setFormData({ ...formData, title: e.target.value }); setErrorMsg(''); }}
                            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-3 text-[15px] sm:text-[13.5px] font-medium outline-none rounded-2xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                            placeholder="Misal: Iuran 17 Agustus / Kebersihan"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                Batas Waktu Pelunasan
                            </label>
                            <input
                                type="date"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-3 text-[15px] sm:text-[13.5px] font-medium outline-none rounded-2xl transition-all text-slate-800 dark:text-white cursor-pointer"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                Target Minimal per Warga (Rp) *
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.minAmount}
                                onChange={e => { setFormData({ ...formData, minAmount: e.target.value }); setErrorMsg(''); }}
                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-3 text-[15px] sm:text-[13.5px] font-medium outline-none rounded-2xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {errorMsg && (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-500/30 text-red-600 dark:text-red-400 font-semibold text-[12px] px-4 py-3 rounded-2xl mt-5 flex items-center gap-2">
                        <Icon name="error" className="text-[16px] shrink-0" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                <div className="flex gap-2.5 mt-8 pt-5 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => { triggerHaptic(); setView('list'); setErrorMsg(''); }}
                        className="btn-native-secondary flex-1"
                    >
                        Batal
                    </button>
                    <button
                        onClick={handleSaveAgenda}
                        className="btn-native-primary flex-1"
                    >
                        <Icon name="save" className="text-[18px]" />
                        <span>Simpan Agenda</span>
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'manage') {
        const totalTerkumpul = calculateTotal(tempPayments);
        const lunasCount = activeMembers.filter(m => (tempPayments[m.id] || 0) >= selectedAgenda.minAmount).length;
        const transferred = selectedAgenda.transferredToKas || 0;
        const sisa = totalTerkumpul - transferred;

        return (
            <div className="space-y-6 max-w-7xl mx-auto">
                <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { triggerHaptic(); setView('list'); setErrorMsg(''); }}
                            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-all shadow-xs shrink-0"
                        >
                            <Icon name="arrow_back" className="text-[18px]" />
                        </button>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                {selectedAgenda.title}
                            </h2>
                            <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400">
                                Rekap Penyetoran Iuran &amp; Pelunasan Warga
                            </p>
                        </div>
                    </div>
                    {userRole === 'admin' && (
                        <button
                            onClick={() => { triggerHaptic(); window.print(); }}
                            className="btn-native-secondary shrink-0"
                        >
                            <Icon name="print" className="text-[17px] text-slate-500 dark:text-slate-400" />
                            <span>Cetak Laporan</span>
                        </button>
                    )}
                </div>

                {/* Print Layout */}
                <div className="hidden print-only">
                    <div className="kop-surat">
                        <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                        <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                        <div className="kop-surat-logo-right"></div>
                    </div>
                    <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Penerimaan Iuran Umum</h2><p className="text-[11pt]">Agenda: <strong>{selectedAgenda.title}</strong></p></div>
                    <div style={{ marginBottom: '15px', fontSize: '11pt' }}><p>Target Minimal per Warga: <strong>{formatRp(selectedAgenda.minAmount)}</strong></p><p>Total Terkumpul: <strong>{formatRp(totalTerkumpul)}</strong></p></div>
                    <table className="print-table">
                        <thead><tr><th width="5%">No</th><th width="35%">Nama Warga</th><th width="20%">Status</th><th width="20%">Nominal Bayar</th><th width="20%">TTD</th></tr></thead>
                        <tbody>
                            {activeMembers.map((m, idx) => {
                                const amt = tempPayments[m.id] || 0;
                                return <tr key={m.id}><td className="text-center font-medium">{idx + 1}</td><td className="font-medium">{m.name}</td><td className="text-center font-medium">{amt >= selectedAgenda.minAmount ? 'LUNAS' : '-'}</td><td className="text-right font-medium">{amt > 0 ? formatRp(amt) : ''}</td><td></td></tr>
                            })}
                        </tbody>
                    </table>
                    <div className="ttd-container">
                        <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                        <div className="ttd-box"><p>Penerima / Bendahara,</p><br /><div className="ttd-space" style={{ height: '60px' }}></div><p className="ttd-name">( ................................... )</p></div>
                    </div>
                </div>

                {/* Digital Manage Cards */}
                <div className="bento-island-card !p-5 sm:!p-7 no-print space-y-6">
                    {/* Top 3 Stat Bento Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Target / Warga</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{formatRp(selectedAgenda.minAmount)}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/20 text-center">
                            <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Dana Terkumpul</p>
                            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">{formatRp(totalTerkumpul)}</p>
                        </div>
                        <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-500/20 text-center flex flex-col items-center justify-center">
                            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Sisa (Belum Disetor)</p>
                            <p className="text-xl font-black text-amber-700 dark:text-amber-300 tracking-tight">{formatRp(sisa)}</p>
                            {userRole === 'admin' && sisa > 0 && (
                                <button
                                    onClick={() => {
                                        triggerHaptic();
                                        const savedTotal = calculateTotal(selectedAgenda.payments || {});
                                        const currentTotal = calculateTotal(tempPayments);
                                        if (savedTotal !== currentTotal) { setErrorMsg('Simpan Rekap Warga dulu sebelum menyetor dana!'); return; }
                                        setIsTransferModalOpen(true);
                                        setErrorMsg('');
                                    }}
                                    className="mt-2 text-[11px] font-bold px-3 py-1 rounded-xl bg-amber-600 text-white hover:bg-amber-700 active:scale-95 transition-all shadow-xs flex items-center gap-1"
                                >
                                    <Icon name="sync_alt" className="text-[14px]" />
                                    <span>Setor ke Kas Utama</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Progres Pelunasan Warga</span>
                            <span className="text-[13px] font-black text-slate-800 dark:text-white">
                                {lunasCount} <span className="text-[11px] font-semibold text-slate-400">/ {activeMembers.length} Warga Lunas</span>
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-red-600 to-amber-500 h-full rounded-full transition-all duration-700"
                                style={{ width: `${activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Grid of Warga Payment Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeMembers.map(member => {
                            const amountPaid = tempPayments[member.id] || 0;
                            const isLunas = amountPaid >= selectedAgenda.minAmount;
                            const isError = amountPaid > 0 && amountPaid < selectedAgenda.minAmount;
                            return (
                                <div
                                    key={member.id}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        userRole === 'admin'
                                            ? isError
                                                ? 'bg-red-50/50 dark:bg-red-950/20 border-red-500/30'
                                                : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 hover:border-red-500/30'
                                            : isLunas
                                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500/25'
                                                : 'bg-slate-50 dark:bg-slate-850 border-slate-200/80 dark:border-slate-800'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2.5">
                                        <h3 className="font-bold text-[13.5px] text-slate-800 dark:text-white truncate pr-2">{member.name}</h3>
                                        {isLunas ? (
                                            <span className="text-[9.5px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 border border-emerald-500/20">
                                                <Icon name="check" className="text-[11px]" /> LUNAS
                                            </span>
                                        ) : (
                                            <span className="text-[9.5px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 border border-slate-200/80 dark:border-slate-700">
                                                BELUM
                                            </span>
                                        )}
                                    </div>
                                    {userRole === 'admin' ? (
                                        <div>
                                            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200/80 dark:border-slate-700 focus-within:border-red-500 focus-within:bg-white dark:focus-within:bg-slate-900 transition-all">
                                                <span className="text-[12px] font-bold text-slate-400 mr-1.5">Rp</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={tempPayments[member.id] || ''}
                                                    onChange={e => {
                                                        setTempPayments(prev => ({ ...prev, [member.id]: safeNumber(e.target.value) }));
                                                        setErrorMsg('');
                                                    }}
                                                    className="w-full bg-transparent border-none text-[13.5px] font-bold outline-none p-0 text-slate-800 dark:text-white placeholder:text-slate-400"
                                                    placeholder="0"
                                                />
                                            </div>
                                            {isError && (
                                                <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                                                    <Icon name="info" className="text-[12px]" /> Kurang dari target {formatRp(selectedAgenda.minAmount)}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-[12px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                            <Icon name={isLunas ? "task_alt" : "pending"} className={isLunas ? "text-emerald-500" : "text-slate-400"} />
                                            <span>{isLunas ? "Telah lunas disetor" : "Menunggu pembayaran"}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {userRole === 'admin' && (
                        <div className="pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                            {errorMsg ? (
                                <div className="bg-red-50 dark:bg-red-950/40 border border-red-500/30 text-red-600 dark:text-red-400 font-semibold text-[12px] px-3.5 py-2 rounded-xl flex items-center gap-2">
                                    <Icon name="error" className="text-[16px] shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            ) : <div></div>}
                            <button
                                onClick={handleSavePayments}
                                className="btn-native-primary w-full sm:w-auto"
                            >
                                <Icon name="save" className="text-[18px]" />
                                <span>Simpan Rekap Warga</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* MODAL SETOR KE KAS UTAMA (Native Bottom Sheet) */}
                {isTransferModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                        <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-sm text-center border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                            {/* Mobile Pull Bar */}
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                            <div className="mb-4 bg-amber-50 dark:bg-amber-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/25 text-amber-600 dark:text-amber-400">
                                <Icon name="move_to_inbox" className="text-[34px]" fill="true" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Setor ke Kas Warga</h3>
                            <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                                Mutasi dana terkumpul dari agenda iuran ke Saldo Buku Kas Utama RT.
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-2xl mb-4 border border-slate-200/80 dark:border-slate-800">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Batas Maksimal Setor</p>
                                <p className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{formatRp(sisa)}</p>
                            </div>

                            <div className="text-left mb-5">
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Nominal Disetor (Rp)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={transferAmount}
                                    onChange={e => { setTransferAmount(safeNumber(e.target.value)); setErrorMsg(''); }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-2.5 text-[16px] sm:text-[14px] font-bold outline-none rounded-xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="0"
                                />
                            </div>

                            {errorMsg && (
                                <div className="bg-red-50 dark:bg-red-950/40 border border-red-500/30 text-red-600 dark:text-red-400 font-semibold text-[11.5px] px-3.5 py-2 rounded-xl mb-4 text-left flex items-center gap-1.5">
                                    <Icon name="error" className="text-[15px] shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div className="flex gap-2.5">
                                <button
                                    onClick={() => { triggerHaptic(); setIsTransferModalOpen(false); setErrorMsg(''); }}
                                    className="btn-native-secondary flex-1"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={executeTransferToKas}
                                    className="btn-native-primary flex-1 !bg-amber-600 hover:!bg-amber-700"
                                >
                                    Setor Dana
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* BENTO HEADER CARD */}
            <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/25 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="payments" className="text-[26px]" fill="true" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Agenda Iuran Warga</h2>
                        <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Penggalangan dana kegiatan, fasilitas, dan kebersihan lingkungan.
                        </p>
                    </div>
                </div>

                {userRole === 'admin' && (
                    <button
                        onClick={() => {
                            triggerHaptic();
                            setFormData({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 });
                            setSelectedAgenda(null);
                            setView('form');
                            setErrorMsg('');
                        }}
                        className="btn-native-primary shrink-0 w-full sm:w-auto"
                    >
                        <Icon name="add" className="text-[18px]" />
                        <span>Buat Agenda Baru</span>
                    </button>
                )}
            </div>

            {/* LIST AGENDAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {iuranData.map(agenda => {
                    const payments = agenda.payments || {};
                    const totalTerkumpul = calculateTotal(payments);
                    const lunasCount = activeMembers.filter(m => payments[m.id] >= agenda.minAmount).length;
                    const progressPercent = activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100;

                    return (
                        <div
                            key={agenda.id}
                            className="bento-island-card flex flex-col justify-between hover:border-red-500/30 transition-all duration-300"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white tracking-tight leading-snug">
                                        {agenda.title}
                                    </h3>
                                    <span className="shrink-0 text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 flex items-center gap-1">
                                        <Icon name="event" className="text-[12px]" />
                                        {parseLocalDate(agenda.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5 mb-4">
                                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                                        <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Target / Warga</p>
                                        <p className="text-[14px] font-black text-slate-800 dark:text-white tracking-tight">{formatRp(agenda.minAmount)}</p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/20">
                                        <p className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Terkumpul</p>
                                        <p className="text-[14px] font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
                                            {userRole === 'admin' ? formatRp(totalTerkumpul) : `${lunasCount} Warga`}
                                        </p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mb-1.5">
                                        <span>Status Pelunasan</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{lunasCount} / {activeMembers.length} Warga</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-red-600 to-amber-500 h-full rounded-full transition-all duration-700"
                                            style={{ width: `${progressPercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                {userRole === 'admin' ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                triggerHaptic();
                                                setSelectedAgenda(agenda);
                                                setTempPayments(agenda.payments || {});
                                                setView('manage');
                                            }}
                                            className="btn-native-action flex-1 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20 text-[12.5px] font-bold gap-1.5 px-3 py-2"
                                        >
                                            <Icon name="edit_document" className="text-[16px]" />
                                            <span>Kelola Data</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                triggerHaptic();
                                                setFormData({ title: agenda.title, minAmount: agenda.minAmount, dueDate: agenda.dueDate, payments: agenda.payments || {}, transferredToKas: agenda.transferredToKas || 0 });
                                                setSelectedAgenda(agenda);
                                                setView('form');
                                                setErrorMsg('');
                                            }}
                                            className="btn-native-action w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                                            title="Ubah Agenda"
                                        >
                                            <Icon name="tune" className="text-[16px]" />
                                        </button>
                                        <button
                                            onClick={() => { triggerHaptic(); setDeleteConfirmAgendaId(agenda.id); }}
                                            className="btn-native-action w-9 h-9 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20"
                                            title="Hapus Agenda"
                                        >
                                            <Icon name="delete" className="text-[16px]" />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => {
                                            triggerHaptic();
                                            setSelectedAgenda(agenda);
                                            setTempPayments(agenda.payments || {});
                                            setView('manage');
                                        }}
                                        className="btn-native-secondary w-full"
                                    >
                                        <Icon name="visibility" className="text-[16px]" />
                                        <span>Cek Status Pembayaran</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {iuranData.length === 0 && (
                <div className="bento-island-card p-12 text-center">
                    <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-2xl mb-4 mx-auto border border-slate-200 dark:border-slate-700 text-slate-400">
                        <Icon name="volunteer_activism" className="text-[40px]" fill="true" />
                    </div>
                    <p className="text-slate-800 dark:text-white font-bold text-[16px] tracking-tight">Belum Ada Agenda Iuran</p>
                    <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mt-1">Daftar agenda donasi atau tagihan lingkungan akan tampil di sini.</p>
                </div>
            )}

            {/* MODAL KONFIRMASI HAPUS AGENDA (Native Bottom Sheet) */}
            {deleteConfirmAgendaId && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 w-full max-w-sm text-center border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="mb-4 bg-red-50 dark:bg-red-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-red-500/25 text-red-600">
                            <Icon name="delete" className="text-[34px]" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Hapus Agenda?</h3>
                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            Agenda iuran beserta seluruh rekapan pembayaran warga akan dihapus permanen.
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => { triggerHaptic(); setDeleteConfirmAgendaId(null); }}
                                className="btn-native-secondary flex-1"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    triggerHaptic();
                                    setIuranData(iuranData.filter(i => i.id !== deleteConfirmAgendaId));
                                    setDeleteConfirmAgendaId(null);
                                    showToast('Agenda iuran berhasil dihapus.');
                                }}
                                className="btn-native-primary !bg-red-600 hover:!bg-red-700 flex-1"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IuranUmum;
