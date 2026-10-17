import React, { useState, useEffect } from 'react';
import Icon from './Icon.jsx';

        function PWAInstallBanner() {
            const [deferredPrompt, setDeferredPrompt] = useState(null);
            const [showBanner, setShowBanner] = useState(false);
            const [isIOS, setIsIOS] = useState(false);
            const [isInstalled, setIsInstalled] = useState(false);
            const [dismissed, setDismissed] = useState(false);

            useEffect(() => {
                // Cek sudah diinstall (standalone mode)
                const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches 
                    || window.navigator.standalone === true;
                if (alreadyInstalled) { setIsInstalled(true); return; }

                // Cek sudah pernah dismiss
                try {
                    if (sessionStorage.getItem('pwa_banner_dismissed')) { setDismissed(true); return; }
                } catch(e) { /* incognito mode - lanjut tampil banner */ }

                // Deteksi iOS
                const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
                const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
                if (ios && isSafari) {
                    setIsIOS(true);
                    const t = setTimeout(() => setShowBanner(true), 2500);
                    return () => clearTimeout(t);
                }

                // Android/Chrome: tangkap event beforeinstallprompt
                let bannerTimer = null;
                const handler = (e) => {
                    e.preventDefault();
                    setDeferredPrompt(e);
                    bannerTimer = setTimeout(() => setShowBanner(true), 2500);
                };
                const onInstalled = () => { setShowBanner(false); setIsInstalled(true); };
                window.addEventListener('beforeinstallprompt', handler);
                window.addEventListener('appinstalled', onInstalled);
                return () => {
                    window.removeEventListener('beforeinstallprompt', handler);
                    window.removeEventListener('appinstalled', onInstalled);
                    if (bannerTimer) clearTimeout(bannerTimer);
                };
            }, []);

            const handleInstall = async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') setShowBanner(false);
                setDeferredPrompt(null);
            };

            const handleDismiss = () => {
                setShowBanner(false);
                try { sessionStorage.setItem('pwa_banner_dismissed', '1'); } catch(e) {}
            };

            if (isInstalled || dismissed || !showBanner) return null;

            return (
                <div className="fixed bottom-0 left-0 right-0 z-[60] p-3 sm:p-4 no-print"
                     style={{ animation: 'slideUpFade 0.4s ease-out', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 flex flex-wrap items-center gap-4 max-w-lg mx-auto">
                        {/* Ikon */}
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-google-red to-google-redDark flex items-center justify-center shrink-0 shadow-md text-white font-medium text-[18px]">
                            RT
                        </div>
                        {/* Teks */}
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-[13px] text-google-text leading-tight tracking-tight">
                                Pasang Aplikasi Ini
                            </p>
                            {isIOS ? (
                                <p className="text-[11px] font-medium text-google-textVariant mt-0.5 leading-snug">
                                    Tap <span className="inline-flex items-center gap-0.5 font-medium text-google-blue">
                                        <Icon name="ios_share" className="text-[13px]"/> Bagikan
                                    </span> lalu pilih <b>"Tambah ke Layar Utama"</b>
                                </p>
                            ) : (
                                <p className="text-[11px] font-medium text-google-textVariant mt-0.5 leading-snug">
                                    Install ke homescreen untuk akses lebih cepat
                                </p>
                            )}
                        </div>
                        {/* Tombol */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {!isIOS && (
                                <button onClick={handleInstall}
                                    className="bg-google-blue text-white text-[12px] font-medium px-4 py-2.5 rounded-full border border-google-blueDark hover:bg-google-blueDark active:scale-95 transition-all duration-200 shadow-md whitespace-nowrap">
                                    Install
                                </button>
                            )}
                            <button onClick={handleDismiss}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all duration-200">
                                <Icon name="close" className="text-[16px] text-google-textVariant"/>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

export default PWAInstallBanner;
