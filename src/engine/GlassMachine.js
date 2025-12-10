// GLASS MACHINE ENGINE
// Main orchestrator with Buchla 200-series inspired voices
// Three voices, shared harmonic field, polymetric clocks, gesture control

import { createClockSystem, POLYMETRIC_PRESETS, PHASE_PRESETS } from './clockSystem.js';
import { SCALES } from './scales.js';
import { createBuchlaVoice } from '../voices/BuchlaVoice.js';
import { createLFOBank } from './LFOBank.js';
import { createSendBus } from '../effects/SendBus.js';
import { createInsertBus } from '../effects/InsertBus.js';

export class GlassMachine {
    constructor(options = {}) {
        // Audio context (created on user interaction)
        this.ctx = null;
        this.isInitialized = false;

        // Master output chain
        this.masterGain = null;
        this.masterLimiter = null;
        this.masterAnalyser = null;

        // Insert effects bus (Data Bender - processes all voices before send)
        this.insertBus = null;

        // Send effects bus (Nautilus delay, Basil delay)
        this.sendBus = null;

        // Clock system
        this.clock = null;

        // Three Buchla voices
        this.voices = [];

        // Global LFO bank (12 LFOs with 2 destinations each)
        this.lfoBank = null;

        // Shared harmonic state
        this.rootMidi = options.rootMidi || 48; // C3
        this.scaleName = options.scaleName || 'major';

        // Master settings
        this.masterVolume = options.masterVolume || 0.8;
        this.bpm = options.bpm || 120;

        // Polymetric preset
        this.polymetricPreset = options.polymetricPreset || 'glassCascade';
        this.phasePreset = options.phasePreset || 'ripple';

        // Transposition sequencer
        this.transposeSequence = [0, 0, 0, 0, 0, 0, 0, 0]; // 8 steps, scale degrees
        this.transposeStepCount = 8; // Active number of steps (1-8)
        this.transposeBarsPerStep = 2;
        this.currentTransposeStep = 0;
        this.transposeOffset = 0;
        this.lastTransposeBar = -1;

        // Event callbacks
        this.onStateChange = options.onStateChange || null;
        this.onBeat = options.onBeat || null;
        this.onTransposeStep = options.onTransposeStep || null;
    }

    // Initialize audio (must be called from user gesture)
    async initialize() {
        if (this.isInitialized) return;

        // Create audio context
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Resume if suspended
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        // Create master output chain
        this._createMasterChain();

        // Create clock system
        this.clock = createClockSystem(this.ctx, {
            bpm: this.bpm,
            beatsPerBar: 4,
            alignmentBars: 4,
            onBar: (bar) => this._onBar(bar)
        });

        // Start transpose sequencer update loop
        this._startTransposeLoop();

        // Create three Buchla voices
        await this._createVoices();

        // Apply polymetric settings
        this._applyPolymetricPreset();

        // Create global LFO bank
        this.lfoBank = createLFOBank(this.ctx, 12);
        this.lfoBank.setBPM(this.bpm);
        this._refreshLFODestinations();

        // Load insert effects (Data Bender and Arbhar)
        try {
            await this.insertBus.loadDataBender();
            this.insertBus.setBPM(this.bpm);
        } catch (error) {
            console.warn('GlassMachine: Failed to load Data Bender:', error);
        }

        try {
            await this.insertBus.loadArbhar();
        } catch (error) {
            console.warn('GlassMachine: Failed to load Arbhar:', error);
        }

        try {
            await this.insertBus.loadMorphagene();
        } catch (error) {
            console.warn('GlassMachine: Failed to load Morphagene:', error);
        }

        try {
            await this.insertBus.loadLubadh();
        } catch (error) {
            console.warn('GlassMachine: Failed to load Lubadh:', error);
        }

        // Load send effects (Nautilus, Basil delays, FDNR reverb)
        try {
            await this.sendBus.loadAllEffects();
            this.sendBus.setBPM(this.bpm);

            // Connect insert bus send output to send bus
            // This allows processed insert signals to be routed to reverb/delay
            this.sendBus.connectInsertBus(this.insertBus);
        } catch (error) {
            console.warn('GlassMachine: Failed to load send effects:', error);
        }

        this.isInitialized = true;
        this._triggerStateChange();

        return this;
    }

    // Create master output chain
    _createMasterChain() {
        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.masterVolume;

        // Create insert effects bus (Data Bender)
        // Signal chain: Voices → InsertBus → SendBus → Master
        this.insertBus = createInsertBus(this.ctx);

        // Create send effects bus (Nautilus, Basil)
        this.sendBus = createSendBus(this.ctx);

        // Master limiter
        this.masterLimiter = this.ctx.createDynamicsCompressor();
        this.masterLimiter.threshold.value = -3;
        this.masterLimiter.knee.value = 0;
        this.masterLimiter.ratio.value = 20;
        this.masterLimiter.attack.value = 0.001;
        this.masterLimiter.release.value = 0.1;

        // Analyser for visualizations
        this.masterAnalyser = this.ctx.createAnalyser();
        this.masterAnalyser.fftSize = 256;

        // INSERT EFFECT ROUTING (like a guitar pedal before the mixer)
        // Signal chain: Voices → InsertBus (Data Bender) → masterGain → output
        //                                              ↘ SendBus (delays) → masterGain
        //
        // InsertBus output is the ONLY path to master for the dry/processed signal
        // SendBus receives a tap from InsertBus for delay sends

        // Main signal path: InsertBus → masterGain
        this.insertBus.output.connect(this.masterGain);

        // Send bus tap: InsertBus → SendBus voice input 0 → delay effects → masterGain
        // This allows the (possibly processed) signal to feed the delay sends
        this.insertBus.output.connect(this.sendBus.getVoiceInput(0));

        // Delay returns mix back to master
        this.sendBus.output.connect(this.masterGain);

        // Connect chain
        this.masterGain.connect(this.masterLimiter);
        this.masterLimiter.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.ctx.destination);
    }

    // Create the three Buchla voices
    async _createVoices() {
        // Voice configurations for Glass-style triadic texture
        // Voice 0: ROOT - Lower register, foundational
        // Voice 1: THIRD - Middle register, fills harmony
        // Voice 2: FIFTH - Upper register, sparkle
        const voiceConfigs = [
            {
                name: 'Root Voice',
                octave: -1,          // One octave down
                division: 1,         // Quarter notes
                phaseOffset: 0,
                pan: -0.4,           // Left
                fmRatio: 2,
                fmIndex: 0.15,
                lpgCutoff: 1500,
                envMode: 'gate'
            },
            {
                name: 'Third Voice',
                octave: 0,           // Middle
                division: 1.5,       // Dotted quarter (2:3 polyrhythm)
                phaseOffset: 0.25,
                pan: 0,              // Center
                fmRatio: 3,
                fmIndex: 0.2,
                lpgCutoff: 2500,
                envMode: 'gate'
            },
            {
                name: 'Fifth Voice',
                octave: 0,           // Same octave but higher notes from pattern
                division: 2,         // Eighth notes
                phaseOffset: 0.125,
                pan: 0.4,            // Right
                fmRatio: 4,
                fmIndex: 0.25,
                lpgCutoff: 3500,
                envMode: 'trigger'   // Pluckier
            }
        ];

        for (let i = 0; i < 3; i++) {
            const config = voiceConfigs[i];

            // Create Buchla voice
            // Pass InsertBus voice input as the output destination (not masterGain!)
            // This ensures the ONLY path to master is through InsertBus
            const insertInput = this.insertBus.getVoiceInput(i);
            const voice = createBuchlaVoice(
                this.ctx,
                insertInput,  // Voice connects here, NOT directly to masterGain
                i,
                {
                    rootMidi: this.rootMidi,
                    scaleName: this.scaleName
                }
            );

            await voice.initialize();

            // Apply initial parameters
            voice.setParam('octave', config.octave);
            voice.setParam('fmRatio', config.fmRatio);
            voice.setParam('fmIndex', config.fmIndex);
            voice.setParam('lpgCutoff', config.lpgCutoff);
            voice.setParam('pan', config.pan);
            voice.setParam('envMode', config.envMode);

            // Configure pattern for voice role
            const baseDegrees = [0, 2, 4]; // Root, third, fifth
            voice.patternEngine.setBaseDegree(baseDegrees[i]);

            // Set pattern intervals based on role
            const intervalSpreads = [
                [0, 2, 4, 7],  // Root: triadic with octave
                [0, 2, 4],     // Third: tight triadic
                [0, 2]         // Fifth: tight trill
            ];
            voice.patternEngine.setIntervalSpread(intervalSpreads[i]);

            // Create voice clock with polymetric relationship
            const voiceClock = this.clock.registerVoice(i, {
                division: config.division,
                phaseOffset: config.phaseOffset,
                accentPattern: i === 0 ? [1.2, 0.8, 1.0, 0.8] :
                              i === 1 ? [1.0, 0.9, 1.1, 0.9, 1.0, 0.9] :
                                       [1.0, 0.8]
            });

            // Connect voice to clock (callback is onStep, not onNote)
            voiceClock.onStep = (event) => voice.scheduleNote(event);
            voice.clock = voiceClock;

            this.voices.push(voice);
        }
    }

    // Refresh LFO destinations from all voices
    _refreshLFODestinations() {
        if (!this.lfoBank) return;

        const destinations = [];
        for (const voice of this.voices) {
            const voiceParams = voice.getModulatableParamList();
            destinations.push(...voiceParams);
        }
        this.lfoBank.setAvailableDestinations(destinations);
    }

    // Apply polymetric preset to all voices
    _applyPolymetricPreset() {
        const divisions = POLYMETRIC_PRESETS[this.polymetricPreset] || [1, 1, 1];
        const phases = PHASE_PRESETS[this.phasePreset] || [0, 0, 0];

        const baseDivisions = [1, 1.5, 2];

        for (let i = 0; i < this.voices.length; i++) {
            if (this.voices[i].clock) {
                const baseDivision = baseDivisions[i];
                const presetMultiplier = divisions[i];
                this.voices[i].clock.setDivision(baseDivision * presetMultiplier);
                this.voices[i].clock.setPhaseOffset(phases[i]);
            }
        }
    }

    // Start playback
    async start() {
        if (!this.isInitialized) return;

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.clock.start();
        this._triggerStateChange();
    }

    // Stop playback
    stop() {
        if (!this.isInitialized) return;
        this.clock.stop();
        this._triggerStateChange();
    }

    // Toggle playback
    async toggle() {
        if (this.clock?.isRunning) {
            this.stop();
        } else {
            await this.start();
        }
    }

    // Reset to beginning
    reset() {
        if (!this.isInitialized) return;
        this.clock?.reset();
        this.resetTranspose();
        this._triggerStateChange();
    }

    // === HARMONIC CONTROLS ===

    setRoot(midi) {
        this.rootMidi = midi;
        for (const voice of this.voices) {
            voice.setRoot(midi);
        }
        this._triggerStateChange();
    }

    transpose(semitones) {
        this.setRoot(this.rootMidi + semitones);
    }

    setScale(scaleName) {
        if (SCALES[scaleName]) {
            this.scaleName = scaleName;
            for (const voice of this.voices) {
                voice.setScale(scaleName);
            }
            this._triggerStateChange();
        }
    }

    // === TEMPO CONTROLS ===

    setBpm(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
        this.clock?.setBpm(this.bpm);
        this.lfoBank?.setBPM(this.bpm);
        this.insertBus?.setBPM(this.bpm);
        this.sendBus?.setBPM(this.bpm);
        this._triggerStateChange();
    }

    tapTempo(tapTime) {
        if (!this._lastTapTime) {
            this._lastTapTime = tapTime;
            this._tapHistory = [];
            return;
        }

        const interval = tapTime - this._lastTapTime;
        this._lastTapTime = tapTime;

        if (interval > 2000) {
            this._tapHistory = [];
            return;
        }

        this._tapHistory.push(interval);
        if (this._tapHistory.length > 4) {
            this._tapHistory.shift();
        }

        const avgInterval = this._tapHistory.reduce((a, b) => a + b, 0) / this._tapHistory.length;
        const bpm = Math.round(60000 / avgInterval);
        this.setBpm(bpm);
    }

    // === VOICE CONTROLS ===

    // Set a Buchla voice parameter
    setVoiceParam(voiceId, paramName, value) {
        const voice = this.voices[voiceId];
        if (voice) {
            voice.setParam(paramName, value);
        }
    }

    // Get voice parameters
    getVoiceParams(voiceId) {
        const voice = this.voices[voiceId];
        return voice ? voice.getParams() : null;
    }

    // Handle XY pad input for a voice
    setVoiceXY(voiceId, x, y) {
        const voice = this.voices[voiceId];
        if (voice) {
            voice.setXPosition(x);
            voice.setYPosition(y);
        }
    }

    // Mute/unmute a voice
    setVoiceMuted(voiceId, muted) {
        const voice = this.voices[voiceId];
        if (voice) {
            voice.setMuted(muted);
            if (voice.clock) {
                voice.clock.setMuted(muted);
            }
        }
    }

    // Copy voice settings
    copyVoice(sourceId, targetIds) {
        const source = this.voices[sourceId];
        if (!source) return;

        for (const targetId of targetIds) {
            if (targetId === sourceId) continue;
            const target = this.voices[targetId];
            if (target) {
                target.copyFrom(source);
            }
        }

        this._triggerStateChange();
    }

    copyVoiceToAll(sourceId) {
        const targetIds = [0, 1, 2].filter(id => id !== sourceId);
        this.copyVoice(sourceId, targetIds);
    }

    // === SEND EFFECT CONTROLS ===

    // Set send amount for a voice to a specific effect (0-1)
    setVoiceSendAmount(voiceId, effectType, amount) {
        // If only 2 args, assume legacy call for nautilus
        if (amount === undefined) {
            amount = effectType;
            effectType = 'nautilus';
        }
        this.sendBus?.setVoiceSendAmount(voiceId, effectType, amount);
    }

    // Get send amount for a voice to a specific effect
    getVoiceSendAmount(voiceId, effectType = 'nautilus') {
        return this.sendBus?.getVoiceSendAmount(voiceId, effectType) || 0;
    }

    // Set send amount for a voice to Nautilus specifically
    setVoiceNautilusSend(voiceId, amount) {
        this.sendBus?.setVoiceSendAmount(voiceId, 'nautilus', amount);
    }

    // Set send amount for a voice to Basil specifically
    setVoiceBasilSend(voiceId, amount) {
        this.sendBus?.setVoiceSendAmount(voiceId, 'basil', amount);
    }

    // Get the current send effect (Nautilus - legacy)
    getSendEffect() {
        return this.sendBus?.getEffect('nautilus');
    }

    // Set a parameter on the send effect
    setSendEffectParam(name, value) {
        const effect = this.sendBus?.getEffect('nautilus');
        if (effect?.setParam) {
            effect.setParam(name, value);
        }
    }

    // Get all send effect parameters
    getSendEffectParams() {
        const effect = this.sendBus?.getEffect('nautilus');
        return effect?.getParams?.() || null;
    }

    // Set delay mode on send effect
    setSendEffectDelayMode(mode) {
        const effect = this.sendBus?.getEffect('nautilus');
        if (effect?.setDelayMode) {
            effect.setDelayMode(mode);
        }
    }

    // Set feedback mode on send effect
    setSendEffectFeedbackMode(mode) {
        const effect = this.sendBus?.getEffect('nautilus');
        if (effect?.setFeedbackMode) {
            effect.setFeedbackMode(mode);
        }
    }

    // Freeze the send effect buffer
    freezeSendEffect(active) {
        const effect = this.sendBus?.getEffect('nautilus');
        if (effect?.freeze) {
            effect.freeze(active);
        }
    }

    // Purge (clear) send effect buffers
    purgeSendEffect() {
        const effect = this.sendBus?.getEffect('nautilus');
        if (effect?.purge) {
            effect.purge();
        }
    }

    // Set master return level (effect output volume)
    setReturnLevel(level) {
        this.sendBus?.setReturnLevel(level);
    }

    // === BASIL DELAY CONTROLS ===

    // Get Basil effect for direct parameter control
    getBasilEffect() {
        return this.sendBus?.getBasil();
    }

    // Set Basil send level (0-1)
    setBasilSendLevel(level) {
        this.sendBus?.setEffectSendLevel('basil', level);
    }

    // Set a parameter on Basil
    setBasilParam(name, value) {
        const basil = this.sendBus?.getBasil();
        if (basil?.setParam) {
            basil.setParam(name, value);
        }
    }

    // Get all Basil parameters
    getBasilParams() {
        const basil = this.sendBus?.getBasil();
        return basil?.getParams?.() || null;
    }

    // Set Basil speed mode (0=1x, 1=1/2, 2=1/4, 3=1/8)
    setBasilSpeedMode(mode) {
        const basil = this.sendBus?.getBasil();
        if (basil?.setSpeedMode) {
            basil.setSpeedMode(mode);
        }
    }

    // Toggle Basil lo-fi mode
    setBasilLoFi(active) {
        const basil = this.sendBus?.getBasil();
        if (basil?.setLoFi) {
            basil.setLoFi(active);
        }
    }

    // Freeze Basil buffer
    freezeBasil(active) {
        const basil = this.sendBus?.getBasil();
        if (basil?.freeze) {
            basil.freeze(active);
        }
    }

    // Set Basil sync mode
    setBasilSync(enabled, division = 1) {
        const basil = this.sendBus?.getBasil();
        if (basil?.setSync) {
            basil.setSync(enabled, division);
        }
    }

    // Purge Basil buffers
    purgeBasil() {
        const basil = this.sendBus?.getBasil();
        if (basil?.purge) {
            basil.purge();
        }
    }

    // === FDNR REVERB CONTROLS ===

    // Set send amount for a voice to FDNR
    setVoiceFDNRSend(voiceId, amount) {
        this.sendBus?.setVoiceSendAmount(voiceId, 'fdnr', amount);
    }

    // Set a parameter on FDNR
    setFDNRParam(name, value) {
        const fdnr = this.sendBus?.getFDNR();
        if (fdnr?.setParam) {
            fdnr.setParam(name, value);
        }
    }

    // Get all FDNR parameters
    getFDNRParams() {
        const fdnr = this.sendBus?.getFDNR();
        return fdnr?.getParams?.() || null;
    }

    // Set FDNR mode/preset
    setFDNRMode(modeIndex) {
        const fdnr = this.sendBus?.getFDNR();
        if (fdnr?.setMode) {
            fdnr.setMode(modeIndex);
        }
    }

    // Get current FDNR mode
    getFDNRMode() {
        const fdnr = this.sendBus?.getFDNR();
        return fdnr?.getMode?.() || 0;
    }

    // Purge FDNR buffers
    purgeFDNR() {
        const fdnr = this.sendBus?.getFDNR();
        if (fdnr?.purge) {
            fdnr.purge();
        }
    }

    // === INSERT-TO-SEND ROUTING ===

    // Set insert bus send amount to a specific effect (0-1)
    // This routes the processed insert chain output to send effects
    setInsertSendAmount(effectType, amount) {
        this.sendBus?.setInsertSendAmount(effectType, amount);
    }

    // Get insert send amount to a specific effect
    getInsertSendAmount(effectType) {
        return this.sendBus?.getInsertSendAmount(effectType) || 0;
    }

    // Set insert send to Nautilus
    setInsertNautilusSend(amount) {
        this.setInsertSendAmount('nautilus', amount);
    }

    // Set insert send to Basil
    setInsertBasilSend(amount) {
        this.setInsertSendAmount('basil', amount);
    }

    // Set insert send to FDNR
    setInsertFDNRSend(amount) {
        this.setInsertSendAmount('fdnr', amount);
    }

    // Get all insert send amounts
    getInsertSends() {
        return this.sendBus?.getInsertSends() || {};
    }

    // Set the insert bus master send level (controls how much goes to all sends)
    setInsertSendMasterLevel(level) {
        this.insertBus?.setSendOutputLevel(level);
    }

    // Get insert bus master send level
    getInsertSendMasterLevel() {
        return this.insertBus?.getSendOutputLevel() || 0;
    }

    // === DATA BENDER CONTROLS (Insert Effect) ===

    // Enable/disable Data Bender insert effect
    setDataBenderEnabled(enabled) {
        this.insertBus?.setDataBenderEnabled(enabled);
    }

    // Check if Data Bender is enabled
    isDataBenderEnabled() {
        return this.insertBus?.isDataBenderEnabled() || false;
    }

    // Toggle Data Bender on/off
    toggleDataBender() {
        this.insertBus?.toggleDataBender();
    }

    // Get Data Bender effect for direct control
    getDataBenderEffect() {
        return this.insertBus?.getDataBender();
    }

    // Set a parameter on Data Bender
    setDataBenderParam(name, value) {
        const databender = this.insertBus?.getDataBender();
        if (databender?.setParam) {
            databender.setParam(name, value);
        }
    }

    // Set Data Bender mode (macro/micro)
    setDataBenderMode(mode) {
        const databender = this.insertBus?.getDataBender();
        if (databender?.setMode) {
            databender.setMode(mode);
        }
    }

    // Set Data Bender clock mode (internal/external)
    setDataBenderClockMode(mode) {
        const databender = this.insertBus?.getDataBender();
        if (databender?.setClockMode) {
            databender.setClockMode(mode);
        }
    }

    // Set Data Bender bend enabled
    setDataBenderBend(enabled) {
        const databender = this.insertBus?.getDataBender();
        if (databender?.setBendEnabled) {
            databender.setBendEnabled(enabled);
        }
    }

    // Set Data Bender break enabled
    setDataBenderBreak(enabled) {
        const databender = this.insertBus?.getDataBender();
        if (databender?.setBreakEnabled) {
            databender.setBreakEnabled(enabled);
        }
    }

    // Set Data Bender corrupt type
    setDataBenderCorruptType(type) {
        const databender = this.insertBus?.getDataBender();
        if (databender?.setCorruptType) {
            databender.setCorruptType(type);
        }
    }

    // Freeze Data Bender buffer
    freezeDataBender(active) {
        const databender = this.insertBus?.getDataBender();
        if (databender?.freeze) {
            databender.freeze(active);
        }
    }

    // Purge Data Bender buffers
    purgeDataBender() {
        const databender = this.insertBus?.getDataBender();
        if (databender?.purge) {
            databender.purge();
        }
    }

    // Reset Data Bender (sync clock)
    resetDataBender() {
        const databender = this.insertBus?.getDataBender();
        if (databender?.reset) {
            databender.reset();
        }
    }

    // === ARBHAR CONTROLS ===

    // Enable/disable Arbhar insert effect
    setArbharEnabled(enabled) {
        this.insertBus?.setArbharEnabled(enabled);
    }

    // Check if Arbhar is enabled
    isArbharEnabled() {
        return this.insertBus?.isArbharEnabled() || false;
    }

    // Toggle Arbhar on/off
    toggleArbhar() {
        this.insertBus?.toggleArbhar();
    }

    // Get Arbhar effect for direct control
    getArbharEffect() {
        return this.insertBus?.getArbhar();
    }

    // Set a parameter on Arbhar
    setArbharParam(name, value) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setParam) {
            arbhar.setParam(name, value);
        }
    }

    // Set Arbhar scan mode (0=Scan, 1=Follow, 2=Wavetable)
    setArbharScanMode(mode) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setScanMode) {
            arbhar.setScanMode(mode);
        }
    }

    // Set Arbhar active layer (0-5)
    setArbharLayer(layer) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setActiveLayer) {
            arbhar.setActiveLayer(layer);
        }
    }

    // Set Arbhar continuous engine enabled
    setArbharContinuousEngine(enabled) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setContinuousEngine) {
            arbhar.setContinuousEngine(enabled);
        }
    }

    // Set Arbhar strike engine enabled
    setArbharStrikeEngine(enabled) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setStrikeEngine) {
            arbhar.setStrikeEngine(enabled);
        }
    }

    // Trigger Arbhar strike
    strikeArbhar() {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.strike) {
            arbhar.strike();
        }
    }

    // Start Arbhar recording
    startArbharRecording() {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.startRecording) {
            arbhar.startRecording();
        }
    }

    // Stop Arbhar recording
    stopArbharRecording() {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.stopRecording) {
            arbhar.stopRecording();
        }
    }

    // Toggle Arbhar recording
    toggleArbharRecording() {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.toggleRecording) {
            arbhar.toggleRecording();
        }
    }

    // Set Arbhar auto-capture enabled
    setArbharAutoCapture(enabled) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setAutoCapture) {
            arbhar.setAutoCapture(enabled);
        }
    }

    // Freeze Arbhar
    freezeArbhar(active) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.freeze) {
            arbhar.freeze(active);
        }
    }

    // Set Arbhar pitch quantize enabled
    setArbharPitchQuantize(enabled) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setPitchQuantize) {
            arbhar.setPitchQuantize(enabled);
        }
    }

    // Set Arbhar pitch scale
    setArbharPitchScale(scale) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.setPitchScale) {
            arbhar.setPitchScale(scale);
        }
    }

    // Clear Arbhar layer
    clearArbharLayer(layer) {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.clearLayer) {
            arbhar.clearLayer(layer);
        }
    }

    // Clear all Arbhar layers
    clearAllArbharLayers() {
        const arbhar = this.insertBus?.getArbhar();
        if (arbhar?.clearAllLayers) {
            arbhar.clearAllLayers();
        }
    }

    // === MORPHAGENE CONTROLS ===

    // Enable/disable Morphagene insert effect
    setMorphageneEnabled(enabled) {
        this.insertBus?.setMorphageneEnabled(enabled);
    }

    // Check if Morphagene is enabled
    isMorphageneEnabled() {
        return this.insertBus?.isMorphageneEnabled() || false;
    }

    // Toggle Morphagene on/off
    toggleMorphagene() {
        this.insertBus?.toggleMorphagene();
    }

    // Get Morphagene effect for direct control
    getMorphageneEffect() {
        return this.insertBus?.getMorphagene();
    }

    // Set a parameter on Morphagene
    setMorphageneParam(name, value) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setParam) {
            morphagene.setParam(name, value);
        }
    }

    // Get all Morphagene parameters
    getMorphageneParams() {
        const morphagene = this.insertBus?.getMorphagene();
        return morphagene?.getParams?.() || null;
    }

    // Set Morphagene varispeed (0-1: 0=max reverse, 0.5=stop, 1=max forward)
    setMorphageneVarispeed(value) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setVarispeed) {
            morphagene.setVarispeed(value);
        }
    }

    // Set Morphagene to forward 1x speed
    setMorphageneForward1x() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setForward1x) {
            morphagene.setForward1x();
        }
    }

    // Set Morphagene to reverse 1x speed
    setMorphageneReverse1x() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setReverse1x) {
            morphagene.setReverse1x();
        }
    }

    // Stop Morphagene playback
    stopMorphagene() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.stop) {
            morphagene.stop();
        }
    }

    // Set Morphagene gene size (0=full splice, 1=microsound)
    setMorphageneGeneSize(value) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setGeneSize) {
            morphagene.setGeneSize(value);
        }
    }

    // Set Morphagene slide position (0-1)
    setMorphageneSlide(value) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setSlide) {
            morphagene.setSlide(value);
        }
    }

    // Set Morphagene morph (gene overlap, 0-1)
    setMorphageneMorph(value) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setMorph) {
            morphagene.setMorph(value);
        }
    }

    // Set Morphagene organize (splice selection, 0-1)
    setMorphageneOrganize(value) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setOrganize) {
            morphagene.setOrganize(value);
        }
    }

    // Set Morphagene SOS (sound on sound mix, 0=input only, 1=playback only)
    setMorphageneSOS(value) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setSOS) {
            morphagene.setSOS(value);
        }
    }

    // Start Morphagene recording (into current splice)
    startMorphageneRecording() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.startRecording) {
            morphagene.startRecording();
        }
    }

    // Start Morphagene recording into new splice
    startMorphageneNewSpliceRecording() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.startRecordingNewSplice) {
            morphagene.startRecordingNewSplice();
        }
    }

    // Stop Morphagene recording
    stopMorphageneRecording() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.stopRecording) {
            morphagene.stopRecording();
        }
    }

    // Toggle Morphagene recording
    toggleMorphageneRecording() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.toggleRecording) {
            morphagene.toggleRecording();
        }
    }

    // Create splice marker at current position
    createMorphageneSplice() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.createSplice) {
            morphagene.createSplice();
        }
    }

    // Shift to next splice
    shiftMorphageneSplice() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.shiftSplice) {
            morphagene.shiftSplice();
        }
    }

    // Delete current splice marker
    deleteMorphageneSpliceMarker() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.deleteSpliceMarker) {
            morphagene.deleteSpliceMarker();
        }
    }

    // Clear Morphagene reel
    clearMorphageneReel() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.clearReel) {
            morphagene.clearReel();
        }
    }

    // Set Morphagene play state
    setMorphagenePlay(active) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setPlay) {
            morphagene.setPlay(active);
        }
    }

    // Toggle Morphagene play
    toggleMorphagenePlay() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.togglePlay) {
            morphagene.togglePlay();
        }
    }

    // Trigger Morphagene (restart from beginning)
    triggerMorphagene() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.trigger) {
            morphagene.trigger();
        }
    }

    // Freeze Morphagene
    freezeMorphagene(active) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.freeze) {
            morphagene.freeze(active);
        }
    }

    // Toggle Morphagene freeze
    toggleMorphageneFreeze() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.toggleFreeze) {
            morphagene.toggleFreeze();
        }
    }

    // Load sample into Morphagene from URL
    async loadMorphageneSampleFromURL(url, name) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.loadSampleFromURL) {
            await morphagene.loadSampleFromURL(url, name);
        }
    }

    // Load sample into Morphagene from File
    async loadMorphageneSampleFromFile(file) {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.loadSampleFromFile) {
            await morphagene.loadSampleFromFile(file);
        }
    }

    // Set Morphagene to initialization state (unmodulated 1/1 playback)
    setMorphageneInitState() {
        const morphagene = this.insertBus?.getMorphagene();
        if (morphagene?.setInitializationState) {
            morphagene.setInitializationState();
        }
    }

    // === LUBADH CONTROLS ===

    // Enable/disable Lubadh insert effect
    setLubadhEnabled(enabled) {
        this.insertBus?.setLubadhEnabled(enabled);
    }

    // Check if Lubadh is enabled
    isLubadhEnabled() {
        return this.insertBus?.isLubadhEnabled() || false;
    }

    // Toggle Lubadh on/off
    toggleLubadh() {
        this.insertBus?.toggleLubadh();
    }

    // Get Lubadh effect for direct control
    getLubadhEffect() {
        return this.insertBus?.getLubadh();
    }

    // Set a parameter on Lubadh
    setLubadhParam(name, value) {
        const lubadh = this.insertBus?.getLubadh();
        if (lubadh?.setParam) {
            lubadh.setParam(name, value);
        }
    }

    // Get all Lubadh parameters
    getLubadhParams() {
        const lubadh = this.insertBus?.getLubadh();
        return lubadh?.getParams?.() || null;
    }

    // Load sample into Lubadh from File
    async loadLubadhSampleFromFile(file, deck = 'A') {
        const lubadh = this.insertBus?.getLubadh();
        if (lubadh?.loadSampleFromFile) {
            await lubadh.loadSampleFromFile(file, deck);
        }
    }

    // Load sample into Lubadh from URL
    async loadLubadhSampleFromURL(url, deck = 'A', name) {
        const lubadh = this.insertBus?.getLubadh();
        if (lubadh?.loadSampleFromURL) {
            await lubadh.loadSampleFromURL(url, deck, name);
        }
    }

    // === NAUTILUS CONTROLS (aliased for clarity) ===

    // Get Nautilus effect for direct parameter control
    getNautilusEffect() {
        return this.sendBus?.getNautilus();
    }

    // Set Nautilus send level (0-1)
    setNautilusSendLevel(level) {
        this.sendBus?.setEffectSendLevel('nautilus', level);
    }

    // === GLOBAL LFO BANK CONTROLS ===

    getLFOBank() {
        return this.lfoBank;
    }

    getLFODestinations() {
        return this.lfoBank?.availableDestinations || [];
    }

    setLFOEnabled(lfoId, enabled) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (lfo) {
            if (enabled) {
                lfo.enable();
            } else {
                lfo.disable();
            }
        }
    }

    setLFORate(lfoId, rate) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (lfo) {
            lfo.setRate(rate);
        }
    }

    setLFODepth(lfoId, depth) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (lfo) {
            lfo.setDepth(depth);
        }
    }

    setLFOShape(lfoId, shape) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (lfo) {
            lfo.setShape(shape);
        }
    }

    setLFOSync(lfoId, synced) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (lfo) {
            lfo.setSync(synced);
        }
    }

    setLFOSyncDivision(lfoId, division) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (lfo) {
            lfo.setSyncDivision(division);
        }
    }

    setLFOPolarity(lfoId, polarity) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (lfo) {
            lfo.setPolarity(polarity);
        }
    }

    setLFODestination(lfoId, slot, destinationId) {
        const lfo = this.lfoBank?.getLFO(lfoId);
        if (!lfo) return;

        if (!destinationId) {
            lfo.clearDestination(slot);
            return;
        }

        const dest = this.lfoBank.findDestination(destinationId);
        if (dest) {
            lfo.setDestination(slot, dest);
        }
    }

    // === TRANSPOSITION SEQUENCER ===

    setTransposeSequence(sequence) {
        this.transposeSequence = sequence.map(v => Math.max(-12, Math.min(12, v)));
    }

    setTransposeBarsPerStep(bars) {
        this.transposeBarsPerStep = Math.max(1, Math.min(16, bars));
    }

    setTransposeStepCount(count) {
        this.transposeStepCount = Math.max(1, Math.min(8, count));
        // Reset to first step if current step is beyond new count
        if (this.currentTransposeStep >= this.transposeStepCount) {
            this.currentTransposeStep = 0;
            this._applyTransposeOffset(this.transposeSequence[0] || 0);
            if (this.onTransposeStep) {
                this.onTransposeStep(0);
            }
        }
    }

    getTransposeStepCount() {
        return this.transposeStepCount;
    }

    _startTransposeLoop() {
        this._transposeInterval = setInterval(() => {
            this._updateTranspose();
        }, 50);
    }

    _updateTranspose() {
        if (!this.clock?.isRunning) return;

        const currentBar = this.clock.getCurrentBar();

        if (currentBar !== this.lastTransposeBar) {
            this.lastTransposeBar = currentBar;

            const stepIndex = Math.floor(currentBar / this.transposeBarsPerStep) % this.transposeStepCount;

            if (stepIndex !== this.currentTransposeStep) {
                this.currentTransposeStep = stepIndex;
                const newOffset = this.transposeSequence[stepIndex];

                if (newOffset !== this.transposeOffset) {
                    this._applyTransposeOffset(newOffset);
                }

                if (this.onTransposeStep) {
                    this.onTransposeStep(stepIndex);
                }
            }
        }
    }

    _applyTransposeOffset(offset) {
        const previousOffset = this.transposeOffset;
        this.transposeOffset = offset;
        const degreeChange = offset - previousOffset;

        for (const voice of this.voices) {
            if (voice.patternEngine) {
                const currentBase = voice.patternEngine.baseDegree || 0;
                voice.patternEngine.setBaseDegree(currentBase + degreeChange, true);
            }
        }
    }

    _onBar(bar) {
        // Bar callback - handled by _updateTranspose
    }

    resetTranspose() {
        this.currentTransposeStep = 0;
        this.lastTransposeBar = -1;
        this._applyTransposeOffset(this.transposeSequence[0] || 0);
        if (this.onTransposeStep) {
            this.onTransposeStep(0);
        }
    }

    // === POLYMETRIC CONTROLS ===

    setPolymetricPreset(presetName) {
        if (POLYMETRIC_PRESETS[presetName]) {
            this.polymetricPreset = presetName;
            this._applyPolymetricPreset();
            this._triggerStateChange();
        }
    }

    setPhasePreset(presetName) {
        if (PHASE_PRESETS[presetName]) {
            this.phasePreset = presetName;
            this._applyPolymetricPreset();
            this._triggerStateChange();
        }
    }

    nudgeVoicePhase(voiceId, amount) {
        const voice = this.voices[voiceId];
        if (voice?.clock) {
            voice.clock.nudgePhase(amount);
        }
    }

    // === MASTER CONTROLS ===

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
        }
    }

    getAnalyserData() {
        if (!this.masterAnalyser) return null;
        const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
        this.masterAnalyser.getByteFrequencyData(data);
        return data;
    }

    getWaveformData() {
        if (!this.masterAnalyser) return null;
        const data = new Uint8Array(this.masterAnalyser.fftSize);
        this.masterAnalyser.getByteTimeDomainData(data);
        return data;
    }

    // === STATE ===

    getState() {
        return {
            isInitialized: this.isInitialized,
            isPlaying: this.clock?.isRunning || false,
            rootMidi: this.rootMidi,
            scaleName: this.scaleName,
            bpm: this.bpm,
            masterVolume: this.masterVolume,
            polymetricPreset: this.polymetricPreset,
            phasePreset: this.phasePreset,
            voices: this.voices.map(v => ({
                id: v.id,
                params: v.getParams(),
                isMuted: v.isMuted
            })),
            clock: this.clock?.getSyncInfo(),
            insertBus: this.insertBus?.getState() || null,
            sendBus: this.sendBus?.getState() || null
        };
    }

    _triggerStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }
    }

    // === CLEANUP ===

    dispose() {
        this.stop();

        if (this._transposeInterval) {
            clearInterval(this._transposeInterval);
            this._transposeInterval = null;
        }

        if (this.lfoBank) {
            this.lfoBank.dispose();
            this.lfoBank = null;
        }

        if (this.insertBus) {
            this.insertBus.dispose();
            this.insertBus = null;
        }

        if (this.sendBus) {
            this.sendBus.dispose();
            this.sendBus = null;
        }

        for (const voice of this.voices) {
            voice.dispose();
        }
        this.voices = [];

        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }

        this.isInitialized = false;
    }
}

// Factory function
export function createGlassMachine(options = {}) {
    return new GlassMachine(options);
}
