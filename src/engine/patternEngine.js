// PATTERN ENGINE
// Generates trill and arpeggio patterns for each voice
// Outputs scale degrees to the pitch bus

export const PATTERN_SHAPES = {
    // Trill patterns (2-note alternations)
    trillStrict: {
        name: 'Strict Trill',
        generate: (degrees) => {
            const [a, b] = degrees.slice(0, 2);
            return [a, b];
        },
        traverse: 'alternate'
    },

    trillBiased: {
        name: 'Biased Trill',
        generate: (degrees) => {
            const [a, b] = degrees.slice(0, 2);
            return [a, b, b, a];
        },
        traverse: 'loop'
    },

    trillBreathing: {
        name: 'Breathing Trill',
        generate: (degrees) => {
            const [a, b] = degrees.slice(0, 2);
            return [a, a, b, a, a, b];
        },
        traverse: 'loop'
    },

    trillAccelerate: {
        name: 'Accelerating Trill',
        generate: (degrees) => {
            const [a, b] = degrees.slice(0, 2);
            return [a, a, a, b, a, a, b, a, b, a, b, a, b];
        },
        traverse: 'loop'
    },

    // 3-note patterns
    threeNote: {
        name: 'Three Note',
        generate: (degrees) => degrees.slice(0, 3),
        traverse: 'loop'
    },

    threeNoteReverse: {
        name: 'Three Note Reverse',
        generate: (degrees) => {
            const d = degrees.slice(0, 3);
            return [...d, ...d.slice().reverse().slice(1)];
        },
        traverse: 'loop'
    },

    // 4-note patterns
    fourNote: {
        name: 'Four Note',
        generate: (degrees) => degrees.slice(0, 4),
        traverse: 'loop'
    },

    fourNoteAlbertiBass: {
        name: 'Alberti Bass',
        generate: (degrees) => {
            const [a, b, c, d] = degrees.slice(0, 4);
            return [a, c, b, c];
        },
        traverse: 'loop'
    },

    // 5-note patterns (Glass-style)
    fiveNote: {
        name: 'Five Note',
        generate: (degrees) => degrees.slice(0, 5),
        traverse: 'loop'
    },

    fiveNoteGlass: {
        name: 'Glass Five',
        generate: (degrees) => {
            const d = degrees.slice(0, 5);
            return [d[0], d[1], d[2], d[3], d[2], d[1]];
        },
        traverse: 'loop'
    },

    // Arpeggio traversals
    arpUp: {
        name: 'Arp Up',
        generate: (degrees) => degrees,
        traverse: 'loop'
    },

    arpDown: {
        name: 'Arp Down',
        generate: (degrees) => [...degrees].reverse(),
        traverse: 'loop'
    },

    arpUpDown: {
        name: 'Arp Up-Down',
        generate: (degrees) => {
            if (degrees.length <= 2) return degrees;
            return [...degrees, ...degrees.slice(1, -1).reverse()];
        },
        traverse: 'loop'
    },

    arpDownUp: {
        name: 'Arp Down-Up',
        generate: (degrees) => {
            const rev = [...degrees].reverse();
            if (rev.length <= 2) return rev;
            return [...rev, ...rev.slice(1, -1).reverse()];
        },
        traverse: 'loop'
    },

    arpRandom: {
        name: 'Random',
        generate: (degrees) => degrees,
        traverse: 'random'
    },

    arpRandomWalk: {
        name: 'Random Walk',
        generate: (degrees) => degrees,
        traverse: 'randomWalk'
    },

    // Reich-style phasing patterns
    reichPhase: {
        name: 'Reich Phase',
        generate: (degrees) => degrees.slice(0, Math.min(8, degrees.length)),
        traverse: 'loop'
    },

    // Fibonacci-based pattern
    fibonacciStep: {
        name: 'Fibonacci',
        generate: (degrees) => {
            const fib = [0, 1];
            while (fib.length < degrees.length) {
                fib.push((fib[fib.length - 1] + fib[fib.length - 2]) % degrees.length);
            }
            return fib.map(i => degrees[i % degrees.length]);
        },
        traverse: 'loop'
    },

    // Euclidean-inspired patterns
    euclidean: {
        name: 'Euclidean',
        generate: (degrees, params = {}) => {
            const steps = params.steps || 8;
            const hits = params.hits || Math.min(3, degrees.length);

            const pattern = [];
            let bucket = 0;

            for (let i = 0; i < steps; i++) {
                bucket += hits;
                if (bucket >= steps) {
                    bucket -= steps;
                    pattern.push(degrees[pattern.filter(d => d !== null).length % degrees.length]);
                } else {
                    pattern.push(null); // Rest
                }
            }
            return pattern;
        },
        traverse: 'loop'
    }
};

export class PatternEngine {
    constructor(pitchBus, options = {}) {
        this.pitchBus = pitchBus;

        // Pattern configuration
        this.patternShape = options.patternShape || 'trillStrict';
        this.baseDegree = options.baseDegree || 0;

        // Interval spread (determines which degrees are in the pattern)
        this.intervalSpread = options.intervalSpread || [0, 2]; // Default: trill on neighboring scale degrees

        // Custom degree pool (if not using intervalSpread)
        this.customDegrees = options.customDegrees || null;

        // Pattern state
        this.pattern = [];
        this.patternIndex = 0;
        this.randomWalkPosition = 0;

        // Timing
        this.stepRate = options.stepRate || 8; // Steps per beat
        this.lastStepTime = 0;

        // Gate/envelope
        this.gateLength = options.gateLength || 0.8; // 80% of step duration
        this.accentPattern = options.accentPattern || null;
        this.accentStrength = options.accentStrength || 1.3;

        // Direction for patterns that support it
        this.direction = 1; // 1 = forward, -1 = backward

        // Generate initial pattern
        this._generatePattern();
    }

    // Set pattern shape
    // preservePosition: if true, tries to maintain playback position after regeneration
    setPatternShape(shapeName, preservePosition = false) {
        if (PATTERN_SHAPES[shapeName]) {
            const oldIndex = this.patternIndex;
            const oldLength = this.pattern.length;
            this.patternShape = shapeName;
            this._generatePattern();

            if (preservePosition && oldLength > 0 && this.pattern.length > 0) {
                // Map old position to new pattern proportionally
                const progress = oldIndex / oldLength;
                this.patternIndex = Math.floor(progress * this.pattern.length);
            }
        }
    }

    // Set base degree (pattern root)
    setBaseDegree(degree, preservePosition = false) {
        const oldIndex = this.patternIndex;
        const oldLength = this.pattern.length;
        this.baseDegree = degree;
        this._generatePattern();

        if (preservePosition && oldLength > 0 && this.pattern.length > 0) {
            const progress = oldIndex / oldLength;
            this.patternIndex = Math.floor(progress * this.pattern.length);
        }
    }

    // Set interval spread
    setIntervalSpread(intervals, preservePosition = false) {
        const oldIndex = this.patternIndex;
        const oldLength = this.pattern.length;
        this.intervalSpread = intervals;
        this.customDegrees = null;
        this._generatePattern();

        if (preservePosition && oldLength > 0 && this.pattern.length > 0) {
            const progress = oldIndex / oldLength;
            this.patternIndex = Math.floor(progress * this.pattern.length);
        }
    }

    // Set custom degrees
    setCustomDegrees(degrees) {
        this.customDegrees = degrees;
        this._generatePattern();
    }

    // Set step rate
    setStepRate(rate) {
        this.stepRate = rate;
    }

    // Set gate length
    setGateLength(length) {
        this.gateLength = Math.max(0.1, Math.min(1, length));
    }

    // Set accent pattern (array of accent multipliers)
    setAccentPattern(pattern) {
        this.accentPattern = pattern;
    }

    // Expand interval spread (for X-axis gesture)
    expandSpread(amount) {
        if (this.intervalSpread.length >= 2) {
            // Expand from center
            const expanded = this.intervalSpread.map((interval, i) => {
                const sign = interval >= 0 ? 1 : -1;
                return interval + Math.round(amount * sign * (i + 1) * 0.5);
            });
            this.setIntervalSpread(expanded);
        }
    }

    // Compress interval spread
    compressSpread(amount) {
        if (this.intervalSpread.length >= 2) {
            // Compress towards center
            const center = this.intervalSpread.reduce((a, b) => a + b, 0) / this.intervalSpread.length;
            const compressed = this.intervalSpread.map(interval => {
                return Math.round(interval + (center - interval) * amount);
            });
            this.setIntervalSpread(compressed);
        }
    }

    // Morph pattern complexity (0-1)
    setComplexity(complexity) {
        // Map complexity to pattern shapes
        const patterns = [
            'trillStrict',      // 0.0 - 0.15
            'trillBiased',      // 0.15 - 0.3
            'threeNote',        // 0.3 - 0.45
            'fourNote',         // 0.45 - 0.6
            'fiveNoteGlass',    // 0.6 - 0.75
            'arpUpDown',        // 0.75 - 0.9
            'fibonacciStep'     // 0.9 - 1.0
        ];

        const index = Math.min(patterns.length - 1, Math.floor(complexity * patterns.length));
        this.setPatternShape(patterns[index]);

        // Also adjust interval spread based on complexity
        const noteCount = 2 + Math.floor(complexity * 4);
        const spread = [];
        for (let i = 0; i < noteCount; i++) {
            spread.push(Math.round(i * (1 + complexity * 2)));
        }
        this.setIntervalSpread(spread);
    }

    // Step the pattern forward and return next degree
    step(time) {
        if (this.pattern.length === 0) return null;

        const shape = PATTERN_SHAPES[this.patternShape];
        let nextDegree;

        switch (shape.traverse) {
            case 'alternate':
                nextDegree = this.pattern[this.patternIndex % 2];
                this.patternIndex++;
                break;

            case 'random':
                nextDegree = this.pattern[Math.floor(Math.random() * this.pattern.length)];
                break;

            case 'randomWalk':
                // Move randomly to adjacent pattern position
                const delta = Math.random() < 0.5 ? -1 : 1;
                this.randomWalkPosition = Math.max(0, Math.min(this.pattern.length - 1,
                    this.randomWalkPosition + delta));
                nextDegree = this.pattern[this.randomWalkPosition];
                break;

            case 'loop':
            default:
                nextDegree = this.pattern[this.patternIndex % this.pattern.length];
                this.patternIndex = (this.patternIndex + this.direction + this.pattern.length) % this.pattern.length;
                break;
        }

        // Handle rests (null values)
        if (nextDegree === null) {
            return { degree: null, isRest: true };
        }

        // Calculate accent
        let accent = 1;
        if (this.accentPattern) {
            accent = this.accentPattern[this.patternIndex % this.accentPattern.length] || 1;
        }

        return {
            degree: nextDegree,
            isRest: false,
            accent: accent,
            gateLength: this.gateLength
        };
    }

    // Reset pattern to beginning
    reset() {
        this.patternIndex = 0;
        this.randomWalkPosition = Math.floor(this.pattern.length / 2);
    }

    // Reverse direction
    reverse() {
        this.direction *= -1;
    }

    // Get current pattern
    getPattern() {
        return [...this.pattern];
    }

    // Get pattern state for display
    getState() {
        return {
            shape: this.patternShape,
            pattern: this.pattern,
            index: this.patternIndex,
            baseDegree: this.baseDegree,
            intervalSpread: this.intervalSpread,
            stepRate: this.stepRate,
            gateLength: this.gateLength
        };
    }

    // Internal: generate pattern from current settings
    _generatePattern() {
        // Determine which degrees to use
        let degrees;

        if (this.customDegrees) {
            degrees = this.customDegrees;
        } else {
            degrees = this.intervalSpread.map(interval => this.baseDegree + interval);
        }

        // Get pattern generator
        const shape = PATTERN_SHAPES[this.patternShape];
        if (shape) {
            this.pattern = shape.generate(degrees);
        } else {
            this.pattern = degrees;
        }

        // Reset index when pattern changes
        this.patternIndex = 0;
        this.randomWalkPosition = Math.floor(this.pattern.length / 2);
    }
}

// Preset pattern configurations
export const PATTERN_PRESETS = {
    simpleTrill: {
        patternShape: 'trillStrict',
        intervalSpread: [0, 2],
        stepRate: 16
    },

    wideTrill: {
        patternShape: 'trillStrict',
        intervalSpread: [0, 7],
        stepRate: 12
    },

    glassArpeggio: {
        patternShape: 'fiveNoteGlass',
        intervalSpread: [0, 2, 4, 7, 9],
        stepRate: 8
    },

    triadic: {
        patternShape: 'arpUpDown',
        intervalSpread: [0, 2, 4],
        stepRate: 8
    },

    openVoicing: {
        patternShape: 'fourNote',
        intervalSpread: [0, 7, 12, 14],
        stepRate: 6
    },

    reichPattern: {
        patternShape: 'reichPhase',
        intervalSpread: [0, 2, 3, 5, 7, 8, 10, 12],
        stepRate: 10
    },

    minimalTrill: {
        patternShape: 'trillBreathing',
        intervalSpread: [0, 1],
        stepRate: 12
    },

    cascading: {
        patternShape: 'arpDown',
        intervalSpread: [14, 12, 9, 7, 4, 2, 0],
        stepRate: 8
    }
};

// Factory function
export function createPatternEngine(pitchBus, presetName = null, options = {}) {
    const preset = presetName && PATTERN_PRESETS[presetName]
        ? { ...PATTERN_PRESETS[presetName], ...options }
        : options;

    return new PatternEngine(pitchBus, preset);
}
