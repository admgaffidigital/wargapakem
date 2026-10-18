import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, getLocalDate, uploadToGoogleDrive } from '../../utils/helpers.js';

        /* ================= COUNTDOWN TIMER COMPONENT ================= */
        function CountdownTimer({ deadline }) {
            const [timeLeft, setTimeLeft] = useState(null);

            useEffect(() => {
                if (!deadline) { setTimeLeft(null); return; }
                const calc = () => {
                    const diff = new Date(deadline) - new Date();
                    if (diff <= 0) { setTimeLeft({ expired: true }); return; }
                    const days = Math.floor(diff / 86400000);
                    const hours = Math.floor((diff % 86400000) / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    setTimeLeft({ days, hours, mins, secs, expired: false });
                };
                calc();
                const id = setInterval(calc, 1000);
                return () => clearInterval(id);
            }, [deadline]);

            if (!timeLeft) return null;

            if (timeLeft.expired) {
                return (
                    <div className="flex items-center gap-1.5 bg-red-500 text-white text-[10px] font-medium px-3 py-1.5 rounded-full shadow-md">
                        <Icon name="timer_off" className="text-[13px]" fill="true" />
                        Pembelian Ditutup
                    </div>
                );
            }

            const urgent = timeLeft.days === 0;
            return (
                <div className={`flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-full shadow-md ${urgent ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-400 text-amber-950'}`}>
                    <Icon name="timer" className="text-[13px]" fill="true" />
                    {timeLeft.days > 0 && <span>{timeLeft.days}h </span>}
                    <span>{String(timeLeft.hours).padStart(2,'0')}:{String(timeLeft.mins).padStart(2,'0')}:{String(timeLeft.secs).padStart(2,'0')}</span>
                </div>
            );
        }

        /* ================= TIKET EVENTS / JALAN SANTAI COMPONENT ================= */
        function Tiket({ products = [], setProducts, orders = [], setOrders, userRole, isProductsLoaded = false }) {
            const [activeSubTab, setActiveSubTab] = useState(userRole === 'admin' ? 'orders' : 'shop');
            const [modalConfig, setModalConfig] = useState(null);
            const [sharingProduct, setSharingProduct] = useState(null);

            useEffect(() => {
                const params = new URLSearchParams(window.location.search);
                const productId = params.get('product');
                if (productId && products.length > 0) {
                    const prod = products.find(p => String(p.sku) === productId || String(p.id) === productId || ('TKT-' + String(p.id).substring(8)) === productId);
                    if (prod && prod.stock > 0) {
                        handleOpenBuyModal(prod);
                        // Hapus query params dari URL agar tidak memicu terus menerus
                        const newUrl = window.location.pathname + window.location.hash;
                        window.history.replaceState({}, document.title, newUrl);
                    }
                }
            }, [products]);

            const handleShareToSocial = (platform) => {
                if (!sharingProduct) return;
                const skuOrId = sharingProduct.sku || ('TKT-' + String(sharingProduct.id).substring(8));
                const shareUrl = `${window.location.origin}${window.location.pathname}?page=tiket&product=${skuOrId}`;
                
                // Teks pesan yang akan dibagikan
                const shareText = `Yuk beli tiket *${sharingProduct.name}* Jalan Santai RT Pakem!\nHarga: *${formatRp(sharingProduct.price)}*\nLokasi Pengambilan: *${sharingProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}*\n\nPesan online di sini: ${shareUrl}`;

                switch (platform) {
                    case 'whatsapp':
                        // PENTING: encodeURIComponent agar & dalam URL tidak dipotong oleh WhatsApp API
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
                        break;
                    case 'telegram':
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Yuk beli tiket ${sharingProduct.name} Jalan Santai RT Pakem!`)}`, '_blank');
                        break;
                    case 'facebook':
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                        break;
                    case 'twitter':
                        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Yuk beli tiket ${sharingProduct.name} Jalan Santai RT Pakem! ${shareUrl}`)}`, '_blank');
                        break;
                    case 'copy':
                        navigator.clipboard.writeText(shareUrl)
                            .then(() => {
                                showToast("Tautan berhasil disalin!");
                                setSharingProduct(null);
                            })
                            .catch(() => {
                                showToast("Gagal menyalin tautan.");
                            });
                        break;
                    default:
                        break;
                }
            };

            // Custom Confirm Dialog State
            const [confirmModal, setConfirmModal] = useState(null);

            // Warga State
            const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
            const [selectedProduct, setSelectedProduct] = useState(null);
            const [buyForm, setBuyForm] = useState({ name: '', quantity: 1, notes: '', deliveryMethod: 'pickup', deliveryDay: '', deliveryTime: '' });
            const [wargaError, setWargaError] = useState('');
            const [myTicketsSearch, setMyTicketsSearch] = useState('');
            const [buyersSearch, setBuyersSearch] = useState('');
            const [localSavedOrderIds, setLocalSavedOrderIds] = useState(() => {
                try {
                    const saved = localStorage.getItem('wargapakem_my_tickets');
                    return saved ? JSON.parse(saved) : [];
                } catch (e) {
                    return [];
                }
            });

            // Admin State
            const [isProductModalOpen, setIsProductModalOpen] = useState(false);
            const [editingProduct, setEditingProduct] = useState(null);
            const [productForm, setProductForm] = useState({ name: '', price: '', stock: '', description: '', imageUrl: '', pickupLocationName: '', pickupGeoUrl: '', deadline: '' });
            const [productError, setProductError] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [adminOrderFilter, setAdminOrderFilter] = useState('all');
            const [adminSearchQuery, setAdminSearchQuery] = useState('');
            // Inline edit nama pemesan (admin)
            const [editingBuyerName, setEditingBuyerName] = useState(null); // { orderId, value }
            // Track which product card has its description expanded
            const [expandedDescId, setExpandedDescId] = useState(null);

            const handleProductImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setProductError('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setProductError('Ukuran file maksimal 10MB!');
                setIsUploading(true); setProductError('');
                try {
                    const url = await uploadToGoogleDrive(file, 600, 0.6);
                    setProductForm(prev => ({ ...prev, imageUrl: url }));
                } catch (error) {
                    setProductError(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const handleSaveProduct = () => {
                if (!productForm.name || !productForm.price || productForm.stock === '') {
                    return setProductError("Nama Tiket, Harga, dan Stok wajib diisi!");
                }
                const price = Number(productForm.price);
                const stock = Number(productForm.stock);
                if (isNaN(price) || price < 0) return setProductError("Harga harus berupa angka positif!");
                if (isNaN(stock) || stock < 0) return setProductError("Stok harus berupa angka positif!");

                const productData = {
                    name: productForm.name,
                    price: price,
                    stock: stock,
                    description: productForm.description,
                    imageUrl: productForm.imageUrl,
                    pickupLocationName: productForm.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT',
                    pickupGeoUrl: productForm.pickupGeoUrl || 'https://maps.google.com',
                    deadline: productForm.deadline || ''
                };

                if (editingProduct) {
                    // Capture editingProduct.id to avoid stale closure
                    const editId = editingProduct.id;
                    const fallbackSku = editingProduct.sku || ('TKT-' + String(editId).substring(8));
                    setProducts(prev => (prev || []).map(p => p.id === editId ? { ...p, ...productData, sku: fallbackSku } : p));
                    setModalConfig({ message: 'Produk tiket berhasil diperbarui.' });
                } else {
                    const sku = 'TKT-' + Math.random().toString(36).substring(2, 7).toUpperCase();
                    const newProduct = { id: Date.now(), sku, sold: 0, ...productData };
                    setProducts(prev => [newProduct, ...(prev || [])]);
                    setModalConfig({ message: 'Produk tiket baru berhasil ditambahkan.' });
                }
                setIsProductModalOpen(false);
                setEditingProduct(null);
                setProductForm({ name: '', price: '', stock: '', description: '', imageUrl: '', pickupLocationName: '', pickupGeoUrl: '', deadline: '' });
            };

            const handleSaveBuyerName = (orderId) => {
                if (!editingBuyerName || editingBuyerName.orderId !== orderId) return;
                const newName = editingBuyerName.value.trim().toUpperCase();
                if (!newName) { setEditingBuyerName(null); return; }
                setOrders(prev => (prev || []).map(o => o.id === orderId ? { ...o, buyerName: newName } : o));
                setEditingBuyerName(null);
                showToast('Nama pemesan berhasil diperbarui.');
            };

            const handleEditProduct = (product) => {
                setEditingProduct(product);
                setProductForm({
                    name: product.name || '',
                    price: product.price || '',
                    stock: product.stock || 0,
                    description: product.description || '',
                    imageUrl: product.imageUrl || '',
                    pickupLocationName: product.pickupLocationName || '',
                    pickupGeoUrl: product.pickupGeoUrl || '',
                    deadline: product.deadline || ''
                });
                setProductError('');
                setIsProductModalOpen(true);
            };

            const handleDeleteProduct = (productId) => {
                setConfirmModal({
                    title: "Hapus Produk?",
                    message: "Yakin ingin menghapus produk tiket ini? Tindakan ini tidak bisa dibatalkan.",
                    confirmText: "Hapus",
                    onConfirm: () => {
                        setProducts(prev => prev.filter(p => p.id !== productId));
                        setModalConfig({ message: 'Produk tiket berhasil dihapus.' });
                        setConfirmModal(null);
                    }
                });
            };

            const handleResetSales = (productId) => {
                setConfirmModal({
                    title: "Reset Penjualan?",
                    message: "Yakin ingin mereset jumlah terjual menjadi 0 dan menghapus seluruh riwayat pesanan tiket ini? Tindakan ini tidak bisa dibatalkan.",
                    confirmText: "Reset",
                    onConfirm: () => {
                        // Reset product sold count
                        setProducts(prev => (prev || []).map(p => p.id === productId ? { ...p, sold: 0 } : p));
                        // Delete orders of this product
                        setOrders(prev => (prev || []).filter(o => o.productId !== productId));
                        setModalConfig({ message: 'Data penjualan berhasil di-reset.' });
                        setConfirmModal(null);
                        setIsProductModalOpen(false);
                    }
                });
            };


            // Order actions (Admin)
            const handleUpdateOrderStatus = (orderId, newStatus) => {
                // Snapshot current values to avoid stale closure
                const order = (orders || []).find(o => o.id === orderId);
                if (!order) return;
                // Guard: prevent re-cancellation
                if (order.status === newStatus) return;

                // Restock & un-sold if transitioning TO cancelled
                if (newStatus === 'cancelled' && order.status !== 'cancelled') {
                    setProducts(prev => (prev || []).map(p => {
                        if (p.id === order.productId) {
                            return { ...p, stock: p.stock + order.quantity, sold: Math.max(0, (p.sold || 0) - order.quantity) };
                        }
                        return p;
                    }));
                }
                // If reverting FROM cancelled back to active - deduct stock again
                if (order.status === 'cancelled' && newStatus !== 'cancelled') {
                    setProducts(prev => (prev || []).map(p => {
                        if (p.id === order.productId) {
                            return { ...p, stock: Math.max(0, p.stock - order.quantity), sold: (p.sold || 0) + order.quantity };
                        }
                        return p;
                    }));
                }

                setOrders(prev => (prev || []).map(o => o.id === orderId ? { ...o, status: newStatus } : o));
                showToast(`Status pesanan diubah ke: ${getStatusLabel(newStatus)}`);
            };

            const getStatusLabel = (status) => {
                switch(status) {
                    case 'pending': return 'Menunggu Konfirmasi';
                    case 'processed': return 'Diproses';
                    case 'completed': return 'Selesai';
                    case 'cancelled': return 'Dibatalkan';
                    default: return status;
                }
            };

            const getStatusColor = (status) => {
                switch(status) {
                    case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40';
                    case 'processed': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40';
                    case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40';
                    case 'cancelled': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/40';
                    default: return 'bg-slate-50 text-slate-700 border-slate-200';
                }
            };

            // Order placing (Warga)
            const handleOpenBuyModal = (product) => {
                setSelectedProduct(product);
                setBuyForm({
                    name: '',
                    quantity: 1,
                    notes: '',
                    deliveryMethod: 'pickup',
                    deliveryDay: '',
                    deliveryTime: ''
                });
                setWargaError('');
                setIsBuyModalOpen(true);
            };

            const handlePlaceOrder = () => {
                if (!buyForm.name.trim()) return setWargaError("Nama lengkap wajib diisi!");
                const qty = Number(buyForm.quantity);
                if (isNaN(qty) || qty < 1) return setWargaError("Jumlah pembelian minimal 1 tiket!");
                if (qty > selectedProduct.stock) return setWargaError(`Stok tidak mencukupi! Hanya tersisa ${selectedProduct.stock} tiket.`);
                if (buyForm.deliveryMethod === 'delivery') {
                    if (!buyForm.deliveryDay.trim()) return setWargaError("Hari pengantaran wajib diisi!");
                    if (!buyForm.deliveryTime.trim()) return setWargaError("Jam pengantaran wajib diisi!");
                }

                const newOrder = {
                    id: Date.now(),
                    productId: selectedProduct.id,
                    productName: selectedProduct.name,
                    buyerName: buyForm.name.trim(),
                    quantity: qty,
                    totalPrice: qty * selectedProduct.price,
                    notes: buyForm.notes.trim(),
                    pickupLocation: selectedProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT',
                    pickupGeoUrl: selectedProduct.pickupGeoUrl || 'https://maps.google.com',
                    deliveryMethod: buyForm.deliveryMethod,
                    deliveryDay: buyForm.deliveryMethod === 'delivery' ? buyForm.deliveryDay.trim() : '',
                    deliveryTime: buyForm.deliveryMethod === 'delivery' ? buyForm.deliveryTime.trim() : '',
                    status: 'pending',
                    timestamp: getLocalDate()
                };

                // Deduct stock - functional update avoids stale closure
                const targetProductId = selectedProduct.id;
                setProducts(prev => (prev || []).map(p => {
                    if (p.id === targetProductId) {
                        return { ...p, stock: Math.max(0, p.stock - qty), sold: (p.sold || 0) + qty };
                    }
                    return p;
                }));

                // Add order - functional update
                setOrders(prev => [newOrder, ...(prev || [])]);

                // Save locally - functional update
                setLocalSavedOrderIds(prev => {
                    const newLocalIds = [newOrder.id, ...(prev || [])];
                    try {
                        localStorage.setItem('wargapakem_my_tickets', JSON.stringify(newLocalIds));
                    } catch(e) {}
                    return newLocalIds;
                });

                setIsBuyModalOpen(false);
                setModalConfig({ message: 'Pesanan tiket Anda berhasil diajukan! Pembayaran dilakukan secara COD.' });
            };

            const handleCancelOrderByWarga = (order) => {
                if (!order || order.status === 'cancelled') return;
                // Return stock - functional update
                setProducts(prev => (prev || []).map(p => {
                    if (p.id === order.productId) {
                        return { ...p, stock: p.stock + order.quantity, sold: Math.max(0, (p.sold || 0) - order.quantity) };
                    }
                    return p;
                }));
                // Update order status - functional update
                setOrders(prev => (prev || []).map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o));
                showToast("Pesanan berhasil dibatalkan.");
            };

            const handleDeleteOrderLog = (orderId) => {
                setConfirmModal({
                    title: "Hapus Log Pesanan?",
                    message: "Yakin ingin menghapus riwayat/log pesanan ini dari sistem secara permanen?",
                    confirmText: "Hapus",
                    onConfirm: () => {
                        setOrders(prev => (prev || []).filter(o => o.id !== orderId));
                        setLocalSavedOrderIds(prev => {
                            const newLocalIds = (prev || []).filter(id => id !== orderId);
                            try {
                                localStorage.setItem('wargapakem_my_tickets', JSON.stringify(newLocalIds));
                            } catch(e) {}
                            return newLocalIds;
                        });
                        showToast("Riwayat pesanan berhasil dihapus.");
                        setConfirmModal(null);
                    }
                });
            };

            // Filters
            const filteredOrders = (orders || []).filter(o => {
                if (!o || !o.id) return false;
                const matchStatus = adminOrderFilter === 'all' || o.status === adminOrderFilter;
                const buyerName = (o.buyerName || '').toLowerCase();
                const productName = (o.productName || '').toLowerCase();
                const query = adminSearchQuery.toLowerCase();
                const matchSearch = buyerName.includes(query) || productName.includes(query);
                return matchStatus && matchSearch;
            });

            const myTicketsFiltered = (orders || []).filter(o => {
                if (!o || !o.id) return false;
                const isMyOrder = localSavedOrderIds.includes(o.id);
                const buyerName = (o.buyerName || '').toLowerCase();
                const isSearchMatch = myTicketsSearch ? buyerName.includes(myTicketsSearch.toLowerCase()) : false;
                return isMyOrder || isSearchMatch;
            });

            // Daftar Pembeli (semua order non-cancelled, diurutkan terbaru)
            const buyersList = (orders || []).filter(o => o && o.id && o.status !== 'cancelled');
            const buyersTotalTickets = buyersList.reduce((sum, o) => sum + (o.quantity || 0), 0);
            const buyersListFiltered = buyersSearch
                ? buyersList.filter(o => (o.buyerName || '').toLowerCase().includes(buyersSearch.toLowerCase()))
                : buyersList;

            // Filter produk aktif dan arsip
            const activeProducts = (products || []).filter(p => !p.archived && !(p.deadline && new Date(p.deadline) <= new Date()));
            const archivedProducts = (products || []).filter(p => p.archived || (p.deadline && new Date(p.deadline) <= new Date()));


            // Statistics (Admin)
            const stats = useMemo(() => {
                let totalSold = 0;
                let revenue = 0;
                let pendingCount = 0;

                (orders || []).forEach(o => {
                    if (o.status !== 'cancelled') {
                        totalSold += o.quantity;
                        if (o.status === 'completed' || o.status === 'processed') {
                            revenue += o.totalPrice;
                        }
                    }
                    if (o.status === 'pending') {
                        pendingCount++;
                    }
                });

                return { totalSold, revenue, pendingCount };
            }, [orders]);

            return (
                <div className="animate-fade-in pb-24 w-full">
                    {modalConfig && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-8 max-w-sm w-full text-center modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check_circle" className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 mb-2">Berhasil</h3>
                                <p className="text-slate-650 font-medium mb-8 text-[13px]">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-google-blue hover:bg-google-blueDark text-white font-medium py-3.5 rounded-full transition-all">Tutup</button>
                            </div>
                        </div>
                    )}

                    {userRole === 'admin' ? (
                        /* ================== VIEW ADMIN ================== */
                        <div className="space-y-8">
                            {/* Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-google-blueLight border border-google-blue/30 text-google-blueDark flex items-center justify-center shrink-0"><Icon name="trending_up" className="text-[24px]" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Total Tiket Terjual</p>
                                        <h4 className="text-xl font-medium text-slate-800">{stats.totalSold} <span className="text-[11px] font-medium text-slate-500">Tiket</span></h4>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-500 flex items-center justify-center shrink-0"><Icon name="payments" className="text-[24px]" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Total Pendapatan</p>
                                        <h4 className="text-xl font-medium text-slate-800">{formatRp(stats.revenue)}</h4>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-205 text-amber-500 flex items-center justify-center shrink-0"><Icon name="schedule" className="text-[24px]" /></div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider font-medium text-slate-400">Pesanan Pending</p>
                                        <h4 className="text-xl font-medium text-slate-800">{stats.pendingCount} <span className="text-[11px] font-medium text-slate-500">Pesanan</span></h4>
                                    </div>
                                </div>
                            </div>

                            {/* Sub Navigation */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                                <div className="flex gap-2">
                                    <button onClick={() => setActiveSubTab('orders')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-2 ${activeSubTab === 'orders' ? 'bg-slate-850 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon name="receipt_long" /> Pesanan Masuk</button>
                                    <button onClick={() => setActiveSubTab('products')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-2 ${activeSubTab === 'products' ? 'bg-slate-850 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Icon name="inventory_2" /> Kelola Produk</button>
                                </div>
                                {activeSubTab === 'products' && (
                                    <button onClick={() => { setEditingProduct(null); setProductForm({ name: '', price: '', stock: '', description: '', imageUrl: '', pickupLocationName: '', pickupGeoUrl: '' }); setProductError(''); setIsProductModalOpen(true); }} className="bg-google-blue hover:bg-google-blueDark text-white px-4 py-2.5 rounded-full font-medium text-[12px] shadow-md hover:shadow-lg transition-all flex items-center gap-2"><Icon name="add" /> Tambah Produk Tiket</button>
                                )}
                            </div>

                            {/* Panel Pesanan */}
                            {activeSubTab === 'orders' && (
                                <div className="space-y-7">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 relative">
                                            <input type="text" placeholder="Cari nama pembeli atau tiket..." value={adminSearchQuery} onChange={e => setAdminSearchQuery(e.target.value)} style={{ paddingLeft: '1.25rem' }} className="w-full bg-white border border-slate-200 pr-5 py-3 rounded-2xl text-[13px] font-medium outline-none focus:border-google-blue/40" />
                                        </div>
                                        <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 shrink-0">
                                            {['all', 'pending', 'processed', 'completed', 'cancelled'].map(status => (
                                                <button key={status} onClick={() => setAdminOrderFilter(status)} className={`px-4 py-2.5 rounded-full text-[11px] font-medium border transition-all capitalize whitespace-nowrap ${adminOrderFilter === status ? 'bg-google-blueLight text-google-blueDark border-google-blue/30' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{status === 'all' ? 'Semua' : getStatusLabel(status)}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {filteredOrders.length === 0 ? (
                                        <div className="bg-white border border-slate-200 p-12 text-center rounded-3xl"><div className="w-16 h-16 bg-slate-50 border border-slate-200 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400"><Icon name="receipt" className="text-[28px]" /></div><p className="text-[13px] font-medium text-slate-800">Tidak ada pesanan ditemukan.</p></div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {filteredOrders.map(order => (
                                                <div key={order.id} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-7 hover:shadow-md transition-shadow">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8.5 h-8.5 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                                    <Icon name="receipt_long" className="text-[17px]" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">ID Pesanan</p>
                                                                    <p className="text-[12px] font-medium text-slate-700">#TKT-{String(order.id).slice(-6)}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-medium px-3.5 py-2 rounded-lg border ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                                                        </div>

                                                        <div className="bg-slate-50 rounded-xl p-5 sm:p-6 border border-slate-100 space-y-6">
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1">
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Pemesan</p>
                                                                    {/* Nama Pemesan - inline edit oleh admin */}
                                                                    {editingBuyerName && editingBuyerName.orderId === order.id ? (
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <input
                                                                                autoFocus
                                                                                type="text"
                                                                                value={editingBuyerName.value}
                                                                                onChange={e => setEditingBuyerName({ orderId: order.id, value: e.target.value.toUpperCase() })}
                                                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveBuyerName(order.id); if (e.key === 'Escape') setEditingBuyerName(null); }}
                                                                                className="flex-1 bg-amber-50 border border-amber-400 rounded-lg px-3 py-1.5 text-[14px] font-medium text-slate-800 uppercase outline-none focus:shadow-md tracking-wide"
                                                                            />
                                                                            <button onClick={() => handleSaveBuyerName(order.id)} className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors" title="Simpan">
                                                                                <Icon name="check" className="text-[14px]" />
                                                                            </button>
                                                                            <button onClick={() => setEditingBuyerName(null)} className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center shrink-0 transition-colors" title="Batal">
                                                                                <Icon name="close" className="text-[14px]" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2 group mt-0.5">
                                                                            <h4 className="font-medium text-[15px] text-slate-800 uppercase tracking-wide">{order.buyerName}</h4>
                                                                            <button
                                                                                onClick={() => setEditingBuyerName({ orderId: order.id, value: order.buyerName })}
                                                                                className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0 transition-all"
                                                                                title="Edit nama pemesan"
                                                                            >
                                                                                <Icon name="edit" className="text-[12px]" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-right ml-2 shrink-0">
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Total</p>
                                                                    <p className="text-[14px] font-medium text-rose-600">{formatRp(order.totalPrice)}</p>
                                                                </div>
                                                            </div>

                                                            <div className="pt-2 border-t border-slate-200">
                                                                <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Rincian Tiket</p>
                                                                <p className="text-[12.5px] font-medium text-slate-700">{order.productName} <span className="text-slate-500 font-medium">x{order.quantity} Pcs</span></p>
                                                            </div>
                                                        </div>

                                                        <div className="mt-6 space-y-3.5">
                                                            {order.deliveryMethod === 'delivery' ? (
                                                                <div className="flex items-start gap-3.5 text-[11.5px] text-slate-600 font-medium bg-white p-4.5 rounded-xl border border-slate-200">
                                                                    <div className="w-6.5 h-6.5 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="local_shipping" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Diantar ke Rumah</span>
                                                                        <p className="text-[11px] text-slate-500 mt-1">Waktu: {order.deliveryDay || '-'}, {order.deliveryTime || '-'}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-start gap-3.5 text-[11.5px] text-slate-600 font-medium bg-white p-4.5 rounded-xl border border-slate-200">
                                                                    <div className="w-6.5 h-6.5 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="location_on" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Ambil Sendiri</span>
                                                                        <p className="text-[11px] text-slate-500 mt-1">{order.pickupLocation || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                                                        {order.pickupGeoUrl && (
                                                                            <a href={order.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 text-rose-600 hover:underline inline-flex items-center gap-1 font-medium"><Icon name="map" className="text-[11px]" /> Buka Peta</a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {order.notes && (
                                                                <div className="flex items-start gap-3 text-[11.5px] text-slate-600 font-medium bg-amber-50 p-4.5 rounded-xl border border-amber-100">
                                                                    <Icon name="chat_bubble" className="text-[14px] mt-0.5 shrink-0 text-amber-500" />
                                                                    <span><span className="font-medium text-slate-800">Catatan:</span> {order.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between mt-6">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                                                <Icon name="event" className="text-[13px]" /> {order.timestamp}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    {order.status !== 'completed' && order.status !== 'cancelled' ? (
                                                        <div className="flex gap-2 border-t border-slate-200 pt-5 mt-4">
                                                            {order.status === 'pending' && (
                                                                <button onClick={() => handleUpdateOrderStatus(order.id, 'processed')} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="task_alt" className="text-[14px]" /> Terima & Proses</button>
                                                            )}
                                                            {order.status === 'processed' && (
                                                                <button onClick={() => handleUpdateOrderStatus(order.id, 'completed')} className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="check" className="text-[14px]" /> Selesai</button>
                                                            )}
                                                            <button onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="cancel" className="text-[14px]" /> Tolak / Batalkan</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 border-t border-slate-200 pt-5 mt-4">
                                                            <button onClick={() => handleDeleteOrderLog(order.id)} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium py-3 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="delete" className="text-[14px]" /> Hapus Log Pesanan</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Panel Kelola Produk */}
                            {activeSubTab === 'products' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                    {products.map(prod => (
                                        <div key={prod.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                                            <div className="relative h-44 bg-slate-100 flex items-center justify-center border-b border-slate-200">
                                                {prod.imageUrl ? (
                                                    <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-slate-400 flex flex-col items-center"><Icon name="local_activity" className="text-[48px] mb-2" /><span className="text-[11px] font-medium">Tidak ada foto</span></div>
                                                )}
                                                <div className="absolute top-3 right-3 bg-slate-900/75 text-white text-[10px] font-medium px-3 py-1.5 rounded-full ">Stok: {prod.stock}</div>
                                            </div>
                                            <div className="p-5 flex-1 flex flex-col justify-between space-y-6">
                                                <div>
                                                    <h4 className="font-medium text-[15px] text-slate-800 line-clamp-1">{prod.name}</h4>
                                                    <p className="text-[12px] font-medium text-google-blue mt-1">{formatRp(prod.price)}</p>
                                                    <p className={`text-[11.5px] font-medium text-slate-500 mt-2 leading-relaxed ${expandedDescId === prod.id ? '' : 'line-clamp-3'}`}>{prod.description || 'Tidak ada deskripsi.'}</p>
                                                    {(prod.description || '').length > 80 && (
                                                        <button onClick={() => setExpandedDescId(expandedDescId === prod.id ? null : prod.id)} className="mt-1 text-[10.5px] font-medium text-google-blue hover:underline">
                                                            {expandedDescId === prod.id ? '↑ Tutup' : '↓ Selengkapnya'}
                                                        </button>
                                                    )}
                                                    
                                                    <div className="mt-3 space-y-1.5">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-lg w-fit border border-slate-200"><Icon name="shopping_bag" className="text-[13px]" /> Terjual: {prod.sold || 0} Pcs</div>
                                                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500"><Icon name="location_on" className="text-[13px] text-google-blue" /> {prod.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 pt-3 border-t border-slate-100 mt-1">
                                                    <button onClick={() => handleEditProduct(prod)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95"><Icon name="edit" className="text-[14px]" /> Edit</button>
                                                    <button onClick={() => setSharingProduct(prod)} className="flex items-center justify-center px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-full py-2 transition-all active:scale-95 shadow-sm" title="Bagikan"><Icon name="share" className="text-[14px]" /></button>
                                                    <button onClick={() => handleDeleteProduct(prod.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95"><Icon name="delete" className="text-[14px]" /> Hapus</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Modal Kelola Produk */}
                            {isProductModalOpen && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                                    <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                        <h3 className="text-xl font-medium text-slate-800 mb-6 tracking-tight">{editingProduct ? 'Edit Produk Tiket' : 'Tambah Produk Tiket Baru'}</h3>
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Nama Tiket / Produk</label>
                                                <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Tiket Jalan Santai RT Pakem" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Harga (Rp)</label>
                                                    <input type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: 5000" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Stok Tiket</label>
                                                    <input type="number" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: 100" />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Nama Lokasi Pengambilan</label>
                                                    <input type="text" value={productForm.pickupLocationName} onChange={e => setProductForm({...productForm, pickupLocationName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Rumah Mas Novan / Rumah Pak RT" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Link Google Maps Lokasi</label>
                                                    <input type="text" value={productForm.pickupGeoUrl} onChange={e => setProductForm({...productForm, pickupGeoUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: https://maps.google.com/..." />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Deskripsi Tiket</label>
                                                <textarea value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all h-24 resize-none" placeholder="Tuliskan info doorprize, aturan, jadwal, dll..."></textarea>
                                            </div>
                                            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2">
                                                <label className="text-[10px] font-medium text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Icon name="timer" className="text-[14px]" fill="true" /> Batas Waktu Pembelian (Deadline)
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={productForm.deadline}
                                                    onChange={e => setProductForm({...productForm, deadline: e.target.value})}
                                                    className="w-full bg-white border border-rose-300 p-3.5 text-[13px] font-medium outline-none rounded-xl focus:border-rose-400 focus:shadow-sm transition-all"
                                                />
                                                <p className="text-[10.5px] text-rose-400 font-medium flex items-start gap-1">
                                                    <Icon name="info" className="text-[12px] shrink-0 mt-0.5" /> Setelah waktu ini terlewati, tombol beli akan otomatis dikunci. Kosongkan jika tidak ada batas waktu.
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Upload Foto Cover (Opsional)</label>
                                                <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                                    <input type="file" accept="image/*" onChange={handleProductImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                                    <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                        {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="image" className="text-[20px]" />}
                                                    </div>
                                                    <div className="relative z-0 flex-1 min-w-0">
                                                        <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (productForm.imageUrl ? "Gambar Siap" : "Pilih Gambar")}</p>
                                                        <p className="text-[11px] text-google-textVariant truncate">{productForm.imageUrl ? "Klik untuk mengganti" : "Maksimal 10MB"}</p>
                                                    </div>
                                                    {productForm.imageUrl && !isUploading && (
                                                        <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200"><img src={productForm.imageUrl} alt="Preview" className="w-full h-full object-cover" /></div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Arsipkan Event Checkbox */}
                                            <div className="pt-2">
                                                <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-200 p-3.5 rounded-2xl hover:bg-slate-100 transition-all select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!productForm.archived}
                                                        onChange={e => setProductForm({...productForm, archived: e.target.checked})}
                                                        className="w-4.5 h-4.5 text-google-blue rounded border-slate-200 focus:ring-google-blue"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="text-[12.5px] font-medium text-slate-800">Arsipkan Event ini</span>
                                                        <p className="text-[10px] text-slate-500 font-medium leading-tight">Pindahkan event ini dari daftar aktif ke riwayat arsip event</p>
                                                    </div>
                                                </label>
                                            </div>

                                            {/* Reset Data Penjualan (Hanya untuk Edit) */}
                                            {editingProduct && (
                                                <div className="pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResetSales(editingProduct.id)}
                                                        className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-250 py-3 rounded-full text-[11.5px] font-medium transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <Icon name="restart_alt" className="text-[16px]" />
                                                        Reset Penjualan & Pembelian (Hapus Riwayat)
                                                    </button>
                                                    <p className="text-[9px] text-slate-400 font-medium ml-1 mt-1 flex items-start gap-1">
                                                        <Icon name="warning" className="text-[11px] text-amber-500 shrink-0" />
                                                        PENTING: Seluruh pesanan masuk (order) untuk produk ini akan dihapus permanen dari sistem.
                                                    </p>
                                                </div>
                                            )}

                                            {productError && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[12px] font-medium border border-red-200 flex items-center gap-2"><Icon name="error" /> {productError}</div>}
                                        </div>
                                        <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                                            <button onClick={() => setIsProductModalOpen(false)} className="w-1/3 bg-white text-slate-700 border border-slate-200 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all shadow-sm">Batal</button>
                                            <button onClick={handleSaveProduct} disabled={isUploading} className="w-2/3 bg-google-blue text-white px-4 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark transition-all flex items-center justify-center gap-2"><Icon name="save" className="text-[16px]"/> Simpan Produk</button>
                                        </div>

                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ================== VIEW WARGA ================== */
                        <div className="space-y-8">
                            {/* Banner Header */}
                            <div className="bento-header-card bg-gradient-to-br from-red-600 via-rose-600 to-red-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-lg relative overflow-hidden border border-red-500/30">
                                <div className="absolute inset-0 bg-black/10"></div>
                                <div className="relative z-10">
                                    <span className="bg-white/25  px-3 py-1 rounded-full text-[10px] font-medium tracking-widest uppercase border border-white/20">EVENT RT PAKEM</span>
                                    <h2 className="text-2xl sm:text-3xl font-medium mt-3 tracking-tight">Katalog Tiket Jalan Santai</h2>
                                    <p className="text-[12px] sm:text-[13px] text-white/95 mt-1.5 max-w-xl leading-relaxed font-medium">
                                        Beli tiket jalan santai Anda secara online di sini! Silakan lakukan pembayaran di tempat (COD) langsung saat mengambil tiket di lokasi pengambilan yang telah ditentukan.
                                    </p>
                                </div>
                            </div>

                            {/* Warga Sub Tabs */}
                            <div className="slide-list-scroller bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 p-2 rounded-2xl shadow-sm flex gap-2 overflow-x-auto scrollbar-none whitespace-nowrap items-center">
                                <button onClick={() => setActiveSubTab('shop')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeSubTab === 'shop' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="shopping_bag" className="text-[15px]" />
                                    <span>Beli Tiket</span>
                                </button>
                                <button onClick={() => setActiveSubTab('my_tickets')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 relative whitespace-nowrap shrink-0 ${activeSubTab === 'my_tickets' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="confirmation_number" className="text-[15px]" />
                                    <span>Tiket Saya</span>
                                    {myTicketsFiltered.length > 0 && <span className="bg-rose-500 text-white text-[8.5px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-1 leading-none">{myTicketsFiltered.length}</span>}
                                </button>
                                <button onClick={() => setActiveSubTab('buyers_list')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 relative whitespace-nowrap shrink-0 ${activeSubTab === 'buyers_list' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="groups" className="text-[15px]" />
                                    <span>Daftar Pembeli</span>
                                    {buyersList.length > 0 && <span className="bg-rose-500 text-white text-[8.5px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-1 leading-none">{buyersList.length}</span>}
                                </button>
                                <button onClick={() => setActiveSubTab('archive')} className={`px-4 py-2.5 rounded-full font-medium text-[12px] transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeSubTab === 'archive' ? 'bg-google-blue text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon name="archive" className="text-[15px]" />
                                    <span>Arsip Event</span>
                                </button>
                            </div>






                            {/* Sub Tab: Beli Tiket */}
                            {activeSubTab === 'shop' && (
                                activeProducts.length === 0 ? (
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center rounded-3xl">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400">
                                            <Icon name="local_activity" className="text-[28px]" />
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">Tidak ada event tiket aktif saat ini.</p>
                                        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Silakan kunjungi tab "Arsip Event" untuk melihat riwayat event sebelumnya.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {activeProducts.map(prod => (
                                            <div key={prod.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/85 dark:border-slate-800/85 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                                                {/* Image Cover with Aspect-Ratio and overlays */}
                                                <div className="relative w-full h-48 sm:h-52 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-b border-slate-200/80 dark:border-slate-850">
                                                    {prod.imageUrl ? (
                                                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
                                                            <div className="w-14 h-14 rounded-2xl bg-google-blue text-white flex items-center justify-center shadow-md mb-2">
                                                                <Icon name="local_activity" className="text-[26px]" />
                                                            </div>
                                                            <span className="text-[10px] font-medium uppercase tracking-widest text-google-blue dark:text-google-blueLight">Tiket Jalan Santai</span>
                                                        </div>
                                                    )}
                                                    {/* Official Store Badge - top left */}
                                                    <div className="absolute top-3.5 left-3.5 flex items-center gap-1 bg-google-yellow text-white text-[9px] font-medium px-2.5 py-1 rounded-lg shadow-md shadow-amber-500/20  border border-white/20 tracking-wide">
                                                        <Icon name="verified" className="text-[12px]" fill="true" />
                                                        OFFICIAL
                                                    </div>
                                                    {/* Stock Pill - top right */}
                                                    <div className={`absolute top-3.5 right-3.5 text-[9.5px] font-medium px-2.5 py-1 rounded-lg  shadow-md border ${prod.stock > 0 ? 'bg-slate-900/75 dark:bg-slate-950/75 text-white border-white/10' : 'bg-red-500/90 text-white border-red-400/20'}`}>
                                                        {prod.stock > 0 ? `Stok: ${prod.stock}` : 'Stok Habis'}
                                                    </div>
                                                    {/* Countdown Timer overlay - bottom right */}
                                                    {prod.deadline && (
                                                        <div className="absolute bottom-3 right-3 z-10 scale-90 origin-bottom-right">
                                                            <CountdownTimer deadline={prod.deadline} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Details */}
                                                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                                                    <div className="space-y-5">
                                                        <p className="text-[10.5px] font-medium text-google-blue mb-[-4px] uppercase tracking-wider">SKU: {prod.sku || ('TKT-' + String(prod.id).substring(8))}</p>
                                                        <h4 className="font-medium text-[15px] text-slate-800 dark:text-slate-100 tracking-tight leading-snug line-clamp-1">{prod.name}</h4>
                                                        
                                                        {/* Price and Sold Row */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-base sm:text-lg font-medium text-rose-550 dark:text-rose-450">{formatRp(prod.price)}</span>
                                                            {(prod.sold || 0) > 0 && (
                                                                <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-medium px-2.5 py-1 rounded-lg">
                                                                    <Icon name="trending_up" className="text-[11px]" />
                                                                    {prod.sold} Terjual
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Batas Pembelian Box */}
                                                        {prod.deadline && (() => {
                                                            const isExp = new Date(prod.deadline) <= new Date();
                                                            return (
                                                                <div className={`text-[10.5px] font-medium flex items-center gap-1.5 p-2.5 rounded-lg border ${isExp ? 'bg-rose-50/50 border-rose-100 text-rose-600 dark:bg-rose-950/10 dark:border-rose-900/30' : 'bg-amber-50/50 border-amber-100 text-amber-600 dark:bg-amber-950/10 dark:border-amber-900/30'}`}>
                                                                    <Icon name={isExp ? 'timer_off' : 'event'} className="text-[14px]" />
                                                                    <span>{isExp ? 'Pembelian telah ditutup' : `Batas pembelian: ${new Date(prod.deadline).toLocaleString('id-ID', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}`}</span>
                                                                </div>
                                                            );
                                                        })()}

                                                        <p className={`text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed ${expandedDescId === prod.id ? '' : 'line-clamp-2'}`}>{prod.description || 'Tidak ada deskripsi.'}</p>
                                                        {(prod.description || '').length > 80 && (
                                                            <button onClick={() => setExpandedDescId(expandedDescId === prod.id ? null : prod.id)} className="mt-1 text-[10.5px] font-medium text-google-blue dark:text-blue-400 hover:underline flex items-center gap-0.5">
                                                                <Icon name={expandedDescId === prod.id ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                                                                {expandedDescId === prod.id ? 'Tutup' : 'Selengkapnya'}
                                                            </button>
                                                        )}
                                                        
                                                        {/* Pickup Location Box */}
                                                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 rounded-xl">
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-550 dark:text-rose-450 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
                                                                    <Icon name="location_on" className="text-[16px]" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-[8px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lokasi Pengambilan</p>
                                                                    <p className="text-[11.5px] font-medium text-slate-700 dark:text-slate-300 truncate leading-tight mt-0.5">{prod.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                                                </div>
                                                            </div>
                                                            {prod.pickupGeoUrl && (
                                                                <a href={prod.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-google-blueLight hover:bg-google-blueLight/85 text-google-blueDark dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0 border border-google-blue/20 dark:border-blue-900/30 transition-all hover:scale-105" title="Buka Google Maps">
                                                                    <Icon name="map" className="text-[14px]" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    {(() => {
                                                        const isDeadlinePassed = prod.deadline && new Date(prod.deadline) <= new Date();
                                                        const canBuy = prod.stock > 0 && !isDeadlinePassed;
                                                        return (
                                                            <div className="flex gap-2.5 pt-2">
                                                                <button
                                                                    onClick={() => handleOpenBuyModal(prod)}
                                                                    disabled={!canBuy}
                                                                    className={`flex-1 py-3 rounded-full font-medium text-[12.5px] transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md ${canBuy ? 'bg-google-blue hover:bg-google-blueDark text-white shadow-google-blue/15' : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'}`}
                                                                >
                                                                    <Icon name={isDeadlinePassed ? 'timer_off' : 'add_shopping_cart'} className="text-[16px]" />
                                                                    {isDeadlinePassed ? 'Pembelian Ditutup' : prod.stock > 0 ? 'Beli Tiket Sekarang' : 'Stok Habis'}
                                                                </button>
                                                                <button onClick={() => setSharingProduct(prod)} className="w-11 h-11 bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-850 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-750 rounded-full transition-all flex items-center justify-center active:scale-95" title="Bagikan">
                                                                    <Icon name="share" className="text-[16px]" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {/* Sub Tab: Arsip Event */}
                            {activeSubTab === 'archive' && (
                                archivedProducts.length === 0 ? (
                                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center rounded-3xl">
                                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400">
                                            <Icon name="archive" className="text-[28px]" />
                                        </div>
                                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">Tidak ada arsip event saat ini.</p>
                                        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-1">Seluruh event yang telah selesai atau diarsipkan akan muncul di sini sebagai riwayat kegiatan.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {archivedProducts.map(prod => (
                                            <div key={prod.id} className="bg-slate-50/50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/85 dark:border-slate-800/85 shadow-sm overflow-hidden flex flex-col justify-between opacity-90 hover:opacity-100 transition-all duration-300">
                                                {/* Image Cover with Aspect-Ratio and overlays */}
                                                <div className="relative w-full h-48 sm:h-52 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-b border-slate-200/80 dark:border-slate-850 grayscale">
                                                    {prod.imageUrl ? (
                                                        <img src={prod.imageUrl} alt={prod.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-850 flex flex-col items-center justify-center p-6 text-center">
                                                            <div className="w-14 h-14 rounded-2xl bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shadow-md mb-2">
                                                                <Icon name="local_activity" className="text-[26px]" />
                                                            </div>
                                                            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-450 dark:text-slate-500">Tiket Jalan Santai</span>
                                                        </div>
                                                    )}
                                                    {/* Archive Badge - top left */}
                                                    <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 bg-slate-700/90 text-white text-[9px] font-medium px-2.5 py-1 rounded-lg shadow-md  tracking-wide">
                                                        <Icon name="archive" className="text-[12px]" fill="true" />
                                                        ARSIP
                                                    </div>
                                                </div>

                                                {/* Details */}
                                                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                                                    <div className="space-y-5">
                                                        <h4 className="font-medium text-[15px] text-slate-650 dark:text-slate-300 tracking-tight leading-snug line-clamp-1 uppercase">{prod.name}</h4>
                                                        
                                                        {/* Price and Sold Row */}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-base sm:text-lg font-medium text-slate-400 line-through">{formatRp(prod.price)}</span>
                                                            {(prod.sold || 0) > 0 && (
                                                                <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-slate-400 dark:text-slate-500 text-[10px] font-medium px-2.5 py-1 rounded-lg">
                                                                    <Icon name="trending_up" className="text-[11px]" />
                                                                    {prod.sold} Terjual
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Status selesai box */}
                                                        <div className="text-[10.5px] font-medium flex items-center gap-1.5 p-2.5 rounded-lg border bg-rose-50/50 border-rose-100 text-rose-600 dark:bg-rose-950/10 dark:border-rose-900/30">
                                                            <Icon name="timer_off" className="text-[14px]" />
                                                            <span>Event Selesai / Pembelian Ditutup</span>
                                                        </div>

                                                        <p className={`text-[12px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed ${expandedDescId === prod.id ? '' : 'line-clamp-2'}`}>{prod.description || 'Tidak ada deskripsi.'}</p>
                                                    </div>

                                                    {/* Action Buttons (Disabled) */}
                                                    <div className="flex gap-2.5 pt-2">
                                                        <button
                                                            disabled
                                                            className="flex-1 py-3 rounded-full font-medium text-[12.5px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed flex items-center justify-center gap-1.5"
                                                        >
                                                            <Icon name="lock" className="text-[16px]" />
                                                            Event Selesai / Diarsipkan
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}


                            {/* Sub Tab: Tiket Saya */}
                            {activeSubTab === 'my_tickets' && (
                                <div className="space-y-7">
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 relative">
                                            <input type="text" placeholder="Cari pesanan berdasarkan nama pembeli..." value={myTicketsSearch} onChange={e => setMyTicketsSearch(e.target.value)} style={{ paddingLeft: '1.25rem' }} className="w-full bg-white border border-slate-200 pr-5 py-3 rounded-2xl text-[13px] font-medium outline-none focus:border-google-blue/40" />
                                        </div>
                                        {myTicketsSearch && (
                                            <button onClick={() => setMyTicketsSearch('')} className="bg-white border border-slate-200 text-slate-650 hover:bg-slate-100 px-4 py-3 rounded-full text-[11px] font-medium transition-all">Reset</button>
                                        )}
                                    </div>

                                    {myTicketsFiltered.length === 0 ? (
                                        <div className="bg-white border border-slate-200 p-12 text-center rounded-3xl">
                                            <div className="w-16 h-16 bg-slate-50 border border-slate-200 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400"><Icon name="confirmation_number" className="text-[28px]" /></div>
                                            <p className="text-[13px] font-medium text-slate-800">Belum ada tiket yang terdaftar.</p>
                                            <p className="text-[11.5px] font-medium text-slate-400 mt-1 max-w-sm mx-auto">Silakan beli tiket di tab "Beli Tiket" atau gunakan pencarian nama jika Anda membuat pesanan di perangkat lain.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {myTicketsFiltered.map(order => (
                                                <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                                    <Icon name="receipt_long" className="text-[16px]" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">ID Pesanan</p>
                                                                    <p className="text-[12px] font-medium text-slate-700">#TKT-{String(order.id).slice(-6)}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-[10px] font-medium px-3 py-1.5 rounded-lg border ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</span>
                                                        </div>
                                                        
                                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-5">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Pemesan</p>
                                                                    <h4 className="font-medium text-[15px] text-slate-800">{order.buyerName}</h4>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-medium text-slate-400 uppercase">Total Harga</p>
                                                                    <p className="text-[14px] font-medium text-rose-600">{formatRp(order.totalPrice)}</p>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="pt-2 border-t border-slate-200">
                                                                <p className="text-[10px] font-medium text-slate-400 uppercase mb-1">Rincian Tiket</p>
                                                                <p className="text-[13px] font-medium text-slate-700">{order.productName} <span className="text-slate-500 font-medium">x{order.quantity} Pcs</span></p>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="mt-4 space-y-2">
                                                            {order.deliveryMethod === 'delivery' ? (
                                                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-white p-3 rounded-xl border border-slate-200">
                                                                    <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="local_shipping" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Diantar ke Rumah</span>
                                                                        <p className="text-[11px] text-slate-500 mt-0.5">Waktu: {order.deliveryDay || '-'}, {order.deliveryTime || '-'}</p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-white p-3 rounded-xl border border-slate-200">
                                                                    <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                                                        <Icon name="location_on" className="text-[13px] text-rose-500" />
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-medium text-slate-800">Ambil Sendiri</span>
                                                                        <p className="text-[11px] text-slate-500 mt-0.5">{order.pickupLocation || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                                                        {order.pickupGeoUrl && (
                                                                            <a href={order.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-rose-600 hover:underline inline-flex items-center gap-1 font-medium"><Icon name="map" className="text-[11px]" /> Buka Peta</a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            {order.notes && (
                                                                <div className="flex items-start gap-2 text-[11.5px] text-slate-600 font-medium bg-amber-50 p-3 rounded-xl border border-amber-100">
                                                                    <Icon name="chat_bubble" className="text-[14px] mt-0.5 shrink-0 text-amber-500" />
                                                                    <span><span className="font-medium text-slate-800">Catatan Anda:</span> {order.notes}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between mt-4">
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                                                                <Icon name="event" className="text-[13px]" /> {order.timestamp}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                                                                <Icon name="payments" className="text-[13px]" /> Bayar COD
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {order.status === 'pending' && (
                                                        <div className="border-t border-slate-100 pt-3">
                                                            <button onClick={() => {
                                                                setConfirmModal({
                                                                    title: "Batalkan Pesanan?",
                                                                    message: "Apakah Anda yakin ingin membatalkan pesanan tiket ini?",
                                                                    confirmText: "Batalkan",
                                                                    onConfirm: () => {
                                                                        handleCancelOrderByWarga(order);
                                                                        setConfirmModal(null);
                                                                    }
                                                                });
                                                            }} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-medium py-2.5 rounded-full text-[11px] transition-colors flex items-center justify-center gap-1"><Icon name="cancel" className="text-[14px]" /> Batalkan Pesanan</button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sub Tab: Daftar Pembeli */}
                            {activeSubTab === 'buyers_list' && (
                                <div className="space-y-7">
                                    {/* Info Banner */}
                                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl p-4 flex items-start gap-3">
                                        <Icon name="info" className="text-[18px] text-google-blue shrink-0 mt-0.5" />
                                        <p className="text-[12px] font-medium text-blue-800 dark:text-blue-300 leading-relaxed">
                                            Daftar ini menampilkan semua warga yang telah memesan tiket (tidak termasuk yang dibatalkan). Total <span className="font-medium">{buyersList.length} pembeli</span> dengan <span className="font-medium">{buyersTotalTickets} tiket</span> telah dipesan.
                                        </p>
                                    </div>

                                    {/* Search */}
                                    <div className="relative">
                                        <input type="text" placeholder="Cari nama pembeli..." value={buyersSearch} onChange={e => setBuyersSearch(e.target.value)} style={{ paddingLeft: '1.25rem' }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 pr-5 py-3 rounded-2xl text-[13px] font-medium outline-none focus:border-google-blue/40 dark:text-slate-200" />
                                        {buyersSearch && (
                                            <button onClick={() => setBuyersSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><Icon name="close" className="text-[16px]" /></button>
                                        )}
                                    </div>

                                    {buyersListFiltered.length === 0 ? (
                                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center rounded-3xl">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center rounded-full mx-auto mb-4 text-slate-400">
                                                <Icon name="groups" className="text-[28px]" />
                                            </div>
                                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200">{buyersSearch ? 'Tidak ada pembeli ditemukan.' : 'Belum ada yang memesan tiket.'}</p>
                                            <p className="text-[11.5px] font-medium text-slate-400 mt-1">Jadilah yang pertama memesan tiket!</p>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                            {/* Header Tabel */}
                                            <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
                                                <div className="col-span-1 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center">#</div>
                                                <div className="col-span-6 text-[9px] font-medium text-slate-400 uppercase tracking-wider">Nama Pembeli</div>
                                                <div className="col-span-3 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center">Jumlah</div>
                                                <div className="col-span-2 text-[9px] font-medium text-slate-400 uppercase tracking-wider text-center">Tgl</div>
                                            </div>
                                            {/* Baris Pembeli */}
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                                {buyersListFiltered.map((order, idx) => (
                                                    <div key={order.id} className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${order.status === 'completed' ? 'bg-emerald-50/40 dark:bg-emerald-950/10' : ''}`}>
                                                        <div className="col-span-1 text-[10px] font-medium text-slate-400 text-center tabular-nums">{idx + 1}</div>
                                                        <div className="col-span-6 min-w-0">
                                                            <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 truncate leading-tight uppercase tracking-wide">{order.buyerName}</p>
                                                            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">{order.productName}</p>
                                                        </div>
                                                        <div className="col-span-3 text-center">
                                                            <span className="inline-flex items-center gap-1 bg-google-blueLight dark:bg-blue-950/40 text-google-blueDark dark:text-blue-400 border border-google-blue/20 dark:border-blue-900/40 text-[11px] font-medium px-2.5 py-1 rounded-full">
                                                                <Icon name="confirmation_number" className="text-[11px]" />
                                                                {order.quantity}
                                                            </span>
                                                        </div>
                                                        <div className="col-span-2 text-[9.5px] font-medium text-slate-400 text-center leading-tight">
                                                            {order.timestamp ? order.timestamp.slice(5) : '-'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Footer Ringkasan */}
                                            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total {buyersListFiltered.length} pembeli</span>
                                                <span className="inline-flex items-center gap-1.5 bg-google-blue text-white text-[11px] font-medium px-3 py-1.5 rounded-full">
                                                    <Icon name="confirmation_number" className="text-[12px]" />
                                                    {buyersListFiltered.reduce((sum, o) => sum + (o.quantity || 0), 0)} Tiket Dipesan
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Modal Beli Tiket (Warga) */}
                            {isBuyModalOpen && selectedProduct && (
                                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                                    <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                                            <h3 className="text-lg font-medium text-slate-800">Formulir Beli Tiket</h3>
                                            <button onClick={() => setIsBuyModalOpen(false)} className="w-8 h-8 rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 flex items-center justify-center"><Icon name="close" /></button>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="bg-google-blueLight border border-google-blue/20 rounded-2xl p-4 text-[12px] text-google-blueDark">
                                                <p className="font-medium">{selectedProduct.name}</p>
                                                <p className="font-medium text-slate-500 mt-0.5">Harga: {formatRp(selectedProduct.price)} / tiket</p>
                                                <p className="font-medium text-slate-500">Tersedia: {selectedProduct.stock} tiket</p>
                                            </div>

                                            {/* Pilihan Metode Penerimaan Tiket */}
                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Metode Penerimaan Tiket</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button type="button" onClick={() => setBuyForm({ ...buyForm, deliveryMethod: 'pickup' })} className={`p-4 rounded-full border font-medium text-[12px] text-center flex flex-col items-center justify-center gap-2 transition-all ${buyForm.deliveryMethod === 'pickup' ? 'border-google-blue bg-google-blueLight text-google-blueDark shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                                        <Icon name="store" className="text-[20px]" />
                                                        <span>Ambil Sendiri (COD)</span>
                                                    </button>
                                                    <button type="button" onClick={() => setBuyForm({ ...buyForm, deliveryMethod: 'delivery' })} className={`p-4 rounded-full border font-medium text-[12px] text-center flex flex-col items-center justify-center gap-2 transition-all ${buyForm.deliveryMethod === 'delivery' ? 'border-google-blue bg-google-blueLight text-google-blueDark shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                                                        <Icon name="local_shipping" className="text-[20px]" />
                                                        <span>Antar ke Rumah (COD)</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Tampilkan Input Waktu atau Info Lokasi */}
                                            {buyForm.deliveryMethod === 'delivery' ? (
                                                <div className="animate-fade-in bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-5">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Hari Pengantaran</label>
                                                            <input type="text" value={buyForm.deliveryDay} onChange={e => setBuyForm({...buyForm, deliveryDay: e.target.value})} className="w-full bg-white border border-slate-200 p-3.5 text-[13px] font-medium outline-none rounded-xl focus:border-google-blue/50 focus:shadow-sm transition-all" placeholder="Cth: Sabtu / Hari ini" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Jam Pengantaran</label>
                                                            <input type="text" value={buyForm.deliveryTime} onChange={e => setBuyForm({...buyForm, deliveryTime: e.target.value})} className="w-full bg-white border border-slate-200 p-3.5 text-[13px] font-medium outline-none rounded-xl focus:border-google-blue/50 focus:shadow-sm transition-all" placeholder="Cth: Jam 4 Sore / Malam" />
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 leading-normal flex items-start gap-1"><Icon name="info" className="text-[13px] text-google-blue shrink-0 mt-0.5" /> Karena lingkungan RT sama, alamat tidak diperlukan. Cukup atur waktu agar pengurus RT bisa mengantarkan tiket ke rumah Anda.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 p-4 rounded-2xl text-[12px] text-emerald-800 dark:text-emerald-400 animate-fade-in">
                                                    <div className="flex items-start gap-2">
                                                        <Icon name="info" className="text-[18px] shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="font-medium">Informasi Pengambilan & Pembayaran:</p>
                                                            <p className="font-medium mt-1">Pembayaran dilakukan secara tunai / bayar di tempat (COD) saat mengambil tiket langsung di:</p>
                                                            <p className="font-medium mt-1 text-[13px] flex items-center gap-1">
                                                                <Icon name="location_on" className="text-[14px]" /> {selectedProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}
                                                            </p>
                                                            {selectedProduct.pickupGeoUrl && (
                                                                <a href={selectedProduct.pickupGeoUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium underline hover:text-emerald-900"><Icon name="map" className="text-[13px]" /> Petunjuk Arah Google Maps</a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Nama Lengkap Pembeli</label>
                                                <input type="text" value={buyForm.name} onChange={e => setBuyForm({...buyForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Budi RT 02" />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Jumlah Tiket</label>
                                                    <div className="flex items-center gap-0 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-google-blue/50 focus-within:shadow-md transition-all">
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuyForm(f => ({ ...f, quantity: Math.max(1, (f.quantity || 1) - 1) }))}
                                                            className="w-14 h-14 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 active:scale-90 transition-all text-xl font-medium flex-shrink-0 select-none"
                                                        >-</button>
                                                        <span className="flex-1 text-center text-[18px] font-medium text-slate-800 select-none tabular-nums">
                                                            {buyForm.quantity || 1}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setBuyForm(f => ({ ...f, quantity: Math.min(selectedProduct.stock, (f.quantity || 1) + 1) }))}
                                                            disabled={(buyForm.quantity || 1) >= selectedProduct.stock}
                                                            className="w-14 h-14 flex items-center justify-center text-slate-500 hover:bg-green-50 hover:text-google-green active:scale-90 transition-all text-xl font-medium flex-shrink-0 select-none disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >+</button>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">Stok tersedia: <span className="text-google-blue font-medium">{selectedProduct.stock}</span> tiket</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Total Pembayaran</label>
                                                    <div className="w-full bg-google-blueLight border border-google-blue/20 p-4 text-[15px] font-medium text-google-blue rounded-2xl flex items-center justify-center h-14">
                                                        {formatRp(Number(buyForm.quantity || 1) * selectedProduct.price)}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 ml-1">{formatRp(selectedProduct.price)} × {buyForm.quantity || 1} tiket</p>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-2 ml-1">Catatan Tambahan (Opsional)</label>
                                                <input type="text" value={buyForm.notes} onChange={e => setBuyForm({...buyForm, notes: e.target.value})} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue/50 focus:shadow-md transition-all" placeholder="Cth: Kaos Ukuran L / Minta diantar sore hari" />
                                            </div>

                                            {wargaError && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[12px] font-medium border border-red-200 flex items-center gap-2"><Icon name="error" /> {wargaError}</div>}
                                        </div>
                                        <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                                            <button onClick={() => setIsBuyModalOpen(false)} className="w-1/3 bg-white text-slate-700 border border-slate-200 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all shadow-sm">Batal</button>
                                            <button onClick={handlePlaceOrder} className="w-2/3 bg-google-blue text-white px-4 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark transition-all flex items-center justify-center gap-2"><Icon name="shopping_cart_checkout" className="text-[16px]"/> Pesan Tiket (COD)</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {confirmModal && (
                        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 text-red-500">
                                    <Icon name="delete_forever" className="text-[40px]" fill="true" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 mb-2">{confirmModal.title}</h3>
                                <p className="text-[12.5px] font-medium text-slate-500 mb-6 leading-relaxed">{confirmModal.message}</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setConfirmModal(null)} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm">Batal</button>
                                    <button onClick={confirmModal.onConfirm} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-full font-medium text-[13px] active:scale-95 transition-all shadow-md">{confirmModal.confirmText || 'Hapus'}</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {sharingProduct && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                                    <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2"><Icon name="share" className="text-google-blue" /> Bagikan Tiket</h3>
                                    <button onClick={() => setSharingProduct(null)} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"><Icon name="close" /></button>
                                </div>

                                <div className="mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                                    <h4 className="font-medium text-[14px] text-slate-800 dark:text-slate-200 line-clamp-1">{sharingProduct.name}</h4>
                                    <p className="text-[12px] font-medium text-google-blue mt-0.5">{formatRp(sharingProduct.price)}</p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1"><Icon name="location_on" className="text-[13px] text-google-blue" /> {sharingProduct.pickupLocationName || 'Rumah Mas Novan / Rumah Pak RT'}</p>
                                </div>

                                <div className="space-y-2.5">
                                    <button onClick={() => handleShareToSocial('whatsapp')} className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="chat" className="text-[18px]" /> WhatsApp
                                    </button>
                                    <button onClick={() => handleShareToSocial('telegram')} className="w-full bg-[#0088cc] hover:bg-[#0077b3] text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="send" className="text-[18px] rotate-[-30deg] mt-[-2px]" /> Telegram
                                    </button>
                                    <button onClick={() => handleShareToSocial('facebook')} className="w-full bg-[#1877F2] hover:bg-[#1566d4] text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="facebook" className="text-[18px]" /> Facebook
                                    </button>
                                    <button onClick={() => handleShareToSocial('twitter')} className="w-full bg-slate-900 hover:bg-slate-950 text-white font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                        <Icon name="close" className="text-[18px]" /> X (Twitter)
                                    </button>
                                    <button onClick={() => handleShareToSocial('copy')} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 font-medium py-3.5 px-4 rounded-full text-[12.5px] transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 active:scale-95">
                                        <Icon name="content_copy" className="text-[18px]" /> Salin Tautan
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


export default Tiket;
