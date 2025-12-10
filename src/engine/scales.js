// SCALE AND HARMONIC DEFINITIONS
// Defines scales, modes, and harmonic structures for the pitch engine

// Common scales as semitone intervals from root
export const SCALES = {
    // Western modes
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],

    // Harmonic/melodic variants
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],

    // Pentatonic
    majorPentatonic: [0, 2, 4, 7, 9],
    minorPentatonic: [0, 3, 5, 7, 10],

    // Ethiopian Pentatonic (Kiñit)
    tizitaMajor: [0, 2, 5, 7, 9],      // Tizita Major - nostalgic, bittersweet
    tizitaMinor: [0, 3, 5, 7, 10],     // Tizita Minor - melancholic
    batiMajor: [0, 2, 5, 7, 10],       // Bati Major - joyful, uplifting
    batiMinor: [0, 3, 5, 7, 10],       // Bati Minor - contemplative
    ambassel: [0, 3, 5, 7, 11],        // Ambassel - spiritual, devotional
    anchihoye: [0, 2, 5, 7, 11],       // Anchihoye - bright, celebratory

    // Glass-like / minimalist scales
    wholeTone: [0, 2, 4, 6, 8, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],

    // Exotic / Modal
    hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
    persian: [0, 1, 4, 5, 6, 8, 11],
    hirajoshi: [0, 2, 3, 7, 8],
    inSen: [0, 1, 5, 7, 10],

    // Symmetrical
    diminished: [0, 2, 3, 5, 6, 8, 9, 11],
    augmented: [0, 3, 4, 7, 8, 11],

    // Just the root (for drones/unison)
    unison: [0],

    // Perfect intervals only (Riley/Young style)
    perfectFifths: [0, 7],
    perfectFourths: [0, 5],
    quartal: [0, 5, 10],
    quintal: [0, 7, 14]
};

// Just Intonation ratios (for pure intervals)
export const JUST_RATIOS = {
    unison: 1,
    minorSecond: 16/15,
    majorSecond: 9/8,
    minorThird: 6/5,
    majorThird: 5/4,
    perfectFourth: 4/3,
    tritone: 45/32,
    perfectFifth: 3/2,
    minorSixth: 8/5,
    majorSixth: 5/3,
    minorSeventh: 9/5,
    majorSeventh: 15/8,
    octave: 2
};

// Convert semitones to Just Intonation ratio (approximation)
export function semitonesToJustRatio(semitones) {
    const justMap = {
        0: 1,
        1: 16/15,
        2: 9/8,
        3: 6/5,
        4: 5/4,
        5: 4/3,
        6: 45/32,
        7: 3/2,
        8: 8/5,
        9: 5/3,
        10: 9/5,
        11: 15/8,
        12: 2
    };

    const octaves = Math.floor(semitones / 12);
    const remainder = ((semitones % 12) + 12) % 12;

    return justMap[remainder] * Math.pow(2, octaves);
}

// MIDI note to frequency (12-TET)
export function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// Frequency to MIDI note
export function freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / 440);
}

// Note names for display
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Get note name from MIDI number
export function midiToNoteName(midi) {
    const noteName = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteName}${octave}`;
}

// Common chord structures (intervals from root)
export const CHORD_TYPES = {
    // Triads
    major: [0, 4, 7],
    minor: [0, 3, 7],
    diminished: [0, 3, 6],
    augmented: [0, 4, 8],
    suspended2: [0, 2, 7],
    suspended4: [0, 5, 7],

    // Seventh chords
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    dominant7: [0, 4, 7, 10],
    diminished7: [0, 3, 6, 9],
    halfDiminished7: [0, 3, 6, 10],
    minorMajor7: [0, 3, 7, 11],

    // Extended
    add9: [0, 4, 7, 14],
    minor9: [0, 3, 7, 10, 14],
    major9: [0, 4, 7, 11, 14],

    // Glass-like stacked structures
    stackedFourths: [0, 5, 10, 15],
    stackedFifths: [0, 7, 14, 21],
    openVoicing: [0, 7, 12, 16],

    // Clusters
    cluster: [0, 1, 2],
    wideCluster: [0, 2, 4]
};

// Quantize a frequency to the nearest scale degree
export function quantizeToScale(freq, rootMidi, scale, useJust = false) {
    const midi = freqToMidi(freq);
    const offsetFromRoot = midi - rootMidi;
    const octave = Math.floor(offsetFromRoot / 12);
    const degreeInOctave = ((offsetFromRoot % 12) + 12) % 12;

    // Find closest scale degree
    let closestDegree = scale[0];
    let minDistance = 12;

    for (const degree of scale) {
        const distance = Math.min(
            Math.abs(degreeInOctave - degree),
            Math.abs(degreeInOctave - degree + 12),
            Math.abs(degreeInOctave - degree - 12)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestDegree = degree;
        }
    }

    const quantizedMidi = rootMidi + octave * 12 + closestDegree;

    if (useJust) {
        const justRatio = semitonesToJustRatio(quantizedMidi - rootMidi);
        return midiToFreq(rootMidi) * justRatio;
    }

    return midiToFreq(quantizedMidi);
}

// Get scale degree from absolute MIDI note
export function getScaleDegree(midi, rootMidi, scale) {
    const offsetFromRoot = ((midi - rootMidi) % 12 + 12) % 12;
    return scale.indexOf(offsetFromRoot);
}

// Get MIDI note from scale degree
export function scaleDegreeToMidi(degree, rootMidi, scale, octaveOffset = 0) {
    const scaleLength = scale.length;
    const normalizedDegree = ((degree % scaleLength) + scaleLength) % scaleLength;
    const additionalOctaves = Math.floor(degree / scaleLength);

    return rootMidi + scale[normalizedDegree] + (octaveOffset + additionalOctaves) * 12;
}

// Generate a chord from root and type
export function generateChord(rootMidi, chordType) {
    const intervals = CHORD_TYPES[chordType] || CHORD_TYPES.major;
    return intervals.map(interval => rootMidi + interval);
}

// Transpose scale to new root
export function transposeScale(scale, semitones) {
    return scale.map(degree => (degree + semitones) % 12);
}
