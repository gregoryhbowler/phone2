// GLOBAL GESTURE HANDLERS
// Device-level gestures (tilt, shake, multi-touch global controls)

export class GlobalGestureHandler {
    constructor(options = {}) {
        // Callbacks
        this.onTilt = options.onTilt || null;
        this.onShake = options.onShake || null;
        this.onThreeFingerSlide = options.onThreeFingerSlide || null;
        this.onPinch = options.onPinch || null;
        this.onRotate = options.onRotate || null;

        // Device orientation
        this.hasOrientation = false;
        this.baseOrientation = { alpha: 0, beta: 0, gamma: 0 };
        this.currentOrientation = { alpha: 0, beta: 0, gamma: 0 };
        this.orientationCalibrated = false;

        // Shake detection
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        this.shakeThreshold = options.shakeThreshold || 15;
        this.shakeTimeout = null;
        this.shakeCount = 0;
        this.shakeMinCount = 2;

        // Multi-touch state
        this.activeTouches = new Map();
        this.initialPinchDistance = 0;
        this.initialRotationAngle = 0;

        // Three-finger state
        this.threeFingerStartY = 0;
        this.isThreeFingerActive = false;

        // Initialize
        this._setupEvents();
    }

    // Setup device events
    _setupEvents() {
        // Device orientation (for tilt)
        if (window.DeviceOrientationEvent) {
            // Check for iOS 13+ permission requirement
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // Will need to request permission on user interaction
                this.needsOrientationPermission = true;
            } else {
                this._startOrientation();
            }
        }

        // Device motion (for shake)
        if (window.DeviceMotionEvent) {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                this.needsMotionPermission = true;
            } else {
                this._startMotion();
            }
        }

        // Touch events for multi-touch gestures
        document.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        document.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this._onTouchEnd(e));
    }

    // Request permissions (must be called from user gesture)
    async requestPermissions() {
        const results = { orientation: false, motion: false };

        if (this.needsOrientationPermission) {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    this._startOrientation();
                    results.orientation = true;
                }
            } catch (e) {
                console.warn('Orientation permission denied:', e);
            }
        } else {
            results.orientation = true;
        }

        if (this.needsMotionPermission) {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this._startMotion();
                    results.motion = true;
                }
            } catch (e) {
                console.warn('Motion permission denied:', e);
            }
        } else {
            results.motion = true;
        }

        return results;
    }

    // Start orientation listening
    _startOrientation() {
        window.addEventListener('deviceorientation', (e) => this._onOrientation(e));
        this.hasOrientation = true;
    }

    // Start motion listening
    _startMotion() {
        window.addEventListener('devicemotion', (e) => this._onMotion(e));
    }

    // Handle device orientation
    _onOrientation(event) {
        this.currentOrientation = {
            alpha: event.alpha || 0, // Z-axis rotation (0-360)
            beta: event.beta || 0,   // X-axis rotation (-180 to 180)
            gamma: event.gamma || 0  // Y-axis rotation (-90 to 90)
        };

        // Calibrate on first reading
        if (!this.orientationCalibrated) {
            this.calibrateOrientation();
        }

        // Calculate relative tilt from calibrated base
        const relativeTilt = {
            x: (this.currentOrientation.gamma - this.baseOrientation.gamma) / 45, // -1 to 1
            y: (this.currentOrientation.beta - this.baseOrientation.beta) / 45,    // -1 to 1
            rotation: (this.currentOrientation.alpha - this.baseOrientation.alpha) / 180
        };

        // Clamp values
        relativeTilt.x = Math.max(-1, Math.min(1, relativeTilt.x));
        relativeTilt.y = Math.max(-1, Math.min(1, relativeTilt.y));

        if (this.onTilt) {
            this.onTilt(relativeTilt);
        }
    }

    // Calibrate orientation to current position
    calibrateOrientation() {
        this.baseOrientation = { ...this.currentOrientation };
        this.orientationCalibrated = true;
    }

    // Handle device motion (shake detection)
    _onMotion(event) {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;

        const deltaX = Math.abs(acc.x - this.lastAcceleration.x);
        const deltaY = Math.abs(acc.y - this.lastAcceleration.y);
        const deltaZ = Math.abs(acc.z - this.lastAcceleration.z);

        this.lastAcceleration = { x: acc.x, y: acc.y, z: acc.z };

        // Detect shake
        if (deltaX + deltaY + deltaZ > this.shakeThreshold) {
            this.shakeCount++;

            // Reset shake count after timeout
            clearTimeout(this.shakeTimeout);
            this.shakeTimeout = setTimeout(() => {
                if (this.shakeCount >= this.shakeMinCount && this.onShake) {
                    this.onShake({ intensity: this.shakeCount });
                }
                this.shakeCount = 0;
            }, 500);
        }
    }

    // Touch start handler
    _onTouchStart(event) {
        // Track all touches
        for (const touch of event.changedTouches) {
            this.activeTouches.set(touch.identifier, {
                x: touch.pageX,
                y: touch.pageY,
                startX: touch.pageX,
                startY: touch.pageY
            });
        }

        const touchCount = this.activeTouches.size;

        // Three-finger gesture start
        if (touchCount === 3) {
            this.isThreeFingerActive = true;
            this.threeFingerStartY = this._getAverageY();
        }

        // Two-finger pinch/rotate start
        if (touchCount === 2) {
            const touches = Array.from(this.activeTouches.values());
            this.initialPinchDistance = this._getDistance(touches[0], touches[1]);
            this.initialRotationAngle = this._getAngle(touches[0], touches[1]);
        }
    }

    // Touch move handler
    _onTouchMove(event) {
        // Update touch positions
        for (const touch of event.changedTouches) {
            if (this.activeTouches.has(touch.identifier)) {
                const data = this.activeTouches.get(touch.identifier);
                data.x = touch.pageX;
                data.y = touch.pageY;
            }
        }

        const touchCount = this.activeTouches.size;

        // Three-finger slide
        if (touchCount === 3 && this.isThreeFingerActive) {
            const currentY = this._getAverageY();
            const deltaY = currentY - this.threeFingerStartY;

            // Normalize to -1 to 1 based on screen height
            const normalized = deltaY / (window.innerHeight * 0.5);

            if (this.onThreeFingerSlide) {
                this.onThreeFingerSlide({
                    delta: Math.max(-1, Math.min(1, normalized)),
                    direction: deltaY > 0 ? 'down' : 'up'
                });
            }
        }

        // Two-finger pinch/rotate
        if (touchCount === 2) {
            const touches = Array.from(this.activeTouches.values());
            const currentDistance = this._getDistance(touches[0], touches[1]);
            const currentAngle = this._getAngle(touches[0], touches[1]);

            // Pinch
            if (this.initialPinchDistance > 0) {
                const scale = currentDistance / this.initialPinchDistance;
                if (this.onPinch) {
                    this.onPinch({ scale, expanding: scale > 1 });
                }
            }

            // Rotate
            const rotation = currentAngle - this.initialRotationAngle;
            if (Math.abs(rotation) > 5 && this.onRotate) {
                this.onRotate({ angle: rotation, direction: rotation > 0 ? 'clockwise' : 'counterclockwise' });
            }
        }
    }

    // Touch end handler
    _onTouchEnd(event) {
        for (const touch of event.changedTouches) {
            this.activeTouches.delete(touch.identifier);
        }

        if (this.activeTouches.size < 3) {
            this.isThreeFingerActive = false;
        }

        if (this.activeTouches.size < 2) {
            this.initialPinchDistance = 0;
            this.initialRotationAngle = 0;
        }
    }

    // Helper: get average Y position of all touches
    _getAverageY() {
        let sum = 0;
        for (const touch of this.activeTouches.values()) {
            sum += touch.y;
        }
        return sum / this.activeTouches.size;
    }

    // Helper: get distance between two points
    _getDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Helper: get angle between two points
    _getAngle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
    }

    // Get current tilt state
    getTiltState() {
        if (!this.orientationCalibrated) return { x: 0, y: 0, rotation: 0 };

        return {
            x: (this.currentOrientation.gamma - this.baseOrientation.gamma) / 45,
            y: (this.currentOrientation.beta - this.baseOrientation.beta) / 45,
            rotation: (this.currentOrientation.alpha - this.baseOrientation.alpha) / 180
        };
    }

    // Check if device has required sensors
    getCapabilities() {
        return {
            orientation: !!window.DeviceOrientationEvent,
            motion: !!window.DeviceMotionEvent,
            touch: 'ontouchstart' in window,
            needsPermission: this.needsOrientationPermission || this.needsMotionPermission
        };
    }

    // Cleanup
    dispose() {
        window.removeEventListener('deviceorientation', this._onOrientation);
        window.removeEventListener('devicemotion', this._onMotion);
        clearTimeout(this.shakeTimeout);
    }
}

// Factory function
export function createGlobalGestureHandler(options = {}) {
    return new GlobalGestureHandler(options);
}
