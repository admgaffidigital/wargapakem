import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';

        function WaktuSholatWidget() {
            const DEFAULT_LAT = -7.8246;
            const DEFAULT_LNG = 112.0792;
            const DEFAULT_CITY = 'Gurah, Kediri';

            const [city, setCity] = useState(() => localStorage.getItem('sholat_city_name') || DEFAULT_CITY);
            const [coords, setCoords] = useState(() => {
                const lat = localStorage.getItem('sholat_lat');
                const lng = localStorage.getItem('sholat_lng');
                return lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
            });
            const [isGPS, setIsGPS] = useState(() => localStorage.getItem('sholat_is_gps') === 'true');

            const [schedule, setSchedule] = useState(() => {
                try {
                    const cached = localStorage.getItem('sholat_schedule_today');
                    return cached ? JSON.parse(cached) : null;
                } catch(e) { return null; }
            });
            const [searchQuery, setSearchQuery] = useState('');
            const [searchResults, setSearchResults] = useState([]);
            const [isSearching, setIsSearching] = useState(false);
            const [loading, setLoading] = useState(false);
            const [nextPrayer, setNextPrayer] = useState(null);
            const [timeRemaining, setTimeRemaining] = useState('');
            const [adzanEnabled, setAdzanEnabled] = useState(() => localStorage.getItem('sholat_adzan_enabled') === 'true');
            const lastAdzanPlayed = useRef(null);

            const fetchByCoords = useCallback(async (lat, lng) => {
                setLoading(true);
                const now = new Date();
                const d = String(now.getDate()).padStart(2, '0');
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const y = now.getFullYear();

                try {
                    const res = await fetch(`https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${lat}&longitude=${lng}&method=11`);
                    const data = await res.json();
                    if (data && data.code === 200 && data.data && data.data.timings) {
                        const t = data.data.timings;
                        const todayJadwal = {
                            tanggal: `${d}/${m}/${y}`,
                            imsak: t.Imsak,
                            subuh: t.Fajr,
                            dzuhur: t.Dhuhr,
                            ashar: t.Asr,
                            maghrib: t.Maghrib,
                            isya: t.Isha
                        };
                        setSchedule(todayJadwal);
                        localStorage.setItem('sholat_schedule_today', JSON.stringify(todayJadwal));
                    }
                } catch (e) {
                    console.warn("Gagal mengambil jadwal sholat Aladhan:", e);
                } finally {
                    setLoading(false);
                }
            }, []);

            const fetchByCityId = useCallback(async (cId) => {
                setLoading(true);
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                
                try {
                    const res = await fetch(`https://api.myquran.com/v2/sholat/jadwal/${cId}/${y}/${m}/${d}`);
                    const data = await res.json();
                    if (data && data.status && data.data && data.data.jadwal) {
                        const todayJadwal = data.data.jadwal;
                        setSchedule(todayJadwal);
                        localStorage.setItem('sholat_schedule_today', JSON.stringify(todayJadwal));
                    }
                } catch (e) {
                    console.warn("Gagal mengambil jadwal sholat Kemenag:", e);
                } finally {
                    setLoading(false);
                }
            }, []);

            const handleGPSDetection = () => {
                if (!navigator.geolocation) {
                    showToast('Geolokasi tidak didukung oleh browser Anda.', 'error');
                    return;
                }
                setLoading(true);
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        setCoords({ lat, lng });
                        setIsGPS(true);
                        setCity('Lokasi GPS Aktif');
                        localStorage.setItem('sholat_lat', lat);
                        localStorage.setItem('sholat_lng', lng);
                        localStorage.setItem('sholat_is_gps', 'true');
                        localStorage.setItem('sholat_city_name', 'Lokasi GPS Aktif');
                        fetchByCoords(lat, lng);
                        showToast('Berhasil mendeteksi lokasi GPS perangkat.');
                    },
                    (error) => {
                        console.error(error);
                        showToast('Gagal mengakses GPS. Pastikan izin lokasi aktif.', 'error');
                        setLoading(false);
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            };

            const handleSearchCity = async (e) => {
                e.preventDefault();
                if (!searchQuery.trim()) return;
                setIsSearching(true);
                try {
                    const res = await fetch(`https://api.myquran.com/v2/sholat/kota/cari/${searchQuery.trim()}`);
                    const data = await res.json();
                    if (data && data.status && Array.isArray(data.data)) {
                        setSearchResults(data.data);
                    } else {
                        setSearchResults([]);
                    }
                } catch (e) {
                    console.error(e);
                    showToast('Gagal mencari kota. Coba lagi.', 'error');
                } finally {
                    setIsSearching(false);
                }
            };

            const selectCity = (selectedCity) => {
                setCity(selectedCity.lokasi);
                setIsGPS(false);
                localStorage.setItem('sholat_city_name', selectedCity.lokasi);
                localStorage.setItem('sholat_is_gps', 'false');
                localStorage.removeItem('sholat_lat');
                localStorage.removeItem('sholat_lng');
                setSearchResults([]);
                setSearchQuery('');
                fetchByCityId(selectedCity.id);
            };

            useEffect(() => {
                if (isGPS) {
                    fetchByCoords(coords.lat, coords.lng);
                } else {
                    if (city === DEFAULT_CITY) {
                        fetchByCoords(DEFAULT_LAT, DEFAULT_LNG);
                    } else {
                        const savedCityId = localStorage.getItem('sholat_city_id') || '1609';
                        fetchByCityId(savedCityId);
                    }
                }
            }, [isGPS, coords, fetchByCoords, fetchByCityId, city]);

            useEffect(() => {
                if (!schedule) return;

                const timer = setInterval(() => {
                    const now = new Date();
                    const prayerTimes = [
                        { name: 'Imsak', time: schedule.imsak },
                        { name: 'Subuh', time: schedule.subuh },
                        { name: 'Dzuhur', time: schedule.dzuhur },
                        { name: 'Ashar', time: schedule.ashar },
                        { name: 'Maghrib', time: schedule.maghrib },
                        { name: 'Isya', time: schedule.isya }
                    ];

                    let upcoming = null;
                    let minDiff = Infinity;

                    prayerTimes.forEach(p => {
                        if (!p.time) return;
                        const [hours, minutes] = p.time.split(':').map(Number);
                        const pDate = new Date();
                        pDate.setHours(hours, minutes, 0, 0);

                        const diff = pDate - now;
                        if (diff > 0 && diff < minDiff) {
                            minDiff = diff;
                            upcoming = { ...p, timeObj: pDate, diff };
                        }
                    });

                    if (!upcoming) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        const [hours, minutes] = schedule.imsak.split(':').map(Number);
                        const pDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), hours, minutes, 0, 0);
                        const diff = pDate - now;
                        upcoming = { name: 'Imsak (Besok)', time: schedule.imsak, timeObj: pDate, diff };
                    }

                    setNextPrayer(upcoming);

                    const totalSecs = Math.floor(upcoming.diff / 1000);
                    const hrs = Math.floor(totalSecs / 3600);
                    const mins = Math.floor((totalSecs % 3600) / 60);
                    const secs = totalSecs % 60;
                    
                    const timeStr = `${hrs > 0 ? hrs + 'j ' : ''}${mins}m ${secs}s`;
                    setTimeRemaining(timeStr);

                    // Cek Notifikasi Adzan
                    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const currentPrayer = prayerTimes.find(p => p.time === nowTimeStr && p.name !== 'Imsak');
                    if (currentPrayer) {
                        const adzanKey = `${schedule.tanggal}-${currentPrayer.name}`;
                        if (lastAdzanPlayed.current !== adzanKey) {
                            lastAdzanPlayed.current = adzanKey;
                            const isAdzanActive = localStorage.getItem('sholat_adzan_enabled') === 'true';
                            if (isAdzanActive) {
                                try {
                                    const audio = new Audio('https://www.islamcan.com/audio/adhan/azan1.mp3');
                                    audio.play().catch(e => console.warn("Auto-play Adzan diblokir browser:", e));
                                    
                                    if ("Notification" in window && Notification.permission === "granted") {
                                        new Notification("Waktu Sholat", {
                                            body: `Telah masuk waktu sholat ${currentPrayer.name} untuk wilayah ${city}`
                                        });
                                    }
                                } catch(err) {
                                    console.error("Gagal memutar adzan:", err);
                                }
                            }
                        }
                    }
                }, 1000);

                return () => clearInterval(timer);
            }, [schedule]);

            if (!schedule) {
                return (
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[13px] font-medium text-google-textVariant">Memuat Jadwal Sholat...</p>
                        </div>
                    </div>
                );
            }

            const prayers = [
                { id: 'imsak', name: 'Imsak', time: schedule.imsak, icon: 'wb_twilight' },
                { id: 'subuh', name: 'Subuh', time: schedule.subuh, icon: 'nights_stay' },
                { id: 'dzuhur', name: 'Dzuhur', time: schedule.dzuhur, icon: 'wb_sunny' },
                { id: 'ashar', name: 'Ashar', time: schedule.ashar, icon: 'light_mode' },
                { id: 'maghrib', name: 'Maghrib', time: schedule.maghrib, icon: 'wb_twilight' },
                { id: 'isya', name: 'Isya', time: schedule.isya, icon: 'dark_mode' }
            ];

            return (
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Icon name="mosque" className="text-red-600 text-[20px]" fill="true"/>
                                <h3 className="text-[16px] font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2">
                                    Jadwal Sholat {city}
                                    {isGPS && <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-lg font-medium border border-red-200">GPS</span>}
                                </h3>
                            </div>
                            <p className="text-[11px] font-medium text-google-textVariant mt-0.5">Metode Kemenag RI G Hari ini: {schedule.tanggal}</p>
                        </div>

                        <div className="w-full md:w-auto flex flex-wrap items-center gap-2">
                            <button 
                                type="button"
                                onClick={() => {
                                    const newVal = !adzanEnabled;
                                    setAdzanEnabled(newVal);
                                    localStorage.setItem('sholat_adzan_enabled', newVal ? 'true' : 'false');
                                    if (newVal) {
                                        if ("Notification" in window && Notification.permission !== "granted") {
                                            Notification.requestPermission();
                                        }
                                        // window.showToast defined globally? The component uses showToast
                                        if (typeof showToast === 'function') {
                                            showToast('Notifikasi & Suara Adzan diaktifkan');
                                        }
                                    } else {
                                        if (typeof showToast === 'function') {
                                            showToast('Notifikasi Adzan dinonaktifkan');
                                        }
                                    }
                                }}
                                className={`flex items-center gap-1.5 font-medium text-[11px] px-5 py-2.5 rounded-full border transition-all active:scale-95 ${
                                    adzanEnabled 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-500/30' 
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <Icon name={adzanEnabled ? "notifications_active" : "notifications_off"} className="text-[14px]"/>
                                {adzanEnabled ? 'Adzan Aktif' : 'Adzan Mati'}
                            </button>

                            <button 
                                type="button" 
                                onClick={handleGPSDetection}
                                className={`flex items-center gap-1.5 font-medium text-[11px] px-5 py-2.5 rounded-full border transition-all active:scale-95 ${
                                    isGPS 
                                        ? 'bg-red-50 text-red-600 border-red-500/40' 
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                                <Icon name="my_location" className="text-[14px]"/>
                                {loading ? 'GPS...' : 'Gunakan GPS'}
                            </button>

                            <form onSubmit={handleSearchCity} className="flex flex-wrap items-center gap-2 md:flex-initial">
                                <div className="bg-slate-50 border border-slate-200 focus-within:border-red-500 rounded-full px-4 py-1.5 flex items-center gap-2 flex-1 md:w-56 shadow-sm">
                                    <Icon name="search" className="text-[14px] text-slate-400" />
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Cari Kota..."
                                        className="bg-transparent border-none outline-none text-[12.5px] font-medium w-full text-google-text placeholder:text-slate-400"
                                    />
                                </div>
                                <button type="submit" disabled={isSearching} className="bg-red-600 text-white font-medium text-[11px] px-5 py-2.5 rounded-full border border-red-700 hover:bg-red-700 shadow-sm active:scale-95 transition-all">
                                    {isSearching ? '...' : 'Cari'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="relative">
                            <div className="absolute top-0 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 max-h-48 overflow-y-auto hide-scrollbar p-2 space-y-1">
                                {searchResults.map(res => (
                                    <button 
                                        key={res.id} 
                                        onClick={() => selectCity(res)}
                                        className="w-full text-left px-4 py-2.5 rounded-full hover:bg-red-50 hover:text-red-700 font-medium text-[12px] text-google-text transition-colors"
                                    >
                                        {res.lokasi}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {nextPrayer && (
                        <div className="bg-red-50/70 dark:bg-red-950/40 border border-red-500/30 dark:border-red-500/20 p-6 sm:p-8 md:p-8 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="w-11 h-11 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md"><Icon name="alarm" className="text-[18px]"/></div>
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest font-medium text-red-800 dark:text-red-200">Sholat Berikutnya</p>
                                    <h4 className="text-[14px] font-medium text-red-700 dark:text-red-300 mt-0.5">{nextPrayer.name} pukul {nextPrayer.time}</h4>
                                </div>
                            </div>
                            <div className="bg-white/80 dark:bg-red-900/40 border border-red-500/30 dark:border-red-500/30 px-5 py-2.5 rounded-xl shadow-sm text-center">
                                <span className="text-[11px] font-medium text-red-800 dark:text-red-200 uppercase tracking-wider block">Waktu Mundur</span>
                                <span className="text-[13px] font-medium text-red-600 dark:text-red-300 font-mono">{timeRemaining}</span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
                        {prayers.map(p => {
                            const isUpcoming = nextPrayer && nextPrayer.name.includes(p.name);
                            return (
                                <div 
                                    key={p.id}
                                    className={`p-4 rounded-2xl border text-center transition-all duration-300 ${
                                        isUpcoming 
                                            ? 'bg-red-600 border-red-700 text-white shadow-lg scale-105 z-10' 
                                            : 'bg-slate-50 border-slate-200/60 hover:bg-white hover:border-red-500/40 text-google-text'
                                    }`}
                                >
                                    <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-3 ${isUpcoming ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-200 shadow-sm'}`}>
                                        <Icon name={p.icon} className="text-[17px]" fill="true"/>
                                    </div>
                                    <p className={`text-[11px] font-medium ${isUpcoming ? 'text-white' : 'text-google-textVariant'}`}>{p.name}</p>
                                    <p className={`text-[14px] font-medium mt-1 font-mono ${isUpcoming ? 'text-white' : 'text-google-text'}`}>{p.time}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

export default WaktuSholatWidget;
