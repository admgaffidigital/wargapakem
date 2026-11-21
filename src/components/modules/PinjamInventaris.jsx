import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { safeNumber, getLocalDate, parseLocalDate, triggerHaptic } from '../../utils/helpers.js';

function PinjamInventaris({ inventarisData, setInventarisData, pinjamData, setPinjamData, members, userRole }) {
    const [view, setView] = useState('list');
    const [formData, setFormData] = useState({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
    const [errorMsg, setErrorMsg] = useState('');
    const [konfirmReturnId, setKonfirmReturnId] = useState(null);
    const [konfirmRejectId, setKonfirmRejectId] = useState(null);

    const getStokTersedia = (itemId) => {
        const item = inventarisData.find(i => i.id === itemId);
        if (!item) return 0;
        const stokPinjam = item.qtyPinjam !== undefined
            ? item.qtyPinjam
            : ((item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0)) || (item.qty || 1);
        const totalDipinjam = pinjamData
            .filter(p => p.itemId === itemId && p.status === 'approved')
            .reduce((sum, p) => sum + (p.qty || 1), 0);
        return Math.max(0, stokPinjam - totalDipinjam);
    };

    const handleSubmitPinjam = () => {
        triggerHaptic();
        if (!formData.namaWarga.trim()) return setErrorMsg('Nama warga wajib diisi!');
        if (!formData.itemId) return setErrorMsg('Pilih barang yang akan dipinjam!');
        if (!formData.keperluan.trim()) return setErrorMsg('Keperluan / nama acara wajib diisi!');
        if (!formData.tanggalPinjam) return setErrorMsg('Tanggal pinjam wajib diisi!');
        if (!formData.tanggalKembali) return setErrorMsg('Perkiraan tanggal kembali wajib diisi!');
        if (formData.tanggalKembali < formData.tanggalPinjam) return setErrorMsg('Tanggal kembali tidak boleh sebelum tanggal pinjam!');

        const wargaValid = members.find(m => m.name.toLowerCase() === formData.namaWarga.trim().toLowerCase());
        if (!wargaValid) return setErrorMsg(`Nama "${formData.namaWarga}" tidak terdaftar di sistem warga.`);

        const qtyMinta = Math.max(1, safeNumber(formData.qty) || 1);
        const stokTersedia = getStokTersedia(Number(formData.itemId));
        if (stokTersedia <= 0) return setErrorMsg('Stok barang ini sedang habis / semua sedang dipinjam!');
        if (qtyMinta > stokTersedia) return setErrorMsg(`Jumlah yang diminta (${qtyMinta}) melebihi stok tersedia (${stokTersedia} unit)!`);

        const sudahAjukan = pinjamData.find(p => p.itemId === Number(formData.itemId) && p.namaWarga.toLowerCase() === formData.namaWarga.trim().toLowerCase() && (p.status === 'pending' || p.status === 'approved'));
        if (sudahAjukan) return setErrorMsg('Anda sudah memiliki pengajuan aktif untuk barang ini!');

        const item = inventarisData.find(i => i.id === Number(formData.itemId));
        const newPinjam = {
            id: Date.now(),
            itemId: Number(formData.itemId),
            namaBarang: item.name,
            namaWarga: formData.namaWarga.trim(),
            keperluan: formData.keperluan.trim(),
            qty: qtyMinta,
            tanggalPinjam: formData.tanggalPinjam,
            tanggalKembali: formData.tanggalKembali,
            catatan: formData.catatan.trim(),
            status: 'pending',
            tanggalAjuan: getLocalDate(),
            tanggalApprove: null,
            tanggalKembaliAktual: null,
        };
        setPinjamData([newPinjam, ...pinjamData]);
        showToast(`Pengajuan pinjam ${item.name} berhasil dikirim!`);
        setFormData({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
        setView('list');
        setErrorMsg('');
    };

    const handleApprove = (id) => {
        triggerHaptic();
        setPinjamData(pinjamData.map(p => p.id === id ? { ...p, status: 'approved', tanggalApprove: getLocalDate() } : p));
        showToast('Pengajuan disetujui. Barang siap dipinjam.');
    };

    const handleReject = (id) => {
        triggerHaptic();
        setPinjamData(pinjamData.filter(p => p.id !== id));
        setKonfirmRejectId(null);
        showToast('Pengajuan ditolak dan dihapus.');
    };

    const handleReturn = (id) => {
        triggerHaptic();
        setPinjamData(pinjamData.filter(p => p.id !== id));
        setKonfirmReturnId(null);
        showToast('Barang berhasil dikembalikan. Stok inventaris pulih.');
    };

    const pendingList = pinjamData.filter(p => p.status === 'pending');
    const approvedList = pinjamData.filter(p => p.status === 'approved');
    const allActive = [...pendingList, ...approvedList];

    return (
        <div className="space-y-6">
            {/* BENTO HEADER CARD */}
            <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="handshake" className="text-[26px]" fill="true" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            Pinjam Fasilitas RT
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Layanan peminjaman alat, tenda, kursi dan barang lingkungan.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {userRole === 'admin' && (
                        <button
                            onClick={() => { triggerHaptic(); setView(view === 'admin' ? 'list' : 'admin'); }}
                            className={`btn-native-action flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] font-bold ${
                                view === 'admin'
                                    ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700'
                            }`}
                        >
                            <Icon name="admin_panel_settings" className="text-[16px]" />
                            <span>Panel Admin</span>
                            {pendingList.length > 0 && (
                                <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                    {pendingList.length}
                                </span>
                            )}
                        </button>
                    )}

                    <button
                        onClick={() => { triggerHaptic(); setView(view === 'form' ? 'list' : 'form'); setErrorMsg(''); }}
                        className="btn-native-primary flex-1 sm:flex-none shrink-0"
                    >
                        <Icon name={view === 'form' ? "close" : "add"} className="text-[18px]" />
                        <span>{view === 'form' ? 'Batal' : 'Ajukan Pinjam'}</span>
                    </button>
                </div>
            </div>

            {/* FORM PENGAJUAN PINJAM */}
            {view === 'form' && (
                <div className="bento-island-card max-w-2xl mx-auto p-5 sm:p-7 animate-modal-in">
                    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <Icon name="edit_document" className="text-[20px] text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Form Permohonan Peminjaman</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Nama Warga */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                Nama Warga Peminjam *
                            </label>
                            <input
                                type="text"
                                value={formData.namaWarga}
                                onChange={e => setFormData(p => ({ ...p, namaWarga: e.target.value }))}
                                placeholder="Ketik nama sesuai data buku warga..."
                                list="warga-list-pinjam"
                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                            />
                            <datalist id="warga-list-pinjam">
                                {members.map(m => <option key={m.id} value={m.name} />)}
                            </datalist>
                        </div>

                        {/* Pilih Barang */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                Barang yang Dipinjam *
                            </label>
                            <select
                                value={formData.itemId}
                                onChange={e => setFormData(p => ({ ...p, itemId: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white cursor-pointer"
                            >
                                <option value="">-- Pilih Barang --</option>
                                {inventarisData.map(item => {
                                    const stok = getStokTersedia(item.id);
                                    return (
                                        <option key={item.id} value={item.id} disabled={stok <= 0}>
                                            {item.name} (Tersedia: {stok} unit){stok <= 0 ? ' [HABIS]' : ''}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Jumlah & Keperluan */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Jumlah Unit *
                                </label>
                                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic();
                                            setFormData(p => ({ ...p, qty: Math.max(1, (p.qty || 1) - 1) }));
                                        }}
                                        className="w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 rounded-lg flex items-center justify-center font-black text-[16px] text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-xs shrink-0"
                                    >
                                        −
                                    </button>
                                    <div className="flex-1 text-center font-black text-[15px] text-slate-800 dark:text-white">
                                        {formData.qty || 1} <span className="text-[11px] font-normal text-slate-400">unit</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic();
                                            const stok = formData.itemId ? getStokTersedia(Number(formData.itemId)) : 99;
                                            setFormData(p => ({ ...p, qty: Math.min(stok, (p.qty || 1) + 1) }));
                                        }}
                                        className="w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 rounded-lg flex items-center justify-center font-black text-[16px] text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-xs shrink-0"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Keperluan / Nama Hajat *
                                </label>
                                <input
                                    type="text"
                                    value={formData.keperluan}
                                    onChange={e => setFormData(p => ({ ...p, keperluan: e.target.value }))}
                                    placeholder="Misal: Tasyakuran, Pengajian..."
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        {/* Tanggal Pinjam & Kembali */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Tanggal Pinjam *
                                </label>
                                <input
                                    type="date"
                                    value={formData.tanggalPinjam}
                                    onChange={e => setFormData(p => ({ ...p, tanggalPinjam: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Estimasi Kembali *
                                </label>
                                <input
                                    type="date"
                                    value={formData.tanggalKembali}
                                    min={formData.tanggalPinjam}
                                    onChange={e => setFormData(p => ({ ...p, tanggalKembali: e.target.value }))}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Catatan Tambahan */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                Catatan Tambahan <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.catatan}
                                onChange={e => setFormData(p => ({ ...p, catatan: e.target.value }))}
                                placeholder="Keterangan tambahan jika diperlukan..."
                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="bg-red-50 dark:bg-red-950/40 border border-red-500/30 text-red-600 dark:text-red-400 font-semibold text-[11.5px] px-3.5 py-2 rounded-xl mt-4 flex items-center gap-1.5">
                            <Icon name="error" className="text-[15px] shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <div className="flex gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => { triggerHaptic(); setView('list'); setErrorMsg(''); }}
                            className="btn-native-secondary flex-1"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmitPinjam}
                            className="btn-native-primary flex-1"
                        >
                            <Icon name="send" className="text-[18px]" />
                            <span>Kirim Pengajuan</span>
                        </button>
                    </div>
                </div>
            )}

            {/* PANEL ADMIN PINJAM INVENTARIS */}
            {view === 'admin' && userRole === 'admin' && (
                <div className="space-y-5">
                    {/* Antrean Menunggu Persetujuan */}
                    {pendingList.length > 0 && (
                        <div className="bento-island-card !p-5 space-y-3 border-amber-500/30">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Menunggu Persetujuan ({pendingList.length})
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {pendingList.map(p => (
                                    <div
                                        key={p.id}
                                        className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-[14px] text-slate-800 dark:text-white">{p.namaWarga}</p>
                                            <p className="text-[12.5px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                                                <Icon name="inventory_2" className="text-[14px]" />
                                                <span>{p.namaBarang} ({p.qty || 1} unit)</span>
                                            </p>
                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                                                {parseLocalDate(p.tanggalPinjam).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} s/d {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} • Keperluan: "{p.keperluan}"
                                            </p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => { triggerHaptic(); setKonfirmRejectId(p.id); }}
                                                className="btn-native-action px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20 text-[11.5px] font-bold"
                                            >
                                                Tolak
                                            </button>
                                            <button
                                                onClick={() => handleApprove(p.id)}
                                                className="btn-native-action px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-bold shadow-xs flex items-center gap-1"
                                            >
                                                <Icon name="check" className="text-[15px]" />
                                                <span>Setujui</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sedang Dipinjam */}
                    {approvedList.length > 0 && (
                        <div className="bento-island-card !p-5 space-y-3">
                            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                                <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight uppercase">
                                    Sedang Dipinjam ({approvedList.length})
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {approvedList.map(p => (
                                    <div
                                        key={p.id}
                                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-[14px] text-slate-800 dark:text-white">{p.namaWarga}</p>
                                            <p className="text-[12.5px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                                <Icon name="inventory_2" className="text-[14px]" />
                                                <span>{p.namaBarang} ({p.qty || 1} unit)</span>
                                            </p>
                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                                                Est. Kembali: {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} • "{p.keperluan}"
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => { triggerHaptic(); setKonfirmReturnId(p.id); }}
                                            className="btn-native-action px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11.5px] font-bold shadow-xs flex items-center gap-1 shrink-0"
                                        >
                                            <Icon name="assignment_return" className="text-[15px]" />
                                            <span>Barang Kembali</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {allActive.length === 0 && (
                        <div className="bento-island-card p-10 text-center">
                            <Icon name="check_circle" className="text-[40px] text-emerald-500 mx-auto mb-2" fill="true" />
                            <p className="text-slate-800 dark:text-white font-bold text-[15px]">Tidak Ada Pinjaman Aktif</p>
                            <p className="text-[12px] font-medium text-slate-400">Semua barang berada di gudang inventaris RT.</p>
                        </div>
                    )}
                </div>
            )}

            {/* DAFTAR STATUS UNTUK WARGA */}
            {view === 'list' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {inventarisData.map(item => {
                        const stok = getStokTersedia(item.id);
                        const sedangDipinjam = pinjamData.filter(p => p.itemId === item.id && p.status === 'approved');
                        return (
                            <div
                                key={item.id}
                                className={`bento-island-card flex items-center gap-3.5 p-4 ${
                                    stok <= 0 ? 'bg-red-50/30 dark:bg-red-950/10 border-red-500/25' : ''
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                                    stok <= 0
                                        ? 'bg-red-50 dark:bg-red-950/40 border-red-500/25 text-red-600 dark:text-red-400'
                                        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                                }`}>
                                    <Icon name="inventory_2" className="text-[22px]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-bold text-[13.5px] text-slate-800 dark:text-white truncate">{item.name}</p>
                                    <p className={`text-[11px] font-bold mt-0.5 ${
                                        stok <= 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                        {stok <= 0 ? 'Semua sedang dipinjam' : `${stok} dari ${item.qty} unit siap dipinjam`}
                                    </p>
                                    {sedangDipinjam.length > 0 && (
                                        <div className="mt-1 text-[10px] text-slate-400 truncate">
                                            Dipinjam: {sedangDipinjam.map(p => p.namaWarga).join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL KONFIRMASI PENGEMBALIAN (Native Bottom Sheet) */}
            {konfirmReturnId && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 w-full max-w-sm text-center border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        {(() => {
                            const p = pinjamData.find(x => x.id === konfirmReturnId);
                            return p ? (
                                <>
                                    <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/25 text-emerald-600">
                                        <Icon name="assignment_return" className="text-[34px]" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Konfirmasi Pengembalian</h3>
                                    <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                                        Barang <span className="font-bold text-slate-800 dark:text-white">{p.namaBarang}</span> dikembalikan oleh <span className="font-bold text-slate-800 dark:text-white">{p.namaWarga}</span>.
                                    </p>
                                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-6">
                                        Stok inventaris RT akan otomatis pulih.
                                    </p>
                                    <div className="flex gap-2.5">
                                        <button
                                            onClick={() => { triggerHaptic(); setKonfirmReturnId(null); }}
                                            className="btn-native-secondary flex-1"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            onClick={() => handleReturn(konfirmReturnId)}
                                            className="btn-native-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700"
                                        >
                                            Konfirmasi
                                        </button>
                                    </div>
                                </>
                            ) : null;
                        })()}
                    </div>
                </div>
            )}

            {/* MODAL KONFIRMASI TOLAK (Native Bottom Sheet) */}
            {konfirmRejectId && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 w-full max-w-sm text-center border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="mb-4 bg-red-50 dark:bg-red-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-red-500/25 text-red-600">
                            <Icon name="cancel" className="text-[34px]" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Tolak Pengajuan?</h3>
                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            Permohonan pinjam ini akan ditolak dan dihapus dari daftar antrean.
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => { triggerHaptic(); setKonfirmRejectId(null); }}
                                className="btn-native-secondary flex-1"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => handleReject(konfirmRejectId)}
                                className="btn-native-primary !bg-red-600 hover:!bg-red-700 flex-1"
                            >
                                Tolak &amp; Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PinjamInventaris;
