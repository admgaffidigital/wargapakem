import React from 'react';
import Icon from '../common/Icon.jsx';

        function PetaDesa({ infoDesa }) {

            return (
                <div className="space-y-8 max-w-7xl mx-auto tab-fade-in">
                    <div className="bg-white p-6 sm:p-8 lg:p-8 rounded-3xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-5">
                        <div className="text-center md:text-left">
                            <h2 className="text-2xl font-medium text-google-text tracking-tight flex flex-wrap items-center gap-2 justify-center md:justify-start">
                                <Icon name="map" className="text-[24px] text-red-600"/>
                                Area Cakupan Desa Banyuanyar
                            </h2>
                            <p className="text-[13px] font-medium text-google-textVariant mt-1.5">Peta interaktif wilayah Desa Banyuanyar, Kecamatan Gurah, Kabupaten Kediri.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 bg-red-50 border border-red-500/30 px-4 py-2.5 rounded-2xl shadow-sm">
                            <Icon name="explore" className="text-[17px] text-red-600" fill="true"/>
                            <div className="text-[12.5px] font-medium text-red-800">
                                Kode Pos: 64181
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm overflow-hidden">
                        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15810.734045472811!2d112.0831012336427!3d-7.82328387515901!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e7859a9896e1c3d%3A0x750afa04649cafb0!2sBanyuanyar%2C%20Kec.%20Gurah%2C%20Kabupaten%20Kediri%2C%20Jawa%20Timur!5e0!3m2!1sid!2sid!4v1783910401380!5m2!1sid!2sid" className="w-full h-[450px] rounded-3xl z-10 border border-slate-200/80" style={{border:0}} allowFullScreen="" referrerPolicy="strict-origin-when-cross-origin"></iframe>
                        <p className="text-[10px] font-medium text-center text-google-textVariant mt-3 flex flex-wrap items-center justify-center gap-1"><Icon name="info" className="text-[13px]" /> Peta interaktif dari Google Maps.</p>
                    </div>

                    {infoDesa?.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                <Icon name="border_outer" className="text-[16px] text-red-600" />
                                Batas Administrasi Desa
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {['utara', 'selatan', 'timur', 'barat'].map(arah => (
                                    <div key={arah} className="bg-slate-50 p-6 sm:p-8 md:p-6 rounded-2xl border border-slate-200/50">
                                        <p className="text-[9px] uppercase tracking-widest font-medium text-slate-500 mb-0.5">{arah}</p>
                                        <p className="font-medium text-[13px] text-google-text">{infoDesa.batas?.[arah] || '-'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-[14px] font-medium text-google-text mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                                <Icon name="contact_phone" className="text-[16px] text-red-600" />
                                Kontak Penting Layanan Desa
                            </h3>
                            <div className="space-y-5">
                                {infoDesa.kontak?.map((k, i) => (
                                    <div key={k.id || i} className={`flex justify-between items-center bg-${k.color}-50/50 border border-${k.color}-500/10 px-4 py-3 rounded-2xl`}>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <Icon name={k.icon || 'contact_phone'} className={`text-[16px] text-${k.color}-600`} fill="true"/>
                                            <span className={`text-[12px] font-medium text-${k.color}-800`}>{k.nama}</span>
                                        </div>
                                        <span className={`text-[12px] font-medium text-${k.color}-700`}>{k.telepon}</span>
                                    </div>
                                ))}
                                {(!infoDesa.kontak || infoDesa.kontak.length === 0) && (
                                    <div className="text-center p-4 text-slate-500 text-sm">Belum ada kontak penting</div>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            );
        }

export default PetaDesa;
