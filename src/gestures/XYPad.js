// XY PAD GESTURE CONTROLLER
// Touch-driven XY pad with gesture recognition and physics

export class XYPad {
    constructor(element, options = {}) {
        this.element = element;
        this.voiceId = options.voiceId || 0;

        // Current position (0-1)
        this.x = options.initialX || 0.5;
        this.y = options.initialY || 0.5;

        // Velocity for physics
        this.velocityX = 0;
        this.velocityY = 0;

        // Physics settings
        this.friction = options.friction || 0.92;
        this.springStrength = options.springStrength || 0;
        this.springTarget = { x: 0.5, y: 0.5 };

        // Touch state
        this.isPressed = false;
        this.lastTouchTime = 0;
        this.touchStartPos = { x: 0, y: 0 };
        this.touchHistory = []; // For gesture detection

        // Gesture callbacks
        this.onMove = options.onMove || null;
        this.onGestureFlick = options.onGestureFlick || null;
        this.onGestureLongPress = options.onGestureLongPress || null;
        this.onGestureTap = options.onGestureTap || null;
        this.onGestureOrbit = options.onGestureOrbit || null;
        this.onGesturePinch = options.onGesturePinch || null;

        // Long press detection
        this.longPressTimer = null;
        this.longPressThreshold = 500; // ms

        // Flick detection
        this.flickThreshold = 0.3; // velocity threshold
        this.flickDecay = 0.85;

        // Animation frame
        this.animationFrame = null;
        this.isAnimating = false;

        // Visual feedback element
        this.indicator = null;

        // Orbit gesture detection
        this.orbitHistory = [];
        this.orbitThreshold = 3; // minimum rotations to detect

        // Initialize
        this._setupEvents();
        this._createVisuals();
    }

    // Setup touch/mouse events
    _setupEvents() {
        // Touch events
        this.element.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        this.element.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
        this.element.addEventListener('touchend', (e) => this._onTouchEnd(e));
        this.element.addEventListener('touchcancel', (e) => this._onTouchEnd(e));

        // Mouse events (for desktop testing)
        this.element.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.element.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.element.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.element.addEventListener('mouseleave', (e) => this._onMouseUp(e));
    }

    // Create visual elements
    _createVisuals() {
        this.indicator = document.createElement('div');
        this.indicator.className = 'xy-indicator';
        this.element.appendChild(this.indicator);

        // Defer initial positioning until after layout
        requestAnimationFrame(() => {
            this._updateIndicator();
        });
    }

    // Update indicator position
    _updateIndicator() {
        if (!this.indicator) return;

        const rect = this.element.getBoundingClientRect();
        // Skip if element hasn't been laid out yet
        if (rect.width === 0 || rect.height === 0) return;

        const indicatorSize = 24;

        const left = this.x * rect.width - indicatorSize / 2;
        const top = (1 - this.y) * rect.height - indicatorSize / 2;

        this.indicator.style.left = `${left}px`;
        this.indicator.style.top = `${top}px`;

        // Size based on velocity
        const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
        const scale = 1 + speed * 2;
        this.indicator.style.transform = `scale(${scale})`;

        // Active state
        this.indicator.classList.toggle('active', this.isPressed);
    }

    // Convert client coordinates to 0-1 range
    // Note: getBoundingClientRect returns viewport-relative coords, so use clientX/Y not pageX/Y
    _pageToNormalized(clientX, clientY) {
        const rect = this.element.getBoundingClientRect();

        // Guard against zero dimensions
        if (rect.width === 0 || rect.height === 0) {
            return { x: this.x, y: this.y };
        }

        // Calculate position relative to element (using client coords which match getBoundingClientRect)
        const relX = clientX - rect.left;
        const relY = clientY - rect.top;

        return {
            x: Math.max(0, Math.min(1, relX / rect.width)),
            y: Math.max(0, Math.min(1, 1 - relY / rect.height)) // Inverted Y: top=1, bottom=0
        };
    }

    // Touch start handler
    _onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this._startInteraction(touch.clientX, touch.clientY);
    }

    // Touch move handler
    _onTouchMove(e) {
        e.preventDefault();
        if (!this.isPressed) return;

        const touch = e.touches[0];
        this._moveInteraction(touch.clientX, touch.clientY);
    }

    // Touch end handler
    _onTouchEnd(e) {
        this._endInteraction();
    }

    // Mouse handlers
    _onMouseDown(e) {
        this._startInteraction(e.clientX, e.clientY);
    }

    _onMouseMove(e) {
        if (!this.isPressed) return;
        this._moveInteraction(e.clientX, e.clientY);
    }

    _onMouseUp(e) {
        this._endInteraction();
    }

    // Start interaction
    _startInteraction(pageX, pageY) {
        this.isPressed = true;
        this.lastTouchTime = performance.now();

        const pos = this._pageToNormalized(pageX, pageY);
        this.touchStartPos = { ...pos };
        this.x = pos.x;
        this.y = pos.y;

        // Reset velocity
        this.velocityX = 0;
        this.velocityY = 0;

        // Reset touch history
        this.touchHistory = [{ x: pos.x, y: pos.y, time: this.lastTouchTime }];
        this.orbitHistory = [];

        // Start long press timer
        this.longPressTimer = setTimeout(() => {
            if (this.isPressed && this._isNearStart()) {
                if (this.onGestureLongPress) {
                    this.onGestureLongPress({ x: this.x, y: this.y, voiceId: this.voiceId });
                }
            }
        }, this.longPressThreshold);

        // Start animation loop
        this._startAnimation();

        // Trigger initial move
        this._triggerMove();
        this._updateIndicator();
    }

    // Move interaction
    _moveInteraction(pageX, pageY) {
        const now = performance.now();
        const pos = this._pageToNormalized(pageX, pageY);

        // Calculate velocity
        const dt = (now - this.lastTouchTime) / 1000;
        if (dt > 0) {
            this.velocityX = (pos.x - this.x) / dt;
            this.velocityY = (pos.y - this.y) / dt;
        }

        this.x = pos.x;
        this.y = pos.y;
        this.lastTouchTime = now;

        // Add to history
        this.touchHistory.push({ x: pos.x, y: pos.y, time: now });
        if (this.touchHistory.length > 20) {
            this.touchHistory.shift();
        }

        // Track orbit gesture
        this._trackOrbit(pos);

        // Cancel long press if moved too much
        if (!this._isNearStart()) {
            clearTimeout(this.longPressTimer);
        }

        // Trigger move callback
        this._triggerMove();
        this._updateIndicator();
    }

    // End interaction
    _endInteraction() {
        if (!this.isPressed) return;

        this.isPressed = false;
        clearTimeout(this.longPressTimer);

        const now = performance.now();
        const duration = now - this.touchHistory[0]?.time || 0;

        // Detect tap (short duration, minimal movement)
        if (duration < 200 && this._isNearStart()) {
            if (this.onGestureTap) {
                this.onGestureTap({ x: this.x, y: this.y, voiceId: this.voiceId });
            }
        }

        // Detect flick (high velocity)
        const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
        if (speed > this.flickThreshold) {
            if (this.onGestureFlick) {
                this.onGestureFlick({
                    x: this.x,
                    y: this.y,
                    velocityX: this.velocityX,
                    velocityY: this.velocityY,
                    speed,
                    voiceId: this.voiceId
                });
            }
            // Continue with momentum
            this._continueWithMomentum();
        }

        // Detect orbit gesture
        if (this._checkOrbitGesture()) {
            if (this.onGestureOrbit) {
                this.onGestureOrbit({
                    x: this.x,
                    y: this.y,
                    rotations: this._countRotations(),
                    voiceId: this.voiceId
                });
            }
        }

        this._updateIndicator();
    }

    // Check if current position is near start position
    _isNearStart() {
        const dx = this.x - this.touchStartPos.x;
        const dy = this.y - this.touchStartPos.y;
        return Math.sqrt(dx * dx + dy * dy) < 0.05;
    }

    // Track orbit gesture
    _trackOrbit(pos) {
        if (this.touchHistory.length < 2) return;

        const prev = this.touchHistory[this.touchHistory.length - 2];
        const center = this.touchStartPos;

        // Calculate angle change
        const prevAngle = Math.atan2(prev.y - center.y, prev.x - center.x);
        const currAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
        let deltaAngle = currAngle - prevAngle;

        // Normalize to -PI to PI
        while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

        this.orbitHistory.push(deltaAngle);
    }

    // Check if orbit gesture was made
    _checkOrbitGesture() {
        if (this.orbitHistory.length < 10) return false;

        const totalRotation = this.orbitHistory.reduce((sum, angle) => sum + angle, 0);
        return Math.abs(totalRotation) > Math.PI * 2 * this.orbitThreshold;
    }

    // Count rotations
    _countRotations() {
        const totalRotation = this.orbitHistory.reduce((sum, angle) => sum + angle, 0);
        return Math.floor(Math.abs(totalRotation) / (Math.PI * 2));
    }

    // Continue with momentum after release
    _continueWithMomentum() {
        // Animation will handle this via friction
    }

    // Animation loop
    _startAnimation() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this._animate();
    }

    _animate() {
        if (!this.isAnimating) return;

        // Apply physics when not pressed
        if (!this.isPressed) {
            // Apply friction
            this.velocityX *= this.friction;
            this.velocityY *= this.friction;

            // Apply spring force
            if (this.springStrength > 0) {
                this.velocityX += (this.springTarget.x - this.x) * this.springStrength;
                this.velocityY += (this.springTarget.y - this.y) * this.springStrength;
            }

            // Update position
            this.x = Math.max(0, Math.min(1, this.x + this.velocityX * 0.016));
            this.y = Math.max(0, Math.min(1, this.y + this.velocityY * 0.016));

            // Trigger move if still moving
            const speed = Math.sqrt(this.velocityX ** 2 + this.velocityY ** 2);
            if (speed > 0.001) {
                this._triggerMove();
            } else {
                // Stop animation when settled
                this.isAnimating = false;
            }
        }

        this._updateIndicator();

        if (this.isAnimating || this.isPressed) {
            this.animationFrame = requestAnimationFrame(() => this._animate());
        }
    }

    // Trigger move callback
    _triggerMove() {
        if (this.onMove) {
            this.onMove({
                x: this.x,
                y: this.y,
                velocityX: this.velocityX,
                velocityY: this.velocityY,
                isPressed: this.isPressed,
                voiceId: this.voiceId
            });
        }
    }

    // Public: Set position programmatically
    setPosition(x, y, animate = false) {
        if (animate) {
            this.velocityX = (x - this.x) * 5;
            this.velocityY = (y - this.y) * 5;
            this._startAnimation();
        } else {
            this.x = Math.max(0, Math.min(1, x));
            this.y = Math.max(0, Math.min(1, y));
            this.velocityX = 0;
            this.velocityY = 0;
        }
        this._updateIndicator();
        this._triggerMove();
    }

    // Public: Enable spring behavior
    enableSpring(targetX = 0.5, targetY = 0.5, strength = 0.1) {
        this.springTarget = { x: targetX, y: targetY };
        this.springStrength = strength;
    }

    // Public: Disable spring
    disableSpring() {
        this.springStrength = 0;
    }

    // Public: Get state
    getState() {
        return {
            x: this.x,
            y: this.y,
            velocityX: this.velocityX,
            velocityY: this.velocityY,
            isPressed: this.isPressed,
            voiceId: this.voiceId
        };
    }

    // Cleanup
    dispose() {
        this.isAnimating = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        clearTimeout(this.longPressTimer);
        if (this.indicator) {
            this.indicator.remove();
        }
    }
}

// Create XY pads for all three voices
export function createXYPads(containerElement, options = {}) {
    const pads = [];

    // Initial positions matching voice roles:
    // Y=0 is bottom, Y=1 is top
    const initialPositions = [
        { x: 0.5, y: 0.5 },   // Root: center
        { x: 0.3, y: 0.6 },   // Third: upper-left
        { x: 0.7, y: 0.4 }    // Fifth: lower-right
    ];

    for (let i = 0; i < 3; i++) {
        // Create XY pad directly in container (no more voice-column wrapper)
        const padElement = document.createElement('div');
        padElement.className = 'xy-pad';
        padElement.dataset.voiceId = i;

        containerElement.appendChild(padElement);

        const pad = new XYPad(padElement, {
            voiceId: i,
            initialX: initialPositions[i].x,
            initialY: initialPositions[i].y,
            ...options,
            onMove: (data) => options.onMove?.(data),
            onGestureFlick: (data) => options.onGestureFlick?.(data),
            onGestureLongPress: (data) => options.onGestureLongPress?.(data),
            onGestureTap: (data) => options.onGestureTap?.(data),
            onGestureOrbit: (data) => options.onGestureOrbit?.(data)
        });

        pads.push(pad);
    }

    return pads;
}
