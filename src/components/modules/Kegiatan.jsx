import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import WaktuSholatWidget from '../common/WaktuSholatWidget.jsx';

function Kegiatan({ nextMeeting, setNextMeeting, userRole }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(nextMeeting);
    useEffect(() => { if (!isEditing) setFormData(nextMeeting); }, [nextMeeting, isEditing]);
    
    return (
        <div className="space-y-8 tab-fade-in">
            {userRole === 'admin' && (
                <div className="bento-header-card no-print">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Jadwal & Agenda Lingkungan</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Pengaturan Agenda Rapat RT</h2>
                            <p className="text-[12.5px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">Agenda tampil sebagai teks berjalan (marquee) di Halaman Utama warga.</p>
                        </div>
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="btn-native-action shrink-0 flex items-center justify-center gap-2 w-full sm:w-auto">
                                <Icon name="edit" className="text-[16px]" />
                                <span>Ubah Agenda</span>
                            </button>
                        )}
                    </div>

                    {isEditing && (
                        <div className="mt-6 pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-widest">Hari &amp; Tanggal</label>
                                    <input type="text" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-800 px-4 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400" placeholder="Misal: Sabtu, 10 Agustus 2026"/>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-widest">Jam Pelaksanaan</label>
                                    <input type="text" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-800 px-4 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400" placeholder="Misal: 19.30 WIB - Selesai"/>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-widest">Lokasi Pertemuan</label>
                                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-800 px-4 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400" placeholder="Misal: Rumah Bpk. Budi (RT 01)"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-widest">Agenda Utama Kegiatan</label>
                                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-800 px-4 py-3 text-[13px] font-medium outline-none rounded-2xl resize-none min-h-[100px] leading-relaxed transition-all text-slate-800 dark:text-white placeholder:text-slate-400" placeholder="Tulis rincian acara di sini..."></textarea>
                            </div>
                            <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-200/80 dark:border-slate-800">
                                <button onClick={() => setIsEditing(false)} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                                <button onClick={() => { setNextMeeting(formData); setIsEditing(false); showToast('Jadwal kegiatan berhasil diperbarui.'); }} className="btn-native-primary flex-1 flex items-center justify-center gap-2">
                                    <Icon name="save" className="text-[16px]"/>
                                    <span>Simpan Agenda</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <WaktuSholatWidget />
        </div>
    );
}

export default Kegiatan;
