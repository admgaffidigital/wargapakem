import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { safeNumber, getLocalDate, parseLocalDate } from '../../utils/helpers.js';

        function PinjamInventaris({ inventarisData, setInventarisData, pinjamData, setPinjamData, members, userRole }) {
            const [view, setView] = useState('list');          // 'list' | 'form' | 'admin'
            const [formData, setFormData] = useState({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [konfirmReturnId, setKonfirmReturnId] = useState(null);
            const [konfirmRejectId, setKonfirmRejectId] = useState(null);

            // Hitung stok tersedia untuk dipinjam (hanya Baru + Bekas, minus total qty yang sudah dipinjam)
            const getStokTersedia = (itemId) => {
                const item = inventarisData.find(i => i.id === itemId);
                if (!item) return 0;
                // qtyPinjam = baru + bekas (rusak tidak dipinjamkan)
                const stokPinjam = item.qtyPinjam !== undefined
                    ? item.qtyPinjam
                    : ((item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0)) || (item.qty || 1);
                // Kurangi berdasarkan JUMLAH (qty) yang dipinjam, bukan jumlah record
                const totalDipinjam = pinjamData
                    .filter(p => p.itemId === itemId && p.status === 'approved')
                    .reduce((sum, p) => sum + (p.qty || 1), 0);
                return Math.max(0, stokPinjam - totalDipinjam);
            };

            const handleSubmitPinjam = () => {
                if (!formData.namaWarga.trim()) return setErrorMsg('Nama warga wajib diisi!');
                if (!formData.itemId) return setErrorMsg('Pilih barang yang akan dipinjam!');
                if (!formData.keperluan.trim()) return setErrorMsg('Keperluan / nama acara wajib diisi!');
                if (!formData.tanggalPinjam) return setErrorMsg('Tanggal pinjam wajib diisi!');
                if (!formData.tanggalKembali) return setErrorMsg('Perkiraan tanggal kembali wajib diisi!');
                if (formData.tanggalKembali < formData.tanggalPinjam) return setErrorMsg('Tanggal kembali tidak boleh sebelum tanggal pinjam!');
                // Validasi nama warga terdaftar
                const wargaValid = members.find(m => m.name.toLowerCase() === formData.namaWarga.trim().toLowerCase());
                if (!wargaValid) return setErrorMsg(`Nama "${formData.namaWarga}" tidak terdaftar di sistem. Pastikan nama sesuai data warga.`);
                // Cek stok
                const qtyMinta = Math.max(1, safeNumber(formData.qty) || 1);
                const stokTersedia = getStokTersedia(Number(formData.itemId));
                if (stokTersedia <= 0) return setErrorMsg('Stok barang ini sedang habis / semua sedang dipinjam!');
                if (qtyMinta > stokTersedia) return setErrorMsg(`Jumlah yang diminta (${qtyMinta}) melebihi stok tersedia (${stokTersedia} unit)!`);
                // Cek apakah warga sudah punya pengajuan aktif untuk barang ini
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
                    status: 'pending',       // pending | approved | returned | rejected
                    tanggalAjuan: getLocalDate(),
                    tanggalApprove: null,
                    tanggalKembaliAktual: null,
                };
                setPinjamData([newPinjam, ...pinjamData]);
                showToast(`Pengajuan pinjam ${item.name} berhasil dikirim! Tunggu persetujuan admin.`);
                setFormData({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
                setView('list');
                setErrorMsg('');
            };

            const handleApprove = (id) => {
                setPinjamData(pinjamData.map(p => p.id === id ? { ...p, status: 'approved', tanggalApprove: getLocalDate() } : p));
                showToast('Pengajuan disetujui. Barang siap dipinjam.');
            };

            const handleReject = (id) => {
                setPinjamData(pinjamData.filter(p => p.id !== id));
                setKonfirmRejectId(null);
                showToast('Pengajuan ditolak dan dihapus.');
            };

            const handleReturn = (id) => {
                // Hapus record pinjam (stok otomatis pulih karena hitung dari filter)
                setPinjamData(pinjamData.filter(p => p.id !== id));
                setKonfirmReturnId(null);
                showToast('Barang berhasil dicatat kembali. Stok inventaris sudah pulih.');
            };

            const pendingList  = pinjamData.filter(p => p.status === 'pending');
            const approvedList = pinjamData.filter(p => p.status === 'approved');
            const allActive    = [...pendingList, ...approvedList];

            return (
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2"><Icon name="handshake" className="text-[24px] text-google-green" />Pinjam Inventaris</h2>
                                <p className="text-[13px] font-medium text-google-textVariant mt-1">Ajukan peminjaman barang inventaris RT untuk keperluan kegiatan warga.</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {userRole === 'admin' && (
                                    <button onClick={() => setView(view === 'admin' ? 'list' : 'admin')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-[12px] border transition-all active:scale-95 ${view === 'admin' ? 'bg-google-blue text-white border-google-blueDark' : 'bg-white text-google-text border-slate-200 hover:border-google-blue'}`}>
                                        <Icon name="admin_panel_settings" className="text-[16px]" />Panel Admin
                                        {pendingList.length > 0 && <span className="bg-google-red text-white text-[9px] font-medium px-2 py-0.5 rounded-full">{pendingList.length}</span>}
                                    </button>
                                )}
                                <button onClick={() => { setView('form'); setErrorMsg(''); }} className="flex flex-wrap items-center gap-2 bg-google-green text-white px-5 py-2.5 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all">
                                    <Icon name="add" className="text-[16px]" />Ajukan Pinjam
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Form Pengajuan */}
                    {view === 'form' && (
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                            <h3 className="text-[16px] font-medium text-google-text mb-6 flex flex-wrap items-center gap-2"><Icon name="edit_document" className="text-[18px] text-google-green" />Form Pengajuan Pinjam</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Nama warga */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Nama Warga *</label>
                                    <input type="text" value={formData.namaWarga} onChange={e => setFormData(p => ({...p, namaWarga: e.target.value}))} placeholder="Ketik nama sesuai data di Buku Warga..." list="warga-list-pinjam" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                    <datalist id="warga-list-pinjam">{members.map(m => <option key={m.id} value={m.name} />)}</datalist>
                                    <p className="text-[10px] text-google-textVariant mt-1">Nama harus sesuai data warga yang terdaftar di sistem.</p>
                                </div>
                                {/* Pilih barang */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Barang yang Dipinjam *</label>
                                    <select value={formData.itemId} onChange={e => setFormData(p => ({...p, itemId: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors">
                                        <option value="">-- Pilih Barang --</option>
                                        {inventarisData.map(item => {
                                            const stok = getStokTersedia(item.id);
                                            return <option key={item.id} value={item.id} disabled={stok <= 0}>{item.name} - Stok tersedia: {stok} dari {item.qty}{stok <= 0 ? ' (Habis)' : ''}</option>;
                                        })}
                                    </select>
                                </div>
                                {/* Jumlah yang dipinjam */}
                                <div>
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Jumlah Dipinjam *</label>
                                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200 focus-within:border-google-green rounded-xl px-4 py-3">
                                        <button type="button" onClick={() => setFormData(p => ({...p, qty: Math.max(1, (p.qty||1)-1)}))}
                                            className="w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center font-medium text-[17px] text-google-text hover:bg-slate-100 active:scale-95 transition-all shrink-0">G</button>
                                        <div className="flex-1 text-center">
                                            <span className="font-medium text-[17px] text-google-text">{formData.qty || 1}</span>
                                            <span className="text-[11px] text-google-textVariant ml-2">unit</span>
                                        </div>
                                        <button type="button" onClick={() => {
                                            const stok = formData.itemId ? getStokTersedia(Number(formData.itemId)) : 99;
                                            setFormData(p => ({...p, qty: Math.min(stok, (p.qty||1)+1)}));
                                        }} className="w-9 h-9 bg-white border border-slate-200 rounded-full flex items-center justify-center font-medium text-[17px] text-google-text hover:bg-slate-100 active:scale-95 transition-all shrink-0">+</button>
                                    </div>
                                    {formData.itemId && (
                                        <p className="text-[10px] text-google-textVariant mt-1">
                                            Stok tersedia: <span className="font-medium text-google-green">{getStokTersedia(Number(formData.itemId))} unit</span>
                                        </p>
                                    )}
                                </div>
                                {/* Keperluan */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Keperluan / Nama Acara *</label>
                                    <input type="text" value={formData.keperluan} onChange={e => setFormData(p => ({...p, keperluan: e.target.value}))} placeholder="contoh: Tahlilan di rumah Pak Hadi, 7 Muharram" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                                {/* Tanggal pinjam & kembali */}
                                <div>
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Tanggal Pinjam *</label>
                                    <input type="date" value={formData.tanggalPinjam} onChange={e => setFormData(p => ({...p, tanggalPinjam: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Perkiraan Tanggal Kembali *</label>
                                    <input type="date" value={formData.tanggalKembali} min={formData.tanggalPinjam} onChange={e => setFormData(p => ({...p, tanggalKembali: e.target.value}))} className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                                {/* Catatan opsional */}
                                <div className="sm:col-span-2">
                                    <label className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 block">Catatan Tambahan (opsional)</label>
                                    <textarea value={formData.catatan} onChange={e => setFormData(p => ({...p, catatan: e.target.value}))} rows={2} placeholder="Keterangan tambahan jika perlu..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors resize-none" />
                                </div>
                            </div>
                            {errorMsg && <div className="mt-4 bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-xl text-[12px] font-medium flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px]" />{errorMsg}</div>}
                            <div className="flex flex-wrap gap-3 mt-6">
                                <button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">Batal</button>
                                <button onClick={handleSubmitPinjam} className="flex flex-wrap bg-google-green text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2"><Icon name="send" className="text-[16px]" />Kirim Pengajuan</button>
                            </div>
                        </div>
                    )}

                    {/* Panel Admin */}
                    {view === 'admin' && userRole === 'admin' && (
                        <div className="space-y-6">
                            {/* Pending */}
                            {pendingList.length > 0 && (
                                <div className="bg-white rounded-3xl border border-google-yellow/40 shadow-sm p-6 sm:p-8 md:p-6">
                                    <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2"><Icon name="pending" className="text-[17px] text-google-yellow" />Menunggu Persetujuan ({pendingList.length})</h3>
                                    <div className="space-y-5">
                                        {pendingList.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-google-yellowLight/40 border border-google-yellow/40 rounded-2xl p-6 sm:p-8 md:p-8">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{p.namaWarga}</p>
                                                    <p className="text-[12px] font-medium text-google-yellowDark mt-0.5 flex flex-wrap items-center gap-1"><Icon name="inventory_2" className="text-[13px]" />{p.namaBarang} <span className="ml-1 bg-google-yellow/20 text-google-yellowDark border border-google-yellow/40 px-2 py-0.5 rounded-lg font-medium text-[10px]">{p.qty || 1} unit</span></p>
                                                    <p className="text-[11px] text-google-textVariant mt-1 flex flex-wrap items-center gap-1"><Icon name="event" className="text-[12px]" />Pinjam: {parseLocalDate(p.tanggalPinjam).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} G Kembali: {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
                                                    <p className="text-[11px] text-google-textVariant mt-0.5 italic">"{p.keperluan}"</p>
                                                    {p.catatan && <p className="text-[10px] text-slate-500 mt-0.5">= {p.catatan}</p>}
                                                </div>
                                                <div className="flex flex-wrap gap-2 shrink-0">
                                                    <button onClick={() => setKonfirmRejectId(p.id)} className="px-4 py-2.5 bg-white text-google-red border border-google-red/30 rounded-full font-medium text-[11px] hover:bg-google-redLight active:scale-95 transition-all">Tolak</button>
                                                    <button onClick={() => handleApprove(p.id)} className="px-4 py-2.5 bg-google-green text-white border border-google-greenDark rounded-full font-medium text-[11px] hover:bg-google-greenDark active:scale-95 transition-all shadow-md flex flex-wrap items-center gap-1"><Icon name="check" className="text-[13px]" />Setujui</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Approved / sedang dipinjam */}
                            {approvedList.length > 0 && (
                                <div className="bg-white rounded-3xl border border-google-blue/30 shadow-sm p-6 sm:p-8 md:p-6">
                                    <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2"><Icon name="handshake" className="text-[17px] text-google-blue" />Sedang Dipinjam ({approvedList.length})</h3>
                                    <div className="space-y-5">
                                        {approvedList.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-google-blueLight/30 border border-google-blue/30 rounded-2xl p-6 sm:p-8 md:p-8">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{p.namaWarga}</p>
                                                    <p className="text-[12px] font-medium text-google-blueDark mt-0.5 flex flex-wrap items-center gap-1"><Icon name="inventory_2" className="text-[13px]" />{p.namaBarang} <span className="ml-1 bg-google-blue/10 text-google-blueDark border border-google-blue/30 px-2 py-0.5 rounded-lg font-medium text-[10px]">{p.qty || 1} unit</span></p>
                                                    <p className="text-[11px] text-google-textVariant mt-1 flex flex-wrap items-center gap-1"><Icon name="event" className="text-[12px]" />Pinjam: {parseLocalDate(p.tanggalPinjam).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} G Estimasi Kembali: {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
                                                    <p className="text-[11px] text-google-textVariant mt-0.5 italic">"{p.keperluan}"</p>
                                                    {/* Cek apakah sudah lewat tanggal kembali */}
                                                    {p.tanggalKembali < getLocalDate() && (
                                                        <p className="text-[10px] font-medium text-google-red mt-1 flex flex-wrap items-center gap-1"><Icon name="warning" className="text-[12px]" />Melewati estimasi tanggal kembali!</p>
                                                    )}
                                                </div>
                                                <button onClick={() => setKonfirmReturnId(p.id)} className="px-4 py-2.5 bg-google-blue text-white border border-google-blueDark rounded-full font-medium text-[11px] hover:bg-google-blueDark active:scale-95 transition-all shadow-md flex flex-wrap items-center gap-1 shrink-0"><Icon name="assignment_return" className="text-[13px]" />Barang Kembali</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {allActive.length === 0 && (
                                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                                    <Icon name="check_circle" className="text-[56px] text-google-green mx-auto mb-4" fill="true" />
                                    <h3 className="text-[17px] font-medium text-google-text mb-2">Semua Bersih!</h3>
                                    <p className="text-[13px] text-google-textVariant font-medium">Tidak ada pengajuan pinjam yang aktif saat ini.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Daftar Status untuk Warga */}
                    {view === 'list' && (
                        <div className="space-y-6">
                            {/* Info stok tersedia */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {inventarisData.map(item => {
                                    const stok = getStokTersedia(item.id);
                                    const sedangDipinjam = pinjamData.filter(p => p.itemId === item.id && p.status === 'approved');
                                    return (
                                        <div key={item.id} className={`bg-white rounded-3xl border p-5 shadow-sm flex items-center gap-4 ${stok <= 0 ? 'border-google-red/40 bg-google-redLight/20' : 'border-slate-200'}`}>
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${stok <= 0 ? 'bg-google-redLight border-google-red/30' : 'bg-google-greenLight border-google-green/30'}`}>
                                                <Icon name="inventory_2" className={`text-[24px] ${stok <= 0 ? 'text-google-red' : 'text-google-green'}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{item.name}</p>
                                                <p className={`text-[11px] font-medium mt-0.5 ${stok <= 0 ? 'text-google-red' : 'text-google-greenDark'}`}>{stok <= 0 ? 'G Semua sedang dipinjam' : `G ${stok} dari ${item.qty} tersedia`}</p>
                                                {sedangDipinjam.length > 0 && (
                                                    <div className="mt-1.5 bg-google-redLight/50 border border-google-red/30 rounded-lg px-3 py-1.5 space-y-1">
                                                        {sedangDipinjam.map((p, i) => (
                                                            <div key={i} className="flex items-center justify-between">
                                                                <span className="text-[10px] font-medium text-google-text flex flex-wrap items-center gap-1"><Icon name="person" className="text-[11px] text-google-textVariant" />{p.namaWarga}</span>
                                                                <span className="text-[9px] font-medium text-google-red bg-white px-2 py-0.5 rounded-lg border border-google-red/30 shrink-0 ml-1">{p.qty || 1} unit</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {inventarisData.length === 0 && (
                                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
                                    <Icon name="inventory_2" className="text-[56px] text-slate-300 mx-auto mb-4" />
                                    <p className="text-[13px] text-google-textVariant font-medium">Belum ada barang inventaris yang terdaftar.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Modal konfirmasi kembali */}
                    {konfirmReturnId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                {(() => { const p = pinjamData.find(x => x.id === konfirmReturnId); return p ? (<>
                                    <div className="mb-5 bg-google-greenLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-green/30"><Icon name="assignment_return" className="text-[40px] text-google-green" /></div>
                                    <h3 className="text-xl font-medium text-google-text mb-2">Konfirmasi Pengembalian</h3>
                                    <p className="text-[13px] text-google-textVariant mb-2"><span className="font-medium text-google-text">{p.namaBarang}</span><br/>dikembalikan oleh <span className="font-medium text-google-blueDark">{p.namaWarga}</span></p>
                                    <p className="text-[12px] font-medium text-google-green mb-6">Stok inventaris akan otomatis pulih setelah konfirmasi.</p>
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => setKonfirmReturnId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3 rounded-full font-medium text-[12px] border border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                        <button onClick={() => handleReturn(konfirmReturnId)} className="flex-1 bg-google-green text-white px-4 py-3 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95">G Konfirmasi Kembali</button>
                                    </div>
                                </>) : null; })()}
                            </div>
                        </div>
                    )}

                    {/* Modal konfirmasi tolak */}
                    {konfirmRejectId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="cancel" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-xl font-medium text-google-text mb-2">Tolak Pengajuan?</h3>
                                <p className="text-[13px] text-google-textVariant mb-6">Pengajuan pinjam ini akan dihapus dari daftar.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setKonfirmRejectId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3 rounded-full font-medium text-[12px] border border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                    <button onClick={() => handleReject(konfirmRejectId)} className="flex-1 bg-google-red text-white px-4 py-3 rounded-full font-medium text-[12px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95">Tolak & Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        // =====================================================
        // KOMPONEN INFAQ

export default PinjamInventaris;
