import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { getLocalDate, parseLocalDate, uploadToGoogleDrive } from '../../utils/helpers.js';

        function Galeri({ data, setData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [formData, setFormData] = useState({ title: '', date: getLocalDate(), imageUrl: '', description: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [selectedPhoto, setSelectedPhoto] = useState(null); // Lightbox viewer state

            const handleSave = () => {
                if (!formData.title || !formData.imageUrl) return setErrorMsg("Judul dan Foto wajib diisi!");
                if (editingId) {
                    setData(data.map(item => item.id === editingId ? { ...item, ...formData } : item));
                    showToast('Dokumentasi berhasil diperbarui.');
                } else {
                    setData([{ id: Date.now(), ...formData }, ...data]);
                    showToast('Foto berhasil ditambahkan ke galeri.');
                }
                setIsFormOpen(false);
                setEditingId(null);
            };

            const handleEdit = (item) => {
                setFormData({
                    title: item.title,
                    date: item.date || getLocalDate(),
                    imageUrl: item.imageUrl,
                    description: item.description || ''
                });
                setEditingId(item.id);
                setErrorMsg('');
                setIsUploading(false);
                setIsFormOpen(true);
            };

            // Upload Galeri: Canvas compress → base64 → Firestore (tanpa GAS)
            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 1200, 0.82);
                    setFormData(prev => ({ ...prev, imageUrl: url }));
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            return (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div>
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                <Icon name="photo_library" className="text-[24px] text-red-600"/>
                                Galeri Lingkungan
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1.5">Album dokumentasi digital dan catatan kegiatan warga.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setFormData({ title: '', date: getLocalDate(), imageUrl: '', description: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-google-blue border border-google-blueDark text-white px-6 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2">
                                <Icon name="add_a_photo" className="text-[17px]" />
                                <span>Unggah Foto</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                        {data.map(item => (
                            <div key={item.id} className="bento-island-card overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-red-500/30 transition-all duration-300 flex flex-col group relative p-0">
                                <div onClick={() => setSelectedPhoto(item)} className="w-full aspect-[4/3] bg-slate-100 relative shrink-0 border-b border-slate-200 overflow-hidden flex items-center justify-center cursor-zoom-in">
                                    <img src={item.imageUrl} loading="lazy" className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" alt={item.title} onError={(e) => { e.target.style.display = 'none'; }} />
                                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        <div className="bg-white/90  p-3 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                            <Icon name="zoom_in" className="text-slate-800 text-[17px]"/>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 sm:p-8 md:p-8 flex flex-col justify-between flex-1">
                                    <div>
                                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1.5">
                                            <span className="text-[9px] font-medium text-red-600 bg-red-50 border border-red-500/15 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                                {parseLocalDate(item.date).toLocaleDateString('id-ID', {month: 'long', year:'numeric'})}
                                            </span>
                                            <span className="text-[10px] font-medium text-google-textVariant flex flex-wrap items-center gap-0.5">
                                                <Icon name="event" className="text-[12px]" />
                                                {parseLocalDate(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                            </span>
                                        </div>
                                        <h3 onClick={() => setSelectedPhoto(item)} className="text-[14px] font-medium text-google-text leading-snug tracking-tight mb-2 group-hover:text-red-600 transition-colors cursor-pointer line-clamp-1">{item.title}</h3>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
                                            <p className="text-[12.5px] font-medium text-google-textVariant leading-relaxed line-clamp-3">
                                                {item.description || 'Tidak ada deskripsi.'}
                                            </p>
                                        </div>
                                    </div>
                                    {userRole === 'admin' && (
                                        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-3">
                                            <button onClick={() => handleEdit(item)} className="bg-white text-google-blue w-9 h-9 rounded-full font-medium flex items-center justify-center hover:bg-google-blueLight border border-slate-200 hover:border-google-blue/30 transition-all duration-300">
                                                <Icon name="edit" className="text-[14px]" />
                                            </button>
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="bg-white text-google-red w-9 h-9 rounded-full font-medium flex items-center justify-center hover:bg-google-redLight border border-slate-200 hover:border-google-red/30 transition-all duration-300">
                                                <Icon name="delete" className="text-[14px]" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.length === 0 && (
                        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                            <div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border border-slate-200">
                                <Icon name="photo_library" className="text-[48px] text-slate-400" fill="true" />
                            </div>
                            <h3 className="font-medium text-[17px] mb-2 text-google-text">Belum Ada Foto</h3>
                            <p className="text-google-textVariant font-medium text-[13px]">Album dokumentasi warga masih kosong.</p>
                        </div>
                    )}

                    {/* Lightbox / Detail Viewer Modal */}
                    {selectedPhoto && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 overflow-hidden modal-card animate-modal-in" style={{ animation: 'slideUp 0.3s ease-out' }}>
                                <div className="p-6 sm:p-8 md:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Icon name="image" className="text-red-600" />
                                        <span className="text-[12px] font-medium text-google-text">Detail Dokumentasi</span>
                                    </div>
                                    <button onClick={() => setSelectedPhoto(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-all active:scale-95">
                                        <Icon name="close" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 hide-scrollbar">
                                    <div className="w-full bg-slate-900 aspect-video flex items-center justify-center relative">
                                        <img src={selectedPhoto.imageUrl} alt={selectedPhoto.title} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="p-6 sm:p-8 space-y-6">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-500/15 px-3 py-1.5 rounded-lg flex flex-wrap items-center gap-1">
                                                <Icon name="event" className="text-[13px]" />
                                                {parseLocalDate(selectedPhoto.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-medium text-google-text leading-tight tracking-tight">{selectedPhoto.title}</h3>
                                        <div className="bg-slate-50 border border-slate-200/60 p-6 sm:p-8 md:p-8 rounded-2xl text-google-textVariant text-[13px] leading-relaxed font-medium whitespace-pre-line">
                                            {selectedPhoto.description || 'Tidak ada deskripsi rinci untuk kegiatan ini.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upload / Edit Form Modal */}
                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">
                                    {editingId ? 'Edit Dokumentasi' : 'Unggah Dokumentasi'}
                                </h3>
                                <div className="space-y-7">
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Judul / Kegiatan</label>
                                        <input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Contoh: Kerja Bakti 17an" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal</label>
                                        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Deskripsi Rinci</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl resize-none min-h-[100px] leading-relaxed transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Tuliskan keterangan lengkap kegiatan di sini..."></textarea>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">File Foto</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="cloud_upload" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.imageUrl ? "Foto Siap" : "Pilih File")}</p>
                                                <p className="text-[10px] text-google-textVariant truncate">{formData.imageUrl ? "Klik untuk mengganti foto" : "Maksimal 2MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200">
                                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-4 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); setEditingId(null); }} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="btn-native-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2">
                                        {editingId ? 'Simpan' : 'Unggah'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Foto?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Foto ini akan dihapus dari galeri warga.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                                    <button onClick={() => { setData(data.filter(item => item.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Foto berhasil dihapus.'); }} className="btn-native-primary flex-1">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default Galeri;
