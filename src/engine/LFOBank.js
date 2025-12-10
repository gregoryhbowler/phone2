// GLOBAL LFO BANK
// 12 global LFOs with 2 selectable destinations each
// Destinations dynamically generated from available voice parameters

// Sync division presets (relative to quarter note = 1)
export const SYNC_DIVISIONS = [
    { label: '4 bars', value: 0.0625 },   // 1/16 of quarter = 4 bars
    { label: '2 bars', value: 0.125 },    // 1/8 of quarter = 2 bars
    { label: '1 bar', value: 0.25 },      // 1/4 of quarter = 1 bar
    { label: '1/2', value: 0.5 },         // Half note
    { label: '1/4', value: 1 },           // Quarter note
    { label: '1/8', value: 2 },           // Eighth note
    { label: '1/16', value: 4 },          // Sixteenth note
    { label: '1/32', value: 8 },          // 32nd note
    { label: '1/4T', value: 1.5 },        // Quarter triplet
    { label: '1/8T', value: 3 },          // Eighth triplet
    { label: '1/16T', value: 6 },         // Sixteenth triplet
];

// LFO shapes
export const LFO_SHAPES = ['sine', 'triangle', 'square', 'sawtooth', 'random'];

// Parameter ranges for depth scaling
const PARAM_RANGES = {
    filterFreq: { min: 20, max: 20000, curve: 'exp' },
    freq: { min: 0.01, max: 20, curve: 'exp' },
    filterQ: { min: 0.1, max: 20, curve: 'linear' },
    Q: { min: 0.1, max: 20, curve: 'linear' },
    gain: { min: 0, max: 1, curve: 'linear' },
    modDepth: { min: 0, max: 5000, curve: 'linear' },
    sizzle: { min: -12, max: 12, curve: 'linear' },
    feedback: { min: 0, max: 0.95, curve: 'linear' },
    time: { min: 0.001, max: 2, curve: 'exp' },
    depth: { min: 0, max: 100, curve: 'linear' },
    pan: { min: -1, max: 1, curve: 'linear' },
    clickGain: { min: 0, max: 1, curve: 'linear' }
};

// Single Global LFO with 2 destinations
export class GlobalLFO {
    constructor(ctx, id) {
        this.ctx = ctx;
        this.id = id;
        this.enabled = false;

        // LFO parameters
        this.rate = 1.0;              // Hz (when free-running)
        this.depth = 0.5;             // 0-1 normalized depth
        this.shape = 'sine';          // sine, triangle, square, sawtooth, random
        this.synced = false;          // Tempo sync mode
        this.syncDivision = 1;        // Sync division (1 = quarter note)
        this.polarity = 'bipolar';    // bipolar, unipolar+, unipolar-

        // Two destination slots
        this.destinations = [
            { id: null, paramRef: null, range: null, baseValue: 0, gainNode: null },
            { id: null, paramRef: null, range: null, baseValue: 0, gainNode: null }
        ];

        // Audio nodes (created when enabled)
        this.osc = null;
        this.masterGain = null;       // Overall depth control
        this.polarityGain = null;     // For polarity scaling
        this.offset = null;           // For unipolar offset

        // BPM reference (set by LFOBank)
        this.bpm = 120;
    }

    // Enable/start the LFO
    enable() {
        if (this.enabled) return;

        console.log(`LFO ${this.id}: Enabling`);

        // Create oscillator
        this.osc = this.ctx.createOscillator();
        this._setOscShape(this.shape);
        this._updateRate();

        // Master gain for combining signals (not for depth - depth is applied per-destination)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1;

        // Polarity processing chain
        this.polarityGain = this.ctx.createGain();
        this.offset = this.ctx.createConstantSource();

        this._updatePolarity();

        // Connect: osc -> polarityGain -> masterGain
        this.osc.connect(this.polarityGain);
        this.polarityGain.connect(this.masterGain);
        this.offset.connect(this.masterGain);

        this.osc.start();
        this.offset.start();

        // Reconnect existing destinations - masterGain -> gainNode -> paramRef
        for (const dest of this.destinations) {
            console.log(`LFO ${this.id}: Checking dest`, dest.id, 'paramRef:', !!dest.paramRef, 'gainNode:', !!dest.gainNode);
            if (dest.paramRef && dest.gainNode) {
                try {
                    this.masterGain.connect(dest.gainNode);
                    console.log(`LFO ${this.id}: Connected to`, dest.id);
                } catch (e) {
                    console.error(`LFO ${this.id}: Failed to connect to`, dest.id, e);
                }
            }
        }

        this.enabled = true;
        console.log(`LFO ${this.id}: Enabled`);
    }

    // Disable/stop the LFO
    disable() {
        if (!this.enabled) return;

        // Disconnect masterGain from all destination gainNodes first
        // (preserving the gainNode -> paramRef connections for when we re-enable)
        if (this.masterGain) {
            for (const dest of this.destinations) {
                if (dest.gainNode) {
                    try {
                        this.masterGain.disconnect(dest.gainNode);
                    } catch (e) {
                        // May not be connected
                    }
                }
            }
        }

        // Stop and disconnect oscillator
        if (this.osc) {
            try { this.osc.stop(); } catch (e) {}
            try { this.osc.disconnect(); } catch (e) {}
            this.osc = null;
        }

        // Stop offset source
        if (this.offset) {
            try { this.offset.stop(); } catch (e) {}
            try { this.offset.disconnect(); } catch (e) {}
            this.offset = null;
        }

        // Disconnect gains
        if (this.masterGain) {
            try { this.masterGain.disconnect(); } catch (e) {}
            this.masterGain = null;
        }
        if (this.polarityGain) {
            try { this.polarityGain.disconnect(); } catch (e) {}
            this.polarityGain = null;
        }

        this.enabled = false;
    }

    // Set LFO rate (Hz when free-running)
    setRate(hz) {
        this.rate = Math.max(0.01, Math.min(20, hz));
        this._updateRate();
    }

    // Set sync division
    setSyncDivision(division) {
        this.syncDivision = division;
        if (this.synced) {
            this._updateRate();
        }
    }

    // Toggle sync mode
    setSync(synced) {
        this.synced = synced;
        this._updateRate();
    }

    // Update BPM (called by LFOBank when tempo changes)
    setBPM(bpm) {
        this.bpm = bpm;
        if (this.synced) {
            this._updateRate();
        }
    }

    // Internal: update oscillator frequency
    _updateRate() {
        if (!this.osc) return;

        let freq;
        if (this.synced) {
            // Tempo-synced rate: BPM / 60 gives beats per second
            // syncDivision = 1 means one LFO cycle per beat
            const beatsPerSecond = this.bpm / 60;
            freq = beatsPerSecond * this.syncDivision;
        } else {
            freq = this.rate;
        }

        this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.02);
    }

    // Set depth (0-1)
    setDepth(depth) {
        this.depth = Math.max(0, Math.min(1, depth));
        // Depth is applied per-destination in _updateDestinationGains, not on masterGain
        // masterGain stays at 1 to pass through the LFO signal unchanged
        this._updateDestinationGains();
    }

    // Set waveform shape
    setShape(shape) {
        if (!LFO_SHAPES.includes(shape)) return;
        this.shape = shape;
        this._setOscShape(shape);
    }

    // Internal: set oscillator waveform
    _setOscShape(shape) {
        if (!this.osc) return;

        if (shape === 'random') {
            // For random/S&H, we use a square wave and will implement S&H later
            // For now, approximate with square
            this.osc.type = 'square';
        } else {
            this.osc.type = shape;
        }
    }

    // Set polarity mode
    setPolarity(polarity) {
        if (!['bipolar', 'unipolar+', 'unipolar-'].includes(polarity)) return;
        this.polarity = polarity;
        this._updatePolarity();
    }

    // Internal: update polarity processing
    _updatePolarity() {
        if (!this.polarityGain || !this.offset) return;

        switch (this.polarity) {
            case 'bipolar':
                // Pass-through: oscillator outputs -1 to +1
                this.polarityGain.gain.value = 1;
                this.offset.offset.value = 0;
                break;
            case 'unipolar+':
                // 0 to +1: (osc + 1) / 2
                this.polarityGain.gain.value = 0.5;
                this.offset.offset.value = 0.5;
                break;
            case 'unipolar-':
                // 0 to -1: (-osc + 1) / 2, then negate
                this.polarityGain.gain.value = -0.5;
                this.offset.offset.value = -0.5;
                break;
        }
    }

    // Set destination for a slot (0 or 1)
    setDestination(slot, destInfo) {
        if (slot < 0 || slot > 1) return;

        const dest = this.destinations[slot];

        // Disconnect existing gainNode from masterGain first (if connected)
        if (dest.gainNode && this.masterGain) {
            try {
                this.masterGain.disconnect(dest.gainNode);
            } catch (e) {
                // May not be connected
            }
        }

        // Then disconnect gainNode from paramRef
        if (dest.gainNode) {
            try {
                dest.gainNode.disconnect();
            } catch (e) {
                // May already be disconnected
            }
            dest.gainNode = null;
        }

        // Clear if no destination
        if (!destInfo || !destInfo.paramRef) {
            dest.id = null;
            dest.paramRef = null;
            dest.range = null;
            dest.baseValue = 0;
            return;
        }

        // Validate that paramRef is an AudioParam
        const param = destInfo.paramRef;
        if (!param || typeof param.value !== 'number') {
            console.warn(`LFO ${this.id}: Invalid AudioParam for destination ${destInfo.id}`);
            dest.id = null;
            dest.paramRef = null;
            dest.range = null;
            dest.baseValue = 0;
            return;
        }

        // Set new destination
        dest.id = destInfo.id;
        dest.paramRef = param;
        dest.range = destInfo.range || PARAM_RANGES[destInfo.paramName] || { min: 0, max: 1 };
        dest.baseValue = param.value;

        // Create gain node for this destination's depth scaling
        dest.gainNode = this.ctx.createGain();
        this._updateDestinationGain(dest);

        console.log(`LFO ${this.id}: setDestination slot ${slot}:`, destInfo.id, 'enabled:', this.enabled, 'hasMasterGain:', !!this.masterGain, 'gainValue:', dest.gainNode.gain.value);

        // Connect gain node to parameter
        try {
            dest.gainNode.connect(param);
            console.log(`LFO ${this.id}: Connected gainNode to param`);
        } catch (e) {
            console.error(`LFO ${this.id}: Failed to connect gainNode to param`, e);
            dest.gainNode = null;
            dest.id = null;
            dest.paramRef = null;
            return;
        }

        // Connect LFO masterGain to this gain node if enabled
        if (this.enabled && this.masterGain) {
            try {
                this.masterGain.connect(dest.gainNode);
                console.log(`LFO ${this.id}: Connected masterGain to gainNode`);
            } catch (e) {
                console.error(`LFO ${this.id}: Failed to connect masterGain`, e);
            }
        } else {
            console.log(`LFO ${this.id}: Skipping masterGain connection (will connect on enable)`);
        }
    }

    // Clear a destination slot
    clearDestination(slot) {
        this.setDestination(slot, null);
    }

    // Internal: update gain scaling for a destination based on range and depth
    _updateDestinationGain(dest) {
        if (!dest.gainNode || !dest.range) return;

        // Calculate modulation range based on parameter range
        const range = dest.range;
        const span = range.max - range.min;

        // Scale modulation depth by parameter range
        // depth of 1.0 = full range modulation
        const modulationAmount = span * this.depth;

        dest.gainNode.gain.value = modulationAmount;
    }

    // Update all destination gains
    _updateDestinationGains() {
        for (const dest of this.destinations) {
            this._updateDestinationGain(dest);
        }
    }

    // Get state for serialization/UI
    getState() {
        return {
            id: this.id,
            enabled: this.enabled,
            rate: this.rate,
            depth: this.depth,
            shape: this.shape,
            synced: this.synced,
            syncDivision: this.syncDivision,
            polarity: this.polarity,
            destinations: this.destinations.map(d => ({
                id: d.id,
                hasConnection: !!d.paramRef
            }))
        };
    }

    // Dispose
    dispose() {
        this.disable();
        for (const dest of this.destinations) {
            if (dest.gainNode) {
                dest.gainNode.disconnect();
            }
        }
        this.destinations = [
            { id: null, paramRef: null, range: null, baseValue: 0, gainNode: null },
            { id: null, paramRef: null, range: null, baseValue: 0, gainNode: null }
        ];
    }
}

// LFO Bank - manages 12 global LFOs
export class LFOBank {
    constructor(ctx, numLFOs = 12) {
        this.ctx = ctx;
        this.numLFOs = numLFOs;
        this.lfos = [];
        this.bpm = 120;

        // Create LFO instances
        for (let i = 0; i < numLFOs; i++) {
            this.lfos.push(new GlobalLFO(ctx, i));
        }

        // Cache of available destinations (rebuilt when patches change)
        this.availableDestinations = [];
    }

    // Get an LFO by index
    getLFO(index) {
        return this.lfos[index];
    }

    // Set BPM for all LFOs (for tempo sync)
    setBPM(bpm) {
        this.bpm = bpm;
        for (const lfo of this.lfos) {
            lfo.setBPM(bpm);
        }
    }

    // Collect all available destinations from voices
    collectAllDestinations(voices) {
        const destinations = [];

        voices.forEach((voice, vIdx) => {
            // From pitch-tracking oscillators
            voice.pitchTrackingOscs?.forEach((osc, oIdx) => {
                if (osc.params) {
                    Object.entries(osc.params).forEach(([name, param]) => {
                        if (param && typeof param.value === 'number') {
                            destinations.push({
                                id: `v${vIdx}_o${oIdx}_${name}`,
                                label: `V${vIdx + 1} O${oIdx + 1} ${this._getParamLabel(name)}`,
                                voiceId: vIdx,
                                oscIdx: oIdx,
                                paramName: name,
                                paramRef: param,
                                range: PARAM_RANGES[name] || { min: 0, max: 1, curve: 'linear' }
                            });
                        }
                    });
                }
            });

            // From modules (filters, effects)
            voice.modules?.forEach((mod, mIdx) => {
                if (mod.params) {
                    Object.entries(mod.params).forEach(([name, param]) => {
                        if (param && typeof param.value === 'number') {
                            const prefix = mIdx < 2 ? `F${mIdx + 1}` : `FX${mIdx - 1}`;
                            destinations.push({
                                id: `v${vIdx}_m${mIdx}_${name}`,
                                label: `V${vIdx + 1} ${prefix} ${this._getParamLabel(name)}`,
                                voiceId: vIdx,
                                modIdx: mIdx,
                                paramName: name,
                                paramRef: param,
                                range: PARAM_RANGES[name] || { min: 0, max: 1, curve: 'linear' }
                            });
                        }
                    });
                }
            });

            // Voice-level ADSR params (exposed as modulatable targets)
            // Attack
            destinations.push({
                id: `v${vIdx}_adsr_attack`,
                label: `V${vIdx + 1} ENV ATK`,
                voiceId: vIdx,
                paramName: 'adsrAttack',
                paramRef: null, // Will need special handling
                range: { min: 0.001, max: 2.0, curve: 'exp' },
                isADSR: true,
                adsrParam: 'attack'
            });
            destinations.push({
                id: `v${vIdx}_adsr_decay`,
                label: `V${vIdx + 1} ENV DEC`,
                voiceId: vIdx,
                paramName: 'adsrDecay',
                paramRef: null,
                range: { min: 0.001, max: 2.0, curve: 'exp' },
                isADSR: true,
                adsrParam: 'decay'
            });
            destinations.push({
                id: `v${vIdx}_adsr_sustain`,
                label: `V${vIdx + 1} ENV SUS`,
                voiceId: vIdx,
                paramName: 'adsrSustain',
                paramRef: null,
                range: { min: 0, max: 1, curve: 'linear' },
                isADSR: true,
                adsrParam: 'sustain'
            });
            destinations.push({
                id: `v${vIdx}_adsr_release`,
                label: `V${vIdx + 1} ENV REL`,
                voiceId: vIdx,
                paramName: 'adsrRelease',
                paramRef: null,
                range: { min: 0.001, max: 4.0, curve: 'exp' },
                isADSR: true,
                adsrParam: 'release'
            });
        });

        this.availableDestinations = destinations;
        return destinations;
    }

    // Get short label for parameter name
    _getParamLabel(name) {
        const labels = {
            filterFreq: 'CUT',
            filterQ: 'RES',
            freq: 'FRQ',
            Q: 'Q',
            gain: 'LVL',
            modDepth: 'MOD',
            sizzle: 'SIZ',
            feedback: 'FB',
            time: 'DLY',
            depth: 'DPT',
            pan: 'PAN',
            clickGain: 'CLK'
        };
        return labels[name] || name.slice(0, 3).toUpperCase();
    }

    // Find destination by ID
    findDestination(id) {
        return this.availableDestinations.find(d => d.id === id);
    }

    // Set available destinations directly (for BuchlaVoice integration)
    // Accepts array of { id, label, param, range } objects
    setAvailableDestinations(destinations) {
        // Store current destination selections
        const previousSelections = this.lfos.map(lfo => [
            lfo.destinations[0].id,
            lfo.destinations[1].id
        ]);

        // Map to internal format
        this.availableDestinations = destinations.map(d => ({
            id: d.id,
            label: d.label,
            paramRef: d.param,
            range: d.range || { min: 0, max: 1, curve: 'linear' }
        }));

        // Restore selections where possible
        this.lfos.forEach((lfo, lfoIdx) => {
            previousSelections[lfoIdx].forEach((destId, slot) => {
                if (destId) {
                    const dest = this.findDestination(destId);
                    if (dest) {
                        lfo.setDestination(slot, dest);
                    } else {
                        // Destination no longer exists
                        lfo.clearDestination(slot);
                    }
                }
            });
        });
    }

    // Refresh destinations when patches change
    refreshDestinations(voices) {
        // Store current destination selections
        const previousSelections = this.lfos.map(lfo => [
            lfo.destinations[0].id,
            lfo.destinations[1].id
        ]);

        // Rebuild destination list
        this.collectAllDestinations(voices);

        // Restore selections where possible
        this.lfos.forEach((lfo, lfoIdx) => {
            previousSelections[lfoIdx].forEach((destId, slot) => {
                if (destId) {
                    const dest = this.findDestination(destId);
                    if (dest) {
                        lfo.setDestination(slot, dest);
                    } else {
                        // Destination no longer exists
                        lfo.clearDestination(slot);
                    }
                }
            });
        });
    }

    // Get state for all LFOs
    getState() {
        return {
            bpm: this.bpm,
            lfos: this.lfos.map(lfo => lfo.getState())
        };
    }

    // Dispose all LFOs
    dispose() {
        for (const lfo of this.lfos) {
            lfo.dispose();
        }
        this.lfos = [];
        this.availableDestinations = [];
    }
}

// Factory function
export function createLFOBank(ctx, numLFOs = 12) {
    return new LFOBank(ctx, numLFOs);
}
