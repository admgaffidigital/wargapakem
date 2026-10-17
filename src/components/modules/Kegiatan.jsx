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
                        <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
                                <div><h2 className="text-xl font-medium text-google-text tracking-tight">Pengaturan Agenda</h2><p className="text-[12px] font-medium text-google-textVariant mt-1">Agenda tampil sebagai teks berjalan (marquee) di Halaman Utama.</p></div>
                                {!isEditing && <button onClick={() => setIsEditing(true)} className="shrink-0 bg-white border border-slate-200 text-google-text px-6 py-2.5 rounded-full font-medium flex items-center justify-center gap-2 text-[12px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm w-full sm:w-auto"><Icon name="edit" className="text-[14px]" /><span>Ubah Agenda</span></button>}
                            </div>

                            {isEditing && (
                                <div className="mt-6 pt-6 border-t border-slate-200 space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Hari &amp; Tanggal</label><input type="text" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: Sabtu, 10 Agustus 2026"/></div>
                                        <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Jam Pelaksanaan</label><input type="text" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: 19.30 WIB - Selesai"/></div>
                                    </div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Lokasi Pertemuan</label><input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: Rumah Bpk. Budi (RT 01)"/></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Agenda Utama Kegiatan</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[13px] font-medium outline-none rounded-2xl resize-none min-h-[100px] leading-relaxed transition-all text-google-text placeholder:text-slate-400" placeholder="Tulis rincian acara di sini..."></textarea></div>
                                    <div className="flex flex-wrap gap-3 pt-6 mt-6 border-t border-slate-200">
                                        <button onClick={() => setIsEditing(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3 rounded-full font-medium text-[12px] hover:bg-slate-50 border border-slate-200 active:scale-95 transition-all shadow-sm flex items-center justify-center">Batal</button>
                                        <button onClick={() => { setNextMeeting(formData); setIsEditing(false); showToast('Jadwal kegiatan berhasil diperbarui.'); }} className="flex bg-google-blue border border-google-blueDark text-white px-6 py-3 rounded-full font-medium text-[12px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all items-center justify-center gap-2"><Icon name="save" className="text-[14px]"/> Simpan Agenda</button>
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
