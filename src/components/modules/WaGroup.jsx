import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';

        // ============================================================
        // KOMPONEN GRUP WHATSAPP (WARGA & ADMIN PERSATUAN)
        // ============================================================
        function WaGroup({ requests = [], setRequests, userRole, inviteLink }) {
            const safeRequests = Array.isArray(requests) ? requests : [];

            const [name, setName] = useState('');
            const [whatsapp, setWhatsapp] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            const [activeSubTab, setActiveSubTab] = useState('active'); // 'active' | 'history'

            // Baca ID dari localStorage untuk mengenali request Warga di browser ini
            const [myRequestId, setMyRequestId] = useState(() => localStorage.getItem('wa_group_request_id') || '');

            const myRequest = safeRequests.find(r => r.id === myRequestId);

            const handleRequestSubmit = (e) => {
                e.preventDefault();
                if (!name.trim() || !whatsapp.trim()) {
                    setErrorMsg('Nama Lengkap dan Nomor WhatsApp wajib diisi!');
                    return;
                }
                const cleanPhone = whatsapp.replace(/[^0-9]/g, '');
                if (cleanPhone.length < 9) {
                    setErrorMsg('Nomor WhatsApp tidak valid (terlalu pendek)!');
                    return;
                }

                const newId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                const newRequest = {
                    id: newId,
                    name: name.trim(),
                    whatsapp: cleanPhone,
                    status: 'pending',
                    timestamp: new Date().toISOString()
                };

                const updatedRequests = [newRequest, ...safeRequests];
                setRequests(updatedRequests);
                localStorage.setItem('wa_group_request_id', newId);
                setMyRequestId(newId);
                setName('');
                setWhatsapp('');
                setErrorMsg('');
                showToast('Permintaan gabung berhasil diajukan! Admin akan meninjau dalam 1x24 jam.');
            };

            const handleCancelRequest = () => {
                const updatedRequests = safeRequests.filter(r => r.id !== myRequestId);
                setRequests(updatedRequests);
                localStorage.removeItem('wa_group_request_id');
                setMyRequestId('');
                showToast('Pengajuan gabung grup dibatalkan.');
            };

            const handleResetRequest = () => {
                localStorage.removeItem('wa_group_request_id');
                setMyRequestId('');
            };

            const handleApprove = (id) => {
                const updatedRequests = safeRequests.map(r => r.id === id ? { ...r, status: 'approved' } : r);
                setRequests(updatedRequests);
                showToast('Permintaan gabung grup WhatsApp disetujui.');
            };

            const handleReject = (id) => {
                const updatedRequests = safeRequests.map(r => r.id === id ? { ...r, status: 'rejected' } : r);
                setRequests(updatedRequests);
                showToast('Permintaan gabung grup WhatsApp ditolak.');
            };

            const handleResetStatus = (id) => {
                const updatedRequests = safeRequests.map(r => r.id === id ? { ...r, status: 'pending' } : r);
                setRequests(updatedRequests);
                showToast('Status permintaan diubah kembali menjadi Menunggu.');
            };

            const handleDeleteRequest = (id) => {
                const updatedRequests = safeRequests.filter(r => r.id !== id);
                setRequests(updatedRequests);
                showToast('Data pengajuan telah dihapus.');
            };

            const formatDate = (isoString) => {
                if (!isoString) return '-';
                const date = new Date(isoString);
                return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            };

            // Render Warga View
            if (userRole !== 'admin') {
                if (!myRequestId || !myRequest) {
                    return (
                        <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-md space-y-8">
                                <div className="text-center space-y-5">
                                    <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/20 text-google-green flex items-center justify-center mx-auto border border-green-100 dark:border-green-900/40">
                                        <Icon name="forum" className="text-[32px]" fill="true" />
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Gabung Grup WhatsApp Warga</h2>
                                    <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Grup resmi WhatsApp digunakan untuk membagikan pengumuman penting, info kegiatan lingkungan, dan koordinasi antar warga secara cepat.
                                    </p>
                                </div>

                                <form onSubmit={handleRequestSubmit} className="space-y-6 pt-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700/60 focus-within:border-google-blue focus-within:ring-1 focus-within:ring-google-blue transition-all">
                                        <label className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Nama Lengkap Sesuai KTP</label>
                                        <input 
                                            type="text" 
                                            value={name} 
                                            onChange={e => setName(e.target.value)} 
                                            placeholder="Masukkan nama lengkap Anda" 
                                            className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                        />
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700/60 focus-within:border-google-blue focus-within:ring-1 focus-within:ring-google-blue transition-all">
                                        <label className="text-[10px] font-medium text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Nomor WhatsApp Aktif</label>
                                        <input 
                                            type="text" 
                                            value={whatsapp} 
                                            onChange={e => setWhatsapp(e.target.value)} 
                                            placeholder="Contoh: 081234567890" 
                                            className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                        />
                                    </div>

                                    {errorMsg && (
                                        <p className="text-[11px] text-google-red font-medium flex items-center gap-1"><Icon name="error" className="text-[14px]" /> {errorMsg}</p>
                                    )}

                                    <button 
                                        type="submit" 
                                        className="w-full bg-google-green hover:bg-green-600 text-white py-4 rounded-full font-medium text-[13px] flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all mt-4"
                                    >
                                        <Icon name="send" />
                                        <span>Ajukan Gabung Grup</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="max-w-xl mx-auto px-4 py-8 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-md space-y-8 text-center">
                            {myRequest.status === 'pending' && (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center mx-auto border border-amber-100 dark:border-amber-900/40 animate-pulse">
                                        <Icon name="schedule" className="text-[32px]" fill="true" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Pengajuan Sedang Ditinjau </h2>
                                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                                            Halo <strong className="font-medium text-slate-800 dark:text-slate-100">{myRequest.name}</strong> ({myRequest.whatsapp}), pengajuan gabung grup WhatsApp Anda sedang diperiksa oleh Admin RT.
                                        </p>
                                        <p className="text-[11px] text-amber-600 dark:text-amber-500 font-medium bg-amber-50 dark:bg-amber-950/30 py-2.5 px-4 rounded-xl border border-amber-100 dark:border-amber-900/20 inline-block mt-2">
                                            Estimasi verifikasi dalam 1 x 24 jam.
                                        </p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                                        <button 
                                            onClick={handleCancelRequest} 
                                            className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3.5 rounded-full font-medium text-[12.5px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
                                        >
                                            Batalkan Pengajuan
                                        </button>
                                    </div>
                                </>
                            )}

                            {myRequest.status === 'approved' && (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/20 text-google-green flex items-center justify-center mx-auto border border-green-100 dark:border-green-900/40">
                                        <Icon name="verified" className="text-[32px]" fill="true" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Pengajuan Disetujui! 🛒</h2>
                                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                                            Selamat <strong className="font-medium text-slate-800 dark:text-slate-100">{myRequest.name}</strong>, Admin telah menyetujui akses masuk grup WhatsApp Warga RT.
                                        </p>
                                    </div>
                                    
                                    {inviteLink ? (
                                        <a 
                                            href={inviteLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="w-full bg-google-green hover:bg-green-600 text-white py-4 rounded-2xl font-medium text-[13px] flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all mt-4"
                                        >
                                            <Icon name="forum" />
                                            <span>Gabung Grup WhatsApp Sekarang</span>
                                        </a>
                                    ) : (
                                        <div className="bg-red-50 dark:bg-red-950/30 text-google-red p-4 rounded-xl border border-red-200 text-[11.5px] font-medium">
                                            Link grup belum diatur oleh Admin. Silakan hubungi pengurus RT Anda.
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <button 
                                            onClick={handleResetRequest} 
                                            className="text-slate-500 hover:text-slate-700 text-[11px] font-medium hover:underline"
                                        >
                                            Gabung dengan Nomor Lain / Daftar Ulang
                                        </button>
                                    </div>
                                </>
                            )}

                            {myRequest.status === 'rejected' && (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/20 text-google-red flex items-center justify-center mx-auto border border-red-100 dark:border-red-900/40">
                                        <Icon name="cancel" className="text-[32px]" fill="true" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-800 dark:text-slate-100">Pengajuan Ditolak 🚚</h2>
                                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                                            Maaf <strong className="font-medium text-slate-800 dark:text-slate-100">{myRequest.name}</strong>, pengajuan Anda untuk bergabung ke grup WhatsApp ditolak oleh Admin. 
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-1">Pastikan data nama dan nomor Anda valid sesuai keanggotaan warga.</p>
                                    </div>
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                                        <button 
                                            onClick={handleResetRequest} 
                                            className="flex-1 bg-google-blue hover:bg-blue-600 text-white py-3.5 rounded-full font-medium text-[12.5px] active:scale-95 transition-all shadow-sm"
                                        >
                                            Ajukan Ulang / Koreksi Data
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            }

            // Render Admin View
            const pendingRequests = safeRequests.filter(r => r.status === 'pending');
            const processedRequests = safeRequests.filter(r => r.status !== 'pending');

            return (
                <div className="animate-fade-in pb-24 w-full space-y-8">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-medium text-slate-800 dark:text-slate-100 tracking-tight">Verifikasi Grup WhatsApp</h2>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                                Kelola pengajuan gabung grup WhatsApp warga RT. Total {safeRequests.length} pengajuan.
                            </p>
                        </div>
                        {inviteLink ? (
                            <div className="bg-green-50 dark:bg-green-950/20 text-google-green text-[11px] font-medium py-2.5 px-4 rounded-xl border border-green-100 dark:border-green-900/40 flex items-center gap-1.5 shrink-0">
                                <Icon name="check_circle" className="text-[14px]" />
                                Link Grup Aktif: <a href={inviteLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-700">{inviteLink.substring(0, 30)}...</a>
                            </div>
                        ) : (
                            <div className="bg-red-50 dark:bg-red-950/20 text-google-red text-[11px] font-medium py-2.5 px-4 rounded-xl border border-red-100 dark:border-red-900/40 flex items-center gap-1.5 shrink-0">
                                <Icon name="warning" className="text-[14px]" />
                                Link grup belum diset di Setelan Admin!
                            </div>
                        )}
                    </div>

                    <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
                        <button 
                            onClick={() => setActiveSubTab('active')} 
                            className={`pb-3 font-medium text-[13px] relative transition-colors ${activeSubTab === 'active' ? 'text-google-blue' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span>Permintaan Aktif ({pendingRequests.length})</span>
                            {activeSubTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-google-blue rounded-full"></div>}
                        </button>
                        <button 
                            onClick={() => setActiveSubTab('history')} 
                            className={`pb-3 font-medium text-[13px] relative transition-colors ${activeSubTab === 'history' ? 'text-google-blue' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <span>Riwayat Proses ({processedRequests.length})</span>
                            {activeSubTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-google-blue rounded-full"></div>}
                        </button>
                    </div>

                    {activeSubTab === 'active' ? (
                        pendingRequests.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-2">
                                <Icon name="inbox" className="text-[48px]" />
                                <p className="text-[13px] font-medium">Tidak ada pengajuan gabung grup yang menunggu persetujuan.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pendingRequests.map(r => (
                                    <div key={r.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md space-y-6 hover:shadow-md transition-shadow">
                                        <div className="space-y-1.5">
                                            <h3 className="font-medium text-slate-800 dark:text-slate-100 text-[14.5px] truncate">{r.name}</h3>
                                            <p className="text-[12px] font-medium text-google-blue flex items-center gap-1">
                                                <Icon name="call" className="text-[13px]" /> {r.whatsapp}
                                            </p>
                                            <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                                <Icon name="event" className="text-[12px]" /> Diajukan: {formatDate(r.timestamp)}
                                            </p>
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <button 
                                                onClick={() => handleReject(r.id)} 
                                                className="flex-1 bg-red-50 hover:bg-red-100 text-google-red py-2.5 rounded-full text-[11px] font-medium border border-red-200/50 transition-colors active:scale-95"
                                            >
                                                Tolak
                                            </button>
                                            <button 
                                                onClick={() => handleApprove(r.id)} 
                                                className="flex-1 bg-google-green hover:bg-green-600 text-white py-2.5 rounded-full text-[11px] font-medium transition-colors active:scale-95 shadow-md shadow-green-500/20"
                                            >
                                                Setujui
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        processedRequests.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400 space-y-2">
                                <Icon name="history" className="text-[48px]" />
                                <p className="text-[13px] font-medium">Belum ada riwayat pengajuan yang diproses.</p>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-medium text-slate-400 block-none uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                                                <th className="px-6 sm:px-8 py-5">Nama Lengkap</th>
                                                <th className="px-6 sm:px-8 py-5">Nomor WhatsApp</th>
                                                <th className="px-6 sm:px-8 py-5">Tanggal Diajukan</th>
                                                <th className="px-6 sm:px-8 py-5">Status</th>
                                                <th className="px-6 sm:px-8 py-5 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[12.5px] font-medium text-slate-700 dark:text-slate-300">
                                            {processedRequests.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                                                    <td className="px-6 sm:px-8 py-5 font-medium text-slate-800 dark:text-slate-100">{r.name}</td>
                                                    <td className="px-6 sm:px-8 py-5 text-google-blue font-medium">{r.whatsapp}</td>
                                                    <td className="px-6 sm:px-8 py-5 text-slate-400">{formatDate(r.timestamp)}</td>
                                                    <td className="px-6 sm:px-8 py-5">
                                                        {r.status === 'approved' ? (
                                                            <span className="inline-flex items-center gap-1 bg-green-50 dark:bg-green-950/20 text-google-green text-[10px] font-medium px-2.5 py-1 rounded-full border border-green-200 dark:border-green-900/40">
                                                                <Icon name="check" className="text-[12px]" /> Disetujui
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 bg-red-50 dark:bg-red-950/20 text-google-red text-[10px] font-medium px-2.5 py-1 rounded-full border border-red-200 dark:border-red-900/40">
                                                                <Icon name="close" className="text-[12px]" /> Ditolak
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 sm:px-8 py-5 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => handleResetStatus(r.id)} 
                                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                                                                title="Ubah keputusan kembali ke pending"
                                                            >
                                                                <Icon name="undo" className="text-[16px]" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteRequest(r.id)} 
                                                                className="p-1.5 hover:bg-red-50/10 rounded-full text-slate-400 hover:text-google-red transition-colors"
                                                                title="Hapus permanen"
                                                            >
                                                                <Icon name="delete" className="text-[16px]" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )}
                </div>
            );
        }


export default WaGroup;
