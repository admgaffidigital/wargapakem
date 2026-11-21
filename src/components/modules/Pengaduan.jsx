import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { uploadToGoogleDrive, triggerHaptic } from '../../utils/helpers.js';
import { showToast } from '../common/Toast.jsx';

function Pengaduan({ laporanData, setLaporanData, userRole }) {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState({ title: '', category: 'Infrastruktur', description: '', reporter: '', imageUrl: '', status: 'Menunggu' });
    const [errorMsg, setErrorMsg] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [filterStatus, setFilterStatus] = useState('Semua');

    const categories = ['Infrastruktur', 'Keamanan', 'Kebersihan', 'Sosial', 'Lainnya'];
    const statuses = ['Menunggu', 'Diproses', 'Selesai'];

    const handleSave = () => {
        triggerHaptic();
        if (!formData.title || !formData.description) return setErrorMsg("Judul dan Deskripsi laporan wajib diisi!");
        const newLaporan = { id: Date.now(), date: new Date().toISOString(), ...formData };
        setLaporanData([newLaporan, ...(laporanData || [])]);
        setIsFormOpen(false);
        setFormData({ title: '', category: 'Infrastruktur', description: '', reporter: '', imageUrl: '', status: 'Menunggu' });
        showToast('Laporan berhasil dikirim dan tersimpan.');
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
        if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran maksimal 10MB!');
        setIsUploading(true);
        setErrorMsg('');
        try {
            const url = await uploadToGoogleDrive(file, 800, 0.6);
            setFormData({ ...formData, imageUrl: url });
        } catch (error) {
            setErrorMsg(error);
        } finally {
            setIsUploading(false);
        }
    };

    const changeStatus = (id, newStatus) => {
        triggerHaptic();
        setLaporanData((laporanData || []).map(item => item.id === id ? { ...item, status: newStatus } : item));
        showToast(`Status laporan diubah ke ${newStatus}.`);
    };

    const filteredData = (laporanData || []).filter(item => filterStatus === 'Semua' || item.status === filterStatus);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'Menunggu':
                return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-500/25';
            case 'Diproses':
                return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-500/25';
            case 'Selesai':
                return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
            default:
                return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200';
        }
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            {/* BENTO HEADER CARD */}
            <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-500/25 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="campaign" className="text-[26px]" fill="true" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            Lapor &amp; Aspirasi Warga
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Pusat penyampaian keluhan fasilitas, masukan dan aspirasi lingkungan.
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => {
                        triggerHaptic();
                        setIsFormOpen(true);
                        setErrorMsg('');
                    }}
                    className="btn-native-primary shrink-0 w-full sm:w-auto"
                >
                    <Icon name="add" className="text-[18px]" />
                    <span>Buat Laporan</span>
                </button>
            </div>

            {/* FILTER STATUS PILLS */}
            <div className="slide-list-scroller flex items-center gap-2 pb-1">
                {['Semua', ...statuses].map(status => (
                    <button
                        key={status}
                        onClick={() => { triggerHaptic(); setFilterStatus(status); }}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-[12px] whitespace-nowrap transition-all active:scale-95 cursor-pointer ${
                            filterStatus === status
                                ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                                : 'bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                        }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* LIST REPORTS */}
            {filteredData.length === 0 ? (
                <div className="bento-island-card p-12 text-center">
                    <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-2xl mb-4 mx-auto border border-slate-200 dark:border-slate-700 text-slate-400">
                        <Icon name="task_alt" className="text-[40px]" />
                    </div>
                    <p className="text-slate-800 dark:text-white font-bold text-[16px] tracking-tight">Lingkungan Aman Terkendali</p>
                    <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mt-1">Belum ada pengaduan atau aspirasi aktif di kategori ini.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    {filteredData.map(item => (
                        <div
                            key={item.id}
                            className="bento-island-card flex flex-col justify-between hover:border-blue-500/30 transition-all duration-300"
                        >
                            <div>
                                <div className="flex justify-between items-start gap-2 mb-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-slate-200/80 dark:border-slate-700">
                                            {item.category}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${getStatusBadge(item.status)}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                    {userRole === 'admin' && (
                                        <button
                                            onClick={() => { triggerHaptic(); setDeleteConfirmId(item.id); }}
                                            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20 flex items-center justify-center transition-colors"
                                            title="Hapus Laporan"
                                        >
                                            <Icon name="delete" className="text-[14px]" />
                                        </button>
                                    )}
                                </div>

                                <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-300 text-[13px] leading-relaxed mb-4 whitespace-pre-line line-clamp-4">
                                    {item.description}
                                </p>

                                {item.imageUrl && (
                                    <div className="mb-4 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 h-44 border border-slate-200/80 dark:border-slate-700">
                                        <img src={item.imageUrl} alt="Lampiran Laporan" loading="lazy" className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                                    <div className="flex items-center gap-1">
                                        <Icon name="person" className="text-[13px]" />
                                        <span>{item.reporter || 'Warga Anonim'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Icon name="schedule" className="text-[13px]" />
                                        <span>{formatDate(item.date)}</span>
                                    </div>
                                </div>

                                {userRole === 'admin' && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-1.5">
                                        {statuses.map(st => (
                                            item.status !== st && (
                                                <button
                                                    key={st}
                                                    onClick={() => changeStatus(item.id, st)}
                                                    className="btn-native-action flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700"
                                                >
                                                    Set {st}
                                                </button>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL FORM BUAT LAPORAN (Native Bottom Sheet) */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[90vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-lg border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-5">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                <Icon name="campaign" className="text-blue-600" />
                                <span>Buat Laporan Warga</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => { triggerHaptic(); setIsFormOpen(false); }}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center active:scale-95 transition-all"
                            >
                                <Icon name="close" className="text-[17px]" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Judul Laporan *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="Cth: Lampu jalan mati di Gang Mawar..."
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Kategori
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white cursor-pointer"
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Detail / Deskripsi Masalah *
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows="3"
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white resize-none placeholder:text-slate-400"
                                    placeholder="Ceritakan detail masalah atau aspirasi Anda..."
                                ></textarea>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Nama Pelapor <span className="text-slate-400 font-normal lowercase">(opsional / kosongkan jika anonim)</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.reporter}
                                    onChange={e => setFormData({ ...formData, reporter: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="Kosongkan jika ingin anonim"
                                />
                            </div>

                            {/* Lampiran Foto */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Foto Bukti <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                                </label>
                                <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative bg-white dark:bg-slate-850">
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                    {isUploading ? (
                                        <div className="flex flex-col items-center justify-center py-2 text-slate-500">
                                            <Icon name="sync" className="animate-spin text-[26px] mb-1 text-blue-500" />
                                            <span className="text-[12px] font-semibold">Memproses foto...</span>
                                        </div>
                                    ) : formData.imageUrl ? (
                                        <div className="relative inline-block">
                                            <img src={formData.imageUrl} alt="Preview" className="h-28 object-contain rounded-lg shadow-xs" />
                                            <span className="block mt-1 text-[10px] font-semibold text-blue-600">Ketuk untuk mengganti</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-2 text-slate-400">
                                            <Icon name="add_a_photo" className="text-[28px] mb-1" />
                                            <span className="text-[12px] font-semibold">Upload foto bukti kondisi</span>
                                        </div>
                                    )}
                                </div>
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
                                onClick={() => { triggerHaptic(); setIsFormOpen(false); }}
                                className="btn-native-secondary flex-1"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isUploading}
                                className="btn-native-primary flex-1 !bg-blue-600 hover:!bg-blue-700 disabled:opacity-50"
                            >
                                Kirim Laporan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL KONFIRMASI HAPUS (Native Bottom Sheet) */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 w-full max-w-sm text-center border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="mb-4 bg-red-50 dark:bg-red-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-red-500/25 text-red-600">
                            <Icon name="delete" className="text-[34px]" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Hapus Laporan?</h3>
                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            Laporan ini akan dihapus permanen dari sistem pengaduan warga.
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => { triggerHaptic(); setDeleteConfirmId(null); }}
                                className="btn-native-secondary flex-1"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic();
                                    setLaporanData((laporanData || []).filter(item => item.id !== deleteConfirmId));
                                    setDeleteConfirmId(null);
                                    showToast('Laporan berhasil dihapus.');
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

export default Pengaduan;
