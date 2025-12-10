// PITCH-TRACKING OSCILLATOR WRAPPERS
// Wraps complex oscillators (harmonic, additive, FM, etc.) to properly track pitch
// These maintain spectral character while allowing the pitch bus to control them

import { MODULE_TYPES } from './modules.js';

// Base class for pitch-tracking oscillators
class PitchTrackingOscillator {
    constructor(ctx, baseFreq = 220) {
        this.ctx = ctx;
        this.baseFreq = baseFreq;
        this.node = null;
        this.params = {};
    }

    // Set the base frequency - override in subclasses
    setFrequency(freq) {
        this.baseFreq = freq;
    }

    // Cleanup
    dispose() {}
}

// Harmonic Oscillator - tracks pitch across all partials
export class HarmonicOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.numHarmonics = options.numHarmonics || 8;
        this.amplitudeDecay = options.amplitudeDecay || 1; // 1/h decay

        // Output gain - boosted for better presence
        this.node = ctx.createGain();
        this.node.gain.value = 0.35;

        // Create oscillators for each harmonic
        this.oscillators = [];
        this.gains = [];

        for (let h = 1; h <= this.numHarmonics; h++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = this.baseFreq * h;

            const gain = ctx.createGain();
            gain.gain.value = 0.4 / Math.pow(h, this.amplitudeDecay);

            osc.connect(gain);
            gain.connect(this.node);
            osc.start();

            this.oscillators.push(osc);
            this.gains.push(gain);
        }

        this.params = { gain: this.node.gain };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;

        // Update all harmonics proportionally
        for (let i = 0; i < this.oscillators.length; i++) {
            const harmonic = i + 1;
            this.oscillators[i].frequency.setTargetAtTime(
                freq * harmonic,
                time,
                0.02 // Glide time
            );
        }
    }

    dispose() {
        this.oscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
            try { osc.disconnect(); } catch (e) {}
        });
        this.gains.forEach(g => {
            try { g.disconnect(); } catch (e) {}
        });
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Odd Harmonic Oscillator - hollow, clarinet-like
export class OddHarmonicOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.harmonics = [1, 3, 5, 7, 9, 11];

        this.node = ctx.createGain();
        this.node.gain.value = 0.4;

        this.oscillators = [];
        this.gains = [];

        for (const h of this.harmonics) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = this.baseFreq * h;

            const gain = ctx.createGain();
            gain.gain.value = 0.3 / h;

            osc.connect(gain);
            gain.connect(this.node);
            osc.start();

            this.oscillators.push({ osc, harmonic: h });
            this.gains.push(gain);
        }

        this.params = { gain: this.node.gain };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;

        for (const { osc, harmonic } of this.oscillators) {
            osc.frequency.setTargetAtTime(freq * harmonic, time, 0.02);
        }
    }

    dispose() {
        this.oscillators.forEach(({ osc }) => {
            try { osc.stop(); } catch (e) {}
            try { osc.disconnect(); } catch (e) {}
        });
        this.gains.forEach(g => {
            try { g.disconnect(); } catch (e) {}
        });
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Perfect Intervals Oscillator - stacked fifths (Riley/Young style)
export class PerfectOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        // Just intonation ratios for perfect intervals
        this.ratios = [1, 3/2, 2, 3]; // Root, 5th, octave, 5th+octave

        this.node = ctx.createGain();
        this.node.gain.value = 0.45;

        this.oscillators = [];
        this.gains = [];

        for (const ratio of this.ratios) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = this.baseFreq * ratio;

            const gain = ctx.createGain();
            gain.gain.value = 0.2;

            osc.connect(gain);
            gain.connect(this.node);
            osc.start();

            this.oscillators.push({ osc, ratio });
            this.gains.push(gain);
        }

        this.params = { gain: this.node.gain };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;

        for (const { osc, ratio } of this.oscillators) {
            osc.frequency.setTargetAtTime(freq * ratio, time, 0.02);
        }
    }

    dispose() {
        this.oscillators.forEach(({ osc }) => {
            try { osc.stop(); } catch (e) {}
            try { osc.disconnect(); } catch (e) {}
        });
        this.gains.forEach(g => {
            try { g.disconnect(); } catch (e) {}
        });
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Additive Oscillator - random amplitudes but pitch-tracking
export class AdditiveOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.numPartials = options.numPartials || 8;

        this.node = ctx.createGain();
        this.node.gain.value = 0.4;

        this.oscillators = [];
        this.gains = [];
        this.amplitudes = []; // Store random amplitudes

        for (let i = 1; i <= this.numPartials; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = this.baseFreq * i;

            // Random amplitude with 1/i decay - ensure minimum presence
            const amp = (0.2 + Math.random() * 0.4) / i;
            this.amplitudes.push(amp);

            const gain = ctx.createGain();
            gain.gain.value = amp;

            osc.connect(gain);
            gain.connect(this.node);
            osc.start();

            this.oscillators.push(osc);
            this.gains.push(gain);
        }

        this.params = { gain: this.node.gain };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;

        for (let i = 0; i < this.oscillators.length; i++) {
            const harmonic = i + 1;
            this.oscillators[i].frequency.setTargetAtTime(
                freq * harmonic,
                time,
                0.02
            );
        }
    }

    // Randomize the amplitudes (for variation)
    randomizeAmplitudes() {
        const time = this.ctx.currentTime;
        for (let i = 0; i < this.gains.length; i++) {
            const amp = (Math.random() * 0.5) / (i + 1);
            this.amplitudes[i] = amp;
            this.gains[i].gain.setTargetAtTime(amp, time, 0.1);
        }
    }

    dispose() {
        this.oscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
            try { osc.disconnect(); } catch (e) {}
        });
        this.gains.forEach(g => {
            try { g.disconnect(); } catch (e) {}
        });
        try { this.node.disconnect(); } catch (e) {}
    }
}

// FM Oscillator - maintains carrier:modulator ratio
export class FMOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        // FM parameters - randomize ratio for variety
        this.ratio = options.ratio || [1.5, 2, 2.5, 3, 4, 5][Math.floor(Math.random() * 6)];
        this.modulationIndex = options.modulationIndex || (0.5 + Math.random() * 2);

        // Carrier
        this.carrier = ctx.createOscillator();
        this.carrier.type = 'sine';
        this.carrier.frequency.value = this.baseFreq;

        // Modulator
        this.modulator = ctx.createOscillator();
        this.modulator.type = 'sine';
        this.modulator.frequency.value = this.baseFreq * this.ratio;

        // Modulation depth
        this.modGain = ctx.createGain();
        this.modGain.gain.value = this.baseFreq * this.modulationIndex;

        // Output - boosted for presence
        this.node = ctx.createGain();
        this.node.gain.value = 0.45;

        // Connect: modulator -> modGain -> carrier.frequency
        this.modulator.connect(this.modGain);
        this.modGain.connect(this.carrier.frequency);
        this.carrier.connect(this.node);

        this.carrier.start();
        this.modulator.start();

        this.params = {
            gain: this.node.gain,
            modDepth: this.modGain.gain
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;

        // Update carrier frequency
        this.carrier.frequency.setTargetAtTime(freq, time, 0.02);

        // Update modulator frequency (maintain ratio)
        this.modulator.frequency.setTargetAtTime(freq * this.ratio, time, 0.02);

        // Update modulation depth (proportional to frequency)
        this.modGain.gain.setTargetAtTime(freq * this.modulationIndex, time, 0.02);
    }

    setRatio(ratio) {
        this.ratio = ratio;
        this.modulator.frequency.setTargetAtTime(
            this.baseFreq * ratio,
            this.ctx.currentTime,
            0.02
        );
    }

    setModulationIndex(index) {
        this.modulationIndex = index;
        this.modGain.gain.setTargetAtTime(
            this.baseFreq * index,
            this.ctx.currentTime,
            0.02
        );
    }

    dispose() {
        try { this.carrier.stop(); } catch (e) {}
        try { this.carrier.disconnect(); } catch (e) {}
        try { this.modulator.stop(); } catch (e) {}
        try { this.modulator.disconnect(); } catch (e) {}
        try { this.modGain.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Bell Oscillator - inharmonic partials that track pitch
export class BellOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        // Inharmonic ratios for bell-like tones - randomize slightly for variety
        const baseRatios = [1, 2.0, 3.0, 4.2, 5.4, 6.8, 8.1];
        this.ratios = baseRatios.map(r => r * (0.98 + Math.random() * 0.04));

        this.node = ctx.createGain();
        this.node.gain.value = 0.35;

        this.oscillators = [];
        this.gains = [];

        for (let i = 0; i < this.ratios.length; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = this.baseFreq * this.ratios[i];

            const gain = ctx.createGain();
            gain.gain.value = 0.2 / (i + 1);

            osc.connect(gain);
            gain.connect(this.node);
            osc.start();

            this.oscillators.push(osc);
            this.gains.push(gain);
        }

        this.params = { gain: this.node.gain };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;

        for (let i = 0; i < this.oscillators.length; i++) {
            this.oscillators[i].frequency.setTargetAtTime(
                freq * this.ratios[i],
                time,
                0.02
            );
        }
    }

    dispose() {
        this.oscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
            try { osc.disconnect(); } catch (e) {}
        });
        this.gains.forEach(g => {
            try { g.disconnect(); } catch (e) {}
        });
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Phasing Pair - two oscillators with slight detune
export class PhasingPairOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        // Randomize detune for variety in phasing speed
        this.detuneRatio = options.detuneRatio || (1 + 0.0005 + Math.random() * 0.002);

        this.node = ctx.createGain();
        this.node.gain.value = 0.5;

        // Two oscillators
        this.osc1 = ctx.createOscillator();
        this.osc2 = ctx.createOscillator();
        this.osc1.type = this.osc2.type = 'sine';
        this.osc1.frequency.value = this.baseFreq;
        this.osc2.frequency.value = this.baseFreq * this.detuneRatio;

        // Individual gains
        this.gain1 = ctx.createGain();
        this.gain2 = ctx.createGain();
        this.gain1.gain.value = this.gain2.gain.value = 0.5;

        // Stereo panning
        this.pan1 = ctx.createStereoPanner();
        this.pan2 = ctx.createStereoPanner();
        this.pan1.pan.value = -0.3;
        this.pan2.pan.value = 0.3;

        // Connect
        this.osc1.connect(this.gain1);
        this.osc2.connect(this.gain2);
        this.gain1.connect(this.pan1);
        this.gain2.connect(this.pan2);
        this.pan1.connect(this.node);
        this.pan2.connect(this.node);

        this.osc1.start();
        this.osc2.start();

        this.params = { gain: this.node.gain };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;

        this.osc1.frequency.setTargetAtTime(freq, time, 0.02);
        this.osc2.frequency.setTargetAtTime(freq * this.detuneRatio, time, 0.02);
    }

    setDetune(ratio) {
        this.detuneRatio = ratio;
        this.osc2.frequency.setTargetAtTime(
            this.baseFreq * ratio,
            this.ctx.currentTime,
            0.02
        );
    }

    dispose() {
        try { this.osc1.stop(); } catch (e) {}
        try { this.osc1.disconnect(); } catch (e) {}
        try { this.osc2.stop(); } catch (e) {}
        try { this.osc2.disconnect(); } catch (e) {}
        try { this.gain1.disconnect(); } catch (e) {}
        try { this.gain2.disconnect(); } catch (e) {}
        try { this.pan1.disconnect(); } catch (e) {}
        try { this.pan2.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Formant Oscillator - source tracks pitch, formants stay fixed
export class FormantOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        // Formant frequencies (vowel-like, don't change with pitch)
        // Randomize for different vowel colors
        const vowelType = Math.floor(Math.random() * 4);
        const vowels = [
            [{ freq: 800, Q: 5 }, { freq: 1200, Q: 6 }, { freq: 2500, Q: 8 }],   // "ah"
            [{ freq: 400, Q: 5 }, { freq: 2000, Q: 7 }, { freq: 2800, Q: 8 }],   // "ee"
            [{ freq: 500, Q: 4 }, { freq: 1000, Q: 5 }, { freq: 2300, Q: 7 }],   // "oh"
            [{ freq: 350, Q: 6 }, { freq: 600, Q: 5 }, { freq: 2700, Q: 9 }]     // "oo"
        ];
        this.formants = options.formants || vowels[vowelType];

        // Source oscillator (tracks pitch)
        this.source = ctx.createOscillator();
        this.source.type = 'sawtooth';
        this.source.frequency.value = this.baseFreq;

        // Output - boosted
        this.node = ctx.createGain();
        this.node.gain.value = 0.4;

        // Formant filters (fixed frequencies)
        this.filters = [];
        for (const f of this.formants) {
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = f.freq;
            filter.Q.value = f.Q;

            const gain = ctx.createGain();
            gain.gain.value = 0.3;

            this.source.connect(filter);
            filter.connect(gain);
            gain.connect(this.node);

            this.filters.push(filter);
        }

        this.source.start();

        this.params = {
            gain: this.node.gain,
            freq: this.source.frequency
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        // Only the source oscillator follows pitch
        // Formant filters stay at fixed frequencies
        this.source.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
    }

    dispose() {
        try { this.source.stop(); } catch (e) {}
        try { this.source.disconnect(); } catch (e) {}
        this.filters.forEach(f => {
            try { f.disconnect(); } catch (e) {}
        });
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Simple oscillators that just need frequency tracking
export class SimpleOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.osc = ctx.createOscillator();
        this.osc.type = options.type || 'sine';
        this.osc.frequency.value = this.baseFreq;

        this.node = ctx.createGain();
        this.node.gain.value = options.gain || 0.5;

        this.osc.connect(this.node);
        this.osc.start();

        this.params = {
            gain: this.node.gain,
            freq: this.osc.frequency
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
    }

    dispose() {
        try { this.osc.stop(); } catch (e) {}
        try { this.osc.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// ==========================================
// BUCHLA-STYLE PITCH-TRACKING OSCILLATORS
// ==========================================

// Buchla Complex - wavefolder with internal FM
export class BuchlaComplexOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        // More varied parameters for distinct timbres
        this.foldAmount = options.foldAmount || (1.5 + Math.random() * 4);
        this.modRatio = options.modRatio || [1.5, 2, 2.5, 3, 3.5, 4][Math.floor(Math.random() * 6)];
        this.modIndex = options.modIndex || (0.2 + Math.random() * 0.6);

        this.node = ctx.createGain();
        this.node.gain.value = 0.4;

        // Primary oscillator
        this.osc = ctx.createOscillator();
        this.osc.type = 'sine';
        this.osc.frequency.value = this.baseFreq;

        // FM modulator
        this.modOsc = ctx.createOscillator();
        this.modOsc.type = 'sine';
        this.modOsc.frequency.value = this.baseFreq * this.modRatio;
        this.modGain = ctx.createGain();
        this.modGain.gain.value = this.baseFreq * this.modIndex;
        this.modOsc.connect(this.modGain);
        this.modGain.connect(this.osc.frequency);

        // Wavefolder
        this.folder = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            let x = (i - 128) / 128;
            x = x * this.foldAmount;
            while (Math.abs(x) > 1) {
                x = x > 0 ? 2 - x : -2 - x;
            }
            curve[i] = x;
        }
        this.folder.curve = curve;

        // High shelf for sizzle
        this.sizzle = ctx.createBiquadFilter();
        this.sizzle.type = 'highshelf';
        this.sizzle.frequency.value = 3000;
        this.sizzle.gain.value = 4 + Math.random() * 4;

        this.osc.connect(this.folder);
        this.folder.connect(this.sizzle);
        this.sizzle.connect(this.node);

        this.osc.start();
        this.modOsc.start();

        this.params = {
            gain: this.node.gain,
            modDepth: this.modGain.gain,
            sizzle: this.sizzle.gain
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;
        this.osc.frequency.setTargetAtTime(freq, time, 0.02);
        this.modOsc.frequency.setTargetAtTime(freq * this.modRatio, time, 0.02);
        this.modGain.gain.setTargetAtTime(freq * this.modIndex, time, 0.02);
    }

    dispose() {
        try { this.osc.stop(); } catch (e) {}
        try { this.osc.disconnect(); } catch (e) {}
        try { this.modOsc.stop(); } catch (e) {}
        try { this.modOsc.disconnect(); } catch (e) {}
        try { this.modGain.disconnect(); } catch (e) {}
        try { this.folder.disconnect(); } catch (e) {}
        try { this.sizzle.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Buchla LPG - resonant lowpass gate character
export class BuchlaLPGOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.node = ctx.createGain();
        this.node.gain.value = 0.45;

        // Rich harmonic source
        this.osc = ctx.createOscillator();
        this.osc.type = 'sawtooth';
        this.osc.frequency.value = this.baseFreq;

        // LPG filter - resonant lowpass
        this.lpg = ctx.createBiquadFilter();
        this.lpg.type = 'lowpass';
        this.filterBaseFreq = 800 + Math.random() * 1500;
        this.lpg.frequency.value = this.filterBaseFreq;
        this.lpg.Q.value = 4 + Math.random() * 6;

        // Filter modulation
        this.filterMod = ctx.createOscillator();
        this.filterMod.type = 'sine';
        this.filterMod.frequency.value = 0.2 + Math.random() * 0.5;
        this.filterModGain = ctx.createGain();
        this.filterModGain.gain.value = 300;
        this.filterMod.connect(this.filterModGain);
        this.filterModGain.connect(this.lpg.frequency);

        this.osc.connect(this.lpg);
        this.lpg.connect(this.node);

        this.osc.start();
        this.filterMod.start();

        this.params = {
            gain: this.node.gain,
            filterFreq: this.lpg.frequency,
            filterQ: this.lpg.Q,
            modDepth: this.filterModGain.gain
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;
        this.osc.frequency.setTargetAtTime(freq, time, 0.02);
        // Filter tracks pitch somewhat (key tracking)
        const filterTarget = this.filterBaseFreq + (freq - 220) * 1.5;
        this.lpg.frequency.setTargetAtTime(Math.max(200, filterTarget), time, 0.05);
    }

    dispose() {
        try { this.osc.stop(); } catch (e) {}
        try { this.osc.disconnect(); } catch (e) {}
        try { this.filterMod.stop(); } catch (e) {}
        try { this.filterMod.disconnect(); } catch (e) {}
        try { this.filterModGain.disconnect(); } catch (e) {}
        try { this.lpg.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Buchla Bongo - plucky percussive tone
export class BuchlaBongoOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.node = ctx.createGain();
        this.node.gain.value = 0.45;

        // Main sine
        this.osc = ctx.createOscillator();
        this.osc.type = 'sine';
        this.osc.frequency.value = this.baseFreq;

        // FM for attack transient
        this.modOsc = ctx.createOscillator();
        this.modOsc.type = 'sine';
        this.modOsc.frequency.value = this.baseFreq * 1.5;
        this.modGain = ctx.createGain();
        this.modGain.gain.value = this.baseFreq * 0.8;
        this.modOsc.connect(this.modGain);
        this.modGain.connect(this.osc.frequency);

        // Resonant filter for body
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'bandpass';
        this.filter.frequency.value = this.baseFreq * 3;
        this.filter.Q.value = 8;

        // Click layer
        this.click = ctx.createOscillator();
        this.click.type = 'square';
        this.click.frequency.value = this.baseFreq * 4;
        this.clickGain = ctx.createGain();
        this.clickGain.gain.value = 0.08;
        this.clickFilter = ctx.createBiquadFilter();
        this.clickFilter.type = 'highpass';
        this.clickFilter.frequency.value = 2000;

        this.osc.connect(this.filter);
        this.filter.connect(this.node);
        this.click.connect(this.clickFilter);
        this.clickFilter.connect(this.clickGain);
        this.clickGain.connect(this.node);

        this.osc.start();
        this.modOsc.start();
        this.click.start();

        this.params = {
            gain: this.node.gain,
            clickGain: this.clickGain.gain
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;
        this.osc.frequency.setTargetAtTime(freq, time, 0.02);
        this.modOsc.frequency.setTargetAtTime(freq * 1.5, time, 0.02);
        this.modGain.gain.setTargetAtTime(freq * 0.8, time, 0.02);
        this.filter.frequency.setTargetAtTime(freq * 3, time, 0.02);
        this.click.frequency.setTargetAtTime(freq * 4, time, 0.02);
    }

    dispose() {
        try { this.osc.stop(); } catch (e) {}
        try { this.osc.disconnect(); } catch (e) {}
        try { this.modOsc.stop(); } catch (e) {}
        try { this.modOsc.disconnect(); } catch (e) {}
        try { this.modGain.disconnect(); } catch (e) {}
        try { this.filter.disconnect(); } catch (e) {}
        try { this.click.stop(); } catch (e) {}
        try { this.click.disconnect(); } catch (e) {}
        try { this.clickGain.disconnect(); } catch (e) {}
        try { this.clickFilter.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Sizzle Oscillator - detuned with high shelf
export class SizzleOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.node = ctx.createGain();
        this.node.gain.value = 0.35;

        this.oscillators = [];
        this.gains = [];

        // Multiple detuned oscillators
        for (let i = 0; i < 4; i++) {
            const osc = ctx.createOscillator();
            osc.type = i < 2 ? 'sawtooth' : 'square';
            osc.frequency.value = this.baseFreq * (1 + (i - 1.5) * 0.003);
            const g = ctx.createGain();
            g.gain.value = 0.15;
            osc.connect(g);
            g.connect(this.node);
            osc.start();
            this.oscillators.push(osc);
            this.gains.push(g);
        }

        // Sizzle shelf
        this.sizzle = ctx.createBiquadFilter();
        this.sizzle.type = 'highshelf';
        this.sizzle.frequency.value = 4000;
        this.sizzle.gain.value = 6;

        this.finalNode = ctx.createGain();
        this.finalNode.gain.value = 1;
        this.node.connect(this.sizzle);
        this.sizzle.connect(this.finalNode);

        this.params = {
            gain: this.node.gain,
            sizzle: this.sizzle.gain
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;
        for (let i = 0; i < this.oscillators.length; i++) {
            this.oscillators[i].frequency.setTargetAtTime(
                freq * (1 + (i - 1.5) * 0.003),
                time,
                0.02
            );
        }
    }

    get outputNode() {
        return this.finalNode;
    }

    dispose() {
        this.oscillators.forEach(osc => {
            try { osc.stop(); } catch (e) {}
            try { osc.disconnect(); } catch (e) {}
        });
        this.gains.forEach(g => {
            try { g.disconnect(); } catch (e) {}
        });
        try { this.sizzle.disconnect(); } catch (e) {}
        try { this.finalNode.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// West Coast Dual - two oscillators with ring-mod style interaction
export class WestCoastDualOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.ratio = options.ratio || [1.5, 2, 2.5, 3, 4, 5, 6][Math.floor(Math.random() * 7)];

        this.node = ctx.createGain();
        this.node.gain.value = 0.4;

        // Primary oscillator
        this.osc1 = ctx.createOscillator();
        this.osc1.type = 'sawtooth';
        this.osc1.frequency.value = this.baseFreq;

        // Secondary at ratio
        this.osc2 = ctx.createOscillator();
        this.osc2.type = 'triangle';
        this.osc2.frequency.value = this.baseFreq * this.ratio;

        // Ring-mod style mixing
        this.ringGain = ctx.createGain();
        this.ringGain.gain.value = 0.5;
        this.osc2.connect(this.ringGain.gain);

        this.mix = ctx.createGain();
        this.mix.gain.value = 0.6;

        this.osc1.connect(this.ringGain);
        this.ringGain.connect(this.mix);
        this.osc2.connect(this.mix);
        this.mix.connect(this.node);

        this.osc1.start();
        this.osc2.start();

        this.params = {
            gain: this.node.gain
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;
        this.osc1.frequency.setTargetAtTime(freq, time, 0.02);
        this.osc2.frequency.setTargetAtTime(freq * this.ratio, time, 0.02);
    }

    dispose() {
        try { this.osc1.stop(); } catch (e) {}
        try { this.osc1.disconnect(); } catch (e) {}
        try { this.osc2.stop(); } catch (e) {}
        try { this.osc2.disconnect(); } catch (e) {}
        try { this.ringGain.disconnect(); } catch (e) {}
        try { this.mix.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Vactrol Oscillator - organic slow filter modulation
export class VactrolOscillator extends PitchTrackingOscillator {
    constructor(ctx, options = {}) {
        super(ctx, options.baseFreq || 220);

        this.node = ctx.createGain();
        this.node.gain.value = 0.45;

        // Triangle source
        this.osc = ctx.createOscillator();
        this.osc.type = 'triangle';
        this.osc.frequency.value = this.baseFreq;

        // Slow filter modulation (vactrol character)
        this.filter = ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filterBaseFreq = 1200;
        this.filter.frequency.value = this.filterBaseFreq;
        this.filter.Q.value = 2;

        this.filterLFO = ctx.createOscillator();
        this.filterLFO.type = 'sine';
        this.filterLFO.frequency.value = 0.08 + Math.random() * 0.15;
        this.lfoGain = ctx.createGain();
        this.lfoGain.gain.value = 600;
        this.filterLFO.connect(this.lfoGain);
        this.lfoGain.connect(this.filter.frequency);

        // Soft saturation
        this.sat = ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i - 128) / 128;
            curve[i] = Math.tanh(x * 1.5);
        }
        this.sat.curve = curve;

        this.osc.connect(this.filter);
        this.filter.connect(this.sat);
        this.sat.connect(this.node);

        this.osc.start();
        this.filterLFO.start();

        this.params = {
            gain: this.node.gain,
            filterFreq: this.filter.frequency,
            modDepth: this.lfoGain.gain
        };
    }

    setFrequency(freq) {
        this.baseFreq = freq;
        const time = this.ctx.currentTime;
        this.osc.frequency.setTargetAtTime(freq, time, 0.02);
        // Filter tracks pitch
        const filterTarget = this.filterBaseFreq + (freq - 220) * 2;
        this.filter.frequency.setTargetAtTime(Math.max(300, filterTarget), time, 0.08);
    }

    dispose() {
        try { this.osc.stop(); } catch (e) {}
        try { this.osc.disconnect(); } catch (e) {}
        try { this.filterLFO.stop(); } catch (e) {}
        try { this.filterLFO.disconnect(); } catch (e) {}
        try { this.lfoGain.disconnect(); } catch (e) {}
        try { this.filter.disconnect(); } catch (e) {}
        try { this.sat.disconnect(); } catch (e) {}
        try { this.node.disconnect(); } catch (e) {}
    }
}

// Factory function to create pitch-tracking oscillators
export function createPitchTrackingOscillator(ctx, type, options = {}) {
    switch (type) {
        case 'harmonicOsc':
            return new HarmonicOscillator(ctx, options);
        case 'oddHarmonicOsc':
            return new OddHarmonicOscillator(ctx, options);
        case 'perfectOsc':
            return new PerfectOscillator(ctx, options);
        case 'additiveOsc':
            return new AdditiveOscillator(ctx, options);
        case 'fmOsc':
            return new FMOscillator(ctx, options);
        case 'bellOsc':
            return new BellOscillator(ctx, options);
        case 'phasingPair':
            return new PhasingPairOscillator(ctx, options);
        case 'formantOsc':
            return new FormantOscillator(ctx, options);
        case 'sineOsc':
            return new SimpleOscillator(ctx, { ...options, type: 'sine' });
        case 'sawOsc':
            return new SimpleOscillator(ctx, { ...options, type: 'sawtooth', gain: 0.2 });
        case 'squareOsc':
            return new SimpleOscillator(ctx, { ...options, type: 'square', gain: 0.15 });
        case 'triangleOsc':
            return new SimpleOscillator(ctx, { ...options, type: 'triangle', gain: 0.35 });
        // Buchla-inspired oscillators
        case 'buchlaComplex':
            return new BuchlaComplexOscillator(ctx, options);
        case 'buchlaLPG':
            return new BuchlaLPGOscillator(ctx, options);
        case 'buchlaBongo':
            return new BuchlaBongoOscillator(ctx, options);
        case 'sizzleOsc':
            return new SizzleOscillator(ctx, options);
        case 'westCoastDual':
            return new WestCoastDualOscillator(ctx, options);
        case 'vactrolOsc':
            return new VactrolOscillator(ctx, options);
        default:
            console.warn(`Unknown oscillator type: ${type}, falling back to sine`);
            return new SimpleOscillator(ctx, { ...options, type: 'sine' });
    }
}

// List of oscillator types that need pitch tracking
export const PITCH_TRACKING_OSCILLATORS = [
    'sineOsc',
    'sawOsc',
    'squareOsc',
    'triangleOsc',
    'harmonicOsc',
    'oddHarmonicOsc',
    'perfectOsc',
    'additiveOsc',
    'fmOsc',
    'bellOsc',
    'phasingPair',
    'formantOsc',
    // Buchla-inspired oscillators
    'buchlaComplex',
    'buchlaLPG',
    'buchlaBongo',
    'sizzleOsc',
    'westCoastDual',
    'vactrolOsc'
];
