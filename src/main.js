import * as THREE from 'three/webgpu';
import { Inspector } from 'three/addons/inspector/Inspector.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let renderer, scene, camera;

const basePath = "/yet-another-threejs-playground";

// 🔹 Lista de modelos
const models = {
    RolCanela: basePath + '/RolCanela.glb',
    Sushi: basePath + '/sushi_boat_nigiri.glb',
    platoUnlit: basePath + '/270326_Unlit.glb'
};

let gui;

let meshes = [];
let currentModel = null;

// 🔹 Estado UI
const params = {
    model: 'RolCanela'
};

const loader = new GLTFLoader();

init();

function init() {

    // renderer
    renderer = new THREE.WebGPURenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.inspector = new Inspector();
    document.body.appendChild(renderer.domElement);

    // tone mapping
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setClearColor(new THREE.Color(0x000000));

    // scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#f5f5f5');

    // camera
    camera = new THREE.PerspectiveCamera(4, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 20, 0);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 10;
    controls.maxDistance = 25;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2.2;

    // 🔹 GUI
    gui = renderer.inspector.createParameters('Scene');

    gui.add(params, 'model', Object.keys(models))
        .name('Modelo')
        .onChange((value) => {
            loadModel(value);
        });

    // 🔹 cargar modelo inicial
    loadModel(params.model);

    // resize
    window.addEventListener('resize', onWindowResize);
}

// 🔹 función principal
function loadModel(name) {

    const path = models[name];

    loader.load(path, function (gltf) {

        // eliminar modelo anterior
        if (currentModel) {
            disposeModel(currentModel);
            scene.remove(currentModel);
        }

        currentModel = gltf.scene;

        // normalización básica
        currentModel.scale.set(5, 5, 5);
        currentModel.position.set(0, 0, 0);

        meshes = currentModel.children;

        scene.add(currentModel);

    }, undefined, function (error) {
        console.error(error);
    });

}

// 🔹 limpieza de memoria
function disposeModel(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            child.geometry.dispose();

            if (child.material.map) child.material.map.dispose();

            child.material.dispose();
        }
    });
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function animate() {
    renderer.render(scene, camera);
}