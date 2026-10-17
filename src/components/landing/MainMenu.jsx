import React from 'react';
import Icon from '../common/Icon.jsx';

        function MainMenu({ userRole, NavItems, changeTab, identity, bannerImage, setShowPwaGuide, sponsorsData, nextMeeting }) {
            return (
                <div className="space-y-8 sm:space-y-8 max-w-7xl mx-auto mt-2">
                    
                    {/* --- AREA BANNER UTAMA --- */}
                    <div className={`relative rounded-3xl sm:rounded-3xl p-6 sm:p-10 text-white border border-red-400/20 shadow-xl shadow-red-500/20 dark:border-red-900/30 overflow-hidden group min-h-[220px] sm:min-h-[280px] flex items-end ${!bannerImage ? 'bg-red-600' : 'bg-slate-900'}`}>
                        {bannerImage && (
                            <>
                                <img src={bannerImage} alt="Banner Lingkungan" className="absolute inset-0 w-full h-full object-cover object-center z-0 group-hover:scale-105 transition-transform duration-1000" />
                                <div className="absolute inset-0 bg-slate-950/65 z-0"></div>
                            </>
                        )}

                        <div className="relative z-10 w-full text-left pb-2">
                            <div className="inline-flex items-center gap-1.5 bg-red-800 px-3.5 py-1.5 rounded-full mb-3 border border-white/20 shadow-sm w-fit">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-[9px] font-medium uppercase tracking-widest text-white/90">Sistem Aktif</span>
                            </div>
                            
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-medium mb-2 tracking-tight text-white uppercase [text-shadow:_0_4px_12px_rgba(0,0,0,0.4)]">
                                Halo, {userRole === 'admin' ? 'Admin!' : 'Warga!'}
                            </h2>
                            <p className="text-[12.5px] sm:text-[13px] font-medium text-white/95 leading-relaxed max-w-2xl [text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]">
                                {identity.subtitle}
                            </p>
                        </div>
                    </div>
                    {/* --- AKHIR AREA BANNER --- */}

                    {/* --- AREA RUNNING TEXT AGENDA --- */}
                    {nextMeeting && nextMeeting.date && nextMeeting.date !== 'Belum dijadwalkan' && (
                        <div className="bg-red-50 border border-red-200 text-red-800 rounded-full px-4 py-2 flex items-center gap-3 overflow-hidden shadow-sm mt-4">
                            <Icon name="campaign" className="text-red-600 shrink-0 animate-pulse text-[17px]" />
                            <marquee className="text-[12px] font-medium tracking-wide whitespace-nowrap uppercase">
                                Info Agenda Mendatang: <span className="font-medium text-red-700">{nextMeeting.date}</span> jam <span className="font-medium text-red-700">{nextMeeting.time}</span> di <span className="font-medium text-red-700">{nextMeeting.location}</span>. Agenda: {nextMeeting.notes}
                            </marquee>
                        </div>
                    )}

                    {/* AREA GRID MENU */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 mt-6">
                            {NavItems.map((item, idx) => (
                            <button key={item.id} onClick={() => changeTab(item.id)} style={{ animationDelay: `${idx * 0.05}s` }} className="menu-item-in relative overflow-hidden bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-600 hover:-translate-y-1.5 transition-all duration-300 flex flex-col items-center justify-center text-center gap-3 active:scale-95 group">
                                <div className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:-rotate-6 shadow-sm group-hover:shadow-md border border-white/60 ${item.bg} ${item.color.replace('border', '')}`}>
                                    <Icon name={item.icon} className="relative z-10 text-[26px] sm:text-[30px] drop-shadow-sm" fill="true" />
                                </div>
                                
                                <span className="relative z-10 text-[12.5px] sm:text-[13px] font-medium text-google-textVariant group-hover:text-google-blueDark transition-colors tracking-tight">{item.label}</span>
                            </button>
                        ))}
                    </div>




    
                    {userRole !== 'admin' && (
                        <div className="flex justify-center mt-16 mb-4">
                            <div className="bg-white py-2 px-4 rounded-full text-center border border-slate-200 shadow-sm flex items-center justify-center">
                                <p className="text-[10px] font-medium text-google-textVariant flex flex-wrap items-center justify-center gap-1.5"><Icon name="info" className="text-[13px]" /> Mode Warga (akses terbatas).</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

export default MainMenu;
