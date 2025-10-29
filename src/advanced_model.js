import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, renderer;
let camera;
let info;
let camcontrols;
let estrella,
  Planetas = [],
  Lunas = [];
let objetos = [];
let t0 = 0;
let accglobal = 0.001;
let timestamp;

// --- VARIABLES DE CONTROL DE CÁMARA ---
let viewMode = "normal"; // Estado: 'normal', 'follow', 'free'
let followTargetIndex = 0;
let currentFollowTargetIndex = -1;
let followableObjects = []; // Contiene todos los objetos que pueden ser seguidos
const FOLLOW_DISTANCE = 7; // Distancia base, se ajusta para el sol

// --- VARIABLES DE MOVIMIENTO LIBRE (WASD + MOUSELOOK) ---
let keyState = {}; // Para rastrear qué teclas están pulsadas
const velocity = new THREE.Vector3(); // Velocidad de movimiento
const MOVE_SPEED = 20; // Velocidad de desplazamiento
const MOUSE_SENSITIVITY = 0.002; // Sensibilidad del ratón
let euler = new THREE.Euler(0, 0, 0, "YXZ"); // Objeto para gestionar rotación de la cámara

// --- TEXTURAS A CARGAR ---
const loader = new THREE.TextureLoader();
const EARTH_MAP = loader.load("./Textures/planeta.jpg");
const EARTH_BUMP = loader.load("./Textures/earthbump1k.jpg");
const EARTH_SPEC = loader.load("./Textures/earthspec1k.jpg");
const CLOUD_MAP = loader.load("./Textures/earth_clouds_1024.png");
const CLOUD_ALPHA = loader.load("./Textures/earth_clouds_1024.png");
const SUN_MAP = loader.load("./Textures/sun_map2.png");

// Carga de todas las texturas de planetas
const TEXTURAS_PLANETAS = {
  mercurio: loader.load("./Textures/mercurioMap.png"),
  venus: loader.load("./Textures/venus_map.jpg"),
  marte: loader.load("./Textures/marte.jpg"),
  jupiter: loader.load("./Textures/jupiter.jpg"),
  saturno: loader.load("./Textures/saturno.jpg"),
  urano: loader.load("./Textures/uranusMapa.jpg"),
  neptuno: loader.load("./Textures/neptunoMapa.jpg"),
};

// Anillo de saturno
const TEXTURAS_EXTRAS = {
  anillosSaturno: loader.load("./Textures/Saturn_Rings.png"),
};

// Fondo
const MILKYWAY_BACKGROUND = loader.load("./Textures/space2.jpg");

// Variable para almacenar referencias a los planetas por nombre
const planetMeshes = {};

init();
setupFreeControl();
animationLoop();

// --- CONFIGURACIÓN DE EVENTOS DE CONTROL LIBRE ---
function setupFreeControl() {
  window.addEventListener("keydown", handleKeyDown, false);
  window.addEventListener("keyup", handleKeyUp, false);

  // Añadir listener para el ratón SÓLO cuando el modo sea 'free'
  document.body.addEventListener("click", () => {
    if (
      viewMode === "free" &&
      document.pointerLockElement !== renderer.domElement
    ) {
      // Bloquear el ratón al hacer click
      renderer.domElement.requestPointerLock();
    }
  });

  document.addEventListener("pointerlockchange", onPointerLockChange, false);
  document.addEventListener("mousemove", handleMouseMove, false);
}

function onPointerLockChange() {
  if (document.pointerLockElement === renderer.domElement) {
    console.log("Control del ratón activado (Pointer Lock)");
  } else {
    if (viewMode === "free") {
      setViewMode("normal");
    }
    console.log("Control del ratón desactivado (Pointer Lock)");
  }
}

function handleKeyDown(event) {
  keyState[event.key.toLowerCase()] = true;

  // Lógica para cambiar de modo de vista (F, P)
  const key = event.key.toLowerCase();

  // Tecla 'F': Alternar entre normal y follow
  if (key === "f") {
    if (viewMode === "follow") setViewMode("normal");
    else setViewMode("follow");
  }
  // Tecla 'P': Alternar entre normal y free (P de Primera Persona)
  else if (key === "p") {
    if (viewMode === "free") setViewMode("normal");
    else setViewMode("free");
  }
  // Navegación entre objetivos en modo follow
  if (viewMode === "follow" && followableObjects.length > 0) {
    if (key === "arrowright" || key === "d") {
      followTargetIndex = (followTargetIndex + 1) % followableObjects.length;
    } else if (key === "arrowleft" || key === "a") {
      followTargetIndex =
        (followTargetIndex - 1 + followableObjects.length) %
        followableObjects.length;
    }
    updateInfoText();
  }
}

function handleKeyUp(event) {
  keyState[event.key.toLowerCase()] = false;
}

function handleMouseMove(event) {
  if (
    viewMode !== "free" ||
    document.pointerLockElement !== renderer.domElement
  )
    return;

  // Rotación del ratón (Mouselook)
  const movementX =
    event.movementX || event.mozMovementX || event.webkitMovementX || 0;
  const movementY =
    event.movementY || event.mozMovementY || event.webkitMovementY || 0;

  // Aplicar rotación
  euler.setFromQuaternion(camera.quaternion);
  euler.y -= movementX * MOUSE_SENSITIVITY;
  euler.x -= movementY * MOUSE_SENSITIVITY;

  // Limitar la rotación vertical
  euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

  camera.quaternion.setFromEuler(euler);
}

function setViewMode(newMode) {
  if (viewMode === newMode) return;

  if (newMode === "free") {
    // --- MODO LIBRE ---
    camcontrols.enabled = false;
    document.body.addEventListener("click", () => {
      if (
        viewMode === "free" &&
        document.pointerLockElement !== renderer.domElement
      ) {
        renderer.domElement.requestPointerLock();
      }
    });
    info.innerHTML += " | Click para Mouselook";
  } else {
    // --- MODO NORMAL o SEGUIMIENTO ---
    document.exitPointerLock();
    keyState = {};
    camcontrols.enabled = true;

    if (newMode === "normal") {
      camcontrols.target.set(0, 0, 0);
      if (viewMode === "free") {
        camera.position.set(0, 50, 200);
      }
      currentFollowTargetIndex = -1;
    }
  }

  viewMode = newMode;
  updateInfoText();
}

function updateInfoText() {
  const target = followableObjects[followTargetIndex];
  const targetName =
    (target && target.userData && target.userData.name) || "Sol";

  let modeText = "";
  let controlsText = "";

  // --- INFORMACIÓN EN PANTALLA ---
  switch (viewMode) {
    case "normal":
      modeText = "ORBITAL";
      controlsText =
        "Click/Arrastrar: Orbitar | Rueda: Zoom | [F] Seguir | [P] Libre";
      break;

    case "follow":
      modeText = `SEGUIMIENTO (${targetName})`;
      controlsText =
        "Click/Arrastrar: Orbitar | [A/D y/o Flechas]: Cambiar Objetivo | Rueda: Zoom | [F] Volver a orbital | [P] Libre";
      break;

    case "free":
      modeText = "LIBRE (WASD+Ratón)";
      controlsText =
        "[WASD]: Mover | [Esp/Shift]: Subir/Bajar | Click: Activar Ratón | [F] Seguir | [P] Volver a Orbital";
      break;
  }

  info.innerHTML = `Iván Pérez Díaz - Sistema Solar<br><br>Vista: ${modeText} | Controles: ${controlsText}`;
}

// --- LÓGICA DE INIT Y OBJETOS ---
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
  document.body.appendChild(info);

  scene = new THREE.Scene();
  const skyGeometry = new THREE.SphereGeometry(48000, 64, 64);
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: MILKYWAY_BACKGROUND,
    side: THREE.BackSide, // Para que la textura se vea por dentro
    color: 0x505050,
  });
  const skysphere = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(skysphere);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    60000
  );
  camera.position.set(0, 50, 200);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  camcontrols = new OrbitControls(camera, renderer.domElement);
  camcontrols.enableDamping = true;

  // Luz ambiental
  const Lamb = new THREE.AmbientLight(0xffffff, 0.03);
  scene.add(Lamb);

  // Intensidad de la luz del sol
  const Lpoint = new THREE.PointLight(0xffffff, 20000.0, 35000);
  Lpoint.position.set(0, 0, 0); // En el centro (sol)
  Lpoint.castShadow = true;
  scene.add(Lpoint);

  const degToRad = (degrees) => degrees * (Math.PI / 180);

  // --- CREACIÓN DE OBJETOS DEL SISTEMA SOLAR ---
  Estrella(60, 0xffff66, "Sol", SUN_MAP);

  const planetasData = [
    {
      name: "Mercurio",
      radio: 0.3,
      dist: 75.0,
      vel: 0.12,
      f1: 1.05,
      f2: 0.95,
      incl: degToRad(-5.0),
      texture: TEXTURAS_PLANETAS["mercurio"],
    },
    {
      name: "Venus",
      radio: 0.6,
      dist: 90.0,
      vel: 0.11,
      f1: 1.0,
      f2: 1.0,
      incl: degToRad(5.0),
      texture: TEXTURAS_PLANETAS["venus"],
    },
    {
      name: "Tierra",
      radio: 0.65,
      dist: 110.0,
      vel: 0.1,
      f1: 1.0,
      f2: 1.0,
      incl: degToRad(0.0),
      texture: EARTH_MAP,
      texbump: EARTH_BUMP,
      texspec: EARTH_SPEC,
    },
    {
      name: "Marte",
      radio: 0.45,
      dist: 130.0,
      vel: 0.09,
      f1: 1.06,
      f2: 0.94,
      incl: degToRad(3.0),
      texture: TEXTURAS_PLANETAS["marte"],
    },
    {
      name: "Júpiter",
      radio: 2.25,
      dist: 150.0,
      vel: 0.08,
      f1: 1.05,
      f2: 0.95,
      incl: degToRad(2.0),
      texture: TEXTURAS_PLANETAS["jupiter"],
    },
    {
      name: "Saturno",
      radio: 1.8,
      dist: 170.0,
      vel: 0.07,
      f1: 1.05,
      f2: 0.95,
      incl: degToRad(-4.0),
      texture: TEXTURAS_PLANETAS["saturno"],
    },
    {
      name: "Urano",
      radio: 1.2,
      dist: 190.0,
      vel: 0.05,
      f1: 1.0,
      f2: 1.0,
      incl: degToRad(6),
      texture: TEXTURAS_PLANETAS["urano"],
    },
    {
      name: "Neptuno",
      radio: 1.05,
      dist: 210.0,
      vel: 0.04,
      f1: 1.0,
      f2: 1.0,
      incl: degToRad(0.0),
      texture: TEXTURAS_PLANETAS["neptuno"],
    },
  ];

  planetasData.forEach((data) =>
    CrearPlanetaTexturizado(
      data.radio,
      data.dist,
      data.vel,
      data.f1,
      data.f2,
      data.incl,
      data.name,
      data.texture,
      data.texbump, // Si no tiene nada se pasa undefined
      data.texspec // Si no tiene nada se pasa undefined
    )
  );

  const TIERRA_RADIO = 0.65;
  let tierra_mesh = planetMeshes["Tierra"];

  if (tierra_mesh) {
    PlanetaTexturizado(
      tierra_mesh,
      0.0,
      0.0,
      0.0,
      TIERRA_RADIO * 1.03,
      40,
      40,
      0xffffff,
      CLOUD_MAP,
      undefined,
      undefined,
      CLOUD_ALPHA,
      false
    );
    Luna(tierra_mesh, 0.12, 1.5, 4.0, 0xffffff, degToRad(10.0), "Luna");
  }

  // --- AÑADIR LUNAS A PLANETAS
  let marte_mesh = planetMeshes["Marte"];
  if (marte_mesh) {
    Luna(marte_mesh, 0.1, 0.8, 3.0, 0xaaaaaa, degToRad(10), "Fobos");
    Luna(marte_mesh, 0.07, 1.2, 1.5, 0xbbbbbb, degToRad(6), "Deimos");
  }

  // Júpiter
  let jupiter_mesh = planetMeshes["Júpiter"];
  if (jupiter_mesh) {
    Luna(jupiter_mesh, 0.22, 3.5, 1.8, 0xffffcc, degToRad(20), "Ío");
    Luna(jupiter_mesh, 0.18, 5.0, 2, 0xccccff, degToRad(1.5), "Europa");
    Luna(jupiter_mesh, 0.3, 7.0, 2.2, 0xdddddd, degToRad(10), "Ganimedes");
    Luna(jupiter_mesh, 0.26, 8.5, 1.5, 0xbbbbbb, degToRad(-7), "Calisto");
  }

  // Saturno
  let saturno_mesh = planetMeshes["Saturno"];
  if (saturno_mesh) {
    Luna(saturno_mesh, 0.35, 4.0, 2, 0xffccaa, degToRad(0.8), "Titán");
    Luna(saturno_mesh, 0.15, 5.0, 2.4, 0xcccccc, degToRad(1.0), "Rea");

    const radioPlaneta = saturno_mesh.geometry.parameters.radius;
    const radioInterior = radioPlaneta + 0.8;
    const radioExterior = radioPlaneta + 1.5;

    const ringGeometry = new THREE.RingGeometry(
      radioInterior,
      radioExterior,
      64
    );

    const ringMaterial = new THREE.MeshPhongMaterial({
      map: TEXTURAS_EXTRAS.saturno_anillo,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      receiveShadow: true,
    });

    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    saturno_mesh.rotation.z = degToRad(26.7);

    ringMesh.rotation.x = Math.PI / 2;
    saturno_mesh.add(ringMesh);
  }

  // Urano
  let urano_mesh = planetMeshes["Urano"];
  if (urano_mesh) {
    Luna(urano_mesh, 0.12, 3.0, 3.0, 0xbbbbbb, degToRad(5), "Titania");
    Luna(urano_mesh, 0.11, 4.0, 4.0, 0xcccccc, degToRad(-5), "Oberón");
  }

  // Neptuno
  let neptuno_mesh = planetMeshes["Neptuno"];
  if (neptuno_mesh) {
    Luna(neptuno_mesh, 0.2, 3.0, 4.0, 0xaaddff, degToRad(157.0), "Tritón"); // Inclinación > 90
  }

  if (followableObjects.length > 0) {
    followTargetIndex = 0; // El seguimiento empezará por el Sol (índice 0)
  }

  t0 = Date.now();
  updateInfoText(); // Llamada inicial para mostrar el estado.
}

// --- FUNCIÓN PARA CREAR LOS PLANETAS CON TEXTURAS ---
function CrearPlanetaTexturizado(radio, dist, vel, f1, f2, incl, name, texture, texbump = undefined, texspec = undefined) {

  let pivoteOrbita = PivoteOrbital(dist, vel, f1, f2, incl);

  let planeta_mesh = PlanetaTexturizado(pivoteOrbita, 0, 0, 0, radio ,40, 40, 0xffffff, texture, texbump, texspec, undefined, true);

  planeta_mesh.userData.dist = dist;
  planeta_mesh.userData.speed = vel;
  planeta_mesh.userData.f1 = f1;
  planeta_mesh.userData.f2 = f2;
  planeta_mesh.userData.name = name;

  Planetas.push(planeta_mesh);
  followableObjects.push(planeta_mesh);
  planetMeshes[name] = planeta_mesh;

  return planeta_mesh;
}

// --- FUNCIONES AUXILIARES DE OBJETOS ---
function PivoteOrbital(dist, vel, f1, f2, incl) {
  let pivoteOrbita = new THREE.Object3D();
  pivoteOrbita.rotation.z = incl;
  scene.add(pivoteOrbita);

  let curve = new THREE.EllipseCurve(0, 0, dist * f1, dist * f2);
  let points = curve.getPoints(100);
  let geome = new THREE.BufferGeometry().setFromPoints(points);
  let mate = new THREE.LineBasicMaterial({ color: 0x444444 });
  let orbita = new THREE.Line(geome, mate);
  orbita.rotation.x = Math.PI / 2;
  pivoteOrbita.add(orbita);

  return pivoteOrbita;
}

function Estrella(rad, col, name, texture = undefined) {
  let geometry = new THREE.SphereGeometry(rad, 32, 32);

  let materialOptions = {};
  if (texture) {
    materialOptions.map = texture;
    materialOptions.color = 0xffffff;
  } else {
    materialOptions.color = col;
  }

  let material = new THREE.MeshBasicMaterial(materialOptions);

  estrella = new THREE.Mesh(geometry, material);
  estrella.userData.name = name;
  scene.add(estrella);
}

function PlanetaTexturizado(padre, px, py, pz, radio, nx, ny, col, texture = undefined, texbump = undefined, texspec = undefined, texalpha = undefined, sombra = false) {
  let geometry = new THREE.SphereGeometry(radio, nx, ny);

  let material = new THREE.MeshPhongMaterial({
    color: col,
    shininess: 30,
  });

  if (texture != undefined) material.map = texture;
  if (texbump != undefined) {
    material.bumpMap = texbump;
    material.bumpScale = 0.05;
  }
  if (texspec != undefined) {
    material.specularMap = texspec;
    material.specular = new THREE.Color("grey");
  }

  if (texalpha != undefined) {
    material.alphaMap = texalpha;
    material.transparent = true;
    material.side = THREE.DoubleSide;
    material.opacity = 1.0;
    material.depthWrite = false;
  }

  let mesh = new THREE.Mesh(geometry, material);

  if (sombra) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  mesh.position.set(px, py, pz);
  padre.add(mesh);

  if (
    (padre.parent === scene && padre !== estrella) ||
    padre.userData.name === "Tierra"
  ) {
    objetos.push(mesh);
  }

  return mesh;
}

function Luna(planeta, radio, dist, vel, col, angle, name) {
  var pivote = new THREE.Object3D();
  pivote.rotation.z = angle;
  planeta.add(pivote);

  let curve = new THREE.EllipseCurve(
    0,
    0,
    dist,
    dist,
    0,
    2 * Math.PI,
    false,
    0
  );

  let points = curve.getPoints(100);
  let geome = new THREE.BufferGeometry().setFromPoints(points);

  // Tono de órbita
  let mate = new THREE.LineBasicMaterial({ color: 0x333333 });

  // Crear órbita
  let orbita = new THREE.Line(geome, mate);
  orbita.rotation.x = Math.PI / 2;
  pivote.add(orbita);

  var geom = new THREE.SphereGeometry(radio, 10, 10);
  var mat = new THREE.MeshPhongMaterial({ color: col });
  var luna = new THREE.Mesh(geom, mat);

  luna.castShadow = true;
  luna.receiveShadow = true;

  luna.userData.dist = dist;
  luna.userData.speed = vel;
  luna.userData.name = name;

  Lunas.push(luna);

  pivote.add(luna);
}

function animationLoop() {
  timestamp = (Date.now() - t0) * accglobal;
  requestAnimationFrame(animationLoop);

  // --- LÓGICA DE CONTROL DE CÁMARA ---
  if (viewMode === "normal") {
    camcontrols.update();
  } else if (viewMode === "follow") {
    const target = followableObjects[followTargetIndex];

    if (target) {
      const newTargetPosition = new THREE.Vector3();
      target.getWorldPosition(newTargetPosition);

      if (followTargetIndex !== currentFollowTargetIndex) {
        // --- SALTO A UN NUEVO OBJETIVO ---
        currentFollowTargetIndex = followTargetIndex;

        // Calcular offset inicial (horizontal, a FOLLOW_DISTANCE)
        let cameraOffset;
        if (target.userData.name === "Sol") {
          cameraOffset = new THREE.Vector3(0, 5, FOLLOW_DISTANCE * 2);
        } else {
          cameraOffset = new THREE.Vector3(0, 0, FOLLOW_DISTANCE);
        }

        let followRotation = new THREE.Object3D();
        if (
          target.parent &&
          target.parent.type === "Object3D" &&
          target.parent.parent === scene &&
          target.userData.name !== "Sol"
        ) {
          followRotation.rotation.copy(target.parent.rotation);
        }
        cameraOffset.applyEuler(followRotation.rotation);

        // Movemos la cámara a la posición de seguimiento inicial
        const newCameraPosition = newTargetPosition.clone().add(cameraOffset);
        camera.position.copy(newCameraPosition);

        // Apuntamos los controles al objetivo
        camcontrols.target.copy(newTargetPosition);
      } else {
        // --- SEGUIMIENTO CONTINUO ---
        // Obtener la posición del target del fotograma ANTERIOR
        const oldTargetPosition = new THREE.Vector3();
        oldTargetPosition.copy(camcontrols.target);

        // Calcular cuánto se ha movido el target
        const delta = new THREE.Vector3();
        delta.subVectors(newTargetPosition, oldTargetPosition);

        // Mover la cámara en la misma dirección
        camera.position.add(delta);
        camcontrols.target.copy(newTargetPosition);
      }
    }
    camcontrols.update();
  } else if (viewMode === "free") {
    // Lógica de Movimiento Libre (WASD)
    const delta = 0.007;
    velocity.x = 0;
    velocity.y = 0;
    velocity.z = 0;
    if (keyState["w"]) velocity.z -= MOVE_SPEED * delta;
    if (keyState["s"]) velocity.z += MOVE_SPEED * delta;
    if (keyState["a"]) velocity.x -= MOVE_SPEED * delta;
    if (keyState["d"]) velocity.x += MOVE_SPEED * delta;
    if (keyState[" "]) velocity.y += MOVE_SPEED * delta;
    if (keyState["shift"]) velocity.y -= MOVE_SPEED * delta;
    camera.translateX(velocity.x);
    camera.translateY(velocity.y);
    camera.translateZ(velocity.z);
  }

  // --- LÓGICA DE ANIMACIÓN DEL SISTEMA SOLAR (MOVIMIENTOS ORBITALES) ---
  for (let object of objetos) {
    object.rotation.y += 0.003;
  }

  if (estrella) {
    estrella.rotation.y += 0.001;
  }

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