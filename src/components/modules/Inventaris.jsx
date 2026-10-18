import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { uploadToGoogleDrive } from '../../utils/helpers.js';

        function Inventaris({ data, setData, userRole, pinjamData }) {
            // formData kini punya kondisi per tipe: qty_baru, qty_bekas, qty_rusak
            const [formData, setFormData] = useState({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' });
            const [editingId, setEditingId] = useState(null);
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);

            // Helper: hitung total stok dari kondisi
            const getTotalStok = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0) + (item.kondisi?.rusak || 0);
            // Helper: hitung stok yang bisa dipinjam (baru + bekas saja)
            const getStokPinjam = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0);

            const handleSave = () => {
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
                    // Gunakan functional updater agar selalu pakai state terbaru
                    setData(prev => prev.map(item => item.id === savedId ? { ...item, ...itemData } : item));
                    showToast('Data inventaris berhasil diperbarui.');
                } else {
                    const newId = Date.now();
                    // Gunakan functional updater agar selalu pakai state terbaru
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
                    setFormData(prev => ({...prev, imageUrl: url}));
                } catch (error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const openEditForm = (item) => {
                setFormData({
                    name: item.name,
                    kondisi: item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 }, // backward compat data lama
                    imageUrl: item.imageUrl || '',
                });
                setEditingId(item.id);
                setIsFormOpen(true);
                setErrorMsg('');
                setIsUploading(false);
            };

            const KondisiInput = ({ label, field, color, icon }) => (
                <div className={`flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 border ${color} rounded-2xl px-4 py-3`}>
                    <div className="flex items-center gap-2.5">
                        <Icon name={icon} className="text-[18px] text-slate-500 dark:text-slate-400" />
                        <span className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setFormData(p => ({...p, kondisi: {...p.kondisi, [field]: Math.max(0, (p.kondisi[field]||0)-1)}}))}
                            className="w-9 h-9 sm:w-10 sm:h-10 bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 rounded-xl flex items-center justify-center font-black text-[18px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-xs">−</button>
                        <span className="w-8 text-center font-black text-[15px] text-slate-800 dark:text-white">{formData.kondisi[field] || 0}</span>
                        <button type="button" onClick={() => setFormData(p => ({...p, kondisi: {...p.kondisi, [field]: (p.kondisi[field]||0)+1}}))}
                            className="w-9 h-9 sm:w-10 sm:h-10 bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600 rounded-xl flex items-center justify-center font-black text-[18px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 active:scale-95 transition-all shadow-xs">+</button>
                    </div>
                </div>
            );

            return (
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Logistik & Fasilitas RT</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Aset &amp; Inventaris</h2>
                            <p className="text-[12.5px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">Daftar barang fasilitas RT beserta kondisi dan ketersediaan stok pinjam warga.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setFormData({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="btn-native-primary shrink-0 flex items-center justify-center gap-2">
                                <Icon name="add" className="text-[18px]" />
                                <span>Tambah Barang</span>
                            </button>
                        )}
                    </div>

                    {/* Grid kartu barang */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                        {data.map(item => {
                            const kondisi = item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 };
                            const totalStok   = getTotalStok({kondisi});
                            const stokPinjam  = getStokPinjam({kondisi});
                            const sedangDipinjam = pinjamData ? pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').length : 0;
                            const tersedia    = Math.max(0, stokPinjam - sedangDipinjam);
                            return (
                                <div key={item.id} className="bento-island-card overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-red-500/30 transition-all duration-300 flex flex-col group relative p-0">
                                    {/* Foto */}
                                    <div className="w-full relative shrink-0 border-b border-slate-200 overflow-hidden" style={{height:'200px'}}>
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} loading="lazy" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" alt={item.name} onError={(e) => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }} />
                                            : <div className="w-full h-full bg-slate-50 flex items-center justify-center"><Icon name="inventory_2" className="text-[64px] text-slate-300" /></div>
                                        }
                                        {/* Badge status pinjam */}
                                        {sedangDipinjam > 0 && (
                                            <div className="absolute top-3 left-3 bg-google-red text-white px-2.5 py-1 rounded-lg font-medium text-[9px] shadow-sm flex flex-wrap items-center gap-1 uppercase tracking-wider"><Icon name="handshake" className="text-[11px]" />{sedangDipinjam} Dipinjam</div>
                                        )}
                                        {/* Badge total stok */}
                                        <div className="absolute top-3 right-3 bg-white/95  text-google-text px-3 py-1.5 rounded-lg font-medium text-[11px] shadow-sm border border-slate-200 flex flex-wrap items-center gap-1.5">
                                            <Icon name="tag" className="text-[13px] text-google-yellowDark" />{totalStok} unit
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-6 sm:p-8 md:p-8 flex flex-col gap-3">
                                        <h3 className="text-[15px] font-medium text-google-text leading-snug tracking-tight group-hover:text-google-yellowDark transition-colors">{item.name}</h3>

                                        {/* Kondisi chips */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {kondisi.baru > 0 && <span className="text-[10px] font-medium bg-google-greenLight text-google-greenDark border border-google-green/30 px-2.5 py-1 rounded-lg flex flex-wrap items-center gap-1"><Icon name="verified" className="text-[11px]" />Baru: {kondisi.baru}</span>}
                                            {kondisi.bekas > 0 && <span className="text-[10px] font-medium bg-google-yellowLight text-google-yellowDark border border-google-yellow/30 px-2.5 py-1 rounded-lg flex flex-wrap items-center gap-1"><Icon name="refresh" className="text-[11px]" />Bekas: {kondisi.bekas}</span>}
                                            {kondisi.rusak > 0 && <span className="text-[10px] font-medium bg-google-redLight text-google-redDark border border-google-red/30 px-2.5 py-1 rounded-lg flex flex-wrap items-center gap-1"><Icon name="report" className="text-[11px]" />Rusak: {kondisi.rusak}</span>}
                                        </div>

                                        {/* Stok pinjam */}
                                        <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${tersedia > 0 ? 'bg-google-greenLight/60 border-google-green/30' : 'bg-google-redLight/60 border-google-red/30'}`}>
                                            <span className="text-[11px] font-medium text-google-textVariant">Dapat Dipinjam</span>
                                            <span className={`text-[12px] font-medium ${tersedia > 0 ? 'text-google-greenDark' : 'text-google-red'}`}>{tersedia > 0 ? `${tersedia} tersedia` : 'Tidak tersedia'}</span>
                                        </div>
                                        {/* Detail daftar peminjam aktif */}
                                        {pinjamData && pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').length > 0 && (
                                            <div className="bg-google-redLight/40 border border-google-red/30 rounded-xl px-3.5 py-2.5 space-y-1.5">
                                                <p className="text-[10px] font-medium text-google-redDark uppercase tracking-wider flex flex-wrap items-center gap-1"><Icon name="handshake" className="text-[12px]" />Sedang Dipinjam:</p>
                                                {pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').map((p, i) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <span className="text-[11px] font-medium text-google-text truncate flex flex-wrap items-center gap-1.5"><Icon name="person" className="text-[12px] text-google-textVariant" />{p.namaWarga}</span>
                                                        <span className="text-[10px] font-medium text-google-red shrink-0 ml-2 bg-white px-2 py-0.5 rounded-lg border border-google-red/30">{p.qty || 1} unit</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tombol admin */}
                                        {userRole === 'admin' && (
                                            <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
                                                <button onClick={() => openEditForm(item)} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white dark:hover:text-white border border-blue-500/25 rounded-xl py-2 px-3 text-[12px] font-bold transition-all active:scale-95 cursor-pointer"><Icon name="edit" className="text-[15px]" /> Edit</button>
                                                <button onClick={() => setDeleteConfirmId(item.id)} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white border border-red-500/25 rounded-xl py-2 px-3 text-[12px] font-bold transition-all active:scale-95 cursor-pointer"><Icon name="delete" className="text-[15px]" /> Hapus</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {data.length === 0 && (
                            <div className="col-span-full bg-white border border-slate-200 p-12 text-center rounded-3xl shadow-sm">
                                <Icon name="inventory_2" className="text-[56px] text-slate-300 mb-4 mx-auto" />
                                <h3 className="text-[17px] font-medium text-google-text mb-2">Belum Ada Inventaris</h3>
                                <p className="text-[13px] font-medium text-google-textVariant">Tambahkan barang inventaris RT yang pertama.</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Form Tambah/Edit */}
                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 my-4 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit Inventaris' : 'Tambah Inventaris'}</h3>
                                <div className="space-y-7">

                                    {/* Nama barang */}
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Nama Barang *</label>
                                        <input type="text" value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setErrorMsg(''); }} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Contoh: Speaker Aktif, Tenda Hajatan..." />
                                    </div>

                                    {/* Kondisi barang */}
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Jumlah per Kondisi</label>
                                        <div className="space-y-2.5">
                                            <KondisiInput label="Kondisi Baru" field="baru" color="border-google-green/40 focus-within:border-google-green" icon="verified" />
                                            <KondisiInput label="Kondisi Bekas" field="bekas" color="border-google-yellow/40 focus-within:border-google-yellow" icon="refresh" />
                                            <KondisiInput label="Kondisi Rusak" field="rusak" color="border-google-red/40 focus-within:border-google-red" icon="report" />
                                        </div>
                                        {/* Ringkasan */}
                                        {((formData.kondisi.baru||0)+(formData.kondisi.bekas||0)+(formData.kondisi.rusak||0)) > 0 && (
                                            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap gap-x-4 gap-y-1">
                                                <span className="text-[11px] font-medium text-google-text">Total: {(formData.kondisi.baru||0)+(formData.kondisi.bekas||0)+(formData.kondisi.rusak||0)} unit</span>
                                                <span className="text-[11px] font-medium text-google-greenDark">Bisa dipinjam: {(formData.kondisi.baru||0)+(formData.kondisi.bekas||0)} unit</span>
                                                {(formData.kondisi.rusak||0) > 0 && <span className="text-[11px] font-medium text-google-red">Tidak dipinjamkan: {formData.kondisi.rusak} unit (rusak)</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Foto (opsional) */}
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Foto Aset <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : formData.imageUrl ? <img src={formData.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="preview" /> : <Icon name="cloud_upload" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text">{isUploading ? 'Mengunggah...' : formData.imageUrl ? 'Foto Tersimpan ✓' : 'Pilih Gambar'}</p>
                                                <p className="text-[11px] text-google-textVariant">{formData.imageUrl ? 'Klik untuk ganti foto' : 'Maks. 2MB • JPG, PNG, WEBP'}</p>
                                            </div>
                                            {formData.imageUrl && <button type="button" onClick={e => { e.stopPropagation(); setFormData(p=>({...p,imageUrl:''})); }} className="relative z-20 text-google-red bg-white border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center text-[14px] hover:bg-google-redLight active:scale-95 shrink-0">+</button>}
                                        </div>
                                    </div>

                                    {errorMsg && <div className="bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-xl text-[12px] font-medium flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px]" />{errorMsg}</div>}
                                </div>

                                <div className="flex flex-wrap gap-3 mt-6">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); }} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="btn-native-primary flex-1 disabled:opacity-50">Simpan Barang</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal konfirmasi hapus */}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Barang?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Barang ini akan dihapus permanen dari daftar inventaris RT.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                                    <button onClick={() => { const idToDelete = deleteConfirmId; setData(prev => prev.filter(item => item.id !== idToDelete)); setDeleteConfirmId(null); showToast('Barang berhasil dihapus.'); }} className="btn-native-primary flex-1">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default Inventaris;
