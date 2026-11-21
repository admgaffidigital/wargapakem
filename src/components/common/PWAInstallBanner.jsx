import React, { useState, useEffect } from 'react';
import Icon from './Icon.jsx';
import { triggerHaptic } from '../../utils/helpers.js';

function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const alreadyInstalled = window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
        if (alreadyInstalled) { setIsInstalled(true); return; }

        try {
            if (sessionStorage.getItem('pwa_banner_dismissed')) { setDismissed(true); return; }
        } catch (e) { }

        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
        const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
        if (ios && isSafari) {
            setIsIOS(true);
            const t = setTimeout(() => setShowBanner(true), 2500);
            return () => clearTimeout(t);
        }

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
        triggerHaptic();
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setShowBanner(false);
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        triggerHaptic();
        setShowBanner(false);
        try { sessionStorage.setItem('pwa_banner_dismissed', '1'); } catch (e) { }
    };

    if (isInstalled || dismissed || !showBanner) return null;

    return (
        <div
            className="fixed bottom-16 sm:bottom-4 left-0 right-0 z-[60] p-3 sm:p-4 no-print"
            style={{ animation: 'slideUp 0.35s ease-out' }}
        >
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 flex items-center gap-3.5 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md font-black text-[16px]">
                    RT
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-[13.5px] text-slate-800 dark:text-white leading-tight tracking-tight">
                        Pasang Aplikasi Warga
                    </p>
                    {isIOS ? (
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Ketuk ikon <b>Bagikan</b> <Icon name="ios_share" className="text-[12px] inline text-red-600" /> lalu <b>"Tambah ke Layar Utama"</b>
                        </p>
                    ) : (
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Akses cepat, hemat kuota, dan notifikasi langsung
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {!isIOS && (
                        <button
                            onClick={handleInstall}
                            className="btn-native-primary !min-h-[38px] !text-[12px] !py-1.5 !px-3.5"
                        >
                            Pasang
                        </button>
                    )}
                    <button
                        onClick={handleDismiss}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white active:scale-95 transition-all"
                    >
                        <Icon name="close" className="text-[16px]" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PWAInstallBanner;
