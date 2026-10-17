import React, { useState, useEffect, useRef, useMemo } from 'react';
import Icon from '../common/Icon.jsx';
import { showToast } from '../common/Toast.jsx';
import { formatRp, safeNumber, formatBulanTahun, getLocalDate, parseLocalDate, isNonaktif } from '../../utils/helpers.js';

        function Pertemuan({ members, setMembers, currentRound, setCurrentRound, jimpitanBalance, setJimpitanBalance, setMeetingHistory, onFinish, nominalArisan, nominalJimpitan, arisanPeriod, setArisanPeriod, identity, cycleNumber }) {
            const [step, setStep] = useState(1);
            const [showHolidayModal, setShowHolidayModal] = useState(false);
            const [meetingDate, setMeetingDate] = useState(getLocalDate());
            const arisanMembers = useMemo(() => members.filter(m => m.program !== 'IuranOnly'), [members]);
            
            const eligibleWinners = useMemo(() => arisanMembers.filter(m => !m.hasWon && !isNonaktif(m) && m.program !== 'JimpitanOnly'), [arisanMembers]);
            const isCycleAlreadyComplete = arisanMembers.length > 0 && eligibleWinners.length === 0;

            const [attendance, setAttendance] = useState(() => {
                const init = {}; arisanMembers.forEach(m => init[m.id] = { status: 'Hadir', payDebt: false }); return init;
            });
            
            // FIX: Sinkronisasi attendance jika ada warga baru yang ditambahkan saat form Pertemuan terbuka
            useEffect(() => {
                setAttendance(prev => {
                    const updated = { ...prev };
                    arisanMembers.forEach(m => {
                        if (!updated[m.id]) {
                            updated[m.id] = { status: 'Hadir', payDebt: false };
                        }
                    });
                    return updated;
                });
            }, [arisanMembers]);

            const [isScannerOpen, setIsScannerOpen] = useState(false);
            const [scannedMembers, setScannedMembers] = useState([]);
            const [cashReceived, setCashReceived] = useState('');
            const [cashierStatus, setCashierStatus] = useState('Hadir');
            const [showCashierModal, setShowCashierModal] = useState(false);
            const scannerRef = useRef(null);
            
            const scannedMembersRef = useRef(scannedMembers);
            useEffect(() => { scannedMembersRef.current = scannedMembers; }, [scannedMembers]);

            useEffect(() => {
                if (isScannerOpen) {
                    if (!scannerRef.current) {
                        import('html5-qrcode').then((module) => {
                            const Html5QrcodeScanner = module.Html5QrcodeScanner;
                        scannerRef.current = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 150} }, false);
                        scannerRef.current.render((decodedText) => {
                            const memberIdStr = decodedText.replace('M-', '');
                            const m = arisanMembers.find(x => x.id.toString() === memberIdStr);
                            if (m) {
                                if (!scannedMembersRef.current.some(x => x.id === m.id)) {
                                    setScannedMembers(prev => [...prev, m]);
                                    showToast(`${m.name} masuk keranjang!`);
                                }
                            } else {
                                showToast('Warga tidak ditemukan!');
                            }
                        }, (error) => {});
                        });
                    }
                } else {
                    if (scannerRef.current) {
                        scannerRef.current.clear().catch(e => console.error(e));
                        scannerRef.current = null;
                    }
                }
                return () => {
                    if (scannerRef.current) {
                        scannerRef.current.clear().catch(e => console.error(e));
                        scannerRef.current = null;
                    }
                };
            }, [isScannerOpen, arisanMembers]);
            
            const handleOpenCashier = () => {
                if (scannedMembers.length === 0) return;
                setIsScannerOpen(false);
                setShowCashierModal(true);
                setCashReceived('');
                setCashierStatus('Hadir');
            };

            const handleCashierSave = () => {
                if (scannedMembers.length === 0) return;
                
                let totalTagihanGabungan = 0;
                scannedMembers.forEach(m => {
                    let tagihanBulanIni = 0;
                    if (m.program === 'Arisan') tagihanBulanIni = nominalArisan + nominalJimpitan;
                    else if (m.program === 'ArisanOnly') tagihanBulanIni = nominalArisan;
                    else if (m.program === 'JimpitanOnly') tagihanBulanIni = nominalJimpitan;
                    else if (m.program === 'IuranOnly') tagihanBulanIni = nominalJimpitan;
                    totalTagihanGabungan += tagihanBulanIni + (m.debt || 0);
                });
                
                const received = safeNumber(cashReceived);
                const isPaidFull = received >= totalTagihanGabungan;

                setAttendance(prev => {
                    const updated = { ...prev };
                    scannedMembers.forEach(m => {
                        updated[m.id] = {
                            status: cashierStatus,
                            payDebt: (cashierStatus === 'Hadir' && isPaidFull && m.debt > 0)
                        };
                    });
                    return updated;
                });

                showToast(`Presensi ${scannedMembers.length} warga disimpan!`);
                setShowCashierModal(false);
                setScannedMembers([]);
                
                setTimeout(() => setIsScannerOpen(true), 300);
            };
            const [selectedWinnerId, setSelectedWinnerId] = useState('');
            const [errorMsg, setErrorMsg] = useState('');
            
            const calculations = useMemo(() => {
                let kasArisanTerkumpul = 0, kasJimpitanTerkumpul = 0, talanganJimpitan = 0, pelunasanTunggakan = 0, tunggakanBaru = 0;
                arisanMembers.forEach(m => {
                    const att = attendance[m.id];
                    if (!att) return; // guard: warga belum ada di attendance (ditambah setelah form buka)
                    if (isNonaktif(m)) { if (att.status === 'Hadir') kasJimpitanTerkumpul += nominalJimpitan; return; } // Nonaktif/Meninggal: hanya jimpitan
                    if (att.status === 'Hadir') { 
                        if (m.program !== 'JimpitanOnly') kasArisanTerkumpul += nominalArisan; 
                        if (m.program !== 'ArisanOnly') kasJimpitanTerkumpul += nominalJimpitan; 
                        if (m.debt > 0 && att.payDebt) pelunasanTunggakan += m.debt; 
                    } 
                    else if (att.status === 'Alfa' || att.status === 'Musibah') { 
                        if (m.program !== 'JimpitanOnly') { talanganJimpitan += nominalArisan; kasArisanTerkumpul += nominalArisan; }
                        tunggakanBaru += (m.program === 'ArisanOnly' ? nominalArisan : (m.program === 'JimpitanOnly' ? nominalJimpitan : (nominalArisan + nominalJimpitan))); 
                    }
                });
                // LOGIKA ARISAN: Pemenang tidak membayar ke dirinya sendiri.
                // Kurangi nominalArisan pemenang dari total yang diserahkan, KECUALI
                // pemenang tidak hadir (sudah tidak terhitung di kasArisanTerkumpul via Hadir).
                const winnerMember = selectedWinnerId ? arisanMembers.find(m => m.id === Number(selectedWinnerId)) : null;
                const winnerAtt = winnerMember ? attendance[winnerMember.id] : null;
                const winnerIsPresent = winnerAtt && winnerAtt.status === 'Hadir' && !isNonaktif(winnerMember);
                if (!isCycleAlreadyComplete && winnerIsPresent) {
                    kasArisanTerkumpul -= nominalArisan;
                }
                return { kasArisanTerkumpul, kasJimpitanTerkumpul, talanganJimpitan, pelunasanTunggakan, tunggakanBaru };
            }, [arisanMembers, attendance, nominalArisan, nominalJimpitan, selectedWinnerId, isCycleAlreadyComplete]);

            const currentTotalDebt = useMemo(() => members.reduce((sum, m) => sum + Number(m.debt || 0), 0), [members]);
            const deltaJimpitan = calculations.kasJimpitanTerkumpul + calculations.pelunasanTunggakan - calculations.talanganJimpitan;
            const projectedJimpitanCash = jimpitanBalance + deltaJimpitan;
            const projectedTotalDebt = currentTotalDebt + calculations.tunggakanBaru - calculations.pelunasanTunggakan;

            const handleAttendanceChange = (id, status) => setAttendance(prev => ({...prev, [id]: { ...prev[id], status }}));
            const togglePayDebt = (id) => setAttendance(prev => ({...prev, [id]: { ...prev[id], payDebt: !prev[id].payDebt }}));

            const submitPertemuan = () => {
                if (!isCycleAlreadyComplete && !selectedWinnerId) return setErrorMsg("Pilih pemenang arisan terlebih dahulu!");
                
                setJimpitanBalance(prev => prev + deltaJimpitan); // FIX KRITIS-3: functional update untuk hindari race condition
                let winnerName = "", absensiDetails = [];
                const updatedMembers = members.map(m => {
                    if (m.program === 'IuranOnly') return m;
                    let updatedM = { ...m };
                    const att = attendance[m.id];
                    // Guard: jika warga arisan tidak ada di attendance (baru ditambah setelah form dibuka)
                    if (!att) { absensiDetails.push({ name: m.name, status: 'Hadir' }); return updatedM; }
                    if (!isCycleAlreadyComplete && m.id === Number(selectedWinnerId)) { 
                        updatedM.hasWon = true; updatedM.wonRound = currentRound; winnerName = m.name; 
                    }
                    // FIX CELAH-1: Guard Meninggal SEBELUM push absensiDetails
                    // Warga Meninggal dicatat dengan status khusus 'Meninggal', bebas dari arisan
                    if (isNonaktif(m)) {
                        absensiDetails.push({ name: m.name, status: m.status });
                        return updatedM;
                    } // Nonaktif/Meninggal: catat status asli, bebas arisan
                    absensiDetails.push({ name: m.name, status: att.status });
                    const tagihanBaru = m.program === 'ArisanOnly' ? nominalArisan : (m.program === 'JimpitanOnly' ? nominalJimpitan : (nominalArisan + nominalJimpitan));
                    if (att.status === 'Hadir') { updatedM.redRecord = false; if (att.payDebt) updatedM.debt = 0; } 
                    else if (att.status === 'Alfa') { updatedM.debt = (updatedM.debt || 0) + tagihanBaru; updatedM.redRecord = true; } 
                    // Musibah = halangan valid (sakit/musibah), punya tunggakan tapi TIDAK masuk rapor merah
                    else if (att.status === 'Musibah') { updatedM.debt = (updatedM.debt || 0) + tagihanBaru; }
                    return updatedM;
                });
                
                if(isCycleAlreadyComplete) { winnerName = "G SIKLUS SELESAI (TIDAK ADA UNDIAN)"; }

                const formattedDate = parseLocalDate(meetingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

                setMembers(updatedMembers);
                setMeetingHistory(prev => [{ id: Date.now(), round: currentRound, periode: formatBulanTahun(arisanPeriod), date: formattedDate, winner: winnerName, kasArisanTerkumpul: calculations.kasArisanTerkumpul, kasJimpitanMasuk: calculations.kasJimpitanTerkumpul, pelunasanTunggakan: calculations.pelunasanTunggakan, talanganJimpitan: calculations.talanganJimpitan, tunggakanBaru: calculations.tunggakanBaru, saldoAkhirJimpitan: projectedJimpitanCash, totalTunggakanAkhir: projectedTotalDebt, absensiDetails }, ...prev]);
                setCurrentRound(prev => prev + 1);
                const [year, month] = arisanPeriod.split('-'); let d = new Date(year, month - 1); d.setMonth(d.getMonth() + 1);
                setArisanPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                onFinish();
                showToast('Absensi & hasil arisan berhasil disimpan.');
            };

            const handleSetHoliday = () => {
                const totalDebtSnapshot = members.reduce((sum, m) => sum + Number(m.debt || 0), 0);
                const formattedDate = parseLocalDate(meetingDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                
                setMeetingHistory(prev => [{ id: Date.now(), round: currentRound, periode: formatBulanTahun(arisanPeriod), date: formattedDate, winner: '=n+ LIBUR (TIDAK ADA ARISAN)', kasArisanTerkumpul: 0, kasJimpitanMasuk: 0, pelunasanTunggakan: 0, talanganJimpitan: 0, tunggakanBaru: 0, saldoAkhirJimpitan: jimpitanBalance, totalTunggakanAkhir: totalDebtSnapshot, absensiDetails: [] }, ...prev]);
                
                const [year, month] = arisanPeriod.split('-'); let d = new Date(year, month - 1); d.setMonth(d.getMonth() + 1);
                setArisanPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                
                setShowHolidayModal(false);
                onFinish();
                showToast('Bulan ini ditandai libur, periode lanjut otomatis.');
            };

            return (
                <div className="bg-white rounded-3xl overflow-hidden max-w-7xl mx-auto border border-slate-200 shadow-xl">
                    <div className="bg-slate-50 px-8 py-6 flex items-center justify-between no-print border-b border-slate-200 relative">
                        {[1, 2, 3].map(num => (<div key={num} className="flex flex-col items-center relative z-10"><div className={`w-12 h-12 rounded-full flex items-center justify-center font-medium text-[16px] border transition-all duration-500 ${step >= num ? 'bg-google-blue text-white border-google-blueDark shadow-md scale-110' : 'bg-white text-slate-400 border-slate-400'}`}>{num}</div></div>))}
                        <div className="absolute left-16 right-16 h-2 bg-slate-200 top-[45px] z-0 rounded-full overflow-hidden"><div className="h-full bg-google-blue transition-all duration-700 ease-in-out" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div></div>
                    </div>
                    <div className="p-5 sm:p-8 bg-white">
                        {step === 1 && (
                            <div className="space-y-8">
                                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-8 no-print border-b border-slate-200 pb-8">
                                    <div className="flex flex-col w-full lg:w-auto">
                                        <h3 className="text-3xl font-medium text-google-text tracking-tight">Sesi Presensi Arisan</h3>
                                        <div className="flex flex-wrap items-center gap-3 mt-4 bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 w-full sm:w-fit focus-within:border-google-blue focus-within:bg-white focus-within:shadow-md transition-all">
                                            <Icon name="edit_calendar" className="text-[17px] text-google-blue shrink-0" />
                                            <label className="text-[10px] font-medium text-google-textVariant uppercase tracking-widest shrink-0 mr-1">Tgl Pelaksanaan:</label>
                                            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="bg-transparent border-none text-[13px] font-medium outline-none text-google-blueDark cursor-pointer w-full" />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 w-full lg:w-auto mt-2 lg:mt-0">
                                        <button onClick={() => setIsScannerOpen(true)} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-google-blue text-white px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark active:scale-95 transition-all duration-300"><Icon name="qr_code_scanner" className="text-[17px]" /><span>Kasir Scan</span></button>
                                        <button onClick={() => setShowHolidayModal(true)} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-white text-google-yellowDark px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] border border-google-yellow hover:bg-google-yellowLight hover:shadow-md active:scale-95 transition-all duration-300"><Icon name="event_busy" className="text-[17px]" /><span>Bulan Libur</span></button>
                                        <button onClick={() => window.print()} className="flex flex-wrap sm:flex-nowrap shrink-0 bg-white text-google-text px-6 py-3.5 rounded-full font-medium flex flex-wrap items-center justify-center gap-2 text-[13px] border border-slate-200 hover:bg-slate-50 hover:border-slate-400 hover:shadow-md active:scale-95 transition-all duration-300"><Icon name="print" className="text-[17px]" /><span>Cetak Blanko Absen</span></button>
                                    </div>
                                </div>
                                <div className="hidden print-only">
                                    <div className="kop-surat"><div className="kop-surat-logo"><img src={identity?.logoApp || "./National_emblem_of_Indonesia_Garuda_Pancasila.svg"} alt="Logo" /></div><div className="kop-surat-text"><h1>PENGURUS RUKUN TETANGGA (RT)</h1><h1>{identity?.name || "Aplikasi Arisan"}</h1>{identity?.subtitle && <p>{identity.subtitle}</p>}</div><div className="kop-surat-logo-right"></div></div>
                                    <div className="text-center mb-6"><h2 className="text-[14pt] font-medium underline uppercase mb-1">Daftar Hadir Pertemuan Arisan</h2><p className="text-[11pt]">Siklus Ke-{cycleNumber || 1} | Putaran Ke-{currentRound} | Periode: {formatBulanTahun(arisanPeriod)}</p></div>
                                    <table className="print-table">
                                        <thead><tr><th width="5%">No</th><th width="35%">Nama Warga</th><th width="20%">Status Arisan</th><th width="20%">Tunggakan Sebelumnya</th><th width="20%">Tanda Tangan</th></tr></thead>
                                        <tbody>
                                            {arisanMembers.length === 0 ? <tr><td colSpan="5" className="text-center font-medium">Belum ada data warga.</td></tr> : arisanMembers.map((m, idx) => (
                                                <tr key={m.id}><td className="text-center font-medium">{idx + 1}</td><td className="font-medium">{m.name}</td><td className="text-center font-medium">{m.hasWon ? `Menang (Put.${m.wonRound})` : 'Belum'}</td><td className="text-right font-medium">{m.debt > 0 ? formatRp(m.debt) : '-'}</td><td></td></tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 no-print">
                                    {arisanMembers.map(member => {
                                        const isMeninggal = isNonaktif(member); // Meninggal ATAU Nonaktif/Pindah
                                        const attStatus = isMeninggal ? 'Meninggal' : (attendance[member.id]?.status || 'Hadir');
                                        return (
                                        <div key={member.id} className={`border rounded-3xl p-6 flex flex-col gap-4 transition-all duration-300 ${isMeninggal ? 'bg-slate-100 border-slate-400 opacity-75' : attStatus === 'Hadir' ? 'bg-white border-slate-200 hover:border-google-blue/50 hover:shadow-xl hover:-translate-y-1 shadow-sm' : attStatus === 'Musibah' ? 'bg-google-yellowLight/50 border-google-yellow shadow-md' : 'bg-google-redLight/50 border-google-red shadow-md'}`}>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex flex-wrap items-center gap-4 min-w-0">
                                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-medium text-[17px] shrink-0 border transition-colors ${isMeninggal ? 'bg-slate-200 text-slate-400 border-slate-400' : attStatus === 'Hadir' ? 'bg-slate-50 text-google-text border-slate-200' : attStatus === 'Musibah' ? 'bg-google-yellow text-white border-google-yellowDark' : 'bg-google-red text-white border-google-redDark'}`}>{member.name.charAt(0).toUpperCase()}</div>
                                                    <div className="min-w-0">
                                                        <h3 className={`font-medium text-[14px] truncate tracking-tight ${isMeninggal ? 'text-slate-400 line-through' : 'text-google-text'}`}>{member.name}</h3>
                                                        {isMeninggal
                                                            ? <span className="text-[9px] text-slate-500 font-medium border border-slate-400 px-2.5 py-1 rounded-md bg-slate-200 mt-1.5 inline-flex items-center gap-1 uppercase tracking-widest"><Icon name="sentiment_very_dissatisfied" className="text-[12px]" /> Wafat / Nonaktif</span>
                                                            : member.debt > 0
                                                                ? <span className="text-[10px] bg-google-redLight text-google-redDark px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 mt-1.5 border border-google-red/40 uppercase tracking-wider"><Icon name="warning" className="text-[13px]"/> Hutang {formatRp(member.debt)}</span>
                                                                : <span className="text-[10px] bg-google-greenLight text-google-greenDark font-medium px-3 py-1.5 rounded-md mt-1.5 inline-flex items-center gap-1.5 border border-google-green/40 uppercase tracking-wider"><Icon name="check_circle" className="text-[13px]"/> Bersih</span>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            {isMeninggal ? (
                                                <div className="flex flex-col gap-2.5">
                                                    {/* Info banner: bebas arisan, wajib jimpitan */}
                                                    <div className="flex flex-wrap items-center gap-3 bg-slate-200 border border-slate-400 rounded-xl px-4 py-3">
                                                        <Icon name="do_not_disturb_on" className="text-[18px] text-slate-500 shrink-0" />
                                                        <div>
                                                            <p className="text-[11px] font-medium text-slate-600 uppercase tracking-widest leading-tight">Bebas Iuran Arisan</p>
                                                            <p className="text-[10px] font-normal text-slate-500 leading-tight mt-0.5">Anggota wafat tidak dikenakan setoran arisan</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-3 bg-google-blueLight border border-google-blue/30 rounded-xl px-4 py-3">
                                                        <Icon name="volunteer_activism" className="text-[18px] text-google-blue shrink-0" fill="true" />
                                                        <div>
                                                            <p className="text-[11px] font-medium text-google-blueDark uppercase tracking-widest leading-tight">Wajib Jimpitan</p>
                                                            <p className="text-[10px] font-normal text-google-blue leading-tight mt-0.5">{formatRp(nominalJimpitan)} per pertemuan tetap berjalan</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap rounded-2xl bg-slate-100 p-2 gap-2 border border-slate-200 inset-shadow-sm">
                                                    {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                        <button key={stat} onClick={() => handleAttendanceChange(member.id, stat)} className={`flex-1 py-3 text-[11px] font-medium uppercase tracking-widest rounded-full transition-all duration-300 border ${attendance[member.id].status === stat ? (stat === 'Hadir' ? 'bg-google-green text-white border-google-greenDark shadow-md scale-105' : stat === 'Musibah' ? 'bg-google-yellow text-white border-google-yellowDark shadow-md scale-105' : 'bg-google-red text-white border-google-redDark shadow-md scale-105') : 'bg-transparent text-google-textVariant border-transparent hover:bg-slate-200/50'}`}>{stat}</button>
                                                    ))}
                                                </div>
                                            )}
                                            {attendance[member.id]?.status === 'Hadir' && member.debt > 0 && !isMeninggal && (
                                                <label className="flex items-center justify-between bg-google-blueLight px-5 py-4 rounded-2xl cursor-pointer border border-google-blue/30 shadow-sm hover:bg-google-blue/20 transition-colors group mt-2">
                                                    <div><span className="text-[13px] font-medium text-google-blueDark block mb-0.5">Lunasi Tunggakan?</span><span className="text-[11px] font-medium text-google-blue">Centang potong saldo</span></div>
                                                    <div className="relative flex items-center justify-center"><input type="checkbox" checked={attendance[member.id].payDebt} onChange={() => togglePayDebt(member.id)} className="peer appearance-none w-7 h-7 border border-google-blue/50 rounded-lg checked:bg-google-blue checked:border-google-blue transition-colors cursor-pointer" /><Icon name="check" className="absolute text-white text-[16px] opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" strokeWidth="4"/></div>
                                                </label>
                                            )}
                                        </div>
                                        );
                                    })}

                                    {arisanMembers.length === 0 && <div className="col-span-full bg-slate-50 border border-slate-200 p-12 text-center rounded-3xl shadow-sm"><Icon name="group_off" className="text-[48px] text-slate-400 mb-4 mx-auto" fill="true" /><p className="font-medium text-[16px] text-google-text">Belum ada warga arisan terdaftar.</p></div>}
                                </div>
                                <div className="pt-8 flex justify-end no-print border-t border-slate-200 mt-10"><button onClick={() => setStep(2)} className="bg-google-blue text-white px-10 py-4 rounded-full font-medium text-[13px] border border-google-blueDark shadow-md hover:bg-google-blueDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap items-center gap-2">Lanjut Ke Rekapitulasi <Icon name="arrow_forward" className="text-[17px]"/></button></div>
                                
                                {showHolidayModal && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print transition-opacity modal-backdrop animate-backdrop-in">
                                        <div className="max-h-[85vh] overflow-y-auto hide-scrollbar rounded-3xl p-8 w-full max-w-sm text-center border border-slate-200 dark:border-slate-800 modal-card animate-modal-in">
                                            <div className="mb-6 bg-google-yellowLight w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-google-yellow/30"><Icon name="event_busy" className="text-[48px] text-google-yellowDark" /></div>
                                            <h3 className="text-2xl font-medium text-google-text mb-2 tracking-tight">Liburkan Bulan Ini?</h3>
                                            <p className="text-[13px] font-medium text-google-textVariant mb-8 leading-relaxed">Periode <b className="text-google-text">{formatBulanTahun(arisanPeriod)}</b> akan ditandai sebagai bulan libur.</p>
                                            <div className="text-[12px] font-medium text-google-textVariant mb-8 space-y-5 bg-slate-50 p-6 sm:p-8 md:p-6 rounded-3xl border border-slate-200 text-left"><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[16px] text-google-blue shrink-0"/><span>Tidak ada penarikan kas/jimpitan sama sekali.</span></p><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[16px] text-google-blue shrink-0"/><span>Putaran ke-{currentRound} tidak akan dihitung.</span></p><p className="flex flex-wrap gap-2.5"><Icon name="info" className="text-[16px] text-google-blue shrink-0"/><span>Periode akan melompat ke bulan berikutnya.</span></p></div>
                                            <div className="flex flex-wrap gap-3">
                                                <button onClick={() => setShowHolidayModal(false)} className="w-full sm:w-auto bg-white text-google-text px-6 py-3.5 rounded-full font-medium text-[13px] hover:bg-slate-50 border border-slate-200 hover:border-slate-400 active:scale-95 transition-all duration-300 shadow-sm">Batal</button>
                                                <button onClick={handleSetHoliday} className="flex-1 bg-google-yellow text-white px-6 py-3.5 rounded-full font-medium text-[13px] border border-google-yellowDark shadow-md hover:bg-google-yellowDark hover:shadow-lg active:scale-95 transition-all duration-300">Setuju, Libur</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {isScannerOpen && (
                                    <div className="fixed inset-0 z-50 flex flex-col p-4 sm:p-6 no-print overflow-y-auto hide-scrollbar modal-backdrop animate-backdrop-in">
                                        <div className="absolute top-4 right-4 z-50">
                                            <button onClick={() => setIsScannerOpen(false)} className="bg-white/20 text-white w-9 h-9 flex items-center justify-center shrink-0 rounded-full hover:bg-white/40"><Icon name="close" className="text-[20px]" /></button>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center pt-2 pb-10">
                                            <div id="reader" className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl shrink-0"></div>
                                            
                                            {scannedMembers.length > 0 && (
                                                <div className="mt-6 w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-google-blue shrink-0">
                                                    <h4 className="font-medium text-google-text mb-3 text-[13px] uppercase tracking-widest">Keranjang Scan ({scannedMembers.length} Warga)</h4>
                                                    <div className="flex flex-wrap gap-2 mb-4 max-h-[150px] overflow-y-auto hide-scrollbar">
                                                        {scannedMembers.map(m => (
                                                            <span key={m.id} className="bg-google-blueLight text-google-blueDark px-3 py-1.5 rounded-lg text-[12px] font-medium border border-google-blue/30">{m.name}</span>
                                                        ))}
                                                    </div>
                                                    <button onClick={handleOpenCashier} className="w-full bg-google-blue text-white py-3.5 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-google-blueDark transition-colors shadow-md">Proses Pembayaran <Icon name="arrow_forward" className="text-[16px]" /></button>
                                                </div>
                                            )}
                                            {scannedMembers.length === 0 && <p className="text-white/60 text-center font-medium mt-6 shrink-0">Arahkan kamera ke barcode warga untuk memindai.</p>}
                                        </div>
                                    </div>
                                )}
                                
                                {showCashierModal && scannedMembers.length > 0 && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print modal-backdrop animate-backdrop-in">
                                        <div className="rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 max-h-[95vh] flex flex-col modal-card animate-modal-in">
                                            <h3 className="text-xl font-medium text-google-text mb-2 text-center">Kasir Pembayaran</h3>
                                            <div className="text-center mb-4">
                                                <p className="text-[13px] text-google-textVariant font-medium">{scannedMembers.length} Warga (Gandengan)</p>
                                                <p className="text-[13px] font-medium text-google-text truncate">{scannedMembers.map(m => m.name).join(', ')}</p>
                                            </div>
                                            
                                            <div className="overflow-y-auto hide-scrollbar flex-1 mb-4">
                                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                    {(() => {
                                                        let totalTagihanBulanIni = 0;
                                                        let totalTunggakan = 0;
                                                        scannedMembers.forEach(m => {
                                                            totalTagihanBulanIni += (m.program === 'IuranOnly' ? 0 : nominalArisan) + nominalJimpitan;
                                                            totalTunggakan += (m.debt || 0);
                                                        });
                                                        const totalGabungan = totalTagihanBulanIni + totalTunggakan;
                                                        return (
                                                            <>
                                                                <div className="flex justify-between text-[13px] mb-1"><span className="text-google-textVariant font-medium">Total Tagihan Bulan Ini</span><span className="font-medium text-google-text">{formatRp(totalTagihanBulanIni)}</span></div>
                                                                {totalTunggakan > 0 && <div className="flex justify-between text-[13px] mb-1"><span className="text-google-red font-medium">Total Tunggakan</span><span className="font-medium text-google-red">{formatRp(totalTunggakan)}</span></div>}
                                                                <div className="border-t border-slate-200 my-2"></div>
                                                                <div className="flex justify-between text-[14px]"><span className="font-medium text-google-text">Total Harus Dibayar</span><span className="font-medium text-google-blue">{formatRp(totalGabungan)}</span></div>
                                                            </>
                                                        )
                                                    })()}
                                                </div>

                                                <div className="mb-4 mt-4">
                                                    <label className="text-[10px] uppercase tracking-widest font-medium text-google-textVariant block mb-2">Status Kehadiran (Semua Warga)</label>
                                                    <div className="flex gap-2">
                                                        {['Hadir', 'Musibah', 'Alfa'].map(stat => (
                                                            <button key={stat} onClick={() => setCashierStatus(stat)} className={`flex-1 py-2.5 text-[11px] font-medium uppercase tracking-widest rounded-full border transition-all ${cashierStatus === stat ? 'bg-google-blue text-white border-google-blueDark shadow-md' : 'bg-transparent text-google-textVariant border-slate-200 hover:bg-slate-50'}`}>{stat}</button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mb-4">
                                                    <label className="text-[10px] uppercase tracking-widest font-medium text-google-textVariant block mb-2">Uang Diterima (Rp)</label>
                                                    <input type="number" min="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-google-blue focus:bg-white focus:shadow-md px-5 py-3.5 text-[16px] font-medium outline-none rounded-xl text-google-text placeholder:text-slate-300 transition-all" placeholder="0" />
                                                </div>

                                                {(() => {
                                                    let totalGabungan = 0;
                                                    scannedMembers.forEach(m => {
                                                        totalGabungan += (m.program === 'IuranOnly' ? 0 : nominalArisan) + nominalJimpitan + (m.debt || 0);
                                                    });
                                                    const received = safeNumber(cashReceived);
                                                    const kembalian = received - totalGabungan;
                                                    return received > 0 ? (
                                                        <div className={`p-4 rounded-xl border shadow-sm ${kembalian >= 0 ? 'bg-google-greenLight border-google-green/40 text-google-greenDark' : 'bg-google-redLight border-google-red/40 text-google-redDark'}`}>
                                                            <p className="text-[10px] font-medium uppercase tracking-widest mb-1">{kembalian >= 0 ? 'Kembalian' : 'Status'}</p>
                                                            <p className="text-[17px] font-medium">{kembalian >= 0 ? formatRp(kembalian) : 'Uang Kurang!'}</p>
                                                        </div>
                                                    ) : null;
                                                })()}
                                            </div>

                                            <div className="flex gap-3 mt-auto shrink-0 pt-2 border-t border-slate-200">
                                                <button onClick={() => { setShowCashierModal(false); setScannedMembers([]); setTimeout(() => setIsScannerOpen(true), 300); }} className="flex-1 bg-white border border-slate-200 text-google-text font-medium py-3.5 rounded-full hover:bg-slate-50 hover:border-slate-400 transition-all text-[13px]">Batal</button>
                                                <button onClick={handleCashierSave} className="flex-1 bg-google-blue border border-google-blueDark text-white font-medium py-3.5 rounded-full hover:bg-google-blueDark hover:shadow-md transition-all text-[13px] flex justify-center items-center gap-2"><Icon name="save" className="text-[16px]" />Simpan</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {step === 2 && (
                            <div className="space-y-8 no-print">
                                <h3 className="text-3xl font-medium text-google-text mb-2 tracking-tight">Rekapitulasi Sementara</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8">Periksa kembali rincian aliran dana sebelum mengundi pemenang.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-google-greenLight border border-google-green/40 rounded-3xl p-8 sm:p-10 flex flex-col justify-center text-center shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                        <Icon name="payments" className="absolute -right-4 -bottom-4 text-[140px] text-google-green opacity-10 group-hover:scale-110 transition-transform duration-700" fill="true" />
                                        <div className="relative z-10">
                                            <p className="text-[11px] uppercase font-medium tracking-widest mb-3 text-google-greenDark">Arisan Diserahkan Ke Pemenang</p>
                                            <p className="text-4xl lg:text-5xl font-medium text-google-greenDark drop-shadow-sm tracking-tight">{formatRp(calculations.kasArisanTerkumpul)}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 space-y-7 shadow-sm">
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="add_circle" className="text-[17px] text-google-green"/> Tunai Masuk</span><span className="text-google-greenDark font-medium">+{formatRp(calculations.kasJimpitanTerkumpul)}</span></div>
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="add_circle" className="text-[17px] text-google-green"/> Bayar Tunggakan</span><span className="text-google-greenDark font-medium">+{formatRp(calculations.pelunasanTunggakan)}</span></div>
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="remove_circle" className="text-[17px] text-google-red"/> Talangan (Keluar)</span><span className="text-google-redDark font-medium">-{formatRp(calculations.talanganJimpitan)}</span></div>
                                        <div className="flex justify-between text-[13px] font-medium"><span className="text-google-textVariant flex flex-wrap items-center gap-2.5"><Icon name="info" className="text-[17px] text-google-yellowDark"/> Tunggakan Baru</span><span className="text-google-redDark font-medium">+{formatRp(calculations.tunggakanBaru)}</span></div>
                                        <div className="w-full h-px bg-slate-200 my-5"></div>
                                        <div className="flex justify-between items-center font-medium text-[16px] bg-slate-50 p-6 sm:p-8 md:p-8 rounded-2xl border border-slate-200 shadow-sm"><span className="text-[13px] uppercase tracking-widest text-google-textVariant">Saldo Tunai Berjalan</span><span className="text-[18px] text-google-blueDark tracking-tight">{formatRp(projectedJimpitanCash)}</span></div>
                                    </div>
                                </div>
                                <div className="pt-8 flex flex-col sm:flex-row justify-between border-t border-slate-200 mt-10 gap-4">
                                    <button onClick={() => setStep(1)} className="w-full sm:w-auto bg-white text-google-text border border-slate-200 px-8 py-4 rounded-full font-medium text-[13px] hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2 shadow-sm"><Icon name="arrow_back" className="text-[17px]"/> Kembali</button>
                                    <button onClick={() => setStep(3)} className="w-full sm:w-auto bg-google-blue text-white border border-google-blueDark px-10 py-4 rounded-full font-medium text-[13px] shadow-md hover:bg-google-blueDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2">Lanjut Undi Pemenang <Icon name="celebration" className="text-[17px]"/></button>
                                </div>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="space-y-8 no-print">
                                <h3 className="text-3xl font-medium text-google-text mb-2 text-center tracking-tight">Tentukan Pemenang</h3>
                                <p className="text-[13px] font-medium text-google-textVariant mb-8 text-center">Pilih warga yang akan menerima dana arisan putaran ini.</p>
                                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 sm:p-14 text-center shadow-lg relative overflow-hidden max-w-2xl mx-auto">
                                    
                                    
                                    
                                    <div className="mb-8 relative z-10 animate-bounce" style={{ animationDuration: '2s' }}><Icon name="emoji_events" className="text-[100px] text-google-yellow drop-shadow-2xl" fill="true" /></div>
                                    
                                    {isCycleAlreadyComplete ? (
                                        <div className="text-center bg-google-greenLight text-google-greenDark p-6 sm:p-8 md:p-6 rounded-3xl border border-google-green max-w-sm mx-auto relative z-10 shadow-sm">
                                            <Icon name="verified" className="text-[40px] mb-3 mx-auto" fill="true" />
                                            <p className="font-medium text-[14px]">Semua warga sudah menang (Siklus Selesai).</p>
                                        </div>
                                    ) : (
                                        <div className="text-left bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 focus-within:border-google-blue focus-within:shadow-lg transition-all max-w-sm mx-auto relative z-10 shadow-md">
                                            <label className="text-[10px] font-medium text-google-textVariant block mb-3 uppercase tracking-widest text-center">Pilih Warga Pemenang</label>
                                            <select className="w-full bg-slate-50 rounded-full border border-slate-200 text-[16px] font-medium outline-none px-5 py-3.5 text-google-blueDark cursor-pointer focus:bg-white transition-colors" value={selectedWinnerId} onChange={(e) => {setSelectedWinnerId(e.target.value); setErrorMsg('');}}>
                                                <option value="" disabled>-- Klik untuk memilih --</option>
                                                {eligibleWinners.map(m => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                                            </select>
                                        </div>
                                    )}
                                    {errorMsg && <div className="bg-google-redLight border border-google-red/40 text-google-redDark font-medium text-[12px] px-5 py-4 rounded-2xl mt-6 flex flex-wrap items-center justify-center gap-2 max-w-sm mx-auto relative z-10"><Icon name="error" className="text-[16px] shrink-0"/><span>{errorMsg}</span></div>}
                                </div>
                                <div className="pt-8 flex flex-col sm:flex-row justify-between border-t border-slate-200 mt-10 gap-4">
                                    <button onClick={() => setStep(2)} className="w-full sm:w-auto bg-white text-google-text border border-slate-200 px-8 py-4 rounded-full font-medium text-[13px] hover:bg-slate-50 hover:border-slate-400 active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2 shadow-sm"><Icon name="arrow_back" className="text-[17px]"/> Kembali</button>
                                    <button onClick={submitPertemuan} className="w-full sm:w-auto bg-google-green text-white border border-google-greenDark px-12 py-4 rounded-full font-medium text-[13px] shadow-md hover:bg-google-greenDark hover:-translate-y-1 hover:shadow-lg active:scale-95 transition-all duration-300 flex flex-wrap justify-center items-center gap-2"><Icon name="check_circle" className="text-[17px]"/> Selesai &amp; Simpan</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

export default Pertemuan;
