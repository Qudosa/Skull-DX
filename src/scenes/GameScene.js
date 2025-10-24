// src/scenes/GameScene.js
import * as THREE from 'three';
import { InputManager } from '../systems/InputManager.js';
import { HUDCanvas } from '../ui/HUDCanvas.js';
import { LevelBuilder } from '../systems/LevelBuilder.js';

export class GameScene {
  constructor(renderer, { realm = 1, level = 1, seed = Date.now() } = {}) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121212);

    // Camera (first-person)
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 1.6, 0);

    // Controls and HUD
    this.input = new InputManager();
    this.input.enablePointerLock(document.getElementById('app'));

    this.hud = new HUDCanvas();
    this.hud.setState({ health: 100, lives: 3, keys: 0, coins: 0 });

    // Audio
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.audioLoader = new THREE.AudioLoader();
    this.bgMusic = new THREE.Audio(this.listener);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    this.scene.add(dir);

    // Physics / movement
    this.velocity = new THREE.Vector3();
    this.speed = 3.6; // walk
    this.runMultiplier = 1.7;
    this.gravity = -9.8;
    this.onGround = true;
    this.playerHeight = 1.6;

    // Colliders and world
    this.colliders = [];
    this.worldGroup = new THREE.Group();
    this.scene.add(this.worldGroup);

    // Level builder
    this.levelBuilder = new LevelBuilder();

    // Load level
    this.currentRealm = realm;
    this.currentLevel = level;
    this.loadLevel(realm, level, seed);

    // Minimap placeholder
    this.minimap = { w: 20, h: 20, cells: [], playerX: 0, playerZ: 0 };

    window.addEventListener('resize', () => this.onResize());
    this.clock = new THREE.Clock();

    this.isPaused = false;
  }

  async loadLevel(realm, level, seed) {
    if (this.bgMusic && this.bgMusic.isPlaying) this.bgMusic.stop();
    if (this.footstep && this.footstep.isPlaying) this.footstep.stop();

    const info = this.levelBuilder.generate({ realm, level, seed });
    this.levelInfo = info;

    // Clear previous world
    while (this.worldGroup.children.length) this.worldGroup.remove(this.worldGroup.children[0]);
    this.colliders = [];

    // Textures
    const texLoader = new THREE.TextureLoader();
    const floorTex = texLoader.load('/assets/textures/r1_tex/r1-lvl1_floor1.png');
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    const wallTex = texLoader.load('/assets/textures/r1_tex/r1-lvl1_wall1.png');
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;

    // Floor plane
    const worldSize = Math.max(info.width, info.height);
    const planeSize = worldSize * 2; // doubled
    floorTex.repeat.set(worldSize, worldSize);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((info.width - 1), 0, (info.height - 1));
    this.worldGroup.add(floor);

    // Maze walls
    const wallHeight = 3.5;
    const cellSize = 2; // doubled corridor width

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const cell = info.grid[y][x];
        const worldX = x * cellSize;
        const worldZ = y * cellSize;

        if (cell === 1) {
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(cellSize, wallHeight, cellSize),
            new THREE.MeshStandardMaterial({ map: wallTex })
          );
          box.position.set(worldX, wallHeight / 2, worldZ);
          box.castShadow = true;
          box.receiveShadow = true;
          this.worldGroup.add(box);
          this.colliders.push(new THREE.Box3().setFromObject(box));
        } else if (cell === 2) {
          this.camera.position.set(worldX, 1.6, worldZ);
        } else if (cell === 3) {
          const goalMat = new THREE.MeshStandardMaterial({
            color: 0xffaa00,
            emissive: 0xff6600,
            emissiveIntensity: 0.6
          });
          const goal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.6, 12),
            goalMat
          );
          goal.position.set(worldX, 0.3, worldZ);
          this.worldGroup.add(goal);
        }
      }
    }

    // Bounding box for maze limits
    const worldBox = new THREE.Box3(
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(info.width * cellSize + 1, 10, info.height * cellSize + 1)
    );
    this.worldBounds = worldBox;

    // Minimap data
    this.minimap = {
      w: info.width,
      h: info.height,
      cells: info.grid,
      playerX: this.camera.position.x,
      playerZ: this.camera.position.z
    };
    this.hud.setMinimapData(() => ({
      w: this.minimap.w,
      h: this.minimap.h,
      cells: this.minimap.cells,
      playerX: Math.floor(this.minimap.playerX / cellSize),
      playerZ: Math.floor(this.minimap.playerZ / cellSize),
    }));

    // Audio
    this._loadAudio();
  }

  _loadAudio() {
    try {
      this.audioLoader.load('/assets/audio/music/r1_music.ogg', (buffer) => {
        this.bgMusic.setBuffer(buffer);
        this.bgMusic.setLoop(true);
        this.bgMusic.setVolume(0.45);
        try { this.bgMusic.play(); } catch (e) {}
      });
    } catch (e) {}

    this.footstep = new THREE.Audio(this.listener);
    this.audioLoader.load('/assets/audio/sfx/r1_sfx_footstep.ogg', (buf) => {
      this.footstep.setBuffer(buf);
      this.footstep.setLoop(true);
      this.footstep.setVolume(0.6);
    });
  }

  _checkCollision(pos) {
    const pBox = new THREE.Box3(
      new THREE.Vector3(pos.x - 0.25, pos.y - 0.1, pos.z - 0.25),
      new THREE.Vector3(pos.x + 0.25, pos.y + 1.6, pos.z + 0.25)
    );
    if (!this.worldBounds.containsPoint(new THREE.Vector3(pos.x, pos.y, pos.z))) return true;
    for (const b of this.colliders) {
      if (pBox.intersectsBox(b)) return true;
    }
    return false;
  }

  update() {
    if (this.isPaused) return;
    const dt = this.clock.getDelta();
    this.input.update();

    // Look
    const look = this.input.getLookDelta();
    this._yaw(-look.dx);
    this._pitch(-look.dy);

    // Movement
    const mv = this.input.getMoveVector();
    let speed = this.speed * (this.input.isRunning() ? this.runMultiplier : 1);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(this.camera.up, forward).normalize().negate();

    const moveVec = new THREE.Vector3();
    moveVec.addScaledVector(forward, mv.z * speed * dt);
    moveVec.addScaledVector(right, mv.x * speed * dt);

    const nextPos = this.camera.position.clone().add(moveVec);
    if (!this._checkCollision(nextPos)) {
      this.camera.position.copy(nextPos);
      this.minimap.playerX = this.camera.position.x;
      this.minimap.playerZ = this.camera.position.z;

      if ((mv.rawX !== 0 || mv.rawZ !== 0) && this.footstep && !this.footstep.isPlaying) {
        try { this.footstep.play(); } catch (e) {}
      } else if (this.footstep && (mv.rawX === 0 && mv.rawZ === 0) && this.footstep.isPlaying) {
        this.footstep.stop();
      }
    } else {
      if (this.footstep && this.footstep.isPlaying) this.footstep.stop();
    }

    // HUD update
    this.hud.setState({ health: Math.max(0, Math.round(this.hud.health)) });
    this.hud.draw();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  _yaw(amountRad) {
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), amountRad);
    this.camera.quaternion.premultiply(quat);
  }

  _pitch(amountRad) {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    e.x += amountRad;
    const max = Math.PI / 2 - 0.05;
    e.x = THREE.MathUtils.clamp(e.x, -max, max);
    this.camera.quaternion.setFromEuler(e);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.hud.resize();
  }

  dispose() {
    try {
      if (this.bgMusic && this.bgMusic.isPlaying) this.bgMusic.stop();
      if (this.footstep && this.footstep.isPlaying) this.footstep.stop();
    } catch (e) {}
    const el = document.getElementById('hud-canvas');
    if (el) el.remove();
  }
}
