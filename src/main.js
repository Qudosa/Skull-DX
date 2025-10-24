import * as THREE from 'three';
import { BootScene } from './scenes/BootScene.js';
import { StartMenuScene } from './scenes/StartMenuScene.js';
import './styles.css';

let renderer;
let bootScene;
let startMenu;
let gameScene;

let currentScene = 'boot';
let hasStarted = false;

function init() {
  const canvas = document.getElementById('app');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Boot Scene
  bootScene = new BootScene(renderer);

  window.addEventListener('resize', () => {
    if (bootScene && currentScene === 'boot') bootScene.onResize(window.innerWidth, window.innerHeight);
    if (startMenu && currentScene === 'menu') startMenu.onResize(window.innerWidth, window.innerHeight);
    if (gameScene && currentScene === 'game') gameScene.onResize(window.innerWidth, window.innerHeight);
  });

  // Input for splash start
  window.addEventListener('keydown', handleStart);
  window.addEventListener('mousedown', handleStart);
  window.addEventListener('touchstart', handleStart);

  animate();
}

function handleStart() {
  if (currentScene !== 'boot' || hasStarted) return;
  hasStarted = true;

  const enterText = document.getElementById('enter-text');
  const titleText = document.getElementById('title');

  if (enterText) {
    enterText.style.transition = 'opacity 0.8s ease';
    enterText.style.opacity = 0;
  }
  if (titleText) {
    titleText.style.transition = 'opacity 0.8s ease';
    titleText.style.opacity = 0;
  }

  setTimeout(() => {
    if (enterText) enterText.remove();
    if (titleText) titleText.remove();

    currentScene = 'menu';
    startMenu = new StartMenuScene(renderer, bootScene);
  }, 800);
}

async function switchToGameScene() {
  if (startMenu) {
    startMenu.fadeOut();
    startMenu.removeCanvasBlur();
  }

  setTimeout(async () => {
    const ui = document.getElementById('menu-ui');
    if (ui) ui.remove();

    if (bootScene && bootScene.dispose) bootScene.dispose();

    const { GameScene } = await import('./scenes/GameScene.js');
    gameScene = new GameScene(renderer);
    currentScene = 'game';
  }, 800);
}

window.app = { switchToGameScene };

function animate() {
  requestAnimationFrame(animate);

  switch (currentScene) {
    case 'boot':
      bootScene?.update();
      break;
    case 'menu':
      startMenu?.update();
      break;
    case 'game':
      gameScene?.update();
      break;
  }
}

init();
