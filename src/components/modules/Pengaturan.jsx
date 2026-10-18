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
                    <div className="space-y-8">
                        {/* Toggle Aktif */}
                        <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 cursor-pointer hover:bg-google-blueLight/20 hover:border-google-blue/40 dark:hover:bg-slate-850/20 transition-all duration-200">
                            <div>
                                <p className="text-[13px] font-medium text-google-text dark:text-white">Aktifkan Info Desa</p>
                                <p className="text-[11px] text-google-textVariant dark:text-slate-300 font-medium mt-0.5">Tampilkan bagian batas & kontak di Peta Desa</p>
                            </div>
                            <div className="relative">
                                <input type="checkbox" className="sr-only peer" checked={localInfo.enabled} onChange={e => setLocalInfo({...localInfo, enabled: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-google-blue after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                            </div>
                        </label>

                        {localInfo.enabled && (
                            <>
                                {/* Batas Administrasi */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                    <h4 className="font-medium text-[13px] text-google-text dark:text-white mb-4">Batas Administrasi</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                            <div key={arah} className="bg-white dark:bg-slate-800 rounded-xl px-4 py-2 border border-slate-200 dark:border-slate-700 focus-within:border-google-blue transition-all">
                                                <label className="text-[9px] font-medium text-google-textVariant dark:text-slate-400 block mb-1 uppercase tracking-widest">{arah}</label>
                                                <input type="text" value={localInfo.batas?.[arah] || ''} onChange={e => updateBatas(arah, e.target.value)} className="w-full bg-transparent border-none text-[12px] font-medium outline-none p-0 text-google-text dark:text-white" placeholder={`Batas ${arah}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Kontak Penting */}
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                                    <h4 className="font-medium text-[13px] text-google-text dark:text-white mb-4">Kontak Penting</h4>
                                    <div className="space-y-5 mb-4">
                                        {localInfo.kontak?.map((k, idx) => {
                                            const idKey = k.id || k.nama;
                                            return (
                                            <div key={idKey} className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-750 relative group">
                                                <div className="flex-1">
                                                    <input type="text" value={k.nama} onChange={e => updateKontak(idKey, 'nama', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[12px] font-medium outline-none focus:border-google-blue text-google-text dark:text-white mb-2" placeholder="Nama Layanan" />
                                                    <input type="text" value={k.telepon} onChange={e => updateKontak(idKey, 'telepon', e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[12px] font-medium outline-none focus:border-google-blue text-google-text dark:text-white" placeholder="Nomor Telepon" />
                                                </div>
                                                <button onClick={() => removeKontak(idKey)} className="self-end sm:self-center bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-2 rounded-full hover:bg-red-100 transition-colors">
                                                    <Icon name="delete" className="text-[17px]" />
                                                </button>
                                            </div>
                                        )})}
                                    </div>
                                    <button onClick={addKontak} className="w-full py-3 border border-dashed border-slate-400 dark:border-slate-650 rounded-full text-google-textVariant dark:text-slate-400 font-medium text-[12px] hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-google-blue hover:border-google-blue transition-all flex items-center justify-center gap-2">
                                        <Icon name="add" className="text-[16px]" /> Tambah Kontak
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

            // Gunakan base64 dengan kompresi Canvas agar ukuran sangat kecil (< 50KB) dan aman masuk Firestore
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
                // Gunakan functional update agar tidak terkena stale closure saat onSnapshot Firebase tiba
                setSponsorsData(prev => {
                    const current = prev?.sponsors || [];
                    return { ...prev, sponsors: [...current, { name: nameToSave, url: urlToSave }] };
                });
                setNewName(''); setNewUrl(''); setPreviewUrl(''); setUploadError('');
                showAlert('Sponsor berhasil ditambahkan dan disimpan!');
            };

            return (
            <PengaturanSection title="Manajemen Sponsor" onSave={() => showAlert('Pengaturan Sponsor berhasil disimpan.')}>
                <div className="space-y-6">
                 <label className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 cursor-pointer hover:bg-google-blueLight/20 hover:border-google-blue/40 dark:hover:bg-slate-850/20 transition-all duration-200">
                    <div>
                    <p className="text-[13px] font-medium text-google-text dark:text-white">Aktifkan Tampilan Sponsor</p>
                    <p className="text-[11px] text-google-textVariant dark:text-slate-300 font-medium mt-0.5">Tampilkan logo-logo sponsor di halaman utama</p>
                    </div>
                    <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={sponsorsData?.enabled || false} onChange={e => {
                        const checked = e.target.checked;
                        // Functional update agar enabled tidak hilang saat onSnapshot tiba
                        setSponsorsData(prev => ({ ...prev, enabled: checked }));
                    }} />
                    <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 peer-checked:bg-google-blue rounded-full transition-colors peer"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-6 peer"></div>
                    </div>
                 </label>
                 {sponsorsData?.enabled && (
                    <div className="mt-2 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-7">
                    <div>
                        <p className="text-[10px] font-medium text-google-textVariant dark:text-slate-400 uppercase tracking-widest mb-3">Daftar Sponsor</p>
                        <div className="space-y-2">
                        {sponsorsData?.sponsors?.map((s, i) => (
                            <div key={i} className="flex items-center justify-between bg-white dark:bg-slate-850 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-750 gap-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <img src={s.url} alt={s.name} className="h-9 w-16 object-contain shrink-0 rounded bg-slate-50 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700" onError={(e) => { e.target.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>=+n+</text></svg>'; }} />
                                <span className="text-[12px] font-medium text-google-text dark:text-white truncate">{s.name}</span>
                            </div>
                            <button onClick={() => {
                                const idx = i;
                                // Functional update agar hapus tidak terkena stale closure
                                setSponsorsData(prev => {
                                    const ns = [...(prev?.sponsors || [])]; ns.splice(idx, 1);
                                    return { ...prev, sponsors: ns };
                                });
                            }} className="text-google-red hover:bg-red-50 dark:hover:bg-red-950/20 w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0"><Icon name="delete" className="text-[17px]" /></button>
                            </div>
                        ))}
                        {(!sponsorsData?.sponsors || sponsorsData.sponsors.length === 0) && (
                            <p className="text-[11px] italic text-slate-400 dark:text-slate-500 text-center py-3">Belum ada sponsor. Tambahkan di bawah.</p>
                        )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-6">
                        <p className="text-[10px] font-medium text-google-textVariant dark:text-slate-400 uppercase tracking-widest">Tambah Sponsor Baru</p>

                        <div className="bg-white dark:bg-slate-850 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-google-blue transition-all shadow-sm">
                        <label className="text-[9px] font-medium text-google-textVariant dark:text-slate-400 block mb-1 uppercase tracking-widest">Nama Sponsor</label>
                        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Misal: Bank BRI Cabang Pakem" className="w-full bg-transparent text-[13px] font-medium text-google-text dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 outline-none" />
                        </div>

                        <div>
                        <p className="text-[9px] font-medium text-google-textVariant dark:text-slate-400 uppercase tracking-widest mb-2">Logo / Gambar Sponsor</p>
                        <label className={`relative w-full h-16 bg-white dark:bg-slate-850 border ${isUploading ? 'border-google-blue bg-google-blueLight/20 dark:bg-google-blueLight/10' : 'border-slate-200 dark:border-slate-700 hover:border-google-blue/50'} rounded-xl flex items-center justify-center px-4 cursor-pointer transition-all duration-200 overflow-hidden`}>
                            <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                            {isUploading ? (
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin shrink-0"></div>
                                <span className="font-medium text-[12px] text-google-blue">Mengunggah logo...</span>
                            </div>
                            ) : (
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-10 h-10 bg-google-blueLight dark:bg-slate-800 rounded-xl flex items-center justify-center border border-google-blue/30 dark:border-slate-700 shrink-0">
                                <Icon name="add_photo_alternate" className="text-google-blue text-[17px]" />
                                </div>
                                <div>
                                <p className="font-medium text-[12px] text-google-text dark:text-white">{previewUrl ? 'Ganti Gambar Logo' : 'Pilih File Logo (Maks 2MB)'}</p>
                                <p className="text-[10px] text-google-textVariant dark:text-slate-400 font-medium">PNG, JPG, SVG, WEBP • upload ke Google Drive</p>
                                </div>
                            </div>
                            )}
                        </label>
                        {uploadError && <p className="text-[10px] text-google-red font-medium mt-2 px-1">{uploadError}</p>}
                        </div>

                        {/* Preview */}
                        {previewUrl && !isUploading && (
                        <div className="flex items-center gap-3 bg-white dark:bg-slate-850 border border-google-green/30 dark:border-google-green/45 rounded-xl p-3 shadow-sm">
                            <img src={previewUrl} alt="preview" className="h-10 max-w-[80px] object-contain rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1" onError={(e) => e.target.style.display='none'} />
                            <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-google-green flex items-center gap-1"><Icon name="check_circle" className="text-[13px]"/>Logo siap disimpan</p>
                            <p className="text-[9px] text-google-textVariant dark:text-slate-400 truncate font-mono mt-0.5">{previewUrl.slice(0,60)}</p>
                            </div>
                            <button onClick={() => { setNewUrl(''); setPreviewUrl(''); setUploadError(''); }} className="text-google-red hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-full transition-colors shrink-0"><Icon name="close" className="text-[14px]" /></button>
                        </div>
                        )}

                        {/* Fallback URL manual */}
                        <details className="mt-1">
                        <summary className="text-[10px] font-medium text-google-textVariant dark:text-slate-400 cursor-pointer select-none hover:text-google-blue transition-colors flex items-center gap-1.5">
                            <Icon name="link" className="text-[13px]" /> Atau masukkan URL gambar secara manual
                        </summary>
                        <div className="mt-2 bg-white dark:bg-slate-850 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 focus-within:border-google-blue transition-all shadow-sm">
                            <input type="text" value={newUrl} onChange={e => { setNewUrl(e.target.value); setPreviewUrl(e.target.value); }} placeholder="https://contoh.com/logo.png" className="w-full bg-transparent text-[12px] font-mono text-google-text dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-500 outline-none" />
                        </div>
                        </details>
                    </div>

                    <button onClick={handleAdd} disabled={isUploading || !newName.trim() || !newUrl.trim()} className="w-full bg-google-blue border border-google-blueDark text-white py-4 rounded-full font-medium text-[13px] hover:bg-google-blueDark active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                        <Icon name="add_circle" className="text-[17px]" />Tambah &amp; Simpan Sponsor
                    </button>
                    </div>
                )}
                </div>
            </PengaturanSection>
            );
        }


        function PengaturanSection({ title, onSave, children }) {
            return (
                <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <h3 className="font-medium text-[17px] text-google-text mb-6 border-b border-slate-200 pb-4 group-hover:text-google-blue transition-colors tracking-tight">{title}</h3>
                    <div className="space-y-8 mb-8">{children}</div>
                    <button onClick={onSave} className="w-full bg-slate-50 border border-slate-200 text-google-blueDark py-4 rounded-full font-medium text-[13px] hover:bg-google-blue hover:border-google-blue hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95">Simpan {title}</button>
                </div>
            );
        }

        function Pengaturan(props) {
            const { nominalArisan, setNominalArisan, nominalJimpitan, setNominalJimpitan, identity, setIdentity, setMembers, setMeetingHistory, currentRound, setCurrentRound, cycleNumber, setCycleNumber, jimpitanBalance, setJimpitanBalance, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions, arisanPeriod, setArisanPeriod, bannerImage, setBannerImage,
            // State tambahan untuk reset menyeluruh (diteruskan dari App)
            setIuranData, setGaleriData, setInventarisData, setInformasi, setNextMeeting, infoDesa, setInfoDesa, umkmData, setUmkmData, landingConfig, setLandingConfig } = props;
            
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
                { id: 'profil', title: 'Profil Aplikasi', icon: 'badge', bg: 'bg-google-blueLight', text: 'text-google-blueDark', border: 'border-google-blue/30', hoverBorder: 'hover:border-google-blue', groupHoverBg: 'group-hover:bg-google-blue', groupHoverText: 'group-hover:text-google-blueDark', desc: 'Nama & Kop Surat Aplikasi' },
                { id: 'nominal', title: 'Iuran Wajib', icon: 'payments', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hoverBorder: 'hover:border-amber-500', groupHoverBg: 'group-hover:bg-amber-500', groupHoverText: 'group-hover:text-amber-700', desc: 'Besaran Arisan & Jimpitan' },
                { id: 'kalibrasi', title: 'Kalibrasi Siklus', icon: 'build', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hoverBorder: 'hover:border-amber-500', groupHoverBg: 'group-hover:bg-amber-500', groupHoverText: 'group-hover:text-amber-700', desc: 'Atur Putaran & Siklus' },
                { id: 'saldo', title: 'Koreksi Saldo', icon: 'account_balance_wallet', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', hoverBorder: 'hover:border-slate-500', groupHoverBg: 'group-hover:bg-slate-500', groupHoverText: 'group-hover:text-slate-600', desc: 'Edit Saldo Kas Utama' },
                { id: 'banner', title: 'Banner Utama', icon: 'image', bg: 'bg-google-redLight', text: 'text-google-redDark', border: 'border-google-red/30', hoverBorder: 'hover:border-google-red', groupHoverBg: 'group-hover:bg-google-red', groupHoverText: 'group-hover:text-google-redDark', desc: 'Gambar Latar Halaman Depan' },
                { id: 'sponsor', title: 'Sponsor', icon: 'handshake', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hoverBorder: 'hover:border-emerald-500', groupHoverBg: 'group-hover:bg-emerald-500', groupHoverText: 'group-hover:text-emerald-700', desc: 'Logo Sponsor RT' },
                { id: 'legal', title: 'Kebijakan', icon: 'gavel', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', hoverBorder: 'hover:border-slate-500', groupHoverBg: 'group-hover:bg-slate-500', groupHoverText: 'group-hover:text-slate-600', desc: 'Syarat & Privasi' },
                { id: 'infodesa', title: 'Info Desa', icon: 'map', bg: 'bg-google-redLight', text: 'text-google-redDark', border: 'border-google-red/30', hoverBorder: 'hover:border-google-red', groupHoverBg: 'group-hover:bg-google-red', groupHoverText: 'group-hover:text-google-redDark', desc: 'Kontak & Batas Wilayah' },
                { id: 'landing', title: 'Teks Beranda', icon: 'view_quilt', bg: 'bg-google-blueLight', text: 'text-google-blueDark', border: 'border-google-blue/30', hoverBorder: 'hover:border-google-blue', groupHoverBg: 'group-hover:bg-google-blue', groupHoverText: 'group-hover:text-google-blueDark', desc: 'Ubah teks landing page' },
                { id: 'whatsapp', title: 'Grup WhatsApp', icon: 'chat', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hoverBorder: 'hover:border-emerald-500', groupHoverBg: 'group-hover:bg-emerald-500', groupHoverText: 'group-hover:text-emerald-700', desc: 'Link & Akses Grup WA' },
                { id: 'reset', title: 'Reset Sistem', icon: 'warning', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', hoverBorder: 'hover:border-red-500', groupHoverBg: 'group-hover:bg-red-500', groupHoverText: 'group-hover:text-red-600', desc: 'Hapus Semua Data' }
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
                        // Gunakan functional update untuk hindari stale closure
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
                    // Reset data konten yang sering terlupakan
                    if (setIuranData) setIuranData([]);
                    if (setGaleriData) setGaleriData([]);
                    if (setInventarisData) setInventarisData([]);
                    if (setUmkmData) setUmkmData([]);
                    if (setLaporanData) setLaporanData([]);
                    if (setInformasi) setInformasi([]);
                    if (setNextMeeting) setNextMeeting({ date: 'Belum dijadwalkan', time: '-', location: '-', notes: '-' });
                    setBannerImage('');
                    // Bersihkan localStorage cache
                    try {
                        const keys = ['members','history','round','cycle','jimpitan','kas_rt_balance','kas_rt_trx','period','iuran_umum','galeri_warga','inventaris_rt','informasi','next_meeting','banner_image','umkm', 'laporan'];
                        keys.forEach(k => localStorage.removeItem('arisan_rt_' + k));
                    } catch(e) {}
                    setConfirmResetModal(false); setResetPromptInput(''); showAlert("Sistem berhasil di-reset total.");
                } else {
                    showAlert("Kode salah. Gagal reset."); setConfirmResetModal(false); setResetPromptInput('');
                }
            };

            // Upload Banner: Canvas compress → base64 → Firestore (tanpa GAS)
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
                        <div key={menu.id} onClick={() => setActiveMenu(menu.id)} className={`bento-island-card p-5 sm:p-7 hover:border-red-500/30 cursor-pointer transition-all duration-300 group flex flex-col items-center text-center gap-3.5`}>
                            <div className={`w-14 h-14 ${menu.bg} ${menu.text} rounded-2xl flex items-center justify-center border ${menu.border} group-hover:scale-110 ${menu.groupHoverBg} group-hover:text-white transition-all duration-300`}>
                                <Icon name={menu.icon} className="text-[24px]" fill="true" />
                            </div>
                            <div>
                                <h3 className={`font-medium text-[14px] text-google-text tracking-tight ${menu.groupHoverText} transition-colors`}>{menu.title}</h3>
                                <p className="text-[11px] font-medium text-google-textVariant mt-1">{menu.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            );

            const renderHeader = (menuId) => {
                const menu = pengaturanMenus.find(m => m.id === menuId);
                if (!menu) return null;
                return (
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <button onClick={() => setActiveMenu(null)} className="w-11 h-11 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-700 dark:text-slate-200 shrink-0 shadow-sm cursor-pointer">
                            <Icon name="arrow_back" className="text-[20px]" />
                        </button>
                        <div className={`w-12 h-12 ${menu.bg} ${menu.text} rounded-full flex items-center justify-center border ${menu.border} shrink-0`}>
                            <Icon name={menu.icon} className="text-[20px]" fill="true" />
                        </div>
                        <h2 className="text-[17px] font-medium text-google-text tracking-tight">{menu.title}</h2>
                    </div>
                );
            };

            return (
                <div className="space-y-8 tab-fade-in">
                    {activeMenu === null && (
                        <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-5">
                            <div className="bg-google-blueLight text-google-blue w-16 h-16 rounded-2xl flex items-center justify-center border border-google-blue/30 shrink-0"><Icon name="admin_panel_settings" className="text-[32px]" fill="true"/></div>
                            <div><h2 className="text-2xl font-medium text-google-text tracking-tight">Setelan Portal Admin</h2><p className="text-[13px] font-medium text-google-textVariant mt-1.5">Ubah konfigurasi fundamental aplikasi RT.</p></div>
                        </div>
                    )}

                    {activeMenu === null ? renderGridMenu() : (
                        <div className="w-full">
                            {renderHeader(activeMenu)}
                            
                            {activeMenu === 'profil' && (
                                <PengaturanSection title="Profil Utama Aplikasi" onSave={() => handleSaveAll('id')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Kop Surat (Baris 1)</label><input type="text" value={formIdentity.name} onChange={e => setFormIdentity({...formIdentity, name: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Sub Judul (Baris 2)</label><input type="text" value={formIdentity.subtitle} onChange={e => setFormIdentity({...formIdentity, subtitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Logo Aplikasi</label>
                                            <p className="text-[11px] text-slate-500 font-medium leading-snug">Format disarankan PNG transparan (maks 2MB). Kosongkan untuk pakai lambang Garuda bawaan.</p>
                                            {formIdentity.logoApp && (
                                                <button onClick={() => setFormIdentity({...formIdentity, logoApp: null})} className="text-[12px] font-medium text-google-red hover:underline mt-2 flex items-center gap-1"><Icon name="delete" className="text-[14px]" /> Hapus Logo Custom</button>
                                            )}
                                        </div>
                                        <div className="relative w-20 h-20 shrink-0 bg-slate-50 border border-dashed border-slate-400 rounded-2xl flex items-center justify-center hover:bg-google-blueLight/20 hover:border-google-blue/50 transition-all cursor-pointer overflow-hidden group">
                                            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            {isUploadingLogo ? (
                                                <div className="w-6 h-6 border border-google-blue border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                formIdentity.logoApp ? <img src={formIdentity.logoApp} className="w-full h-full object-contain p-2" alt="Logo" /> : <div className="flex flex-col items-center text-slate-400 group-hover:text-google-blue transition-colors"><Icon name="add_photo_alternate" className="text-[24px]" /><span className="text-[9px] font-medium mt-1">Upload</span></div>
                                            )}
                                        </div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'nominal' && (
                                <PengaturanSection title="Iuran Wajib" onSave={() => handleSaveAll('nominal')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Nominal Arisan (Rp)</label><input type="number" min="0" value={formNominal.arisan} onChange={e => setFormNominal({...formNominal, arisan: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Nominal Jimpitan (Rp)</label><input type="number" min="0" value={formNominal.jimpitan} onChange={e => setFormNominal({...formNominal, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'kalibrasi' && (
                                <PengaturanSection title="Kalibrasi Siklus & Bulan" onSave={() => handleSaveAll('kalibrasi')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Bulan & Tahun Arisan</label><input type="month" value={formPeriod} onChange={e => setFormPeriod(e.target.value)} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text cursor-pointer" /></div>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex-1 bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[9px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Putaran Ke-</label><input type="number" min="1" value={formRound.round} onChange={e => setFormRound({...formRound, round: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                        <div className="flex-1 bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[9px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Siklus Ke-</label><input type="number" min="1" value={formRound.cycle} onChange={e => setFormRound({...formRound, cycle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'saldo' && (
                                <PengaturanSection title="Koreksi Saldo Manual" onSave={() => handleSaveAll('saldo')}>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Saldo Kas Warga Utama (Rp)</label><input type="number" min="0" value={formSaldo.kasRt} onChange={e => setFormSaldo({...formSaldo, kasRt: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Saldo Jimpitan Berjalan (Rp)</label><input type="number" min="0" value={formSaldo.jimpitan} onChange={e => setFormSaldo({...formSaldo, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'banner' && (
                                <PengaturanSection title="Gambar Latar Banner Utama" onSave={() => handleSaveAll('banner')}>
                                    <div className={`flex flex-col gap-4 bg-white border ${isUploadingBanner ? 'border-google-blue shadow-md' : 'border-slate-200'} p-4 rounded-2xl transition-all`}>
                                        <label className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest">Unggah Foto (Orientasi Lebar/Landscape direkomendasikan)</label>
                                        <div className="relative overflow-hidden w-full h-14 bg-slate-50 border border-slate-200 rounded-xl flex items-center px-4 hover:border-google-blue transition-colors cursor-pointer">
                                            <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={isUploadingBanner} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            {isUploadingBanner ? (
                                                <div className="flex flex-wrap items-center gap-3"><div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div><span className="font-medium text-[12px] text-google-blue">Mengunggah...</span></div>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-3"><Icon name="add_photo_alternate" className="text-google-textVariant text-[20px]" /><span className="font-medium text-[12px] text-google-text">{formBanner ? "Ganti Gambar Baru" : "Pilih File Gambar (Maks 2MB)"}</span></div>
                                            )}
                                        </div>
                                        {formBanner && !isUploadingBanner && (
                                            <div className="relative mt-2 h-24 w-full rounded-xl overflow-hidden border border-slate-200 group">
                                                <img src={formBanner} alt="Preview Banner" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button onClick={(e) => { e.preventDefault(); setFormBanner(''); }} className="bg-google-red text-white text-[11px] font-medium px-4 py-2 rounded-full flex flex-wrap items-center gap-1"><Icon name="delete" className="text-[14px]"/> Hapus</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </PengaturanSection>
                            )}
                            {activeMenu === 'landing' && (
                                <PengaturanSection title="Teks Halaman Depan" onSave={() => handleSaveAll('landing')}>
                                    <div className="space-y-8">
                                        <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
                                            <h4 className="text-[13px] font-medium text-google-text">Seksi Berita &amp; Pengumuman</h4>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Subjudul</label><input type="text" value={formLanding.newsSubtitle} onChange={e => setFormLanding({...formLanding, newsSubtitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Judul Utama</label><input type="text" value={formLanding.newsTitle} onChange={e => setFormLanding({...formLanding, newsTitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                        </div>

                                        
                                        <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
                                            <h4 className="text-[13px] font-medium text-google-text">Bagian Footer (Bawah)</h4>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Slogan / Tagline</label><input type="text" value={formLanding.footerTagline} onChange={e => setFormLanding({...formLanding, footerTagline: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Judul Info Resmi</label><input type="text" value={formLanding.footerInfoTitle} onChange={e => setFormLanding({...formLanding, footerInfoTitle: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Teks Bukti Verifikasi</label><input type="text" value={formLanding.footerInfoDesc} onChange={e => setFormLanding({...formLanding, footerInfoDesc: e.target.value})} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                        </div>

                                        <div className="bg-slate-50 p-6 sm:p-8 rounded-2xl border border-slate-200 space-y-6">
                                            <h4 className="text-[13px] font-medium text-google-text">Integrasi Google AdSense</h4>
                                            <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Google AdSense Publisher ID</label><input type="text" value={formLanding.adsenseClientId || ''} onChange={e => setFormLanding({...formLanding, adsenseClientId: e.target.value})} placeholder="Contoh: ca-pub-XXXXXXXXXXXXXXXX" className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text" /></div>
                                            <p className="text-[11px] text-slate-500 leading-normal flex items-start gap-1">
                                                <Icon name="info" className="text-[13px] text-google-blue shrink-0 mt-0.5" /> Masukkan Publisher ID Anda untuk mengaktifkan iklan otomatis (Auto Ads). Pastikan Anda menyetujui penempatan iklan di dasbor Google AdSense Anda.
                                            </p>
                                        </div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'whatsapp' && (
                                <PengaturanSection title="Setelan Grup WhatsApp" onSave={() => handleSaveAll('whatsapp')}>
                                    <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-google-blue transition-all shadow-sm">
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Link Undangan Grup WhatsApp (Invite Link)</label>
                                        <input type="text" value={formLanding.whatsappGroupLink || ''} onChange={e => setFormLanding({...formLanding, whatsappGroupLink: e.target.value})} placeholder="Contoh: https://chat.whatsapp.com/..." className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400" />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-normal flex items-start gap-1">
                                        <Icon name="info" className="text-[13px] text-google-blue shrink-0 mt-0.5" /> Link grup WhatsApp ini akan dibagikan secara otomatis kepada warga setelah pengajuan gabung mereka disetujui oleh Admin.
                                    </p>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'sponsor' && (
                                <SponsorSection sponsorsData={props.sponsorsData} setSponsorsData={props.setSponsorsData} showAlert={showAlert} />
                            )}
                            
                            {activeMenu === 'legal' && (
                                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/50 shadow-sm relative overflow-hidden animate-fade-in">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-10"></div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200"><Icon name="gavel" className="text-[20px]" /></div>
                                        <div>
                                            <h2 className="text-[16px] md:text-[17px] font-medium text-slate-800 tracking-tight">Hukum & Kebijakan</h2>
                                            <p className="text-[12px] text-slate-500 font-medium">Syarat & Ketentuan serta Privasi</p>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                            <div>
                                                <p className="text-[13px] font-medium text-slate-800">Aktifkan Halaman Kebijakan</p>
                                                <p className="text-[11px] text-slate-500">Tampilkan link di menu dan layar login</p>
                                            </div>
                                            <button onClick={() => props.setLegalData(p => ({...p, enabled: !p?.enabled}))} className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${props.legalData?.enabled ? 'bg-google-green' : 'bg-slate-300'}`}>
                                                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${props.legalData?.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>

                                        {props.legalData?.enabled && (
                                            <div className="space-y-8 animate-fade-in">
                                                <div>
                                                    <label className="text-[11px] font-medium text-slate-500 block mb-2 ml-1 uppercase tracking-widest">Syarat & Ketentuan</label>
                                                    <textarea value={props.legalData?.terms || ''} onChange={(e) => props.setLegalData(p => ({...p, terms: e.target.value}))} rows="6" className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white text-slate-700 rounded-xl px-5 py-4 text-[13px] font-medium outline-none transition-all resize-y custom-scrollbar" placeholder="Isi Syarat dan Ketentuan..."></textarea>
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-medium text-slate-500 block mb-2 ml-1 uppercase tracking-widest">Kebijakan Privasi</label>
                                                    <textarea value={props.legalData?.privacy || ''} onChange={(e) => props.setLegalData(p => ({...p, privacy: e.target.value}))} rows="6" className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white text-slate-700 rounded-xl px-5 py-4 text-[13px] font-medium outline-none transition-all resize-y custom-scrollbar" placeholder="Isi Kebijakan Privasi..."></textarea>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => { showAlert('Kebijakan Hukum & Privasi berhasil disimpan!') }} className="w-full mt-8 bg-slate-50 border border-slate-200 text-google-blueDark py-4 rounded-full font-medium text-[13px] hover:bg-google-blue hover:border-google-blue hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95">Simpan Kebijakan</button>
                                </div>
                            )}
                            {activeMenu === 'infodesa' && (
                                <InfoDesaSection infoDesa={props.infoDesa} setInfoDesa={props.setInfoDesa} showAlert={showAlert} />
                            )}

                            {activeMenu === 'reset' && (
                                <div className="bg-google-red text-white p-8 sm:p-10 rounded-3xl border border-google-redDark shadow-xl relative overflow-hidden group">
                                    <Icon name="warning" className="absolute -right-5 -top-5 text-[160px] text-white opacity-10 group-hover:scale-110 transition-transform duration-700" fill="true" />
                                    <div className="relative z-10">
                                        <div className="flex items-center space-x-3 mb-4"><Icon name="report" className="text-[36px] text-white" fill="true" /><h3 className="font-medium text-[20px] tracking-tight">Bahaya: Hapus Semua Database</h3></div>
                                        <p className="text-[13px] font-medium mb-8 text-white/90 max-w-xl leading-relaxed">Tindakan ini akan menghapus seluruh data warga, riwayat keuangan, tunggakan, dan mengembalikan saldo kas menjadi nol kembali seperti baru (Setelan Pabrik).</p>
                                        <button onClick={() => setConfirmResetModal(true)} className="bg-white text-google-redDark px-8 py-4 rounded-full font-medium text-[13px] shadow-lg hover:shadow-xl active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto hover:bg-slate-50 border border-transparent hover:border-google-red"><Icon name="delete_forever" className="text-[17px]"/> Format Database Sekarang</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {modalConfig && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="mb-6 bg-google-greenLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-green/30"><Icon name="check_circle" className="text-[48px] text-google-green" fill="true" /></div>
                                <p className="text-google-text text-[17px] font-medium mb-8 leading-snug tracking-tight">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-google-blue text-white px-8 py-4 rounded-full font-medium text-[13px] border border-google-blueDark hover:bg-google-blueDark active:scale-95 transition-all duration-300 shadow-md">Tutup Pesan</button>
                            </div>
                        </div>
                    )}
                    {confirmResetModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-left border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <h3 className="text-3xl font-medium text-google-red mb-2 tracking-tight">Reset Total?</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Tindakan ini permanen dan tidak bisa dibatalkan. Ketik kata <b className="text-google-red">RESET</b> di bawah ini.</p>
                                <div className="bg-slate-50 rounded-2xl px-5 py-4 border border-google-red/40 focus-within:border-google-red focus-within:bg-white focus-within:shadow-md transition-all mb-8"><input type="text" value={resetPromptInput} onChange={e => setResetPromptInput(e.target.value)} className="w-full bg-transparent border-none text-[18px] outline-none p-0 text-google-redDark uppercase tracking-widest font-medium placeholder:text-google-red/30" placeholder="RESET" /></div>
                                <div className="flex flex-wrap gap-3"><button onClick={() => {setConfirmResetModal(false); setResetPromptInput('');}} className="w-full sm:w-auto bg-white text-google-text py-4 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button><button onClick={executeFactoryReset} className="flex flex-wrap bg-google-red text-white border border-google-redDark py-4 rounded-full font-medium text-[13px] shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2">Eksekusi</button></div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }



export default Pengaturan;
