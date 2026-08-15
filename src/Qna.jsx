import React, { useState, useMemo } from 'react';

function Icon({ name, className = "text-[17px]", fill = "false" }) {
    return (
        <span 
            className={`material-symbols-rounded shrink-0 select-none flex items-center justify-center ${className}`} 
            style={{ fontVariationSettings: fill === 'true' ? "'FILL' 1" : "'FILL' 0", lineHeight: '1em', width: '1em', height: '1em' }} 
            aria-hidden="true"
        >
            {name}
        </span>
    );
}

function Qna({ 
    userRole, 
    nominalArisan, 
    nominalJimpitan, 
    identity, 
    members, 
    arisanPeriod, 
    currentRound, 
    cycleNumber, 
    jimpitanBalance, 
    kasRtBalance, 
    meetingHistory, 
    inventarisData, 
    pinjamData, 
    infaqData 
}) {
    const [mode, setMode] = useState(userRole === 'admin' ? 'admin' : 'warga');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Semua');
    const [expandedIds, setExpandedIds] = useState({});

    // Formatting helper
    const formatRp = (num) => `Rp ${(num || 0).toLocaleString('id-ID')}`;

    // ==========================================
    // KNOWLEDGE BASE DATA
    // ==========================================
    const kbWarga = useMemo(() => [
        {
            category: 'Arisan',
            icon: 'emoji_events',
            q: 'Apa itu Arisan RT ini?',
            a: `Arisan RT adalah kegiatan kumpul-kumpul uang rutin setiap bulan. Setiap anggota membayar iuran arisan sebesar ${formatRp(nominalArisan || 10000)} per pertemuan.

Uang dari semua anggota dikumpulkan, lalu diundi dan satu orang beruntung mendapatkan semua uang tersebut bulan itu.

Setiap orang akan mendapat giliran menang TEPAT 1 kali per siklus, jadi tidak ada yang dirugikan. Setelah semua mendapat giliran, siklus baru dimulai lagi dari awal.`
        },
        {
            category: 'Arisan',
            icon: 'emoji_events',
            q: 'Berapa uang yang diterima pemenang arisan?',
            a: `Pemenang menerima uang dari semua anggota yang hadir, MINUS bagian dirinya sendiri karena tidak masuk akal seseorang membayar ke dirinya sendiri.

Contoh mudah:
- Ada 10 anggota hadir, iuran ${formatRp(nominalArisan || 10000)} per orang.
- Total terkumpul = 10 x ${formatRp(nominalArisan || 10000)} = ${formatRp(10 * (nominalArisan || 10000))}.
- Pemenang hadir dan menerima ${formatRp(9 * (nominalArisan || 10000))} (dari 9 orang lainnya).

Ini bukan pengurangan, melainkan cara menghitung yang jujur agar uang fisik yang diserahkan cocok dengan catatan.`
        },
        {
            category: 'Arisan',
            icon: 'emoji_events',
            q: 'Kenapa ada menu "Pemenang"?',
            a: `Menu Pemenang menampilkan daftar siapa saja yang SUDAH mendapat giliran menang di siklus yang sedang berjalan.

Anda bisa memeriksa:
- Siapa saja yang sudah menang di putaran berapa.
- Siapa saja yang belum mendapat giliran menang.

Jika nama Anda belum ada di daftar, berarti Anda masih punya kesempatan menang di pertemuan bulan berikutnya.`
        },
        {
            category: 'Arisan',
            icon: 'emoji_events',
            q: 'Apa itu Putaran dan Siklus?',
            a: `- **Putaran**: Urutan pertemuan arisan bulanan (Putaran 1 = bulan pertama, Putaran 2 = bulan kedua, dst).
- **Siklus**: Satu babak penuh sampai semua anggota mendapat giliran menang tepat 1 kali.

Contoh: Jika ada 12 anggota arisan, satu siklus berisi 12 putaran (12 bulan). Setelah putaran ke-12 selesai, masuk Siklus baru.
Saat ini: Siklus ke-${cycleNumber || 1}, Putaran ke-${currentRound || 1}.`
        },
        {
            category: 'Jimpitan',
            icon: 'savings',
            q: 'Apa itu Jimpitan?',
            a: `Jimpitan adalah iuran sukarela bernominal kecil yang dikumpulkan setiap pertemuan arisan, terpisah dari uang arisan utama.

Besarnya: ${formatRp(nominalJimpitan || 2000)} per anggota per pertemuan.

Uang jimpitan tidak diundi, melainkan dikumpulkan terus sebagai tabungan bersama RT yang bisa digunakan untuk kebutuhan operasional, sosial, atau ditransfer ke Kas Warga Utama jika diperlukan.`
        },
        {
            category: 'Jimpitan',
            icon: 'savings',
            q: 'Apa perbedaan Kas Jimpitan dan Kas Warga?',
            a: `Sistem ini memiliki dua jenis kas yang terpisah:
- **Kas Jimpitan**: Uang yang terkumpul dari iuran kehadiran bulanan sebagai dana gotong royong warga.
- **Kas Warga Utama**: Uang operasional RT yang lebih besar, bisa berasal dari alokasi kas jimpitan, iuran umum, atau donasi/sponsorship.

Admin dapat memindahkan dana jimpitan ke Kas Warga jika ada kebutuhan mendesak, dan semua riwayat pemindahan tercatat transparan.`
        },
        {
            category: 'Jimpitan',
            icon: 'savings',
            q: 'Apa itu "Saldo Efektif"?',
            a: `Saldo Efektif Jimpitan adalah gabungan dari:
- Saldo tunai yang ada di kas jimpitan.
- Total piutang (tunggakan seluruh warga yang belum membayar jimpitan).

Tampilan ini memberikan gambaran total aset jimpitan riil yang dimiliki oleh RT saat ini. Saldo tunai saat ini: ${formatRp(jimpitanBalance || 0)}.`
        },
        {
            category: 'Jimpitan',
            icon: 'savings',
            q: 'Apa itu Talangan?',
            a: `Talangan terjadi ketika ada warga yang absen (Alfa atau Musibah) dalam pertemuan arisan.

Agar pemenang tetap menerima uang arisan penuh pada bulan itu, kekurangan setoran dari warga yang absen "ditalangi sementara" menggunakan Kas Jimpitan.

Saat warga yang absen tersebut hadir kembali di bulan berikutnya dan melunasi tunggakan, dana talangan tersebut otomatis dikembalikan ke Kas Jimpitan.`
        },
        {
            category: 'Tunggakan',
            icon: 'warning',
            q: 'Kenapa saya tercatat memiliki Tunggakan?',
            a: `Tunggakan timbul otomatis jika Anda tidak hadir pada pertemuan arisan, baik dengan status:
- **Alfa**: Tidak hadir tanpa alasan jelas.
- **Musibah**: Tidak hadir karena alasan yang sah (sakit, urusan keluarga mendesak, dll).

Besar tunggakan per absen = Arisan + Jimpitan = ${formatRp((nominalArisan || 10000) + (nominalJimpitan || 2000))}. Tunggakan ini bukan denda, melainkan kewajiban tertunda yang harus dilunasi pada kehadiran berikutnya.`
        },
        {
            category: 'Tunggakan',
            icon: 'warning',
            q: 'Bagaimana cara melunasi Tunggakan?',
            a: `Cara pelunasan tunggakan sangat praktis:
1. Hadir di pertemuan arisan berikutnya.
2. Bayar iuran bulanan berjalan.
3. Beritahu Admin untuk melunasi tunggakan Anda.
4. Admin akan mencentang opsi "Lunasi Tunggakan?" di dasbor absensi Anda.

Tunggakan Anda akan otomatis terhapus dari riwayat sistem setelah data disimpan oleh admin.`
        },
        {
            category: 'Tunggakan',
            icon: 'warning',
            q: 'Apa bedanya status "Alfa" dan "Musibah"?',
            a: `- **Alfa (Rapor Merah)**: Tidak hadir tanpa konfirmasi/alasan jelas. Nama Anda akan ditandai dengan badge merah di dashboard warga sebagai peringatan.
- **Musibah**: Tidak hadir karena alasan penting/darurat. Anda tetap dicatat memiliki tunggakan, namun nama Anda TIDAK akan masuk dalam daftar rapor merah karena mendapat toleransi sosial.`
        },
        {
            category: 'Iuran',
            icon: 'volunteer_activism',
            q: 'Apa itu Iuran Umum?',
            a: `Iuran Umum adalah tagihan khusus di luar arisan rutin untuk program tertentu, contohnya:
- Iuran Kemerdekaan (17 Agustus)
- Pembangunan Masjid/Mushola
- Dana Darurat/Sosial kematian

Setiap agenda iuran memiliki nama, nominal minimum, dan tenggat waktu yang ditentukan oleh pengurus RT.`
        },
        {
            category: 'Iuran',
            icon: 'volunteer_activism',
            q: 'Kenapa saya hanya melihat status LUNAS atau BELUM LUNAS?',
            a: `Ini adalah fitur **Privasi Finansial**.

Sistem menyembunyikan nominal pasti yang disumbangkan setiap warga untuk menjaga kerukunan, mengingat kemampuan ekonomi setiap keluarga berbeda. Anda hanya akan melihat tanda LUNAS jika setoran Anda sudah mencapai batas nominal minimum agenda tersebut.`
        },
        {
            category: 'Buku Kas',
            icon: 'account_balance_wallet',
            q: 'Apakah Warga biasa bisa mengubah data Buku Kas?',
            a: `Tidak. Anggota/warga umum hanya memiliki akses **Melihat (Read-Only)** riwayat Buku Kas.

Hanya Admin yang memiliki hak menambah, mengoreksi, atau menghapus transaksi. Hal ini memastikan transparansi keuangan RT tetap terjaga tanpa risiko data diubah secara tidak sah.`
        },
        {
            category: 'Buku Warga',
            icon: 'person',
            q: 'Apa arti tanda/badge status di nama saya?',
            a: `Di menu Buku Warga, status Anda ditandai sebagai:
- **BERSIH** (Hijau): Kehadiran baik, tidak ada tunggakan.
- **HUTANG** (Kuning/Merah): Memiliki tunggakan pembayaran yang harus dilunasi.
- **WAFAT** (Abu-abu): Diberhentikan dari kewajiban iuran/arisan.
- **NONAKTIF** (Abu-abu): Pindah rumah atau tidak aktif lagi.`
        },
        {
            category: 'Info RT',
            icon: 'campaign',
            q: 'Di mana saya bisa melihat inventaris barang milik RT?',
            a: `Anda dapat mengakses menu **Inventaris** di dasbor utama. Di sana tercantum daftar lengkap barang milik RT (tenda, kursi, sound system) beserta jumlahnya sebagai bentuk transparansi aset bersama.

Saat ini RT memiliki ${inventarisData?.length || 0} barang terdaftar.`
        },
        {
            category: 'Official Store',
            icon: 'local_mall',
            q: 'Bagaimana cara membeli barang di Official Store RT?',
            a: `Sangat mudah!
1. Buka menu **Official Store** di dasbor.
2. Pilih produk dan kuantitas, lalu masukkan ke keranjang belanja.
3. Klik Keranjang, isi nama lengkap, nomor WhatsApp, dan alamat/blok rumah Anda.
4. Klik buat pesanan. Barang akan dikirim secara gratis ongkir langsung ke rumah Anda dengan sistem pembayaran COD (Bayar di Tempat).`
        },
        {
            category: 'Tiket Acara',
            icon: 'local_activity',
            q: 'Bagaimana cara membeli tiket acara RT di aplikasi?',
            a: `Jika RT mengadakan acara berbayar (seperti Jalan Sehat atau Bazar):
1. Buka menu **Beli Tiket**.
2. Pilih tiket acara yang Anda inginkan, tentukan jumlahnya, lalu selesaikan pemesanan.
3. Tiket QR Code digital akan otomatis tersimpan di akun Anda dan dapat ditunjukkan ke panitia saat acara berlangsung.`
        }
    ], [nominalArisan, nominalJimpitan, cycleNumber, currentRound, jimpitanBalance, inventarisData]);

    const kbAdmin = useMemo(() => [
        {
            category: 'Keanggotaan',
            icon: 'group',
            q: 'Apa saja jenis Program Keikutsertaan warga?',
            a: `Ada 4 jenis program yang dapat diatur untuk setiap warga:
1. **Full (Arisan, Iuran & Jimpitan)**: Ikut serta dalam semua kegiatan keuangan RT.
2. **Hanya Iuran Umum**: Khusus warga yang tidak mengikuti arisan maupun jimpitan bulanan.
3. **Arisan Saja (Bebas Jimpitan)**: Biasanya diberikan untuk lansia atau warga dengan dispensasi tertentu.
4. **Jimpitan & Iuran Umum**: Mengikuti jimpitan dan iuran umum tanpa menjadi peserta undian arisan.`
        },
        {
            category: 'Keanggotaan',
            icon: 'group',
            q: 'Bagaimana cara mengelola Status Warga?',
            a: `Status warga dapat diatur menjadi 3 jenis:
- **Aktif**: Berpartisipasi penuh dalam kewajibannya.
- **Meninggal / Wafat**: Bebas dari iuran arisan bulanan dan tidak masuk undian arisan, namun tetap berkontribusi jimpitan jika hadir.
- **Nonaktif / Pindah**: Diberhentikan dari kewajiban arisan bulanan.

Mengubah status warga dapat dilakukan lewat tombol **Edit** pada menu Buku Warga.`
        },
        {
            category: 'Absensi Arisan',
            icon: 'how_to_reg',
            q: 'Bagaimana alur 3 langkah absensi pertemuan arisan?',
            a: `Menu Absen Arisan diproses melalui 3 langkah berurutan:
1. **Langkah 1**: Konfirmasi Periode & Tanggal Pertemuan.
2. **Langkah 2**: Catat Kehadiran (Hadir / Musibah / Alfa) masing-masing warga. Warga dengan status Wafat/Nonaktif akan otomatis diarsir abu-abu.
3. **Langkah 3**: Pilih Pemenang Arisan dari daftar nama warga yang belum pernah menang di siklus berjalan.`
        },
        {
            category: 'Absensi Arisan',
            icon: 'how_to_reg',
            q: 'Bagaimana sistem kalkulasi Kas Arisan dan Jimpitan?',
            a: `- **Kas Arisan**: (Jumlah warga Hadir x ${formatRp(nominalArisan || 10000)}) - Bagian pemenang. Contoh: jika 10 warga hadir, kas arisan terkumpul adalah 9 x ${formatRp(nominalArisan || 10000)} = ${formatRp(9 * (nominalArisan || 10000))}, yang langsung diserahkan kepada pemenang.
- **Kas Jimpitan**: Setiap warga yang hadir menyumbang ${formatRp(nominalJimpitan || 2000)} ke jimpitan. Kekurangan setoran arisan dari warga yang absen (Alfa/Musibah) ditalangi dari Kas Jimpitan terlebih dahulu.`
        },
        {
            category: 'Absensi Arisan',
            icon: 'how_to_reg',
            q: 'Bagaimana jika semua warga sudah pernah menang arisan?',
            a: `Ketika semua warga yang berhak sudah memenangkan arisan tepat satu kali, siklus arisan dinyatakan selesai. 

Pada halaman absen langkah ke-3, sistem akan menampilkan tombol untuk melakukan **Reset Siklus Baru** (misal berpindah ke Siklus ke-${(cycleNumber || 1) + 1}). Ini akan mengosongkan riwayat menang agar semua nama warga bisa diundi kembali.`
        },
        {
            category: 'Buku Kas',
            icon: 'account_balance_wallet',
            q: 'Bagaimana cara menarik dana dari Kas Jimpitan?',
            a: `Dana jimpitan yang terkumpul dapat dicairkan dan dipindahkan ke Kas Warga Utama via tombol **"Tarik Kas Jimpitan"** di menu Buku Kas.

Masukkan nominal penarikan (maksimal sebesar saldo jimpitan saat ini: ${formatRp(jimpitanBalance || 0)}). Sistem akan otomatis mencatat pemindahan ini sebagai pemasukan di Buku Kas.`
        },
        {
            category: 'Buku Kas',
            icon: 'account_balance_wallet',
            q: 'Apakah saldo Buku Kas bisa bernilai negatif?',
            a: `Tidak. Sistem dilengkapi pengaman (*Guard Negative Balance*) yang akan memblokir pengisian transaksi pengeluaran jika nilainya melampaui saldo Kas Warga Utama saat ini (${formatRp(kasRtBalance || 0)}). 

Jika terpaksa harus mencatat pengeluaran besar, pastikan Anda melakukan penarikan kas jimpitan terlebih dahulu.`
        },
        {
            category: 'Iuran Umum',
            icon: 'volunteer_activism',
            q: 'Bagaimana mekanisme pengelolaan Iuran Umum?',
            a: `1. Klik tombol **Buat Agenda Baru** di menu Iuran Umum, tentukan nama dan nominal minimum.
2. Catat pembayaran masing-masing warga di tabel daftar iuran.
3. Setelah selesai, klik tombol **"Simpan Rekap Warga"**.
4. Setelah rekap tersimpan, klik **"Setor ke Kas"** untuk memindahkan uang iuran tersebut menjadi pemasukan Kas Warga Utama.`
        },
        {
            category: 'Laporan & Revisi',
            icon: 'analytics',
            q: 'Bagaimana cara merevisi absensi pertemuan yang sudah lampau?',
            a: `Jika ada kesalahan input absensi di bulan sebelumnya:
1. Buka menu **Arsip Riwayat**.
2. Klik ikon **Edit/Revisi** pada baris periode yang ingin diubah.
3. Ubah kehadiran warga secara akurat, lalu klik Simpan.

Sistem akan otomatis menghitung ulang seluruh saldo kas jimpitan, talangan, saldo akhir, serta tunggakan warga di periode tersebut secara otomatis.`
        },
        {
            category: 'Setelan Admin',
            icon: 'settings',
            q: 'Bagaimana melakukan Factory Reset jika ingin memulai dari awal?',
            a: `Fasilitas Factory Reset berada di menu **Setelan Admin**. Tindakan ini akan menghapus seluruh data (warga, kas, riwayat arisan, galeri, dll).

Untuk konfirmasi, Anda harus memasukkan kata kunci "RESET". Tindakan ini **tidak bisa dibatalkan**. PIN login admin Anda akan tetap dipertahankan agar Anda tidak terkunci dari aplikasi.`
        }
    ], [nominalArisan, nominalJimpitan, cycleNumber, currentRound, jimpitanBalance, kasRtBalance]);

    // Active KB mapping
    const currentKB = mode === 'admin' ? kbAdmin : kbWarga;

    // Filter categories dynamically
    const categories = useMemo(() => {
        const cats = new Set(currentKB.map(item => item.category));
        return ['Semua', ...Array.from(cats)];
    }, [currentKB]);

    // Filtered data based on search and category
    const filteredQna = useMemo(() => {
        return currentKB.filter(item => {
            const matchesSearch = item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 item.a.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'Semua' || item.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [currentKB, searchQuery, selectedCategory]);

    const toggleAccordion = (id) => {
        setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-white tracking-tight flex items-center gap-2.5">
                            <Icon name="quiz" className="text-google-blue text-[28px] sm:text-3xl" fill="true" /> Pusat Tanya Jawab (Q&A)
                        </h2>
                        <p className="text-slate-650 dark:text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed font-medium">
                            Temukan penjelasan dan cara membaca data arisan, jimpitan, kas, dan operasional RT secara instan.
                        </p>
                    </div>

                    {/* Mode Switcher for Admins */}
                    {userRole === 'admin' && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full shrink-0 border border-slate-200 dark:border-slate-700 self-start md:self-auto shadow-inner">
                            <button 
                                onClick={() => { setMode('warga'); setSelectedCategory('Semua'); setSearchQuery(''); }} 
                                className={`px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${mode === 'warga' ? 'bg-google-green text-white shadow' : 'text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                <Icon name="group" className="text-[14px]" /> Panduan Warga
                            </button>
                            <button 
                                onClick={() => { setMode('admin'); setSelectedCategory('Semua'); setSearchQuery(''); }} 
                                className={`px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${mode === 'admin' ? 'bg-google-blue text-white shadow' : 'text-slate-655 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                <Icon name="admin_panel_settings" className="text-[14px]" /> Panduan Admin
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls: Search and Filters */}
            <div className="flex flex-col gap-4">
                {/* Search Bar */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-800 focus-within:border-google-blue dark:focus-within:border-google-blue flex items-center gap-2.5 shadow-sm transition-all">
                    <Icon name="search" className="text-slate-400 dark:text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Cari pertanyaan atau kata kunci bantuan..." 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        className="w-full bg-transparent border-none outline-none text-[13px] text-slate-800 dark:text-white placeholder-slate-400"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                            <Icon name="close" className="text-[15px]" />
                        </button>
                    )}
                </div>

                {/* Category Pills */}
                {categories.length > 2 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {categories.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setSelectedCategory(cat)} 
                                className={`px-4 py-2.5 rounded-full text-[11px] sm:text-xs font-medium shrink-0 transition-all border active:scale-95 ${selectedCategory === cat ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-355 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Accordion List */}
            <div className="space-y-4">
                {filteredQna.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Icon name="search_off" className="text-[32px] text-slate-400 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">Pencarian Tidak Ditemukan</h3>
                        <p className="text-slate-550 dark:text-slate-400 max-w-sm text-xs sm:text-sm leading-relaxed">Coba cari dengan kata kunci lain seperti: arisan, jimpitan, tunggakan, iuran, kas, atau reset.</p>
                    </div>
                ) : (
                    filteredQna.map((item, index) => {
                        const key = `${mode}_${index}`;
                        const isExpanded = !!expandedIds[key];
                        const accentClass = mode === 'admin' ? 'hover:border-google-blue/40 border-google-blue/10' : 'hover:border-google-green/40 border-google-green/10';
                        return (
                            <div 
                                key={key}
                                className={`bg-white dark:bg-slate-900 rounded-2xl border ${accentClass} shadow-sm overflow-hidden transition-all duration-200`}
                            >
                                <button 
                                    onClick={() => toggleAccordion(key)}
                                    className="w-full px-5 py-4.5 sm:px-6 sm:py-5 flex items-center justify-between text-left gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${mode === 'admin' ? 'bg-google-blueLight text-google-blueDark' : 'bg-google-greenLight text-google-greenDark'}`}>
                                            <Icon name={item.icon} className="text-[16px] sm:text-[18px]" fill="true" />
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-555 block mb-0.5">{item.category}</span>
                                            <span className="font-semibold text-xs sm:text-sm text-slate-850 dark:text-slate-100 tracking-tight leading-tight">{item.q}</span>
                                        </div>
                                    </div>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-650 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <Icon name="expand_more" className="text-[20px]" />
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-slate-100 dark:border-slate-800 animate-slide-down">
                                        <p className="text-[12.5px] sm:text-sm font-medium text-slate-655 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pt-4">
                                            {item.a}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default Qna;
