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

    // Mode tampilan menu warga: 'auto' (HP = list, Desktop = grid), 'list', atau 'grid'
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('warga_list_view_mode') || 'auto';
        } catch (e) {
            return 'auto';
        }
    });

    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('warga_list_view_mode', mode);
        } catch (e) {}
    };

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

    const executeDelete = () => { 
        setMembers(members.filter(m => m.id !== deleteConfirmId)); 
        setDeleteConfirmId(null); 
        showToast('Data warga berhasil dihapus.'); 
    };

    const filteredMembers = members.filter(m => 
        (m.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
        String(m.id || '').includes(searchQuery.trim())
    );

    return (
        <div className="space-y-5 sm:space-y-6">
            {/* BENTO HEADER CARD */}
            <div className="bento-header-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/25 flex items-center justify-center shrink-0 shadow-xs">
                        <Icon name="groups" className="text-[26px]" fill="true" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">Buku Induk Warga</h2>
                        <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            Total <span className="font-bold text-red-600 dark:text-red-400">{members.length} Warga</span> Terdaftar dalam Sistem
                        </p>
                    </div>
                </div>

                {/* Action Buttons Header */}
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto hide-scrollbar pb-1 sm:pb-0 shrink-0">
                    <button
                        type="button"
                        onClick={() => { setPrintMode('buku'); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(''), 1000); }, 100); }}
                        className="btn-native-secondary shrink-0"
                        title="Cetak Formulir Buku Induk"
                    >
                        <Icon name="print" className="text-[17px] text-slate-500 dark:text-slate-400" />
                        <span>Cetak Form</span>
                    </button>

                    {userRole === 'admin' && (
                        <button
                            type="button"
                            onClick={handlePrintBarcode}
                            className="btn-native-secondary shrink-0"
                            title="Cetak Seluruh Barcode Warga"
                        >
                            <Icon name="qr_code_scanner" className="text-[17px] text-slate-500 dark:text-slate-400" />
                            <span>Cetak Barcode</span>
                        </button>
                    )}

                    {userRole === 'admin' && (
                        <button
                            type="button"
                            onClick={() => { setFormData({ name: '', status: 'Normal', program: 'Arisan', debt: 0, hasWon: false, wonRound: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); }}
                            className="btn-native-primary shrink-0"
                            title="Tambah Data Warga Baru"
                        >
                            <Icon name="person_add" className="text-[18px]" />
                            <span>Tambah Warga</span>
                        </button>
                    )}
                </div>
            </div>

            {/* SEARCH TOOLBAR & VIEW MODE SWITCHER */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
                {/* Search Input Bar */}
                <div className="relative flex-1 bento-island-card !p-2 sm:!p-2.5 flex items-center gap-2">
                    <Icon name="search" className="text-[20px] text-slate-400 shrink-0 ml-2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Cari nama warga atau ID anggota..."
                        className="w-full bg-transparent outline-none font-medium text-[15px] sm:text-[13.5px] text-slate-800 dark:text-white placeholder:text-slate-400"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 shrink-0 active:scale-95 transition-all"
                            title="Hapus Pencarian"
                        >
                            <Icon name="close" className="text-[16px]" />
                        </button>
                    )}
                </div>

                {/* View Switcher: Auto, List, Grid */}
                <div className="inline-flex items-center self-end sm:self-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-[11px] font-bold shrink-0">
                    <button
                        type="button"
                        onClick={() => handleSetViewMode('auto')}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                            viewMode === 'auto'
                                ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title="Otomatis: Mode Baris (HP) dan Kotak (Desktop)"
                    >
                        <Icon name="tune" className="text-[14px]" />
                        <span className="hidden xs:inline">Otomatis</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSetViewMode('list')}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                            viewMode === 'list'
                                ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title="Tampilan Baris (List View)"
                    >
                        <Icon name="view_list" className="text-[15px]" />
                        <span>List</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSetViewMode('grid')}
                        className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                            viewMode === 'grid'
                                ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-xs'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title="Tampilan Kotak (Grid View)"
                    >
                        <Icon name="grid_view" className="text-[15px]" />
                        <span>Grid</span>
                    </button>
                </div>
            </div>

            {/* Print Mode: Buku Induk */}
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
            
            {/* Print Mode: Barcode */}
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

            {/* --- TAMPILAN 1: LIST VIEW (ERGONOMIS NATIVE ROW) --- */}
            <div
                className={`space-y-2.5 no-print ${
                    viewMode === 'list'
                        ? 'block'
                        : viewMode === 'grid'
                        ? 'hidden'
                        : 'block sm:hidden'
                }`}
            >
                {filteredMembers.map((member) => (
                    <div
                        key={member.id}
                        onClick={(e) => { if (!e.target.closest('button')) setPreviewMember(member); }}
                        className="bento-island-card !p-3 sm:!p-3.5 flex items-center justify-between gap-3 group cursor-pointer active:scale-[0.99] transition-all"
                    >
                        <div className="flex items-center gap-3 min-w-0 pr-1">
                            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-[17px] shrink-0 border transition-all ${
                                isNonaktif(member)
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                                    : 'bg-red-50 text-red-600 border-red-500/20 dark:bg-red-950/40 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white'
                            }`}>
                                {member.name.charAt(0).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className={`font-bold text-[14px] sm:text-[15px] truncate tracking-tight ${
                                        isNonaktif(member)
                                            ? 'text-slate-400 line-through'
                                            : 'text-slate-800 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400'
                                    }`}>
                                        {member.name}
                                    </h3>
                                    {isNonaktif(member) && (
                                        <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                            {member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10px] font-semibold">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                                        {member.program === 'IuranOnly' ? 'Hanya Iuran' : (member.program === 'ArisanOnly' ? 'Arisan Saja' : (member.program === 'JimpitanOnly' ? 'Jimpitan' : 'Full'))}
                                    </span>

                                    {member.debt > 0 ? (
                                        <span className="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                                            <Icon name="warning" className="text-[12px]" />
                                            <span>{formatRp(member.debt)}</span>
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                            <Icon name="check_circle" className="text-[12px]" />
                                            <span>Aman</span>
                                        </span>
                                    )}

                                    {member.hasWon && (
                                        <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                                            <Icon name="emoji_events" className="text-[12px]" />
                                            <span>Put.{member.wonRound}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Action buttons / Barcode click */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {userRole === 'admin' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setFormData(member); setEditingId(member.id); setIsFormOpen(true); setErrorMsg(''); }}
                                        className="btn-native-action w-9 h-9 sm:w-10 sm:h-10 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:text-slate-300 dark:hover:text-red-400 border border-slate-200/80 dark:border-slate-700"
                                        title="Edit Data Warga"
                                    >
                                        <Icon name="edit" className="text-[15px]" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(member.id); }}
                                        className="btn-native-action w-9 h-9 sm:w-10 sm:h-10 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20"
                                        title="Hapus Warga"
                                    >
                                        <Icon name="delete" className="text-[15px]" />
                                    </button>
                                </>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-red-600 transition-colors">
                                    <Icon name="chevron_right" className="text-[18px]" />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* --- TAMPILAN 2: GRID VIEW (BENTO CARDS UNTUK TABLET & DESKTOP) --- */}
            <div
                className={`gap-3.5 sm:gap-4 lg:gap-5 no-print ${
                    viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                        : viewMode === 'list'
                        ? 'hidden'
                        : 'hidden sm:grid sm:grid-cols-2 lg:grid-cols-3'
                }`}
            >
                {filteredMembers.map((member) => (
                    <div
                        key={member.id}
                        onClick={(e) => { if (!e.target.closest('button')) setPreviewMember(member); }}
                        className="bento-island-card flex flex-col justify-between gap-4 group cursor-pointer hover:-translate-y-1 transition-all"
                    >
                        <div>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[19px] shrink-0 border transition-all ${
                                        isNonaktif(member)
                                            ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                                            : 'bg-red-50 text-red-600 border-red-500/25 dark:bg-red-950/40 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white'
                                    }`}>
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={`font-bold text-[15px] sm:text-[16px] truncate tracking-tight ${
                                            isNonaktif(member)
                                                ? 'text-slate-400 line-through'
                                                : 'text-slate-800 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400'
                                        }`}>
                                            {member.name}
                                        </h3>
                                        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                                            ID: M-{member.id}
                                        </p>
                                    </div>
                                </div>

                                {isNonaktif(member) && (
                                    <span className="text-[9px] uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-lg font-bold border border-slate-200 dark:border-slate-700 shrink-0">
                                        {member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}
                                    </span>
                                )}
                            </div>

                            {/* Badges Info */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[10.5px] font-semibold">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                                    {member.program === 'IuranOnly' ? 'Hanya Iuran' : (member.program === 'ArisanOnly' ? 'Arisan Saja' : (member.program === 'JimpitanOnly' ? 'Jimpitan & Iuran' : 'Arisan, Iuran & Jimpitan'))}
                                </span>

                                {member.debt > 0 ? (
                                    <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                                        <Icon name="warning" className="text-[13px]" />
                                        <span>Tunggakan {formatRp(member.debt)}</span>
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                        <Icon name="check_circle" className="text-[13px]" />
                                        <span>Lunas</span>
                                    </span>
                                )}

                                {member.hasWon && (
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                        <Icon name="emoji_events" className="text-[13px]" />
                                        <span>Put. {member.wonRound}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Footer Card: Barcode Trigger & Admin Action */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 gap-2">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setPreviewMember(member); }}
                                className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1.5 transition-colors"
                            >
                                <Icon name="qr_code_2" className="text-[16px]" />
                                <span>Lihat Barcode</span>
                            </button>

                            {userRole === 'admin' && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setFormData(member); setEditingId(member.id); setIsFormOpen(true); setErrorMsg(''); }}
                                        className="btn-native-action w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:text-slate-300 dark:hover:text-red-400 border border-slate-200/80 dark:border-slate-700"
                                        title="Edit"
                                    >
                                        <Icon name="edit" className="text-[14px]" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(member.id); }}
                                        className="btn-native-action w-8 h-8 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-950/40 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white border border-red-500/20"
                                        title="Hapus"
                                    >
                                        <Icon name="delete" className="text-[14px]" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredMembers.length === 0 && (
                <div className="bento-island-card p-12 text-center">
                    <div className="bg-slate-100 dark:bg-slate-800 w-20 h-20 flex items-center justify-center rounded-2xl mb-4 mx-auto border border-slate-200 dark:border-slate-700 text-slate-400">
                        <Icon name="search_off" className="text-[40px]" fill="true" />
                    </div>
                    <p className="text-slate-800 dark:text-white font-bold text-[16px] tracking-tight">Tidak Ditemukan</p>
                    <p className="text-[13px] font-medium text-slate-400 dark:text-slate-500 mt-1">Tidak ada data warga yang cocok dengan pencarian Anda.</p>
                </div>
            )}

            {/* MODAL FORM TAMBAH / EDIT WARGA */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
                            <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                                {editingId ? 'Edit Data Warga' : 'Tambah Warga Baru'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => { setIsFormOpen(false); setErrorMsg(''); }}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center active:scale-95 transition-all"
                            >
                                <Icon name="close" className="text-[17px]" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Nama Lengkap *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => { setFormData({ ...formData, name: e.target.value }); setErrorMsg(''); }}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-2.5 text-[16px] sm:text-[13.5px] font-medium outline-none rounded-xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                    placeholder="Masukkan nama warga..."
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                    Program Keikutsertaan
                                </label>
                                <select
                                    value={formData.program || 'Arisan'}
                                    onChange={e => setFormData({ ...formData, program: e.target.value, hasWon: false, wonRound: '' })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-2.5 text-[16px] sm:text-[13.5px] font-medium outline-none rounded-xl transition-all text-slate-800 dark:text-white cursor-pointer"
                                >
                                    <option value="Arisan">Full (Arisan, Iuran &amp; Jimpitan)</option>
                                    <option value="IuranOnly">Hanya Iuran Umum Saja</option>
                                    <option value="ArisanOnly">Arisan Saja (Bebas Jimpitan)</option>
                                    <option value="JimpitanOnly">Jimpitan &amp; Iuran Umum (Tanpa Arisan)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                        Status Warga
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-2.5 text-[16px] sm:text-[13.5px] font-medium outline-none rounded-xl transition-all text-slate-800 dark:text-white cursor-pointer"
                                    >
                                        <option value="Normal">Aktif</option>
                                        <option value="Meninggal">Meninggal / Wafat</option>
                                        <option value="Nonaktif">Nonaktif / Pindah</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                        Tunggakan (Rp)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.debt}
                                        onChange={e => { setFormData({ ...formData, debt: e.target.value }); setErrorMsg(''); }}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-2.5 text-[16px] sm:text-[13.5px] font-medium outline-none rounded-xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {formData.program !== 'IuranOnly' && formData.program !== 'JimpitanOnly' && (
                                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.hasWon}
                                                onChange={e => setFormData({ ...formData, hasWon: e.target.checked })}
                                                className="peer appearance-none w-5 h-5 border border-slate-300 dark:border-slate-600 rounded-lg checked:bg-red-600 checked:border-red-600 transition-colors cursor-pointer"
                                            />
                                            <Icon name="check" className="absolute text-white text-[13px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth="4"/>
                                        </div>
                                        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-red-600 transition-colors">
                                            Warga Sudah Menang Arisan
                                        </span>
                                    </label>

                                    {formData.hasWon && (
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5 ml-1 uppercase tracking-widest">
                                                Di Putaran Ke-
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={formData.wonRound}
                                                onChange={e => { setFormData({ ...formData, wonRound: e.target.value }); setErrorMsg(''); }}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 px-4 py-2.5 text-[16px] sm:text-[13.5px] font-medium outline-none rounded-xl transition-all text-slate-800 dark:text-white placeholder:text-slate-400"
                                                placeholder="Misal: 3"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {errorMsg && (
                            <div className="bg-red-50 dark:bg-red-950/40 border border-red-500/30 text-red-600 dark:text-red-400 font-semibold text-[12px] px-3.5 py-2.5 rounded-xl mt-4 flex items-center gap-2">
                                <Icon name="error" className="text-[16px] shrink-0"/>
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => { setIsFormOpen(false); setErrorMsg(''); }}
                                className="btn-native-secondary flex-1"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                className="btn-native-primary flex-1"
                            >
                                Simpan Data
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL KONFIRMASI HAPUS */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-7 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                        <div className="mb-4 bg-red-50 dark:bg-red-950/40 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border border-red-500/25 text-red-600">
                            <Icon name="person_remove" className="text-[34px]" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1 tracking-tight">Hapus Warga?</h3>
                        <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            Data warga dan riwayat keikutsertaannya akan dihapus secara permanen dari sistem.
                        </p>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirmId(null)}
                                className="btn-native-secondary flex-1"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={executeDelete}
                                className="btn-native-primary !bg-red-600 hover:!bg-red-700 flex-1"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* MODAL PREVIEW BARCODE RESMI */}
            {previewMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in" onClick={() => setPreviewMember(null)}>
                    <div className="max-h-[90vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 relative modal-card animate-modal-in" onClick={e => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setPreviewMember(null)}
                            className="absolute top-4 right-4 w-9 h-9 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
                            title="Tutup"
                        >
                            <Icon name="close" className="text-[17px]" />
                        </button>
                        
                        <div className="mb-3">
                            <div className={`w-18 h-18 mx-auto rounded-3xl flex items-center justify-center font-black text-[28px] border shadow-xs ${
                                isNonaktif(previewMember)
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                                    : 'bg-red-50 text-red-600 border-red-500/25 dark:bg-red-950/40 dark:text-red-400'
                            }`}>
                                {previewMember.name.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <h3 className={`font-black text-[17px] tracking-tight mb-0.5 ${
                            isNonaktif(previewMember) ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'
                        }`}>
                            {previewMember.name}
                        </h3>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-5 bg-slate-100 dark:bg-slate-800 inline-block px-3 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700">
                            No. Anggota: M-{previewMember.id}
                        </p>

                        <div className="space-y-3 text-left mb-5 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-[12px]">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80 dark:border-slate-700">
                                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Status</span>
                                <span className="font-bold text-slate-800 dark:text-white">{previewMember.status}</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80 dark:border-slate-700">
                                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Program</span>
                                <span className="font-bold text-slate-800 dark:text-white">
                                    {previewMember.program === 'IuranOnly' ? 'Hanya Iuran' : (previewMember.program === 'ArisanOnly' ? 'Arisan Saja' : (previewMember.program === 'JimpitanOnly' ? 'Jimpitan' : 'Full (Arisan, Iuran, Jimpitan)'))}
                                </span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80 dark:border-slate-700">
                                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Tunggakan</span>
                                <span className={`font-bold ${previewMember.debt > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    {previewMember.debt > 0 ? formatRp(previewMember.debt) : 'Rp 0 (Aman)'}
                                </span>
                            </div>
                            {previewMember.program !== 'IuranOnly' && (
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Arisan</span>
                                    <span className={`font-bold ${previewMember.hasWon ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                                        {previewMember.hasWon ? `Menang (Put. ${previewMember.wonRound})` : 'Belum Menang'}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-4 bg-white dark:bg-slate-900 mb-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Barcode Identitas</p>
                            <canvas id="preview-barcode" className="mx-auto w-full max-w-[200px]"></canvas>
                            <button
                                type="button"
                                onClick={handleDownloadBarcode}
                                className="mt-3 btn-native-secondary !min-h-[38px] !text-[11.5px] !py-1.5 !px-3.5 mx-auto"
                            >
                                <Icon name="download" className="text-[14px]" />
                                <span>Unduh Barcode (PNG)</span>
                            </button>
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-3">Tunjukkan barcode ini kepada petugas RT jika diperlukan.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WargaList;
