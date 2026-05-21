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

function isMobile() {
    return typeof window !== 'undefined'
        && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
}

export function createViewer() {
    const forceWebGL = !WebGPU.isAvailable();
    const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setClearColor(new THREE.Color(0x000000));
    if (!isMobile()) renderer.inspector = new Inspector();
    document.body.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    let envMap = null;
    let hdriEnabled = true;
    let hdriBackground = false;
    let hdriAffectsAll = false;

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
    controls.enableRotate = false;
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: null };
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };

    const ROTATE_SPEED = 0.006;
    const WORLD_UP = new THREE.Vector3(0, 1, 0);
    const MAX_TILT = (80 * Math.PI) / 180;
    const MIN_TILT = -0.5;

    let modelYaw = 0;
    let modelTilt = 0;
    let lastYaw = 0;
    let lastTilt = 0;
    let yawVel = 0;
    let tiltVel = 0;
    const INERTIA_DECAY = 0.88;
    const INERTIA_EPSILON = 0.00005;
    const tiltAxis = new THREE.Vector3(1, 0, 0);
    const qYaw = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();

    function applyModelOrientation() {
        if (!currentRoot) return;
        qYaw.setFromAxisAngle(WORLD_UP, modelYaw);
        qTilt.setFromAxisAngle(tiltAxis, modelTilt);
        currentRoot.quaternion.multiplyQuaternions(qTilt, qYaw);
    }

    function updateInertia() {
        if (!currentRoot) return;
        if (canvasPointer.id !== null) {
            yawVel = modelYaw - lastYaw;
            tiltVel = modelTilt - lastTilt;
            lastYaw = modelYaw;
            lastTilt = modelTilt;
            return;
        }
        if (Math.abs(yawVel) < INERTIA_EPSILON && Math.abs(tiltVel) < INERTIA_EPSILON) {
            lastYaw = modelYaw;
            lastTilt = modelTilt;
            return;
        }
        modelYaw += yawVel;
        const nextTilt = Math.max(MIN_TILT, Math.min(MAX_TILT, modelTilt + tiltVel));
        if (nextTilt === MAX_TILT || nextTilt === MIN_TILT) tiltVel = 0;
        modelTilt = nextTilt;
        yawVel *= INERTIA_DECAY;
        tiltVel *= INERTIA_DECAY;
        lastYaw = modelYaw;
        lastTilt = modelTilt;
        applyModelOrientation();
    }

    const canvasPointer = { id: null, x: 0, y: 0 };
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.addEventListener('pointerdown', (e) => {
        if (!currentRoot || canvasPointer.id !== null) return;
        canvasPointer.id = e.pointerId;
        canvasPointer.x = e.clientX;
        canvasPointer.y = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', (e) => {
        if (e.pointerId !== canvasPointer.id || !currentRoot) return;
        const dx = e.clientX - canvasPointer.x;
        const dy = e.clientY - canvasPointer.y;
        canvasPointer.x = e.clientX;
        canvasPointer.y = e.clientY;
        modelYaw += dx * ROTATE_SPEED;
        modelTilt = Math.max(MIN_TILT, Math.min(MAX_TILT, modelTilt + dy * ROTATE_SPEED));
        applyModelOrientation();
    });
    const endCanvasDrag = (e) => {
        if (e.pointerId !== canvasPointer.id) return;
        canvasPointer.id = null;
        renderer.domElement.releasePointerCapture?.(e.pointerId);
    };
    renderer.domElement.addEventListener('pointerup', endCanvasDrag);
    renderer.domElement.addEventListener('pointercancel', endCanvasDrag);

    let hdriYaw = 0;
    function rotateCameraBy(dx) {
        hdriYaw -= dx * ROTATE_SPEED;
        scene.backgroundRotation.y = hdriYaw;
        scene.environmentRotation.y = hdriYaw;
    }

    const loader = new GLTFLoader();
    let currentRoot = null;

    function disposeRoot(root) {
        const textures = new Set();
        const materials = new Set();
        root.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose?.();
            const collect = (m) => { if (m) materials.add(m); };
            if (Array.isArray(obj.material)) obj.material.forEach(collect); else collect(obj.material);
            if (obj.userData.pbrMaterial) (Array.isArray(obj.userData.pbrMaterial) ? obj.userData.pbrMaterial : [obj.userData.pbrMaterial]).forEach(collect);
            if (obj.userData.basicMaterial) (Array.isArray(obj.userData.basicMaterial) ? obj.userData.basicMaterial : [obj.userData.basicMaterial]).forEach(collect);
        });
        for (const m of materials) {
            for (const k of Object.keys(m)) {
                const v = m[k];
                if (v && v.isTexture) textures.add(v);
            }
        }
        for (const t of textures) t.dispose();
        for (const m of materials) m.dispose?.();
    }

    function toAlbedo(material) {
        return new THREE.MeshBasicMaterial({
            map: material.map ?? null,
            color: material.color ? material.color.clone() : new THREE.Color(0xffffff),
            transparent: material.transparent === true,
            opacity: material.opacity ?? 1,
            alphaMap: material.alphaMap ?? null,
            alphaTest: material.alphaTest ?? 0,
            side: material.side ?? THREE.FrontSide,
            vertexColors: material.vertexColors === true,
        });
    }

    function applyHdriMaterials(root) {
        root.traverse((obj) => {
            if (!obj.isMesh) return;
            const pbr = obj.userData.pbrMaterial;
            const basic = obj.userData.basicMaterial;
            if (!pbr || !basic) return;
            const useHdri = hdriAffectsAll || usesHdri(obj);
            obj.material = useHdri ? pbr : basic;
        });
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
            const original = obj.material;
            obj.userData.pbrMaterial = original;
            obj.userData.basicMaterial = Array.isArray(original)
                ? original.map(toAlbedo)
                : toAlbedo(original);
        });
        applyHdriMaterials(gltf.scene);
        gltf.scene.scale.set(5, 5, 5);
        scene.add(gltf.scene);
        currentRoot = gltf.scene;
        frameObject(gltf.scene);

        modelYaw = 0;
        modelTilt = 0;
        lastYaw = 0;
        lastTilt = 0;
        yawVel = 0;
        tiltVel = 0;
        tiltAxis.setFromMatrixColumn(camera.matrixWorld, 0);
        tiltAxis.y = 0;
        if (tiltAxis.lengthSq() < 1e-6) tiltAxis.set(1, 0, 0);
        tiltAxis.normalize();
        applyModelOrientation();
        return gltf;
    }

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    renderer.setAnimationLoop(() => {
        updateInertia();
        renderer.render(scene, camera);
    });

    return {
        loadModel,
        rotateCameraBy,
        backend: forceWebGL ? 'WebGL2' : 'WebGPU',
        setHdriEnabled(v) { hdriEnabled = !!v; applyHdri(); },
        setHdriBackground(v) { hdriBackground = !!v; applyHdri(); },
        setHdriAffectsAll(v) {
            hdriAffectsAll = !!v;
            if (currentRoot) applyHdriMaterials(currentRoot);
        },
        get hdriEnabled() { return hdriEnabled; },
        get hdriBackground() { return hdriBackground; },
        get hdriAffectsAll() { return hdriAffectsAll; },
    };
}
