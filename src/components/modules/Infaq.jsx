import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, getLocalDate, parseLocalDate, uploadToGoogleDrive } from '../../utils/helpers.js';

        function Infaq({ infaqData, setInfaqData, userRole, identity }) {
            // view: 'list' = daftar program, 'detail' = detail 1 program, 'form' = admin buat/edit
            const [view, setView]               = useState('list');
            const [selected, setSelected]       = useState(null);
            const [editingId, setEditingId]     = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [errorMsg, setErrorMsg]       = useState('');
            const [isUploading, setIsUploading] = useState(false);

            // Form admin: buat/edit program infaq
            const emptyForm = {
                judul: '', deskripsi: '', tujuan: '', manfaat: '', imageUrl: '',
                danaTarget: 0, danaTerkumpul: 0,
                rekening: [{ bank: '', norek: '', atasNama: '' }],
            };
            const [form, setForm] = useState(emptyForm);

            // Nominal infaq yang dipilih warga (tampilan detail)
            const [nominalInput, setNominalInput]   = useState('');
            const [namaInfaq, setNamaInfaq]         = useState('');
            const [tipeNama, setTipeNama]            = useState('nama'); // 'nama' | 'tanpanama' | 'hambaalah'
            const [showPayModal, setShowPayModal]   = useState(false);
            const [selectedRek, setSelectedRek]     = useState(0);

            // Cek jika ada perintah buka Infaq dari Landing Page
            useEffect(() => {
                const openId = sessionStorage.getItem('openInfaqId');
                if (openId && infaqData.length > 0) {
                    const prog = infaqData.find(i => i.id === openId);
                    if (prog) {
                        setSelected(prog);
                        setView('detail');
                        setNominalInput('');
                        setNamaInfaq('');
                        setTipeNama('nama');
                        setSelectedRek(0);
                    }
                    sessionStorage.removeItem('openInfaqId');
                }
            }, [infaqData]);

            // Tambahan State Warga: Upload Bukti
            const [buktiUrl, setBuktiUrl]           = useState('');
            const [isUploadingBukti, setIsUploadingBukti] = useState(false);

            const NOMINAL_CEPAT = [10000, 25000, 50000, 100000, 250000, 500000];

            // ---- Handler Warga: Upload Bukti ----
            const handleBuktiUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return showToast('Ukuran foto maks 2MB!', 'error');
                setIsUploadingBukti(true);
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.8);
                    setBuktiUrl(url);
                } catch(error) {
                    showToast(error, 'error');
                } finally {
                    setIsUploadingBukti(false);
                }
            };

            // ---- Handler Admin ----
            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return setErrorMsg('Ukuran foto maks 2MB!');
                setIsUploading(true);
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.8);
                    setForm(p => ({...p, imageUrl: url}));
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleSaveProgram = () => {
                if (!form.judul.trim())     return setErrorMsg('Judul program wajib diisi!');
                if (!form.deskripsi.trim()) return setErrorMsg('Deskripsi wajib diisi!');
                if (form.rekening.some(r => !r.bank.trim() || !r.norek.trim() || !r.atasNama.trim()))
                    return setErrorMsg('Lengkapi semua data rekening pembayaran!');

                const data = {
                    ...form,
                    judul: form.judul.trim(),
                    deskripsi: form.deskripsi.trim(),
                    tujuan: form.tujuan.trim(),
                    manfaat: form.manfaat.trim(),
                    danaTarget: safeNumber(form.danaTarget),
                    danaTerkumpul: safeNumber(form.danaTerkumpul),
                };
                if (editingId) {
                    setInfaqData(infaqData.map(i => i.id === editingId ? { ...i, ...data } : i));
                    showToast('Program infaq berhasil diperbarui.');
                } else {
                    setInfaqData([{ id: Date.now(), ...data, createdAt: getLocalDate() }, ...infaqData]);
                    showToast('Program infaq baru berhasil dibuat.');
                }
                setView('list'); setEditingId(null); setForm(emptyForm); setErrorMsg('');
            };

            const addRek = () => setForm(p => ({ ...p, rekening: [...p.rekening, { bank: '', norek: '', atasNama: '' }] }));
            const removeRek = (i) => setForm(p => ({ ...p, rekening: p.rekening.filter((_, idx) => idx !== i) }));
            const updateRek = (i, field, val) => setForm(p => ({
                ...p, rekening: p.rekening.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
            }));

            // ---- Helper ----
            const pct = (item) => item.danaTarget > 0
                ? Math.min(100, Math.round((item.danaTerkumpul / item.danaTarget) * 100))
                : null;

            const namaDisplay = tipeNama === 'tanpanama' ? 'Tanpa Nama'
                : tipeNama === 'hambaalah' ? 'Hamba Allah'
                : namaInfaq.trim() || 'Anonim';

            // ---- RENDER: LIST ----
            if (view === 'list') return (
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                <Icon name="volunteer_activism" className="text-[24px] text-google-green" fill="true" />Program Infaq
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1">Salurkan infaq untuk kebaikan bersama warga {identity?.name || 'RT'}.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setForm(emptyForm); setEditingId(null); setErrorMsg(''); setView('form'); }}
                                className="flex flex-wrap items-center gap-2 bg-google-green text-white px-5 py-2.5 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all shrink-0">
                                <Icon name="add" className="text-[16px]" />Buat Program Infaq
                            </button>
                        )}
                    </div>

                    {/* Grid program */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                        {infaqData.map(item => {
                            const p = pct(item);
                            return (
                                <div key={item.id} onClick={() => { setSelected(item); setView('detail'); setNominalInput(''); setNamaInfaq(''); setTipeNama('nama'); setSelectedRek(0); }}
                                    className="bento-island-card overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-emerald-500/30 transition-all duration-300 cursor-pointer group flex flex-col p-0">
                                    {/* Foto */}
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 aspect-[4/3] sm:aspect-video">
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={item.judul} />
                                            : <div className="flex items-center justify-center p-10"><Icon name="volunteer_activism" className="text-[64px] text-slate-300 dark:text-slate-600" fill="true" /></div>
                                        }
                                    </div>
                                    {/* Info */}
                                    <div className="p-6 sm:p-8 md:p-8 flex flex-col gap-3">
                                        <h3 className="text-[15px] font-medium text-google-text leading-snug tracking-tight group-hover:text-google-greenDark transition-colors">{item.judul}</h3>
                                        <p className="text-[12px] text-google-textVariant font-medium leading-relaxed line-clamp-2">{item.deskripsi}</p>
                                        {/* Dana progress */}
                                        <div className="mt-auto space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-google-textVariant">Dana Terkumpul</span>
                                                {p !== null && <span className="text-[11px] font-medium text-google-green">{p}%</span>}
                                            </div>
                                            <p className="text-[16px] font-medium text-google-green tracking-tight">{formatRp(item.danaTerkumpul || 0)}</p>
                                            {item.danaTarget > 0 && (
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-google-green rounded-full transition-all duration-700" style={{width: `${p}%`}} />
                                                </div>
                                            )}
                                            {item.danaTarget > 0 && (
                                                <p className="text-[10px] text-google-textVariant font-medium">Target: {formatRp(item.danaTarget)}</p>
                                            )}
                                        </div>
                                        {/* Admin actions */}
                                        {userRole === 'admin' && (
                                            <div className="flex gap-2 pt-3 border-t border-slate-100 mt-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => { setForm({...item}); setEditingId(item.id); setErrorMsg(''); setView('form'); }}
                                                    className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95">
                                                    <Icon name="edit" className="text-[14px]" /> Edit
                                                </button>
                                                <button onClick={() => setDeleteConfirmId(item.id)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95">
                                                    <Icon name="delete" className="text-[14px]" /> Hapus
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {infaqData.length === 0 && (
                            <div className="col-span-full bg-white border border-slate-200 p-14 text-center rounded-3xl shadow-sm">
                                <Icon name="volunteer_activism" className="text-[64px] text-slate-300 mx-auto mb-4" fill="true" />
                                <h3 className="text-[17px] font-medium text-google-text mb-2">Belum Ada Program Infaq</h3>
                                <p className="text-[13px] text-google-textVariant font-medium">{userRole === 'admin' ? 'Klik "Buat Program Infaq" untuk menambahkan.' : 'Program infaq akan tampil di sini.'}</p>
                            </div>
                        )}
                    </div>

                    {/* Modal hapus */}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30">
                                    <Icon name="delete" className="text-[40px] text-google-red" />
                                </div>
                                <h3 className="text-xl font-medium text-google-text mb-2">Hapus Program Infaq?</h3>
                                <p className="text-[13px] text-google-textVariant mb-8">Program beserta data rekening akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                    <button onClick={() => { setInfaqData(infaqData.filter(i => i.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Program infaq dihapus.'); }}
                                        className="flex-1 bg-google-red text-white px-4 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );

            // ---- RENDER: DETAIL ----
            if (view === 'detail' && selected) {
                const prog = infaqData.find(i => i.id === selected.id) || selected;
                const p = pct(prog);
                return (
                    <div className="space-y-7 w-full">
                        {/* Back */}
                        <button onClick={() => setView('list')} className="flex flex-wrap items-center gap-2 text-google-textVariant font-medium text-[13px] hover:text-google-text transition-colors active:scale-95">
                            <Icon name="arrow_back" className="text-[17px]" />Kembali ke Daftar
                        </button>

                        {/* Foto */}
                        {prog.imageUrl && (
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center max-h-[500px]">
                                <img src={prog.imageUrl} className="w-full h-full object-cover" alt={prog.judul} />
                            </div>
                        )}

                        {/* Judul & dana */}
                        <div className="bento-island-card p-5 sm:p-7">
                            <h2 className="text-[18px] font-medium text-google-text mb-2 tracking-tight">{prog.judul}</h2>
                            <p className="text-[13px] text-google-textVariant font-medium leading-relaxed mb-4">{prog.deskripsi}</p>
                            {/* Progress dana */}
                            <div className="bg-google-greenLight/50 border border-google-green/30 rounded-2xl p-6 sm:p-8 md:p-8">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider">Dana Terkumpul</p>
                                        <p className="text-[24px] font-medium text-google-green tracking-tight">{formatRp(prog.danaTerkumpul || 0)}</p>
                                    </div>
                                    {p !== null && (
                                        <div className="text-right">
                                            <p className="text-[11px] font-medium text-google-textVariant">Target</p>
                                            <p className="text-[13px] font-medium text-google-text">{formatRp(prog.danaTarget)}</p>
                                        </div>
                                    )}
                                </div>
                                {prog.danaTarget > 0 && (
                                    <>
                                        <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-google-green/30">
                                            <div className="h-full bg-google-green rounded-full transition-all duration-700" style={{width:`${p}%`}} />
                                        </div>
                                        <p className="text-[11px] font-medium text-google-greenDark mt-1.5">{p}% dari target tercapai</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Admin: update dana */}
                        {userRole === 'admin' && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-google-blue/30 shadow-sm p-6 sm:p-8 md:p-6">
                                <h3 className="text-[13px] font-medium text-google-text mb-3 flex flex-wrap items-center gap-2">
                                    <Icon name="edit" className="text-[16px] text-google-blue" />Perbarui Dana Terkumpul
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    <input type="number" min="0" defaultValue={prog.danaTerkumpul || 0}
                                        id="update-dana-input"
                                        className="flex-1 bg-slate-50 border border-slate-200 focus:border-google-blue rounded-full px-4 py-3 text-[13px] font-medium outline-none transition-colors"
                                        placeholder="Nominal dana terkumpul..." />
                                    <button onClick={() => {
                                        const val = safeNumber(document.getElementById('update-dana-input').value);
                                        setInfaqData(infaqData.map(i => i.id === prog.id ? {...i, danaTerkumpul: val} : i));
                                        setSelected(prev => ({...prev, danaTerkumpul: val}));
                                        showToast('Dana terkumpul berhasil diperbarui.');
                                    }} className="bg-google-blue text-white px-5 py-3 rounded-full font-medium text-[12px] border border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all whitespace-nowrap">
                                        Simpan
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Admin: Panel Approval Bukti Transfer */}
                        {userRole === 'admin' && (prog.donasi || []).length > 0 && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-google-yellow/30 shadow-sm p-6 sm:p-8 md:p-6">
                                <h3 className="text-[15px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2">
                                    <Icon name="verified_user" className="text-[18px] text-google-yellow" fill="true" />Persetujuan Bukti Bayar
                                </h3>
                                <div className="space-y-6">
                                    {(prog.donasi || []).map(donasi => (
                                        <div key={donasi.id} className="bg-slate-50 rounded-2xl p-6 sm:p-8 md:p-6 border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                            <div className="flex flex-wrap items-center gap-4 w-full">
                                                {donasi.imageUrl ? (
                                                    <a href={donasi.imageUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 shrink-0 bg-slate-200 rounded-xl overflow-hidden hover:opacity-80 transition-opacity">
                                                        <img src={donasi.imageUrl} className="w-full h-full object-cover" alt="Bukti Transfer" />
                                                    </a>
                                                ) : (
                                                    <div className="w-16 h-16 shrink-0 bg-slate-200 rounded-xl flex items-center justify-center">
                                                        <Icon name="receipt" className="text-[20px] text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{donasi.nama}</p>
                                                    <p className="text-[13px] font-medium text-google-green">{formatRp(donasi.nominal)}</p>
                                                    <p className="text-[10px] text-google-textVariant mt-0.5">{parseLocalDate(donasi.tanggal).toLocaleDateString('id-ID')}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                                                {donasi.status === 'PENDING' ? (
                                                    <>
                                                        <button onClick={() => {
                                                            const updatedDonasi = (prog.donasi || []).map(d => d.id === donasi.id ? {...d, status: 'APPROVED'} : d);
                                                            const newDana = (prog.danaTerkumpul || 0) + donasi.nominal;
                                                            const updatedProg = { ...prog, donasi: updatedDonasi, danaTerkumpul: newDana };
                                                            setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                            setSelected(updatedProg);
                                                            showToast('Bukti disetujui. Dana bertambah otomatis!');
                                                        }} className="bg-google-green text-white px-4 py-2 rounded-full font-medium text-[11px] border border-google-greenDark shadow-sm hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                                            <Icon name="check" className="text-[13px]"/>Setujui
                                                        </button>
                                                        <button onClick={() => {
                                                            const updatedDonasi = (prog.donasi || []).map(d => d.id === donasi.id ? {...d, status: 'REJECTED'} : d);
                                                            const updatedProg = { ...prog, donasi: updatedDonasi };
                                                            setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                            setSelected(updatedProg);
                                                            showToast('Bukti ditolak.', 'error');
                                                        }} className="bg-white text-google-red px-4 py-2 rounded-full font-medium text-[11px] border border-google-red/30 shadow-sm hover:bg-google-redLight active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                                            <Icon name="close" className="text-[13px]"/>Tolak
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={`px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-widest ${
                                                        donasi.status === 'APPROVED' ? 'bg-google-greenLight text-google-greenDark border border-google-green/30' :
                                                        donasi.status === 'REJECTED' ? 'bg-google-redLight text-google-redDark border border-google-red/30' :
                                                        'bg-google-yellowLight text-google-yellowDark border border-google-yellow/30'
                                                    }`}>
                                                        {donasi.status === 'APPROVED' ? 'Disetujui' : donasi.status === 'REJECTED' ? 'Œ Ditolak' : ' Menunggu'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Riwayat Donasi • Tampil untuk SEMUA user (Warga & Admin) */}
                        {(prog.donasi || []).length > 0 && userRole !== 'admin' && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 md:p-6">
                                <h3 className="text-[15px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2">
                                    <Icon name="receipt_long" className="text-[18px] text-google-blue" fill="true" />Riwayat Donasi Anda
                                </h3>
                                <div className="space-y-5">
                                    {(prog.donasi || []).map(donasi => (
                                        <div key={donasi.id} className="bg-slate-50 rounded-2xl p-6 sm:p-8 md:p-6 border border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                                            <div className="flex flex-wrap items-center gap-3 w-full">
                                                {donasi.imageUrl ? (
                                                    <a href={donasi.imageUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 shrink-0 bg-slate-200 rounded-lg overflow-hidden hover:opacity-80 transition-opacity">
                                                        <img src={donasi.imageUrl} className="w-full h-full object-cover" alt="Bukti" />
                                                    </a>
                                                ) : (
                                                    <div className="w-12 h-12 shrink-0 bg-slate-200 rounded-lg flex items-center justify-center">
                                                        <Icon name="receipt" className="text-[17px] text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{donasi.nama}</p>
                                                    <p className="text-[12px] font-medium text-google-green">{formatRp(donasi.nominal)}</p>
                                                    <p className="text-[10px] text-google-textVariant">{parseLocalDate(donasi.tanggal).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-md text-[10px] font-medium uppercase tracking-widest shrink-0 ${
                                                donasi.status === 'APPROVED' ? 'bg-google-greenLight text-google-greenDark border border-google-green/30' :
                                                donasi.status === 'REJECTED' ? 'bg-google-redLight text-google-redDark border border-google-red/30' :
                                                'bg-google-yellowLight text-google-yellowDark border border-google-yellow/30'
                                            }`}>
                                                {donasi.status === 'APPROVED' ? 'Disetujui' : donasi.status === 'REJECTED' ? 'Œ Ditolak' : ' Menunggu'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tujuan & manfaat */}
                        {(prog.tujuan || prog.manfaat) && (
                            <div className="bg-white rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 md:p-6 space-y-6">
                                {prog.tujuan && (
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 flex flex-wrap items-center gap-1.5"><Icon name="flag" className="text-[13px] text-google-blue" />Tujuan Program</p>
                                        <p className="text-[13px] text-google-text font-medium leading-relaxed">{prog.tujuan}</p>
                                    </div>
                                )}
                                {prog.manfaat && (
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-1.5 flex flex-wrap items-center gap-1.5"><Icon name="star" className="text-[13px] text-google-yellow" />Manfaat</p>
                                        <p className="text-[13px] text-google-text font-medium leading-relaxed">{prog.manfaat}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Form infaq warga */}
                        <div className="bg-white rounded-3xl sm:rounded-3xl border border-google-green/30 shadow-sm p-6 sm:p-8 md:p-6 space-y-7">
                            <h3 className="text-[15px] font-medium text-google-text flex flex-wrap items-center gap-2">
                                <Icon name="volunteer_activism" className="text-[18px] text-google-green" fill="true" />Tunaikan Infaq
                            </h3>

                            {/* Pilih nominal */}
                            <div>
                                <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-2">Nominal Infaq</p>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {NOMINAL_CEPAT.map(n => (
                                        <button key={n} onClick={() => setNominalInput(String(n))}
                                            className={`py-2.5 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${nominalInput === String(n) ? 'bg-google-green text-white border-google-greenDark shadow-md' : 'bg-slate-50 text-google-text border-slate-200 hover:border-google-green/50'}`}>
                                            {formatRp(n)}
                                        </button>
                                    ))}
                                </div>
                                <input type="number" min="1000" value={nominalInput} onChange={e => setNominalInput(e.target.value)}
                                    placeholder="Atau ketik nominal lain (Rp)..."
                                    className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                            </div>

                            {/* Nama penginfaq */}
                            <div>
                                <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider mb-2">Atas Nama</p>
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {[['nama','Nama Saya'],['tanpanama','Tanpa Nama'],['hambaalah','Hamba Allah']].map(([val, label]) => (
                                        <button key={val} onClick={() => setTipeNama(val)}
                                            className={`px-4 py-2 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${tipeNama === val ? 'bg-google-green text-white border-google-greenDark' : 'bg-slate-50 text-google-text border-slate-200 hover:border-google-green/40'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {tipeNama === 'nama' && (
                                    <input type="text" value={namaInfaq} onChange={e => setNamaInfaq(e.target.value)}
                                        placeholder="Ketik nama Anda..."
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                )}
                            </div>

                            {/* Ringkasan sebelum bayar */}
                            {nominalInput && safeNumber(nominalInput) >= 1000 && (
                                <div className="bg-google-greenLight border border-google-green/40 rounded-xl px-4 py-3.5 flex justify-between items-center">
                                    <div>
                                        <p className="text-[11px] font-medium text-google-textVariant">Infaq atas nama: <span className="text-google-greenDark">{namaDisplay}</span></p>
                                        <p className="text-[16px] font-medium text-google-green mt-0.5">{formatRp(safeNumber(nominalInput))}</p>
                                    </div>
                                    <button onClick={() => setShowPayModal(true)}
                                        className="bg-google-green text-white px-5 py-3 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center gap-1.5 shrink-0">
                                        <Icon name="payments" className="text-[16px]" />Bayar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal pembayaran */}
                        {showPayModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-8 md:p-6 modal-backdrop animate-backdrop-in">
                                <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl sm:rounded-3xl p-6 sm:p-8 md:p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 my-4 modal-card animate-modal-in">
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="text-[16px] font-medium text-google-text">Cara Pembayaran</h3>
                                        <button onClick={() => setShowPayModal(false)} className="w-9 h-9 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all">
                                            <Icon name="close" className="text-[16px]" />
                                        </button>
                                    </div>

                                    {/* Ringkasan */}
                                    <div className="bg-google-greenLight border border-google-green/30 rounded-2xl p-6 sm:p-8 md:p-6 mb-4">
                                        <p className="text-[11px] font-medium text-google-textVariant">Nominal Infaq</p>
                                        <p className="text-[18px] font-medium text-google-green">{formatRp(safeNumber(nominalInput))}</p>
                                        <p className="text-[11px] font-medium text-google-textVariant mt-1">Atas nama: <span className="text-google-greenDark font-medium">{namaDisplay}</span></p>
                                    </div>

                                    {/* Pilih rekening */}
                                    {(prog.rekening || []).length > 1 && (
                                        <div className="flex gap-2 flex-wrap mb-3">
                                            {(prog.rekening || []).map((r, i) => (
                                                <button key={i} onClick={() => setSelectedRek(i)}
                                                    className={`px-3 py-1.5 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${selectedRek === i ? 'bg-google-blue text-white border-google-blueDark' : 'bg-slate-50 text-google-text border-slate-200'}`}>
                                                    {r.bank}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Detail rekening */}
                                    {(prog.rekening || []).length > 0 && (() => {
                                        const r = prog.rekening[selectedRek] || prog.rekening[0];
                                        return (
                                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 md:p-8 space-y-5.5">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="w-10 h-10 bg-google-blueLight rounded-xl flex items-center justify-center border border-google-blue/30 shrink-0">
                                                        <Icon name="account_balance" className="text-[17px] text-google-blue" />
                                                    </div>
                                                    <p className="font-medium text-[14px] text-google-text">{r.bank}</p>
                                                </div>
                                                {[['Nomor Rekening', r.norek], ['Atas Nama', r.atasNama]].map(([label, val]) => (
                                                    <div key={label} className="flex items-center justify-between">
                                                        <span className="text-[11px] font-medium text-google-textVariant">{label}</span>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-medium text-[13px] text-google-text">{val}</span>
                                                            <button onClick={() => { navigator.clipboard?.writeText(val); showToast(`${label} disalin!`); }}
                                                                className="w-7 h-7 bg-white border border-slate-200 rounded-full flex items-center justify-center hover:bg-google-blueLight hover:border-google-blue/40 active:scale-95 transition-all">
                                                                <Icon name="content_copy" className="text-[12px] text-google-textVariant" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <p className="text-[10px] font-medium text-google-textVariant bg-white border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
                                                    = Cantumkan nominal <span className="text-google-green font-medium">{formatRp(safeNumber(nominalInput))}</span> dan nama <span className="text-google-greenDark font-medium">{namaDisplay}</span> saat transfer.
                                                </p>
                                            </div>
                                        );
                                    })()}

                                        {/* Upload Bukti */}
                                        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 md:p-6 text-center relative overflow-hidden transition-all focus-within:border-google-green group hover:border-google-green/40 cursor-pointer">
                                            <p className="text-[11px] font-medium text-google-textVariant mb-2 uppercase tracking-wider">Upload Bukti Transfer</p>
                                            <input type="file" accept="image/*" onChange={handleBuktiUpload} disabled={isUploadingBukti} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                            {isUploadingBukti ? (
                                                <div className="w-8 h-8 border border-google-green border-t-transparent rounded-full animate-spin mx-auto my-3" />
                                            ) : buktiUrl ? (
                                                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                                                    <img src={buktiUrl} className="w-full h-32 object-cover" alt="Bukti Transfer" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white font-medium text-[11px] flex flex-wrap items-center gap-1"><Icon name="edit" className="text-[14px]"/> Ganti Foto</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-2 flex flex-col items-center bg-white rounded-xl border border-slate-200 shadow-sm group-hover:bg-google-greenLight transition-colors">
                                                    <Icon name="add_photo_alternate" className="text-[32px] text-slate-300 group-hover:text-google-green transition-colors" />
                                                    <span className="text-[10px] text-google-textVariant mt-1">Ketuk untuk unggah (Maks 2MB)</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-4">
                                            <button onClick={() => { setShowPayModal(false); setBuktiUrl(''); }}
                                                className="w-full sm:w-auto bg-white text-google-text py-3.5 rounded-full font-medium text-[12px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">
                                                Batal
                                            </button>
                                            <button onClick={() => { 
                                                if (!buktiUrl) return showToast('Mohon unggah bukti transfer terlebih dahulu!', 'error');
                                                const newDonasi = {
                                                    id: Date.now(),
                                                    nama: namaDisplay,
                                                    nominal: safeNumber(nominalInput),
                                                    imageUrl: buktiUrl,
                                                    status: 'PENDING',
                                                    tanggal: getLocalDate()
                                                };
                                                const updatedProg = {
                                                    ...prog,
                                                    donasi: [newDonasi, ...(prog.donasi || [])]
                                                };
                                                setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                setSelected(updatedProg); // update view detail
                                                setShowPayModal(false);
                                                setBuktiUrl('');
                                                showToast('Terima kasih! Bukti transfer Anda telah dikirim dan menunggu verifikasi Admin.');
                                            }}
                                                className="flex flex-wrap bg-google-green text-white py-3.5 rounded-full font-medium text-[12px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-1.5">
                                                <Icon name="send" className="text-[16px]"/> Kirim Bukti
                                            </button>
                                        </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            // ---- RENDER: FORM ADMIN ----
            if (view === 'form') return (
                <div className="space-y-7 w-full">
                    <button onClick={() => { setView('list'); setErrorMsg(''); }} className="flex flex-wrap items-center gap-2 text-google-textVariant font-medium text-[13px] hover:text-google-text transition-colors active:scale-95">
                        <Icon name="arrow_back" className="text-[17px]" />Kembali
                    </button>

                    <div className="bento-island-card p-5 sm:p-7">
                        <h3 className="text-[17px] font-medium text-google-text mb-6 tracking-tight">
                            {editingId ? ' Edit Program Infaq' : '+ Buat Program Infaq Baru'}
                        </h3>
                        <div className="space-y-7">

                            {/* Gambar */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Foto Program <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-green transition-all`}>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 z-0">
                                        {isUploading ? <div className="w-5 h-5 border border-google-green border-t-transparent rounded-full animate-spin" />
                                            : form.imageUrl ? <img src={form.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="preview" />
                                            : <Icon name="cloud_upload" className="text-[20px] text-google-textVariant" />}
                                    </div>
                                    <div className="flex-1 z-0">
                                        <p className="font-medium text-[13px] text-google-text">{isUploading ? 'Mengunggah...' : form.imageUrl ? 'Foto Tersimpan ✓' : 'Pilih Foto Program'}</p>
                                        <p className="text-[11px] text-google-textVariant">Maks. 2MB</p>
                                    </div>
                                    {form.imageUrl && <button type="button" onClick={e => { e.stopPropagation(); setForm(p=>({...p,imageUrl:''})); }} className="relative z-20 text-google-red bg-white border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center text-[14px] hover:bg-google-redLight active:scale-95 shrink-0">+</button>}
                                </div>
                            </div>

                            {/* Judul */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Judul Program *</label>
                                <input type="text" value={form.judul} onChange={e => setForm(p=>({...p,judul:e.target.value}))}
                                    placeholder="contoh: Infaq Pembangunan Mushola RT" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                            </div>

                            {/* Deskripsi */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Deskripsi Program *</label>
                                <textarea value={form.deskripsi} onChange={e => setForm(p=>({...p,deskripsi:e.target.value}))} rows={3}
                                    placeholder="Jelaskan program infaq ini secara singkat..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors resize-none" />
                            </div>

                            {/* Tujuan & Manfaat */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Tujuan <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                    <textarea value={form.tujuan} onChange={e => setForm(p=>({...p,tujuan:e.target.value}))} rows={2}
                                        placeholder="Tujuan program infaq ini..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[12px] font-medium outline-none transition-colors resize-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Manfaat <span className="text-slate-400 normal-case font-normal">(opsional)</span></label>
                                    <textarea value={form.manfaat} onChange={e => setForm(p=>({...p,manfaat:e.target.value}))} rows={2}
                                        placeholder="Manfaat bagi warga..." className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[12px] font-medium outline-none transition-colors resize-none" />
                                </div>
                            </div>

                            {/* Dana target (opsional) */}
                            <div>
                                <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Target Dana <span className="text-slate-400 normal-case font-normal">(opsional, 0 = tanpa target)</span></label>
                                <input type="number" min="0" value={form.danaTarget || ''} onChange={e => setForm(p=>({...p,danaTarget:safeNumber(e.target.value)}))}
                                    placeholder="0" className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                            </div>

                            {/* Dana terkumpul (edit saja) */}
                            {editingId && (
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-2 uppercase tracking-widest">Dana Terkumpul Saat Ini</label>
                                    <input type="number" min="0" value={form.danaTerkumpul || ''} onChange={e => setForm(p=>({...p,danaTerkumpul:safeNumber(e.target.value)}))}
                                        className="w-full bg-slate-50 border border-slate-200 focus:border-google-green rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-colors" />
                                </div>
                            )}

                            {/* Rekening pembayaran */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest">Rekening Pembayaran *</label>
                                    <button type="button" onClick={addRek} className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-google-blue bg-google-blueLight border border-google-blue/30 px-3 py-1.5 rounded-full hover:bg-google-blue hover:text-white active:scale-95 transition-all">
                                        <Icon name="add" className="text-[13px]" />Tambah Rekening
                                    </button>
                                </div>
                                <div className="space-y-5">
                                    {form.rekening.map((r, i) => (
                                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 md:p-4 sm:p-6 space-y-5">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-medium text-google-textVariant uppercase tracking-wider">Rekening {i+1}</p>
                                                {form.rekening.length > 1 && (
                                                    <button type="button" onClick={() => removeRek(i)} className="text-google-red hover:bg-google-redLight w-7 h-7 flex items-center justify-center rounded-full border border-google-red/30 active:scale-95 transition-all">
                                                        <Icon name="close" className="text-[13px]" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <input type="text" value={r.bank} onChange={e => updateRek(i,'bank',e.target.value)}
                                                    placeholder="Nama Bank (BRI, BCA...)" className="bg-white border border-slate-200 focus:border-google-blue rounded-xl px-3 py-2.5 text-[12px] font-medium outline-none transition-colors" />
                                                <input type="text" value={r.norek} onChange={e => updateRek(i,'norek',e.target.value)}
                                                    placeholder="Nomor Rekening" className="bg-white border border-slate-200 focus:border-google-blue rounded-xl px-3 py-2.5 text-[12px] font-medium outline-none transition-colors" />
                                                <input type="text" value={r.atasNama} onChange={e => updateRek(i,'atasNama',e.target.value)}
                                                    placeholder="Atas Nama" className="bg-white border border-slate-200 focus:border-google-blue rounded-xl px-3 py-2.5 text-[12px] font-medium outline-none transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-xl text-[12px] font-medium flex flex-wrap items-center gap-2">
                                    <Icon name="error" className="text-[16px]" />{errorMsg}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3 mt-6">
                            <button onClick={() => { setView('list'); setErrorMsg(''); }} className="btn-native-secondary w-full sm:w-auto">Batal</button>
                            <button onClick={handleSaveProgram} disabled={isUploading} className="btn-native-primary flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20 border-emerald-500/30 disabled:opacity-50">
                                {editingId ? 'Simpan Perubahan' : 'Buat Program'}
                            </button>
                        </div>
                    </div>
                </div>
            );

            return null;
        }


export default Infaq;
