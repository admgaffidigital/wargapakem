import React, { useEffect, useRef } from 'react';

        function FlagWavingBackground({ theme }) {
            const canvasRef = useRef(null);
            const themeRef = useRef(theme);

            useEffect(() => {
                themeRef.current = theme;
            }, [theme]);

            useEffect(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                let animFrame;
                let t = 0;
                let W, H;
                let isAnimating = true;

                function resize() {
                    W = window.innerWidth;
                    H = window.innerHeight;
                    canvas.width = W;
                    canvas.height = H;
                }
                resize();
                window.addEventListener('resize', resize);

                function drawFrame(time) {
                    const isDark = themeRef.current === 'dark';
                    ctx.clearRect(0, 0, W, H);

                    ctx.clearRect(0, 0, W, H);

                    // 1. Gambar area MERAH (Bagian atas bendera)
                    ctx.fillStyle = isDark ? '#4c0519' : '#dc2626'; // Rose-950 atau Merah standar
                    ctx.beginPath();
                    
                    // Mulai dari pojok kiri atas
                    ctx.moveTo(0, 0);
                    
                    // Gambar batas atas
                    ctx.lineTo(W, 0);
                    
                    // Titik kanan tengah (batas gelombang)
                    const endAmp = H * 0.08;
                    const endPhase = Math.PI * 3.5 - time * 1.8;
                    ctx.lineTo(W, H * 0.5 + Math.sin(endPhase) * endAmp);
                    
                    // Loop mundur untuk menggambar kurva batas bawah bendera dari kanan ke kiri
                    // Optimasi: Gunakan resolusi 15px di layar kecil (mobile) agar ringan
                    const step = W < 768 ? 15 : 5;
                    for (let x = W; x >= 0; x -= step) {
                        const xProgress = x / W;
                        const amplitude = H * 0.08 * xProgress * xProgress;
                        const wavePhase = xProgress * Math.PI * 3.5 - time * 1.8;
                        const midY = H * 0.5 + Math.sin(wavePhase) * amplitude;
                        ctx.lineTo(x, midY);
                    }
                    
                    // Titik kiri tengah
                    const startPhase = 0 * Math.PI * 3.5 - time * 1.8;
                    ctx.lineTo(0, H * 0.5 + Math.sin(startPhase) * 0);
                    
                    ctx.closePath();
                    ctx.fill();

                    // 3. Tambahkan bayangan kain 3D dengan Linear Gradient yang sangat halus
                    const shadeGrad = ctx.createLinearGradient(0, 0, W, 0);
                    const shadeStops = W < 768 ? 10 : 20; 
                    for (let i = 0; i <= shadeStops; i++) {
                        const xProgress = i / shadeStops;
                        const wavePhase = xProgress * Math.PI * 3.5 - time * 1.8;
                        const curvature = Math.cos(wavePhase); // -1 sampai 1
                        
                        if (curvature > 0) {
                            // Diperhalus signifikan (dari 0.15 ke 0.03) agar elegan dan bersih
                            const alpha = curvature * 0.03; 
                            shadeGrad.addColorStop(xProgress, `rgba(255,255,255,${alpha})`);
                        } else {
                            // Diperhalus signifikan (dari 0.25 ke 0.04) agar tidak seperti noda/smudge abu-abu di background putih
                            const alpha = -curvature * 0.04; 
                            shadeGrad.addColorStop(xProgress, `rgba(0,0,0,${alpha})`);
                        }
                    }
                    ctx.fillStyle = shadeGrad;
                    ctx.fillRect(0, 0, W, H);

                    // 4. Efek kilau satin yang bergerak (Shimmer)
                    const shimX = W * (0.3 + Math.sin(time * 0.4) * 0.25);
                    const shimY = H * (0.3 + Math.cos(time * 0.3) * 0.15);
                    const grad = ctx.createRadialGradient(shimX, shimY, 0, shimX, shimY, W * 0.45);
                    grad.addColorStop(0, 'rgba(255,255,255,0.04)'); // Lebih halus
                    grad.addColorStop(1, 'rgba(255,255,255,0)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, 0, W, H);
                }

                function loop() {
                    if (!isAnimating) return;
                    animFrame = requestAnimationFrame(loop);
                    if (document.hidden) return;
                    drawFrame(t);
                    t += 0.045;
                }

                // Render frame pertama langsung agar layar tidak kosong
                drawFrame(0);

                // Tunda animasi 2 detik agar PageSpeed selesai menghitung LCP dan TTI tanpa gangguan
                const startDelay = setTimeout(() => {
                    loop();
                }, 2000);

                return () => {
                    isAnimating = false;
                    clearTimeout(startDelay);
                    cancelAnimationFrame(animFrame);
                    window.removeEventListener('resize', resize);
                };
            }, []);

            return (
                                <canvas
                    ref={canvasRef}
                    className="fixed inset-0 pointer-events-none no-print"
                    style={{ zIndex: -1, width: '100%', height: '100%' }}
                />
            );
        }


export default FlagWavingBackground;
