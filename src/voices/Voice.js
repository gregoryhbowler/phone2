// VOICE CLASS
// Combines pitch bus, pattern engine, and audio modules into a playable voice
// Each voice is a complete trill/arpeggio instrument

import { PitchBus, createPitchBus } from '../engine/pitchBus.js';
import { PatternEngine, createPatternEngine } from '../engine/patternEngine.js';
import { MODULE_TYPES } from '../engine/modules.js';
import { createPitchTrackingOscillator, PITCH_TRACKING_OSCILLATORS } from '../engine/pitchTrackingOscillators.js';
import { midiToFreq } from '../engine/scales.js';

export class Voice {
    constructor(audioContext, masterOutput, voiceId, options = {}) {
        this.ctx = audioContext;
        this.masterOutput = masterOutput;
        this.id = voiceId;

        // Voice-specific settings
        this.name = options.name || `Voice ${voiceId}`;

        // Create pitch bus with callback for pitch changes
        this.pitchBus = createPitchBus(audioContext, {
            rootMidi: options.rootMidi || 48,
            scale: options.scale,
            rangeMin: options.rangeMin || 0,
            rangeMax: options.rangeMax || 14,
            glideTime: options.glideTime || 0.02,
            onPitchChange: (freq, midi, degree) => this._onPitchChange(freq, midi, degree)
        });

        // Create pattern engine
        this.pattern = createPatternEngine(this.pitchBus, options.patternPreset, options.patternConfig);

        // Audio chain
        this.modules = [];
        this.pitchTrackingOscs = []; // Oscillators that need manual pitch updates
        this.voiceGain = this.ctx.createGain();
        this.voiceGain.gain.value = options.volume || 0.7;

        // Envelope for note articulation
        this.envelope = this.ctx.createGain();
        this.envelope.gain.value = 0;

        // Connect envelope to voice output
        this.envelope.connect(this.voiceGain);
        this.voiceGain.connect(this.masterOutput);

        // Current note state
        this.isPlaying = false;
        this.currentNote = null;
        this.currentFreq = midiToFreq(options.rootMidi || 48);

        // Voice clock reference (set by engine)
        this.clock = null;

        // XY state for gesture control
        this.xyState = { x: 0.5, y: 0.5 };

        // Modulation targets
        this.modTargets = new Map();

        // Filter cutoff base value (for Y-axis modulation)
        this.filterCutoffBase = 2000;

        // Callback when patch changes (for UI sync)
        this.onPatchChange = null;

        // ADSR envelope parameters - supports very snappy attacks (1ms) to slow pads (2s)
        this.adsr = {
            attack: 0.01,    // 10ms default - snappy but click-free
            decay: 0.1,      // 100ms decay
            sustain: 0.7,    // 70% sustain level
            release: 0.3     // 300ms release
        };
    }

    // Called when pitch bus changes frequency
    _onPitchChange(freq, midi, degree) {
        this.currentFreq = freq;

        // Update all pitch-tracking oscillators
        for (const osc of this.pitchTrackingOscs) {
            osc.setFrequency(freq);
        }
    }

    // Build the voice's audio chain from module definitions
    buildPatch(patch) {
        // Cleanup existing modules
        this.cleanup();

        const chain = [];
        let lastNode = null;

        // Create oscillators using pitch-tracking wrappers
        for (const oscDef of patch.oscillators || []) {
            const typeName = typeof oscDef === 'string' ? oscDef : oscDef.type;

            let module;

            // Use pitch-tracking oscillators for melodic types
            if (PITCH_TRACKING_OSCILLATORS.includes(typeName)) {
                module = createPitchTrackingOscillator(this.ctx, typeName, {
                    baseFreq: this.currentFreq
                });
                this.pitchTrackingOscs.push(module);
            } else {
                // Fallback to original module creation for non-melodic
                module = this._createModule(typeName);
            }

            if (module) {
                if (lastNode) {
                    // Mix with previous oscillators - use higher gain to preserve level
                    const mixer = this.ctx.createGain();
                    mixer.gain.value = 0.7;
                    lastNode.connect(mixer);
                    module.node.connect(mixer);
                    lastNode = mixer;
                } else {
                    lastNode = module.node;
                }

                chain.push(module);
            }
        }

        // Create filters (if any)
        for (const filterDef of patch.filters || []) {
            const typeName = typeof filterDef === 'string' ? filterDef : filterDef.type;
            const module = this._createModule(typeName);
            if (module && lastNode) {
                lastNode.connect(module.node);
                lastNode = module.output || module.node;
                chain.push(module);

                // Register filter cutoff for modulation
                if (module.params.freq) {
                    this.modTargets.set('filterCutoff', module.params.freq);
                    this.filterCutoffBase = module.params.freq.value;
                }
            }
        }

        // Create effects (if any)
        for (const fxDef of patch.effects || []) {
            const typeName = typeof fxDef === 'string' ? fxDef : fxDef.type;
            const module = this._createModule(typeName);
            if (module && lastNode) {
                lastNode.connect(module.node);
                lastNode = module.output || module.node;
                chain.push(module);
            }
        }

        // Create modulators (connect to targets)
        for (const modDef of patch.modulators || []) {
            const typeName = typeof modDef === 'string' ? modDef : modDef.type;
            const module = this._createModule(typeName);
            if (module) {
                // Connect modulator to its target
                const targetName = (typeof modDef === 'object' && modDef.target) || 'filterCutoff';
                if (this.modTargets.has(targetName)) {
                    const target = this.modTargets.get(targetName);
                    module.node.connect(target);
                }
                chain.push(module);
            }
        }

        // Create spatial processors
        for (const spatialDef of patch.spatial || []) {
            const typeName = typeof spatialDef === 'string' ? spatialDef : spatialDef.type;
            // Extract parameters from definition (e.g., pan value for panner)
            const moduleParams = typeof spatialDef === 'object' ? { ...spatialDef } : {};
            delete moduleParams.type; // Remove type from params
            const module = this._createModule(typeName, moduleParams);
            if (module && lastNode) {
                lastNode.connect(module.node);
                lastNode = module.output || module.node;
                chain.push(module);
            }
        }

        // Connect final output to envelope
        if (lastNode) {
            lastNode.connect(this.envelope);
        }

        this.modules = chain;

        // Notify listeners that patch changed (for UI sync)
        if (this.onPatchChange) {
            this.onPatchChange(this);
        }
    }

    // Create a single module instance (for non-oscillator modules)
    _createModule(typeName, params = {}) {
        const moduleType = MODULE_TYPES[typeName];
        if (!moduleType) {
            console.warn(`Unknown module type: ${typeName}`);
            return null;
        }

        try {
            return moduleType.create(this.ctx, params);
        } catch (e) {
            console.error(`Failed to create module ${typeName}:`, e);
            return null;
        }
    }

    // Set the voice clock (called by engine)
    setClock(voiceClock) {
        this.clock = voiceClock;
        this.clock.onStep = (event) => this._onClockStep(event);
    }

    // Handle clock step
    _onClockStep(event) {
        if (!this.isPlaying) return;

        // Get next note from pattern
        const step = this.pattern.step(event.time);

        if (step.isRest) {
            // Schedule note off
            this._scheduleNoteOff(event.time);
        } else {
            // Schedule note
            this._scheduleNote(event.time, step.degree, event.duration * step.gateLength, step.accent);
        }
    }

    // Schedule a note at precise time with full ADSR envelope
    _scheduleNote(time, degree, duration, accent = 1) {
        // Update pitch (this triggers _onPitchChange which updates oscillators)
        this.pitchBus.setDegree(degree, true);

        const env = this.envelope.gain;
        const { attack, decay, sustain, release } = this.adsr;

        // Peak level based on accent
        const peak = Math.max(0.0001, accent);
        const sustainLevel = Math.max(0.0001, peak * sustain);

        // Click-free floor value (never use true 0 with exponential ramps)
        const floor = 0.0001;

        // Cancel any ongoing envelope
        env.cancelScheduledValues(time);

        // === ATTACK PHASE ===
        // Start from near-zero
        env.setValueAtTime(floor, time);

        if (attack < 0.005) {
            // Very fast attack (< 5ms): use setTargetAtTime for smooth, click-free rise
            // Time constant of attack/2 reaches ~86% in attack time
            env.setTargetAtTime(peak, time, Math.max(0.0005, attack * 0.5));
        } else {
            // Normal attack: exponential ramp
            env.exponentialRampToValueAtTime(peak, time + attack);
        }

        // === DECAY PHASE ===
        // Fall from peak to sustain level
        const decayStart = time + attack;
        if (decay < 0.005) {
            // Very fast decay: use setTargetAtTime
            env.setTargetAtTime(sustainLevel, decayStart, Math.max(0.0005, decay * 0.5));
        } else {
            // Normal decay: setTargetAtTime with time constant for smooth fall
            // Time constant of decay * 0.3 means we reach ~95% of target in decay time
            env.setTargetAtTime(sustainLevel, decayStart, decay * 0.3);
        }

        // === RELEASE PHASE ===
        // Calculate when release should start (end of note minus release time)
        const releaseStart = time + Math.max(0, duration - release);

        // Only schedule release if the note is long enough
        if (duration > attack + 0.01) {
            // Hold at sustain until release starts
            env.setValueAtTime(sustainLevel, releaseStart);

            if (release < 0.005) {
                // Very fast release: use setTargetAtTime
                env.setTargetAtTime(floor, releaseStart, Math.max(0.0005, release * 0.5));
            } else {
                // Normal release: smooth exponential fall
                env.setTargetAtTime(floor, releaseStart, release * 0.3);
            }
        }
    }

    // Schedule note off
    _scheduleNoteOff(time) {
        this.envelope.gain.cancelScheduledValues(time);
        this.envelope.gain.setTargetAtTime(0.0001, time, 0.02);
    }

    // Start playing (or resume)
    start() {
        this.isPlaying = true;
        // Don't reset pattern on resume - only reset on explicit clock reset
    }

    // Stop playing
    stop() {
        this.isPlaying = false;
        this.envelope.gain.cancelScheduledValues(this.ctx.currentTime);
        this.envelope.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }

    // Hard reset - called when clock resets
    hardReset() {
        this.pattern.reset();
        this.envelope.gain.cancelScheduledValues(this.ctx.currentTime);
        this.envelope.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.01);
    }

    // Set volume
    setVolume(volume) {
        this.voiceGain.gain.setTargetAtTime(
            Math.max(0, Math.min(1, volume)),
            this.ctx.currentTime,
            0.02
        );
    }

    // Set root note
    setRoot(midi) {
        this.pitchBus.setRoot(midi);
    }

    // Set scale
    setScale(scaleName) {
        this.pitchBus.setScale(scaleName);
    }

    // Set ADSR envelope parameters
    // attack/decay/release: time in seconds (0.001 - 4.0)
    // sustain: level 0-1
    setADSR(attack, decay, sustain, release) {
        this.adsr = {
            attack: Math.max(0.001, Math.min(4.0, attack)),
            decay: Math.max(0.001, Math.min(4.0, decay)),
            sustain: Math.max(0.0, Math.min(1.0, sustain)),
            release: Math.max(0.001, Math.min(4.0, release))
        };
    }

    // Set individual ADSR parameter
    setADSRParam(param, value) {
        if (param === 'attack') {
            this.adsr.attack = Math.max(0.001, Math.min(4.0, value));
        } else if (param === 'decay') {
            this.adsr.decay = Math.max(0.001, Math.min(4.0, value));
        } else if (param === 'sustain') {
            this.adsr.sustain = Math.max(0.0, Math.min(1.0, value));
        } else if (param === 'release') {
            this.adsr.release = Math.max(0.001, Math.min(4.0, value));
        }
    }

    // === MODULATION MACRO SYSTEM ===
    // Function generator style modulation inspired by Buchla/Serge
    // Affects amplitude and timbre without changing oscillator pitch

    // Set modulation amount (0-1) - scales all modulation depths
    setModulationAmount(amount) {
        this.modulationAmount = Math.max(0, Math.min(1, amount));

        // Scale all active modulators
        for (const modulator of this.activeModulators || []) {
            if (modulator.baseDepth !== undefined && modulator.depthParam) {
                const scaledDepth = modulator.baseDepth * this.modulationAmount;
                modulator.depthParam.setTargetAtTime(scaledDepth, this.ctx.currentTime, 0.05);
            }
        }
    }

    // Apply modulation settings from patch - FUNCTION GENERATOR STYLE
    applyModulation(modSettings) {
        if (!modSettings) return;

        // Clear existing modulators
        this._clearModulators();

        this.activeModulators = [];
        const amount = modSettings.amount !== undefined ? modSettings.amount : 0.5;
        this.modulationAmount = amount;

        console.log(`Voice ${this.id}: Applying FUNCTION GENERATOR modulation, amount=${amount}`);

        // ============================================
        // 1. INTERNAL VCA MODULATION (Buchla-style)
        // Modulate individual harmonic/partial gains within oscillators
        // This creates timbral shifts without pitch change
        // ============================================
        this._applyInternalVCAModulation(modSettings, amount);

        // ============================================
        // 2. FILTER CUTOFF MODULATION (aggressive sweep)
        // ============================================
        if (modSettings.settings?.filterMod && this.modTargets.has('filterCutoff')) {
            this._applyFilterCutoffModulation(modSettings.settings.filterMod, amount);
        }

        // ============================================
        // 3. FILTER Q/RESONANCE MODULATION (Serge-style)
        // Swept resonance creates dramatic timbral changes
        // ============================================
        if (modSettings.settings?.filterQMod || modSettings.settings?.filterMod) {
            this._applyFilterQModulation(modSettings.settings.filterQMod || modSettings.settings.filterMod, amount);
        }

        // ============================================
        // 4. PAN MODULATION (spatial movement)
        // ============================================
        if (modSettings.settings?.panMod) {
            this._applyPanModulation(modSettings.settings.panMod, amount);
        }

        // ============================================
        // 5. AMPLITUDE MODULATION (tremolo/VCA)
        // Multiple LFOs at different rates for complex patterns
        // ============================================
        this._applyComplexAmplitudeModulation(modSettings, amount);

        // ============================================
        // 6. FM INDEX MODULATION (for FM oscillators)
        // Changes brightness/timbre dramatically
        // ============================================
        this._applyFMIndexModulation(modSettings, amount);

        // ============================================
        // 7. WAVEFOLDER/SATURATION MODULATION
        // For Buchla-style oscillators
        // ============================================
        this._applyWavefolderModulation(modSettings, amount);

        console.log(`Voice ${this.id}: Total active modulators: ${this.activeModulators.length}`);
    }

    // Internal VCA modulation - modulate individual harmonic gains
    _applyInternalVCAModulation(modSettings, amount) {
        // Only apply if we have harmonic oscillators with gains arrays
        for (const ptOsc of this.pitchTrackingOscs) {
            if (!ptOsc.gains || ptOsc.gains.length < 2) continue;

            // Create different LFOs for different harmonics - this creates
            // spectral animation like a morphing wavetable
            const numHarmonics = ptOsc.gains.length;

            for (let i = 1; i < numHarmonics; i++) {
                const gain = ptOsc.gains[i];
                if (!gain || !gain.gain) continue;

                // Each harmonic gets a different rate - creates interference patterns
                const baseRate = 0.1 + (i * 0.07); // Harmonics modulate at different rates
                const lfo = this.ctx.createOscillator();
                lfo.type = i % 2 === 0 ? 'sine' : 'triangle'; // Mix waveforms
                lfo.frequency.value = baseRate * (1 + amount * 0.5);

                const lfoGain = this.ctx.createGain();
                // Store original gain value for restoration
                const originalGain = gain.gain.value;
                // Modulation depth varies by harmonic - higher harmonics modulate more
                const modDepth = originalGain * 0.6 * amount * (1 + i * 0.1);
                lfoGain.gain.value = modDepth;

                // Connect LFO to harmonic gain (bipolar modulation around current value)
                lfo.connect(lfoGain);
                lfoGain.connect(gain.gain);
                lfo.start();

                this.activeModulators.push({
                    osc: lfo,
                    gain: lfoGain,
                    baseDepth: modDepth,
                    depthParam: lfoGain.gain,
                    type: 'internalVCA',
                    harmonicIndex: i
                });
            }

            console.log(`Voice ${this.id}: Internal VCA mod on ${numHarmonics} harmonics`);
        }
    }

    // Filter cutoff modulation with complex LFO
    _applyFilterCutoffModulation(filterMod, amount) {
        const filterTarget = this.modTargets.get('filterCutoff');
        if (!filterTarget) return;

        // PRIMARY LFO - main sweep
        const lfo1 = this.ctx.createOscillator();
        lfo1.type = 'triangle';
        lfo1.frequency.value = filterMod.rate || 0.3;

        const lfoGain1 = this.ctx.createGain();
        const baseDepth1 = (filterMod.depth || 0.5) * 4000; // Wide sweep
        lfoGain1.gain.value = baseDepth1 * amount;

        lfo1.connect(lfoGain1);
        lfoGain1.connect(filterTarget);
        lfo1.start();

        this.activeModulators.push({
            osc: lfo1,
            gain: lfoGain1,
            baseDepth: baseDepth1,
            depthParam: lfoGain1.gain,
            type: 'filterCutoff'
        });

        // SECONDARY LFO - faster modulation for shimmer
        const lfo2 = this.ctx.createOscillator();
        lfo2.type = 'sine';
        lfo2.frequency.value = (filterMod.rate || 0.3) * 3.7; // Non-integer ratio for complexity

        const lfoGain2 = this.ctx.createGain();
        const baseDepth2 = baseDepth1 * 0.3; // Smaller contribution
        lfoGain2.gain.value = baseDepth2 * amount;

        lfo2.connect(lfoGain2);
        lfoGain2.connect(filterTarget);
        lfo2.start();

        this.activeModulators.push({
            osc: lfo2,
            gain: lfoGain2,
            baseDepth: baseDepth2,
            depthParam: lfoGain2.gain,
            type: 'filterCutoffSecondary'
        });

        console.log(`Voice ${this.id}: Filter cutoff mod active, sweep=${baseDepth1}Hz + ${baseDepth2}Hz shimmer`);
    }

    // Filter Q modulation - resonance sweeps for dramatic timbre changes
    _applyFilterQModulation(qMod, amount) {
        // Find filter with Q parameter
        for (const mod of this.modules) {
            if (mod.params?.Q) {
                const qTarget = mod.params.Q;
                const baseQ = qTarget.value || 1;

                // Slow sweep of resonance
                const qLfo = this.ctx.createOscillator();
                qLfo.type = 'sine';
                qLfo.frequency.value = (qMod?.rate || 0.15) * 0.5; // Very slow

                const qGain = this.ctx.createGain();
                // Sweep Q from low to high resonance
                const qDepth = Math.min(8, baseQ * 2) * (qMod?.depth || 0.5) * amount;
                qGain.gain.value = qDepth;

                qLfo.connect(qGain);
                qGain.connect(qTarget);
                qLfo.start();

                console.log(`Voice ${this.id}: Filter Q mod active, base=${baseQ}, depth=${qDepth}`);

                this.activeModulators.push({
                    osc: qLfo,
                    gain: qGain,
                    baseDepth: qDepth,
                    depthParam: qGain.gain,
                    type: 'filterQ'
                });
                break;
            }
        }
    }

    // Pan modulation
    _applyPanModulation(panMod, amount) {
        for (const mod of this.modules) {
            if (mod.params?.pan) {
                const panLfo = this.ctx.createOscillator();
                panLfo.type = 'sine';
                panLfo.frequency.value = panMod.rate || 0.1;

                const panGain = this.ctx.createGain();
                const baseDepth = (panMod.depth || 0.5) * 0.9;
                panGain.gain.value = baseDepth * amount;

                panLfo.connect(panGain);
                panGain.connect(mod.params.pan);
                panLfo.start();

                console.log(`Voice ${this.id}: Pan mod active, rate=${panLfo.frequency.value}, depth=${panGain.gain.value}`);

                this.activeModulators.push({
                    osc: panLfo,
                    gain: panGain,
                    baseDepth: baseDepth,
                    depthParam: panGain.gain,
                    type: 'pan'
                });
                break;
            }
        }
    }

    // Complex amplitude modulation with multiple LFOs
    _applyComplexAmplitudeModulation(modSettings, amount) {
        const ampMod = modSettings.settings?.ampMod;
        if (!ampMod && amount < 0.3) return; // Skip if no amp mod and low amount

        // PRIMARY TREMOLO - main amplitude variation
        const tremLfo1 = this.ctx.createOscillator();
        tremLfo1.type = 'sine';
        tremLfo1.frequency.value = ampMod?.rate || 2.5;

        const tremGain1 = this.ctx.createGain();
        const baseDepth1 = (ampMod?.depth || 0.25) * 0.4;
        tremGain1.gain.value = baseDepth1 * amount;

        tremLfo1.connect(tremGain1);
        tremGain1.connect(this.voiceGain.gain);
        tremLfo1.start();

        this.activeModulators.push({
            osc: tremLfo1,
            gain: tremGain1,
            baseDepth: baseDepth1,
            depthParam: tremGain1.gain,
            type: 'ampPrimary'
        });

        // SECONDARY TREMOLO - slower for breathing effect
        const tremLfo2 = this.ctx.createOscillator();
        tremLfo2.type = 'sine';
        tremLfo2.frequency.value = (ampMod?.rate || 2.5) * 0.23; // Non-integer ratio

        const tremGain2 = this.ctx.createGain();
        const baseDepth2 = baseDepth1 * 0.5;
        tremGain2.gain.value = baseDepth2 * amount;

        tremLfo2.connect(tremGain2);
        tremGain2.connect(this.voiceGain.gain);
        tremLfo2.start();

        this.activeModulators.push({
            osc: tremLfo2,
            gain: tremGain2,
            baseDepth: baseDepth2,
            depthParam: tremGain2.gain,
            type: 'ampSecondary'
        });

        // OFFSET to keep signal positive
        const offset = this.ctx.createConstantSource();
        const totalModDepth = tremGain1.gain.value + tremGain2.gain.value;
        offset.offset.value = 1 - totalModDepth * 0.5; // Compensate for bipolar LFOs
        offset.connect(this.voiceGain.gain);
        offset.start();

        this.activeModulators.push({
            source: offset,
            type: 'ampOffset'
        });

        console.log(`Voice ${this.id}: Complex amplitude mod active, depths=${baseDepth1}+${baseDepth2}`);
    }

    // FM index modulation - for FM oscillators, changes brightness dramatically
    _applyFMIndexModulation(modSettings, amount) {
        for (const ptOsc of this.pitchTrackingOscs) {
            // Check if this is an FM oscillator with modDepth param
            if (ptOsc.params?.modDepth || ptOsc.modGain?.gain) {
                const modDepthTarget = ptOsc.params?.modDepth || ptOsc.modGain?.gain;
                const baseModDepth = modDepthTarget.value;

                const fmLfo = this.ctx.createOscillator();
                fmLfo.type = 'triangle';
                fmLfo.frequency.value = 0.2 + amount * 0.3; // Slow sweep

                const fmGain = this.ctx.createGain();
                // Modulate the FM index significantly
                const fmModDepth = baseModDepth * 0.8 * amount;
                fmGain.gain.value = fmModDepth;

                fmLfo.connect(fmGain);
                fmGain.connect(modDepthTarget);
                fmLfo.start();

                console.log(`Voice ${this.id}: FM index mod active, base=${baseModDepth}, depth=${fmModDepth}`);

                this.activeModulators.push({
                    osc: fmLfo,
                    gain: fmGain,
                    baseDepth: fmModDepth,
                    depthParam: fmGain.gain,
                    type: 'fmIndex'
                });
            }
        }
    }

    // Wavefolder/saturation modulation for Buchla-style oscillators
    _applyWavefolderModulation(modSettings, amount) {
        for (const ptOsc of this.pitchTrackingOscs) {
            // Check for sizzle (high shelf gain) parameter
            if (ptOsc.params?.sizzle || ptOsc.sizzle?.gain) {
                const sizzleTarget = ptOsc.params?.sizzle || ptOsc.sizzle?.gain;
                const baseSizzle = sizzleTarget.value;

                const sizzleLfo = this.ctx.createOscillator();
                sizzleLfo.type = 'sine';
                sizzleLfo.frequency.value = 0.15 + amount * 0.2;

                const sizzleGain = this.ctx.createGain();
                const sizzleDepth = 4 * amount; // Modulate high shelf by +/- 4dB
                sizzleGain.gain.value = sizzleDepth;

                sizzleLfo.connect(sizzleGain);
                sizzleGain.connect(sizzleTarget);
                sizzleLfo.start();

                console.log(`Voice ${this.id}: Sizzle mod active, base=${baseSizzle}dB, depth=${sizzleDepth}dB`);

                this.activeModulators.push({
                    osc: sizzleLfo,
                    gain: sizzleGain,
                    baseDepth: sizzleDepth,
                    depthParam: sizzleGain.gain,
                    type: 'sizzle'
                });
            }

            // Check for filter frequency on LPG-style oscillators
            if (ptOsc.params?.filterFreq || ptOsc.lpg?.frequency) {
                const filterTarget = ptOsc.params?.filterFreq || ptOsc.lpg?.frequency;

                const filterLfo = this.ctx.createOscillator();
                filterLfo.type = 'triangle';
                filterLfo.frequency.value = 0.25 + amount * 0.35;

                const filterGain = this.ctx.createGain();
                const filterDepth = 1500 * amount; // Wide sweep
                filterGain.gain.value = filterDepth;

                filterLfo.connect(filterGain);
                filterGain.connect(filterTarget);
                filterLfo.start();

                console.log(`Voice ${this.id}: LPG filter mod active, depth=${filterDepth}Hz`);

                this.activeModulators.push({
                    osc: filterLfo,
                    gain: filterGain,
                    baseDepth: filterDepth,
                    depthParam: filterGain.gain,
                    type: 'lpgFilter'
                });
            }

            // Modulate internal filter Q on LPG oscillators
            if (ptOsc.params?.filterQ || ptOsc.lpg?.Q) {
                const qTarget = ptOsc.params?.filterQ || ptOsc.lpg?.Q;
                const baseQ = qTarget.value || 4;

                const qLfo = this.ctx.createOscillator();
                qLfo.type = 'sine';
                qLfo.frequency.value = 0.18;

                const qGain = this.ctx.createGain();
                const qDepth = baseQ * 0.5 * amount;
                qGain.gain.value = qDepth;

                qLfo.connect(qGain);
                qGain.connect(qTarget);
                qLfo.start();

                console.log(`Voice ${this.id}: LPG Q mod active, base=${baseQ}, depth=${qDepth}`);

                this.activeModulators.push({
                    osc: qLfo,
                    gain: qGain,
                    baseDepth: qDepth,
                    depthParam: qGain.gain,
                    type: 'lpgQ'
                });
            }
        }
    }

    // Clear active modulators
    _clearModulators() {
        for (const mod of this.activeModulators || []) {
            try {
                mod.osc?.stop();
                mod.osc?.disconnect();
                mod.gain?.disconnect();
                mod.source?.stop();
                mod.source?.disconnect();
            } catch (e) {
                // Ignore disposal errors
            }
        }
        this.activeModulators = [];
    }

    // Handle XY gesture input
    setXY(x, y) {
        const prevX = this.xyState.x;
        const prevY = this.xyState.y;
        this.xyState = { x, y };

        // === X-AXIS: Interval Spread / Harmonic Complexity ===
        // Low X = tight intervals (trill), High X = wide intervals (arpeggio)
        // Use larger threshold to prevent constant pattern regeneration which kills notes
        if (Math.abs(x - prevX) > 0.08) {
            // Don't use setComplexity - instead, directly control interval spread
            // This preserves the voice's harmonic role while varying texture
            const noteCount = 2 + Math.floor(x * 4); // 2-6 notes in pattern
            const maxSpread = Math.round(2 + x * 10); // 2-12 scale degrees

            // Build interval spread maintaining triadic feel
            const spread = [];
            for (let i = 0; i < noteCount; i++) {
                // Use triadic intervals (0, 2, 4, 7...) scaled by spread
                const triadicDegrees = [0, 2, 4, 7, 9, 11, 14];
                spread.push(Math.min(maxSpread, triadicDegrees[i % triadicDegrees.length]));
            }

            // Determine target pattern shape based on X region
            let targetShape;
            if (x < 0.25) {
                targetShape = 'trillStrict';
            } else if (x < 0.5) {
                targetShape = 'trillBiased';
            } else if (x < 0.75) {
                targetShape = 'threeNote';
            } else {
                targetShape = 'arpUpDown';
            }

            // Only update if shape or spread actually changed significantly
            // This prevents killing notes during small movements
            const currentSpread = this.pattern.intervalSpread;
            const spreadChanged = !currentSpread ||
                spread.length !== currentSpread.length ||
                spread.some((s, i) => Math.abs(s - (currentSpread[i] || 0)) > 1);
            const shapeChanged = this.pattern.patternShape !== targetShape;

            if (spreadChanged || shapeChanged) {
                // Use preservePosition flag to maintain playback continuity
                if (spreadChanged) {
                    this.pattern.setIntervalSpread(spread, true);
                }
                if (shapeChanged) {
                    this.pattern.setPatternShape(targetShape, true);
                }
            }
        }

        // === Y-AXIS: Rate / Trill Speed ===
        // Only update if Y changed enough to matter (prevents micro-jitter in timing)
        if (this.clock && Math.abs(y - prevY) > 0.01) {
            // Map Y to division: 0 = slow (0.5 = half notes), 1 = fast trill (4 = sixteenths)
            // At 144 BPM: 0.5 div = 1.2 Hz, 4 div = 9.6 Hz (actual trill territory)
            // Use exponential curve for more musical feel
            const minDiv = 0.5;
            const maxDiv = 4;
            const targetDivision = minDiv + Math.pow(y, 1.5) * (maxDiv - minDiv);

            // Smooth division changes to prevent timing glitches
            // Small changes are applied directly, large jumps are smoothed
            const currentDivision = this.clock.division;
            const divisionDelta = Math.abs(targetDivision - currentDivision);

            if (divisionDelta > 0.5) {
                // Large change - interpolate to prevent jarring timing shifts
                const smoothedDivision = currentDivision + (targetDivision - currentDivision) * 0.3;
                this.clock.setDivision(smoothedDivision);
            } else {
                this.clock.setDivision(targetDivision);
            }
        }

        // Gate length: longer at bottom (legato), shorter at top (staccato trill)
        // Only update on meaningful Y changes
        if (Math.abs(y - prevY) > 0.02) {
            const gateLength = 0.9 - y * 0.6; // 0.9 at bottom, 0.3 at top
            this.pattern.setGateLength(gateLength);
        }

        // === FILTER MODULATION ===
        // Y affects filter cutoff: brighter at top (more presence for fast trills)
        if (this.modTargets.has('filterCutoff')) {
            const cutoff = this.modTargets.get('filterCutoff');
            // Exponential curve from 800Hz to 6000Hz
            const targetCutoff = 800 * Math.pow(7.5, y);
            cutoff.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.03);
        }

        // === ACCENT INTENSITY ===
        // Higher Y = more pronounced accents (for rhythmic clarity at fast speeds)
        const accentStrength = 1.0 + y * 0.4; // 1.0 to 1.4
        this.pattern.accentStrength = accentStrength;
    }

    // Trigger a burst arpeggio (for flick gesture)
    triggerBurst() {
        if (!this.clock) return;

        // Temporarily increase speed
        const originalDivision = this.clock.division;
        this.clock.setDivision(originalDivision * 3);

        // Restore after 500ms
        setTimeout(() => {
            this.clock.setDivision(originalDivision);
        }, 500);
    }

    // Sustain current note (for long press)
    sustainNote(sustain) {
        if (sustain) {
            // Freeze pattern, hold current note
            this._sustainedGateLength = this.pattern.gateLength;
            this.pattern.setGateLength(1.0);
        } else {
            // Restore
            if (this._sustainedGateLength !== undefined) {
                this.pattern.setGateLength(this._sustainedGateLength);
            }
        }
    }

    // Get current state
    getState() {
        return {
            id: this.id,
            name: this.name,
            isPlaying: this.isPlaying,
            volume: this.voiceGain.gain.value,
            pitch: this.pitchBus.getState(),
            pattern: this.pattern.getState(),
            xy: this.xyState,
            currentFreq: this.currentFreq
        };
    }

    // Cleanup resources
    cleanup() {
        // CRITICAL: Clear active modulators FIRST (LFOs, tremolo, etc.)
        // These keep running and cause "stuck" sounds if not stopped
        this._clearModulators();

        // Dispose pitch-tracking oscillators (Buchla, Harmonic, FM, etc.)
        // These have internal LFOs and oscillators that must be stopped
        for (const osc of this.pitchTrackingOscs) {
            try {
                // Call dispose first to stop all internal oscillators/LFOs
                if (osc.dispose) osc.dispose();

                // Disconnect all nodes from audio graph
                if (osc.node) osc.node.disconnect();
                if (osc.outputNode) osc.outputNode.disconnect();
                if (osc.finalNode) osc.finalNode.disconnect(); // SizzleOscillator

                // Stop and disconnect internal oscillators that dispose might have missed
                // (in case dispose only calls stop() but not disconnect())
                if (osc.osc) { try { osc.osc.stop(); osc.osc.disconnect(); } catch (e) {} }
                if (osc.osc1) { try { osc.osc1.stop(); osc.osc1.disconnect(); } catch (e) {} }
                if (osc.osc2) { try { osc.osc2.stop(); osc.osc2.disconnect(); } catch (e) {} }
                if (osc.carrier) { try { osc.carrier.stop(); osc.carrier.disconnect(); } catch (e) {} }
                if (osc.modulator) { try { osc.modulator.stop(); osc.modulator.disconnect(); } catch (e) {} }
                if (osc.modOsc) { try { osc.modOsc.stop(); osc.modOsc.disconnect(); } catch (e) {} }
                if (osc.source) { try { osc.source.stop(); osc.source.disconnect(); } catch (e) {} }
                if (osc.click) { try { osc.click.stop(); osc.click.disconnect(); } catch (e) {} }

                // Internal modulation LFOs (Buchla LPG, Vactrol have these)
                if (osc.filterMod) { try { osc.filterMod.stop(); osc.filterMod.disconnect(); } catch (e) {} }
                if (osc.filterLFO) { try { osc.filterLFO.stop(); osc.filterLFO.disconnect(); } catch (e) {} }

                // Disconnect gains and filters
                if (osc.modGain) { try { osc.modGain.disconnect(); } catch (e) {} }
                if (osc.filterModGain) { try { osc.filterModGain.disconnect(); } catch (e) {} }
                if (osc.lfoGain) { try { osc.lfoGain.disconnect(); } catch (e) {} }
                if (osc.lpg) { try { osc.lpg.disconnect(); } catch (e) {} }
                if (osc.filter) { try { osc.filter.disconnect(); } catch (e) {} }
                if (osc.folder) { try { osc.folder.disconnect(); } catch (e) {} }
                if (osc.sizzle) { try { osc.sizzle.disconnect(); } catch (e) {} }
                if (osc.sat) { try { osc.sat.disconnect(); } catch (e) {} }

                // Arrays of oscillators (Harmonic, Additive, Bell, etc.)
                if (osc.oscillators) {
                    for (const subOsc of osc.oscillators) {
                        try {
                            if (subOsc.stop) subOsc.stop();
                            if (subOsc.disconnect) subOsc.disconnect();
                            if (subOsc.osc) { subOsc.osc.stop(); subOsc.osc.disconnect(); }
                        } catch (e) {}
                    }
                }
                if (osc.gains) {
                    for (const g of osc.gains) {
                        try { g.disconnect(); } catch (e) {}
                    }
                }
                if (osc.filters) {
                    for (const f of osc.filters) {
                        try { f.disconnect(); } catch (e) {}
                    }
                }
            } catch (e) {
                // Ignore disposal errors
            }
        }
        this.pitchTrackingOscs = [];

        // Stop and disconnect all other modules
        for (const module of this.modules) {
            try {
                // Disconnect from audio graph first
                if (module.node) module.node.disconnect();
                if (module.output) module.output.disconnect();

                if (module.dispose) {
                    module.dispose();
                } else {
                    // Stop oscillators
                    if (module.osc) {
                        try { module.osc.stop(); } catch (e) {}
                        try { module.osc.disconnect(); } catch (e) {}
                    }
                    if (module.oscs) {
                        for (const oscData of module.oscs) {
                            try {
                                if (oscData.stop) oscData.stop();
                                else if (oscData.osc && oscData.osc.stop) oscData.osc.stop();
                                if (oscData.disconnect) oscData.disconnect();
                                else if (oscData.osc && oscData.osc.disconnect) oscData.osc.disconnect();
                            } catch (e) {}
                        }
                    }
                    if (module.source) {
                        try { module.source.stop(); } catch (e) {}
                        try { module.source.disconnect(); } catch (e) {}
                    }
                    if (module.lfo) {
                        try { module.lfo.stop(); } catch (e) {}
                        try { module.lfo.disconnect(); } catch (e) {}
                    }
                    // Stop any internal modulation LFOs (Buchla oscillators have these)
                    if (module.filterMod) {
                        try { module.filterMod.stop(); } catch (e) {}
                        try { module.filterMod.disconnect(); } catch (e) {}
                    }
                    if (module.filterLFO) {
                        try { module.filterLFO.stop(); } catch (e) {}
                        try { module.filterLFO.disconnect(); } catch (e) {}
                    }
                    if (module.modOsc) {
                        try { module.modOsc.stop(); } catch (e) {}
                        try { module.modOsc.disconnect(); } catch (e) {}
                    }
                }
            } catch (e) {
                // Ignore disposal errors
            }
        }

        this.modules = [];
        this.modTargets.clear();
    }

    // Dispose voice completely
    dispose() {
        this.stop();
        this.cleanup();
        this.pitchBus.dispose();
        this.voiceGain.disconnect();
        this.envelope.disconnect();
    }
}

// Voice archetype presets - with proper patch definitions
export const VOICE_ARCHETYPES = {
    glassOrgan: {
        name: 'Glass Organ',
        patternPreset: 'triadic',
        patch: {
            oscillators: ['harmonicOsc'],
            filters: ['filterLP'],
            effects: ['tapeWobble', 'delayShort'],
            modulators: [{ type: 'lfoSmooth', target: 'filterCutoff' }],
            spatial: ['autoPanner']
        },
        rangeMin: 0,
        rangeMax: 14
    },

    barbieriLadder: {
        name: 'Barbieri Ladder',
        patternPreset: 'openVoicing',
        patch: {
            oscillators: ['perfectOsc'],
            filters: ['filterSVF'],
            effects: ['delayLong', 'tapeLoss'],
            modulators: [{ type: 'lfoGlacial', target: 'filterCutoff' }],
            spatial: ['panner']
        },
        rangeMin: -7,
        rangeMax: 21
    },

    fmShards: {
        name: 'FM Shards',
        patternPreset: 'simpleTrill',
        patch: {
            oscillators: ['fmOsc'],
            filters: ['filterHP', 'filterPeak'],
            effects: ['delayPingPong'],
            modulators: [],
            spatial: ['stereoWidener']
        },
        rangeMin: 7,
        rangeMax: 21
    },

    droneBase: {
        name: 'Drone Base',
        patternPreset: 'minimalTrill',
        patch: {
            oscillators: ['sineOsc', 'triangleOsc'],
            filters: ['filterLP'],
            effects: ['softClip'],
            modulators: [{ type: 'lfoGlacial', target: 'filterCutoff' }],
            spatial: ['panner']
        },
        rangeMin: -14,
        rangeMax: 7
    },

    bellTones: {
        name: 'Bell Tones',
        patternPreset: 'cascading',
        patch: {
            oscillators: ['bellOsc'],
            filters: ['filterBP'],
            effects: ['convolver'],
            modulators: [],
            spatial: ['autoPanner']
        },
        rangeMin: 7,
        rangeMax: 28
    }
};

// Factory function
export function createVoice(audioContext, masterOutput, voiceId, archetype = null, options = {}) {
    const archetypeConfig = archetype && VOICE_ARCHETYPES[archetype]
        ? VOICE_ARCHETYPES[archetype]
        : null;

    const voiceOptions = {
        ...options,
        ...(archetypeConfig ? {
            name: archetypeConfig.name,
            patternPreset: archetypeConfig.patternPreset,
            rangeMin: archetypeConfig.rangeMin,
            rangeMax: archetypeConfig.rangeMax
        } : {})
    };

    const voice = new Voice(audioContext, masterOutput, voiceId, voiceOptions);

    // Build patch if archetype provided
    if (archetypeConfig && archetypeConfig.patch) {
        voice.buildPatch(archetypeConfig.patch);
    }

    return voice;
}
