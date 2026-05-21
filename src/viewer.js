import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { Inspector } from 'three/addons/inspector/Inspector.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

const HDRI_NAME_PREFIXES = ['Plate', 'Cylinder'];

function usesHdri(obj) {
    return HDRI_NAME_PREFIXES.some((p) => obj.name?.startsWith(p));
}

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

    let envMap = null;
    let hdriEnabled = true;
    let hdriBackground = false;

    function applyHdri() {
        scene.environment = hdriEnabled ? envMap : null;
        scene.background = hdriEnabled && hdriBackground ? envMap : null;
    }

    new EXRLoader().load(`${import.meta.env.BASE_URL}brown_photostudio_01_4k.exr`, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        envMap = texture;
        applyHdri();
    });

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

    function frameObject(object, fill = 1.5) {
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxSize = Math.max(size.x, size.y, size.z);
        const fovV = (camera.fov * Math.PI) / 180;
        const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
        const distV = (size.y / 2) / Math.tan(fovV / 2);
        const distH = (Math.max(size.x, size.z) / 2) / Math.tan(fovH / 2);
        const distance = Math.max(distV, distH) * fill + maxSize / 2;

        const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        if (dir.lengthSq() === 0) dir.set(-0.5, 0.6, 0.7).normalize();
        camera.position.copy(center).addScaledVector(dir, distance);
        camera.near = Math.max(distance / 100, 0.01);
        camera.far = distance * 100;
        camera.updateProjectionMatrix();

        controls.target.copy(center);
        controls.minDistance = distance * 0.2;
        controls.maxDistance = distance * 4;
        controls.update();
    }

    async function loadModel(url) {
        const gltf = await loader.loadAsync(url);
        if (currentRoot) {
            scene.remove(currentRoot);
            disposeRoot(currentRoot);
        }
        gltf.scene.traverse((obj) => {
            if (!obj.isMesh) return;
            if (usesHdri(obj)) return;
            obj.material = Array.isArray(obj.material)
                ? obj.material.map(toAlbedo)
                : toAlbedo(obj.material);
        });
        gltf.scene.scale.set(5, 5, 5);
        scene.add(gltf.scene);
        currentRoot = gltf.scene;
        frameObject(gltf.scene);
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
        setHdriEnabled(v) { hdriEnabled = !!v; applyHdri(); },
        setHdriBackground(v) { hdriBackground = !!v; applyHdri(); },
        get hdriEnabled() { return hdriEnabled; },
        get hdriBackground() { return hdriBackground; },
    };
}
