// PITCH BUS
// Central pitch control for each voice
// Receives pitch from the pattern engine, outputs frequency to oscillators

import { SCALES, midiToFreq, scaleDegreeToMidi, quantizeToScale } from './scales.js';

export class PitchBus {
    constructor(audioContext, options = {}) {
        this.ctx = audioContext;

        // Harmonic field parameters
        this.rootMidi = options.rootMidi || 48; // C3
        this.scale = options.scale || SCALES.major;
        this.useJustIntonation = options.useJust || false;

        // Voice range (in scale degrees from root)
        this.rangeMin = options.rangeMin || 0;
        this.rangeMax = options.rangeMax || 14; // Two octaves

        // Current state
        this.currentDegree = 0;
        this.currentMidi = this.rootMidi;
        this.currentFreq = midiToFreq(this.rootMidi);

        // Portamento/glide settings
        this.glideTime = options.glideTime || 0.02; // 20ms default

        // Frequency outputs - can connect multiple oscillators
        this.outputs = [];

        // Callbacks for when pitch changes
        this.onPitchChange = options.onPitchChange || null;
    }

    // Register an oscillator's frequency param to receive pitch updates
    registerOutput(freqParam) {
        if (freqParam && typeof freqParam.setTargetAtTime === 'function') {
            this.outputs.push(freqParam);
            // Initialize to current frequency
            freqParam.setTargetAtTime(this.currentFreq, this.ctx.currentTime, 0.001);
        }
    }

    // Unregister an output
    unregisterOutput(freqParam) {
        const index = this.outputs.indexOf(freqParam);
        if (index > -1) {
            this.outputs.splice(index, 1);
        }
    }

    // Set pitch by scale degree
    setDegree(degree, glide = true) {
        // Clamp to range
        const clampedDegree = Math.max(this.rangeMin, Math.min(this.rangeMax, degree));
        this.currentDegree = clampedDegree;

        // Convert to MIDI
        this.currentMidi = scaleDegreeToMidi(clampedDegree, this.rootMidi, this.scale);

        // Convert to frequency
        if (this.useJustIntonation) {
            this.currentFreq = this._calculateJustFreq(this.currentMidi);
        } else {
            this.currentFreq = midiToFreq(this.currentMidi);
        }

        // Update all outputs
        this._updateOutputs(glide);

        // Callback
        if (this.onPitchChange) {
            this.onPitchChange(this.currentFreq, this.currentMidi, this.currentDegree);
        }

        return this.currentFreq;
    }

    // Set pitch by MIDI note (quantized to scale)
    setMidi(midi, glide = true) {
        // Quantize to scale
        const offsetFromRoot = ((midi - this.rootMidi) % 12 + 12) % 12;
        let closestDegree = 0;
        let minDistance = 12;

        for (let i = 0; i < this.scale.length; i++) {
            const distance = Math.min(
                Math.abs(offsetFromRoot - this.scale[i]),
                Math.abs(offsetFromRoot - this.scale[i] + 12),
                Math.abs(offsetFromRoot - this.scale[i] - 12)
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestDegree = i;
            }
        }

        const octaveOffset = Math.floor((midi - this.rootMidi) / 12);
        const fullDegree = closestDegree + octaveOffset * this.scale.length;

        return this.setDegree(fullDegree, glide);
    }

    // Set pitch by raw frequency (quantized to scale)
    setFrequency(freq, glide = true) {
        const quantizedFreq = quantizeToScale(freq, this.rootMidi, this.scale, this.useJustIntonation);
        this.currentFreq = quantizedFreq;

        // Update all outputs
        this._updateOutputs(glide);

        return this.currentFreq;
    }

    // Set root note
    setRoot(midi) {
        this.rootMidi = midi;
        // Recalculate current frequency with new root
        this.setDegree(this.currentDegree, false);
    }

    // Set scale
    setScale(scaleName) {
        if (SCALES[scaleName]) {
            this.scale = SCALES[scaleName];
            // Recalculate current frequency with new scale
            this.setDegree(this.currentDegree, false);
        }
    }

    // Set custom scale
    setCustomScale(intervals) {
        if (Array.isArray(intervals) && intervals.length > 0) {
            this.scale = intervals.sort((a, b) => a - b);
            this.setDegree(this.currentDegree, false);
        }
    }

    // Set range
    setRange(min, max) {
        this.rangeMin = min;
        this.rangeMax = max;
        // Re-clamp current degree
        this.setDegree(this.currentDegree, false);
    }

    // Set glide time
    setGlideTime(seconds) {
        this.glideTime = Math.max(0.001, seconds);
    }

    // Toggle just intonation
    setJustIntonation(useJust) {
        this.useJustIntonation = useJust;
        this.setDegree(this.currentDegree, false);
    }

    // Get current state
    getState() {
        return {
            frequency: this.currentFreq,
            midi: this.currentMidi,
            degree: this.currentDegree,
            root: this.rootMidi,
            scale: this.scale,
            range: [this.rangeMin, this.rangeMax]
        };
    }

    // Move by interval (in scale degrees)
    transpose(degreeDelta, glide = true) {
        return this.setDegree(this.currentDegree + degreeDelta, glide);
    }

    // Move by semitones (will quantize)
    transposeSemitones(semitones, glide = true) {
        return this.setMidi(this.currentMidi + semitones, glide);
    }

    // Get frequency for a degree without setting it
    peekDegree(degree) {
        const midi = scaleDegreeToMidi(degree, this.rootMidi, this.scale);
        if (this.useJustIntonation) {
            return this._calculateJustFreq(midi);
        }
        return midiToFreq(midi);
    }

    // Internal: update all registered outputs
    _updateOutputs(glide) {
        const time = this.ctx.currentTime;
        const glideTime = glide ? this.glideTime : 0.001;

        for (const param of this.outputs) {
            try {
                param.setTargetAtTime(this.currentFreq, time, glideTime);
            } catch (e) {
                // Param may have been disconnected
                console.warn('Failed to update pitch output:', e);
            }
        }
    }

    // Internal: calculate just intonation frequency
    _calculateJustFreq(midi) {
        const rootFreq = midiToFreq(this.rootMidi);
        const semitones = midi - this.rootMidi;
        const octaves = Math.floor(semitones / 12);
        const remainder = ((semitones % 12) + 12) % 12;

        // Just intonation ratios for each semitone
        const justRatios = [1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8];

        return rootFreq * justRatios[remainder] * Math.pow(2, octaves);
    }

    // Cleanup
    dispose() {
        this.outputs = [];
        this.onPitchChange = null;
    }
}

// Factory for creating a pitch bus with common configurations
export function createPitchBus(audioContext, config = {}) {
    const defaults = {
        rootMidi: 48,
        scale: SCALES.major,
        useJust: false,
        rangeMin: 0,
        rangeMax: 14,
        glideTime: 0.02
    };

    return new PitchBus(audioContext, { ...defaults, ...config });
}
