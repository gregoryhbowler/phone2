// MODULE DEFINITIONS
// Hundreds of module types for the modular synth
// Each module has: name, category, create(ctx, params), connect(source), disconnect(), process(input)
// Inspired by: Buchla, Serge, Ciani, Barbieri, Reich, Radigue, Basinski, Autechre

export const MODULE_TYPES = {
    // ==========================================
    // OSCILLATORS (Sound Sources)
    // ==========================================

    // Basic oscillators - pure waveforms
    sineOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 110 + Math.random() * 330;
            const gain = ctx.createGain();
            gain.gain.value = 0.3;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    sawOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 55 + Math.random() * 220;
            const gain = ctx.createGain();
            gain.gain.value = 0.2;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    squareOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 82.5 + Math.random() * 165;
            const gain = ctx.createGain();
            gain.gain.value = 0.15;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    triangleOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = 220 + Math.random() * 440;
            const gain = ctx.createGain();
            gain.gain.value = 0.35;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    // SPECTRAL OSCILLATORS (Caterina Barbieri, Kali Malone inspired)
    harmonicOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.15;
            const oscs = [];
            const baseFreq = 55 + Math.random() * 55;

            for (let h = 1; h <= 8; h++) {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * h;
                const g = ctx.createGain();
                g.gain.value = 0.4 / h;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            }

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    oddHarmonicOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.18;
            const oscs = [];
            const baseFreq = 82.5 + Math.random() * 82.5;

            [1, 3, 5, 7, 9, 11].forEach((h, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * h;
                const g = ctx.createGain();
                g.gain.value = 0.3 / h;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    perfectOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.2;
            const oscs = [];
            const baseFreq = 55 + Math.random() * 55;

            const ratios = [1, 3/2, 9/4, 27/8].map(r => r > 2 ? r / 2 : r);
            ratios.forEach((ratio, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * ratio * (i < 2 ? 1 : 2);
                const g = ctx.createGain();
                g.gain.value = 0.2;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    phasingPair: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.25;
            const baseFreq = 220 + Math.random() * 220;

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = osc2.type = 'sine';
            osc1.frequency.value = baseFreq;
            osc2.frequency.value = baseFreq * 1.001;

            const g1 = ctx.createGain();
            const g2 = ctx.createGain();
            g1.gain.value = g2.gain.value = 0.5;

            const pan1 = ctx.createStereoPanner();
            const pan2 = ctx.createStereoPanner();
            pan1.pan.value = -0.3;
            pan2.pan.value = 0.3;

            osc1.connect(g1);
            osc2.connect(g2);
            g1.connect(pan1);
            g2.connect(pan2);
            pan1.connect(out);
            pan2.connect(out);

            osc1.start();
            osc2.start();

            return { node: out, osc: osc1, osc2, params: { freq: osc1.frequency, gain: out.gain } };
        }
    },

    droneOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.3;
            const baseFreq = 55;

            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = baseFreq;

            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.05;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.5;

            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            osc.connect(out);
            osc.start();
            lfo.start();

            return { node: out, osc, lfo, params: { freq: osc.frequency, gain: out.gain } };
        }
    },

    bellOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.12;
            const oscs = [];
            const baseFreq = 200 + Math.random() * 200;
            const ratios = [1, 2.0, 3.0, 4.2, 5.4, 6.8, 8.1];

            ratios.forEach((ratio, i) => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * ratio;
                const g = ctx.createGain();
                g.gain.value = 0.2 / (i + 1);
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push(osc);
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    pulseOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'sawtooth';
            const freq = 110 + Math.random() * 220;
            osc1.frequency.value = freq;
            osc2.frequency.value = freq;
            const inv = ctx.createGain();
            inv.gain.value = -1;
            const out = ctx.createGain();
            out.gain.value = 0.2;
            osc1.connect(out);
            osc2.connect(inv);
            inv.connect(out);
            osc1.start();
            osc2.start();
            return { node: out, osc: osc1, osc2, params: { freq: osc1.frequency, freq2: osc2.frequency } };
        }
    },

    superSaw: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.1;
            const oscs = [];
            const baseFreq = 110 + Math.random() * 110;
            for (let i = 0; i < 5; i++) {
                const osc = ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = baseFreq * (1 + (i - 2) * 0.01 * Math.random());
                osc.connect(out);
                osc.start();
                oscs.push(osc);
            }
            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    noiseWhite: {
        category: 'osc',
        create: (ctx) => {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = 0.1;
            noise.connect(gain);
            noise.start();
            return { node: gain, source: noise, params: { gain: gain.gain } };
        }
    },

    noisePink: {
        category: 'osc',
        create: (ctx) => {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = 0.12;
            noise.connect(gain);
            noise.start();
            return { node: gain, source: noise, params: { gain: gain.gain } };
        }
    },

    noiseBrown: {
        category: 'osc',
        create: (ctx) => {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = 0.15;
            noise.connect(gain);
            noise.start();
            return { node: gain, source: noise, params: { gain: gain.gain } };
        }
    },

    chaosOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc2.type = 'square';
            osc1.frequency.value = 37 + Math.random() * 100;
            osc2.frequency.value = 41 + Math.random() * 100;

            const gain1 = ctx.createGain();
            const gain2 = ctx.createGain();
            gain1.gain.value = 150;
            gain2.gain.value = 100;

            osc1.connect(gain1);
            osc2.connect(gain2);
            gain1.connect(osc2.frequency);
            gain2.connect(osc1.frequency);

            const out = ctx.createGain();
            out.gain.value = 0.12;
            osc1.connect(out);
            osc2.connect(out);

            osc1.start();
            osc2.start();

            return { node: out, osc: osc1, osc2, params: { freq: osc1.frequency, freq2: osc2.frequency } };
        }
    },

    fmOsc: {
        category: 'osc',
        create: (ctx) => {
            const carrier = ctx.createOscillator();
            const modulator = ctx.createOscillator();
            const modGain = ctx.createGain();

            carrier.type = 'sine';
            modulator.type = 'sine';

            const ratio = [1, 2, 3, 4, 5, 7][Math.floor(Math.random() * 6)];
            const baseFreq = 110 + Math.random() * 220;

            carrier.frequency.value = baseFreq;
            modulator.frequency.value = baseFreq * ratio;
            modGain.gain.value = baseFreq * (0.5 + Math.random() * 2);

            modulator.connect(modGain);
            modGain.connect(carrier.frequency);

            const out = ctx.createGain();
            out.gain.value = 0.2;
            carrier.connect(out);

            carrier.start();
            modulator.start();

            return { node: out, osc: carrier, modulator, params: { freq: carrier.frequency, modFreq: modulator.frequency, modDepth: modGain.gain } };
        }
    },

    additiveOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.15;
            const oscs = [];
            const baseFreq = 55 + Math.random() * 110;

            for (let i = 1; i <= 8; i++) {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * i;
                const g = ctx.createGain();
                g.gain.value = (Math.random() * 0.5) / i;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push({ osc, gain: g });
            }

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    subOsc: {
        category: 'osc',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 27.5 + Math.random() * 55;
            const gain = ctx.createGain();
            gain.gain.value = 0.35;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, gain: gain.gain } };
        }
    },

    metallicOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.1;
            const oscs = [];
            const baseFreq = 100 + Math.random() * 200;
            const ratios = [1, 1.4, 2.8, 3.5, 5.9, 6.7];

            ratios.forEach(ratio => {
                const osc = ctx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = baseFreq * ratio;
                const g = ctx.createGain();
                g.gain.value = 0.15 / ratio;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push(osc);
            });

            return { node: out, oscs, params: { gain: out.gain } };
        }
    },

    formantOsc: {
        category: 'osc',
        create: (ctx) => {
            const source = ctx.createOscillator();
            source.type = 'sawtooth';
            source.frequency.value = 110 + Math.random() * 110;

            const formants = [
                { freq: 800, Q: 5 },
                { freq: 1200, Q: 6 },
                { freq: 2500, Q: 8 }
            ];

            const out = ctx.createGain();
            out.gain.value = 0.15;

            formants.forEach(f => {
                const filter = ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = f.freq * (0.8 + Math.random() * 0.4);
                filter.Q.value = f.Q;
                const g = ctx.createGain();
                g.gain.value = 0.3;
                source.connect(filter);
                filter.connect(g);
                g.connect(out);
            });

            source.start();

            return { node: out, osc: source, params: { freq: source.frequency, gain: out.gain } };
        }
    },

    // ==========================================
    // BUCHLA-INSPIRED OSCILLATORS
    // Plucky, sizzling, complex timbres with internal modulation
    // ==========================================

    // Buchla-style complex oscillator with wavefolder-like harmonics
    buchlaComplex: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.18;

            // Primary oscillator
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const baseFreq = 110 + Math.random() * 220;
            osc.frequency.value = baseFreq;

            // Waveshaper for that folded/sizzle character
            const folder = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            const foldAmount = 2 + Math.random() * 3;
            for (let i = 0; i < 256; i++) {
                let x = (i - 128) / 128;
                // Triangle fold approximation
                x = x * foldAmount;
                while (Math.abs(x) > 1) {
                    x = x > 0 ? 2 - x : -2 - x;
                }
                curve[i] = x;
            }
            folder.curve = curve;

            // High shelf for sizzle
            const sizzle = ctx.createBiquadFilter();
            sizzle.type = 'highshelf';
            sizzle.frequency.value = 3000;
            sizzle.gain.value = 4 + Math.random() * 4;

            // Subtle internal modulation
            const modOsc = ctx.createOscillator();
            modOsc.type = 'sine';
            modOsc.frequency.value = baseFreq * (2 + Math.random());
            const modGain = ctx.createGain();
            modGain.gain.value = baseFreq * 0.3;
            modOsc.connect(modGain);
            modGain.connect(osc.frequency);

            osc.connect(folder);
            folder.connect(sizzle);
            sizzle.connect(out);

            osc.start();
            modOsc.start();

            return { node: out, osc, modOsc, params: { freq: osc.frequency, gain: out.gain, modDepth: modGain.gain } };
        }
    },

    // Buchla lowpass gate simulation - that characteristic plucky decay
    buchlaLPG: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.22;

            // Rich harmonic source
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            const baseFreq = 110 + Math.random() * 220;
            osc.frequency.value = baseFreq;

            // The LPG filter - resonant lowpass
            const lpg = ctx.createBiquadFilter();
            lpg.type = 'lowpass';
            lpg.frequency.value = 800 + Math.random() * 1500;
            lpg.Q.value = 4 + Math.random() * 6; // Resonant for that plucky ring

            // Vactrol-like response simulation via envelope
            const vcaEnv = ctx.createGain();
            vcaEnv.gain.value = 1;

            // Self-modulating filter for movement
            const filterMod = ctx.createOscillator();
            filterMod.type = 'sine';
            filterMod.frequency.value = 0.2 + Math.random() * 0.5;
            const filterModGain = ctx.createGain();
            filterModGain.gain.value = 300;
            filterMod.connect(filterModGain);
            filterModGain.connect(lpg.frequency);

            osc.connect(lpg);
            lpg.connect(vcaEnv);
            vcaEnv.connect(out);

            osc.start();
            filterMod.start();

            return { node: out, osc, lpg, params: { freq: osc.frequency, gain: out.gain, filterFreq: lpg.frequency, filterQ: lpg.Q } };
        }
    },

    // Buchla-style "bongo" - plucky percussive with pitch decay
    buchlaBongo: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.2;

            // Sine with slight FM for richness
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const baseFreq = 150 + Math.random() * 200;
            osc.frequency.value = baseFreq;

            // FM modulator for attack transient
            const modOsc = ctx.createOscillator();
            modOsc.type = 'sine';
            modOsc.frequency.value = baseFreq * 1.5;
            const modGain = ctx.createGain();
            modGain.gain.value = baseFreq * 0.8;
            modOsc.connect(modGain);
            modGain.connect(osc.frequency);

            // Resonant filter for body
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = baseFreq * 3;
            filter.Q.value = 8;

            // Parallel path for attack click
            const click = ctx.createOscillator();
            click.type = 'square';
            click.frequency.value = baseFreq * 4;
            const clickGain = ctx.createGain();
            clickGain.gain.value = 0.08;
            const clickFilter = ctx.createBiquadFilter();
            clickFilter.type = 'highpass';
            clickFilter.frequency.value = 2000;

            osc.connect(filter);
            filter.connect(out);
            click.connect(clickFilter);
            clickFilter.connect(clickGain);
            clickGain.connect(out);

            osc.start();
            modOsc.start();
            click.start();

            return { node: out, osc, modOsc, click, params: { freq: osc.frequency, gain: out.gain } };
        }
    },

    // Sizzle oscillator - bright harmonics with shimmer
    sizzleOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.15;

            const baseFreq = 220 + Math.random() * 220;

            // Multiple detuned oscillators for shimmer
            const oscs = [];
            for (let i = 0; i < 4; i++) {
                const osc = ctx.createOscillator();
                osc.type = i < 2 ? 'sawtooth' : 'square';
                osc.frequency.value = baseFreq * (1 + (i - 1.5) * 0.003);
                const g = ctx.createGain();
                g.gain.value = 0.15;
                osc.connect(g);
                g.connect(out);
                osc.start();
                oscs.push(osc);
            }

            // High-shelf boost for sizzle
            const sizzle = ctx.createBiquadFilter();
            sizzle.type = 'highshelf';
            sizzle.frequency.value = 4000;
            sizzle.gain.value = 6;

            // Reconnect through sizzle
            out.disconnect();
            const finalOut = ctx.createGain();
            finalOut.gain.value = 1;
            out.connect(sizzle);
            sizzle.connect(finalOut);

            return { node: finalOut, oscs, params: { freq: oscs[0].frequency, gain: out.gain } };
        }
    },

    // West Coast style dual oscillator with hard sync character
    westCoastDual: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.18;

            const baseFreq = 110 + Math.random() * 110;

            // Primary oscillator
            const osc1 = ctx.createOscillator();
            osc1.type = 'sawtooth';
            osc1.frequency.value = baseFreq;

            // Secondary at different ratio for beating
            const osc2 = ctx.createOscillator();
            osc2.type = 'triangle';
            const ratio = [1.5, 2, 2.5, 3, 4][Math.floor(Math.random() * 5)];
            osc2.frequency.value = baseFreq * ratio;

            // Ring mod style mixing
            const ringGain = ctx.createGain();
            ringGain.gain.value = 0.5;
            osc2.connect(ringGain.gain);

            const mix = ctx.createGain();
            mix.gain.value = 0.6;

            osc1.connect(ringGain);
            ringGain.connect(mix);
            osc2.connect(mix);
            mix.connect(out);

            osc1.start();
            osc2.start();

            return { node: out, osc: osc1, osc2, params: { freq: osc1.frequency, gain: out.gain } };
        }
    },

    // Vactrol-style oscillator with organic response
    vactrolOsc: {
        category: 'osc',
        create: (ctx) => {
            const out = ctx.createGain();
            out.gain.value = 0.2;

            const baseFreq = 110 + Math.random() * 220;

            // Triangle for that soft fundamental
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = baseFreq;

            // Slow filter modulation (vactrol-like sluggish response)
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1200;
            filter.Q.value = 2;

            const filterLFO = ctx.createOscillator();
            filterLFO.type = 'sine';
            filterLFO.frequency.value = 0.08 + Math.random() * 0.15; // Very slow
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 600;

            filterLFO.connect(lfoGain);
            lfoGain.connect(filter.frequency);

            // Soft saturation
            const sat = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i - 128) / 128;
                curve[i] = Math.tanh(x * 1.5);
            }
            sat.curve = curve;

            osc.connect(filter);
            filter.connect(sat);
            sat.connect(out);

            osc.start();
            filterLFO.start();

            return { node: out, osc, filterLFO, params: { freq: osc.frequency, gain: out.gain, filterFreq: filter.frequency } };
        }
    },

    // ==========================================
    // MODULATORS (LFOs, Envelopes, etc)
    // ==========================================

    lfoGlacial: {
        category: 'mod',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 0.01 + Math.random() * 0.05;
            const gain = ctx.createGain();
            gain.gain.value = 20;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSine: {
        category: 'mod',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 0.5 + Math.random() * 3;
            const gain = ctx.createGain();
            gain.gain.value = 15;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSquare: {
        category: 'mod',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 1 + Math.random() * 4;
            const gain = ctx.createGain();
            gain.gain.value = 12;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSaw: {
        category: 'mod',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 0.5 + Math.random() * 2;
            const gain = ctx.createGain();
            gain.gain.value = 18;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoRandom: {
        category: 'mod',
        create: (ctx) => {
            const bufferSize = ctx.sampleRate;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 0.2 + Math.random() * 0.5;
            const gain = ctx.createGain();
            gain.gain.value = 20;
            source.connect(gain);
            source.start();
            return { node: gain, source, params: { rate: source.playbackRate, depth: gain.gain }, isModulator: true };
        }
    },

    lfoSmooth: {
        category: 'mod',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 0.1 + Math.random() * 0.4;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 5;
            const gain = ctx.createGain();
            gain.gain.value = 25;
            osc.connect(filter);
            filter.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoFast: {
        category: 'mod',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 5 + Math.random() * 15;
            const gain = ctx.createGain();
            gain.gain.value = 8;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true };
        }
    },

    lfoChaotic: {
        category: 'mod',
        create: (ctx) => {
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.value = 0.3 + Math.random() * 0.5;
            osc2.frequency.value = 0.37 + Math.random() * 0.5;

            const mult = ctx.createGain();
            mult.gain.value = 15;
            osc1.connect(mult);
            osc2.connect(mult.gain);

            osc1.start();
            osc2.start();
            return { node: mult, osc: osc1, osc2, params: { freq: osc1.frequency, depth: mult.gain }, isModulator: true };
        }
    },

    sampleHold: {
        category: 'mod',
        create: (ctx) => {
            const noise = ctx.createBufferSource();
            const bufferSize = ctx.sampleRate;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            const stepSize = Math.floor(ctx.sampleRate / (2 + Math.random() * 8));
            let currentValue = 0;
            for (let i = 0; i < bufferSize; i++) {
                if (i % stepSize === 0) {
                    currentValue = Math.random() * 2 - 1;
                }
                data[i] = currentValue;
            }
            noise.buffer = buffer;
            noise.loop = true;
            const gain = ctx.createGain();
            gain.gain.value = 30;
            noise.connect(gain);
            noise.start();
            return { node: gain, source: noise, params: { depth: gain.gain }, isModulator: true };
        }
    },

    envFollower: {
        category: 'mod',
        create: (ctx) => {
            const input = ctx.createGain();
            const rectifier = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                curve[i] = Math.abs((i - 128) / 128);
            }
            rectifier.curve = curve;
            const smoothing = ctx.createBiquadFilter();
            smoothing.type = 'lowpass';
            smoothing.frequency.value = 10;
            const output = ctx.createGain();
            output.gain.value = 50;

            input.connect(rectifier);
            rectifier.connect(smoothing);
            smoothing.connect(output);

            return { node: input, output, params: { gain: output.gain }, isModulator: true };
        }
    },

    // ==========================================
    // EFFECTS (Filters, Delays, etc)
    // ==========================================

    tapeWobble: {
        category: 'fx',
        create: (ctx) => {
            const delay = ctx.createDelay(0.1);
            delay.delayTime.value = 0.005;
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.3 + Math.random() * 0.5;
            const depth = ctx.createGain();
            depth.gain.value = 0.002;
            lfo.connect(depth);
            depth.connect(delay.delayTime);
            lfo.start();
            return { node: delay, lfo, params: { freq: lfo.frequency, depth: depth.gain } };
        }
    },

    tapeLoss: {
        category: 'fx',
        create: (ctx) => {
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 40 + Math.random() * 60;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 4000 + Math.random() * 4000;
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -20;
            comp.ratio.value = 4;

            hp.connect(lp);
            lp.connect(comp);

            return { node: hp, output: comp, params: { hpFreq: hp.frequency, lpFreq: lp.frequency } };
        }
    },

    filterLP: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            // Higher minimum cutoff to avoid muffled/quiet patches
            filter.frequency.value = 1500 + Math.random() * 4000;
            filter.Q.value = 0.5 + Math.random() * 3;
            return { node: filter, params: { freq: filter.frequency, Q: filter.Q } };
        }
    },

    filterHP: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 100 + Math.random() * 500;
            filter.Q.value = 0.5 + Math.random() * 2;
            return { node: filter, params: { freq: filter.frequency, Q: filter.Q } };
        }
    },

    filterBP: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 500 + Math.random() * 2000;
            filter.Q.value = 1 + Math.random() * 5;
            return { node: filter, params: { freq: filter.frequency, Q: filter.Q } };
        }
    },

    filterNotch: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'notch';
            filter.frequency.value = 1000 + Math.random() * 2000;
            filter.Q.value = 2 + Math.random() * 6;
            return { node: filter, params: { freq: filter.frequency, Q: filter.Q } };
        }
    },

    filterPeak: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = 500 + Math.random() * 3000;
            filter.Q.value = 1 + Math.random() * 4;
            filter.gain.value = 3 + Math.random() * 9;
            return { node: filter, params: { freq: filter.frequency, Q: filter.Q, gain: filter.gain } };
        }
    },

    filterResonant: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            // Higher cutoff to let sound through even with high resonance
            filter.frequency.value = 1200 + Math.random() * 2500;
            filter.Q.value = 4 + Math.random() * 6;
            return { node: filter, params: { freq: filter.frequency, Q: filter.Q } };
        }
    },

    filterSVF: {
        category: 'fx',
        create: (ctx) => {
            const lp = ctx.createBiquadFilter();
            const hp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            hp.type = 'highpass';
            lp.frequency.value = hp.frequency.value = 1000 + Math.random() * 2000;
            lp.Q.value = hp.Q.value = 0.707;

            const mixer = ctx.createGain();
            mixer.gain.value = 0.7;

            lp.connect(hp);
            hp.connect(mixer);

            return { node: lp, output: mixer, params: { freq: lp.frequency } };
        }
    },

    combFilter: {
        category: 'fx',
        create: (ctx) => {
            const delay = ctx.createDelay(0.1);
            delay.delayTime.value = 0.002 + Math.random() * 0.015;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.4 + Math.random() * 0.4;

            const mix = ctx.createGain();
            mix.gain.value = 0.7;

            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(mix);

            return { node: delay, output: mix, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    allpassFilter: {
        category: 'fx',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'allpass';
            filter.frequency.value = 500 + Math.random() * 2000;
            filter.Q.value = 0.5 + Math.random() * 2;
            return { node: filter, params: { freq: filter.frequency, Q: filter.Q } };
        }
    },

    delayShort: {
        category: 'fx',
        create: (ctx) => {
            const delay = ctx.createDelay(1);
            delay.delayTime.value = 0.1 + Math.random() * 0.3;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.35 + Math.random() * 0.35;
            const mix = ctx.createGain();
            mix.gain.value = 0.6;

            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(mix);

            return { node: delay, output: mix, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    delayLong: {
        category: 'fx',
        create: (ctx) => {
            const delay = ctx.createDelay(4);
            delay.delayTime.value = 0.5 + Math.random() * 1.5;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.5 + Math.random() * 0.3;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 3000;
            filter.Q.value = 0.5;

            const mix = ctx.createGain();
            mix.gain.value = 0.4;

            delay.connect(filter);
            filter.connect(feedback);
            feedback.connect(delay);
            delay.connect(mix);

            return { node: delay, output: mix, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    delayPingPong: {
        category: 'fx',
        create: (ctx) => {
            const delay1 = ctx.createDelay(1);
            const delay2 = ctx.createDelay(1);
            delay1.delayTime.value = 0.15 + Math.random() * 0.2;
            delay2.delayTime.value = 0.2 + Math.random() * 0.3;

            const fb = ctx.createGain();
            fb.gain.value = 0.4;

            const mix = ctx.createGain();
            mix.gain.value = 0.5;

            delay1.connect(delay2);
            delay2.connect(fb);
            fb.connect(delay1);
            delay1.connect(mix);
            delay2.connect(mix);

            return { node: delay1, output: mix, params: { time: delay1.delayTime, feedback: fb.gain } };
        }
    },

    distortion: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const amount = 10 + Math.random() * 40;
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i - 128) / 128;
                curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
            }
            shaper.curve = curve;
            shaper.oversample = '2x';
            return { node: shaper, params: {} };
        }
    },

    softClip: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i - 128) / 128;
                curve[i] = x / (1 + Math.abs(x));
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    foldback: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            const threshold = 0.3 + Math.random() * 0.4;
            for (let i = 0; i < 256; i++) {
                let x = (i - 128) / 128;
                while (Math.abs(x) > threshold) {
                    x = Math.abs(Math.abs(x) - threshold * 2) - threshold;
                }
                curve[i] = x / threshold;
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    bitcrusher: {
        category: 'fx',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const bits = 4 + Math.floor(Math.random() * 4);
            const levels = Math.pow(2, bits);
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                const x = (i - 128) / 128;
                curve[i] = Math.round(x * levels) / levels;
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    ringMod: {
        category: 'fx',
        create: (ctx) => {
            const carrier = ctx.createOscillator();
            carrier.type = 'sine';
            carrier.frequency.value = 100 + Math.random() * 500;

            const modGain = ctx.createGain();
            modGain.gain.value = 0;

            carrier.connect(modGain.gain);
            carrier.start();

            return { node: modGain, osc: carrier, params: { freq: carrier.frequency } };
        }
    },

    compressor: {
        category: 'fx',
        create: (ctx) => {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -30 + Math.random() * 20;
            comp.knee.value = 10 + Math.random() * 20;
            comp.ratio.value = 4 + Math.random() * 12;
            comp.attack.value = 0.003 + Math.random() * 0.05;
            comp.release.value = 0.1 + Math.random() * 0.4;
            return { node: comp, params: { threshold: comp.threshold, ratio: comp.ratio } };
        }
    },

    convolver: {
        category: 'fx',
        create: (ctx) => {
            const conv = ctx.createConvolver();
            const length = ctx.sampleRate * (0.1 + Math.random() * 0.5);
            const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
            for (let c = 0; c < 2; c++) {
                const data = buffer.getChannelData(c);
                for (let i = 0; i < length; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.3));
                }
            }
            conv.buffer = buffer;

            const mix = ctx.createGain();
            mix.gain.value = 0.4;
            conv.connect(mix);

            return { node: conv, output: mix, params: {} };
        }
    },

    // ==========================================
    // SEQUENCERS & CLOCKS
    // ==========================================

    clockSlow: {
        category: 'seq',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 0.25 + Math.random() * 0.5;
            const gain = ctx.createGain();
            gain.gain.value = 25;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true, isClock: true };
        }
    },

    clockFast: {
        category: 'seq',
        create: (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = 2 + Math.random() * 6;
            const gain = ctx.createGain();
            gain.gain.value = 20;
            osc.connect(gain);
            osc.start();
            return { node: gain, osc, params: { freq: osc.frequency, depth: gain.gain }, isModulator: true, isClock: true };
        }
    },

    stepSeq: {
        category: 'seq',
        create: (ctx) => {
            const steps = 8;
            const buffer = ctx.createBuffer(1, steps, ctx.sampleRate / 1000);
            const data = buffer.getChannelData(0);
            const scale = [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8, 2];
            for (let i = 0; i < steps; i++) {
                data[i] = (Math.log2(scale[Math.floor(Math.random() * scale.length)]));
            }
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 1 + Math.random() * 3;
            const gain = ctx.createGain();
            gain.gain.value = 50;
            source.connect(gain);
            source.start();
            return { node: gain, source, params: { rate: source.playbackRate, depth: gain.gain }, isModulator: true };
        }
    },

    euclideanSeq: {
        category: 'seq',
        create: (ctx) => {
            const steps = 16;
            const hits = 3 + Math.floor(Math.random() * 5);
            const buffer = ctx.createBuffer(1, steps, ctx.sampleRate / 1000);
            const data = buffer.getChannelData(0);

            const pattern = [];
            let bucket = 0;
            for (let i = 0; i < steps; i++) {
                bucket += hits;
                if (bucket >= steps) {
                    bucket -= steps;
                    pattern.push(1);
                } else {
                    pattern.push(0);
                }
            }
            for (let i = 0; i < steps; i++) {
                data[i] = pattern[i];
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.playbackRate.value = 2 + Math.random() * 4;
            const gain = ctx.createGain();
            gain.gain.value = 30;
            source.connect(gain);
            source.start();
            return { node: gain, source, params: { rate: source.playbackRate, depth: gain.gain }, isModulator: true };
        }
    },

    // ==========================================
    // LOGIC & ROUTING
    // ==========================================

    mixer: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.5 + Math.random() * 0.5;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    attenuator: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.1 + Math.random() * 0.4;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    amplifier: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 1.5 + Math.random() * 2;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    inverter: {
        category: 'logic',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = -1;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    rectifier: {
        category: 'logic',
        create: (ctx) => {
            const shaper = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) {
                curve[i] = Math.abs((i - 128) / 128);
            }
            shaper.curve = curve;
            return { node: shaper, params: {} };
        }
    },

    slewLimiter: {
        category: 'logic',
        create: (ctx) => {
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 15 + Math.random() * 30;
            filter.Q.value = 0.707;
            return { node: filter, params: {} };
        }
    },

    dcOffset: {
        category: 'logic',
        create: (ctx) => {
            const offset = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
            if (offset.offset) {
                offset.offset.value = Math.random() * 0.5;
            }
            const gain = ctx.createGain();
            gain.gain.value = 1;
            offset.connect(gain);
            offset.start();
            return { node: gain, source: offset, params: { gain: gain.gain } };
        }
    },

    // ==========================================
    // UTILITIES
    // ==========================================

    vca: {
        category: 'util',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.3 + Math.random() * 0.4;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    panner: {
        category: 'util',
        create: (ctx, params = {}) => {
            const panner = ctx.createStereoPanner();
            // Use provided pan value, or default to center (0)
            panner.pan.value = params.pan !== undefined ? params.pan : 0;
            return { node: panner, params: { pan: panner.pan } };
        }
    },

    autoPanner: {
        category: 'util',
        create: (ctx) => {
            const panner = ctx.createStereoPanner();
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + Math.random() * 1;
            const depth = ctx.createGain();
            depth.gain.value = 0.6;
            lfo.connect(depth);
            depth.connect(panner.pan);
            lfo.start();
            return { node: panner, lfo, params: { freq: lfo.frequency, depth: depth.gain } };
        }
    },

    ducker: {
        category: 'util',
        create: (ctx) => {
            const gain = ctx.createGain();
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.5 + Math.random() * 2;
            const depth = ctx.createGain();
            depth.gain.value = -0.4;
            const offset = ctx.createConstantSource ? ctx.createConstantSource() : null;

            if (offset) {
                offset.offset.value = 1;
                offset.connect(gain.gain);
                offset.start();
            } else {
                gain.gain.value = 0.5;
            }

            lfo.connect(depth);
            depth.connect(gain.gain);
            lfo.start();

            return { node: gain, lfo, params: { freq: lfo.frequency } };
        }
    },

    crossfader: {
        category: 'util',
        create: (ctx) => {
            const gain = ctx.createGain();
            gain.gain.value = 0.5;
            return { node: gain, params: { gain: gain.gain } };
        }
    },

    feedbackLoop: {
        category: 'util',
        create: (ctx) => {
            const delay = ctx.createDelay(0.5);
            delay.delayTime.value = 0.02 + Math.random() * 0.08;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.2 + Math.random() * 0.25;
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2500 + Math.random() * 2000;
            filter.Q.value = 0.707;

            delay.connect(filter);
            filter.connect(feedback);
            feedback.connect(delay);

            return { node: delay, output: feedback, params: { time: delay.delayTime, feedback: feedback.gain } };
        }
    },

    limiter: {
        category: 'util',
        create: (ctx) => {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -3;
            comp.knee.value = 0;
            comp.ratio.value = 20;
            comp.attack.value = 0.001;
            comp.release.value = 0.1;
            return { node: comp, params: {} };
        }
    },

    stereoWidener: {
        category: 'util',
        create: (ctx) => {
            const splitter = ctx.createChannelSplitter(2);
            const merger = ctx.createChannelMerger(2);
            const delay = ctx.createDelay(0.1);
            delay.delayTime.value = 0.01 + Math.random() * 0.02;

            splitter.connect(merger, 0, 0);
            splitter.connect(delay);
            delay.connect(merger, 0, 1);

            return { node: splitter, output: merger, params: { time: delay.delayTime } };
        }
    }
};

// Get all module type names
export const MODULE_NAMES = Object.keys(MODULE_TYPES);

// Get random module type
export function getRandomModuleType() {
    return MODULE_NAMES[Math.floor(Math.random() * MODULE_NAMES.length)];
}

// Get module types by category
export function getModulesByCategory(category) {
    return Object.entries(MODULE_TYPES)
        .filter(([_, m]) => m.category === category)
        .map(([name]) => name);
}
