import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, formatBulanTahun, isNonaktif } from '../../utils/helpers.js';

        function WargaList({ members, setMembers, userRole, identity, cycleNumber, currentRound, arisanPeriod }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [formData, setFormData] = useState({ name: '', status: 'Normal', program: 'Arisan', debt: 0, hasWon: false, wonRound: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [printMode, setPrintMode] = useState('');
            const [searchQuery, setSearchQuery] = useState('');
            const [previewMember, setPreviewMember] = useState(null);

            useEffect(() => {
                if (previewMember) {
                    import('jsbarcode').then((module) => {
                        const JsBarcode = module.default;
                    JsBarcode("#preview-barcode", `M-${previewMember.id}`, { width: 2, height: 60, fontSize: 16 });
                    });
                }
            }, [previewMember]);

            const handleDownloadBarcode = () => {
                const canvas = document.getElementById("preview-barcode");
                if (!canvas) return;
                const url = canvas.toDataURL("image/png");
                const link = document.createElement("a");
                link.href = url;
                link.download = `Barcode_${previewMember.name.replace(/\s+/g, '_')}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
            
            const handlePrintBarcode = () => {
                setPrintMode('barcode');
                setTimeout(() => {
                    
                    import('jsbarcode').then((module) => {
                        const JsBarcode = module.default;
                        JsBarcode(".barcode-element").init();
                    });
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => setPrintMode(''), 1000);
                    }, 200);
                }, 200);
            };
            
            const handleSave = () => {
                const trimmedName = formData.name ? formData.name.trim() : '';
                if (!trimmedName) return setErrorMsg("Nama wajib diisi!");
                // Validasi duplikat nama (kecuali saat edit dirinya sendiri)
                const isDuplicate = members.some(m => m.name.trim().toLowerCase() === trimmedName.toLowerCase() && m.id !== editingId);
                if (isDuplicate) return setErrorMsg("Nama warga sudah terdaftar di sistem!");
                const nominalDebt = safeNumber(formData.debt);
                const finalWonRound = formData.hasWon ? safeNumber(formData.wonRound || 1) : null;
                const newObj = { name: trimmedName, status: formData.status, program: formData.program, debt: nominalDebt, redRecord: nominalDebt > 0, hasWon: formData.hasWon, wonRound: finalWonRound };
                if (editingId) { setMembers(members.map(m => m.id === editingId ? { ...m, ...newObj } : m)); showToast('Data warga berhasil diperbarui.'); }
                else { setMembers([...members, { id: Date.now(), ...newObj }]); showToast('Warga baru berhasil ditambahkan.'); }
                setIsFormOpen(false);
            };

            const executeDelete = () => { setMembers(members.filter(m => m.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Data warga berhasil dihapus.'); };

            return (
                <div className="space-y-7">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Buku Induk Warga</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Total <span className="font-medium text-google-blue">{members.length} Warga</span> Terdaftar</p></div>
                        <div className="flex gap-3 w-full sm:w-auto overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
                            <button onClick={() => { setPrintMode('buku'); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(''), 1000); }, 100); }} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="print" className="text-[16px]" /><span>Cetak Form</span></button>
                            {userRole === 'admin' && <button onClick={handlePrintBarcode} className="bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="qr_code_scanner" className="text-[16px]" /><span>Cetak Barcode</span></button>}
                            {userRole === 'admin' && <button onClick={() => { setFormData({ name: '', status: 'Normal', program: 'Arisan', debt: 0, hasWon: false, wonRound: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); }} className="bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="person_add" className="text-[17px]" /><span>Tambah Data</span></button>}
                        </div>
                    </div>

                    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 no-print">
                        <Icon name="search" className="text-[20px] text-slate-400 shrink-0 ml-2" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama warga..." className="w-full bg-transparent outline-none font-medium text-[13px] text-google-text placeholder:text-slate-400 placeholder:font-medium" />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 shrink-0 active:scale-95 transition-all"><Icon name="close" className="text-[16px]" /></button>}
                    </div>

                    {printMode === 'buku' && (
                        <div className="hidden print-only">
                            <div className="kop-surat">
                                <div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div>
                                <div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div>
                                <div className="kop-surat-logo-right"></div>
                            </div>
                            <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Buku Induk &amp; Evaluasi Warga</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber || 1} | Putaran Ke-{currentRound} | Periode: {formatBulanTahun(arisanPeriod)}</p></div>
                            <table className="print-table">
                                <thead><tr><th width="5%">No</th><th width="30%">Nama Warga</th><th width="15%">Program</th><th width="15%">Status Arisan</th><th width="15%">Tunggakan</th><th width="20%">Keterangan</th></tr></thead>
                                <tbody>
                                    {members.length === 0 ? <tr><td colSpan="6" className="text-center font-medium">Belum ada data.</td></tr> : members.map((m, idx) => (
                                        <tr key={m.id}>
                                            <td className="text-center font-medium">{idx + 1}</td>
                                            <td className="font-medium">{m.name} {m.status === 'Meninggal' && <span className="text-[9px] bg-slate-200 px-1 rounded-sm text-slate-600">Wafat</span>}{m.status === 'Nonaktif' && <span className="text-[9px] bg-slate-200 px-1 rounded-sm text-slate-600">Nonaktif</span>}</td>
                                            <td className="text-center font-medium">{m.program === 'IuranOnly' ? 'Iuran Saja' : (m.program === 'ArisanOnly' ? 'Arisan Saja (Bebas Jimpitan)' : (m.program === 'JimpitanOnly' ? 'Jimpitan & Iuran Umum' : 'Arisan, Iuran & Jimpitan'))}</td>
                                            <td className="text-center font-medium">{m.program === 'IuranOnly' || m.program === 'JimpitanOnly' ? '-' : (m.hasWon ? `Menang (Put.${m.wonRound})` : 'Belum')}</td>
                                            <td className="text-right font-medium">{m.debt > 0 ? formatRp(m.debt) : '-'}</td><td></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="ttd-container">
                                <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                                <div className="ttd-box"><p>Dibuat Oleh,</p><p>Sekretaris / Admin</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                            </div>
                        </div>
                    )}
                    
                    {printMode === 'barcode' && (
                        <div className="hidden print-only">
                            <div className="text-center mb-8"><h2 className="text-[18pt] font-medium uppercase mb-1">Kartu Barcode Warga</h2><p className="text-[12pt]">{identity?.name || 'Aplikasi Arisan'}</p></div>
                            <div className="grid grid-cols-2 gap-8" style={{ pageBreakInside: 'avoid' }}>
                                {members.map(m => (
                                    <div key={m.id} className="border border-black p-6 rounded-xl flex flex-col items-center justify-center text-center" style={{ pageBreakInside: 'avoid' }}>
                                        <h3 className="font-medium text-[12pt] mb-2 uppercase">{identity?.name || 'RT/RW'}</h3>
                                        <p className="font-medium text-[16pt] uppercase mb-1 leading-tight">{m.name}</p>
                                        <p className="font-medium text-[11pt] mb-4 text-gray-700">No. Anggota: M-{m.id}</p>
                                        <svg className="barcode-element" data-value={`M-${m.id}`} data-text={`M-${m.id}`} data-height="50" data-width="1.8" data-fontSize="14"></svg>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-6 no-print">
                        {(() => {
                            const filteredMembers = members.filter(m => (m.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()));
                            return (
                                <>
                                    {filteredMembers.map((member) => (
                                        <div key={member.id} onClick={(e) => { if(!e.target.closest('button')) setPreviewMember(member); }} className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-google-blue/40 transition-all duration-300 gap-5 group cursor-pointer">
                                <div className="flex flex-wrap items-center gap-5">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-medium text-[20px] shrink-0 border transition-colors duration-300 ${isNonaktif(member) ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-google-blueLight text-google-blueDark border-google-blue/30 group-hover:bg-google-blue group-hover:text-white group-hover:border-google-blueDark'}`}>{member.name.charAt(0).toUpperCase()}</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-medium text-[16px] truncate transition-colors tracking-tight ${isNonaktif(member) ? 'text-slate-400 line-through' : 'text-google-text group-hover:text-google-blueDark'}`}>{member.name} {isNonaktif(member) && <span className="text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md ml-2 font-medium border border-slate-200 align-middle">{member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</h3>
                                        <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-[10px] uppercase tracking-wider">
                                            <span className={`px-3 py-1.5 rounded-md font-medium border ${member.program === 'IuranOnly' ? 'bg-slate-50 text-google-textVariant border-slate-200' : (member.program === 'ArisanOnly' ? 'bg-google-yellowLight text-google-yellowDark border-google-yellow/40' : (member.program === 'JimpitanOnly' ? 'bg-google-greenLight text-google-greenDark border-google-green/40' : 'bg-google-blue/10 text-google-blueDark border-google-blue/30'))}`}>{member.program === 'IuranOnly' ? 'Hanya Iuran' : (member.program === 'ArisanOnly' ? 'Arisan Saja (Bebas Jimpitan)' : (member.program === 'JimpitanOnly' ? 'Jimpitan & Iuran Umum' : 'Arisan, Iuran & Jimpitan'))}</span>
                                            {member.program !== 'IuranOnly' && member.program !== 'JimpitanOnly' && (member.hasWon ? <span className="bg-google-blue text-white px-3 py-1.5 rounded-md font-medium shadow-sm border border-google-blueDark flex flex-wrap items-center gap-1"><Icon name="emoji_events" className="text-[13px]"/> Menang Put. {member.wonRound}</span> : <span className="text-google-textVariant px-3 py-1.5 rounded-md bg-slate-100 font-medium border border-slate-200">Belum Menang</span>)}
                                            {member.debt > 0 ? <span className="bg-google-redLight text-google-redDark px-3 py-1.5 rounded-md font-medium border border-google-red/40 animate-pulse flex flex-wrap items-center gap-1.5"><Icon name="warning" className="text-[13px]"/> Tunggakan {formatRp(member.debt)}</span> : <span className="bg-google-greenLight text-google-greenDark px-3 py-1.5 rounded-md font-medium border border-google-green/40 flex flex-wrap items-center gap-1.5"><Icon name="check_circle" className="text-[13px]"/> Aman</span>}
                                        </div>
                                    </div>
                                </div>
                                {userRole === 'admin' && (
                                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 border-t sm:border-t-0 border-slate-200 pt-5 sm:pt-0 justify-end w-full sm:w-auto opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <button onClick={() => { setFormData(member); setEditingId(member.id); setIsFormOpen(true); setErrorMsg(''); }} className="bg-google-blue text-white px-5 py-2 rounded-full font-medium text-[12px] hover:bg-google-blueDark shadow-sm active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5"><Icon name="edit" className="text-[14px]" /><span className="sm:hidden">Edit</span></button>
                                        <button onClick={() => setDeleteConfirmId(member.id)} className="bg-google-red/10 text-google-red px-5 py-2 rounded-full font-medium text-[12px] hover:bg-google-red hover:text-white shadow-sm active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5"><Icon name="delete" className="text-[14px]" /><span className="sm:hidden">Hapus</span></button>
                                    </div>
                                )}
                            </div>
                                    ))}
                                    {filteredMembers.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border border-slate-200"><Icon name="search_off" className="text-[48px] text-slate-400" fill="true" /></div><p className="text-google-text font-medium text-[17px] tracking-tight">Tidak Ditemukan</p><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Tidak ada warga yang cocok dengan pencarian.</p></div>}
                                </>
                            );
                        })()}
                    </div>

                    {isFormOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit Data Warga' : 'Tambah Warga Baru'}</h3>
                                <div className="space-y-7">
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nama Lengkap</label><input type="text" value={formData.name} onChange={e => {setFormData({...formData, name: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Masukkan nama..." /></div>
                                    <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Program Keikutsertaan</label><select value={formData.program || 'Arisan'} onChange={e => setFormData({...formData, program: e.target.value, hasWon: false, wonRound: ''})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text cursor-pointer"><option value="Arisan">Full (Arisan, Iuran &amp; Jimpitan)</option><option value="IuranOnly">Hanya Iuran Umum Saja</option><option value="ArisanOnly">Arisan Saja (Bebas Jimpitan)</option><option value="JimpitanOnly">Jimpitan &amp; Iuran Umum (Tanpa Arisan)</option></select></div>
                                    <div className="flex flex-wrap gap-5">
                                        <div className="flex-1"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text cursor-pointer"><option value="Normal">Aktif</option><option value="Meninggal">Meninggal / Wafat</option><option value="Nonaktif">Nonaktif / Pindah</option></select></div>
                                        <div className="flex-1"><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tunggakan (Rp)</label><input type="number" min="0" value={formData.debt} onChange={e => {setFormData({...formData, debt: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                    </div>
                                    {formData.program !== 'IuranOnly' && formData.program !== 'JimpitanOnly' && (
                                        <div className="pt-5 border-t border-slate-200">
                                            <label className="flex flex-wrap items-center gap-3 mb-5 cursor-pointer group"><div className="relative flex items-center justify-center"><input type="checkbox" checked={formData.hasWon} onChange={e => setFormData({...formData, hasWon: e.target.checked})} className="peer appearance-none w-6 h-6 border border-slate-400 rounded-lg checked:bg-google-blue checked:border-google-blue transition-colors cursor-pointer" /><Icon name="check" className="absolute text-white text-[14px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth="4"/></div><span className="text-[13px] font-medium text-google-text group-hover:text-google-blue transition-colors">Warga Sudah Menang Arisan</span></label>
                                            {formData.hasWon && <div><label className="text-[10px] font-medium text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Di Putaran Ke-</label><input type="number" min="1" value={formData.wonRound} onChange={e => {setFormData({...formData, wonRound: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[13px] font-medium outline-none rounded-2xl transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Misal: 3" /></div>}
                                        </div>
                                    )}
                                </div>
                                {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-4 py-3.5 rounded-2xl mt-5 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-200">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} className="flex flex-wrap bg-google-blue text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Simpan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border border-google-red/30"><Icon name="person_remove" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Hapus Warga?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Data warga dan riwayatnya akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={executeDelete} className="flex flex-wrap bg-google-red text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-redDark shadow-md hover:bg-google-redDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {previewMember && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in" onClick={() => setPreviewMember(null)}>
                            <div className="max-h-[90vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 relative modal-card animate-modal-in" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setPreviewMember(null)} className="absolute top-4 right-4 w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-all"><Icon name="close" className="text-[17px]" /></button>
                                
                                <div className="mb-4">
                                    <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center font-medium text-[32px] border shadow-sm ${isNonaktif(previewMember) ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-google-blueLight text-google-blueDark border-google-blue/30'}`}>{previewMember.name.charAt(0).toUpperCase()}</div>
                                </div>
                                <h3 className={`font-medium text-[18px] tracking-tight mb-1 ${isNonaktif(previewMember) ? 'text-slate-400 line-through' : 'text-google-text'}`}>{previewMember.name}</h3>
                                <p className="text-[12px] font-medium text-google-textVariant mb-6 bg-slate-50 inline-block px-4 py-1.5 rounded-lg border border-slate-200">No. Anggota: M-{previewMember.id}</p>

                                <div className="space-y-5 text-left mb-6 bg-slate-50 p-5 rounded-3xl border border-slate-200">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Status</span><span className="font-medium text-[13px] text-google-text">{previewMember.status}</span></div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Program</span><span className="font-medium text-[13px] text-google-text">{previewMember.program === 'IuranOnly' ? 'Hanya Iuran' : (previewMember.program === 'ArisanOnly' ? 'Arisan Saja (Bebas Jimpitan)' : (previewMember.program === 'JimpitanOnly' ? 'Jimpitan & Iuran Umum' : 'Arisan, Iuran & Jimpitan'))}</span></div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Tunggakan</span><span className={`font-medium text-[13px] ${previewMember.debt > 0 ? 'text-google-red' : 'text-google-green'}`}>{previewMember.debt > 0 ? formatRp(previewMember.debt) : 'Rp 0 (Aman)'}</span></div>
                                    {previewMember.program !== 'IuranOnly' && (
                                        <div className="flex justify-between items-center"><span className="text-[11px] font-medium text-google-textVariant uppercase tracking-widest">Arisan</span><span className={`font-medium text-[13px] ${previewMember.hasWon ? 'text-google-blue' : 'text-google-textVariant'}`}>{previewMember.hasWon ? `Menang (Put. ${previewMember.wonRound})` : 'Belum Menang'}</span></div>
                                    )}
                                </div>
                                
                                <div className="border border-dashed border-slate-400 rounded-3xl p-5 bg-white mb-2 relative">
                                    <p className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest mb-3">Barcode Resmi</p>
                                    <canvas id="preview-barcode" className="mx-auto w-full max-w-[200px]"></canvas>
                                    <button onClick={handleDownloadBarcode} className="mt-4 bg-slate-100 hover:bg-slate-200 text-google-text font-medium text-[11px] px-4 py-2 rounded-full transition-all flex items-center justify-center gap-1 mx-auto border border-slate-200 active:scale-95"><Icon name="download" className="text-[14px]"/> Simpan Gambar (PNG)</button>
                                </div>
                                <p className="text-[10px] font-medium text-slate-400 mt-4">Tunjukkan barcode ini kepada petugas jika diperlukan.</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default WargaList;
