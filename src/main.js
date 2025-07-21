import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DragControls } from 'three/examples/jsm/controls/DragControls.js';
import GUI from 'lil-gui';
import Stats from 'stats.js';

const stats = new Stats();
stats.showPanel(0);
stats.dom.style.position = 'absolute';
stats.dom.style.top = '';
stats.dom.style.bottom = '0px';
stats.dom.style.left = '0px';
document.body.appendChild(stats.dom);

var propagacion = false; 
let isAnimating = false;

class PhysicalObject {
  constructor({ color = 0xffffff, mass = 1, charge = 1, position = { x: 0, y: 0, z: 0 } } = {}) {
    this.color = color;
    this.mass = mass;
    this.charge = charge;

    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshToonMaterial({ color});
    this.mesh = new THREE.Mesh(geometry, material);

    this.mesh.scale.set(mass, mass, mass);
    this.mesh.position.set(position.x, position.y, position.z);
  }

  addToScene(scene, draggableObjects) {
    scene.add(this.mesh);
    draggableObjects.push(this.mesh);
    updateField(this);
  }

  duplicate(offset = { x: 1, y: 1, z: 1 }) {
    return new PhysicalObject({
      color: this.mesh.material.color.getHex(),
      mass: this.mesh.scale.x,
      charge: this.charge,
      position: {
        x: this.mesh.position.x + offset.x,
        y: this.mesh.position.y + offset.y,
        z: this.mesh.position.z + offset.z,
      }
    });
  }

  setColor(hex) {
    this.mesh.material.color.set(hex);
  }

  setMass(s) {
    this.mass = s;
    this.mesh.scale.set(s, s, s);
  }

  setCharge(q) {
    this.charge = q;
  }
}

const meshToPhysicalObject = new Map();
const scene = new THREE.Scene();
scene.background = new THREE.Color('black');
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 0, 10);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.1;
const draggableObjects = [];
var currentclickedObject = null;
const dragControls = new DragControls(draggableObjects, camera, renderer.domElement);
dragControls.addEventListener('dragstart', (e) => {
  orbit.enabled = false
  var physicalObjectDragged= meshToPhysicalObject.get(e.object);
  updateField(physicalObjectDragged);
});
dragControls.addEventListener('drag', (e) => {
  updateField(null);
});
dragControls.addEventListener('dragend', (e) => {
  orbit.enabled = true;
  var physicalObjectDragged= meshToPhysicalObject.get(e.object);
  updateField(physicalObjectDragged);
});
const hoverLight = 0.2;
dragControls.addEventListener('hoveron', (event) => {
const color = event.object.material.color;
const hsl = new THREE.Color(color.r, color.g, color.b).getHSL(new THREE.Color());
event.object.material.color.setHSL(hsl.h, hsl.s, hsl.l + hoverLight);
});
dragControls.addEventListener('hoveroff', (event) => {
const color = event.object.material.color;
const hsl = new THREE.Color(color.r, color.g, color.b).getHSL(new THREE.Color());
event.object.material.color.setHSL(hsl.h, hsl.s, hsl.l - hoverLight);
});
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let mouseDownPos = new THREE.Vector2();
let time = 0;

window.addEventListener('mousedown', (event) => {
  mouseDownPos.set(event.clientX, event.clientY);
  time = performance.now();
  const panel = document.getElementById('configPanel');
  if (panel.style.display === 'none') return;
  if (panel.contains(event.target)) return;
  panel.style.display = 'none'; 
});

window.addEventListener('mouseup', (event) => {
const dx = event.clientX - mouseDownPos.x;
const dy = event.clientY - mouseDownPos.y;
const dt = performance.now() - time;
const distance = Math.sqrt(dx * dx + dy * dy);

if (distance < 10 && dt < 200) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(draggableObjects);

  if (intersects.length > 0) {
    const selected = intersects[0].object;
    const object = meshToPhysicalObject.get(selected);
    currentclickedObject = object;

    const panel = document.getElementById('configPanel');
    panel.style.display = 'flex';

    const scaleMassInput = document.getElementById('scaleMassInput');
    const scaleMassOutput = document.getElementById('scaleMassOutput');
    scaleMassInput.value = selected.scale.x.toFixed(1);
    const s = parseFloat(scaleMassInput.value);
    object.setMass(s);
    scaleMassOutput.innerHTML = `<span>${s.toFixed(1)}</span><small> kg</small>`;
    scaleMassInput.oninput = () => {
      const s = parseFloat(scaleMassInput.value);
      object.setMass(s);
      scaleMassOutput.innerHTML = `<span>${s.toFixed(1)}</span><small> kg</small>`;
    };

    const scaleChargeInput = document.getElementById('scaleChargeInput');
    const scaleChargeOutput = document.getElementById('scaleChargeOutput');
    scaleChargeInput.value = object.charge.toFixed(1);
    scaleChargeOutput.innerHTML = `<span>${object.charge.toFixed(1)}</span><small> μC</small>`;
    scaleChargeInput.oninput = () => {
      const q = parseFloat(scaleChargeInput.value);
      object.setCharge(q);
      scaleChargeOutput.innerHTML = `<span>${q.toFixed(1)}</span><small> μC</small>`;
      updateField(object);
    };

    document.getElementById('deleteBtn').onclick = () => {
      scene.remove(selected);
      draggableObjects.splice(draggableObjects.indexOf(selected), 1);
      meshToPhysicalObject.delete(selected);
      panel.style.display = 'none';
      updateField(null);
    }

    document.getElementById('duplicateBtn').onclick = () => {
      const newObj = object.duplicate({ x: Math.random() * 4 - 1, y: Math.random() * 4 - 1, z: Math.random() * 4 - 1});
      newObj.addToScene(scene, draggableObjects);
      meshToPhysicalObject.set(newObj.mesh, newObj);
      updateField(newObj);
    };
  }
}
});

function modificateCoordinatesByInput(){
  const coordinatesInputs = document.querySelectorAll('.coordinateInput');
  coordinatesInputs.forEach((input, index) => {
  input.addEventListener('input', () => {
    if (currentclickedObject) {
      var value = parseFloat(input.value);
      if (isNaN(value)) {
        value = 0;
      }
      switch (index) {
        case 0:
          currentclickedObject.mesh.position.x = value;
          break;
        case 1:
          currentclickedObject.mesh.position.y = value;
          break;
        case 2:
          currentclickedObject.mesh.position.z = value;
          break;
      }
      updateField(null);
    }
  });
  });
}

modificateCoordinatesByInput();

const gui = new GUI({ title: "Controles" });
gui.domElement.style.position = 'absolute';
gui.domElement.style.top = '1em';
gui.domElement.style.left = '1em';
gui.domElement.style.background = 'transparent';

const settings = {
  addSphere: () => {
    const obj = new PhysicalObject({
      color: Math.random() * 0xffffff,
      position: {
        x: Math.random() * 4 - 2,
        y: Math.random() * 4 - 2,
        z: Math.random() * 4 - 2
      }
    });
    obj.addToScene(scene, draggableObjects);
    meshToPhysicalObject.set(obj.mesh, obj);
  },
  play: () => {
    isAnimating = !isAnimating;
    playBtn.innerText = isAnimating ? 'Detener' : 'Animar';
    playBtn.style.background = isAnimating ? '#fcba03' : '#4CAF50';
  },
  sliderValue: 20,
  propagation: false
};

gui.add(settings, 'addSphere').name('Agregar esfera');
const play = gui.add(settings, 'play').name('Animar');
gui.add(settings, 'sliderValue', 10, 50).step(1).name('Tamaño de campo')
  .onChange(() => {
    generateGroundFieldArrows();
  });

const playBtn = play.domElement.querySelector('button');
playBtn.style.background = '#4CAF50';
playBtn.style.color = 'black';
gui.add(settings, 'propagation').name('Propagación').onChange((value) => {
  propagacion = value;
});

const MIN_DISTANCE = 0.5;
const SOFTENING = 0.5;
const MAX_SPEED = 500.0;

function updateChargesMotion(deltaTime) {
  const forces = new Map();
  for (const mesh of draggableObjects) {
    forces.set(mesh, new THREE.Vector3());
  }
  for (let i = 0; i < draggableObjects.length; i++) {
    for (let j = i + 1; j < draggableObjects.length; j++) {
      const meshA = draggableObjects[i];
      const meshB = draggableObjects[j];
      const objA = meshToPhysicalObject.get(meshA);
      const objB = meshToPhysicalObject.get(meshB);

      const posA = meshA.position.clone();
      const posB = meshB.position.clone();

      const r = new THREE.Vector3().subVectors(posB, posA);
      let distance = r.length();

      if (distance < MIN_DISTANCE) {
        const correction = r.clone().normalize().multiplyScalar((MIN_DISTANCE - distance) * 0.5);
        meshA.position.sub(correction);
        meshB.position.add(correction);
        distance = MIN_DISTANCE;
      }

      const distanceSq = distance * distance + SOFTENING;
      const forceMagnitude = (objA.charge * objB.charge) / distanceSq;
      const forceDirection = r.normalize();
      const force = forceDirection.clone().multiplyScalar(forceMagnitude);

      forces.get(meshA).add(force.clone().negate());
      forces.get(meshB).add(force);
    }
  }
  for (const mesh of draggableObjects) {
    const obj = meshToPhysicalObject.get(mesh);
    const mass = obj.mass || 1;
    let acceleration = forces.get(mesh).clone().divideScalar(mass);
    const speed = acceleration.length();
    if (speed > MAX_SPEED) {
      acceleration.normalize().multiplyScalar(MAX_SPEED);
    }
    const displacement = acceleration.multiplyScalar(deltaTime * 0.1);
    mesh.position.add(displacement);
  }
}

for (const mesh of draggableObjects) {
  const obj = meshToPhysicalObject.get(mesh);
  const mass = obj.mass || 1;
  const acceleration = forces.get(mesh).clone().divideScalar(mass);
  mesh.position.add(acceleration.multiplyScalar(deltaTime));
}

let lastTime = performance.now();

function animate() {
  stats.begin();
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) * 0.001;
  lastTime = currentTime;
  if (isAnimating) {
    updateChargesMotion(deltaTime);
    updateField();
  }
  orbit.update();
  renderer.render(scene, camera);
  stats.end();
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
renderer.setSize(innerWidth, innerHeight);
});

const fieldVectorMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00,  opacity: 0.4, transparent: true });
const fieldVectors = [];
function addFieldVector(position, direction) {
const start = position.clone();
const end = position.clone().add(direction);
const points = [start, end];
const geometry = new THREE.BufferGeometry().setFromPoints(points);
const line = new THREE.Line(geometry, fieldVectorMaterial);
scene.add(line);
fieldVectors.push(line);
}

const step = .5;
function generateGroundFieldArrows() {
  for (const vec of fieldVectors) {
    scene.remove(vec);
  }
  fieldVectors.length = 0;
  const fieldMatrixSize = settings.sliderValue;
  for (let k = -fieldMatrixSize/2; k < fieldMatrixSize/2; k++) {
    for (let i = -fieldMatrixSize/2; i < fieldMatrixSize/2; i++) {
      const position = new THREE.Vector3(
        i * step, 0, k * step
      );
      const direction = new THREE.Vector3(
        0,1,0
      ).normalize().multiplyScalar(step);
      addFieldVector(position, direction);
    }
  }
}

generateGroundFieldArrows();

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7.5);
scene.add(light);

function modificateFieldVectorDirection(i,k, direction) {
  const fieldMatrixSize = settings.sliderValue;
  const index = i + (fieldMatrixSize *k);
  if (index < 0 || index >= fieldVectors.length) {
    console.warn('Index out of bounds:', index);
    return;
  }
  const line = fieldVectors[index];
  const geometry = line.geometry;
  const positions = geometry.attributes.position.array;
  direction = direction.clone().normalize().multiplyScalar(step);
  positions[3] = positions[0] + direction.x;
  positions[4] = positions[1] + direction.y;
  positions[5] = positions[2] + direction.z;
  geometry.attributes.position.needsUpdate = true;
} 

function updateField(physicalObject = null) {
  const fieldMatrixSize = settings.sliderValue;
  for (let k = 0; k < fieldMatrixSize; k++) {
    for (let i = 0; i < fieldMatrixSize; i++) {
      const index = i + (fieldMatrixSize * k);
      const line = fieldVectors[index];
      const geometry = line.geometry;
      const positions = geometry.attributes.position.array;
      const fieldPoint = new THREE.Vector3(positions[0], positions[1], positions[2]);
      const totalField = new THREE.Vector3();
      draggableObjects.forEach((obj) => {
        const physicalObject = meshToPhysicalObject.get(obj);
        if (physicalObject) {
          const charge = physicalObject.charge || 0;
          const chargePos = physicalObject.mesh.position;
          const r = fieldPoint.clone().sub(chargePos);
          const distanceSquared = r.lengthSq();
          if (distanceSquared > 1e-4) {
            const fieldContribution = r.normalize().multiplyScalar(charge / distanceSquared);
            totalField.add(fieldContribution);
          }
        }
      });
      const direction = totalField.normalize().multiplyScalar(step);
      if (!propagacion) {
        modificateFieldVectorDirection(i, k, direction);
      } else {
        const delay = fieldPoint.length() * 40;
        if (!geometry.attributes.position.needsUpdate) {
          setTimeout(() => {
            modificateFieldVectorDirection(i, k, direction);
          }, delay);
        } else {
          modificateFieldVectorDirection(i, k, direction);
        }
      }
    }
  }
  if (physicalObject) {
    updateCoordinatesInputs(physicalObject);
  }
}

function updateCoordinatesInputs(figure) {
const coordinatesInputs = document.querySelectorAll('.coordinateInput');
coordinatesInputs.forEach((input, index) => {
  switch (index) {
    case 0:
      input.value = figure.mesh.position.x.toFixed(2);
      break;
    case 1:
      input.value = figure.mesh.position.y.toFixed(2);
      break;
    case 2:
      input.value = figure.mesh.position.z.toFixed(2);
      break;
  }
});

}

const axesHelper = new THREE.AxesHelper( 5 );
scene.add( axesHelper );