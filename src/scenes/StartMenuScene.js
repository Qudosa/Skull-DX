import * as THREE from 'three';

export class StartMenuScene {
  constructor(renderer, backgroundScene) {
    this.renderer = renderer;
    this.backgroundScene = backgroundScene;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.z = 3;

    this.clock = new THREE.Clock();
    this.createUI();
    this.applyCanvasBlur();

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);
  }

  applyCanvasBlur() {
    const canvas = document.getElementById('app');
    canvas.style.transition = 'filter 1s ease, opacity 1s ease';
    canvas.style.filter = 'blur(8px) brightness(0.4)';
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

    const style = document.createElement('style');
    style.innerHTML = `
      #menu-ui {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
        color: #fff;
        font-family: 'Orbitron', sans-serif;
        text-shadow: 0 0 8px #f00, 0 0 20px #800;
      }

      #menu-title {
        font-size: 4rem;
        margin-bottom: 60px;
        letter-spacing: 0.15rem;
      }

      #menu-buttons {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      #menu-buttons button {
        background: rgba(0,0,0,0.6);
        border: 2px solid #f00;
        color: #fff;
        padding: 14px 36px;
        font-size: 1.3rem;
        border-radius: 8px;
        font-family: 'Orbitron', sans-serif;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      #menu-buttons button:hover {
        background: #f00;
        color: #000;
        text-shadow: none;
      }

      #menu-ui::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(transparent 40%, rgba(0,0,0,0.8) 100%);
        z-index: -1;
      }
    `;
    document.head.appendChild(style);
  }

  startGame() {
    console.log('Starting game...');
    this.fadeOut();
    this.removeCanvasBlur();
    setTimeout(() => {
      if (window.app && typeof window.app.switchToGameScene === 'function') {
        window.app.switchToGameScene();
      }
    }, 800);
  }

  showOptions() {
    alert('Options menu not yet implemented.');
  }

  quitGame() {
    alert('Quit feature not available in browser build.');
  }

  fadeOut() {
    const ui = document.getElementById('menu-ui');
    if (!ui) return;
    ui.style.transition = 'opacity 0.8s ease';
    ui.style.opacity = 0;
  }

  update() {
    if (this.backgroundScene) {
      this.backgroundScene.update();
      this.renderer.autoClear = true;
      this.renderer.render(this.backgroundScene.scene, this.backgroundScene.camera);
    }
    this.renderer.autoClear = false;
    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}