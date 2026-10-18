import React, { useState } from 'react';
import Icon from '../common/Icon.jsx';

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
                <div className="space-y-8 max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="bento-header-card flex flex-col md:flex-row justify-between items-center gap-4 no-print">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2 justify-center md:justify-start">
                                <Icon name="calendar_month" className="text-[24px] text-red-600"/>
                                Kalender Tiga Dimensi Waktu
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1.5">Penanggalan Nasional (Masehi), Jawa (Pasaran), dan Hijriah (Islam).</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 bg-red-50 border border-red-500/30 px-4 py-2.5 rounded-2xl shadow-sm">
                            <Icon name="today" className="text-[17px] text-red-600 animate-pulse" fill="true"/>
                            <div className="text-[11px] font-medium text-red-800">
                                Hari Ini: {getJavaneseDayName(new Date())} {getPasaran(new Date())}, {new Date().getDate()} {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Detail Day Card & Weton Checker */}
                        <div className="space-y-8">
                            {/* Hari Ini / Selected Day Info */}
                            <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm relative overflow-hidden group">
                                
                                <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                    <Icon name="info" className="text-[16px] text-red-600" />
                                    Detail Tanggal
                                </h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="bg-slate-50 border border-slate-200/60 p-6 sm:p-8 md:p-6 rounded-2xl shadow-sm">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-google-textVariant mb-1">Masehi / Nasional</p>
                                        <p className="font-medium text-[14px] text-google-text">
                                            {selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="bg-red-50/50 border border-red-500/20 p-6 sm:p-8 md:p-6 rounded-2xl shadow-sm">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-red-800 mb-1">Jawa / Pasaran</p>
                                        <p className="font-medium text-[14px] text-red-700">
                                            {selectedDetails.jawa}
                                        </p>
                                        <p className="text-[10px] font-medium text-red-600/80 mt-1">
                                            Weton: <span className="underline decoration-dotted">{selectedDetails.jawaDay} {selectedDetails.pasaran}</span>
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200/60 p-6 sm:p-8 md:p-6 rounded-2xl shadow-sm">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-google-textVariant mb-1">Hijriah / Kalender Islam</p>
                                        <p className="font-medium text-[14px] text-google-text">
                                            {selectedDetails.hijri}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Weton Checker Tool */}
                            <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm">
                                <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                    <Icon name="search" className="text-[16px] text-red-600" />
                                    Cek Weton & Pasaran Lahir
                                </h3>
                                <form onSubmit={handleCheckWeton} className="space-y-6">
                                    <div className="bg-slate-50 rounded-2xl px-4 py-3 border border-slate-200 focus-within:border-red-500 focus-within:bg-white transition-all shadow-sm">
                                        <label className="text-[10px] font-medium text-google-textVariant block mb-1 uppercase tracking-widest">Pilih Tanggal</label>
                                        <input type="date" value={checkDateStr} onChange={e => { setCheckDateStr(e.target.value); setCheckResult(null); }} className="w-full bg-transparent border-none text-[13px] font-medium outline-none p-0 text-google-text cursor-pointer animate-none" />
                                    </div>
                                    <button type="submit" className="w-full bg-red-600 text-white py-3.5 rounded-full font-medium text-[12px] border border-red-700 hover:bg-red-700 active:scale-95 transition-all duration-300 shadow-md flex flex-wrap justify-center items-center gap-1.5">
                                        <Icon name="explore" className="text-[14px]"/>
                                        Cek Sekarang
                                    </button>
                                </form>

                                {checkResult && (
                                    <div className="mt-5 p-6 sm:p-8 md:p-6 rounded-2xl bg-red-50 border border-red-500/30 space-y-2.5 tab-fade-in">
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest font-medium text-red-800">Hasil Analisis</p>
                                            <p className="text-[11px] font-medium text-slate-600 mt-1">Masehi: {checkResult.gregorian}</p>
                                        </div>
                                        <div className="h-px bg-red-500/10"></div>
                                        <div>
                                            <p className="text-[12px] font-medium text-red-700">Weton: {checkResult.weton}</p>
                                            <p className="text-[11px] font-medium text-red-800 mt-0.5">Jawa: {checkResult.jawa}</p>
                                            <p className="text-[11px] font-medium text-slate-700 mt-0.5">Hijriah: {checkResult.hijri}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Calendar Grid Sheet */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm flex flex-col">
                            {/* Navigation */}
                            <div className="flex justify-between items-center mb-6">
                                <button onClick={handlePrevMonth} className="w-10 h-10 bg-slate-50 border border-slate-200 text-google-text hover:bg-slate-100 hover:border-slate-400 rounded-full flex justify-center items-center active:scale-95 transition-all shadow-sm">
                                    <Icon name="chevron_left" className="text-[17px]" />
                                </button>
                                <h3 className="text-xl font-medium text-google-text tracking-tight uppercase">
                                    {monthNames[month]} {year}
                                </h3>
                                <button onClick={handleNextMonth} className="w-10 h-10 bg-slate-50 border border-slate-200 text-google-text hover:bg-slate-100 hover:border-slate-400 rounded-full flex justify-center items-center active:scale-95 transition-all shadow-sm">
                                    <Icon name="chevron_right" className="text-[17px]" />
                                </button>
                            </div>

                            {/* Day names of the week */}
                            <div className="grid grid-cols-7 gap-1 text-center font-medium text-[10px] uppercase tracking-wider text-google-textVariant mb-2 pb-2 border-b border-slate-200">
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
                                            className={`relative min-h-[64px] p-2 rounded-full border flex flex-col justify-between items-stretch text-left transition-all active:scale-95 ${
                                                !cell.isCurrentMonth ? 'opacity-30 border-transparent hover:border-slate-200' : ''
                                            } ${
                                                isSelected 
                                                    ? 'bg-red-600 text-white border-red-700 shadow-md scale-105 z-10' 
                                                    : isToday 
                                                        ? 'bg-red-50 border-red-500 text-red-700 shadow-sm font-medium' 
                                                        : 'bg-slate-50/50 border-slate-200/70 hover:border-red-500/40 hover:bg-white text-google-text'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-[12px] sm:text-[13px] font-medium leading-none">{cell.date.getDate()}</span>
                                                <span className={`text-[8px] sm:text-[9px] font-medium opacity-80 leading-none ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                                                    {dayDetails.hijriDay}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex flex-col items-stretch leading-tight">
                                                <span className={`text-[8px] sm:text-[9.5px] font-medium truncate ${
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


export default Kalender;
