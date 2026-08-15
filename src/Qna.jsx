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
    // KNOWLEDGE BASE DATA (DETAILED & CITIZEN FRIENDLY)
    // ==========================================
    const kbWarga = useMemo(() => [
        {
            category: 'Arisan Warga',
            icon: 'emoji_events',
            q: 'Apa itu Arisan RT ini?',
            a: `Arisan RT adalah kegiatan menabung bersama secara berkala setiap bulan untuk mempererat tali silaturahmi antar-tetangga di wilayah RT kita. Setiap anggota yang berpartisipasi menyetor uang arisan sebesar ${formatRp(nominalArisan || 10000)} per pertemuan.

Uang yang terkumpul dari seluruh peserta akan diserahkan kepada satu orang pemenang yang diundi menggunakan sistem acak komputer yang adil.

Penting dipahami: Sistem ini menganut asas keadilan penuh. Setiap peserta yang terdaftar dipastikan akan memenangkan arisan tepat satu kali di setiap siklus putaran. Tidak ada bunga, tidak ada potongan biaya admin. Setelah seluruh warga mendapat giliran menang, barulah siklus akan direset dan dimulai kembali dari awal.`
        },
        {
            category: 'Arisan Warga',
            icon: 'emoji_events',
            q: 'Berapa uang yang diterima pemenang arisan?',
            a: `Pemenang arisan akan menerima akumulasi uang dari seluruh anggota yang hadir pada pertemuan tersebut, kecuali bagian dari dirinya sendiri.

Mengapa demikian? Karena secara logika, seseorang tidak perlu membayar iuran arisan kepada dirinya sendiri.

Ilustrasi Sederhana (Contoh Amplop):
- Misalkan ada 10 orang warga yang hadir, dengan nominal iuran arisan ${formatRp(nominalArisan || 10000)} per orang.
- Total nominal di atas kertas adalah 10 orang x ${formatRp(nominalArisan || 10000)} = ${formatRp(10 * (nominalArisan || 10000))}.
- Namun karena pemenang tidak menyetor untuk amplopnya sendiri, maka ada 9 tetangga lainnya yang mengisi amplop masing-masing sebesar ${formatRp(nominalArisan || 10000)}.
- Total uang fisik yang dibawa pulang oleh pemenang adalah ${formatRp(9 * (nominalArisan || 10000))} (dari 9 orang lain).

Dengan cara ini, jumlah uang kas fisik yang diserahkan di tempat akan sangat akurat dan cocok dengan catatan sistem absensi tanpa ada selisih.`
        },
        {
            category: 'Arisan Warga',
            icon: 'emoji_events',
            q: 'Kenapa ada menu "Pemenang"?',
            a: `Menu Pemenang berfungsi sebagai papan transparansi publik. Di menu ini, seluruh warga bisa melihat:
1. Daftar nama warga yang sudah mendapatkan giliran menang beserta informasi di putaran/bulan ke berapa mereka menang.
2. Daftar nama warga yang belum mendapatkan giliran menang di siklus putaran berjalan saat ini.

Jika nama Anda belum ada di daftar pemenang, jangan khawatir! Anda masih berada di dalam wadah undian komputer dan giliran menang Anda akan segera datang di pertemuan bulan-bulan berikutnya.`
        },
        {
            category: 'Arisan Warga',
            icon: 'emoji_events',
            q: 'Apa itu Putaran dan Siklus?',
            a: `Untuk memudahkan pemahaman perkembangan arisan kita:
- **Putaran**: Menunjukkan jumlah pertemuan bulanan yang sudah terlaksana. Putaran 1 berarti bulan pertama, Putaran 2 berarti bulan kedua, dan seterusnya.
- **Siklus**: Adalah satu putaran besar penuh yang baru selesai jika seluruh warga yang terdaftar sudah memenangkan arisan masing-masing tepat satu kali.

Contoh: Jika total peserta arisan kita adalah 12 orang, maka 1 Siklus akan memakan waktu 12 Putaran (12 bulan). Setelah putaran ke-12 selesai, sistem akan mereset data pemenang untuk memulai Siklus baru dari awal.
Kondisi saat ini: Aplikasi kita saat ini sedang berjalan pada Siklus ke-${cycleNumber || 1} dan Putaran ke-${currentRound || 1}.`
        },
        {
            category: 'Arisan Warga',
            icon: 'history',
            q: 'Apa itu menu Arsip Riwayat?',
            a: `Menu Arsip Riwayat adalah catatan digital permanen untuk setiap pertemuan bulanan yang sudah lewat. Di sana warga dapat melihat:
- Siapa pemenang arisan pada bulan tersebut.
- Berapa jumlah kas arisan dan kas jimpitan yang terkumpul.
- Siapa saja warga yang absen beserta riwayat dana talangannya.

Data ini tersimpan aman di server cloud (Firebase) sehingga tidak bisa diubah-ubah sepihak, kecuali terdapat revisi absensi resmi oleh pengurus RT jika ada kekeliruan pencatatan.`
        },
        {
            category: 'Kas Jimpitan',
            icon: 'savings',
            q: 'Apa itu Jimpitan?',
            a: `Jimpitan adalah iuran sukarela bernominal kecil yang dikumpulkan dari setiap warga yang hadir di setiap pertemuan bulanan. Nominal jimpitan disepakati sebesar ${formatRp(nominalJimpitan || 2000)} per warga.

Berbeda dengan uang arisan yang diundi untuk dibawa pulang oleh perorangan, uang kas jimpitan ini tidak diundi. Jimpitan dikumpulkan terus-menerus sebagai tabungan sosial dan operasional bersama. Dana jimpitan ini digunakan untuk membeli keperluan RT (seperti sapu, tong sampah, sound system), membiayai rapat, memberikan sumbangan sosial bagi warga yang tertimpa musibah (sakit/kematian), atau dialokasikan sebagai dana talangan sementara jika ada warga arisan yang absen.`
        },
        {
            category: 'Kas Jimpitan',
            icon: 'savings',
            q: 'Apa perbedaan Kas Jimpitan dan Kas Warga Utama?',
            a: `Situs RT kita mengelola dua kantong keuangan yang berbeda fungsi demi tertib administrasi:
1. **Kas Jimpitan**: Sumbernya murni dari iuran kehadiran bulanan sebesar ${formatRp(nominalJimpitan || 2000)} per warga. Kas ini utamanya digunakan untuk urusan sosial warga dan dana talangan arisan.
2. **Kas Warga Utama**: Merupakan kas operasional RT berskala lebih besar yang saldo awalnya didapat dari iuran tahunan, donasi sukarela, sumbangan pembangunan, maupun hasil pemindahan (transfer) sebagian dana dari kas jimpitan atas persetujuan bersama.

Setiap ada pemindahan dana dari Kas Jimpitan ke Kas Warga Utama oleh admin, sistem akan mencatatnya sebagai transaksi masuk resmi di Buku Kas RT secara realtime untuk menghindari salah hitung.`
        },
        {
            category: 'Kas Jimpitan',
            icon: 'savings',
            q: 'Apa itu "Saldo Efektif"?',
            a: `Pada halaman Dashboard utama, Anda akan melihat grafik atau angka "Saldo Efektif Jimpitan". Angka ini adalah penjumlahan dari:
1. **Saldo Tunai**: Uang kas jimpitan fisik yang saat ini dipegang oleh bendahara RT.
2. **Total Piutang**: Jumlah akumulasi tunggakan dari seluruh warga yang belum membayar iuran/jimpitannya (uang kas RT yang masih berada di tangan warga).

Contoh: Jika saldo tunai bendahara adalah Rp 100.000, dan ada total tunggakan warga sebesar Rp 50.000, maka Saldo Efektif Jimpitan adalah Rp 150.000. Konsep Saldo Efektif ini sangat penting agar pengurus RT dapat mengetahui total aset jimpitan riil yang dimiliki oleh paguyuban RT kita saat ini. Saldo tunai jimpitan saat ini: ${formatRp(jimpitanBalance || 0)}.`
        },
        {
            category: 'Kas Jimpitan',
            icon: 'savings',
            q: 'Apa itu Talangan?',
            a: `Sistem talangan dibuat agar pemenang arisan bulanan tetap menerima uangnya secara utuh (penuh) pada hari pertemuan, meskipun ada beberapa anggota arisan yang tidak bisa hadir (absen) dan belum menyetor uang arisan mereka.

Kekurangan uang setoran dari warga yang absen tersebut akan ditalangi sementara dengan meminjam dana dari Kas Jimpitan.

Nanti, ketika warga yang absen tersebut hadir di pertemuan bulan berikutnya dan membayar tunggakan mereka, uang pelunasan tersebut akan otomatis masuk kembali untuk memulihkan saldo Kas Jimpitan yang dipinjam sebelumnya. Dengan sistem talangan ini, jalannya arisan tidak akan terhambat dan pemenang bulan itu tidak dirugikan.`
        },
        {
            category: 'Tunggakan Warga',
            icon: 'warning',
            q: 'Kenapa saya tercatat memiliki Tunggakan?',
            a: `Tunggakan otomatis tercatat di sistem apabila nama Anda diatur sebagai "Tidak Hadir" pada saat absensi arisan bulanan ditutup oleh pengurus. Ketidakhadiran ini bisa berupa:
- **Alfa**: Absen tanpa alasan yang jelas atau tanpa memberikan kabar.
- **Musibah**: Absen karena ada halangan penting (sakit, tugas dinas, atau ada musibah keluarga).

Besar tunggakan per satu kali absen adalah iuran arisan + jimpitan = ${formatRp((nominalArisan || 10000) + (nominalJimpitan || 2000))}. Tunggakan ini bukanlah denda atau hukuman bunga, melainkan kewajiban iuran bulanan Anda yang tertunda dan harus dilunasi pada pertemuan berikutnya.`
        },
        {
            category: 'Tunggakan Warga',
            icon: 'warning',
            q: 'Bagaimana cara melunasi Tunggakan saya?',
            a: `Anda dapat melunasi tunggakan dengan langkah mudah berikut:
1. Hadir di pertemuan arisan RT pada bulan berikutnya.
2. Bayar iuran bulan berjalan seperti biasa.
3. Serahkan uang tunggakan Anda kepada bendahara/admin.
4. Admin akan membuka lembar absen Anda dan mencentang kolom "Lunasi Tunggakan?".

Setelah data absensi disimpan oleh admin ke server cloud, status tunggakan Anda akan otomatis terhapus dari sistem dan status nama Anda kembali menjadi BERSIH (hijau).`
        },
        {
            category: 'Tunggakan Warga',
            icon: 'warning',
            q: 'Apa perbedaan status "Alfa" dan "Musibah" di absensi?',
            a: `RT kita sangat menghargai toleransi sosial dan kedisiplinan. Oleh karena itu, ketidakhadiran dibagi menjadi dua:
- **Alfa (Rapor Merah)**: Diberikan jika warga absen tanpa kabar sama sekali. Nama warga akan ditandai dengan lingkaran merah atau badge "Rapor Merah" di dasbor sebagai pengingat kedisiplinan.
- **Musibah**: Diberikan jika warga absen karena alasan darurat yang sah (sakit keras, musibah keluarga, dll). Warga tetap mencatat tunggakan iuran, namun nama warga bebas dari label Rapor Merah karena pengurus memaklumi kondisi darurat tersebut.`
        },
        {
            category: 'Iuran Umum',
            icon: 'volunteer_activism',
            q: 'Apa itu Iuran Umum?',
            a: `Iuran Umum adalah iuran insidental (khusus) di luar uang arisan bulanan yang digunakan untuk mendanai acara/kegiatan tertentu di lingkungan RT kita. Contohnya:
- Dana Peringatan HUT RI (17 Agustus)
- Sumbangan pembangunan/renovasi masjid RT
- Iuran kebersihan lingkungan khusus

Setiap agenda iuran memiliki batas nominal minimum pembayaran dan tenggat waktu yang ditentukan oleh pengurus.`
        },
        {
            category: 'Iuran Umum',
            icon: 'volunteer_activism',
            q: 'Kenapa saya hanya melihat status LUNAS atau BELUM LUNAS tanpa angka rupiah?',
            a: `Hal ini merupakan fitur privasi dan kenyamanan warga.

Kemampuan finansial setiap kepala keluarga tentu berbeda-beda. Demi menjaga kerukunan dan menghindari rasa sungkan antar-tetangga, besarnya nominal iuran yang Anda bayar bersifat rahasia (privat). Anda dan warga lain hanya bisa melihat status LUNAS (jika nominal setoran Anda telah memenuhi batas minimal agenda) atau BELUM LUNAS. Hanya bendahara/admin RT yang dapat melihat nominal persisnya demi kebutuhan laporan pembukuan.`
        },
        {
            category: 'Buku Kas RT',
            icon: 'account_balance_wallet',
            q: 'Apakah Warga biasa bisa mengubah data Buku Kas?',
            a: `Tidak bisa. Anggota atau warga biasa hanya diberikan hak akses Melihat (Read-Only) seluruh riwayat kas masuk dan keluar.

Hak untuk menambah transaksi, mengoreksi entri yang salah, atau melakukan penarikan jimpitan dibatasi khusus untuk Admin Utama yang terverifikasi. Hal ini menjamin transparansi laporan keuangan di mana warga bisa memantau aliran kas kapan saja, namun datanya terlindung dari perubahan tidak sah.`
        },
        {
            category: 'Buku Warga',
            icon: 'person',
            q: 'Apa arti status "BERSIH", "HUTANG", "WAFAT", dan "NONAKTIF" di Buku Warga?',
            a: `Tanda di samping nama Anda di menu Buku Warga menjelaskan kondisi keanggotaan Anda saat ini:
- **BERSIH** (Badge Hijau): Kondisi prima, kehadiran aktif, dan tidak memiliki tunggakan iuran arisan/jimpitan.
- **HUTANG** (Badge Kuning/Merah): Warga memiliki kewajiban pembayaran tertunda yang harus segera dilunasi.
- **WAFAT** (Abu-abu): Status untuk warga yang telah berpulang. Mereka otomatis dibebaskan dari segala kewajiban arisan dan iuran bulanan.
- **NONAKTIF** (Abu-abu): Diberhentikan dari kewajiban arisan karena sudah pindah rumah ke luar wilayah RT kita.`
        },
        {
            category: 'Inventaris & Pinjam',
            icon: 'campaign',
            q: 'Di mana saya bisa melihat inventaris barang milik RT?',
            a: `Anda dapat mengakses menu Inventaris di dasbor utama. Di sana tercantum daftar lengkap barang milik RT (tenda terpal, kursi lipat, sound system portable) beserta jumlahnya sebagai bentuk transparansi aset bersama.

Saat ini RT memiliki ${inventarisData?.length || 0} barang terdaftar.`
        },
        {
            category: 'Inventaris & Pinjam',
            icon: 'handshake',
            q: 'Bagaimana cara mengajukan peminjaman barang inventaris RT?',
            a: `Jika Anda memiliki acara keluarga di rumah (seperti syukuran, khitanan, pernikahan, atau takziah) dan ingin meminjam alat RT:
1. Buka menu **Pinjam Inventaris** di dasbor.
2. Cari barang yang Anda butuhkan (pastikan statusnya "Tersedia").
3. Isi formulir peminjaman: masukkan jumlah barang, tanggal mulai meminjam, dan tanggal rencana pengembalian.
4. Kirim pengajuan Anda. Pengurus RT akan meninjau ketersediaan barang. Setelah disetujui, Anda bisa mengambil barang tersebut di tempat penyimpanan RT.`
        },
        {
            category: 'Infaq RT',
            icon: 'volunteer_activism',
            q: 'Bagaimana cara menyalurkan donasi Infaq secara online?',
            a: `Penyaluran infaq untuk kegiatan sosial RT dapat dilakukan di menu **Infaq**:
1. Isi formulir dengan nama Anda (atau centang pilihan **Anonim / Hamba Allah** jika Anda ingin merahasiakan identitas Anda).
2. Tentukan nominal infaq dan unggah bukti transfer pembayaran.
3. Klik kirim. Bendahara RT akan memverifikasi bukti tersebut, dan dana Anda akan resmi masuk dalam laporan infaq sosial RT.`
        },
        {
            category: 'Official Store',
            icon: 'local_mall',
            q: 'Bagaimana cara membeli barang di Official Store RT?',
            a: `Official Store RT adalah toko kelontong online yang dikelola oleh pengurus RT untuk membantu menyediakan kebutuhan harian warga. Cara membelinya:
1. Buka menu **Official Store** di dasbor.
2. Pilih produk yang diinginkan, tentukan varian dan jumlahnya, lalu masukkan ke keranjang.
3. Buka keranjang belanja di pojok kanan atas, lalu klik checkout.
4. Isi data pengiriman: Nama lengkap Anda, nomor WhatsApp aktif, dan alamat/blok rumah.
5. Klik pesan. Pengurus RT akan mengantarkan barang langsung ke depan pintu rumah Anda secara **Gratis Ongkir (Bebas Ongkos Kirim)**, dan Anda cukup membayar tunai di tempat saat barang diterima (**COD**). Setiap pembelian produk di toko ini juga berkontribusi menyumbang Kas RT!`
        },
        {
            category: 'Tiket Acara',
            icon: 'local_activity',
            q: 'Bagaimana cara membeli tiket acara RT di aplikasi?',
            a: `Jika RT mengadakan acara besar yang berbayar (seperti tiket jalan sehat memperingati kemerdekaan, kupon doorprize, atau bazar makanan):
1. Buka menu **Beli Tiket**.
2. Pilih event aktif, tentukan jumlah tiket yang ingin dibeli, lalu kirim pemesanan.
3. Setelah dikonfirmasi oleh panitia, tiket digital beserta **QR Code** unik akan muncul di menu "Tiket Saya".
4. Anda cukup menunjukkan kode QR tersebut di HP Anda kepada petugas lapangan saat acara berlangsung untuk dipindai.`
        },
        {
            category: 'Blog Warga',
            icon: 'article',
            q: 'Bagaimana cara berkontribusi di Blog Warga?',
            a: `Menu **Blog Warga** adalah wadah sosial kreatif milik kita bersama. Semua warga dapat menulis artikel, resep masakan, opini, pengumuman kehilangan hewan peliharaan, berita duka, kabar pernikahan, atau cerita inspiratif lainnya. Warga lainnya dapat saling berinteraksi dengan membaca, memberikan apresiasi tombol *Like*, dan memberikan komentar-komentar positif untuk merajut kebersamaan.`
        },
        {
            category: 'Peta Lokasi',
            icon: 'map',
            q: 'Apa kegunaan menu Peta Lokasi?',
            a: `Menu **Peta Lokasi** menyajikan peta pemukiman wilayah RT kita secara digital yang interaktif. Dengan mendaftarkan koordinat GPS rumah masing-masing, kurir ekspedisi pengantar barang belanjaan online, ojek online, kerabat, atau tamu dari luar kota dapat dengan mudah menemukan alamat rumah Anda secara presisi tanpa harus tersesat di gang-gang RT.`
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
- **Nonaktif / Pindah**: Diberhentikan dari kewajiban arisan bulanan karena sudah pindah atau mengundurkan diri.

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
            category: 'Buku Kas RT',
            icon: 'account_balance_wallet',
            q: 'Bagaimana cara menarik dana dari Kas Jimpitan?',
            a: `Dana jimpitan yang terkumpul dapat dicairkan dan dipindahkan ke Kas Warga Utama via tombol **"Tarik Kas Jimpitan"** di menu Buku Kas.

Masukkan nominal penarikan (maksimal sebesar saldo jimpitan saat ini: ${formatRp(jimpitanBalance || 0)}). Sistem akan otomatis mencatat pemindahan ini sebagai pemasukan di Buku Kas.`
        },
        {
            category: 'Buku Kas RT',
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
            category: 'Musik Warga',
            icon: 'music_note',
            q: 'Apa fungsi dari menu Musik Warga?',
            a: `Menu **Musik Warga** adalah fitur khusus Admin untuk mengiringi jalannya pertemuan arisan RT.

Admin dapat memutar musik, mencari lagu, atau menyetel daftar putar audio secara terpusat agar suasana berkumpul terasa lebih hangat, santai, dan ceria.`
        },
        {
            category: 'Setelan Admin',
            icon: 'settings',
            q: 'Bagaimana cara melakukan Koreksi Saldo Manual?',
            a: `Jika terdapat selisih antara saldo digital di sistem dan uang kas fisik:
1. Buka menu **Setelan Admin**.
2. Cari bagian **Koreksi Saldo Manual**.
3. Isi saldo baru untuk Kas Warga Utama atau Kas Jimpitan.
4. Perubahan Kas Warga Utama akan otomatis dicatat sebagai transaksi "Penyesuaian Saldo Awal" di Buku Kas sebagai bukti audit.`
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
                                className={`px-4 py-2.5 rounded-full text-[11px] sm:text-xs font-medium shrink-0 transition-all border active:scale-95 ${selectedCategory === cat ? 'bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-white shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-355 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850'}`}
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
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-555 block mb-0.5">{item.category}</span>
                                            <span className="font-semibold text-xs sm:text-sm text-slate-850 dark:text-slate-100 tracking-tight leading-tight block truncate sm:whitespace-normal">{item.q}</span>
                                        </div>
                                    </div>
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-650 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <Icon name="expand_more" className="text-[20px]" />
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t border-slate-100 dark:border-slate-800 animate-slide-down">
                                        <p className="text-[12.5px] sm:text-sm font-medium text-slate-655 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pt-4 text-justify">
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
