// ============================================================
// helpers.js - Fungsi pembantu & utilitas portal WARGA PAKEM
// ============================================================

export const GOOGLE_DRIVE_API_URL = "https://script.google.com/macros/s/AKfycbxYi3xmw3jsotb-pcipK4uRITqrIcNf-9CJ66Oa_ZjFpVw9R2q6w1zX7UlabKHAK_m0/exec";

export const getDirectImgUrl = (url) => {
    if (!url) return '';
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
        return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
    }
    return url;
};

export const getLocalDate = () => {
    const offset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - offset).toISOString().split('T')[0];
};

export const formatRp = (angka) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(angka || 0);

export const formatBulanTahun = (yyyy_mm) => {
    if (!yyyy_mm) return '-';
    const [year, month] = yyyy_mm.split('-');
    return new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
};

export const safeNumber = (val) =>
    val === '' ? '' : (isNaN(Math.abs(Number(val))) ? 0 : Math.abs(Number(val)));

export const parseLocalDate = (dateStr) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-');
    return new Date(+y, +m - 1, +d);
};

export const isNonaktif = (member) =>
    Boolean(member && (member.status === 'Meninggal' || member.status === 'Nonaktif'));

export const uploadToGoogleDrive = async (file, maxSize = 1200, quality = 0.82) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h && w > maxSize) {
                    h *= maxSize / w;
                    w = maxSize;
                } else if (h >= w && h > maxSize) {
                    w *= maxSize / h;
                    h = maxSize;
                }
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const compressedBase64 = canvas.toDataURL('image/webp', quality);

                try {
                    const response = await fetch(GOOGLE_DRIVE_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            filename: file.name.split('.')[0] + '.webp',
                            mimeType: 'image/webp',
                            fileData: compressedBase64
                        })
                    });
                    const data = await response.json();
                    if (data.status === 'success') {
                        resolve(data.url);
                    } else {
                        reject(data.message || 'Gagal upload ke Google Drive');
                    }
                } catch (error) {
                    reject('Koneksi upload gagal: ' + error.message);
                }
            };
            img.onerror = () => reject('Gagal memproses gambar');
            img.src = reader.result;
        };
        reader.onerror = () => reject('Gagal membaca file');
        reader.readAsDataURL(file);
    });
};
