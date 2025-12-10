// GLASS MACHINE - Main Entry Point
// Gesture-driven Philip Glass-inspired synthesizer

import { createGlassMachine } from './engine/GlassMachine.js';
import { createXYPads } from './gestures/XYPad.js';
import { createGlobalGestureHandler } from './gestures/globalGestures.js';
import { SCALES } from './engine/scales.js';
import { POLYMETRIC_PRESETS, PHASE_PRESETS } from './engine/clockSystem.js';
import { SYNC_DIVISIONS, LFO_SHAPES } from './engine/LFOBank.js';
import './ui/styles.css';

// App state
let glassMachine = null;
let xyPads = [];
let globalGestures = null;
let animationFrame = null;

// DOM Elements
const elements = {
    app: null,
    startScreen: null,
    startBtn: null,
    playBtn: null,
    resetBtn: null,
    settingsBtn: null,
    randomizeBtn: null,
    settingsPanel: null,
    xyContainer: null,
    bpmDisplay: null,
    rootDisplay: null,
    scaleDisplay: null,
    scaleSelect: null,
    bpmSlider: null,
    volumeSlider: null,
    polymetricSelect: null,
    phaseSelect: null,
    voiceMutes: [],
    visualizerCanvas: null,
    transposeCells: [],
    transposeStepsSelect: null,
    transposeBarsSelect: null,
    transposeClearBtn: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    createUI();
    setupEventListeners();
});

// Create the UI structure
function createUI() {
    const app = document.createElement('div');
    app.className = 'app';
    app.innerHTML = `
        <!-- Start Screen -->
        <div class="start-screen" id="start-screen">
            <h1>Glass Machine</h1>
            <p>A gesture-driven synthesizer inspired by minimalist composers. Touch the pads to control three interweaving voices.</p>
            <button class="start-btn" id="start-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                </svg>
            </button>
            <p style="font-size: 11px; opacity: 0.5;">Tap to begin</p>
        </div>

        <!-- Header -->
        <div class="header">
            <h1>Glass Machine</h1>
            <div class="header-controls">
                <button class="btn" id="play-btn" title="Play/Pause">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="play-icon">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    <svg viewBox="0 0 24 24" fill="currentColor" class="pause-icon" style="display:none;">
                        <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                </button>
                <button class="btn" id="reset-btn" title="Reset Clock">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 4v6h6"/>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                </button>
                <button class="btn" id="settings-btn" title="Settings">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Info Bar -->
        <div class="info-bar">
            <div class="info-item">
                <span>BPM:</span>
                <span class="info-value" id="bpm-display">120</span>
            </div>
            <div class="info-item">
                <span>Root:</span>
                <span class="info-value" id="root-display">C3</span>
            </div>
            <div class="info-item">
                <span>Scale:</span>
                <span class="info-value" id="scale-display">Major</span>
            </div>
        </div>

        <!-- Visualizer -->
        <div class="visualizer">
            <canvas id="visualizer-canvas"></canvas>
        </div>

        <!-- Buchla Voice Panels -->
        <div class="buchla-voices" id="buchla-voices">
            <!-- Voice 1 -->
            <div class="buchla-panel" data-voice="0">
                <div class="buchla-header">
                    <button class="mute-btn" data-voice="0">V1</button>
                    <span class="buchla-title">ROOT</span>
                    <select class="copy-select" data-voice="0" title="Copy to...">
                        <option value="">Copy→</option>
                        <option value="1">→V2</option>
                        <option value="2">→V3</option>
                        <option value="1,2">→All</option>
                    </select>
                </div>
                <div class="buchla-sections">
                    <div class="buchla-section osc-section">
                        <span class="section-label">OSC</span>
                        <div class="octave-btns" data-voice="0">
                            <button class="octave-btn" data-voice="0" data-oct="-2">-2</button>
                            <button class="octave-btn" data-voice="0" data-oct="-1" class="active">-1</button>
                            <button class="octave-btn" data-voice="0" data-oct="0">0</button>
                            <button class="octave-btn" data-voice="0" data-oct="1">+1</button>
                            <button class="octave-btn" data-voice="0" data-oct="2">+2</button>
                        </div>
                        <div class="wave-btns" data-voice="0">
                            <button class="wave-btn active" data-voice="0" data-wave="sine" title="Sine">~</button>
                            <button class="wave-btn" data-voice="0" data-wave="triangle" title="Triangle">△</button>
                            <button class="wave-btn" data-voice="0" data-wave="sawtooth" title="Saw">⊿</button>
                            <button class="wave-btn" data-voice="0" data-wave="square" title="Square">□</button>
                        </div>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="fmRatio" min="0" max="100" value="25" title="FM Ratio">
                                <span class="param-label">RATIO</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="fmIndex" min="0" max="100" value="20" title="FM Index">
                                <span class="param-label">INDEX</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section fold-section">
                        <span class="section-label">FOLD</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="foldAmount" min="0" max="100" value="0" title="Fold Amount">
                                <span class="param-label">AMT</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="foldSymmetry" min="0" max="100" value="50" title="Fold Symmetry">
                                <span class="param-label">SYM</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section lpg-section">
                        <span class="section-label">LPG</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="lpgCutoff" min="0" max="100" value="50" title="Cutoff">
                                <span class="param-label">CUT</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="lpgResonance" min="0" max="100" value="10" title="Resonance">
                                <span class="param-label">RES</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="lpgResponse" min="0" max="100" value="50" title="Response">
                                <span class="param-label">RSP</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section env-section">
                        <span class="section-label">ENV</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="attack" min="0" max="100" value="5" title="Attack">
                                <span class="param-label">ATK</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="decay" min="0" max="100" value="30" title="Decay">
                                <span class="param-label">DCY</span>
                            </div>
                        </div>
                        <div class="env-mode-btns" data-voice="0">
                            <button class="env-mode-btn active" data-voice="0" data-mode="gate">Gate</button>
                            <button class="env-mode-btn" data-voice="0" data-mode="trigger">Trig</button>
                            <button class="env-mode-btn" data-voice="0" data-mode="drone">Drone</button>
                        </div>
                    </div>
                    <div class="buchla-section out-section">
                        <span class="section-label">OUT</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="level" min="0" max="100" value="80" title="Level">
                                <span class="param-label">LVL</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="0" data-param="pan" min="0" max="100" value="30" title="Pan">
                                <span class="param-label">PAN</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Voice 2 -->
            <div class="buchla-panel" data-voice="1">
                <div class="buchla-header">
                    <button class="mute-btn" data-voice="1">V2</button>
                    <span class="buchla-title">THIRD</span>
                    <select class="copy-select" data-voice="1" title="Copy to...">
                        <option value="">Copy→</option>
                        <option value="0">→V1</option>
                        <option value="2">→V3</option>
                        <option value="0,2">→All</option>
                    </select>
                </div>
                <div class="buchla-sections">
                    <div class="buchla-section osc-section">
                        <span class="section-label">OSC</span>
                        <div class="octave-btns" data-voice="1">
                            <button class="octave-btn" data-voice="1" data-oct="-2">-2</button>
                            <button class="octave-btn" data-voice="1" data-oct="-1">-1</button>
                            <button class="octave-btn active" data-voice="1" data-oct="0">0</button>
                            <button class="octave-btn" data-voice="1" data-oct="1">+1</button>
                            <button class="octave-btn" data-voice="1" data-oct="2">+2</button>
                        </div>
                        <div class="wave-btns" data-voice="1">
                            <button class="wave-btn active" data-voice="1" data-wave="sine" title="Sine">~</button>
                            <button class="wave-btn" data-voice="1" data-wave="triangle" title="Triangle">△</button>
                            <button class="wave-btn" data-voice="1" data-wave="sawtooth" title="Saw">⊿</button>
                            <button class="wave-btn" data-voice="1" data-wave="square" title="Square">□</button>
                        </div>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="fmRatio" min="0" max="100" value="38" title="FM Ratio">
                                <span class="param-label">RATIO</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="fmIndex" min="0" max="100" value="15" title="FM Index">
                                <span class="param-label">INDEX</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section fold-section">
                        <span class="section-label">FOLD</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="foldAmount" min="0" max="100" value="0" title="Fold Amount">
                                <span class="param-label">AMT</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="foldSymmetry" min="0" max="100" value="50" title="Fold Symmetry">
                                <span class="param-label">SYM</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section lpg-section">
                        <span class="section-label">LPG</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="lpgCutoff" min="0" max="100" value="60" title="Cutoff">
                                <span class="param-label">CUT</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="lpgResonance" min="0" max="100" value="15" title="Resonance">
                                <span class="param-label">RES</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="lpgResponse" min="0" max="100" value="40" title="Response">
                                <span class="param-label">RSP</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section env-section">
                        <span class="section-label">ENV</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="attack" min="0" max="100" value="10" title="Attack">
                                <span class="param-label">ATK</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="decay" min="0" max="100" value="40" title="Decay">
                                <span class="param-label">DCY</span>
                            </div>
                        </div>
                        <div class="env-mode-btns" data-voice="1">
                            <button class="env-mode-btn active" data-voice="1" data-mode="gate">Gate</button>
                            <button class="env-mode-btn" data-voice="1" data-mode="trigger">Trig</button>
                            <button class="env-mode-btn" data-voice="1" data-mode="drone">Drone</button>
                        </div>
                    </div>
                    <div class="buchla-section out-section">
                        <span class="section-label">OUT</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="level" min="0" max="100" value="80" title="Level">
                                <span class="param-label">LVL</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="1" data-param="pan" min="0" max="100" value="50" title="Pan">
                                <span class="param-label">PAN</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- Voice 3 -->
            <div class="buchla-panel" data-voice="2">
                <div class="buchla-header">
                    <button class="mute-btn" data-voice="2">V3</button>
                    <span class="buchla-title">FIFTH</span>
                    <select class="copy-select" data-voice="2" title="Copy to...">
                        <option value="">Copy→</option>
                        <option value="0">→V1</option>
                        <option value="1">→V2</option>
                        <option value="0,1">→All</option>
                    </select>
                </div>
                <div class="buchla-sections">
                    <div class="buchla-section osc-section">
                        <span class="section-label">OSC</span>
                        <div class="octave-btns" data-voice="2">
                            <button class="octave-btn" data-voice="2" data-oct="-2">-2</button>
                            <button class="octave-btn" data-voice="2" data-oct="-1">-1</button>
                            <button class="octave-btn active" data-voice="2" data-oct="0">0</button>
                            <button class="octave-btn" data-voice="2" data-oct="1">+1</button>
                            <button class="octave-btn" data-voice="2" data-oct="2">+2</button>
                        </div>
                        <div class="wave-btns" data-voice="2">
                            <button class="wave-btn active" data-voice="2" data-wave="sine" title="Sine">~</button>
                            <button class="wave-btn" data-voice="2" data-wave="triangle" title="Triangle">△</button>
                            <button class="wave-btn" data-voice="2" data-wave="sawtooth" title="Saw">⊿</button>
                            <button class="wave-btn" data-voice="2" data-wave="square" title="Square">□</button>
                        </div>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="fmRatio" min="0" max="100" value="50" title="FM Ratio">
                                <span class="param-label">RATIO</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="fmIndex" min="0" max="100" value="30" title="FM Index">
                                <span class="param-label">INDEX</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section fold-section">
                        <span class="section-label">FOLD</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="foldAmount" min="0" max="100" value="0" title="Fold Amount">
                                <span class="param-label">AMT</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="foldSymmetry" min="0" max="100" value="50" title="Fold Symmetry">
                                <span class="param-label">SYM</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section lpg-section">
                        <span class="section-label">LPG</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="lpgCutoff" min="0" max="100" value="70" title="Cutoff">
                                <span class="param-label">CUT</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="lpgResonance" min="0" max="100" value="5" title="Resonance">
                                <span class="param-label">RES</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="lpgResponse" min="0" max="100" value="30" title="Response">
                                <span class="param-label">RSP</span>
                            </div>
                        </div>
                    </div>
                    <div class="buchla-section env-section">
                        <span class="section-label">ENV</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="attack" min="0" max="100" value="3" title="Attack">
                                <span class="param-label">ATK</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="decay" min="0" max="100" value="25" title="Decay">
                                <span class="param-label">DCY</span>
                            </div>
                        </div>
                        <div class="env-mode-btns" data-voice="2">
                            <button class="env-mode-btn" data-voice="2" data-mode="gate">Gate</button>
                            <button class="env-mode-btn active" data-voice="2" data-mode="trigger">Trig</button>
                            <button class="env-mode-btn" data-voice="2" data-mode="drone">Drone</button>
                        </div>
                    </div>
                    <div class="buchla-section out-section">
                        <span class="section-label">OUT</span>
                        <div class="param-row">
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="level" min="0" max="100" value="75" title="Level">
                                <span class="param-label">LVL</span>
                            </div>
                            <div class="param-knob">
                                <input type="range" class="buchla-knob" data-voice="2" data-param="pan" min="0" max="100" value="70" title="Pan">
                                <span class="param-label">PAN</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- XY Pads -->
        <div class="xy-container" id="xy-container"></div>

        <!-- Bottom Controls -->
        <div class="bottom-controls">
            <div class="control-group">
                <label>Root</label>
                <select id="root-select">
                    <option value="36">C2</option>
                    <option value="37">C#2</option>
                    <option value="38">D2</option>
                    <option value="39">D#2</option>
                    <option value="40">E2</option>
                    <option value="41">F2</option>
                    <option value="42">F#2</option>
                    <option value="43">G2</option>
                    <option value="44">G#2</option>
                    <option value="45">A2</option>
                    <option value="46">A#2</option>
                    <option value="47">B2</option>
                    <option value="48" selected>C3</option>
                    <option value="49">C#3</option>
                    <option value="50">D3</option>
                    <option value="51">D#3</option>
                    <option value="52">E3</option>
                    <option value="53">F3</option>
                    <option value="54">F#3</option>
                    <option value="55">G3</option>
                    <option value="56">G#3</option>
                    <option value="57">A3</option>
                    <option value="58">A#3</option>
                    <option value="59">B3</option>
                    <option value="60">C4</option>
                    <option value="61">C#4</option>
                    <option value="62">D4</option>
                    <option value="63">D#4</option>
                    <option value="64">E4</option>
                </select>
            </div>
            <div class="control-group">
                <label>Scale</label>
                <select id="scale-select">
                    <optgroup label="Major Modes">
                        <option value="major">Ionian (Major)</option>
                        <option value="dorian">Dorian</option>
                        <option value="phrygian">Phrygian</option>
                        <option value="lydian">Lydian</option>
                        <option value="mixolydian">Mixolydian</option>
                        <option value="minor">Aeolian (Minor)</option>
                        <option value="locrian">Locrian</option>
                    </optgroup>
                    <optgroup label="Minor Variants">
                        <option value="harmonicMinor">Harmonic Minor</option>
                        <option value="melodicMinor">Melodic Minor</option>
                    </optgroup>
                    <optgroup label="Pentatonic">
                        <option value="majorPentatonic">Major Pentatonic</option>
                        <option value="minorPentatonic">Minor Pentatonic</option>
                    </optgroup>
                    <optgroup label="Ethiopian">
                        <option value="tizitaMajor">Tizita Major</option>
                        <option value="tizitaMinor">Tizita Minor</option>
                        <option value="batiMajor">Bati Major</option>
                        <option value="batiMinor">Bati Minor</option>
                        <option value="ambassel">Ambassel</option>
                        <option value="anchihoye">Anchihoye</option>
                    </optgroup>
                    <optgroup label="Symmetric">
                        <option value="wholeTone">Whole Tone</option>
                        <option value="diminished">Diminished</option>
                        <option value="augmented">Augmented</option>
                        <option value="chromatic">Chromatic</option>
                    </optgroup>
                    <optgroup label="World/Exotic">
                        <option value="hungarianMinor">Hungarian Minor</option>
                        <option value="persian">Persian</option>
                        <option value="hirajoshi">Hirajoshi</option>
                        <option value="inSen">In Sen</option>
                    </optgroup>
                    <optgroup label="Minimalist">
                        <option value="quartal">Quartal</option>
                        <option value="quintal">Quintal</option>
                        <option value="perfectFifths">Perfect Fifths</option>
                        <option value="unison">Drone/Unison</option>
                    </optgroup>
                </select>
            </div>
            <div class="control-group">
                <label>Rhythm</label>
                <select id="polymetric-select">
                    <optgroup label="Basic">
                        <option value="unison">Unison</option>
                        <option value="doubled">Fast (2x)</option>
                        <option value="quadrupled">Faster (4x)</option>
                    </optgroup>
                    <optgroup label="Glass/Floe">
                        <option value="glassCascade" selected>Glass Cascade</option>
                        <option value="glassRipple">Glass Ripple</option>
                        <option value="floeA">Floe Flow</option>
                        <option value="floeC">Floe Center</option>
                    </optgroup>
                    <optgroup label="Polymetric">
                        <option value="threeAgainstTwo">3:2</option>
                        <option value="fourAgainstThree">4:3</option>
                        <option value="fiveAgainstFour">5:4</option>
                        <option value="polymetric345">3:4:5</option>
                        <option value="hemiola">Hemiola</option>
                    </optgroup>
                    <optgroup label="Layered">
                        <option value="layered123">Slow→Fast</option>
                        <option value="layered234">Stacked</option>
                        <option value="africanBell">African Bell</option>
                    </optgroup>
                    <optgroup label="Reich">
                        <option value="reichPhase">Reich Phase</option>
                        <option value="reichDrift">Reich Drift</option>
                    </optgroup>
                    <optgroup label="Experimental">
                        <option value="fibonacci">Fibonacci</option>
                        <option value="triplets">Triplets</option>
                        <option value="euclidean">Euclidean</option>
                    </optgroup>
                </select>
            </div>
            <div class="control-group">
                <label>Phase</label>
                <select id="phase-select">
                    <optgroup label="Basic">
                        <option value="locked">Locked</option>
                        <option value="tight">Tight</option>
                        <option value="ripple" selected>Ripple</option>
                        <option value="spread">Spread</option>
                    </optgroup>
                    <optgroup label="Musical">
                        <option value="cascade">Cascade</option>
                        <option value="offbeat">Offbeat</option>
                        <option value="syncopated">Syncopated</option>
                        <option value="hocket">Hocket</option>
                        <option value="swing">Swing</option>
                    </optgroup>
                    <optgroup label="Reich">
                        <option value="reichA">Reich Micro</option>
                        <option value="reichB">Reich Canon</option>
                        <option value="canon">Full Canon</option>
                    </optgroup>
                    <optgroup label="Floe">
                        <option value="floeRipple">Floe Ripple</option>
                        <option value="floeWave">Floe Wave</option>
                    </optgroup>
                </select>
            </div>
        </div>


        <!-- Transposition Sequencer -->
        <div class="transpose-sequencer" id="transpose-sequencer">
            <div class="transpose-header">
                <span class="transpose-label">Transpose</span>
                <div class="transpose-controls">
                    <select class="transpose-steps-select" id="transpose-steps" title="Number of steps">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                        <option value="6">6</option>
                        <option value="7">7</option>
                        <option value="8" selected>8</option>
                    </select>
                    <select class="transpose-bars-select" id="transpose-bars" title="Bars per step">
                        <option value="1">1 bar</option>
                        <option value="2" selected>2 bars</option>
                        <option value="4">4 bars</option>
                        <option value="8">8 bars</option>
                    </select>
                    <button class="transpose-clear-btn" id="transpose-clear" title="Clear all">×</button>
                </div>
            </div>
            <div class="transpose-cells" id="transpose-cells">
                <div class="transpose-cell" data-index="0" data-value="0">0</div>
                <div class="transpose-cell" data-index="1" data-value="0">0</div>
                <div class="transpose-cell" data-index="2" data-value="0">0</div>
                <div class="transpose-cell" data-index="3" data-value="0">0</div>
                <div class="transpose-cell" data-index="4" data-value="0">0</div>
                <div class="transpose-cell" data-index="5" data-value="0">0</div>
                <div class="transpose-cell" data-index="6" data-value="0">0</div>
                <div class="transpose-cell" data-index="7" data-value="0">0</div>
            </div>
        </div>

        <!-- LFO Bank -->
        <div class="lfo-bank" id="lfo-bank">
            <div class="lfo-bank-header">
                <span class="lfo-bank-label">LFO Bank</span>
                <button class="lfo-bank-toggle" id="lfo-bank-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="lfo-bank-content" id="lfo-bank-content"></div>
        </div>

        <!-- FX Drawer (Nautilus Delay) -->
        <div class="fx-drawer" id="fx-drawer">
            <div class="fx-drawer-header">
                <span class="fx-drawer-label">NAUTILUS DELAY</span>
                <button class="fx-drawer-toggle" id="fx-drawer-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="fx-drawer-content" id="fx-drawer-content">
                <!-- Voice Sends -->
                <div class="fx-section fx-sends">
                    <span class="fx-section-label">SEND</span>
                    <div class="fx-send-controls">
                        <div class="fx-send">
                            <span class="fx-send-label">V1</span>
                            <input type="range" class="fx-send-slider" data-voice="0" min="0" max="100" value="0" title="Voice 1 Send">
                        </div>
                        <div class="fx-send">
                            <span class="fx-send-label">V2</span>
                            <input type="range" class="fx-send-slider" data-voice="1" min="0" max="100" value="0" title="Voice 2 Send">
                        </div>
                        <div class="fx-send">
                            <span class="fx-send-label">V3</span>
                            <input type="range" class="fx-send-slider" data-voice="2" min="0" max="100" value="0" title="Voice 3 Send">
                        </div>
                        <div class="fx-send insert-send">
                            <span class="fx-send-label insert-label">INS</span>
                            <input type="range" class="insert-send-slider" data-effect="nautilus" min="0" max="100" value="0" title="Insert FX Chain Send to Nautilus">
                        </div>
                    </div>
                </div>

                <!-- Core Parameters -->
                <div class="fx-section fx-core">
                    <span class="fx-section-label">CORE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fx-knob" data-param="mix" min="0" max="100" value="50" title="Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fx-knob" data-param="feedback" min="0" max="100" value="50" title="Feedback">
                            <span class="fx-param-label">FDBK</span>
                        </div>
                        <div class="fx-param">
                            <select class="fx-resolution" data-param="resolution" title="Resolution">
                                <option value="0">2 Bars</option>
                                <option value="6.25">1 Bar</option>
                                <option value="12.5">Dot Half</option>
                                <option value="18.75">Half</option>
                                <option value="25">Dot Qtr</option>
                                <option value="31.25">Quarter</option>
                                <option value="37.5">Dot 8th</option>
                                <option value="43.75" selected>8th</option>
                                <option value="50">8th Trip</option>
                                <option value="56.25">16th</option>
                                <option value="62.5">16th Trip</option>
                                <option value="68.75">32nd</option>
                                <option value="75">64th</option>
                                <option value="81.25">128th</option>
                                <option value="87.5">256th</option>
                                <option value="100">512th</option>
                            </select>
                            <span class="fx-param-label">RES</span>
                        </div>
                    </div>
                </div>

                <!-- Delay Network -->
                <div class="fx-section fx-network">
                    <span class="fx-section-label">NETWORK</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fx-knob" data-param="sensors" min="1" max="8" value="1" step="1" title="Sensors (Active Lines)">
                            <span class="fx-param-label">SENS</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fx-knob" data-param="dispersal" min="0" max="100" value="0" title="Dispersal">
                            <span class="fx-param-label">DISP</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fx-knob" data-param="reversal" min="0" max="100" value="0" title="Reversal">
                            <span class="fx-param-label">REV</span>
                        </div>
                    </div>
                </div>

                <!-- Modes -->
                <div class="fx-section fx-modes">
                    <span class="fx-section-label">MODE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Delay</span>
                            <div class="fx-mode-btns" id="delay-mode-btns">
                                <button class="fx-mode-btn active" data-mode="fade">Fade</button>
                                <button class="fx-mode-btn" data-mode="doppler">Dopp</button>
                                <button class="fx-mode-btn" data-mode="shimmer">Shim</button>
                                <button class="fx-mode-btn" data-mode="deshimmer">DeSh</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Feedback</span>
                            <div class="fx-mode-btns" id="feedback-mode-btns">
                                <button class="fx-mode-btn active" data-mode="normal">Norm</button>
                                <button class="fx-mode-btn" data-mode="pingPong">Ping</button>
                                <button class="fx-mode-btn" data-mode="cascade">Casc</button>
                                <button class="fx-mode-btn" data-mode="adrift">Adft</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Shimmer Intervals -->
                <div class="fx-section fx-shimmer" id="fx-shimmer-section">
                    <span class="fx-section-label">SHIMMER</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <select class="fx-interval" data-param="shimmerSemitones" title="Shimmer Interval">
                                <option value="1">+1</option>
                                <option value="2">+2</option>
                                <option value="3">+3</option>
                                <option value="4">+4</option>
                                <option value="5">+5</option>
                                <option value="6">+6</option>
                                <option value="7">+7</option>
                                <option value="8">+8</option>
                                <option value="9">+9</option>
                                <option value="10">+10</option>
                                <option value="11">+11</option>
                                <option value="12" selected>+12</option>
                            </select>
                            <span class="fx-param-label">UP</span>
                        </div>
                        <div class="fx-param">
                            <select class="fx-interval" data-param="deshimmerSemitones" title="De-Shimmer Interval">
                                <option value="1">-1</option>
                                <option value="2">-2</option>
                                <option value="3">-3</option>
                                <option value="4">-4</option>
                                <option value="5">-5</option>
                                <option value="6">-6</option>
                                <option value="7">-7</option>
                                <option value="8">-8</option>
                                <option value="9">-9</option>
                                <option value="10">-10</option>
                                <option value="11">-11</option>
                                <option value="12" selected>-12</option>
                            </select>
                            <span class="fx-param-label">DOWN</span>
                        </div>
                    </div>
                </div>

                <!-- Chroma (Feedback Effect) -->
                <div class="fx-section fx-chroma">
                    <span class="fx-section-label">CHROMA</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <select class="fx-chroma-select" data-param="chroma" title="Chroma Effect">
                                <option value="0">Oceanic</option>
                                <option value="1">White Water</option>
                                <option value="2">Refraction</option>
                                <option value="3">Pulse Amp</option>
                                <option value="4">Receptor</option>
                                <option value="5">SOS</option>
                            </select>
                            <span class="fx-param-label">TYPE</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fx-knob" data-param="depth" min="0" max="100" value="0" title="Depth">
                            <span class="fx-param-label">DEPTH</span>
                        </div>
                    </div>
                </div>

                <!-- Reverb -->
                <div class="fx-section fx-reverb">
                    <span class="fx-section-label">REVERB</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fx-knob" data-param="reverbMix" min="0" max="100" value="0" title="Reverb Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                        <div class="fx-param">
                            <select class="fx-reverb-preset" data-param="reverbPreset" title="Reverb Preset">
                                <option value="0">Normal</option>
                                <option value="1">Bright</option>
                                <option value="2">Dark</option>
                            </select>
                            <span class="fx-param-label">TYPE</span>
                        </div>
                    </div>
                </div>

                <!-- Special Controls -->
                <div class="fx-section fx-special">
                    <span class="fx-section-label">SPECIAL</span>
                    <div class="fx-special-btns">
                        <button class="fx-special-btn" id="fx-freeze-btn" title="Freeze Buffer">FREEZE</button>
                        <button class="fx-special-btn" id="fx-purge-btn" title="Purge All Buffers">PURGE</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- FX Drawer (Basil Delay) -->
        <div class="fx-drawer basil-drawer" id="basil-drawer">
            <div class="fx-drawer-header basil-header">
                <span class="fx-drawer-label basil-label">BASIL DELAY</span>
                <button class="fx-drawer-toggle" id="basil-drawer-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="fx-drawer-content" id="basil-drawer-content">
                <!-- Voice Sends -->
                <div class="fx-section basil-sends">
                    <span class="fx-section-label basil-section-label">SEND</span>
                    <div class="fx-send-controls">
                        <div class="fx-send basil-send">
                            <span class="fx-send-label">V1</span>
                            <input type="range" class="basil-send-slider" data-voice="0" min="0" max="100" value="0" title="Voice 1 Send to Basil">
                        </div>
                        <div class="fx-send basil-send">
                            <span class="fx-send-label">V2</span>
                            <input type="range" class="basil-send-slider" data-voice="1" min="0" max="100" value="0" title="Voice 2 Send to Basil">
                        </div>
                        <div class="fx-send basil-send">
                            <span class="fx-send-label">V3</span>
                            <input type="range" class="basil-send-slider" data-voice="2" min="0" max="100" value="0" title="Voice 3 Send to Basil">
                        </div>
                        <div class="fx-send basil-send insert-send">
                            <span class="fx-send-label insert-label">INS</span>
                            <input type="range" class="insert-send-slider" data-effect="basil" min="0" max="100" value="0" title="Insert FX Chain Send to Basil">
                        </div>
                    </div>
                </div>

                <!-- Core Parameters -->
                <div class="fx-section basil-core">
                    <span class="fx-section-label basil-section-label">CORE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="time" min="0" max="100" value="50" title="Time">
                            <span class="fx-param-label">TIME</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="mix" min="0" max="100" value="50" title="Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="feedback" min="0" max="100" value="30" title="Feedback">
                            <span class="fx-param-label">FDBK</span>
                        </div>
                    </div>
                </div>

                <!-- Stereo & Fine -->
                <div class="fx-section basil-stereo">
                    <span class="fx-section-label basil-section-label">STEREO</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="stereo" min="0" max="100" value="0" title="Stereo Spread">
                            <span class="fx-param-label">SPREAD</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="fine" min="0" max="100" value="50" title="Fine Tune">
                            <span class="fx-param-label">FINE</span>
                        </div>
                    </div>
                </div>

                <!-- SPACE Section -->
                <div class="fx-section basil-space">
                    <span class="fx-section-label basil-section-label">SPACE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="blur" min="0" max="100" value="50" title="Blur (CCW=Pre, CW=In Feedback)">
                            <span class="fx-param-label">BLUR</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="filter" min="0" max="100" value="50" title="Filter (CCW=LP, CW=HP)">
                            <span class="fx-param-label">FILTER</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="basil-knob" data-param="taps" min="0" max="100" value="50" title="Taps (CCW=Odd+Even, CW=Even)">
                            <span class="fx-param-label">TAPS</span>
                        </div>
                    </div>
                </div>

                <!-- Speed Mode -->
                <div class="fx-section basil-modes">
                    <span class="fx-section-label basil-section-label">MODE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Speed</span>
                            <div class="fx-mode-btns" id="basil-speed-btns">
                                <button class="basil-mode-btn active" data-mode="0">1x</button>
                                <button class="basil-mode-btn" data-mode="1">1/2</button>
                                <button class="basil-mode-btn" data-mode="2">1/4</button>
                                <button class="basil-mode-btn" data-mode="3">1/8</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Options</span>
                            <div class="fx-mode-btns" id="basil-option-btns">
                                <button class="basil-mode-btn" id="basil-lofi-btn" data-mode="lofi">LO-FI</button>
                                <button class="basil-mode-btn" id="basil-pingpong-btn" data-mode="pingpong">PING</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sync -->
                <div class="fx-section basil-sync">
                    <span class="fx-section-label basil-section-label">SYNC</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <button class="basil-sync-btn" id="basil-sync-toggle">SYNC</button>
                            <span class="fx-param-label">ENABLE</span>
                        </div>
                        <div class="fx-param">
                            <select class="basil-sync-div" id="basil-sync-division" title="Sync Division">
                                <option value="32">32 bars</option>
                                <option value="24">24 bars</option>
                                <option value="16">16 bars</option>
                                <option value="12">12 bars</option>
                                <option value="8">8 bars</option>
                                <option value="6">6 bars</option>
                                <option value="4">4 bars</option>
                                <option value="3">3 bars</option>
                                <option value="2">2 bars</option>
                                <option value="1" selected>1 bar</option>
                                <option value="0.75">3/4</option>
                                <option value="0.5">1/2</option>
                                <option value="0.333">1/3</option>
                                <option value="0.25">1/4</option>
                                <option value="0.167">1/6</option>
                                <option value="0.125">1/8</option>
                            </select>
                            <span class="fx-param-label">DIV</span>
                        </div>
                    </div>
                </div>

                <!-- Special Controls -->
                <div class="fx-section basil-special">
                    <span class="fx-section-label basil-section-label">SPECIAL</span>
                    <div class="fx-special-btns">
                        <button class="basil-special-btn" id="basil-freeze-btn" title="Freeze Buffer">FREEZE</button>
                        <button class="basil-special-btn" id="basil-purge-btn" title="Purge All Buffers">PURGE</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- FX Drawer (FDNR Reverb) -->
        <div class="fx-drawer fdnr-drawer" id="fdnr-drawer">
            <div class="fx-drawer-header fdnr-header">
                <span class="fx-drawer-label fdnr-label">FDNR REVERB</span>
                <button class="fx-drawer-toggle" id="fdnr-drawer-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="fx-drawer-content" id="fdnr-drawer-content">
                <!-- Voice Sends -->
                <div class="fx-section fdnr-sends">
                    <span class="fx-section-label fdnr-section-label">SEND</span>
                    <div class="fx-send-controls">
                        <div class="fx-send fdnr-send">
                            <span class="fx-send-label">V1</span>
                            <input type="range" class="fdnr-send-slider" data-voice="0" min="0" max="100" value="0" title="Voice 1 Send to FDNR">
                        </div>
                        <div class="fx-send fdnr-send">
                            <span class="fx-send-label">V2</span>
                            <input type="range" class="fdnr-send-slider" data-voice="1" min="0" max="100" value="0" title="Voice 2 Send to FDNR">
                        </div>
                        <div class="fx-send fdnr-send">
                            <span class="fx-send-label">V3</span>
                            <input type="range" class="fdnr-send-slider" data-voice="2" min="0" max="100" value="0" title="Voice 3 Send to FDNR">
                        </div>
                        <div class="fx-send fdnr-send insert-send">
                            <span class="fx-send-label insert-label">INS</span>
                            <input type="range" class="insert-send-slider" data-effect="fdnr" min="0" max="100" value="0" title="Insert FX Chain Send to FDNR">
                        </div>
                    </div>
                </div>

                <!-- Mode Selector -->
                <div class="fx-section fdnr-mode">
                    <span class="fx-section-label fdnr-section-label">MODE</span>
                    <div class="fx-param-row">
                        <select class="fdnr-mode-select" id="fdnr-mode-select" title="Reverb Mode/Preset">
                            <option value="0">Twin Star</option>
                            <option value="1">Sea Serpent</option>
                            <option value="2">Horse Man</option>
                            <option value="3">Archer</option>
                            <option value="4">Void Maker</option>
                            <option value="5">Galaxy Spiral</option>
                            <option value="6">Harp String</option>
                            <option value="7">Goat Horn</option>
                            <option value="8">Nebula Cloud</option>
                            <option value="9">Triangle</option>
                            <option value="10">Cloud Major</option>
                            <option value="11">Cloud Minor</option>
                            <option value="12">Queen Chair</option>
                            <option value="13">Hunter Belt</option>
                            <option value="14">Water Bearer</option>
                            <option value="15">Two Fish</option>
                            <option value="16">Scorpion Tail</option>
                            <option value="17" selected>Balance Scale</option>
                            <option value="18">Lion Heart</option>
                            <option value="19">Maiden</option>
                            <option value="20">Seven Sisters</option>
                        </select>
                    </div>
                </div>

                <!-- Core Parameters -->
                <div class="fx-section fdnr-core">
                    <span class="fx-section-label fdnr-section-label">CORE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="mix" min="0" max="100" value="50" title="Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="feedback" min="0" max="100" value="50" title="Feedback (Room Size)">
                            <span class="fx-param-label">SIZE</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="delay" min="0" max="1000" value="100" title="Pre-Delay (ms)">
                            <span class="fx-param-label">DELAY</span>
                        </div>
                    </div>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="density" min="0" max="100" value="50" title="Density (Damping)">
                            <span class="fx-param-label">DENSITY</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="width" min="0" max="100" value="100" title="Stereo Width">
                            <span class="fx-param-label">WIDTH</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="diffusion" min="0" max="100" value="100" title="Diffusion">
                            <span class="fx-param-label">DIFF</span>
                        </div>
                    </div>
                </div>

                <!-- Modulation (Warp) -->
                <div class="fx-section fdnr-mod">
                    <span class="fx-section-label fdnr-section-label">MODULATION</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="warp" min="0" max="100" value="0" title="Warp (Chorus Feedback)">
                            <span class="fx-param-label">WARP</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="modRate" min="0" max="500" value="50" title="Mod Rate (Hz x100)">
                            <span class="fx-param-label">RATE</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="modDepth" min="0" max="100" value="50" title="Mod Depth">
                            <span class="fx-param-label">DEPTH</span>
                        </div>
                    </div>
                </div>

                <!-- Dynamics -->
                <div class="fx-section fdnr-dynamics">
                    <span class="fx-section-label fdnr-section-label">DYNAMICS</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="saturation" min="0" max="100" value="0" title="Saturation">
                            <span class="fx-param-label">SAT</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="ducking" min="0" max="100" value="0" title="Ducking">
                            <span class="fx-param-label">DUCK</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="gateThresh" min="-100" max="0" value="-100" title="Gate Threshold (dB)">
                            <span class="fx-param-label">GATE</span>
                        </div>
                    </div>
                </div>

                <!-- EQ -->
                <div class="fx-section fdnr-eq">
                    <span class="fx-section-label fdnr-section-label">EQ</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="eq3Low" min="-12" max="12" value="0" title="Low (200Hz)">
                            <span class="fx-param-label">LOW</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="eq3Mid" min="-12" max="12" value="0" title="Mid (1kHz)">
                            <span class="fx-param-label">MID</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="eq3High" min="-12" max="12" value="0" title="High (6kHz)">
                            <span class="fx-param-label">HIGH</span>
                        </div>
                    </div>
                </div>

                <!-- Stereo & Sync -->
                <div class="fx-section fdnr-stereo">
                    <span class="fx-section-label fdnr-section-label">STEREO / SYNC</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="fdnr-knob" data-param="msBalance" min="0" max="100" value="50" title="M/S Balance">
                            <span class="fx-param-label">M/S</span>
                        </div>
                        <div class="fx-param">
                            <select class="fdnr-sync-select" id="fdnr-sync-select" title="Pre-Delay Sync">
                                <option value="0" selected>Free</option>
                                <option value="1">1/4</option>
                                <option value="2">1/8</option>
                                <option value="3">1/16</option>
                            </select>
                            <span class="fx-param-label">SYNC</span>
                        </div>
                        <div class="fx-param">
                            <button class="fdnr-limiter-btn active" id="fdnr-limiter-btn" title="Output Limiter">LIM</button>
                            <span class="fx-param-label">LIMIT</span>
                        </div>
                    </div>
                </div>

                <!-- Special Controls -->
                <div class="fx-section fdnr-special">
                    <span class="fx-section-label fdnr-section-label">SPECIAL</span>
                    <div class="fx-special-btns">
                        <button class="fdnr-special-btn" id="fdnr-purge-btn" title="Clear Reverb Buffers">PURGE</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- FX Drawer (Data Bender) -->
        <div class="fx-drawer databender-drawer" id="databender-drawer">
            <div class="fx-drawer-header databender-header">
                <span class="fx-drawer-label databender-label">DATA BENDER</span>
                <button class="fx-drawer-toggle" id="databender-drawer-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="fx-drawer-content" id="databender-drawer-content">
                <!-- Insert Enable/Bypass -->
                <div class="fx-section databender-enable">
                    <span class="fx-section-label databender-section-label">INSERT</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <button class="databender-enable-btn" id="databender-enable-btn" title="Enable/Bypass Data Bender Insert">OFF</button>
                            <span class="fx-mode-label">Processes all voices when ON</span>
                        </div>
                    </div>
                </div>

                <!-- Core Parameters -->
                <div class="fx-section databender-core">
                    <span class="fx-section-label databender-section-label">CORE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="time" min="0" max="100" value="50" title="Time (Buffer Period)">
                            <span class="fx-param-label">TIME</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="repeats" min="0" max="100" value="0" title="Repeats (Buffer Subdivisions)">
                            <span class="fx-param-label">RPTS</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="mix" min="0" max="100" value="50" title="Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                    </div>
                </div>

                <!-- Bend & Break -->
                <div class="fx-section databender-bendbreak">
                    <span class="fx-section-label databender-section-label">BEND / BREAK</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="bend" min="0" max="100" value="0" title="Bend (Tape Effects / Pitch)">
                            <span class="fx-param-label">BEND</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="break" min="0" max="100" value="0" title="Break (CD Skip / Traverse)">
                            <span class="fx-param-label">BREAK</span>
                        </div>
                    </div>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Enable</span>
                            <div class="fx-mode-btns">
                                <button class="databender-mode-btn" id="databender-bend-btn" data-mode="bend">BEND</button>
                                <button class="databender-mode-btn" id="databender-break-btn" data-mode="break">BREAK</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Corrupt -->
                <div class="fx-section databender-corrupt">
                    <span class="fx-section-label databender-section-label">CORRUPT</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="corrupt" min="0" max="100" value="0" title="Corrupt Amount">
                            <span class="fx-param-label">AMOUNT</span>
                        </div>
                        <div class="fx-param">
                            <select class="databender-corrupt-select" id="databender-corrupt-type" title="Corrupt Type">
                                <option value="0">Decimate</option>
                                <option value="1">Dropout</option>
                                <option value="2">Destroy</option>
                                <option value="3">DJ Filter</option>
                                <option value="4">Vinyl Sim</option>
                            </select>
                            <span class="fx-param-label">TYPE</span>
                        </div>
                    </div>
                </div>

                <!-- Mode -->
                <div class="fx-section databender-modes">
                    <span class="fx-section-label databender-section-label">MODE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Process</span>
                            <div class="fx-mode-btns" id="databender-mode-btns">
                                <button class="databender-mode-btn active" data-mode="macro">MACRO</button>
                                <button class="databender-mode-btn" data-mode="micro">MICRO</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Clock</span>
                            <div class="fx-mode-btns" id="databender-clock-btns">
                                <button class="databender-mode-btn active" data-mode="internal">INT</button>
                                <button class="databender-mode-btn" data-mode="external">EXT</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Advanced -->
                <div class="fx-section databender-advanced">
                    <span class="fx-section-label databender-section-label">ADVANCED</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="stereoWidth" min="0" max="100" value="0" title="Stereo Width Enhancement">
                            <span class="fx-param-label">WIDTH</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="databender-knob" data-param="windowing" min="0" max="100" value="2" title="Glitch Windowing (0=clicks, 100=smooth)">
                            <span class="fx-param-label">WINDOW</span>
                        </div>
                    </div>
                </div>

                <!-- Special Controls -->
                <div class="fx-section databender-special">
                    <span class="fx-section-label databender-section-label">SPECIAL</span>
                    <div class="fx-special-btns">
                        <button class="databender-special-btn" id="databender-freeze-btn" title="Freeze Buffer">FREEZE</button>
                        <button class="databender-special-btn" id="databender-purge-btn" title="Purge All Buffers">PURGE</button>
                        <button class="databender-special-btn" id="databender-reset-btn" title="Reset/Sync Clock">RESET</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- FX Drawer (Arbhar Granular) -->
        <div class="fx-drawer arbhar-drawer" id="arbhar-drawer">
            <div class="fx-drawer-header arbhar-header">
                <span class="fx-drawer-label arbhar-label">ARBHAR</span>
                <button class="fx-drawer-toggle" id="arbhar-drawer-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="fx-drawer-content" id="arbhar-drawer-content">
                <!-- Insert Enable/Bypass -->
                <div class="fx-section arbhar-enable">
                    <span class="fx-section-label arbhar-section-label">INSERT</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <button class="arbhar-enable-btn" id="arbhar-enable-btn" title="Enable/Bypass Arbhar Insert">OFF</button>
                            <span class="fx-mode-label">Granular processor</span>
                        </div>
                    </div>
                </div>

                <!-- Grain Parameters -->
                <div class="fx-section arbhar-grain">
                    <span class="fx-section-label arbhar-section-label">GRAIN</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="scan" min="0" max="100" value="50" title="Scan (Grain Position)">
                            <span class="fx-param-label">SCAN</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="spray" min="0" max="100" value="0" title="Spray (Random Offset)">
                            <span class="fx-param-label">SPRAY</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="intensity" min="0" max="100" value="25" title="Intensity (Grain Count)">
                            <span class="fx-param-label">INTNS</span>
                        </div>
                    </div>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="length" min="0" max="100" value="30" title="Length (Grain Duration)">
                            <span class="fx-param-label">LENGTH</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="pitch" min="0" max="100" value="50" title="Pitch (-2 to +2 octaves)">
                            <span class="fx-param-label">PITCH</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="pitchSpray" min="0" max="100" value="0" title="Pitch Spray (Random Deviation)">
                            <span class="fx-param-label">P.SPRY</span>
                        </div>
                    </div>
                </div>

                <!-- Grain Shape -->
                <div class="fx-section arbhar-shape">
                    <span class="fx-section-label arbhar-section-label">SHAPE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <select class="arbhar-select" id="arbhar-window" title="Grain Window Shape">
                                <option value="0">Gaussian</option>
                                <option value="1">Square</option>
                                <option value="2">Sawtooth</option>
                            </select>
                            <span class="fx-param-label">WINDOW</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="tilt" min="0" max="100" value="50" title="Tilt (Sawtooth Asymmetry)">
                            <span class="fx-param-label">TILT</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="direction" min="0" max="100" value="50" title="Direction (Reverse Probability)">
                            <span class="fx-param-label">DIR</span>
                        </div>
                    </div>
                </div>

                <!-- Mode -->
                <div class="fx-section arbhar-modes">
                    <span class="fx-section-label arbhar-section-label">MODE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Scan Mode</span>
                            <div class="fx-mode-btns" id="arbhar-scanmode-btns">
                                <button class="arbhar-mode-btn active" data-mode="0" title="Fixed position">SCAN</button>
                                <button class="arbhar-mode-btn" data-mode="1" title="Playhead follows">FOLLOW</button>
                                <button class="arbhar-mode-btn" data-mode="2" title="Wavetable mode">WAVE</button>
                            </div>
                        </div>
                    </div>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Layer</span>
                            <div class="fx-mode-btns" id="arbhar-layer-btns">
                                <button class="arbhar-mode-btn active" data-layer="0" title="Alpha">α</button>
                                <button class="arbhar-mode-btn" data-layer="1" title="Beta">β</button>
                                <button class="arbhar-mode-btn" data-layer="2" title="Gamma">γ</button>
                                <button class="arbhar-mode-btn" data-layer="3" title="Delta">δ</button>
                                <button class="arbhar-mode-btn" data-layer="4" title="Epsilon">ε</button>
                                <button class="arbhar-mode-btn" data-layer="5" title="Zeta">ζ</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Effects -->
                <div class="fx-section arbhar-effects">
                    <span class="fx-section-label arbhar-section-label">EFFECTS</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="reverbMix" min="0" max="100" value="0" title="Reverb Mix">
                            <span class="fx-param-label">VERB</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="feedback" min="0" max="100" value="0" title="Feedback/Delay">
                            <span class="fx-param-label">FDBK</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="mix" min="0" max="100" value="50" title="Dry/Wet Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                    </div>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="pan" min="0" max="100" value="50" title="Pan Position">
                            <span class="fx-param-label">PAN</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="arbhar-knob" data-param="panSpray" min="0" max="100" value="50" title="Pan Spray (Stereo Width)">
                            <span class="fx-param-label">P.SPRY</span>
                        </div>
                    </div>
                </div>

                <!-- Engine & Recording -->
                <div class="fx-section arbhar-engine">
                    <span class="fx-section-label arbhar-section-label">ENGINE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Engines</span>
                            <div class="fx-mode-btns">
                                <button class="arbhar-mode-btn active" id="arbhar-continuous-btn" title="Continuous grain generation">CONT</button>
                                <button class="arbhar-mode-btn" id="arbhar-strike-btn" title="Strike-triggered grains">STRIKE</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Capture</span>
                            <div class="fx-mode-btns">
                                <button class="arbhar-mode-btn active" id="arbhar-autocapture-btn" title="Auto-capture on onset">AUTO</button>
                                <button class="arbhar-mode-btn" id="arbhar-record-btn" title="Manual record">REC</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pitch Quantize -->
                <div class="fx-section arbhar-pitch">
                    <span class="fx-section-label arbhar-section-label">QUANTIZE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <button class="arbhar-mode-btn" id="arbhar-quantize-btn" title="Enable Pitch Quantization">QUANT</button>
                            <select class="arbhar-select" id="arbhar-scale" title="Quantization Scale">
                                <option value="0">Chromatic</option>
                                <option value="1">Major</option>
                                <option value="2">Minor</option>
                                <option value="3">Pentatonic</option>
                                <option value="4">Whole Tone</option>
                                <option value="5">Fifths</option>
                                <option value="6">Octaves</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Special Controls -->
                <div class="fx-section arbhar-special">
                    <span class="fx-section-label arbhar-section-label">SPECIAL</span>
                    <div class="fx-special-btns">
                        <button class="arbhar-special-btn" id="arbhar-freeze-btn" title="Freeze">FREEZE</button>
                        <button class="arbhar-special-btn" id="arbhar-strike-trigger-btn" title="Trigger Strike">STRIKE!</button>
                        <button class="arbhar-special-btn" id="arbhar-clear-btn" title="Clear Current Layer">CLEAR</button>
                        <button class="arbhar-special-btn" id="arbhar-clearall-btn" title="Clear All Layers">CLR ALL</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- FX Drawer (Morphagene) -->
        <div class="fx-drawer morphagene-drawer" id="morphagene-drawer">
            <div class="fx-drawer-header morphagene-header">
                <span class="fx-drawer-label morphagene-label">MORPHAGENE</span>
                <button class="fx-drawer-toggle" id="morphagene-drawer-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="fx-drawer-content" id="morphagene-drawer-content">
                <!-- Insert Enable/Bypass -->
                <div class="fx-section morphagene-enable">
                    <span class="fx-section-label morphagene-section-label">INSERT</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <button class="morphagene-enable-btn" id="morphagene-enable-btn" title="Enable/Bypass Morphagene Insert">OFF</button>
                            <span class="fx-mode-label">Tape microsound processor</span>
                        </div>
                    </div>
                </div>

                <!-- Core Parameters -->
                <div class="fx-section morphagene-core">
                    <span class="fx-section-label morphagene-section-label">TRANSPORT</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="morphagene-knob" data-param="varispeed" min="0" max="100" value="75" title="Varispeed (0=rev, 50=stop, 100=fwd)">
                            <span class="fx-param-label">VARI</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="morphagene-knob" data-param="organize" min="0" max="100" value="0" title="Organize (Splice Selection)">
                            <span class="fx-param-label">ORG</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="morphagene-knob" data-param="sos" min="0" max="100" value="100" title="S.O.S (0=input, 100=playback)">
                            <span class="fx-param-label">SOS</span>
                        </div>
                    </div>
                </div>

                <!-- Gene Parameters -->
                <div class="fx-section morphagene-gene">
                    <span class="fx-section-label morphagene-section-label">GENE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="morphagene-knob" data-param="geneSize" min="0" max="100" value="0" title="Gene Size (0=full splice, 100=microsound)">
                            <span class="fx-param-label">SIZE</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="morphagene-knob" data-param="slide" min="0" max="100" value="0" title="Slide (Position within splice)">
                            <span class="fx-param-label">SLIDE</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="morphagene-knob" data-param="morph" min="0" max="100" value="30" title="Morph (Gene overlap, 30=seamless)">
                            <span class="fx-param-label">MORPH</span>
                        </div>
                    </div>
                </div>

                <!-- Mix -->
                <div class="fx-section morphagene-mix">
                    <span class="fx-section-label morphagene-section-label">MIX</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="morphagene-knob" data-param="mix" min="0" max="100" value="100" title="Dry/Wet Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                    </div>
                </div>

                <!-- Transport Controls -->
                <div class="fx-section morphagene-transport">
                    <span class="fx-section-label morphagene-section-label">CONTROL</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Speed</span>
                            <div class="fx-mode-btns">
                                <button class="morphagene-mode-btn" id="morphagene-rev1x-btn" title="Reverse 1x">◀1x</button>
                                <button class="morphagene-mode-btn" id="morphagene-stop-btn" title="Stop">■</button>
                                <button class="morphagene-mode-btn active" id="morphagene-fwd1x-btn" title="Forward 1x">▶1x</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Play</span>
                            <div class="fx-mode-btns">
                                <button class="morphagene-mode-btn active" id="morphagene-play-btn" title="Play/Pause">PLAY</button>
                                <button class="morphagene-mode-btn" id="morphagene-trigger-btn" title="Trigger/Restart">TRIG</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Recording Controls -->
                <div class="fx-section morphagene-recording">
                    <span class="fx-section-label morphagene-section-label">RECORD</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Record</span>
                            <div class="fx-mode-btns">
                                <button class="morphagene-mode-btn" id="morphagene-rec-btn" title="Record (Sound on Sound)">REC</button>
                                <button class="morphagene-mode-btn" id="morphagene-newsplice-btn" title="Record New Splice">+SPLICE</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Splice</span>
                            <div class="fx-mode-btns">
                                <button class="morphagene-mode-btn" id="morphagene-splice-btn" title="Create Splice Marker">MARK</button>
                                <button class="morphagene-mode-btn" id="morphagene-shift-btn" title="Shift to Next Splice">SHIFT</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sample Loading -->
                <div class="fx-section morphagene-sample">
                    <span class="fx-section-label morphagene-section-label">SAMPLE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <input type="file" id="morphagene-file-input" accept="audio/*" style="display:none;">
                            <button class="morphagene-mode-btn" id="morphagene-load-btn" title="Load Audio Sample">LOAD</button>
                            <span class="fx-mode-label" id="morphagene-sample-name">No sample</span>
                        </div>
                    </div>
                </div>

                <!-- Special Controls -->
                <div class="fx-section morphagene-special">
                    <span class="fx-section-label morphagene-section-label">SPECIAL</span>
                    <div class="fx-special-btns">
                        <button class="morphagene-special-btn" id="morphagene-freeze-btn" title="Freeze">FREEZE</button>
                        <button class="morphagene-special-btn" id="morphagene-init-btn" title="Initialize (1/1 playback)">INIT</button>
                        <button class="morphagene-special-btn" id="morphagene-clear-btn" title="Clear Reel">CLEAR</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- FX Drawer (Lubadh) -->
        <div class="fx-drawer lubadh-drawer" id="lubadh-drawer">
            <div class="fx-drawer-header lubadh-header">
                <span class="fx-drawer-label lubadh-label">LÚBADH</span>
                <button class="fx-drawer-toggle" id="lubadh-drawer-toggle" title="Expand/Collapse">▼</button>
            </div>
            <div class="fx-drawer-content" id="lubadh-drawer-content">
                <!-- Insert Enable/Bypass -->
                <div class="fx-section lubadh-enable">
                    <span class="fx-section-label lubadh-section-label">INSERT</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <button class="lubadh-enable-btn" id="lubadh-enable-btn" title="Enable/Bypass Lubadh Insert">OFF</button>
                            <span class="fx-mode-label">Dual deck tape looper</span>
                        </div>
                    </div>
                </div>

                <!-- Link Mode -->
                <div class="fx-section lubadh-link">
                    <span class="fx-section-label lubadh-section-label">MODE</span>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <button class="lubadh-mode-btn" id="lubadh-link-btn" title="Link decks for stereo operation">LINK</button>
                            <span class="fx-mode-label">Stereo link</span>
                        </div>
                    </div>
                </div>

                <!-- Deck A Controls -->
                <div class="fx-section lubadh-deck-a">
                    <span class="fx-section-label lubadh-section-label">DECK A</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="speedA" min="0" max="100" value="75" title="Speed A (0=4x rev, 50=stall, 100=4x fwd)">
                            <span class="fx-param-label">SPEED</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="startA" min="0" max="100" value="0" title="Loop Start Position A">
                            <span class="fx-param-label">START</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="lengthA" min="0" max="100" value="100" title="Loop Length A">
                            <span class="fx-param-label">LENGTH</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="dubLevelA" min="0" max="100" value="90" title="Overdub Feedback A (lower=faster decay)">
                            <span class="fx-param-label">DUB</span>
                        </div>
                    </div>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Transport</span>
                            <div class="fx-mode-btns">
                                <button class="lubadh-mode-btn" id="lubadh-rev-a-btn" title="Reverse 1x">◀1x</button>
                                <button class="lubadh-mode-btn" id="lubadh-stall-a-btn" title="Stall">■</button>
                                <button class="lubadh-mode-btn active" id="lubadh-fwd-a-btn" title="Forward 1x">▶1x</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Record</span>
                            <div class="fx-mode-btns">
                                <button class="lubadh-mode-btn" id="lubadh-rec-a-btn" title="Record/Overdub">REC</button>
                                <button class="lubadh-mode-btn active" id="lubadh-mon-a-btn" title="Input Monitor (pass input through)">MON</button>
                                <button class="lubadh-mode-btn" id="lubadh-retrig-a-btn" title="Retrigger">TRIG</button>
                            </div>
                        </div>
                    </div>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <input type="file" id="lubadh-file-a-input" accept="audio/*" style="display:none;">
                            <button class="lubadh-mode-btn" id="lubadh-load-a-btn" title="Load Sample to Deck A">LOAD</button>
                            <span class="fx-mode-label" id="lubadh-sample-a-name">No sample</span>
                        </div>
                        <div class="fx-mode-group">
                            <button class="lubadh-mode-btn" id="lubadh-erase-a-btn" title="Erase Deck A">ERASE</button>
                        </div>
                    </div>
                </div>

                <!-- Deck B Controls -->
                <div class="fx-section lubadh-deck-b">
                    <span class="fx-section-label lubadh-section-label">DECK B</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="speedB" min="0" max="100" value="75" title="Speed B (0=4x rev, 50=stall, 100=4x fwd)">
                            <span class="fx-param-label">SPEED</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="startB" min="0" max="100" value="0" title="Loop Start Position B">
                            <span class="fx-param-label">START</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="lengthB" min="0" max="100" value="100" title="Loop Length B">
                            <span class="fx-param-label">LENGTH</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="dubLevelB" min="0" max="100" value="90" title="Overdub Feedback B (lower=faster decay)">
                            <span class="fx-param-label">DUB</span>
                        </div>
                    </div>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Transport</span>
                            <div class="fx-mode-btns">
                                <button class="lubadh-mode-btn" id="lubadh-rev-b-btn" title="Reverse 1x">◀1x</button>
                                <button class="lubadh-mode-btn" id="lubadh-stall-b-btn" title="Stall">■</button>
                                <button class="lubadh-mode-btn active" id="lubadh-fwd-b-btn" title="Forward 1x">▶1x</button>
                            </div>
                        </div>
                        <div class="fx-mode-group">
                            <span class="fx-mode-label">Record</span>
                            <div class="fx-mode-btns">
                                <button class="lubadh-mode-btn" id="lubadh-rec-b-btn" title="Record/Overdub">REC</button>
                                <button class="lubadh-mode-btn active" id="lubadh-mon-b-btn" title="Input Monitor (pass input through)">MON</button>
                                <button class="lubadh-mode-btn" id="lubadh-retrig-b-btn" title="Retrigger">TRIG</button>
                            </div>
                        </div>
                    </div>
                    <div class="fx-mode-row">
                        <div class="fx-mode-group">
                            <input type="file" id="lubadh-file-b-input" accept="audio/*" style="display:none;">
                            <button class="lubadh-mode-btn" id="lubadh-load-b-btn" title="Load Sample to Deck B">LOAD</button>
                            <span class="fx-mode-label" id="lubadh-sample-b-name">No sample</span>
                        </div>
                        <div class="fx-mode-group">
                            <button class="lubadh-mode-btn" id="lubadh-erase-b-btn" title="Erase Deck B">ERASE</button>
                        </div>
                    </div>
                </div>

                <!-- Tape Emulation -->
                <div class="fx-section lubadh-tape">
                    <span class="fx-section-label lubadh-section-label">TAPE</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="tapeEmulation" min="0" max="100" value="50" title="Tape Emulation Amount">
                            <span class="fx-param-label">TAPE</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="saturation" min="0" max="100" value="40" title="Saturation/Warmth">
                            <span class="fx-param-label">SAT</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="wowFlutter" min="0" max="100" value="30" title="Wow & Flutter">
                            <span class="fx-param-label">WOW</span>
                        </div>
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="crossfadeDuration" min="0" max="100" value="50" title="Loop Crossfade Duration">
                            <span class="fx-param-label">XFADE</span>
                        </div>
                    </div>
                </div>

                <!-- Mix -->
                <div class="fx-section lubadh-mix">
                    <span class="fx-section-label lubadh-section-label">MIX</span>
                    <div class="fx-param-row">
                        <div class="fx-param">
                            <input type="range" class="lubadh-knob" data-param="mix" min="0" max="100" value="100" title="Dry/Wet Mix">
                            <span class="fx-param-label">MIX</span>
                        </div>
                    </div>
                </div>

                <!-- Special Controls -->
                <div class="fx-section lubadh-special">
                    <span class="fx-section-label lubadh-section-label">SPECIAL</span>
                    <div class="fx-special-btns">
                        <button class="lubadh-special-btn" id="lubadh-init-btn" title="Initialize (reset to defaults)">INIT</button>
                        <button class="lubadh-special-btn" id="lubadh-clear-all-btn" title="Clear All Decks">CLR ALL</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Settings Panel -->
        <div class="settings-panel" id="settings-panel">
            <h2>Settings</h2>
            <div class="settings-section">
                <h3>Tempo</h3>
                <input type="range" id="bpm-slider" min="40" max="200" value="120">
            </div>
            <div class="settings-section">
                <h3>Master Volume</h3>
                <input type="range" id="volume-slider" min="0" max="100" value="80">
            </div>
            <div class="settings-section">
                <h3>Device Sensors</h3>
                <button class="randomize-btn" id="calibrate-btn">Calibrate Tilt</button>
            </div>
        </div>
    `;

    document.body.appendChild(app);

    // Cache element references
    elements.app = app;
    elements.startScreen = document.getElementById('start-screen');
    elements.startBtn = document.getElementById('start-btn');
    elements.playBtn = document.getElementById('play-btn');
    elements.resetBtn = document.getElementById('reset-btn');
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.randomizeBtn = document.getElementById('randomize-btn');
    elements.settingsPanel = document.getElementById('settings-panel');
    elements.xyContainer = document.getElementById('xy-container');
    elements.bpmDisplay = document.getElementById('bpm-display');
    elements.rootDisplay = document.getElementById('root-display');
    elements.scaleDisplay = document.getElementById('scale-display');
    elements.scaleSelect = document.getElementById('scale-select');
    elements.bpmSlider = document.getElementById('bpm-slider');
    elements.volumeSlider = document.getElementById('volume-slider');
    elements.polymetricSelect = document.getElementById('polymetric-select');
    elements.phaseSelect = document.getElementById('phase-select');
    elements.visualizerCanvas = document.getElementById('visualizer-canvas');
    elements.voiceMutes = document.querySelectorAll('.mute-btn');
    elements.copySelects = document.querySelectorAll('.copy-select');
    elements.transposeCells = document.querySelectorAll('.transpose-cell');
    elements.transposeStepsSelect = document.getElementById('transpose-steps');
    elements.transposeBarsSelect = document.getElementById('transpose-bars');
    elements.transposeClearBtn = document.getElementById('transpose-clear');

    // Buchla panel elements
    elements.buchlaKnobs = document.querySelectorAll('.buchla-knob');
    elements.octaveBtns = document.querySelectorAll('.octave-btn');
    elements.waveBtns = document.querySelectorAll('.wave-btn');
    elements.envModeBtns = document.querySelectorAll('.env-mode-btn');

    // Generate LFO bank rows
    const lfoBankContent = document.getElementById('lfo-bank-content');
    for (let i = 0; i < 12; i++) {
        const row = document.createElement('div');
        row.className = 'lfo-row';
        row.dataset.lfo = i;
        row.innerHTML = `
            <button class="lfo-toggle" data-lfo="${i}" title="Enable/Disable LFO ${i+1}">${i+1}</button>
            <div class="lfo-controls">
                <div class="lfo-control-group">
                    <label>Rate</label>
                    <input type="range" class="lfo-rate" data-lfo="${i}" min="0" max="100" value="30" title="LFO Rate">
                </div>
                <div class="lfo-control-group">
                    <label>Depth</label>
                    <input type="range" class="lfo-depth" data-lfo="${i}" min="0" max="100" value="50" title="LFO Depth">
                </div>
                <select class="lfo-shape" data-lfo="${i}" title="LFO Shape">
                    <option value="sine">Sine</option>
                    <option value="triangle">Tri</option>
                    <option value="square">Sqr</option>
                    <option value="sawtooth">Saw</option>
                    <option value="random">S&H</option>
                </select>
                <select class="lfo-sync" data-lfo="${i}" title="Sync Mode">
                    <option value="free">Free</option>
                    <option value="sync">Sync</option>
                </select>
                <select class="lfo-sync-div" data-lfo="${i}" title="Sync Division" style="display:none;">
                    <option value="0.0625">4 bars</option>
                    <option value="0.125">2 bars</option>
                    <option value="0.25">1 bar</option>
                    <option value="0.5">1/2</option>
                    <option value="1">1/4</option>
                    <option value="2">1/8</option>
                    <option value="4">1/16</option>
                    <option value="0.667">1/4T</option>
                    <option value="1.333">1/8T</option>
                </select>
                <select class="lfo-polarity" data-lfo="${i}" title="Polarity">
                    <option value="bipolar">±</option>
                    <option value="unipolar+">+</option>
                    <option value="unipolar-">−</option>
                </select>
            </div>
            <div class="lfo-destinations">
                <select class="lfo-dest" data-lfo="${i}" data-slot="0" title="Destination 1">
                    <option value="">Dest 1</option>
                </select>
                <select class="lfo-dest" data-lfo="${i}" data-slot="1" title="Destination 2">
                    <option value="">Dest 2</option>
                </select>
            </div>
        `;
        lfoBankContent.appendChild(row);
    }

    // Cache LFO element references
    elements.lfoBankToggle = document.getElementById('lfo-bank-toggle');
    elements.lfoBankContent = document.getElementById('lfo-bank-content');
    elements.lfoToggles = document.querySelectorAll('.lfo-toggle');
    elements.lfoRates = document.querySelectorAll('.lfo-rate');
    elements.lfoDepths = document.querySelectorAll('.lfo-depth');
    elements.lfoShapes = document.querySelectorAll('.lfo-shape');
    elements.lfoSyncs = document.querySelectorAll('.lfo-sync');
    elements.lfoSyncDivs = document.querySelectorAll('.lfo-sync-div');
    elements.lfoPolarities = document.querySelectorAll('.lfo-polarity');
    elements.lfoDests = document.querySelectorAll('.lfo-dest');

    // Cache FX Drawer element references
    elements.fxDrawerToggle = document.getElementById('fx-drawer-toggle');
    elements.fxDrawerContent = document.getElementById('fx-drawer-content');
    elements.fxSendSliders = document.querySelectorAll('.fx-send-slider');
    elements.fxKnobs = document.querySelectorAll('.fx-knob');
    elements.fxResolution = document.querySelector('.fx-resolution');
    elements.fxDelayModeBtns = document.querySelectorAll('#delay-mode-btns .fx-mode-btn');
    elements.fxFeedbackModeBtns = document.querySelectorAll('#feedback-mode-btns .fx-mode-btn');
    elements.fxShimmerSection = document.getElementById('fx-shimmer-section');
    elements.fxIntervals = document.querySelectorAll('.fx-interval');
    elements.fxChromaSelect = document.querySelector('.fx-chroma-select');
    elements.fxReverbPreset = document.querySelector('.fx-reverb-preset');
    elements.fxFreezeBtn = document.getElementById('fx-freeze-btn');
    elements.fxPurgeBtn = document.getElementById('fx-purge-btn');

    // Cache Basil Drawer element references
    elements.basilDrawerToggle = document.getElementById('basil-drawer-toggle');
    elements.basilDrawerContent = document.getElementById('basil-drawer-content');
    elements.basilSendSliders = document.querySelectorAll('.basil-send-slider');
    elements.basilKnobs = document.querySelectorAll('.basil-knob');
    elements.basilSpeedBtns = document.querySelectorAll('#basil-speed-btns .basil-mode-btn');
    elements.basilLoFiBtn = document.getElementById('basil-lofi-btn');
    elements.basilPingPongBtn = document.getElementById('basil-pingpong-btn');
    elements.basilSyncToggle = document.getElementById('basil-sync-toggle');
    elements.basilSyncDivision = document.getElementById('basil-sync-division');
    elements.basilFreezeBtn = document.getElementById('basil-freeze-btn');
    elements.basilPurgeBtn = document.getElementById('basil-purge-btn');

    // FDNR Reverb elements
    elements.fdnrDrawerToggle = document.getElementById('fdnr-drawer-toggle');
    elements.fdnrDrawerContent = document.getElementById('fdnr-drawer-content');
    elements.fdnrSendSliders = document.querySelectorAll('.fdnr-send-slider');
    elements.fdnrModeSelect = document.getElementById('fdnr-mode-select');
    elements.fdnrKnobs = document.querySelectorAll('.fdnr-knob');
    elements.fdnrSyncSelect = document.getElementById('fdnr-sync-select');
    elements.fdnrLimiterBtn = document.getElementById('fdnr-limiter-btn');
    elements.fdnrPurgeBtn = document.getElementById('fdnr-purge-btn');

    // Insert Send sliders (INS sends from insert chain to each effect)
    elements.insertSendSliders = document.querySelectorAll('.insert-send-slider');

    // Data Bender elements
    elements.databenderDrawerToggle = document.getElementById('databender-drawer-toggle');
    elements.databenderDrawerContent = document.getElementById('databender-drawer-content');
    elements.databenderEnableBtn = document.getElementById('databender-enable-btn');
    elements.databenderKnobs = document.querySelectorAll('.databender-knob');
    elements.databenderModeBtns = document.querySelectorAll('#databender-mode-btns .databender-mode-btn');
    elements.databenderClockBtns = document.querySelectorAll('#databender-clock-btns .databender-mode-btn');
    elements.databenderBendBtn = document.getElementById('databender-bend-btn');
    elements.databenderBreakBtn = document.getElementById('databender-break-btn');
    elements.databenderCorruptType = document.getElementById('databender-corrupt-type');
    elements.databenderFreezeBtn = document.getElementById('databender-freeze-btn');
    elements.databenderPurgeBtn = document.getElementById('databender-purge-btn');
    elements.databenderResetBtn = document.getElementById('databender-reset-btn');

    // Arbhar elements
    elements.arbharDrawerToggle = document.getElementById('arbhar-drawer-toggle');
    elements.arbharDrawerContent = document.getElementById('arbhar-drawer-content');
    elements.arbharEnableBtn = document.getElementById('arbhar-enable-btn');
    elements.arbharKnobs = document.querySelectorAll('.arbhar-knob');
    elements.arbharScanModeBtns = document.querySelectorAll('#arbhar-scanmode-btns .arbhar-mode-btn');
    elements.arbharLayerBtns = document.querySelectorAll('#arbhar-layer-btns .arbhar-mode-btn');
    elements.arbharWindowSelect = document.getElementById('arbhar-window');
    elements.arbharContinuousBtn = document.getElementById('arbhar-continuous-btn');
    elements.arbharStrikeBtn = document.getElementById('arbhar-strike-btn');
    elements.arbharAutoCaptureBtn = document.getElementById('arbhar-autocapture-btn');
    elements.arbharRecordBtn = document.getElementById('arbhar-record-btn');
    elements.arbharQuantizeBtn = document.getElementById('arbhar-quantize-btn');
    elements.arbharScaleSelect = document.getElementById('arbhar-scale');
    elements.arbharFreezeBtn = document.getElementById('arbhar-freeze-btn');
    elements.arbharStrikeTriggerBtn = document.getElementById('arbhar-strike-trigger-btn');
    elements.arbharClearBtn = document.getElementById('arbhar-clear-btn');
    elements.arbharClearAllBtn = document.getElementById('arbhar-clearall-btn');

    // Morphagene elements
    elements.morphageneDrawerToggle = document.getElementById('morphagene-drawer-toggle');
    elements.morphageneDrawerContent = document.getElementById('morphagene-drawer-content');
    elements.morphageneEnableBtn = document.getElementById('morphagene-enable-btn');
    elements.morphageneKnobs = document.querySelectorAll('.morphagene-knob');
    elements.morphageneRev1xBtn = document.getElementById('morphagene-rev1x-btn');
    elements.morphageneStopBtn = document.getElementById('morphagene-stop-btn');
    elements.morphageneFwd1xBtn = document.getElementById('morphagene-fwd1x-btn');
    elements.morphagenePlayBtn = document.getElementById('morphagene-play-btn');
    elements.morphageneTriggerBtn = document.getElementById('morphagene-trigger-btn');
    elements.morphageneRecBtn = document.getElementById('morphagene-rec-btn');
    elements.morphageneNewSpliceBtn = document.getElementById('morphagene-newsplice-btn');
    elements.morphageneSpliceBtn = document.getElementById('morphagene-splice-btn');
    elements.morphageneShiftBtn = document.getElementById('morphagene-shift-btn');
    elements.morphageneFileInput = document.getElementById('morphagene-file-input');
    elements.morphageneLoadBtn = document.getElementById('morphagene-load-btn');
    elements.morphageneSampleName = document.getElementById('morphagene-sample-name');
    elements.morphageneFreezeBtn = document.getElementById('morphagene-freeze-btn');
    elements.morphageneInitBtn = document.getElementById('morphagene-init-btn');
    elements.morphageneClearBtn = document.getElementById('morphagene-clear-btn');

    // Lubadh elements
    elements.lubadhDrawerToggle = document.getElementById('lubadh-drawer-toggle');
    elements.lubadhDrawerContent = document.getElementById('lubadh-drawer-content');
    elements.lubadhEnableBtn = document.getElementById('lubadh-enable-btn');
    elements.lubadhLinkBtn = document.getElementById('lubadh-link-btn');
    elements.lubadhKnobs = document.querySelectorAll('.lubadh-knob');
    // Deck A
    elements.lubadhRevABtn = document.getElementById('lubadh-rev-a-btn');
    elements.lubadhStallABtn = document.getElementById('lubadh-stall-a-btn');
    elements.lubadhFwdABtn = document.getElementById('lubadh-fwd-a-btn');
    elements.lubadhRecABtn = document.getElementById('lubadh-rec-a-btn');
    elements.lubadhMonABtn = document.getElementById('lubadh-mon-a-btn');
    elements.lubadhRetrigABtn = document.getElementById('lubadh-retrig-a-btn');
    elements.lubadhFileAInput = document.getElementById('lubadh-file-a-input');
    elements.lubadhLoadABtn = document.getElementById('lubadh-load-a-btn');
    elements.lubadhSampleAName = document.getElementById('lubadh-sample-a-name');
    elements.lubadhEraseABtn = document.getElementById('lubadh-erase-a-btn');
    // Deck B
    elements.lubadhRevBBtn = document.getElementById('lubadh-rev-b-btn');
    elements.lubadhStallBBtn = document.getElementById('lubadh-stall-b-btn');
    elements.lubadhFwdBBtn = document.getElementById('lubadh-fwd-b-btn');
    elements.lubadhRecBBtn = document.getElementById('lubadh-rec-b-btn');
    elements.lubadhMonBBtn = document.getElementById('lubadh-mon-b-btn');
    elements.lubadhRetrigBBtn = document.getElementById('lubadh-retrig-b-btn');
    elements.lubadhFileBInput = document.getElementById('lubadh-file-b-input');
    elements.lubadhLoadBBtn = document.getElementById('lubadh-load-b-btn');
    elements.lubadhSampleBName = document.getElementById('lubadh-sample-b-name');
    elements.lubadhEraseBBtn = document.getElementById('lubadh-erase-b-btn');
    // Special
    elements.lubadhInitBtn = document.getElementById('lubadh-init-btn');
    elements.lubadhClearAllBtn = document.getElementById('lubadh-clear-all-btn');
}

// Setup event listeners
function setupEventListeners() {
    // Start button
    elements.startBtn.addEventListener('click', handleStart);

    // Play/pause button
    elements.playBtn.addEventListener('click', () => {
        glassMachine?.toggle();
    });

    // Reset button - resets clock for all voices and modulation
    elements.resetBtn.addEventListener('click', () => {
        glassMachine?.reset();
        // Visual feedback
        elements.resetBtn.classList.add('pulse');
        setTimeout(() => elements.resetBtn.classList.remove('pulse'), 300);
    });

    // Settings button
    elements.settingsBtn.addEventListener('click', () => {
        elements.settingsPanel.classList.toggle('open');
    });

    // Close settings when clicking outside
    document.addEventListener('click', (e) => {
        if (elements.settingsPanel.classList.contains('open') &&
            !elements.settingsPanel.contains(e.target) &&
            !elements.settingsBtn.contains(e.target)) {
            elements.settingsPanel.classList.remove('open');
        }
    });

    // Scale select
    elements.scaleSelect.addEventListener('change', (e) => {
        glassMachine?.setScale(e.target.value);
    });

    // Polymetric select
    elements.polymetricSelect.addEventListener('change', (e) => {
        glassMachine?.setPolymetricPreset(e.target.value);
    });

    // Phase select
    elements.phaseSelect.addEventListener('change', (e) => {
        glassMachine?.setPhasePreset(e.target.value);
    });

    // BPM slider
    elements.bpmSlider.addEventListener('input', (e) => {
        glassMachine?.setBpm(parseInt(e.target.value));
    });

    // Volume slider
    elements.volumeSlider.addEventListener('input', (e) => {
        glassMachine?.setMasterVolume(parseInt(e.target.value) / 100);
    });

    // Root select
    document.getElementById('root-select')?.addEventListener('change', (e) => {
        glassMachine?.setRoot(parseInt(e.target.value));
    });

    // Voice mutes
    elements.voiceMutes.forEach((btn) => {
        btn.addEventListener('click', () => {
            const voiceId = parseInt(btn.dataset.voice);
            btn.classList.toggle('muted');
            glassMachine?.setVoiceMuted(voiceId, btn.classList.contains('muted'));
        });
    });

    // Copy voice selects
    elements.copySelects.forEach((select) => {
        select.addEventListener('change', () => {
            const sourceId = parseInt(select.dataset.voice);
            const targetValue = select.value;
            if (!targetValue) return; // Empty option selected

            // Parse target IDs (can be "1" or "0,2" for multiple)
            const targetIds = targetValue.split(',').map(id => parseInt(id));
            glassMachine?.copyVoice(sourceId, targetIds);

            // Reset select to default option
            select.selectedIndex = 0;

            // Visual feedback on the source Buchla panel
            const panel = select.closest('.buchla-panel');
            panel?.classList.add('pulse');
            setTimeout(() => panel?.classList.remove('pulse'), 300);
        });
    });

    // === BUCHLA PANEL CONTROLS ===

    // Buchla knob sliders
    elements.buchlaKnobs.forEach((slider) => {
        slider.addEventListener('input', () => {
            const voiceId = parseInt(slider.dataset.voice);
            const param = slider.dataset.param;
            const rawValue = parseInt(slider.value);

            // Convert slider 0-100 to actual values based on param
            let value;
            switch (param) {
                case 'fmRatio':
                    // 0.5 to 8 (exponential feel)
                    value = 0.5 + (rawValue / 100) * 7.5;
                    break;
                case 'fmIndex':
                    // 0 to 1
                    value = rawValue / 100;
                    break;
                case 'foldAmount':
                    // 0 to 1
                    value = rawValue / 100;
                    break;
                case 'foldSymmetry':
                    // 0 to 1
                    value = rawValue / 100;
                    break;
                case 'lpgCutoff':
                    // 50 to 12000 Hz (exponential)
                    value = 50 * Math.pow(240, rawValue / 100);
                    break;
                case 'lpgResonance':
                    // 0 to 20
                    value = rawValue / 5;
                    break;
                case 'lpgResponse':
                    // 0 to 1
                    value = rawValue / 100;
                    break;
                case 'attack':
                    // 0.001 to 2 seconds (exponential)
                    value = 0.001 * Math.pow(2000, rawValue / 100);
                    break;
                case 'decay':
                    // 0.001 to 4 seconds (exponential)
                    value = 0.001 * Math.pow(4000, rawValue / 100);
                    break;
                case 'level':
                    // 0 to 1
                    value = rawValue / 100;
                    break;
                case 'pan':
                    // -1 to 1
                    value = (rawValue / 50) - 1;
                    break;
                default:
                    value = rawValue / 100;
            }

            glassMachine?.setVoiceParam(voiceId, param, value);
        });
    });

    // Octave buttons
    elements.octaveBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const voiceId = parseInt(btn.dataset.voice);
            const octave = parseInt(btn.dataset.oct);

            // Update active state for this voice's octave buttons
            document.querySelectorAll(`.octave-btn[data-voice="${voiceId}"]`).forEach(b => {
                b.classList.toggle('active', b === btn);
            });

            glassMachine?.setVoiceParam(voiceId, 'octave', octave);
        });
    });

    // Waveform buttons
    elements.waveBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const voiceId = parseInt(btn.dataset.voice);
            const wave = btn.dataset.wave;

            // Update active state for this voice's wave buttons
            document.querySelectorAll(`.wave-btn[data-voice="${voiceId}"]`).forEach(b => {
                b.classList.toggle('active', b === btn);
            });

            glassMachine?.setVoiceParam(voiceId, 'carrierType', wave);
        });
    });

    // Envelope mode buttons
    elements.envModeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const voiceId = parseInt(btn.dataset.voice);
            const mode = btn.dataset.mode;

            // Update active state for this voice's env mode buttons
            document.querySelectorAll(`.env-mode-btn[data-voice="${voiceId}"]`).forEach(b => {
                b.classList.toggle('active', b === btn);
            });

            glassMachine?.setVoiceParam(voiceId, 'envMode', mode);
        });
    });

    // Transposition sequencer cells - drag to change value
    elements.transposeCells.forEach((cell) => {
        let startY = 0;
        let startValue = 0;

        const handleStart = (e) => {
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            startY = touch.clientY;
            startValue = parseInt(cell.dataset.value) || 0;
            cell.classList.add('dragging');
        };

        const handleMove = (e) => {
            if (!cell.classList.contains('dragging')) return;
            e.preventDefault();
            const touch = e.touches ? e.touches[0] : e;
            const deltaY = startY - touch.clientY;
            // 10px per degree change
            const newValue = Math.max(-12, Math.min(12, startValue + Math.round(deltaY / 10)));
            cell.dataset.value = newValue;
            cell.textContent = newValue > 0 ? `+${newValue}` : newValue;
            cell.classList.toggle('positive', newValue > 0);
            cell.classList.toggle('negative', newValue < 0);
            // Update GlassMachine
            updateTransposeSequence();
        };

        const handleEnd = () => {
            cell.classList.remove('dragging');
        };

        cell.addEventListener('touchstart', handleStart, { passive: false });
        cell.addEventListener('touchmove', handleMove, { passive: false });
        cell.addEventListener('touchend', handleEnd);
        cell.addEventListener('mousedown', handleStart);
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleEnd);
    });

    // Transpose step count (1-8)
    elements.transposeStepsSelect?.addEventListener('change', (e) => {
        const stepCount = parseInt(e.target.value);
        glassMachine?.setTransposeStepCount(stepCount);
        // Update cell visibility
        elements.transposeCells.forEach((cell, i) => {
            cell.classList.toggle('hidden', i >= stepCount);
        });
    });

    // Transpose bars per step
    elements.transposeBarsSelect.addEventListener('change', (e) => {
        glassMachine?.setTransposeBarsPerStep(parseInt(e.target.value));
    });

    // Clear transpose sequence
    elements.transposeClearBtn.addEventListener('click', () => {
        elements.transposeCells.forEach(cell => {
            cell.dataset.value = 0;
            cell.textContent = '0';
            cell.classList.remove('positive', 'negative');
        });
        updateTransposeSequence();
    });

    // Calibrate button
    document.getElementById('calibrate-btn')?.addEventListener('click', () => {
        globalGestures?.calibrateOrientation();
    });

    // === LFO Bank Controls ===

    // LFO Bank expand/collapse toggle
    elements.lfoBankToggle?.addEventListener('click', () => {
        elements.lfoBankContent.classList.toggle('collapsed');
        elements.lfoBankToggle.textContent = elements.lfoBankContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // LFO enable/disable toggles
    elements.lfoToggles.forEach((btn) => {
        btn.addEventListener('click', () => {
            const lfoId = parseInt(btn.dataset.lfo);
            btn.classList.toggle('active');
            glassMachine?.setLFOEnabled(lfoId, btn.classList.contains('active'));
        });
    });

    // LFO rate sliders (0-100 maps to 0.01-20 Hz exponentially)
    elements.lfoRates.forEach((slider) => {
        slider.addEventListener('input', () => {
            const lfoId = parseInt(slider.dataset.lfo);
            const rawValue = parseInt(slider.value);
            // Exponential mapping: 0.01 Hz to 20 Hz
            const rate = 0.01 * Math.pow(2000, rawValue / 100);
            glassMachine?.setLFORate(lfoId, rate);
        });
    });

    // LFO depth sliders (0-100 maps to 0-1)
    elements.lfoDepths.forEach((slider) => {
        slider.addEventListener('input', () => {
            const lfoId = parseInt(slider.dataset.lfo);
            const depth = parseInt(slider.value) / 100;
            glassMachine?.setLFODepth(lfoId, depth);
        });
    });

    // LFO shape selects
    elements.lfoShapes.forEach((select) => {
        select.addEventListener('change', () => {
            const lfoId = parseInt(select.dataset.lfo);
            glassMachine?.setLFOShape(lfoId, select.value);
        });
    });

    // LFO sync mode selects
    elements.lfoSyncs.forEach((select) => {
        select.addEventListener('change', () => {
            const lfoId = parseInt(select.dataset.lfo);
            const synced = select.value === 'sync';
            glassMachine?.setLFOSync(lfoId, synced);
            // Show/hide sync division dropdown
            const syncDivSelect = document.querySelector(`.lfo-sync-div[data-lfo="${lfoId}"]`);
            const rateSlider = document.querySelector(`.lfo-rate[data-lfo="${lfoId}"]`);
            if (syncDivSelect) {
                syncDivSelect.style.display = synced ? 'block' : 'none';
            }
            if (rateSlider) {
                rateSlider.parentElement.style.display = synced ? 'none' : 'flex';
            }
        });
    });

    // LFO sync division selects
    elements.lfoSyncDivs.forEach((select) => {
        select.addEventListener('change', () => {
            const lfoId = parseInt(select.dataset.lfo);
            const division = parseFloat(select.value);
            glassMachine?.setLFOSyncDivision(lfoId, division);
        });
    });

    // LFO polarity selects
    elements.lfoPolarities.forEach((select) => {
        select.addEventListener('change', () => {
            const lfoId = parseInt(select.dataset.lfo);
            glassMachine?.setLFOPolarity(lfoId, select.value);
        });
    });

    // LFO destination selects
    elements.lfoDests.forEach((select) => {
        select.addEventListener('change', () => {
            const lfoId = parseInt(select.dataset.lfo);
            const slot = parseInt(select.dataset.slot);
            const destId = select.value;
            glassMachine?.setLFODestination(lfoId, slot, destId);
        });
    });

    // === FX Drawer Controls ===

    // FX Drawer expand/collapse toggle
    elements.fxDrawerToggle?.addEventListener('click', () => {
        elements.fxDrawerContent.classList.toggle('collapsed');
        elements.fxDrawerToggle.textContent = elements.fxDrawerContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Voice send sliders
    elements.fxSendSliders?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const voiceId = parseInt(slider.dataset.voice);
            const amount = parseInt(slider.value) / 100;
            glassMachine?.setVoiceSendAmount(voiceId, amount);
        });
    });

    // FX parameter knobs (sliders)
    elements.fxKnobs?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const param = slider.dataset.param;
            let value;

            switch (param) {
                case 'sensors':
                    // Integer 1-8
                    value = parseInt(slider.value);
                    break;
                case 'mix':
                case 'feedback':
                case 'dispersal':
                case 'reversal':
                case 'depth':
                case 'reverbMix':
                    // 0-1 normalized
                    value = parseInt(slider.value) / 100;
                    break;
                default:
                    value = parseInt(slider.value) / 100;
            }

            glassMachine?.setSendEffectParam(param, value);
        });
    });

    // Resolution select
    elements.fxResolution?.addEventListener('change', () => {
        const value = parseFloat(elements.fxResolution.value) / 100;
        glassMachine?.setSendEffectParam('resolution', value);
    });

    // Delay mode buttons
    elements.fxDelayModeBtns?.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // Update active state
            elements.fxDelayModeBtns.forEach(b => b.classList.toggle('active', b === btn));

            glassMachine?.setSendEffectDelayMode(mode);

            // Show/hide shimmer section based on mode
            if (elements.fxShimmerSection) {
                const isShimmerMode = mode === 'shimmer' || mode === 'deshimmer';
                elements.fxShimmerSection.style.display = isShimmerMode ? 'block' : 'none';
            }
        });
    });

    // Feedback mode buttons
    elements.fxFeedbackModeBtns?.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // Update active state
            elements.fxFeedbackModeBtns.forEach(b => b.classList.toggle('active', b === btn));

            glassMachine?.setSendEffectFeedbackMode(mode);
        });
    });

    // Shimmer interval selects
    elements.fxIntervals?.forEach((select) => {
        select.addEventListener('change', () => {
            const param = select.dataset.param;
            const value = parseInt(select.value);
            glassMachine?.setSendEffectParam(param, value);
        });
    });

    // Chroma effect select
    elements.fxChromaSelect?.addEventListener('change', () => {
        const value = parseInt(elements.fxChromaSelect.value);
        glassMachine?.setSendEffectParam('chroma', value);
    });

    // Reverb preset select
    elements.fxReverbPreset?.addEventListener('change', () => {
        const value = parseInt(elements.fxReverbPreset.value);
        glassMachine?.setSendEffectParam('reverbPreset', value);
    });

    // Freeze button
    elements.fxFreezeBtn?.addEventListener('click', () => {
        elements.fxFreezeBtn.classList.toggle('active');
        const isActive = elements.fxFreezeBtn.classList.contains('active');
        glassMachine?.freezeSendEffect(isActive);
    });

    // Purge button
    elements.fxPurgeBtn?.addEventListener('click', () => {
        glassMachine?.purgeSendEffect();
        // Visual feedback
        elements.fxPurgeBtn.classList.add('pulse');
        setTimeout(() => elements.fxPurgeBtn.classList.remove('pulse'), 300);
    });

    // === BASIL DELAY CONTROLS ===

    // Basil Drawer expand/collapse toggle
    elements.basilDrawerToggle?.addEventListener('click', () => {
        elements.basilDrawerContent.classList.toggle('collapsed');
        elements.basilDrawerToggle.textContent = elements.basilDrawerContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Basil voice send sliders
    elements.basilSendSliders?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const voiceId = parseInt(slider.dataset.voice);
            const amount = parseInt(slider.value) / 100;
            glassMachine?.setVoiceBasilSend(voiceId, amount);
        });
    });

    // Basil parameter knobs (sliders)
    elements.basilKnobs?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const param = slider.dataset.param;
            let value;

            switch (param) {
                case 'time':
                case 'mix':
                case 'stereo':
                    // 0-1 normalized
                    value = parseInt(slider.value) / 100;
                    break;
                case 'feedback':
                    // -1 to 1 (negative = ping-pong mode)
                    // For now, map 0-100 to positive range 0-1
                    // Ping-pong mode is controlled by separate button
                    value = parseInt(slider.value) / 100;
                    if (elements.basilPingPongBtn?.classList.contains('active')) {
                        value = -value;
                    }
                    break;
                case 'fine':
                    // -1 to 1
                    value = (parseInt(slider.value) / 50) - 1;
                    break;
                case 'blur':
                case 'filter':
                case 'taps':
                    // -1 to 1 (0-50 maps to -1 to 0, 50-100 maps to 0 to 1)
                    value = (parseInt(slider.value) / 50) - 1;
                    break;
                default:
                    value = parseInt(slider.value) / 100;
            }

            glassMachine?.setBasilParam(param, value);
        });
    });

    // Basil speed mode buttons
    elements.basilSpeedBtns?.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = parseInt(btn.dataset.mode);

            // Update active state
            elements.basilSpeedBtns.forEach(b => b.classList.toggle('active', b === btn));

            glassMachine?.setBasilSpeedMode(mode);
        });
    });

    // Basil Lo-Fi toggle
    elements.basilLoFiBtn?.addEventListener('click', () => {
        elements.basilLoFiBtn.classList.toggle('active');
        const isActive = elements.basilLoFiBtn.classList.contains('active');
        glassMachine?.setBasilLoFi(isActive);
    });

    // Basil Ping-Pong toggle
    elements.basilPingPongBtn?.addEventListener('click', () => {
        elements.basilPingPongBtn.classList.toggle('active');
        const isActive = elements.basilPingPongBtn.classList.contains('active');
        // Update feedback sign based on ping-pong mode
        const feedbackSlider = document.querySelector('.basil-knob[data-param="feedback"]');
        if (feedbackSlider) {
            const rawValue = parseInt(feedbackSlider.value) / 100;
            glassMachine?.setBasilParam('feedback', isActive ? -rawValue : rawValue);
        }
    });

    // Basil Sync toggle
    elements.basilSyncToggle?.addEventListener('click', () => {
        elements.basilSyncToggle.classList.toggle('active');
        const isActive = elements.basilSyncToggle.classList.contains('active');
        const division = parseFloat(elements.basilSyncDivision?.value || 1);
        glassMachine?.setBasilSync(isActive, division);
    });

    // Basil Sync division select
    elements.basilSyncDivision?.addEventListener('change', () => {
        const division = parseFloat(elements.basilSyncDivision.value);
        const isActive = elements.basilSyncToggle?.classList.contains('active');
        if (isActive) {
            glassMachine?.setBasilSync(true, division);
        }
    });

    // Basil Freeze button
    elements.basilFreezeBtn?.addEventListener('click', () => {
        elements.basilFreezeBtn.classList.toggle('active');
        const isActive = elements.basilFreezeBtn.classList.contains('active');
        glassMachine?.freezeBasil(isActive);
    });

    // Basil Purge button
    elements.basilPurgeBtn?.addEventListener('click', () => {
        glassMachine?.purgeBasil();
        // Visual feedback
        elements.basilPurgeBtn.classList.add('pulse');
        setTimeout(() => elements.basilPurgeBtn.classList.remove('pulse'), 300);
    });

    // === FDNR REVERB EVENT HANDLERS ===

    // FDNR Drawer expand/collapse toggle
    elements.fdnrDrawerToggle?.addEventListener('click', () => {
        elements.fdnrDrawerContent.classList.toggle('collapsed');
        elements.fdnrDrawerToggle.textContent = elements.fdnrDrawerContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // FDNR voice send sliders
    elements.fdnrSendSliders?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const voiceId = parseInt(slider.dataset.voice);
            const amount = parseInt(slider.value) / 100;
            glassMachine?.setVoiceFDNRSend(voiceId, amount);
        });
    });

    // FDNR mode selector
    elements.fdnrModeSelect?.addEventListener('change', () => {
        const modeIndex = parseInt(elements.fdnrModeSelect.value);
        glassMachine?.setFDNRMode(modeIndex);
        // Update knobs to reflect the new preset values
        updateFDNRKnobsFromPreset(modeIndex);
    });

    // FDNR parameter knobs
    elements.fdnrKnobs?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const param = slider.dataset.param;
            let value;

            switch (param) {
                case 'modRate':
                    // 0-500 maps to 0-5 Hz
                    value = parseInt(slider.value) / 100;
                    break;
                case 'delay':
                    // Direct ms value (0-1000)
                    value = parseInt(slider.value);
                    break;
                case 'eq3Low':
                case 'eq3Mid':
                case 'eq3High':
                case 'gateThresh':
                    // Direct dB values (can be negative)
                    value = parseInt(slider.value);
                    break;
                default:
                    // Most params are 0-100
                    value = parseInt(slider.value);
            }

            glassMachine?.setFDNRParam(param, value);
        });
    });

    // FDNR sync select
    elements.fdnrSyncSelect?.addEventListener('change', () => {
        const syncMode = parseInt(elements.fdnrSyncSelect.value);
        glassMachine?.setFDNRParam('preDelaySync', syncMode);
    });

    // FDNR limiter toggle
    elements.fdnrLimiterBtn?.addEventListener('click', () => {
        elements.fdnrLimiterBtn.classList.toggle('active');
        const isActive = elements.fdnrLimiterBtn.classList.contains('active');
        glassMachine?.setFDNRParam('limiterOn', isActive);
    });

    // FDNR purge button
    elements.fdnrPurgeBtn?.addEventListener('click', () => {
        glassMachine?.purgeFDNR();
        // Visual feedback
        elements.fdnrPurgeBtn.classList.add('pulse');
        setTimeout(() => elements.fdnrPurgeBtn.classList.remove('pulse'), 300);
    });

    // === INSERT SEND EVENT HANDLERS ===

    // Insert Send sliders - route processed insert chain to send effects
    elements.insertSendSliders?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const effectType = slider.dataset.effect;
            const amount = parseInt(slider.value) / 100;
            glassMachine?.setInsertSendAmount(effectType, amount);
        });
    });

    // === DATA BENDER EVENT HANDLERS ===

    // Data Bender drawer toggle
    elements.databenderDrawerToggle?.addEventListener('click', () => {
        elements.databenderDrawerContent.classList.toggle('collapsed');
        elements.databenderDrawerToggle.textContent = elements.databenderDrawerContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Data Bender enable/bypass button
    elements.databenderEnableBtn?.addEventListener('click', () => {
        glassMachine?.toggleDataBender();
        const isEnabled = glassMachine?.isDataBenderEnabled() || false;
        elements.databenderEnableBtn.textContent = isEnabled ? 'ON' : 'OFF';
        elements.databenderEnableBtn.classList.toggle('active', isEnabled);

        // When enabled, mix is auto-set to 100% wet - update UI to reflect this
        if (isEnabled) {
            const mixSlider = document.querySelector('.databender-knob[data-param="mix"]');
            if (mixSlider) {
                mixSlider.value = 100;
            }
        }
    });

    // Data Bender parameter knobs (sliders)
    elements.databenderKnobs?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const param = slider.dataset.param;
            let value;

            switch (param) {
                case 'time':
                case 'repeats':
                case 'mix':
                case 'bend':
                case 'break':
                case 'corrupt':
                case 'stereoWidth':
                    // 0-1 normalized
                    value = parseInt(slider.value) / 100;
                    break;
                case 'windowing':
                    // 0-1 but default is 2%
                    value = parseInt(slider.value) / 100;
                    break;
                default:
                    value = parseInt(slider.value) / 100;
            }

            glassMachine?.setDataBenderParam(param, value);
        });
    });

    // Data Bender mode buttons (Macro/Micro)
    elements.databenderModeBtns?.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // Update active state
            elements.databenderModeBtns.forEach(b => b.classList.toggle('active', b === btn));

            glassMachine?.setDataBenderMode(mode);
        });
    });

    // Data Bender clock buttons (Internal/External)
    elements.databenderClockBtns?.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;

            // Update active state
            elements.databenderClockBtns.forEach(b => b.classList.toggle('active', b === btn));

            glassMachine?.setDataBenderClockMode(mode);
        });
    });

    // Data Bender Bend enable toggle
    elements.databenderBendBtn?.addEventListener('click', () => {
        elements.databenderBendBtn.classList.toggle('active');
        const isActive = elements.databenderBendBtn.classList.contains('active');
        glassMachine?.setDataBenderBend(isActive);
    });

    // Data Bender Break enable toggle
    elements.databenderBreakBtn?.addEventListener('click', () => {
        elements.databenderBreakBtn.classList.toggle('active');
        const isActive = elements.databenderBreakBtn.classList.contains('active');
        glassMachine?.setDataBenderBreak(isActive);
    });

    // Data Bender Corrupt type select
    elements.databenderCorruptType?.addEventListener('change', () => {
        const type = parseInt(elements.databenderCorruptType.value);
        glassMachine?.setDataBenderCorruptType(type);
    });

    // Data Bender Freeze button
    elements.databenderFreezeBtn?.addEventListener('click', () => {
        elements.databenderFreezeBtn.classList.toggle('active');
        const isActive = elements.databenderFreezeBtn.classList.contains('active');
        glassMachine?.freezeDataBender(isActive);
    });

    // Data Bender Purge button
    elements.databenderPurgeBtn?.addEventListener('click', () => {
        glassMachine?.purgeDataBender();
        // Visual feedback
        elements.databenderPurgeBtn.classList.add('pulse');
        setTimeout(() => elements.databenderPurgeBtn.classList.remove('pulse'), 300);
    });

    // Data Bender Reset button
    elements.databenderResetBtn?.addEventListener('click', () => {
        glassMachine?.resetDataBender();
        // Visual feedback
        elements.databenderResetBtn.classList.add('pulse');
        setTimeout(() => elements.databenderResetBtn.classList.remove('pulse'), 300);
    });

    // === ARBHAR EVENT HANDLERS ===

    // Arbhar drawer toggle
    elements.arbharDrawerToggle?.addEventListener('click', () => {
        elements.arbharDrawerContent.classList.toggle('collapsed');
        elements.arbharDrawerToggle.textContent = elements.arbharDrawerContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Arbhar enable/bypass button
    elements.arbharEnableBtn?.addEventListener('click', () => {
        glassMachine?.toggleArbhar();
        const isEnabled = glassMachine?.isArbharEnabled() || false;
        elements.arbharEnableBtn.textContent = isEnabled ? 'ON' : 'OFF';
        elements.arbharEnableBtn.classList.toggle('active', isEnabled);

        // When enabled, mix is auto-set to 100% wet - update UI to reflect this
        if (isEnabled) {
            const mixSlider = document.querySelector('.arbhar-knob[data-param="mix"]');
            if (mixSlider) {
                mixSlider.value = 100;
            }
        }
    });

    // Arbhar parameter knobs (sliders)
    elements.arbharKnobs?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const param = slider.dataset.param;
            const value = parseInt(slider.value) / 100;
            glassMachine?.setArbharParam(param, value);
        });
    });

    // Arbhar scan mode buttons
    elements.arbharScanModeBtns?.forEach((btn) => {
        btn.addEventListener('click', () => {
            const mode = parseInt(btn.dataset.mode);

            // Update active state
            elements.arbharScanModeBtns.forEach(b => b.classList.toggle('active', b === btn));

            glassMachine?.setArbharScanMode(mode);
        });
    });

    // Arbhar layer buttons
    elements.arbharLayerBtns?.forEach((btn) => {
        btn.addEventListener('click', () => {
            const layer = parseInt(btn.dataset.layer);

            // Update active state
            elements.arbharLayerBtns.forEach(b => b.classList.toggle('active', b === btn));

            glassMachine?.setArbharLayer(layer);
        });
    });

    // Arbhar window shape select
    elements.arbharWindowSelect?.addEventListener('change', () => {
        const window = parseInt(elements.arbharWindowSelect.value);
        glassMachine?.setArbharParam('grainWindow', window / 2); // Normalize to 0-1
    });

    // Arbhar Continuous engine toggle
    elements.arbharContinuousBtn?.addEventListener('click', () => {
        elements.arbharContinuousBtn.classList.toggle('active');
        const isActive = elements.arbharContinuousBtn.classList.contains('active');
        glassMachine?.setArbharContinuousEngine(isActive);
    });

    // Arbhar Strike engine toggle
    elements.arbharStrikeBtn?.addEventListener('click', () => {
        elements.arbharStrikeBtn.classList.toggle('active');
        const isActive = elements.arbharStrikeBtn.classList.contains('active');
        glassMachine?.setArbharStrikeEngine(isActive);
    });

    // Arbhar Auto-capture toggle
    elements.arbharAutoCaptureBtn?.addEventListener('click', () => {
        elements.arbharAutoCaptureBtn.classList.toggle('active');
        const isActive = elements.arbharAutoCaptureBtn.classList.contains('active');
        glassMachine?.setArbharAutoCapture(isActive);
    });

    // Arbhar Record toggle
    elements.arbharRecordBtn?.addEventListener('click', () => {
        elements.arbharRecordBtn.classList.toggle('active');
        const isActive = elements.arbharRecordBtn.classList.contains('active');
        if (isActive) {
            glassMachine?.startArbharRecording();
        } else {
            glassMachine?.stopArbharRecording();
        }
    });

    // Arbhar Pitch Quantize toggle
    elements.arbharQuantizeBtn?.addEventListener('click', () => {
        elements.arbharQuantizeBtn.classList.toggle('active');
        const isActive = elements.arbharQuantizeBtn.classList.contains('active');
        glassMachine?.setArbharPitchQuantize(isActive);
    });

    // Arbhar Scale select
    elements.arbharScaleSelect?.addEventListener('change', () => {
        const scale = parseInt(elements.arbharScaleSelect.value);
        glassMachine?.setArbharPitchScale(scale);
    });

    // Arbhar Freeze button
    elements.arbharFreezeBtn?.addEventListener('click', () => {
        elements.arbharFreezeBtn.classList.toggle('active');
        const isActive = elements.arbharFreezeBtn.classList.contains('active');
        glassMachine?.freezeArbhar(isActive);
    });

    // Arbhar Strike trigger button
    elements.arbharStrikeTriggerBtn?.addEventListener('click', () => {
        glassMachine?.strikeArbhar();
        // Visual feedback
        elements.arbharStrikeTriggerBtn.classList.add('pulse');
        setTimeout(() => elements.arbharStrikeTriggerBtn.classList.remove('pulse'), 300);
    });

    // Arbhar Clear current layer button
    elements.arbharClearBtn?.addEventListener('click', () => {
        // Get current layer from active button
        const activeLayerBtn = document.querySelector('#arbhar-layer-btns .arbhar-mode-btn.active');
        const layer = activeLayerBtn ? parseInt(activeLayerBtn.dataset.layer) : 0;
        glassMachine?.clearArbharLayer(layer);
        // Visual feedback
        elements.arbharClearBtn.classList.add('pulse');
        setTimeout(() => elements.arbharClearBtn.classList.remove('pulse'), 300);
    });

    // Arbhar Clear all layers button
    elements.arbharClearAllBtn?.addEventListener('click', () => {
        glassMachine?.clearAllArbharLayers();
        // Visual feedback
        elements.arbharClearAllBtn.classList.add('pulse');
        setTimeout(() => elements.arbharClearAllBtn.classList.remove('pulse'), 300);
    });

    // === MORPHAGENE EVENT HANDLERS ===

    // Morphagene drawer toggle
    elements.morphageneDrawerToggle?.addEventListener('click', () => {
        elements.morphageneDrawerContent.classList.toggle('collapsed');
        elements.morphageneDrawerToggle.textContent = elements.morphageneDrawerContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Morphagene enable/bypass button
    elements.morphageneEnableBtn?.addEventListener('click', () => {
        glassMachine?.toggleMorphagene();
        const isEnabled = glassMachine?.isMorphageneEnabled() || false;
        elements.morphageneEnableBtn.textContent = isEnabled ? 'ON' : 'OFF';
        elements.morphageneEnableBtn.classList.toggle('active', isEnabled);

        // When enabled, mix is auto-set to 100% wet - update UI to reflect this
        if (isEnabled) {
            const mixSlider = document.querySelector('.morphagene-knob[data-param="mix"]');
            if (mixSlider) {
                mixSlider.value = 100;
            }
        }
    });

    // Morphagene parameter knobs (sliders)
    elements.morphageneKnobs?.forEach((slider) => {
        slider.addEventListener('input', () => {
            const param = slider.dataset.param;
            const value = parseInt(slider.value) / 100;
            glassMachine?.setMorphageneParam(param, value);
        });
    });

    // Morphagene speed buttons
    elements.morphageneRev1xBtn?.addEventListener('click', () => {
        glassMachine?.setMorphageneReverse1x();
        elements.morphageneRev1xBtn.classList.add('active');
        elements.morphageneStopBtn.classList.remove('active');
        elements.morphageneFwd1xBtn.classList.remove('active');
        // Update varispeed slider
        const varispeedSlider = document.querySelector('.morphagene-knob[data-param="varispeed"]');
        if (varispeedSlider) varispeedSlider.value = 25;
    });

    elements.morphageneStopBtn?.addEventListener('click', () => {
        glassMachine?.stopMorphagene();
        elements.morphageneRev1xBtn.classList.remove('active');
        elements.morphageneStopBtn.classList.add('active');
        elements.morphageneFwd1xBtn.classList.remove('active');
        // Update varispeed slider
        const varispeedSlider = document.querySelector('.morphagene-knob[data-param="varispeed"]');
        if (varispeedSlider) varispeedSlider.value = 50;
    });

    elements.morphageneFwd1xBtn?.addEventListener('click', () => {
        glassMachine?.setMorphageneForward1x();
        elements.morphageneRev1xBtn.classList.remove('active');
        elements.morphageneStopBtn.classList.remove('active');
        elements.morphageneFwd1xBtn.classList.add('active');
        // Update varispeed slider
        const varispeedSlider = document.querySelector('.morphagene-knob[data-param="varispeed"]');
        if (varispeedSlider) varispeedSlider.value = 75;
    });

    // Morphagene play/trigger buttons
    elements.morphagenePlayBtn?.addEventListener('click', () => {
        glassMachine?.toggleMorphagenePlay();
        const morphagene = glassMachine?.getMorphageneEffect();
        const isPlaying = morphagene?.isPlayActive?.() || false;
        elements.morphagenePlayBtn.classList.toggle('active', isPlaying);
    });

    elements.morphageneTriggerBtn?.addEventListener('click', () => {
        glassMachine?.triggerMorphagene();
        // Visual feedback
        elements.morphageneTriggerBtn.classList.add('pulse');
        setTimeout(() => elements.morphageneTriggerBtn.classList.remove('pulse'), 300);
    });

    // Morphagene recording buttons
    elements.morphageneRecBtn?.addEventListener('click', () => {
        const morphagene = glassMachine?.getMorphageneEffect();
        if (morphagene?.isRecording) {
            glassMachine?.stopMorphageneRecording();
            elements.morphageneRecBtn.classList.remove('active');
        } else {
            glassMachine?.startMorphageneRecording();
            elements.morphageneRecBtn.classList.add('active');
        }
    });

    elements.morphageneNewSpliceBtn?.addEventListener('click', () => {
        glassMachine?.startMorphageneNewSpliceRecording();
        elements.morphageneRecBtn.classList.add('active');
        elements.morphageneNewSpliceBtn.classList.add('pulse');
        setTimeout(() => elements.morphageneNewSpliceBtn.classList.remove('pulse'), 300);
    });

    // Morphagene splice buttons
    elements.morphageneSpliceBtn?.addEventListener('click', () => {
        glassMachine?.createMorphageneSplice();
        elements.morphageneSpliceBtn.classList.add('pulse');
        setTimeout(() => elements.morphageneSpliceBtn.classList.remove('pulse'), 300);
    });

    elements.morphageneShiftBtn?.addEventListener('click', () => {
        glassMachine?.shiftMorphageneSplice();
        elements.morphageneShiftBtn.classList.add('pulse');
        setTimeout(() => elements.morphageneShiftBtn.classList.remove('pulse'), 300);
    });

    // Morphagene sample loading
    elements.morphageneLoadBtn?.addEventListener('click', () => {
        elements.morphageneFileInput?.click();
    });

    elements.morphageneFileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                elements.morphageneSampleName.textContent = 'Loading...';
                await glassMachine?.loadMorphageneSampleFromFile(file);
                elements.morphageneSampleName.textContent = file.name.slice(0, 20);
            } catch (error) {
                console.error('Failed to load sample:', error);
                elements.morphageneSampleName.textContent = 'Error';
            }
        }
    });

    // Morphagene special buttons
    elements.morphageneFreezeBtn?.addEventListener('click', () => {
        elements.morphageneFreezeBtn.classList.toggle('active');
        const isActive = elements.morphageneFreezeBtn.classList.contains('active');
        glassMachine?.freezeMorphagene(isActive);
    });

    elements.morphageneInitBtn?.addEventListener('click', () => {
        glassMachine?.setMorphageneInitState();
        // Reset UI to init state
        const varispeedSlider = document.querySelector('.morphagene-knob[data-param="varispeed"]');
        const geneSizeSlider = document.querySelector('.morphagene-knob[data-param="geneSize"]');
        const slideSlider = document.querySelector('.morphagene-knob[data-param="slide"]');
        const morphSlider = document.querySelector('.morphagene-knob[data-param="morph"]');
        const organizeSlider = document.querySelector('.morphagene-knob[data-param="organize"]');
        const sosSlider = document.querySelector('.morphagene-knob[data-param="sos"]');
        if (varispeedSlider) varispeedSlider.value = 75;
        if (geneSizeSlider) geneSizeSlider.value = 0;
        if (slideSlider) slideSlider.value = 0;
        if (morphSlider) morphSlider.value = 30;
        if (organizeSlider) organizeSlider.value = 0;
        if (sosSlider) sosSlider.value = 100;
        // Update speed buttons
        elements.morphageneRev1xBtn?.classList.remove('active');
        elements.morphageneStopBtn?.classList.remove('active');
        elements.morphageneFwd1xBtn?.classList.add('active');
        // Visual feedback
        elements.morphageneInitBtn.classList.add('pulse');
        setTimeout(() => elements.morphageneInitBtn.classList.remove('pulse'), 300);
    });

    elements.morphageneClearBtn?.addEventListener('click', () => {
        glassMachine?.clearMorphageneReel();
        elements.morphageneSampleName.textContent = 'No sample';
        // Visual feedback
        elements.morphageneClearBtn.classList.add('pulse');
        setTimeout(() => elements.morphageneClearBtn.classList.remove('pulse'), 300);
    });

    // === LUBADH EVENT HANDLERS ===

    // Lubadh drawer toggle
    elements.lubadhDrawerToggle?.addEventListener('click', () => {
        elements.lubadhDrawerContent.classList.toggle('collapsed');
        elements.lubadhDrawerToggle.textContent = elements.lubadhDrawerContent.classList.contains('collapsed') ? '▶' : '▼';
    });

    // Lubadh enable/bypass button
    elements.lubadhEnableBtn?.addEventListener('click', () => {
        glassMachine?.toggleLubadh();
        const isEnabled = glassMachine?.isLubadhEnabled() || false;
        elements.lubadhEnableBtn.textContent = isEnabled ? 'ON' : 'OFF';
        elements.lubadhEnableBtn.classList.toggle('active', isEnabled);
        // When enabling, ensure mix is at 100%
        if (isEnabled) {
            const mixSlider = document.querySelector('.lubadh-knob[data-param="mix"]');
            if (mixSlider) mixSlider.value = 100;
        }
    });

    // Lubadh link button
    elements.lubadhLinkBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        if (lubadh) {
            lubadh.toggleLink();
            const isLinked = lubadh.isLinkEnabled();
            elements.lubadhLinkBtn.classList.toggle('active', isLinked);
        }
    });

    // Lubadh parameter knobs (sliders)
    elements.lubadhKnobs?.forEach((slider) => {
        slider.addEventListener('input', (e) => {
            const param = e.target.dataset.param;
            const value = e.target.value / 100;
            glassMachine?.setLubadhParam(param, value);
        });
    });

    // Deck A transport buttons
    elements.lubadhRevABtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.reverse1xA();
        elements.lubadhRevABtn.classList.add('active');
        elements.lubadhStallABtn.classList.remove('active');
        elements.lubadhFwdABtn.classList.remove('active');
        const speedSlider = document.querySelector('.lubadh-knob[data-param="speedA"]');
        if (speedSlider) speedSlider.value = 25;
    });

    elements.lubadhStallABtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.stallA();
        elements.lubadhRevABtn.classList.remove('active');
        elements.lubadhStallABtn.classList.add('active');
        elements.lubadhFwdABtn.classList.remove('active');
        const speedSlider = document.querySelector('.lubadh-knob[data-param="speedA"]');
        if (speedSlider) speedSlider.value = 50;
    });

    elements.lubadhFwdABtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.forward1xA();
        elements.lubadhRevABtn.classList.remove('active');
        elements.lubadhStallABtn.classList.remove('active');
        elements.lubadhFwdABtn.classList.add('active');
        const speedSlider = document.querySelector('.lubadh-knob[data-param="speedA"]');
        if (speedSlider) speedSlider.value = 75;
    });

    // Deck A record/monitor/retrigger
    elements.lubadhRecABtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        if (lubadh?.deckA.isRecording) {
            lubadh.stopRecordingA();
            elements.lubadhRecABtn.classList.remove('active');
        } else {
            lubadh?.startRecordingA();
            elements.lubadhRecABtn.classList.add('active');
        }
    });

    elements.lubadhMonABtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        if (lubadh) {
            lubadh.toggleMonitorA();
            const isMonitoring = lubadh.isMonitorEnabledA();
            elements.lubadhMonABtn.classList.toggle('active', isMonitoring);
        }
    });

    elements.lubadhRetrigABtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.retriggerA();
        elements.lubadhRetrigABtn.classList.add('pulse');
        setTimeout(() => elements.lubadhRetrigABtn.classList.remove('pulse'), 300);
    });

    // Deck A sample loading
    elements.lubadhLoadABtn?.addEventListener('click', () => {
        elements.lubadhFileAInput?.click();
    });

    elements.lubadhFileAInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                elements.lubadhSampleAName.textContent = 'Loading...';
                await glassMachine?.loadLubadhSampleFromFile(file, 'A');
                elements.lubadhSampleAName.textContent = file.name.slice(0, 15);
            } catch (error) {
                console.error('Failed to load sample:', error);
                elements.lubadhSampleAName.textContent = 'Error';
            }
        }
    });

    elements.lubadhEraseABtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.eraseA();
        elements.lubadhSampleAName.textContent = 'No sample';
        elements.lubadhRecABtn.classList.remove('active');
        elements.lubadhEraseABtn.classList.add('pulse');
        setTimeout(() => elements.lubadhEraseABtn.classList.remove('pulse'), 300);
    });

    // Deck B transport buttons
    elements.lubadhRevBBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.reverse1xB();
        elements.lubadhRevBBtn.classList.add('active');
        elements.lubadhStallBBtn.classList.remove('active');
        elements.lubadhFwdBBtn.classList.remove('active');
        const speedSlider = document.querySelector('.lubadh-knob[data-param="speedB"]');
        if (speedSlider) speedSlider.value = 25;
    });

    elements.lubadhStallBBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.stallB();
        elements.lubadhRevBBtn.classList.remove('active');
        elements.lubadhStallBBtn.classList.add('active');
        elements.lubadhFwdBBtn.classList.remove('active');
        const speedSlider = document.querySelector('.lubadh-knob[data-param="speedB"]');
        if (speedSlider) speedSlider.value = 50;
    });

    elements.lubadhFwdBBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.forward1xB();
        elements.lubadhRevBBtn.classList.remove('active');
        elements.lubadhStallBBtn.classList.remove('active');
        elements.lubadhFwdBBtn.classList.add('active');
        const speedSlider = document.querySelector('.lubadh-knob[data-param="speedB"]');
        if (speedSlider) speedSlider.value = 75;
    });

    // Deck B record/monitor/retrigger
    elements.lubadhRecBBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        if (lubadh?.deckB.isRecording) {
            lubadh.stopRecordingB();
            elements.lubadhRecBBtn.classList.remove('active');
        } else {
            lubadh?.startRecordingB();
            elements.lubadhRecBBtn.classList.add('active');
        }
    });

    elements.lubadhMonBBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        if (lubadh) {
            lubadh.toggleMonitorB();
            const isMonitoring = lubadh.isMonitorEnabledB();
            elements.lubadhMonBBtn.classList.toggle('active', isMonitoring);
        }
    });

    elements.lubadhRetrigBBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.retriggerB();
        elements.lubadhRetrigBBtn.classList.add('pulse');
        setTimeout(() => elements.lubadhRetrigBBtn.classList.remove('pulse'), 300);
    });

    // Deck B sample loading
    elements.lubadhLoadBBtn?.addEventListener('click', () => {
        elements.lubadhFileBInput?.click();
    });

    elements.lubadhFileBInput?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                elements.lubadhSampleBName.textContent = 'Loading...';
                await glassMachine?.loadLubadhSampleFromFile(file, 'B');
                elements.lubadhSampleBName.textContent = file.name.slice(0, 15);
            } catch (error) {
                console.error('Failed to load sample:', error);
                elements.lubadhSampleBName.textContent = 'Error';
            }
        }
    });

    elements.lubadhEraseBBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.eraseB();
        elements.lubadhSampleBName.textContent = 'No sample';
        elements.lubadhRecBBtn.classList.remove('active');
        elements.lubadhEraseBBtn.classList.add('pulse');
        setTimeout(() => elements.lubadhEraseBBtn.classList.remove('pulse'), 300);
    });

    // Special buttons
    elements.lubadhInitBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.setInitializationState();
        // Reset all sliders to defaults
        document.querySelector('.lubadh-knob[data-param="speedA"]').value = 75;
        document.querySelector('.lubadh-knob[data-param="speedB"]').value = 75;
        document.querySelector('.lubadh-knob[data-param="startA"]').value = 0;
        document.querySelector('.lubadh-knob[data-param="startB"]').value = 0;
        document.querySelector('.lubadh-knob[data-param="lengthA"]').value = 100;
        document.querySelector('.lubadh-knob[data-param="lengthB"]').value = 100;
        document.querySelector('.lubadh-knob[data-param="dubLevelA"]').value = 90;
        document.querySelector('.lubadh-knob[data-param="dubLevelB"]').value = 90;
        document.querySelector('.lubadh-knob[data-param="tapeEmulation"]').value = 50;
        document.querySelector('.lubadh-knob[data-param="saturation"]').value = 40;
        document.querySelector('.lubadh-knob[data-param="wowFlutter"]').value = 30;
        document.querySelector('.lubadh-knob[data-param="crossfadeDuration"]').value = 50;
        document.querySelector('.lubadh-knob[data-param="mix"]').value = 100;
        // Reset button states
        elements.lubadhRevABtn?.classList.remove('active');
        elements.lubadhStallABtn?.classList.remove('active');
        elements.lubadhFwdABtn?.classList.add('active');
        elements.lubadhRevBBtn?.classList.remove('active');
        elements.lubadhStallBBtn?.classList.remove('active');
        elements.lubadhFwdBBtn?.classList.add('active');
        elements.lubadhLinkBtn?.classList.remove('active');
        // Visual feedback
        elements.lubadhInitBtn.classList.add('pulse');
        setTimeout(() => elements.lubadhInitBtn.classList.remove('pulse'), 300);
    });

    elements.lubadhClearAllBtn?.addEventListener('click', () => {
        const lubadh = glassMachine?.getLubadhEffect();
        lubadh?.eraseA();
        lubadh?.eraseB();
        elements.lubadhSampleAName.textContent = 'No sample';
        elements.lubadhSampleBName.textContent = 'No sample';
        elements.lubadhRecABtn.classList.remove('active');
        elements.lubadhRecBBtn.classList.remove('active');
        // Visual feedback
        elements.lubadhClearAllBtn.classList.add('pulse');
        setTimeout(() => elements.lubadhClearAllBtn.classList.remove('pulse'), 300);
    });
}

// Handle start button click
async function handleStart() {
    // Hide start screen
    elements.startScreen.classList.add('hidden');

    // Create glass machine
    // 120 BPM is standard - with division 4, that's 8 Hz (musical trill range)
    glassMachine = createGlassMachine({
        bpm: 120,
        rootMidi: 48,
        scaleName: 'major',
        onStateChange: updateUI,
        onTransposeStep: updateTransposeHighlight
    });

    // Initialize audio
    await glassMachine.initialize();

    // Set up Morphagene param change callback to sync UI
    const morphagene = glassMachine.getMorphageneEffect();
    if (morphagene) {
        morphagene.onParamChange = (name, value) => {
            // Update UI when processor changes params (e.g., auto-start playback after recording)
            if (name === 'varispeed') {
                const varispeedSlider = document.querySelector('.morphagene-knob[data-param="varispeed"]');
                if (varispeedSlider) {
                    varispeedSlider.value = Math.round(value * 100);
                }
                // Update button states
                const isForward1x = Math.abs(value - 0.75) < 0.05;
                const isStopped = Math.abs(value - 0.5) < 0.05;
                const isReverse1x = Math.abs(value - 0.25) < 0.05;
                elements.morphageneRev1xBtn?.classList.toggle('active', isReverse1x);
                elements.morphageneStopBtn?.classList.toggle('active', isStopped);
                elements.morphageneFwd1xBtn?.classList.toggle('active', isForward1x);
            }
        };
    }

    // Create XY pads
    xyPads = createXYPads(elements.xyContainer, {
        onMove: handleXYMove,
        onGestureFlick: handleFlick,
        onGestureLongPress: handleLongPress,
        onGestureTap: handleTap,
        onGestureOrbit: handleOrbit
    });

    // Add voice labels
    document.querySelectorAll('.xy-pad').forEach((pad, i) => {
        const label = document.createElement('span');
        label.className = 'voice-label';
        label.textContent = `Voice ${i + 1}`;
        pad.appendChild(label);

        const xLabel = document.createElement('span');
        xLabel.className = 'axis-label x-label';
        xLabel.textContent = 'Complexity';
        pad.appendChild(xLabel);

        const yLabel = document.createElement('span');
        yLabel.className = 'axis-label y-label';
        yLabel.textContent = 'Speed';
        pad.appendChild(yLabel);
    });

    // Setup global gestures (handlers are optional - just log for now)
    globalGestures = createGlobalGestureHandler({
        onTilt: (data) => {
            // Could map tilt to global filter or master effects
            // console.log('tilt', data);
        },
        onShake: (data) => {
            // Could trigger pattern randomization or reset
            // console.log('shake', data);
        },
        onThreeFingerSlide: (data) => {
            // Could control global transpose
            // console.log('3-finger slide', data);
        },
        onPinch: (data) => {
            // Could control master volume or zoom
            // console.log('pinch', data);
        }
    });

    // Request sensor permissions if needed
    if (globalGestures.getCapabilities().needsPermission) {
        await globalGestures.requestPermissions();
    }

    // Initialize LFO destination dropdowns
    refreshLFODestinations();

    // Start visualization loop
    startVisualization();

    // Start playback
    glassMachine.start();
    updateUI(glassMachine.getState());
}

// XY pad move handler
function handleXYMove(data) {
    glassMachine?.setVoiceXY(data.voiceId, data.x, data.y);
}

// Flick gesture handler - could trigger accent or pattern change
function handleFlick(data) {
    const voice = glassMachine?.voices[data.voiceId];
    if (voice?.patternEngine) {
        // Flick could reverse pattern direction
        voice.patternEngine.reverse();
    }
}

// Long press handler - switch to drone mode temporarily
function handleLongPress(data) {
    const voice = glassMachine?.voices[data.voiceId];
    if (voice) {
        // Could toggle drone mode or trigger a sustained note
        // For now, just log - could implement sustained trigger
        console.log('Long press on voice', data.voiceId);
    }
}

// Tap handler - reset pattern to beginning
function handleTap(data) {
    const voice = glassMachine?.voices[data.voiceId];
    if (voice?.patternEngine) {
        // Reset pattern to beginning
        voice.patternEngine.reset();
    }
}

// Orbit gesture handler - phase shift
function handleOrbit(data) {
    glassMachine?.nudgeVoicePhase(data.voiceId, 0.1 * data.rotations);
}

// FDNR preset values for updating UI when mode changes
const FDNR_MODE_PRESETS = {
    0:  { mix: 40, delay: 350, feedback: 55, width: 100, density: 60, diffusion: 80, modRate: 0.6, modDepth: 25, eq3Low: 0, eq3Mid: 0, eq3High: 0, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    1:  { mix: 55, delay: 850, feedback: 88, width: 90, density: 85, diffusion: 50, modRate: 0.25, modDepth: 75, eq3Low: 4, eq3Mid: 0, eq3High: -6, warp: 20, saturation: 0, ducking: 0, gateThresh: -100 },
    2:  { mix: 35, delay: 180, feedback: 40, width: 75, density: 95, diffusion: 100, modRate: 1.2, modDepth: 10, eq3Low: -1, eq3Mid: 2, eq3High: -2, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    3:  { mix: 45, delay: 550, feedback: 65, width: 100, density: 30, diffusion: 40, modRate: 0.8, modDepth: 35, eq3Low: 0, eq3Mid: 0, eq3High: 4, warp: 0, saturation: 10, ducking: 0, gateThresh: -100 },
    4:  { mix: 100, delay: 1000, feedback: 98, width: 100, density: 100, diffusion: 100, modRate: 0.15, modDepth: 60, eq3Low: 8, eq3Mid: 0, eq3High: -12, warp: 0, saturation: 45, ducking: 0, gateThresh: -100 },
    5:  { mix: 50, delay: 600, feedback: 80, width: 100, density: 50, diffusion: 70, modRate: 2.8, modDepth: 65, eq3Low: 0, eq3Mid: 0, eq3High: 0, warp: 30, saturation: 0, ducking: 0, gateThresh: -100 },
    6:  { mix: 40, delay: 60, feedback: 90, width: 60, density: 0, diffusion: 0, modRate: 0.4, modDepth: 15, eq3Low: 0, eq3Mid: 0, eq3High: 6, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    7:  { mix: 30, delay: 220, feedback: 45, width: 80, density: 80, diffusion: 90, modRate: 0.9, modDepth: 20, eq3Low: 2, eq3Mid: 3, eq3High: -4, warp: 0, saturation: 35, ducking: 0, gateThresh: -100 },
    8:  { mix: 65, delay: 900, feedback: 82, width: 100, density: 100, diffusion: 100, modRate: 0.3, modDepth: 40, eq3Low: 0, eq3Mid: 0, eq3High: -3, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    9:  { mix: 40, delay: 450, feedback: 50, width: 100, density: 10, diffusion: 20, modRate: 0, modDepth: 0, eq3Low: 0, eq3Mid: 0, eq3High: 0, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    10: { mix: 50, delay: 700, feedback: 75, width: 100, density: 90, diffusion: 95, modRate: 0.7, modDepth: 30, eq3Low: -5, eq3Mid: 0, eq3High: 6, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    11: { mix: 55, delay: 750, feedback: 78, width: 90, density: 90, diffusion: 95, modRate: 0.5, modDepth: 45, eq3Low: 3, eq3Mid: 0, eq3High: -8, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    12: { mix: 60, delay: 650, feedback: 72, width: 100, density: 85, diffusion: 85, modRate: 1.5, modDepth: 55, eq3Low: 0, eq3Mid: 2, eq3High: 0, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    13: { mix: 35, delay: 150, feedback: 25, width: 60, density: 100, diffusion: 100, modRate: 0, modDepth: 0, eq3Low: 0, eq3Mid: 0, eq3High: 0, warp: 0, saturation: 0, ducking: 0, gateThresh: -30 },
    14: { mix: 70, delay: 500, feedback: 65, width: 100, density: 70, diffusion: 60, modRate: 3.0, modDepth: 85, eq3Low: 0, eq3Mid: 0, eq3High: 0, warp: 15, saturation: 0, ducking: 0, gateThresh: -100 },
    15: { mix: 50, delay: 600, feedback: 60, width: 100, density: 40, diffusion: 50, modRate: 0.4, modDepth: 60, eq3Low: 5, eq3Mid: 0, eq3High: -10, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    16: { mix: 45, delay: 300, feedback: 55, width: 80, density: 80, diffusion: 80, modRate: 4.0, modDepth: 30, eq3Low: 0, eq3Mid: 0, eq3High: 5, warp: 0, saturation: 80, ducking: 0, gateThresh: -100 },
    17: { mix: 50, delay: 400, feedback: 50, width: 100, density: 50, diffusion: 50, modRate: 0.5, modDepth: 20, eq3Low: 0, eq3Mid: 0, eq3High: 0, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    18: { mix: 55, delay: 500, feedback: 65, width: 90, density: 75, diffusion: 85, modRate: 0.8, modDepth: 25, eq3Low: 0, eq3Mid: 4, eq3High: -2, warp: 0, saturation: 25, ducking: 0, gateThresh: -100 },
    19: { mix: 40, delay: 350, feedback: 45, width: 100, density: 80, diffusion: 90, modRate: 0.3, modDepth: 10, eq3Low: -2, eq3Mid: 0, eq3High: 0, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 },
    20: { mix: 60, delay: 777, feedback: 77, width: 100, density: 30, diffusion: 60, modRate: 2.0, modDepth: 50, eq3Low: 0, eq3Mid: 0, eq3High: 8, warp: 0, saturation: 0, ducking: 0, gateThresh: -100 }
};

// Update FDNR knobs when preset mode changes
function updateFDNRKnobsFromPreset(modeIndex) {
    const preset = FDNR_MODE_PRESETS[modeIndex];
    if (!preset) return;

    elements.fdnrKnobs?.forEach((slider) => {
        const param = slider.dataset.param;
        if (preset[param] !== undefined) {
            if (param === 'modRate') {
                slider.value = preset[param] * 100; // Convert Hz to slider value
            } else {
                slider.value = preset[param];
            }
        }
    });
}

// Update UI from state
function updateUI(state) {
    if (!state) return;

    // Update info bar
    elements.bpmDisplay.textContent = state.bpm;
    elements.rootDisplay.textContent = midiToNoteName(state.rootMidi);
    elements.scaleDisplay.textContent = formatScaleName(state.scaleName);

    // Update play button
    const playIcon = elements.playBtn.querySelector('.play-icon');
    const pauseIcon = elements.playBtn.querySelector('.pause-icon');
    if (state.isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        elements.playBtn.classList.add('playing');
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        elements.playBtn.classList.remove('playing');
    }

    // Update sliders
    elements.bpmSlider.value = state.bpm;
    elements.volumeSlider.value = Math.round(state.masterVolume * 100);
}

// MIDI to note name helper
function midiToNoteName(midi) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return notes[midi % 12] + Math.floor(midi / 12 - 1);
}

// Format scale name for display
function formatScaleName(name) {
    return name.replace(/([A-Z])/g, ' $1').trim();
}

// Visualization loop
function startVisualization() {
    const canvas = elements.visualizerCanvas;
    const ctx = canvas.getContext('2d');

    // Set canvas size
    const resize = () => {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    function draw() {
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;

        // Clear
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, width, height);

        // Get waveform data
        const data = glassMachine?.getWaveformData();
        if (!data) {
            animationFrame = requestAnimationFrame(draw);
            return;
        }

        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;

        const sliceWidth = width / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0;
            const y = v * height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.stroke();

        animationFrame = requestAnimationFrame(draw);
    }

    draw();
}

// Update transpose sequence in GlassMachine
function updateTransposeSequence() {
    const sequence = Array.from(elements.transposeCells).map(cell =>
        parseInt(cell.dataset.value) || 0
    );
    glassMachine?.setTransposeSequence(sequence);
}

// Update transpose cell highlighting based on current position
function updateTransposeHighlight(stepIndex) {
    elements.transposeCells.forEach((cell, i) => {
        cell.classList.toggle('active', i === stepIndex);
    });
}

// Refresh LFO destination dropdowns from available voice params
function refreshLFODestinations() {
    const destinations = glassMachine?.getLFODestinations() || [];

    // Update all destination select dropdowns
    elements.lfoDests?.forEach((select) => {
        const currentValue = select.value;
        const slot = parseInt(select.dataset.slot);

        // Clear and rebuild options
        select.innerHTML = `<option value="">Dest ${slot + 1}</option>`;

        destinations.forEach((dest) => {
            const option = document.createElement('option');
            option.value = dest.id;
            option.textContent = dest.label;
            select.appendChild(option);
        });

        // Restore previous selection if still valid
        if (currentValue && destinations.some(d => d.id === currentValue)) {
            select.value = currentValue;
        }
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }
    glassMachine?.dispose();
    xyPads.forEach(pad => pad.dispose());
    globalGestures?.dispose();
});
