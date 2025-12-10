// PATCH GENERATOR
// Generates random but musically-biased patches for voices
// Follows the "melodic-safe" approach to maintain tonal clarity

import { MODULE_TYPES, getModulesByCategory } from '../engine/modules.js';
import { PATTERN_PRESETS } from '../engine/patternEngine.js';

// Oscillators suitable for melodic/tonal use (pitch-trackable)
const MELODIC_OSCILLATORS = [
    'sineOsc',
    'triangleOsc',
    'harmonicOsc',
    'oddHarmonicOsc',
    'perfectOsc',
    'additiveOsc',
    'fmOsc',
    'formantOsc',
    'phasingPair',
    'droneOsc'
];

// Buchla/West Coast style oscillators - plucky, sizzling, complex
const BUCHLA_OSCILLATORS = [
    'buchlaComplex',
    'buchlaLPG',
    'buchlaBongo',
    'sizzleOsc',
    'westCoastDual',
    'vactrolOsc'
];

// Oscillators for occasional color (use sparingly)
const COLOR_OSCILLATORS = [
    'sawOsc',
    'squareOsc',
    'pulseOsc',
    'superSaw',
    'bellOsc',
    'subOsc'
];

// Oscillators to avoid for melodic voices (too noisy/chaotic)
const AVOID_OSCILLATORS = [
    'chaosOsc',
    'metallicOsc',
    'noiseWhite',
    'noisePink',
    'noiseBrown'
];

// Filter types by character
const FILTERS = {
    toneShaping: ['filterLP', 'filterSVF', 'filterResonant'],
    color: ['filterBP', 'filterHP', 'filterPeak', 'filterNotch'],
    special: ['combFilter', 'allpassFilter']
};

// Effects by type
const EFFECTS = {
    tape: ['tapeWobble', 'tapeLoss'],
    delay: ['delayShort', 'delayLong', 'delayPingPong'],
    saturation: ['softClip', 'distortion'],
    space: ['convolver', 'feedbackLoop']
};

// Spatial processors
const SPATIAL = ['panner', 'autoPanner', 'stereoWidener'];

// Modulators (for subtle movement)
const MODULATORS = {
    slow: ['lfoGlacial', 'lfoSmooth'],
    medium: ['lfoSine', 'lfoSaw'],
    fast: ['lfoFast'],
    chaotic: ['lfoChaotic', 'lfoRandom']
};

// Utility modules
const UTILITIES = ['vca', 'attenuator', 'limiter', 'compressor'];

// Random selection helper
function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Weighted random selection
function weightedPick(options) {
    const total = options.reduce((sum, opt) => sum + opt.weight, 0);
    let random = Math.random() * total;

    for (const opt of options) {
        random -= opt.weight;
        if (random <= 0) return opt.value;
    }

    return options[options.length - 1].value;
}

// Modulation macro presets - define different "flavors" of modulation
// Each preset defines what parameters get modulated and how
// EURORACK-STYLE: Much more aggressive and noticeable modulation
const MODULATION_PRESETS = {
    subtle: {
        name: 'Subtle Drift',
        filterMod: { depth: 0.25, rate: 0.15 },
        panMod: { depth: 0.3, rate: 0.1 },
        pitchMod: null,
        ampMod: null
    },
    shimmer: {
        name: 'Shimmer',
        filterMod: { depth: 0.5, rate: 0.6 },
        panMod: { depth: 0.5, rate: 0.35 },
        pitchMod: { depth: 0.008, rate: 0.4 }, // Noticeable vibrato
        ampMod: { depth: 0.15, rate: 4 }
    },
    pulse: {
        name: 'Pulse',
        filterMod: { depth: 0.7, rate: 2.0 }, // Fast filter sweep
        panMod: { depth: 0.2, rate: 1.0 },
        pitchMod: null,
        ampMod: { depth: 0.3, rate: 4 } // Rhythmic tremolo
    },
    organic: {
        name: 'Organic',
        filterMod: { depth: 0.6, rate: 0.08 }, // Very slow but deep
        panMod: { depth: 0.4, rate: 0.05 },
        pitchMod: { depth: 0.005, rate: 0.03 },
        ampMod: { depth: 0.1, rate: 0.2 }
    },
    wobble: {
        name: 'Wobble',
        filterMod: { depth: 0.8, rate: 4.0 }, // Dubstep-ish
        panMod: { depth: 0.3, rate: 2.0 },
        pitchMod: null,
        ampMod: { depth: 0.2, rate: 8 }
    },
    breathing: {
        name: 'Breathing',
        filterMod: { depth: 0.5, rate: 0.2 },
        panMod: { depth: 0.6, rate: 0.15 },
        pitchMod: { depth: 0.01, rate: 0.1 },
        ampMod: { depth: 0.25, rate: 0.3 } // Slow amplitude swell
    },
    chaotic: {
        name: 'Chaotic',
        filterMod: { depth: 0.6, rate: 1.3, type: 'random' },
        panMod: { depth: 0.7, rate: 0.8, type: 'random' },
        pitchMod: { depth: 0.015, rate: 0.5, type: 'random' },
        ampMod: { depth: 0.2, rate: 3, type: 'random' }
    },
    static: {
        name: 'Static',
        filterMod: null,
        panMod: null,
        pitchMod: null,
        ampMod: null
    },
    // New eurorack-inspired presets
    buchlaGate: {
        name: 'Buchla Gate',
        filterMod: { depth: 0.9, rate: 0.3 }, // Deep slow sweep
        panMod: { depth: 0.2, rate: 0.07 },
        pitchMod: null,
        ampMod: { depth: 0.4, rate: 0.5 } // Vactrol-like response
    },
    serge: {
        name: 'Serge Chaos',
        filterMod: { depth: 0.7, rate: 0.7 },
        panMod: { depth: 0.5, rate: 0.4 },
        pitchMod: { depth: 0.02, rate: 0.2 }, // Noticeable pitch wander
        ampMod: { depth: 0.15, rate: 1.5 }
    },
    glass: {
        name: 'Glass Shimmer',
        filterMod: { depth: 0.3, rate: 0.4 },
        panMod: { depth: 0.4, rate: 0.2 },
        pitchMod: { depth: 0.003, rate: 0.6 }, // Subtle chorus-like
        ampMod: null
    },
    reich: {
        name: 'Reich Phase',
        filterMod: null,
        panMod: { depth: 0.8, rate: 0.1 }, // Slow pan drift
        pitchMod: null,
        ampMod: { depth: 0.1, rate: 0.08 }
    }
};

// Get a random modulation preset
export function getRandomModulationPreset() {
    const presets = Object.keys(MODULATION_PRESETS);
    return presets[Math.floor(Math.random() * presets.length)];
}

// Generate a single voice patch with musical bias
export function generatePatch(options = {}) {
    const {
        brightness = 0.5,    // 0 = dark, 1 = bright
        complexity = 0.5,    // 0 = simple, 1 = complex
        movement = 0.5,      // 0 = static, 1 = lots of modulation
        wetness = 0.5,       // 0 = dry, 1 = lots of effects
        character = 'balanced', // 'balanced', 'organ', 'bell', 'string', 'pad', 'buchla'
        modulationPreset = null // Specific modulation preset, or null for auto
    } = options;

    const patch = {
        oscillators: [],
        filters: [],
        effects: [],
        modulators: [],
        spatial: [],
        // NEW: modulation macro settings
        modulation: {
            preset: modulationPreset || getRandomModulationPreset(),
            amount: movement, // 0-1 controls how much of the preset is applied
            settings: null // Will be populated with actual values
        }
    };

    // Apply modulation preset
    const modPreset = MODULATION_PRESETS[patch.modulation.preset] || MODULATION_PRESETS.subtle;
    patch.modulation.settings = JSON.parse(JSON.stringify(modPreset));

    // === OSCILLATORS ===
    // Pick 1-2 oscillators based on complexity
    const numOscs = complexity > 0.6 ? 2 : 1;

    // Character-based oscillator selection with more variety
    let oscPool;
    switch (character) {
        case 'organ':
            oscPool = ['harmonicOsc', 'oddHarmonicOsc', 'perfectOsc', 'additiveOsc'];
            break;
        case 'bell':
            oscPool = ['bellOsc', 'fmOsc', 'additiveOsc', 'buchlaComplex'];
            break;
        case 'string':
            oscPool = ['sawOsc', 'superSaw', 'formantOsc', 'sizzleOsc'];
            break;
        case 'pad':
            oscPool = ['droneOsc', 'phasingPair', 'sineOsc', 'triangleOsc', 'vactrolOsc'];
            break;
        case 'buchla':
            oscPool = BUCHLA_OSCILLATORS;
            break;
        case 'plucky':
            oscPool = ['buchlaLPG', 'buchlaBongo', 'bellOsc', 'fmOsc', 'westCoastDual'];
            break;
        case 'sizzle':
            oscPool = ['buchlaComplex', 'sizzleOsc', 'westCoastDual', 'fmOsc'];
            break;
        default:
            // "balanced" - truly random mix from all pools for maximum variety
            const allPools = [MELODIC_OSCILLATORS, BUCHLA_OSCILLATORS, COLOR_OSCILLATORS];
            const selectedPool = allPools[Math.floor(Math.random() * allPools.length)];
            oscPool = selectedPool;
    }

    for (let i = 0; i < numOscs; i++) {
        patch.oscillators.push({ type: pick(oscPool) });
    }

    // Occasionally add a color oscillator (low volume, blended)
    if (complexity > 0.6 && Math.random() < 0.3) {
        patch.oscillators.push({ type: pick(COLOR_OSCILLATORS), mix: 0.2 });
    }

    // === FILTERS ===
    // Always one tone-shaping filter
    patch.filters.push({ type: pick(FILTERS.toneShaping) });

    // Brightness affects filter choice
    if (brightness > 0.7) {
        // Bright: maybe add a peak filter for presence
        if (Math.random() < 0.5) {
            patch.filters.push({ type: 'filterPeak' });
        }
    } else if (brightness < 0.3) {
        // Dark: add another LP or notch
        if (Math.random() < 0.5) {
            patch.filters.push({ type: pick(['filterLP', 'filterNotch']) });
        }
    }

    // Complexity can add special filters
    if (complexity > 0.7 && Math.random() < 0.4) {
        patch.filters.push({ type: pick(FILTERS.special) });
    }

    // === EFFECTS ===
    // Tape effect for warmth (common)
    if (Math.random() < 0.6 + wetness * 0.3) {
        patch.effects.push({ type: pick(EFFECTS.tape) });
    }

    // Delay based on wetness
    if (wetness > 0.3 && Math.random() < wetness) {
        patch.effects.push({ type: pick(EFFECTS.delay) });
    }

    // Saturation (subtle)
    if (Math.random() < 0.3) {
        patch.effects.push({ type: 'softClip' }); // Prefer soft clip over hard distortion
    }

    // Convolver for space (occasional)
    if (wetness > 0.6 && Math.random() < 0.3) {
        patch.effects.push({ type: 'convolver' });
    }

    // === MODULATORS ===
    // Movement determines modulation amount
    if (movement > 0.2) {
        // Slow modulator on filter (almost always)
        patch.modulators.push({
            type: pick(MODULATORS.slow),
            target: 'filterCutoff',
            depth: 0.3 + Math.random() * 0.4
        });
    }

    if (movement > 0.5 && Math.random() < 0.5) {
        // Medium modulator
        patch.modulators.push({
            type: pick(MODULATORS.medium),
            target: 'filterCutoff',
            depth: 0.1 + Math.random() * 0.2
        });
    }

    // Chaotic modulation only for high movement
    if (movement > 0.8 && Math.random() < 0.3) {
        patch.modulators.push({
            type: pick(MODULATORS.chaotic),
            target: 'filterCutoff',
            depth: 0.05 + Math.random() * 0.1
        });
    }

    // === SPATIAL ===
    // Always some stereo interest
    const spatialChoice = weightedPick([
        { value: 'panner', weight: 3 },
        { value: 'autoPanner', weight: movement * 5 },
        { value: 'stereoWidener', weight: 2 }
    ]);
    patch.spatial.push({ type: spatialChoice });

    // === UTILITIES ===
    // Always end with limiter for safety
    patch.effects.push({ type: 'limiter' });

    return patch;
}

// Generate a complete three-voice configuration
export function generateTrioConfiguration(options = {}) {
    const {
        harmonyStyle = 'triadic',  // 'triadic', 'quartal', 'unison', 'spread'
        textureStyle = 'varied',   // 'varied', 'uniform', 'contrasting'
        rootMidi = 48,
        scaleName = 'major'
    } = options;

    // Determine voice roles based on harmony style
    let voiceRoles;
    switch (harmonyStyle) {
        case 'triadic':
            voiceRoles = ['root', 'third', 'fifth'];
            break;
        case 'quartal':
            voiceRoles = ['root', 'fourth', 'seventh'];
            break;
        case 'unison':
            voiceRoles = ['root', 'root', 'root'];
            break;
        case 'spread':
            voiceRoles = ['bass', 'mid', 'high'];
            break;
        default:
            voiceRoles = ['root', 'third', 'fifth'];
    }

    // Generate patches with varying characters - more variety
    let characters;
    const allCharacters = ['organ', 'pad', 'bell', 'string', 'buchla', 'plucky', 'sizzle', 'balanced'];
    switch (textureStyle) {
        case 'varied':
            // Pick 3 different random characters
            const shuffled = [...allCharacters].sort(() => Math.random() - 0.5);
            characters = shuffled.slice(0, 3);
            break;
        case 'uniform':
            const char = pick(allCharacters);
            characters = [char, char, char];
            break;
        case 'contrasting':
            // Ensure very different timbres
            const contrastPairs = [
                ['organ', 'buchla', 'bell'],
                ['pad', 'plucky', 'sizzle'],
                ['string', 'bell', 'buchla'],
                ['sizzle', 'organ', 'pad']
            ];
            characters = pick(contrastPairs);
            break;
        default:
            // Each voice gets a random character for maximum variety
            characters = [pick(allCharacters), pick(allCharacters), pick(allCharacters)];
    }

    const voices = [];

    for (let i = 0; i < 3; i++) {
        // Vary parameters MORE between voices for distinct sounds
        const brightness = 0.2 + Math.random() * 0.7;  // 0.2-0.9 (was 0.3-0.7)
        const complexity = 0.2 + Math.random() * 0.7;  // 0.2-0.9 (was 0.3-0.8)
        const movement = 0.1 + Math.random() * 0.8;    // 0.1-0.9 (was 0.2-0.8)
        const wetness = 0.2 + Math.random() * 0.6;     // 0.2-0.8 (was 0.3-0.7)

        // Generate patch
        const patch = generatePatch({
            brightness,
            complexity,
            movement,
            wetness,
            character: characters[i]
        });

        // Determine range based on role
        let rangeMin, rangeMax;
        switch (voiceRoles[i]) {
            case 'bass':
                rangeMin = -14;
                rangeMax = 7;
                break;
            case 'root':
                rangeMin = 0;
                rangeMax = 14;
                break;
            case 'third':
            case 'fourth':
            case 'mid':
                rangeMin = 2;
                rangeMax = 16;
                break;
            case 'fifth':
            case 'seventh':
            case 'high':
                rangeMin = 4;
                rangeMax = 21;
                break;
            default:
                rangeMin = 0;
                rangeMax = 14;
        }

        // Pick a pattern preset
        const patternPresets = Object.keys(PATTERN_PRESETS);
        const patternPreset = pick(patternPresets);

        voices.push({
            id: i,
            name: `Voice ${i + 1} (${voiceRoles[i]})`,
            patch,
            rangeMin,
            rangeMax,
            patternPreset,
            role: voiceRoles[i],
            character: characters[i]
        });
    }

    return {
        rootMidi,
        scaleName,
        voices
    };
}

// Mutate an existing patch slightly
export function mutatePatch(patch, intensity = 0.3) {
    const mutated = JSON.parse(JSON.stringify(patch)); // Deep clone

    // Possibly swap one oscillator
    if (Math.random() < intensity && mutated.oscillators.length > 0) {
        const idx = Math.floor(Math.random() * mutated.oscillators.length);
        // Mix in Buchla oscillators too
        const pool = Math.random() < 0.3 ? BUCHLA_OSCILLATORS : MELODIC_OSCILLATORS;
        mutated.oscillators[idx] = { type: pick(pool) };
    }

    // Possibly swap a filter
    if (Math.random() < intensity && mutated.filters.length > 1) {
        const idx = Math.floor(Math.random() * (mutated.filters.length - 1)); // Keep limiter
        mutated.filters[idx] = { type: pick([...FILTERS.toneShaping, ...FILTERS.color]) };
    }

    // Possibly add/remove an effect
    if (Math.random() < intensity) {
        if (mutated.effects.length > 2 && Math.random() < 0.5) {
            // Remove one (not limiter)
            const idx = Math.floor(Math.random() * (mutated.effects.length - 1));
            mutated.effects.splice(idx, 1);
        } else {
            // Add one
            const allEffects = [...EFFECTS.tape, ...EFFECTS.delay, ...EFFECTS.space];
            mutated.effects.splice(mutated.effects.length - 1, 0, { type: pick(allEffects) });
        }
    }

    // Possibly change modulation preset
    if (mutated.modulation && Math.random() < intensity * 0.5) {
        mutated.modulation.preset = getRandomModulationPreset();
        const modPreset = MODULATION_PRESETS[mutated.modulation.preset];
        mutated.modulation.settings = JSON.parse(JSON.stringify(modPreset));
    }

    return mutated;
}

// MULTI-LEVEL RANDOMIZATION
// 10% - Subtle evolution: tweak parameters, keep structure
export function evolvePatch10(patch) {
    const mutated = JSON.parse(JSON.stringify(patch));

    // Just nudge the modulation amount
    if (mutated.modulation) {
        mutated.modulation.amount = Math.max(0, Math.min(1,
            mutated.modulation.amount + (Math.random() - 0.5) * 0.2
        ));
    }

    // Maybe slightly adjust filter parameters if they exist
    if (mutated.filters && mutated.filters.length > 0) {
        // Just randomize filter Q slightly (affects resonance/character)
        mutated.filters[0].qOffset = (Math.random() - 0.5) * 2;
    }

    return mutated;
}

// 30% - Moderate evolution: may swap one component, adjust several params
export function evolvePatch30(patch) {
    const mutated = JSON.parse(JSON.stringify(patch));

    // 50% chance to swap one oscillator for similar type
    if (Math.random() < 0.5 && mutated.oscillators && mutated.oscillators.length > 0) {
        const idx = Math.floor(Math.random() * mutated.oscillators.length);
        const currentType = mutated.oscillators[idx].type;

        // Find similar oscillators (same category)
        let similarPool;
        if (BUCHLA_OSCILLATORS.includes(currentType)) {
            similarPool = BUCHLA_OSCILLATORS;
        } else if (MELODIC_OSCILLATORS.includes(currentType)) {
            similarPool = MELODIC_OSCILLATORS;
        } else {
            similarPool = COLOR_OSCILLATORS;
        }

        mutated.oscillators[idx] = { type: pick(similarPool) };
    }

    // Change modulation amount more significantly
    if (mutated.modulation) {
        mutated.modulation.amount = Math.max(0, Math.min(1,
            mutated.modulation.amount + (Math.random() - 0.5) * 0.4
        ));
    }

    // 30% chance to swap modulation preset
    if (Math.random() < 0.3 && mutated.modulation) {
        mutated.modulation.preset = getRandomModulationPreset();
        const modPreset = MODULATION_PRESETS[mutated.modulation.preset];
        mutated.modulation.settings = JSON.parse(JSON.stringify(modPreset));
    }

    // 30% chance to swap one effect
    if (Math.random() < 0.3 && mutated.effects && mutated.effects.length > 1) {
        const idx = Math.floor(Math.random() * (mutated.effects.length - 1));
        const allEffects = [...EFFECTS.tape, ...EFFECTS.delay, ...EFFECTS.saturation];
        mutated.effects[idx] = { type: pick(allEffects) };
    }

    return mutated;
}

// 60% - Significant evolution: swap multiple components, could change character
export function evolvePatch60(patch) {
    const mutated = JSON.parse(JSON.stringify(patch));

    // 70% chance to swap primary oscillator
    if (Math.random() < 0.7 && mutated.oscillators && mutated.oscillators.length > 0) {
        // Could switch between buchla and melodic
        const pool = Math.random() < 0.4 ? BUCHLA_OSCILLATORS : MELODIC_OSCILLATORS;
        mutated.oscillators[0] = { type: pick(pool) };
    }

    // 50% chance to swap or add secondary oscillator
    if (Math.random() < 0.5) {
        if (mutated.oscillators.length > 1) {
            const pool = Math.random() < 0.4 ? BUCHLA_OSCILLATORS : MELODIC_OSCILLATORS;
            mutated.oscillators[1] = { type: pick(pool) };
        } else {
            const pool = Math.random() < 0.4 ? BUCHLA_OSCILLATORS : COLOR_OSCILLATORS;
            mutated.oscillators.push({ type: pick(pool), mix: 0.3 });
        }
    }

    // Always change modulation preset
    if (mutated.modulation) {
        mutated.modulation.preset = getRandomModulationPreset();
        const modPreset = MODULATION_PRESETS[mutated.modulation.preset];
        mutated.modulation.settings = JSON.parse(JSON.stringify(modPreset));
        mutated.modulation.amount = 0.3 + Math.random() * 0.5;
    }

    // 60% chance to swap filter
    if (Math.random() < 0.6 && mutated.filters && mutated.filters.length > 0) {
        const allFilters = [...FILTERS.toneShaping, ...FILTERS.color];
        mutated.filters[0] = { type: pick(allFilters) };
    }

    // 50% chance to swap or add effect
    if (Math.random() < 0.5 && mutated.effects) {
        const idx = Math.floor(Math.random() * Math.max(1, mutated.effects.length - 1));
        const allEffects = [...EFFECTS.tape, ...EFFECTS.delay, ...EFFECTS.saturation, ...EFFECTS.space];
        mutated.effects[idx] = { type: pick(allEffects) };
    }

    return mutated;
}

// Randomize just the modulation macro settings
export function randomizeModulation(patch) {
    const mutated = JSON.parse(JSON.stringify(patch));

    if (mutated.modulation) {
        mutated.modulation.preset = getRandomModulationPreset();
        const modPreset = MODULATION_PRESETS[mutated.modulation.preset];
        mutated.modulation.settings = JSON.parse(JSON.stringify(modPreset));
    }

    return mutated;
}

// Export modulation presets for UI
export { MODULATION_PRESETS };

// Crossover between two patches
export function crossoverPatches(patchA, patchB) {
    return {
        oscillators: Math.random() < 0.5 ? [...patchA.oscillators] : [...patchB.oscillators],
        filters: Math.random() < 0.5 ? [...patchA.filters] : [...patchB.filters],
        effects: [...new Set([
            ...patchA.effects.slice(0, 2),
            ...patchB.effects.slice(0, 2),
            { type: 'limiter' }
        ])],
        modulators: Math.random() < 0.5 ? [...patchA.modulators] : [...patchB.modulators],
        spatial: Math.random() < 0.5 ? [...patchA.spatial] : [...patchB.spatial]
    };
}

// Preset patch collections
export const PATCH_PRESETS = {
    // Glass-inspired
    glassMinimal: () => generatePatch({
        brightness: 0.6,
        complexity: 0.3,
        movement: 0.3,
        wetness: 0.4,
        character: 'organ'
    }),

    glassFloe: () => generatePatch({
        brightness: 0.7,
        complexity: 0.5,
        movement: 0.4,
        wetness: 0.5,
        character: 'organ'
    }),

    // Barbieri-inspired
    barbieriLadder: () => generatePatch({
        brightness: 0.4,
        complexity: 0.6,
        movement: 0.5,
        wetness: 0.6,
        character: 'organ'
    }),

    // Bell tones
    bellCrystal: () => generatePatch({
        brightness: 0.8,
        complexity: 0.4,
        movement: 0.2,
        wetness: 0.5,
        character: 'bell'
    }),

    // Pad/drone
    ambientPad: () => generatePatch({
        brightness: 0.3,
        complexity: 0.3,
        movement: 0.6,
        wetness: 0.7,
        character: 'pad'
    }),

    // String-like
    stringEnsemble: () => generatePatch({
        brightness: 0.5,
        complexity: 0.4,
        movement: 0.5,
        wetness: 0.4,
        character: 'string'
    })
};
