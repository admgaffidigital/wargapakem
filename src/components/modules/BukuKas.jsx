import React, { useState, useEffect, useRef } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, getLocalDate, parseLocalDate, uploadToGoogleDrive } from '../../utils/helpers.js';

        function BukuKas({ balance, setBalance, transactions, setTransactions, userRole, identity, jimpitanBalance, setJimpitanBalance }) {
            // Komponen BukuKas untuk pencatatan transaksi Kas RT Utama
            const [filterMonth, setFilterMonth] = useState('Semua');
            const [isModalOpen, setIsModalOpen] = useState(false);
            const [selectedImage, setSelectedImage] = useState(null);
            const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
            const [transferAmount, setTransferAmount] = useState('');
            const [formData, setFormData] = useState({ type: 'Pengeluaran', category: 'Pembelian Barang', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [editingId, setEditingId] = useState(null);

            const groupedTransactions = useMemo(() => {
                const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
                const groups = {};
                sorted.forEach(t => {
                    const dateObj = parseLocalDate(t.date);
                    const monthYear = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    if (!groups[monthYear]) groups[monthYear] = [];
                    groups[monthYear].push(t);
                });
                return groups;
            }, [transactions]);

            const availableMonths = Object.keys(groupedTransactions);
            const displayedTransactions = useMemo(() => {
                if (filterMonth === 'Semua') return transactions;
                return groupedTransactions[filterMonth] || [];
            }, [filterMonth, transactions, groupedTransactions]);

            // Upload Nota Kas RT: Canvas compress G base64 G Firestore (tanpa GAS)
            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 1200, 0.82);
                    setFormData(prev => ({ ...prev, receiptUrl: url }));
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleSave = () => {
                if (!formData.description) return setErrorMsg("Keterangan wajib diisi!");
                const nominal = safeNumber(formData.amount);
                if (nominal <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
                
                if (editingId) {
                    const oldTx = transactions.find(t => t.id === editingId);
                    let tempBalance = balance;
                    if (oldTx.type === 'Pemasukan') tempBalance -= oldTx.amount;
                    else tempBalance += oldTx.amount;
                    
                    if (formData.type === 'Pengeluaran' && nominal > tempBalance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(tempBalance)}`);
                    
                    if (formData.type === 'Pemasukan') tempBalance += nominal;
                    else tempBalance -= nominal;
                    
                    // Koreksi kas jimpitan jika ini transaksi Mutasi Jimpitan
                    if (oldTx.category === 'Mutasi Jimpitan') {
                        const diffJimpitan = oldTx.amount - nominal;
                        setJimpitanBalance(prev => prev + diffJimpitan);
                    }
                    
                    setBalance(tempBalance);
                    setTransactions(transactions.map(t => t.id === editingId ? { ...formData, amount: nominal } : t));
                    setEditingId(null);
                    showToast(`Transaksi berhasil diperbarui.`);
                } else {
                    if (formData.type === 'Pengeluaran' && nominal > balance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(balance)}`);
                    if (formData.type === 'Pemasukan') setBalance(prev => prev + nominal); else setBalance(prev => prev - nominal);
                    setTransactions([{ id: Date.now(), ...formData, amount: nominal }, ...transactions]);
                    showToast(`Transaksi ${formData.type.toLowerCase()} berhasil dicatat.`);
                }
                
                setIsModalOpen(false); setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
                setIsUploading(false);
            };

            const handleTransferJimpitan = () => {
                const nominal = safeNumber(transferAmount);
                if (nominal <= 0 || nominal > jimpitanBalance) return setErrorMsg(`Penarikan tidak valid! Maksimal ${formatRp(jimpitanBalance)}`);
                setJimpitanBalance(prev => prev - nominal); setBalance(prev => prev + nominal);
                setTransactions([{ id: Date.now(), type: 'Pemasukan', category: 'Mutasi Jimpitan', description: 'Pencairan Kas Jimpitan', amount: nominal, date: getLocalDate() }, ...transactions]);
                setIsTransferModalOpen(false); setTransferAmount('');
                showToast(`Berhasil mencairkan ${formatRp(nominal)} dari Kas Jimpitan.`);
            };

            return (
                <div className="space-y-8 print:p-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Buku Kas Utama</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Catatan riwayat transaksi operasional RT.</p></div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="bg-slate-50 border border-slate-200 text-google-text text-[13px] font-medium rounded-xl px-4 py-3.5 outline-none focus:border-google-blue w-full sm:w-auto cursor-pointer">
                                <option value="Semua">Semua Bulan</option>
                                {availableMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                            </select>
                            <button onClick={() => window.print()} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center gap-2 text-[13px] border border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 w-full sm:w-auto"><Icon name="print" className="text-[16px]" /> <span>Cetak Laporan</span></button>
                        </div>
                    </div>

                    <div className="hidden print-only">
                        <div className="kop-surat">
                            <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                            <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                            <div className="kop-surat-logo-right"></div>
                        </div>
                        <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Buku Kas Umum</h2><p className="text-[11pt]">{filterMonth !== 'Semua' ? `Periode: ${filterMonth}` : `Per Tanggal: ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}`}</p></div>
                        <table className="print-table">
                            <thead><tr><th width="5%">No</th><th width="15%">Tanggal</th><th width="40%">Uraian Transaksi</th><th width="20%">Pemasukan</th><th width="20%">Pengeluaran</th></tr></thead>
                            <tbody>
                                {displayedTransactions.length === 0 ? <tr><td colSpan="5" className="text-center font-medium">Nihil / Belum ada transaksi</td></tr> : displayedTransactions.map((t, idx) => (
                                    <tr key={t.id}><td className="text-center font-medium">{idx + 1}</td><td className="text-center font-medium">{parseLocalDate(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}</td><td className="font-medium">{t.description} {t.category ? `(${t.category})` : ''}</td><td className="text-right font-medium">{t.type === 'Pemasukan' ? formatRp(t.amount) : '-'}</td><td className="text-right font-medium">{t.type === 'Pengeluaran' ? formatRp(t.amount) : '-'}</td></tr>
                                ))}
                            </tbody>
                            <tfoot><tr><th colSpan="3" className="text-right">SALDO TOTAL KAS WARGA SAAT INI</th><th colSpan="2" className="text-center" style={{fontSize: '12pt'}}>{formatRp(balance)}</th></tr></tfoot>
                        </table>
                        <div className="ttd-container">
                            <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                            <div className="ttd-box"><p>Dibuat Oleh,</p><p>Bendahara / Admin</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                        </div>
                    </div>

                    <div className="bg-google-blue text-white p-8 sm:p-12 rounded-3xl border border-google-blueDark shadow-xl relative overflow-hidden no-print group cursor-default">
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-2xl mb-5 shadow-sm">
                                    <Icon name="account_balance_wallet" className="text-[16px]"/>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-50">Total Saldo Aktif</span>
                                </div>
                                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight drop-shadow-md">{formatRp(balance)}</h2>
                            </div>
                            <div className="hidden lg:flex items-center justify-center w-24 h-24 bg-white/10 rounded-full border border-white/20 shadow-inner">
                                <Icon name="savings" className="text-5xl text-white/90 drop-shadow-md" />
                            </div>
                        </div>
                    </div>

                    {userRole === 'admin' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 no-print">
                            <button onClick={() => { setEditingId(null); setFormData({ type: 'Pemasukan', category: 'Iuran Opsional', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); setIsModalOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-4 hover:border-google-green hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-google-green/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                                <div className="bg-google-greenLight text-google-greenDark w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:bg-google-green group-hover:text-white transition-colors duration-300 shadow-sm border border-google-green/30"><Icon name="add" className="text-[24px] group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" /></div>
                                <span className="text-[13px] font-medium text-google-text">Catat Pemasukan</span>
                            </button>
                            <button onClick={() => { setEditingId(null); setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); setIsModalOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-4 hover:border-google-red hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-google-red/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                                <div className="bg-google-redLight text-google-redDark w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:bg-google-red group-hover:text-white transition-colors duration-300 shadow-sm border border-google-red/30"><Icon name="remove" className="text-[24px] group-hover:scale-110 group-hover:-rotate-90 transition-all duration-300" /></div>
                                <span className="text-[13px] font-medium text-google-text">Catat Pengeluaran</span>
                            </button>
                            <button onClick={() => { setIsTransferModalOpen(true); setErrorMsg(''); }} className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl flex flex-row sm:flex-col items-center sm:justify-center gap-3 sm:gap-4 hover:border-google-yellow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-google-yellow/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                                <div className="bg-google-yellowLight text-google-yellowDark w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:bg-google-yellow group-hover:text-white transition-colors duration-300 shadow-sm border border-google-yellow/30"><Icon name="move_to_inbox" className="text-[24px] group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300" /></div>
                                <span className="text-[13px] font-medium text-google-text leading-tight">Cairkan Kas Jimpitan</span>
                            </button>
                        </div>
                    )}

                    <div className="space-y-8 no-print">
                        <h3 className="text-xl font-medium text-google-text mb-3 px-2 tracking-tight">Riwayat Transaksi Terkini</h3>
                        {Object.keys(groupedTransactions).map((monthYear) => (
                            <div key={monthYear} className="space-y-6">
                                <div className="flex items-center gap-3 mb-2 px-2 pt-2">
                                    <h4 className="text-[12px] font-medium text-slate-800 uppercase tracking-widest">{monthYear}</h4>
                                    <div className="h-px bg-slate-300 flex-1"></div>
                                </div>
                                {groupedTransactions[monthYear].map((t) => (
                                    <div key={t.id} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-google-blue/30 transition-all duration-300 gap-4 group">
                                        <div className="flex items-center gap-5 flex-1 overflow-hidden">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-colors duration-300 ${t.type === 'Pemasukan' ? 'bg-google-greenLight text-google-greenDark border-google-green/30 group-hover:bg-google-green group-hover:text-white' : 'bg-google-redLight text-google-redDark border-google-red/30 group-hover:bg-google-red group-hover:text-white'}`}><Icon name={t.type === 'Pemasukan' ? "arrow_downward" : "arrow_upward"} className="text-[24px]" fill="true" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-[14px] text-google-text truncate mb-1.5">{t.description}</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-[11px] font-medium text-google-textVariant bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md inline-flex items-center gap-1.5"><Icon name="label" className="text-[13px]" /> {t.category} &bull; {parseLocalDate(t.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p>
                                                    {t.receiptUrl && <button onClick={() => setSelectedImage(t.receiptUrl)} className="text-[11px] font-medium text-google-blue bg-google-blueLight border border-google-blue/30 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 hover:bg-google-blue hover:text-white transition-colors duration-300"><Icon name="receipt" className="text-[13px]" /> Lihat Bukti</button>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-200 pt-4 sm:pt-0 w-full sm:w-auto">
                                            <span className={`font-medium text-[17px] ${t.type === 'Pemasukan' ? 'text-google-greenDark' : 'text-google-redDark'} tracking-tight`}>{t.type === 'Pemasukan' ? '+' : '-'}{formatRp(t.amount)}</span>
                                            {userRole === 'admin' && t.category !== 'Saldo Awal' && (
                                                <div className="flex flex-wrap gap-2 mt-0 sm:mt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                    <button onClick={() => {
                                                        setEditingId(t.id);
                                                        setFormData(t);
                                                        setIsModalOpen(true);
                                                        setErrorMsg('');
                                                    }} className="text-google-blue bg-white hover:bg-google-blueLight border border-slate-200 hover:border-google-blue/40 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all duration-300 active:scale-95 flex flex-wrap items-center gap-1 uppercase tracking-widest"><Icon name="edit" className="text-[14px]" /><span className="hidden sm:inline">Edit</span></button>
                                                    <button onClick={() => { 
                                                        if (t.type === 'Pemasukan') setBalance(prev => prev - t.amount); 
                                                        else setBalance(prev => prev + t.amount);
                                                        if (t.category === 'Mutasi Jimpitan') setJimpitanBalance(prev => prev + t.amount);
                                                        setTransactions(transactions.filter(x => x.id !== t.id)); 
                                                    }} className="text-google-red bg-white hover:bg-google-redLight border border-slate-200 hover:border-google-red/40 rounded-full px-3 py-1.5 text-[10px] font-medium transition-all duration-300 active:scale-95 flex flex-wrap items-center gap-1 uppercase tracking-widest"><Icon name="delete" className="text-[14px]" /><span className="hidden sm:inline">Hapus</span></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                        {transactions.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="receipt_long" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2 tracking-tight">Belum Ada Transaksi</h3><p className="text-google-textVariant font-medium text-[13px]">Buku kas masih dalam keadaan kosong.</p></div>}
                    </div>

                    {isModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-sm text-left border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className={`mb-6 w-20 h-20 rounded-full flex items-center justify-center border ${formData.type === 'Pemasukan' ? 'bg-google-greenLight text-google-green border-google-green/30' : 'bg-google-redLight text-google-red border-google-red/30'}`}><Icon name={formData.type === 'Pemasukan' ? 'arrow_downward' : 'arrow_upward'} className="text-[36px]" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit' : 'Catat'} {formData.type}</h3>
                                <div className="space-y-7">
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal Transaksi</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} /></div>
                                    <div>
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md cursor-pointer ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`}>
                                            {formData.type === 'Pengeluaran' ? <><option>Belanja Barang/Alat</option><option>Honor Jasa</option><option>Konsumsi</option><option>Bantuan Sosial</option><option>Lain-lain</option></> : <><option>Iuran Opsional</option><option>Donasi</option><option>Pemasukan Jasa</option><option>Lain-lain</option></>}
                                        </select>
                                    </div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Keterangan / Uraian</label><input type="text" value={formData.description} onChange={e => {setFormData({...formData, description: e.target.value}); setErrorMsg('');}} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md placeholder:text-slate-400 ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} placeholder="Misal: Beli Sapu Lidi" /></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal (Rp)</label><input type="number" min="0" value={formData.amount} onChange={e => {setFormData({...formData, amount: safeNumber(e.target.value)}); setErrorMsg('');}} className={`w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md placeholder:text-slate-400 ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} placeholder="0" /></div>
                                    
                                    {formData.type === 'Pengeluaran' && (
                                        <div>
                                            <label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Upload Bukti / Nota (Opsional)</label>
                                            <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-red shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-red transition-all`}>
                                                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                                <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                    {isUploading ? <div className="w-5 h-5 border border-google-red border-t-transparent rounded-full animate-spin"></div> : <Icon name="receipt" className="text-[20px]" />}
                                                </div>
                                                <div className="relative z-0 flex-1 min-w-0">
                                                    <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.receiptUrl ? "Nota Siap" : "Pilih File Nota")}</p>
                                                    <p className="text-[10px] text-google-textVariant truncate">{formData.receiptUrl ? "Klik untuk mengganti nota" : "Maksimal 2MB"}</p>
                                                </div>
                                                {formData.receiptUrl && !isUploading && (
                                                    <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200 group">
                                                        <img src={formData.receiptUrl} alt="Nota Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-6 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button onClick={() => { setIsModalOpen(false); setErrorMsg(''); setIsUploading(false); setEditingId(null); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className={`flex-1 text-white px-6 py-3.5 rounded-full font-medium text-[13px] border shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 ${formData.type === 'Pemasukan' ? 'bg-google-green border-google-greenDark hover:bg-google-greenDark' : 'bg-google-red border-google-redDark hover:bg-google-redDark'}`}>Simpan Data</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isTransferModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-yellow/30"><Icon name="move_to_inbox" className="text-[48px] text-google-yellowDark" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Pencairan Jimpitan</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Tarik dana dari kas Jimpitan Fisik ke Kas Utama RT.</p>
                                
                                <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl mb-8 border border-slate-200 shadow-sm"><p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-2">Saldo Jimpitan Saat Ini</p><p className="text-[24px] font-medium text-google-text tracking-tight">{formatRp(jimpitanBalance)}</p></div>
                                
                                <div className="text-left mb-8"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal Disetor (Rp)</label><input type="number" min="0" value={transferAmount} onChange={e => {setTransferAmount(safeNumber(e.target.value)); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[16px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mb-8 flex flex-wrap items-center gap-2 text-left"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <button onClick={() => { setIsTransferModalOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleTransferJimpitan} className="flex flex-wrap bg-google-yellow text-white px-6 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-yellowDark border border-google-yellowDark active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Mutasi Dana</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* IMAGE VIEWER MODAL */}
                    {selectedImage && (
                        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 transition-opacity modal-backdrop animate-backdrop-in" onClick={() => setSelectedImage(null)}>
                            <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center animate-fadeIn modal-card animate-modal-in" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setSelectedImage(null)} className="absolute -top-12 right-0 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors border border-white/20"><Icon name="close" className="text-[24px]" /></button>
                                <img src={selectedImage} alt="Bukti Transaksi" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default BukuKas;
