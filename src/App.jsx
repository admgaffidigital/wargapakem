// ============================================================
// App.jsx - Portal Warga RT PAKEM
// Dikonversi dari index.html (Babel CDN) ke Vite build system
// ============================================================
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    db, auth, doc, onSnapshot, setDoc,
    signInWithEmailAndPassword, signOut, onAuthStateChanged
} from './firebase.js';

const getDirectImgUrl = (url) => {
            if (!url) return '';
            const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (driveMatch) {
                return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
            }
            return url;
        };
        
        const getLocalDate = () => { const offset = new Date().getTimezoneOffset() * 60000; return new Date(Date.now() - offset).toISOString().split('T')[0]; };
        
        function Icon({ name, className = "text-[20px]", fill = "false" }) {
            return <span className={`material-symbols-rounded shrink-0 select-none flex items-center justify-center ${className}`} style={{ fontVariationSettings: fill === 'true' ? "'FILL' 1" : "'FILL' 0", lineHeight: '1em', width: '1em', height: '1em' }} aria-hidden="true">{name}</span>;
        }

        /* ================= TOAST NOTIFICATION (GLOBAL) ================= */
        function showToast(message, type = 'success') {
            window.dispatchEvent(new CustomEvent('app:toast', { detail: { message, type } }));
        }

        function ToastContainer() {
            const [toasts, setToasts] = useState([]);

            useEffect(() => {
                const handler = (e) => {
                    const id = Date.now() + Math.random();
                    setToasts(prev => [...prev, { id, message: e.detail.message, type: e.detail.type }]);
                    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
                };
                window.addEventListener('app:toast', handler);
                return () => window.removeEventListener('app:toast', handler);
            }, []);

            if (toasts.length === 0) return null;

            return (
                <div className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 no-print w-[92%] sm:w-auto items-center"
                     style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
                    <style>{`@keyframes toastSlideIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                    {toasts.map(t => (
                        <div key={t.id} className={`flex items-center gap-2.5 px-5 py-3.5 rounded-[16px] shadow-2xl border-2 font-extrabold text-[13px] max-w-sm sm:max-w-md ${t.type === 'error' ? 'bg-google-red text-white border-google-redDark' : 'bg-google-green text-white border-google-greenDark'}`}
                             style={{ animation: 'toastSlideIn 0.3s ease-out' }}>
                            <Icon name={t.type === 'error' ? 'error' : 'check_circle'} className="text-[20px]" fill="true" />
                            <span>{t.message}</span>
                        </div>
                    ))}
                </div>
            );
        }

        function useFirebaseSync(key, initialValue) {
            const [data, setData] = useState(() => {
                // Fallback: baca localStorage dulu agar data tidak hilang saat Firebase lambat/gagal
                try {
                    const cached = localStorage.getItem('arisan_rt_' + key);
                    if (cached !== null) return JSON.parse(cached);
                } catch(e) {}
                return typeof initialValue === 'function' ? initialValue() : initialValue;
            });
            const [isLoaded, setIsLoaded] = useState(false);
            
            useEffect(() => {
                if (!db) {
                    // Tidak ada Firebase - anggap loaded dengan data dari localStorage/initialValue
                    setIsLoaded(true);
                    return;
                }
                const docRef = doc(db, 'arisan_rt', key);
                const unsubscribe = onSnapshot(docRef, (snapshot) => {
                    if (snapshot.exists()) {
                        const val = snapshot.data().value;
                        setData(val);
                        // Sinkron ke localStorage sebagai cache offline
                        try { localStorage.setItem('arisan_rt_' + key, JSON.stringify(val)); } catch(e) {}
                    } else {
                        const iv = typeof initialValue === 'function' ? initialValue() : initialValue;
                        setData(iv);
                    }
                    setIsLoaded(true);
                }, (error) => {
                    console.warn(`[Sync Error] Gagal memuat koleksi '${key}':`, error.message);
                    setIsLoaded(true); 
                });
                return () => unsubscribe();
            }, [key]);
            
            const updateData = useCallback((newValue) => {
                setData(prevData => {
                    const valueToStore = typeof newValue === 'function' ? newValue(prevData) : newValue;
                    // Selalu simpan ke localStorage sebagai cache
                    try { localStorage.setItem('arisan_rt_' + key, JSON.stringify(valueToStore)); } catch(e) {}
                    if (db) {
                        const docRef = doc(db, 'arisan_rt', key);
                        const safeValue = valueToStore === undefined ? null : valueToStore;
                        const sanitizedData = JSON.parse(JSON.stringify(safeValue));
                        setDoc(docRef, { value: sanitizedData }, { merge: false }).catch(err => console.error(err)); 
                    }
                    return valueToStore;
                });
            }, [key]);
            
            return [data, updateData, isLoaded];
        }

        const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
        const formatBulanTahun = (yyyy_mm) => {
            if (!yyyy_mm) return '-'; const [year, month] = yyyy_mm.split('-'); return new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        };
        const safeNumber = (val) => isNaN(Math.abs(Number(val))) ? 0 : Math.abs(Number(val));
        // FIX LOGIKA-2: Helper parse tanggal lokal (hindari timezone off-by-one UTC)
        const parseLocalDate = (dateStr) => { if (!dateStr) return new Date(); const [y, m, d] = dateStr.split('-'); return new Date(+y, +m - 1, +d); };
        // Helper: cek apakah warga nonaktif (Meninggal ATAU Nonaktif/Pindah) - bebas dari arisan
        const isNonaktif = (member) => member && (member.status === 'Meninggal' || member.status === 'Nonaktif');


        /* ================= PWA INSTALL BANNER COMPONENT ================= */
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
                    setTimeout(() => setShowBanner(true), 2500);
                    return;
                }

                // Android/Chrome: tangkap event beforeinstallprompt
                const handler = (e) => {
                    e.preventDefault();
                    setDeferredPrompt(e);
                    setTimeout(() => setShowBanner(true), 2500);
                };
                const onInstalled = () => { setShowBanner(false); setIsInstalled(true); };
                window.addEventListener('beforeinstallprompt', handler);
                window.addEventListener('appinstalled', onInstalled);
                return () => {
                    window.removeEventListener('beforeinstallprompt', handler);
                    window.removeEventListener('appinstalled', onInstalled);
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
                    <style>{`
                        @keyframes slideUpFade {
                            from { opacity: 0; transform: translateY(20px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                    <div className="bg-white rounded-[24px] shadow-2xl border-2 border-slate-200 p-4 sm:p-5 flex flex-wrap items-center gap-4 max-w-lg mx-auto">
                        {/* Ikon */}
                        <div className="w-14 h-14 rounded-[16px] shrink-0 flex items-center justify-center text-white font-extrabold text-[22px] shadow-md"
                             style={{ background: 'linear-gradient(135deg,#1a73e8,#0d47a1)' }}>
                            RT
                        </div>
                        {/* Teks */}
                        <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-[14px] text-google-text leading-tight tracking-tight">
                                Pasang Aplikasi Ini
                            </p>
                            {isIOS ? (
                                <p className="text-[12px] font-medium text-google-textVariant mt-0.5 leading-snug">
                                    Tap <span className="inline-flex items-center gap-0.5 font-extrabold text-google-blue">
                                        <Icon name="ios_share" className="text-[14px]"/> Bagikan
                                    </span> lalu pilih <b>"Tambah ke Layar Utama"</b>
                                </p>
                            ) : (
                                <p className="text-[12px] font-medium text-google-textVariant mt-0.5 leading-snug">
                                    Install ke homescreen untuk akses lebih cepat
                                </p>
                            )}
                        </div>
                        {/* Tombol */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {!isIOS && (
                                <button onClick={handleInstall}
                                    className="bg-google-blue text-white text-[13px] font-extrabold px-4 py-2.5 rounded-full border-2 border-google-blueDark hover:bg-google-blueDark active:scale-95 transition-all duration-200 shadow-md whitespace-nowrap">
                                    Install
                                </button>
                            )}
                            <button onClick={handleDismiss}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all duration-200">
                                <Icon name="close" className="text-[18px] text-google-textVariant"/>
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        /* ================= ROBOT ASISTEN COMPONENT ================= */

        function RobotGuide({ userRole, nominalArisan, nominalJimpitan, identity, members, arisanPeriod, currentRound, cycleNumber, jimpitanBalance, kasRtBalance, meetingHistory, inventarisData, pinjamData, infaqData }) {
            const [isOpen, setIsOpen] = useState(false);
            const [mode, setMode] = useState(userRole === 'admin' ? 'admin' : 'warga'); // 'admin' | 'warga'
            const [activeMenu, setActiveMenu] = useState(null);
            const [messages, setMessages] = useState([{
                sender: 'robot',
                text: userRole === 'admin'
                    ? `Halo Admin! = Saya Asisten Pintar ${identity?.name || 'Arisan RT'}.\n\nSaya memahami semua fitur, logika, dan kalkulasi sistem. Pilih mode panduan yang Anda butuhkan:`
                    : `Halo Warga ${identity?.name || 'RT'}! =\n\nSaya siap menjelaskan cara membaca data arisan, iuran, kas, dan semua informasi di aplikasi ini dengan bahasa yang mudah dipahami. Silakan pilih topik:`
            }]);
            const messagesEndRef = useRef(null);
            const [inputText, setInputText] = useState('');

            useEffect(() => {
                if (isOpen && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
            }, [messages, isOpen]);

            useEffect(() => {
                const handlePopState = (e) => {
                    if (isOpen) setIsOpen(false);
                };
                window.addEventListener('popstate', handlePopState);
                return () => window.removeEventListener('popstate', handlePopState);
            }, [isOpen]);

            const toggleRobot = () => {
                if (!isOpen) {
                    window.history.pushState({ robot: true }, '');
                    setIsOpen(true);
                } else {
                    window.history.back(); // Memanggil popstate untuk menutup
                }
            };

            // ================================================================
            // KNOWLEDGE BASE ADMIN G teknis, fitur, kalkulasi sistem
            // ================================================================
            const kbAdmin = {
                warga: {
                    label: '= Menu Warga', icon: 'group',
                    intro: 'Menu Warga adalah pusat data seluruh anggota G nama, program, status, dan tunggakan.',
                    topics: [
                        { label: 'Program Keikutsertaan', answer: `Ada 2 jenis program warga:\n\n1n+G Full (Arisan & Iuran) G ikut arisan bulanan DAN iuran umum. Muncul di Absen Arisan.\n\n2n+G Hanya Iuran Umum G tidak ikut arisan, tapi tetap kena tagihan Iuran Umum.\n\nPilih sesuai kesepakatan saat mendaftar.` },
                        { label: 'Status Warga (3 jenis)', answer: `= Aktif G ikut semua kewajiban.\n\nGÜ½ Meninggal / Wafat G bebas arisan, TETAP wajib jimpitan Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')}. Kartu di Absen otomatis abu-abu.\n\n= Nonaktif / Pindah G sama seperti Meninggal, bebas arisan.\n\nUbah status lewat tombol Edit di daftar warga.` },
                        { label: 'Tunggakan Warga', answer: `Tunggakan timbul otomatis saat warga Alfa atau Musibah.\n\nBesaran = Arisan + Jimpitan = Rp ${((nominalArisan||10000)+(nominalJimpitan||2000)).toLocaleString('id-ID')} per bulan absen.\n\nLunas saat warga hadir + centang "Lunasi Tunggakan?" di form Absen.` },
                        { label: 'Rapor Merah vs Musibah', answer: `= Rapor Merah (Alfa) G tidak hadir tanpa alasan. Dapat tanda merah di dashboard.\n\n= Musibah G berhalangan karena alasan valid (sakit, musibah). Punya tunggakan tapi TIDAK dapat rapor merah.\n\nMusibah = toleransi, Alfa = peringatan.` },
                        { label: 'Tambah / Edit / Hapus Warga', answer: `GP Tambah G isi nama, program, status. Nama harus unik karena jadi identifikasi di absensi.\n\nGn+ Edit G ubah data termasuk status dan koreksi tunggakan manual.\n\n=n+ Hapus G ada konfirmasi. Tidak bisa dipulihkan.` }
                    ]
                },
                pertemuan: {
                    label: '=n+ Absen Arisan', icon: 'how_to_reg',
                    intro: 'Form absen 3 langkah: konfirmasi periode G catat kehadiran G pilih pemenang.',
                    topics: [
                        { label: 'Alur 3 Langkah', answer: `Step 1 G Konfirmasi periode & tanggal.\nStep 2 G Klik status tiap warga: Hadir / Musibah / Alfa. Warga Meninggal/Nonaktif otomatis abu-abu.\nStep 3 G Pilih pemenang dari daftar eligible (belum pernah menang siklus ini).` },
                        { label: 'Kalkulasi Kas Arisan', answer: `Kas Arisan = (Jumlah Hadir + Rp ${(nominalArisan||10000).toLocaleString('id-ID')}) G 1 nominal pemenang (karena pemenang tidak bayar ke diri sendiri).\n\nContoh 10 orang hadir: Rp ${(10*(nominalArisan||10000)).toLocaleString('id-ID')} G Rp ${(nominalArisan||10000).toLocaleString('id-ID')} = Rp ${(9*(nominalArisan||10000)).toLocaleString('id-ID')} diserahkan ke pemenang.` },
                        { label: 'Kalkulasi Kas Jimpitan', answer: `Hadir = +Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')} masuk jimpitan.\nAlfa/Musibah = warga tidak setor, tapi kekurangan untuk pemenang ditalangi dari jimpitan.\nMeninggal/Nonaktif hadir = +Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')} jimpitan saja.` },
                        { label: 'Sistem Talangan', answer: `Warga Alfa/Musibah G uang arisan untuk pemenang tetap full, ditambal dari Kas Jimpitan sementara.\nWarga tercatat tunggakan Rp ${((nominalArisan||10000)+(nominalJimpitan||2000)).toLocaleString('id-ID')}.\nSaat hadir + centang lunasi G tunggakan terhapus, kas jimpitan dipulihkan.` },
                        { label: 'Libur & Siklus Baru', answer: `Libur: klik "Tandai Libur" di Step 1 G periode lanjut, putaran tidak berubah.\n\nSiklus Baru: semua warga sudah pernah menang G muncul opsi reset. Siklus ke-${cycleNumber||1} saat ini, putaran ke-${currentRound||1}.` }
                    ]
                },
                kas: {
                    label: '=Æ¦ Buku Kas RT', icon: 'account_balance_wallet',
                    intro: 'Catatan keuangan Kas RT Utama. Terpisah dari Kas Jimpitan.',
                    topics: [
                        { label: 'Kategori Transaksi', answer: `= Pemasukan: Iuran Opsional, Donasi, Pemasukan Jasa, Lain-lain.\n= Pengeluaran: Belanja Barang/Alat, Honor Jasa, Konsumsi, Bantuan Sosial, Lain-lain.\n\nSetiap transaksi wajib ada keterangan agar mudah diaudit.` },
                        { label: 'Tarik Kas Jimpitan', answer: `Dana jimpitan bisa dicairkan ke Kas RT via tombol "Tarik Kas Jimpitan".\n\nMaksimal tarik = saldo jimpitan saat ini: Rp ${(jimpitanBalance||0).toLocaleString('id-ID')}.\n\nJika transaksi ini dihapus, saldo jimpitan otomatis dikembalikan.` },
                        { label: 'Guard Saldo Negatif', answer: `Sistem TIDAK mengizinkan pengeluaran melebihi saldo kas.\n\nJika nominal > saldo, muncul pesan error dan transaksi dibatalkan. Saldo RT saat ini: Rp ${(kasRtBalance||0).toLocaleString('id-ID')}.` }
                    ]
                },
                iuran: {
                    label: '= Iuran Umum', icon: 'volunteer_activism',
                    intro: 'Tagihan khusus di luar arisan G dana kemerdekaan, pembangunan, dll.',
                    topics: [
                        { label: 'Cara Kerja Iuran', answer: `Admin buat agenda G isi nominal yang dibayar tiap warga G warga hanya lihat LUNAS/BELUM LUNAS (nominal privat).\n\nSetelah rekap tersimpan, admin bisa setor ke Kas RT Utama.` },
                        { label: 'Validasi Sebelum Setor', answer: `Tombol "Setor ke Kas" akan diblokir jika admin belum klik "Simpan Rekap Warga" dulu.\n\nIni mencegah perbedaan antara data yang tampil dan yang benar-benar disetor.` },
                        { label: 'Hapus Agenda', answer: `Ada dialog konfirmasi 2 langkah sebelum hapus.\n\nSemua data pembayaran warga ikut terhapus. Dana yang sudah disetor ke kas TETAP ada di Buku Kas.` }
                    ]
                },
                laporan: {
                    label: '= Laporan & Revisi', icon: 'analytics',
                    intro: 'Riwayat historis semua pertemuan arisan G kas, talangan, saldo per bulan.',
                    topics: [
                        { label: 'Kolom Laporan', answer: `Setiap baris laporan menampilkan: Periode, Putaran, Pemenang, Kas Arisan Terkumpul, Kas Jimpitan Masuk, Talangan, Tunggakan Baru, Total Tunggakan Akhir, dan Saldo Akhir Jimpitan.` },
                        { label: 'Revisi Absensi', answer: `Klik ikon Edit di baris laporan G ubah status warga G Simpan.\n\nSistem otomatis hitung ulang: saldo jimpitan, tunggakan warga, kasArisan (jika pemenang berubah), dan saldoAkhirJimpitan di record tersebut.\n\nWarga Meninggal/Nonaktif tidak bisa diubah statusnya.` }
                    ]
                },
                dashboard: {
                    label: '= Dashboard', icon: 'dashboard',
                    intro: 'Ringkasan kondisi arisan RT G saldo, tunggakan, putaran saat ini.',
                    topics: [
                        { label: 'Saldo Efektif Jimpitan', answer: `Saldo Efektif = Saldo Tunai + Total Piutang (tunggakan seluruh warga).\n\nIni menggambarkan total aset jimpitan secara riil. Saldo tunai jimpitan saat ini: Rp ${(jimpitanBalance||0).toLocaleString('id-ID')}.` },
                        { label: 'Rapor Merah di Dashboard', answer: `Badge merah menunjukkan jumlah warga yang punya tunggakan dari status Alfa (absen tanpa alasan).\n\nMusibah tidak ikut hitungan rapor merah meski ada tunggakan.` }
                    ]
                },
                pengaturan: {
                    label: 'Gn+ Pengaturan', icon: 'settings',
                    intro: 'Konfigurasi sistem: nominal, identitas, koreksi saldo, PIN, reset.',
                    topics: [
                        { label: 'Nominal Arisan & Jimpitan', answer: `Arisan: Rp ${(nominalArisan||10000).toLocaleString('id-ID')} | Jimpitan: Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')}.\n\nPerubahan berlaku mulai pertemuan berikutnya. Riwayat lama tetap memakai nominal lama.` },
                        { label: 'Koreksi Saldo Manual', answer: `Kas RT: perbedaan dicatat otomatis sebagai transaksi "Penyesuaian Saldo Awal" di Buku Kas.\nJimpitan: langsung ubah tanpa entry transaksi.\n\nGunakan jika ada perbedaan antara sistem dan uang fisik.` },
                        { label: 'Kalibrasi Putaran & Siklus', answer: `Koreksi nomor putaran dan siklus jika ada kesalahan (misal migrasi dari sistem lama).\n\nPutaran saat ini: ${currentRound||1} | Siklus: ${cycleNumber||1}.` },
                        { label: 'Factory Reset', answer: `Menghapus SEMUA data: warga, riwayat, saldo, iuran, galeri, inventaris.\n\nKetik "RESET" untuk konfirmasi. Gn+ TIDAK BISA DIBATALKAN. PIN admin tetap tidak berubah agar admin masih bisa login setelah reset.` }
                    ]
                },
                infaq_inventaris: {
                    label: '= Infaq & Inventaris', icon: 'inventory_2',
                    intro: 'Kelola data Infaq, barang inventaris, dan status peminjaman.',
                    topics: [
                        { label: 'Sistem Infaq Warga', answer: `Infaq dikelola terpisah dari Kas RT dan Jimpitan.\n\nSaat ini ada ${infaqData?.filter(i => i.status === 'PENDING').length || 0} donasi Infaq yang menunggu persetujuan (PENDING). Total donasi disetujui: Rp ${(infaqData?.filter(i => i.status === 'APPROVED').reduce((sum, i) => sum + parseInt(i.nominal || 0), 0) || 0).toLocaleString('id-ID')}.` },
                        { label: 'Manajemen Inventaris', answer: `RT memiliki ${inventarisData?.length || 0} jenis barang inventaris.\n\nJika ada yang meminjam, gunakan menu "Pinjam Inventaris". Saat ini ada ${pinjamData?.filter(p => p.status === 'DIPINJAM').length || 0} transaksi barang yang sedang dipinjam warga.` }
                    ]
                }
            };

            // ================================================================
            // KNOWLEDGE BASE WARGA G bahasa awam, cara baca data
            // ================================================================
            const kbWarga = {
                arisan: {
                    label: '= Cara Baca Arisan', icon: 'emoji_events',
                    intro: 'Penjelasan lengkap tentang sistem arisan, bagaimana uang dihitung, dan apa artinya setiap data yang tampil.',
                    topics: [
                        {
                            label: 'Apa itu Arisan RT ini?',
                            answer: `Arisan RT adalah kegiatan kumpul-kumpul uang rutin setiap bulan. Setiap anggota membayar iuran arisan sebesar Rp ${(nominalArisan||10000).toLocaleString('id-ID')} per pertemuan.\n\nUang dari semua anggota dikumpulkan, lalu diundi G satu orang beruntung mendapatkan semua uang tersebut bulan itu.\n\nSetiap orang akan mendapat giliran menang TEPAT 1 kali per siklus, jadi tidak ada yang dirugikan. Setelah semua mendapat giliran, siklus baru dimulai lagi dari awal.`
                        },
                        {
                            label: 'Berapa uang yang diterima pemenang?',
                            answer: `Pemenang menerima uang dari semua anggota yang hadir, MINUS bagian dirinya sendiri G karena tidak masuk akal seseorang membayar ke dirinya sendiri.\n\nContoh mudah:\nG Ada 10 anggota hadir, iuran Rp ${(nominalArisan||10000).toLocaleString('id-ID')} per orang\nG Total terkumpul = 10 + Rp ${(nominalArisan||10000).toLocaleString('id-ID')} = Rp ${(10*(nominalArisan||10000)).toLocaleString('id-ID')}\nG Pemenang hadir G menerima Rp ${(9*(nominalArisan||10000)).toLocaleString('id-ID')} (9 orang lainnya)\n\nIni bukan pengurangan G ini cara menghitung yang benar dan jujur agar uang fisik yang diserahkan ke pemenang cocok dengan yang ada di tangan.`
                        },
                        {
                            label: 'Kenapa ada "Pemenang" di menu?',
                            answer: `Menu Pemenang menampilkan daftar siapa saja yang SUDAH mendapat giliran menang di siklus yang sedang berjalan.\n\nAnda bisa cek:\nG Siapa sudah menang di putaran berapa\nG Siapa yang belum mendapat giliran\n\nJika nama Anda belum ada di daftar, berarti Anda masih punya kesempatan menang di bulan-bulan mendatang. Sabar ya! =`
                        },
                        {
                            label: 'Apa itu Putaran dan Siklus?',
                            answer: `= Putaran = urutan pertemuan arisan.\nPutaran 1 = pertemuan pertama, putaran 2 = pertemuan kedua, dst.\n\n= Siklus = satu "babak" penuh sampai semua anggota mendapat giliran menang.\n\nContoh: jika ada 12 anggota arisan, satu siklus = 12 putaran (G 12 bulan). Setelah semua dapat giliran, masuk Siklus baru.\n\nSaat ini: Siklus ke-${cycleNumber||1}, Putaran ke-${currentRound||1}.`
                        },
                        {
                            label: 'Apa itu Arsip Riwayat?',
                            answer: `Arsip Riwayat (menu "Arsip Riwayat" di beranda) adalah catatan historis semua pertemuan arisan yang sudah selesai.\n\nDi sana Anda bisa melihat:\nG Siapa pemenang tiap bulan\nG Berapa kas yang terkumpul\nG Saldo kas jimpitan akhir tiap bulan\n\nData ini TIDAK bisa dimanipulasi oleh siapapun setelah tersimpan, kecuali ada revisi resmi oleh admin dengan alasan yang jelas.`
                        }
                    ]
                },
                jimpitan: {
                    label: '=Æ¦ Memahami Kas Jimpitan', icon: 'savings',
                    intro: 'Apa itu jimpitan, mengapa ada dua kas, dan bagaimana cara membacanya.',
                    topics: [
                        {
                            label: 'Apa itu Jimpitan?',
                            answer: `Jimpitan adalah iuran kecil yang dikumpulkan setiap pertemuan arisan, terpisah dari uang arisan.\n\nBesarnya: Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')} per anggota per pertemuan.\n\nUang jimpitan TIDAK diundi G dikumpulkan terus sebagai "tabungan bersama" RT yang bisa dipakai untuk keperluan operasional, membantu warga yang kesulitan, atau ditransfer ke Kas RT jika diperlukan.`
                        },
                        {
                            label: 'Bedanya Kas Jimpitan dan Kas RT?',
                            answer: `Ada DUA kantong uang di sistem ini:\n\n= Kas Jimpitan G uang dari iuran kehadiran bulanan. Ini uang hasil gotong royong murni dari warga.\n\n= Kas RT Utama G uang operasional RT yang lebih besar. Bisa berasal dari pencairan jimpitan, iuran umum, sumbangan, dll.\n\nAdmin bisa memindahkan sebagian jimpitan ke Kas RT jika ada kebutuhan mendesak. Semua perpindahan uang tercatat di Buku Kas.`
                        },
                        {
                            label: 'Apa itu "Saldo Efektif"?',
                            answer: `Di Ringkasan (Dashboard) ada tampilan "Saldo Efektif Jimpitan".\n\nIni bukan hanya uang tunai yang ada G ini gabungan dari:\nG Saldo tunai yang ada di kas jimpitan\nG Total tunggakan semua warga (uang yang masih "di dalam" warga)\n\nContoh: saldo tunai Rp 50.000, ada warga dengan tunggakan Rp 20.000 G Saldo Efektif = Rp 70.000.\n\nIni memberikan gambaran total aset jimpitan yang sesungguhnya.`
                        },
                        {
                            label: 'Apa itu Talangan?',
                            answer: `"Talangan" terjadi saat ada warga yang tidak hadir (Alfa atau Musibah).\n\nKarena pemenang harus tetap menerima uang penuh, kekurangan dari warga yang absen itu "dipinjam sementara" dari Kas Jimpitan.\n\nNanti saat warga yang absen itu hadir kembali dan melunasi tunggakannya, uang kembali masuk ke kas jimpitan.\n\nJadi sistem ini adil G pemenang tidak dirugikan, dan warga yang absen wajib bayar di bulan berikutnya.`
                        }
                    ]
                },
                tunggakan: {
                    label: 'Gn+ Tunggakan Saya', icon: 'warning',
                    intro: 'Penjelasan kenapa bisa ada tunggakan, apa artinya, dan bagaimana cara melunasinya.',
                    topics: [
                        {
                            label: 'Kenapa saya punya tunggakan?',
                            answer: `Tunggakan timbul otomatis jika Anda tidak hadir di pertemuan arisan, baik karena:\nG Alfa (tidak hadir tanpa alasan) =\nG Musibah (berhalangan: sakit, keluarga, dll) =\n\nBesaran tunggakan = Rp ${(nominalArisan||10000).toLocaleString('id-ID')} (arisan) + Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')} (jimpitan) = Rp ${((nominalArisan||10000)+(nominalJimpitan||2000)).toLocaleString('id-ID')} per bulan absen.\n\nIni bukan denda G ini adalah kewajiban yang tertunda yang harus dibayar di pertemuan berikutnya.`
                        },
                        {
                            label: 'Bagaimana cara melunasi?',
                            answer: `Cara melunasi tunggakan sangat mudah:\n\n1n+G Hadir di pertemuan arisan bulan berikutnya\n2n+G Bayar iuran seperti biasa\n3n+G Beritahu admin bahwa Anda ingin melunasi tunggakan\n4n+G Admin akan mencentang "Lunasi Tunggakan?" di kartu absen Anda\n\nSetelah itu, tunggakan Anda otomatis terhapus dari sistem dan saldo bersih kembali.`
                        },
                        {
                            label: 'Apa bedanya "Rapor Merah" dan Musibah?',
                            answer: `= Rapor Merah (dari Alfa) G Anda tidak hadir TANPA alasan yang jelas. Nama Anda akan tampil di tanda merah di daftar warga.\n\n= Musibah G Anda tidak hadir karena halangan yang valid (sakit keras, keluarga meninggal, bencana, dll). Admin memberi toleransi G Anda punya tunggakan tapi TIDAK mendapat rapor merah.\n\nKeduanya harus dilunasi, tapi Musibah diperlakukan dengan lebih manusiawi.`
                        },
                        {
                            label: 'Bagaimana jika saya meninggal atau pindah?',
                            answer: `Jika status warga diubah admin menjadi "Meninggal / Wafat" atau "Nonaktif / Pindah":\n\nG Bebas dari kewajiban iuran arisan\nG Tidak lagi masuk undian pemenang\n= Masih dicatat untuk jimpitan jika masih hadir\n\nAdmin akan memperbarui status tersebut berdasarkan informasi yang diterima. Hubungi admin RT untuk pembaruan data.`
                        }
                    ]
                },
                iuran: {
                    label: '= Cara Baca Iuran Umum', icon: 'volunteer_activism',
                    intro: 'Memahami apa itu Iuran Umum dan kenapa status Anda LUNAS atau BELUM LUNAS.',
                    topics: [
                        {
                            label: 'Apa itu Iuran Umum?',
                            answer: `Iuran Umum adalah tagihan khusus di luar arisan rutin G misalnya:\nG Dana Peringatan 17 Agustus\nG Sumbangan Pembangunan Masjid/Mushola\nG Kas Sosial Warga\nG Dana Darurat Bencana\n\nSetiap agenda iuran punya judul, nominal minimum, dan tenggat waktu yang ditetapkan admin.`
                        },
                        {
                            label: 'Kenapa saya hanya lihat LUNAS/BELUM?',
                            answer: `Ini adalah fitur PRIVASI yang disengaja.\n\nSistem menjaga kerahasiaan besaran donasi tiap warga G karena kemampuan finansial setiap orang berbeda. Anda hanya melihat status LUNAS jika nominal Anda sudah memenuhi minimum yang ditetapkan.\n\nHanya Admin yang tahu nominal persis masing-masing warga. Sesama warga TIDAK bisa melihat berapa yang dibayar orang lain.`
                        },
                        {
                            label: 'Bagaimana cara lapor ke admin?',
                            answer: `Jika Anda sudah membayar iuran tapi status masih "BELUM LUNAS":\n\n1n+G Hubungi admin RT langsung\n2n+G Tunjukkan bukti pembayaran\n3n+G Admin akan memperbarui data di sistem\n\nAdmin perlu mengklik "Simpan Rekap Warga" agar perubahan tersimpan ke server.`
                        }
                    ]
                },
                kas: {
                    label: '= Cara Baca Kas RT', icon: 'account_balance_wallet',
                    intro: 'Memahami laporan keuangan RT G dari mana uang masuk, ke mana uang keluar.',
                    topics: [
                        {
                            label: 'Apa yang terlihat di menu Kas RT?',
                            answer: `Di menu "Kas RT" Anda bisa melihat:\n\n= Saldo kas RT saat ini\n= Riwayat semua pemasukan dan pengeluaran\n\nPermasukan bisa berasal dari: iuran opsional, donasi warga, pencairan jimpitan, hasil iuran umum.\n\nPengeluaran bisa untuk: belanja alat, konsumsi rapat, bantuan sosial, honor petugas, dll.`
                        },
                        {
                            label: 'Apakah warga bisa tambah/hapus data?',
                            answer: `Tidak. Warga hanya bisa MELIHAT riwayat transaksi.\n\nHanya Admin yang bisa mencatat transaksi baru atau menghapus entri yang salah.\n\nIni memastikan transparansi G semua warga bisa memantau keuangan RT, tapi hanya admin yang berwenang mengubah data.`
                        },
                        {
                            label: 'Apakah data ini bisa dipercaya?',
                            answer: `Ya. Semua transaksi di sistem ini:\nG Langsung tersimpan ke cloud (Firebase)\nG Sinkron di semua perangkat secara realtime\nG Hanya bisa diubah oleh Admin dengan PIN khusus\nG Setiap perubahan saldo ada jejak transaksi\n\nJika ada keraguan, warga bisa meminta admin untuk menampilkan laporan cetak di pertemuan RT.`
                        }
                    ]
                },
                buku_warga: {
                    label: '= Cara Baca Data Diri', icon: 'person',
                    intro: 'Memahami status, tunggakan, dan informasi diri Anda di Buku Warga.',
                    topics: [
                        {
                            label: 'Apa arti tanda di nama saya?',
                            answer: `Di menu "Buku Warga", setiap warga punya tanda:\n\n= BERSIH G tidak ada tunggakan, kehadiran bagus.\n= HUTANG Rp X,XXX G ada tunggakan yang harus segera dilunasi.\nGÜ½ WAFAT G status telah diubah admin (tidak lagi aktif di arisan).\nGÜ¬ NONAKTIF G pindah atau tidak aktif lagi.\n\nTanda merah kecil (G) di samping nama = warga punya rapor merah dari Alfa.`
                        },
                        {
                            label: 'Saya baru bergabung, apa yang perlu saya tahu?',
                            answer: `Selamat bergabung! Berikut yang perlu dipahami:\n\n1. Setiap bulan Anda membayar Rp ${(nominalArisan||10000).toLocaleString('id-ID')} arisan + Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')} jimpitan = Rp ${((nominalArisan||10000)+(nominalJimpitan||2000)).toLocaleString('id-ID')} total per pertemuan.\n\n2. Nama Anda masuk daftar undian. Anda akan menang tepat 1 kali per siklus.\n\n3. Jika tidak bisa hadir, beritahu admin sebelumnya agar dicatat Musibah (bukan Alfa).\n\n4. Tunggakan tidak hangus G harus dilunasi saat hadir berikutnya.`
                        },
                        {
                            label: 'Bagaimana cara cek status arisan saya?',
                            answer: `Buka menu "Pemenang" di beranda G cari nama Anda:\n\nG Nama ADA di daftar = Anda SUDAH menang di siklus ini. Selamat!\nGÅ¦ Nama TIDAK ADA = Anda belum mendapat giliran, masih akan diundi bulan mendatang.\n\nBuka menu "Buku Warga" untuk cek tunggakan dan status terkini Anda.`
                        }
                    ]
                },
                info_rt: {
                    label: '= Info & Jadwal RT', icon: 'campaign',
                    intro: 'Cara membaca pengumuman, galeri, inventaris, dan jadwal kegiatan.',
                    topics: [
                        {
                            label: 'Menu Info Warga',
                            answer: `Menu "Info Warga" berisi pengumuman resmi dari pengurus RT G seperti pemberitahuan jadwal, kegiatan, aturan baru, atau informasi penting lainnya.\n\nSemua warga bisa membaca tanpa perlu login. Informasi ini HANYA bisa ditulis dan diedit oleh Admin.`
                        },
                        {
                            label: 'Menu Galeri',
                            answer: `Galeri berisi foto-foto kegiatan dan dokumentasi RT.\n\nSemua warga bisa melihat. Foto diunggah oleh Admin sebagai bentuk transparansi kegiatan.`
                        },
                        {
                            label: 'Menu Inventaris',
                            answer: `Inventaris RT adalah daftar barang-barang milik RT beserta jumlah dan fotonya.\n\nSaat ini ada ${inventarisData?.length || 0} barang milik RT. Warga bisa melihat barang apa saja yang dimiliki RT (kursi, tenda, sound system, dll) sebagai bentuk transparansi aset bersama.`
                        },
                        {
                            label: 'Menu Jadwal Kegiatan',
                            answer: `Menu "Jadwal" menampilkan informasi pertemuan berikutnya: tanggal, waktu, lokasi, dan keterangan tambahan.\n\nCek menu ini untuk tahu kapan arisan berikutnya. Admin akan selalu memperbarui jadwal setelah setiap pertemuan selesai.`
                        }
                    ]
                },
                infaq_pinjam: {
                    label: '= Infaq & Pinjam', icon: 'volunteer_activism',
                    intro: 'Panduan donasi Infaq sukarela dan tata cara meminjam inventaris RT.',
                    topics: [
                        {
                            label: 'Bagaimana Cara Infaq?',
                            answer: `Infaq adalah donasi sukarela untuk kegiatan sosial RT.\n\n1. Masuk menu "Infaq"\n2. Isi nominal dan upload foto bukti transfer\n3. Kirim!\n\nStatus akan "PENDING" sampai disetujui Admin. Anda bisa melihat riwayat infaq Anda sendiri secara transparan.`
                        },
                        {
                            label: 'Bagaimana Cara Meminjam Barang RT?',
                            answer: `Jika Anda butuh meminjam barang (misal: kursi untuk hajatan):\n\n1. Lihat ketersediaan barang di menu "Inventaris"\n2. Hubungi Admin RT untuk serah terima\n3. Admin akan mencatat pinjaman Anda di menu "Pinjam Inventaris"\n\nBarang harus dikembalikan dalam kondisi baik sesuai kesepakatan!`
                        }
                    ]
                }
            };

            const currentKB = mode === 'admin' ? kbAdmin : kbWarga;
            const mainMenus = Object.keys(currentKB);

            const handleModeSwitch = (newMode) => {
                setMode(newMode);
                setActiveMenu(null);
                setMessages([{
                    sender: 'robot',
                    text: newMode === 'admin'
                        ? `Mode Admin aktif =\n\nSaya siap menjelaskan semua fitur teknis, logika kalkulasi, dan cara kerja sistem. Pilih menu:`
                        : `Mode Warga aktif =G=G=G=\n\nSaya akan menjelaskan data arisan dengan bahasa yang mudah dipahami. Pilih topik yang ingin Anda pahami:`
                }]);
            };

            const handleMenuClick = (menuKey) => {
                if (activeMenu === menuKey) { setActiveMenu(null); return; }
                const menu = currentKB[menuKey];
                setActiveMenu(menuKey);
                setMessages(prev => [...prev,
                    { sender: 'user', text: menu.label },
                    { sender: 'robot', text: `${menu.intro}\n\nPilih topik yang ingin Anda ketahui lebih lanjut =` }
                ]);
            };

            const handleTopicClick = (menuKey, topic) => {
                setMessages(prev => [...prev,
                    { sender: 'user', text: topic.label },
                    { sender: 'robot', text: topic.answer }
                ]);
                setActiveMenu(null);
            };

            const handleSearch = () => {
                const q = inputText.trim().toLowerCase();
                if (!q) return;
                const userMsg = inputText;
                setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
                setInputText('');
                let found = [];
                for (const menuKey of mainMenus) {
                    const menu = currentKB[menuKey];
                    for (const topic of menu.topics) {
                        const combined = (topic.label + ' ' + topic.answer).toLowerCase();
                        if (combined.includes(q)) found.push({ menuLabel: menu.label, topic });
                    }
                }
                if (found.length === 0) {
                    // coba di KB lainnya
                    const otherKB = mode === 'admin' ? kbWarga : kbAdmin;
                    for (const menuKey of Object.keys(otherKB)) {
                        const menu = otherKB[menuKey];
                        for (const topic of menu.topics) {
                            const combined = (topic.label + ' ' + topic.answer).toLowerCase();
                            if (combined.includes(q)) found.push({ menuLabel: menu.label, topic, otherMode: true });
                        }
                    }
                }
                if (found.length === 0) {
                    setMessages(prev => [...prev, { sender: 'robot', text: `Saya tidak menemukan info tentang "${userMsg}".\n\nCoba gunakan kata kunci seperti: tunggakan, pemenang, jimpitan, saldo, iuran, hapus, siklus, atau pilih menu di bawah =` }]);
                } else {
                    const best = found[0];
                    const extra = best.otherMode ? `\n\n= Info ini ada di mode ${mode === 'admin' ? 'Warga' : 'Admin'}. Coba ganti mode untuk topik lebih lanjut.` : (found.length > 1 ? `\n\n= Ada ${found.length - 1} topik lain yang relevan. Pilih menu untuk eksplorasi lebih lanjut.` : '');
                    setMessages(prev => [...prev, { sender: 'robot', text: `= ${best.menuLabel}:\n\n${best.topic.answer}${extra}` }]);
                }
            };

            return (
                <div className="fixed right-6 z-50 flex flex-col items-end no-print" style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}>
                    {isOpen && (
                        <div className="bg-white rounded-[24px] shadow-2xl border-2 border-slate-200 w-[320px] max-w-full sm:w-[380px] max-w-full overflow-hidden flex flex-col mb-4 max-h-[82vh]">

                            {/* Header */}
                            <div className={`text-white px-5 py-4 flex items-center justify-between shrink-0 ${mode === 'admin' ? 'bg-google-blue' : 'bg-google-green'}`}>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <Icon name="support_agent" className="text-[28px]" fill="true" />
                                    <div>
                                        <h3 className="font-extrabold text-[15px] leading-tight">Asisten Pintar RT</h3>
                                        <p className={`text-[10px] font-medium leading-tight ${mode === 'admin' ? 'text-blue-100' : 'text-green-100'}`}>{identity?.name || 'Sistem Arisan RT'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 w-8 h-8 flex items-center justify-center rounded-full transition-colors active:scale-95"><Icon name="close" className="text-[20px]" /></button>
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex flex-wrap gap-0 border-b-2 border-slate-100 shrink-0">
                                <button onClick={() => handleModeSwitch('warga')} className={`flex-1 py-2.5 text-[12px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${mode === 'warga' ? 'bg-google-greenLight text-google-greenDark border-b-2 border-google-green' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                                    <Icon name="group" className="text-[16px]" />Panduan Warga
                                </button>
                                <button onClick={() => handleModeSwitch('admin')} className={`flex-1 py-2.5 text-[12px] font-extrabold flex items-center justify-center gap-1.5 transition-all ${mode === 'admin' ? 'bg-google-blueLight text-google-blueDark border-b-2 border-google-blue' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                                    <Icon name="admin_panel_settings" className="text-[16px]" />Panduan Admin
                                </button>
                            </div>

                            {/* Chat area */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 space-y-3 bg-slate-50 hide-scrollbar border-y border-slate-100" style={{fontSize:'13px'}}>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.sender === 'robot' && (
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-1 shrink-0 ${mode === 'admin' ? 'bg-google-blue' : 'bg-google-green'}`}>
                                                <Icon name="support_agent" className="text-white text-[15px]" fill="true" />
                                            </div>
                                        )}
                                        <div className={`p-3 rounded-2xl max-w-[82%] leading-relaxed shadow-sm whitespace-pre-line font-medium ${msg.sender === 'user' ? (mode === 'admin' ? 'bg-google-blue' : 'bg-google-green') + ' text-white rounded-tr-sm text-[12px]' : 'bg-white text-google-text border border-slate-200 rounded-tl-sm text-[12.5px]'}`}>{msg.text}</div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Sub-topik */}
                            {activeMenu && (
                                <div className="px-3 py-2 bg-white border-b border-slate-100 flex flex-wrap gap-1.5 shrink-0 max-h-36 overflow-y-auto hide-scrollbar">
                                    <p className="w-full text-[10px] font-extrabold text-google-textVariant uppercase tracking-widest mb-0.5">{currentKB[activeMenu].label}</p>
                                    {currentKB[activeMenu].topics.map((t, i) => (
                                        <button key={i} onClick={() => handleTopicClick(activeMenu, t)} className={`text-[11px] font-bold px-3 py-1.5 rounded-full border active:scale-95 transition-all ${mode === 'admin' ? 'bg-google-blueLight text-google-blueDark border-google-blue/30 hover:bg-google-blue hover:text-white' : 'bg-google-greenLight text-google-greenDark border-google-green/30 hover:bg-google-green hover:text-white'}`}>{t.label}</button>
                                    ))}
                                    <button onClick={() => setActiveMenu(null)} className="text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-200 active:scale-95 transition-all">G Tutup</button>
                                </div>
                            )}

                            {/* Menu utama */}
                            {!activeMenu && (
                                <div className="px-3 py-2 bg-white border-b border-slate-100 flex flex-wrap gap-1.5 shrink-0 max-h-28 overflow-y-auto hide-scrollbar">
                                    <p className="w-full text-[10px] font-extrabold text-google-textVariant uppercase tracking-widest mb-0.5">Pilih Topik:</p>
                                    {mainMenus.map(key => (
                                        <button key={key} onClick={() => handleMenuClick(key)} className={`text-[11px] font-bold border-2 px-3 py-1.5 rounded-full active:scale-95 transition-all flex items-center gap-1 ${mode === 'admin' ? 'bg-slate-50 text-google-text border-slate-200 hover:border-google-blue hover:text-google-blue hover:bg-google-blueLight' : 'bg-slate-50 text-google-text border-slate-200 hover:border-google-green hover:text-google-greenDark hover:bg-google-greenLight'}`}>
                                            <Icon name={currentKB[key].icon} className="text-[13px]" />{currentKB[key].label.replace(/^[^\s]+\s/, '')}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Input */}
                            <div className="p-3 bg-white flex flex-wrap gap-2 shrink-0">
                                <input
                                    type="text" value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    placeholder={mode === 'admin' ? 'Tanya fitur sistem...' : 'Tanya tentang arisan Anda...'}
                                    className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-google-blue rounded-full px-4 py-2 text-[12px] font-medium outline-none transition-colors"
                                />
                                <button onClick={handleSearch} className={`w-9 h-9 text-white rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${mode === 'admin' ? 'bg-google-blue hover:bg-google-blueDark' : 'bg-google-green hover:bg-google-greenDark'}`}>
                                    <Icon name="send" className="text-[16px]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FAB */}
                    <button
                        onClick={toggleRobot}
                        className={`w-16 h-16 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-all border-4 border-white ${mode === 'admin' ? 'bg-google-blue hover:bg-google-blueDark' : 'bg-google-green hover:bg-google-greenDark'}`}
                        style={{ boxShadow: mode === 'admin' ? '0 8px 32px rgba(66,133,244,0.5)' : '0 8px 32px rgba(52,168,83,0.5)' }}
                    >
                        <Icon name={isOpen ? "close" : "support_agent"} className="text-[30px]" fill="true" />
                    </button>
                </div>
            );
        }



        /* ===== HELPER: Normalisasi URL Audio untuk Streaming ===== */
        function normalizeAudioUrl(url) {
            if (!url) return '';
            try {
                // Dropbox share link G dl.dropboxusercontent.com (direct stream, CORS OK)
                // Contoh: https://www.dropbox.com/s/XXXXX/file.mp3?dl=0
                //   G https://dl.dropboxusercontent.com/s/XXXXX/file.mp3
                if (url.includes('dropbox.com')) {
                    // Format baru Dropbox: /scl/fi/ atau /s/
                    let normalized = url
                        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                        .replace('?dl=0', '')
                        .replace('?dl=1', '')
                        .replace('&dl=0', '')
                        .replace('&dl=1', '');
                    // Hapus parameter rlkey jika ada (untuk URL baru Dropbox)
                    // dl.dropboxusercontent.com tidak butuh rlkey
                    return normalized;
                }
                // Google Drive viewer G langsung (catatan: GDrive sering CORS issue, tapi kita coba convert)
                // https://drive.google.com/file/d/ID/view G https://drive.google.com/uc?export=download&id=ID
                const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (gdriveMatch) {
                    return `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
                }
                return url;
            } catch(e) {
                return url;
            }
        }

        /* ================= FLOATING MUSIC PLAYER (WARGA ONLY) ================= */
        /* ================= BACKGROUND MUSIC PLAYER (WARGA ONLY - INVISIBLE) ================= */
        function FloatingMusicPlayer({ musicData }) {
            const audioRef = useRef(null);

            const streamUrl = normalizeAudioUrl(musicData?.url);

            useEffect(() => {
                if (!streamUrl) return;
                const audio = audioRef.current;
                if (!audio) return;

                audio.volume = 0.6;
                audio.loop = true;

                const attemptPlay = () => {
                    audio.play().catch(() => {
                        // Browser blokir autoplay G tunggu interaksi user
                    });
                };

                // Coba autoplay saat audio siap
                audio.addEventListener('canplay', attemptPlay, { once: true });
                audio.load();

                // Fallback: langsung play saat user pertama kali klik/tap layar
                const handleFirstInteraction = () => {
                    if (audio.paused) audio.play().catch(() => {});
                    document.removeEventListener('click', handleFirstInteraction, true);
                    document.removeEventListener('touchstart', handleFirstInteraction, true);
                };
                document.addEventListener('click', handleFirstInteraction, true);
                document.addEventListener('touchstart', handleFirstInteraction, true);

                // Cleanup: hentikan musik saat warga logout (komponen di-unmount)
                return () => {
                    audio.pause();
                    audio.src = '';
                    document.removeEventListener('click', handleFirstInteraction, true);
                    document.removeEventListener('touchstart', handleFirstInteraction, true);
                };
            }, [streamUrl]);

            // Render hanya elemen audio tersembunyi G tidak ada UI yang terlihat
            return <audio ref={audioRef} src={streamUrl} preload="auto" style={{ display: 'none' }} />;
        }


        /* ================= MUSIC ADMIN (ADMIN ONLY) ================= */
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
                <div className="space-y-6 max-w-2xl mx-auto">
                    {/* Hidden audio for test */}
                    <audio ref={previewAudioRef} preload="auto" style={{ display: 'none' }} />

                    {/* Header */}
                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm">
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="w-14 h-14 rounded-[20px] bg-google-yellowLight flex items-center justify-center border-2 border-google-yellow/40 shrink-0">
                                <Icon name="music_note" className="text-[32px] text-google-yellowDark" fill="true" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-extrabold text-google-text tracking-tight">Musik Warga</h2>
                                <p className="text-[13px] font-medium text-google-textVariant mt-0.5">Musik otomatis memutar untuk semua pengunjung Warga.</p>
                            </div>
                        </div>
                    </div>

                    {/* Status Musik Terpasang */}
                    {currentUrl ? (
                        <div className={`rounded-[28px] p-6 border-2 ${isEnabled ? 'bg-google-greenLight border-google-green/40' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border-2 ${isEnabled ? 'bg-google-green border-google-greenDark' : 'bg-slate-300 border-slate-400'}`}>
                                        <Icon name={isEnabled ? 'graphic_eq' : 'music_off'} className="text-white text-[20px]" fill="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-google-textVariant">{isEnabled ? '=Ä¦ Aktif' : '= Nonaktif'}</p>
                                        <p className="font-extrabold text-[15px] text-google-text truncate">{currentName || 'Musik RT'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 shrink-0">
                                    <button onClick={handleToggleEnabled}
                                            className={`px-3 py-2 rounded-full font-extrabold text-[12px] border-2 transition-all active:scale-95 ${isEnabled ? 'bg-white text-google-greenDark border-google-green/40 hover:bg-google-greenLight' : 'bg-google-green text-white border-google-greenDark'}`}>
                                        {isEnabled ? 'Nonaktifkan' : 'Aktifkan'}
                                    </button>
                                    <button onClick={handleDeleteMusic}
                                            className="px-3 py-2 rounded-full font-extrabold text-[12px] bg-google-redLight text-google-redDark border-2 border-google-red/30 hover:bg-google-red hover:text-white active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                        <Icon name="delete" className="text-[13px]" /> Hapus
                                    </button>
                                </div>
                            </div>
                            {/* Preview player native browser */}
                            {isEnabled && (
                                <div className="bg-white/80 rounded-[14px] p-3 border border-google-green/20">
                                    <p className="text-[10px] font-extrabold text-google-greenDark mb-2 uppercase tracking-widest">G Preview</p>
                                    <audio controls src={currentUrl} className="w-full" style={{ height: '36px' }}>
                                        Browser Anda tidak mendukung audio.
                                    </audio>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-[28px] p-8 border-2 border-dashed border-slate-300 text-center">
                            <Icon name="music_off" className="text-[40px] text-slate-300 mb-3" />
                            <p className="font-extrabold text-[16px] text-slate-500">Belum Ada Musik</p>
                            <p className="text-[13px] font-medium text-slate-400 mt-1">Masukkan URL Dropbox di bawah.</p>
                        </div>
                    )}

                    {/* Panduan Dropbox */}
                    <div className="bg-white rounded-[32px] border-2 border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex flex-wrap items-center gap-3">
                            <Icon name="cloud_upload" className="text-white text-[24px]" fill="true" />
                            <div>
                                <p className="text-white font-extrabold text-[15px]">Upload via Dropbox</p>
                                <p className="text-blue-100 text-[11px] font-medium">Cara terbaik G gratis, cepat, dan bebas CORS</p>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5 md:p-6">
                            <ol className="space-y-3 mb-5">
                                {[
                                    { step: '1', text: 'Buka dropbox.com dan login (atau daftar gratis).', icon: 'open_in_new' },
                                    { step: '2', text: 'Upload file MP3/WAV/OGG ke Dropbox Anda.', icon: 'upload' },
                                    { step: '3', text: 'Klik kanan file G "Share" G "Copy Link" G salin link yang muncul.', icon: 'share' },
                                    { step: '4', text: 'Paste link di kolom URL di bawah. Sistem otomatis mengkonversi ke link streaming.', icon: 'paste' },
                                ].map(item => (
                                    <li key={item.step} className="flex flex-wrap items-start gap-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">{item.step}</div>
                                        <p className="text-[13px] font-medium text-google-textVariant leading-snug">{item.text}</p>
                                    </li>
                                ))}
                            </ol>

                            {/* Form Input */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-extrabold text-google-textVariant block mb-1.5 ml-1 uppercase tracking-widest">Nama Lagu</label>
                                    <input type="text" value={nameInput} onChange={e => setNameInput(e.target.value)}
                                           placeholder="Contoh: Indonesia Raya Instrumental"
                                           className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white text-google-text rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-all placeholder:text-slate-400" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold text-google-textVariant block mb-1.5 ml-1 uppercase tracking-widest">URL Dropbox / Link Audio Langsung</label>
                                    <input type="url" value={urlInput} onChange={e => { setUrlInput(e.target.value); setTestStatus('idle'); setErrorMsg(''); }}
                                           placeholder="https://www.dropbox.com/s/xxxxx/lagu.mp3?dl=0"
                                           className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white text-google-text rounded-[14px] px-4 py-3 text-[13px] font-medium outline-none transition-all placeholder:text-slate-400" />
                                </div>

                                {/* Test button */}
                                <button onClick={handlePreviewTest}
                                        className="w-full bg-slate-100 text-google-textVariant py-2.5 rounded-[12px] font-extrabold text-[12px] border-2 border-slate-200 hover:bg-slate-200 active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2">
                                    <Icon name="play_circle" className="text-[16px]" /> Test Apakah URL Bisa Diputar
                                </button>

                                {/* Test result */}
                                {testStatus === 'testing' && (
                                    <div className="flex flex-wrap items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2.5 rounded-[12px] text-[12px] font-extrabold border-2 border-blue-200">
                                        <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                        Mengecek URL...
                                    </div>
                                )}
                                {testStatus === 'ok' && (
                                    <div className="bg-google-greenLight border-2 border-google-green/40 rounded-[12px] p-3">
                                        <p className="text-[12px] font-extrabold text-google-greenDark mb-2 flex flex-wrap items-center gap-1.5">
                                            <Icon name="check_circle" className="text-[14px]" fill="true" /> URL Valid G Preview:
                                        </p>
                                        <audio controls src={previewUrl} className="w-full" style={{ height: '34px' }} />
                                    </div>
                                )}
                                {testStatus === 'fail' && (
                                    <div className="flex flex-wrap items-center gap-2 bg-google-redLight text-google-redDark px-4 py-2.5 rounded-[12px] text-[12px] font-extrabold border-2 border-google-red/30">
                                        <Icon name="error" className="text-[14px]" fill="true" />
                                        URL gagal dimuat. Pastikan link Dropbox sudah benar dan file publik (tidak private).
                                    </div>
                                )}

                                {errorMsg && (
                                    <div className="flex flex-wrap items-center gap-2 bg-google-redLight text-google-redDark px-4 py-2.5 rounded-[12px] font-extrabold text-[12px] border-2 border-google-red/30">
                                        <Icon name="error" className="text-[14px]" fill="true" /> {errorMsg}
                                    </div>
                                )}

                                <button onClick={handleSaveUrl}
                                        className="w-full bg-google-green text-white py-3.5 rounded-[14px] font-extrabold text-[14px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2">
                                    <Icon name="save" className="text-[20px]" /> Simpan & Aktifkan Musik
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-google-yellowLight rounded-[24px] p-5 sm:p-6 md:p-8 border-2 border-google-yellow/40 flex flex-wrap items-start gap-3">
                        <Icon name="info" className="text-[20px] text-google-yellowDark shrink-0 mt-0.5" fill="true" />
                        <ul className="text-[12px] font-medium text-google-yellowDark/90 space-y-1 list-disc list-inside">
                            <li>Musik <strong>hanya memutar</strong> untuk pengguna login sebagai <strong>Warga</strong>.</li>
                            <li>Admin tidak mendengar musik saat login sebagai Admin.</li>
                            <li>Browser mobile kadang memblokir autoplay G warga cukup tap layar sekali.</li>
                            <li>Gunakan file audio bebas hak cipta atau milik sendiri.</li>
                        </ul>
                    </div>
                </div>
            );
        }


        
        function Umkm({ umkmData, setUmkmData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [formData, setFormData] = useState({ name: '', owner: '', phone: '', category: 'Lainnya', description: '', imageUrl: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [searchQuery, setSearchQuery] = useState('');
            const [selectedCategory, setSelectedCategory] = useState('Semua');

            const categories = ['Semua', 'Makanan & Minuman', 'Jasa', 'Toko/Warung', 'Pakaian', 'Kesehatan', 'Lainnya'];

            const handleSave = () => {
                if (!formData.name || !formData.phone) return setErrorMsg("Nama Usaha dan Nomor WhatsApp wajib diisi!");
                
                // Format phone number (ensure starts with 62)
                let formattedPhone = formData.phone.replace(/\D/g, '');
                if (formattedPhone.startsWith('0')) {
                    formattedPhone = '62' + formattedPhone.substring(1);
                } else if (!formattedPhone.startsWith('62')) {
                    formattedPhone = '62' + formattedPhone;
                }

                const newFormData = { ...formData, phone: formattedPhone };

                if (editingId) {
                    setUmkmData(umkmData.map(item => item.id === editingId ? { ...item, ...newFormData } : item));
                    setModalConfig && setModalConfig({ message: 'Data UMKM berhasil diperbarui.' });
                } else {
                    setUmkmData([{ id: Date.now(), ...newFormData }, ...umkmData]);
                    setModalConfig && setModalConfig({ message: 'Data UMKM berhasil ditambahkan.' });
                }
                setIsFormOpen(false);
                setEditingId(null);
            };

            const handleEdit = (item) => {
                setFormData({
                    name: item.name || '',
                    owner: item.owner || '',
                    phone: item.phone || '',
                    category: item.category || 'Lainnya',
                    description: item.description || '',
                    imageUrl: item.imageUrl || ''
                });
                setEditingId(item.id);
                setErrorMsg('');
                setIsUploading(false);
                setIsFormOpen(true);
            };

            const handleImageUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const MAX_SIZE = 800;
                        if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                        else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                        canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                        setFormData({ ...formData, imageUrl: compressedDataUrl });
                        setIsUploading(false);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            };

            const filteredData = (umkmData || []).filter(item => {
                const matchSearch = (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                    (item.owner || '').toLowerCase().includes(searchQuery.toLowerCase());
                const matchCategory = selectedCategory === 'Semua' || item.category === selectedCategory;
                return matchSearch && matchCategory;
            });

            // Mock modal config untuk alert sederhana jika tidak ada di props
            const [modalConfig, setModalConfig] = useState(null);

            return (
                <div className="animate-fade-in pb-24 max-w-7xl mx-auto px-4 sm:px-6 w-full">
                    {modalConfig && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-scale-up">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check_circle" className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Berhasil</h3>
                                <p className="text-slate-600 mb-8">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-full transition-all">Tutup</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-gradient-to-br from-green-50 to-emerald-100/50 p-6 sm:p-10 rounded-[32px] border border-green-200/60 shadow-[0_8px_30px_rgba(34,197,94,0.12)] mb-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 text-white rounded-2xl mb-4 shadow-lg">
                                    <Icon name="storefront" />
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mb-2">Pasar Warga RT</h1>
                                <p className="text-slate-600 text-[15px] sm:text-[16px] max-w-xl font-medium leading-relaxed">Direktori usaha milik warga RT. Dukung UMKM lokal dengan berbelanja dari tetangga sendiri.</p>
                            </div>
                            {userRole === 'admin' && (
                                <button onClick={() => { setFormData({ name: '', owner: '', phone: '', category: 'Lainnya', description: '', imageUrl: '' }); setEditingId(null); setIsFormOpen(true); }} className="w-full md:w-auto bg-green-600 text-white px-8 py-4 rounded-full font-extrabold text-[15px] shadow-[0_8px_25px_rgba(22,163,74,0.3)] hover:bg-green-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2 group">
                                    <Icon name="add_circle" className="group-hover:rotate-90 transition-transform duration-300" /> Tambah Usaha
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mb-6 flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Cari nama usaha atau pemilik..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-2xl focus:border-green-500 outline-none transition-all font-medium text-slate-700" />
                        </div>
                        <div className="relative min-w-[200px]">
                            <Icon name="filter_list" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="w-full pl-12 pr-10 py-3.5 bg-white border-2 border-slate-200 rounded-2xl focus:border-green-500 outline-none transition-all font-bold text-slate-700 appearance-none cursor-pointer">
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {filteredData.length === 0 ? (
                        <div className="bg-white/80 backdrop-blur-md rounded-[32px] p-12 text-center border-2 border-dashed border-slate-200 shadow-sm">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Icon name="store_off" className="text-[48px] text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Belum Ada UMKM</h3>
                            <p className="text-slate-500 font-medium">Daftar usaha warga masih kosong atau tidak ditemukan.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredData.map(item => (
                                <div key={item.id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group flex flex-col h-full">
                                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden shrink-0">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                                <Icon name="image" className="text-4xl mb-2" />
                                                <span className="text-sm font-medium">Tidak ada foto</span>
                                            </div>
                                        )}
                                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[12px] font-bold text-green-700 shadow-sm border border-green-100 flex items-center gap-1">
                                            <Icon name="sell" className="text-[14px]" /> {item.category}
                                        </div>
                                        {userRole === 'admin' && (
                                            <div className="absolute top-4 right-4 flex gap-2">
                                                <button onClick={() => handleEdit(item)} className="w-10 h-10 bg-white/95 text-blue-600 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-50 transition-colors">
                                                    <Icon name="edit" className="text-[20px]" />
                                                </button>
                                                <button onClick={() => setDeleteConfirmId(item.id)} className="w-10 h-10 bg-white/95 text-red-500 rounded-full shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors">
                                                    <Icon name="delete" className="text-[20px]" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 flex flex-col flex-1">
                                        <h3 className="font-extrabold text-xl text-slate-800 mb-1 line-clamp-1">{item.name}</h3>
                                        <div className="flex items-center text-slate-500 text-sm mb-4 font-medium">
                                            <Icon name="person" className="text-[16px] mr-1" /> {item.owner}
                                        </div>
                                        <p className="text-slate-600 text-sm mb-6 line-clamp-3 leading-relaxed flex-1">
                                            {item.description || 'Tidak ada deskripsi.'}
                                        </p>
                                        <a href={`https://wa.me/${item.phone}?text=Halo%20${encodeURIComponent(item.owner)},%20saya%20melihat%20usaha%20Anda%20di%20Portal%20Warga.%20Bisa%20tanya-tanya?`} target="_blank" rel="noopener noreferrer" className="mt-auto w-full bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border-2 border-green-200 hover:border-green-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
                                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                            Hubungi Penjual
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {isFormOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[90vh]">
                                <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-green-50 to-white rounded-t-[32px]">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                        <Icon name="storefront" className="text-green-600" />
                                        {editingId ? 'Edit Data UMKM' : 'Tambah UMKM Baru'}
                                    </h2>
                                    <button onClick={() => setIsFormOpen(false)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 transition-all">
                                        <Icon name="close" />
                                    </button>
                                </div>
                                <div className="p-6 sm:p-8 overflow-y-auto space-y-5">
                                    {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[14px] font-bold border border-red-100 flex items-center gap-2"><Icon name="error" /> {errorMsg}</div>}
                                    
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Nama Usaha / Toko</label>
                                        <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700" placeholder="Contoh: Warung Barokah" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Nama Pemilik</label>
                                        <input type="text" value={formData.owner} onChange={e => setFormData({...formData, owner: e.target.value})} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700" placeholder="Contoh: Bpk. Budi" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Nomor WhatsApp</label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">+62</div>
                                            <input type="number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border-2 border-slate-200 rounded-2xl pl-12 pr-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700" placeholder="81234567890" />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-bold text-slate-700 appearance-none bg-white">
                                            {categories.filter(c => c !== 'Semua').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Deskripsi Usaha</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="3" className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-green-500 outline-none transition-all font-medium text-slate-700 resize-none" placeholder="Menjual berbagai macam kebutuhan..."></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Foto (Opsional)</label>
                                        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            {isUploading ? (
                                                <div className="flex flex-col items-center justify-center text-slate-500 py-4"><Icon name="sync" className="animate-spin text-[32px] mb-2 text-green-500" /><span className="font-bold">Memproses gambar...</span></div>
                                            ) : formData.imageUrl ? (
                                                <div className="relative inline-block">
                                                    <img src={formData.imageUrl} alt="Preview" className="h-32 object-contain rounded-xl shadow-sm" />
                                                    <div className="absolute top-2 right-2 bg-slate-900/60 text-white text-[11px] px-2 py-1 rounded-md font-bold">Ganti</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-500 py-4"><Icon name="add_a_photo" className="text-[36px] mb-3 text-slate-400" /><span className="font-bold text-sm">Upload foto</span></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 sm:p-8 border-t border-slate-100 flex gap-3 shrink-0 bg-slate-50 rounded-b-[32px]">
                                    <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-white text-slate-700 font-bold py-4 rounded-full border-2 border-slate-200 hover:bg-slate-100">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 bg-green-600 text-white font-black py-4 rounded-full shadow-lg shadow-green-600/30 hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50">Simpan Data</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deleteConfirmId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                            <div className="bg-white max-w-sm w-full rounded-[28px] shadow-2xl p-8 text-center animate-scale-up">
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                                    <Icon name="warning" className="text-[40px] text-red-500" />
                                </div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">Hapus UMKM?</h3>
                                <p className="text-slate-500 font-medium mb-8">Data usaha yang dihapus tidak dapat dikembalikan. Yakin?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-full font-bold hover:bg-slate-200">Batal</button>
                                    <button onClick={() => {
                                        setUmkmData(umkmData.filter(item => item.id !== deleteConfirmId));
                                        setModalConfig && setModalConfig({ message: 'Data UMKM dihapus.' });
                                        setDeleteConfirmId(null);
                                    }} className="flex-1 py-3.5 bg-red-500 text-white rounded-full font-bold shadow-md hover:bg-red-600 active:scale-95">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        
        function Pengaduan({ laporanData, setLaporanData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [formData, setFormData] = useState({ title: '', category: 'Infrastruktur', description: '', reporter: '', imageUrl: '', status: 'Menunggu' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [filterStatus, setFilterStatus] = useState('Semua');

            const categories = ['Infrastruktur', 'Keamanan', 'Kebersihan', 'Sosial', 'Lainnya'];
            const statuses = ['Menunggu', 'Diproses', 'Selesai'];

            const handleSave = () => {
                if (!formData.title || !formData.description) return setErrorMsg("Judul dan Deskripsi wajib diisi!");
                const newLaporan = { id: Date.now(), date: new Date().toISOString(), ...formData };
                setLaporanData([newLaporan, ...(laporanData || [])]);
                setIsFormOpen(false);
                setFormData({ title: '', category: 'Infrastruktur', description: '', reporter: '', imageUrl: '', status: 'Menunggu' });
                setModalConfig && setModalConfig({ message: 'Laporan berhasil dikirim.' });
            };

            const handleImageUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width; let height = img.height;
                        const MAX = 800;
                        if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
                        else if (height > MAX) { width *= MAX / height; height = MAX; }
                        canvas.width = width; canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        setFormData({ ...formData, imageUrl: canvas.toDataURL('image/jpeg', 0.6) });
                        setIsUploading(false);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            };

            const changeStatus = (id, newStatus) => {
                setLaporanData((laporanData || []).map(item => item.id === id ? { ...item, status: newStatus } : item));
            };

            const filteredData = (laporanData || []).filter(item => filterStatus === 'Semua' || item.status === filterStatus);

            const [modalConfig, setModalConfig] = useState(null);

            const getStatusColor = (status) => {
                switch(status) {
                    case 'Menunggu': return 'bg-red-100 text-red-700 border-red-200';
                    case 'Diproses': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
                    case 'Selesai': return 'bg-green-100 text-green-700 border-green-200';
                    default: return 'bg-slate-100 text-slate-700 border-slate-200';
                }
            };

            const formatDate = (isoString) => {
                const date = new Date(isoString);
                return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            };

            return (
                <div className="animate-fade-in pb-24 max-w-7xl mx-auto px-4 sm:px-6 w-full">
                    {modalConfig && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-scale-up">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check_circle" className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Berhasil</h3>
                                <p className="text-slate-600 mb-8">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-full transition-all">Tutup</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-gradient-to-br from-indigo-50 to-blue-100/50 p-6 sm:p-10 rounded-[32px] border border-blue-200/60 shadow-[0_8px_30px_rgba(59,130,246,0.12)] mb-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 text-white rounded-2xl mb-4 shadow-lg">
                                    <Icon name="campaign" />
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mb-2">Lapor RT</h1>
                                <p className="text-slate-600 text-[15px] sm:text-[16px] max-w-xl font-medium leading-relaxed">Sistem Pengaduan dan Aspirasi Warga. Laporkan keluhan atau berikan saran untuk lingkungan kita.</p>
                            </div>
                            <button onClick={() => setIsFormOpen(true)} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-full font-extrabold text-[15px] shadow-[0_8px_25px_rgba(37,99,235,0.3)] hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2 group">
                                <Icon name="add_circle" className="group-hover:rotate-90 transition-transform duration-300" /> Buat Laporan
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {['Semua', ...statuses].map(status => (
                            <button key={status} onClick={() => setFilterStatus(status)} className={`px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all ${filterStatus === status ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                                {status}
                            </button>
                        ))}
                    </div>

                    {filteredData.length === 0 ? (
                        <div className="bg-white/80 backdrop-blur-md rounded-[32px] p-12 text-center border-2 border-dashed border-slate-200 shadow-sm">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Icon name="task_alt" className="text-[48px] text-slate-300" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-2">Belum Ada Laporan</h3>
                            <p className="text-slate-500 font-medium">Lingkungan aman terkendali. Belum ada pengaduan warga.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredData.map(item => (
                                <div key={item.id} className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{item.category}</span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>{item.status}</span>
                                        </div>
                                        {userRole === 'admin' && (
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                                <Icon name="delete" className="text-[16px]" />
                                            </button>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800 mb-2">{item.title}</h3>
                                    <p className="text-slate-600 text-sm mb-4 leading-relaxed line-clamp-4">{item.description}</p>
                                    
                                    {item.imageUrl && (
                                        <div className="mb-4 rounded-xl overflow-hidden bg-slate-100 h-48 border border-slate-200">
                                            <img src={item.imageUrl} alt="Lampiran Laporan" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500">
                                        <div className="flex items-center gap-1.5"><Icon name="person" className="text-[16px]" /> {item.reporter || 'Warga'}</div>
                                        <div className="flex items-center gap-1.5"><Icon name="schedule" className="text-[16px]" /> {formatDate(item.date)}</div>
                                    </div>

                                    {userRole === 'admin' && (
                                        <div className="mt-4 flex gap-2">
                                            {statuses.map(st => (
                                                item.status !== st && (
                                                    <button key={st} onClick={() => changeStatus(item.id, st)} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${st === 'Menunggu' ? 'border-red-200 text-red-600 hover:bg-red-50' : st === 'Diproses' ? 'border-yellow-200 text-yellow-600 hover:bg-yellow-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                                                        Set {st}
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {isFormOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[90vh]">
                                <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-50 to-white rounded-t-[32px]">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                        <Icon name="campaign" className="text-blue-600" /> Buat Laporan
                                    </h2>
                                    <button onClick={() => setIsFormOpen(false)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 transition-all"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 sm:p-8 overflow-y-auto space-y-5">
                                    {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[14px] font-bold border border-red-100 flex items-center gap-2"><Icon name="error" /> {errorMsg}</div>}
                                    
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Judul Laporan</label>
                                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700" placeholder="Cth: Lampu jalan mati di Blok A" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-bold text-slate-700 appearance-none bg-white">
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Isi Laporan / Detail</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="4" className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 resize-none" placeholder="Ceritakan detail masalah..."></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Nama Pelapor (Opsional)</label>
                                        <input type="text" value={formData.reporter} onChange={e => setFormData({...formData, reporter: e.target.value})} className="w-full border-2 border-slate-200 rounded-2xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700" placeholder="Kosongkan jika ingin anonim" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Lampiran Foto (Opsional)</label>
                                        <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors relative">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            {isUploading ? (
                                                <div className="flex flex-col items-center justify-center text-slate-500 py-4"><Icon name="sync" className="animate-spin text-[32px] mb-2 text-blue-500" /><span className="font-bold">Memproses gambar...</span></div>
                                            ) : formData.imageUrl ? (
                                                <div className="relative inline-block">
                                                    <img src={formData.imageUrl} alt="Preview" className="h-32 object-contain rounded-xl shadow-sm" />
                                                    <div className="absolute top-2 right-2 bg-slate-900/60 text-white text-[11px] px-2 py-1 rounded-md font-bold">Ganti</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-500 py-4"><Icon name="add_a_photo" className="text-[36px] mb-3 text-slate-400" /><span className="font-bold text-sm">Upload foto bukti</span></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 sm:p-8 border-t border-slate-100 flex gap-3 shrink-0 bg-slate-50 rounded-b-[32px]">
                                    <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-white text-slate-700 font-bold py-4 rounded-full border-2 border-slate-200 hover:bg-slate-100">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 bg-blue-600 text-white font-black py-4 rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">Kirim Laporan</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deleteConfirmId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                            <div className="bg-white max-w-sm w-full rounded-[28px] shadow-2xl p-8 text-center animate-scale-up">
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5"><Icon name="warning" className="text-[40px] text-red-500" /></div>
                                <h3 className="text-xl font-black text-slate-800 mb-2">Hapus Laporan?</h3>
                                <p className="text-slate-500 font-medium mb-8">Laporan yang dihapus tidak dapat dikembalikan. Yakin?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 bg-slate-100 text-slate-700 rounded-full font-bold hover:bg-slate-200">Batal</button>
                                    <button onClick={() => {
                                        setLaporanData((laporanData || []).filter(item => item.id !== deleteConfirmId));
                                        setModalConfig && setModalConfig({ message: 'Laporan dihapus.' });
                                        setDeleteConfirmId(null);
                                    }} className="flex-1 py-3.5 bg-red-500 text-white rounded-full font-bold shadow-md hover:bg-red-600 active:scale-95">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function App() {

            

            
            const [isLoggedIn, setIsLoggedIn] = useState(false);
            const [userRole, setUserRole] = useState(null); 
            const [activeTab, setActiveTab] = useState('menu'); 
            const [showLogoutModal, setShowLogoutModal] = useState(false);
            const [showLicenseModal, setShowLicenseModal] = useState(false);
            const [isOffline, setIsOffline] = useState(!navigator.onLine); 
            
            // Core Database States
            const [members, setMembers, l1] = useFirebaseSync('members', []);
            const [currentRound, setCurrentRound, l2] = useFirebaseSync('round', 1);
            const [cycleNumber, setCycleNumber, l3] = useFirebaseSync('cycle', 1);
            const [arisanPeriod, setArisanPeriod, l4] = useFirebaseSync('period', () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
            const [jimpitanBalance, setJimpitanBalance, l5] = useFirebaseSync('jimpitan', 0);
            const [meetingHistory, setMeetingHistory, l6] = useFirebaseSync('history', []);
            const [kasRtBalance, setKasRtBalance, l7] = useFirebaseSync('kas_rt_balance', 0);
            const [kasRtTransactions, setKasRtTransactions, l8] = useFirebaseSync('kas_rt_trx', []);
            const [nominalArisan, setNominalArisan, l10] = useFirebaseSync('nominal_arisan', 10000);
            const [nominalJimpitan, setNominalJimpitan, l11] = useFirebaseSync('nominal_jimpitan', 10000);
            const [identity, setIdentity, l12] = useFirebaseSync('identity', { name: 'Aplikasi Arisan RT', subtitle: 'Wilayah Kependudukan Anda' });

            useEffect(() => {
                if (identity?.logoApp) {
                    let link = document.querySelector("link[rel~='icon']");
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = 'icon';
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    link.href = identity.logoApp;
                }
            }, [identity?.logoApp]);
            const [nextMeeting, setNextMeeting, l13] = useFirebaseSync('next_meeting', { date: 'Belum dijadwalkan', time: '-', location: '-', notes: '-' });
            const [informasi, setInformasi, l14] = useFirebaseSync('informasi', []);
            const defaultLegal = {
                enabled: true,
                terms: "1. Akses Portal: Portal ini hanya diperuntukkan bagi warga lingkungan yang terdaftar sah. Dilarang membagikan akses login kepada pihak luar.\n2. Penggunaan Fitur: Warga dilarang menyalahgunakan fitur portal untuk menyebarkan hoaks, ujaran kebencian, atau pelanggaran hukum.\n3. Hak Admin: Admin (Pengurus Lingkungan) berhak memblokir akun warga yang terbukti melanggar aturan atau memalsukan data.\n4. Validitas Data: Warga bertanggung jawab penuh atas kebenaran data yang diunggah.",
                privacy: "1. Pengumpulan Data: Sistem mengumpulkan data (seperti Nama, NIK, Alamat) murni untuk keperluan administrasi rukun tetangga.\n2. Keamanan Data: Data disimpan di server cloud secara aman dengan sistem database modern.\n3. Anti Jual-Beli Data: Kami menjamin 100% bahwa data warga tidak akan pernah dijual atau diberikan ke pihak ketiga untuk tujuan komersial.\n4. Keterbukaan Data Kas: Informasi keuangan diproses secara transparan demi akuntabilitas lingkungan."
            };
            const [legalData, setLegalData, l_legal] = useFirebaseSync('legal', defaultLegal);
            const [showLegalModal, setShowLegalModal] = useState(null); // 'terms' | 'privacy' | null
            const [iuranData, setIuranData, l15] = useFirebaseSync('iuran_umum', []);
            const [galeriData, setGaleriData, l17] = useFirebaseSync('galeri_warga', []);
            const [umkmData, setUmkmData, l_umkm] = useFirebaseSync('umkm', []);
        const [laporanData, setLaporanData] = useFirebaseSync('laporan', []);
            const [inventarisData, setInventarisData, l18] = useFirebaseSync('inventaris_rt', []);
            const [bannerImage, setBannerImage, l19] = useFirebaseSync('banner_image', '');
            const [pinjamData, setPinjamData, l21] = useFirebaseSync('pinjam_inventaris', []);
            const [infaqData, setInfaqData, l22] = useFirebaseSync('infaq_data', []);
            const [musicData, setMusicData, l23] = useFirebaseSync('music_config', { url: '', name: '', enabled: true });
            const [sponsorsData, setSponsorsData, l24] = useFirebaseSync('sponsors_data', { enabled: false, sponsors: [] });
            const [infoDesa, setInfoDesa, l25] = useFirebaseSync('info_desa', {
                enabled: true,
                batas: { utara: 'Desa Adan-adan', selatan: 'Desa Gurah', timur: 'Desa Tumpang', barat: 'Desa Sukorejo' },
                kontak: [
                    { id: 1, nama: 'Ambulans Siaga Desa', telepon: '0812-3456-7890', icon: 'local_hospital', color: 'red' },
                    { id: 2, nama: 'Kantor Balai Desa', telepon: '(0354) 689123', icon: 'business', color: 'slate' },
                    { id: 3, nama: 'Bhabinkamtibmas', telepon: '0821-4455-6677', icon: 'security', color: 'blue' },
                    { id: 4, nama: 'Babinsa Desa', telepon: '0857-8899-0011', icon: 'military_tech', color: 'green' }
                ]
            });

            // State khusus UI tambahan
            const [showPwaGuide, setShowPwaGuide] = useState(false);

            // Jika Firebase tidak tersedia (offline total / gagal init), anggap semua loaded
            const firebaseUnavailable = !db;
            const isAppReady = firebaseUnavailable || (l1 && l2 && l3 && l4 && l5 && l6 && l7 && l8 && l10 && l11 && l12 && l13 && l14 && l15 && l17 && l18 && l19 && l21 && l22 && l23 && l24 && l25);

            useEffect(() => {
                if (auth && onAuthStateChanged) {
                    const unsubscribe = onAuthStateChanged(auth, (user) => {
                        if (user && user.uid === '7kGABJkj7APXHPtyVQUHQeoz0Cy1') {
                            setUserRole('admin');
                            setIsLoggedIn(true);
                            if (window.location.hash === '') window.location.hash = 'menu';
                        }
                    });
                    return () => unsubscribe();
                }
            }, []);

            useEffect(() => {
                const handleOnline = () => setIsOffline(false);
                const handleOffline = () => setIsOffline(true);
                window.addEventListener('online', handleOnline);
                window.addEventListener('offline', handleOffline);

                const handleAppInstalled = () => {
                    try { sessionStorage.setItem('pwa_banner_dismissed', '1'); } catch(e) {}
                    console.log('[PWA] Aplikasi berhasil diinstall ke perangkat.');
                };
                window.addEventListener('appinstalled', handleAppInstalled);
                
                const handleHashChange = () => {
                    const hash = window.location.hash.replace('#', '');
                    if (hash) setActiveTab(hash);
                    else setActiveTab('menu');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };
                window.addEventListener('hashchange', handleHashChange);
                handleHashChange(); 
                
                return () => {
                    window.removeEventListener('online', handleOnline);
                    window.removeEventListener('offline', handleOffline);
                    window.removeEventListener('appinstalled', handleAppInstalled);
                    window.removeEventListener('hashchange', handleHashChange);
                };
            }, []);

            const changeTab = (tabId) => { window.location.hash = tabId; };

            if (!isAppReady) {
                return (
                    <div className="fixed inset-0 z-[999] bg-slate-100/90 backdrop-blur-md flex justify-center items-center">
                        <div className="bg-white p-8 sm:p-10 rounded-[32px] shadow-2xl border-2 border-slate-200 flex flex-col items-center max-w-[300px] max-w-full w-[90%] relative overflow-hidden">
                            <div className="flex h-2 w-full absolute top-0 left-0">
                                <div className="w-1/4 bg-google-blue"></div>
                                <div className="w-1/4 bg-google-red"></div>
                                <div className="w-1/4 bg-google-yellow"></div>
                                <div className="w-1/4 bg-google-green"></div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-4 mb-6 h-8">
                                <div className="w-4 h-4 rounded-full bg-google-blue animate-bounce" style={{ animationDelay: '0s', animationDuration: '0.9s' }}></div>
                                <div className="w-4 h-4 rounded-full bg-google-red animate-bounce" style={{ animationDelay: '0.15s', animationDuration: '0.9s' }}></div>
                                <div className="w-4 h-4 rounded-full bg-google-yellow animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.9s' }}></div>
                                <div className="w-4 h-4 rounded-full bg-google-green animate-bounce" style={{ animationDelay: '0.45s', animationDuration: '0.9s' }}></div>
                            </div>
                            <h2 className="text-google-text font-extrabold text-[18px] mb-3 tracking-tight text-center">Memuat Portal</h2>
                            <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-200">
                                <div className="w-2 h-2 bg-google-blue rounded-full animate-pulse"></div>
                                <p className="text-[10px] font-extrabold text-google-textVariant uppercase tracking-widest">Sinkronisasi Data</p>
                            </div>
                        </div>
                    </div>
                );
            }

            if (!isLoggedIn) {
                return (
                    <>
                        <LoginScreen legalData={legalData} setShowLegalModal={setShowLegalModal} onLogin={(role) => { 
                            setIsLoggedIn(true); setUserRole(role); window.location.hash = 'menu';
                        }} identity={identity} setShowPwaGuide={setShowPwaGuide} />
                        {showPwaGuide && <PwaGuideModal onClose={() => setShowPwaGuide(false)} />}
                        {showLegalModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-fade-in">
                            <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border-2 border-slate-100/50 max-h-[80vh]">
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                                    <h3 className="text-[16px] font-black text-slate-800 flex items-center gap-2">
                                        <Icon name={showLegalModal === 'terms' ? 'gavel' : 'privacy_tip'} className="text-google-blue" /> 
                                        {showLegalModal === 'terms' ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'}
                                    </h3>
                                    <button onClick={() => setShowLegalModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar">
                                    <div className="prose prose-sm text-slate-600 text-justify leading-relaxed whitespace-pre-wrap">
                                        {showLegalModal === 'terms' ? legalData?.terms : legalData?.privacy}
                                    </div>
                                </div>
                                <div className="p-4 border-t border-slate-100 shrink-0">
                                    <button onClick={() => setShowLegalModal(null)} className="w-full bg-google-blue hover:bg-google-blueDark text-white py-3.5 rounded-xl font-extrabold text-[14px] transition-colors active:scale-95">Tutup & Lanjutkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    </>
                );
            }

            const executeLogout = () => {
                if (auth && signOut && userRole === 'admin') {
                    signOut(auth).then(() => {
                        setIsLoggedIn(false); setUserRole(null); setActiveTab('menu'); window.location.hash = ''; setShowLogoutModal(false);
                    }).catch(console.error);
                } else {
                    setIsLoggedIn(false); setUserRole(null); setActiveTab('menu'); window.location.hash = ''; setShowLogoutModal(false);
                }
            };

            const NavItems = [
                { id: 'dashboard', icon: 'dashboard', label: 'Ringkasan', bg: 'bg-google-blueLight', color: 'text-google-blueDark border-2 border-google-blue' },
                { id: 'informasi', icon: 'campaign', label: 'Info Warga', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border-2 border-google-yellow' },
                { id: 'warga', icon: 'group', label: 'Buku Warga', bg: 'bg-google-greenLight', color: 'text-google-greenDark border-2 border-google-green' },
                { id: 'galery', icon: 'photo_library', label: 'Galeri', bg: 'bg-slate-100', color: 'text-google-text border-2 border-slate-300' },
                { id: 'inventaris', icon: 'inventory_2', label: 'Inventaris', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border-2 border-google-yellow' },
                { id: 'umkm', icon: 'storefront', label: 'UMKM RT', bg: 'bg-green-100', color: 'text-green-700 border-2 border-green-500' },
                { id: 'pengaduan', icon: 'report_problem', label: 'Lapor RT', bg: 'bg-blue-100', color: 'text-blue-700 border-2 border-blue-500' },
                { id: 'pinjam', icon: 'handshake', label: 'Pinjam Inventaris', bg: 'bg-google-greenLight', color: 'text-google-greenDark border-2 border-google-green' },
                { id: 'iuran', icon: 'volunteer_activism', label: 'Iuran Umum', bg: 'bg-google-redLight', color: 'text-google-redDark border-2 border-google-red' },
                { id: 'kas', icon: 'account_balance_wallet', label: 'Kas RT', bg: 'bg-google-blueLight', color: 'text-google-blueDark border-2 border-google-blue' },
                { id: 'laporan', icon: 'history', label: 'Arsip Riwayat', bg: 'bg-slate-100', color: 'text-google-text border-2 border-slate-300' },
                { id: 'infaq', icon: 'volunteer_activism', label: 'Infaq', bg: 'bg-google-greenLight', color: 'text-google-greenDark border-2 border-google-green' },
                { id: 'pemenang', icon: 'emoji_events', label: 'Pemenang', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border-2 border-google-yellow' },
                { id: 'kegiatan', icon: 'event', label: 'Jadwal', bg: 'bg-google-blueLight', color: 'text-google-blueDark border-2 border-google-blue' },
                { id: 'kalender', icon: 'calendar_month', label: 'Kalender', bg: 'bg-google-redLight', color: 'text-google-redDark border-2 border-google-red' },
                { id: 'peta', icon: 'map', label: 'Peta Desa', bg: 'bg-slate-100', color: 'text-google-text border-2 border-slate-300' },
                ...(userRole === 'admin' ? [
                    { id: 'pertemuan', icon: 'checklist', label: 'Absen Arisan', bg: 'bg-google-greenLight', color: 'text-google-greenDark border-2 border-google-green' },
                    { id: 'musik', icon: 'music_note', label: 'Musik Warga', bg: 'bg-google-yellowLight', color: 'text-google-yellowDark border-2 border-google-yellow' },
                    { id: 'pengaturan', icon: 'settings', label: 'Setelan Admin', bg: 'bg-slate-100', color: 'text-google-text border-2 border-slate-300' }
                ] : [])
            ];

            const renderContent = () => {
                switch(activeTab) {
                    case 'menu': return <MainMenu userRole={userRole} NavItems={NavItems} changeTab={changeTab} identity={identity} bannerImage={bannerImage} setShowPwaGuide={setShowPwaGuide} sponsorsData={sponsorsData} nextMeeting={nextMeeting} />;
                    case 'dashboard': return <Dashboard members={members} setMembers={setMembers} jimpitanBalance={jimpitanBalance} kasRtBalance={kasRtBalance} currentRound={currentRound} setCurrentRound={setCurrentRound} userRole={userRole} cycleNumber={cycleNumber} setCycleNumber={setCycleNumber} changeTab={changeTab} arisanPeriod={arisanPeriod} />;
                    case 'informasi': return <Informasi data={informasi} setData={setInformasi} userRole={userRole} />;
                    case 'warga': return <WargaList members={members} setMembers={setMembers} userRole={userRole} identity={identity} cycleNumber={cycleNumber} currentRound={currentRound} arisanPeriod={arisanPeriod} />;
                    case 'galery': return <Galeri data={galeriData} setData={setGaleriData} userRole={userRole} />;
                    case 'inventaris': return <Inventaris data={inventarisData} setData={setInventarisData} userRole={userRole} pinjamData={pinjamData} />;
                    case 'umkm': return <Umkm umkmData={umkmData} setUmkmData={setUmkmData} userRole={userRole} />;
                    case 'pengaduan': return <Pengaduan laporanData={laporanData} setLaporanData={setLaporanData} userRole={userRole} />;
                    case 'pinjam': return <PinjamInventaris inventarisData={inventarisData} setInventarisData={setInventarisData} pinjamData={pinjamData} setPinjamData={setPinjamData} members={members} userRole={userRole} />;
                    case 'iuran': return <IuranUmum iuranData={iuranData} setIuranData={setIuranData} members={members} userRole={userRole} kasRtBalance={kasRtBalance} setKasRtBalance={setKasRtBalance} kasRtTransactions={kasRtTransactions} setKasRtTransactions={setKasRtTransactions} identity={identity} />;
                    case 'kas': return <BukuKas balance={kasRtBalance} setBalance={setKasRtBalance} transactions={kasRtTransactions} setTransactions={setKasRtTransactions} userRole={userRole} identity={identity} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} />;
                    case 'laporan': return <Laporan history={meetingHistory} setMeetingHistory={setMeetingHistory} members={members} setMembers={setMembers} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} nominalArisan={nominalArisan} nominalJimpitan={nominalJimpitan} cycleNumber={cycleNumber} identity={identity} userRole={userRole} />;
                    case 'pertemuan': return userRole === 'admin' ? <Pertemuan members={members} setMembers={setMembers} currentRound={currentRound} setCurrentRound={setCurrentRound} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} setMeetingHistory={setMeetingHistory} onFinish={() => changeTab('menu')} nominalArisan={nominalArisan} nominalJimpitan={nominalJimpitan} arisanPeriod={arisanPeriod} setArisanPeriod={setArisanPeriod} identity={identity} cycleNumber={cycleNumber} /> : null;
                    case 'pengaturan': return userRole === 'admin' ? <Pengaturan nominalArisan={nominalArisan} setNominalArisan={setNominalArisan} nominalJimpitan={nominalJimpitan} setNominalJimpitan={setNominalJimpitan} identity={identity} setIdentity={setIdentity} setMembers={setMembers} setMeetingHistory={setMeetingHistory} currentRound={currentRound} setCurrentRound={setCurrentRound} cycleNumber={cycleNumber} setCycleNumber={setCycleNumber} jimpitanBalance={jimpitanBalance} setJimpitanBalance={setJimpitanBalance} kasRtBalance={kasRtBalance} setKasRtBalance={setKasRtBalance} kasRtTransactions={kasRtTransactions} setKasRtTransactions={setKasRtTransactions} arisanPeriod={arisanPeriod} setArisanPeriod={setArisanPeriod} bannerImage={bannerImage} setBannerImage={setBannerImage} setIuranData={setIuranData} setGaleriData={setGaleriData} setInventarisData={setInventarisData} setInformasi={setInformasi} setNextMeeting={setNextMeeting} sponsorsData={sponsorsData} setSponsorsData={setSponsorsData} infoDesa={infoDesa} setInfoDesa={setInfoDesa} legalData={legalData} setLegalData={setLegalData} /> : null;
                    case 'infaq': return <Infaq infaqData={infaqData} setInfaqData={setInfaqData} userRole={userRole} identity={identity} />;
                    case 'pemenang': return <Pemenang members={members} />;
                    case 'kegiatan': return <Kegiatan nextMeeting={nextMeeting} />;
                    case 'kalender': return <Kalender />;
                    case 'peta': return <PetaDesa infoDesa={infoDesa} />;
                    case 'musik': return userRole === 'admin' ? <MusicAdmin musicData={musicData} setMusicData={setMusicData} /> : null;
                    default: return <MainMenu userRole={userRole} NavItems={NavItems} changeTab={changeTab} identity={identity} sponsorsData={sponsorsData} nextMeeting={nextMeeting} />;
                }
            };

            const activeTabTitle = NavItems.find(i => i.id === activeTab)?.label || identity.name;

            return (
                <div className="min-h-screen bg-transparent print:bg-white font-sans text-google-text flex flex-col relative">
                    <FlagWavingBackground />
                    <div className="sticky top-0 z-40 no-print w-full">
                        {isOffline && (
                            <div className="bg-google-redDark text-white text-center py-2.5 px-4 text-[13px] font-bold flex flex-wrap items-center justify-center gap-2 w-full shadow-md">
                                <Icon name="wifi_off" className="text-[18px]" /> Koneksi terputus. Anda masuk ke mode offline.
                            </div>
                        )}

                        <header className="bg-white/95 text-google-text py-4 px-5 sm:px-8 w-[calc(100%-2rem)] max-w-5xl mx-auto mt-4 rounded-[28px] border border-red-500/10 shadow-[0_10px_30px_rgba(239,68,68,0.04)] relative z-20">
                            <div className="max-w-5xl mx-auto flex items-center justify-between">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    {activeTab === 'menu' ? (
                                        <div className="bg-gradient-to-tr from-red-500 to-rose-600 text-white w-10 h-10 rounded-full shrink-0 flex justify-center items-center shadow-[0_4px_12px_rgba(239,68,68,0.2)] border border-red-400/40"><Icon name="home" className="text-[20px]" fill="true" /></div>
                                    ) : (
                                        <button onClick={() => changeTab('menu')} className="w-10 h-10 bg-white text-google-text border-2 border-slate-200 hover:text-red-600 hover:border-red-500/30 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[20px]" /></button>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                        <h1 className="text-[16px] sm:text-[18px] font-extrabold truncate leading-tight tracking-tight text-slate-800">{activeTab === 'menu' ? identity.name : activeTabTitle}</h1>
                                        {activeTab === 'menu' && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0"></span>}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 shrink-0 pl-2">
                                    <span className={`text-[10px] font-extrabold px-3 py-1.5 rounded-md uppercase tracking-widest border-2 ${userRole === 'admin' ? 'bg-red-50 text-red-700 border-red-500/20' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{userRole === 'admin' ? 'Admin' : 'Warga'}</span>
                                    <button onClick={() => setShowLogoutModal(true)} className="w-10 h-10 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-full flex justify-center items-center transition-all duration-300 active:scale-95 border border-red-500/20 shadow-sm"><Icon name="logout" className="text-[18px]" /></button>
                                </div>
                            </div>
                        </header>
                    </div>

                    <main className="flex-1 w-full pt-5 md:pt-8 print:pb-0 print:pt-0" style={{paddingBottom: '10rem'}}>
                        <div key={activeTab} className="max-w-5xl mx-auto px-4 sm:px-6 tab-fade-in pb-10">
                            {renderContent()}
                        </div>
                    </main>

                    <footer className="w-full text-center py-8 no-print border-t border-red-500/10 bg-gradient-to-b from-white/10 to-white/90 text-[12.5px] font-bold text-slate-500">
                        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3.5">
                            <p className="flex flex-wrap items-center gap-1.5 justify-center">
                                <Icon name="flag" className="text-red-500 text-[16px] animate-pulse" fill="true" />
                                - {new Date().getFullYear()} <span className="text-red-600 font-extrabold">WP LINGKUNGAN</span>. All rights reserved.
                            </p>
                            <button onClick={() => setShowLicenseModal(true)} className="flex flex-wrap items-center justify-center gap-1.5 hover:text-red-500 transition-colors active:scale-95 group">
                                <Icon name="lock" className="text-[14px] group-hover:scale-110 transition-transform" /> <span className="underline decoration-dashed underline-offset-4">&copy; 2026 Keamanan Data & Hak Cipta</span>
                            </button>
                        </div>
                    </footer>
{legalData?.enabled && (
                        <div className="w-full text-center pb-6 no-print bg-white">
                            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-extrabold text-google-blue">
                                <button onClick={() => setShowLegalModal('terms')} className="hover:underline">Syarat & Ketentuan</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={() => setShowLegalModal('privacy')} className="hover:underline">Kebijakan Privasi</button>
                            </div>
                        </div>
                    )}
                    


                    <RobotGuide userRole={userRole} nominalArisan={nominalArisan} nominalJimpitan={nominalJimpitan} identity={identity} members={members} arisanPeriod={arisanPeriod} currentRound={currentRound} cycleNumber={cycleNumber} jimpitanBalance={jimpitanBalance} kasRtBalance={kasRtBalance} meetingHistory={meetingHistory} inventarisData={inventarisData} pinjamData={pinjamData} infaqData={infaqData} />
                    <PWAInstallBanner />
                    {showLicenseModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-fade-in">
                            <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl animate-slide-up border-2 border-red-500/20">
                                <div className="bg-red-50 px-6 py-5 border-b border-red-500/10 flex items-center justify-between">
                                    <h3 className="text-[16px] font-black text-red-700 flex items-center gap-2"><Icon name="verified_user" /> KEAMANAN DATA & LISENSI</h3>
                                    <button onClick={() => setShowLicenseModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 text-red-500 transition-colors"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 md:p-8">
                                    <div className="prose prose-sm text-slate-600 text-justify leading-relaxed max-w-none">
                                        <p className="font-bold text-slate-800 text-[14px] mb-3">Website ini <span className="text-red-600 uppercase underline decoration-red-300 underline-offset-4">tidak diperjualbelikan</span>.</p>
                                        <p className="mb-3">Seluruh data di dalam sistem ini dilindungi secara ketat dan dikelola secara eksklusif oleh Admin Lingkungan.</p>
                                        <p className="mb-4 text-red-600 font-medium bg-red-50 p-3 rounded-xl border border-red-100">Segala bentuk pencurian data, penyalahgunaan akses, atau tindak kriminal digital lainnya akan ditelusuri dan <strong>dilaporkan kepada pihak yang berwajib</strong> sesuai perundang-undangan yang berlaku.</p>
                                        <p className="mb-6">Sistem ini diperuntukkan khusus untuk keperluan digitalisasi guna menunjang tata kelola lingkungan desa yang transparan dan akuntabel.</p>
                                        
                                        <div className="border-t-2 border-dashed border-slate-200 pt-4 text-center">
                                            <p className="text-[12px] font-extrabold text-slate-400 mb-1">COPYRIGHT &copy; 2026</p>
                                            <p className="text-[11px] text-slate-400 mb-2">Sistem & lisensi ditandatangani secara digital oleh pengembang resmi:</p>
                                            <p className="text-[18px] font-black tracking-widest bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent uppercase">Novan Restu Utomo</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowLicenseModal(false)} className="w-full mt-6 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-extrabold text-[14px] transition-colors active:scale-95">Saya Mengerti</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {showLegalModal && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4 animate-fade-in">
                            <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border-2 border-slate-100/50 max-h-[80vh]">
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                                    <h3 className="text-[16px] font-black text-slate-800 flex items-center gap-2">
                                        <Icon name={showLegalModal === 'terms' ? 'gavel' : 'privacy_tip'} className="text-google-blue" /> 
                                        {showLegalModal === 'terms' ? 'Syarat & Ketentuan' : 'Kebijakan Privasi'}
                                    </h3>
                                    <button onClick={() => setShowLegalModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 overflow-y-auto custom-scrollbar">
                                    <div className="prose prose-sm text-slate-600 text-justify leading-relaxed whitespace-pre-wrap">
                                        {showLegalModal === 'terms' ? legalData?.terms : legalData?.privacy}
                                    </div>
                                </div>
                                <div className="p-4 border-t border-slate-100 shrink-0">
                                    <button onClick={() => setShowLegalModal(null)} className="w-full bg-google-blue hover:bg-google-blueDark text-white py-3.5 rounded-xl font-extrabold text-[14px] transition-colors active:scale-95">Tutup & Lanjutkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    <ToastContainer />
                    {/* Floating Music Player - hanya untuk warga */}
                    {userRole === 'warga' && musicData?.url && musicData?.enabled && <FloatingMusicPlayer musicData={musicData} />}

                    {showPwaGuide && <PwaGuideModal onClose={() => setShowPwaGuide(false)} />}

                    {showLogoutModal && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center border-2 border-slate-200 shadow-2xl transform scale-100 transition-transform">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30"><Icon name="logout" className="text-[40px] text-google-red" fill="true" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2">Keluar Sesi?</h3>
                                <p className="text-[14px] text-google-textVariant mb-8 leading-relaxed font-medium">Sesi portal akan diakhiri. Anda akan kembali ke layar otorisasi.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setShowLogoutModal(false)} className="w-full sm:w-auto bg-white text-google-text py-3.5 px-6 rounded-full font-extrabold text-[14px] hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 active:scale-95 transition-all shadow-sm">Batal</button>
                                    <button onClick={executeLogout} className="flex-1 bg-google-red text-white py-3.5 px-6 rounded-full font-extrabold text-[14px] shadow-md hover:shadow-lg hover:bg-google-redDark border-2 border-google-redDark active:scale-95 transition-all">Ya, Keluar</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        /* ================= COMPONENTS (VIEWS) ================= */

        function PwaGuideModal({ onClose }) {
            const [tab, setTab] = useState('android');
            return (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
<div className="bg-white rounded-[32px] w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] border-2 border-slate-200" style={{ animation: 'slideUp 0.3s ease-out' }}>
                        <div className="p-4 sm:p-5 md:p-6 border-b-2 border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-[30px]">
                            <h3 className="text-xl font-extrabold text-google-text flex flex-wrap items-center gap-2"><Icon name="install_mobile" className="text-google-blue" /> Panduan Install Aplikasi</h3>
                            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-google-text transition-all active:scale-95"><Icon name="close" /></button>
                        </div>
                        <div className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1">
                            <p className="text-[14px] text-google-textVariant mb-6 font-medium">Aplikasi ini bisa diinstal langsung ke perangkat Anda (Android, iOS, maupun PC/Laptop) tanpa melalui App Store atau Play Store. Hemat memori dan cepat!</p>
                            
                            <div className="flex bg-slate-100 p-1.5 rounded-[16px] mb-6 border-2 border-slate-200 shadow-inner">
                                <button onClick={() => setTab('android')} className={`flex-1 py-2.5 rounded-[12px] text-[13px] font-extrabold transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'android' ? 'bg-white text-google-blue border-2 border-google-blue/30 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Icon name="android" className="text-[18px]" /> Android</button>
                                <button onClick={() => setTab('ios')} className={`flex-1 py-2.5 rounded-[12px] text-[13px] font-extrabold transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'ios' ? 'bg-white text-google-text border-2 border-slate-300 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Icon name="apple" className="text-[18px]" /> iOS</button>
                                <button onClick={() => setTab('pc')} className={`flex-1 py-2.5 rounded-[12px] text-[13px] font-extrabold transition-all duration-300 flex items-center justify-center gap-1.5 ${tab === 'pc' ? 'bg-white text-google-blue border-2 border-google-blue/30 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Icon name="laptop_mac" className="text-[18px]" /> PC/Laptop</button>
                            </div>

                            {tab === 'android' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <h4 className="font-extrabold text-google-text text-[15px]">Pengguna Google Chrome</h4>
                                    <ol className="list-decimal pl-5 space-y-3 text-[14px] text-google-textVariant font-medium">
                                        <li>Buka website ini di browser <b>Google Chrome</b>.</li>
                                        <li>Tunggu beberapa detik, akan muncul banner <b>"Pasang Aplikasi Ini"</b> di bagian bawah layar. Klik tombol <b>Install</b>.</li>
                                        <li>Atau, klik ikon <b>titik tiga</b> (G) di pojok kanan atas browser.</li>
                                        <li>Pilih menu <b>"Tambahkan ke Layar Utama"</b> (Add to Home screen) atau <b>"Instal Aplikasi"</b>.</li>
                                        <li>Klik <b>Instal</b> pada pop-up yang muncul. Aplikasi siap digunakan!</li>
                                    </ol>
                                </div>
                            )}

                            {tab === 'ios' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <h4 className="font-extrabold text-google-text text-[15px]">Pengguna iPhone & iPad (Safari)</h4>
                                    <ol className="list-decimal pl-5 space-y-3 text-[14px] text-google-textVariant font-medium">
                                        <li>Buka website ini menggunakan browser <b>Safari</b> (wajib).</li>
                                        <li>Ketuk ikon <b>Bagikan</b> <Icon name="ios_share" className="text-[16px] inline text-google-blue" /> (kotak dengan panah ke atas) di bagian bawah layar.</li>
                                        <li>Geser menu ke atas atau ke samping, cari dan ketuk <b>"Tambah ke Layar Utama"</b> (Add to Home Screen) <Icon name="add_box" className="text-[16px] inline text-slate-500" />.</li>
                                        <li>Ketuk tombol <b>Tambah</b> di pojok kanan atas.</li>
                                        <li>Aplikasi kini ada di daftar aplikasi Anda dan siap digunakan!</li>
                                    </ol>
                                </div>
                            )}

                            {tab === 'pc' && (
                                <div className="space-y-4 animate-fadeIn">
                                    <h4 className="font-extrabold text-google-text text-[15px]">Pengguna PC/Laptop (Chrome / Edge)</h4>
                                    <ol className="list-decimal pl-5 space-y-3 text-[14px] text-google-textVariant font-medium">
                                        <li>Buka website ini di <b>Google Chrome</b> atau <b>Microsoft Edge</b>.</li>
                                        <li>Perhatikan ujung kanan bilah alamat web (address bar).</li>
                                        <li>Klik ikon <b>Install</b> <Icon name="install_desktop" className="text-[16px] inline text-google-blue" /> yang muncul di sana.</li>
                                        <li>Pada Chrome, Anda juga bisa klik ikon <b>titik tiga</b> (G) &rarr; <b>"Save and share"</b> &rarr; <b>"Install page as app"</b>.</li>
                                        <li>Aplikasi akan terinstal, dapat di-pin ke Taskbar, dan dibuka layaknya program desktop biasa.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                        <div className="p-5 sm:p-6 md:p-8 border-t-2 border-slate-200 bg-slate-50 rounded-b-[30px] flex justify-end">
                            <button onClick={onClose} className="bg-google-blue text-white px-6 py-3 rounded-full font-extrabold text-[14px] shadow-md hover:bg-google-blueDark transition-all active:scale-95">Tutup Panduan</button>
                        </div>
                    </div>
                </div>
            );
        }

        function FlagWavingBackground() {
            const canvasRef = useRef(null);
            useEffect(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                let animFrame;
                let t = 0;
                let W, H;

                function resize() {
                    W = window.innerWidth;
                    H = window.innerHeight;
                    canvas.width = W;
                    canvas.height = H;
                }
                resize();
                window.addEventListener('resize', resize);

                function draw() {
                    animFrame = requestAnimationFrame(draw);
                    
                    if (document.hidden) return;

                    ctx.clearRect(0, 0, W, H);

                    // 1. Gambar latar belakang MERAH solid
                    ctx.fillStyle = '#dc2626'; // Merah standar
                    ctx.fillRect(0, 0, W, H);

                    // 2. Gambar area PUTIH menggunakan kurva mulus (Polygon Path)
                    ctx.fillStyle = '#f8fafc'; // Putih salju
                    ctx.beginPath();
                    
                    // Mulai dari sisi kiri (Tiang)
                    const startPhase = 0 * Math.PI * 3.5 - t * 1.8;
                    ctx.moveTo(0, H * 0.5 + Math.sin(startPhase) * 0);

                    // Loop untuk menggambar kurva batas bendera dengan sangat halus (resolusi 5px)
                    for (let x = 0; x <= W; x += 5) {
                        const xProgress = x / W;
                        const amplitude = H * 0.08 * xProgress * xProgress;
                        const wavePhase = xProgress * Math.PI * 3.5 - t * 1.8;
                        const midY = H * 0.5 + Math.sin(wavePhase) * amplitude;
                        ctx.lineTo(x, midY);
                    }
                    
                    // Pastikan titik terakhir tepat di ujung kanan layar
                    const endAmp = H * 0.08;
                    const endPhase = Math.PI * 3.5 - t * 1.8;
                    ctx.lineTo(W, H * 0.5 + Math.sin(endPhase) * endAmp);

                    // Menutup area putih ke sudut bawah layar
                    ctx.lineTo(W, H);
                    ctx.lineTo(0, H);
                    ctx.closePath();
                    ctx.fill();

                    // 3. Tambahkan bayangan kain 3D dengan Linear Gradient yang sangat halus
                    // Ini menggantikan strip vertikal yang membuat garis kasar
                    const shadeGrad = ctx.createLinearGradient(0, 0, W, 0);
                    const shadeStops = 40; // 40 titik untuk gradasi mulus
                    for (let i = 0; i <= shadeStops; i++) {
                        const xProgress = i / shadeStops;
                        const wavePhase = xProgress * Math.PI * 3.5 - t * 1.8;
                        const curvature = Math.cos(wavePhase); // -1 sampai 1
                        
                        if (curvature > 0) {
                            // Sisi menghadap cahaya (Putih mengkilap)
                            const alpha = curvature * 0.15; // Maks 15% putih
                            shadeGrad.addColorStop(xProgress, `rgba(255,255,255,${alpha})`);
                        } else {
                            // Sisi membelakangi cahaya (Hitam bayangan)
                            const alpha = -curvature * 0.25; // Maks 25% hitam
                            shadeGrad.addColorStop(xProgress, `rgba(0,0,0,${alpha})`);
                        }
                    }
                    ctx.fillStyle = shadeGrad;
                    ctx.fillRect(0, 0, W, H);

                    // 4. Efek kilau satin yang bergerak (Shimmer)
                    const shimX = W * (0.3 + Math.sin(t * 0.4) * 0.25);
                    const shimY = H * (0.3 + Math.cos(t * 0.3) * 0.15);
                    const grad = ctx.createRadialGradient(shimX, shimY, 0, shimX, shimY, W * 0.45);
                    grad.addColorStop(0, 'rgba(255,255,255,0.08)');
                    grad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, W, H);

                    t += 0.045;
                }

                draw();
                return () => {
                    cancelAnimationFrame(animFrame);
                    window.removeEventListener('resize', resize);
                };
            }, []);

            return (
                <canvas
                    ref={canvasRef}
                    className="fixed inset-0 pointer-events-none no-print"
                    style={{ zIndex: -1, width: '100%', height: '100%' }}
                />
            );
        }

        function LoginScreen({ onLogin, identity, setShowPwaGuide, legalData, setShowLegalModal }) {
            const [email, setEmail] = useState('');
            const [password, setPassword] = useState('');
            const [isLoading, setIsLoading] = useState(false);
            const [mode, setMode] = useState('select'); 
            const [error, setError] = useState('');
            
            const handleAdminLogin = async () => {
                if (!email || !password) return setError('Email dan Password wajib diisi.');
                setIsLoading(true); setError('');
                try {
                    const userCredential = await signInWithEmailAndPassword(auth, email, password);
                    if (userCredential.user.uid === '7kGABJkj7APXHPtyVQUHQeoz0Cy1') {
                        onLogin('admin');
                    } else {
                        await signOut(auth);
                        setError('Akses ditolak. UID tidak sesuai.');
                    }
                } catch (err) {
                    setError('Login gagal. Periksa kembali email dan password Anda.');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            };
            
            return (
                <div className="w-full min-h-screen flex flex-col justify-center items-center p-4 sm:p-5 md:p-6 bg-transparent relative overflow-hidden">
                    <FlagWavingBackground />

                    <div className="relative overflow-hidden bg-white/95 backdrop-blur-md p-8 sm:p-10 rounded-[32px] w-full max-w-sm text-center shadow-[0_20px_50px_rgba(239,68,68,0.08)] border-2 border-red-500/10 z-10 hover:border-red-500/30 hover:shadow-[0_20px_50px_rgba(239,68,68,0.15)] transition-all duration-500">
                        <div className="h-1.5 w-full absolute top-0 left-0 bg-red-600"></div>
                        <div className="mx-auto mt-4 mb-6 bg-red-50/50 w-28 h-28 rounded-full flex items-center justify-center border-[3px] border-red-500/20 shadow-inner">
                            <img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Garuda Pancasila" className="w-20 h-20 object-contain" />
                        </div>
                        <h1 className="text-[23px] font-black bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent mb-1.5 tracking-tight">Portal Layanan RT</h1>
                        <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-snug">{identity.name}</p>
                        
                        {mode === 'select' ? (
                            <div className="space-y-4">
                                <button onClick={() => onLogin('warga')} className="w-full bg-white text-google-text font-extrabold py-3.5 rounded-full flex flex-wrap justify-center items-center gap-2 border-2 border-slate-200 text-[14px] hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 active:scale-95 shadow-sm"><Icon name="person" className="text-[20px] text-google-textVariant" /><span>Masuk sebagai Warga</span></button>
                                <button onClick={() => setMode('admin_login')} className="w-full bg-google-blue text-white font-extrabold py-3.5 rounded-full flex flex-wrap justify-center items-center gap-2 text-[14px] border-2 border-google-blueDark shadow-md hover:shadow-lg hover:bg-google-blueDark transition-all duration-300 active:scale-95"><Icon name="lock" className="text-[20px]" /><span>Otorisasi Admin</span></button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="text-left">
                                    <label className="text-[11px] font-extrabold text-google-textVariant block mb-1.5 ml-2 uppercase tracking-widest">Email Admin</label>
                                    <input type="email" placeholder="Email Firebase Anda" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md text-google-text rounded-[16px] px-5 py-3.5 text-[15px] font-bold outline-none transition-all placeholder:font-medium placeholder:text-slate-400" />
                                </div>
                                <div className="text-left">
                                    <label className="text-[11px] font-extrabold text-google-textVariant block mb-1.5 ml-2 uppercase tracking-widest">Kata Sandi</label>
                                    <input type="password" placeholder="Kata Sandi Firebase" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md text-google-text rounded-[16px] px-5 py-3.5 text-[15px] font-bold outline-none transition-all placeholder:font-medium placeholder:text-slate-400" />
                                </div>
                                <div className="mt-8 pt-4 border-t-2 border-slate-100/50 text-center">
                                    <p className="text-[10px] text-slate-400 font-medium px-4 leading-relaxed">
                                        <Icon name="shield" className="text-[12px] inline mr-1" />
                                        Dilindungi enkripsi & keamanan tingkat lanjut. <br /> Segala bentuk pencurian data akan dipidanakan.
                                    </p>
                                    <p className="text-[10px] text-slate-300 font-extrabold mt-1">&copy; 2026 Novan Restu Utomo</p>
                                    
                                    {legalData?.enabled && (
                                        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-[10px] font-bold text-google-blue">
                                            <button onClick={() => setShowLegalModal('terms')} className="hover:underline">Syarat & Ketentuan</button>
                                            <span className="text-slate-300">|</span>
                                            <button onClick={() => setShowLegalModal('privacy')} className="hover:underline">Kebijakan Privasi</button>
                                        </div>
                                    )}
                                </div>
                                {error && <p className="text-[12px] text-google-redDark font-extrabold bg-google-redLight py-3 rounded-[12px] border-2 border-google-red/30 shadow-sm flex flex-wrap items-center justify-center gap-1.5 mt-2"><Icon name="error" className="text-[16px]"/> {error}</p>}
                                <div className="flex flex-wrap gap-3 pt-4">
                                    <button onClick={() => {setMode('select'); setError(''); setEmail(''); setPassword('');}} className="flex-1 bg-white border-2 border-slate-200 text-google-text py-3.5 rounded-full font-extrabold text-[14px] hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center" disabled={isLoading}>Kembali</button>
                                    <button onClick={handleAdminLogin} className="flex-1 bg-google-blue border-2 border-google-blueDark text-white py-3.5 rounded-full font-extrabold text-[14px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all duration-300 flex items-center justify-center disabled:opacity-70" disabled={isLoading}>{isLoading ? 'Memeriksa...' : 'Masuk Admin'}</button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                </div>
            );
        }

function MainMenu({ userRole, NavItems, changeTab, identity, bannerImage, setShowPwaGuide, sponsorsData, nextMeeting }) {
            return (
                <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto mt-2">
                    
                    {/* --- AREA BANNER UTAMA --- */}
                    <div className={`relative rounded-[32px] p-5 sm:p-8 text-white border-2 border-google-blueDark shadow-xl overflow-hidden group ${!bannerImage ? 'bg-gradient-to-br from-google-blue via-google-blue to-google-blueDark' : 'bg-slate-900'}`}>
                        {bannerImage && (
                            <>
                                {/* object-center memastikan fokus gambar tetap di tengah */}
                                <img src={bannerImage} alt="Banner Lingkungan" className="absolute inset-0 w-full h-full object-cover object-center z-0 group-hover:scale-105 transition-transform duration-1000" />
                                
                                {/* Gradasi dibuat jauh lebih tipis agar gambar lebih terang di HP */}
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/70 via-slate-900/20 to-transparent z-0"></div>
                            </>
                        )}

                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700 z-0"></div>
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-google-blueLight opacity-20 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700 delay-100 z-0"></div>
                        <div className="absolute top-1/2 right-1/4 w-24 h-24 bg-google-yellow opacity-10 rounded-full blur-2xl animate-pulse z-0"></div>

                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full mb-4 border border-white/30 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-white [text-shadow:_0_1px_2px_rgba(0,0,0,0.5)]">Sistem Aktif</span>
                            </div>
                            
                            {/* Tambahan text-shadow kuat agar teks tetap mencolok meski background sangat terang */}
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-2.5 tracking-tight [text-shadow:_0_2px_10px_rgba(0,0,0,0.7)]">
                                Halo, {userRole === 'admin' ? 'Admin!' : 'Warga!'}
                            </h2>
                            <p className="text-[14px] sm:text-[15px] font-medium text-white max-w-md leading-relaxed [text-shadow:_0_2px_8px_rgba(0,0,0,0.9)]">
                                {identity.subtitle}
                            </p>
                        </div>
                    </div>
                    {/* --- AKHIR AREA BANNER --- */}

                    {/* --- AREA RUNNING TEXT AGENDA --- */}
                    {nextMeeting && nextMeeting.date && nextMeeting.date !== 'Belum dijadwalkan' && (
                        <div className="bg-red-50 border-2 border-red-200 text-red-800 rounded-full px-4 py-2 flex items-center gap-3 overflow-hidden shadow-sm mt-4">
                            <Icon name="campaign" className="text-red-600 shrink-0 animate-pulse text-[20px]" />
                            <marquee className="text-[13px] font-bold tracking-wide whitespace-nowrap uppercase">
                                Info Agenda Mendatang: <span className="font-extrabold text-red-700">{nextMeeting.date}</span> jam <span className="font-extrabold text-red-700">{nextMeeting.time}</span> di <span className="font-extrabold text-red-700">{nextMeeting.location}</span>. Agenda: {nextMeeting.notes}
                            </marquee>
                        </div>
                    )}

                    {/* AREA GRID MENU */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
                        {NavItems.map((item, idx) => (
                            <button key={item.id} onClick={() => changeTab(item.id)} style={{ animationDelay: `${idx * 0.05}s` }} className="menu-item-in relative overflow-hidden bg-white p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-google-blue/40 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3.5 active:scale-95 group">
                                <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                
                                <div className={`relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-[20px] sm:rounded-[24px] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-md border-2 border-transparent ${item.bg} ${item.color.replace('border-2', '')}`}>
                                    <Icon name={item.icon} className="text-[32px] sm:text-[36px]" fill="true" />
                                </div>
                                
                                <span className="relative z-10 text-[14px] sm:text-[15px] font-extrabold text-google-textVariant group-hover:text-google-blueDark transition-colors tracking-tight">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    
                                        

                    
                    {/* SPONSORED BY */}
                    {sponsorsData?.enabled && sponsorsData?.sponsors?.length > 0 && (
                        <div className="flex flex-col items-center justify-center mt-20 mb-8 animate-fadeIn">
                            <p className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 mb-4">Sponsored By</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6 md:gap-8 items-center justify-items-center w-full max-w-5xl px-4 mx-auto">
                                {sponsorsData.sponsors.map((s, i) => (
                                    <img key={i} src={s.url} alt={s.name} className="h-9 sm:h-11 md:h-14 lg:h-16 w-auto max-w-[90px] sm:max-w-[120px] md:max-w-[140px] lg:max-w-[160px] object-contain grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-110" title={s.name} />
                                ))}
                            </div>
                        </div>
                    )}
    
                    {userRole !== 'admin' && (
                        <div className="flex justify-center mt-16 mb-4">
                            <div className="bg-white py-2 px-4 rounded-full text-center border-2 border-slate-200 shadow-sm flex items-center justify-center">
                                <p className="text-[11px] font-bold text-google-textVariant flex flex-wrap items-center justify-center gap-1.5"><Icon name="info" className="text-[15px]" /> Mode Warga (akses terbatas).</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function WaktuSholatWidget() {
            const DEFAULT_LAT = -7.8246;
            const DEFAULT_LNG = 112.0792;
            const DEFAULT_CITY = 'Gurah, Kediri';

            const [city, setCity] = useState(() => localStorage.getItem('sholat_city_name') || DEFAULT_CITY);
            const [coords, setCoords] = useState(() => {
                const lat = localStorage.getItem('sholat_lat');
                const lng = localStorage.getItem('sholat_lng');
                return lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
            });
            const [isGPS, setIsGPS] = useState(() => localStorage.getItem('sholat_is_gps') === 'true');

            const [schedule, setSchedule] = useState(() => {
                try {
                    const cached = localStorage.getItem('sholat_schedule_today');
                    return cached ? JSON.parse(cached) : null;
                } catch(e) { return null; }
            });
            const [searchQuery, setSearchQuery] = useState('');
            const [searchResults, setSearchResults] = useState([]);
            const [isSearching, setIsSearching] = useState(false);
            const [loading, setLoading] = useState(false);
            const [nextPrayer, setNextPrayer] = useState(null);
            const [timeRemaining, setTimeRemaining] = useState('');
            const [adzanEnabled, setAdzanEnabled] = useState(() => localStorage.getItem('sholat_adzan_enabled') === 'true');
            const lastAdzanPlayed = useRef(null);

            const fetchByCoords = useCallback(async (lat, lng) => {
                setLoading(true);
                const now = new Date();
                const d = String(now.getDate()).padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = now.getFullYear();

                try {
                    const res = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${lat}&longitude=${lng}&method=11`);
                    const data = await res.json();
                    if (data && data.code === 200 && data.data && data.data.timings) {
                        const t = data.data.timings;
                        const todayJadwal = {
                            tanggal: `${d}/${m}/${y}`,
                            imsak: t.Imsak,
                            subuh: t.Fajr,
                            dzuhur: t.Dhuhr,
                            ashar: t.Asr,
                            maghrib: t.Maghrib,
                            isya: t.Isha
                        };
                        setSchedule(todayJadwal);
                        localStorage.setItem('sholat_schedule_today', JSON.stringify(todayJadwal));
                    }
                } catch (e) {
                    console.warn("Gagal mengambil jadwal sholat Aladhan:", e);
                } finally {
                    setLoading(false);
                }
            }, []);

            const fetchByCityId = useCallback(async (cId) => {
                setLoading(true);
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                
                try {
                    const res = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cId}/${y}/${m}/${d}`);
                    const data = await res.json();
                    if (data && data.status && data.data && data.data.jadwal) {
                        const todayJadwal = data.data.jadwal;
                        setSchedule(todayJadwal);
                        localStorage.setItem('sholat_schedule_today', JSON.stringify(todayJadwal));
                    }
                } catch (e) {
                    console.warn("Gagal mengambil jadwal sholat Kemenag:", e);
                } finally {
                    setLoading(false);
                }
            }, []);

            const handleGPSDetection = () => {
                if (!navigator.geolocation) {
                    showToast('Geolokasi tidak didukung oleh browser Anda.', 'error');
                    return;
                }
                setLoading(true);
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        setCoords({ lat, lng });
                        setIsGPS(true);
                        setCity('Lokasi GPS Aktif');
                        localStorage.setItem('sholat_lat', lat);
                        localStorage.setItem('sholat_lng', lng);
                        localStorage.setItem('sholat_is_gps', 'true');
                        localStorage.setItem('sholat_city_name', 'Lokasi GPS Aktif');
                        fetchByCoords(lat, lng);
                        showToast('Berhasil mendeteksi lokasi GPS perangkat.');
                    },
                    (error) => {
                        console.error(error);
                        showToast('Gagal mengakses GPS. Pastikan izin lokasi aktif.', 'error');
                        setLoading(false);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            };

            const handleSearchCity = async (e) => {
                e.preventDefault();
                if (!searchQuery.trim()) return;
                setIsSearching(true);
                try {
                    const res = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${searchQuery.trim()}`);
                    const data = await res.json();
                    if (data && data.status && Array.isArray(data.data)) {
                        setSearchResults(data.data);
                    } else {
                        setSearchResults([]);
                    }
                } catch (e) {
                    console.error(e);
                    showToast('Gagal mencari kota. Coba lagi.', 'error');
                } finally {
                    setIsSearching(false);
                }
            };

            const selectCity = (selectedCity) => {
                setCity(selectedCity.lokasi);
                setIsGPS(false);
                localStorage.setItem('sholat_city_name', selectedCity.lokasi);
                localStorage.setItem('sholat_is_gps', 'false');
                localStorage.removeItem('sholat_lat');
                localStorage.removeItem('sholat_lng');
                setSearchResults([]);
                setSearchQuery('');
                fetchByCityId(selectedCity.id);
            };

            useEffect(() => {
                if (isGPS) {
                    fetchByCoords(coords.lat, coords.lng);
                } else {
                    if (city === DEFAULT_CITY) {
                        fetchByCoords(DEFAULT_LAT, DEFAULT_LNG);
                    } else {
                        const savedCityId = localStorage.getItem('sholat_city_id') || '1609';
                        fetchByCityId(savedCityId);
                    }
                }
            }, [isGPS, coords, fetchByCoords, fetchByCityId, city]);

            useEffect(() => {
                if (!schedule) return;

                const timer = setInterval(() => {
                    const now = new Date();
                    const prayerTimes = [
                        { name: 'Imsak', time: schedule.imsak },
                        { name: 'Subuh', time: schedule.subuh },
                        { name: 'Dzuhur', time: schedule.dzuhur },
                        { name: 'Ashar', time: schedule.ashar },
                        { name: 'Maghrib', time: schedule.maghrib },
                        { name: 'Isya', time: schedule.isya }
                    ];

                    let upcoming = null;
                    let minDiff = Infinity;

                    prayerTimes.forEach(p => {
                        if (!p.time) return;
                        const [hours, minutes] = p.time.split(':').map(Number);
                        const pDate = new Date();
                        pDate.setHours(hours, minutes, 0, 0);

                        const diff = pDate - now;
                        if (diff > 0 && diff < minDiff) {
                            minDiff = diff;
                            upcoming = { ...p, timeObj: pDate, diff };
                        }
                    });

                    if (!upcoming) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const [hours, minutes] = schedule.imsak.split(':').map(Number);
                        const pDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), hours, minutes, 0, 0);
                        const diff = pDate - now;
                        upcoming = { name: 'Imsak (Besok)', time: schedule.imsak, timeObj: pDate, diff };
                    }

                    setNextPrayer(upcoming);

                    const totalSecs = Math.floor(upcoming.diff / 1000);
                    const hrs = Math.floor(totalSecs / 3600);
                    const mins = Math.floor((totalSecs % 3600) / 60);
                    const secs = totalSecs % 60;
                    
                    const timeStr = `${hrs > 0 ? hrs + 'j ' : ''}${mins}m ${secs}s`;
                    setTimeRemaining(timeStr);

                    // Cek Notifikasi Adzan
                    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const currentPrayer = prayerTimes.find(p => p.time === nowTimeStr && p.name !== 'Imsak');
                    if (currentPrayer) {
                        const adzanKey = `${schedule.tanggal}-${currentPrayer.name}`;
                        if (lastAdzanPlayed.current !== adzanKey) {
                            lastAdzanPlayed.current = adzanKey;
                            const isAdzanActive = localStorage.getItem('sholat_adzan_enabled') === 'true';
                            if (isAdzanActive) {
                                try {
                                    const audio = new Audio('https://www.islamcan.com/audio/adhan/azan1.mp3');
                                    audio.play().catch(e => console.warn("Auto-play Adzan diblokir browser:", e));
                                    
                                    if ("Notification" in window && Notification.permission === "granted") {
                                        new Notification("Waktu Sholat", {
                                            body: `Telah masuk waktu sholat ${currentPrayer.name} untuk wilayah ${city}`
                                        });
                                    }
                                } catch(err) {
                                    console.error("Gagal memutar adzan:", err);
                                }
                            }
                        }
                    }
                }, 1000);

                return () => clearInterval(timer);
            }, [schedule]);

            if (!schedule) {
                return (
                    <div className="bg-white rounded-[32px] p-6 sm:p-8 border-2 border-slate-200 shadow-sm flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[14px] font-bold text-google-textVariant">Memuat Jadwal Sholat...</p>
                        </div>
                    </div>
                );
            }

            const prayers = [
                { id: 'imsak', name: 'Imsak', time: schedule.imsak, icon: 'wb_twilight' },
                { id: 'subuh', name: 'Subuh', time: schedule.subuh, icon: 'nights_stay' },
                { id: 'dzuhur', name: 'Dzuhur', time: schedule.dzuhur, icon: 'wb_sunny' },
                { id: 'ashar', name: 'Ashar', time: schedule.ashar, icon: 'light_mode' },
                { id: 'maghrib', name: 'Maghrib', time: schedule.maghrib, icon: 'wb_twilight' },
                { id: 'isya', name: 'Isya', time: schedule.isya, icon: 'dark_mode' }
            ];

            return (
                <div className="bg-white rounded-[32px] p-6 sm:p-8 border-2 border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Icon name="mosque" className="text-red-600 text-[24px]" fill="true"/>
                                <h3 className="text-[18px] font-extrabold text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                    Jadwal Sholat {city}
                                    {isGPS && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-extrabold border border-red-200">GPS</span>}
                                </h3>
                            </div>
                            <p className="text-[12px] font-bold text-google-textVariant mt-0.5">Metode Kemenag RI G Hari ini: {schedule.tanggal}</p>
                        </div>

                        <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    const newVal = !adzanEnabled;
                                    setAdzanEnabled(newVal);
                                    localStorage.setItem('sholat_adzan_enabled', newVal ? 'true' : 'false');
                                    if (newVal) {
                                        if ("Notification" in window && Notification.permission !== "granted") {
                                            Notification.requestPermission();
                                        }
                                        // window.showToast defined globally? The component uses showToast
                                        if (typeof showToast === 'function') {
                                            showToast('Notifikasi & Suara Adzan diaktifkan');
                                        }
                                    } else {
                                        if (typeof showToast === 'function') {
                                            showToast('Notifikasi Adzan dinonaktifkan');
                                        }
                                    }
                                }}
                                className={`flex items-center gap-1.5 font-extrabold text-[12px] px-5 py-2.5 rounded-full border transition-all active:scale-95 ${
                                    adzanEnabled 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-500/30' 
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <Icon name={adzanEnabled ? "notifications_active" : "notifications_off"} className="text-[16px]"/>
                                {adzanEnabled ? 'Adzan Aktif' : 'Adzan Mati'}
                            </button>

                            <button 
                                type="button" 
                                onClick={handleGPSDetection}
                                className={`flex items-center gap-1.5 font-extrabold text-[12px] px-5 py-2.5 rounded-full border transition-all active:scale-95 ${
                                    isGPS 
                                        ? 'bg-red-50 text-red-600 border-red-500/30' 
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <Icon name="my_location" className="text-[16px]"/>
                                {loading ? 'GPS...' : 'Gunakan GPS'}
                            </button>

                            <form onSubmit={handleSearchCity} className="flex flex-wrap items-center gap-2 md:flex-initial">
                                <div className="bg-slate-50 border-2 border-slate-200 focus-within:border-red-500 rounded-full px-4 py-1.5 flex items-center gap-2 flex-1 md:w-56 shadow-sm">
                                    <Icon name="search" className="text-[16px] text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Cari Kota..."
                                        className="bg-transparent border-none outline-none text-[12.5px] font-bold w-full text-google-text placeholder:text-slate-400"
                                    />
                                </div>
                                <button type="submit" disabled={isSearching} className="bg-red-600 text-white font-extrabold text-[12px] px-5 py-2.5 rounded-full border border-red-700 hover:bg-red-700 shadow-sm active:scale-95 transition-all">
                                    {isSearching ? '...' : 'Cari'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="relative">
                            <div className="absolute top-0 left-0 right-0 bg-white border-2 border-slate-200 rounded-[20px] shadow-2xl z-30 max-h-48 overflow-y-auto hide-scrollbar p-2 space-y-1">
                                {searchResults.map(res => (
                                    <button 
                                        key={res.id} 
                                        onClick={() => selectCity(res)}
                                        className="w-full text-left px-4 py-2.5 rounded-[12px] hover:bg-red-50 hover:text-red-700 font-bold text-[13px] text-google-text transition-colors"
                                    >
                                        {res.lokasi}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {nextPrayer && (
                        <div className="bg-red-50/70 border border-red-500/20 p-5 sm:p-6 md:p-8 rounded-[24px] flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="w-11 h-11 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"><Icon name="alarm" className="text-[22px]"/></div>
                                <div>
                                    <p className="text-[11px] uppercase tracking-widest font-extrabold text-red-800">Sholat Berikutnya</p>
                                    <h4 className="text-[16px] font-extrabold text-red-700 mt-0.5">{nextPrayer.name} pukul {nextPrayer.time}</h4>
                                </div>
                            </div>
                            <div className="bg-white/80 border border-red-500/20 px-5 py-2.5 rounded-full shadow-sm text-center">
                                <span className="text-[12px] font-extrabold text-red-800 uppercase tracking-wider block">Waktu Mundur</span>
                                <span className="text-[15px] font-black text-red-600 font-mono">{timeRemaining}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
                        {prayers.map(p => {
                            const isUpcoming = nextPrayer && nextPrayer.name.includes(p.name);
                            return (
                                <div 
                                    key={p.id}
                                    className={`p-4 rounded-[22px] border text-center transition-all duration-300 ${
                                        isUpcoming 
                                            ? 'bg-red-600 border-red-700 text-white shadow-lg scale-105 z-10' 
                                            : 'bg-slate-50 border-slate-200/60 hover:bg-white hover:border-red-500/30 text-google-text'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-3 ${isUpcoming ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-100 shadow-sm'}`}>
                                        <Icon name={p.icon} className="text-[20px]" fill="true"/>
                                    </div>
                                    <p className={`text-[12px] font-extrabold ${isUpcoming ? 'text-white' : 'text-google-textVariant'}`}>{p.name}</p>
                                    <p className={`text-[16px] font-black mt-1 font-mono ${isUpcoming ? 'text-white' : 'text-google-text'}`}>{p.time}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        function Dashboard({ members, setMembers, jimpitanBalance, kasRtBalance, currentRound, setCurrentRound, userRole, cycleNumber, setCycleNumber, changeTab, arisanPeriod }) {
            const [showResetModal, setShowResetModal] = useState(false);
            const totalDebt = members.reduce((sum, m) => sum + (m.debt || 0), 0);
            const redRecords = members.filter(m => m.redRecord).length;
            const arisanMembers = members.filter(m => m.status === 'Normal' && m.program !== 'IuranOnly');
            const winnersCount = arisanMembers.filter(m => m.hasWon).length;
            const isCycleComplete = winnersCount >= arisanMembers.length && arisanMembers.length > 0;
            const saldoEfektifJimpitan = (jimpitanBalance || 0) + totalDebt;

            return (
                <div className="space-y-5 sm:space-y-6">
                    <div className="bg-white rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-2 border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
                        <div>
                            <span className="inline-flex items-center px-3.5 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-widest bg-google-blueLight text-google-blueDark mb-3 border border-google-blue/30">Siklus {cycleNumber}</span>
                            <h2 className="text-3xl sm:text-4xl font-extrabold text-google-text leading-tight tracking-tight">Putaran {currentRound}</h2>
                            <p className="text-[14px] font-bold text-google-textVariant mt-2 flex flex-wrap items-center gap-1.5"><Icon name="event" className="text-[18px]" /> {formatBulanTahun(arisanPeriod)}</p>
                        </div>
                        <div className="bg-slate-50 px-6 py-5 rounded-[24px] w-full sm:w-72 max-w-full border-2 border-slate-200 shadow-sm">
                            <div className="flex justify-between items-end mb-3">
                                <p className="text-[12px] text-google-textVariant font-extrabold uppercase tracking-wider">Progres Pemenang</p>
                                <p className="text-xl font-extrabold text-google-blueDark leading-none">{winnersCount} <span className="text-[14px] text-google-textVariant">/ {arisanMembers.length}</span></p>
                            </div>
                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-gradient-to-r from-google-blue to-google-blueDark h-full rounded-full transition-all duration-1000" style={{ width: `${(winnersCount / (arisanMembers.length || 1)) * 100}%` }}></div></div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[32px] p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 border-2 border-slate-700 relative overflow-hidden group cursor-default">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-google-blue opacity-20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-google-green opacity-20 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000 delay-100"></div>

                        <div className="relative z-10 w-full text-center sm:text-left">
                            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-widest bg-white/10 text-slate-200 mb-3 border border-white/10 shadow-sm">
                                <Icon name="account_balance_wallet" className="text-[14px]" /> Total Dana Kelolaan Global
                            </span>
                            <p className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">{formatRp((kasRtBalance || 0) + (jimpitanBalance || 0))}</p>
                            <p className="text-[13px] text-slate-400 font-medium mt-2">Gabungan Total Saldo Aktif Kas Utama RT + Kas Jimpitan Tunai.</p>
                        </div>
                    </div>
                    
                    {isCycleComplete && userRole === 'admin' && (
                        <div className="bg-gradient-to-r from-google-blueLight to-blue-50 p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] flex flex-col sm:flex-row items-center sm:text-left text-center gap-6 border-2 border-google-blue shadow-sm">
                            <div className="bg-google-blue text-white w-16 h-16 rounded-full flex items-center justify-center shadow-md border-2 border-google-blueDark shrink-0"><Icon name="task_alt" className="text-[32px]" fill="true" /></div>
                            <div className="flex-1"><h3 className="font-extrabold text-google-blueDark text-xl mb-1.5">Siklus Telah Selesai</h3><p className="text-[14px] font-medium text-google-blue">Seluruh warga arisan telah memenangkan putaran. Silakan mulai siklus baru.</p></div>
                            <button onClick={() => setShowResetModal(true)} className="w-full sm:w-auto px-8 py-3.5 bg-google-blue text-white font-extrabold rounded-full text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="refresh" className="text-[20px]"/> Mulai Baru</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-white rounded-[32px] p-6 sm:p-8 flex flex-col justify-between border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-blue/50 transition-all duration-300 group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[11px] font-extrabold uppercase tracking-widest text-google-textVariant block mb-2">Kas Utama RT</span><p className="text-3xl font-extrabold text-google-text group-hover:text-google-blue transition-colors tracking-tight">{formatRp(kasRtBalance)}</p></div>
                                <div className="bg-google-blueLight text-google-blueDark w-14 h-14 rounded-[20px] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border-2 border-google-blue/20"><Icon name="account_balance" className="text-[28px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('kas')} className="w-full bg-white text-google-text border-2 border-slate-200 font-extrabold py-3.5 rounded-full text-[13px] hover:bg-slate-50 hover:border-google-blue hover:text-google-blue transition-all duration-300 active:scale-95 shadow-sm flex flex-wrap items-center justify-center gap-2">Rincian Kas</button>
                        </div>
                        
                        <div className="bg-white rounded-[32px] p-6 sm:p-8 flex flex-col justify-between border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-green/50 transition-all duration-300 group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[11px] font-extrabold uppercase tracking-widest text-google-textVariant block mb-2">Kas Jimpitan Tunai</span><p className="text-3xl font-extrabold text-google-text group-hover:text-google-green transition-colors tracking-tight">{formatRp(jimpitanBalance)}</p></div>
                                <div className="bg-google-greenLight text-google-greenDark w-14 h-14 rounded-[20px] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border-2 border-google-green/20"><Icon name="savings" className="text-[28px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('laporan')} className="w-full bg-white text-google-text border-2 border-slate-200 font-extrabold py-3.5 rounded-full text-[13px] hover:bg-slate-50 hover:border-google-green hover:text-google-green transition-all duration-300 active:scale-95 shadow-sm flex flex-wrap items-center justify-center gap-2">Riwayat Arisan</button>
                        </div>

                        <div className="bg-white rounded-[32px] p-6 sm:p-8 flex flex-col justify-between border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-red/50 transition-all duration-300 group cursor-default">
                            <div className="flex items-start justify-between mb-6">
                                <div><span className="text-[11px] font-extrabold uppercase tracking-widest text-google-textVariant block mb-2">Tunggakan Total</span><p className="text-3xl font-extrabold text-google-text group-hover:text-google-red transition-colors tracking-tight">{formatRp(totalDebt)}</p></div>
                                <div className="bg-google-redLight text-google-redDark w-14 h-14 rounded-[20px] flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm border-2 border-google-red/20"><Icon name="money_off" className="text-[28px]" fill="true" /></div>
                            </div>
                            <button onClick={() => changeTab('warga')} className="w-full bg-white text-google-text border-2 border-slate-200 font-extrabold py-3.5 rounded-full text-[13px] hover:bg-slate-50 hover:border-google-red hover:text-google-red transition-all duration-300 active:scale-95 shadow-sm flex flex-wrap items-center justify-center gap-2">Cek Penunggak</button>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-google-yellowLight to-yellow-50 border-2 border-google-yellow/40 rounded-[32px] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-sm hover:shadow-md transition-shadow">
                        <div><p className="text-[11px] font-extrabold text-google-yellowDark uppercase tracking-widest mb-1.5">Total Saldo Efektif Jimpitan</p><p className="text-3xl font-extrabold text-google-yellowDark tracking-tight">{formatRp(saldoEfektifJimpitan)}</p></div>
                        <div className="flex flex-wrap items-center gap-3 bg-white/80 backdrop-blur-sm px-5 py-4 rounded-[24px] border-2 border-google-yellow/30 shadow-sm"><Icon name="info" className="text-[24px] text-google-yellowDark shrink-0" /><p className="text-[13px] font-bold text-google-yellowDark max-w-[220px] max-w-full leading-relaxed">Akumulasi aset utuh (Kas Tunai + Piutang Warga).</p></div>
                    </div>

                    {redRecords > 0 && (
                        <div className="bg-gradient-to-r from-google-red to-google-redDark text-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] flex items-start space-x-5 border-2 border-google-redDark shadow-lg hover:shadow-xl transition-shadow animate-pulse" style={{ animationDuration: '3s' }}>
                            <Icon name="warning" className="text-[36px] shrink-0 drop-shadow-md" fill="true" />
                            <div><h4 className="text-[18px] font-extrabold mb-1.5 tracking-tight">Peringatan: Tunggakan Terdeteksi</h4><p className="text-[14px] font-medium text-red-50 leading-relaxed">Terdapat <strong>{redRecords} warga</strong> dengan catatan rapor merah.</p></div>
                        </div>
                    )}

                    {showResetModal && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-left border-2 border-slate-200 shadow-2xl transform scale-100 transition-transform">
                                <div className="mb-5 bg-google-blueLight w-16 h-16 rounded-full flex items-center justify-center border-2 border-google-blue/30"><Icon name="refresh" className="text-[32px] text-google-blue" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2">Mulai Siklus Baru?</h3>
                                <div className="text-[14px] font-medium text-google-textVariant mb-8 space-y-3 bg-slate-50 p-5 sm:p-6 md:p-8 rounded-[24px] border-2 border-slate-200"><p className="flex flex-wrap gap-2.5 items-start"><Icon name="check_circle" className="text-[18px] text-google-green shrink-0 mt-0.5"/><span className="leading-relaxed">Saldo Kas & Tunggakan <b className="text-google-text">TIDAK DIRESET</b>.</span></p><p className="flex flex-wrap gap-2.5 items-start"><Icon name="check_circle" className="text-[18px] text-google-green shrink-0 mt-0.5"/><span className="leading-relaxed">Status menang warga akan dibersihkan ke awal.</span></p></div>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setShowResetModal(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { 
                                        setMembers(members.map(m => m.program === 'IuranOnly' ? m : { ...m, hasWon: false, wonRound: null })); 
                                        setCurrentRound(1); 
                                        setCycleNumber(prev => (prev || 1) + 1); 
                                        setShowResetModal(false); 
                                        showToast('Siklus baru berhasil dimulai.'); 
                                    }} className="flex-1 bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300">Bersihkan</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        function Inventaris({ data, setData, userRole, pinjamData }) {
            // formData kini punya kondisi per tipe: qty_baru, qty_bekas, qty_rusak
            const [formData, setFormData] = useState({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' });
            const [editingId, setEditingId] = useState(null);
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);

            // Helper: hitung total stok dari kondisi
            const getTotalStok = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0) + (item.kondisi?.rusak || 0);
            // Helper: hitung stok yang bisa dipinjam (baru + bekas saja)
            const getStokPinjam = (item) => (item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0);

            const handleSave = () => {
                if (!formData.name.trim()) return setErrorMsg('Nama barang wajib diisi!');
                const k = formData.kondisi;
                const totalQty = (k.baru || 0) + (k.bekas || 0) + (k.rusak || 0);
                if (totalQty <= 0) return setErrorMsg('Jumlah barang minimal 1 unit (isi salah satu kondisi)!');

                const itemData = {
                    name: formData.name.trim(),
                    kondisi: { baru: k.baru || 0, bekas: k.bekas || 0, rusak: k.rusak || 0 },
                    qty: totalQty,                    // total semua kondisi (untuk backward compat)
                    qtyPinjam: (k.baru || 0) + (k.bekas || 0),  // yang bisa dipinjam
                    imageUrl: formData.imageUrl || '',
                };

                if (editingId) {
                    setData(data.map(item => item.id === editingId ? { ...item, ...itemData } : item));
                    showToast('Data inventaris berhasil diperbarui.');
                } else {
                    setData([{ id: Date.now(), ...itemData }, ...data]);
                    showToast('Barang baru berhasil ditambahkan.');
                }
                setIsFormOpen(false);
                setErrorMsg('');
            };

            const handleImageUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return setErrorMsg('Ukuran foto maksimal 2MB!');
                setIsUploading(true);
                const reader = new FileReader();
                reader.onloadend = () => { setFormData(prev => ({...prev, imageUrl: reader.result})); setIsUploading(false); };
                reader.onerror = () => { setErrorMsg('Gagal membaca file.'); setIsUploading(false); };
                reader.readAsDataURL(file);
            };

            const openEditForm = (item) => {
                setFormData({
                    name: item.name,
                    kondisi: item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 }, // backward compat data lama
                    imageUrl: item.imageUrl || '',
                });
                setEditingId(item.id);
                setIsFormOpen(true);
                setErrorMsg('');
                setIsUploading(false);
            };

            const KondisiInput = ({ label, field, color, icon }) => (
                <div className={`flex items-center justify-between bg-slate-50 border-2 ${color} rounded-[14px] px-4 py-3`}>
                    <div className="flex flex-wrap items-center gap-2">
                        <Icon name={icon} className="text-[18px]" />
                        <span className="text-[13px] font-extrabold text-google-text">{label}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setFormData(p => ({...p, kondisi: {...p.kondisi, [field]: Math.max(0, (p.kondisi[field]||0)-1)}}))}
                            className="w-8 h-8 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center font-extrabold text-[18px] text-google-text hover:bg-slate-100 active:scale-95 transition-all">G</button>
                        <span className="w-8 text-center font-extrabold text-[16px] text-google-text">{formData.kondisi[field] || 0}</span>
                        <button type="button" onClick={() => setFormData(p => ({...p, kondisi: {...p.kondisi, [field]: (p.kondisi[field]||0)+1}}))}
                            className="w-8 h-8 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center font-extrabold text-[18px] text-google-text hover:bg-slate-100 active:scale-95 transition-all">+</button>
                    </div>
                </div>
            );

            return (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 no-print">
                        <div>
                            <h2 className="text-2xl font-extrabold text-google-text tracking-tight">Aset &amp; Inventaris</h2>
                            <p className="text-[14px] font-medium text-google-textVariant mt-1.5">Daftar barang fasilitas RT beserta kondisi dan stok pinjam.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setFormData({ name: '', kondisi: { baru: 0, bekas: 0, rusak: 0 }, imageUrl: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="flex flex-wrap items-center gap-2 bg-google-yellow text-white px-6 py-3 rounded-full font-extrabold text-[14px] border-2 border-google-yellowDark shadow-md hover:bg-google-yellowDark active:scale-95 transition-all shrink-0">
                                <Icon name="add" className="text-[20px]" />Tambah Barang
                            </button>
                        )}
                    </div>

                    {/* Grid kartu barang */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                        {data.map(item => {
                            const kondisi = item.kondisi || { baru: item.qty || 1, bekas: 0, rusak: 0 };
                            const totalStok   = getTotalStok({kondisi});
                            const stokPinjam  = getStokPinjam({kondisi});
                            const sedangDipinjam = pinjamData ? pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').length : 0;
                            const tersedia    = Math.max(0, stokPinjam - sedangDipinjam);
                            return (
                                <div key={item.id} className="bg-white rounded-[32px] overflow-hidden border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-google-yellow/40 transition-all duration-300 flex flex-col group relative">
                                    {/* Foto */}
                                    <div className="w-full bg-slate-50 relative shrink-0 border-b-2 border-slate-200 overflow-hidden flex items-center justify-center" style={{minHeight:'120px', maxHeight:'220px'}}>
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} className="w-full h-full object-contain transform group-hover:scale-105 transition-transform duration-700" style={{maxHeight:'220px', objectFit:'contain'}} loading="lazy" alt={item.name} onError={(e) => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }} />
                                            : <div className="flex items-center justify-center p-8"><Icon name="inventory_2" className="text-[64px] text-slate-300" /></div>
                                        }
                                        {/* Badge status pinjam */}
                                        {sedangDipinjam > 0 && (
                                            <div className="absolute top-3 left-3 bg-google-red text-white px-2.5 py-1 rounded-xl font-extrabold text-[10px] shadow-sm flex flex-wrap items-center gap-1 uppercase tracking-wider"><Icon name="handshake" className="text-[12px]" />{sedangDipinjam} Dipinjam</div>
                                        )}
                                        {/* Badge total stok */}
                                        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-google-text px-3 py-1.5 rounded-xl font-extrabold text-[12px] shadow-sm border border-slate-200 flex flex-wrap items-center gap-1.5">
                                            <Icon name="tag" className="text-[14px] text-google-yellowDark" />{totalStok} unit
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-3">
                                        <h3 className="text-[17px] font-extrabold text-google-text leading-snug tracking-tight group-hover:text-google-yellowDark transition-colors">{item.name}</h3>

                                        {/* Kondisi chips */}
                                        <div className="flex flex-wrap gap-1.5">
                                            {kondisi.baru > 0 && <span className="text-[11px] font-extrabold bg-google-greenLight text-google-greenDark border border-google-green/30 px-2.5 py-1 rounded-full flex flex-wrap items-center gap-1"><Icon name="verified" className="text-[12px]" />Baru: {kondisi.baru}</span>}
                                            {kondisi.bekas > 0 && <span className="text-[11px] font-extrabold bg-google-yellowLight text-google-yellowDark border border-google-yellow/30 px-2.5 py-1 rounded-full flex flex-wrap items-center gap-1"><Icon name="refresh" className="text-[12px]" />Bekas: {kondisi.bekas}</span>}
                                            {kondisi.rusak > 0 && <span className="text-[11px] font-extrabold bg-google-redLight text-google-redDark border border-google-red/30 px-2.5 py-1 rounded-full flex flex-wrap items-center gap-1"><Icon name="report" className="text-[12px]" />Rusak: {kondisi.rusak}</span>}
                                        </div>

                                        {/* Stok pinjam */}
                                        <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-[12px] border ${tersedia > 0 ? 'bg-google-greenLight/60 border-google-green/30' : 'bg-google-redLight/60 border-google-red/30'}`}>
                                            <span className="text-[12px] font-extrabold text-google-textVariant">Dapat Dipinjam</span>
                                            <span className={`text-[13px] font-extrabold ${tersedia > 0 ? 'text-google-greenDark' : 'text-google-red'}`}>{tersedia > 0 ? `${tersedia} tersedia` : 'Tidak tersedia'}</span>
                                        </div>
                                        {/* Detail daftar peminjam aktif */}
                                        {pinjamData && pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').length > 0 && (
                                            <div className="bg-google-redLight/40 border border-google-red/20 rounded-[12px] px-3.5 py-2.5 space-y-1.5">
                                                <p className="text-[11px] font-extrabold text-google-redDark uppercase tracking-wider flex flex-wrap items-center gap-1"><Icon name="handshake" className="text-[13px]" />Sedang Dipinjam:</p>
                                                {pinjamData.filter(p => p.itemId === item.id && p.status === 'approved').map((p, i) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <span className="text-[12px] font-bold text-google-text truncate flex flex-wrap items-center gap-1.5"><Icon name="person" className="text-[13px] text-google-textVariant" />{p.namaWarga}</span>
                                                        <span className="text-[11px] font-extrabold text-google-red shrink-0 ml-2 bg-white px-2 py-0.5 rounded-full border border-google-red/20">{p.qty || 1} unit</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Tombol admin */}
                                        {userRole === 'admin' && (
                                            <div className="flex flex-wrap justify-end gap-2 mt-auto pt-2 border-t-2 border-slate-100">
                                                <button onClick={() => openEditForm(item)} className="bg-slate-50 text-google-text border-2 border-slate-200 hover:border-google-blue hover:text-google-blue hover:bg-google-blueLight px-4 py-2.5 rounded-full font-extrabold text-[12px] active:scale-95 transition-all flex flex-wrap items-center gap-1.5"><Icon name="edit" className="text-[15px]" />Edit</button>
                                                <button onClick={() => setDeleteConfirmId(item.id)} className="bg-slate-50 text-google-red border-2 border-slate-200 hover:border-google-red/40 hover:bg-google-redLight px-4 py-2.5 rounded-full font-extrabold text-[12px] active:scale-95 transition-all flex flex-wrap items-center gap-1.5"><Icon name="delete" className="text-[15px]" />Hapus</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {data.length === 0 && (
                            <div className="col-span-full bg-white border-2 border-slate-200 p-12 text-center rounded-[32px] shadow-sm">
                                <Icon name="inventory_2" className="text-[56px] text-slate-300 mb-4 mx-auto" />
                                <h3 className="text-[20px] font-extrabold text-google-text mb-2">Belum Ada Inventaris</h3>
                                <p className="text-[14px] font-medium text-google-textVariant">Tambahkan barang inventaris RT yang pertama.</p>
                            </div>
                        )}
                    </div>

                    {/* Modal Form Tambah/Edit */}
                    {isFormOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-md shadow-2xl border-2 border-slate-200 my-4">
                                <h3 className="text-2xl font-extrabold text-google-text mb-6 tracking-tight">{editingId ? 'Edit Inventaris' : 'Tambah Inventaris'}</h3>
                                <div className="space-y-5">

                                    {/* Nama barang */}
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Nama Barang *</label>
                                        <input type="text" value={formData.name} onChange={e => { setFormData({...formData, name: e.target.value}); setErrorMsg(''); }} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all text-google-text placeholder:text-slate-400" placeholder="Contoh: Speaker Aktif, Tenda Hajatan..." />
                                    </div>

                                    {/* Kondisi barang */}
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Jumlah per Kondisi</label>
                                        <div className="space-y-2.5">
                                            <KondisiInput label="= Kondisi Baru" field="baru" color="border-google-green/40 focus-within:border-google-green" icon="verified" />
                                            <KondisiInput label="= Kondisi Bekas" field="bekas" color="border-google-yellow/40 focus-within:border-google-yellow" icon="refresh" />
                                            <KondisiInput label="= Kondisi Rusak" field="rusak" color="border-google-red/40 focus-within:border-google-red" icon="report" />
                                        </div>
                                        {/* Ringkasan */}
                                        {((formData.kondisi.baru||0)+(formData.kondisi.bekas||0)+(formData.kondisi.rusak||0)) > 0 && (
                                            <div className="mt-3 bg-slate-50 border-2 border-slate-200 rounded-[14px] px-4 py-3 flex flex-wrap gap-x-4 gap-y-1">
                                                <span className="text-[12px] font-extrabold text-google-text">Total: {(formData.kondisi.baru||0)+(formData.kondisi.bekas||0)+(formData.kondisi.rusak||0)} unit</span>
                                                <span className="text-[12px] font-bold text-google-greenDark">Bisa dipinjam: {(formData.kondisi.baru||0)+(formData.kondisi.bekas||0)} unit</span>
                                                {(formData.kondisi.rusak||0) > 0 && <span className="text-[12px] font-bold text-google-red">Tidak dipinjamkan: {formData.kondisi.rusak} unit (rusak)</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Foto (opsional) */}
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Foto Aset <span className="text-slate-400 normal-case font-semibold">(opsional)</span></label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border-2 ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-[16px] relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 shadow-sm border border-slate-100 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border-2 border-google-blue border-t-transparent rounded-full animate-spin"></div> : formData.imageUrl ? <img src={formData.imageUrl} className="w-12 h-12 rounded-[12px] object-cover" alt="preview" /> : <Icon name="cloud_upload" className="text-[24px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-extrabold text-[14px] text-google-text">{isUploading ? 'Mengunggah...' : formData.imageUrl ? 'Foto Tersimpan G' : 'Pilih Gambar'}</p>
                                                <p className="text-[12px] text-google-textVariant">{formData.imageUrl ? 'Klik untuk ganti foto' : 'Maks. 2MB G JPG, PNG, WEBP'}</p>
                                            </div>
                                            {formData.imageUrl && <button type="button" onClick={e => { e.stopPropagation(); setFormData(p=>({...p,imageUrl:''})); }} className="relative z-20 text-google-red bg-white border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center text-[16px] hover:bg-google-redLight active:scale-95 shrink-0">+</button>}
                                        </div>
                                    </div>

                                    {errorMsg && <div className="bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-[14px] text-[13px] font-bold flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px]" />{errorMsg}</div>}
                                </div>

                                <div className="flex flex-wrap gap-3 mt-6">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 bg-google-yellow text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-yellowDark shadow-md hover:bg-google-yellowDark active:scale-95 transition-all disabled:opacity-50">Simpan</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modal konfirmasi hapus */}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Hapus Barang?</h3>
                                <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Barang ini akan dihapus permanen dari daftar inventaris RT.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { setData(data.filter(item => item.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Barang berhasil dihapus.'); }} className="flex-1 bg-google-red text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-redDark shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function PinjamInventaris({ inventarisData, setInventarisData, pinjamData, setPinjamData, members, userRole }) {
            const [view, setView] = useState('list');          // 'list' | 'form' | 'admin'
            const [formData, setFormData] = useState({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [konfirmReturnId, setKonfirmReturnId] = useState(null);
            const [konfirmRejectId, setKonfirmRejectId] = useState(null);

            // Hitung stok tersedia untuk dipinjam (hanya Baru + Bekas, minus total qty yang sudah dipinjam)
            const getStokTersedia = (itemId) => {
                const item = inventarisData.find(i => i.id === itemId);
                if (!item) return 0;
                // qtyPinjam = baru + bekas (rusak tidak dipinjamkan)
                const stokPinjam = item.qtyPinjam !== undefined
                    ? item.qtyPinjam
                    : ((item.kondisi?.baru || 0) + (item.kondisi?.bekas || 0)) || (item.qty || 1);
                // Kurangi berdasarkan JUMLAH (qty) yang dipinjam, bukan jumlah record
                const totalDipinjam = pinjamData
                    .filter(p => p.itemId === itemId && p.status === 'approved')
                    .reduce((sum, p) => sum + (p.qty || 1), 0);
                return Math.max(0, stokPinjam - totalDipinjam);
            };

            const handleSubmitPinjam = () => {
                if (!formData.namaWarga.trim()) return setErrorMsg('Nama warga wajib diisi!');
                if (!formData.itemId) return setErrorMsg('Pilih barang yang akan dipinjam!');
                if (!formData.keperluan.trim()) return setErrorMsg('Keperluan / nama acara wajib diisi!');
                if (!formData.tanggalPinjam) return setErrorMsg('Tanggal pinjam wajib diisi!');
                if (!formData.tanggalKembali) return setErrorMsg('Perkiraan tanggal kembali wajib diisi!');
                if (formData.tanggalKembali < formData.tanggalPinjam) return setErrorMsg('Tanggal kembali tidak boleh sebelum tanggal pinjam!');
                // Validasi nama warga terdaftar
                const wargaValid = members.find(m => m.name.toLowerCase() === formData.namaWarga.trim().toLowerCase());
                if (!wargaValid) return setErrorMsg(`Nama "${formData.namaWarga}" tidak terdaftar di sistem. Pastikan nama sesuai data warga.`);
                // Cek stok
                const qtyMinta = Math.max(1, safeNumber(formData.qty) || 1);
                const stokTersedia = getStokTersedia(Number(formData.itemId));
                if (stokTersedia <= 0) return setErrorMsg('Stok barang ini sedang habis / semua sedang dipinjam!');
                if (qtyMinta > stokTersedia) return setErrorMsg(`Jumlah yang diminta (${qtyMinta}) melebihi stok tersedia (${stokTersedia} unit)!`);
                // Cek apakah warga sudah punya pengajuan aktif untuk barang ini
                const sudahAjukan = pinjamData.find(p => p.itemId === Number(formData.itemId) && p.namaWarga.toLowerCase() === formData.namaWarga.trim().toLowerCase() && (p.status === 'pending' || p.status === 'approved'));
                if (sudahAjukan) return setErrorMsg('Anda sudah memiliki pengajuan aktif untuk barang ini!');

                const item = inventarisData.find(i => i.id === Number(formData.itemId));
                const newPinjam = {
                    id: Date.now(),
                    itemId: Number(formData.itemId),
                    namaBarang: item.name,
                    namaWarga: formData.namaWarga.trim(),
                    keperluan: formData.keperluan.trim(),
                    qty: qtyMinta,
                    tanggalPinjam: formData.tanggalPinjam,
                    tanggalKembali: formData.tanggalKembali,
                    catatan: formData.catatan.trim(),
                    status: 'pending',       // pending | approved | returned | rejected
                    tanggalAjuan: getLocalDate(),
                    tanggalApprove: null,
                    tanggalKembaliAktual: null,
                };
                setPinjamData([newPinjam, ...pinjamData]);
                showToast(`Pengajuan pinjam ${item.name} berhasil dikirim! Tunggu persetujuan admin.`);
                setFormData({ namaWarga: '', keperluan: '', tanggalPinjam: getLocalDate(), tanggalKembali: '', itemId: '', qty: 1, catatan: '' });
                setView('list');
                setErrorMsg('');
            };

            const handleApprove = (id) => {
                setPinjamData(pinjamData.map(p => p.id === id ? { ...p, status: 'approved', tanggalApprove: getLocalDate() } : p));
                showToast('Pengajuan disetujui. Barang siap dipinjam.');
            };

            const handleReject = (id) => {
                setPinjamData(pinjamData.filter(p => p.id !== id));
                setKonfirmRejectId(null);
                showToast('Pengajuan ditolak dan dihapus.');
            };

            const handleReturn = (id) => {
                // Hapus record pinjam (stok otomatis pulih karena hitung dari filter)
                setPinjamData(pinjamData.filter(p => p.id !== id));
                setKonfirmReturnId(null);
                showToast('Barang berhasil dicatat kembali. Stok inventaris sudah pulih.');
            };

            const pendingList  = pinjamData.filter(p => p.status === 'pending');
            const approvedList = pinjamData.filter(p => p.status === 'approved');
            const allActive    = [...pendingList, ...approvedList];

            return (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-extrabold text-google-text tracking-tight flex flex-wrap items-center gap-2"><Icon name="handshake" className="text-[28px] text-google-green" />Pinjam Inventaris</h2>
                                <p className="text-[14px] font-medium text-google-textVariant mt-1">Ajukan peminjaman barang inventaris RT untuk keperluan kegiatan warga.</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {userRole === 'admin' && (
                                    <button onClick={() => setView(view === 'admin' ? 'list' : 'admin')} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-extrabold text-[13px] border-2 transition-all active:scale-95 ${view === 'admin' ? 'bg-google-blue text-white border-google-blueDark' : 'bg-white text-google-text border-slate-200 hover:border-google-blue'}`}>
                                        <Icon name="admin_panel_settings" className="text-[18px]" />Panel Admin
                                        {pendingList.length > 0 && <span className="bg-google-red text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingList.length}</span>}
                                    </button>
                                )}
                                <button onClick={() => { setView('form'); setErrorMsg(''); }} className="flex flex-wrap items-center gap-2 bg-google-green text-white px-5 py-2.5 rounded-full font-extrabold text-[13px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all">
                                    <Icon name="add" className="text-[18px]" />Ajukan Pinjam
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Form Pengajuan */}
                    {view === 'form' && (
                        <div className="bg-white rounded-[32px] border-2 border-slate-200 shadow-sm p-6 sm:p-8">
                            <h3 className="text-[18px] font-extrabold text-google-text mb-6 flex flex-wrap items-center gap-2"><Icon name="edit_document" className="text-[22px] text-google-green" />Form Pengajuan Pinjam</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Nama warga */}
                                <div className="sm:col-span-2">
                                    <label className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 block">Nama Warga *</label>
                                    <input type="text" value={formData.namaWarga} onChange={e => setFormData(p => ({...p, namaWarga: e.target.value}))} placeholder="Ketik nama sesuai data di Buku Warga..." list="warga-list-pinjam" className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-colors" />
                                    <datalist id="warga-list-pinjam">{members.map(m => <option key={m.id} value={m.name} />)}</datalist>
                                    <p className="text-[11px] text-google-textVariant mt-1">Nama harus sesuai data warga yang terdaftar di sistem.</p>
                                </div>
                                {/* Pilih barang */}
                                <div className="sm:col-span-2">
                                    <label className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 block">Barang yang Dipinjam *</label>
                                    <select value={formData.itemId} onChange={e => setFormData(p => ({...p, itemId: e.target.value}))} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-colors">
                                        <option value="">-- Pilih Barang --</option>
                                        {inventarisData.map(item => {
                                            const stok = getStokTersedia(item.id);
                                            return <option key={item.id} value={item.id} disabled={stok <= 0}>{item.name} G Stok tersedia: {stok} dari {item.qty}{stok <= 0 ? ' (Habis)' : ''}</option>;
                                        })}
                                    </select>
                                </div>
                                {/* Jumlah yang dipinjam */}
                                <div>
                                    <label className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 block">Jumlah Dipinjam *</label>
                                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 border-2 border-slate-200 focus-within:border-google-green rounded-[14px] px-4 py-3">
                                        <button type="button" onClick={() => setFormData(p => ({...p, qty: Math.max(1, (p.qty||1)-1)}))}
                                            className="w-9 h-9 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center font-extrabold text-[20px] text-google-text hover:bg-slate-100 active:scale-95 transition-all shrink-0">G</button>
                                        <div className="flex-1 text-center">
                                            <span className="font-extrabold text-[20px] text-google-text">{formData.qty || 1}</span>
                                            <span className="text-[12px] text-google-textVariant ml-2">unit</span>
                                        </div>
                                        <button type="button" onClick={() => {
                                            const stok = formData.itemId ? getStokTersedia(Number(formData.itemId)) : 99;
                                            setFormData(p => ({...p, qty: Math.min(stok, (p.qty||1)+1)}));
                                        }} className="w-9 h-9 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center font-extrabold text-[20px] text-google-text hover:bg-slate-100 active:scale-95 transition-all shrink-0">+</button>
                                    </div>
                                    {formData.itemId && (
                                        <p className="text-[11px] text-google-textVariant mt-1">
                                            Stok tersedia: <span className="font-extrabold text-google-green">{getStokTersedia(Number(formData.itemId))} unit</span>
                                        </p>
                                    )}
                                </div>
                                {/* Keperluan */}
                                <div className="sm:col-span-2">
                                    <label className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 block">Keperluan / Nama Acara *</label>
                                    <input type="text" value={formData.keperluan} onChange={e => setFormData(p => ({...p, keperluan: e.target.value}))} placeholder="contoh: Tahlilan di rumah Pak Hadi, 7 Muharram" className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-colors" />
                                </div>
                                {/* Tanggal pinjam & kembali */}
                                <div>
                                    <label className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 block">Tanggal Pinjam *</label>
                                    <input type="date" value={formData.tanggalPinjam} onChange={e => setFormData(p => ({...p, tanggalPinjam: e.target.value}))} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-colors" />
                                </div>
                                <div>
                                    <label className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 block">Perkiraan Tanggal Kembali *</label>
                                    <input type="date" value={formData.tanggalKembali} min={formData.tanggalPinjam} onChange={e => setFormData(p => ({...p, tanggalKembali: e.target.value}))} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-colors" />
                                </div>
                                {/* Catatan opsional */}
                                <div className="sm:col-span-2">
                                    <label className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 block">Catatan Tambahan (opsional)</label>
                                    <textarea value={formData.catatan} onChange={e => setFormData(p => ({...p, catatan: e.target.value}))} rows={2} placeholder="Keterangan tambahan jika perlu..." className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-colors resize-none" />
                                </div>
                            </div>
                            {errorMsg && <div className="mt-4 bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-[14px] text-[13px] font-bold flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px]" />{errorMsg}</div>}
                            <div className="flex flex-wrap gap-3 mt-6">
                                <button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">Batal</button>
                                <button onClick={handleSubmitPinjam} className="flex flex-wrap bg-google-green text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-2"><Icon name="send" className="text-[18px]" />Kirim Pengajuan</button>
                            </div>
                        </div>
                    )}

                    {/* Panel Admin */}
                    {view === 'admin' && userRole === 'admin' && (
                        <div className="space-y-4">
                            {/* Pending */}
                            {pendingList.length > 0 && (
                                <div className="bg-white rounded-[32px] border-2 border-google-yellow/40 shadow-sm p-4 sm:p-5 md:p-6">
                                    <h3 className="text-[16px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2"><Icon name="pending" className="text-[20px] text-google-yellow" />Menunggu Persetujuan ({pendingList.length})</h3>
                                    <div className="space-y-3">
                                        {pendingList.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-google-yellowLight/40 border border-google-yellow/40 rounded-[20px] p-5 sm:p-6 md:p-8">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-extrabold text-[15px] text-google-text truncate">{p.namaWarga}</p>
                                                    <p className="text-[13px] font-bold text-google-yellowDark mt-0.5 flex flex-wrap items-center gap-1"><Icon name="inventory_2" className="text-[14px]" />{p.namaBarang} <span className="ml-1 bg-google-yellow/20 text-google-yellowDark border border-google-yellow/40 px-2 py-0.5 rounded-full font-extrabold text-[11px]">{p.qty || 1} unit</span></p>
                                                    <p className="text-[12px] text-google-textVariant mt-1 flex flex-wrap items-center gap-1"><Icon name="event" className="text-[13px]" />Pinjam: {parseLocalDate(p.tanggalPinjam).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} G Kembali: {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
                                                    <p className="text-[12px] text-google-textVariant mt-0.5 italic">"{p.keperluan}"</p>
                                                    {p.catatan && <p className="text-[11px] text-slate-500 mt-0.5">= {p.catatan}</p>}
                                                </div>
                                                <div className="flex flex-wrap gap-2 shrink-0">
                                                    <button onClick={() => setKonfirmRejectId(p.id)} className="px-4 py-2.5 bg-white text-google-red border-2 border-google-red/30 rounded-full font-extrabold text-[12px] hover:bg-google-redLight active:scale-95 transition-all">Tolak</button>
                                                    <button onClick={() => handleApprove(p.id)} className="px-4 py-2.5 bg-google-green text-white border-2 border-google-greenDark rounded-full font-extrabold text-[12px] hover:bg-google-greenDark active:scale-95 transition-all shadow-md flex flex-wrap items-center gap-1"><Icon name="check" className="text-[14px]" />Setujui</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Approved / sedang dipinjam */}
                            {approvedList.length > 0 && (
                                <div className="bg-white rounded-[32px] border-2 border-google-blue/30 shadow-sm p-4 sm:p-5 md:p-6">
                                    <h3 className="text-[16px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2"><Icon name="handshake" className="text-[20px] text-google-blue" />Sedang Dipinjam ({approvedList.length})</h3>
                                    <div className="space-y-3">
                                        {approvedList.map(p => (
                                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-google-blueLight/30 border border-google-blue/30 rounded-[20px] p-5 sm:p-6 md:p-8">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-extrabold text-[15px] text-google-text truncate">{p.namaWarga}</p>
                                                    <p className="text-[13px] font-bold text-google-blueDark mt-0.5 flex flex-wrap items-center gap-1"><Icon name="inventory_2" className="text-[14px]" />{p.namaBarang} <span className="ml-1 bg-google-blue/10 text-google-blueDark border border-google-blue/30 px-2 py-0.5 rounded-full font-extrabold text-[11px]">{p.qty || 1} unit</span></p>
                                                    <p className="text-[12px] text-google-textVariant mt-1 flex flex-wrap items-center gap-1"><Icon name="event" className="text-[13px]" />Pinjam: {parseLocalDate(p.tanggalPinjam).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} G Estimasi Kembali: {parseLocalDate(p.tanggalKembali).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
                                                    <p className="text-[12px] text-google-textVariant mt-0.5 italic">"{p.keperluan}"</p>
                                                    {/* Cek apakah sudah lewat tanggal kembali */}
                                                    {p.tanggalKembali < getLocalDate() && (
                                                        <p className="text-[11px] font-extrabold text-google-red mt-1 flex flex-wrap items-center gap-1"><Icon name="warning" className="text-[13px]" />Melewati estimasi tanggal kembali!</p>
                                                    )}
                                                </div>
                                                <button onClick={() => setKonfirmReturnId(p.id)} className="px-4 py-2.5 bg-google-blue text-white border-2 border-google-blueDark rounded-full font-extrabold text-[12px] hover:bg-google-blueDark active:scale-95 transition-all shadow-md flex flex-wrap items-center gap-1 shrink-0"><Icon name="assignment_return" className="text-[14px]" />Barang Kembali</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {allActive.length === 0 && (
                                <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm">
                                    <Icon name="check_circle" className="text-[56px] text-google-green mx-auto mb-4" fill="true" />
                                    <h3 className="text-[20px] font-extrabold text-google-text mb-2">Semua Bersih!</h3>
                                    <p className="text-[14px] text-google-textVariant font-medium">Tidak ada pengajuan pinjam yang aktif saat ini.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Daftar Status untuk Warga */}
                    {view === 'list' && (
                        <div className="space-y-4">
                            {/* Info stok tersedia */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {inventarisData.map(item => {
                                    const stok = getStokTersedia(item.id);
                                    const sedangDipinjam = pinjamData.filter(p => p.itemId === item.id && p.status === 'approved');
                                    return (
                                        <div key={item.id} className={`bg-white rounded-[24px] border-2 p-5 shadow-sm flex items-center gap-4 ${stok <= 0 ? 'border-google-red/40 bg-google-redLight/20' : 'border-slate-200'}`}>
                                            <div className={`w-14 h-14 rounded-[16px] flex items-center justify-center shrink-0 border-2 ${stok <= 0 ? 'bg-google-redLight border-google-red/30' : 'bg-google-greenLight border-google-green/30'}`}>
                                                <Icon name="inventory_2" className={`text-[28px] ${stok <= 0 ? 'text-google-red' : 'text-google-green'}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-extrabold text-[14px] text-google-text truncate">{item.name}</p>
                                                <p className={`text-[12px] font-bold mt-0.5 ${stok <= 0 ? 'text-google-red' : 'text-google-greenDark'}`}>{stok <= 0 ? 'G Semua sedang dipinjam' : `G ${stok} dari ${item.qty} tersedia`}</p>
                                                {sedangDipinjam.length > 0 && (
                                                    <div className="mt-1.5 bg-google-redLight/50 border border-google-red/20 rounded-[10px] px-3 py-1.5 space-y-1">
                                                        {sedangDipinjam.map((p, i) => (
                                                            <div key={i} className="flex items-center justify-between">
                                                                <span className="text-[11px] font-bold text-google-text flex flex-wrap items-center gap-1"><Icon name="person" className="text-[12px] text-google-textVariant" />{p.namaWarga}</span>
                                                                <span className="text-[10px] font-extrabold text-google-red bg-white px-2 py-0.5 rounded-full border border-google-red/20 shrink-0 ml-1">{p.qty || 1} unit</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {inventarisData.length === 0 && (
                                <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm">
                                    <Icon name="inventory_2" className="text-[56px] text-slate-300 mx-auto mb-4" />
                                    <p className="text-[15px] text-google-textVariant font-medium">Belum ada barang inventaris yang terdaftar.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Modal konfirmasi kembali */}
                    {konfirmReturnId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-5 md:p-6">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200">
                                {(() => { const p = pinjamData.find(x => x.id === konfirmReturnId); return p ? (<>
                                    <div className="mb-5 bg-google-greenLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-green/30"><Icon name="assignment_return" className="text-[40px] text-google-green" /></div>
                                    <h3 className="text-xl font-extrabold text-google-text mb-2">Konfirmasi Pengembalian</h3>
                                    <p className="text-[14px] text-google-textVariant mb-2"><span className="font-extrabold text-google-text">{p.namaBarang}</span><br/>dikembalikan oleh <span className="font-extrabold text-google-blueDark">{p.namaWarga}</span></p>
                                    <p className="text-[13px] font-bold text-google-green mb-6">Stok inventaris akan otomatis pulih setelah konfirmasi.</p>
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => setKonfirmReturnId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3 rounded-full font-extrabold text-[13px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                        <button onClick={() => handleReturn(konfirmReturnId)} className="flex-1 bg-google-green text-white px-4 py-3 rounded-full font-extrabold text-[13px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95">G Konfirmasi Kembali</button>
                                    </div>
                                </>) : null; })()}
                            </div>
                        </div>
                    )}

                    {/* Modal konfirmasi tolak */}
                    {konfirmRejectId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-5 md:p-6">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30"><Icon name="cancel" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-xl font-extrabold text-google-text mb-2">Tolak Pengajuan?</h3>
                                <p className="text-[14px] text-google-textVariant mb-6">Pengajuan pinjam ini akan dihapus dari daftar.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setKonfirmRejectId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3 rounded-full font-extrabold text-[13px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                    <button onClick={() => handleReject(konfirmRejectId)} className="flex-1 bg-google-red text-white px-4 py-3 rounded-full font-extrabold text-[13px] border-2 border-google-redDark shadow-md hover:bg-google-redDark active:scale-95">Tolak & Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        // =====================================================
        // KOMPONEN INFAQ
        // =====================================================
        function Infaq({ infaqData, setInfaqData, userRole, identity }) {
            // view: 'list' = daftar program, 'detail' = detail 1 program, 'form' = admin buat/edit
            const [view, setView]               = useState('list');
            const [selected, setSelected]       = useState(null);
            const [editingId, setEditingId]     = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [errorMsg, setErrorMsg]       = useState('');
            const [isUploading, setIsUploading] = useState(false);

            // Form admin: buat/edit program infaq
            const emptyForm = {
                judul: '', deskripsi: '', tujuan: '', manfaat: '', imageUrl: '',
                danaTarget: 0, danaTerkumpul: 0,
                rekening: [{ bank: '', norek: '', atasNama: '' }],
            };
            const [form, setForm] = useState(emptyForm);

            // Nominal infaq yang dipilih warga (tampilan detail)
            const [nominalInput, setNominalInput]   = useState('');
            const [namaInfaq, setNamaInfaq]         = useState('');
            const [tipeNama, setTipeNama]            = useState('nama'); // 'nama' | 'tanpanama' | 'hambaalah'
            const [showPayModal, setShowPayModal]   = useState(false);
            const [selectedRek, setSelectedRek]     = useState(0);

            // Tambahan State Warga: Upload Bukti
            const [buktiUrl, setBuktiUrl]           = useState('');
            const [isUploadingBukti, setIsUploadingBukti] = useState(false);

            const NOMINAL_CEPAT = [10000, 25000, 50000, 100000, 250000, 500000];

            // ---- Handler Warga: Upload Bukti ----
            const handleBuktiUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return showToast('Ukuran foto maks 2MB!', 'error');
                setIsUploadingBukti(true);
                const reader = new FileReader();
                reader.onloadend = () => { setBuktiUrl(reader.result); setIsUploadingBukti(false); };
                reader.onerror  = () => { showToast('Gagal membaca file.', 'error'); setIsUploadingBukti(false); };
                reader.readAsDataURL(file);
            };

            // ---- Handler Admin ----
            const handleImageUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return setErrorMsg('Ukuran foto maks 2MB!');
                setIsUploading(true);
                const reader = new FileReader();
                reader.onloadend = () => { setForm(p => ({...p, imageUrl: reader.result})); setIsUploading(false); };
                reader.onerror  = () => { setErrorMsg('Gagal membaca file.'); setIsUploading(false); };
                reader.readAsDataURL(file);
            };

            const handleSaveProgram = () => {
                if (!form.judul.trim())     return setErrorMsg('Judul program wajib diisi!');
                if (!form.deskripsi.trim()) return setErrorMsg('Deskripsi wajib diisi!');
                if (form.rekening.some(r => !r.bank.trim() || !r.norek.trim() || !r.atasNama.trim()))
                    return setErrorMsg('Lengkapi semua data rekening pembayaran!');

                const data = {
                    ...form,
                    judul: form.judul.trim(),
                    deskripsi: form.deskripsi.trim(),
                    tujuan: form.tujuan.trim(),
                    manfaat: form.manfaat.trim(),
                    danaTarget: safeNumber(form.danaTarget),
                    danaTerkumpul: safeNumber(form.danaTerkumpul),
                };
                if (editingId) {
                    setInfaqData(infaqData.map(i => i.id === editingId ? { ...i, ...data } : i));
                    showToast('Program infaq berhasil diperbarui.');
                } else {
                    setInfaqData([{ id: Date.now(), ...data, createdAt: getLocalDate() }, ...infaqData]);
                    showToast('Program infaq baru berhasil dibuat.');
                }
                setView('list'); setEditingId(null); setForm(emptyForm); setErrorMsg('');
            };

            const addRek = () => setForm(p => ({ ...p, rekening: [...p.rekening, { bank: '', norek: '', atasNama: '' }] }));
            const removeRek = (i) => setForm(p => ({ ...p, rekening: p.rekening.filter((_, idx) => idx !== i) }));
            const updateRek = (i, field, val) => setForm(p => ({
                ...p, rekening: p.rekening.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
            }));

            // ---- Helper ----
            const pct = (item) => item.danaTarget > 0
                ? Math.min(100, Math.round((item.danaTerkumpul / item.danaTarget) * 100))
                : null;

            const namaDisplay = tipeNama === 'tanpanama' ? 'Tanpa Nama'
                : tipeNama === 'hambaalah' ? 'Hamba Allah'
                : namaInfaq.trim() || 'Anonim';

            // ---- RENDER: LIST ----
            if (view === 'list') return (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-extrabold text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                <Icon name="volunteer_activism" className="text-[28px] text-google-green" fill="true" />Program Infaq
                            </h2>
                            <p className="text-[14px] font-medium text-google-textVariant mt-1">Salurkan infaq untuk kebaikan bersama warga {identity?.name || 'RT'}.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setForm(emptyForm); setEditingId(null); setErrorMsg(''); setView('form'); }}
                                className="flex flex-wrap items-center gap-2 bg-google-green text-white px-5 py-2.5 rounded-full font-extrabold text-[13px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all shrink-0">
                                <Icon name="add" className="text-[18px]" />Buat Program Infaq
                            </button>
                        )}
                    </div>

                    {/* Grid program */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {infaqData.map(item => {
                            const p = pct(item);
                            return (
                                <div key={item.id} onClick={() => { setSelected(item); setView('detail'); setNominalInput(''); setNamaInfaq(''); setTipeNama('nama'); setSelectedRek(0); }}
                                    className="bg-white rounded-[28px] overflow-hidden border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-google-green/50 transition-all duration-300 cursor-pointer group flex flex-col">
                                    {/* Foto */}
                                    <div className="w-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0" style={{minHeight:'160px', maxHeight:'220px'}}>
                                        {item.imageUrl
                                            ? <img src={item.imageUrl} className="w-full object-contain group-hover:scale-105 transition-transform duration-700" style={{maxHeight:'220px'}} loading="lazy" alt={item.judul} />
                                            : <div className="flex items-center justify-center p-10"><Icon name="volunteer_activism" className="text-[64px] text-slate-300" fill="true" /></div>
                                        }
                                    </div>
                                    {/* Info */}
                                    <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-3">
                                        <h3 className="text-[17px] font-extrabold text-google-text leading-snug tracking-tight group-hover:text-google-greenDark transition-colors">{item.judul}</h3>
                                        <p className="text-[13px] text-google-textVariant font-medium leading-relaxed line-clamp-2">{item.deskripsi}</p>
                                        {/* Dana progress */}
                                        <div className="mt-auto space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[12px] font-extrabold text-google-textVariant">Dana Terkumpul</span>
                                                {p !== null && <span className="text-[12px] font-extrabold text-google-green">{p}%</span>}
                                            </div>
                                            <p className="text-[18px] font-extrabold text-google-green tracking-tight">{formatRp(item.danaTerkumpul || 0)}</p>
                                            {item.danaTarget > 0 && (
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-google-green rounded-full transition-all duration-700" style={{width: `${p}%`}} />
                                                </div>
                                            )}
                                            {item.danaTarget > 0 && (
                                                <p className="text-[11px] text-google-textVariant font-medium">Target: {formatRp(item.danaTarget)}</p>
                                            )}
                                        </div>
                                        {/* Admin actions */}
                                        {userRole === 'admin' && (
                                            <div className="flex flex-wrap gap-2 pt-3 border-t-2 border-slate-100 mt-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => { setForm({...item}); setEditingId(item.id); setErrorMsg(''); setView('form'); }}
                                                    className="flex flex-wrap text-[12px] font-extrabold bg-slate-50 text-google-text border-2 border-slate-200 hover:border-google-blue hover:text-google-blue rounded-full py-2 flex flex-wrap items-center justify-center gap-1 active:scale-95 transition-all">
                                                    <Icon name="edit" className="text-[14px]" />Edit
                                                </button>
                                                <button onClick={() => setDeleteConfirmId(item.id)}
                                                    className="flex flex-wrap text-[12px] font-extrabold bg-slate-50 text-google-red border-2 border-slate-200 hover:border-google-red/40 rounded-full py-2 flex flex-wrap items-center justify-center gap-1 active:scale-95 transition-all">
                                                    <Icon name="delete" className="text-[14px]" />Hapus
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {infaqData.length === 0 && (
                            <div className="col-span-full bg-white border-2 border-slate-200 p-14 text-center rounded-[32px] shadow-sm">
                                <Icon name="volunteer_activism" className="text-[64px] text-slate-300 mx-auto mb-4" fill="true" />
                                <h3 className="text-[20px] font-extrabold text-google-text mb-2">Belum Ada Program Infaq</h3>
                                <p className="text-[14px] text-google-textVariant font-medium">{userRole === 'admin' ? 'Klik "Buat Program Infaq" untuk menambahkan.' : 'Program infaq akan tampil di sini.'}</p>
                            </div>
                        )}
                    </div>

                    {/* Modal hapus */}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-5 md:p-6">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30">
                                    <Icon name="delete" className="text-[40px] text-google-red" />
                                </div>
                                <h3 className="text-xl font-extrabold text-google-text mb-2">Hapus Program Infaq?</h3>
                                <p className="text-[14px] text-google-textVariant mb-8">Program beserta data rekening akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-4 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95">Batal</button>
                                    <button onClick={() => { setInfaqData(infaqData.filter(i => i.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Program infaq dihapus.'); }}
                                        className="flex-1 bg-google-red text-white px-4 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-redDark shadow-md hover:bg-google-redDark active:scale-95">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );

            // ---- RENDER: DETAIL ----
            if (view === 'detail' && selected) {
                const prog = infaqData.find(i => i.id === selected.id) || selected;
                const p = pct(prog);
                return (
                    <div className="space-y-5 max-w-2xl mx-auto">
                        {/* Back */}
                        <button onClick={() => setView('list')} className="flex flex-wrap items-center gap-2 text-google-textVariant font-extrabold text-[14px] hover:text-google-text transition-colors active:scale-95">
                            <Icon name="arrow_back" className="text-[20px]" />Kembali ke Daftar
                        </button>

                        {/* Foto */}
                        {prog.imageUrl && (
                            <div className="w-full bg-slate-100 rounded-[28px] overflow-hidden border-2 border-slate-200 flex items-center justify-center" style={{maxHeight:'300px'}}>
                                <img src={prog.imageUrl} className="w-full object-contain" style={{maxHeight:'300px'}} alt={prog.judul} />
                            </div>
                        )}

                        {/* Judul & dana */}
                        <div className="bg-white rounded-[28px] border-2 border-slate-200 shadow-sm p-4 sm:p-5 md:p-6">
                            <h2 className="text-[22px] font-extrabold text-google-text mb-2 tracking-tight">{prog.judul}</h2>
                            <p className="text-[14px] text-google-textVariant font-medium leading-relaxed mb-4">{prog.deskripsi}</p>
                            {/* Progress dana */}
                            <div className="bg-google-greenLight/50 border border-google-green/30 rounded-[20px] p-5 sm:p-6 md:p-8">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <p className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider">Dana Terkumpul</p>
                                        <p className="text-[28px] font-extrabold text-google-green tracking-tight">{formatRp(prog.danaTerkumpul || 0)}</p>
                                    </div>
                                    {p !== null && (
                                        <div className="text-right">
                                            <p className="text-[12px] font-bold text-google-textVariant">Target</p>
                                            <p className="text-[15px] font-extrabold text-google-text">{formatRp(prog.danaTarget)}</p>
                                        </div>
                                    )}
                                </div>
                                {prog.danaTarget > 0 && (
                                    <>
                                        <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-google-green/20">
                                            <div className="h-full bg-google-green rounded-full transition-all duration-700" style={{width:`${p}%`}} />
                                        </div>
                                        <p className="text-[12px] font-bold text-google-greenDark mt-1.5">{p}% dari target tercapai</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Admin: update dana */}
                        {userRole === 'admin' && (
                            <div className="bg-white rounded-[28px] border-2 border-google-blue/30 shadow-sm p-4 sm:p-5 md:p-6">
                                <h3 className="text-[15px] font-extrabold text-google-text mb-3 flex flex-wrap items-center gap-2">
                                    <Icon name="edit" className="text-[18px] text-google-blue" />Perbarui Dana Terkumpul
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    <input type="number" min="0" defaultValue={prog.danaTerkumpul || 0}
                                        id="update-dana-input"
                                        className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-google-blue rounded-[14px] px-4 py-3 text-[14px] font-bold outline-none transition-colors"
                                        placeholder="Nominal dana terkumpul..." />
                                    <button onClick={() => {
                                        const val = safeNumber(document.getElementById('update-dana-input').value);
                                        setInfaqData(infaqData.map(i => i.id === prog.id ? {...i, danaTerkumpul: val} : i));
                                        setSelected(prev => ({...prev, danaTerkumpul: val}));
                                        showToast('Dana terkumpul berhasil diperbarui.');
                                    }} className="bg-google-blue text-white px-5 py-3 rounded-[14px] font-extrabold text-[13px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all whitespace-nowrap">
                                        Simpan
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Admin: Panel Approval Bukti Transfer */}
                        {userRole === 'admin' && (prog.donasi || []).length > 0 && (
                            <div className="bg-white rounded-[28px] border-2 border-google-yellow/30 shadow-sm p-4 sm:p-5 md:p-6">
                                <h3 className="text-[17px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2">
                                    <Icon name="verified_user" className="text-[22px] text-google-yellow" fill="true" />Persetujuan Bukti Bayar
                                </h3>
                                <div className="space-y-4">
                                    {(prog.donasi || []).map(donasi => (
                                        <div key={donasi.id} className="bg-slate-50 rounded-[20px] p-4 sm:p-5 md:p-6 border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                            <div className="flex flex-wrap items-center gap-4 w-full">
                                                {donasi.imageUrl ? (
                                                    <a href={donasi.imageUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 shrink-0 bg-slate-200 rounded-[12px] overflow-hidden hover:opacity-80 transition-opacity">
                                                        <img src={donasi.imageUrl} className="w-full h-full object-cover" alt="Bukti Transfer" />
                                                    </a>
                                                ) : (
                                                    <div className="w-16 h-16 shrink-0 bg-slate-200 rounded-[12px] flex items-center justify-center">
                                                        <Icon name="receipt" className="text-[24px] text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-extrabold text-[15px] text-google-text truncate">{donasi.nama}</p>
                                                    <p className="text-[14px] font-extrabold text-google-green">{formatRp(donasi.nominal)}</p>
                                                    <p className="text-[11px] text-google-textVariant mt-0.5">{parseLocalDate(donasi.tanggal).toLocaleDateString('id-ID')}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                                                {donasi.status === 'PENDING' ? (
                                                    <>
                                                        <button onClick={() => {
                                                            const updatedDonasi = (prog.donasi || []).map(d => d.id === donasi.id ? {...d, status: 'APPROVED'} : d);
                                                            const newDana = (prog.danaTerkumpul || 0) + donasi.nominal;
                                                            const updatedProg = { ...prog, donasi: updatedDonasi, danaTerkumpul: newDana };
                                                            setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                            setSelected(updatedProg);
                                                            showToast('Bukti disetujui. Dana bertambah otomatis!');
                                                        }} className="bg-google-green text-white px-4 py-2 rounded-full font-extrabold text-[12px] border-2 border-google-greenDark shadow-sm hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                                            <Icon name="check" className="text-[14px]"/>Setujui
                                                        </button>
                                                        <button onClick={() => {
                                                            const updatedDonasi = (prog.donasi || []).map(d => d.id === donasi.id ? {...d, status: 'REJECTED'} : d);
                                                            const updatedProg = { ...prog, donasi: updatedDonasi };
                                                            setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                            setSelected(updatedProg);
                                                            showToast('Bukti ditolak.', 'error');
                                                        }} className="bg-white text-google-red px-4 py-2 rounded-full font-extrabold text-[12px] border-2 border-google-red/30 shadow-sm hover:bg-google-redLight active:scale-95 transition-all flex flex-wrap items-center gap-1">
                                                            <Icon name="close" className="text-[14px]"/>Tolak
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-widest ${
                                                        donasi.status === 'APPROVED' ? 'bg-google-greenLight text-google-greenDark border border-google-green/30' :
                                                        donasi.status === 'REJECTED' ? 'bg-google-redLight text-google-redDark border border-google-red/30' :
                                                        'bg-google-yellowLight text-google-yellowDark border border-google-yellow/30'
                                                    }`}>
                                                        {donasi.status === 'APPROVED' ? 'G Disetujui' : donasi.status === 'REJECTED' ? 'G Ditolak' : 'GÅ¦ Menunggu'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Riwayat Donasi G Tampil untuk SEMUA user (Warga & Admin) */}
                        {(prog.donasi || []).length > 0 && userRole !== 'admin' && (
                            <div className="bg-white rounded-[28px] border-2 border-slate-200 shadow-sm p-4 sm:p-5 md:p-6">
                                <h3 className="text-[17px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2">
                                    <Icon name="receipt_long" className="text-[22px] text-google-blue" fill="true" />Riwayat Donasi Anda
                                </h3>
                                <div className="space-y-3">
                                    {(prog.donasi || []).map(donasi => (
                                        <div key={donasi.id} className="bg-slate-50 rounded-[16px] p-4 sm:p-5 md:p-6 border border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                                            <div className="flex flex-wrap items-center gap-3 w-full">
                                                {donasi.imageUrl ? (
                                                    <a href={donasi.imageUrl} target="_blank" rel="noopener noreferrer" className="w-12 h-12 shrink-0 bg-slate-200 rounded-[10px] overflow-hidden hover:opacity-80 transition-opacity">
                                                        <img src={donasi.imageUrl} className="w-full h-full object-cover" alt="Bukti" />
                                                    </a>
                                                ) : (
                                                    <div className="w-12 h-12 shrink-0 bg-slate-200 rounded-[10px] flex items-center justify-center">
                                                        <Icon name="receipt" className="text-[20px] text-slate-400" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-extrabold text-[14px] text-google-text truncate">{donasi.nama}</p>
                                                    <p className="text-[13px] font-extrabold text-google-green">{formatRp(donasi.nominal)}</p>
                                                    <p className="text-[11px] text-google-textVariant">{parseLocalDate(donasi.tanggal).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-widest shrink-0 ${
                                                donasi.status === 'APPROVED' ? 'bg-google-greenLight text-google-greenDark border border-google-green/30' :
                                                donasi.status === 'REJECTED' ? 'bg-google-redLight text-google-redDark border border-google-red/30' :
                                                'bg-google-yellowLight text-google-yellowDark border border-google-yellow/30'
                                            }`}>
                                                {donasi.status === 'APPROVED' ? 'G Disetujui' : donasi.status === 'REJECTED' ? 'G Ditolak' : 'GÅ¦ Menunggu'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tujuan & manfaat */}
                        {(prog.tujuan || prog.manfaat) && (
                            <div className="bg-white rounded-[28px] border-2 border-slate-200 shadow-sm p-4 sm:p-5 md:p-6 space-y-4">
                                {prog.tujuan && (
                                    <div>
                                        <p className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 flex flex-wrap items-center gap-1.5"><Icon name="flag" className="text-[14px] text-google-blue" />Tujuan Program</p>
                                        <p className="text-[14px] text-google-text font-medium leading-relaxed">{prog.tujuan}</p>
                                    </div>
                                )}
                                {prog.manfaat && (
                                    <div>
                                        <p className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-1.5 flex flex-wrap items-center gap-1.5"><Icon name="star" className="text-[14px] text-google-yellow" />Manfaat</p>
                                        <p className="text-[14px] text-google-text font-medium leading-relaxed">{prog.manfaat}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Form infaq warga */}
                        <div className="bg-white rounded-[28px] border-2 border-google-green/30 shadow-sm p-4 sm:p-5 md:p-6 space-y-5">
                            <h3 className="text-[17px] font-extrabold text-google-text flex flex-wrap items-center gap-2">
                                <Icon name="volunteer_activism" className="text-[22px] text-google-green" fill="true" />Tunaikan Infaq
                            </h3>

                            {/* Pilih nominal */}
                            <div>
                                <p className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-2">Nominal Infaq</p>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {NOMINAL_CEPAT.map(n => (
                                        <button key={n} onClick={() => setNominalInput(String(n))}
                                            className={`py-2.5 rounded-[12px] font-extrabold text-[12px] border-2 transition-all active:scale-95 ${nominalInput === String(n) ? 'bg-google-green text-white border-google-greenDark shadow-md' : 'bg-slate-50 text-google-text border-slate-200 hover:border-google-green/50'}`}>
                                            {formatRp(n)}
                                        </button>
                                    ))}
                                </div>
                                <input type="number" min="1000" value={nominalInput} onChange={e => setNominalInput(e.target.value)}
                                    placeholder="Atau ketik nominal lain (Rp)..."
                                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-bold outline-none transition-colors" />
                            </div>

                            {/* Nama penginfaq */}
                            <div>
                                <p className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider mb-2">Atas Nama</p>
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {[['nama','Nama Saya'],['tanpanama','Tanpa Nama'],['hambaalah','Hamba Allah']].map(([val, label]) => (
                                        <button key={val} onClick={() => setTipeNama(val)}
                                            className={`px-4 py-2 rounded-full font-extrabold text-[12px] border-2 transition-all active:scale-95 ${tipeNama === val ? 'bg-google-green text-white border-google-greenDark' : 'bg-slate-50 text-google-text border-slate-200 hover:border-google-green/40'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {tipeNama === 'nama' && (
                                    <input type="text" value={namaInfaq} onChange={e => setNamaInfaq(e.target.value)}
                                        placeholder="Ketik nama Anda..."
                                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-bold outline-none transition-colors" />
                                )}
                            </div>

                            {/* Ringkasan sebelum bayar */}
                            {nominalInput && safeNumber(nominalInput) >= 1000 && (
                                <div className="bg-google-greenLight border border-google-green/40 rounded-[14px] px-4 py-3.5 flex justify-between items-center">
                                    <div>
                                        <p className="text-[12px] font-extrabold text-google-textVariant">Infaq atas nama: <span className="text-google-greenDark">{namaDisplay}</span></p>
                                        <p className="text-[18px] font-extrabold text-google-green mt-0.5">{formatRp(safeNumber(nominalInput))}</p>
                                    </div>
                                    <button onClick={() => setShowPayModal(true)}
                                        className="bg-google-green text-white px-5 py-3 rounded-full font-extrabold text-[13px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center gap-1.5 shrink-0">
                                        <Icon name="payments" className="text-[18px]" />Bayar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal pembayaran */}
                        {showPayModal && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-5 md:p-6">
                                <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[28px] p-4 sm:p-5 md:p-6 w-full max-w-sm shadow-2xl border-2 border-slate-200 my-4">
                                    <div className="flex items-center justify-between mb-5">
                                        <h3 className="text-[18px] font-extrabold text-google-text">Cara Pembayaran</h3>
                                        <button onClick={() => setShowPayModal(false)} className="w-9 h-9 bg-slate-50 border-2 border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all">
                                            <Icon name="close" className="text-[18px]" />
                                        </button>
                                    </div>

                                    {/* Ringkasan */}
                                    <div className="bg-google-greenLight border border-google-green/30 rounded-[16px] p-4 sm:p-5 md:p-6 mb-4">
                                        <p className="text-[12px] font-bold text-google-textVariant">Nominal Infaq</p>
                                        <p className="text-[22px] font-extrabold text-google-green">{formatRp(safeNumber(nominalInput))}</p>
                                        <p className="text-[12px] font-bold text-google-textVariant mt-1">Atas nama: <span className="text-google-greenDark font-extrabold">{namaDisplay}</span></p>
                                    </div>

                                    {/* Pilih rekening */}
                                    {(prog.rekening || []).length > 1 && (
                                        <div className="flex gap-2 flex-wrap mb-3">
                                            {(prog.rekening || []).map((r, i) => (
                                                <button key={i} onClick={() => setSelectedRek(i)}
                                                    className={`px-3 py-1.5 rounded-full font-extrabold text-[12px] border-2 transition-all active:scale-95 ${selectedRek === i ? 'bg-google-blue text-white border-google-blueDark' : 'bg-slate-50 text-google-text border-slate-200'}`}>
                                                    {r.bank}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Detail rekening */}
                                    {(prog.rekening || []).length > 0 && (() => {
                                        const r = prog.rekening[selectedRek] || prog.rekening[0];
                                        return (
                                            <div className="bg-slate-50 border-2 border-slate-200 rounded-[18px] p-5 sm:p-6 md:p-8 space-y-3.5">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="w-10 h-10 bg-google-blueLight rounded-[12px] flex items-center justify-center border border-google-blue/20 shrink-0">
                                                        <Icon name="account_balance" className="text-[20px] text-google-blue" />
                                                    </div>
                                                    <p className="font-extrabold text-[16px] text-google-text">{r.bank}</p>
                                                </div>
                                                {[['Nomor Rekening', r.norek], ['Atas Nama', r.atasNama]].map(([label, val]) => (
                                                    <div key={label} className="flex items-center justify-between">
                                                        <span className="text-[12px] font-extrabold text-google-textVariant">{label}</span>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-extrabold text-[15px] text-google-text">{val}</span>
                                                            <button onClick={() => { navigator.clipboard?.writeText(val); showToast(`${label} disalin!`); }}
                                                                className="w-7 h-7 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center hover:bg-google-blueLight hover:border-google-blue/40 active:scale-95 transition-all">
                                                                <Icon name="content_copy" className="text-[13px] text-google-textVariant" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <p className="text-[11px] font-bold text-google-textVariant bg-white border border-slate-200 rounded-[10px] px-3 py-2 leading-relaxed">
                                                    = Cantumkan nominal <span className="text-google-green font-extrabold">{formatRp(safeNumber(nominalInput))}</span> dan nama <span className="text-google-greenDark font-extrabold">{namaDisplay}</span> saat transfer.
                                                </p>
                                            </div>
                                        );
                                    })()}

                                        {/* Upload Bukti */}
                                        <div className="mt-4 bg-slate-50 border-2 border-slate-200 rounded-[18px] p-4 sm:p-5 md:p-6 text-center relative overflow-hidden transition-all focus-within:border-google-green group hover:border-google-green/40 cursor-pointer">
                                            <p className="text-[12px] font-extrabold text-google-textVariant mb-2 uppercase tracking-wider">Upload Bukti Transfer</p>
                                            <input type="file" accept="image/*" onChange={handleBuktiUpload} disabled={isUploadingBukti} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                            {isUploadingBukti ? (
                                                <div className="w-8 h-8 border-2 border-google-green border-t-transparent rounded-full animate-spin mx-auto my-3" />
                                            ) : buktiUrl ? (
                                                <div className="relative rounded-[12px] overflow-hidden border border-slate-200">
                                                    <img src={buktiUrl} className="w-full h-32 object-cover" alt="Bukti Transfer" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-white font-bold text-[12px] flex flex-wrap items-center gap-1"><Icon name="edit" className="text-[16px]"/> Ganti Foto</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-2 flex flex-col items-center bg-white rounded-[12px] border border-slate-100 shadow-sm group-hover:bg-google-greenLight transition-colors">
                                                    <Icon name="add_photo_alternate" className="text-[32px] text-slate-300 group-hover:text-google-green transition-colors" />
                                                    <span className="text-[11px] text-google-textVariant mt-1">Ketuk untuk unggah (Maks 2MB)</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-4">
                                            <button onClick={() => { setShowPayModal(false); setBuktiUrl(''); }}
                                                className="w-full sm:w-auto bg-white text-google-text py-3.5 rounded-full font-extrabold text-[13px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">
                                                Batal
                                            </button>
                                            <button onClick={() => { 
                                                if (!buktiUrl) return showToast('Mohon unggah bukti transfer terlebih dahulu!', 'error');
                                                const newDonasi = {
                                                    id: Date.now(),
                                                    nama: namaDisplay,
                                                    nominal: safeNumber(nominalInput),
                                                    imageUrl: buktiUrl,
                                                    status: 'PENDING',
                                                    tanggal: getLocalDate()
                                                };
                                                const updatedProg = {
                                                    ...prog,
                                                    donasi: [newDonasi, ...(prog.donasi || [])]
                                                };
                                                setInfaqData(infaqData.map(i => i.id === prog.id ? updatedProg : i));
                                                setSelected(updatedProg); // update view detail
                                                setShowPayModal(false);
                                                setBuktiUrl('');
                                                showToast('Terima kasih! Bukti transfer Anda telah dikirim dan menunggu verifikasi Admin.');
                                            }}
                                                className="flex flex-wrap bg-google-green text-white py-3.5 rounded-full font-extrabold text-[13px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all flex flex-wrap items-center justify-center gap-1.5">
                                                <Icon name="send" className="text-[18px]"/> Kirim Bukti
                                            </button>
                                        </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            // ---- RENDER: FORM ADMIN ----
            if (view === 'form') return (
                <div className="space-y-5 max-w-2xl mx-auto">
                    <button onClick={() => { setView('list'); setErrorMsg(''); }} className="flex flex-wrap items-center gap-2 text-google-textVariant font-extrabold text-[14px] hover:text-google-text transition-colors active:scale-95">
                        <Icon name="arrow_back" className="text-[20px]" />Kembali
                    </button>

                    <div className="bg-white rounded-[32px] border-2 border-slate-200 shadow-sm p-6 sm:p-8">
                        <h3 className="text-[20px] font-extrabold text-google-text mb-6 tracking-tight">
                            {editingId ? 'Gn+ Edit Program Infaq' : 'GP Buat Program Infaq Baru'}
                        </h3>
                        <div className="space-y-5">

                            {/* Gambar */}
                            <div>
                                <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Foto Program <span className="text-slate-400 normal-case font-semibold">(opsional)</span></label>
                                <div className={`flex items-center gap-4 bg-slate-50 border-2 ${isUploading ? 'border-google-blue' : 'border-slate-200'} p-3 rounded-[16px] relative overflow-hidden focus-within:border-google-green transition-all`}>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="bg-white w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 shadow-sm border border-slate-100 z-0">
                                        {isUploading ? <div className="w-5 h-5 border-2 border-google-green border-t-transparent rounded-full animate-spin" />
                                            : form.imageUrl ? <img src={form.imageUrl} className="w-12 h-12 rounded-[12px] object-cover" alt="preview" />
                                            : <Icon name="cloud_upload" className="text-[24px] text-google-textVariant" />}
                                    </div>
                                    <div className="flex-1 z-0">
                                        <p className="font-extrabold text-[14px] text-google-text">{isUploading ? 'Mengunggah...' : form.imageUrl ? 'Foto Tersimpan G' : 'Pilih Foto Program'}</p>
                                        <p className="text-[12px] text-google-textVariant">Maks. 2MB</p>
                                    </div>
                                    {form.imageUrl && <button type="button" onClick={e => { e.stopPropagation(); setForm(p=>({...p,imageUrl:''})); }} className="relative z-20 text-google-red bg-white border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center text-[16px] hover:bg-google-redLight active:scale-95 shrink-0">+</button>}
                                </div>
                            </div>

                            {/* Judul */}
                            <div>
                                <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Judul Program *</label>
                                <input type="text" value={form.judul} onChange={e => setForm(p=>({...p,judul:e.target.value}))}
                                    placeholder="contoh: Infaq Pembangunan Mushola RT" className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-bold outline-none transition-colors" />
                            </div>

                            {/* Deskripsi */}
                            <div>
                                <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Deskripsi Program *</label>
                                <textarea value={form.deskripsi} onChange={e => setForm(p=>({...p,deskripsi:e.target.value}))} rows={3}
                                    placeholder="Jelaskan program infaq ini secara singkat..." className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-medium outline-none transition-colors resize-none" />
                            </div>

                            {/* Tujuan & Manfaat */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Tujuan <span className="text-slate-400 normal-case font-semibold">(opsional)</span></label>
                                    <textarea value={form.tujuan} onChange={e => setForm(p=>({...p,tujuan:e.target.value}))} rows={2}
                                        placeholder="Tujuan program infaq ini..." className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[13px] font-medium outline-none transition-colors resize-none" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Manfaat <span className="text-slate-400 normal-case font-semibold">(opsional)</span></label>
                                    <textarea value={form.manfaat} onChange={e => setForm(p=>({...p,manfaat:e.target.value}))} rows={2}
                                        placeholder="Manfaat bagi warga..." className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[13px] font-medium outline-none transition-colors resize-none" />
                                </div>
                            </div>

                            {/* Dana target (opsional) */}
                            <div>
                                <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Target Dana <span className="text-slate-400 normal-case font-semibold">(opsional, 0 = tanpa target)</span></label>
                                <input type="number" min="0" value={form.danaTarget || ''} onChange={e => setForm(p=>({...p,danaTarget:safeNumber(e.target.value)}))}
                                    placeholder="0" className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-bold outline-none transition-colors" />
                            </div>

                            {/* Dana terkumpul (edit saja) */}
                            {editingId && (
                                <div>
                                    <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 uppercase tracking-widest">Dana Terkumpul Saat Ini</label>
                                    <input type="number" min="0" value={form.danaTerkumpul || ''} onChange={e => setForm(p=>({...p,danaTerkumpul:safeNumber(e.target.value)}))}
                                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-green rounded-[14px] px-4 py-3 text-[14px] font-bold outline-none transition-colors" />
                                </div>
                            )}

                            {/* Rekening pembayaran */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest">Rekening Pembayaran *</label>
                                    <button type="button" onClick={addRek} className="flex flex-wrap items-center gap-1 text-[12px] font-extrabold text-google-blue bg-google-blueLight border border-google-blue/30 px-3 py-1.5 rounded-full hover:bg-google-blue hover:text-white active:scale-95 transition-all">
                                        <Icon name="add" className="text-[14px]" />Tambah Rekening
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {form.rekening.map((r, i) => (
                                        <div key={i} className="bg-slate-50 border-2 border-slate-200 rounded-[18px] p-4 sm:p-5 md:p-6 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-wider">Rekening {i+1}</p>
                                                {form.rekening.length > 1 && (
                                                    <button type="button" onClick={() => removeRek(i)} className="text-google-red hover:bg-google-redLight w-7 h-7 flex items-center justify-center rounded-full border border-google-red/20 active:scale-95 transition-all">
                                                        <Icon name="close" className="text-[14px]" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <input type="text" value={r.bank} onChange={e => updateRek(i,'bank',e.target.value)}
                                                    placeholder="Nama Bank (BRI, BCA...)" className="bg-white border-2 border-slate-200 focus:border-google-blue rounded-[12px] px-3 py-2.5 text-[13px] font-bold outline-none transition-colors" />
                                                <input type="text" value={r.norek} onChange={e => updateRek(i,'norek',e.target.value)}
                                                    placeholder="Nomor Rekening" className="bg-white border-2 border-slate-200 focus:border-google-blue rounded-[12px] px-3 py-2.5 text-[13px] font-bold outline-none transition-colors" />
                                                <input type="text" value={r.atasNama} onChange={e => updateRek(i,'atasNama',e.target.value)}
                                                    placeholder="Atas Nama" className="bg-white border-2 border-slate-200 focus:border-google-blue rounded-[12px] px-3 py-2.5 text-[13px] font-bold outline-none transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="bg-google-redLight border border-google-red/30 text-google-redDark px-4 py-3 rounded-[14px] text-[13px] font-bold flex flex-wrap items-center gap-2">
                                    <Icon name="error" className="text-[18px]" />{errorMsg}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3 mt-6">
                            <button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all">Batal</button>
                            <button onClick={handleSaveProgram} disabled={isUploading} className="flex-1 bg-google-green text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-greenDark shadow-md hover:bg-google-greenDark active:scale-95 transition-all disabled:opacity-50">
                                {editingId ? 'Simpan Perubahan' : 'Buat Program'}
                            </button>
                        </div>
                    </div>
                </div>
            );

            return null;
        }


        function Galeri({ data, setData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [formData, setFormData] = useState({ title: '', date: getLocalDate(), imageUrl: '', description: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [selectedPhoto, setSelectedPhoto] = useState(null); // Lightbox viewer state

            const handleSave = () => {
                if (!formData.title || !formData.imageUrl) return setErrorMsg("Judul dan Foto wajib diisi!");
                if (editingId) {
                    setData(data.map(item => item.id === editingId ? { ...item, ...formData } : item));
                    showToast('Dokumentasi berhasil diperbarui.');
                } else {
                    setData([{ id: Date.now(), ...formData }, ...data]);
                    showToast('Foto berhasil ditambahkan ke galeri.');
                }
                setIsFormOpen(false);
                setEditingId(null);
            };

            const handleEdit = (item) => {
                setFormData({
                    title: item.title,
                    date: item.date || getLocalDate(),
                    imageUrl: item.imageUrl,
                    description: item.description || ''
                });
                setEditingId(item.id);
                setErrorMsg('');
                setIsUploading(false);
                setIsFormOpen(true);
            };

            // Upload Galeri: Canvas compress G base64 G Firestore (tanpa GAS)
            const handleImageUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX = 1200;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
                        else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/webp', 0.82);
                        setFormData(prev => ({ ...prev, imageUrl: compressed }));
                        setIsUploading(false);
                    };
                    img.onerror = () => { setErrorMsg('Gagal memproses gambar.'); setIsUploading(false); };
                    img.src = reader.result;
                };
                reader.onerror = () => { setErrorMsg('Gagal membaca file.'); setIsUploading(false); };
                reader.readAsDataURL(file);
            };

            return (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm no-print">
                        <div>
                            <h2 className="text-2xl font-extrabold text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                <Icon name="photo_library" className="text-[28px] text-red-600"/>
                                Galeri Lingkungan
                            </h2>
                            <p className="text-[14px] font-medium text-google-textVariant mt-1.5">Album dokumentasi digital dan catatan kegiatan warga.</p>
                        </div>
                        {userRole === 'admin' && (
                            <button onClick={() => { setFormData({ title: '', date: getLocalDate(), imageUrl: '', description: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-google-blue border-2 border-google-blueDark text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2">
                                <Icon name="add_a_photo" className="text-[20px]" />
                                <span>Unggah Foto</span>
                            </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.map(item => (
                            <div key={item.id} className="bg-white rounded-[32px] overflow-hidden border-2 border-slate-200/80 shadow-sm hover:shadow-[0_15px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1.5 hover:border-red-500/20 transition-all duration-300 flex flex-col group relative">
                                <div onClick={() => setSelectedPhoto(item)} className="w-full aspect-[4/3] bg-slate-100 relative shrink-0 border-b border-slate-100 overflow-hidden flex items-center justify-center cursor-zoom-in">
                                    <img src={item.imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" loading="lazy" alt={item.title} onError={(e) => { e.target.style.display = 'none'; }} />
                                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        <div className="bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                            <Icon name="zoom_in" className="text-slate-800 text-[20px]"/>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 sm:p-6 md:p-8 flex flex-col justify-between flex-1">
                                    <div>
                                        <div className="flex flex-wrap justify-between items-start gap-2 mb-1.5">
                                            <span className="text-[10px] font-extrabold text-red-600 bg-red-50 border border-red-500/15 px-2.5 py-1 rounded-md uppercase tracking-wider">
                                                {parseLocalDate(item.date).toLocaleDateString('id-ID', {month: 'long', year:'numeric'})}
                                            </span>
                                            <span className="text-[11px] font-bold text-google-textVariant flex flex-wrap items-center gap-0.5">
                                                <Icon name="event" className="text-[13px]" />
                                                {parseLocalDate(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                            </span>
                                        </div>
                                        <h3 onClick={() => setSelectedPhoto(item)} className="text-[16px] font-extrabold text-google-text leading-snug tracking-tight mb-2 group-hover:text-red-600 transition-colors cursor-pointer line-clamp-1">{item.title}</h3>
                                        <div className="bg-slate-50 p-3 rounded-[14px] border border-slate-100 mb-4">
                                            <p className="text-[12.5px] font-medium text-google-textVariant leading-relaxed line-clamp-3">
                                                {item.description || 'Tidak ada deskripsi.'}
                                            </p>
                                        </div>
                                    </div>
                                    {userRole === 'admin' && (
                                        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                                            <button onClick={() => handleEdit(item)} className="bg-white text-google-blue w-9 h-9 rounded-full font-extrabold flex items-center justify-center hover:bg-google-blueLight border border-slate-200 hover:border-google-blue/30 transition-all duration-300">
                                                <Icon name="edit" className="text-[16px]" />
                                            </button>
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="bg-white text-google-red w-9 h-9 rounded-full font-extrabold flex items-center justify-center hover:bg-google-redLight border border-slate-200 hover:border-google-red/30 transition-all duration-300">
                                                <Icon name="delete" className="text-[16px]" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.length === 0 && (
                        <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm">
                            <div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border-2 border-slate-200">
                                <Icon name="photo_library" className="text-[48px] text-slate-400" fill="true" />
                            </div>
                            <h3 className="font-extrabold text-[20px] mb-2 text-google-text">Belum Ada Foto</h3>
                            <p className="text-google-textVariant font-medium text-[15px]">Album dokumentasi warga masih kosong.</p>
                        </div>
                    )}

                    {/* Lightbox / Detail Viewer Modal */}
                    {selectedPhoto && (
                        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] border-2 border-slate-200 overflow-hidden" style={{ animation: 'slideUp 0.3s ease-out' }}>
                                <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Icon name="image" className="text-red-600" />
                                        <span className="text-[13px] font-extrabold text-google-text">Detail Dokumentasi</span>
                                    </div>
                                    <button onClick={() => setSelectedPhoto(null)} className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 transition-all active:scale-95">
                                        <Icon name="close" />
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1 hide-scrollbar">
                                    <div className="w-full bg-slate-900 aspect-video flex items-center justify-center relative">
                                        <img src={selectedPhoto.imageUrl} alt={selectedPhoto.title} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="p-6 sm:p-8 space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="text-[11px] font-extrabold text-red-700 bg-red-50 border border-red-500/15 px-3 py-1.5 rounded-full flex flex-wrap items-center gap-1">
                                                <Icon name="event" className="text-[14px]" />
                                                {parseLocalDate(selectedPhoto.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-black text-google-text leading-tight tracking-tight">{selectedPhoto.title}</h3>
                                        <div className="bg-slate-50 border border-slate-200/60 p-5 sm:p-6 md:p-8 rounded-[22px] text-google-textVariant text-[14px] leading-relaxed font-medium whitespace-pre-line">
                                            {selectedPhoto.description || 'Tidak ada deskripsi rinci untuk kegiatan ini.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upload / Edit Form Modal */}
                    {isFormOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-md shadow-2xl border-2 border-slate-200 flex flex-col transform scale-100 transition-transform">
                                <h3 className="text-2xl font-extrabold text-google-text mb-6 tracking-tight">
                                    {editingId ? 'Edit Dokumentasi' : 'Unggah Dokumentasi'}
                                </h3>
                                <div className="space-y-5">
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Judul / Kegiatan</label>
                                        <input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Contoh: Kerja Bakti 17an" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal</label>
                                        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Deskripsi Rinci</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[14px] font-medium outline-none rounded-[16px] resize-none min-h-[100px] leading-relaxed transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Tuliskan keterangan lengkap kegiatan di sini..."></textarea>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">File Foto</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border-2 ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-[16px] relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 shadow-sm border border-slate-100 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border-2 border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="cloud_upload" className="text-[24px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-extrabold text-[14px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.imageUrl ? "Foto Siap" : "Pilih File")}</p>
                                                <p className="text-[11px] text-google-textVariant truncate">{formData.imageUrl ? "Klik untuk mengganti foto" : "Maksimal 2MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-[12px] overflow-hidden border border-slate-200">
                                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-extrabold text-[13px] px-4 py-3.5 rounded-[16px] mt-4 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t-2 border-slate-100">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); setEditingId(null); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex flex-wrap bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all duration-300 disabled:opacity-50 flex flex-wrap items-center justify-center gap-2">
                                        {editingId ? 'Simpan' : 'Unggah'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {deleteConfirmId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Hapus Foto?</h3>
                                <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Foto ini akan dihapus dari galeri warga.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { setData(data.filter(item => item.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Foto berhasil dihapus.'); }} className="flex-1 bg-google-red text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-redDark shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function Informasi({ data, setData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [formData, setFormData] = useState({ title: '', date: getLocalDate(), imageUrl: '', description: '' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            
            const handleSave = () => {
                if (!formData.title || !formData.description) return setErrorMsg("Judul dan deskripsi wajib diisi!");
                if (editingId) { setData(data.map(item => item.id === editingId ? { ...item, ...formData } : item)); showToast('Informasi berhasil diperbarui.'); }
                else { setData([{ id: Date.now(), ...formData }, ...data]); showToast('Informasi berhasil dipublikasikan.'); }
                setIsFormOpen(false);
            };

            const handleImageUpload = (e) => {
                // Upload Informasi: Canvas compress G base64 G Firestore (tanpa GAS)
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) { setErrorMsg('File harus berupa gambar!'); return; }
                if (file.size > 10 * 1024 * 1024) { setErrorMsg('Ukuran file maksimal 10MB!'); return; }
                setIsUploading(true); setErrorMsg('');
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX = 1200;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
                        else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/webp', 0.82);
                        setFormData(prev => ({ ...prev, imageUrl: compressed }));
                        setIsUploading(false);
                    };
                    img.onerror = () => { setErrorMsg('Gagal memproses gambar.'); setIsUploading(false); };
                    img.src = reader.result;
                };
                reader.onerror = () => { setErrorMsg('Gagal membaca file gambar.'); setIsUploading(false); };
                reader.readAsDataURL(file);
            };

            return (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-extrabold text-google-text tracking-tight">Papan Informasi & Kegiatan</h2><p className="text-[14px] font-medium text-google-textVariant mt-1.5">Pengumuman dan dokumentasi lingkungan RT.</p></div>
                        {userRole === 'admin' && <button onClick={() => { setFormData({ title: '', date: getLocalDate(), imageUrl: '', description: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2"><Icon name="add" className="text-[20px]" /><span>Buat Info Baru</span></button>}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                        {data.map(item => (
                            <div key={item.id} className="bg-white rounded-[32px] overflow-hidden border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-google-blue/40 transition-all duration-300 flex flex-col group">
                                {item.imageUrl && <div className="w-full h-48 sm:h-56 bg-slate-100 relative shrink-0 border-b-2 border-slate-200 overflow-hidden"><img src={item.imageUrl} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700" onError={(e) => { e.target.style.display = 'none'; }} /></div>}
                                <div className="p-6 sm:p-8 flex flex-col">
                                    <h3 className="text-[20px] sm:text-[22px] font-extrabold text-google-text leading-snug mb-4 group-hover:text-google-blue transition-colors tracking-tight">{item.title}</h3>
                                    <div className="flex flex-wrap items-center gap-2 mb-5 text-google-blueDark bg-google-blueLight self-start px-4 py-2 rounded-xl text-[12px] font-extrabold uppercase tracking-widest border-2 border-google-blue/20"><Icon name="calendar_today" className="text-[16px]" /><span>{parseLocalDate(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}</span></div>
                                    <p className="text-[14px] font-medium text-google-textVariant leading-relaxed mb-6 whitespace-pre-line flex-1">{item.description}</p>
                                    
                                    {userRole === 'admin' && (
                                        <div className="flex flex-wrap justify-end gap-3 mt-auto pt-6 border-t-2 border-slate-100">
                                            <button onClick={() => { setFormData(item); setEditingId(item.id); setIsFormOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-white text-google-text border-2 border-slate-200 px-5 py-2.5 rounded-full font-extrabold text-[13px] hover:border-google-blue hover:text-google-blue shadow-sm active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-1.5"><Icon name="edit" className="text-[16px]" /> Edit</button>
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="bg-white text-google-red border-2 border-slate-200 px-5 py-2.5 rounded-full font-extrabold text-[13px] hover:border-google-red hover:bg-google-redLight shadow-sm active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-1.5"><Icon name="delete" className="text-[16px]" /> Hapus</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {data.length === 0 && <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border-2 border-slate-200"><Icon name="campaign" className="text-[48px] text-slate-400" fill="true" /></div><h3 className="font-extrabold text-[20px] mb-2 text-google-text">Belum Ada Informasi</h3><p className="text-google-textVariant font-medium text-[15px]">Papan informasi warga masih kosong saat ini.</p></div>}

                    {isFormOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print">
<div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-lg shadow-2xl border-2 border-slate-200 flex flex-col max-h-[90vh] transform scale-100 transition-transform">
                                <h3 className="text-2xl font-extrabold text-google-text mb-6 shrink-0 tracking-tight">{editingId ? 'Edit Info Kegiatan' : 'Buat Info Baru'}</h3>
                                <div className="space-y-5 overflow-y-auto pr-2 pb-2 hide-scrollbar">
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Judul Utama</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Masukkan judul..." /></div>
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text" /></div>
                                    
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Gambar Banner (Upload ke GDrive)</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border-2 ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-[16px] relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 shadow-sm border border-slate-100 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border-2 border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="cloud_upload" className="text-[24px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-extrabold text-[14px] text-google-text truncate">{isUploading ? "Mengunggah ke Drive..." : (formData.imageUrl ? "Gambar Siap" : "Pilih File Gambar")}</p>
                                                <p className="text-[11px] text-google-textVariant truncate">{formData.imageUrl ? "Klik area ini untuk mengganti gambar" : "Format JPG/PNG, Maksimal 2MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-[12px] overflow-hidden border border-slate-200 group">
                                                    <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({...prev, imageUrl: ''})); }} className="absolute top-0 right-0 bg-google-red/90 text-white w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="delete" className="text-[16px]"/></button>
                                                </div>
                                            )}
                                        </div>
                                        <input type="url" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="mt-2 w-full bg-transparent border-b-2 border-slate-200 focus:border-google-blue p-2 text-[12px] font-medium outline-none transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Atau paste URL gambar manual secara langsung di sini..." />
                                    </div>

                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Deskripsi Lengkap</label><textarea value={formData.description} onChange={e => {setFormData({...formData, description: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-medium outline-none rounded-[16px] min-h-[160px] resize-none transition-all duration-300 text-google-text leading-relaxed placeholder:text-slate-400" placeholder="Tuliskan detail informasi di sini..."></textarea></div>
                                </div>
                                {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-extrabold text-[13px] px-4 py-3.5 rounded-[16px] mt-4 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t-2 border-slate-100 shrink-0">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex flex-wrap bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">Publikasikan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {deleteConfirmId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Hapus Informasi?</h3>
                                <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Konten ini akan dihapus secara permanen dari layar warga.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={() => { setData(data.filter(item => item.id !== deleteConfirmId)); setDeleteConfirmId(null); showToast('Informasi berhasil dihapus.'); }} className="flex flex-wrap bg-google-red text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-redDark shadow-md hover:bg-google-redDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

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
                <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-extrabold text-google-text tracking-tight">Buku Induk Warga</h2><p className="text-[14px] font-medium text-google-textVariant mt-1.5">Total <span className="font-extrabold text-google-blue">{members.length} Warga</span> Terdaftar</p></div>
                        <div className="flex gap-3 w-full sm:w-auto overflow-x-auto hide-scrollbar pb-1 sm:pb-0">
                            <button onClick={() => { setPrintMode('buku'); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(''), 1000); }, 100); }} className="bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="print" className="text-[18px]" /><span>Cetak Form</span></button>
                            {userRole === 'admin' && <button onClick={handlePrintBarcode} className="bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="qr_code_scanner" className="text-[18px]" /><span>Cetak Barcode</span></button>}
                            {userRole === 'admin' && <button onClick={() => { setFormData({ name: '', status: 'Normal', program: 'Arisan', debt: 0, hasWon: false, wonRound: '' }); setEditingId(null); setIsFormOpen(true); setErrorMsg(''); }} className="bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 shrink-0 flex flex-wrap items-center justify-center gap-2"><Icon name="person_add" className="text-[20px]" /><span>Tambah Data</span></button>}
                        </div>
                    </div>

                    <div className="bg-white p-4 sm:p-5 rounded-[24px] border-2 border-slate-200 shadow-sm flex items-center gap-3 no-print">
                        <Icon name="search" className="text-[24px] text-slate-400 shrink-0 ml-2" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama warga..." className="w-full bg-transparent outline-none font-bold text-[15px] text-google-text placeholder:text-slate-400 placeholder:font-medium" />
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 shrink-0 active:scale-95 transition-all"><Icon name="close" className="text-[18px]" /></button>}
                    </div>

                    {printMode === 'buku' && (
                        <div className="hidden print-only">
                            <div className="kop-surat"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1><p>{identity?.subtitle || ''}</p></div>
                            <div className="text-center mb-6"><h2 className="text-[14pt] font-bold underline uppercase mb-1">Buku Induk &amp; Evaluasi Warga</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber || 1} | Putaran Ke-{currentRound} | Periode: {formatBulanTahun(arisanPeriod)}</p></div>
                            <table className="print-table">
                                <thead><tr><th width="5%">No</th><th width="30%">Nama Warga</th><th width="15%">Program</th><th width="15%">Status Arisan</th><th width="15%">Tunggakan</th><th width="20%">Keterangan</th></tr></thead>
                                <tbody>
                                    {members.length === 0 ? <tr><td colSpan="6" className="text-center font-bold">Belum ada data.</td></tr> : members.map((m, idx) => (
                                        <tr key={m.id}>
                                            <td className="text-center font-bold">{idx + 1}</td>
                                            <td className="font-bold">{m.name} {m.status === 'Meninggal' && <span style={{fontSize:'9px', background:'#eee', padding:'2px'}}>Wafat</span>}{m.status === 'Nonaktif' && <span style={{fontSize:'9px', background:'#eee', padding:'2px'}}>Nonaktif</span>}</td>
                                            <td className="text-center font-bold">{m.program === 'IuranOnly' ? 'Iuran Saja' : 'Arisan + Iuran'}</td>
                                            <td className="text-center font-bold">{m.program === 'IuranOnly' ? '-' : (m.hasWon ? `Menang (Put.${m.wonRound})` : 'Belum')}</td>
                                            <td className="text-right font-bold">{m.debt > 0 ? formatRp(m.debt) : '-'}</td><td></td>
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
                            <div className="text-center mb-8"><h2 className="text-[18pt] font-extrabold uppercase mb-1">Kartu Barcode Warga</h2><p className="text-[12pt]">{identity?.name || 'Aplikasi Arisan'}</p></div>
                            <div className="grid grid-cols-2 gap-8" style={{ pageBreakInside: 'avoid' }}>
                                {members.map(m => (
                                    <div key={m.id} className="border-2 border-black p-6 rounded-2xl flex flex-col items-center justify-center text-center" style={{ pageBreakInside: 'avoid' }}>
                                        <h3 className="font-extrabold text-[12pt] mb-2 uppercase">{identity?.name || 'RT/RW'}</h3>
                                        <p className="font-extrabold text-[16pt] uppercase mb-1 leading-tight">{m.name}</p>
                                        <p className="font-bold text-[11pt] mb-4 text-gray-700">No. Anggota: M-{m.id}</p>
                                        <svg className="barcode-element" data-value={`M-${m.id}`} data-text={`M-${m.id}`} data-height="50" data-width="1.8" data-fontSize="14"></svg>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 no-print">
                        {(() => {
                            const filteredMembers = members.filter(m => (m.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()));
                            return (
                                <>
                                    {filteredMembers.map((member) => (
                                        <div key={member.id} onClick={(e) => { if(!e.target.closest('button')) setPreviewMember(member); }} className="bg-white rounded-[24px] p-4 sm:p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between border-2 border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-google-blue/40 transition-all duration-300 gap-5 group cursor-pointer">
                                <div className="flex flex-wrap items-center gap-5">
                                    <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center font-extrabold text-[24px] shrink-0 border-2 transition-colors duration-300 ${isNonaktif(member) ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-google-blueLight text-google-blueDark border-google-blue/30 group-hover:bg-google-blue group-hover:text-white group-hover:border-google-blueDark'}`}>{member.name.charAt(0).toUpperCase()}</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-extrabold text-[18px] truncate transition-colors tracking-tight ${isNonaktif(member) ? 'text-slate-400 line-through' : 'text-google-text group-hover:text-google-blueDark'}`}>{member.name} {isNonaktif(member) && <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 px-2.5 py-1 rounded-md ml-2 font-extrabold border-2 border-slate-200 align-middle">{member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</h3>
                                        <div className="flex flex-wrap items-center gap-2.5 mt-2.5 text-[11px] uppercase tracking-wider">
                                            <span className={`px-3 py-1.5 rounded-md font-extrabold border-2 ${member.program === 'IuranOnly' ? 'bg-slate-50 text-google-textVariant border-slate-200' : 'bg-google-blue/10 text-google-blueDark border-google-blue/20'}`}>{member.program === 'IuranOnly' ? 'Hanya Iuran' : 'Arisan & Iuran'}</span>
                                            {member.program !== 'IuranOnly' && (member.hasWon ? <span className="bg-google-blue text-white px-3 py-1.5 rounded-md font-extrabold shadow-sm border-2 border-google-blueDark flex flex-wrap items-center gap-1"><Icon name="emoji_events" className="text-[14px]"/> Menang Put. {member.wonRound}</span> : <span className="text-google-textVariant px-3 py-1.5 rounded-md bg-slate-100 font-extrabold border-2 border-slate-200">Belum Menang</span>)}
                                            {member.debt > 0 ? <span className="bg-google-redLight text-google-redDark px-3 py-1.5 rounded-md font-extrabold border-2 border-google-red/40 animate-pulse flex flex-wrap items-center gap-1.5"><Icon name="warning" className="text-[14px]"/> Tunggakan {formatRp(member.debt)}</span> : <span className="bg-google-greenLight text-google-greenDark px-3 py-1.5 rounded-md font-extrabold border-2 border-google-green/40 flex flex-wrap items-center gap-1.5"><Icon name="check_circle" className="text-[14px]"/> Aman</span>}
                                        </div>
                                    </div>
                                </div>
                                {userRole === 'admin' && (
                                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 border-t-2 sm:border-t-0 border-slate-100 pt-5 sm:pt-0 justify-end w-full sm:w-auto opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <button onClick={() => { setFormData(member); setEditingId(member.id); setIsFormOpen(true); setErrorMsg(''); }} className="bg-white text-google-text px-5 py-2.5 rounded-full font-extrabold text-[13px] border-2 border-slate-200 shadow-sm hover:border-google-blue hover:text-google-blue active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-1.5"><Icon name="edit" className="text-[16px]" /><span className="sm:hidden">Edit</span></button>
                                        <button onClick={() => setDeleteConfirmId(member.id)} className="bg-white text-google-red px-5 py-2.5 rounded-full font-extrabold text-[13px] border-2 border-slate-200 shadow-sm hover:border-google-red hover:bg-google-redLight active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-1.5"><Icon name="delete" className="text-[16px]" /><span className="sm:hidden">Hapus</span></button>
                                    </div>
                                )}
                            </div>
                                    ))}
                                    {filteredMembers.length === 0 && <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-5 mx-auto border-2 border-slate-200"><Icon name="search_off" className="text-[48px] text-slate-400" fill="true" /></div><p className="text-google-text font-extrabold text-[20px] tracking-tight">Tidak Ditemukan</p><p className="text-[15px] font-medium text-google-textVariant mt-1.5">Tidak ada warga yang cocok dengan pencarian.</p></div>}
                                </>
                            );
                        })()}
                    </div>

                    {isFormOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-md border-2 border-slate-200 shadow-2xl transform scale-100 transition-transform">
                                <h3 className="text-2xl font-extrabold text-google-text mb-6 tracking-tight">{editingId ? 'Edit Data Warga' : 'Tambah Warga Baru'}</h3>
                                <div className="space-y-5">
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nama Lengkap</label><input type="text" value={formData.name} onChange={e => {setFormData({...formData, name: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Masukkan nama..." /></div>
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Program Keikutsertaan</label><select value={formData.program || 'Arisan'} onChange={e => setFormData({...formData, program: e.target.value, hasWon: false, wonRound: ''})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text cursor-pointer"><option value="Arisan">Full (Arisan &amp; Iuran)</option><option value="IuranOnly">Hanya Iuran Umum Saja</option></select></div>
                                    <div className="flex flex-wrap gap-5">
                                        <div className="flex-1"><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Status</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text cursor-pointer"><option value="Normal">Aktif</option><option value="Meninggal">Meninggal / Wafat</option><option value="Nonaktif">Nonaktif / Pindah</option></select></div>
                                        <div className="flex-1"><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tunggakan (Rp)</label><input type="number" min="0" value={formData.debt} onChange={e => {setFormData({...formData, debt: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                    </div>
                                    {formData.program !== 'IuranOnly' && (
                                        <div className="pt-5 border-t-2 border-slate-100">
                                            <label className="flex flex-wrap items-center gap-3 mb-5 cursor-pointer group"><div className="relative flex items-center justify-center"><input type="checkbox" checked={formData.hasWon} onChange={e => setFormData({...formData, hasWon: e.target.checked})} className="peer appearance-none w-6 h-6 border-2 border-slate-300 rounded-lg checked:bg-google-blue checked:border-google-blue transition-colors cursor-pointer" /><Icon name="check" className="absolute text-white text-[16px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth="4"/></div><span className="text-[14px] font-extrabold text-google-text group-hover:text-google-blue transition-colors">Warga Sudah Menang Arisan</span></label>
                                            {formData.hasWon && <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Di Putaran Ke-</label><input type="number" min="1" value={formData.wonRound} onChange={e => {setFormData({...formData, wonRound: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Misal: 3" /></div>}
                                        </div>
                                    )}
                                </div>
                                {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-extrabold text-[13px] px-4 py-3.5 rounded-[16px] mt-5 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t-2 border-slate-100">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} className="flex flex-wrap bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Simpan</button>
                                </div>
                            </div>
                        </div>
                    )}
                    {deleteConfirmId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30"><Icon name="person_remove" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Hapus Warga?</h3>
                                <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Data warga dan riwayatnya akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={executeDelete} className="flex flex-wrap bg-google-red text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-redDark shadow-md hover:bg-google-redDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {previewMember && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity" onClick={() => setPreviewMember(null)}>
                            <div className="max-h-[90vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform relative" onClick={e => e.stopPropagation()}>
                                <button onClick={() => setPreviewMember(null)} className="absolute top-4 right-4 w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-all"><Icon name="close" className="text-[20px]" /></button>
                                
                                <div className="mb-4">
                                    <div className={`w-20 h-20 mx-auto rounded-[24px] flex items-center justify-center font-extrabold text-[32px] border-2 shadow-sm ${isNonaktif(previewMember) ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-google-blueLight text-google-blueDark border-google-blue/30'}`}>{previewMember.name.charAt(0).toUpperCase()}</div>
                                </div>
                                <h3 className={`font-extrabold text-[22px] tracking-tight mb-1 ${isNonaktif(previewMember) ? 'text-slate-400 line-through' : 'text-google-text'}`}>{previewMember.name}</h3>
                                <p className="text-[13px] font-bold text-google-textVariant mb-6 bg-slate-50 inline-block px-4 py-1.5 rounded-full border-2 border-slate-200">No. Anggota: M-{previewMember.id}</p>

                                <div className="space-y-3 text-left mb-6 bg-slate-50 p-5 rounded-[24px] border-2 border-slate-200">
                                    <div className="flex justify-between items-center pb-3 border-b-2 border-slate-100"><span className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-widest">Status</span><span className="font-bold text-[14px] text-google-text">{previewMember.status}</span></div>
                                    <div className="flex justify-between items-center pb-3 border-b-2 border-slate-100"><span className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-widest">Program</span><span className="font-bold text-[14px] text-google-text">{previewMember.program === 'IuranOnly' ? 'Hanya Iuran' : 'Arisan & Iuran'}</span></div>
                                    <div className="flex justify-between items-center pb-3 border-b-2 border-slate-100"><span className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-widest">Tunggakan</span><span className={`font-extrabold text-[14px] ${previewMember.debt > 0 ? 'text-google-red' : 'text-google-green'}`}>{previewMember.debt > 0 ? formatRp(previewMember.debt) : 'Rp 0 (Aman)'}</span></div>
                                    {previewMember.program !== 'IuranOnly' && (
                                        <div className="flex justify-between items-center"><span className="text-[12px] font-extrabold text-google-textVariant uppercase tracking-widest">Arisan</span><span className={`font-bold text-[14px] ${previewMember.hasWon ? 'text-google-blue' : 'text-google-textVariant'}`}>{previewMember.hasWon ? `Menang (Put. ${previewMember.wonRound})` : 'Belum Menang'}</span></div>
                                    )}
                                </div>
                                
                                <div className="border-2 border-dashed border-slate-300 rounded-[24px] p-5 bg-white mb-2 relative">
                                    <p className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest mb-3">Barcode Resmi</p>
                                    <canvas id="preview-barcode" className="mx-auto w-full max-w-[200px]"></canvas>
                                    <button onClick={handleDownloadBarcode} className="mt-4 bg-slate-100 hover:bg-slate-200 text-google-text font-extrabold text-[12px] px-4 py-2 rounded-full transition-all flex items-center justify-center gap-1 mx-auto border-2 border-slate-200 active:scale-95"><Icon name="download" className="text-[16px]"/> Simpan Gambar (PNG)</button>
                                </div>
                                <p className="text-[11px] font-medium text-slate-400 mt-4">Tunjukkan barcode ini kepada petugas jika diperlukan.</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function IuranUmum({ iuranData, setIuranData, members, userRole, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions, identity }) {
            const [view, setView] = useState('list');
            const [selectedAgenda, setSelectedAgenda] = useState(null);
            const [formData, setFormData] = useState({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 });
            const [tempPayments, setTempPayments] = useState({});
            const [transferAmount, setTransferAmount] = useState('');
            const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
            const [errorMsg, setErrorMsg] = useState('');
            // FIX: Tambah state untuk konfirmasi hapus agenda
            const [deleteConfirmAgendaId, setDeleteConfirmAgendaId] = useState(null);

            const activeMembers = useMemo(() => members.filter(m => m.status === 'Normal'), [members]);

            const handleSaveAgenda = () => {
                if (!formData.title || !formData.title.trim()) return setErrorMsg("Judul Agenda Wajib!");
                const safeMinAmount = safeNumber(formData.minAmount);
                if (safeMinAmount <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
                if (selectedAgenda) { setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate } : item)); showToast('Agenda iuran berhasil diperbarui.'); }
                else { setIuranData([{ id: Date.now(), title: formData.title, minAmount: safeMinAmount, dueDate: formData.dueDate, payments: {}, transferredToKas: 0 }, ...iuranData]); showToast('Agenda iuran baru berhasil dibuat.'); }
                setView('list');
            };

            const handleSavePayments = () => {
                const cleanPayments = {};
                // FIX: Gunakan parseInt untuk memastikan key tersimpan sebagai angka konsisten
                for (let memberId in tempPayments) {
                    const numId = parseInt(memberId);
                    if (tempPayments[memberId] >= selectedAgenda.minAmount) cleanPayments[numId] = safeNumber(tempPayments[memberId]);
                }
                setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, payments: cleanPayments } : item));
                setView('list');
                showToast('Rekap pembayaran warga berhasil disimpan.');
            };

            const executeTransferToKas = () => {
                const nominal = safeNumber(transferAmount);
                const sisa = calculateTotal(selectedAgenda.payments || {}) - (selectedAgenda.transferredToKas || 0);
                if (nominal <= 0 || nominal > sisa) return setErrorMsg(`Nominal penarikan maksimal ${formatRp(sisa)}!`);
                setKasRtBalance(prev => prev + nominal);
                setKasRtTransactions(prev => [{ id: Date.now(), date: getLocalDate(), type: 'Pemasukan', category: 'Iuran Umum', description: `Mutasi Iuran: ${selectedAgenda.title}`, amount: nominal }, ...prev]);
                setIuranData(iuranData.map(item => item.id === selectedAgenda.id ? { ...item, transferredToKas: (selectedAgenda.transferredToKas || 0) + nominal } : item));
                setIsTransferModalOpen(false); setView('list');
                showToast(`Berhasil menyetor ${formatRp(nominal)} ke Kas RT.`);
            };

            const calculateTotal = (obj) => { let total = 0; for(let k in obj) total += obj[k]; return total; };

            if (view === 'form') {
                return (
                    <div className="bg-white p-5 sm:p-8 rounded-[32px] border-2 border-slate-200 max-w-2xl mx-auto shadow-xl">
                        <div className="flex flex-wrap items-center gap-5 mb-8 border-b-2 border-slate-100 pb-6"><button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-12 h-12 bg-white text-google-text border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[20px] font-extrabold text-google-text" /></button><h2 className="text-[22px] sm:text-[24px] font-extrabold text-google-text leading-tight tracking-tight">{selectedAgenda ? 'Edit Agenda' : 'Buat Agenda Iuran'}</h2></div>
                        <div className="space-y-6">
                            <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nama / Keperluan Iuran</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="Misal: Dana 17 Agustus" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Batas Akhir Waktu</label><input type="date" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text cursor-pointer" /></div>
                                <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tarif Minimal (Rp)</label><input type="number" min="0" value={formData.minAmount} onChange={e => {setFormData({...formData, minAmount: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[15px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                            </div>
                        </div>
                        {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-bold text-[13px] px-4 py-3.5 rounded-[16px] mt-6 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                        <div className="flex justify-end mt-10 pt-6 border-t-2 border-slate-100">
                            <button onClick={handleSaveAgenda} className="bg-google-blue text-white px-8 py-4 rounded-full font-extrabold text-[15px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto flex flex-wrap items-center justify-center gap-2"><Icon name="save" className="text-[20px]"/> Simpan Agenda</button>
                        </div>
                    </div>
                );
            }

            if (view === 'manage') {
                const totalTerkumpul = calculateTotal(tempPayments);
                const lunasCount = activeMembers.filter(m => (tempPayments[m.id] || 0) >= selectedAgenda.minAmount).length;
                const transferred = selectedAgenda.transferredToKas || 0;
                const sisa = totalTerkumpul - transferred;

                return (
                    <div className="space-y-6 max-w-5xl mx-auto">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 no-print bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm">
                            <div className="flex flex-wrap items-center gap-5"><button onClick={() => { setView('list'); setErrorMsg(''); }} className="w-12 h-12 bg-white text-google-text border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-full shrink-0 flex justify-center items-center transition-all duration-300 active:scale-95 shadow-sm"><Icon name="arrow_back" className="text-[20px] font-extrabold text-google-text" /></button><div><h2 className="text-[22px] sm:text-[24px] font-extrabold text-google-text leading-tight tracking-tight">{selectedAgenda.title}</h2><p className="text-[14px] font-medium text-google-textVariant mt-1">Kelola Penyetoran Warga</p></div></div>
                            {userRole === 'admin' && <button onClick={() => window.print()} className="bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="print" className="text-[18px]" /> <span className="hidden sm:inline">Cetak Laporan</span></button>}
                        </div>

                        <div className="hidden print-only">
                            <div className="kop-surat"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || ''}</h1></div>
                            <div className="text-center mb-6"><h2 className="text-[14pt] font-bold underline uppercase mb-1">Penerimaan Iuran Umum</h2><p className="text-[11pt]">Agenda: <strong>{selectedAgenda.title}</strong></p></div>
                            <div style={{marginBottom:'15px', fontSize:'11pt'}}><p>Target Minimal per Warga: <strong>{formatRp(selectedAgenda.minAmount)}</strong></p><p>Total Terkumpul: <strong>{formatRp(totalTerkumpul)}</strong></p></div>
                            <table className="print-table">
                                <thead><tr><th width="5%">No</th><th width="35%">Nama Warga</th><th width="20%">Status</th><th width="20%">Nominal Bayar</th><th width="20%">TTD</th></tr></thead>
                                <tbody>
                                    {activeMembers.map((m, idx) => {
                                        const amt = tempPayments[m.id] || 0;
                                        return <tr key={m.id}><td className="text-center font-bold">{idx + 1}</td><td className="font-bold">{m.name}</td><td className="text-center font-bold">{amt >= selectedAgenda.minAmount ? 'LUNAS' : '-'}</td><td className="text-right font-bold">{amt > 0 ? formatRp(amt) : ''}</td><td></td></tr>
                                    })}
                                </tbody>
                            </table>
                            <div className="ttd-container">
                                <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                                <div className="ttd-box"><p>Penerima / Bendahara,</p><br/><div className="ttd-space" style={{height:'60px'}}></div><p className="ttd-name">( ................................... )</p></div>
                            </div>
                        </div>

                        <div className="bg-white p-5 sm:p-8 rounded-[32px] border-2 border-slate-200 shadow-sm no-print">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
                                <div className="bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[24px] border-2 border-slate-200 text-center shadow-sm"><p className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest mb-2">Target / Warga</p><p className="text-[24px] font-extrabold text-google-text tracking-tight">{formatRp(selectedAgenda.minAmount)}</p></div>
                                <div className="bg-google-greenLight p-4 sm:p-5 md:p-6 rounded-[24px] border-2 border-google-green/30 text-center shadow-sm"><p className="text-[11px] font-extrabold text-google-greenDark uppercase tracking-widest mb-2">Dana Terkumpul</p><p className="text-[24px] font-extrabold text-google-greenDark tracking-tight">{formatRp(totalTerkumpul)}</p></div>
                                <div className="bg-gradient-to-br from-google-blueLight to-blue-50 p-4 sm:p-5 md:p-6 rounded-[24px] border-2 border-google-blue/30 text-center flex flex-col items-center relative shadow-sm hover:shadow-md transition-shadow group"><p className="text-[11px] font-extrabold text-google-blueDark uppercase tracking-widest mb-2">Sisa (Belum Disetor)</p><p className="text-[24px] font-extrabold text-google-blueDark group-hover:scale-105 transition-transform tracking-tight">{formatRp(sisa)}</p>
                                    {userRole === 'admin' && sisa > 0 && <button onClick={() => { 
                                            const savedTotal = calculateTotal(selectedAgenda.payments || {});
                                            const currentTotal = calculateTotal(tempPayments);
                                            if (savedTotal !== currentTotal) { setErrorMsg('Simpan Rekap Warga dulu sebelum menyetor dana!'); return; }
                                            setIsTransferModalOpen(true); setErrorMsg(''); 
                                        }} className="absolute -bottom-5 bg-google-blue text-white text-[13px] font-extrabold px-6 py-2.5 rounded-full border-2 border-google-blueDark shadow-lg hover:bg-google-blueDark hover:-translate-y-1 active:scale-95 transition-all flex flex-wrap items-center gap-1.5"><Icon name="sync_alt" className="text-[16px]" /> Setor ke Kas Utama</button>}
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 border-2 border-slate-200 p-4 sm:p-5 md:p-6 rounded-[24px] mb-10 shadow-sm">
                                <div className="flex justify-between items-end mb-4"><span className="text-[14px] font-extrabold text-google-textVariant">Progres Pelunasan Warga</span><span className="text-[20px] font-extrabold text-google-blueDark leading-none">{lunasCount} <span className="text-[15px] text-google-textVariant">/ {activeMembers.length}</span></span></div>
                                <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-gradient-to-r from-google-blue to-google-blueDark h-full rounded-full transition-all duration-1000" style={{ width: `${activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100}%` }}></div></div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {activeMembers.map(member => {
                                    const amountPaid = tempPayments[member.id] || 0;
                                    const isLunas = amountPaid >= selectedAgenda.minAmount;
                                    const isError = amountPaid > 0 && amountPaid < selectedAgenda.minAmount;
                                    return (
                                        <div key={member.id} className={`p-6 rounded-[24px] border-2 flex flex-col justify-between transition-all duration-300 group ${userRole === 'admin' ? (isError ? 'bg-google-redLight border-google-red hover:shadow-lg' : 'bg-white border-slate-200 hover:border-google-blue hover:shadow-xl hover:-translate-y-1') : (isLunas ? 'bg-google-greenLight border-google-green shadow-sm' : 'bg-slate-50 border-slate-200')}`}>
                                            <div className="flex justify-between items-start mb-6">
                                                <h3 className="font-extrabold text-[16px] text-google-text truncate pr-3 group-hover:text-google-blue transition-colors leading-tight">{member.name}</h3>
                                                {isLunas ? <span className="text-[10px] bg-google-green text-white px-3 py-1.5 rounded-md font-extrabold uppercase tracking-widest shadow-sm flex flex-wrap items-center gap-1 shrink-0 border border-google-greenDark"><Icon name="check" className="text-[12px]"/> LUNAS</span> : <span className="text-[10px] bg-slate-200 text-google-textVariant px-3 py-1.5 rounded-md font-extrabold uppercase tracking-widest shrink-0 border border-slate-300">BELUM</span>}
                                            </div>
                                            {userRole === 'admin' ? (
                                                <div>
                                                    <div className={`flex items-center bg-slate-50 rounded-[16px] px-4 py-3 border-2 transition-colors duration-300 ${isError ? 'border-google-red' : 'border-slate-200 focus-within:border-google-blue focus-within:bg-white focus-within:shadow-md'}`}>
                                                        <span className="text-[15px] font-extrabold text-google-textVariant mr-2">Rp</span>
                                                        <input type="number" min="0" value={tempPayments[member.id] || ''} onChange={(e) => { setTempPayments(prev => ({...prev, [member.id]: safeNumber(e.target.value)})); setErrorMsg(''); }} className="w-full bg-transparent border-none text-[16px] font-bold outline-none p-0 text-google-text placeholder:text-slate-300" placeholder="0" />
                                                    </div>
                                                    {isError && <p className="text-[11px] font-extrabold text-google-redDark mt-2.5 ml-1 flex flex-wrap items-center gap-1.5"><Icon name="info" className="text-[14px]" /> Kurang dari {formatRp(selectedAgenda.minAmount)}</p>}
                                                </div>
                                            ) : (
                                                <div className="text-[13px] font-bold mt-2 bg-white p-3.5 rounded-[16px] border-2 border-slate-100 flex flex-wrap items-center gap-2.5 shadow-sm">
                                                    {isLunas ? <><Icon name="task_alt" className="text-[20px] text-google-greenDark" /><span className="text-google-greenDark">Memenuhi Syarat</span></> : <><Icon name="pending" className="text-[20px] text-google-textVariant" /><span className="text-google-textVariant">Menunggu Penyetoran</span></>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {userRole === 'admin' && (
                                <div className="mt-10 pt-8 border-t-2 border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-5">
                                    {errorMsg ? <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-bold text-[13px] px-5 py-4 rounded-[16px] w-full sm:w-auto flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div> : <div></div>}
                                    <button onClick={handleSavePayments} className="w-full sm:w-auto bg-google-blue text-white px-10 py-4 rounded-full font-extrabold text-[15px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2"><Icon name="save" className="text-[20px]" /> Simpan Rekap Warga</button>
                                </div>
                            )}
                        </div>

                        {isTransferModalOpen && (
                            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                                <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                    <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border-2 border-google-yellow/30"><Icon name="move_to_inbox" className="text-[48px] text-google-yellowDark" fill="true" /></div>
                                    <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Setor ke Kas RT</h3>
                                    <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Mutasi dana fisik dari Iuran ke Saldo Buku Kas Utama.</p>
                                    
                                    <div className="bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[24px] mb-8 border-2 border-slate-200 shadow-sm"><p className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest mb-2">Batas Maksimal Tarik</p><p className="text-[28px] font-extrabold text-google-text tracking-tight">{formatRp(sisa)}</p></div>
                                    
                                    <div className="text-left mb-8"><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal Disetor (Rp)</label><input type="number" min="0" value={transferAmount} onChange={e => {setTransferAmount(safeNumber(e.target.value)); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[18px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                    
                                    {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-bold text-[13px] px-4 py-3.5 rounded-[16px] mb-8 flex flex-wrap items-center gap-2 text-left"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                                    
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => { setIsTransferModalOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                        <button onClick={executeTransferToKas} className="flex flex-wrap bg-google-yellow text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-yellowDark shadow-md hover:bg-google-yellowDark hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Setor Dana</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            }

            return (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-extrabold text-google-text tracking-tight">Agenda Iuran Umum</h2><p className="text-[14px] font-medium text-google-textVariant mt-1.5">Penggalangan dana non-arisan (berlaku untuk semua warga).</p></div>
                        {userRole === 'admin' && <button onClick={() => { setFormData({ title: '', minAmount: 0, dueDate: getLocalDate(), payments: {}, transferredToKas: 0 }); setSelectedAgenda(null); setView('form'); setErrorMsg(''); }} className="shrink-0 bg-google-blue text-white px-8 py-3.5 rounded-full font-extrabold flex flex-wrap items-center gap-2 text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 w-full sm:w-auto justify-center"><Icon name="add_task" className="text-[20px]" /><span>Buat Agenda Baru</span></button>}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                        {iuranData.map(agenda => {
                            const payments = agenda.payments || {};
                            const totalTerkumpul = calculateTotal(payments);
                            const lunasCount = activeMembers.filter(m => payments[m.id] >= agenda.minAmount).length;
                            const progressPercent = activeMembers.length === 0 ? 0 : (lunasCount / activeMembers.length) * 100;

                            return (
                                <div key={agenda.id} className="bg-white rounded-[32px] p-6 sm:p-8 border-2 border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1.5 hover:border-google-blue/40 transition-all duration-300 group">
                                    <div>
                                        <h3 className="text-[24px] font-extrabold text-google-text leading-snug mb-6 group-hover:text-google-blue transition-colors tracking-tight">{agenda.title}</h3>
                                        <div className="flex flex-col sm:flex-row gap-4 mb-8">
                                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[20px] border-2 border-slate-200 shadow-sm"><div className="w-12 h-12 rounded-full bg-google-blueLight flex items-center justify-center text-google-blue border border-google-blue/20"><Icon name="event" className="text-[24px]" fill="true"/></div><div><p className="text-[10px] font-extrabold text-google-textVariant uppercase tracking-widest mb-1">Batas Akhir</p><p className="text-[14px] font-bold text-google-text">{parseLocalDate(agenda.dueDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p></div></div>
                                            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[20px] border-2 border-slate-200 shadow-sm"><div className="w-12 h-12 rounded-full bg-google-greenLight flex items-center justify-center text-google-green border border-google-green/20"><Icon name="payments" className="text-[24px]" fill="true"/></div><div><p className="text-[10px] font-extrabold text-google-textVariant uppercase tracking-widest mb-1">Target Minimal</p><p className="text-[15px] font-extrabold text-google-text">{formatRp(agenda.minAmount)}</p></div></div>
                                        </div>
                                        <div className="bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[24px] border-2 border-slate-200 mb-8 shadow-sm">
                                            <div className="flex justify-between items-end mb-4"><span className="text-[13px] font-bold text-google-textVariant">Progres Warga Lunas</span><span className="text-[18px] font-extrabold text-google-blueDark leading-none">{lunasCount} <span className="text-[13px] text-google-textVariant">/ {activeMembers.length}</span></span></div>
                                            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden inset-shadow-sm"><div className="bg-gradient-to-r from-google-blue to-google-blueDark h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pt-6 border-t-2 border-slate-100">
                                        <div className="bg-google-greenLight/50 px-5 py-3.5 rounded-[16px] border-2 border-google-green/20"><p className="text-[10px] text-google-greenDark uppercase tracking-widest font-extrabold mb-1">Total Dana Terkumpul</p><p className="text-[22px] font-extrabold text-google-greenDark tracking-tight truncate">{userRole === 'admin' ? formatRp(totalTerkumpul) : '= Disembunyikan'}</p></div>
                                        {userRole === 'admin' ? (
                                            <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-auto">
                                                <button onClick={() => { setSelectedAgenda(agenda); setTempPayments(agenda.payments || {}); setView('manage'); }} className="px-6 py-3.5 bg-google-blueLight text-google-blueDark border-2 border-google-blue/30 rounded-full text-[14px] font-extrabold hover:bg-google-blue hover:text-white transition-all duration-300 hover:shadow-md active:scale-95 flex flex-wrap items-center gap-1.5"><Icon name="edit_document" className="text-[18px]"/> Kelola</button>
                                                <button onClick={() => { setFormData({ title: agenda.title, minAmount: agenda.minAmount, dueDate: agenda.dueDate, payments: agenda.payments || {}, transferredToKas: agenda.transferredToKas || 0 }); setSelectedAgenda(agenda); setView('form'); setErrorMsg(''); }} className="w-12 h-12 flex items-center justify-center bg-white text-google-text hover:bg-slate-50 hover:border-slate-300 rounded-full border-2 border-slate-200 active:scale-95 transition-all duration-300 shadow-sm"><Icon name="settings" className="text-[20px]" /></button>
                                                <button onClick={() => setDeleteConfirmAgendaId(agenda.id)} className="w-12 h-12 flex items-center justify-center bg-white text-google-red hover:bg-google-redLight hover:border-google-red/40 rounded-full border-2 border-slate-200 active:scale-95 transition-all duration-300 shadow-sm"><Icon name="delete" className="text-[20px]" /></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => { setSelectedAgenda(agenda); setTempPayments(agenda.payments || {}); setView('manage'); }} className="px-8 py-3.5 bg-white border-2 border-slate-200 text-google-text rounded-full text-[14px] font-extrabold hover:bg-slate-50 hover:border-slate-300 shadow-sm shrink-0 active:scale-95 transition-all duration-300 self-end sm:self-auto flex flex-wrap items-center gap-2"><Icon name="visibility" className="text-[18px]"/> Cek Status Saya</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {iuranData.length === 0 && <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border-2 border-slate-200"><Icon name="volunteer_activism" className="text-[48px] text-google-red" fill="true" /></div><h3 className="text-google-text font-extrabold text-[22px] mb-2 tracking-tight">Belum Ada Agenda Iuran</h3><p className="text-google-textVariant font-medium text-[15px]">Daftar donasi atau tagihan umum akan tampil di sini.</p></div>}

                    {/* FIX: Modal konfirmasi hapus agenda */}
                    {deleteConfirmAgendaId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200">
                                <div className="mb-5 bg-google-redLight w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2 border-google-red/30"><Icon name="delete" className="text-[40px] text-google-red" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Hapus Agenda?</h3>
                                <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Agenda iuran beserta seluruh data pembayaran warga akan dihapus permanen.</p>
                                <div className="flex flex-wrap gap-3">
                                    <button onClick={() => setDeleteConfirmAgendaId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                    <button onClick={() => { setIuranData(iuranData.filter(i => i.id !== deleteConfirmAgendaId)); setDeleteConfirmAgendaId(null); showToast('Agenda iuran berhasil dihapus.'); }} className="flex-1 bg-google-red text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-redDark shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300">Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function BukuKas({ balance, setBalance, transactions, setTransactions, userRole, identity, jimpitanBalance, setJimpitanBalance }) {
            // Komponen BukuKas untuk pencatatan transaksi Kas RT Utama
            const [isModalOpen, setIsModalOpen] = useState(false);
            const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
            const [transferAmount, setTransferAmount] = useState('');
            const [formData, setFormData] = useState({ type: 'Pengeluaran', category: 'Pembelian Barang', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [editingId, setEditingId] = useState(null);

            // Upload Nota Kas RT: Canvas compress G base64 G Firestore (tanpa GAS)
            const handleImageUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX = 1200;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
                        else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/webp', 0.82);
                        setFormData(prev => ({ ...prev, receiptUrl: compressed }));
                        setIsUploading(false);
                    };
                    img.onerror = () => { setErrorMsg('Gagal memproses gambar nota.'); setIsUploading(false); };
                    img.src = reader.result;
                };
                reader.onerror = () => { setErrorMsg('Gagal membaca file nota.'); setIsUploading(false); };
                reader.readAsDataURL(file);
            };

            const handleSave = () => {
                if (!formData.description) return setErrorMsg("Keterangan wajib diisi!");
                const nominal = safeNumber(formData.amount);
                if (nominal <= 0) return setErrorMsg("Nominal harus lebih dari Rp 0!");
                
                if (editingId) {
                    const oldTx = transactions.find(t => t.id === editingId);
                    let tempBalance = balance;
                    if (oldTx.type === 'Pemasukan') tempBalance -= oldTx.amount;
                    else tempBalance += oldTx.amount;
                    
                    if (formData.type === 'Pengeluaran' && nominal > tempBalance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(tempBalance)}`);
                    
                    if (formData.type === 'Pemasukan') tempBalance += nominal;
                    else tempBalance -= nominal;
                    
                    setBalance(tempBalance);
                    setTransactions(transactions.map(t => t.id === editingId ? { ...formData, amount: nominal } : t));
                    setEditingId(null);
                    showToast(`Transaksi berhasil diperbarui.`);
                } else {
                    if (formData.type === 'Pengeluaran' && nominal > balance) return setErrorMsg(`Saldo tidak cukup! Saldo saat ini ${formatRp(balance)}`);
                    if (formData.type === 'Pemasukan') setBalance(prev => prev + nominal); else setBalance(prev => prev - nominal);
                    setTransactions([{ id: Date.now(), ...formData, amount: nominal }, ...transactions]);
                    showToast(`Transaksi ${formData.type.toLowerCase()} berhasil dicatat.`);
                }
                
                setIsModalOpen(false); setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null });
                setIsUploading(false);
            };

            const handleTransferJimpitan = () => {
                const nominal = safeNumber(transferAmount);
                if (nominal <= 0 || nominal > jimpitanBalance) return setErrorMsg(`Penarikan tidak valid! Maksimal ${formatRp(jimpitanBalance)}`);
                setJimpitanBalance(prev => prev - nominal); setBalance(prev => prev + nominal);
                setTransactions([{ id: Date.now(), type: 'Pemasukan', category: 'Mutasi Jimpitan', description: 'Pencairan Kas Jimpitan', amount: nominal, date: getLocalDate() }, ...transactions]);
                setIsTransferModalOpen(false); setTransferAmount('');
                showToast(`Berhasil mencairkan ${formatRp(nominal)} dari Kas Jimpitan.`);
            };

            return (
                <div className="space-y-6 print:p-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm no-print">
                        <div><h2 className="text-2xl font-extrabold text-google-text tracking-tight">Buku Kas Utama</h2><p className="text-[14px] font-medium text-google-textVariant mt-1.5">Catatan riwayat transaksi operasional RT.</p></div>
                        <button onClick={() => window.print()} className="bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold flex flex-wrap items-center gap-2 text-[14px] border-2 border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 w-full sm:w-auto"><Icon name="print" className="text-[18px]" /> <span>Cetak Laporan</span></button>
                    </div>

                    <div className="hidden print-only">
                        <div className="kop-surat"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || ''}</h1></div>
                        <div className="text-center mb-6"><h2 className="text-[14pt] font-bold underline uppercase mb-1">Buku Kas Umum</h2><p className="text-[11pt]">Per Tanggal: {new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}</p></div>
                        <table className="print-table">
                            <thead><tr><th width="5%">No</th><th width="15%">Tanggal</th><th width="40%">Uraian Transaksi</th><th width="20%">Pemasukan</th><th width="20%">Pengeluaran</th></tr></thead>
                            <tbody>
                                {transactions.length === 0 ? <tr><td colSpan="5" className="text-center font-bold">Nihil / Belum ada transaksi</td></tr> : transactions.map((t, idx) => (
                                    <tr key={t.id}><td className="text-center font-bold">{idx + 1}</td><td className="text-center font-bold">{parseLocalDate(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}</td><td className="font-bold">{t.description} {t.category ? `(${t.category})` : ''}</td><td className="text-right font-bold">{t.type === 'Pemasukan' ? formatRp(t.amount) : '-'}</td><td className="text-right font-bold">{t.type === 'Pengeluaran' ? formatRp(t.amount) : '-'}</td></tr>
                                ))}
                            </tbody>
                            <tfoot><tr><th colSpan="3" className="text-right">SALDO AKHIR KAS RT</th><th colSpan="2" className="text-center" style={{fontSize: '12pt'}}>{formatRp(balance)}</th></tr></tfoot>
                        </table>
                        <div className="ttd-container">
                            <div className="ttd-box"><p>Mengetahui,</p><p>Ketua RT</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                            <div className="ttd-box"><p>Dibuat Oleh,</p><p>Bendahara / Admin</p><div className="ttd-space"></div><p className="ttd-name">( ................................... )</p></div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-google-blue via-google-blue to-google-blueDark text-white p-8 sm:p-12 rounded-[32px] border-2 border-google-blueDark shadow-xl relative overflow-hidden no-print group cursor-default">
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-56 h-56 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 bg-black opacity-10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-1000 delay-100"></div>
                        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-google-blueLight opacity-20 rounded-full blur-3xl animate-pulse"></div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full mb-5 shadow-sm">
                                <Icon name="account_balance_wallet" className="text-[18px]"/>
                                <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-50">Total Saldo Aktif</span>
                            </div>
                            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight drop-shadow-md">{formatRp(balance)}</h2>
                        </div>
                    </div>

                    {userRole === 'admin' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5 no-print">
                            <button onClick={() => { setEditingId(null); setFormData({ type: 'Pemasukan', category: 'Iuran Opsional', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); setIsModalOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-white border-2 border-slate-200 p-4 sm:p-5 md:p-6 rounded-[24px] flex flex-row sm:flex-col items-center sm:justify-center gap-4 hover:border-google-green hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center">
                                <div className="bg-google-greenLight text-google-greenDark w-14 h-14 rounded-[20px] flex items-center justify-center group-hover:bg-google-green group-hover:text-white transition-colors duration-300 shadow-sm border border-google-green/20"><Icon name="add" className="text-[28px] group-hover:scale-110 group-hover:rotate-90 transition-all duration-300" /></div>
                                <span className="text-[15px] font-extrabold text-google-text">Catat Pemasukan</span>
                            </button>
                            <button onClick={() => { setEditingId(null); setFormData({ type: 'Pengeluaran', category: 'Belanja Barang/Alat', description: '', amount: '', date: getLocalDate(), receiptUrl: null }); setIsModalOpen(true); setErrorMsg(''); setIsUploading(false); }} className="bg-white border-2 border-slate-200 p-4 sm:p-5 md:p-6 rounded-[24px] flex flex-row sm:flex-col items-center sm:justify-center gap-4 hover:border-google-red hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center">
                                <div className="bg-google-redLight text-google-redDark w-14 h-14 rounded-[20px] flex items-center justify-center group-hover:bg-google-red group-hover:text-white transition-colors duration-300 shadow-sm border border-google-red/20"><Icon name="remove" className="text-[28px] group-hover:scale-110 group-hover:-rotate-90 transition-all duration-300" /></div>
                                <span className="text-[15px] font-extrabold text-google-text">Catat Pengeluaran</span>
                            </button>
                            <button onClick={() => { setIsTransferModalOpen(true); setErrorMsg(''); }} className="bg-white border-2 border-slate-200 p-4 sm:p-5 md:p-6 rounded-[24px] flex flex-row sm:flex-col items-center sm:justify-center gap-4 hover:border-google-yellow hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-sm active:scale-95 group text-left sm:text-center">
                                <div className="bg-google-yellowLight text-google-yellowDark w-14 h-14 rounded-[20px] flex items-center justify-center group-hover:bg-google-yellow group-hover:text-white transition-colors duration-300 shadow-sm border border-google-yellow/20"><Icon name="move_to_inbox" className="text-[28px] group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300" /></div>
                                <span className="text-[15px] font-extrabold text-google-text leading-tight">Cairkan Kas Jimpitan</span>
                            </button>
                        </div>
                    )}

                    <div className="space-y-4 no-print">
                        <h3 className="text-xl font-extrabold text-google-text mb-5 px-2 tracking-tight">Riwayat Transaksi Terkini</h3>
                        {transactions.map((t) => (
                            <div key={t.id} className="bg-white p-5 sm:p-6 rounded-[24px] border-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-google-blue/30 transition-all duration-300 gap-4 group">
                                <div className="flex items-center gap-5 flex-1 overflow-hidden">
                                    <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center shrink-0 border-2 transition-colors duration-300 ${t.type === 'Pemasukan' ? 'bg-google-greenLight text-google-greenDark border-google-green/30 group-hover:bg-google-green group-hover:text-white' : 'bg-google-redLight text-google-redDark border-google-red/30 group-hover:bg-google-red group-hover:text-white'}`}><Icon name={t.type === 'Pemasukan' ? "arrow_downward" : "arrow_upward"} className="text-[28px]" fill="true" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-extrabold text-[16px] text-google-text truncate mb-1.5">{t.description}</p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-[12px] font-bold text-google-textVariant bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md inline-flex items-center gap-1.5"><Icon name="label" className="text-[14px]" /> {t.category} G {parseLocalDate(t.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p>
                                            {t.receiptUrl && <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-google-blue bg-google-blueLight border border-google-blue/20 px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 hover:bg-google-blue hover:text-white transition-colors duration-300"><Icon name="receipt" className="text-[14px]" /> Lihat Bukti</a>}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t-2 sm:border-t-0 border-slate-100 pt-4 sm:pt-0 w-full sm:w-auto">
                                    <span className={`font-extrabold text-[20px] ${t.type === 'Pemasukan' ? 'text-google-greenDark' : 'text-google-redDark'} tracking-tight`}>{t.type === 'Pemasukan' ? '+' : '-'}{formatRp(t.amount)}</span>
                                    {userRole === 'admin' && t.category !== 'Saldo Awal' && (
                                        <div className="flex flex-wrap gap-2 mt-0 sm:mt-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            <button onClick={() => {
                                                setEditingId(t.id);
                                                setFormData(t);
                                                setIsModalOpen(true);
                                                setErrorMsg('');
                                            }} className="text-google-blue bg-white hover:bg-google-blueLight border-2 border-slate-200 hover:border-google-blue/40 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition-all duration-300 active:scale-95 flex flex-wrap items-center gap-1 uppercase tracking-widest"><Icon name="edit" className="text-[16px]" /><span className="hidden sm:inline">Edit</span></button>
                                            <button onClick={() => { 
                                                if (t.type === 'Pemasukan') setBalance(prev => prev - t.amount); 
                                                else setBalance(prev => prev + t.amount);
                                                if (t.category === 'Mutasi Jimpitan') setJimpitanBalance(prev => prev + t.amount);
                                                setTransactions(transactions.filter(x => x.id !== t.id)); 
                                            }} className="text-google-red bg-white hover:bg-google-redLight border-2 border-slate-200 hover:border-google-red/40 rounded-full px-3 py-1.5 text-[11px] font-extrabold transition-all duration-300 active:scale-95 flex flex-wrap items-center gap-1 uppercase tracking-widest"><Icon name="delete" className="text-[16px]" /><span className="hidden sm:inline">Hapus</span></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {transactions.length === 0 && <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border-2 border-slate-200"><Icon name="receipt_long" className="text-[48px] text-slate-400" /></div><h3 className="font-extrabold text-[22px] text-google-text mb-2 tracking-tight">Belum Ada Transaksi</h3><p className="text-google-textVariant font-medium text-[15px]">Buku kas masih dalam keadaan kosong.</p></div>}
                    </div>

                    {isModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-sm text-left shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                <div className={`mb-6 w-20 h-20 rounded-full flex items-center justify-center border-2 ${formData.type === 'Pemasukan' ? 'bg-google-greenLight text-google-green border-google-green/30' : 'bg-google-redLight text-google-red border-google-red/30'}`}><Icon name={formData.type === 'Pemasukan' ? 'arrow_downward' : 'arrow_upward'} className="text-[36px]" fill="true" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-6 tracking-tight">{editingId ? 'Edit' : 'Catat'} {formData.type}</h3>
                                <div className="space-y-5">
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Tanggal Transaksi</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className={`w-full bg-slate-50 border-2 border-slate-200 p-4 text-[15px] font-bold outline-none rounded-[16px] transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} /></div>
                                    <div>
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={`w-full bg-slate-50 border-2 border-slate-200 p-4 text-[15px] font-bold outline-none rounded-[16px] transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md cursor-pointer ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`}>
                                            {formData.type === 'Pengeluaran' ? <><option>Belanja Barang/Alat</option><option>Honor Jasa</option><option>Konsumsi</option><option>Bantuan Sosial</option><option>Lain-lain</option></> : <><option>Iuran Opsional</option><option>Donasi</option><option>Pemasukan Jasa</option><option>Lain-lain</option></>}
                                        </select>
                                    </div>
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Keterangan / Uraian</label><input type="text" value={formData.description} onChange={e => {setFormData({...formData, description: e.target.value}); setErrorMsg('');}} className={`w-full bg-slate-50 border-2 border-slate-200 p-4 text-[15px] font-bold outline-none rounded-[16px] transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md placeholder:text-slate-400 ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} placeholder="Misal: Beli Sapu Lidi" /></div>
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal (Rp)</label><input type="number" min="0" value={formData.amount} onChange={e => {setFormData({...formData, amount: safeNumber(e.target.value)}); setErrorMsg('');}} className={`w-full bg-slate-50 border-2 border-slate-200 p-4 text-[15px] font-bold outline-none rounded-[16px] transition-colors duration-300 text-google-text focus:bg-white focus:shadow-md placeholder:text-slate-400 ${formData.type === 'Pemasukan' ? 'focus:border-google-green' : 'focus:border-google-red'}`} placeholder="0" /></div>
                                    
                                    {formData.type === 'Pengeluaran' && (
                                        <div>
                                            <label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Upload Bukti / Nota (Opsional)</label>
                                            <div className={`flex items-center gap-4 bg-slate-50 border-2 ${isUploading ? 'border-google-red shadow-md' : 'border-slate-200'} p-3 rounded-[16px] relative overflow-hidden focus-within:border-google-red transition-all`}>
                                                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                                <div className="bg-white w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 shadow-sm border border-slate-100 text-google-textVariant relative z-0">
                                                    {isUploading ? <div className="w-5 h-5 border-2 border-google-red border-t-transparent rounded-full animate-spin"></div> : <Icon name="receipt" className="text-[24px]" />}
                                                </div>
                                                <div className="relative z-0 flex-1 min-w-0">
                                                    <p className="font-extrabold text-[14px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.receiptUrl ? "Nota Siap" : "Pilih File Nota")}</p>
                                                    <p className="text-[11px] text-google-textVariant truncate">{formData.receiptUrl ? "Klik untuk mengganti nota" : "Maksimal 2MB"}</p>
                                                </div>
                                                {formData.receiptUrl && !isUploading && (
                                                    <div className="relative z-20 shrink-0 w-12 h-12 rounded-[12px] overflow-hidden border border-slate-200 group">
                                                        <img src={formData.receiptUrl} alt="Nota Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-bold text-[13px] px-4 py-3.5 rounded-[16px] mt-6 flex flex-wrap items-center gap-2"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                                <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t-2 border-slate-100">
                                    <button onClick={() => { setIsModalOpen(false); setErrorMsg(''); setIsUploading(false); setEditingId(null); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className={`flex-1 text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 shadow-md hover:shadow-lg active:scale-95 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 ${formData.type === 'Pemasukan' ? 'bg-google-green border-google-greenDark hover:bg-google-greenDark' : 'bg-google-red border-google-redDark hover:bg-google-redDark'}`}>Simpan Data</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isTransferModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border-2 border-google-yellow/30"><Icon name="move_to_inbox" className="text-[48px] text-google-yellowDark" fill="true" /></div>
                                <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Pencairan Jimpitan</h3>
                                <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Tarik dana dari kas Jimpitan Fisik ke Kas Utama RT.</p>
                                
                                <div className="bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[24px] mb-8 border-2 border-slate-200 shadow-sm"><p className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest mb-2">Saldo Jimpitan Saat Ini</p><p className="text-[28px] font-extrabold text-google-text tracking-tight">{formatRp(jimpitanBalance)}</p></div>
                                
                                <div className="text-left mb-8"><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Nominal Disetor (Rp)</label><input type="number" min="0" value={transferAmount} onChange={e => {setTransferAmount(safeNumber(e.target.value)); setErrorMsg('');}} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[18px] font-bold outline-none rounded-[16px] transition-all duration-300 text-google-text placeholder:text-slate-400" placeholder="0" /></div>
                                
                                {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-bold text-[13px] px-4 py-3.5 rounded-[16px] mb-8 flex flex-wrap items-center gap-2 text-left"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                                
                                <div className="flex flex-wrap gap-3 pt-2">
                                    <button onClick={() => { setIsTransferModalOpen(false); setErrorMsg(''); }} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button>
                                    <button onClick={handleTransferJimpitan} className="flex flex-wrap bg-google-yellow text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] shadow-md hover:shadow-lg hover:bg-google-yellowDark border-2 border-google-yellowDark active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2">Mutasi Dana</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        function Pertemuan({ members, setMembers, currentRound, setCurrentRound, jimpitanBalance, setJimpitanBalance, setMeetingHistory, onFinish, nominalArisan, nominalJimpitan, arisanPeriod, setArisanPeriod, identity, cycleNumber }) {
            const [step, setStep] = useState(1);
            const [showHolidayModal, setShowHolidayModal] = useState(false);
            const [meetingDate, setMeetingDate] = useState(getLocalDate());
            const arisanMembers = useMemo(() => members.filter(m => m.program !== 'IuranOnly'), [members]);
            
            const eligibleWinners = useMemo(() => arisanMembers.filter(m => !m.hasWon && !isNonaktif(m)), [arisanMembers]);
            const isCycleAlreadyComplete = arisanMembers.length > 0 && eligibleWinners.length === 0;

            const [attendance, setAttendance] = useState(() => {
                const init = {}; arisanMembers.forEach(m => init[m.id] = { status: 'Hadir', payDebt: false }); return init;
            });
            
            // FIX: Sinkronisasi attendance jika ada warga baru yang ditambahkan saat form Pertemuan terbuka
            useEffect(() => {
                setAttendance(prev => {
                    const updated = { ...prev };
                    arisanMembers.forEach(m => {
                        if (!updated[m.id]) {
                            updated[m.id] = { status: 'Hadir', payDebt: false };
                        }
                    });
                    return updated;
                });
            }, [arisanMembers]);

            const [isScannerOpen, setIsScannerOpen] = useState(false);
            const [scannedMembers, setScannedMembers] = useState([]);
            const [cashReceived, setCashReceived] = useState('');
            const [cashierStatus, setCashierStatus] = useState('Hadir');
            const [showCashierModal, setShowCashierModal] = useState(false);
            const scannerRef = useRef(null);
            
            const scannedMembersRef = useRef(scannedMembers);
            useEffect(() => { scannedMembersRef.current = scannedMembers; }, [scannedMembers]);

            useEffect(() => {
                if (isScannerOpen) {
                    if (!scannerRef.current) {
                        import('html5-qrcode').then((module) => {
                            const Html5QrcodeScanner = module.Html5QrcodeScanner;
                        scannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 150} }, false);
                        scannerRef.current.render((decodedText) => {
                            const memberIdStr = decodedText.replace('M-', '');
                            const m = arisanMembers.find(x => x.id.toString() === memberIdStr);
                            if (m) {
                                if (!scannedMembersRef.current.some(x => x.id === m.id)) {
                                    setScannedMembers(prev => [...prev, m]);
                                    showToast(`${m.name} masuk keranjang!`);
                                }
                            } else {
                                showToast('Warga tidak ditemukan!');
                            }
                        }, (error) => {});
                        });
                    }
                } else {
                    if (scannerRef.current) {
                        scannerRef.current.clear().catch(e => console.error(e));
                        scannerRef.current = null;
                    }
                }
                return () => {
                    if (scannerRef.current) {
                        scannerRef.current.clear().catch(e => console.error(e));
                        scannerRef.current = null;
                    }
                };
            }, [isScannerOpen, arisanMembers]);
            
            const handleOpenCashier = () => {
                if (scannedMembers.length === 0) return;
                setIsScannerOpen(false);
                setShowCashierModal(true);
                setCashReceived('');
                setCashierStatus('Hadir');
            };

            const handleCashierSave = () => {
                if (scannedMembers.length === 0) return;
                
                let totalTagihanGabungan = 0;
                scannedMembers.forEach(m => {
                    const tagihanBulanIni = (m.program === 'IuranOnly' ? 0 : nominalArisan) + nominalJimpitan;
                    totalTagihanGabungan += tagihanBulanIni + (m.debt || 0);
                });
                
                const received = safeNumber(cashReceived);
                const isPaidFull = received >= totalTagihanGabungan;

                setAttendance(prev => {
                    const updated = { ...prev };
                    scannedMembers.forEach(m => {
                        updated[m.id] = {
                            status: cashierStatus,
                            payDebt: (cashierStatus === 'Hadir' && isPaidFull && m.debt > 0)
                        };
                    });
                    return updated;
                });

                showToast(`Presensi ${scannedMembers.length} warga disimpan!`);
                setShowCashierModal(false);
                setScannedMembers([]);
                
                setTimeout(() => setIsScannerOpen(true), 300);
            };
            const [selectedWinnerId, setSelectedWinnerId] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            
            const calculations = useMemo(() => {
                let kasArisanTerkumpul = 0, kasJimpitanTerkumpul = 0, talanganJimpitan = 0, pelunasanTunggakan = 0, tunggakanBaru = 0;
                arisanMembers.forEach(m => {
                    const att = attendance[m.id];
                    if (!att) return; // guard: warga belum ada di attendance (ditambah setelah form buka)
                    if (isNonaktif(m)) { if (att.status === 'Hadir') kasJimpitanTerkumpul += nominalJimpitan; return; } // Nonaktif/Meninggal: hanya jimpitan
                    if (att.status === 'Hadir') { kasArisanTerkumpul += nominalArisan; kasJimpitanTerkumpul += nominalJimpitan; if (m.debt > 0 && att.payDebt) pelunasanTunggakan += m.debt; } 
                    else if (att.status === 'Alfa' || att.status === 'Musibah') { talanganJimpitan += nominalArisan; kasArisanTerkumpul += nominalArisan; tunggakanBaru += (nominalArisan + nominalJimpitan); }
                });
                // LOGIKA ARISAN: Pemenang tidak membayar ke dirinya sendiri.
                // Kurangi nominalArisan pemenang dari total yang diserahkan, KECUALI
                // pemenang tidak hadir (sudah tidak terhitung di kasArisanTerkumpul via Hadir).
                const winnerMember = selectedWinnerId ? arisanMembers.find(m => m.id === Number(selectedWinnerId)) : null;
                const winnerAtt = winnerMember ? attendance[winnerMember.id] : null;
                const winnerIsPresent = winnerAtt && winnerAtt.status === 'Hadir' && !isNonaktif(winnerMember);
                if (!isCycleAlreadyComplete && winnerIsPresent) {
                    kasArisanTerkumpul -= nominalArisan;
                }
                return { kasArisanTerkumpul, kasJimpitanTerkumpul, talanganJimpitan, pelunasanTunggakan, tunggakanBaru };
            }, [arisanMembers, attendance, nominalArisan, nominalJimpitan, selectedWinnerId, isCycleAlreadyComplete]);

            const currentTotalDebt = useMemo(() => members.reduce((sum, m) => sum + (m.debt || 0), 0), [members]);
            const deltaJimpitan = calculations.kasJimpitanTerkumpul + calculations.pelunasanTunggakan - calculations.talanganJimpitan;
            const projectedJimpitanCash = jimpitanBalance + deltaJimpitan;
            const projectedTotalDebt = currentTotalDebt + calculations.tunggakanBaru - calculations.pelunasanTunggakan;

            const handleAttendanceChange = (id, status) => setAttendance(prev => ({...prev, [id]: { ...prev[id], status }}));
            const togglePayDebt = (id) => setAttendance(prev => ({...prev, [id]: { ...prev[id], payDebt: !prev[id].payDebt }}));

            const submitPertemuan = () => {
                if (!isCycleAlreadyComplete && !selectedWinnerId) return setErrorMsg("Pilih pemenang arisan terlebih dahulu!");
                
                setJimpitanBalance(prev => prev + deltaJimpitan); // FIX KRITIS-3: functional update untuk hindari race condition
                let winnerName = "", absensiDetails = [];
                const updatedMembers = members.map(m => {
                    if (m.program === 'IuranOnly') return m;
                    let updatedM = { ...m };
                    const att = attendance[m.id];
                    // Guard: jika warga arisan tidak ada di attendance (baru ditambah setelah form dibuka)
                    if (!att) { absensiDetails.push({ name: m.name, status: 'Hadir' }); return updatedM; }
                    if (!isCycleAlreadyComplete && m.id === Number(selectedWinnerId)) { 
                        updatedM.hasWon = true; updatedM.wonRound = currentRound; winnerName = m.name; 
                    }
                    // FIX CELAH-1: Guard Meninggal SEBELUM push absensiDetails
                    // Warga Meninggal dicatat dengan status khusus 'Meninggal', bebas dari arisan
                    if (isNonaktif(m)) {
                        absensiDetails.push({ name: m.name, status: m.status });
                        return updatedM;
                    } // Nonaktif/Meninggal: catat status asli, bebas arisan
                    absensiDetails.push({ name: m.name, status: att.status });
                    if (att.status === 'Hadir') { updatedM.redRecord = false; if (att.payDebt) updatedM.debt = 0; } 
                    else if (att.status === 'Alfa') { updatedM.debt = (updatedM.debt || 0) + (nominalArisan + nominalJimpitan); updatedM.redRecord = true; } 
                    // Musibah = halangan valid (sakit/musibah), punya tunggakan tapi TIDAK masuk rapor merah
                    else if (att.status === 'Musibah') { updatedM.debt = (updatedM.debt || 0) + (nominalArisan + nominalJimpitan); }
                    return updatedM;
                });
                
                if(isCycleAlreadyComplete) { winnerName = "G SIKLUS SELESAI (TIDAK ADA UNDIAN)"; }

                const formattedDate = parseLocalDate(meetingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

                setMembers(updatedMembers);
                setMeetingHistory(prev => [{ id: Date.now(), round: currentRound, periode: formatBulanTahun(arisanPeriod), date: formattedDate, winner: winnerName, kasArisanTerkumpul: calculations.kasArisanTerkumpul, kasJimpitanMasuk: calculations.kasJimpitanTerkumpul, pelunasanTunggakan: calculations.pelunasanTunggakan, talanganJimpitan: calculations.talanganJimpitan, tunggakanBaru: calculations.tunggakanBaru, saldoAkhirJimpitan: projectedJimpitanCash, totalTunggakanAkhir: projectedTotalDebt, absensiDetails }, ...prev]);
                setCurrentRound(prev => prev + 1);
                const [year, month] = arisanPeriod.split('-'); let d = new Date(year, month - 1); d.setMonth(d.getMonth() + 1);
                setArisanPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                onFinish();
                showToast('Absensi & hasil arisan berhasil disimpan.');
            };

            const handleSetHoliday = () => {
                const totalDebtSnapshot = members.reduce((sum, m) => sum + (m.debt || 0), 0);
                const formattedDate = parseLocalDate(meetingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                
                setMeetingHistory(prev => [{ id: Date.now(), round: currentRound, periode: formatBulanTahun(arisanPeriod), date: formattedDate, winner: '=n+ LIBUR (TIDAK ADA ARISAN)', kasArisanTerkumpul: 0, kasJimpitanMasuk: 0, pelunasanTunggakan: 0, talanganJimpitan: 0, tunggakanBaru: 0, saldoAkhirJimpitan: jimpitanBalance, totalTunggakanAkhir: totalDebtSnapshot, absensiDetails: [] }, ...prev]);
                
                const [year, month] = arisanPeriod.split('-'); let d = new Date(year, month - 1); d.setMonth(d.getMonth() + 1);
                setArisanPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                
                setShowHolidayModal(false);
                onFinish();
                showToast('Bulan ini ditandai libur, periode lanjut otomatis.');
            };

            return (
                <div className="bg-white rounded-[32px] overflow-hidden max-w-5xl mx-auto border-2 border-slate-200 shadow-xl">
                    <div className="bg-slate-50 px-8 py-6 flex items-center justify-between no-print border-b border-slate-200 relative">
                        {[1, 2, 3].map(num => (<div key={num} className="flex flex-col items-center relative z-10"><div className={`w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-[18px] border-2 transition-all duration-500 ${step >= num ? 'bg-google-blue text-white border-google-blueDark shadow-md scale-110' : 'bg-white text-slate-400 border-slate-300'}`}>{num}</div></div>))}
                        <div className="absolute left-16 right-16 h-2 bg-slate-200 top-[45px] z-0 rounded-full overflow-hidden"><div className="h-full bg-google-blue transition-all duration-700 ease-in-out" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div></div>
                    </div>
                    <div className="p-5 sm:p-8 bg-white">
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-8 no-print border-b-2 border-slate-100 pb-8">
                                    <div className="flex flex-col w-full lg:w-auto">
                                        <h3 className="text-3xl font-extrabold text-google-text tracking-tight">Sesi Presensi Arisan</h3>
                                        <div className="flex flex-wrap items-center gap-3 mt-4 bg-slate-50 px-5 py-3.5 rounded-[16px] border-2 border-slate-200 w-full sm:w-fit focus-within:border-google-blue focus-within:bg-white focus-within:shadow-md transition-all">
                                            <Icon name="edit_calendar" className="text-[20px] text-google-blue shrink-0" />
                                            <label className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest shrink-0 mr-1">Tgl Pelaksanaan:</label>
                                            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="bg-transparent border-none text-[15px] font-bold outline-none text-google-blueDark cursor-pointer w-full" />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                                        <button onClick={() => setIsScannerOpen(true)} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold flex flex-wrap items-center justify-center gap-2 text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all duration-300"><Icon name="qr_code_scanner" className="text-[20px]" /><span>Kasir Scan</span></button>
                                        <button onClick={() => setShowHolidayModal(true)} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-white text-google-yellowDark px-6 py-3.5 rounded-full font-extrabold flex flex-wrap items-center justify-center gap-2 text-[14px] border-2 border-google-yellow hover:bg-google-yellowLight hover:shadow-md active:scale-95 transition-all duration-300"><Icon name="event_busy" className="text-[20px]" /><span>Bulan Libur</span></button>
                                        <button onClick={() => window.print()} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold flex flex-wrap items-center justify-center gap-2 text-[14px] border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-95 transition-all duration-300"><Icon name="print" className="text-[20px]" /><span>Cetak Blanko Absen</span></button>
                                    </div>
                                </div>
                                <div className="hidden print-only">
                                    <div className="kop-surat"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || 'Aplikasi Arisan'}</h1></div>
                                    <div className="text-center mb-6"><h2 className="text-[14pt] font-bold underline uppercase mb-1">Daftar Hadir Pertemuan Arisan</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber || 1} | Putaran Ke-{currentRound} | Periode: {formatBulanTahun(arisanPeriod)}</p></div>
                                    <table className="print-table">
                                        <thead><tr><th width="5%">No</th><th width="35%">Nama Warga</th><th width="20%">Status Arisan</th><th width="20%">Tunggakan Sebelumnya</th><th width="20%">Tanda Tangan</th></tr></thead>
                                        <tbody>
                                            {arisanMembers.length === 0 ? <tr><td colSpan="5" className="text-center font-bold">Belum ada data warga.</td></tr> : arisanMembers.map((m, idx) => (
                                                <tr key={m.id}><td className="text-center font-bold">{idx + 1}</td><td className="font-bold">{m.name}</td><td className="text-center font-bold">{m.hasWon ? `Menang (Put.${m.wonRound})` : 'Belum'}</td><td className="text-right font-bold">{m.debt > 0 ? formatRp(m.debt) : '-'}</td><td></td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 no-print">
                                    {arisanMembers.map(member => {
                                        const isMeninggal = isNonaktif(member); // Meninggal ATAU Nonaktif/Pindah
                                        const attStatus = isMeninggal ? 'Meninggal' : (attendance[member.id]?.status || 'Hadir');
                                        return (
                                        <div key={member.id} className={`border-2 rounded-[24px] p-6 flex flex-col gap-4 transition-all duration-300 ${isMeninggal ? 'bg-slate-100 border-slate-300 opacity-75' : attStatus === 'Hadir' ? 'bg-white border-slate-200 hover:border-google-blue/50 hover:shadow-xl hover:-translate-y-1 shadow-sm' : attStatus === 'Musibah' ? 'bg-google-yellowLight/50 border-google-yellow shadow-md' : 'bg-google-redLight/50 border-google-red shadow-md'}`}>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex flex-wrap items-center gap-4 min-w-0">
                                                    <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center font-extrabold text-[20px] shrink-0 border-2 transition-colors ${isMeninggal ? 'bg-slate-200 text-slate-400 border-slate-300' : attStatus === 'Hadir' ? 'bg-slate-50 text-google-text border-slate-200' : attStatus === 'Musibah' ? 'bg-google-yellow text-white border-google-yellowDark' : 'bg-google-red text-white border-google-redDark'}`}>{member.name.charAt(0).toUpperCase()}</div>
                                                    <div className="min-w-0">
                                                        <h3 className={`font-extrabold text-[16px] truncate tracking-tight ${isMeninggal ? 'text-slate-400 line-through' : 'text-google-text'}`}>{member.name}</h3>
                                                        {isMeninggal
                                                            ? <span className="text-[10px] text-slate-500 font-extrabold border border-slate-300 px-2.5 py-1 rounded-md bg-slate-200 mt-1.5 inline-flex items-center gap-1 uppercase tracking-widest"><Icon name="sentiment_very_dissatisfied" className="text-[13px]" /> Wafat / Nonaktif</span>
                                                            : member.debt > 0
                                                                ? <span className="text-[11px] bg-google-redLight text-google-redDark px-3 py-1.5 rounded-md font-extrabold inline-flex items-center gap-1.5 mt-1.5 border border-google-red/40 uppercase tracking-wider"><Icon name="warning" className="text-[14px]"/> Hutang {formatRp(member.debt)}</span>
                                                                : <span className="text-[11px] bg-google-greenLight text-google-greenDark font-extrabold px-3 py-1.5 rounded-md mt-1.5 inline-flex items-center gap-1.5 border border-google-green/40 uppercase tracking-wider"><Icon name="check_circle" className="text-[14px]"/> Bersih</span>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            {isMeninggal ? (
                                                <div className="flex flex-col gap-2.5">
                                                    {/* Info banner: bebas arisan, wajib jimpitan */}
                                                    <div className="flex flex-wrap items-center gap-3 bg-slate-200 border border-slate-300 rounded-[14px] px-4 py-3">
                                                        <Icon name="do_not_disturb_on" className="text-[22px] text-slate-500 shrink-0" />
                                                        <div>
                                                            <p className="text-[12px] font-extrabold text-slate-600 uppercase tracking-widest leading-tight">Bebas Iuran Arisan</p>
                                                            <p className="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">Anggota wafat tidak dikenakan setoran arisan</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 bg-google-blueLight border border-google-blue/30 rounded-[14px] px-4 py-3">
                                                        <Icon name="volunteer_activism" className="text-[22px] text-google-blue shrink-0" fill="true" />
                                                        <div>
                                                            <p className="text-[12px] font-extrabold text-google-blueDark uppercase tracking-widest leading-tight">Wajib Jimpitan</p>
                                                            <p className="text-[11px] font-semibold text-google-blue leading-tight mt-0.5">{formatRp(nominalJimpitan)} per pertemuan tetap berjalan</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap rounded-[16px] bg-slate-100 p-2 gap-2 border border-slate-200 inset-shadow-sm">
                                                    {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                        <button key={stat} onClick={() => handleAttendanceChange(member.id, stat)} className={`flex-1 py-3 text-[12px] font-extrabold uppercase tracking-widest rounded-xl transition-all duration-300 border-2 ${attendance[member.id].status === stat ? (stat === 'Hadir' ? 'bg-google-green text-white border-google-greenDark shadow-md scale-105' : stat === 'Musibah' ? 'bg-google-yellow text-white border-google-yellowDark shadow-md scale-105' : 'bg-google-red text-white border-google-redDark shadow-md scale-105') : 'bg-transparent text-google-textVariant border-transparent hover:bg-slate-200/50'}`}>{stat}</button>
                                                    ))}
                                                </div>
                                            )}
                                            {attendance[member.id]?.status === 'Hadir' && member.debt > 0 && !isMeninggal && (
                                                <label className="flex items-center justify-between bg-google-blueLight px-5 py-4 rounded-[16px] cursor-pointer border border-google-blue/30 shadow-sm hover:bg-google-blue/20 transition-colors group mt-2">
                                                    <div><span className="text-[14px] font-extrabold text-google-blueDark block mb-0.5">Lunasi Tunggakan?</span><span className="text-[12px] font-bold text-google-blue">Centang potong saldo</span></div>
                                                    <div className="relative flex items-center justify-center"><input type="checkbox" checked={attendance[member.id].payDebt} onChange={() => togglePayDebt(member.id)} className="peer appearance-none w-7 h-7 border-2 border-google-blue/50 rounded-lg checked:bg-google-blue checked:border-google-blue transition-colors cursor-pointer" /><Icon name="check" className="absolute text-white text-[18px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth="4"/></div>
                                                </label>
                                            )}
                                        </div>
                                        );
                                    })}

                                    {arisanMembers.length === 0 && <div className="col-span-full bg-slate-50 border-2 border-slate-200 p-12 text-center rounded-[32px] shadow-sm"><Icon name="group_off" className="text-[48px] text-slate-400 mb-4 mx-auto" fill="true" /><p className="font-extrabold text-[18px] text-google-text">Belum ada warga arisan terdaftar.</p></div>}
                                </div>
                                <div className="pt-8 flex justify-end no-print border-t-2 border-slate-100 mt-10"><button onClick={() => setStep(2)} className="bg-google-blue text-white px-10 py-4 rounded-full font-extrabold text-[15px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center gap-2">Lanjut Ke Rekapitulasi <Icon name="arrow_forward" className="text-[20px]"/></button></div>
                                
                                {showHolidayModal && (
                                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                                        <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center border-2 border-slate-200 shadow-2xl transform scale-100 transition-transform">
                                            <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border-2 border-google-yellow/30"><Icon name="event_busy" className="text-[48px] text-google-yellowDark" /></div>
                                            <h3 className="text-2xl font-extrabold text-google-text mb-2 tracking-tight">Liburkan Bulan Ini?</h3>
                                            <p className="text-[14px] font-medium text-google-textVariant mb-8 leading-relaxed">Periode <b className="text-google-text">{formatBulanTahun(arisanPeriod)}</b> akan ditandai sebagai bulan libur.</p>
                                            <div className="text-[13px] font-medium text-google-textVariant mb-8 space-y-3 bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[24px] border border-slate-200 text-left"><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[18px] text-google-blue shrink-0"/><span>Tidak ada penarikan kas/jimpitan sama sekali.</span></p><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[18px] text-google-blue shrink-0"/><span>Putaran ke-{currentRound} tidak akan dihitung.</span></p><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[18px] text-google-blue shrink-0"/><span>Periode akan melompat ke bulan berikutnya.</span></p></div>
                                            <div className="flex flex-wrap gap-3">
                                                <button onClick={() => setShowHolidayModal(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                                <button onClick={handleSetHoliday} className="flex-1 bg-google-yellow text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-yellowDark shadow-md hover:bg-google-yellowDark hover:shadow-lg active:scale-95 transition-all duration-300">Setuju, Libur</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {isScannerOpen && (
                                    <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col p-4 sm:p-6 no-print overflow-y-auto hide-scrollbar">
                                        <div className="flex justify-between items-center mb-6 shrink-0">
                                            <h3 className="text-white font-extrabold text-xl sm:text-2xl">Scan Barcode Warga</h3>
                                            <button onClick={() => setIsScannerOpen(false)} className="bg-white/20 text-white p-2 rounded-full hover:bg-white/40"><Icon name="close" className="text-[24px]" /></button>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center pt-2 pb-10">
                                            <div id="reader" className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl shrink-0"></div>
                                            
                                            {scannedMembers.length > 0 && (
                                                <div className="mt-6 w-full max-w-md bg-white rounded-[24px] p-5 shadow-2xl border-2 border-google-blue shrink-0">
                                                    <h4 className="font-extrabold text-google-text mb-3 text-[14px] uppercase tracking-widest">Keranjang Scan ({scannedMembers.length} Warga)</h4>
                                                    <div className="flex flex-wrap gap-2 mb-4 max-h-[150px] overflow-y-auto hide-scrollbar">
                                                        {scannedMembers.map(m => (
                                                            <span key={m.id} className="bg-google-blueLight text-google-blueDark px-3 py-1.5 rounded-full text-[13px] font-bold border border-google-blue/30">{m.name}</span>
                                                        ))}
                                                    </div>
                                                    <button onClick={handleOpenCashier} className="w-full bg-google-blue text-white py-3.5 rounded-xl font-extrabold flex items-center justify-center gap-2 hover:bg-google-blueDark transition-colors shadow-md">Proses Pembayaran <Icon name="arrow_forward" className="text-[18px]" /></button>
                                                </div>
                                            )}
                                            {scannedMembers.length === 0 && <p className="text-white/60 text-center font-medium mt-6 shrink-0">Arahkan kamera ke barcode warga untuk memindai.</p>}
                                        </div>
                                    </div>
                                )}
                                
                                {showCashierModal && scannedMembers.length > 0 && (
                                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print">
                                        <div className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border-2 border-slate-200 max-h-[95vh] flex flex-col">
                                            <h3 className="text-xl font-extrabold text-google-text mb-2 text-center">Kasir Pembayaran</h3>
                                            <div className="text-center mb-4">
                                                <p className="text-[14px] text-google-textVariant font-bold">{scannedMembers.length} Warga (Gandengan)</p>
                                                <p className="text-[14px] font-extrabold text-google-text truncate">{scannedMembers.map(m => m.name).join(', ')}</p>
                                            </div>
                                            
                                            <div className="overflow-y-auto hide-scrollbar flex-1 mb-4">
                                                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                                                    {(() => {
                                                        let totalTagihanBulanIni = 0;
                                                        let totalTunggakan = 0;
                                                        scannedMembers.forEach(m => {
                                                            totalTagihanBulanIni += (m.program === 'IuranOnly' ? 0 : nominalArisan) + nominalJimpitan;
                                                            totalTunggakan += (m.debt || 0);
                                                        });
                                                        const totalGabungan = totalTagihanBulanIni + totalTunggakan;
                                                        return (
                                                            <>
                                                                <div className="flex justify-between text-[14px] mb-1"><span className="text-google-textVariant font-bold">Total Tagihan Bulan Ini</span><span className="font-extrabold text-google-text">{formatRp(totalTagihanBulanIni)}</span></div>
                                                                {totalTunggakan > 0 && <div className="flex justify-between text-[14px] mb-1"><span className="text-google-red font-bold">Total Tunggakan</span><span className="font-extrabold text-google-red">{formatRp(totalTunggakan)}</span></div>}
                                                                <div className="border-t-2 border-slate-200 my-2"></div>
                                                                <div className="flex justify-between text-[16px]"><span className="font-extrabold text-google-text">Total Harus Dibayar</span><span className="font-extrabold text-google-blue">{formatRp(totalGabungan)}</span></div>
                                                            </>
                                                        )
                                                    })()}
                                                </div>

                                                <div className="mb-4 mt-4">
                                                    <label className="text-[11px] uppercase tracking-widest font-extrabold text-google-textVariant block mb-2">Status Kehadiran (Semua Warga)</label>
                                                    <div className="flex gap-2">
                                                        {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                            <button key={stat} onClick={() => setCashierStatus(stat)} className={`flex-1 py-2.5 text-[12px] font-extrabold uppercase tracking-widest rounded-xl border-2 transition-all ${cashierStatus === stat ? 'bg-google-blue text-white border-google-blueDark shadow-md' : 'bg-transparent text-google-textVariant border-slate-200 hover:bg-slate-50'}`}>{stat}</button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="text-[11px] uppercase tracking-widest font-extrabold text-google-textVariant block mb-2">Uang Diterima (Rp)</label>
                                                    <input type="number" min="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[18px] font-bold outline-none rounded-2xl text-google-text placeholder:text-slate-300 transition-all" placeholder="0" />
                                                </div>

                                                {(() => {
                                                    let totalGabungan = 0;
                                                    scannedMembers.forEach(m => {
                                                        totalGabungan += (m.program === 'IuranOnly' ? 0 : nominalArisan) + nominalJimpitan + (m.debt || 0);
                                                    });
                                                    const received = safeNumber(cashReceived);
                                                    const kembalian = received - totalGabungan;
                                                    return received > 0 ? (
                                                        <div className={`p-4 rounded-2xl border-2 shadow-sm ${kembalian >= 0 ? 'bg-google-greenLight border-google-green/40 text-google-greenDark' : 'bg-google-redLight border-google-red/40 text-google-redDark'}`}>
                                                            <p className="text-[11px] font-extrabold uppercase tracking-widest mb-1">{kembalian >= 0 ? 'Kembalian' : 'Status'}</p>
                                                            <p className="text-[20px] font-extrabold">{kembalian >= 0 ? formatRp(kembalian) : 'Uang Kurang!'}</p>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            <div className="flex gap-3 mt-auto shrink-0 pt-2 border-t-2 border-slate-100">
                                                <button onClick={() => { setShowCashierModal(false); setScannedMembers([]); setTimeout(() => setIsScannerOpen(true), 300); }} className="flex-1 bg-white border-2 border-slate-200 text-google-text font-extrabold py-3.5 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all text-[14px]">Batal</button>
                                                <button onClick={handleCashierSave} className="flex-1 bg-google-blue border-2 border-google-blueDark text-white font-extrabold py-3.5 rounded-full hover:bg-google-blueDark hover:shadow-md transition-all text-[14px] flex justify-center items-center gap-2"><Icon name="save" className="text-[18px]" />Simpan</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {step === 2 && (
                            <div className="space-y-6 no-print">
                                <h3 className="text-3xl font-extrabold text-google-text mb-2 tracking-tight">Rekapitulasi Sementara</h3>
                                <p className="text-[15px] font-medium text-google-textVariant mb-8">Periksa kembali rincian aliran dana sebelum mengundi pemenang.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-gradient-to-br from-google-greenLight to-green-50 border-2 border-google-green/40 rounded-[32px] p-8 sm:p-10 flex flex-col justify-center text-center shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                        <Icon name="payments" className="absolute -right-4 -bottom-4 text-[140px] text-google-green opacity-10 group-hover:scale-110 transition-transform duration-700" fill="true" />
                                        <div className="relative z-10">
                                            <p className="text-[12px] uppercase font-extrabold tracking-widest mb-3 text-google-greenDark">Arisan Diserahkan Ke Pemenang</p>
                                            <p className="text-4xl lg:text-5xl font-extrabold text-google-greenDark drop-shadow-sm tracking-tight">{formatRp(calculations.kasArisanTerkumpul)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 space-y-5 shadow-sm">
                                        <div className="flex justify-between text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="add_circle" className="text-[20px] text-google-green"/> Tunai Masuk</span><span className="text-google-greenDark font-extrabold">+{formatRp(calculations.kasJimpitanTerkumpul)}</span></div>
                                        <div className="flex justify-between text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="add_circle" className="text-[20px] text-google-green"/> Bayar Tunggakan</span><span className="text-google-greenDark font-extrabold">+{formatRp(calculations.pelunasanTunggakan)}</span></div>
                                        <div className="flex justify-between text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="remove_circle" className="text-[20px] text-google-red"/> Talangan (Keluar)</span><span className="text-google-redDark font-extrabold">-{formatRp(calculations.talanganJimpitan)}</span></div>
                                        <div className="flex justify-between text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="info" className="text-[20px] text-google-yellowDark"/> Tunggakan Baru</span><span className="text-google-redDark font-extrabold">+{formatRp(calculations.tunggakanBaru)}</span></div>
                                        <div className="w-full h-px bg-slate-200 my-5"></div>
                                        <div className="flex justify-between items-center font-extrabold text-[18px] bg-slate-50 p-5 sm:p-6 md:p-8 rounded-[20px] border border-slate-200 shadow-sm"><span className="text-[14px] uppercase tracking-widest text-google-textVariant">Saldo Tunai Berjalan</span><span className="text-[22px] text-google-blueDark tracking-tight">{formatRp(projectedJimpitanCash)}</span></div>
                                    </div>
                                </div>
                                <div className="pt-8 flex flex-col sm:flex-row justify-between border-t-2 border-slate-100 mt-10 gap-4">
                                    <button onClick={() => setStep(1)} className="w-full sm:w-auto bg-white text-google-text border-2 border-slate-200 px-8 py-4 rounded-full font-extrabold text-[15px] hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2 shadow-sm"><Icon name="arrow_back" className="text-[20px]"/> Kembali</button>
                                    <button onClick={() => setStep(3)} className="w-full sm:w-auto bg-google-blue text-white border-2 border-google-blueDark px-10 py-4 rounded-full font-extrabold text-[15px] shadow-md hover:bg-google-blueDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2">Lanjut Undi Pemenang <Icon name="celebration" className="text-[20px]"/></button>
                                </div>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-6 no-print">
                                <h3 className="text-3xl font-extrabold text-google-text mb-2 text-center tracking-tight">Tentukan Pemenang</h3>
                                <p className="text-[15px] font-medium text-google-textVariant mb-8 text-center">Pilih warga yang akan menerima dana arisan putaran ini.</p>
                                <div className="bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 rounded-[32px] p-8 sm:p-14 text-center shadow-lg relative overflow-hidden max-w-2xl mx-auto">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-google-yellow opacity-10 rounded-full blur-3xl"></div>
                                    <div className="absolute bottom-0 left-0 w-40 h-40 bg-google-blue opacity-10 rounded-full blur-3xl"></div>
                                    
                                    <div className="mb-8 relative z-10 animate-bounce" style={{ animationDuration: '2s' }}><Icon name="emoji_events" className="text-[100px] text-google-yellow drop-shadow-2xl" fill="true" /></div>
                                    
                                    {isCycleAlreadyComplete ? (
                                        <div className="text-center bg-google-greenLight text-google-greenDark p-4 sm:p-5 md:p-6 rounded-[24px] border-2 border-google-green max-w-sm mx-auto relative z-10 shadow-sm">
                                            <Icon name="verified" className="text-[40px] mb-3 mx-auto" fill="true" />
                                            <p className="font-extrabold text-[16px]">Semua warga sudah menang (Siklus Selesai).</p>
                                        </div>
                                    ) : (
                                        <div className="text-left bg-white rounded-[24px] p-4 sm:p-5 md:p-6 border-2 border-slate-200 focus-within:border-google-blue focus-within:shadow-lg transition-all max-w-sm mx-auto relative z-10 shadow-md">
                                            <label className="text-[11px] font-extrabold text-google-textVariant block mb-3 uppercase tracking-widest text-center">Pilih Warga Pemenang</label>
                                            <select className="w-full bg-slate-50 rounded-[16px] border-2 border-slate-200 text-[18px] font-extrabold outline-none px-5 py-3.5 text-google-blueDark cursor-pointer focus:bg-white transition-colors" value={selectedWinnerId} onChange={(e) => {setSelectedWinnerId(e.target.value); setErrorMsg('');}}>
                                                <option value="" disabled>-- Klik untuk memilih --</option>
                                                {eligibleWinners.map(m => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                                            </select>
                                        </div>
                                    )}
                                    {errorMsg && <div className="bg-google-redLight border-2 border-google-red/40 text-google-redDark font-bold text-[13px] px-5 py-4 rounded-[16px] mt-6 flex flex-wrap items-center justify-center gap-2 max-w-sm mx-auto relative z-10"><Icon name="error" className="text-[18px] shrink-0"/><span>{errorMsg}</span></div>}
                                </div>
                                <div className="pt-8 flex flex-col sm:flex-row justify-between border-t-2 border-slate-100 mt-10 gap-4">
                                    <button onClick={() => setStep(2)} className="w-full sm:w-auto bg-white text-google-text border-2 border-slate-200 px-8 py-4 rounded-full font-extrabold text-[15px] hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2 shadow-sm"><Icon name="arrow_back" className="text-[20px]"/> Kembali</button>
                                    <button onClick={submitPertemuan} className="w-full sm:w-auto bg-google-green text-white border-2 border-google-greenDark px-12 py-4 rounded-full font-extrabold text-[15px] shadow-md hover:bg-google-greenDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2"><Icon name="check_circle" className="text-[20px]"/> Selesai &amp; Simpan</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        function Laporan({ history, setMeetingHistory, members, setMembers, jimpitanBalance, setJimpitanBalance, nominalArisan, nominalJimpitan, cycleNumber, identity, userRole }) {
            const [filterMonth, setFilterMonth] = useState('Semua');
            const availableMonths = [...new Set(history.map(item => item.periode))];
            const displayedHistory = filterMonth === 'Semua' ? history : history.filter(item => item.periode === filterMonth);
const [editingHistoryId, setEditingHistoryId] = useState(null);
const [tempAttendance, setTempAttendance] = useState({});
const chartRef = useRef(null);
const canvasRef = useRef(null);

useEffect(() => {
if (!canvasRef.current || history.length === 0) return;
const chronological = [...history].reverse();
const labels = chronological.map(h => h.periode);
const dataPoints = chronological.map(h => h.saldoAkhirJimpitan || 0);

if (chartRef.current) chartRef.current.destroy();

import('chart.js/auto').then((module) => {
const Chart = module.default;
const ctx = canvasRef.current.getContext('2d');
chartRef.current = new Chart(ctx, {
type: 'line',
data: {
labels: labels,
datasets: [{
label: 'Saldo Jimpitan (Rp)',
data: dataPoints,
borderColor: '#1a73e8',
backgroundColor: 'rgba(26, 115, 232, 0.1)',
borderWidth: 3,
pointBackgroundColor: '#1a73e8',
pointBorderColor: '#fff',
pointBorderWidth: 2,
pointRadius: 5,
pointHoverRadius: 7,
fill: true,
tension: 0.4
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
plugins: { legend: { display: false } },
scales: {
y: {
beginAtZero: true,
ticks: { callback: function(value) { return 'Rp ' + (value/1000) + 'k'; } }
}
}
}
});

}); return () => { if (chartRef.current) chartRef.current.destroy(); };
}, [history]);

let growthStatus = null;
let growthAmount = 0;
if (history.length >= 2) {
const latest = history[0].saldoAkhirJimpitan || 0;
const previous = history[1].saldoAkhirJimpitan || 0;
growthAmount = latest - previous;
if (growthAmount > 0) growthStatus = 'tumbuh';
else if (growthAmount < 0) growthStatus = 'turun';
else growthStatus = 'stagnan';
} else if (history.length === 1) {
growthStatus = 'tumbuh';
growthAmount = history[0].saldoAkhirJimpitan || 0;
}

            const handleOpenEdit = (record) => { const attMap = {}; record.absensiDetails.forEach(a => { attMap[a.name] = a.status; }); setTempAttendance(attMap); setEditingHistoryId(record.id); };
            const handleAttendanceChange = (name, status) => { setTempAttendance(prev => ({ ...prev, [name]: status })); };

            const saveEditHistory = () => {
                const record = history.find(h => h.id === editingHistoryId);
                if (!record) return;
                let deltaGlobalJimpitan = 0, deltaRecordKasJimpitan = 0, deltaRecordTalangan = 0, deltaTunggakan = 0, deltaArisan = 0;
                const updatedMembers = [...members];
                // Cek apakah pemenang record ini berubah kehadirannya (affects kasArisanTerkumpul)
                const isWinnerRecord = (name) => record.winner && record.winner.includes(name);

                record.absensiDetails.forEach(oldAtt => {
                    const newStatus = tempAttendance[oldAtt.name];
                    if (!newStatus || oldAtt.status === newStatus) return; // tidak ada perubahan
                    // Cari berdasarkan nama (limitasi desain: nama harus unik)
                    const memberIndex = updatedMembers.findIndex(m => m.name === oldAtt.name);
                    if (memberIndex === -1) return;
                    // FIX CELAH-2: Warga Meninggal bebas dari arisan - skip perubahan debt/talangan
                    if (isNonaktif(updatedMembers[memberIndex])) return; // Nonaktif/Meninggal: bebas dari arisan
                    const member = { ...updatedMembers[memberIndex] };
                    const debtAmount = nominalArisan + nominalJimpitan;
                    
                    // Batalkan efek status lama
                    if (oldAtt.status === 'Hadir') {
                        deltaRecordKasJimpitan -= nominalJimpitan;
                        deltaGlobalJimpitan -= nominalJimpitan;
                    } else if (oldAtt.status === 'Alfa' || oldAtt.status === 'Musibah') {
                        deltaRecordTalangan -= nominalArisan;
                        deltaGlobalJimpitan += nominalArisan; // kembalikan talangan ke jimpitan
                        member.debt = Math.max(0, member.debt - debtAmount);
                        deltaTunggakan -= debtAmount;
                    }
                    
                    // Terapkan efek status baru
                    if (newStatus === 'Hadir') {
                        deltaRecordKasJimpitan += nominalJimpitan;
                        deltaGlobalJimpitan += nominalJimpitan;
                        // FIX: Jika ini pemenang, kasArisan berkurang karena pemenang hadir (tidak bayar ke diri sendiri)
                        if (isWinnerRecord(oldAtt.name)) deltaArisan -= nominalArisan;
                    } else if (newStatus === 'Alfa' || newStatus === 'Musibah') {
                        deltaRecordTalangan += nominalArisan;
                        deltaGlobalJimpitan -= nominalArisan;
                        member.debt += debtAmount;
                        deltaTunggakan += debtAmount;
                        // FIX: Jika ini pemenang tidak hadir, kasArisan bertambah (pemenang kini bayar)
                        if (isWinnerRecord(oldAtt.name)) deltaArisan += nominalArisan;
                    }
                    member.redRecord = member.debt > 0;
                    updatedMembers[memberIndex] = member;
                });
                
                setMembers(updatedMembers);
                setJimpitanBalance(prev => prev + deltaGlobalJimpitan);
                const updatedHistory = history.map(h => {
                    if (h.id === editingHistoryId) {
                        return {
                            ...h,
                            // FIX: Update kasArisanTerkumpul jika kehadiran pemenang berubah
                            kasArisanTerkumpul: Math.max(0, h.kasArisanTerkumpul + deltaArisan),
                            kasJimpitanMasuk: Math.max(0, h.kasJimpitanMasuk + deltaRecordKasJimpitan),
                            talanganJimpitan: Math.max(0, h.talanganJimpitan + deltaRecordTalangan),
                            tunggakanBaru: Math.max(0, (h.tunggakanBaru || 0) + deltaTunggakan),
                            totalTunggakanAkhir: Math.max(0, (h.totalTunggakanAkhir || 0) + deltaTunggakan),
                            // FIX KRITIS-4: Update saldoAkhirJimpitan di record sesuai delta global
                            saldoAkhirJimpitan: Math.max(0, (h.saldoAkhirJimpitan || 0) + deltaGlobalJimpitan),
                            absensiDetails: h.absensiDetails.map(a => ({ ...a, status: tempAttendance[a.name] || a.status }))
                        };
                    }
                    return h;
                });
                setMeetingHistory(updatedHistory); 
                setEditingHistoryId(null);
                showToast('Koreksi riwayat absensi berhasil disimpan.');
            };

            return (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 no-print shadow-sm">
                        <div><h2 className="text-2xl font-extrabold text-google-text tracking-tight">Riwayat Pertemuan Arisan</h2><p className="text-[14px] font-medium text-google-textVariant mt-1.5">Arsip resmi presensi dan sirkulasi dana bulanan.</p></div>
                        <button onClick={() => window.print()} className="bg-white border-2 border-slate-200 text-google-text px-8 py-3.5 rounded-full font-extrabold flex flex-wrap items-center gap-2 text-[14px] hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-95 transition-all duration-300 shadow-sm"><Icon name="print" className="text-[18px]" /><span>Cetak Arsip</span></button>
                    </div>

                    {history.length > 0 && (
<div className="no-print mb-8 bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm">
<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
<div>
<h3 className="text-xl font-extrabold text-google-text tracking-tight">Tren Saldo Jimpitan</h3>
<p className="text-[13px] font-medium text-google-textVariant mt-1">Pertumbuhan saldo tunai dari setiap pertemuan.</p>
</div>
{growthStatus && (
<div className={`px-4 py-2 rounded-[16px] flex items-center gap-3 border-2 ${
growthStatus === 'tumbuh' ? 'bg-google-greenLight border-google-green/40 text-google-greenDark' :
growthStatus === 'turun' ? 'bg-google-redLight border-google-red/40 text-google-redDark' :
'bg-slate-100 border-slate-300 text-slate-600'
}`}>
<Icon name={growthStatus === 'tumbuh' ? 'trending_up' : growthStatus === 'turun' ? 'trending_down' : 'trending_flat'} className="text-[28px]" />
<div className="flex flex-col">
<span className="text-[10px] uppercase font-extrabold tracking-widest">{growthStatus === 'tumbuh' ? 'Status: Tumbuh' : growthStatus === 'turun' ? 'Status: Menurun' : 'Status: Stagnan / Stack'}</span>
<span className="font-extrabold text-[15px] leading-tight">{growthStatus !== 'stagnan' ? (growthAmount > 0 ? '+' : '') + formatRp(Math.abs(growthAmount)) : 'Tidak ada pertumbuhan'}</span>
</div>
</div>
)}
</div>
<div className="w-full h-[250px] relative mb-6">
<canvas ref={canvasRef}></canvas>
</div>

<div className="max-w-xs bg-slate-50 rounded-[20px] px-6 py-4 border-2 border-slate-200 shadow-sm focus-within:border-google-blue focus-within:shadow-md transition-all">
<label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Filter Periode Arsip</label>
<select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full bg-transparent border-none text-[16px] outline-none text-google-blueDark font-extrabold cursor-pointer"><option value="Semua">Tampilkan Semua Bulan</option>{availableMonths.map((month, idx) => <option key={idx} value={month}>{month}</option>)}</select>
</div>
</div>
)}

                    <div className="hidden print-only">
                        <div className="kop-surat"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || ''}</h1><p>{identity?.subtitle || ''}</p></div>
                        <div className="text-center mb-6"><h2 className="text-[14pt] font-bold underline uppercase mb-1">Laporan Pertemuan &amp; Arisan</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber} {filterMonth !== 'Semua' ? `| Bulan: ${filterMonth}` : ''}</p></div>
                        {displayedHistory.length === 0 ? <p className="text-center italic font-bold">Belum ada arsip pada filter ini.</p> : displayedHistory.map((record, idx) => (
                            <div key={record.id} style={{ marginBottom: '30px', pageBreakInside: 'avoid' }}>
                                <h3 style={{ fontSize: '12pt', fontWeight: 'bold', borderBottom: '2px solid black', paddingBottom: '4px', marginBottom: '10px' }}>Putaran Ke-{record.round} ({record.periode})</h3>
                                <table className="print-table" style={{ marginTop: '0', marginBottom: '10px' }}>
                                    <tbody>
                                        <tr><td width="40%"><strong>Tanggal Pelaksanaan</strong></td><td>{record.date}</td></tr>
                                        <tr><td><strong>Pemenang Arisan</strong></td><td>{record.winner}</td></tr>
                                        <tr><td><strong>Arisan Terkumpul/Diserahkan</strong></td><td>{formatRp(record.kasArisanTerkumpul)}</td></tr>
                                        <tr><td><strong>Jimpitan Tunai Masuk</strong></td><td>{formatRp(record.kasJimpitanMasuk)}</td></tr>
                                        <tr><td><strong>Pelunasan Tunggakan Masuk</strong></td><td>{formatRp(record.pelunasanTunggakan)}</td></tr>
                                        <tr><td><strong>Talangan Arisan (Tunai Keluar)</strong></td><td>{formatRp(record.talanganJimpitan)}</td></tr>
                                        <tr><td><strong>Tunggakan Warga (Dicatat Baru)</strong></td><td>{formatRp(record.tunggakanBaru || 0)}</td></tr>
                                        <tr><td><strong>Saldo Tunai Jimpitan Berjalan</strong></td><td style={{fontSize: '12pt'}}><strong>{formatRp(record.saldoAkhirJimpitan)}</strong></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-6 no-print">
                        {displayedHistory.map((record) => {
                            const isHoliday = record.winner.includes('LIBUR');
                            return (
                                <div key={record.id} className="bg-white rounded-[32px] overflow-hidden border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-blue/30 transition-all duration-300">
                                    <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between sm:items-center border-b-2 border-slate-100 bg-slate-50">
                                        <div><h3 className="font-extrabold text-2xl text-google-text tracking-tight">Putaran Ke-{record.round}</h3><p className="text-[14px] font-bold text-google-textVariant mt-2 flex flex-wrap items-center gap-1.5"><Icon name="event" className="text-[18px]"/> {record.periode} G {record.date}</p></div>
                                        <div className="mt-5 sm:mt-0 flex flex-col sm:items-end"><span className="text-[11px] uppercase font-extrabold text-google-textVariant tracking-widest mb-2">{isHoliday ? 'Status Kegiatan' : 'Pemenang Arisan'}</span><div className={`${isHoliday ? 'bg-gradient-to-r from-google-yellow to-google-yellowDark text-white border-google-yellowDark' : 'bg-gradient-to-r from-google-blue to-google-blueDark text-white border-google-blueDark'} px-6 py-3 rounded-full font-extrabold text-[15px] shadow-md inline-flex items-center gap-2 border-2`}><Icon name={isHoliday ? "event_busy" : "emoji_events"} className="text-[20px]" fill="true" /> {record.winner}</div></div>
                                    </div>
                                    <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-gradient-to-br from-google-greenLight/50 to-green-50 border-2 border-google-green/30 rounded-[24px] p-8 flex flex-col justify-center text-center shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                                            <Icon name="payments" className="absolute -right-2 -bottom-2 text-[100px] text-google-green opacity-10 group-hover:scale-110 transition-transform duration-500" fill="true" />
                                            <p className="text-[11px] uppercase font-extrabold tracking-widest mb-3 text-google-greenDark relative z-10">Arisan Diserahkan</p>
                                            <p className="text-4xl font-extrabold text-google-green relative z-10 drop-shadow-sm tracking-tight">{formatRp(record.kasArisanTerkumpul)}</p>
                                        </div>
                                        <div className="space-y-4 bg-slate-50 p-6 sm:p-8 rounded-[24px] border-2 border-slate-200">
                                            <div className="flex justify-between items-center text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="add_circle" className="text-[18px] text-google-green"/> Jimpitan Masuk</span><span className="text-google-greenDark">+{formatRp(record.kasJimpitanMasuk)}</span></div>
                                            <div className="flex justify-between items-center text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="add_circle" className="text-[18px] text-google-green"/> Bayar Tunggakan</span><span className="text-google-greenDark">+{formatRp(record.pelunasanTunggakan)}</span></div>
                                            <div className="flex justify-between items-center text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="remove_circle" className="text-[18px] text-google-red"/> Talangan (Keluar)</span><span className="text-google-redDark">-{formatRp(record.talanganJimpitan)}</span></div>
                                            <div className="flex justify-between items-center text-[15px] font-bold"><span className="text-google-textVariant flex flex-wrap items-center gap-2"><Icon name="info" className="text-[18px] text-google-yellowDark"/> Tunggakan Baru</span><span className="text-google-redDark">+{formatRp(record.tunggakanBaru || 0)}</span></div>
                                            <div className="w-full h-px bg-slate-200 my-4"></div>
                                            <div className="flex justify-between items-center text-[18px] font-extrabold tracking-tight"><span>Saldo Tunai Berjalan</span><span className="text-google-blueDark">{formatRp(record.saldoAkhirJimpitan)}</span></div>
                                        </div>
                                    </div>
                                    {!isHoliday && (
                                        <div className="p-6 sm:p-8 border-t-2 border-slate-100 bg-white">
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                                <h4 className="font-extrabold text-[18px] text-google-text tracking-tight">Detail Presensi Warga</h4>
                                                {userRole === 'admin' && <button onClick={() => handleOpenEdit(record)} className="text-[13px] bg-white text-google-text font-extrabold px-6 py-3.5 rounded-full hover:bg-slate-50 hover:border-slate-300 no-print transition-all duration-300 active:scale-95 border-2 border-slate-200 flex flex-wrap items-center gap-2 shadow-sm"><Icon name="edit" className="text-[18px]" /> Revisi Data</button>}
                                            </div>
                                            <div className="flex flex-wrap gap-3 no-print text-[14px]">
                                                {record.absensiDetails.map((a, i) => {
                                                    const isHadir = a.status === 'Hadir'; const isAlfa = a.status === 'Alfa'; const isMeninggal = (a.status === 'Meninggal' || a.status === 'Nonaktif');
                                                    // FIX: Status Meninggal ditampilkan abu-abu (bebas arisan)
                                                    return <div key={i} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-[12px] border transition-colors ${isMeninggal ? 'bg-slate-100 border-slate-300' : isHadir ? 'bg-slate-50 border-slate-200' : isAlfa ? 'bg-google-redLight border-google-red/40' : 'bg-google-yellowLight border-google-yellow/40'}`}><div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isMeninggal ? 'bg-slate-400' : isHadir ? 'bg-google-green' : isAlfa ? 'bg-google-red' : 'bg-google-yellow'}`}></div><span className={`font-bold text-[14px] ${isMeninggal ? 'text-slate-400 line-through' : 'text-google-text'}`}>{a.name}{isMeninggal && <span className="text-[10px] ml-1.5 bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">{a.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</span></div>
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {displayedHistory.length === 0 && <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border-2 border-slate-200"><Icon name="history" className="text-[48px] text-slate-400" /></div><h3 className="font-extrabold text-[22px] text-google-text mb-2 tracking-tight">Belum Ada Riwayat</h3><p className="text-google-textVariant font-medium text-[15px]">Tidak ada catatan pertemuan untuk bulan yang dipilih.</p></div>}
                    </div>

                    {editingHistoryId && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
<div className="bg-white rounded-[32px] p-6 sm:p-8 w-full max-w-sm text-left max-h-[90vh] flex flex-col border-2 border-slate-200 shadow-2xl transform scale-100 transition-transform">
                                <h3 className="text-2xl font-extrabold text-google-text mb-1 shrink-0 tracking-tight">Revisi Kehadiran</h3><p className="text-[14px] font-medium text-google-textVariant mb-6 shrink-0 leading-relaxed">Saldo akan disesuaikan otomatis mengikuti perubahan presensi ini.</p>
                                <div className="overflow-y-auto space-y-4 flex-1 pb-4 pr-1 hide-scrollbar">
                                    {history.find(h => h.id === editingHistoryId)?.absensiDetails.map((member, idx) => (
                                        <div key={idx} className={`flex flex-col gap-3 border-2 p-5 rounded-[24px] shadow-sm ${isNonaktif(member) ? 'border-slate-200 bg-slate-100 opacity-60' : 'border-slate-200 bg-slate-50'}`}>
                                            <p className={`text-[16px] font-extrabold truncate tracking-tight ${isNonaktif(member) ? 'text-slate-400 line-through' : 'text-google-text'}`}>{member.name}{isNonaktif(member) && <span className="text-[10px] ml-2 bg-slate-300 text-slate-500 px-2 py-0.5 rounded font-extrabold uppercase tracking-wider no-underline">{member.status === 'Meninggal' ? 'Wafat' : 'Nonaktif'}</span>}</p>
                                            {/* FIX BONUS-B: Warga Meninggal tidak punya toggle - bebas dari arisan */}
                                            {isNonaktif(member) ? (
                                                <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-[14px] bg-slate-200 border-2 border-slate-300">
                                                    <Icon name="do_not_disturb" className="text-[18px] text-slate-400" />
                                                    <span className="text-[12px] font-extrabold text-slate-500 uppercase tracking-widest">Bebas Arisan - Jimpitan saja</span>
                                                </div>
                                            ) : (
                                            <div className="flex flex-wrap rounded-[16px] bg-slate-200/60 p-2 gap-2 border-2 border-slate-200 inset-shadow-sm">
                                                {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                    <button key={stat} onClick={() => handleAttendanceChange(member.name, stat)} className={`flex-1 py-2.5 text-[11px] uppercase tracking-widest font-extrabold rounded-xl transition-all duration-300 border-2 ${tempAttendance[member.name] === stat ? (stat === 'Hadir' ? 'bg-google-green text-white shadow-md border-google-greenDark scale-105' : stat === 'Musibah' ? 'bg-google-yellowDark text-white shadow-md border-google-yellowDark scale-105' : 'bg-google-red text-white shadow-md border-google-redDark scale-105') : 'text-google-textVariant bg-transparent hover:bg-white border-transparent'}`}>{stat}</button>
                                                ))}
                                            </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-3 pt-6 border-t-2 border-slate-100 mt-2 shrink-0"><button onClick={() => setEditingHistoryId(null)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-extrabold text-[14px] hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button><button onClick={saveEditHistory} className="flex-1 bg-google-blue text-white px-6 py-3.5 rounded-full font-extrabold text-[14px] border-2 border-google-blueDark shadow-md hover:bg-google-blueDark hover:shadow-lg active:scale-95 transition-all duration-300 flex items-center justify-center">Simpan Revisi</button></div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


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
                        <label className="flex items-center justify-between bg-slate-50 border-2 border-slate-200 rounded-[16px] px-5 py-4 cursor-pointer hover:bg-google-blueLight/20 hover:border-google-blue/40 transition-all duration-200">
                            <div>
                                <p className="text-[14px] font-extrabold text-google-text">Aktifkan Info Desa</p>
                                <p className="text-[12px] text-google-textVariant font-medium mt-0.5">Tampilkan bagian batas & kontak di Peta Desa</p>
                            </div>
                            <div className="relative">
                                <input type="checkbox" className="sr-only peer" checked={localInfo.enabled} onChange={e => setLocalInfo({...localInfo, enabled: e.target.checked})} />
                                <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-google-blue after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                            </div>
                        </label>

                        {localInfo.enabled && (
                            <>
                                {/* Batas Administrasi */}
                                <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-[20px]">
                                    <h4 className="font-extrabold text-[14px] text-google-text mb-4">Batas Administrasi</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                            <div key={arah} className="bg-white rounded-[12px] px-4 py-2 border-2 border-slate-200 focus-within:border-google-blue transition-all">
                                                <label className="text-[10px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">{arah}</label>
                                                <input type="text" value={localInfo.batas?.[arah] || ''} onChange={e => updateBatas(arah, e.target.value)} className="w-full bg-transparent border-none text-[13px] font-bold outline-none p-0 text-google-text" placeholder={`Batas ${arah}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Kontak Penting */}
                                <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-[20px]">
                                    <h4 className="font-extrabold text-[14px] text-google-text mb-4">Kontak Penting</h4>
                                    <div className="space-y-3 mb-4">
                                        {localInfo.kontak?.map((k, idx) => {
                                            const idKey = k.id || k.nama;
                                            return (
                                            <div key={idKey} className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-[12px] border-2 border-slate-200 relative group">
                                                <div className="flex-1">
                                                    <input type="text" value={k.nama} onChange={e => updateKontak(idKey, 'nama', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-bold outline-none focus:border-google-blue text-google-text mb-2" placeholder="Nama Layanan" />
                                                    <input type="text" value={k.telepon} onChange={e => updateKontak(idKey, 'telepon', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-[13px] font-bold outline-none focus:border-google-blue text-google-text" placeholder="Nomor Telepon" />
                                                </div>
                                                <button onClick={() => removeKontak(idKey)} className="self-end sm:self-center bg-red-50 text-red-600 p-2 rounded-[8px] hover:bg-red-100 transition-colors">
                                                    <Icon name="delete" className="text-[20px]" />
                                                </button>
                                            </div>
                                        )})}
                                    </div>
                                    <button onClick={addKontak} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-[12px] text-google-textVariant font-bold text-[13px] hover:bg-slate-100 hover:text-google-blue hover:border-google-blue transition-all flex items-center justify-center gap-2">
                                        <Icon name="add" className="text-[18px]" /> Tambah Kontak
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
            const uploadLogo = (file) => {
                if (!file) return;
                if (!file.type.match('image.*')) { showAlert('Gagal: File harus berupa gambar!'); return; }
                if (file.size > 5 * 1024 * 1024) { showAlert('Gagal: Ukuran gambar awal maksimal 5MB!'); return; }
                setIsUploading(true); setUploadError('');
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 400;
                        const MAX_HEIGHT = 400;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                        } else {
                            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedBase64 = canvas.toDataURL('image/webp', 0.8);
                        
                        setNewUrl(compressedBase64);
                        setPreviewUrl(compressedBase64);
                        setUploadError('');
                        setIsUploading(false);
                    };
                    img.onerror = () => {
                        setUploadError('Gagal memproses gambar.');
                        showAlert('Gagal memproses gambar logo.');
                        setIsUploading(false);
                    };
                    img.src = reader.result;
                };
                reader.onerror = () => {
                    setUploadError('Gagal membaca file.');
                    showAlert('Gagal membaca file logo.');
                    setIsUploading(false);
                };
                reader.readAsDataURL(file);
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
                <div className="space-y-4">
                <label className="flex items-center justify-between bg-slate-50 border-2 border-slate-200 rounded-[16px] px-5 py-4 cursor-pointer hover:bg-google-blueLight/20 hover:border-google-blue/40 transition-all duration-200">
                    <div>
                    <p className="text-[14px] font-extrabold text-google-text">Aktifkan Tampilan Sponsor</p>
                    <p className="text-[12px] text-google-textVariant font-medium mt-0.5">Tampilkan logo-logo sponsor di halaman utama</p>
                    </div>
                    <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={sponsorsData?.enabled || false} onChange={e => {
                        const checked = e.target.checked;
                        // Functional update agar enabled tidak hilang saat onSnapshot tiba
                        setSponsorsData(prev => ({ ...prev, enabled: checked }));
                    }} />
                    <div className="w-12 h-6 bg-slate-200 peer-checked:bg-google-blue rounded-full transition-colors peer"></div>
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-6 peer"></div>
                    </div>
                </label>

                {sponsorsData?.enabled && (
                    <div className="mt-2 p-4 border-2 border-slate-100 rounded-[16px] bg-slate-50 space-y-5">
                    <div>
                        <p className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest mb-3">Daftar Sponsor</p>
                        <div className="space-y-2">
                        {sponsorsData?.sponsors?.map((s, i) => (
                            <div key={i} className="flex items-center justify-between bg-white p-3 rounded-[12px] shadow-sm border border-slate-100 gap-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <img src={s.url} alt={s.name} className="h-9 w-16 object-contain shrink-0 rounded bg-slate-50 p-1 border border-slate-100" onError={e => { e.target.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>=+n+</text></svg>'; }} />
                                <span className="text-[13px] font-bold text-google-text truncate">{s.name}</span>
                            </div>
                            <button onClick={() => {
                                const idx = i;
                                // Functional update agar hapus tidak terkena stale closure
                                setSponsorsData(prev => {
                                    const ns = [...(prev?.sponsors || [])]; ns.splice(idx, 1);
                                    return { ...prev, sponsors: ns };
                                });
                            }} className="text-google-red hover:bg-red-50 p-2 rounded-full transition-colors shrink-0"><Icon name="delete" className="text-[20px]" /></button>
                            </div>
                        ))}
                        {(!sponsorsData?.sponsors || sponsorsData.sponsors.length === 0) && (
                            <p className="text-[12px] italic text-slate-400 text-center py-3">Belum ada sponsor. Tambahkan di bawah.</p>
                        )}
                        </div>
                    </div>

                    <div className="pt-4 border-t-2 border-slate-200 space-y-4">
                        <p className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest">Tambah Sponsor Baru</p>

                        <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm">
                        <label className="text-[10px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Nama Sponsor</label>
                        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Misal: Bank BRI Cabang Pakem" className="w-full bg-transparent text-[14px] font-bold text-google-text placeholder:text-slate-300 outline-none" />
                        </div>

                        <div>
                        <p className="text-[10px] font-extrabold text-google-textVariant uppercase tracking-widest mb-2">Logo / Gambar Sponsor</p>
                        <label className={`relative w-full h-16 bg-white border-2 ${isUploading ? 'border-google-blue bg-google-blueLight/20' : 'border-slate-200 hover:border-google-blue/50'} rounded-[14px] flex items-center justify-center px-4 cursor-pointer transition-all duration-200 overflow-hidden`}>
                            <input type="file" accept="image/*" onChange={e => uploadLogo(e.target.files[0])} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                            {isUploading ? (
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-5 h-5 border-2 border-google-blue border-t-transparent rounded-full animate-spin shrink-0"></div>
                                <span className="font-extrabold text-[13px] text-google-blue">Mengunggah logo...</span>
                            </div>
                            ) : (
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className="w-10 h-10 bg-google-blueLight rounded-[12px] flex items-center justify-center border border-google-blue/20 shrink-0">
                                <Icon name="add_photo_alternate" className="text-google-blue text-[20px]" />
                                </div>
                                <div>
                                <p className="font-extrabold text-[13px] text-google-text">{previewUrl ? 'Ganti Gambar Logo' : 'Pilih File Logo (Maks 2MB)'}</p>
                                <p className="text-[11px] text-google-textVariant font-medium">PNG, JPG, SVG, WEBP G upload ke Google Drive</p>
                                </div>
                            </div>
                            )}
                        </label>
                        {uploadError && <p className="text-[11px] text-google-red font-bold mt-2 px-1">{uploadError}</p>}
                        </div>

                        {/* Preview */}
                        {previewUrl && !isUploading && (
                        <div className="flex items-center gap-3 bg-white border-2 border-google-green/30 rounded-[14px] p-3 shadow-sm">
                            <img src={previewUrl} alt="preview" className="h-10 max-w-[80px] object-contain rounded border border-slate-100 bg-slate-50 p-1" onError={e => e.target.style.display='none'} />
                            <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-extrabold text-google-green flex items-center gap-1"><Icon name="check_circle" className="text-[15px]"/>Logo siap disimpan</p>
                            <p className="text-[10px] text-google-textVariant truncate font-mono mt-0.5">{previewUrl.slice(0,60)}</p>
                            </div>
                            <button onClick={() => { setNewUrl(''); setPreviewUrl(''); setUploadError(''); }} className="text-google-red hover:bg-red-50 p-1.5 rounded-full transition-colors shrink-0"><Icon name="close" className="text-[16px]" /></button>
                        </div>
                        )}

                        {/* Fallback URL manual */}
                        <details className="mt-1">
                        <summary className="text-[11px] font-bold text-google-textVariant cursor-pointer select-none hover:text-google-blue transition-colors flex items-center gap-1.5">
                            <Icon name="link" className="text-[14px]" /> Atau masukkan URL gambar secara manual
                        </summary>
                        <div className="mt-2 bg-white rounded-[14px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm">
                            <input type="text" value={newUrl} onChange={e => { setNewUrl(e.target.value); setPreviewUrl(e.target.value); }} placeholder="https://contoh.com/logo.png" className="w-full bg-transparent text-[13px] font-mono text-google-text placeholder:text-slate-300 outline-none" />
                        </div>
                        </details>
                    </div>

                    <button onClick={handleAdd} disabled={isUploading || !newName.trim() || !newUrl.trim()} className="w-full bg-google-blue border-2 border-google-blueDark text-white py-4 rounded-full font-extrabold text-[15px] hover:bg-google-blueDark active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                        <Icon name="add_circle" className="text-[20px]" />Tambah &amp; Simpan Sponsor
                    </button>
                    </div>
                )}
                </div>
            </PengaturanSection>
            );
        }


        function PengaturanSection({ title, onSave, children }) {
            return (
                <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                    <h3 className="font-extrabold text-[20px] text-google-text mb-6 border-b-2 border-slate-100 pb-4 group-hover:text-google-blue transition-colors tracking-tight">{title}</h3>
                    <div className="space-y-6 mb-8">{children}</div>
                    <button onClick={onSave} className="w-full bg-slate-50 border-2 border-slate-200 text-google-blueDark py-4 rounded-full font-extrabold text-[15px] hover:bg-google-blue hover:border-google-blue hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95">Simpan {title}</button>
                </div>
            );
        }

        function Pengaturan(props) {
            const { nominalArisan, setNominalArisan, nominalJimpitan, setNominalJimpitan, identity, setIdentity, setMembers, setMeetingHistory, currentRound, setCurrentRound, cycleNumber, setCycleNumber, jimpitanBalance, setJimpitanBalance, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions, arisanPeriod, setArisanPeriod, bannerImage, setBannerImage,
            // State tambahan untuk reset menyeluruh (diteruskan dari App)
            setIuranData, setGaleriData, setInventarisData, setInformasi, setNextMeeting, infoDesa, setInfoDesa, umkmData, setUmkmData } = props;
            
            const [formIdentity, setFormIdentity] = useState(identity);
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
                { id: 'profil', title: 'Profil Aplikasi', icon: 'badge', bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', hoverBorder: 'hover:border-blue-500', groupHoverBg: 'group-hover:bg-blue-500', groupHoverText: 'group-hover:text-blue-600', desc: 'Nama & Kop Surat Aplikasi' },
                { id: 'nominal', title: 'Iuran Wajib', icon: 'payments', bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200', hoverBorder: 'hover:border-emerald-500', groupHoverBg: 'group-hover:bg-emerald-500', groupHoverText: 'group-hover:text-emerald-600', desc: 'Besaran Arisan & Jimpitan' },
                { id: 'kalibrasi', title: 'Kalibrasi Siklus', icon: 'build', bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', hoverBorder: 'hover:border-orange-500', groupHoverBg: 'group-hover:bg-orange-500', groupHoverText: 'group-hover:text-orange-600', desc: 'Atur Putaran & Siklus' },
                { id: 'saldo', title: 'Koreksi Saldo', icon: 'account_balance_wallet', bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'border-indigo-200', hoverBorder: 'hover:border-indigo-500', groupHoverBg: 'group-hover:bg-indigo-500', groupHoverText: 'group-hover:text-indigo-600', desc: 'Edit Saldo Kas Utama' },
                { id: 'banner', title: 'Banner Utama', icon: 'image', bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200', hoverBorder: 'hover:border-purple-500', groupHoverBg: 'group-hover:bg-purple-500', groupHoverText: 'group-hover:text-purple-600', desc: 'Gambar Latar Halaman Depan' },
                { id: 'sponsor', title: 'Sponsor', icon: 'handshake', bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200', hoverBorder: 'hover:border-teal-500', groupHoverBg: 'group-hover:bg-teal-500', groupHoverText: 'group-hover:text-teal-600', desc: 'Logo Sponsor RT' },
                { id: 'legal', title: 'Kebijakan', icon: 'gavel', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', hoverBorder: 'hover:border-slate-500', groupHoverBg: 'group-hover:bg-slate-500', groupHoverText: 'group-hover:text-slate-600', desc: 'Syarat & Privasi' },
                { id: 'infodesa', title: 'Info Desa', icon: 'map', bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200', hoverBorder: 'hover:border-rose-500', groupHoverBg: 'group-hover:bg-rose-500', groupHoverText: 'group-hover:text-rose-600', desc: 'Kontak & Batas Wilayah' },
                { id: 'reset', title: 'Reset Sistem', icon: 'warning', bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', hoverBorder: 'hover:border-red-500', groupHoverBg: 'group-hover:bg-red-500', groupHoverText: 'group-hover:text-red-600', desc: 'Hapus Semua Data' }
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

            // Upload Banner: Canvas compress G base64 G Firestore (tanpa GAS)
            const handleLogoUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return showAlert('Gagal: File harus berupa gambar!');
                if (file.size > 2 * 1024 * 1024) return showAlert('Gagal: Ukuran file maksimal 2MB!');
                setIsUploadingLogo(true);
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX = 400;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
                        else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/webp', 0.9);
                        setFormIdentity({...formIdentity, logoApp: compressed});
                        setIsUploadingLogo(false);
                        showAlert('Logo berhasil diunggah! Klik "Simpan Profil" untuk menerapkan.');
                    };
                    img.src = reader.result;
                };
                reader.readAsDataURL(file);
            };

            const handleBannerUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return showAlert('Gagal: File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return showAlert('Gagal: Ukuran file maksimal 10MB!');
                setIsUploadingBanner(true);
                const reader = new FileReader();
                reader.onloadend = () => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX = 1600;
                        let w = img.width, h = img.height;
                        if (w > h) { if (w > MAX) { h = h * MAX / w; w = MAX; } }
                        else { if (h > MAX) { w = w * MAX / h; h = MAX; } }
                        canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/webp', 0.85);
                        setFormBanner(compressed);
                        setIsUploadingBanner(false);
                        showAlert('Gambar berhasil diproses! Klik "Simpan Banner" untuk menerapkan.');
                    };
                    img.onerror = () => { showAlert('Gagal memproses gambar banner.'); setIsUploadingBanner(false); };
                    img.src = reader.result;
                };
                reader.onerror = () => { showAlert('Gagal membaca file gambar banner.'); setIsUploadingBanner(false); };
                reader.readAsDataURL(file);
            };
            const renderGridMenu = () => (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {pengaturanMenus.map(menu => (
                        <div key={menu.id} onClick={() => setActiveMenu(menu.id)} className={`bg-white rounded-[24px] p-5 sm:p-6 border-2 border-slate-200 shadow-sm ${menu.hoverBorder} hover:shadow-lg cursor-pointer transition-all duration-300 group flex flex-col items-center text-center gap-4`}>
                            <div className={`w-14 h-14 ${menu.bg} ${menu.text} rounded-[16px] flex items-center justify-center border-2 ${menu.border} group-hover:scale-110 ${menu.groupHoverBg} group-hover:text-white transition-all duration-300`}>
                                <Icon name={menu.icon} className="text-[28px]" fill="true" />
                            </div>
                            <div>
                                <h3 className={`font-extrabold text-[16px] text-google-text tracking-tight ${menu.groupHoverText} transition-colors`}>{menu.title}</h3>
                                <p className="text-[12px] font-medium text-google-textVariant mt-1">{menu.desc}</p>
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
                        <button onClick={() => setActiveMenu(null)} className="w-12 h-12 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all text-google-textVariant shrink-0 shadow-sm hover:shadow-md">
                            <Icon name="arrow_back" className="text-[24px]" />
                        </button>
                        <div className={`w-12 h-12 ${menu.bg} ${menu.text} rounded-full flex items-center justify-center border ${menu.border} shrink-0`}>
                            <Icon name={menu.icon} className="text-[24px]" fill="true" />
                        </div>
                        <h2 className="text-[20px] font-extrabold text-google-text tracking-tight">{menu.title}</h2>
                    </div>
                );
            };

            return (
                <div className="space-y-6 tab-fade-in">
                    {activeMenu === null && (
                        <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-wrap items-center gap-5">
                            <div className="bg-google-blueLight text-google-blue w-16 h-16 rounded-[20px] flex items-center justify-center border-2 border-google-blue/30 shrink-0"><Icon name="admin_panel_settings" className="text-[32px]" fill="true"/></div>
                            <div><h2 className="text-2xl font-extrabold text-google-text tracking-tight">Setelan Portal Admin</h2><p className="text-[14px] font-medium text-google-textVariant mt-1.5">Ubah konfigurasi fundamental aplikasi RT.</p></div>
                        </div>
                    )}

                    {activeMenu === null ? renderGridMenu() : (
                        <div className="w-full">
                            {renderHeader(activeMenu)}
                            
                            {activeMenu === 'profil' && (
                                <PengaturanSection title="Profil Utama Aplikasi" onSave={() => handleSaveAll('id')}>
                                    <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Kop Surat (Baris 1)</label><input type="text" value={formIdentity.name} onChange={e => setFormIdentity({...formIdentity, name: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Sub Judul (Baris 2)</label><input type="text" value={formIdentity.subtitle} onChange={e => setFormIdentity({...formIdentity, subtitle: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-[16px] px-4 py-4 border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Logo Aplikasi</label>
                                            <p className="text-[12px] text-slate-500 font-medium leading-snug">Format disarankan PNG transparan (maks 2MB). Kosongkan untuk pakai lambang Garuda bawaan.</p>
                                            {formIdentity.logoApp && (
                                                <button onClick={() => setFormIdentity({...formIdentity, logoApp: null})} className="text-[13px] font-bold text-google-red hover:underline mt-2 flex items-center gap-1"><Icon name="delete" className="text-[16px]" /> Hapus Logo Custom</button>
                                            )}
                                        </div>
                                        <div className="relative w-20 h-20 shrink-0 bg-slate-50 border-2 border-dashed border-slate-300 rounded-[16px] flex items-center justify-center hover:bg-google-blueLight/20 hover:border-google-blue/50 transition-all cursor-pointer overflow-hidden group">
                                            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            {isUploadingLogo ? (
                                                <div className="w-6 h-6 border-2 border-google-blue border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                formIdentity.logoApp ? <img src={formIdentity.logoApp} className="w-full h-full object-contain p-2" alt="Logo" /> : <div className="flex flex-col items-center text-slate-400 group-hover:text-google-blue transition-colors"><Icon name="add_photo_alternate" className="text-[28px]" /><span className="text-[10px] font-bold mt-1">Upload</span></div>
                                            )}
                                        </div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'nominal' && (
                                <PengaturanSection title="Iuran Wajib" onSave={() => handleSaveAll('nominal')}>
                                    <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Nominal Arisan (Rp)</label><input type="number" min="0" value={formNominal.arisan} onChange={e => setFormNominal({...formNominal, arisan: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Nominal Jimpitan (Rp)</label><input type="number" min="0" value={formNominal.jimpitan} onChange={e => setFormNominal({...formNominal, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'kalibrasi' && (
                                <PengaturanSection title="Kalibrasi Siklus & Bulan" onSave={() => handleSaveAll('kalibrasi')}>
                                    <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Bulan & Tahun Arisan</label><input type="month" value={formPeriod} onChange={e => setFormPeriod(e.target.value)} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text cursor-pointer" /></div>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex-1 bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Putaran Ke-</label><input type="number" min="1" value={formRound.round} onChange={e => setFormRound({...formRound, round: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                        <div className="flex-1 bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[10px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Siklus Ke-</label><input type="number" min="1" value={formRound.cycle} onChange={e => setFormRound({...formRound, cycle: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'saldo' && (
                                <PengaturanSection title="Koreksi Saldo Manual" onSave={() => handleSaveAll('saldo')}>
                                    <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Saldo Kas RT Utama (Rp)</label><input type="number" min="0" value={formSaldo.kasRt} onChange={e => setFormSaldo({...formSaldo, kasRt: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                    <div className="bg-white rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-google-blue transition-all shadow-sm"><label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Saldo Jimpitan Berjalan (Rp)</label><input type="number" min="0" value={formSaldo.jimpitan} onChange={e => setFormSaldo({...formSaldo, jimpitan: e.target.value})} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text" /></div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'banner' && (
                                <PengaturanSection title="Gambar Latar Banner Utama" onSave={() => handleSaveAll('banner')}>
                                    <div className={`flex flex-col gap-4 bg-white border-2 ${isUploadingBanner ? 'border-google-blue shadow-md' : 'border-slate-200'} p-4 rounded-[16px] transition-all`}>
                                        <label className="text-[11px] font-extrabold text-google-textVariant uppercase tracking-widest">Unggah Foto (Orientasi Lebar/Landscape direkomendasikan)</label>
                                        <div className="relative overflow-hidden w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-[12px] flex items-center px-4 hover:border-google-blue transition-colors cursor-pointer">
                                            <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={isUploadingBanner} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            {isUploadingBanner ? (
                                                <div className="flex flex-wrap items-center gap-3"><div className="w-5 h-5 border-2 border-google-blue border-t-transparent rounded-full animate-spin"></div><span className="font-extrabold text-[13px] text-google-blue">Mengunggah...</span></div>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-3"><Icon name="add_photo_alternate" className="text-google-textVariant text-[24px]" /><span className="font-extrabold text-[13px] text-google-text">{formBanner ? "Ganti Gambar Baru" : "Pilih File Gambar (Maks 2MB)"}</span></div>
                                            )}
                                        </div>
                                        {formBanner && !isUploadingBanner && (
                                            <div className="relative mt-2 h-24 w-full rounded-[12px] overflow-hidden border-2 border-slate-200 group">
                                                <img src={formBanner} alt="Preview Banner" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button onClick={(e) => { e.preventDefault(); setFormBanner(''); }} className="bg-google-red text-white text-[12px] font-extrabold px-4 py-2 rounded-full flex flex-wrap items-center gap-1"><Icon name="delete" className="text-[16px]"/> Hapus</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </PengaturanSection>
                            )}

                            {activeMenu === 'sponsor' && (
                                <SponsorSection sponsorsData={props.sponsorsData} setSponsorsData={props.setSponsorsData} showAlert={showAlert} />
                            )}
                            
                            {activeMenu === 'legal' && (
                                <div className="bg-white p-6 md:p-8 rounded-[32px] border-2 border-slate-100/50 shadow-sm relative overflow-hidden animate-fade-in">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -z-10"></div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200"><Icon name="gavel" className="text-[24px]" /></div>
                                        <div>
                                            <h2 className="text-[18px] md:text-[20px] font-black text-slate-800 tracking-tight">Hukum & Kebijakan</h2>
                                            <p className="text-[13px] text-slate-500 font-medium">Syarat & Ketentuan serta Privasi</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                                            <div>
                                                <p className="text-[14px] font-extrabold text-slate-800">Aktifkan Halaman Kebijakan</p>
                                                <p className="text-[12px] text-slate-500">Tampilkan link di menu dan layar login</p>
                                            </div>
                                            <button onClick={() => props.setLegalData(p => ({...p, enabled: !p?.enabled}))} className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${props.legalData?.enabled ? 'bg-google-green' : 'bg-slate-300'}`}>
                                                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${props.legalData?.enabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                            </button>
                                        </div>

                                        {props.legalData?.enabled && (
                                            <div className="space-y-6 animate-fade-in">
                                                <div>
                                                    <label className="text-[12px] font-extrabold text-slate-500 block mb-2 ml-1 uppercase tracking-widest">Syarat & Ketentuan</label>
                                                    <textarea value={props.legalData?.terms || ''} onChange={(e) => props.setLegalData(p => ({...p, terms: e.target.value}))} rows="6" className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white text-slate-700 rounded-2xl px-5 py-4 text-[14px] font-medium outline-none transition-all resize-y custom-scrollbar" placeholder="Isi Syarat dan Ketentuan..."></textarea>
                                                </div>
                                                <div>
                                                    <label className="text-[12px] font-extrabold text-slate-500 block mb-2 ml-1 uppercase tracking-widest">Kebijakan Privasi</label>
                                                    <textarea value={props.legalData?.privacy || ''} onChange={(e) => props.setLegalData(p => ({...p, privacy: e.target.value}))} rows="6" className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white text-slate-700 rounded-2xl px-5 py-4 text-[14px] font-medium outline-none transition-all resize-y custom-scrollbar" placeholder="Isi Kebijakan Privasi..."></textarea>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => { showAlert('Kebijakan Hukum & Privasi berhasil disimpan!') }} className="w-full mt-8 bg-slate-50 border-2 border-slate-200 text-google-blueDark py-4 rounded-full font-extrabold text-[15px] hover:bg-google-blue hover:border-google-blue hover:text-white transition-all shadow-sm hover:shadow-md active:scale-95">Simpan Kebijakan</button>
                                </div>
                            )}
                            {activeMenu === 'infodesa' && (
                                <InfoDesaSection infoDesa={props.infoDesa} setInfoDesa={props.setInfoDesa} showAlert={showAlert} />
                            )}

                            {activeMenu === 'reset' && (
                                <div className="bg-gradient-to-r from-google-red to-google-redDark text-white p-8 sm:p-10 rounded-[32px] border-2 border-google-redDark shadow-xl relative overflow-hidden group">
                                    <Icon name="warning" className="absolute -right-5 -top-5 text-[160px] text-white opacity-10 group-hover:scale-110 transition-transform duration-700" fill="true" />
                                    <div className="relative z-10">
                                        <div className="flex items-center space-x-3 mb-4"><Icon name="report" className="text-[36px] text-white" fill="true" /><h3 className="font-extrabold text-[24px] tracking-tight">Bahaya: Hapus Semua Database</h3></div>
                                        <p className="text-[15px] font-medium mb-8 text-white/90 max-w-xl leading-relaxed">Tindakan ini akan menghapus seluruh data warga, riwayat keuangan, tunggakan, dan mengembalikan saldo kas menjadi nol kembali seperti baru (Setelan Pabrik).</p>
                                        <button onClick={() => setConfirmResetModal(true)} className="bg-white text-google-redDark px-8 py-4 rounded-full font-extrabold text-[15px] shadow-lg hover:shadow-xl active:scale-95 transition-all duration-300 flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto hover:bg-slate-50 border-2 border-transparent hover:border-google-red"><Icon name="delete_forever" className="text-[20px]"/> Format Database Sekarang</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {modalConfig && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                <div className="mb-6 bg-google-greenLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border-2 border-google-green/30"><Icon name="check_circle" className="text-[48px] text-google-green" fill="true" /></div>
                                <p className="text-google-text text-[20px] font-extrabold mb-8 leading-snug tracking-tight">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-google-blue text-white px-8 py-4 rounded-full font-extrabold text-[15px] border-2 border-google-blueDark hover:bg-google-blueDark active:scale-95 transition-all duration-300 shadow-md">Tutup Pesan</button>
                            </div>
                        </div>
                    )}
                    {confirmResetModal && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity">
                            <div className="max-h-[85vh] overflow-y-auto hide-scrollbar bg-white rounded-[32px] p-8 w-full max-w-sm text-left shadow-2xl border-2 border-slate-200 transform scale-100 transition-transform">
                                <h3 className="text-3xl font-extrabold text-google-red mb-2 tracking-tight">Reset Total?</h3>
                                <p className="text-[15px] font-medium text-google-textVariant mb-8 leading-relaxed">Tindakan ini permanen dan tidak bisa dibatalkan. Ketik kata <b className="text-google-red">RESET</b> di bawah ini.</p>
                                <div className="bg-slate-50 rounded-[16px] px-5 py-4 border-2 border-google-red/40 focus-within:border-google-red focus-within:bg-white focus-within:shadow-md transition-all mb-8"><input type="text" value={resetPromptInput} onChange={e => setResetPromptInput(e.target.value)} className="w-full bg-transparent border-none text-[22px] outline-none p-0 text-google-redDark uppercase tracking-widest font-extrabold placeholder:text-google-red/30" placeholder="RESET" /></div>
                                <div className="flex flex-wrap gap-3"><button onClick={() => {setConfirmResetModal(false); setResetPromptInput('');}} className="w-full sm:w-auto bg-white text-google-text py-4 rounded-full font-extrabold text-[14px] hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 active:scale-95 transition-all duration-300 shadow-sm flex items-center justify-center">Batal</button><button onClick={executeFactoryReset} className="flex flex-wrap bg-google-red text-white border-2 border-google-redDark py-4 rounded-full font-extrabold text-[14px] shadow-md hover:bg-google-redDark active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2">Eksekusi</button></div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


        function Pemenang({ members }) {
            const winners = members.filter(m => m.hasWon).sort((a, b) => a.wonRound - b.wonRound);
            return (
                <div className="space-y-6 max-w-4xl mx-auto">
                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] flex flex-col sm:flex-row justify-between items-center border-2 border-slate-200 shadow-sm text-center sm:text-left gap-5">
                        <div><h2 className="text-2xl font-extrabold text-google-text tracking-tight">Daftar Pemenang Arisan</h2><p className="text-[14px] font-medium text-google-textVariant mt-1.5">Warga yang telah menerima dana pada siklus aktif saat ini.</p></div>
                        <div className="w-16 h-16 bg-google-yellowLight rounded-[20px] flex items-center justify-center border-2 border-google-yellow/40 shrink-0 shadow-sm"><Icon name="emoji_events" className="text-[32px] text-google-yellowDark" fill="true" /></div>
                    </div>
                    {winners.length === 0 ? <div className="bg-white rounded-[32px] border-2 border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border-2 border-slate-200"><Icon name="military_tech" className="text-[48px] text-slate-400" /></div><h3 className="font-extrabold text-[22px] text-google-text mb-2 tracking-tight">Belum Ada Pemenang</h3><p className="text-google-textVariant font-medium text-[15px]">Data penerima arisan akan tampil di sini setelah diundi.</p></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                            {winners.map((winner, index) => (
                                <div key={winner.id} className="bg-white p-4 sm:p-5 md:p-6 rounded-[24px] flex items-center space-x-6 border-2 border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-yellow/60 transition-all duration-300 group">
                                    <div className="bg-google-yellowLight border-2 border-google-yellow/40 text-google-yellowDark font-extrabold w-16 h-16 rounded-[20px] flex items-center justify-center shrink-0 text-[20px] group-hover:bg-google-yellow group-hover:text-white group-hover:scale-110 transition-all duration-300 shadow-sm">#{index + 1}</div>
                                    <div className="flex-1 min-w-0"><h3 className="font-extrabold text-google-text text-[18px] truncate group-hover:text-google-yellowDark transition-colors tracking-tight">{winner.name}</h3><p className="text-[14px] font-bold text-google-textVariant mt-1">Menang di Putaran {winner.wonRound}</p></div>
                                    <Icon name="check_circle" className="text-[32px] text-google-green group-hover:scale-110 transition-transform" fill="true" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        function Kegiatan({ nextMeeting, setNextMeeting, userRole }) {
            const [isEditing, setIsEditing] = useState(false);
            const [formData, setFormData] = useState(nextMeeting);
            useEffect(() => { if (!isEditing) setFormData(nextMeeting); }, [nextMeeting, isEditing]);
            
            return (
                <div className="space-y-6 tab-fade-in">
                    {userRole === 'admin' && (
                        <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
                                <div><h2 className="text-xl font-extrabold text-google-text tracking-tight">Pengaturan Agenda</h2><p className="text-[13px] font-medium text-google-textVariant mt-1">Agenda tampil sebagai teks berjalan (marquee) di Halaman Utama.</p></div>
                                {!isEditing && <button onClick={() => setIsEditing(true)} className="shrink-0 bg-white border-2 border-slate-200 text-google-text px-6 py-2.5 rounded-full font-extrabold flex items-center justify-center gap-2 text-[13px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm w-full sm:w-auto"><Icon name="edit" className="text-[16px]" /><span>Ubah Agenda</span></button>}
                            </div>

                            {isEditing && (
                                <div className="mt-6 pt-6 border-t-2 border-slate-100 space-y-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Hari &amp; Tanggal</label><input type="text" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[14px] font-bold outline-none rounded-[16px] transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: Sabtu, 10 Agustus 2026"/></div>
                                        <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Jam Pelaksanaan</label><input type="text" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[14px] font-bold outline-none rounded-[16px] transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: 19.30 WIB - Selesai"/></div>
                                    </div>
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Lokasi Pertemuan</label><input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[14px] font-bold outline-none rounded-[16px] transition-all text-google-text placeholder:text-slate-400" placeholder="Misal: Rumah Bpk. Budi (RT 01)"/></div>
                                    <div><label className="text-[11px] font-extrabold text-google-textVariant block mb-2 ml-1 uppercase tracking-widest">Agenda Utama Kegiatan</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3 text-[14px] font-medium outline-none rounded-[16px] resize-none min-h-[100px] leading-relaxed transition-all text-google-text placeholder:text-slate-400" placeholder="Tulis rincian acara di sini..."></textarea></div>
                                    <div className="flex flex-wrap gap-3 pt-6 mt-6 border-t-2 border-slate-100">
                                        <button onClick={() => setIsEditing(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3 rounded-full font-extrabold text-[13px] hover:bg-slate-50 border-2 border-slate-200 active:scale-95 transition-all shadow-sm flex items-center justify-center">Batal</button>
                                        <button onClick={() => { setNextMeeting(formData); setIsEditing(false); showToast('Jadwal kegiatan berhasil diperbarui.'); }} className="flex bg-google-blue border-2 border-google-blueDark text-white px-6 py-3 rounded-full font-extrabold text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark active:scale-95 transition-all items-center justify-center gap-2"><Icon name="save" className="text-[16px]"/> Simpan Agenda</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <WaktuSholatWidget />
                </div>
            );
        }

        function Kalender() {
            const [currentDate, setCurrentDate] = useState(new Date());
            const [selectedDate, setSelectedDate] = useState(new Date());
            const [checkDateStr, setCheckDateStr] = useState('');
            const [checkResult, setCheckResult] = useState(null);

            const JAVANESE_MONTHS = [
                'Sura', 'Sapar', 'Mulud', 'Bakda Mulud', 
                'Jumadilawal', 'Jumadilakhir', 'Rejeb', 'Ruwah', 
                'Pasa', 'Sawal', 'Sela', 'Besar'
            ];

            const ISLAMIC_MONTHS = [
                'Muharram', 'Safar', 'Rabi\'ul Awal', 'Rabi\'ul Akhir',
                'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
                'Ramadhan', 'Syawal', 'Dzulqa\'dah', 'Dzulhijjah'
            ];

            // Pasaran Javanese 5-day cycle
            const getPasaran = (date) => {
                const epoch = new Date('1936-03-24T00:00:00');
                const pasaranDays = ['Pon', 'Wage', 'Kliwon', 'Legi', 'Pahing'];
                const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const d2 = new Date(epoch.getFullYear(), epoch.getMonth(), epoch.getDate());
                const diffInDays = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
                let index = diffInDays % 5;
                if (index < 0) index += 5;
                return pasaranDays[index];
            };

            // Javanese Day name (7-day cycle)
            const getJavaneseDayName = (date) => {
                const days = ['Akad', 'Senen', 'Selasa', 'Rebo', 'Kemis', 'Jemuwah', 'Setu'];
                return days[date.getDay()];
            };

            // Hijri and Javanese complete date object converter
            const getHijriAndJawaDetails = (date) => {
                try {
                    const hijriFormatter = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric'
                    });
                    const parts = hijriFormatter.formatToParts(date);
                    const hijriDay = parseInt(parts.find(p => p.type === 'day').value, 10);
                    const hijriMonthNum = parseInt(parts.find(p => p.type === 'month').value, 10);
                    const hijriYear = parseInt(parts.find(p => p.type === 'year').value, 10);

                    const hijriMonthName = ISLAMIC_MONTHS[hijriMonthNum - 1] || 'Muharram';
                    const javaneseMonthName = JAVANESE_MONTHS[hijriMonthNum - 1] || 'Sura';
                    const javaneseYear = hijriYear + 512;
                    const pasaran = getPasaran(date);
                    const javaneseDay = getJavaneseDayName(date);

                    return {
                        hijri: `${hijriDay} ${hijriMonthName} ${hijriYear} H`,
                        hijriDay,
                        jawa: `${javaneseDay} ${pasaran}, ${hijriDay} ${javaneseMonthName} ${javaneseYear} AJ`,
                        pasaran,
                        jawaDay: javaneseDay,
                        jawaMonth: javaneseMonthName,
                        jawaYear: javaneseYear,
                        hijriMonthNum,
                        hijriYear
                    };
                } catch (e) {
                    const pasaran = getPasaran(date);
                    const javaneseDay = getJavaneseDayName(date);
                    return {
                        hijri: `${date.getDate()} - H`,
                        jawa: `${javaneseDay} ${pasaran}, ${date.getDate()} AJ`,
                        pasaran,
                        jawaDay: javaneseDay,
                        jawaMonth: 'Sura',
                        jawaYear: '-'
                    };
                }
            };

            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();

            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const startDayOfWeek = new Date(year, month, 1).getDay();

            const prevMonthDays = new Date(year, month, 0).getDate();

            const handlePrevMonth = () => {
                setCurrentDate(new Date(year, month - 1, 1));
            };

            const handleNextMonth = () => {
                setCurrentDate(new Date(year, month + 1, 1));
            };

            const handleCheckWeton = (e) => {
                e.preventDefault();
                if (!checkDateStr) return;
                const d = new Date(checkDateStr);
                if (isNaN(d.getTime())) return;
                const details = getHijriAndJawaDetails(d);
                setCheckResult({
                    gregorian: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
                    jawa: details.jawa,
                    hijri: details.hijri,
                    weton: `${details.jawaDay} ${details.pasaran}`
                });
            };

            const monthNames = [
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
            ];

            const selectedDetails = getHijriAndJawaDetails(selectedDate);

            // Generate Calendar cells
            const cells = [];
            
            // Previous month padding
            for (let i = startDayOfWeek - 1; i >= 0; i--) {
                const d = new Date(year, month - 1, prevMonthDays - i);
                cells.push({ date: d, isCurrentMonth: false });
            }

            // Current month days
            for (let i = 1; i <= daysInMonth; i++) {
                const d = new Date(year, month, i);
                cells.push({ date: d, isCurrentMonth: true });
            }

            // Next month padding
            const totalCells = 42;
            const remaining = totalCells - cells.length;
            for (let i = 1; i <= remaining; i++) {
                const d = new Date(year, month + 1, i);
                cells.push({ date: d, isCurrentMonth: false });
            }

            return (
                <div className="space-y-6 max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-5">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-extrabold text-google-text tracking-tight flex flex-wrap items-center gap-2 justify-center md:justify-start">
                                <Icon name="calendar_month" className="text-[28px] text-red-600"/>
                                Kalender Tiga Dimensi Waktu
                            </h2>
                            <p className="text-[14px] font-medium text-google-textVariant mt-1.5">Penanggalan Nasional (Masehi), Jawa (Pasaran), dan Hijriah (Islam).</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 bg-red-50 border border-red-500/20 px-4 py-2.5 rounded-[20px] shadow-sm">
                            <Icon name="today" className="text-[20px] text-red-600 animate-pulse" fill="true"/>
                            <div className="text-[12px] font-extrabold text-red-800">
                                Hari Ini: {getJavaneseDayName(new Date())} {getPasaran(new Date())}, {new Date().getDate()} {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Detail Day Card & Weton Checker */}
                        <div className="space-y-6">
                            {/* Hari Ini / Selected Day Info */}
                            <div className="bg-white rounded-[32px] p-4 sm:p-5 md:p-6 border-2 border-slate-200 shadow-sm relative overflow-hidden group">
                                <div className="absolute -right-8 -top-8 w-44 h-44 bg-red-50/50 opacity-40 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700"></div>
                                <h3 className="text-[16px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                                    <Icon name="info" className="text-[18px] text-red-600" />
                                    Detail Tanggal
                                </h3>
                                <div className="space-y-4 relative z-10">
                                    <div className="bg-slate-50 border border-slate-200/60 p-4 sm:p-5 md:p-6 rounded-[20px] shadow-sm">
                                        <p className="text-[10px] uppercase tracking-widest font-extrabold text-google-textVariant mb-1">Masehi / Nasional</p>
                                        <p className="font-extrabold text-[16px] text-google-text">
                                            {selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="bg-red-50/50 border border-red-500/10 p-4 sm:p-5 md:p-6 rounded-[20px] shadow-sm">
                                        <p className="text-[10px] uppercase tracking-widest font-extrabold text-red-800 mb-1">Jawa / Pasaran</p>
                                        <p className="font-extrabold text-[16px] text-red-700">
                                            {selectedDetails.jawa}
                                        </p>
                                        <p className="text-[11px] font-bold text-red-600/80 mt-1">
                                            Weton: <span className="underline decoration-dotted">{selectedDetails.jawaDay} {selectedDetails.pasaran}</span>
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200/60 p-4 sm:p-5 md:p-6 rounded-[20px] shadow-sm">
                                        <p className="text-[10px] uppercase tracking-widest font-extrabold text-google-textVariant mb-1">Hijriah / Kalender Islam</p>
                                        <p className="font-extrabold text-[16px] text-google-text">
                                            {selectedDetails.hijri}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Weton Checker Tool */}
                            <div className="bg-white rounded-[32px] p-4 sm:p-5 md:p-6 border-2 border-slate-200 shadow-sm">
                                <h3 className="text-[16px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                                    <Icon name="search" className="text-[18px] text-red-600" />
                                    Cek Weton & Pasaran Lahir
                                </h3>
                                <form onSubmit={handleCheckWeton} className="space-y-4">
                                    <div className="bg-slate-50 rounded-[16px] px-4 py-3 border-2 border-slate-200 focus-within:border-red-500 focus-within:bg-white transition-all shadow-sm">
                                        <label className="text-[11px] font-extrabold text-google-textVariant block mb-1 uppercase tracking-widest">Pilih Tanggal</label>
                                        <input type="date" value={checkDateStr} onChange={e => { setCheckDateStr(e.target.value); setCheckResult(null); }} className="w-full bg-transparent border-none text-[15px] font-bold outline-none p-0 text-google-text cursor-pointer animate-none" />
                                    </div>
                                    <button type="submit" className="w-full bg-red-600 text-white py-3.5 rounded-full font-extrabold text-[13px] border-2 border-red-700 hover:bg-red-700 active:scale-95 transition-all duration-300 shadow-md flex flex-wrap justify-center items-center gap-1.5">
                                        <Icon name="explore" className="text-[16px]"/>
                                        Cek Sekarang
                                    </button>
                                </form>

                                {checkResult && (
                                    <div className="mt-5 p-4 sm:p-5 md:p-6 rounded-[20px] bg-red-50 border border-red-500/20 space-y-2.5 tab-fade-in">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest font-extrabold text-red-800">Hasil Analisis</p>
                                            <p className="text-[12px] font-bold text-slate-600 mt-1">Masehi: {checkResult.gregorian}</p>
                                        </div>
                                        <div className="h-px bg-red-500/10"></div>
                                        <div>
                                            <p className="text-[13px] font-extrabold text-red-700">Weton: {checkResult.weton}</p>
                                            <p className="text-[12px] font-bold text-red-800 mt-0.5">Jawa: {checkResult.jawa}</p>
                                            <p className="text-[12px] font-bold text-slate-700 mt-0.5">Hijriah: {checkResult.hijri}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Calendar Grid Sheet */}
                        <div className="lg:col-span-2 bg-white rounded-[32px] p-4 sm:p-5 md:p-6 border-2 border-slate-200 shadow-sm flex flex-col">
                            {/* Navigation */}
                            <div className="flex justify-between items-center mb-6">
                                <button onClick={handlePrevMonth} className="w-10 h-10 bg-slate-50 border border-slate-200 text-google-text hover:bg-slate-100 hover:border-slate-300 rounded-full flex justify-center items-center active:scale-95 transition-all shadow-sm">
                                    <Icon name="chevron_left" className="text-[20px]" />
                                </button>
                                <h3 className="text-xl font-extrabold text-google-text tracking-tight uppercase">
                                    {monthNames[month]} {year}
                                </h3>
                                <button onClick={handleNextMonth} className="w-10 h-10 bg-slate-50 border border-slate-200 text-google-text hover:bg-slate-100 hover:border-slate-300 rounded-full flex justify-center items-center active:scale-95 transition-all shadow-sm">
                                    <Icon name="chevron_right" className="text-[20px]" />
                                </button>
                            </div>

                            {/* Day names of the week */}
                            <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-[11px] uppercase tracking-wider text-google-textVariant mb-2 pb-2 border-b border-slate-100">
                                <div className="text-red-600">Ahad</div>
                                <div>Senin</div>
                                <div>Selasa</div>
                                <div>Rabu</div>
                                <div>Kamis</div>
                                <div className="text-emerald-600">Jumat</div>
                                <div>Sabtu</div>
                            </div>

                            {/* Month Grid Cells */}
                            <div className="grid grid-cols-7 gap-1.5 flex-1">
                                {cells.map((cell, idx) => {
                                    const isSelected = selectedDate.getDate() === cell.date.getDate() && 
                                                       selectedDate.getMonth() === cell.date.getMonth() && 
                                                       selectedDate.getFullYear() === cell.date.getFullYear();
                                    
                                    const isToday = new Date().getDate() === cell.date.getDate() && 
                                                    new Date().getMonth() === cell.date.getMonth() && 
                                                    new Date().getFullYear() === cell.date.getFullYear();

                                    const dayDetails = getHijriAndJawaDetails(cell.date);
                                    
                                    return (
                                        <button 
                                            key={idx} 
                                            onClick={() => setSelectedDate(cell.date)}
                                            className={`relative min-h-[64px] p-2 rounded-[16px] border flex flex-col justify-between items-stretch text-left transition-all active:scale-95 ${
                                                !cell.isCurrentMonth ? 'opacity-30 border-transparent hover:border-slate-200' : ''
                                            } ${
                                                isSelected 
                                                    ? 'bg-red-600 text-white border-red-700 shadow-md scale-105 z-10' 
                                                    : isToday 
                                                        ? 'bg-red-50 border-red-500 text-red-700 shadow-sm font-extrabold' 
                                                        : 'bg-slate-50/50 border-slate-200/70 hover:border-red-500/40 hover:bg-white text-google-text'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-[13px] sm:text-[15px] font-extrabold leading-none">{cell.date.getDate()}</span>
                                                <span className={`text-[8px] sm:text-[9px] font-bold opacity-80 leading-none ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                                                    {dayDetails.hijriDay}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-col items-stretch leading-tight">
                                                <span className={`text-[8px] sm:text-[9.5px] font-extrabold truncate ${
                                                    isSelected 
                                                        ? 'text-white' 
                                                        : dayDetails.pasaran === 'Kliwon' 
                                                            ? 'text-red-600' 
                                                            : 'text-emerald-700'
                                                }`}>
                                                    {dayDetails.pasaran}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        function PetaDesa({ infoDesa }) {

            return (
                <div className="space-y-6 max-w-5xl mx-auto tab-fade-in">
                    <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-[24px] sm:rounded-[32px] border-2 border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-5">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-extrabold text-google-text tracking-tight flex flex-wrap items-center gap-2 justify-center md:justify-start">
                                <Icon name="map" className="text-[28px] text-red-600"/>
                                Area Cakupan Desa Banyuanyar
                            </h2>
                            <p className="text-[14px] font-medium text-google-textVariant mt-1.5">Peta interaktif wilayah Desa Banyuanyar, Kecamatan Gurah, Kabupaten Kediri.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-500/20 px-4 py-2.5 rounded-[20px] shadow-sm">
                            <Icon name="explore" className="text-[20px] text-red-600" fill="true"/>
                            <div className="text-[12.5px] font-extrabold text-red-800">
                                Kode Pos: 64181
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[32px] p-4 sm:p-5 md:p-6 border-2 border-slate-200 shadow-sm overflow-hidden">
                        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15810.734045472811!2d112.0831012336427!3d-7.82328387515901!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e7859a9896e1c3d%3A0x750afa04649cafb0!2sBanyuanyar%2C%20Kec.%20Gurah%2C%20Kabupaten%20Kediri%2C%20Jawa%20Timur!5e0!3m2!1sid!2sid!4v1783910401380!5m2!1sid!2sid" className="w-full h-[450px] rounded-[24px] z-10 border border-slate-200/80" style={{border:0}} allowFullScreen="" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"></iframe>
                        <p className="text-[11px] font-bold text-center text-google-textVariant mt-3 flex flex-wrap items-center justify-center gap-1"><Icon name="info" className="text-[14px]" /> Peta interaktif dari Google Maps.</p>
                    </div>

                    {infoDesa?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-[32px] p-4 sm:p-5 md:p-6 border-2 border-slate-200 shadow-sm">
                            <h3 className="text-[16px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                                <Icon name="border_outer" className="text-[18px] text-red-600" />
                                Batas Administrasi Desa
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                    <div key={arah} className="bg-slate-50 p-4 sm:p-5 md:p-6 rounded-[20px] border border-slate-200/50">
                                        <p className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 mb-0.5">{arah}</p>
                                        <p className="font-extrabold text-[14px] text-google-text">{infoDesa.batas?.[arah] || '-'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-[32px] p-4 sm:p-5 md:p-6 border-2 border-slate-200 shadow-sm">
                            <h3 className="text-[16px] font-extrabold text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
                                <Icon name="contact_phone" className="text-[18px] text-red-600" />
                                Kontak Penting Layanan Desa
                            </h3>
                            <div className="space-y-3">
                                {infoDesa.kontak?.map((k, i) => (
                                    <div key={k.id || i} className={`flex justify-between items-center bg-${k.color}-50/50 border border-${k.color}-500/10 px-4 py-3 rounded-[16px]`}>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <Icon name={k.icon || 'contact_phone'} className={`text-[18px] text-${k.color}-600`} fill="true"/>
                                            <span className={`text-[13px] font-bold text-${k.color}-800`}>{k.nama}</span>
                                        </div>
                                        <span className={`text-[13px] font-black text-${k.color}-700`}>{k.telepon}</span>
                                    </div>
                                ))}
                                {(!infoDesa.kontak || infoDesa.kontak.length === 0) && (
                                    <div className="text-center p-4 text-slate-500 text-sm">Belum ada kontak penting</div>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            );
        }


// Default export untuk digunakan di main.jsx
export default App;







