import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import FlagWavingBackground from '../common/FlagWavingBackground.jsx';
import { auth, signInWithEmailAndPassword, signOut } from '../../firebase.js';

export function LoginScreen({
    onLogin,
    identity = {},
    setShowPwaGuide,
    legalData,
    setShowLegalModal,
    setShowLicenseModal,
    theme,
    setTheme
}) {
    const [loginRole, setLoginRole] = useState('warga'); // 'warga' | 'admin'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAdminLogin = async (e) => {
        if (e) e.preventDefault();
        if (!email.trim() || !password.trim()) {
            setError('Email dan Password wajib diisi.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            if (userCredential.user.uid === '7kGABJkj7APXHPtyVQUHQeoz0Cy1') {
                onLogin('admin');
            } else {
                await signOut(auth);
                setError('Akses ditolak. Akun tidak memiliki hak akses Pengurus.');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Login gagal. Periksa kembali email dan kata sandi Anda.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen flex flex-col justify-between bg-transparent text-slate-800 dark:text-slate-100 relative overflow-x-hidden font-sans">
            {/* Latar Belakang Bendera & Batik */}
            <FlagWavingBackground theme={theme} />
            <div className="fixed inset-0 z-[-2] bg-batik opacity-50 dark:opacity-30 pointer-events-none no-print"></div>

            {/* Ornamen Wayang & Gunungan Halus */}
            <div className="fixed top-[10vh] md:top-[12vh] left-1/2 -translate-x-1/2 z-0 pointer-events-none opacity-10 dark:opacity-5 transition-all duration-1000 no-print">
                <img src="./gunungan_transparent.png?v=4" alt="Gunungan" className="w-[85vw] md:w-[50vw] max-w-[600px] h-auto object-contain dark:invert" />
            </div>
            <div className="fixed bottom-0 -left-4 sm:left-0 md:left-4 z-0 pointer-events-none opacity-15 dark:opacity-10 transition-all duration-1000 no-print scale-x-[-1]">
                <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kiri" className="w-[40vw] md:w-[28vw] max-w-[400px] h-auto max-h-[50vh] object-contain object-bottom animate-wayang dark:invert" />
            </div>
            <div className="fixed bottom-0 -right-4 sm:right-0 md:right-4 z-0 pointer-events-none opacity-15 dark:opacity-10 transition-all duration-1000 no-print">
                <img src="./wayang_transparent.png?v=3" alt="Wayang Kulit Kanan" className="w-[40vw] md:w-[28vw] max-w-[400px] h-auto max-h-[50vh] object-contain object-bottom animate-wayang dark:invert" style={{ animationDelay: '1.5s' }} />
            </div>

            {/* TOP BAR RINGKAS */}
            <header className="w-full max-w-5xl mx-auto px-4 pt-4 sm:pt-6 z-20 no-print">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md py-3 px-4 sm:px-6 rounded-2xl sm:rounded-3xl border border-red-500/20 dark:border-red-900/40 shadow-lg shadow-red-500/5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="bg-google-red text-white w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 flex justify-center items-center shadow-md shadow-red-500/20 border border-red-400/40">
                            <img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-[13px] sm:text-[15px] font-bold truncate leading-tight tracking-tight text-slate-800 dark:text-slate-100">
                                {identity?.name || 'Portal Warga RT - PAKEM'}
                            </h1>
                            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                                {identity?.subtitle || 'Banyuanyar, Gurah, Kediri'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {setShowPwaGuide && (
                            <button
                                onClick={() => setShowPwaGuide(true)}
                                className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full flex justify-center items-center transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                                title="Panduan Install Aplikasi (PWA)"
                            >
                                <Icon name="install_mobile" className="text-[16px] sm:text-[18px] text-google-blue" />
                            </button>
                        )}
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full flex justify-center items-center transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                            title="Ganti Mode Gelap / Terang"
                        >
                            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-[16px] sm:text-[18px]" />
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT: PANEL LOGIN & OTORISASI */}
            <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 z-10 w-full">
                <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[28px] sm:rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-2xl p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
                    {/* Header Strip Aksen Merah */}
                    <div className="h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r from-red-600 via-rose-500 to-red-600"></div>

                    {/* Logo & Headline Lingkungan */}
                    <div className="text-center mb-6">
                        <div className="mx-auto mb-3 bg-red-50 dark:bg-red-950/30 w-20 h-20 rounded-full flex items-center justify-center border border-red-500/20 shadow-inner overflow-hidden">
                            <img
                                src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"}
                                alt="Lambang Garuda"
                                className={identity?.logoApp ? "w-full h-full object-cover" : "w-13 h-13 object-contain"}
                            />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                            {identity?.name || 'Portal Warga RT'}
                        </h2>
                        <p className="text-[12px] sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 mt-1">
                            Sistem Informasi Manajemen Kerukunan Lingkungan
                        </p>
                    </div>

                    {/* SEGMENTED TAB SWITCHER: WARGA vs ADMIN */}
                    <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-6 border border-slate-200/60 dark:border-slate-700/60">
                        <button
                            type="button"
                            onClick={() => { setLoginRole('warga'); setError(''); }}
                            className={`py-2.5 px-3 rounded-xl font-bold text-[12.5px] sm:text-[13px] flex items-center justify-center gap-1.5 transition-all duration-200 ${
                                loginRole === 'warga'
                                    ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Icon name="groups" className="text-[16px]" fill={loginRole === 'warga' ? "true" : "false"} />
                            <span>Warga</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setLoginRole('admin'); setError(''); }}
                            className={`py-2.5 px-3 rounded-xl font-bold text-[12.5px] sm:text-[13px] flex items-center justify-center gap-1.5 transition-all duration-200 ${
                                loginRole === 'admin'
                                    ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Icon name="admin_panel_settings" className="text-[16px]" fill={loginRole === 'admin' ? "true" : "false"} />
                            <span>Pengurus RT</span>
                        </button>
                    </div>

                    {/* TAB KONTEN 1: AKSES WARGA */}
                    {loginRole === 'warga' && (
                        <div className="space-y-5 animate-modal-in">
                            <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-750 text-left space-y-2">
                                <div className="flex items-center gap-2 text-google-green dark:text-google-greenLight font-bold text-[12px]">
                                    <Icon name="check_circle" className="text-[15px]" fill="true" />
                                    <span>Akses Langsung Warga Lingkungan</span>
                                </div>
                                <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                                    Pantau buku kas RT, jadwal arisan, jimpitan, infaq, pengumuman lingkungan, dan toko warga secara transparan dan mudah.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => onLogin('warga')}
                                className="w-full min-h-[46px] py-3.5 px-6 bg-google-red hover:bg-google-redDark text-white rounded-full font-bold text-[13.5px] tracking-wide shadow-lg shadow-red-500/25 border border-red-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <Icon name="login" className="text-[18px]" fill="true" />
                                <span>Masuk Portal Warga</span>
                            </button>

                            <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 font-medium">
                                Bebas kata sandi • Dikhususkan bagi warga RT Pakem
                            </p>
                        </div>
                    )}

                    {/* TAB KONTEN 2: LOGIN ADMIN / PENGURUS */}
                    {loginRole === 'admin' && (
                        <form onSubmit={handleAdminLogin} className="space-y-4 animate-modal-in">
                            <div className="space-y-3 text-left">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">
                                        Email Pengurus
                                    </label>
                                    <div className="relative flex items-center">
                                        <div className="absolute left-4 pointer-events-none text-slate-400">
                                            <Icon name="mail" className="text-[17px]" />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => { setEmail(e.target.value); setError(''); }}
                                            placeholder="admin@pakem.desa.id"
                                            autoComplete="username"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-11 pr-4 py-3 text-[13.5px] font-medium outline-none rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:border-red-500 dark:focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5 ml-1">
                                        Kata Sandi
                                    </label>
                                    <div className="relative flex items-center">
                                        <div className="absolute left-4 pointer-events-none text-slate-400">
                                            <Icon name="lock" className="text-[17px]" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={e => { setPassword(e.target.value); setError(''); }}
                                            placeholder="Masukkan kata sandi..."
                                            autoComplete="current-password"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-11 pr-11 py-3 text-[13.5px] font-medium outline-none rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:border-red-500 dark:focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full transition-colors"
                                            title={showPassword ? "Sembunyikan sandi" : "Lihat sandi"}
                                        >
                                            <Icon name={showPassword ? "visibility_off" : "visibility"} className="text-[16px]" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 text-[12px] font-bold flex items-center gap-2">
                                    <Icon name="error" className="text-[16px] shrink-0" fill="true" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full min-h-[46px] py-3.5 px-6 bg-slate-900 hover:bg-black dark:bg-red-600 dark:hover:bg-red-700 text-white rounded-full font-bold text-[13.5px] tracking-wide shadow-lg shadow-black/10 dark:shadow-red-600/20 border border-transparent flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Memverifikasi Otorisasi...</span>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="verified_user" className="text-[17px]" fill="true" />
                                        <span>Masuk Panel Pengurus</span>
                                    </>
                                )}
                            </button>

                            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-medium leading-relaxed pt-1">
                                Dilindungi enkripsi Firebase Auth. Akses hanya untuk pengurus RT terdaftar.
                            </p>
                        </form>
                    )}
                </div>
            </main>

            {/* FOOTER BERSIH & LISENSI */}
            <footer className="w-full text-center py-6 px-4 no-print border-t border-red-500/20 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md text-[12px] font-medium text-slate-500 dark:text-slate-400 z-10">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5">
                        <Icon name="flag" className="text-red-500 text-[14px] animate-pulse" fill="true" />
                        <span>&copy; {new Date().getFullYear()} <strong className="text-red-600 dark:text-red-400 font-bold">WP LINGKUNGAN</strong>. All rights reserved.</span>
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
                        {setShowLicenseModal && (
                            <button
                                onClick={() => setShowLicenseModal(true)}
                                className="hover:text-red-500 transition-colors inline-flex items-center gap-1"
                            >
                                <Icon name="lock" className="text-[13px]" />
                                <span>Lisensi & Hak Cipta</span>
                            </button>
                        )}
                        {legalData?.enabled && setShowLegalModal && (
                            <>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button onClick={() => setShowLegalModal('terms')} className="hover:underline">Syarat & Ketentuan</button>
                                <span className="text-slate-300 dark:text-slate-700">|</span>
                                <button onClick={() => setShowLegalModal('privacy')} className="hover:underline">Kebijakan Privasi</button>
                            </>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default LoginScreen;
