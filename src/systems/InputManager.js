// src/systems/InputManager.js
// Unified input: Keyboard, pointer-lock mouse look, and Gamepad.
// Exposes: update(dt), getMoveVector(), getLookDelta(), isPressed(action)

export class InputManager {
  constructor() {
    // Keyboard state
    this.keys = {};
    window.addEventListener('keydown', (e) => (this.keys[e.code] = true));
    window.addEventListener('keyup', (e) => (this.keys[e.code] = false));

    // Mouse look deltas (pointer lock)
    this.pointerLocked = false;
    this.lookDelta = { x: 0, y: 0 };
    this._onMouseMove = this._onMouseMove.bind(this);

    // Gamepad snapshot
    this.gamepad = null;

    // Action mapping
    this.actionMap = {
      forward: ['KeyW', 'ArrowUp'],
      back: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      run: ['ShiftLeft', 'ShiftRight'],
      interact: ['Space', 'KeyE'],
    };

    // Sensitivity
    this.mouseSensitivity = 0.0025;
    this.gamepadLookSensitivity = 2.0; // multiplier for axes

    // Start listening for pointer lock requests when user clicks canvas
  }

  enablePointerLock(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('click', () => {
      canvas.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (this.pointerLocked) {
        document.addEventListener('mousemove', this._onMouseMove);
      } else {
        document.removeEventListener('mousemove', this._onMouseMove);
      }
      // reset deltas when lock toggles
      this.lookDelta.x = 0;
      this.lookDelta.y = 0;
    });
  }

  _onMouseMove(e) {
    this.lookDelta.x += e.movementX || e.mozMovementX || e.webkitMovementX || 0;
    this.lookDelta.y += e.movementY || e.mozMovementY || e.webkitMovementY || 0;
  }

  update() {
    // Read connected gamepad (first)
    const gpads = navigator.getGamepads?.();
    this.gamepad = gpads && gpads[0] ? gpads[0] : null;

    // Apply a small deadzone to sticks
    if (this.gamepad) {
      const [lx, ly, rx, ry] = [
        this.gamepad.axes[0] ?? 0,
        this.gamepad.axes[1] ?? 0,
        this.gamepad.axes[2] ?? 0,
        this.gamepad.axes[3] ?? 0,
      ];
      this.leftStick = { x: Math.abs(lx) > 0.12 ? lx : 0, y: Math.abs(ly) > 0.12 ? ly : 0 };
      this.rightStick = { x: Math.abs(rx) > 0.12 ? rx : 0, y: Math.abs(ry) > 0.12 ? ry : 0 };
    } else {
      this.leftStick = { x: 0, y: 0 };
      this.rightStick = { x: 0, y: 0 };
    }
  }

  // returns movement vector in local space (z forward, x right)
  getMoveVector() {
    // keyboard
    let forward = this._any(this.actionMap.forward) ? 1 : 0;
    let back = this._any(this.actionMap.back) ? 1 : 0;
    let left = this._any(this.actionMap.left) ? 1 : 0;
    let right = this._any(this.actionMap.right) ? 1 : 0;

    // keyboard directional values
    let y = forward - back;
    let x = right - left;

    // gamepad left stick overrides keyboard (if non-zero)
    if (this.leftStick && (this.leftStick.x !== 0 || this.leftStick.y !== 0)) {
      x = this.leftStick.x;
      y = -this.leftStick.y; // gamepad y is inverted
    }

    // normalize
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, z: y / len, rawX: x, rawZ: y };
  }

  // returns look delta in radians {dx, dy}
  getLookDelta() {
    // mouse pointer lock has priority (accumulated)
    let dx = 0,
      dy = 0;
    if (this.pointerLocked) {
      dx = this.lookDelta.x * this.mouseSensitivity;
      dy = this.lookDelta.y * this.mouseSensitivity;
      // reset after reading
      this.lookDelta.x = 0;
      this.lookDelta.y = 0;
    }

    // gamepad right stick
    if (this.rightStick && (this.rightStick.x !== 0 || this.rightStick.y !== 0)) {
      dx += this.rightStick.x * this.gamepadLookSensitivity * 0.02;
      dy += -this.rightStick.y * this.gamepadLookSensitivity * 0.02;
    }

    return { dx, dy };
  }

  isRunning() {
    return this._any(this.actionMap.run) || (this.gamepad && (this.gamepad.buttons[6]?.pressed || false)); // left trigger
  }

  isPressed(action) {
    return this._any(this.actionMap[action]);
  }

  _any(codes) {
    for (const c of codes) if (this.keys[c]) return true;
    return false;
  }
}
