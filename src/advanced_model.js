import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, renderer;
let camera;
let info;
let camcontrols;
let estrella,
  Planetas = [],
  Lunas = [];
let objetos = []; // Usado para objetos con rotación propia (planetas texturizados, nubes)
let t0 = 0;
let accglobal = 0.001;
let timestamp;

// --- VARIABLES DE CONTROL DE CÁMARA ---
let viewMode = "normal"; // Estado: 'normal', 'follow', 'free'
let followTargetIndex = 0;
let currentFollowTargetIndex = -1; // <-- ¡AÑADE ESTA LÍNEA!
let followableObjects = []; // Contiene todos los objetos que pueden ser seguidos
const FOLLOW_DISTANCE = 7; // Distancia base, se ajusta para el sol

// --- VARIABLES DE MOVIMIENTO LIBRE (WASD + MOUSELOOK) ---
let keyState = {}; // Para rastrear qué teclas están pulsadas
const velocity = new THREE.Vector3(); // Velocidad de movimiento
const MOVE_SPEED = 20; // Velocidad de desplazamiento
const MOUSE_SENSITIVITY = 0.002; // Sensibilidad del ratón
let euler = new THREE.Euler(0, 0, 0, "YXZ"); // Objeto para gestionar rotación de la cámara (Yaw, Pitch)

// --- Texturas a Cargar ---
const loader = new THREE.TextureLoader();
// Texturas de la Tierra (ya estaban)
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

const TEXTURAS_EXTRAS = {
  anillosSaturno: loader.load("./Textures/Saturn_Rings.png"),
};

// Carga de la textura del fondo
const MILKYWAY_BACKGROUND = loader.load("./Textures/space2.jpg");

// Variable para almacenar referencias a los planetas por nombre
const planetMeshes = {};

init();
setupFreeControl(); // Configuración de eventos de ratón y teclado
animationLoop();

// --- 1. CONFIGURACIÓN DE EVENTOS DE CONTROL LIBRE ---

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
    // Si el usuario presiona ESC, volvemos a 'follow' o 'normal'
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

  // Teclas de navegación A/D (solo para modo follow)
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

  // Limitar la rotación vertical (Pitch) a 180 grados
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

    // ¡CAMBIO CLAVE! Habilitamos controles para AMBOS modos
    camcontrols.enabled = true;

    if (newMode === "normal") {
      // Al volver a normal, apuntamos al Sol (origen)
      camcontrols.target.set(0, 0, 0);
      // Si venimos de modo libre, reposicionamos la cámara
      if (viewMode === "free") {
        camera.position.set(0, 50, 100);
      }
      // Invalidamos el índice para forzar el "salto" si volvemos a seguir
      currentFollowTargetIndex = -1;
    }
    // Si newMode es "follow", no hacemos nada especial aquí.
    // El "animationLoop" detectará el cambio y moverá la cámara.
  }

  viewMode = newMode;
  updateInfoText();
}

function updateInfoText() {
  const target = followableObjects[followTargetIndex];
  const targetName =
    (target && target.userData && target.userData.name) || "Sol";

  let modeText;
  if (viewMode === "normal") modeText = "NORMAL (Orbital)";
  else if (viewMode === "follow") modeText = `SEGUIMIENTO (${targetName})`;
  else if (viewMode === "free") modeText = "LIBRE (WASD+Ratón)";

  info.innerHTML = `Iván Pérez Díaz - Sistema Solar | Vista: ${modeText} | [F] Seguir / [P] Libre`;
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

  // Crear una esfera gigante (Skysphere) en lugar de scene.background
  const skyGeometry = new THREE.SphereGeometry(48000, 64, 64); // Radio 800
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: MILKYWAY_BACKGROUND,
    side: THREE.BackSide, // Para que la textura se vea por dentro
    color: 0x505050, // Color gris (50% de brillo) para atenuar la textura
  });
  const skysphere = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(skysphere);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    60000 // <-- AUMENTADO (para que quepa la skysphere de 1600)
  );
  camera.position.set(0, 80, 200);

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // Añadimos el tipo de sombra para que sean más suaves
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  camcontrols = new OrbitControls(camera, renderer.domElement);
  camcontrols.enableDamping = true;

  // Luz ambiental baja para sombras oscuras (lado oscuro)
  const Lamb = new THREE.AmbientLight(0xffffff, 0.05);
  scene.add(Lamb);

  // Intensidad de la luz del sol aumentada
  const Lpoint = new THREE.PointLight(0xffffff, 14000.0, 30000); // Intensidad 4.0
  Lpoint.position.set(0, 0, 0); // En el centro (el Sol)
  Lpoint.castShadow = true;
  scene.add(Lpoint);

  const degToRad = (degrees) => degrees * (Math.PI / 180);

  // --- Reorganizar la creación para seguir el orden del Sistema Solar ---

  // 1. Crear el Sol (se añade a followableObjects dentro de Estrella)
  Estrella(60, 0xffff66, "Sol", SUN_MAP);

  // 2. Crear Mercurio y Venus con inclinaciones y distancias/velocidades ajustadas
  const planetasInteriores = [
    {
      name: "Mercurio",
      radio: 0.3,
      dist: 75.0, // <-- CAMBIO: Más lejos
      vel: 3.0 * 0.1, // <-- CAMBIO: Velocidad reducida
      f1: 1.05,
      f2: 0.95,
      incl: degToRad(-10.0),
      texture: TEXTURAS_PLANETAS["mercurio"],
    },
    {
      name: "Venus",
      radio: 0.6,
      dist: 90.0, // <-- CAMBIO: Más lejos
      vel: 2.8 * 0.1, // <-- CAMBIO: Velocidad reducida
      f1: 1.0,
      f2: 1.0,
      incl: degToRad(5.0),
      texture: TEXTURAS_PLANETAS["venus"],
    },
  ];
  planetasInteriores.forEach((data) =>
    CrearPlanetaTexturizado(
      data.radio,
      data.dist,
      data.vel,
      data.f1,
      data.f2,
      data.incl,
      data.name,
      data.texture
    )
  );

  // 3. Crear la Tierra (inclinación 0 por ser la referencia)
  const TIERRA_RADIO = 0.65;
  const TIERRA_DIST = 110.0; // <-- CAMBIO: Más lejos
  const TIERRA_VEL = 1.6 * 0.1; // <-- CAMBIO: Velocidad reducida
  const TIERRA_INCL = degToRad(0.0); // <-- Referencia
  let tierra_pivote = PivoteOrbital(
    TIERRA_DIST,
    TIERRA_VEL,
    1.0,
    1.0,
    TIERRA_INCL
  );
  let tierra_mesh = PlanetaTexturizado(
    tierra_pivote,
    0,
    0,
    0,
    TIERRA_RADIO,
    40,
    40,
    0xffffff,
    EARTH_MAP,
    EARTH_BUMP,
    EARTH_SPEC,
    undefined,
    true
  );
  tierra_mesh.userData.dist = TIERRA_DIST;
  tierra_mesh.userData.speed = TIERRA_VEL;
  tierra_mesh.userData.f1 = 1.0;
  tierra_mesh.userData.f2 = 1.0;
  tierra_mesh.userData.name = "Tierra";
  Planetas.push(tierra_mesh);
  followableObjects.push(tierra_mesh); // <-- Tierra añadida en orden
  planetMeshes["Tierra"] = tierra_mesh; // Guardar referencia

  // Nubes y Luna de la Tierra (con inclinación lunar más notoria)
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

  // 4. Crear el resto de planetas con inclinaciones y distancias/velocidades ajustadas
  const planetasExteriores = [
    {
      name: "Marte",
      radio: 0.45,
      dist: 130.0, // <-- CAMBIO: Más lejos
      vel: 1.6 * 0.1, // <-- CAMBIO: Velocidad reducida
      f1: 1.06,
      f2: 0.94,
      incl: degToRad(3.0),
      texture: TEXTURAS_PLANETAS["marte"],
    },
    {
      name: "Júpiter",
      radio: 2.25,
      dist: 150.0, // <-- CAMBIO: Más lejos
      vel: 0.9 * 0.1, // <-- CAMBIO: Velocidad reducida
      f1: 1.05,
      f2: 0.95,
      incl: degToRad(2.0),
      texture: TEXTURAS_PLANETAS["jupiter"],
    },
    {
      // Saturno, Urano y Neptuno mantienen distancias pero reducen velocidad
      name: "Saturno",
      radio: 1.8,
      dist: 170.0, // <-- CAMBIO: Más lejos que Júpiter
      vel: 0.7 * 0.1, // <-- CAMBIO: Velocidad reducida
      f1: 1.05,
      f2: 0.95,
      incl: degToRad(-4.0),
      texture: TEXTURAS_PLANETAS["saturno"],
    },
    {
      name: "Urano",
      radio: -1.2,
      dist: 190.0, // <-- CAMBIO: Más lejos que Saturno
      vel: 0.5 * 0.1, // <-- CAMBIO: Velocidad reducida
      f1: 1.0,
      f2: 1.0,
      incl: degToRad(-6),
      texture: TEXTURAS_PLANETAS["urano"],
    },
    {
      name: "Neptuno",
      radio: 1.05,
      dist: 210.0, // <-- CAMBIO: Más lejos que Urano
      vel: 0.4 * 0.1, // <-- CAMBIO: Velocidad reducida
      f1: 1.0,
      f2: 1.0,
      incl: degToRad(0.0),
      texture: TEXTURAS_PLANETAS["neptuno"],
    },
  ];
  planetasExteriores.forEach((data) =>
    CrearPlanetaTexturizado(
      data.radio,
      data.dist,
      data.vel,
      data.f1,
      data.f2,
      data.incl,
      data.name,
      data.texture
    )
  );

  // --- Añadir Lunas a los planetas correspondientes (con inclinaciones más notorias) ---
  // Marte
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
    const radioInterior = radioPlaneta + 0.8; // Un pequeño espacio (1.8 + 0.4 = 2.2)
    const radioExterior = radioPlaneta + 1.5; // Ancho de los anillos (1.8 + 2.0 = 3.8)

    const ringGeometry = new THREE.RingGeometry(
      radioInterior, // Radio interno
      radioExterior, // Radio externo
      64 // Segmentos (para que sea circular)
    );

    // Asegúrate de haber cargado la textura en TEXTURAS_EXTRAS
    const ringMaterial = new THREE.MeshPhongMaterial({
      map: TEXTURAS_EXTRAS.saturno_anillo,
      side: THREE.DoubleSide, // Importante: Para que el anillo se vea por arriba y por abajo
      transparent: true, // Habilita la transparencia del PNG
      opacity: 0.9, // Una ligera opacidad general (opcional)
      receiveShadow: true, // El anillo recibe la sombra del planeta
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

// --- NUEVA FUNCIÓN AUXILIAR PARA CREAR PLANETAS TEXTURIZADOS ---
function CrearPlanetaTexturizado(
  radio,
  dist,
  vel,
  f1,
  f2,
  incl,
  name,
  texture
) {
  let pivoteOrbita = PivoteOrbital(dist, vel, f1, f2, incl);

  let planeta_mesh = PlanetaTexturizado(
    pivoteOrbita,
    0,
    0,
    0,
    radio,
    40,
    40,
    0xffffff,
    texture,
    undefined,
    undefined,
    undefined,
    true // Sombra activada
  );

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
    materialOptions.color = 0xffffff; // Tono blanco para máximo brillo
  } else {
    materialOptions.color = col;
  }

  let material = new THREE.MeshBasicMaterial(materialOptions);

  estrella = new THREE.Mesh(geometry, material);
  estrella.userData.name = name;
  // followableObjects.push(estrella); // <-- Sol añadido primero a la lista
  scene.add(estrella);
}

// Esta función Planeta ya no se usa directamente
function Planeta(radio, dist, vel, col, f1, f2, incl, name) {
  // ... (código sin cambios)
}

function PlanetaTexturizado(
  padre,
  px,
  py,
  pz,
  radio,
  nx,
  ny,
  col,
  texture = undefined,
  texbump = undefined,
  texspec = undefined,
  texalpha = undefined,
  sombra = false
) {
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

  // Añadimos el mesh a 'objetos' solo si es un planeta principal o las nubes de la Tierra
  // Esto es para que solo estos roten, no los pivotes
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

  // ==================================================
  // --- 🛰️ AÑADIR ÓRBITA DE LA LUNA ---
  // ==================================================

  // 1. Crear la curva (un círculo simple, usando EllipseCurve)
  let curve = new THREE.EllipseCurve(
    0,
    0, // Centro
    dist,
    dist, // dist es el radio en x e y (es un círculo)
    0,
    2 * Math.PI, // Ángulo completo
    false,
    0
  );

  // 2. Obtener puntos de la curva
  let points = curve.getPoints(50); // 50 puntos es suficiente
  let geome = new THREE.BufferGeometry().setFromPoints(points);

  // 3. Crear el material (¡"muy clarito"!)
  // Usamos 0x333333, que es un gris más oscuro/tenue que el 0x444444 de los planetas
  // Si lo quieres AÚN más clarito (casi invisible), prueba 0x222222
  let mate = new THREE.LineBasicMaterial({ color: 0x333333 });

  // 4. Crear la línea
  let orbita = new THREE.Line(geome, mate);

  // 5. Rotar la órbita para que esté en el plano XZ (como la de los planetas)
  orbita.rotation.x = Math.PI / 2;

  // 6. Añadir la órbita al pivote
  // (Esto es importante para que la órbita también se incline con el 'angle')
  pivote.add(orbita);

  // ==================================================
  // --- FIN DE LA ÓRBITA ---
  // ==================================================

  var geom = new THREE.SphereGeometry(radio, 10, 10);
  var mat = new THREE.MeshPhongMaterial({ color: col });
  var luna = new THREE.Mesh(geom, mat);

  luna.castShadow = true;
  luna.receiveShadow = true;

  luna.userData.dist = dist;
  luna.userData.speed = vel;
  luna.userData.name = name;

  Lunas.push(luna);

  // Añadimos la luna al mismo pivote
  pivote.add(luna);
}

function animationLoop() {
  timestamp = (Date.now() - t0) * accglobal;
  requestAnimationFrame(animationLoop);

  // ======================================================
  // --- 1. LÓGICA DE CÁMARA (VERSIÓN CORREGIDA) ---
  // ======================================================

  if (viewMode === "normal") {
    // Modo normal: el target es (0,0,0)
    camcontrols.update();
  } else if (viewMode === "follow") {
    const target = followableObjects[followTargetIndex];

    if (target) {
      // Obtenemos la NUEVA posición del planeta en este fotograma
      const newTargetPosition = new THREE.Vector3();
      target.getWorldPosition(newTargetPosition);

      // Detectar si el objetivo ha cambiado (teclas A/D)
      if (followTargetIndex !== currentFollowTargetIndex) {
        // --- 1. SALTO A UN NUEVO OBJETIVO ---
        currentFollowTargetIndex = followTargetIndex; // Actualizar el índice

        // Calcular offset inicial (horizontal, a FOLLOW_DISTANCE)
        let cameraOffset;
        if (target.userData.name === "Sol") {
          cameraOffset = new THREE.Vector3(0, 5, FOLLOW_DISTANCE * 2);
        } else {
          cameraOffset = new THREE.Vector3(0, 0, FOLLOW_DISTANCE);
        }

        // (Aplicamos la rotación del pivote del planeta)
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
        // --- 2. SEGUIMIENTO CONTINUO (¡LA LÓGICA CLAVE!) ---

        // Obtenemos la posición del target del fotograma ANTERIOR
        const oldTargetPosition = new THREE.Vector3();
        oldTargetPosition.copy(camcontrols.target);

        // Calculamos el 'delta' (cuánto se movió el planeta)
        const delta = new THREE.Vector3();
        delta.subVectors(newTargetPosition, oldTargetPosition);

        // ¡Movemos la cámara esa misma cantidad!
        camera.position.add(delta);

        // Y actualizamos el 'target' de los controles a la nueva posición
        camcontrols.target.copy(newTargetPosition);
      }
    }

    // Actualizamos los controles (esto aplica el zoom y la órbita del ratón)
    camcontrols.update();
  } else if (viewMode === "free") {
    // Lógica de Movimiento Libre (WASD) - SIN CAMBIOS
    const delta = 1 / 60;
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

  // 2. LÓGICA DE ANIMACIÓN DEL SISTEMA SOLAR
  // Rotación de los planetas texturizados (Tierra, Nubes, y todos los que se añadan a 'objetos')
  for (let object of objetos) {
    object.rotation.y += 0.003; // Rotación propia
  }

  // Rotación del sol sobre sí mismo
  if (estrella) {
    estrella.rotation.y += 0.001;
  }

  // Movimiento orbital de los Planetas (NO cambia, se mueven en XZ relativo a su pivote inclinado)
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

  // Movimiento orbital de las Lunas (NO cambia, se mueven en XZ relativo a su pivote inclinado)
  for (let object of Lunas) {
    object.position.x =
      Math.cos(timestamp * object.userData.speed) * object.userData.dist;
    object.position.z =
      Math.sin(timestamp * object.userData.speed) * object.userData.dist;
  }

  renderer.render(scene, camera);
}
