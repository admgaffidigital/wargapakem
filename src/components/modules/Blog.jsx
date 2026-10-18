import React, { useState, useEffect } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { getLocalDate, parseLocalDate, uploadToGoogleDrive } from '../../utils/helpers.js';

        function Blog({ blogData, setBlogData, userRole, identity, initialArticleId }) {
            const [isFormOpen, setIsFormOpen] = useState(false);
            const [editingId, setEditingId] = useState(null);
            const [formData, setFormData] = useState({ title: '', content: '', imageUrl: '', date: getLocalDate() });
            const [errorMsg, setErrorMsg] = useState('');
            const [isUploading, setIsUploading] = useState(false);
            const [deleteConfirmId, setDeleteConfirmId] = useState(null);
            const [viewArticleId, setViewArticleId] = useState(initialArticleId || null);
            const [commentName, setCommentName] = useState('');
            const [commentText, setCommentText] = useState('');
            const [replyText, setReplyText] = useState('');
            const [replyToId, setReplyToId] = useState(null);

            useEffect(() => {
                if (initialArticleId) {
                    setViewArticleId(initialArticleId);
                }
            }, [initialArticleId]);

            const handleShareBlog = (article) => {
                const shareUrl = `${window.location.origin}${window.location.pathname}?page=blog&article=${article.id}`;
                const shareText = `Baca artikel menarik: *${article.title}* di Portal Warga RT Pakem!\n\nLink: ${shareUrl}`;
                
                if (navigator.share) {
                    navigator.share({
                        title: article.title,
                        text: `Baca artikel: ${article.title}`,
                        url: shareUrl
                    }).catch(() => {});
                } else {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        showToast('Tautan artikel berhasil disalin ke papan klip!');
                    }).catch(() => {
                        showToast('Gagal menyalin tautan.', 'error');
                    });
                }
            };

            const handleImageUpload = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (!file.type.match('image.*')) return setErrorMsg('File harus berupa gambar!');
                if (file.size > 10 * 1024 * 1024) return setErrorMsg('Ukuran file maksimal 10MB!');
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

            const handleSave = () => {
                if (!formData.title.trim() || !formData.content.trim()) return setErrorMsg('Judul dan Konten harus diisi!');
                const newArticle = {
                    id: editingId || Date.now().toString(),
                    ...formData,
                    likes: editingId ? (blogData.find(b => b.id === editingId)?.likes || 0) : 0,
                    comments: editingId ? (blogData.find(b => b.id === editingId)?.comments || []) : []
                };

                if (editingId) {
                    setBlogData(blogData.map(b => b.id === editingId ? newArticle : b));
                } else {
                    setBlogData([newArticle, ...blogData]);
                }
                setIsFormOpen(false); setEditingId(null); setFormData({ title: '', content: '', imageUrl: '', date: getLocalDate() });
            };

            const handleDelete = (id) => {
                setBlogData(blogData.filter(b => b.id !== id));
                setDeleteConfirmId(null);
                if (viewArticleId === id) setViewArticleId(null);
            };

            const handleLike = (id) => {
                setBlogData(blogData.map(b => {
                    if (b.id === id) {
                        return { ...b, likes: (b.likes || 0) + 1 };
                    }
                    return b;
                }));
            };

            const handleComment = (id) => {
                if (!commentName.trim() || !commentText.trim()) return setErrorMsg('Nama dan Komentar harus diisi!');
                const newComment = { id: Date.now().toString(), name: commentName, text: commentText, date: new Date().toISOString(), role: userRole === 'admin' ? 'Admin' : 'Warga' };
                setBlogData(blogData.map(b => {
                    if (b.id === id) {
                        return { ...b, comments: [...(b.comments || []), newComment] };
                    }
                    return b;
                }));
                setCommentText(''); setErrorMsg('');
            };

            const handleReply = (articleId, commentId) => {
                if (!replyText.trim()) return;
                const reply = { id: Date.now().toString(), text: replyText, date: new Date().toISOString(), role: 'Admin' };
                setBlogData(blogData.map(b => {
                    if (b.id === articleId) {
                        return {
                            ...b, comments: (b.comments || []).map(c => {
                                if (c.id === commentId) {
                                    return { ...c, replies: [...(c.replies || []), reply] };
                                }
                                return c;
                            })
                        };
                    }
                    return b;
                }));
                setReplyText(''); setReplyToId(null);
            };

            if (viewArticleId) {
                const article = blogData.find(b => b.id === viewArticleId);
                if (!article) return <div className="p-8 text-center">Artikel tidak ditemukan <button onClick={() => setViewArticleId(null)} className="text-google-blue underline ml-2">Kembali</button></div>;
                
                return (
                    <div className="space-y-8 tab-fade-in relative z-10 w-full animate-slide-up no-print">
                        <button onClick={() => { setViewArticleId(null); const url = new URL(window.location.href); url.searchParams.delete('page'); url.searchParams.delete('article'); window.history.replaceState({}, document.title, url.pathname + url.hash); }} className="bg-white border border-slate-200 text-google-text px-4 py-2 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm w-fit active:scale-95"><Icon name="arrow_back" /> Kembali</button>
                        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200">
                            {article.imageUrl && <img src={article.imageUrl} alt={article.title} className="w-full h-64 sm:h-80 object-cover" />}
                            <div className="p-6 sm:p-8">
                                <h2 className="text-2xl sm:text-3xl font-medium text-google-text mb-4 tracking-tight leading-tight">{article.title}</h2>
                                <div className="flex items-center gap-4 text-[12px] font-medium text-google-textVariant mb-8 pb-6 border-b border-slate-100">
                                    <span className="flex items-center gap-1.5"><Icon name="calendar_today" className="text-[14px]"/> {parseLocalDate(article.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year:'numeric'})}</span>
                                    <span className="flex items-center gap-1.5"><Icon name="person" className="text-[14px]"/> Ditulis oleh Admin</span>
                                </div>
                                <div className="prose prose-sm sm:prose-base max-w-none text-slate-700 leading-relaxed text-justify whitespace-pre-wrap">
                                    {article.content}
                                </div>
                                
                                <div className="mt-10 pt-6 border-t border-slate-100 flex items-center gap-3">
                                    <button onClick={() => handleLike(article.id)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors active:scale-95"><Icon name="favorite" fill="true" className="text-[20px]" /> <span className="font-medium">{article.likes || 0} Suka</span></button>
                                    <button onClick={() => handleShareBlog(article)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors active:scale-95"><Icon name="share" className="text-[20px]" /> <span className="font-medium">Bagikan</span></button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
                            <h3 className="text-xl font-medium text-google-text mb-6">Komentar Warga ({article.comments?.length || 0})</h3>
                            
                            <div className="mb-8 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                                <h4 className="text-[13px] font-medium text-google-text mb-3">Tulis Komentar</h4>
                                <input type="text" value={commentName} onChange={e => setCommentName(e.target.value)} placeholder="Nama Anda (Misal: Budi RT 01)" className="w-full bg-white border border-slate-200 p-3 rounded-xl text-[13px] mb-3 outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 transition-all" />
                                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Tulis pendapat atau pertanyaan Anda..." className="w-full bg-white border border-slate-200 p-3 rounded-xl text-[13px] mb-3 outline-none focus:border-google-blue focus:ring-2 focus:ring-google-blue/20 transition-all resize-none h-24"></textarea>
                                {errorMsg && <p className="text-red-500 text-[12px] font-medium mb-3">{errorMsg}</p>}
                                <button onClick={() => handleComment(article.id)} className="bg-google-blue text-white px-5 py-2.5 rounded-full font-medium text-[13px] hover:bg-google-blueDark transition-colors active:scale-95 flex items-center gap-2"><Icon name="send" /> Kirim Komentar</button>
                            </div>

                            <div className="space-y-7">
                                {(article.comments || []).map(c => (
                                    <div key={c.id} className="bg-white border border-slate-100 p-5 rounded-2xl">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-medium">{c.name.charAt(0).toUpperCase()}</div>
                                            <div>
                                                <p className="font-medium text-[14px] text-google-text">{c.name} {c.role === 'Admin' && <span className="bg-google-blueLight text-google-blueDark px-2 py-0.5 rounded-md text-[10px] ml-2">Admin</span>}</p>
                                                <p className="text-[11px] text-google-textVariant">{new Date(c.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric', hour: '2-digit', minute:'2-digit'})}</p>
                                            </div>
                                        </div>
                                        <p className="text-[13px] text-slate-700 mt-2 whitespace-pre-wrap">{c.text}</p>
                                        
                                        {(c.replies || []).map(r => (
                                            <div key={r.id} className="mt-3 ml-6 pl-4 border-l border-google-blue/30 bg-google-blueLight/30 p-3 rounded-r-[12px]">
                                                <p className="font-medium text-[12px] text-google-blueDark flex items-center gap-1.5"><Icon name="admin_panel_settings" className="text-[14px]" /> Balasan Admin</p>
                                                <p className="text-[13px] text-slate-700 mt-1 whitespace-pre-wrap">{r.text}</p>
                                            </div>
                                        ))}

                                        {userRole === 'admin' && replyToId !== c.id && (
                                            <button onClick={() => setReplyToId(c.id)} className="mt-3 text-[12px] font-medium text-google-blue flex items-center gap-1 hover:underline"><Icon name="reply" className="text-[14px]" /> Balas sebagai Admin</button>
                                        )}

                                        {replyToId === c.id && (
                                            <div className="mt-3 ml-6">
                                                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Tulis balasan..." className="w-full bg-white border border-slate-200 p-3 rounded-lg text-[12px] mb-2 outline-none focus:border-google-blue resize-none h-20"></textarea>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleReply(article.id, c.id)} className="bg-google-blue text-white px-4 py-2 rounded-full text-[11px] font-medium hover:bg-google-blueDark active:scale-95 transition-all">Kirim Balasan</button>
                                                    <button onClick={() => setReplyToId(null)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-full text-[11px] font-medium hover:bg-slate-300 active:scale-95 transition-all">Batal</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!article.comments || article.comments.length === 0) && <p className="text-[13px] text-center text-slate-500 py-6">Belum ada komentar. Jadilah yang pertama berkomentar!</p>}
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <>
                <div className="space-y-8 tab-fade-in relative z-10 w-full animate-slide-up no-print">
                    <div className="bg-google-yellow text-white p-8 sm:p-10 rounded-3xl border border-amber-600/20 shadow-lg relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-2 bg-white/20  px-3.5 py-1.5 rounded-full mb-4 border border-white/30 shadow-sm">
                                <Icon name="article" className="text-[14px] sm:text-[16px]" fill="true"/>
                                <span className="text-[9px] sm:text-[10px] font-medium uppercase tracking-widest">Warta Warga</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-medium mb-3 tracking-tight [text-shadow:_0_2px_10px_rgba(0,0,0,0.2)]">Blog & Artikel</h2>
                            <p className="text-[13px] sm:text-[14px] font-medium text-white/90 max-w-lg leading-relaxed">Berita, pengumuman, dan cerita menarik dari lingkungan kita.</p>
                        </div>
                        <Icon name="newspaper" className="absolute -bottom-6 -right-6 text-[140px] text-white opacity-20 transform -rotate-12" fill="true" />
                    </div>

                    {userRole === 'admin' && (
                        <div className="flex justify-end">
                            <button onClick={() => { setIsFormOpen(true); setEditingId(null); setFormData({ title: '', content: '', imageUrl: '', date: getLocalDate() }); }} className="bg-google-blue text-white px-5 py-3 rounded-full font-medium text-[13px] hover:bg-google-blueDark transition-colors active:scale-95 flex items-center gap-2 shadow-md"><Icon name="add" className="text-[18px]"/> Tulis Artikel Baru</button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {blogData.map(article => (
                            <a href={`/?page=blog&article=${article.id}`} key={article.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-google-yellow/40 transition-all duration-300 group flex flex-col cursor-pointer" onClick={(e) => { e.preventDefault(); setViewArticleId(article.id); }}>
                                {article.imageUrl ? (
                                    <div className="w-full h-48 bg-slate-100 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300 z-10"></div>
                                        <img src={article.imageUrl} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    </div>
                                ) : (
                                    <div className="w-full h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden">
                                        <Icon name="article" className="text-[64px] text-slate-300" />
                                    </div>
                                )}
                                <div className="p-6 flex flex-col flex-1">
                                    <p className="text-[11px] font-medium text-google-textVariant mb-2 flex items-center gap-1.5"><Icon name="calendar_today" className="text-[13px]"/> {parseLocalDate(article.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year:'numeric'})}</p>
                                    <h3 className="font-medium text-[16px] text-google-text mb-3 line-clamp-2 leading-snug group-hover:text-google-blue transition-colors">{article.title}</h3>
                                    <p className="text-[13px] text-slate-500 line-clamp-3 flex-1 mb-4 leading-relaxed whitespace-pre-wrap">{article.content && article.content.length > 150 ? article.content.substring(0, 150) + '...' : article.content}</p>
                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                                        <div className="flex gap-4">
                                            <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500"><Icon name="favorite" className="text-[14px]" /> {article.likes || 0}</span>
                                            <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500"><Icon name="chat_bubble" className="text-[14px]" /> {article.comments?.length || 0}</span>
                                        </div>
                                    </div>
                                    
                                    {userRole === 'admin' && (
                                        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { setEditingId(article.id); setFormData({ title: article.title, content: article.content, imageUrl: article.imageUrl, date: article.date }); setIsFormOpen(true); }} className="flex-1 flex items-center justify-center gap-1.5 bg-google-blue text-white hover:bg-google-blueDark rounded-full py-2 px-3 text-[12px] font-medium transition-all shadow-sm active:scale-95"><Icon name="edit" className="text-[14px]" /> Edit</button>
                                            <button onClick={() => setDeleteConfirmId(article.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-google-red/10 text-google-red hover:bg-google-red hover:text-white rounded-full py-2 px-3 text-[12px] font-medium transition-all active:scale-95"><Icon name="delete" className="text-[14px]" /> Hapus</button>
                                        </div>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                    {blogData.length === 0 && <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm"><div className="bg-slate-50 w-24 h-24 flex items-center justify-center rounded-full mb-6 mx-auto border border-slate-200"><Icon name="article" className="text-[48px] text-slate-400" /></div><h3 className="font-medium text-[18px] text-google-text mb-2">Belum Ada Artikel</h3><p className="text-google-textVariant font-medium text-[13px]">Artikel atau blog yang diterbitkan oleh Admin akan muncul di sini.</p></div>}
                </div>

                    {isFormOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto hide-scrollbar border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <h3 className="text-2xl font-medium text-google-text mb-6 tracking-tight">{editingId ? 'Edit Artikel' : 'Tulis Artikel Baru'}</h3>
                                <div className="space-y-7">
                                    <div><label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest block mb-2 ml-1">Judul Artikel</label><input type="text" value={formData.title} onChange={e => {setFormData({...formData, title: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue focus:shadow-md transition-all" placeholder="Tulis judul yang menarik..." /></div>
                                    <div><label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest block mb-2 ml-1">Isi Konten</label><textarea value={formData.content} onChange={e => {setFormData({...formData, content: e.target.value}); setErrorMsg('');}} className="w-full bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium outline-none rounded-2xl focus:bg-white focus:border-google-blue focus:shadow-md transition-all h-48 resize-y" placeholder="Tulis cerita atau informasi lengkap di sini..."></textarea></div>
                                    <div>
                                        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest block mb-2 ml-1">Upload Gambar Cover (Opsional)</label>
                                        <div className={`flex items-center gap-4 bg-slate-50 border ${isUploading ? 'border-google-blue shadow-md' : 'border-slate-200'} p-3 rounded-2xl relative overflow-hidden focus-within:border-google-blue transition-all`}>
                                            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" />
                                            <div className="bg-white w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200 text-google-textVariant relative z-0">
                                                {isUploading ? <div className="w-5 h-5 border border-google-blue border-t-transparent rounded-full animate-spin"></div> : <Icon name="image" className="text-[20px]" />}
                                            </div>
                                            <div className="relative z-0 flex-1 min-w-0">
                                                <p className="font-medium text-[13px] text-google-text truncate">{isUploading ? "Mengunggah..." : (formData.imageUrl ? "Gambar Siap" : "Pilih Gambar")}</p>
                                                <p className="text-[11px] text-google-textVariant truncate">{formData.imageUrl ? "Klik untuk mengganti gambar" : "Maksimal 10MB"}</p>
                                            </div>
                                            {formData.imageUrl && !isUploading && (
                                                <div className="relative z-20 shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-200"><img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" /></div>
                                            )}
                                        </div>
                                    </div>
                                    {errorMsg && <div className="bg-red-50 text-red-600 px-4 py-3.5 rounded-xl text-[12px] font-medium flex items-center gap-2 border border-red-200"><Icon name="error" /> {errorMsg}</div>}
                                </div>
                                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100">
                                    <button onClick={() => { setIsFormOpen(false); setErrorMsg(''); setIsUploading(false); }} className="w-1/3 bg-white text-google-text border border-slate-200 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 transition-all active:scale-95 shadow-sm">Batal</button>
                                    <button onClick={handleSave} disabled={isUploading} className="w-2/3 bg-google-blue text-white px-4 py-3.5 rounded-full font-medium text-[13px] shadow-md hover:shadow-lg hover:bg-google-blueDark transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"><Icon name="save" className="text-[16px]"/> Terbitkan</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {deleteConfirmId && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop animate-backdrop-in">
                            <div className="rounded-3xl p-6 sm:p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 text-red-500"><Icon name="delete_forever" className="text-[48px]" fill="true" /></div>
                                <h3 className="text-2xl font-medium text-google-text mb-2">Hapus Artikel?</h3>
                                <p className="text-[13px] text-slate-500 mb-8 leading-relaxed">Artikel ini dan semua komentar di dalamnya akan dihapus secara permanen. Anda yakin?</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setDeleteConfirmId(null)} className="flex-1 bg-white border border-slate-200 text-google-text px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm">Batal</button>
                                    <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 bg-red-500 text-white border border-red-600 px-4 py-3.5 rounded-full font-medium text-[13px] hover:bg-red-600 active:scale-95 transition-all shadow-md">Hapus Permanen</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            );
        }


export default Blog;
