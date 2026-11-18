import * as THREE from 'three';
import { Engine } from '@client/core/Engine';
import { Loop } from '@client/core/Loop';

const engine = new Engine(document.getElementById('game-canvas') as HTMLCanvasElement);
const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 60), new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 }));
ground.position.y = -0.5;
ground.receiveShadow = true;
engine.scene.add(ground);
const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xff5a4e, roughness: 0.4 }));
cube.position.set(0, 1.5, -6);
cube.castShadow = true;
engine.scene.add(cube);
engine.camera.position.set(0, 1.7, 2);
const loop = new Loop(1 / 60, (dt) => { cube.rotation.y += dt; }, () => engine.render());
loop.start();
