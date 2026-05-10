import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { Inspector } from 'three/addons/inspector/Inspector.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createViewer() {
    const forceWebGL = !WebGPU.isAvailable();
    const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setClearColor(new THREE.Color(0x000000));
    renderer.inspector = new Inspector();
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(-8, 10, 11);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1;
    controls.maxDistance = 30;
    controls.enablePan = false;

    const loader = new GLTFLoader();
    let currentRoot = null;

    function disposeRoot(root) {
        root.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose?.();
            const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
            for (const m of mats) {
                for (const k of Object.keys(m)) {
                    const v = m[k];
                    if (v && v.isTexture) v.dispose();
                }
                m.dispose?.();
            }
        });
    }

    function toAlbedo(material) {
        const basic = new THREE.MeshBasicMaterial({
            map: material.map ?? null,
            color: material.color ? material.color.clone() : new THREE.Color(0xffffff),
            transparent: material.transparent === true,
            opacity: material.opacity ?? 1,
            alphaMap: material.alphaMap ?? null,
            alphaTest: material.alphaTest ?? 0,
            side: material.side ?? THREE.FrontSide,
            vertexColors: material.vertexColors === true,
        });
        if (material.map) material.map = null;
        if (material.alphaMap) material.alphaMap = null;
        material.dispose?.();
        return basic;
    }

    async function loadModel(url) {
        const gltf = await loader.loadAsync(url);
        if (currentRoot) {
            scene.remove(currentRoot);
            disposeRoot(currentRoot);
        }
        gltf.scene.traverse((obj) => {
            if (!obj.isMesh) return;
            obj.material = Array.isArray(obj.material)
                ? obj.material.map(toAlbedo)
                : toAlbedo(obj.material);
        });
        gltf.scene.scale.set(5, 5, 5);
        scene.add(gltf.scene);
        currentRoot = gltf.scene;
        return gltf;
    }

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    renderer.setAnimationLoop(() => renderer.render(scene, camera));

    return {
        loadModel,
        backend: forceWebGL ? 'WebGL2' : 'WebGPU',
    };
}
