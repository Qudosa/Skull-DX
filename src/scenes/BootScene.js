
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class BootScene {
  constructor(renderer) {
    this.renderer = renderer;

    // Scene + camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.z = 3;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 3.5);
    directional.position.set(2, 3, 5);
    this.scene.add(directional);

    // GLTF / GLB loader
    const loader = new GLTFLoader();
    loader.load(
      '/assets/models/skull_logo.glb',
      (gltf) => {
        this.logo = gltf.scene;
        this.logo.scale.set(0.7, 0.7, 0.7); // adjust size
        this.logo.rotation.y = Math.PI;
        this.scene.add(this.logo);
      },
      (xhr) => {
        console.log(`Loading model: ${((xhr.loaded / xhr.total) * 100).toFixed(0)}%`);
      },
      (error) => {
        console.error('Error loading GLB model:', error);
      }
    );

    this.clock = new THREE.Clock();
    this.scene.background = new THREE.Color(0x000000);
  }

  update() {
    const delta = this.clock.getDelta();
    if (this.logo) {
      this.logo.rotation.y += delta * 0.55;
    }
    this.renderer.render(this.scene, this.camera);
  }

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
