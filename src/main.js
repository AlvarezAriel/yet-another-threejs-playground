import * as THREE from 'three/webgpu';
import {Inspector} from 'three/addons/inspector/Inspector.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {LightProbeGenerator} from 'three/addons/lights/LightProbeGenerator.js';
import {LightProbeHelper} from 'three/addons/helpers/LightProbeHelperGPU.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let renderer, scene, camera;

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
    renderer.toneMapping = THREE.NoToneMapping;

    // scene
    scene = new THREE.Scene();

    // camera
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 0, 4);

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;
    controls.maxDistance = 30;
    controls.enablePan = false;

    // probe
    lightProbe = new THREE.LightProbe();
    scene.add(lightProbe);

    // light
    directionalLight = new THREE.DirectionalLight(0xffffff, API.directionalLightIntensity);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    // envmap
    const genCubeUrls = function (prefix, postfix) {

        return [
            prefix + 'px' + postfix, prefix + 'nx' + postfix,
            prefix + 'py' + postfix, prefix + 'ny' + postfix,
            prefix + 'pz' + postfix, prefix + 'nz' + postfix
        ];

    };

    const urls = genCubeUrls('pisa/', '.png');

    new THREE.CubeTextureLoader().load(urls, function (cubeTexture) {

        scene.background = cubeTexture;

        lightProbe.copy(LightProbeGenerator.fromCubeTexture(cubeTexture));
        lightProbe.intensity = API.lightProbeIntensity;
        lightProbe.position.set(-10, 0, 0); // position not used in scene lighting calculations (helper honors the position, however)

        loader.load( 'sandwich.glb', function ( gltf ) {
            gltf.scene.scale.set(10, 10, 10);
            console.error( gltf.scene );
            meshes = gltf.scene.children;

            scene.add( gltf.scene );

            for(let i = 0; i < meshes.length; ++i) {
                let mesh = meshes[i];
                mesh.material.envMap = cubeTexture;
                mesh.material.envMapIntensity = API.envMapIntensity;
            }
        }, undefined, function ( error ) {
            console.error( error );
        } );

        // helper
        const helper = new LightProbeHelper(lightProbe, 1);
        scene.add(helper);

    });


    // gui
    gui = renderer.inspector.createParameters('Intensity');

    gui.add(API, 'lightProbeIntensity', 0, 1, 0.02)
        .name('light probe')
        .onChange(function () {

            lightProbe.intensity = API.lightProbeIntensity;

        });

    gui.add(API, 'directionalLightIntensity', 0, 1, 0.02)
        .name('directional light')
        .onChange(function () {

            directionalLight.intensity = API.directionalLightIntensity;

        });

    gui.add(API, 'envMapIntensity', 0, 1, 0.02)
        .name('envMap')
        .onChange(function () {

            for(let i = 0; i < meshes.length; ++i) {
                let mesh = meshes[i];
                console.log(mesh);
                mesh.material.envMapIntensity = API.envMapIntensity;
            }
        });

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
