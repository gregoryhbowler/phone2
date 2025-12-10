// BUCHLA VOICE - 200-Series Inspired Voice Architecture
// FM Oscillator → LPG (Lowpass Gate) → Envelope → Output

import { createPitchBus } from '../engine/pitchBus.js';
import { createPatternEngine } from '../engine/patternEngine.js';

export class BuchlaVoice {
    constructor(ctx, output, id, options = {}) {
        this.ctx = ctx;
        this.masterOutput = output;
        this.id = id;

        // Pitch bus for scale-quantized pitch control
        this.pitchBus = null;

        // Pattern engine for sequencing
        this.patternEngine = null;

        // Current frequency
        this.currentFreq = 220;
        this.baseFreq = 220;

        // Audio nodes - FM Oscillator Section
        this.carrier = null;
        this.modulator = null;
        this.fmGain = null;

        // Audio nodes - Wavefolder Section
        this.wavefolderDrive = null;    // Pre-folder gain (drive)
        this.wavefolder = null;         // WaveShaperNode
        this.wavefolderMix = null;      // Wet/dry mix
        this.wavefolderDry = null;      // Dry path

        // Audio nodes - LPG Section
        this.lpgFilter = null;
        this.lpgVCA = null;

        // Audio nodes - Output Section
        this.outputGain = null;
        this.panner = null;

        // Voice parameters (user-controllable)
        this.params = {
            octave: 0,              // -2 to +2
            carrierType: 'sine',    // sine, triangle, sawtooth, square
            fmRatio: 2,             // 0.5 to 8
            fmIndex: 0.2,           // 0 to 1 (FM depth)
            foldAmount: 0,          // 0 to 1 (wavefolder drive/intensity)
            foldSymmetry: 0.5,      // 0 to 1 (fold symmetry - 0.5 = symmetric)
            lpgCutoff: 2000,        // 50 to 12000 Hz
            lpgResonance: 2,        // 0 to 20
            lpgResponse: 0.5,       // 0 to 1 (vactrol decay speed)
            attack: 0.005,          // 0.001 to 2 seconds
            decay: 0.2,             // 0.001 to 4 seconds
            envMode: 'trigger',     // gate, trigger, drone
            level: 0.8,             // 0 to 1
            pan: 0                  // -1 to 1
        };

        // AudioParam references for LFO modulation
        this.modulatableParams = {};

        // Mute state
        this.isMuted = false;

        // Options
        this.rootMidi = options.rootMidi || 48;
        this.scaleName = options.scaleName || 'major';
    }

    // Initialize the voice audio graph
    async initialize() {
        // Create pitch bus
        this.pitchBus = createPitchBus(this.ctx, {
            rootMidi: this.rootMidi,
            scaleName: this.scaleName
        });

        // Listen for pitch changes
        this.pitchBus.onPitchChange = (freq, midi, degree) => {
            this._onPitchChange(freq, midi, degree);
        };

        // Create pattern engine (requires pitchBus as first arg)
        this.patternEngine = createPatternEngine(this.pitchBus, null, {
            patternShape: 'trillStrict',
            baseDegree: 0,
            intervalSpread: [0, 2]
        });

        // Build the audio graph
        this._buildAudioGraph();

        return this;
    }

    // Build the complete audio signal chain
    _buildAudioGraph() {
        // === FM OSCILLATOR SECTION ===

        // Modulator oscillator (always sine for classic FM)
        this.modulator = this.ctx.createOscillator();
        this.modulator.type = 'sine';
        this.modulator.frequency.value = this.currentFreq * this.params.fmRatio;

        // FM depth control (modulator → fmGain → carrier.frequency)
        this.fmGain = this.ctx.createGain();
        this.fmGain.gain.value = this.currentFreq * this.params.fmIndex;

        // Carrier oscillator
        this.carrier = this.ctx.createOscillator();
        this.carrier.type = this.params.carrierType;
        this.carrier.frequency.value = this.currentFreq;

        // Connect FM: modulator → fmGain → carrier.frequency
        this.modulator.connect(this.fmGain);
        this.fmGain.connect(this.carrier.frequency);

        // === WAVEFOLDER SECTION ===
        // Buchla 259-style wavefolder adds harmonics by folding the waveform

        // Drive gain (pushes signal into folder)
        this.wavefolderDrive = this.ctx.createGain();
        this.wavefolderDrive.gain.value = 1; // Neutral, no folding initially

        // Wavefolder using WaveShaperNode
        this.wavefolder = this.ctx.createWaveShaper();
        this.wavefolder.curve = this._createFoldCurve(this.params.foldSymmetry);
        this.wavefolder.oversample = '2x'; // Reduce aliasing

        // Post-folder output (wet signal)
        this.wavefolderMix = this.ctx.createGain();
        this.wavefolderMix.gain.value = 0; // Start with no fold

        // Dry path bypass
        this.wavefolderDry = this.ctx.createGain();
        this.wavefolderDry.gain.value = 1; // Full dry signal

        // Wavefolder mixer output
        this.wavefolderOut = this.ctx.createGain();
        this.wavefolderOut.gain.value = 1;

        // === LPG SECTION (Lowpass Gate) ===
        // Combined filter + VCA that opens/closes together

        // Lowpass filter
        this.lpgFilter = this.ctx.createBiquadFilter();
        this.lpgFilter.type = 'lowpass';
        this.lpgFilter.frequency.value = 50; // Starts closed
        this.lpgFilter.Q.value = this.params.lpgResonance;

        // VCA (gain node that tracks filter)
        this.lpgVCA = this.ctx.createGain();
        this.lpgVCA.gain.value = 0.0001; // Starts closed

        // === OUTPUT SECTION ===

        // Output level control
        this.outputGain = this.ctx.createGain();
        this.outputGain.gain.value = this.params.level;

        // Stereo panner
        this.panner = this.ctx.createStereoPanner();
        this.panner.pan.value = this.params.pan;

        // === MODULATABLE CONTROL PARAMS ===
        // Create ConstantSourceNodes for params that aren't naturally AudioParams
        // This allows LFO modulation of octave, attack, decay

        // Octave modulation source (-2 to +2)
        // Connected to carrier.detune via octaveToDetuneGain (1 octave = 1200 cents)
        this.octaveSource = this.ctx.createConstantSource();
        this.octaveSource.offset.value = this.params.octave;
        this.octaveSource.start();

        // Scale octave to detune cents (octave * 1200 = cents)
        this.octaveToDetuneGain = this.ctx.createGain();
        this.octaveToDetuneGain.gain.value = 1200; // 1 octave = 1200 cents

        // Connect octave source to carrier detune for continuous modulation
        this.octaveSource.connect(this.octaveToDetuneGain);
        this.octaveToDetuneGain.connect(this.carrier.detune);
        // Also connect to modulator detune to keep FM ratio consistent
        this.octaveToDetuneGain.connect(this.modulator.detune);

        // Attack modulation source (0.001 to 2 seconds)
        this.attackSource = this.ctx.createConstantSource();
        this.attackSource.offset.value = this.params.attack;
        this.attackSource.start();

        // Decay modulation source (0.001 to 4 seconds)
        this.decaySource = this.ctx.createConstantSource();
        this.decaySource.offset.value = this.params.decay;
        this.decaySource.start();

        // === CONNECT THE CHAIN ===
        // Carrier → Wavefolder (wet/dry) → LPG Filter → LPG VCA → Output Gain → Panner → Master

        // Wavefolder wet path: carrier → drive → folder → wet mix → output
        this.carrier.connect(this.wavefolderDrive);
        this.wavefolderDrive.connect(this.wavefolder);
        this.wavefolder.connect(this.wavefolderMix);
        this.wavefolderMix.connect(this.wavefolderOut);

        // Wavefolder dry path: carrier → dry → output
        this.carrier.connect(this.wavefolderDry);
        this.wavefolderDry.connect(this.wavefolderOut);

        // Continue chain: wavefolder output → LPG → output
        this.wavefolderOut.connect(this.lpgFilter);
        this.lpgFilter.connect(this.lpgVCA);
        this.lpgVCA.connect(this.outputGain);
        this.outputGain.connect(this.panner);
        this.panner.connect(this.masterOutput);

        // Start oscillators
        this.carrier.start();
        this.modulator.start();

        // Store modulatable params for LFO targeting
        this.modulatableParams = {
            // Oscillator params
            carrierFreq: this.carrier.frequency,
            modulatorFreq: this.modulator.frequency,
            fmIndex: this.fmGain.gain,
            // Wavefolder params
            foldAmount: this.wavefolderDrive.gain,
            // LPG params
            lpgCutoff: this.lpgFilter.frequency,
            lpgResonance: this.lpgFilter.Q,
            // Envelope params (via ConstantSourceNode)
            octave: this.octaveSource.offset,
            attack: this.attackSource.offset,
            decay: this.decaySource.offset,
            // Output params
            level: this.outputGain.gain,
            pan: this.panner.pan
        };

        // If drone mode, open the gate
        if (this.params.envMode === 'drone') {
            this._openGate();
        }
    }

    // Handle pitch changes from pitch bus
    _onPitchChange(freq, midi, degree) {
        this.baseFreq = freq;
        this._updateFrequencies();
    }

    // Update all frequency-dependent values
    _updateFrequencies() {
        // Octave offset is now applied via detune (continuously modulatable)
        // So we just use baseFreq directly for frequency calculations
        this.currentFreq = this.baseFreq;

        // Update carrier frequency (octave shift handled by detune connection)
        if (this.carrier) {
            this.carrier.frequency.setTargetAtTime(
                this.currentFreq,
                this.ctx.currentTime,
                0.005
            );
        }

        // Update modulator frequency (carrier * ratio, octave shift via detune)
        if (this.modulator) {
            this.modulator.frequency.setTargetAtTime(
                this.currentFreq * this.params.fmRatio,
                this.ctx.currentTime,
                0.005
            );
        }

        // Update FM depth (scales with frequency for consistent timbre)
        if (this.fmGain) {
            this.fmGain.gain.setTargetAtTime(
                this.currentFreq * this.params.fmIndex,
                this.ctx.currentTime,
                0.005
            );
        }
    }

    // Schedule a note trigger from the clock
    scheduleNote(event) {
        if (this.isMuted) return;

        // step() advances the pattern and returns next step info
        const step = this.patternEngine.step(event.time);
        if (!step || step.isRest) return;

        // Update pitch via the pitch bus (degree -> frequency)
        this.pitchBus.setDegree(step.degree, true);

        // Trigger envelope based on mode
        this._trigger(event.time, event.duration * (step.gateLength || 0.8), step.accent || 1);
    }

    // Trigger the LPG envelope
    _trigger(time, duration, accent = 1) {
        const { lpgCutoff, lpgResponse, envMode } = this.params;
        // Read attack/decay from modulatable sources (allows LFO modulation)
        const attack = Math.max(0.001, this.attackSource?.offset.value ?? this.params.attack);
        const decay = Math.max(0.001, this.decaySource?.offset.value ?? this.params.decay);

        // Scale by accent
        const peakCutoff = lpgCutoff * accent;

        // Cancel any ongoing automation
        this.lpgFilter.frequency.cancelScheduledValues(time);
        this.lpgVCA.gain.cancelScheduledValues(time);

        if (envMode === 'drone') {
            // Drone mode - stay open
            return;
        }

        // Click-free floor values
        const cutoffFloor = 50;
        const gainFloor = 0.0001;

        // Calculate actual decay time based on response (vactrol character)
        // Higher response = slower, more organic decay
        const actualDecay = decay * (1 + lpgResponse * 2);

        // === ATTACK PHASE ===
        // Start from closed
        this.lpgFilter.frequency.setValueAtTime(cutoffFloor, time);
        this.lpgVCA.gain.setValueAtTime(gainFloor, time);

        if (attack < 0.005) {
            // Very fast attack - use setTargetAtTime for smoothness
            this.lpgFilter.frequency.setTargetAtTime(peakCutoff, time, attack * 0.5);
            this.lpgVCA.gain.setTargetAtTime(1, time, attack * 0.5);
        } else {
            // Normal attack - exponential ramp
            this.lpgFilter.frequency.exponentialRampToValueAtTime(peakCutoff, time + attack);
            this.lpgVCA.gain.exponentialRampToValueAtTime(1, time + attack);
        }

        // === DECAY/RELEASE PHASE ===
        const decayStart = time + attack;

        if (envMode === 'trigger') {
            // Trigger mode - always decay regardless of gate length
            this.lpgFilter.frequency.setTargetAtTime(cutoffFloor, decayStart, actualDecay * 0.3);
            this.lpgVCA.gain.setTargetAtTime(gainFloor, decayStart, actualDecay * 0.3);
        } else {
            // Gate mode - hold then release
            const holdTime = Math.max(0.01, duration - attack);
            const releaseStart = time + attack + holdTime;

            // Hold at peak
            this.lpgFilter.frequency.setValueAtTime(peakCutoff, releaseStart);
            this.lpgVCA.gain.setValueAtTime(1, releaseStart);

            // Then decay
            this.lpgFilter.frequency.setTargetAtTime(cutoffFloor, releaseStart, actualDecay * 0.3);
            this.lpgVCA.gain.setTargetAtTime(gainFloor, releaseStart, actualDecay * 0.3);
        }
    }

    // Open the gate (for drone mode)
    _openGate() {
        const now = this.ctx.currentTime;
        this.lpgFilter.frequency.setTargetAtTime(this.params.lpgCutoff, now, 0.05);
        this.lpgVCA.gain.setTargetAtTime(1, now, 0.05);
    }

    // Close the gate
    _closeGate() {
        const now = this.ctx.currentTime;
        this.lpgFilter.frequency.setTargetAtTime(50, now, 0.05);
        this.lpgVCA.gain.setTargetAtTime(0.0001, now, 0.05);
    }

    // Create wavefolder transfer function curve
    // Symmetry: 0 = negative bias, 0.5 = symmetric, 1 = positive bias
    _createFoldCurve(symmetry = 0.5) {
        const samples = 8192;
        const curve = new Float32Array(samples);

        // Number of folds (more = more harmonics)
        const folds = 4;

        for (let i = 0; i < samples; i++) {
            // Map index to -1 to 1 range
            let x = (i / (samples - 1)) * 2 - 1;

            // Apply symmetry offset (shifts the fold center)
            const offset = (symmetry - 0.5) * 0.5;
            x = x + offset;

            // Buchla-style wavefolder: sine-based folding
            // This creates smooth folds that add odd harmonics
            let y = Math.sin(x * Math.PI * folds);

            // Normalize output
            curve[i] = y * 0.8;
        }

        return curve;
    }

    // Update wavefolder wet/dry mix based on fold amount
    _updateFoldMix() {
        const amount = this.params.foldAmount;
        const now = this.ctx.currentTime;

        // Calculate drive (1 to 6 for more aggressive folding at high amounts)
        const drive = 1 + amount * 5;

        // Wet/dry crossfade
        const wetLevel = amount;
        const dryLevel = 1 - amount * 0.7; // Keep some dry signal for body

        if (this.wavefolderDrive) {
            this.wavefolderDrive.gain.setTargetAtTime(drive, now, 0.02);
        }
        if (this.wavefolderMix) {
            this.wavefolderMix.gain.setTargetAtTime(wetLevel, now, 0.02);
        }
        if (this.wavefolderDry) {
            this.wavefolderDry.gain.setTargetAtTime(dryLevel, now, 0.02);
        }
    }

    // === PARAMETER SETTERS ===

    setParam(name, value) {
        switch (name) {
            case 'octave':
                this.params.octave = Math.max(-2, Math.min(2, Math.round(value)));
                if (this.octaveSource) {
                    // Octave is now continuously applied via detune connection
                    this.octaveSource.offset.value = this.params.octave;
                }
                break;

            case 'carrierType':
                this.params.carrierType = value;
                if (this.carrier) {
                    this.carrier.type = value;
                }
                break;

            case 'fmRatio':
                this.params.fmRatio = Math.max(0.5, Math.min(8, value));
                this._updateFrequencies();
                break;

            case 'fmIndex':
                this.params.fmIndex = Math.max(0, Math.min(1, value));
                this._updateFrequencies();
                break;

            case 'foldAmount':
                this.params.foldAmount = Math.max(0, Math.min(1, value));
                this._updateFoldMix();
                break;

            case 'foldSymmetry':
                this.params.foldSymmetry = Math.max(0, Math.min(1, value));
                // Regenerate the fold curve with new symmetry
                if (this.wavefolder) {
                    this.wavefolder.curve = this._createFoldCurve(this.params.foldSymmetry);
                }
                break;

            case 'lpgCutoff':
                this.params.lpgCutoff = Math.max(50, Math.min(12000, value));
                // If in drone mode, update immediately
                if (this.params.envMode === 'drone' && this.lpgFilter) {
                    this.lpgFilter.frequency.setTargetAtTime(
                        this.params.lpgCutoff,
                        this.ctx.currentTime,
                        0.02
                    );
                }
                break;

            case 'lpgResonance':
                this.params.lpgResonance = Math.max(0, Math.min(20, value));
                if (this.lpgFilter) {
                    this.lpgFilter.Q.setTargetAtTime(
                        this.params.lpgResonance,
                        this.ctx.currentTime,
                        0.02
                    );
                }
                break;

            case 'lpgResponse':
                this.params.lpgResponse = Math.max(0, Math.min(1, value));
                break;

            case 'attack':
                this.params.attack = Math.max(0.001, Math.min(2, value));
                if (this.attackSource) {
                    this.attackSource.offset.value = this.params.attack;
                }
                break;

            case 'decay':
                this.params.decay = Math.max(0.001, Math.min(4, value));
                if (this.decaySource) {
                    this.decaySource.offset.value = this.params.decay;
                }
                break;

            case 'envMode':
                const oldMode = this.params.envMode;
                this.params.envMode = value;
                // Handle mode transitions
                if (value === 'drone' && oldMode !== 'drone') {
                    this._openGate();
                } else if (value !== 'drone' && oldMode === 'drone') {
                    this._closeGate();
                }
                break;

            case 'level':
                this.params.level = Math.max(0, Math.min(1, value));
                if (this.outputGain) {
                    this.outputGain.gain.setTargetAtTime(
                        this.params.level,
                        this.ctx.currentTime,
                        0.02
                    );
                }
                break;

            case 'pan':
                this.params.pan = Math.max(-1, Math.min(1, value));
                if (this.panner) {
                    this.panner.pan.setTargetAtTime(
                        this.params.pan,
                        this.ctx.currentTime,
                        0.02
                    );
                }
                break;
        }
    }

    // Get all params for state serialization
    getParams() {
        return { ...this.params };
    }

    // Set all params at once
    setParams(params) {
        for (const [name, value] of Object.entries(params)) {
            this.setParam(name, value);
        }
    }

    // === PITCH CONTROL ===

    setRoot(midi) {
        this.pitchBus.setRoot(midi);
    }

    setScale(scaleName) {
        this.pitchBus.setScale(scaleName);
    }

    // === MUTE CONTROL ===

    setMuted(muted) {
        this.isMuted = muted;
        if (muted && this.params.envMode === 'drone') {
            this._closeGate();
        } else if (!muted && this.params.envMode === 'drone') {
            this._openGate();
        }
    }

    // === PATTERN CONTROL ===

    setPatternDensity(density) {
        this.patternEngine.setDensity(density);
    }

    randomizePattern() {
        this.patternEngine.randomize();
    }

    // === COPY VOICE SETTINGS ===

    copyFrom(sourceVoice) {
        this.setParams(sourceVoice.getParams());
        // Copy pattern as well
        if (sourceVoice.patternEngine && this.patternEngine) {
            const sourcePattern = sourceVoice.patternEngine.getPattern();
            this.patternEngine.setPattern(sourcePattern);
        }
    }

    // === MODULATABLE PARAM ACCESS (for LFOs) ===

    getModulatableParam(name) {
        return this.modulatableParams[name] || null;
    }

    getModulatableParamList() {
        return [
            // Oscillator destinations
            { id: `v${this.id}_carrierFreq`, label: `V${this.id + 1} Pitch`, param: this.modulatableParams.carrierFreq, range: { min: 20, max: 2000 } },
            { id: `v${this.id}_modulatorFreq`, label: `V${this.id + 1} Mod Freq`, param: this.modulatableParams.modulatorFreq, range: { min: 20, max: 4000 } },
            { id: `v${this.id}_fmIndex`, label: `V${this.id + 1} FM Index`, param: this.modulatableParams.fmIndex, range: { min: 0, max: 1000 } },
            { id: `v${this.id}_octave`, label: `V${this.id + 1} Octave`, param: this.modulatableParams.octave, range: { min: -2, max: 2 } },
            // Wavefolder destinations
            { id: `v${this.id}_foldAmount`, label: `V${this.id + 1} Fold`, param: this.modulatableParams.foldAmount, range: { min: 1, max: 6 } },
            // LPG destinations
            { id: `v${this.id}_lpgCutoff`, label: `V${this.id + 1} LPG Cut`, param: this.modulatableParams.lpgCutoff, range: { min: 50, max: 12000 } },
            { id: `v${this.id}_lpgResonance`, label: `V${this.id + 1} LPG Res`, param: this.modulatableParams.lpgResonance, range: { min: 0, max: 20 } },
            // Envelope destinations
            { id: `v${this.id}_attack`, label: `V${this.id + 1} Attack`, param: this.modulatableParams.attack, range: { min: 0.001, max: 2 } },
            { id: `v${this.id}_decay`, label: `V${this.id + 1} Decay`, param: this.modulatableParams.decay, range: { min: 0.001, max: 4 } },
            // Output destinations
            { id: `v${this.id}_level`, label: `V${this.id + 1} Level`, param: this.modulatableParams.level, range: { min: 0, max: 1 } },
            { id: `v${this.id}_pan`, label: `V${this.id + 1} Pan`, param: this.modulatableParams.pan, range: { min: -1, max: 1 } }
        ];
    }

    // === XY PAD CONTROL ===

    // X-axis typically controls filter/brightness
    setXPosition(x) {
        // Map X (0-1) to LPG cutoff
        const cutoff = 50 + x * 11950; // 50 to 12000
        this.setParam('lpgCutoff', cutoff);
    }

    // Y-axis typically controls FM depth/timbre
    setYPosition(y) {
        // Map Y (0-1) to FM index
        const index = y * 0.8; // 0 to 0.8
        this.setParam('fmIndex', index);
    }

    // === CLEANUP ===

    dispose() {
        try {
            // Stop oscillators
            if (this.carrier) {
                this.carrier.stop();
                this.carrier.disconnect();
            }
            if (this.modulator) {
                this.modulator.stop();
                this.modulator.disconnect();
            }

            // Stop and disconnect modulation sources
            if (this.octaveSource) {
                this.octaveSource.stop();
                this.octaveSource.disconnect();
            }
            if (this.octaveToDetuneGain) {
                this.octaveToDetuneGain.disconnect();
            }
            if (this.attackSource) {
                this.attackSource.stop();
                this.attackSource.disconnect();
            }
            if (this.decaySource) {
                this.decaySource.stop();
                this.decaySource.disconnect();
            }

            // Disconnect all nodes
            if (this.fmGain) this.fmGain.disconnect();
            if (this.wavefolderDrive) this.wavefolderDrive.disconnect();
            if (this.wavefolder) this.wavefolder.disconnect();
            if (this.wavefolderMix) this.wavefolderMix.disconnect();
            if (this.wavefolderDry) this.wavefolderDry.disconnect();
            if (this.wavefolderOut) this.wavefolderOut.disconnect();
            if (this.lpgFilter) this.lpgFilter.disconnect();
            if (this.lpgVCA) this.lpgVCA.disconnect();
            if (this.outputGain) this.outputGain.disconnect();
            if (this.panner) this.panner.disconnect();

        } catch (e) {
            // Ignore disposal errors
        }

        this.carrier = null;
        this.modulator = null;
        this.octaveSource = null;
        this.octaveToDetuneGain = null;
        this.attackSource = null;
        this.decaySource = null;
        this.fmGain = null;
        this.wavefolderDrive = null;
        this.wavefolder = null;
        this.wavefolderMix = null;
        this.wavefolderDry = null;
        this.wavefolderOut = null;
        this.lpgFilter = null;
        this.lpgVCA = null;
        this.outputGain = null;
        this.panner = null;
        this.modulatableParams = {};
    }
}

// Factory function
export function createBuchlaVoice(ctx, output, id, options = {}) {
    return new BuchlaVoice(ctx, output, id, options);
}
