import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { getLocalDate, parseLocalDate, uploadToGoogleDrive } from '../../utils/helpers.js';

        function Informasi({ data, setData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [formData, setFormData] = useState({ title: '', date: getLocalDate(), imageUrl: '', description: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            
            const handleSave = () => {
                if (!formData.title || !formData.description) return setErrorMsg("Judul dan deskripsi wajib diisi!");
                if (editingId) { setData(data.map(item => item.id === editingId ? { ...item, ...formData } : item)); showToast('Informasi berhasil diperbarui.'); }
                else { setData([{ id: Date.now(), ...formData }, ...data]); showToast('Informasi berhasil dipublikasikan.'); }
                setIsFormOpen(false);
            };

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) { setErrorMsg('File harus berupa gambar!'); return; }
                if (file.size > 10 * 1024 * 1024) { setErrorMsg('Ukuran file maksimal 10MB!'); return; }
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
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Papan Informasi & Kegiatan</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Pengumuman dan dokumentasi lingkungan RT.</p></div>
                        {userRole === 'admin' && <button onClick={() => { setFormData({ title: '', date: getLocalDate(), imageUrl: '', description: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2"><Icon name="add" className="text-[17px]" /><span>Buat Info Baru</span></button>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
                        {data.map(item => (
                            <div key={item.id} className="bento-island-card overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-blue-500/30 transition-all duration-300 flex flex-col group p-0">
                                {item.imageUrl && <div className="w-full h-48 sm:h-56 bg-slate-100 relative shrink-0 border-b border-slate-200 overflow-hidden"><img src={item.imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" onError={(e) => { e.target.style.display = 'none'; }} /></div>}

                                <div className="p-6 sm:p-8 flex flex-col">
                                    <h3 className="text-[17px] sm:text-[18px] font-medium text-google-text leading-snug mb-4 group-hover:text-google-blue transition-colors tracking-tight">{item.title}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mb-5 text-google-blueDark bg-google-blueLight self-start px-4 py-2 rounded-lg text-[11px] font-medium uppercase tracking-widest border border-google-blue/30"><Icon name="calendar_today" className="text-[14px]" /><span>{parseLocalDate(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}</span></div>
                                    <p className="text-[13px] font-medium text-google-textVariant leading-relaxed mb-6 whitespace-pre-line flex-1">{item.description}</p>
                                    
                                    {userRole === 'admin' && (
                                        <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                                            <button onClick={() => { setFormData(item); setEditingId(item.id); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white dark:hover:text-white border border-blue-500/25 rounded-xl py-2 px-3 text-[12px] font-bold transition-all active:scale-95 cursor-pointer"><Icon name="edit" className="text-[15px]" /> Edit</button>
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-600 dark:hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white dark:hover:text-white border border-red-500/25 rounded-xl py-2 px-3 text-[12px] font-bold transition-all active:scale-95 cursor-pointer"><Icon name="delete" className="text-[15px]" /> Hapus</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border border-slate-200"><Icon name="campaign" className="text-[48px] text-slate-400" fill="true" /></div><h3 className="font-medium text-[17px] mb-2 text-google-text">Belum Ada Informasi</h3><p className="text-google-textVariant font-medium text-[13px]">Papan informasi warga masih kosong saat ini.</p></div>}

                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
<div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 shrink-0 tracking-tight">{editingId ? 'Edit Info Kegiatan' : 'Buat Info Baru'}</h3>
                                <div className="space-y-7 overflow-y-auto pr-2 pb-2 hide-scrollbar">
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Judul Utama</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Masukkan judul..." /></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text" /></div>
                                    
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Gambar Banner (Upload ke GDrive)</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="cloud_upload" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah ke Drive..." : (formData.imageUrl ? "Gambar Siap" : "Pilih File Gambar")}</p>
                                                <p className="text-[10px] text-google-textVariant truncate">{formData.imageUrl ? "Klik area ini untuk mengganti gambar" : "Format JPG/PNG, Maksimal 2MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200 group">
                                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({...prev, imageUrl: ''})); }} className="absolute top-0 right-0 bg-google-red/90 text-white w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="delete" className="text-[14px]"/></button>
                                                </div>
                                            )}
                                        </div>
                                        <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="mt-2 w-full bg-transparent border-b border-slate-200 focus:border-google-blue p-2 text-[11px] font-medium outline-none transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Atau paste URL gambar manual secara langsung di sini..." />
                                    </div>

                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Deskripsi Lengkap</label><textarea value={formData.description} onChange={e => {setFormData({...formData, description: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl min-h-[160px] resize-none transition-all duration-300 text-google-text leading-relaxed placeholder:text-slate-400" placeholder="Tuliskan detail informasi di sini..."></textarea></div>
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-4 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200 shrink-0">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); }} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="btn-native-primary flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20 border-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-50"><span>Publikasikan</span></button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Informasi?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Konten ini akan dihapus secara permanen dari layar warga.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                                    <button onClick={() => { setData(data.filter(item => item.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Informasi berhasil dihapus.'); }} className="btn-native-primary flex-1">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default Informasi;
