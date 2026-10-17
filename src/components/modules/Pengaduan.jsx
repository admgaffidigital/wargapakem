import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';
import { uploadToGoogleDrive } from '../../utils/helpers.js';

        function Pengaduan({ laporanData, setLaporanData, userRole }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [formData, setFormData] = useState({ title: '', category: 'Infrastruktur', description: '', reporter: '', imageUrl: '', status: 'Menunggu' });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [filterStatus, setFilterStatus] = useState('Semua');
            // Deklarasi di atas agar dapat diakses oleh semua handler
            const [modalConfig, setModalConfig] = useState(null);

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

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran maksimal 10MB!');
                setIsUploading(true); setErrorMsg('');
                try {
                    const url = await uploadToGoogleDrive(file, 800, 0.6);
                    setFormData({ ...formData, imageUrl: url });
                } catch(error) {
                    setErrorMsg(error);
                } finally {
                    setIsUploading(false);
                }
            };

            const changeStatus = (id, newStatus) => {
                setLaporanData((laporanData || []).map(item => item.id === id ? { ...item, status: newStatus } : item));
            };

            const filteredData = (laporanData || []).filter(item => filterStatus === 'Semua' || item.status === filterStatus);

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
                <div className="animate-fade-in pb-24 w-full">
                    {modalConfig && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-2xl p-8 max-w-sm w-full text-center modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Icon name="check_circle" className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-800 mb-2">Berhasil</h3>
                                <p className="text-slate-600 mb-8">{modalConfig.message}</p>
                                <button onClick={() => setModalConfig(null)} className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-4 rounded-full transition-all">Tutup</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 p-6 sm:p-10 rounded-3xl border border-blue-200/60 shadow-md shadow-blue-500/10 mb-8 relative overflow-hidden">
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 text-white rounded-xl mb-4 shadow-lg">
                                    <Icon name="campaign" />
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-medium text-slate-800 tracking-tight mb-2">Lapor</h1>
                                <p className="text-slate-600 text-[13px] sm:text-[14px] max-w-xl font-medium leading-relaxed">Sistem Pengaduan dan Aspirasi Warga. Laporkan keluhan atau berikan saran untuk lingkungan kita.</p>
                            </div>
                            <button onClick={() => setIsFormOpen(true)} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-full font-medium text-[13px] shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2 group">
                                <Icon name="add_circle" className="group-hover:rotate-90 transition-transform duration-300" /> Buat Laporan
                            </button>
                        </div>
                    </div>

                    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {['Semua', ...statuses].map(status => (
                            <button key={status} onClick={() => setFilterStatus(status)} className={`px-5 py-2.5 rounded-full font-medium text-sm whitespace-nowrap transition-all ${filterStatus === status ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                                {status}
                            </button>
                        ))}
                    </div>

                    {filteredData.length === 0 ? (
                        <div className="bg-white/80  rounded-3xl p-12 text-center border border-dashed border-slate-200 shadow-sm">
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Icon name="task_alt" className="text-[48px] text-slate-300" />
                            </div>
                            <h3 className="text-xl font-medium text-slate-700 mb-2">Belum Ada Laporan</h3>
                            <p className="text-slate-500 font-medium">Lingkungan aman terkendali. Belum ada pengaduan warga.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredData.map(item => (
                                <div key={item.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-medium">{item.category}</span>
                                            <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${getStatusColor(item.status)}`}>{item.status}</span>
                                        </div>
                                        {userRole === 'admin' && (
                                            <button onClick={() => setDeleteConfirmId(item.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                                <Icon name="delete" className="text-[14px]" />
                                            </button>
                                        )}
                                    </div>
                                    <h3 className="text-xl font-medium text-slate-800 mb-2">{item.title}</h3>
                                    <p className="text-slate-600 text-sm mb-4 leading-relaxed line-clamp-4">{item.description}</p>
                                    
                                    {item.imageUrl && (
                                        <div className="mb-4 rounded-lg overflow-hidden bg-slate-100 h-48 border border-slate-200">
                                            <img src={item.imageUrl} alt="Lampiran Laporan" loading="lazy" className="w-full h-full object-cover" />
                                        </div>
                                    )}

                                    <div className="mt-auto pt-4 border-t border-slate-200 flex items-center justify-between text-xs font-medium text-slate-500">
                                        <div className="flex items-center gap-1.5"><Icon name="person" className="text-[14px]" /> {item.reporter || 'Warga'}</div>
                                        <div className="flex items-center gap-1.5"><Icon name="schedule" className="text-[14px]" /> {formatDate(item.date)}</div>
                                    </div>

                                    {userRole === 'admin' && (
                                        <div className="mt-4 flex gap-2">
                                            {statuses.map(st => (
                                                item.status !== st && (
                                                    <button key={st} onClick={() => changeStatus(item.id, st)} className={`flex-1 py-2 rounded-full text-xs font-medium border transition-colors ${st === 'Menunggu' ? 'border-red-200 text-red-600 hover:bg-red-50' : st === 'Diproses' ? 'border-yellow-200 text-yellow-600 hover:bg-yellow-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
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
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="w-full max-w-lg rounded-3xl flex flex-col max-h-[90vh] modal-card animate-modal-in">
                                <div className="p-6 sm:p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-blue-50 dark:bg-slate-900 rounded-t-[32px]">
                                    <h2 className="text-2xl font-medium text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                        <Icon name="campaign" className="text-blue-600" /> Buat Laporan
                                    </h2>
                                    <button onClick={() => setIsFormOpen(false)} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 border border-slate-200 dark:border-slate-700 transition-all"><Icon name="close" /></button>
                                </div>
                                <div className="p-6 sm:p-8 overflow-y-auto space-y-7">
                                    {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[13px] font-medium border border-red-100 flex items-center gap-2"><Icon name="error" /> {errorMsg}</div>}
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Judul Laporan</label>
                                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white" placeholder="Cth: Lampu jalan mati di Blok A" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kategori</label>
                                        <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white appearance-none bg-white dark:bg-slate-800">
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Isi Laporan / Detail</label>
                                        <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows="4" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white resize-none" placeholder="Ceritakan detail masalah..."></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nama Pelapor (Opsional)</label>
                                        <input type="text" value={formData.reporter} onChange={e => setFormData({...formData, reporter: e.target.value})} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3.5 focus:border-blue-500 outline-none transition-all font-medium text-slate-700 dark:text-white" placeholder="Kosongkan jika ingin anonim" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Lampiran Foto (Opsional)</label>
                                        <div className="border border-dashed border-slate-400 dark:border-slate-650 rounded-xl p-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative bg-white dark:bg-slate-800/40">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                            {isUploading ? (
                                                <div className="flex flex-col items-center justify-center text-slate-500 py-4"><Icon name="sync" className="animate-spin text-[32px] mb-2 text-blue-500" /><span className="font-medium">Memproses gambar...</span></div>
                                            ) : formData.imageUrl ? (
                                                <div className="relative inline-block">
                                                    <img src={formData.imageUrl} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                                                    <div className="absolute top-2 right-2 bg-slate-900/60 text-white text-[10px] px-2 py-1 rounded-md font-medium">Ganti</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 py-4"><Icon name="add_a_photo" className="text-[36px] mb-3 text-slate-400 dark:text-slate-500" /><span className="font-medium text-sm">Upload foto bukti</span></div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 sm:p-8 border-t border-slate-200 dark:border-slate-800 flex gap-3 shrink-0 bg-slate-50 dark:bg-slate-950 rounded-b-[32px]">
                                    <button onClick={() => setIsFormOpen(false)} className="flex-1 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-200 font-medium py-4 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="flex-1 bg-blue-600 text-white font-medium py-4 rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">Kirim Laporan</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="max-w-sm w-full rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="w-20 h-20 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center mx-auto mb-5"><Icon name="warning" className="text-[40px] text-red-500" /></div>
                                <h3 className="text-xl font-medium text-slate-800 dark:text-white mb-2">Hapus Laporan?</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">Laporan yang dihapus tidak dapat dikembalikan. Yakin?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full font-medium hover:bg-slate-200 dark:hover:bg-slate-700">Batal</button>
                                    <button onClick={() => {
                                        setLaporanData((laporanData || []).filter(item => item.id !== deleteConfirmId));
                                        setModalConfig && setModalConfig({ message: 'Laporan dihapus.' });
                                        setDeleteConfirmId(null);
                                    }} className="flex-1 py-3.5 bg-red-500 text-white rounded-full font-medium shadow-md hover:bg-red-600 active:scale-95">Ya, Hapus</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        }


export default Pengaduan;
