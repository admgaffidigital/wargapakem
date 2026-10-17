import React, { useState } from 'react';
import Icon from './Icon.jsx';

        function PwaGuideModal({ onClose }) {
            const [tab, setTab] = useState('android');
            return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                    <div className="rounded-3xl w-full max-w-xl flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 dark:border-slate-700 modal-card animate-modal-in" style={{ animation: 'slideUp 0.3s ease-out' }}>
                        <div className="p-6 sm:p-8 md:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 rounded-t-[30px]">
                            <h3 className="text-xl font-medium text-google-text dark:text-white flex flex-wrap items-center gap-2"><Icon name="install_mobile" className="text-google-blue" /> Panduan Install Aplikasi</h3>
                            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-google-text dark:hover:text-white transition-all active:scale-95"><Icon name="close" /></button>
                        </div>
                        <div className="p-6 sm:p-8 md:p-6 overflow-y-auto flex-1">
                            <p className="text-[13px] text-google-textVariant dark:text-slate-300 mb-6 font-medium">Aplikasi ini bisa diinstal langsung ke perangkat Anda (Android, iOS, maupun PC/Laptop) tanpa melalui App Store atau Play Store. Hemat memori dan cepat!</p>
                            
                            <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 rounded-2xl mb-6 border border-slate-200 dark:border-slate-850 shadow-inner">
                                <button onClick={() => setTab('android')} className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'android' ? 'bg-white dark:bg-slate-900 text-google-blue border border-google-blue/30 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}><Icon name="android" className="text-[16px]" /> Android</button>
                                <button onClick={() => setTab('ios')} className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'ios' ? 'bg-white dark:bg-slate-900 text-google-text dark:text-white border border-slate-400 dark:border-slate-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}><Icon name="apple" className="text-[16px]" /> iOS</button>
                                <button onClick={() => setTab('pc')} className={`flex-1 py-2.5 rounded-full text-[12px] font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'pc' ? 'bg-white dark:bg-slate-900 text-google-blue border border-google-blue/30 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}><Icon name="laptop_mac" className="text-[16px]" /> PC/Laptop</button>
                            </div>

                            {tab === 'android' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <h4 className="font-medium text-google-text dark:text-white text-[13px]">Pengguna Google Chrome</h4>
                                    <ol className="list-decimal pl-5 space-y-5 text-[13px] text-google-textVariant dark:text-slate-300 font-medium">
                                        <li>Buka website ini di browser <b>Google Chrome</b>.</li>
                                        <li>Tunggu beberapa detik, akan muncul banner <b>"Pasang Aplikasi Ini"</b> di bagian bawah layar. Klik tombol <b>Install</b>.</li>
                                        <li>Atau, klik ikon <b>titik tiga</b> (G) di pojok kanan atas browser.</li>
                                        <li>Pilih menu <b>"Tambahkan ke Layar Utama"</b> (Add to Home screen) atau <b>"Instal Aplikasi"</b>.</li>
                                        <li>Klik <b>Instal</b> pada pop-up yang muncul. Aplikasi siap digunakan!</li>
                                    </ol>
                                </div>
                            )}

                            {tab === 'ios' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <h4 className="font-medium text-google-text dark:text-white text-[13px]">Pengguna iPhone & iPad (Safari)</h4>
                                    <ol className="list-decimal pl-5 space-y-5 text-[13px] text-google-textVariant dark:text-slate-300 font-medium">
                                        <li>Buka website ini menggunakan browser <b>Safari</b> (wajib).</li>
                                        <li>Ketuk ikon <b>Bagikan</b> <Icon name="ios_share" className="text-[14px] inline text-google-blue" /> (kotak dengan panah ke atas) di bagian bawah layar.</li>
                                        <li>Geser menu ke atas atau ke samping, cari dan ketuk <b>"Tambah ke Layar Utama"</b> (Add to Home Screen) <Icon name="add_box" className="text-[14px] inline text-slate-500" />.</li>
                                        <li>Ketuk tombol <b>Tambah</b> di pojok kanan atas.</li>
                                        <li>Aplikasi kini ada di daftar aplikasi Anda dan siap digunakan!</li>
                                    </ol>
                                </div>
                            )}

                            {tab === 'pc' && (
                                <div className="space-y-6 animate-fadeIn">
                                    <h4 className="font-medium text-google-text dark:text-white text-[13px]">Pengguna PC/Laptop (Chrome / Edge)</h4>
                                    <ol className="list-decimal pl-5 space-y-5 text-[13px] text-google-textVariant dark:text-slate-300 font-medium">
                                        <li>Buka website ini di <b>Google Chrome</b> atau <b>Microsoft Edge</b>.</li>
                                        <li>Perhatikan ujung kanan bilah alamat web (address bar).</li>
                                        <li>Klik ikon <b>Install</b> <Icon name="install_desktop" className="text-[14px] inline text-google-blue" /> yang muncul di sana.</li>
                                        <li>Pada Chrome, Anda juga bisa klik ikon <b>titik tiga</b> (G) &rarr; <b>"Save and share"</b> &rarr; <b>"Install page as app"</b>.</li>
                                        <li>Aplikasi akan terinstal, dapat di-pin ke Taskbar, dan dibuka layaknya program desktop biasa.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                        <div className="p-6 sm:p-8 md:p-8 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-b-[30px] flex justify-end">
                            <button onClick={onClose} className="bg-google-blue text-white px-6 py-3 rounded-full font-medium text-[13px] shadow-md hover:bg-google-blueDark transition-all active:scale-95">Tutup Panduan</button>
                        </div>
                    </div>
                </div>
            );
        }


export default PwaGuideModal;
