import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, renderer;
let camera;
let info;
let grid;
let estrella,
  Planetas = [],
  Lunas = [];
let t0 = 0;
let accglobal = 0.001;
let timestamp;

init();
animationLoop();

function init() {
  info = document.createElement("div");
  info.style.position = "absolute";
  info.style.top = "30px";
  info.style.width = "100%";
  info.style.textAlign = "center";
  info.style.color = "#fff";
  info.style.fontWeight = "bold";
  info.style.backgroundColor = "transparent";
  info.style.zIndex = "1";
  info.style.fontFamily = "Monospace";
  info.innerHTML = "Iván Pérez Díaz - Sistema Solar (Modelo simplificado)";
  document.body.appendChild(info);

  // --- CÁMARA Y ESCENA ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510);
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 50, 100);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  let camcontrols = new OrbitControls(camera, renderer.domElement);
  camcontrols.enableDamping = true;

  // Objeto Sol
  Estrella(4.0, 0xffff66);

  // --- PLANETAS ---
  const degToRad = (degrees) => degrees * (Math.PI / 180);

  // Mercurio
  Planeta(0.3, 8.0, 4.0, 0x909090, 1.05, 0.95, degToRad(7.0));

  // Venus
  Planeta(0.6, 15.0, 2.8, 0xffa500, 1.0, 1.0, degToRad(3.39));

  // Tierra
  let tierra = Planeta(0.65, 21.0, 2.0, 0x0000ff, 1.0, 1.0, degToRad(0.0));

  // Marte
  Planeta(0.45, 32.0, 1.6, 0xff4500, 1.06, 0.94, degToRad(1.85));

  // Júpiter
  Planeta(2.25, 60.0, 0.9, 0xd2b48c, 1.05, 0.95, degToRad(1.31));

  // Saturno
  Planeta(1.8, 90.0, 0.7, 0xf0e68c, 1.05, 0.95, degToRad(2.49));

  // Urano
  Planeta(1.2, 120.0, 0.5, 0x00ffff, 1.0, 1.0, degToRad(0.77));

  // Neptuno
  Planeta(1.05, 150.0, 0.4, 0x4169e1, 1.0, 1.0, degToRad(1.77));

  // Luna de la Tierra
  Luna(tierra, 0.15, 1.0, 6.0, 0xffffff, degToRad(5.14));

  t0 = Date.now();
}

// Función auxiliar para convertir grados a radianes
const degToRad = (degrees) => degrees * (Math.PI / 180);

// --- FUNCIONES DE OBJETOS ---

function Estrella(rad, col) {
  let geometry = new THREE.SphereGeometry(rad, 32, 32);
  let material = new THREE.MeshBasicMaterial({ color: col });
  estrella = new THREE.Mesh(geometry, material);
  scene.add(estrella);
}

function Planeta(radio, dist, vel, col, f1, f2, incl) {
  let geom = new THREE.SphereGeometry(radio, 16, 16);
  let mat = new THREE.MeshBasicMaterial({ color: col });
  let planeta = new THREE.Mesh(geom, mat);
  planeta.userData.dist = dist;
  planeta.userData.speed = vel;
  planeta.userData.f1 = f1;
  planeta.userData.f2 = f2;

  Planetas.push(planeta);

  let pivoteOrbita = new THREE.Object3D();
  pivoteOrbita.rotation.y = incl;
  pivoteOrbita.add(planeta);
  scene.add(pivoteOrbita);

  // Dibuja trayectoria (órbita)
  let curve = new THREE.EllipseCurve(0, 0, dist * f1, dist * f2);
  let points = curve.getPoints(100);
  let geome = new THREE.BufferGeometry().setFromPoints(points);
  let mate = new THREE.LineBasicMaterial({ color: 0x444444 });
  let orbita = new THREE.Line(geome, mate);

  orbita.rotation.x = Math.PI / 2;

  pivoteOrbita.add(orbita);

  return planeta;
}

function Luna(planeta, radio, dist, vel, col, angle) {
  var pivote = new THREE.Object3D();
  pivote.rotation.y = angle;
  planeta.add(pivote);
  var geom = new THREE.SphereGeometry(radio, 10, 10);
  var mat = new THREE.MeshBasicMaterial({ color: col });
  var luna = new THREE.Mesh(geom, mat);
  luna.userData.dist = dist;
  luna.userData.speed = vel;

  Lunas.push(luna);
  pivote.add(luna);
}

function animationLoop() {
  timestamp = (Date.now() - t0) * accglobal;

  requestAnimationFrame(animationLoop);

  for (let object of Planetas) {
    object.position.x =
      Math.cos(timestamp * object.userData.speed) *
      object.userData.f1 *
      object.userData.dist;
    object.position.z =
      Math.sin(timestamp * object.userData.speed) *
      object.userData.f2 *
      object.userData.dist;
  }

  for (let object of Lunas) {
    object.position.x =
      Math.cos(timestamp * object.userData.speed) * object.userData.dist;
    object.position.z =
      Math.sin(timestamp * object.userData.speed) * object.userData.dist;
  }

  renderer.render(scene, camera);
}
