// POLYMETRIC CLOCK SYSTEM
// Master clock with per-voice phase-shiftable divisions
// Supports polymetric relationships (3:4:5, etc.)

export class MasterClock {
    constructor(audioContext, options = {}) {
        this.ctx = audioContext;

        // Master tempo
        this.bpm = options.bpm || 120;

        // Bar length in beats
        this.beatsPerBar = options.beatsPerBar || 4;

        // Master bar duration (all voices align every N bars)
        this.alignmentBars = options.alignmentBars || 4;

        // Clock state
        this.isRunning = false;
        this.startTime = 0;
        this.elapsedBeats = 0;

        // Registered voices
        this.voices = [];

        // Callbacks
        this.onBeat = options.onBeat || null;
        this.onBar = options.onBar || null;
        this.onAlignment = options.onAlignment || null;

        // Scheduler
        this.schedulerInterval = null;
        this.scheduleAheadTime = 0.1; // Look ahead 100ms
        this.schedulerResolution = 25; // Check every 25ms

        // Last scheduled times per voice
        this.lastScheduledBeat = {};
    }

    // Get beat duration in seconds
    get beatDuration() {
        return 60 / this.bpm;
    }

    // Get bar duration in seconds
    get barDuration() {
        return this.beatDuration * this.beatsPerBar;
    }

    // Get alignment duration (when all voices sync)
    get alignmentDuration() {
        return this.barDuration * this.alignmentBars;
    }

    // Set BPM
    setBpm(bpm) {
        this.bpm = Math.max(20, Math.min(300, bpm));
    }

    // Register a voice clock
    registerVoice(voiceId, config = {}) {
        const voiceClock = new VoiceClock(this, voiceId, config);
        this.voices.push(voiceClock);
        this.lastScheduledBeat[voiceId] = -1;
        return voiceClock;
    }

    // Unregister a voice
    unregisterVoice(voiceId) {
        const index = this.voices.findIndex(v => v.id === voiceId);
        if (index > -1) {
            this.voices.splice(index, 1);
            delete this.lastScheduledBeat[voiceId];
        }
    }

    // Get voice by ID
    getVoice(voiceId) {
        return this.voices.find(v => v.id === voiceId);
    }

    // Start the clock (or resume from pause)
    start() {
        if (this.isRunning) return;

        this.isRunning = true;

        // If we have saved elapsed beats (from pause), resume from that position
        // Otherwise start fresh
        if (this.elapsedBeats > 0) {
            // Resume: adjust startTime so getCurrentBeat() returns correct position
            this.startTime = this.ctx.currentTime - (this.elapsedBeats * this.beatDuration);
        } else {
            // Fresh start
            this.startTime = this.ctx.currentTime;
        }

        // Reset voice scheduling state so they pick up from current position
        for (const voice of this.voices) {
            voice.lastScheduledBeat = -1;
        }

        // Start scheduler
        this._startScheduler();
    }

    // Stop the clock (saves position for resume)
    stop() {
        if (this.isRunning) {
            // Save current position before stopping
            this.elapsedBeats = this.getCurrentBeat();
        }

        this.isRunning = false;

        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
    }

    // Pause (alias for stop - maintains position)
    pause() {
        this.stop();
    }

    // Reset to beginning (hard reset)
    reset() {
        const wasRunning = this.isRunning;

        // Stop without saving position
        this.isRunning = false;
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }

        // Reset all state
        this.elapsedBeats = 0;
        this.startTime = this.ctx.currentTime;

        for (const voiceId of Object.keys(this.lastScheduledBeat)) {
            this.lastScheduledBeat[voiceId] = -1;
        }

        for (const voice of this.voices) {
            voice.reset();
        }

        if (wasRunning) {
            this.start();
        }
    }

    // Get current beat position
    getCurrentBeat() {
        if (!this.isRunning) return this.elapsedBeats;

        const elapsed = this.ctx.currentTime - this.startTime;
        return elapsed / this.beatDuration;
    }

    // Get current bar position
    getCurrentBar() {
        return Math.floor(this.getCurrentBeat() / this.beatsPerBar);
    }

    // Get position within current bar (0-1)
    getBarPosition() {
        const beat = this.getCurrentBeat();
        return (beat % this.beatsPerBar) / this.beatsPerBar;
    }

    // Convert beat to audio time
    beatToTime(beat) {
        return this.startTime + beat * this.beatDuration;
    }

    // Schedule all voices
    _startScheduler() {
        this.schedulerInterval = setInterval(() => {
            this._schedule();
        }, this.schedulerResolution);
    }

    // Main scheduling loop
    _schedule() {
        if (!this.isRunning) return;

        const currentTime = this.ctx.currentTime;
        const scheduleUntil = currentTime + this.scheduleAheadTime;

        for (const voice of this.voices) {
            voice._scheduleEvents(currentTime, scheduleUntil);
        }

        // Update elapsed beats
        this.elapsedBeats = this.getCurrentBeat();

        // Check for master events
        this._checkMasterEvents();
    }

    // Check for bar/alignment events
    _checkMasterEvents() {
        const currentBeat = this.getCurrentBeat();
        const currentBar = Math.floor(currentBeat / this.beatsPerBar);
        const alignmentBar = Math.floor(currentBar / this.alignmentBars);

        // These would trigger callbacks (for visual sync, etc.)
        // In practice, you'd want to debounce these
    }

    // Get sync info for all voices
    getSyncInfo() {
        return {
            bpm: this.bpm,
            beat: this.getCurrentBeat(),
            bar: this.getCurrentBar(),
            barPosition: this.getBarPosition(),
            isRunning: this.isRunning,
            voices: this.voices.map(v => v.getState())
        };
    }
}

export class VoiceClock {
    constructor(masterClock, id, options = {}) {
        this.master = masterClock;
        this.id = id;

        // Division/multiplier relative to master beat
        // 1 = quarter notes, 2 = eighth notes, 0.5 = half notes
        // Can be fractional for polymetric: 3/4, 5/4, etc.
        this.division = options.division || 1;

        // Micro-phase offset (0-1, portion of one division)
        this.phaseOffset = options.phaseOffset || 0;

        // Step callback
        this.onStep = options.onStep || null;

        // State - track last scheduled BEAT (not step) for continuity across division changes
        this.lastScheduledBeat = -1;
        this.isMuted = false;

        // Swing (0-1, 0 = straight, 0.5 = maximum swing)
        this.swing = options.swing || 0;

        // Accent pattern (optional)
        this.accentPattern = options.accentPattern || null;
    }

    // Set division - recalculate scheduling state to maintain continuity
    setDivision(division) {
        const newDivision = Math.max(0.125, Math.min(16, division));
        // No need to recalculate - we track by beat time now, not step number
        this.division = newDivision;
    }

    // Set phase offset
    setPhaseOffset(offset) {
        this.phaseOffset = ((offset % 1) + 1) % 1;
    }

    // Nudge phase (for Glass-like rippling)
    nudgePhase(amount) {
        this.setPhaseOffset(this.phaseOffset + amount);
    }

    // Set swing
    setSwing(swing) {
        this.swing = Math.max(0, Math.min(0.5, swing));
    }

    // Mute/unmute
    setMuted(muted) {
        this.isMuted = muted;
    }

    // Get current step number
    getCurrentStep() {
        const masterBeat = this.master.getCurrentBeat();
        return Math.floor((masterBeat + this.phaseOffset) * this.division);
    }

    // Get step duration in seconds
    get stepDuration() {
        return this.master.beatDuration / this.division;
    }

    // Reset
    reset() {
        this.lastScheduledBeat = -1;
    }

    // Get state
    getState() {
        return {
            id: this.id,
            division: this.division,
            phaseOffset: this.phaseOffset,
            currentStep: this.getCurrentStep(),
            isMuted: this.isMuted,
            swing: this.swing
        };
    }

    // Internal: schedule events
    // KEY FIX: Track scheduling by beat time, not step number
    // This allows division changes without breaking the schedule
    _scheduleEvents(currentTime, scheduleUntil) {
        if (this.isMuted || !this.onStep) return;

        const masterBeat = this.master.getCurrentBeat();
        const stepDuration = this.stepDuration;
        const stepInterval = 1 / this.division; // Beat interval between steps

        // Find the next beat time we need to schedule
        let nextBeat;
        if (this.lastScheduledBeat < 0) {
            // First run - start from current position, quantized to step grid
            const currentBeatInPhase = masterBeat + this.phaseOffset;
            const currentStepFloat = currentBeatInPhase * this.division;
            const nextStepNum = Math.floor(currentStepFloat);
            nextBeat = (nextStepNum / this.division) - this.phaseOffset;
        } else {
            // Continue from last scheduled beat
            nextBeat = this.lastScheduledBeat + stepInterval;

            // If we've fallen behind (e.g., division changed), catch up
            const minBeat = masterBeat - 0.1; // Allow slight lookback
            if (nextBeat < minBeat) {
                const currentBeatInPhase = masterBeat + this.phaseOffset;
                const currentStepFloat = currentBeatInPhase * this.division;
                const nextStepNum = Math.floor(currentStepFloat);
                nextBeat = (nextStepNum / this.division) - this.phaseOffset;
            }
        }

        // Schedule all steps until scheduleUntil
        let scheduledCount = 0;
        const maxSchedule = 50; // Safety limit

        while (scheduledCount < maxSchedule) {
            const stepTime = this.master.beatToTime(nextBeat);

            if (stepTime >= scheduleUntil) break;

            // Schedule if in the future (or very close to now)
            if (stepTime >= currentTime - 0.01) {
                // Calculate step number for accent pattern
                const stepNum = Math.round((nextBeat + this.phaseOffset) * this.division);

                // Apply swing (delay odd steps for shuffle feel)
                let actualStepTime = stepTime;
                if (this.swing > 0 && stepNum % 2 === 1) {
                    actualStepTime += stepDuration * this.swing;
                }

                // Calculate accent
                let accent = 1;
                if (this.accentPattern) {
                    accent = this.accentPattern[stepNum % this.accentPattern.length] || 1;
                }

                // Trigger callback
                this.onStep({
                    time: Math.max(actualStepTime, currentTime),
                    step: stepNum,
                    duration: stepDuration,
                    accent: accent,
                    voiceId: this.id
                });

                scheduledCount++;
            }

            this.lastScheduledBeat = nextBeat;
            nextBeat += stepInterval;
        }
    }
}

// Common polymetric configurations
// Values are division multipliers (higher = faster notes)
export const POLYMETRIC_PRESETS = {
    // Standard - all voices at same rate
    unison: [1, 1, 1],
    doubled: [2, 2, 2],
    quadrupled: [4, 4, 4],

    // Simple polymetric - classic ratios
    threeAgainstTwo: [1, 1.5, 1],        // Middle voice in triplets
    fourAgainstThree: [1, 0.75, 1],      // 4:3 polyrhythm
    fiveAgainstFour: [1, 1.25, 1],       // 5:4 creates tension

    // Glass-style - same rate, phase creates cascade
    glassCascade: [1, 1, 1],
    glassRipple: [2, 2, 2],
    glassFlow: [1.5, 1.5, 1.5],          // Dotted quarter feel

    // Complex polymetric - multiple ratios
    polymetric345: [0.75, 1, 1.25],      // 3:4:5 simultaneous
    polymetric567: [1.25, 1.5, 1.75],    // 5:6:7 dense
    africanBell: [1, 1.5, 2],            // Bell pattern inspired

    // Reich phasing - imperceptible drift
    reichPhase: [1, 1.002, 1],           // Slowly drifting center
    reichDrift: [1, 1.001, 1.003],       // All three drift

    // Triplet patterns
    triplets: [1.5, 1.5, 1.5],
    tripletAgainstDuple: [1, 1.5, 2],    // Quarter, triplet, eighth
    hemiola: [1, 1.5, 1],                // Classic hemiola

    // Minimalist - layered rates
    layered123: [0.5, 1, 2],             // Half, quarter, eighth
    layered234: [1, 1.5, 2],             // Stacked density
    layered135: [0.5, 1.5, 2.5],         // Wide spread

    // Floe-inspired - flowing arpeggios
    floeA: [1, 1.25, 1.5],               // Gradual acceleration
    floeB: [2, 1.75, 1.5],               // Gradual deceleration
    floeC: [1, 2, 1],                    // Fast center voice

    // Experimental
    fibonacci: [1, 1.618, 2.618],        // Golden ratio
    primes: [1, 1.5, 2.5],               // 2:3:5 ratio
    euclidean: [1, 1.333, 1.666]         // Even distribution
};

// Phase offset presets for cascade effects
// Values are beat offsets (0-1 = one beat)
export const PHASE_PRESETS = {
    locked: [0, 0, 0],                   // All voices exactly locked - no drift
    unison: [0, 0, 0],                   // All together (alias for locked)
    ripple: [0, 0.125, 0.25],            // Gentle stagger
    cascade: [0, 0.333, 0.666],          // Even thirds
    spread: [0, 0.25, 0.5],              // Quarter beat spread
    tight: [0, 0.0625, 0.125],           // Very close (16th note)

    // Musical phase patterns
    offbeat: [0, 0.5, 0],                // Center on offbeat
    syncopated: [0, 0.25, 0.75],         // Syncopated feel
    hocket: [0, 0.333, 0.666],           // Medieval hocket style
    swing: [0, 0.1, 0.2],                // Slight swing feel

    // Reich-inspired
    reichA: [0, 0.01, 0.02],             // Barely perceptible
    reichB: [0, 0.05, 0.1],              // Slow canon
    canon: [0, 0.5, 1],                  // Full beat offset

    // Floe-style
    floeRipple: [0, 0.083, 0.166],       // Sixteenth note cascade
    floeWave: [0, 0.167, 0.333]          // Eighth note wave
};

// Factory function
export function createClockSystem(audioContext, options = {}) {
    return new MasterClock(audioContext, options);
}
