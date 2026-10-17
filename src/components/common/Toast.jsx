import React, { useState, useEffect } from 'react';
import Icon from './Icon.jsx';

export function showToast(message, type = 'success') {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
}

export function ToastContainer() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        const timers = [];
        const handler = (e) => {
            const id = Date.now() + Math.random();
            setToasts(prev => [...prev, { id, message: e.detail.message, type: e.detail.type || 'success', closing: false }]);
            timers.push(setTimeout(() => {
                setToasts(prev => prev.map(t => t.id === id ? { ...t, closing: true } : t));
            }, 2700));
            timers.push(setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3100));
        };
        window.addEventListener('app:toast', handler);
        return () => {
            window.removeEventListener('app:toast', handler);
            timers.forEach(clearTimeout);
        };
    }, []);

    if (toasts.length === 0) return null;

    const configs = {
        success: { icon: 'task_alt', bg: 'bg-google-red', iconBg: 'bg-white/20', shadow: 'shadow-md' },
        error:   { icon: 'error',    bg: 'bg-google-red', iconBg: 'bg-white/20', shadow: 'shadow-md' },
        info:    { icon: 'info',     bg: 'bg-google-red', iconBg: 'bg-white/20', shadow: 'shadow-md' },
        warning: { icon: 'warning',  bg: 'bg-google-yellow', iconBg: 'bg-white/20', shadow: 'shadow-md' },
    };

    return (
        <div
            className="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col-reverse gap-2.5 no-print items-center pointer-events-none"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))', width: 'min(92vw, 400px)' }}
        >
            {toasts.map(t => {
                const cfg = configs[t.type] || configs.success;
                return (
                    <div
                        key={t.id}
                        className={`w-full flex items-center gap-3 pl-2 pr-4 py-2 rounded-2xl border border-white/20 ${cfg.bg} shadow-2xl ${cfg.shadow} text-white`}
                        style={{ animation: t.closing ? 'toastPopOut 0.35s cubic-bezier(0.4,0,1,1) forwards' : 'toastPopIn 0.45s cubic-bezier(0.16,1,0.3,1) forwards' }}
                    >
                        <div className={`w-9 h-9 rounded-xl ${cfg.iconBg} flex items-center justify-center shrink-0`}>
                            <Icon name={cfg.icon} className="text-[18px] text-white" fill="true" />
                        </div>
                        <p className="flex-1 text-[13px] font-medium leading-snug tracking-wide">{t.message}</p>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    </div>
                );
            })}
        </div>
    );
}

export default ToastContainer;
