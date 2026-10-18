import React, { useRef, useEffect } from 'react';

        function normalizeAudioUrl(url) {
            if (!url) return '';
            try {
                // Dropbox share link → dl.dropboxusercontent.com (direct stream, CORS OK)
                // Contoh: https://www.dropbox.com/s/XXXXX/file.mp3?dl=0
                //   → https://dl.dropboxusercontent.com/s/XXXXX/file.mp3
                if (url.includes('dropbox.com')) {
                    // Format baru Dropbox: /scl/fi/ atau /s/
                    let normalized = url
                        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
                        .replace('?dl=0', '')
                        .replace('?dl=1', '')
                        .replace('&dl=0', '')
                        .replace('&dl=1', '');
                    // Hapus parameter rlkey jika ada (untuk URL baru Dropbox)
                    // dl.dropboxusercontent.com tidak butuh rlkey
                    return normalized;
                }
                // Google Drive viewer → langsung (catatan: GDrive sering CORS issue, tapi kita coba convert)
                // https://drive.google.com/file/d/ID/view → https://drive.google.com/uc?export=download&id=ID
                const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (gdriveMatch) {
                    return `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
                }
                return url;
            } catch(e) {
                return url;
            }
        }

        /* ================= FLOATING MUSIC PLAYER (WARGA ONLY) ================= */
        /* ================= BACKGROUND MUSIC PLAYER (WARGA ONLY - INVISIBLE) ================= */
        function FloatingMusicPlayer({ musicData }) {
            const audioRef = useRef(null);

            const streamUrl = normalizeAudioUrl(musicData?.url);

            useEffect(() => {
                if (!streamUrl) return;
                const audio = audioRef.current;
                if (!audio) return;

                audio.volume = 0.6;
                audio.loop = true;

                const attemptPlay = () => {
                    audio.play().catch(() => {
                        // Browser blokir autoplay → tunggu interaksi user
                    });
                };

                // Coba autoplay saat audio siap
                audio.addEventListener('canplay', attemptPlay, { once: true });
                audio.load();

                // Fallback: langsung play saat user pertama kali klik/tap layar
                const handleFirstInteraction = () => {
                    if (audio.paused) audio.play().catch(() => {});
                    document.removeEventListener('click', handleFirstInteraction, true);
                    document.removeEventListener('touchstart', handleFirstInteraction, true);
                };
                document.addEventListener('click', handleFirstInteraction, true);
                document.addEventListener('touchstart', handleFirstInteraction, true);

                // Cleanup: hentikan musik saat warga logout (komponen di-unmount)
                return () => {
                    audio.pause();
                    audio.src = '';
                    document.removeEventListener('click', handleFirstInteraction, true);
                    document.removeEventListener('touchstart', handleFirstInteraction, true);
                };
            }, [streamUrl]);

            // Render hanya elemen audio tersembunyi → tidak ada UI yang terlihat
            return <audio ref={audioRef} src={streamUrl} preload="auto" style={{ display: 'none' }} />;
        }


        /* ================= MUSIC ADMIN (ADMIN ONLY) ================= */

export default FloatingMusicPlayer;
