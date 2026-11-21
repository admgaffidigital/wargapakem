import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { uploadToGoogleDrive, triggerHaptic } from '../../utils/helpers.js';

function Inventaris({ data, setData, userRole, pinjamData }) {
    const [formData, setFormData] = useState({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' });
    const [editingId, setEditingId] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const getTotalStok = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0) + (item.kondisi?.rusak || 0);
    const getStokPinjam = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0);

    const handleSave = () => {
        triggerHaptic();
        if (!formData.name.trim()) return setErrorMsg('Nama barang wajib diisi!');
        const k = formData.kondisi;
        const totalQty = (k.baru || 0) + (k.bekas || 0) + (k.rusak || 0);
        if (totalQty <= 0) return setErrorMsg('Jumlah barang minimal 1 unit (isi salah satu kondisi)!');

        const imgUrl = formData.imageUrl || '';

        const itemData = {
            name: formData.name.trim(),
            kondisi: { baru: k.baru || 0, bekas: k.bekas || 0, rusak: k.rusak || 0 },
            qty: totalQty,
            qtyPinjam: (k.baru || 0) + (k.bekas || 0),
            imageUrl: imgUrl,
        };

        const savedId = editingId;
        if (savedId) {
            setData(prev => prev.map(item => item.id === savedId ? { ...item, ...itemData } : item));
            showToast('Data inventaris berhasil diperbarui.');
        } else {
            const newId = Date.now();
            setData(prev => [{ id: newId, ...itemData }, ...prev]);
            showToast('Barang baru berhasil ditambahkan.');
        }
        setIsFormOpen(false);
        setErrorMsg('');
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return setErrorMsg('Ukuran foto maksimal 2MB!');
        setIsUploading(true);
        try {
            const url = await uploadToGoogleDrive(file, 800, 0.85);
            setFormData(prev => ({ ...prev, imageUrl: url }));
        } catch (error) {
            setErrorMsg(error);
        } finally {
            setIsUploading(false);
        }
    };

    const openEditForm = (item) => {
        triggerHaptic();
        setFormData({
            name: item.name,
            kondisi: item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 },
            imageUrl: item.imageUrl || '',
        });
        setEditingId(item.id);
        setIsFormOpen(true);
        setErrorMsg('');
        setIsUploading(false);
    };

    const KondisiInput = ({ label, field, colorClass, icon }) => (
        <div className={`flex items-center justify-between bg-slate-50 dark:bg-slate-800 border ${colorClass} rounded-2xl px-4 py-2.5`}>
            <div className="flex items-center gap-2">
                <Icon name={icon} className="text-[18px] text-slate-500 dark:text-slate-400" />
                <span className="text-[12.5px] font-bold text-slate-700 dark:text-slate-200">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic();
                        setFormData(p => ({ ...p, kondisi: { ...p.kondisi, [field]: Math.max(0, (p.kondisi[field] || 0) - 1) } }));
                    }}
                    className="w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 rounded-xl flex items-center justify-center font-black text-[16px] text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-xs"
                >
                    −
                </button>
                <span className="w-8 text-center font-black text-[15px] text-slate-800 dark:text-white">
                    {formData.kondisi[field] || 0}
                </span>
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic();
                        setFormData(p => ({ ...p, kondisi: { ...p.kondisi, [field]: (p.kondisi[field] || 0) + 1 } }));
                    }}
                    className="w-8 h-8 bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 rounded-xl flex items-center justify-center font-black text-[16px] text-slate-700 dark:text-slate-200 active:scale-95 transition-all shadow-xs"
                >
                    +
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* BENTO HEADER */}
            <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="inventory_2" className="text-[26px]" fill="true" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Aset &amp; Inventaris</h2>
                        <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Daftar barang fasilitas RT beserta kondisi dan stok pinjam warga.
                        </p>
                    </div>
                </div>
                {userRole === 'admin' && (
                    <button
                        onClick={() => {
                            triggerHaptic();
                            setFormData({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' });
                            setEditingId(null);
                            setIsFormOpen(true);
                            setErrorMsg('');
                            setIsUploading(false);
                        }}
                        className="btn-native-primary shrink-0 w-full sm:w-auto"
                    >
                        <Icon name="add" className="text-[18px]" />
                        <span>Tambah Barang</span>
                    </button>
                )}
            </div>

            {/* GRID KARTU BARANG */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {data.map(item => {
                    const kondisi = item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 };
                    const totalStok = getTotalStok({ kondisi });
                    const stokPinjam = getStokPinjam({ kondisi });
                    const sedangDipinjam = pinjamData ? pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').length : 0;
                    const tersedia = Math.max(0, stokPinjam - sedangDipinjam);

                    return (
                        <div
                            key={item.id}
                            className="bento-island-card !p-0 overflow-hidden flex flex-col justify-between hover:border-amber-500/30 transition-all duration-300 group"
                        >
                            {/* Gambar */}
                            <div className="w-full relative shrink-0 bg-slate-100 dark:bg-slate-800 h-48 overflow-hidden border-b border-slate-100 dark:border-slate-800">
                                {item.imageUrl ? (
                                    <img
                                        src={item.imageUrl}
                                        loading="lazy"
                                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                                        alt={item.name}
                                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                                        <Icon name="inventory_2" className="text-[52px]" />
                                    </div>
                                )}

                                {/* Badge Pinjam */}
                                {sedangDipinjam > 0 && (
                                    <div className="absolute top-3 left-3 bg-red-600 text-white px-2.5 py-1 rounded-lg font-bold text-[10px] shadow-sm flex items-center gap-1 uppercase tracking-wider">
                                        <Icon name="handshake" className="text-[12px]" />
                                        <span>{sedangDipinjam} Dipinjam</span>
                                    </div>
                                )}

                                {/* Badge Total Stok */}
                                <div className="absolute top-3 right-3 bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-white px-2.5 py-1 rounded-lg font-bold text-[11px] shadow-sm border border-slate-200/80 dark:border-slate-700 flex items-center gap-1">
                                    <Icon name="tag" className="text-[12px] text-amber-500" />
                                    <span>{totalStok} unit</span>
                                </div>
                            </div>

                            {/* Detail */}
                            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 dark:text-white leading-snug tracking-tight">
                                        {item.name}
                                    </h3>

                                    {/* Chips Kondisi */}
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {kondisi.baru > 0 && (
                                            <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                <Icon name="verified" className="text-[11px]" />Baru: {kondisi.baru}
                                            </span>
                                        )}
                                        {kondisi.bekas > 0 && (
                                            <span className="text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                <Icon name="refresh" className="text-[11px]" />Bekas: {kondisi.bekas}
                                            </span>
                                        )}
                                        {kondisi.rusak > 0 && (
                                            <span className="text-[10px] font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                <Icon name="report" className="text-[11px]" />Rusak: {kondisi.rusak}
                                            </span>
                                        )}
                                    </div>

                                    {/* Ketersediaan Pinjam */}
                                    <div className={`mt-3 flex items-center justify-between px-3 py-2 rounded-xl border text-[11.5px] font-bold ${
                                        tersedia > 0
                                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-red-50/70 dark:bg-red-950/30 border-red-500/25 text-red-700 dark:text-red-300'
                                    }`}>
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold">Ketersediaan</span>
                                        <span>{tersedia > 0 ? `${tersedia} Unit Siap Pinjam` : 'Habis Dipinjam'}</span>
                                    </div>
                                </div>

                                {/* Tombol Admin */}
                                {userRole === 'admin' && (
                                    <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                                        <button
                                            onClick={() => openEditForm(item)}
                                            className="btn-native-action flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-[12px] font-bold gap-1 py-1.5"
                                        >
                                            <Icon name="edit" className="text-[15px]" />
                                            <span>Edit</span>
                                        </button>
                                        <button
                                            onClick={() => { triggerHaptic(); setDeleteConfirmId(item.id); }}
                                            className="btn-native-action w-9 h-9 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20"
                                            title="Hapus"
                                        >
                                            <Icon name="delete" className="text-[15px]" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {data.length === 0 && (
                <div className="bento-island-card p-12 text-center">
                    <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-2xl mb-4 mx-auto border border-slate-200 dark:border-slate-700 text-slate-400">
                        <Icon name="inventory_2" className="text-[40px]" fill="true" />
                    </div>
                    <p className="text-slate-800 dark:text-white font-bold text-[16px] tracking-tight">Belum Ada Inventaris</p>
                    <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mt-1">Tambahkan fasilitas atau peralatan milik RT ke dalam sistem.</p>
                </div>
            )}

            {/* MODAL FORM TAMBAH / EDIT INVENTARIS (Native Bottom Sheet) */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[90vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-md border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                        {/* Mobile Pull Bar */}
                        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-5">
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                {editingId ? 'Edit Inventaris' : 'Tambah Inventaris Baru'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => { triggerHaptic(); setIsFormOpen(false); setErrorMsg(''); }}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center active:scale-95 transition-all"
                            >
                                <Icon name="close" className="text-[17px]" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Nama Barang */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Nama Barang *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => { setFormData({ ...formData, name: e.target.value }); setErrorMsg(''); }}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none rounded-xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="Contoh: Tenda RT, Kursi Lipat, Sound System..."
                                />
                            </div>

                            {/* Kondisi Stepper Inputs */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Jumlah Per Kondisi
                                </label>
                                <div className="space-y-2">
                                    <KondisiInput label="Kondisi Baru" field="baru" colorClass="border-emerald-500/25" icon="verified" />
                                    <KondisiInput label="Kondisi Bekas / Layak" field="bekas" colorClass="border-amber-500/25" icon="refresh" />
                                    <KondisiInput label="Kondisi Rusak" field="rusak" colorClass="border-red-500/25" icon="report" />
                                </div>
                            </div>

                            {/* Foto Barang */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Foto Barang <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                                </label>
                                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl relative overflow-hidden">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
                                    />
                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-slate-700 overflow-hidden">
                                        {isUploading ? (
                                            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : formData.imageUrl ? (
                                            <img src={formData.imageUrl} className="w-12 h-12 object-cover" alt="preview" />
                                        ) : (
                                            <Icon name="cloud_upload" className="text-[20px] text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-bold text-slate-800 dark:text-white truncate">
                                            {isUploading ? 'Mengunggah...' : formData.imageUrl ? 'Foto Tersimpan' : 'Pilih Foto Barang'}
                                        </p>
                                        <p className="text-[10.5px] font-medium text-slate-400">
                                            {formData.imageUrl ? 'Ketuk untuk mengganti foto' : 'Maks. 2MB • JPG, PNG, WEBP'}
                                        </p>
                                    </div>
                                    {formData.imageUrl && (
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); setFormData(p => ({ ...p, imageUrl: '' })); }}
                                            className="w-7 h-7 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-full flex items-center justify-center text-[13px] relative z-20 shrink-0 transition-colors"
                                        >
                                            <Icon name="close" className="text-[14px]" />
                                        </button>
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
                                onClick={() => { triggerHaptic(); setIsFormOpen(false); setErrorMsg(''); }}
                                className="btn-native-secondary flex-1"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isUploading}
                                className="btn-native-primary flex-1 disabled:opacity-50"
                            >
                                Simpan Barang
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
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Hapus Barang?</h3>
                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            Barang ini akan dihapus permanen dari daftar inventaris RT.
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
                                    const idToDelete = deleteConfirmId;
                                    setData(prev => prev.filter(item => item.id !== idToDelete));
                                    setDeleteConfirmId(null);
                                    showToast('Barang berhasil dihapus.');
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

export default Inventaris;
