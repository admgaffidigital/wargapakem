import React, { useState, useEffect, useRef } from 'react';

function Icon({ name, className = "text-[17px]", fill = "false" }) {
    return <span className={`material-symbols-rounded shrink-0 select-none flex items-center justify-center ${className}`} style={{ fontVariationSettings: fill === 'true' ? "'FILL' 1" : "'FILL' 0", lineHeight: '1em', width: '1em', height: '1em' }} aria-hidden="true">{name}</span>;
}

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
                        { label: 'Program Keikutsertaan', answer: `Ada 4 jenis program warga:\n\n👉 Full (Arisan, Iuran & Jimpitan) -> ikut semua kegiatan.\n\n👉 Hanya Iuran Umum -> bayar iuran umum saja.\n\n👉 Arisan Saja (Bebas Jimpitan) -> khusus lansia dsb.\n\n👉 Jimpitan & Iuran Umum -> tanpa arisan.\n\nPilih sesuai kesepakatan saat mendaftar.` },
                        { label: 'Status Warga (3 jenis)', answer: `✅ Aktif → ikut semua kewajiban.\n\n🕊️ Meninggal / Wafat → bebas arisan, TETAP wajib jimpitan Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')}. Kartu di Absen otomatis abu-abu.\n\n❌ Nonaktif / Pindah → sama seperti Meninggal, bebas arisan.\n\nUbah status lewat tombol Edit di daftar warga.` },
                        { label: 'Tunggakan Warga', answer: `Tunggakan timbul otomatis saat warga Alfa atau Musibah.\n\nBesaran = Arisan + Jimpitan = Rp ${((nominalArisan||10000)+(nominalJimpitan||2000)).toLocaleString('id-ID')} per bulan absen.\n\nLunas saat warga hadir + centang "Lunasi Tunggakan?" di form Absen.` },
                        { label: 'Rapor Merah vs Musibah', answer: `= Rapor Merah (Alfa) G tidak hadir tanpa alasan. Dapat tanda merah di dashboard.\n\n= Musibah G berhalangan karena alasan valid (sakit, musibah). Punya tunggakan tapi TIDAK dapat rapor merah.\n\nMusibah = toleransi, Alfa = peringatan.` },
                        { label: 'Tambah / Edit / Hapus Warga', answer: `➕ Tambah → isi nama, program, status. Nama harus unik karena jadi identifikasi di absensi.\n\n✏️ Edit → ubah data termasuk status dan koreksi tunggakan manual.\n\n🗑️ Hapus → ada konfirmasi. Tidak bisa dipulihkan.` }
                    ]
                },
                pertemuan: {
                    label: '📋 Absen Arisan', icon: 'how_to_reg',
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
                    label: '= Buku Kas Warga', icon: 'account_balance_wallet',
                    intro: 'Catatan keuangan Kas Warga Utama. Terpisah dari Kas Jimpitan.',
                    topics: [
                        { label: 'Kategori Transaksi', answer: `= Pemasukan: Iuran Opsional, Donasi, Pemasukan Jasa, Lain-lain.\n= Pengeluaran: Belanja Barang/Alat, Honor Jasa, Konsumsi, Bantuan Sosial, Lain-lain.\n\nSetiap transaksi wajib ada keterangan agar mudah diaudit.` },
                        { label: 'Tarik Kas Jimpitan', answer: `Dana jimpitan bisa dicairkan ke Kas Warga via tombol "Tarik Kas Jimpitan".\n\nMaksimal tarik = saldo jimpitan saat ini: Rp ${(jimpitanBalance||0).toLocaleString('id-ID')}.\n\nJika transaksi ini dihapus, saldo jimpitan otomatis dikembalikan.` },
                        { label: 'Guard Saldo Negatif', answer: `Sistem TIDAK mengizinkan pengeluaran melebihi saldo kas.\n\nJika nominal > saldo, muncul pesan error dan transaksi dibatalkan. Saldo Warga saat ini: Rp ${(kasRtBalance||0).toLocaleString('id-ID')}.` }
                    ]
                },
                iuran: {
                    label: '= Iuran Umum', icon: 'volunteer_activism',
                    intro: 'Tagihan khusus di luar arisan G dana kemerdekaan, pembangunan, dll.',
                    topics: [
                        { label: 'Cara Kerja Iuran', answer: `Admin buat agenda G isi nominal yang dibayar tiap warga G warga hanya lihat LUNAS/BELUM LUNAS (nominal privat).\n\nSetelah rekap tersimpan, admin bisa setor ke Kas Warga Utama.` },
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
                    label: '⚙️ Pengaturan', icon: 'settings',
                    intro: 'Konfigurasi sistem: nominal, identitas, koreksi saldo, PIN, reset.',
                    topics: [
                        { label: 'Nominal Arisan & Jimpitan', answer: `Arisan: Rp ${(nominalArisan||10000).toLocaleString('id-ID')} | Jimpitan: Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')}.\n\nPerubahan berlaku mulai pertemuan berikutnya. Riwayat lama tetap memakai nominal lama.` },
                        { label: 'Koreksi Saldo Manual', answer: `Kas Warga: perbedaan dicatat otomatis sebagai transaksi "Penyesuaian Saldo Awal" di Buku Kas.\nJimpitan: langsung ubah tanpa entry transaksi.\n\nGunakan jika ada perbedaan antara sistem dan uang fisik.` },
                        { label: 'Kalibrasi Putaran & Siklus', answer: `Koreksi nomor putaran dan siklus jika ada kesalahan (misal migrasi dari sistem lama).\n\nPutaran saat ini: ${currentRound||1} | Siklus: ${cycleNumber||1}.` },
                        { label: 'Factory Reset', answer: `Menghapus SEMUA data: warga, riwayat, saldo, iuran, galeri, inventaris.\n\nKetik "RESET" untuk konfirmasi. ⚠️ TIDAK BISA DIBATALKAN. PIN admin tetap tidak berubah agar admin masih bisa login setelah reset.` }
                    ]
                },
                infaq_inventaris: {
                    label: '= Infaq & Inventaris', icon: 'inventory_2',
                    intro: 'Kelola data Infaq, barang inventaris, dan status peminjaman.',
                    topics: [
                        { label: 'Sistem Infaq Warga', answer: `Infaq dikelola terpisah dari Kas Warga dan Jimpitan.\n\nSaat ini ada ${infaqData?.filter(i => i.status === 'PENDING').length || 0} donasi Infaq yang menunggu persetujuan (PENDING). Total donasi disetujui: Rp ${(infaqData?.filter(i => i.status === 'APPROVED').reduce((sum, i) => sum + parseInt(i.nominal || 0), 0) || 0).toLocaleString('id-ID')}.` },
                        { label: 'Manajemen Inventaris', answer: `RT memiliki ${inventarisData?.length || 0} jenis barang inventaris.\n\nJika ada yang meminjam, gunakan menu "Pinjam Inventaris". Saat ini ada ${pinjamData?.filter(p => p.status === 'DIPINJAM').length || 0} transaksi barang yang sedang dipinjam warga.` }
                    ]
                },
                blog_warga: {
                    label: '= Blog Warga', icon: 'article',
                    intro: 'Manajemen Blog Warga.',
                    topics: [
                        { label: 'Blog Warga', answer: `Warga bisa menulis artikel/blog. Admin dapat memoderasi tulisan yang ada di sistem jika diperlukan.` }
                    ]
                },
                galeri_peta: {
                    label: '= Galeri & Peta', icon: 'photo_library',
                    intro: 'Dokumentasi kegiatan dan denah lokasi warga.',
                    topics: [
                        { label: 'Galeri Foto', answer: `Tempat menyimpan foto-foto dokumentasi kegiatan RT (kerja bakti, lomba, dll). Warga bisa melihat dan mengunduh foto.` },
                        { label: 'Peta Desa', answer: `Menampilkan titik lokasi rumah warga yang sudah mendaftarkan koordinat GPS-nya. Memudahkan kurir atau tamu mencari alamat.` }
                    ]
                },
                lapor_tiket: {
                    label: '= Lapor & Tiket', icon: 'report_problem',
                    intro: 'Pengaduan masyarakat dan manajemen tiket.',
                    topics: [
                        { label: 'Lapor / Pengaduan', answer: `Menerima laporan atau keluhan dari warga. Admin dapat melihat, memantau, dan memperbarui status penanganan laporan (misalnya: Selesai).` },
                        { label: 'Sistem Tiket', answer: `Fitur penjualan/distribusi tiket untuk acara RT. Admin bisa mengatur kuota, harga, dan memvalidasi tiket masuk.` }
                    ]
                },
                komunikasi_hiburan: {
                    label: '= Info, WA & Hiburan', icon: 'forum',
                    intro: 'Info Warga, Grup WA, Kalender, dan Musik.',
                    topics: [
                        { label: 'Info Warga & Pengumuman', answer: `Menu Informasi digunakan untuk membuat pengumuman resmi RT yang muncul di beranda.` },
                        { label: 'Grup WhatsApp', answer: `Tautan cepat menuju Grup WA RT resmi.` },
                        { label: 'Musik Warga', answer: `Fitur khusus Admin untuk memutar musik pengiring selama kegiatan RT berlangsung.` },
                        { label: 'Jadwal & Kalender', answer: `Mencatat agenda kegiatan RT yang akan datang dan menampilkannya dalam format kalender bulanan.` }
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
                            answer: `Jimpitan adalah iuran kecil yang dikumpulkan setiap pertemuan arisan, terpisah dari uang arisan.\n\nBesarnya: Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')} per anggota per pertemuan.\n\nUang jimpitan TIDAK diundi G dikumpulkan terus sebagai "tabungan bersama" RT yang bisa dipakai untuk keperluan operasional, membantu warga yang kesulitan, atau ditransfer ke Kas Warga jika diperlukan.`
                        },
                        {
                            label: 'Bedanya Kas Jimpitan dan Kas Warga?',
                            answer: `Ada DUA kantong uang di sistem ini:\n\n= Kas Jimpitan G uang dari iuran kehadiran bulanan. Ini uang hasil gotong royong murni dari warga.\n\n= Kas Warga Utama G uang operasional RT yang lebih besar. Bisa berasal dari pencairan jimpitan, iuran umum, sumbangan, dll.\n\nAdmin bisa memindahkan sebagian jimpitan ke Kas Warga jika ada kebutuhan mendesak. Semua perpindahan uang tercatat di Buku Kas.`
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
                    label: '⚠️ Tunggakan Saya', icon: 'warning',
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
                    label: '= Cara Baca Kas Warga', icon: 'account_balance_wallet',
                    intro: 'Memahami laporan keuangan Warga G dari mana uang masuk, ke mana uang keluar.',
                    topics: [
                        {
                            label: 'Apa yang terlihat di menu Kas Warga?',
                            answer: `Di menu "Kas Warga" Anda bisa melihat:\n\n= Saldo kas warga saat ini\n= Riwayat semua pemasukan dan pengeluaran\n\nPermasukan bisa berasal dari: iuran opsional, donasi warga, pencairan jimpitan, hasil iuran umum.\n\nPengeluaran bisa untuk: belanja alat, konsumsi rapat, bantuan sosial, honor petugas, dll.`
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
                            answer: `Di menu "Buku Warga", setiap warga punya tanda:\n\n✅ BERSIH → tidak ada tunggakan, kehadiran bagus.\n⚠️ HUTANG Rp X,XXX → ada tunggakan yang harus segera dilunasi.\n🕊️ WAFAT → status telah diubah admin (tidak lagi aktif di arisan).\n❌ NONAKTIF → pindah atau tidak aktif lagi.\n\nTanda merah kecil di samping nama = warga punya rapor merah dari Alfa.`
                        },
                        {
                            label: 'Saya baru bergabung, apa yang perlu saya tahu?',
                            answer: `Selamat bergabung! Berikut yang perlu dipahami:\n\n1. Setiap bulan Anda membayar Rp ${(nominalArisan||10000).toLocaleString('id-ID')} arisan + Rp ${(nominalJimpitan||2000).toLocaleString('id-ID')} jimpitan = Rp ${((nominalArisan||10000)+(nominalJimpitan||2000)).toLocaleString('id-ID')} total per pertemuan.\n\n2. Nama Anda masuk daftar undian. Anda akan menang tepat 1 kali per siklus.\n\n3. Jika tidak bisa hadir, beritahu admin sebelumnya agar dicatat Musibah (bukan Alfa).\n\n4. Tunggakan tidak hangus G harus dilunasi saat hadir berikutnya.`
                        },
                        {
                            label: 'Bagaimana cara cek status arisan saya?',
                            answer: `Buka menu "Pemenang" di beranda → cari nama Anda:\n\n✅ Nama ADA di daftar = Anda SUDAH menang di siklus ini. Selamat!\n⏳ Nama TIDAK ADA = Anda belum mendapat giliran, masih akan diundi bulan mendatang.\n\nBuka menu "Buku Warga" untuk cek tunggakan dan status terkini Anda.`
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
                },
                tiket_acara: {
                    label: '= Tiket Acara', icon: 'local_activity',
                    intro: 'Pembelian tiket acara RT.',
                    topics: [
                        { label: 'Beli Tiket', answer: `Jika ada acara RT berbayar (misal jalan sehat), Anda bisa memesan tiket langsung di aplikasi tanpa harus antri ke panitia.` }
                    ]
                },
                lapor_blog: {
                    label: '= Lapor & Blog', icon: 'report_problem',
                    intro: 'Layanan interaktif untuk keluhan dan cerita.',
                    topics: [
                        { label: 'Lapor Keluhan', answer: `Lampu jalan mati? Selokan mampet? Gunakan menu "Lapor" untuk mengirim laporan ke pengurus RT. Anda bisa mengecek progres tindak lanjutnya.` },
                        { label: 'Blog Warga', answer: `Di menu "Blog Warga", Anda bisa membaca tulisan dari tetangga lain atau membagikan cerita Anda sendiri. Jangan lupa beri like dan komentar positif!` }
                    ]
                },
                komunikasi_peta: {
                    label: '= Komunikasi & Peta', icon: 'forum',
                    intro: 'Peta rumah warga dan info Grup WA.',
                    topics: [
                        { label: 'Peta Lokasi', answer: `Gunakan menu Peta Desa untuk melihat denah rumah warga. Sangat berguna jika Anda mencari rumah tetangga.` },
                        { label: 'Grup WhatsApp', answer: `Jika Anda belum masuk grup RT, klik menu "Grup WA" untuk langsung bergabung tanpa harus repot meminta link admin.` },
                        { label: 'Kalender', answer: `Gunakan menu Kalender untuk melihat agenda kegiatan kita dalam format kalender bulanan yang mudah dipahami.` }
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
                        <div className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-700 w-[320px] max-w-full sm:w-[380px] max-w-full overflow-hidden flex flex-col mb-4 max-h-[82vh]">

                            {/* Header */}
                            <div className={`text-white px-5 py-4 flex items-center justify-between shrink-0 ${mode === 'admin' ? 'bg-google-blue' : 'bg-google-green'}`}>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <Icon name="support_agent" className="text-[24px]" fill="true" />
                                    <div>
                                        <h3 className="font-medium text-[13px] leading-tight">Asisten Pintar RT</h3>
                                        <p className={`text-[9px] font-medium leading-tight ${mode === 'admin' ? 'text-blue-100' : 'text-green-100'}`}>{identity?.name || 'Sistem Arisan RT'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 w-8 h-8 flex items-center justify-center rounded-full transition-colors active:scale-95"><Icon name="close" className="text-[17px]" /></button>
                            </div>

                            {/* Mode Toggle */}
                            <div className="flex flex-wrap gap-0 border-b border-slate-200 shrink-0">
                                <button onClick={() => handleModeSwitch('warga')} className={`flex-1 py-2.5 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${mode === 'warga' ? 'bg-google-greenLight text-google-greenDark border-b border-google-green' : 'bg-white dark:bg-slate-900 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="group" className="text-[14px]" />Panduan Warga
                                </button>
                                <button onClick={() => handleModeSwitch('admin')} className={`flex-1 py-2.5 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${mode === 'admin' ? 'bg-google-blueLight text-google-blueDark border-b border-google-blue' : 'bg-white dark:bg-slate-900 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="admin_panel_settings" className="text-[14px]" />Panduan Admin
                                </button>
                            </div>

                            {/* Chat area */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 md:p-4 sm:p-6 space-y-5 bg-slate-50 hide-scrollbar border-y border-slate-200" style={{fontSize:'13px'}}>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        {msg.sender === 'robot' && (
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-1 shrink-0 ${mode === 'admin' ? 'bg-google-blue' : 'bg-google-green'}`}>
                                                <Icon name="support_agent" className="text-white text-[13px]" fill="true" />
                                            </div>
                                        )}
                                        <div className={`p-3 rounded-[12px] max-w-[82%] leading-relaxed shadow-sm whitespace-pre-line font-medium ${msg.sender === 'user' ? (mode === 'admin' ? 'bg-google-blue' : 'bg-google-green') + ' text-white rounded-tr-sm text-[11px]' : 'bg-white dark:bg-slate-800 text-google-text dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-sm text-[12.5px]'}`}>{msg.text}</div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Sub-topik */}
                            {activeMenu && (
                                <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 shrink-0 max-h-36 overflow-y-auto hide-scrollbar">
                                    <p className="w-full text-[9px] font-medium text-google-textVariant uppercase tracking-widest mb-0.5">{currentKB[activeMenu].label}</p>
                                    {currentKB[activeMenu].topics.map((t, i) => (
                                        <button key={i} onClick={() => handleTopicClick(activeMenu, t)} className={`text-[10px] font-medium px-3 py-1.5 rounded-full border active:scale-95 transition-all ${mode === 'admin' ? 'bg-google-blueLight text-google-blueDark border-google-blue/30 hover:bg-google-blue hover:text-white' : 'bg-google-greenLight text-google-greenDark border-google-green/30 hover:bg-google-green hover:text-white'}`}>{t.label}</button>
                                    ))}
                                    <button onClick={() => setActiveMenu(null)} className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-95 transition-all">G Tutup</button>
                                </div>
                            )}

                            {/* Menu utama */}
                            {!activeMenu && (
                                <div className="px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5 shrink-0 max-h-28 overflow-y-auto hide-scrollbar">
                                    <p className="w-full text-[9px] font-medium text-google-textVariant uppercase tracking-widest mb-0.5">Pilih Topik:</p>
                                    {mainMenus.map(key => (
                                        <button key={key} onClick={() => handleMenuClick(key)} className={`text-[10px] font-medium border px-3 py-1.5 rounded-full active:scale-95 transition-all flex items-center gap-1 ${mode === 'admin' ? 'bg-slate-50 dark:bg-slate-800 text-google-text dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-google-blue hover:text-google-blue hover:bg-google-blueLight dark:hover:bg-slate-700' : 'bg-slate-50 dark:bg-slate-800 text-google-text dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-google-green hover:text-google-greenDark hover:bg-google-greenLight dark:hover:bg-slate-700'}`}>
                                            <Icon name={currentKB[key].icon} className="text-[12px]" />{currentKB[key].label.replace(/^[^\s]+\s/, '')}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Input */}
                            <div className="p-3 bg-white dark:bg-slate-900 flex flex-wrap gap-2 shrink-0">
                                <input
                                    type="text" value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                    placeholder={mode === 'admin' ? 'Tanya fitur sistem...' : 'Tanya tentang arisan Anda...'}
                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-google-blue dark:text-white rounded-[10px] px-4 py-2 text-[11px] font-medium outline-none transition-colors"
                                />
                                <button onClick={handleSearch} className={`w-9 h-9 text-white rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${mode === 'admin' ? 'bg-google-blue hover:bg-google-blueDark' : 'bg-google-green hover:bg-google-greenDark'}`}>
                                    <Icon name="send" className="text-[14px]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FAB */}
                    <button
                        onClick={toggleRobot}
                        className={`w-16 h-16 text-white rounded-full flex items-center justify-center active:scale-95 transition-all border-4 border-white ${mode === 'admin' ? 'bg-google-blue hover:bg-google-blueDark' : 'bg-google-green hover:bg-google-greenDark'}`}
                    >
                        <Icon name={isOpen ? "close" : "support_agent"} className="text-[30px]" fill="true" />
                    </button>
                </div>
            );
        }

export default RobotGuide;
