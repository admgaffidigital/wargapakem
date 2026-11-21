import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { triggerHaptic } from '../../utils/helpers.js';

function Kegiatan({ nextMeeting = {}, setNextMeeting, userRole }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(nextMeeting);

    useEffect(() => {
        if (!isEditing) setFormData(nextMeeting);
    }, [nextMeeting, isEditing]);

    const handleCopyInvite = () => {
        triggerHaptic(10);
        const text = `*UNDANGAN PERTEMUAN WARGA RT PAKEM*\n\n` +
            `📅 *Hari/Tanggal:* ${nextMeeting.date || '-'}\n` +
            `⏰ *Waktu:* ${nextMeeting.time || '-'}\n` +
            `📍 *Tempat:* ${nextMeeting.location || '-'}\n` +
            `📝 *Agenda Utama:*\n${nextMeeting.notes || '-'}\n\n` +
            `_Dimohon kehadiran seluruh bapak/ibu warga RT Pakem tepat waktu demi kelancaran dan kerukunan lingkungan. Terima kasih._`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Teks undangan berhasil disalin! Siap dibagikan ke WhatsApp.');
            }).catch(() => {
                showToast('Gagal menyalin teks otomatis.', 'error');
            });
        }
    };

    const handleShareWA = () => {
        triggerHaptic(10);
        const text = `*UNDANGAN PERTEMUAN WARGA RT PAKEM*\n\n` +
            `📅 *Hari/Tanggal:* ${nextMeeting.date || '-'}\n` +
            `⏰ *Waktu:* ${nextMeeting.time || '-'}\n` +
            `📍 *Tempat:* ${nextMeeting.location || '-'}\n` +
            `📝 *Agenda Utama:*\n${nextMeeting.notes || '-'}\n\n` +
            `_Dimohon kehadiran seluruh warga tepat waktu. Terima kasih._`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="space-y-6 tab-fade-in max-w-4xl mx-auto pb-8">
            {/* Header Modul */}
            <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-5 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/25 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="event" className="text-[26px]" fill="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            <span className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                                Jadwal &amp; Agenda Lingkungan
                            </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            Agenda Pertemuan &amp; Rapat RT
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Jadwal resmi pertemuan arisan, kerja bakti, dan kegiatan rutin warga.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={handleCopyInvite}
                        className="btn-native-secondary flex-1 sm:flex-none flex items-center justify-center gap-2"
                        title="Salin Teks Undangan"
                    >
                        <Icon name="content_copy" className="text-[16px]" />
                        <span>Salin Undangan</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleShareWA}
                        className="btn-native-primary flex-1 sm:flex-none flex items-center justify-center gap-2 !bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
                        title="Bagikan ke WhatsApp Warga"
                    >
                        <Icon name="share" className="text-[16px]" />
                        <span>Bagikan WA</span>
                    </button>
                </div>
            </div>

            {/* Kartu Utama: Agenda Pertemuan Terdekat */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
                <div className="p-5 sm:p-7 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-gradient-to-r from-red-500/5 via-transparent to-amber-500/5">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-500/20 inline-block mb-1.5">
                            Pertemuan Rutin Bulan Ini
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {nextMeeting.date || 'Belum Dijadwalkan'}
                        </h3>
                    </div>

                    {userRole === 'admin' && !isEditing && (
                        <button
                            type="button"
                            onClick={() => { triggerHaptic(8); setIsEditing(true); }}
                            className="btn-native-action px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[12px] flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                        >
                            <Icon name="edit" className="text-[15px]" />
                            <span>Ubah Jadwal</span>
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <div className="p-5 sm:p-7 space-y-4 bg-slate-50/50 dark:bg-slate-850/40 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                                    Hari &amp; Tanggal
                                </label>
                                <input
                                    type="text"
                                    value={formData.date || ''}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 px-4 py-2.5 text-[13px] font-medium outline-none rounded-xl text-slate-900 dark:text-white"
                                    placeholder="Contoh: Minggu Pertama, 10 Desember 2026"
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                                    Jam Pelaksanaan
                                </label>
                                <input
                                    type="text"
                                    value={formData.time || ''}
                                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 px-4 py-2.5 text-[13px] font-medium outline-none rounded-xl text-slate-900 dark:text-white"
                                    placeholder="Contoh: 19:30 WIB - Selesai"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                                Lokasi Pertemuan / Rumah Tuan Rumah
                            </label>
                            <input
                                type="text"
                                value={formData.location || ''}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 px-4 py-2.5 text-[13px] font-medium outline-none rounded-xl text-slate-900 dark:text-white"
                                placeholder="Contoh: Rumah Bpk. Slamet (RT 05 / RW 03)"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 uppercase tracking-wider">
                                Rincian Agenda &amp; Catatan Penting
                            </label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-red-500 px-4 py-2.5 text-[13px] font-medium outline-none rounded-xl text-slate-900 dark:text-white resize-none min-h-[90px] leading-relaxed"
                                placeholder="Tulis agenda rapat atau pengumuman untuk warga..."
                            ></textarea>
                        </div>

                        <div className="flex gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[12.5px] cursor-pointer transition-all"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic(12);
                                    setNextMeeting(formData);
                                    setIsEditing(false);
                                    showToast('Jadwal kegiatan berhasil disimpan.');
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[12.5px] shadow-md shadow-red-500/25 cursor-pointer transition-all flex items-center justify-center gap-2"
                            >
                                <Icon name="save" className="text-[16px]" />
                                <span>Simpan Perubahan</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-5 sm:p-7 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        {/* Waktu Pelaksanaan */}
                        <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Icon name="schedule" className="text-[20px]" />
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Waktu Mulai</span>
                                <span className="text-[14px] font-bold text-slate-900 dark:text-white block mt-0.5">
                                    {nextMeeting.time || '19:30 WIB'}
                                </span>
                            </div>
                        </div>

                        {/* Lokasi Pertemuan */}
                        <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 md:col-span-2">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <Icon name="home_pin" className="text-[20px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lokasi Pertemuan</span>
                                <span className="text-[14px] font-bold text-slate-900 dark:text-white block mt-0.5 truncate">
                                    {nextMeeting.location || 'Rumah Pengurus RT'}
                                </span>
                            </div>
                        </div>

                        {/* Rincian Agenda Bahasan */}
                        <div className="md:col-span-3 p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Icon name="list_alt" className="text-[14px] text-red-500" /> Topik Bahasan &amp; Rincian Acara
                            </span>
                            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                {nextMeeting.notes || 'Pembukaan arisan rutin bulanan, pengocokan pemenang baru, penyetoran kas jimpitan, dan musyawarah lingkungan.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Pedoman & Jadwal Rutin Lingkungan */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-4">
                <div className="flex items-center gap-2">
                    <Icon name="event_repeat" className="text-[20px] text-red-500" />
                    <h3 className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Agenda Rutin Lingkungan RT Pakem
                    </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {[
                        {
                            title: 'Pertemuan & Arisan Bulanan',
                            time: 'Setiap Minggu Pertama • 19:30 WIB',
                            desc: 'Kocokan arisan, evaluasi buku kas umum, dan rembuk warga.',
                            icon: 'groups',
                            color: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40'
                        },
                        {
                            title: 'Kerja Bakti Lingkungan',
                            time: 'Setiap Hari Minggu Pagi • 06:30 WIB',
                            desc: 'Pembersihan saluran drainase, fasilitas umum & potong rumput.',
                            icon: 'cleaning_services',
                            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                        },
                        {
                            title: 'Ronda Malam (Siskamling)',
                            time: 'Setiap Malam • 22:00 - 04:00 WIB',
                            desc: 'Jadwal ronda bergilir antar warga untuk menjaga keamanan wilayah.',
                            icon: 'security',
                            color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                        }
                    ].map((item, idx) => (
                        <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 space-y-2 flex flex-col justify-between">
                            <div className="space-y-2">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                                    <Icon name={item.icon} className="text-[18px]" fill="true" />
                                </div>
                                <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">{item.title}</h4>
                                <span className="text-[10.5px] font-bold text-red-600 dark:text-red-400 block">{item.time}</span>
                                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Kegiatan;
