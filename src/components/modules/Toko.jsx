import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, GOOGLE_DRIVE_API_URL } from '../../utils/helpers.js';

function Toko({ tokoProducts, setTokoProducts, tokoOrders, setTokoOrders, userRole, identity, changeTab, kasRtBalance, setKasRtBalance, kasRtTransactions, setKasRtTransactions }) {
    const [view, setView] = useState('list');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [orderQty, setOrderQty] = useState(1);
    const [cart, setCart] = useState({});
    const [checkoutForm, setCheckoutForm] = useState({ namaWarga: '', noWa: '', alamat: '', catatan: '' });
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({ judul: '', kategori: '', deskripsi: '', imageUrl: '', isPublished: true, grosirMinQty: '', grosirPrice: '', donasiKas: 0, variants: [{ id: Date.now(), name: 'Default', price: 0 }] });
    const [isUploading, setIsUploading] = useState(false);
    const [activeOrderTab, setActiveOrderTab] = useState('Menunggu');
    const [tokoConfirm, setTokoConfirm] = useState(null); // { message, onConfirm }
    const [selectedCategory, setSelectedCategory] = useState('Semua');

    const cartItemCount = Object.keys(cart).length;
    const cartTotal = Object.values(cart).reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Cek redirect / direct link dari Landing Page atau mount
    useEffect(() => {
        const openIdOrSku = sessionStorage.getItem('openTokoProductId');
        if (openIdOrSku && tokoProducts.length > 0) {
            const p = tokoProducts.find(i => String(i.id) === String(openIdOrSku) || String(i.sku) === String(openIdOrSku));
            if (p) { 
                setSelectedProduct(p); 
                setSelectedVariant(p.variants[0] || null); 
                setOrderQty(1); 
                setView('detail'); 
                sessionStorage.removeItem('openTokoProductId');
            }
        }

        const addIdOrSku = sessionStorage.getItem('addToCartProductId');
        if (addIdOrSku && tokoProducts.length > 0) {
            const p = tokoProducts.find(i => String(i.id) === String(addIdOrSku) || String(i.sku) === String(addIdOrSku));
            if (p) {
                const variant = p.variants[0];
                const qty = 1;
                let price = variant.price;
                if (p.grosirMinQty > 0 && qty >= p.grosirMinQty && p.grosirPrice > 0) price = p.grosirPrice;
                const key = `${p.id}_${variant.id}`;
                setCart(prev => ({ ...prev, [key]: { product: p, variant: variant, qty: (prev[key]?.qty || 0) + 1, price } }));
                showToast('Ditambahkan ke keranjang!');
                setView('cart');
                sessionStorage.removeItem('addToCartProductId');
            }
        }
    }, [tokoProducts]);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0]; if (!file) return; setIsUploading(true);
        try {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const img = new Image();
            img.src = URL.createObjectURL(file); await new Promise(r => img.onload = r);
            let width = img.width; let height = img.height; const MAX = 800;
            if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } } else { if (height > MAX) { width *= MAX / height; height = MAX; } }
            canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
            const b64 = canvas.toDataURL('image/webp', 0.8);
            const res = await fetch(GOOGLE_DRIVE_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ filename: file.name.split('.')[0] + '.webp', mimeType: 'image/webp', fileData: b64 }) });
            const json = await res.json();
            if (json.status === 'success') { setProductForm(prev => ({ ...prev, imageUrl: json.url })); showToast('Gambar berhasil diunggah!'); }
            else throw new Error(json.message);
        } catch (err) { showToast('Gagal upload: ' + err.message, 'error'); } finally { setIsUploading(false); }
    };

    const addToCart = () => {
        if (!selectedVariant || orderQty <= 0) return showToast('Pilih varian & kuantitas!', 'error');
        let price = selectedVariant.price;
        if (selectedProduct.grosirMinQty > 0 && orderQty >= selectedProduct.grosirMinQty && selectedProduct.grosirPrice > 0) price = selectedProduct.grosirPrice;
        const key = `${selectedProduct.id}_${selectedVariant.id}`;
        setCart(prev => ({ ...prev, [key]: { product: selectedProduct, variant: selectedVariant, qty: (prev[key]?.qty || 0) + safeNumber(orderQty), price } }));
        showToast('Ditambahkan ke keranjang!'); setView('list');
    };

    const openWaNotification = (orderId, status) => {
        const order = tokoOrders.find(o => o.id === orderId);
        if (!order) return;
        
        let message = '';
        const orderIdShort = `#TK-${String(order.id).slice(-6)}`;
        const totalFormatted = formatRp(order.totalAmount);
        
        if (status === 'Diproses') {
            message = `Halo ${order.wargaName}, pesanan Anda ${orderIdShort} di Official Store RT sedang diproses. Mohon ditunggu ya! Terima kasih.`;
        } else if (status === 'Diantar') {
            message = `Halo ${order.wargaName}, pesanan Anda ${orderIdShort} di Official Store RT sedang dalam perjalanan ke alamat Anda (${order.address}). Silakan siapkan pembayaran tunai (COD) sebesar ${totalFormatted}. Terima kasih.`;
        } else if (status === 'Selesai') {
            message = `Halo ${order.wargaName}, pesanan Anda ${orderIdShort} di Official Store RT telah selesai diantar. Terima kasih telah berbelanja dan mendukung Kas RT!`;
        } else if (status === 'Dibatalkan') {
            message = `Halo ${order.wargaName}, mohon maaf pesanan Anda ${orderIdShort} di Official Store RT dibatalkan. Silakan hubungi admin untuk info lebih lanjut. Terima kasih.`;
        }
        
        if (message) {
            const formattedPhone = order.phone.replace(/\D/g, '');
            let waPhone = formattedPhone;
            if (formattedPhone.startsWith('0')) {
                waPhone = '62' + formattedPhone.substring(1);
            } else if (!formattedPhone.startsWith('62')) {
                waPhone = '62' + formattedPhone;
            }
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
        }
    };

    const updateOrderStatus = (orderId, newStatus) => {
        const updatedOrders = tokoOrders.map(order => {
            if (order.id === orderId) {
                // If moving to "Selesai" and order has donasiKasAmount
                if (newStatus === 'Selesai' && order.status !== 'Selesai') {
                    const donation = order.donasiKasAmount || 0;
                    if (donation > 0 && setKasRtBalance && setKasRtTransactions) {
                        setKasRtBalance(prev => prev + donation);
                        const newTrx = {
                            id: Date.now(),
                            date: new Date().toISOString(),
                            type: 'income',
                            category: 'Official Store',
                            amount: donation,
                            description: `Kontribusi Toko RT (Order #TK-${String(order.id).slice(-6)})`,
                            recordedBy: identity?.name || 'System'
                        };
                        setKasRtTransactions(prev => [newTrx, ...prev]);
                    }
                }
                return { ...order, status: newStatus };
            }
            return order;
        });
        setTokoOrders(updatedOrders);
        showToast(`Pesanan diupdate ke ${newStatus}.`);
        openWaNotification(orderId, newStatus);
    };

    const processCheckout = () => {
        if (!checkoutForm.namaWarga || !checkoutForm.noWa || !checkoutForm.alamat) return showToast('Lengkapi nama, No WA, dan alamat!', 'error');
        if (cartItemCount === 0) return showToast('Keranjang kosong.', 'error');
        const donasiKasAmount = Object.values(cart).reduce((sum, item) => sum + (safeNumber(item.product.donasiKas || 0) * item.qty), 0);
        setTokoOrders([...tokoOrders, { id: Date.now(), wargaName: checkoutForm.namaWarga, phone: checkoutForm.noWa, address: checkoutForm.alamat, notes: checkoutForm.catatan, items: Object.values(cart), totalAmount: cartTotal, donasiKasAmount, status: 'Menunggu', orderDate: new Date().toISOString() }]);
        setCart({}); setCheckoutForm({ namaWarga: '', noWa: '', alamat: '', catatan: '' });
        showToast('Pesanan berhasil dibuat! Tim kami akan menghubungi Anda.'); setView('list');
    };

    const saveProduct = () => {
        if (!productForm.judul || productForm.variants.length === 0) return showToast('Judul & minimal 1 varian wajib diisi.', 'error');
        
        // Generate SKU otomatis jika belum ada
        const sku = productForm.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;

        if (editingProduct) { setTokoProducts(tokoProducts.map(p => p.id === editingProduct.id ? { ...p, ...productForm, sku } : p)); showToast('Produk diperbarui.'); }
        else { setTokoProducts([...tokoProducts, { id: Date.now(), createdAt: new Date().toISOString(), ...productForm, sku }]); showToast('Produk baru ditambahkan.'); }
        setIsFormOpen(false); setEditingProduct(null);
    };

    // ===== HEADER SHARED =====
    const PageHeader = ({ title, subtitle, onBack, children }) => (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-5 sm:pb-6 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 min-w-0">
                <button onClick={onBack} className="w-10 h-10 shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 shadow-sm transition-all text-slate-800 dark:text-white">
                    <Icon name="arrow_back" className="text-[18px]" />
                </button>
                <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-medium text-slate-800 dark:text-white tracking-tight truncate">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 hidden sm:block">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );

    // ===== VIEW: KERANJANG =====
    if (view === 'cart') return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <PageHeader title="Keranjang Belanja" subtitle="Review & checkout pesanan Anda" onBack={() => setView('list')} />
            {cartItemCount === 0 ? (
                <div className="bg-white dark:bg-slate-900 p-10 sm:p-16 rounded-3xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                    <Icon name="shopping_cart" className="text-[56px] text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Keranjang masih kosong.</p>
                    <button onClick={() => setView('list')} className="mt-4 px-5 py-2 bg-google-blue hover:bg-google-blueDark dark:bg-blue-600 dark:hover:bg-blue-750 text-white rounded-full font-medium text-xs transition-all">Lihat Produk</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Ringkasan Pesanan */}
                    <div className="space-y-8">
                        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                            <h3 className="font-medium text-slate-800 dark:text-white text-base sm:text-lg border-b border-slate-100 dark:border-slate-800 pb-4">Ringkasan Pesanan</h3>
                            {Object.entries(cart).map(([key, item]) => (
                                <div key={key} className="flex gap-4 justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0">
                                    <div className="flex gap-3 sm:gap-4 items-center flex-1 min-w-0">
                                        {item.product.imageUrl ? <img src={item.product.imageUrl} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover shrink-0" /> : <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0"><Icon name="storefront" className="text-slate-400 text-[16px]" /></div>}
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-white line-clamp-1">{item.product.judul}</p>
                                            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 dark:text-slate-400">{item.variant.name} &bull; {item.qty}x {formatRp(item.price)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs sm:text-sm font-medium text-google-green dark:text-google-greenLight">{formatRp(item.price * item.qty)}</p>
                                        <button onClick={() => { const nc = {...cart}; delete nc[key]; setCart(nc); }} className="text-[10px] sm:text-[11px] text-red-500 font-medium hover:underline mt-0.5">Hapus</button>
                                    </div>
                                </div>
                            ))}
                            <div className="bg-slate-50 dark:bg-slate-850 px-5 py-4 rounded-xl flex justify-between items-center border border-slate-200 dark:border-slate-800">
                                <span className="font-medium text-slate-600 dark:text-slate-300 text-sm">Total Belanja</span>
                                <span className="text-base sm:text-lg font-medium text-google-green dark:text-google-greenLight">{formatRp(cartTotal)}</span>
                            </div>
                        </div>
                        <div className="bg-google-greenLight/20 dark:bg-google-greenDark/10 border border-google-green/30 p-5 rounded-2xl flex gap-4 items-start">
                            <Icon name="local_shipping" className="text-google-green text-[20px] shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-google-greenDark dark:text-google-greenLight text-sm">Gratis Ongkir & COD</p>
                                <p className="text-xs text-google-greenDark/80 dark:text-google-greenLight/80 mt-0.5 leading-relaxed">Pesanan diantar langsung ke rumah Anda. Pembayaran tunai saat barang tiba.</p>
                            </div>
                        </div>
                    </div>
                    {/* Form Pengiriman */}
                    <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-7">
                        <h3 className="font-medium text-slate-800 dark:text-white text-base sm:text-lg border-b border-slate-100 dark:border-slate-800 pb-4">Data Pengiriman</h3>
                        {[
                            { label: 'Nama Lengkap Pemesan *', key: 'namaWarga', type: 'text', placeholder: 'Nama Anda...' },
                            { label: 'Nomor WhatsApp *', key: 'noWa', type: 'number', placeholder: '08xx...' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">{f.label}</label>
                                <input type={f.type} value={checkoutForm[f.key]} onChange={e => setCheckoutForm({...checkoutForm, [f.key]: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-google-green dark:focus:border-green-500 text-slate-800 dark:text-white rounded-xl px-5 py-3.5 text-sm font-medium outline-none transition-colors" placeholder={f.placeholder} />
                            </div>
                        ))}
                        {[
                            { label: 'Alamat / Blok RT *', key: 'alamat', placeholder: 'RT 01 / Blok A No. 12...' },
                            { label: 'Catatan (Opsional)', key: 'catatan', placeholder: 'Cth: Diantar sore hari...' },
                        ].map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">{f.label}</label>
                                <textarea rows="2" value={checkoutForm[f.key]} onChange={e => setCheckoutForm({...checkoutForm, [f.key]: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-google-green dark:focus:border-green-500 text-slate-800 dark:text-white rounded-xl px-5 py-3.5 text-sm font-medium outline-none transition-colors resize-none" placeholder={f.placeholder} />
                            </div>
                        ))}
                        <button onClick={processCheckout} className="w-full bg-google-green hover:bg-google-greenDark dark:bg-green-600 dark:hover:bg-green-700 text-white font-medium py-3.5 sm:py-4 rounded-full shadow-md shadow-green-500/30 active:scale-95 transition-all text-sm">
                            ✓ Buat Pesanan & Bayar COD
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    // ===== VIEW: DETAIL PRODUK =====
    if (view === 'detail' && selectedProduct) {
        const effPrice = selectedProduct.grosirMinQty > 0 && orderQty >= selectedProduct.grosirMinQty && selectedProduct.grosirPrice > 0 ? selectedProduct.grosirPrice : (selectedVariant?.price || 0);
        return (
            <div className="space-y-8 max-w-7xl mx-auto">
                <PageHeader title="Detail Produk" onBack={() => setView('list')} />
                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col lg:flex-row">
                    {/* Gambar Produk - Aspect Square */}
                    <div className="lg:w-1/2 aspect-square bg-slate-100 dark:bg-slate-800 relative">
                        {selectedProduct.imageUrl
                            ? <img src={selectedProduct.imageUrl} className="absolute inset-0 w-full h-full object-cover" alt={selectedProduct.judul} />
                            : <div className="absolute inset-0 flex items-center justify-center"><Icon name="storefront" className="text-[56px] text-slate-300 dark:text-slate-650" /></div>}
                        {selectedProduct.grosirMinQty > 0 && <span className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-[9px] font-medium uppercase px-2.5 py-1 rounded-full shadow">Grosir Tersedia</span>}
                        
                        {/* Tombol Share */}
                        <button onClick={(e) => {
                            e.stopPropagation();
                            const cleanUrl = new URL(window.location.origin + window.location.pathname);
                            cleanUrl.searchParams.set('page', 'toko');
                            cleanUrl.searchParams.set('product', selectedProduct.sku || selectedProduct.id);
                            navigator.clipboard.writeText(cleanUrl.toString());
                            showToast('Tautan produk berhasil disalin!');
                        }} className="absolute top-3 right-3 w-8 h-8 bg-white/95 dark:bg-slate-900/95 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-google-blue hover:bg-white dark:hover:bg-slate-850 transition-colors shadow-sm" title="Bagikan Produk">
                            <Icon name="share" className="text-[14px]" />
                        </button>
                    </div>
                    {/* Info & Aksi */}
                    <div className="lg:w-1/2 p-4 sm:p-6 lg:p-8 space-y-7">
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h1 className="text-lg sm:text-2xl font-medium text-slate-800 dark:text-white tracking-tight">{selectedProduct.judul}</h1>
                                {selectedProduct.sku && (
                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                                        {selectedProduct.sku}
                                    </span>
                                )}
                            </div>
                            {selectedProduct.kategori && (
                                <span className="inline-block bg-google-blue/10 text-google-blue dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-md text-[10px] font-medium mb-3 uppercase tracking-wider border border-google-blue/20">
                                    {selectedProduct.kategori}
                                </span>
                            )}
                            {selectedProduct.donasiKas > 0 && (
                                <div className="mt-1 mb-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium px-3.5 py-2 rounded-xl border border-emerald-250 dark:border-emerald-900/40 flex items-center gap-1.5 w-fit">
                                    <Icon name="volunteer_activism" className="text-[15px]" fill="true" />
                                    <span>Beli produk ini = {formatRp(selectedProduct.donasiKas)} otomatis disumbangkan ke Kas RT</span>
                                </div>
                            )}
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedProduct.deskripsi}</p>
                        </div>
                        {/* Pilih Varian */}
                        <div>
                            <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Pilih Varian</label>
                            <div className="flex flex-wrap gap-2">
                                {selectedProduct.variants.map(v => (
                                    <button key={v.id} onClick={() => setSelectedVariant(v)}
                                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-full sm:rounded-full font-medium text-xs sm:text-sm border transition-all active:scale-95 ${selectedVariant?.id === v.id ? 'bg-google-blue text-white border-google-blueDark shadow-md' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-750 hover:border-google-blue/50'}`}>
                                        {v.name} &bull; {formatRp(v.price)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Qty */}
                        <div>
                            <label className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 block">Jumlah Beli (Qty)</label>
                            <div className="flex items-center gap-3">
                                <input type="number" step="0.1" min="0.1" value={orderQty} onChange={e => setOrderQty(e.target.value)} className="w-20 sm:w-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-google-blue dark:focus:border-blue-500 text-slate-800 dark:text-white rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-center font-medium text-sm outline-none" />
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bisa desimal (cth: 1.5)</span>
                            </div>
                            {selectedProduct.grosirMinQty > 0 && selectedProduct.grosirPrice > 0 && (
                                <div className="bg-google-yellowLight/20 border border-google-yellow/40 p-3 rounded-xl flex gap-2 items-start mt-3">
                                    <Icon name="sell" className="text-google-yellowDark text-[16px] shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-google-yellowDark dark:text-google-yellowLight font-medium leading-relaxed">
                                        Beli <span className="underline underline-offset-1">{selectedProduct.grosirMinQty}</span>+ dapat harga grosir: <span className="underline underline-offset-1">{formatRp(selectedProduct.grosirPrice)}</span>/varian
                                        {safeNumber(orderQty) >= safeNumber(selectedProduct.grosirMinQty) && <span className="ml-2 bg-green-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium">✓ Aktif!</span>}
                                    </p>
                                </div>
                            )}
                        </div>
                        {/* Subtotal & CTA */}
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-medium text-slate-600 dark:text-slate-300 text-sm">Subtotal</span>
                                <span className="text-lg sm:text-xl font-medium text-google-green dark:text-google-greenLight">{formatRp(effPrice * safeNumber(orderQty))}</span>
                            </div>
                            <button onClick={addToCart} className="btn-native-primary w-full bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20 border-emerald-500/30 flex justify-center items-center gap-2">
                                <Icon name="add_shopping_cart" className="text-[18px]" /> Tambah ke Keranjang
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ===== VIEW: ADMIN - KELOLA PRODUK =====
    if (view === 'admin-products') return (
        <>
        <div className="space-y-7">
            <PageHeader title="Kelola Katalog Produk" subtitle="Tambah, edit, dan hapus produk toko" onBack={() => setView('list')}>
                <button onClick={() => { setProductForm({ judul: '', kategori: '', deskripsi: '', imageUrl: '', isPublished: true, grosirMinQty: '', grosirPrice: '', donasiKas: 0, variants: [{ id: Date.now(), name: 'Reguler', price: 0 }] }); setEditingProduct(null); setIsFormOpen(true); }} className="bg-google-blue text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full font-medium text-xs sm:text-[13px] hover:bg-google-blueDark shadow-sm flex items-center gap-1.5 active:scale-95 transition-all">
                    <Icon name="add" className="text-[16px] sm:text-[18px]" /> <span className="hidden sm:inline">Produk</span> Baru
                </button>
            </PageHeader>

            {isFormOpen && (
                <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl border border-google-blue dark:border-blue-600 shadow-lg space-y-7">
                    <h3 className="font-medium text-slate-800 dark:text-white text-base sm:text-lg border-b border-slate-200 dark:border-slate-800 pb-3">{editingProduct ? ' Edit Produk' : '+ Produk Baru'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Kolom Kiri */}
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Nama / Judul Produk *</label>
                                <input type="text" value={productForm.judul} onChange={e => setProductForm({...productForm, judul: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 focus:border-google-blue dark:focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-sm font-medium outline-none transition-colors text-slate-800 dark:text-white" placeholder="Beras Premium 5Kg..." />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Kategori Produk</label>
                                <input list="kategori-options" type="text" value={productForm.kategori || ''} onChange={e => setProductForm({...productForm, kategori: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 focus:border-google-blue dark:focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-sm font-medium outline-none transition-colors text-slate-800 dark:text-white" placeholder="Pilih atau Ketik Kategori Baru..." />
                                <datalist id="kategori-options">
                                    <option value="Sembako & Kebutuhan Harian" />
                                    <option value="Makanan & Minuman" />
                                    <option value="Pakaian & Fashion" />
                                    <option value="Elektronik & Gadget" />
                                    <option value="Jasa & Layanan" />
                                    {Array.from(new Set(tokoProducts.map(p => p.kategori).filter(Boolean))).map(kat => (
                                        <option key={kat} value={kat} />
                                    ))}
                                </datalist>
                            </div>
                            {productForm.sku && (
                                <div>
                                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Kode SKU Produk (Otomatis)</label>
                                    <input type="text" value={productForm.sku} readOnly className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed" />
                                </div>
                            )}
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Deskripsi Produk</label>
                                <textarea rows="3" value={productForm.deskripsi} onChange={e => setProductForm({...productForm, deskripsi: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 focus:border-google-blue dark:focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-colors resize-none text-slate-800 dark:text-white" placeholder="Deskripsi produk..." />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Donasi Kas RT per Unit (Rp)</label>
                                <input type="number" value={productForm.donasiKas || 0} onChange={e => setProductForm({...productForm, donasiKas: safeNumber(e.target.value)})} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 focus:border-google-blue dark:focus:border-blue-500 rounded-xl px-4 py-2.5 sm:py-3 text-sm font-medium outline-none transition-colors text-slate-800 dark:text-white" placeholder="Cth: 1000" />
                            </div>
                            {/* Upload Gambar */}
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Gambar Produk (Auto GDrive)</label>
                                <div className={`flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border ${isUploading ? 'border-google-blue' : productForm.imageUrl ? 'border-google-green' : 'border-slate-200 dark:border-slate-750'} p-3 rounded-2xl relative overflow-hidden transition-all`}>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 dark:border-slate-700 z-0 overflow-hidden">
                                        {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin" />
                                            : productForm.imageUrl ? <img src={productForm.imageUrl} className="w-full h-full object-cover" />
                                            : <Icon name="cloud_upload" className="text-[22px] text-slate-400" />}
                                    </div>
                                    <div className="z-0 flex-1 min-w-0">
                                        <p className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate">{isUploading ? 'Mengunggah...' : productForm.imageUrl ? '✓ Gambar Tersimpan' : 'Ketuk untuk pilih gambar'}</p>
                                        <p className="text-[10px] text-slate-450 dark:text-slate-400 font-medium mt-0.5">Otomatis diupload & dikompresi</p>
                                    </div>
                                </div>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl hover:border-google-blue transition-colors">
                                <input type="checkbox" checked={productForm.isPublished} onChange={e => setProductForm({...productForm, isPublished: e.target.checked})} className="w-5 h-5 accent-google-blue rounded" />
                                <div>
                                    <p className="font-medium text-sm text-slate-700 dark:text-slate-300">Publikasikan ke Warga</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Produk akan tampil di halaman warga & landing page</p>
                                </div>
                            </label>
                        </div>
                        {/* Kolom Kanan */}
                        <div className="space-y-7">
                            {/* Varian & Harga */}
                            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-750 space-y-5">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-slate-700 dark:text-slate-300 text-sm">Varian & Harga</h4>
                                    <button onClick={() => setProductForm({...productForm, variants: [...productForm.variants, { id: Date.now(), name: '', price: 0 }]})} className="text-xs font-medium text-google-blue flex items-center gap-0.5 hover:underline"><Icon name="add" className="text-[14px]" />Tambah</button>
                                </div>
                                {productForm.variants.map((v, i) => (
                                    <div key={v.id} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                                        <input type="text" value={v.name} onChange={e => { const nv = [...productForm.variants]; nv[i].name = e.target.value; setProductForm({...productForm, variants: nv}); }} placeholder="Nama Varian" className="w-full sm:flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-google-blue dark:focus:border-blue-500 text-slate-800 dark:text-white" />
                                        <div className="flex gap-2 w-full sm:w-auto sm:flex-1 items-center">
                                            <input type="number" value={v.price} onChange={e => { const nv = [...productForm.variants]; nv[i].price = safeNumber(e.target.value); setProductForm({...productForm, variants: nv}); }} placeholder="Harga" className="w-full flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-google-blue dark:focus:border-blue-500 text-slate-800 dark:text-white" />
                                            {productForm.variants.length > 1 && <button onClick={() => setProductForm({...productForm, variants: productForm.variants.filter(va => va.id !== v.id)})} className="w-7 h-7 shrink-0 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200"><Icon name="close" className="text-[14px]" /></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Grosir */}
                            <div className="bg-yellow-50 dark:bg-yellow-950/10 p-4 rounded-2xl border border-yellow-200 dark:border-yellow-900/30 space-y-5">
                                <h4 className="font-medium text-yellow-800 dark:text-yellow-500 text-sm flex items-center gap-1.5"><Icon name="sell" className="text-[16px]" />Harga Grosir (Opsional)</h4>
                                <p className="text-[11px] text-yellow-700 dark:text-yellow-600 font-medium leading-relaxed">Warga yang membeli  Qty ini akan otomatis mendapat harga grosir.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <div>
                                        <label className="text-[10px] font-medium text-yellow-700 dark:text-yellow-500 mb-1 block">Min. Qty</label>
                                        <input type="number" value={productForm.grosirMinQty} onChange={e => setProductForm({...productForm, grosirMinQty: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-yellow-350 dark:border-yellow-900/40 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-yellow-500 text-slate-800 dark:text-white" placeholder="cth: 5" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-medium text-yellow-700 dark:text-yellow-500 mb-1 block">Harga Grosir</label>
                                        <input type="number" value={productForm.grosirPrice} onChange={e => setProductForm({...productForm, grosirPrice: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-yellow-350 dark:border-yellow-900/40 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:border-yellow-500 text-slate-800 dark:text-white" placeholder="Rp..." />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 justify-end">
                        <button onClick={() => { setIsFormOpen(false); setEditingProduct(null); }} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all border border-slate-300 dark:border-slate-750 text-sm">Batal</button>
                        <button onClick={saveProduct} className="px-5 py-2.5 bg-google-blue text-white font-medium rounded-full hover:bg-google-blueDark active:scale-95 transition-all shadow-md text-sm">Simpan Produk</button>
                    </div>
                </div>
            )}

            {!isFormOpen && (
                <>
                    {/* Mobile Cards (< md) */}
                    <div className="md:hidden space-y-5">
                        {tokoProducts.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 dark:text-slate-500 font-medium text-sm">Belum ada produk.</div>
                        ) : tokoProducts.map((p, idx) => (
                            <div key={p.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex gap-3 items-start">
                                {p.imageUrl ? <img src={p.imageUrl} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-slate-850" /> : <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"><Icon name="storefront" className="text-slate-400 dark:text-slate-650" /></div>}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-medium text-sm text-slate-800 dark:text-white line-clamp-1">{p.judul}</p>
                                            {p.sku && <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{p.sku}</p>}
                                        </div>
                                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase ${p.isPublished ? 'bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{p.isPublished ? 'Publik' : 'Draft'}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 space-y-0.5">
                                        {p.variants.slice(0,2).map((v,i) => <div key={i}>&bull; {v.name}: <span className="font-medium text-slate-700 dark:text-slate-300">{formatRp(v.price)}</span></div>)}
                                        {p.variants.length > 2 && <div className="text-slate-400 dark:text-slate-500">+{p.variants.length-2} varian lainnya</div>}
                                    </div>
                                    {p.grosirMinQty > 0 && <span className="inline-block mt-1.5 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-500 text-[9px] font-medium rounded">Grosir</span>}
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => { setEditingProduct(p); setProductForm({ donasiKas: 0, ...p }); setIsFormOpen(true); }} className="flex-1 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium flex items-center justify-center gap-1 hover:bg-blue-100"><Icon name="edit" className="text-[14px]" />Edit</button>
                                        <button onClick={() => { setTokoConfirm({ message: 'Yakin ingin menghapus produk ini?', onConfirm: () => setTokoProducts(tokoProducts.filter(x => x.id !== p.id)) }); }} className="flex-1 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-xs font-medium flex items-center justify-center gap-1 hover:bg-red-100"><Icon name="delete" className="text-[14px]" />Hapus</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Desktop Table (>= md) */}
                    <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[780px]">
                                <thead><tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <th className="p-5 sm:px-6 sm:py-5 w-12 text-center text-slate-500 dark:text-slate-400">No</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-slate-500 dark:text-slate-400">Info Produk</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-slate-500 dark:text-slate-400">Kategori</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-slate-500 dark:text-slate-400">Varian & Harga</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-center text-slate-500 dark:text-slate-400">Status</th>
                                    <th className="p-5 sm:px-6 sm:py-5 text-right text-slate-500 dark:text-slate-400">Aksi</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {tokoProducts.length === 0 ? <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-medium">Belum ada produk.</td></tr>
                                    : tokoProducts.map((p, idx) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="p-5 sm:px-6 sm:py-5 text-center font-medium text-slate-400 text-sm">{idx+1}</td>
                                            <td className="p-5 sm:px-6 sm:py-5">
                                                <div className="flex items-center gap-3">
                                                    {p.imageUrl ? <img src={p.imageUrl} className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0" /> : <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 flex items-center justify-center"><Icon name="storefront" className="text-slate-400" /></div>}
                                                    <div>
                                                        <p className="font-medium text-sm text-slate-800 dark:text-white">{p.judul}</p>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                            {p.sku && <span className="text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{p.sku}</span>}
                                                            {p.grosirMinQty > 0 && <span className="inline-block px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-500 text-[9px] font-medium rounded uppercase">Grosir Aktif</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5 sm:px-6 sm:py-5">
                                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 whitespace-nowrap inline-block">
                                                    {p.kategori || 'Belum Diatur'}
                                                </span>
                                            </td>
                                            <td className="p-5 sm:px-6 sm:py-5 text-xs font-medium text-slate-600 dark:text-slate-300 space-y-1">{p.variants.map((v,i) => <div key={i}>&bull; {v.name}: <span className="font-medium text-slate-800 dark:text-white">{formatRp(v.price)}</span></div>)}</td>
                                            <td className="p-5 sm:px-6 sm:py-5 text-center"><span className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase ${p.isPublished ? 'bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{p.isPublished ? 'Publik' : 'Draft'}</span></td>
                                            <td className="p-5 sm:px-6 sm:py-5 text-right space-x-2 flex items-center justify-end">
                                                <button onClick={() => { setEditingProduct(p); setProductForm({ donasiKas: 0, ...p }); setIsFormOpen(true); }} className="w-8 h-8 flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30"><Icon name="edit" className="text-[15px]" /></button>
                                                <button onClick={() => { setTokoConfirm({ message: 'Yakin ingin menghapus produk ini?', onConfirm: () => setTokoProducts(tokoProducts.filter(x => x.id !== p.id)) }); }} className="w-8 h-8 flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"><Icon name="delete" className="text-[15px]" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>

        {/* Modern Confirm Modal */}
        {tokoConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                <div className="w-full max-w-xs text-center modal-card animate-modal-in p-7">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="warning" className="text-[32px] text-red-500" fill="true" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Konfirmasi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{tokoConfirm.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setTokoConfirm(null)} className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                        <button onClick={() => { tokoConfirm.onConfirm(); setTokoConfirm(null); }} className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );

    // ===== VIEW: ADMIN - KELOLA PESANAN =====
    if (view === 'admin-orders') return (
        <>
        <div className="space-y-7">
            <PageHeader title="Pesanan Masuk" subtitle="Kelola dan pantau status pesanan warga" onBack={() => setView('list')} />
            {/* Tab Status */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['Menunggu', 'Diproses', 'Diantar', 'Selesai', 'Dibatalkan'].map(tab => (
                    <button key={tab} onClick={() => setActiveOrderTab(tab)} className={`shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-[11px] sm:text-xs transition-all border ${activeOrderTab === tab ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-slate-800 dark:border-slate-200 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-850 hover:border-slate-400'}`}>
                        {tab} <span className={`${activeOrderTab === tab ? 'opacity-70' : 'opacity-50'}`}>({tokoOrders.filter(o => o.status === tab).length})</span>
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tokoOrders.filter(o => o.status === activeOrderTab).length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-400 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-sm">Tidak ada pesanan di tab ini.</div>
                ) : tokoOrders.filter(o => o.status === activeOrderTab).sort((a,b) => new Date(b.orderDate) - new Date(a.orderDate)).map(order => (
                    <div key={order.id} className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                    <Icon name="receipt_long" className="text-[16px]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Order ID</p>
                                    <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300">#TK-{String(order.id).slice(-6)}</p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-[9px] font-medium uppercase shrink-0 border ${order.status === 'Menunggu' ? 'bg-amber-50 border-amber-200 text-amber-700' : order.status === 'Diproses' ? 'bg-google-blueLight border-google-blue/30 text-google-blueDark' : order.status === 'Diantar' ? 'bg-slate-100 border-slate-300 text-slate-600' : order.status === 'Selesai' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{order.status}</span>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-5">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Pemesan</p>
                                    <h4 className="font-medium text-[15px] text-slate-800 dark:text-slate-100 mt-0.5">{order.wargaName}</h4>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Total</p>
                                    <p className="text-[14px] font-medium text-rose-600 dark:text-rose-500">{formatRp(order.totalAmount)}</p>
                                </div>
                            </div>
                            {order.donasiKasAmount > 0 && (
                                <div className="flex justify-between items-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <span>Kontribusi Kas RT:</span>
                                    <span>{formatRp(order.donasiKasAmount)}</span>
                                </div>
                            )}
                            
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-750">
                                <p className="text-[10px] font-medium text-slate-400 uppercase mb-2">Rincian Belanja</p>
                                <div className="space-y-2">
                                    {order.items.map((it, idx) => (
                                        <div key={it.variantKey || it.product?.id || idx} className="flex gap-2 items-start text-xs">
                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 p-0.5">
                                                {it.product.imageUrl ? <img src={it.product.imageUrl} className="w-full h-full object-cover rounded-md" /> : <Icon name="storefront" className="text-[14px] text-slate-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <p className="font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{it.product.judul}</p>
                                                <p className="text-[10px] font-medium text-slate-500">{it.variant.name} &bull; {it.qty}x {formatRp(it.price)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2 flex-1">
                            <div className="flex items-start gap-2 text-[11.5px] text-slate-600 dark:text-slate-300 font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-750">
                                <div className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                                    <Icon name="local_shipping" className="text-[13px] text-rose-500" />
                                </div>
                                <div className="flex-1">
                                    <span className="font-medium text-slate-800 dark:text-white">Alamat Pengiriman</span>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-450 mt-1">{order.address}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between gap-2 text-[11.5px] font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-750">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        <Icon name="call" className="text-[13px] text-slate-500" />
                                    </div>
                                    <span className="font-medium text-slate-800 dark:text-white">WhatsApp</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={`https://wa.me/${order.phone.replace(/^0/,'62')}`} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:underline font-medium">{order.phone}</a>
                                    {order.status !== 'Menunggu' && (
                                        <button onClick={() => openWaNotification(order.id, order.status)} className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-250 dark:border-emerald-900/40 p-1 px-2.5 rounded-lg text-[10px] font-medium flex items-center gap-1 active:scale-95 transition-all">
                                            <Icon name="send" className="text-[10px]" /> Notif WA
                                        </button>
                                    )}
                                </div>
                            </div>

                            {order.notes && (
                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                    <Icon name="chat_bubble" className="text-[14px] mt-0.5 shrink-0 text-amber-500" />
                                    <span><span className="font-medium text-slate-800 dark:text-white">Catatan:</span> {order.notes}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 mb-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                <Icon name="event" className="text-[13px]" /> {order.orderDate ? new Date(order.orderDate).toLocaleString('id-ID', {dateStyle:'short', timeStyle:'short'}) : '-'}
                            </div>
                        </div>

                        <div className="flex gap-2 mt-auto pt-1">
                            {order.status === 'Menunggu' && <button onClick={() => updateOrderStatus(order.id, 'Diproses')} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-full text-xs font-medium transition-colors">Proses</button>}
                            {order.status === 'Diproses' && <button onClick={() => updateOrderStatus(order.id, 'Diantar')} className="flex-1 bg-slate-600 hover:bg-slate-700 text-white py-2 rounded-full text-xs font-medium transition-colors">Mulai Antar</button>}
                            {order.status === 'Diantar' && <button onClick={() => updateOrderStatus(order.id, 'Selesai')} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-full text-xs font-medium transition-colors">Selesai ✓</button>}
                            {(order.status === 'Menunggu' || order.status === 'Diproses') && <button onClick={() => { setTokoConfirm({ message: 'Batalkan pesanan ini?', onConfirm: () => updateOrderStatus(order.id, 'Dibatalkan') }); }} className="px-3 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/40 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 py-2 rounded-full text-xs font-medium transition-colors">Batal</button>}
                            <button onClick={() => { setTokoConfirm({ message: 'Hapus pesanan ini secara permanen?', onConfirm: () => setTokoOrders(tokoOrders.filter(o => o.id !== order.id)) }); }} className="px-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 py-2 rounded-full text-xs font-medium transition-colors flex items-center justify-center" title="Hapus Permanen">
                                <Icon name="delete" className="text-[15px]" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Modern Confirm Modal */}
        {tokoConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                <div className="w-full max-w-xs text-center modal-card animate-modal-in p-7">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="warning" className="text-[32px] text-red-500" fill="true" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Konfirmasi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{tokoConfirm.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setTokoConfirm(null)} className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                        <button onClick={() => { tokoConfirm.onConfirm(); setTokoConfirm(null); }} className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );

    // ===== DEFAULT VIEW: GRID KATALOG PRODUK =====
    return (
        <>
        <div className="space-y-7">
            {/* Header Toko */}
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-medium text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                            <Icon name="storefront" className="text-google-green text-[26px] sm:text-3xl" fill="true" /> Official Store
                        </h2>
                        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Layanan belanja hemat, gratis ongkir, bayar di tempat (COD).</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {userRole === 'admin' && (<>
                            <button onClick={() => setView('admin-products')} className="px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 text-google-blue dark:text-google-blueLight border border-google-blue dark:border-google-blue/40 rounded-full font-medium text-xs hover:bg-google-blue hover:text-white dark:hover:bg-google-blue transition-all">Kelola Katalog</button>
                            <button onClick={() => setView('admin-orders')} className="relative px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 text-yellow-700 dark:text-yellow-500 border border-yellow-400 dark:border-yellow-600/50 rounded-full font-medium text-xs hover:bg-yellow-400 hover:text-white dark:hover:bg-yellow-500 transition-all">
                                Pesanan
                                {tokoOrders.filter(o => o.status === 'Menunggu' || o.status === 'Diproses').length > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-medium animate-bounce">{tokoOrders.filter(o => o.status === 'Menunggu' || o.status === 'Diproses').length}</span>}
                            </button>
                        </>)}
                        <button onClick={() => setView('cart')} className="px-3 sm:px-5 py-2 sm:py-2.5 bg-google-green hover:bg-google-greenDark dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-full font-medium text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5 active:scale-95">
                            <Icon name="shopping_cart" className="text-[16px] sm:text-[18px]" />
                            <span>Keranjang</span>
                            {cartItemCount > 0 && <span className="bg-white text-google-green min-w-[20px] h-[20px] flex items-center justify-center rounded-full text-[10px] sm:text-[11px] font-bold px-1">{cartItemCount}</span>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Kategori Tabs */}
            {Array.from(new Set(tokoProducts.filter(p => p.isPublished).map(p => p.kategori).filter(Boolean))).length > 0 && (
                <div className="slide-list-scroller flex gap-2 pb-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
                    <button onClick={() => setSelectedCategory('Semua')}
                        className={`shrink-0 px-4 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all border ${selectedCategory === 'Semua' ? 'bg-google-blue text-white border-google-blueDark shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-google-blue/40'}`}>
                        Semua
                    </button>
                    {Array.from(new Set(tokoProducts.filter(p => p.isPublished).map(p => p.kategori).filter(Boolean))).map(kat => (
                        <button key={kat} onClick={() => setSelectedCategory(kat)}
                            className={`shrink-0 px-4 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all border ${selectedCategory === kat ? 'bg-google-blue text-white border-google-blueDark shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-google-blue/40'}`}>
                            {kat}
                        </button>
                    ))}
                </div>
            )}

            {/* Grid Produk - 1:1 Aspect Ratio & SKU Share System */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                {tokoProducts.filter(p => p.isPublished && (selectedCategory === 'Semua' || p.kategori === selectedCategory)).length === 0 ? (
                    <div className="col-span-full py-16 text-center text-slate-400 dark:text-slate-500 font-medium text-sm bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">Belum ada produk yang dijual saat ini.</div>
                ) : tokoProducts.filter(p => p.isPublished && (selectedCategory === 'Semua' || p.kategori === selectedCategory)).map(item => (
                    <div key={item.id} onClick={() => { setSelectedProduct(item); setSelectedVariant(item.variants[0] || null); setOrderQty(1); setView('detail'); }}
                        className="bento-island-card p-0 overflow-hidden flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer font-sans">
                        {/* Gambar - 1:1 Ratio */}
                        <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                            {item.imageUrl
                                ? <img src={item.imageUrl} alt={item.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                : <Icon name="storefront" className="text-[40px] sm:text-[48px] text-slate-300 dark:text-slate-600" />}
                            {item.grosirMinQty > 0 && <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[8px] sm:text-[9px] font-medium uppercase px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full shadow-sm">Grosir</span>}
                            
                            {/* Tombol Share */}
                            <button onClick={(e) => {
                                e.stopPropagation();
                                const cleanUrl = new URL(window.location.origin + window.location.pathname);
                                cleanUrl.searchParams.set('page', 'toko');
                                cleanUrl.searchParams.set('product', item.sku || item.id);
                                navigator.clipboard.writeText(cleanUrl.toString());
                                showToast('Tautan produk berhasil disalin!');
                            }} className="absolute top-2 right-2 w-7 h-7 bg-white/95 dark:bg-slate-900/95 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-google-blue hover:bg-white dark:hover:bg-slate-850 transition-colors shadow-sm" title="Bagikan Produk">
                                <Icon name="share" className="text-[13px]" />
                            </button>
                        </div>
                        {/* Info */}
                        <div className="p-3 sm:p-4 space-y-1 flex-1 flex flex-col">
                            <h4 className="font-medium text-[13px] sm:text-[15px] text-slate-800 dark:text-white tracking-tight leading-tight line-clamp-2 group-hover:text-google-green transition-colors">{item.judul}</h4>
                            <div className="flex flex-wrap items-center gap-1">
                                {item.sku && <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-850 px-1 py-0.5 rounded">{item.sku}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-auto">
                                <span className="flex items-center gap-0.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800 uppercase tracking-wider"><Icon name="verified" className="text-[11px]" /> Official</span>
                                <span className="flex items-center gap-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800 uppercase tracking-wider"><Icon name="local_shipping" className="text-[11px]" /> Gratis Ongkir</span>
                                <span className="flex items-center gap-0.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 text-[8px] sm:text-[9px] font-medium px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-800 uppercase tracking-wider"><Icon name="payments" className="text-[11px]" /> COD</span>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center gap-2">
                            <div>
                                <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">Mulai dari</p>
                                <p className="text-[13px] sm:text-[14px] font-medium text-google-green dark:text-google-greenLight">{formatRp(Math.min(...item.variants.map(v => v.price)))}</p>
                            </div>
                            <div onClick={(e) => {
                                e.stopPropagation();
                                const variant = item.variants[0];
                                const qty = 1;
                                let price = variant.price;
                                if (item.grosirMinQty > 0 && qty >= item.grosirMinQty && item.grosirPrice > 0) price = item.grosirPrice;
                                const key = `${item.id}_${variant.id}`;
                                setCart(prev => ({ ...prev, [key]: { product: item, variant: variant, qty: (prev[key]?.qty || 0) + 1, price } }));
                                showToast('Ditambahkan ke keranjang!');
                                setView('cart');
                            }} className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shrink-0 cursor-pointer shadow-xs">
                                <Icon name="shopping_bag" className="text-[15px] sm:text-[18px]" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Modern Confirm Modal */}
        {tokoConfirm && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                <div className="w-full max-w-xs text-center modal-card animate-modal-in p-7">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Icon name="warning" className="text-[32px] text-red-500" fill="true" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-2">Konfirmasi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{tokoConfirm.message}</p>
                    <div className="flex gap-3">
                        <button onClick={() => setTokoConfirm(null)} className="flex-1 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Batal</button>
                        <button onClick={() => { tokoConfirm.onConfirm(); setTokoConfirm(null); }} className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors">Ya, Lanjutkan</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
// =====================================================

export default Toko;
