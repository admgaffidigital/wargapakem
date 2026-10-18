import React, { useState, useRef, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';

// Audio normalizer helper
function normalizeAudioUrl(url) {
    if (!url) return '';
    try {
        if (url.includes('dropbox.com')) {
            let normalized = url
                .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                .replace('?dl=0', '')
                .replace('?dl=1', '')
                .replace('&dl=0', '')
                .replace('&dl=1', '');
            return normalized;
        }
        const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (driveMatch) {
            return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
        }
        return url;
    } catch(e) {
        return url;
    }
}

        function MusicAdmin({ musicData, setMusicData }) {
            const [urlInput, setUrlInput] = useState('');
            const [nameInput, setNameInput] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            const [previewUrl, setPreviewUrl] = useState('');
            const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'testing' | 'ok' | 'fail'
            const previewAudioRef = useRef(null);

            const currentUrl = musicData?.url || '';
            const currentName = musicData?.name || '';
            const isEnabled = musicData?.enabled !== false;

            const handlePreviewTest = () => {
                if (!urlInput.trim()) return setErrorMsg('Masukkan URL terlebih dahulu.');
                const normalized = normalizeAudioUrl(urlInput.trim());
                setPreviewUrl(normalized);
                setTestStatus('testing');
                setErrorMsg('');
            };

            // Ketika previewUrl berubah, coba load audio
            useEffect(() => {
                if (!previewUrl || !previewAudioRef.current) return;
                const audio = previewAudioRef.current;
                audio.src = previewUrl;
                audio.load();
                const onCanPlay = () => setTestStatus('ok');
                const onError = () => setTestStatus('fail');
                audio.addEventListener('canplay', onCanPlay);
                audio.addEventListener('error', onError);
                return () => {
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.removeEventListener('error', onError);
                };
            }, [previewUrl]);

            const handleSaveUrl = () => {
                if (!urlInput.trim()) return setErrorMsg('URL musik tidak boleh kosong.');
                if (!urlInput.startsWith('http')) return setErrorMsg('URL harus dimulai dengan http:// atau https://');
                const normalized = normalizeAudioUrl(urlInput.trim());
                setMusicData({ url: normalized, name: nameInput.trim() || 'Musik RT', enabled: true });
                setUrlInput('');
                setNameInput('');
                setErrorMsg('');
                setPreviewUrl('');
                setTestStatus('idle');
                showToast('Musik berhasil disimpan!');
            };

            const handleDeleteMusic = () => {
                setMusicData({ url: '', name: '', enabled: false });
                showToast('Musik berhasil dihapus.', 'error');
            };

            const handleToggleEnabled = () => {
                setMusicData({ ...musicData, enabled: !isEnabled });
                showToast(isEnabled ? 'Musik dinonaktifkan.' : 'Musik diaktifkan.');
            };

            return (
                <div className="space-y-8 w-full">
                    {/* Hidden audio for test */}
                    <audio ref={previewAudioRef} preload="auto" style={{ display: 'none' }} />

                    {/* Header */}
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-google-yellowLight flex items-center justify-center border border-google-yellow/40 shrink-0">
                                <Icon name="music_note" className="text-[32px] text-google-yellowDark" fill="true" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-medium text-google-text tracking-tight">Musik Warga</h2>
                                <p className="text-[12px] font-medium text-google-textVariant mt-0.5">Musik otomatis memutar untuk semua pengunjung Warga.</p>
                            </div>
                        </div>
                    </div>

                    {/* Status Musik Terpasang */}
                    {currentUrl ? (
                        <div className={`rounded-3xl p-6 border ${isEnabled ? 'bg-google-greenLight border-google-green/40' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border ${isEnabled ? 'bg-google-green border-google-greenDark' : 'bg-slate-300 border-slate-400'}`}>
                                        <Icon name={isEnabled ? 'graphic_eq' : 'music_off'} className="text-white text-[17px]" fill="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-medium uppercase tracking-widest text-google-textVariant">{isEnabled ? 'Aktif' : 'Nonaktif'}</p>
                                        <p className="font-medium text-[13px] text-google-text truncate">{currentName || 'Musik RT'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <button onClick={handleToggleEnabled}
                                            className={`px-3 py-2 rounded-full font-medium text-[11px] border transition-all active:scale-95 ${isEnabled ? 'bg-white text-google-greenDark border-google-green/40 hover:bg-google-greenLight' : 'bg-google-green text-white border-google-greenDark'}`}>
                                        {isEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                                    </button>
                                    <button onClick={handleDeleteMusic}
                                            className="px-3 py-2 rounded-full font-medium text-[11px] bg-google-redLight text-google-redDark border border-google-red/30 hover:bg-google-red hover:text-white active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                        <Icon name="delete" className="text-[12px]" /> Hapus
                                    </button>
                                </div>
                            </div>
                            {/* Preview player native browser */}
                            {isEnabled && (
                                <div className="bg-white/80 rounded-xl p-3 border border-google-green/30">
                                    <p className="text-[9px] font-medium text-google-greenDark mb-2 uppercase tracking-widest">Preview</p>
                                    <audio controls src={currentUrl} className="w-full" style={{ height: '36px' }}>
                                        Browser Anda tidak mendukung audio.
                                    </audio>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-3xl p-8 border border-dashed border-slate-400 text-center">
                            <Icon name="music_off" className="text-[40px] text-slate-300 mb-3" />
                            <p className="font-medium text-[14px] text-slate-500">Belum Ada Musik</p>
                            <p className="text-[12px] font-medium text-slate-400 mt-1">Masukkan URL Dropbox di bawah.</p>
                        </div>
                    )}

                    {/* Panduan Dropbox */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-blue-600 px-6 py-4 flex flex-wrap items-center gap-3">
                            <Icon name="cloud_upload" className="text-white text-[20px]" fill="true" />
                            <div>
                                <p className="text-white font-medium text-[13px]">Upload via Dropbox</p>
                                <p className="text-blue-100 text-[10px] font-medium">Cara terbaik G gratis, cepat, dan bebas CORS</p>
                            </div>
                        </div>
                        <div className="p-6 sm:p-8 md:p-6">
                            <ol className="space-y-5 mb-5">
                                {[
                                    { step: '1', text: 'Buka dropbox.com dan login (atau daftar gratis).', icon: 'open_in_new' },
                                    { step: '2', text: 'Upload file MP3/WAV/OGG ke Dropbox Anda.', icon: 'upload' },
                                    { step: '3', text: 'Klik kanan file G "Share" G "Copy Link" G salin link yang muncul.', icon: 'share' },
                                    { step: '4', text: 'Paste link di kolom URL di bawah. Sistem otomatis mengkonversi ke link streaming.', icon: 'paste' },
                                ].map(item => (
                                    <li key={item.step} className="flex flex-wrap items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center shrink-0 mt-0.5">{item.step}</div>
                                        <p className="text-[12px] font-medium text-google-textVariant leading-snug">{item.text}</p>
                                    </li>
                                ))}
                            </ol>

                            {/* Form Input */}
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-1.5 ml-1 uppercase tracking-widest">Nama Lagu</label>
                                    <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                                           placeholder="Contoh: Indonesia Raya Instrumental"
                                           className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-google-text rounded-xl px-4 py-3 text-[13px] font-medium outline-none transition-all placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-google-textVariant block mb-1.5 ml-1 uppercase tracking-widest">URL Dropbox / Link Audio Langsung</label>
                                    <input type="url" value={urlInput} onChange={e => { setUrlInput(e.target.value); setTestStatus('idle'); setErrorMsg(''); }}
                                           placeholder="https://www.dropbox.com/s/xxxxx/lagu.mp3?dl=0"
                                           className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white text-google-text rounded-xl px-4 py-3 text-[12px] font-medium outline-none transition-all placeholder:text-slate-400" />
                                </div>

                                {/* Test button */}
                                <button onClick={handlePreviewTest}
                                        className="w-full bg-slate-100 text-google-textVariant py-2.5 rounded-full font-medium text-[11px] border border-slate-200 hover:bg-slate-200 active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2">
                                    <Icon name="play_circle" className="text-[14px]" /> Test Apakah URL Bisa Diputar
                                </button>

                                {/* Test result */}
                                {testStatus === 'testing' && (
                                    <div className="flex flex-wrap items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-xl text-[11px] font-medium border border-blue-200">
                                        <div className="w-3.5 h-3.5 border border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                        Mengecek URL...
                                    </div>
                                )}
                                {testStatus === 'ok' && (
                                    <div className="bg-google-greenLight border border-google-green/40 rounded-xl p-3">
                                        <p className="text-[11px] font-medium text-google-greenDark mb-2 flex flex-wrap items-center gap-1.5">
                                            <Icon name="check_circle" className="text-[13px]" fill="true" /> URL Valid Preview:
                                        </p>
                                        <audio controls src={previewUrl} className="w-full" style={{ height: '34px' }} />
                                    </div>
                                )}
                                {testStatus === 'fail' && (
                                    <div className="flex flex-wrap items-center gap-2 bg-google-redLight text-google-redDark px-4 py-2.5 rounded-xl text-[11px] font-medium border border-google-red/30">
                                        <Icon name="error" className="text-[13px]" fill="true" />
                                        URL gagal dimuat. Pastikan link Dropbox sudah benar dan file publik (tidak private).
                                    </div>
                                )}

                                {errorMsg && (
                                    <div className="flex flex-wrap items-center gap-2 bg-google-redLight text-google-redDark px-4 py-2.5 rounded-xl font-medium text-[11px] border border-google-red/30">
                                        <Icon name="error" className="text-[13px]" fill="true" /> {errorMsg}
                                    </div>
                                )}

                                <button onClick={handleSaveUrl}
                                        className="w-full bg-google-green text-white py-3.5 rounded-full font-medium text-[13px] border border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2">
                                    <Icon name="save" className="text-[17px]" /> Simpan & Aktifkan Musik
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-google-yellowLight rounded-3xl p-6 sm:p-8 md:p-8 border border-google-yellow/40 flex flex-wrap items-start gap-3">
                        <Icon name="info" className="text-[17px] text-google-yellowDark shrink-0 mt-0.5" fill="true" />
                        <ul className="text-[11px] font-medium text-google-yellowDark/90 space-y-1 list-disc list-inside">
                            <li>Musik <span className="underline decoration-dotted">hanya memutar</span> untuk pengguna login sebagai <span className="underline decoration-dotted">Warga</span>.</li>
                            <li>Admin tidak mendengar musik saat login sebagai Admin.</li>
                            <li>Browser mobile kadang memblokir autoplay G warga cukup tap layar sekali.</li>
                            <li>Gunakan file audio bebas hak cipta atau milik sendiri.</li>
                        </ul>
                    </div>
                </div>
            );
        }

        

export default MusicAdmin;
