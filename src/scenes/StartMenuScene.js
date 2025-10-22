// src/scenes/StartMenuScene.js
import * as THREE from 'three';

export class StartMenuScene {
  constructor(renderer, backgroundScene) {
    this.renderer = renderer;
    this.backgroundScene = backgroundScene; // keep a reference to BootScene (spinning skull)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.z = 3;

    // Add faint ambient light for the overlay scene (optional)
    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);

    this.clock = new THREE.Clock();
    this.createUI();

    // Apply blur/dim overlay using CSS
    this.applyCanvasBlur();
  }

  applyCanvasBlur() {
    const canvas = document.getElementById('app');
    canvas.style.transition = 'filter 1s ease, opacity 1s ease';
    canvas.style.filter = 'blur(6px) brightness(1.2)'; // ✅ blur + darken
    canvas.style.opacity = 1;
  }

  removeCanvasBlur() {
    const canvas = document.getElementById('app');
    canvas.style.filter = '';
  }

  createUI() {
    const oldUI = document.getElementById('menu-ui');
    if (oldUI) oldUI.remove();

    const div = document.createElement('div');
    div.id = 'menu-ui';
    div.innerHTML = `
      <div id="menu-title">Skull-DX</div>
      <div id="menu-buttons">
        <button id="btn-start">Start Game</button>
        <button id="btn-options">Options</button>
        <button id="btn-quit">Quit</button>
      </div>
    `;
    document.body.appendChild(div);

    document.getElementById('btn-start').onclick = () => this.startGame();
    document.getElementById('btn-options').onclick = () => this.showOptions();
    document.getElementById('btn-quit').onclick = () => this.quitGame();
  }

  startGame() {
    console.log('Starting game...');
    this.fadeOut();
    this.removeCanvasBlur(); // clear blur when leaving menu
  }

  showOptions() {
    console.log('Options menu (coming soon)');
  }

  quitGame() {
    console.log('Quit pressed');
    window.close?.();
  }

  fadeOut() {
    const ui = document.getElementById('menu-ui');
    if (!ui) return;
    ui.style.transition = 'opacity 0.8s ease';
    ui.style.opacity = 0;
  }

update() {
  // Render the background BootScene first (the spinning skull)
  if (this.backgroundScene) {
    this.backgroundScene.update();  // updates rotation
    this.renderer.autoClear = true; // make sure it draws to canvas
    this.renderer.render(this.backgroundScene.scene, this.backgroundScene.camera);
  }

  // Then render this overlay scene (if you want extra effects later)
  this.renderer.autoClear = false;
  this.renderer.render(this.scene, this.camera);
}


  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
