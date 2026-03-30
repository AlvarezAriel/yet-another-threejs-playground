import * as THREE from 'three/webgpu';
import {Inspector} from 'three/addons/inspector/Inspector.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LightProbeGenerator} from 'three/addons/lights/LightProbeGenerator.js';
import {LightProbeHelper} from 'three/addons/helpers/LightProbeHelperGPU.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let renderer, scene, camera;

const basePath = "/yet-another-threejs-playground"

let gui;

let lightProbe;
let directionalLight;

// linear color space
const API = {
    lightProbeIntensity: 1.0,
    directionalLightIntensity: 0.6,
    envMapIntensity: 1
};

let meshes = [];

const loader = new GLTFLoader();

init();

function init() {

    // renderer
    renderer = new THREE.WebGPURenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.inspector = new Inspector();
    document.body.appendChild(renderer.domElement);

    // tone mapping
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setClearColor(new THREE.Color( 0x000000 ))

    // scene
    scene = new THREE.Scene();

    // camera
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(-8, 10, 11);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;
    controls.maxDistance = 30;
    controls.enablePan = false;

    // probe
    // light
    // directionalLight = new THREE.DirectionalLight(0xffffff, API.directionalLightIntensity);
    // directionalLight.position.set(10, 10, 10);
    // scene.add(directionalLight);

    loader.load( basePath + '/RolCanela.glb', function ( gltf ) {
        gltf.scene.scale.set(5, 5, 5);
        console.error( gltf.scene );
        meshes = gltf.scene.children;

        scene.add( gltf.scene );
    }, undefined, function ( error ) {
        console.error( error );
    } );

    // helper
    // const helper = new LightProbeHelper(lightProbe, 1);
    // scene.add(helper);

    // gui
    gui = renderer.inspector.createParameters('Intensity');

    // gui.add(API, 'directionalLightIntensity', 0, 1, 0.02)
    //     .name('directional light')
    //     .onChange(function () {
    //
    //         directionalLight.intensity = API.directionalLightIntensity;
    //
    //     });


    // listener
    window.addEventListener('resize', onWindowResize);

}

function onWindowResize() {

    renderer.setSize(window.innerWidth, window.innerHeight);

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();


}

function animate() {
    renderer.render(scene, camera);
}
