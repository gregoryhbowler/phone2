# Glass Machine - Implementation Guide

---

## 🎯 THE GUIDING PRINCIPLE

**If Philip Glass were to write *Floe* today, with only a phone to do it, he would look at each of our voices as the musicians he has to work with.**

This is the north star for every decision we make. We are not building a toy synthesizer or a demo app. We are building an instrument capable of creating works as staggering and towering as Glass achieved with *Floe*—interlocking voices, cascading arpeggios, harmonic fields that breathe and shift, patterns that phase in and out of alignment to create something larger than the sum of their parts.

Each voice is a musician in our ensemble. Treat them with that respect.

---

## Current Status: v0.2 - CRITICAL FIXES NEEDED

**Honest Assessment: 1/20**

Sound plays but doesn't achieve the core musical vision. The following fundamental issues prevent this from sounding like Glass/minimalist music:

### CORE PROBLEMS

1. **No True Trilling** - Voices play sequential notes but not fast enough to sound like trills. Real trills need 8-20Hz alternation rate, we're at ~2-4Hz.

2. **No Harmonic Relationships Between Voices** - Each voice plays independently in key, but they don't relate as chord tones (root/3rd/5th) or in harmonic counterpoint.

3. **Clock Phase Not Audible** - Phase offsets exist but don't create the characteristic "rippling cascade" because:
   - Base rate is too slow to hear the stagger
   - No accent patterns to create groupings

4. **Patches Too Random** - Random generation picks from full module list, but Glass music needs:
   - Bright, hard-filtered organ tones (harmonicOsc, perfectOsc)
   - Crystalline attack (not too soft)
   - Rhythmic, synced delays

5. **XY Mapping Doesn't Feel Musical** - Changes are either too subtle or too jarring

---

### FIXES APPLIED (v0.2)

1. **Voice Harmonic Roles** - Each voice now has a specific chord function:
   - Voice 0 (Root): baseDegree=0, wider arpUpDown patterns, slower (4x division)
   - Voice 1 (Third): baseDegree=2, tighter trillStrict, medium (6x division)
   - Voice 2 (Fifth): baseDegree=4, tight trillStrict, fast (8x division)

2. **Clock Relationships** - 4:6:8 polymetric feel with staggered phases:
   - Root: phase 0, accent [1.2, 0.8, 1.0, 0.8]
   - Third: phase 0.333, accent [1.0, 0.9, 1.1, 0.9, 1.0, 0.9]
   - Fifth: phase 0.166, accent [1.0, 0.8]

3. **BPM Increased** - 144 BPM (was 120), so 8x division = 19.2 Hz trill rate

4. **Glass-Appropriate Patches** - Created `_createGlassPatch()`:
   - `organ`: harmonicOsc → filterLP → delayShort, softClip, lfoSmooth
   - `bell`: bellOsc → filterLP, filterPeak → delayPingPong, convolver
   - `pad`: perfectOsc → filterSVF → tapeWobble, delayLong, lfoGlacial

5. **XY Mapping Improved**:
   - X-axis: Controls interval spread (2-12 degrees) and pattern shape (trill→arp)
   - Y-axis: Controls division (2-16), gate length (0.9-0.3), filter cutoff (800-6000Hz)
   - Initial positions set per voice role

6. **Initial XY Positions** - Each voice starts at a musically appropriate position

---

---

## 1. Core Musical Model

### 1.1 Shared Harmonic Field ✅ Implemented | 🔧 Needs Optimization

**Current State:**
- [x] Root note (MIDI) shared across all voices
- [x] Scale/mode selection (major, minor, dorian, etc.)
- [x] Per-voice range (rangeMin, rangeMax in scale degrees)
- [x] Scale quantization in `scales.js`
- [x] Just Intonation option available

**Needs Work:**
- [ ] **Custom scale input** - Allow users to define custom interval sets
- [ ] **Per-voice root offset** - Let voices have different roots within harmonic field
- [ ] **Real-time scale morphing** - Smooth transitions between scales

**Files:** `src/engine/scales.js`, `src/engine/pitchBus.js`

---

### 1.2 Trill-Based Voice Engines ✅ Implemented | 🔧 Needs Major Optimization

**Current State:**
- [x] Pattern shapes defined in `patternEngine.js`:
  - Strict trill (A-B-A-B)
  - Biased trill (A-B-B-A)
  - Breathing trill (A-A-B-A-A-B)
  - 3, 4, 5-note patterns
  - Glass arpeggio (up-mid-down-mid)
  - Reich phasing
  - Fibonacci step
  - Euclidean

**Critical Issue - Not Working As Intended:**
The current implementation treats patterns as note sequences, but the *feel* is wrong.

**Required Changes:**

```javascript
// Current: Pattern just selects degrees
step() → returns { degree: 3 }

// Needed: Pattern acts as "rhythmic LFO with pitch output"
// Each voice should feel like a continuous trill stream
```

**TODO:**
- [ ] **Implement true trill engine** - Fast alternation that feels organic
- [ ] **Add shape parameters:**
  - `shape`: zigzag, triangle, sawdown, phasing cycle
  - `depth`: interval spread (narrow = 2 semitones, wide = octave+)
  - `rate`: trill speed (2Hz - 20Hz for true trills)
  - `skew`: asymmetry in timing (accent patterns)
- [ ] **Velocity/accent integration** - Louder on downbeats, softer between
- [ ] **Humanization** - Micro-timing variations (±5-15ms)

**Files:** `src/engine/patternEngine.js`

---

### 1.3 Shared but Phase-Shiftable Clocks ✅ Implemented | 🔧 Needs Tuning

**Current State:**
- [x] Master clock with BPM control
- [x] Per-voice division/multiplier
- [x] Phase offset per voice
- [x] Polymetric presets (3:4:5, cascade, Reich phase)
- [x] Swing parameter

**Issues:**
- Phase offsets don't create the "rippling Glass" effect properly
- Voices don't feel like they're "catching up" to each other

**TODO:**
- [ ] **Improve cascade feel** - When phase preset is "ripple", voices should stagger entry
- [ ] **Add convergence/divergence** - Voices drift apart then snap back together
- [ ] **Visual beat indicator** - Show when voices align (every N bars)
- [ ] **Micro-phase nudge via gesture** - Smooth phase adjustment

**Files:** `src/engine/clockSystem.js`

---

## 2. Gesture → Structure Mapping

### 2.1 X-Axis (Pitch Structure) 🔧 Needs Implementation

**Current State:**
- [x] X mapped to `setComplexity()` - changes pattern shape and interval spread
- [ ] Not granular enough - changes are too abrupt

**Required Behavior:**
```
X = 0.0 → Unison trill (same note repeated, or ±1 semitone)
X = 0.25 → Simple trill (±2-3 scale degrees)
X = 0.5 → 3-4 note arpeggio (triadic)
X = 0.75 → 5+ note pattern (wider intervals)
X = 1.0 → Wide additive structure (octave jumps, stacked 5ths)
```

**TODO:**
- [ ] **Smooth interpolation** between complexity levels
- [ ] **Directional bias control** - tendency to move up vs down vs oscillate
- [ ] **Perfect interval bias at high X** - switch to 5ths/4ths at X > 0.7

**Files:** `src/engine/patternEngine.js`, `src/voices/Voice.js`

---

### 2.2 Y-Axis (Temporal Structure) 🔧 Needs Implementation

**Current State:**
- [x] Y mapped to clock division (faster at top)
- [x] Y affects gate length (shorter at top)

**Required Behavior:**
```
Y = 0.0 → Slow, legato, sustained (drone-ish)
Y = 0.25 → Medium, flowing arpeggios
Y = 0.5 → Standard Glass tempo
Y = 0.75 → Fast, articulated, staccato
Y = 1.0 → Very fast trills, percussive
```

**TODO:**
- [ ] **Accent pattern morphing** - Y changes accent grouping (3s → 4s → 5s)
- [ ] **Envelope shape** - Low Y = slow attack, High Y = sharp attack
- [ ] **Delay feedback tied to Y** - More smear at low Y
- [ ] **Filter modulation depth** - More movement at high Y

**Files:** `src/voices/Voice.js`, `src/gestures/XYPad.js`

---

### 2.3 Gesture Dynamics ❌ Not Implemented

**Required:**

| Gesture | Behavior |
|---------|----------|
| **Flick** | Burst arpeggio (accelerando → decelerando) |
| **Long Press** | Collapse to sustained unison note |
| **Tap** | Accent/trigger single note |
| **Orbit** | Cycle through pattern motifs |
| **Pinch (global)** | Compress/expand all voices' intervals |
| **Figure-8** | Phase shift between voices |

**TODO:**
- [ ] **Implement flick burst** - Temporary speed increase then decay
- [ ] **Implement long press sustain** - Freeze on single note, silence trill
- [ ] **Implement orbit pattern cycling** - Detect circular gesture, advance pattern
- [ ] **Implement pinch** - Two-finger gesture compresses all spreads

**Files:** `src/gestures/XYPad.js`, `src/gestures/globalGestures.js`

---

### 2.4 Global Gestures 🔧 Partially Implemented

**Current State:**
- [x] Tilt detection (gyroscope)
- [x] Shake detection
- [x] Three-finger slide
- [x] Pinch/rotate detection

**Issues:**
- Tilt → root change is too sensitive
- Shake randomization is jarring (full patch change)

**TODO:**
- [ ] **Tilt smoothing** - Low-pass filter on tilt input
- [ ] **Tilt mapping refinement** - Maybe transpose by scale degree, not semitone
- [ ] **Shake → partial randomization** - Only randomize pattern, keep oscillators
- [ ] **Two-finger horizontal drag** - Global transposition
- [ ] **Two-finger vertical drag** - Global interval spread

**Files:** `src/gestures/globalGestures.js`, `src/engine/GlassMachine.js`

---

## 3. Voice Architecture & Synthesis

### 3.1 Module Integration ✅ Implemented | 🔧 Critical Issue

**Current State:**
- [x] All modules from phone1 imported
- [x] Voice builds patch from oscillators, filters, effects, spatial
- [x] Pitch bus connects to oscillator frequency params

**CRITICAL ISSUE: Pitch tracking on complex oscillators**

The current implementation only connects `pitchBus` to simple oscillators:
```javascript
if (module.params.freq) {
    this.pitchBus.registerOutput(module.params.freq);
}
```

But `harmonicOsc`, `perfectOsc`, `additiveOsc` have **multiple internal oscillators** that need to track pitch proportionally.

**Required Fix:**
```javascript
// For harmonicOsc - all partials must follow baseFreq
// partial[n].frequency = baseFreq * n

// Need a wrapper that:
// 1. Stores the harmonic ratios
// 2. On pitch change, updates ALL internal oscillators
// 3. Maintains spectral character while changing pitch
```

**TODO:**
- [ ] **Create pitch-tracking wrappers** for:
  - `harmonicOsc` - Update all 8 partials
  - `oddHarmonicOsc` - Update odd partials
  - `perfectOsc` - Update stacked 5ths
  - `additiveOsc` - Update all partials with random amplitudes
  - `fmOsc` - Update carrier AND modulator (maintain ratio)
  - `formantOsc` - Update source, keep formant filters static
  - `bellOsc` - Update all inharmonic partials
  - `phasingPair` - Update both oscillators
- [ ] **Test each oscillator type** for proper pitch tracking

**Files:** `src/voices/Voice.js`, `src/engine/modules.js`

---

### 3.2 Voice Archetypes ✅ Defined | ❌ Not Properly Implemented

**Defined Archetypes:**

**Voice A - "Glass Organ"**
- Oscillator: harmonicOsc or perfectOsc
- Filter: filterLP/filterSVF with lfoSmooth modulation
- FX: tapeWobble, delayShort, autoPanner
- Pattern: Triadic arps, mid-speed

**Voice B - "Barbieri Ladder"**
- Oscillator: perfectOsc or oddHarmonicOsc
- Filter: filterSVF with lfoGlacial
- FX: delayLong, tapeLoss
- Pattern: Wide intervals, slow climbs

**Voice C - "FM Shards"**
- Oscillator: fmOsc (mild modulation)
- Filter: filterHP + filterPeak
- FX: delayPingPong, stereoWidener
- Pattern: High register, fast trills

**TODO:**
- [ ] **Implement archetype loading** - Pre-built patches that sound right
- [ ] **Ensure each archetype has distinct character**
- [ ] **Test combination of all three** - Should blend, not clash

**Files:** `src/voices/Voice.js`, `src/patches/patchGenerator.js`

---

### 3.3 Sound Design - "Glass" Character ❌ Not Yet Achieved

**Target Sound Qualities:**
- Hard-filtered bright sequences
- Crystalline, organ-like timbres
- Subtle stereo movement
- Rhythmic delay feedback

**TODO:**
- [ ] **Default filter settings** - High cutoff (2-4kHz), low Q
- [ ] **Add optional sub-oscillator layer** - For organ weight
- [ ] **Stereo offset per voice** - Voices spread L/C/R
- [ ] **Rhythmic delay** - Sync delay time to clock divisions
- [ ] **Master reverb/convolution** - Shared ambient space

**Files:** `src/patches/patchGenerator.js`, `src/engine/GlassMachine.js`

---

## 4. Interaction Modes (Floe-Inspired)

### 4.1 Cascading Ripple Mode ❌ Not Implemented

**Behavior:**
- Voice 1 starts pattern
- Voice 2 enters offset by one subdivision
- Voice 3 offsets further
- Creates rippling wave effect

**TODO:**
- [ ] **Implement staggered entry** - On mode activation, sequence voice starts
- [ ] **Gesture pulls voices together/apart** - Phase manipulation
- [ ] **Visual feedback** - Show cascade timing

---

### 4.2 Glass Harmonic Pads Mode ❌ Not Implemented

**Behavior:**
- Slow finger movement → intervals compress, trill slows
- Voices lock into unison/octave
- Release → voices break apart into trills

**TODO:**
- [ ] **Implement "freeze" state** - Detect slow/stopped gesture
- [ ] **Smooth compression** - Gradually reduce interval spread to 0
- [ ] **Snap-back animation** - On release, expand with momentum

---

### 4.3 Additive Motion Mode ❌ Not Implemented

**Behavior:**
- Voice 1 = root of chord
- Voice 2 = 5th
- Voice 3 = 3rd
- Each voice trills around its chord tone

**TODO:**
- [ ] **Implement chord role assignment**
- [ ] **Inversion controls** - Gestures change voicing
- [ ] **Chord progression** - Tilt changes chord center

---

### 4.4 Pulse-Pattern Morphing ❌ Not Implemented

**Behavior:**
- Fast gesture → pattern algorithm changes
- Rhythmic "snaps" to new texture
- 2-note → 3-note → 5-note automatically

**TODO:**
- [ ] **Implement gesture velocity detection**
- [ ] **Pattern transition smoothing** - Crossfade between patterns
- [ ] **Threshold-based switching** - Clear boundaries for feel

---

## 5. Novel Modes

### 5.1 Magnet Mode ❌ Not Implemented

Voices attract/repel harmonically based on gesture.

**TODO:**
- [ ] **Implement harmonic attraction** - Voices converge to perfect intervals
- [ ] **Implement harmonic repulsion** - Voices scatter to wide clusters
- [ ] **Physics simulation** - Smooth movement with inertia

---

### 5.2 Trellis Mode (Tonnetz) ❌ Not Implemented

2D lattice of intervals. XY traverses grid, outputs arpeggio paths.

**TODO:**
- [ ] **Implement Tonnetz grid** - Horizontal = 5ths, Vertical = 3rds
- [ ] **Path tracing** - Gesture creates melodic path through grid
- [ ] **Visual grid overlay** - Show position on pad

---

### 5.3 Bloom Mode ❌ Not Implemented

Hold → pattern expands outward. Release → collapses.

**TODO:**
- [ ] **Implement hold detection** - Distinguish from long press
- [ ] **Expansion animation** - Pattern grows: 1 note → 2 → 3 → 5 → cascade
- [ ] **Collapse with decay** - Reverses on release

---

## 6. Technical Priorities

### Immediate Fixes (Required for Basic Function)

1. ~~**Fix pitch tracking on complex oscillators**~~ ✅ DONE - Created `pitchTrackingOscillators.js` with wrappers for all complex oscillators
2. ~~**Improve XY mapping**~~ ✅ DONE - Added exponential curves, filter modulation tied to Y axis
3. ~~**Add envelope to notes**~~ ✅ DONE - Using exponential ramps to/from 0.001 to avoid clicks
4. ~~**Fix startup delay**~~ ✅ DONE - Clock scheduler now starts immediately

### Short-Term Improvements

5. ~~**Implement gesture dynamics**~~ ✅ DONE (flick → burst, long-press → sustain, tap → pattern reset)
6. ~~**Per-voice randomization**~~ ✅ DONE - Added per-voice randomize buttons with visual feedback
7. **Create working voice archetypes** with proper sound design
8. **Add visual beat/phase indicators**

### Medium-Term Features

7. **Implement interaction modes** (Ripple, Harmonic Pads, Additive)
8. **Add mode switching UI**
9. **Save/load patches**

### Long-Term Polish

10. **Implement novel modes** (Magnet, Trellis, Bloom)
11. **Performance optimization** (reduce CPU on mobile)
12. **PWA support** (offline, add to home screen)

---

## File Reference

```
src/
├── engine/
│   ├── modules.js                  # Synth modules (from phone1)
│   ├── pitchTrackingOscillators.js # NEW: Wrappers for pitch-trackable oscillators
│   ├── scales.js                   # Scale definitions, quantization
│   ├── pitchBus.js                 # Per-voice pitch control
│   ├── patternEngine.js            # Trill/arpeggio patterns
│   ├── clockSystem.js              # Polymetric clocks
│   └── GlassMachine.js             # Main orchestrator
├── voices/
│   └── Voice.js                    # Voice class, module chain
├── patches/
│   └── patchGenerator.js           # Random patch generation
├── gestures/
│   ├── XYPad.js                    # XY touch controllers
│   └── globalGestures.js           # Tilt, shake, pinch
├── ui/
│   └── styles.css                  # Mobile UI styles
└── main.js                         # App entry, UI setup
```

---

## Testing Checklist

- [ ] Each oscillator type plays correct pitch when pattern changes
- [ ] XY pad smoothly morphs pattern complexity (X) and speed (Y)
- [ ] Three voices create polymetric but harmonically coherent texture
- [ ] Flick gesture triggers burst arpeggio
- [ ] Long press sustains note
- [ ] Shake randomizes patches without breaking playback
- [ ] Tilt transposes root smoothly
- [ ] Sound has "Glass" character - bright, crystalline, rhythmic
