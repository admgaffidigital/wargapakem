import React, { useState, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, getLocalDate, parseLocalDate } from '../../utils/helpers.js';

        function IuranUmum({ iuranData, setIuranData, members, userRole, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions, identity }) {
            const [view, setView] = useState('list');
            const [selectedAgenda, setSelectedAgenda] = useState(null);
            const [formData, setFormData] = useState({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 });
            const [tempPayments, setTempPayments] = useState({});
            const [transferAmount, setTransferAmount] = useState('');
            const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
            const [errorMsg, setErrorMsg] = useState('');
            // FIX: Tambah state untuk konfirmasi hapus agenda
            const [deleteConfirmAgendaId, setDeleteConfirmAgendaId] = useState(null);

            const activeMembers = useMemo(() => members.filter(m => m.status === 'Normal'), [members]);

            const handleSaveAgenda = () => {
                if (!formData.title || !formData.title.trim()) return setErrorMsg("Judul Agenda Wajib!");
                const safeMinAmount = safeNumber(formData.minAmount);
                if (safeMinAmount <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
                if (selectedAgenda) { setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate } : item)); showToast('Agenda iuran berhasil diperbarui.'); }
                else { setIuranData([{ id: Date.now(), title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate, payments: {}, transferredToKas: 0 }, ...iuranData]); showToast('Agenda iuran baru berhasil dibuat.'); }
                setView('list');
            };

            const handleSavePayments = () => {
                const cleanPayments = {};
                // FIX: Gunakan parseInt untuk memastikan key tersimpan sebagai angka konsisten
                for (let memberId in tempPayments) {
                    const numId = parseInt(memberId);
                    if (tempPayments[memberId] >= selectedAgenda.minAmount) cleanPayments[numId] = safeNumber(tempPayments[memberId]);
                }
                setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, payments: cleanPayments } : item));
                setView('list');
                showToast('Rekap pembayaran warga berhasil disimpan.');
            };

            const executeTransferToKas = () => {
                const nominal = safeNumber(transferAmount);
                const sisa = calculateTotal(selectedAgenda.payments || {}) - (selectedAgenda.transferredToKas || 0);
                if (nominal <= 0 || nominal > sisa) return setErrorMsg(`Nominal penarikan maksimal ${formatRp(sisa)}!`);
                setKasRtBalance(prev => prev + nominal);
                setKasRtTransactions(prev => [{ id: Date.now(), date: getLocalDate(), type: 'Pemasukan', category: 'Iuran Umum', description: `Mutasi Iuran: ${selectedAgenda.title}`, amount: nominal }, ...prev]);
                setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, transferredToKas: (selectedAgenda.transferredToKas || 0) + nominal } : item));
                setIsTransferModalOpen(false); setView('list');
                showToast(`Berhasil menyetor ${formatRp(nominal)} ke Kas Warga.`);
            };

            const calculateTotal = (obj) => { let total = 0; for(let k in obj) total += Number(obj[k] || 0); return total; };

            if (view === 'form') {
                return (
                    <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 max-w-2xl mx-auto shadow-xl">
                        <div className="flex flex-wrap items-center gap-5 mb-8 border-b border-slate-200 pb-6"><button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-12 h-12 bg-white text-google-text border border-slate-200 hover:bg-slate-50 hover:border-slate-400 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[17px] font-medium text-google-text" /></button><h2 className="text-[18px] sm:text-[20px] font-medium text-google-text leading-tight tracking-tight">{selectedAgenda ? 'Edit Agenda' : 'Buat Agenda Iuran'}</h2></div>
                        <div className="space-y-8">
                            <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nama / Keperluan Iuran</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Misal: Dana 17 Agustus" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Batas Akhir Waktu</label><input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text cursor-pointer" /></div>
                                <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tarif Minimal (Rp)</label><input type="number" min="0" value={formData.minAmount} onChange={e => {setFormData({...formData, minAmount: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                            </div>
                        </div>
                        {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-6 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                        <div className="flex justify-end mt-10 pt-6 border-t border-slate-200">
                            <button onClick={handleSaveAgenda} className="bg-google-blue text-white px-8 py-4 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2"><Icon name="save" className="text-[17px]"/> Simpan Agenda</button>
                        </div>
                    </div>
                );
            }

            if (view === 'manage') {
                const totalTerkumpul = calculateTotal(tempPayments);
                const lunasCount = activeMembers.filter(m => (tempPayments[m.id] || 0) >= selectedAgenda.minAmount).length;
                const transferred = selectedAgenda.transferredToKas || 0;
                const sisa = totalTerkumpul - transferred;

                return (
                    <div className="space-y-8 max-w-7xl mx-auto">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 no-print bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                            <div className="flex flex-wrap items-center gap-5"><button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-12 h-12 bg-white text-google-text border border-slate-200 hover:bg-slate-50 hover:border-slate-400 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[17px] font-medium text-google-text" /></button><div><h2 className="text-[18px] sm:text-[20px] font-medium text-google-text leading-tight tracking-tight">{selectedAgenda.title}</h2><p className="text-[13px] font-medium text-google-textVariant mt-1">Kelola Penyetoran Warga</p></div></div>
                            {userRole === 'admin' && <button onClick={() => window.print()} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="print" className="text-[16px]" /> <span className="hidden sm:inline">Cetak Laporan</span></button>}
                        </div>

                        <div className="hidden print-only">
                            <div className="kop-surat">
                                <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                                <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                                <div className="kop-surat-logo-right"></div>
                            </div>
                            <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Penerimaan Iuran Umum</h2><p className="text-[11pt]">Agenda: <strong>{selectedAgenda.title}</strong></p></div>
                            <div style={{marginBottom:'15px', fontSize:'11pt'}}><p>Target Minimal per Warga: <strong>{formatRp(selectedAgenda.minAmount)}</strong></p><p>Total Terkumpul: <strong>{formatRp(totalTerkumpul)}</strong></p></div>
                            <table className="print-table">
                                <thead><tr><th width="5%">No</th><th width="35%">Nama Warga</th><th width="20%">Status</th><th width="20%">Nominal Bayar</th><th width="20%">TTD</th></tr></thead>
                                <tbody>
                                    {activeMembers.map((m, idx) => {
                                        const amt = tempPayments[m.id] || 0;
                                        return <tr key={m.id}><td className="text-center font-medium">{idx + 1}</td><td className="font-medium">{m.name}</td><td className="text-center font-medium">{amt >= selectedAgenda.minAmount ? 'LUNAS' : '-'}</td><td className="text-right font-medium">{amt > 0 ? formatRp(amt) : ''}</td><td></td></tr>
                                    })}
                                </tbody>
                            </table>
                            <div className="ttd-container">
                                <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                                <div className="ttd-box"><p>Penerima / Bendahara,</p><br/><div className="ttd-space" style={{height:'60px'}}></div><p className="ttd-name">( ................................... )</p></div>
                            </div>
                        </div>

                        <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-200 shadow-sm no-print">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
                                <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl border border-slate-200 text-center shadow-sm"><p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-2">Target / Warga</p><p className="text-[20px] font-medium text-google-text tracking-tight">{formatRp(selectedAgenda.minAmount)}</p></div>
                                <div className="bg-google-greenLight p-6 sm:p-8 md:p-6 rounded-3xl border border-google-green/30 text-center shadow-sm"><p className="text-[10px] font-medium text-google-greenDark uppercase tracking-widest mb-2">Dana Terkumpul</p><p className="text-[20px] font-medium text-google-greenDark tracking-tight">{formatRp(totalTerkumpul)}</p></div>
                                <div className="bg-google-blueLight p-6 sm:p-8 md:p-6 rounded-3xl border border-google-blue/30 text-center flex flex-col items-center relative shadow-sm hover:shadow-md transition-shadow group"><p className="text-[10px] font-medium text-google-blueDark uppercase tracking-widest mb-2">Sisa (Belum Disetor)</p><p className="text-[20px] font-medium text-google-blueDark group-hover:scale-105 transition-transform tracking-tight">{formatRp(sisa)}</p>
                                    {userRole === 'admin' && sisa > 0 && <button onClick={() => { 
                                            const savedTotal = calculateTotal(selectedAgenda.payments || {});
                                            const currentTotal = calculateTotal(tempPayments);
                                            if (savedTotal !== currentTotal) { setErrorMsg('Simpan Rekap Warga dulu sebelum menyetor dana!'); return; }
                                            setIsTransferModalOpen(true); setErrorMsg(''); 
                                        }} className="absolute -bottom-5 bg-google-blue text-white text-[12px] font-medium px-6 py-2.5 rounded-full border border-google-blueDark shadow-lg hover:bg-google-blueDark hover:-translate-y-1 active:scale-95 transition-all flex flex-wrap items-center gap-1.5"><Icon name="sync_alt" className="text-[14px]" /> Setor ke Kas Utama</button>}
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 border border-slate-200 p-6 sm:p-8 md:p-6 rounded-3xl mb-10 shadow-sm">
                                <div className="flex justify-between items-end mb-4"><span className="text-[13px] font-medium text-google-textVariant">Progres Pelunasan Warga</span><span className="text-[17px] font-medium text-google-blueDark leading-none">{lunasCount} <span className="text-[13px] text-google-textVariant">/ {activeMembers.length}</span></span></div>
                                <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-google-blue h-full rounded-full transition-all duration-1000" style={{ width: `${activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100}%` }}></div></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {activeMembers.map(member => {
                                    const amountPaid = tempPayments[member.id] || 0;
                                    const isLunas = amountPaid >= selectedAgenda.minAmount;
                                    const isError = amountPaid > 0 && amountPaid < selectedAgenda.minAmount;
                                    return (
                                        <div key={member.id} className={`p-6 rounded-3xl border flex flex-col justify-between transition-all duration-300 group ${userRole === 'admin' ? (isError ? 'bg-google-redLight border-google-red hover:shadow-lg' : 'bg-white border-slate-200 hover:border-google-blue hover:shadow-xl hover:-translate-y-1') : (isLunas ? 'bg-google-greenLight border-google-green shadow-sm' : 'bg-slate-50 border-slate-200')}`}>
                                            <div className="flex justify-between items-start mb-6">
                                                <h3 className="font-medium text-[14px] text-google-text truncate pr-3 group-hover:text-google-blue transition-colors leading-tight">{member.name}</h3>
                                                {isLunas ? <span className="text-[9px] bg-google-green text-white px-3 py-1.5 rounded-md font-medium uppercase tracking-widest shadow-sm flex flex-wrap items-center gap-1 shrink-0 border border-google-greenDark"><Icon name="check" className="text-[11px]"/> LUNAS</span> : <span className="text-[9px] bg-slate-200 text-google-textVariant px-3 py-1.5 rounded-md font-medium uppercase tracking-widest shrink-0 border border-slate-400">BELUM</span>}
                                            </div>
                                            {userRole === 'admin' ? (
                                                <div>
                                                    <div className={`flex items-center bg-slate-50 rounded-2xl px-4 py-3 border transition-colors duration-300 ${isError ? 'border-google-red' : 'border-slate-200 focus-within:border-google-blue focus-within:bg-white focus-within:shadow-md'}`}>
                                                        <span className="text-[13px] font-medium text-google-textVariant mr-2">Rp</span>
                                                        <input type="number" min="0" value={tempPayments[member.id] || ''} onChange={(e) => { setTempPayments(prev => ({...prev, [member.id]: safeNumber(e.target.value)})); setErrorMsg(''); }} className="w-full bg-transparent border-none text-[14px] font-medium outline-none p-0 text-google-text placeholder:text-slate-300" placeholder="0" />
                                                    </div>
                                                    {isError && <p className="text-[10px] font-medium text-google-redDark mt-2.5 ml-1 flex flex-wrap items-center gap-1.5"><Icon name="info" className="text-[13px]" /> Kurang dari {formatRp(selectedAgenda.minAmount)}</p>}
                                                </div>
                                            ) : (
                                                <div className="text-[12px] font-medium mt-2 bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-2.5 shadow-sm">
                                                    {isLunas ? <><Icon name="task_alt" className="text-[17px] text-google-greenDark" /><span className="text-google-greenDark">Memenuhi Syarat</span></> : <><Icon name="pending" className="text-[17px] text-google-textVariant" /><span className="text-google-textVariant">Menunggu Penyetoran</span></>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {userRole === 'admin' && (
                                <div className="mt-10 pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-5">
                                    {errorMsg ? <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-5 py-4 rounded-2xl w-full sm:w-auto flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div> : <div></div>}
                                    <button onClick={handleSavePayments} className="w-full sm:w-auto bg-google-blue text-white px-10 py-4 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="save" className="text-[17px]" /> Simpan Rekap Warga</button>
                                </div>
                            )}
                        </div>

                        {isTransferModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                                <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                    <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-yellow/30"><Icon name="move_to_inbox" className="text-[48px] text-google-yellowDark" fill="true" /></div>
                                    <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Setor ke Kas Warga</h3>
                                    <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Mutasi dana fisik dari Iuran ke Saldo Buku Kas Utama.</p>
                                    
                                    <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl mb-8 border border-slate-200 shadow-sm"><p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-2">Batas Maksimal Tarik</p><p className="text-[24px] font-medium text-google-text tracking-tight">{formatRp(sisa)}</p></div>
                                    
                                    <div className="text-left mb-8"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal Disetor (Rp)</label><input type="number" min="0" value={transferAmount} onChange={e => {setTransferAmount(safeNumber(e.target.value)); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[16px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                    
                                    {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mb-8 flex flex-wrap items-center gap-2 text-left"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                    
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => { setIsTransferModalOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                        <button onClick={executeTransferToKas} className="flex flex-wrap bg-google-yellow text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-yellowDark shadow-md hover:bg-google-yellowDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Setor Dana</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div className="space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Agenda Iuran Umum</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Penggalangan dana non-arisan (berlaku untuk semua warga).</p></div>
                        {userRole === 'admin' && <button onClick={() => { setFormData({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 }); setSelectedAgenda(null); setView('form'); setErrorMsg(''); }} className="shrink-0 bg-google-blue text-white px-8 py-3.5 rounded-full font-medium flex flex-wrap items-center gap-2 text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto justify-center"><Icon name="add_task" className="text-[17px]" /><span>Buat Agenda Baru</span></button>}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                        {iuranData.map(agenda => {
                            const payments = agenda.payments || {};
                            const totalTerkumpul = calculateTotal(payments);
                            const lunasCount = activeMembers.filter(m => payments[m.id] >= agenda.minAmount).length;
                            const progressPercent = activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100;

                            return (
                                <div key={agenda.id} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1.5 hover:border-google-blue/40 transition-all duration-300 group">
                                    <div>
                                        <h3 className="text-[20px] font-medium text-google-text leading-snug mb-6 group-hover:text-google-blue transition-colors tracking-tight">{agenda.title}</h3>
                                        <div className="flex flex-col sm:flex-row gap-4 mb-8">
                                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-6 sm:p-8 md:p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="w-12 h-12 rounded-full bg-google-blueLight flex items-center justify-center text-google-blue border border-google-blue/30"><Icon name="event" className="text-[20px]" fill="true"/></div><div><p className="text-[9px] font-medium text-google-textVariant uppercase tracking-widest mb-1">Batas Akhir</p><p className="text-[13px] font-medium text-google-text">{parseLocalDate(agenda.dueDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p></div></div>
                                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-6 sm:p-8 md:p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="w-12 h-12 rounded-full bg-google-greenLight flex items-center justify-center text-google-green border border-google-green/30"><Icon name="payments" className="text-[20px]" fill="true"/></div><div><p className="text-[9px] font-medium text-google-textVariant uppercase tracking-widest mb-1">Target Minimal</p><p className="text-[13px] font-medium text-google-text">{formatRp(agenda.minAmount)}</p></div></div>
                                        </div>
                                        <div className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl border border-slate-200 mb-8 shadow-sm">
                                            <div className="flex justify-between items-end mb-4"><span className="text-[12px] font-medium text-google-textVariant">Progres Warga Lunas</span><span className="text-[16px] font-medium text-google-blueDark leading-none">{lunasCount} <span className="text-[12px] text-google-textVariant">/ {activeMembers.length}</span></span></div>
                                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-google-blue h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pt-6 border-t border-slate-200">
                                        <div className="bg-google-greenLight/50 px-5 py-3.5 rounded-2xl border border-google-green/30"><p className="text-[9px] text-google-greenDark uppercase tracking-widest font-medium mb-1">Total Dana Terkumpul</p><p className="text-[18px] font-medium text-google-greenDark tracking-tight truncate">{userRole === 'admin' ? formatRp(totalTerkumpul) : '= Disembunyikan'}</p></div>
                                        {userRole === 'admin' ? (
                                            <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-auto">
                                                <button onClick={() => { setSelectedAgenda(agenda); setTempPayments(agenda.payments || {}); setView('manage'); }} className="px-6 py-3.5 bg-google-blueLight text-google-blueDark border border-google-blue/30 rounded-full text-[13px] font-medium hover:bg-google-blue hover:text-white transition-all duration-300 hover:shadow-md active:scale-95 flex flex-wrap items-center gap-1.5"><Icon name="edit_document" className="text-[16px]"/> Kelola</button>
                                                <button onClick={() => { setFormData({ title: agenda.title, minAmount: agenda.minAmount, dueDate: agenda.dueDate, payments: agenda.payments || {}, transferredToKas: agenda.transferredToKas || 0 }); setSelectedAgenda(agenda); setView('form'); setErrorMsg(''); }} className="w-12 h-12 flex items-center justify-center bg-white text-google-text hover:bg-slate-50 hover:border-slate-400 rounded-full border border-slate-200 active:scale-95 transition-all duration-300 shadow-sm"><Icon name="settings" className="text-[17px]" /></button>
                                                <button onClick={() => setDeleteConfirmAgendaId(agenda.id)} className="w-12 h-12 flex items-center justify-center bg-white text-google-red hover:bg-google-redLight hover:border-google-red/40 rounded-full border border-slate-200 active:scale-95 transition-all duration-300 shadow-sm"><Icon name="delete" className="text-[17px]" /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setSelectedAgenda(agenda); setTempPayments(agenda.payments || {}); setView('manage'); }} className="px-8 py-3.5 bg-white border border-slate-200 text-google-text rounded-full text-[13px] font-medium hover:bg-slate-50 hover:border-slate-400 shadow-sm shrink-0 active:scale-95 transition-all duration-300 self-end sm:self-auto flex flex-wrap items-center gap-2"><Icon name="visibility" className="text-[16px]"/> Cek Status Saya</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {iuranData.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="volunteer_activism" className="text-[48px] text-google-red" fill="true" /></div><h3 className="text-google-text font-medium text-[18px] mb-2 tracking-tight">Belum Ada Agenda Iuran</h3><p className="text-google-textVariant font-medium text-[13px]">Daftar donasi atau tagihan umum akan tampil di sini.</p></div>}

                    {/* FIX: Modal konfirmasi hapus agenda */}
                    {deleteConfirmAgendaId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Agenda?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Agenda iuran beserta seluruh data pembayaran warga akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmAgendaId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { setIuranData(iuranData.filter(i => i.id !== deleteConfirmAgendaId)); setDeleteConfirmAgendaId(null); showToast('Agenda iuran berhasil dihapus.'); }} className="flex-1 bg-google-red text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default IuranUmum;
