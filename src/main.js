// src/main.js
import * as THREE from 'three';
import { BootScene } from './scenes/BootScene.js';
import { StartMenuScene } from './scenes/StartMenuScene.js';
import './styles.css';

let renderer;
let bootScene;
let startMenu;
let currentScene = 'boot';
let hasStarted = false;

function init() {
  const canvas = document.getElementById('app');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  bootScene = new BootScene(renderer);
  window.addEventListener('resize', onResize);

  window.addEventListener('keydown', handleStart);
  window.addEventListener('mousedown', handleStart);
  window.addEventListener('touchstart', handleStart);

  window.addEventListener('gamepadconnected', () => console.log('Gamepad connected'));
  checkGamepad();

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

  // Fade UI, then load menu
  setTimeout(() => {
    if (enterText) enterText.remove();
    if (titleText) titleText.remove();

    // Instead of replacing BootScene, we just layer StartMenu on top
    currentScene = 'menu';
    startMenu = new StartMenuScene(renderer, bootScene);
  }, 800);
}



function checkGamepad() {
  if (currentScene !== 'boot' || hasStarted) return;
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (!gp) continue;
    if (gp.buttons.some((b) => b.pressed)) {
      handleStart();
      break;
    }
  }
  requestAnimationFrame(checkGamepad);
}

function onResize() {
  if (bootScene && currentScene === 'boot')
    bootScene.onResize(window.innerWidth, window.innerHeight);
  if (startMenu && currentScene === 'menu')
    startMenu.onResize(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (currentScene === 'boot') bootScene.update();
  else if (currentScene === 'menu') startMenu.update();
}

init();
