import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { safeNumber, getLocalDate, uploadToGoogleDrive } from '../../utils/helpers.js';

function InfoDesaSection({ infoDesa, setInfoDesa, showAlert }) {
    const [localInfo, setLocalInfo] = useState(infoDesa || { enabled: true, batas: {}, kontak: [] });
    
    useEffect(() => {
        if (infoDesa) setLocalInfo(infoDesa);
    }, [infoDesa]);

    const handleSave = () => {
        setInfoDesa(localInfo);
        showAlert('Pengaturan Info Desa berhasil disimpan.');
    };

    const updateBatas = (arah, val) => {
        setLocalInfo(prev => ({
            ...prev,
            batas: { ...prev.batas, [arah]: val }
        }));
    };

    const addKontak = () => {
        setLocalInfo(prev => ({
            ...prev,
            kontak: [...(prev.kontak || []), { id: Date.now(), nama: 'Kontak Baru', telepon: '0800-0000-0000', icon: 'contact_phone', color: 'slate' }]
        }));
    };

    const removeKontak = (index) => {
        setLocalInfo(prev => ({
            ...prev,
            kontak: prev.kontak.filter((k, i) => i !== index)
        }));
    };

    const updateKontak = (index, field, val) => {
        setLocalInfo(prev => ({
            ...prev,
            kontak: prev.kontak.map((k, i) => i === index ? { ...k, [field]: val } : k)
        }));
    };

    return (
        <PengaturanSection title="Manajemen Info Layanan Desa" onSave={handleSave}>
            <div className="space-y-6">
                {/* Toggle Aktif */}
                <label className="flex items-center justify-between p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl cursor-pointer hover:border-red-500/40 transition-all duration-200">
                    <div>
                        <p className="text-[14px] font-bold text-slate-900 dark:text-white">Aktifkan Info Desa</p>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Tampilkan bagian batas wilayah &amp; kontak darurat di Peta Desa</p>
                    </div>
                    <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={localInfo.enabled} onChange={e => setLocalInfo({...localInfo, enabled: e.target.checked})} />
                        <div className="w-12 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-red-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-6"></div>
                    </div>
                </label>

                {localInfo.enabled && (
                    <>
                        {/* Batas Administrasi */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl space-y-4">
                            <h4 className="font-bold text-[14px] text-slate-900 dark:text-white flex items-center gap-2">
                                <Icon name="explore" className="text-red-500 text-[18px]" />
                                <span>Batas Administrasi Wilayah</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                    <div key={arah} className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">{arah}</label>
                                        <input type="text" value={localInfo.batas?.[arah] || ''} onChange={e => updateBatas(arah, e.target.value)} className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white placeholder:text-slate-400" placeholder={`Batas ${arah}`} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Kontak Penting */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-[14px] text-slate-900 dark:text-white flex items-center gap-2">
                                    <Icon name="contact_phone" className="text-red-500 text-[18px]" />
                                    <span>Kontak Penting &amp; Siaga</span>
                                </h4>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {localInfo.kontak?.length || 0} Kontak
                                </span>
                            </div>

                            <div className="space-y-3">
                                {localInfo.kontak?.map((k, idx) => {
                                    const idKey = k.id || k.nama;
                                    return (
                                        <div key={idKey} className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 relative">
                                            <div className="flex-1 space-y-2">
                                                <input type="text" value={k.nama} onChange={e => updateKontak(idKey, 'nama', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold outline-none focus:border-red-500 text-slate-900 dark:text-white" placeholder="Nama Layanan (contoh: Pos Kamling RT)" />
                                                <input type="text" value={k.telepon} onChange={e => updateKontak(idKey, 'telepon', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-[13px] font-semibold outline-none focus:border-red-500 text-slate-900 dark:text-white" placeholder="Nomor Telepon / WhatsApp" />
                                            </div>
                                            <button onClick={() => removeKontak(idKey)} className="self-end sm:self-center bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 p-2.5 rounded-xl transition-colors cursor-pointer" title="Hapus Kontak">
                                                <Icon name="delete" className="text-[18px]" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <button onClick={addKontak} className="w-full py-3.5 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-400 font-bold text-[13px] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500 transition-all flex items-center justify-center gap-2 cursor-pointer">
                                <Icon name="add" className="text-[18px]" />
                                <span>Tambah Kontak Layanan Baru</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </PengaturanSection>
    );
}

function SponsorSection({ sponsorsData, setSponsorsData, showAlert }) {
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [uploadError, setUploadError] = useState('');

    const uploadLogo = async (file) => {
        if (!file) return;
        if (!file.type.match('image.*')) { showAlert('Gagal: File harus berupa gambar!'); return; }
        if (file.size > 5 * 1024 * 1024) { showAlert('Gagal: Ukuran gambar awal maksimal 5MB!'); return; }
        setIsUploading(true); setUploadError('');
        try {
            const url = await uploadToGoogleDrive(file, 400, 0.8);
            setNewUrl(url);
            setPreviewUrl(url);
            setUploadError('');
        } catch(error) {
            setUploadError(error);
            showAlert(error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAdd = () => {
        if (!newName.trim()) { showAlert('Nama sponsor harus diisi!'); return; }
        if (!newUrl.trim()) { showAlert('Logo harus diunggah atau URL dimasukkan!'); return; }
        const nameToSave = newName.trim();
        const urlToSave = newUrl.trim();
        setSponsorsData(prev => {
            const current = prev?.sponsors || [];
            return { ...prev, sponsors: [...current, { name: nameToSave, url: urlToSave }] };
        });
        setNewName(''); setNewUrl(''); setPreviewUrl(''); setUploadError('');
        showAlert('Sponsor berhasil ditambahkan dan disimpan!');
    };

    return (
        <PengaturanSection title="Manajemen Sponsor RT" onSave={() => showAlert('Pengaturan Sponsor berhasil disimpan.')}>
            <div className="space-y-6">
                <label className="flex items-center justify-between p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl cursor-pointer hover:border-red-500/40 transition-all duration-200">
                    <div>
                        <p className="text-[14px] font-bold text-slate-900 dark:text-white">Aktifkan Tampilan Sponsor</p>
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Tampilkan logo-logo sponsor resmi di halaman utama beranda</p>
                    </div>
                    <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={sponsorsData?.enabled || false} onChange={e => {
                            const checked = e.target.checked;
                            setSponsorsData(prev => ({ ...prev, enabled: checked }));
                        }} />
                        <div className="w-12 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:bg-red-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-6"></div>
                    </div>
                </label>

                {sponsorsData?.enabled && (
                    <div className="p-5 border border-slate-200 dark:border-slate-750 rounded-2xl bg-slate-50 dark:bg-slate-850 space-y-6">
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">Daftar Sponsor Aktif</p>
                            <div className="space-y-2.5">
                                {sponsorsData?.sponsors?.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <img src={s.url} alt={s.name} className="h-10 w-16 object-contain shrink-0 rounded-lg bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" onError={(e) => { e.target.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🤝</text></svg>'; }} />
                                            <span className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{s.name}</span>
                                        </div>
                                        <button onClick={() => {
                                            const idx = i;
                                            setSponsorsData(prev => {
                                                const ns = [...(prev?.sponsors || [])]; ns.splice(idx, 1);
                                                return { ...prev, sponsors: ns };
                                            });
                                        }} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 cursor-pointer" title="Hapus Sponsor">
                                            <Icon name="delete" className="text-[18px]" />
                                        </button>
                                    </div>
                                ))}
                                {(!sponsorsData?.sponsors || sponsorsData.sponsors.length === 0) && (
                                    <p className="text-[12px] italic text-slate-400 dark:text-slate-500 text-center py-4 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">Belum ada sponsor. Tambahkan mitra pendukung di bawah ini.</p>
                                )}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-750 space-y-4">
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Tambah Sponsor Baru</p>

                            <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3.5 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Nama Mitra / Sponsor</label>
                                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Misal: Bank Jatim, Warung Berkah, dsb." className="w-full bg-transparent text-[13.5px] font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none" />
                            </div>

                            <div>
                                <label className={`relative w-full h-20 bg-white dark:bg-slate-900 border-2 border-dashed ${isUploading ? 'border-red-500 bg-red-50/20' : 'border-slate-300 dark:border-slate-700 hover:border-red-500/50'} rounded-2xl flex items-center justify-center px-4 cursor-pointer transition-all duration-200 overflow-hidden`}>
                                    <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                                    {isUploading ? (
                                        <div className="flex items-center gap-3 pointer-events-none">
                                            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
                                            <span className="font-bold text-[13px] text-red-600">Mengunggah logo sponsor...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 pointer-events-none">
                                            <div className="w-11 h-11 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-xl flex items-center justify-center border border-red-500/20 shrink-0">
                                                <Icon name="add_photo_alternate" className="text-[20px]" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-[13px] text-slate-900 dark:text-white">{previewUrl ? 'Ganti Logo Sponsor' : 'Pilih File Logo (PNG, JPG, Maks 5MB)'}</p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Otomatis terkompresi &amp; dioptimasi</p>
                                            </div>
                                        </div>
                                    )}
                                </label>
                                {uploadError && <p className="text-[11px] text-red-600 font-medium mt-2 px-1">{uploadError}</p>}
                            </div>

                            {/* Preview */}
                            {previewUrl && !isUploading && (
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl p-3 shadow-sm">
                                    <img src={previewUrl} alt="preview" className="h-10 max-w-[80px] object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1" onError={(e) => e.target.style.display='none'} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Icon name="check_circle" className="text-[14px]" />
                                            <span>Logo siap disimpan</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate font-mono mt-0.5">{previewUrl.slice(0, 60)}</p>
                                    </div>
                                    <button onClick={() => { setNewUrl(''); setPreviewUrl(''); setUploadError(''); }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0">
                                        <Icon name="close" className="text-[16px]" />
                                    </button>
                                </div>
                            )}

                            <details className="mt-1">
                                <summary className="text-[11px] font-bold text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-red-600 transition-colors flex items-center gap-1.5">
                                    <Icon name="link" className="text-[14px]" />
                                    <span>Atau masukkan URL logo secara manual</span>
                                </summary>
                                <div className="mt-2 bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                    <input type="text" value={newUrl} onChange={e => { setNewUrl(e.target.value); setPreviewUrl(e.target.value); }} placeholder="https://contoh.com/logo.png" className="w-full bg-transparent text-[12px] font-mono text-slate-900 dark:text-white placeholder:text-slate-400 outline-none" />
                                </div>
                            </details>
                        </div>

                        <button onClick={handleAdd} disabled={isUploading || !newName.trim() || !newUrl.trim()} className="w-full min-h-[46px] bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-[14px] shadow-lg shadow-red-500/25 border border-red-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                            <Icon name="add_circle" className="text-[18px]" />
                            <span>Tambah &amp; Simpan Sponsor</span>
                        </button>
                    </div>
                )}
            </div>
        </PengaturanSection>
    );
}

function PengaturanSection({ title, onSave, children, saveLabel }) {
    return (
        <div className="bento-island-card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
                <h3 className="font-extrabold text-[18px] text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span className="w-2 h-5 rounded-full bg-red-600"></span>
                    <span>{title}</span>
                </h3>
            </div>
            <div className="space-y-6">{children}</div>
            {onSave && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={onSave} 
                        className="btn-native-action w-full min-h-[46px] py-3.5 px-6 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-[14px] shadow-lg shadow-red-500/25 border border-red-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Icon name="save" className="text-[18px]" />
                        <span>{saveLabel || `Simpan ${title}`}</span>
                    </button>
                </div>
            )}
        </div>
    );
}

function Pengaturan(props) {
    const { 
        nominalArisan, setNominalArisan, nominalJimpitan, setNominalJimpitan, 
        identity, setIdentity, setMembers, setMeetingHistory, 
        currentRound, setCurrentRound, cycleNumber, setCycleNumber, 
        jimpitanBalance, setJimpitanBalance, kasRtBalance, setKasRtBalance, 
        kasRtTransactions, setKasRtTransactions, arisanPeriod, setArisanPeriod, 
        bannerImage, setBannerImage,
        setIuranData, setGaleriData, setInventarisData, setInformasi, 
        setNextMeeting, infoDesa, setInfoDesa, umkmData, setUmkmData, 
        landingConfig, setLandingConfig 
    } = props;
    
    const [formIdentity, setFormIdentity] = useState(identity);
    const [formLanding, setFormLanding] = useState(landingConfig);
    const [formNominal, setFormNominal] = useState({ arisan: nominalArisan, jimpitan: nominalJimpitan });
    const [formPeriod, setFormPeriod] = useState(arisanPeriod);
    const [formSaldo, setFormSaldo] = useState({ jimpitan: jimpitanBalance, kasRt: kasRtBalance });
    const [formRound, setFormRound] = useState({ round: currentRound, cycle: cycleNumber });
    const [modalConfig, setModalConfig] = useState(null); 
    const [confirmResetModal, setConfirmResetModal] = useState(false);
    const [resetPromptInput, setResetPromptInput] = useState('');
    const [formBanner, setFormBanner] = useState(bannerImage || '');
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingBanner, setIsUploadingBanner] = useState(false);
    const [activeMenu, setActiveMenu] = useState(null);
    
    const pengaturanMenus = [
        { id: 'profil', title: 'Profil Aplikasi', icon: 'badge', bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', desc: 'Nama & Kop Surat Resmi RT' },
        { id: 'nominal', title: 'Iuran Wajib', icon: 'payments', bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', desc: 'Besaran Arisan & Jimpitan' },
        { id: 'kalibrasi', title: 'Kalibrasi Siklus', icon: 'build', bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/20', desc: 'Atur Putaran & Siklus Berjalan' },
        { id: 'saldo', title: 'Koreksi Saldo', icon: 'account_balance_wallet', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', desc: 'Edit Saldo Kas Utama Warga' },
        { id: 'banner', title: 'Banner Utama', icon: 'image', bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20', desc: 'Gambar Latar Halaman Depan' },
        { id: 'sponsor', title: 'Sponsor RT', icon: 'handshake', bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/20', desc: 'Logo Sponsor & Mitra Warga' },
        { id: 'legal', title: 'Hukum & Kebijakan', icon: 'gavel', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700', desc: 'Syarat Ketentuan & Privasi' },
        { id: 'infodesa', title: 'Info Desa', icon: 'map', bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20', desc: 'Kontak Darurat & Batas Wilayah' },
        { id: 'landing', title: 'Teks Beranda', icon: 'view_quilt', bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-500/20', desc: 'Teks Slogan, Footer & AdSense' },
        { id: 'whatsapp', title: 'Grup WhatsApp', icon: 'forum', bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', desc: 'Link Undangan Grup WA Resmi' },
        { id: 'reset', title: 'Reset Sistem', icon: 'warning', bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20', desc: 'Format Ulang Seluruh Database' }
    ];

    useEffect(() => { setFormSaldo({ jimpitan: jimpitanBalance, kasRt: kasRtBalance }); }, [jimpitanBalance, kasRtBalance]);
    useEffect(() => { setFormRound({ round: currentRound, cycle: cycleNumber }); setFormPeriod(arisanPeriod); }, [currentRound, cycleNumber, arisanPeriod]);

    const showAlert = (message) => setModalConfig({ message });

    const handleSaveAll = (type) => {
        if(type === 'saldo') {
            const newKasRt = safeNumber(formSaldo.kasRt);
            const newJimpitan = safeNumber(formSaldo.jimpitan);
            const diff = newKasRt - kasRtBalance;
            setJimpitanBalance(newJimpitan);
            if(diff !== 0) {
                setKasRtBalance(newKasRt);
                setKasRtTransactions(prev => [{ id: Date.now(), date: getLocalDate(), type: diff > 0 ? 'Pemasukan' : 'Pengeluaran', category: 'Saldo Awal', description: 'Penyesuaian Saldo Awal', amount: Math.abs(diff) }, ...prev]);
            }
        }
        if(type === 'id') { if (!formIdentity.name || !formIdentity.name.trim()) return showAlert("Nama aplikasi tidak boleh kosong!"); setIdentity(formIdentity); }
        if(type === 'nominal') {
            const newArisan = safeNumber(formNominal.arisan);
            const newJimpitan = safeNumber(formNominal.jimpitan);
            if (newArisan <= 0 || newJimpitan <= 0) return showAlert("Nominal arisan dan jimpitan harus lebih dari Rp 0!");
            setNominalArisan(newArisan); setNominalJimpitan(newJimpitan);
        }
        if(type === 'kalibrasi') { 
            setArisanPeriod(formPeriod); 
            setCurrentRound(Math.max(1, safeNumber(formRound.round))); 
            setCycleNumber(Math.max(1, safeNumber(formRound.cycle))); 
        }
        if(type === 'banner') { setBannerImage(formBanner); }
        if(type === 'landing') { setLandingConfig(formLanding); }
        if(type === 'whatsapp') { setLandingConfig(formLanding); }
        showAlert("Perubahan berhasil disimpan.");
    };

    const executeFactoryReset = () => {
        if (resetPromptInput.toUpperCase() === 'RESET') {
            const nowPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            setMembers([]); setMeetingHistory([]); setCurrentRound(1); setCycleNumber(1);
            setJimpitanBalance(0); setKasRtBalance(0); setKasRtTransactions([]);
            setArisanPeriod(nowPeriod);
            if (setIuranData) setIuranData([]);
            if (setGaleriData) setGaleriData([]);
            if (setInventarisData) setInventarisData([]);
            if (setUmkmData) setUmkmData([]);
            if (setLaporanData) setLaporanData([]);
            if (setInformasi) setInformasi([]);
            if (setNextMeeting) setNextMeeting({ date: 'Belum dijadwalkan', time: '-', location: '-', notes: '-' });
            setBannerImage('');
            try {
                const keys = ['members','history','round','cycle','jimpitan','kas_rt_balance','kas_rt_trx','period','iuran_umum','galeri_warga','inventaris_rt','informasi','next_meeting','banner_image','umkm', 'laporan'];
                keys.forEach(k => localStorage.removeItem('arisan_rt_' + k));
            } catch(e) {}
            setConfirmResetModal(false); setResetPromptInput(''); showAlert("Sistem berhasil di-reset total.");
        } else {
            showAlert("Kode salah. Gagal reset."); setConfirmResetModal(false); setResetPromptInput('');
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match('image.*')) return showAlert('Gagal: File harus berupa gambar!');
        if (file.size > 2 * 1024 * 1024) return showAlert('Gagal: Ukuran file maksimal 2MB!');
        setIsUploadingLogo(true);
        try {
            const url = await uploadToGoogleDrive(file, 400, 0.9);
            setFormIdentity({...formIdentity, logoApp: url});
            showAlert('Logo berhasil diunggah! Klik "Simpan Profil" untuk menerapkan.');
        } catch(error) {
            showAlert(error);
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const handleBannerUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match('image.*')) return showAlert('Gagal: File harus berupa gambar!');
        if (file.size > 10 * 1024 * 1024) return showAlert('Gagal: Ukuran file maksimal 10MB!');
        setIsUploadingBanner(true);
        try {
            const url = await uploadToGoogleDrive(file, 1600, 0.85);
            setFormBanner(url);
            showAlert('Gambar berhasil diproses! Klik "Simpan Banner" untuk menerapkan.');
        } catch(error) {
            showAlert(error);
        } finally {
            setIsUploadingBanner(false);
        }
    };

    const renderGridMenu = () => (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {pengaturanMenus.map(menu => (
                <div 
                    key={menu.id} 
                    onClick={() => setActiveMenu(menu.id)} 
                    className="bento-island-card p-5 sm:p-6 hover:border-red-500/40 cursor-pointer transition-all duration-300 group flex flex-col items-center text-center gap-3.5 active:scale-[0.98]"
                >
                    <div className={`w-14 h-14 ${menu.bg} ${menu.text} rounded-2xl flex items-center justify-center border ${menu.border} group-hover:scale-110 group-hover:bg-red-600 group-hover:text-white transition-all duration-300 shadow-sm`}>
                        <Icon name={menu.icon} className="text-[26px]" fill="true" />
                    </div>
                    <div>
                        <h3 className="font-bold text-[15px] text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors tracking-tight">
                            {menu.title}
                        </h3>
                        <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            {menu.desc}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderHeader = (menuId) => {
        const menu = pengaturanMenus.find(m => m.id === menuId);
        if (!menu) return null;
        return (
            <div className="flex items-center gap-3.5 mb-6">
                <button 
                    onClick={() => setActiveMenu(null)} 
                    className="w-11 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center justify-center active:scale-95 transition-all text-slate-700 dark:text-slate-200 shrink-0 shadow-sm cursor-pointer"
                    title="Kembali ke Menu Setelan"
                >
                    <Icon name="arrow_back" className="text-[20px]" />
                </button>
                <div className={`w-11 h-11 ${menu.bg} ${menu.text} rounded-2xl flex items-center justify-center border ${menu.border} shrink-0`}>
                    <Icon name={menu.icon} className="text-[22px]" fill="true" />
                </div>
                <div>
                    <h2 className="text-[18px] sm:text-[20px] font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {menu.title}
                    </h2>
                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
                        {menu.desc}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 sm:space-y-8 tab-fade-in">
            {activeMenu === null && (
                <div className="bento-island-card p-6 sm:p-8 border border-red-500/20 shadow-md flex flex-col sm:flex-row items-center sm:items-start gap-5 relative overflow-hidden">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/25 shrink-0 border border-red-400/30">
                        <Icon name="admin_panel_settings" className="text-[32px]" fill="true" />
                    </div>
                    <div className="text-center sm:text-left flex-1 min-w-0">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[11px] font-bold border border-red-500/20 mb-2">
                            <Icon name="tune" className="text-[14px]" />
                            <span>Konfigurasi Induk RT</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Setelan Portal Admin</h2>
                        <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">Kelola identitas, keuangan, siklus, kontak desa, legalitas, dan keamanan sistem warga secara menyeluruh.</p>
                    </div>
                </div>
            )}

            {activeMenu === null ? renderGridMenu() : (
                <div className="w-full">
                    {renderHeader(activeMenu)}
                    
                    {activeMenu === 'profil' && (
                        <PengaturanSection title="Profil Utama Aplikasi" onSave={() => handleSaveAll('id')}>
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Kop Surat / Nama Aplikasi (Baris 1)</label>
                                    <input type="text" value={formIdentity.name} onChange={e => setFormIdentity({...formIdentity, name: e.target.value})} className="w-full bg-transparent border-none text-[14px] font-semibold outline-none p-0 text-slate-900 dark:text-white" placeholder="Contoh: WARGA PAKEM" />
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Sub Judul / Alamat Lingkungan (Baris 2)</label>
                                    <input type="text" value={formIdentity.subtitle} onChange={e => setFormIdentity({...formIdentity, subtitle: e.target.value})} className="w-full bg-transparent border-none text-[14px] font-semibold outline-none p-0 text-slate-900 dark:text-white" placeholder="Contoh: PAKEM RT005 / RW003 DS BANYUANYAR, KEC GURAH" />
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-5 border border-slate-200 dark:border-slate-750 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-widest">Logo Kustom Aplikasi</label>
                                        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-md">Format PNG transparan (maks 2MB). Jika dikosongkan, sistem otomatis menggunakan lambang Garuda resmi.</p>
                                        {formIdentity.logoApp && (
                                            <button onClick={() => setFormIdentity({...formIdentity, logoApp: null})} className="text-[12px] font-bold text-red-600 hover:text-red-700 mt-2 flex items-center gap-1 cursor-pointer">
                                                <Icon name="delete" className="text-[16px]" />
                                                <span>Hapus Logo Kustom (Pakai Bawaan)</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="relative w-24 h-24 shrink-0 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center hover:border-red-500 transition-all cursor-pointer overflow-hidden group">
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                        {isUploadingLogo ? (
                                            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            formIdentity.logoApp ? (
                                                <img src={formIdentity.logoApp} className="w-full h-full object-contain p-2" alt="Logo Kustom" />
                                            ) : (
                                                <div className="flex flex-col items-center text-slate-400 group-hover:text-red-600 transition-colors">
                                                    <Icon name="add_photo_alternate" className="text-[26px]" />
                                                    <span className="text-[10px] font-bold mt-1">Upload</span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </PengaturanSection>
                    )}

                    {activeMenu === 'nominal' && (
                        <PengaturanSection title="Iuran Wajib Warga" onSave={() => handleSaveAll('nominal')}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Nominal Arisan Wajib (Rp)</label>
                                    <input type="number" min="0" value={formNominal.arisan} onChange={e => setFormNominal({...formNominal, arisan: e.target.value})} className="w-full bg-transparent border-none text-[16px] font-bold outline-none p-0 text-slate-900 dark:text-white" />
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Nominal Jimpitan Wajib (Rp)</label>
                                    <input type="number" min="0" value={formNominal.jimpitan} onChange={e => setFormNominal({...formNominal, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[16px] font-bold outline-none p-0 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                        </PengaturanSection>
                    )}

                    {activeMenu === 'kalibrasi' && (
                        <PengaturanSection title="Kalibrasi Siklus &amp; Bulan Arisan" onSave={() => handleSaveAll('kalibrasi')}>
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Bulan &amp; Tahun Periode Berjalan</label>
                                    <input type="month" value={formPeriod} onChange={e => setFormPeriod(e.target.value)} className="w-full bg-transparent border-none text-[14px] font-semibold outline-none p-0 text-slate-900 dark:text-white cursor-pointer" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Putaran Ke-</label>
                                        <input type="number" min="1" value={formRound.round} onChange={e => setFormRound({...formRound, round: e.target.value})} className="w-full bg-transparent border-none text-[16px] font-bold outline-none p-0 text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Siklus Ke-</label>
                                        <input type="number" min="1" value={formRound.cycle} onChange={e => setFormRound({...formRound, cycle: e.target.value})} className="w-full bg-transparent border-none text-[16px] font-bold outline-none p-0 text-slate-900 dark:text-white" />
                                    </div>
                                </div>
                            </div>
                        </PengaturanSection>
                    )}

                    {activeMenu === 'saldo' && (
                        <PengaturanSection title="Koreksi Saldo Kas Manual" onSave={() => handleSaveAll('saldo')}>
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Saldo Kas Warga Utama (Rp)</label>
                                    <input type="number" min="0" value={formSaldo.kasRt} onChange={e => setFormSaldo({...formSaldo, kasRt: e.target.value})} className="w-full bg-transparent border-none text-[16px] font-bold outline-none p-0 text-slate-900 dark:text-white" />
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 dark:focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Saldo Jimpitan Berjalan (Rp)</label>
                                    <input type="number" min="0" value={formSaldo.jimpitan} onChange={e => setFormSaldo({...formSaldo, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[16px] font-bold outline-none p-0 text-slate-900 dark:text-white" />
                                </div>
                            </div>
                        </PengaturanSection>
                    )}

                    {activeMenu === 'banner' && (
                        <PengaturanSection title="Gambar Latar Banner Utama" onSave={() => handleSaveAll('banner')}>
                            <div className={`flex flex-col gap-4 bg-slate-50 dark:bg-slate-850 border ${isUploadingBanner ? 'border-red-500 shadow-md' : 'border-slate-200 dark:border-slate-750'} p-5 rounded-2xl transition-all`}>
                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Unggah Foto (Orientasi Lebar / Landscape Disarankan)</label>
                                <div className="relative overflow-hidden w-full h-16 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center px-4 hover:border-red-500 transition-colors cursor-pointer">
                                    <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={isUploadingBanner} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                    {isUploadingBanner ? (
                                        <div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div><span className="font-bold text-[13px] text-red-600">Mengompres &amp; Mengunggah...</span></div>
                                    ) : (
                                        <div className="flex items-center gap-3"><Icon name="add_photo_alternate" className="text-slate-400 text-[22px]" /><span className="font-bold text-[13px] text-slate-700 dark:text-slate-200">{formBanner ? "Ganti Gambar Banner Baru" : "Pilih File Gambar (Maks 10MB)"}</span></div>
                                    )}
                                </div>
                                {formBanner && !isUploadingBanner && (
                                    <div className="relative mt-2 h-36 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                        <img src={formBanner} alt="Preview Banner" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button onClick={(e) => { e.preventDefault(); setFormBanner(''); }} className="bg-red-600 text-white text-[12px] font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg">
                                                <Icon name="delete" className="text-[16px]"/> Hapus Banner
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </PengaturanSection>
                    )}

                    {activeMenu === 'landing' && (
                        <PengaturanSection title="Teks Beranda &amp; Integrasi" onSave={() => handleSaveAll('landing')}>
                            <div className="space-y-6">
                                <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-4">
                                    <h4 className="text-[14px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Icon name="newspaper" className="text-red-500 text-[18px]" />
                                        <span>Seksi Berita &amp; Pengumuman</span>
                                    </h4>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Subjudul</label>
                                        <input type="text" value={formLanding.newsSubtitle} onChange={e => setFormLanding({...formLanding, newsSubtitle: e.target.value})} className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Judul Utama</label>
                                        <input type="text" value={formLanding.newsTitle} onChange={e => setFormLanding({...formLanding, newsTitle: e.target.value})} className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white" />
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-4">
                                    <h4 className="text-[14px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Icon name="vertical_align_bottom" className="text-red-500 text-[18px]" />
                                        <span>Bagian Footer (Bawah)</span>
                                    </h4>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Slogan / Tagline</label>
                                        <input type="text" value={formLanding.footerTagline} onChange={e => setFormLanding({...formLanding, footerTagline: e.target.value})} className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Judul Info Resmi</label>
                                        <input type="text" value={formLanding.footerInfoTitle} onChange={e => setFormLanding({...formLanding, footerInfoTitle: e.target.value})} className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white" />
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Teks Bukti Verifikasi</label>
                                        <input type="text" value={formLanding.footerInfoDesc} onChange={e => setFormLanding({...formLanding, footerInfoDesc: e.target.value})} className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white" />
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-4">
                                    <h4 className="text-[14px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        <Icon name="ads_click" className="text-red-500 text-[18px]" />
                                        <span>Integrasi Google AdSense</span>
                                    </h4>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-red-500 transition-all shadow-sm">
                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1 uppercase tracking-widest">Google AdSense Publisher ID</label>
                                        <input type="text" value={formLanding.adsenseClientId || ''} onChange={e => setFormLanding({...formLanding, adsenseClientId: e.target.value})} placeholder="Contoh: ca-pub-XXXXXXXXXXXXXXXX" className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white font-mono" />
                                    </div>
                                    <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                                        <Icon name="info" className="text-[15px] text-blue-500 shrink-0 mt-0.5" />
                                        <span>Masukkan Publisher ID Anda untuk mengaktifkan iklan otomatis (Auto Ads) secara resmi.</span>
                                    </p>
                                </div>
                            </div>
                        </PengaturanSection>
                    )}

                    {activeMenu === 'whatsapp' && (
                        <PengaturanSection title="Setelan Grup WhatsApp Warga" onSave={() => handleSaveAll('whatsapp')}>
                            <div className="space-y-4">
                                <div className="bg-slate-50 dark:bg-slate-850 rounded-2xl p-4 border border-slate-200 dark:border-slate-750 focus-within:border-red-500 transition-all shadow-sm">
                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block mb-1.5 uppercase tracking-widest">Link Undangan Grup WhatsApp (Invite Link)</label>
                                    <input type="text" value={formLanding.whatsappGroupLink || ''} onChange={e => setFormLanding({...formLanding, whatsappGroupLink: e.target.value})} placeholder="Contoh: https://chat.whatsapp.com/..." className="w-full bg-transparent border-none text-[13.5px] font-semibold outline-none p-0 text-slate-900 dark:text-white placeholder:text-slate-400" />
                                </div>
                                <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1.5">
                                    <Icon name="info" className="text-[15px] text-emerald-500 shrink-0 mt-0.5" />
                                    <span>Tautan undangan grup ini otomatis dibagikan kepada warga setelah pengajuan pendaftaran mereka diverifikasi oleh Pengurus RT.</span>
                                </p>
                            </div>
                        </PengaturanSection>
                    )}

                    {activeMenu === 'sponsor' && (
                        <SponsorSection sponsorsData={props.sponsorsData} setSponsorsData={props.setSponsorsData} showAlert={showAlert} />
                    )}
                    
                    {activeMenu === 'legal' && (
                        <div className="bento-island-card p-6 sm:p-8 space-y-6">
                            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                                    <Icon name="gavel" className="text-[22px]" />
                                </div>
                                <div>
                                    <h2 className="text-[18px] sm:text-[20px] font-extrabold text-slate-900 dark:text-white tracking-tight">Hukum &amp; Kebijakan</h2>
                                    <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Syarat &amp; Ketentuan serta Kebijakan Privasi Portal</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <label className="flex items-center justify-between p-4 sm:p-5 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-750 cursor-pointer hover:border-red-500/40 transition-all">
                                    <div>
                                        <p className="text-[14px] font-bold text-slate-900 dark:text-white">Aktifkan Halaman Kebijakan</p>
                                        <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Tampilkan tautan kebijakan pada menu dan layar gerbang login</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => props.setLegalData(p => ({...p, enabled: !p?.enabled}))} 
                                        className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-300 ${props.legalData?.enabled ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                    >
                                        <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ${props.legalData?.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                    </button>
                                </label>

                                {props.legalData?.enabled && (
                                    <div className="space-y-5 animate-fade-in">
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-widest">Syarat &amp; Ketentuan</label>
                                            <textarea value={props.legalData?.terms || ''} onChange={(e) => props.setLegalData(p => ({...p, terms: e.target.value}))} rows="6" className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-4 text-[13px] font-medium outline-none transition-all resize-y custom-scrollbar min-h-[120px]" placeholder="Isi Syarat dan Ketentuan..."></textarea>
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2 uppercase tracking-widest">Kebijakan Privasi</label>
                                            <textarea value={props.legalData?.privacy || ''} onChange={(e) => props.setLegalData(p => ({...p, privacy: e.target.value}))} rows="6" className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white rounded-2xl p-4 text-[13px] font-medium outline-none transition-all resize-y custom-scrollbar min-h-[120px]" placeholder="Isi Kebijakan Privasi..."></textarea>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button onClick={() => showAlert('Kebijakan Hukum & Privasi berhasil disimpan!')} className="btn-native-action w-full min-h-[46px] py-3.5 px-6 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-[14px] shadow-lg shadow-red-500/25 border border-red-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer">
                                <Icon name="save" className="text-[18px]" />
                                <span>Simpan Kebijakan Hukum &amp; Privasi</span>
                            </button>
                        </div>
                    )}

                    {activeMenu === 'infodesa' && (
                        <InfoDesaSection infoDesa={props.infoDesa} setInfoDesa={props.setInfoDesa} showAlert={showAlert} />
                    )}

                    {activeMenu === 'reset' && (
                        <div className="bento-island-card p-6 sm:p-10 border border-red-500/40 relative overflow-hidden bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-2xl">
                            <Icon name="warning" className="absolute -right-6 -top-6 text-[180px] text-white opacity-10 pointer-events-none" fill="true" />
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
                                        <Icon name="report" className="text-[28px] text-white" fill="true" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-[20px] sm:text-[22px] tracking-tight">Zona Berbahaya: Format Database Total</h3>
                                        <p className="text-[12px] text-white/80 font-medium">Tindakan ini permanen dan tidak dapat dipulihkan</p>
                                    </div>
                                </div>
                                <p className="text-[13px] font-medium text-white/90 max-w-2xl leading-relaxed">
                                    Tindakan ini akan mengosongkan seluruh data warga, arsip pertemuan arisan, kas RT, jimpitan, mutasi inventaris, dan mengatur ulang siklus kembali ke awal (Setelan Pabrik).
                                </p>
                                <div className="pt-2">
                                    <button onClick={() => setConfirmResetModal(true)} className="min-h-[46px] px-6 py-3.5 bg-white text-red-600 hover:bg-slate-100 rounded-2xl font-bold text-[14px] shadow-lg shadow-black/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto">
                                        <Icon name="delete_forever" className="text-[20px]" />
                                        <span>Format Database Sekarang</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL PESAN NOTIFIKASI */}
            {modalConfig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in shadow-2xl">
                        <div className="mb-5 bg-emerald-50 dark:bg-emerald-950/40 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <Icon name="check_circle" className="text-[40px]" fill="true" />
                        </div>
                        <p className="text-slate-900 dark:text-white text-[16px] font-bold mb-6 leading-snug tracking-tight">
                            {modalConfig.message}
                        </p>
                        <button onClick={() => setModalConfig(null)} className="btn-native-action w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-bold text-[13px] border border-red-500/30 active:scale-95 transition-all shadow-md cursor-pointer">
                            Tutup Pesan
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL KONFIRMASI RESET TOTAL */}
            {confirmResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print modal-backdrop animate-backdrop-in">
                    <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-6 sm:p-8 w-full max-w-sm text-left border border-red-500/30 modal-card animate-modal-in shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center border border-red-500/20">
                            <Icon name="warning" className="text-[26px]" fill="true" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-extrabold text-red-600 tracking-tight">Reset Total?</h3>
                            <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Seluruh basis data akan dihapus permanen. Untuk melanjutkan, ketik kata <b className="text-red-600 dark:text-red-400 font-mono">RESET</b> di bawah ini:
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 border border-red-500/40 focus-within:border-red-600 transition-all">
                            <input 
                                type="text" 
                                value={resetPromptInput} 
                                onChange={e => setResetPromptInput(e.target.value)} 
                                className="w-full bg-transparent border-none text-[18px] outline-none p-0 text-red-600 dark:text-red-400 uppercase tracking-widest font-black text-center placeholder:text-red-300 dark:placeholder:text-red-900" 
                                placeholder="RESET" 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button onClick={() => { setConfirmResetModal(false); setResetPromptInput(''); }} className="min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-[13px] border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer">
                                Batal
                            </button>
                            <button onClick={executeFactoryReset} className="min-h-[44px] bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-[13px] shadow-lg shadow-red-600/30 border border-red-500/30 active:scale-95 transition-all cursor-pointer">
                                Eksekusi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Pengaturan;
