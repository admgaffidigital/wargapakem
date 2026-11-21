import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, getLocalDate, parseLocalDate, uploadToGoogleDrive, triggerHaptic } from '../../utils/helpers.js';

function Infaq({ infaqData, setInfaqData, userRole, identity }) {
    const [view, setView] = useState('list'); // 'list' | 'detail' | 'form'
    const [selected, setSelected] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const emptyForm = {
        judul: '', deskripsi: '', tujuan: '', manfaat: '', imageUrl: '',
        danaTarget: 0, danaTerkumpul: 0,
        rekening: [{ bank: '', norek: '', atasNama: '' }],
    };
    const [form, setForm] = useState(emptyForm);

    const [nominalInput, setNominalInput] = useState('');
    const [namaInfaq, setNamaInfaq] = useState('');
    const [tipeNama, setTipeNama] = useState('nama'); // 'nama' | 'tanpanama' | 'hambaalah'
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedRek, setSelectedRek] = useState(0);

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

    const [buktiUrl, setBuktiUrl] = useState('');
    const [isUploadingBukti, setIsUploadingBukti] = useState(false);

    const NOMINAL_CEPAT = [10000, 25000, 50000, 100000, 250000, 500000];

    const handleBuktiUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return showToast('Ukuran foto maks 2MB!', 'error');
        setIsUploadingBukti(true);
        try {
            const url = await uploadToGoogleDrive(file, 800, 0.8);
            setBuktiUrl(url);
        } catch (error) {
            showToast(error, 'error');
        } finally {
            setIsUploadingBukti(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return setErrorMsg('Ukuran foto maks 2MB!');
        setIsUploading(true);
        try {
            const url = await uploadToGoogleDrive(file, 800, 0.8);
            setForm(p => ({ ...p, imageUrl: url }));
        } catch (error) {
            setErrorMsg(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveProgram = () => {
        triggerHaptic();
        if (!form.judul.trim()) return setErrorMsg('Judul program wajib diisi!');
        if (!form.deskripsi.trim()) return setErrorMsg('Deskripsi wajib diisi!');
        if (form.rekening.some(r => !r.bank.trim() || !r.norek.trim() || !r.atasNama.trim()))
            return setErrorMsg('Lengkapi seluruh rincian rekening pembayaran!');

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

    const pct = (item) => item.danaTarget > 0
        ? Math.min(100, Math.round((item.danaTerkumpul / item.danaTarget) * 100))
        : null;

    const namaDisplay = tipeNama === 'tanpanama' ? 'Tanpa Nama'
        : tipeNama === 'hambaalah' ? 'Hamba Allah'
        : namaInfaq.trim() || 'Anonim';

    if (view === 'list') {
        return (
            <div className="space-y-6">
                {/* BENTO HEADER CARD */}
                <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center shrink-0 shadow-xs">
                            <Icon name="volunteer_activism" className="text-[26px]" fill="true" />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Kotak Infaq &amp; Sedekah</h2>
                            <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                Salurkan infaq untuk program kebaikan bersama warga {identity?.name || 'RT'}.
                            </p>
                        </div>
                    </div>
                    {userRole === 'admin' && (
                        <button
                            onClick={() => { triggerHaptic(); setForm(emptyForm); setEditingId(null); setErrorMsg(''); setView('form'); }}
                            className="btn-native-primary shrink-0 w-full sm:w-auto"
                        >
                            <Icon name="add" className="text-[18px]" />
                            <span>Buat Program Infaq</span>
                        </button>
                    )}
                </div>

                {/* GRID PROGRAM */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {infaqData.map(item => {
                        const p = pct(item);
                        return (
                            <div
                                key={item.id}
                                onClick={() => {
                                    triggerHaptic();
                                    setSelected(item);
                                    setView('detail');
                                    setNominalInput('');
                                    setNamaInfaq('');
                                    setTipeNama('nama');
                                    setSelectedRek(0);
                                }}
                                className="bento-island-card !p-0 overflow-hidden hover:border-emerald-500/30 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
                            >
                                <div className="w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 aspect-[16/9] border-b border-slate-100 dark:border-slate-800">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.judul} />
                                    ) : (
                                        <div className="flex items-center justify-center p-8">
                                            <Icon name="volunteer_activism" className="text-[48px] text-slate-300 dark:text-slate-600" fill="true" />
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                                    <div>
                                        <h3 className="text-base font-black text-slate-800 dark:text-white leading-snug tracking-tight">
                                            {item.judul}
                                        </h3>
                                        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                                            {item.deskripsi}
                                        </p>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                                            <span>Dana Terkumpul</span>
                                            {p !== null && <span className="font-bold text-emerald-600 dark:text-emerald-400">{p}%</span>}
                                        </div>
                                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                                            {formatRp(item.danaTerkumpul || 0)}
                                        </p>
                                        {item.danaTarget > 0 && (
                                            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                                                <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${p}%` }} />
                                            </div>
                                        )}
                                        {item.danaTarget > 0 && (
                                            <p className="text-[10px] font-medium text-slate-400 mt-1">Target: {formatRp(item.danaTarget)}</p>
                                        )}
                                    </div>

                                    {userRole === 'admin' && (
                                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 mt-1" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => { setForm({ ...item }); setEditingId(item.id); setErrorMsg(''); setView('form'); }}
                                                className="btn-native-action flex-1 py-1.5 text-[11.5px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700"
                                            >
                                                <Icon name="edit" className="text-[14px]" /> Edit
                                            </button>
                                            <button
                                                onClick={() => { triggerHaptic(); setDeleteConfirmId(item.id); }}
                                                className="btn-native-action w-9 h-9 rounded-xl bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20"
                                            >
                                                <Icon name="delete" className="text-[14px]" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {infaqData.length === 0 && (
                    <div className="bento-island-card p-12 text-center">
                        <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-2xl mb-4 mx-auto border border-slate-200 dark:border-slate-700 text-slate-400">
                            <Icon name="volunteer_activism" className="text-[40px]" fill="true" />
                        </div>
                        <p className="text-slate-800 dark:text-white font-bold text-[16px] tracking-tight">Belum Ada Program Infaq</p>
                        <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mt-1">
                            {userRole === 'admin' ? 'Klik "Buat Program Infaq" untuk menambahkan agenda penggalangan dana.' : 'Daftar program kebaikan warga akan muncul di sini.'}
                        </p>
                    </div>
                )}

                {/* MODAL HAPUS (Native Bottom Sheet) */}
                {deleteConfirmId && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                        <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-7 w-full max-w-sm text-center border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                            {/* Mobile Pull Bar */}
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                            <div className="mb-4 bg-red-50 dark:bg-red-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-red-500/25 text-red-600">
                                <Icon name="delete" className="text-[34px]" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Hapus Program Infaq?</h3>
                            <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                Program beserta seluruh data rekening donasi akan dihapus permanen.
                            </p>
                            <div className="flex gap-2.5">
                                <button
                                    onClick={() => { triggerHaptic(); setDeleteConfirmId(null); }}
                                    className="btn-native-secondary flex-1"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => {
                                        triggerHaptic();
                                        setInfaqData(infaqData.filter(i => i.id !== deleteConfirmId));
                                        setDeleteConfirmId(null);
                                        showToast('Program infaq berhasil dihapus.');
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

    if (view === 'detail' && selected) {
        const prog = infaqData.find(i => i.id === selected.id) || selected;
        const p = pct(prog);

        return (
            <div className="space-y-6 max-w-3xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => { triggerHaptic(); setView('list'); }}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-bold text-[13px] active:scale-95 transition-all"
                >
                    <Icon name="arrow_back" className="text-[18px]" />
                    <span>Kembali ke Daftar Program</span>
                </button>

                {prog.imageUrl && (
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 aspect-[16/9]">
                        <img src={prog.imageUrl} className="w-full h-full object-cover" alt={prog.judul} />
                    </div>
                )}

                <div className="bento-island-card space-y-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">{prog.judul}</h2>
                        <p className="text-slate-600 dark:text-slate-300 text-[13px] leading-relaxed mt-2 whitespace-pre-line">{prog.deskripsi}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/25">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Dana Terkumpul</p>
                                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 tracking-tight">{formatRp(prog.danaTerkumpul || 0)}</p>
                            </div>
                            {p !== null && (
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target</p>
                                    <p className="text-[13px] font-bold text-slate-800 dark:text-white">{formatRp(prog.danaTarget)}</p>
                                </div>
                            )}
                        </div>
                        {prog.danaTarget > 0 && (
                            <>
                                <div className="w-full h-2.5 bg-emerald-200/60 dark:bg-emerald-900/60 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-600 rounded-full transition-all duration-700" style={{ width: `${p}%` }} />
                                </div>
                                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-1.5">{p}% dari target donasi tercapai</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Form Infaq Warga */}
                <div className="bento-island-card space-y-5">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <Icon name="volunteer_activism" className="text-[20px] text-emerald-600 dark:text-emerald-400" fill="true" />
                        <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Tunaikan Infaq Sekarang</h3>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Pilih Nominal Cepat</p>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            {NOMINAL_CEPAT.map(n => (
                                <button
                                    key={n}
                                    onClick={() => { triggerHaptic(); setNominalInput(String(n)); }}
                                    className={`py-2 px-1 rounded-xl font-bold text-[11.5px] border transition-all active:scale-95 ${
                                        nominalInput === String(n)
                                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-700 hover:border-emerald-500/40'
                                    }`}
                                >
                                    {formatRp(n)}
                                </button>
                            ))}
                        </div>
                        <input
                            type="number"
                            min="1000"
                            value={nominalInput}
                            onChange={e => setNominalInput(e.target.value)}
                            placeholder="Atau masukkan nominal lain (Rp)..."
                            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-bold outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Atas Nama</p>
                        <div className="flex gap-2 flex-wrap mb-2.5">
                            {[['nama', 'Nama Saya'], ['tanpanama', 'Tanpa Nama'], ['hambaalah', 'Hamba Allah']].map(([val, label]) => (
                                <button
                                    key={val}
                                    onClick={() => { triggerHaptic(); setTipeNama(val); }}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-[11.5px] border transition-all active:scale-95 ${
                                        tipeNama === val
                                            ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {tipeNama === 'nama' && (
                            <input
                                type="text"
                                value={namaInfaq}
                                onChange={e => setNamaInfaq(e.target.value)}
                                placeholder="Ketik nama Anda..."
                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                            />
                        )}
                    </div>

                    {nominalInput && safeNumber(nominalInput) >= 1000 && (
                        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-500/25 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Atas Nama: <span className="font-bold text-slate-800 dark:text-white">{namaDisplay}</span></p>
                                <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">{formatRp(safeNumber(nominalInput))}</p>
                            </div>
                            <button
                                onClick={() => { triggerHaptic(); setShowPayModal(true); }}
                                className="btn-native-primary !bg-emerald-600 hover:!bg-emerald-700 w-full sm:w-auto"
                            >
                                <Icon name="payments" className="text-[18px]" />
                                <span>Bayar Sekarang</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* MODAL PEMBAYARAN & UPLOAD BUKTI (Native Bottom Sheet) */}
                {showPayModal && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print modal-backdrop animate-backdrop-in">
                        <div className="max-h-[90vh] overflow-y-auto hide-scrollbar rounded-t-[32px] sm:rounded-[28px] p-6 sm:p-8 w-full max-w-md border-t sm:border border-slate-200/80 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                            {/* Mobile Pull Bar */}
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden"></div>

                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                                <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">Rincian Pembayaran Infaq</h3>
                                <button
                                    onClick={() => setShowPayModal(false)}
                                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center active:scale-95"
                                >
                                    <Icon name="close" className="text-[16px]" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/25">
                                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Nominal Infaq</p>
                                    <p className="text-xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight">{formatRp(safeNumber(nominalInput))}</p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Atas Nama: {namaDisplay}</p>
                                </div>

                                {/* Detail Rekening */}
                                {(prog.rekening || []).length > 0 && (() => {
                                    const r = prog.rekening[selectedRek] || prog.rekening[0];
                                    return (
                                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-750 space-y-2 text-left">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rekening Tujuan</p>
                                            <p className="font-black text-base text-slate-800 dark:text-white">{r.bank}</p>
                                            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                                                <div>
                                                    <p className="text-[10px] text-slate-400">Nomor Rekening</p>
                                                    <p className="font-mono font-bold text-[14px] text-slate-800 dark:text-white">{r.norek}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        triggerHaptic();
                                                        navigator.clipboard?.writeText(r.norek);
                                                        showToast('Nomor rekening disalin!');
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200"
                                                >
                                                    Salin
                                                </button>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-500">a.n. <strong className="text-slate-800 dark:text-white">{r.atasNama}</strong></p>
                                        </div>
                                    );
                                })()}

                                {/* Upload Bukti */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                        Upload Bukti Transfer
                                    </label>
                                    <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative bg-white dark:bg-slate-850">
                                        <input type="file" accept="image/*" onChange={handleBuktiUpload} disabled={isUploadingBukti} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                        {isUploadingBukti ? (
                                            <div className="flex flex-col items-center justify-center py-2 text-slate-500">
                                                <Icon name="sync" className="animate-spin text-[26px] mb-1 text-emerald-500" />
                                                <span className="text-[12px] font-semibold">Memproses foto...</span>
                                            </div>
                                        ) : buktiUrl ? (
                                            <div className="relative inline-block">
                                                <img src={buktiUrl} alt="Bukti Transfer" className="h-28 object-contain rounded-lg shadow-xs" />
                                                <span className="block mt-1 text-[10px] font-semibold text-emerald-600">Ketuk untuk mengganti</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-2 text-slate-400">
                                                <Icon name="add_a_photo" className="text-[28px] mb-1" />
                                                <span className="text-[12px] font-semibold">Ketuk untuk unggah bukti transfer</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => { setShowPayModal(false); setBuktiUrl(''); }}
                                    className="btn-native-secondary flex-1"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={() => {
                                        triggerHaptic();
                                        if (!buktiUrl) return showToast('Unggah bukti transfer terlebih dahulu!', 'error');
                                        const newDonasi = {
                                            id: Date.now(),
                                            nama: namaDisplay,
                                            nominal: safeNumber(nominalInput),
                                            imageUrl: buktiUrl,
                                            status: 'PENDING',
                                            tanggal: getLocalDate(),
                                        };
                                        const updatedProg = {
                                            ...prog,
                                            donasi: [newDonasi, ...(prog.donasi || [])],
                                        };
                                        setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                        setSelected(updatedProg);
                                        setShowPayModal(false);
                                        setBuktiUrl('');
                                        showToast('Terima kasih! Bukti transfer telah terkirim.');
                                    }}
                                    className="btn-native-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700"
                                >
                                    Kirim Bukti
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (view === 'form') {
        return (
            <div className="bento-island-card max-w-2xl mx-auto p-5 sm:p-7 animate-modal-in">
                <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => { triggerHaptic(); setView('list'); setErrorMsg(''); }}
                        className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-all shadow-xs"
                    >
                        <Icon name="arrow_back" className="text-[18px]" />
                    </button>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            {editingId ? 'Edit Program Infaq' : 'Buat Program Infaq Baru'}
                        </h2>
                        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                            Rincian agenda amal, target dana, dan rekening penerima.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                            Judul Program Infaq *
                        </label>
                        <input
                            type="text"
                            value={form.judul}
                            onChange={e => setForm(p => ({ ...p, judul: e.target.value }))}
                            placeholder="Misal: Infaq Renovasi Pos Kamling RT..."
                            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                            Deskripsi Program *
                        </label>
                        <textarea
                            value={form.deskripsi}
                            onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))}
                            rows={3}
                            placeholder="Jelaskan tujuan dan peruntukan dana infaq ini..."
                            className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white resize-none placeholder:text-slate-400"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                Target Dana (Rp) <span className="text-slate-400 font-normal lowercase">(0 = tanpa target)</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={form.danaTarget || ''}
                                onChange={e => setForm(p => ({ ...p, danaTarget: safeNumber(e.target.value) }))}
                                placeholder="0"
                                className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                            />
                        </div>
                        {editingId && (
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Dana Terkumpul Saat Ini (Rp)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.danaTerkumpul || ''}
                                    onChange={e => setForm(p => ({ ...p, danaTerkumpul: safeNumber(e.target.value) }))}
                                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 rounded-xl px-4 py-2.5 text-[15px] sm:text-[13.5px] font-medium outline-none transition-all text-slate-800 dark:text-white"
                                />
                            </div>
                        )}
                    </div>

                    {/* Rekening Pembayaran */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                Rekening Pembayaran *
                            </label>
                            <button
                                type="button"
                                onClick={addRek}
                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                            >
                                <Icon name="add" className="text-[14px]" />
                                <span>Tambah Rekening</span>
                            </button>
                        </div>
                        <div className="space-y-3">
                            {form.rekening.map((r, i) => (
                                <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-700 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase">Rekening #{i + 1}</span>
                                        {form.rekening.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRek(i)}
                                                className="w-6 h-6 rounded-md bg-red-50 text-red-600 flex items-center justify-center text-[12px]"
                                            >
                                                <Icon name="close" className="text-[13px]" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            value={r.bank}
                                            onChange={e => updateRek(i, 'bank', e.target.value)}
                                            placeholder="Bank (BCA, BRI...)"
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[12px] font-medium outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={r.norek}
                                            onChange={e => updateRek(i, 'norek', e.target.value)}
                                            placeholder="Nomor Rekening"
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[12px] font-medium outline-none font-mono"
                                        />
                                        <input
                                            type="text"
                                            value={r.atasNama}
                                            onChange={e => updateRek(i, 'atasNama', e.target.value)}
                                            placeholder="Atas Nama"
                                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[12px] font-medium outline-none"
                                        />
                                    </div>
                                </div>
                            ))}
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
                        onClick={() => { triggerHaptic(); setView('list'); setErrorMsg(''); }}
                        className="btn-native-secondary flex-1"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveProgram}
                        disabled={isUploading}
                        className="btn-native-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-50"
                    >
                        {editingId ? 'Simpan Perubahan' : 'Buat Program'}
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

export default Infaq;
