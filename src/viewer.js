import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { Inspector } from 'three/addons/inspector/Inspector.js';
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

const ROTATE_SPEED = 0.006;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const MAX_TILT = (80 * Math.PI) / 180;
const MIN_TILT = -0.5;
const INERTIA_DECAY = 0.88;
const INERTIA_EPSILON = 0.00005;

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

export function createGallery() {
    const forceWebGL = !WebGPU.isAvailable();
    const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.setClearColor(new THREE.Color(0xfdf8f1), 0);
    if (!isMobile()) renderer.inspector = new Inspector();

    const canvas = renderer.domElement;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    const loader = new GLTFLoader();

    let envMap = null;
    let hdriEnabled = true;
    let hdriBackground = false;
    let hdriAffectsAll = true;
    let hdriYaw = 0;

    const views = [];

    function applyHdriToView(view) {
        view.scene.environment = hdriEnabled ? envMap : null;
        view.scene.background = hdriEnabled && hdriBackground ? envMap : null;
        if (view.scene.environmentRotation) view.scene.environmentRotation.y = hdriYaw;
        if (view.scene.backgroundRotation) view.scene.backgroundRotation.y = hdriYaw;
    }

    function applyHdriToAll() {
        for (const v of views) applyHdriToView(v);
    }

    new EXRLoader().load(`${import.meta.env.BASE_URL}brown_photostudio_01_4k.exr`, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        envMap = texture;
        applyHdriToAll();
    });

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

    function frameViewObject(view, object) {
        const box = new THREE.Box3().setFromObject(object);
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const fovV = (view.camera.fov * Math.PI) / 180;
        const aspect = view.camera.aspect || 1;
        const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
        const distV = (size.y / 2) / Math.tan(fovV / 2);
        const distH = (Math.max(size.x, size.z) / 2) / Math.tan(fovH / 2);
        const fill = 1.5;
        const distance = Math.max(distV, distH) * fill + maxSize / 2;
        const dir = new THREE.Vector3().subVectors(view.camera.position, center).normalize();
        if (dir.lengthSq() === 0) dir.set(-0.5, 0.6, 0.7).normalize();
        view.camera.position.copy(center).addScaledVector(dir, distance);
        view.camera.near = Math.max(distance / 100, 0.01);
        view.camera.far = distance * 100;
        view.camera.lookAt(center);
        view.camera.updateProjectionMatrix();
        view.camera.updateMatrixWorld(true);
        view.target.copy(center);
        view.tiltAxis.setFromMatrixColumn(view.camera.matrixWorld, 0);
        view.tiltAxis.y = 0;
        if (view.tiltAxis.lengthSq() < 1e-6) view.tiltAxis.set(1, 0, 0);
        view.tiltAxis.normalize();
    }

    async function loadModelForView(view) {
        view.status = 'loading';
        view.onStatus?.('loading');
        try {
            const gltf = await loader.loadAsync(view.url);
            gltf.scene.traverse((obj) => {
                if (!obj.isMesh) return;
                obj.userData.pbrMaterial = obj.material;
                obj.userData.basicMaterial = Array.isArray(obj.material)
                    ? obj.material.map(toAlbedo)
                    : toAlbedo(obj.material);
            });
            applyHdriMaterials(gltf.scene);
            gltf.scene.scale.set(5, 5, 5);
            view.scene.add(gltf.scene);
            view.modelRoot = gltf.scene;
            frameViewObject(view, gltf.scene);
            view.status = 'ready';
            view.onStatus?.('ready');
        } catch (e) {
            console.error('failed to load model', view.url, e);
            view.status = 'error';
            view.error = e?.message ?? String(e);
            view.onStatus?.('error', view.error);
        }
    }

    const loadQueue = [];
    const MAX_PARALLEL = 2;
    let activeLoads = 0;
    function pumpQueue() {
        while (activeLoads < MAX_PARALLEL && loadQueue.length > 0) {
            loadQueue.sort((a, b) => {
                const aTop = a.element.getBoundingClientRect().top;
                const bTop = b.element.getBoundingClientRect().top;
                return aTop - bTop;
            });
            const view = loadQueue.shift();
            if (view.status !== 'queued') continue;
            activeLoads++;
            loadModelForView(view).finally(() => {
                activeLoads--;
                pumpQueue();
            });
        }
    }

    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const view = entry.target._galleryView;
            if (!view) continue;
            if (entry.isIntersecting && view.status === 'pending') {
                view.status = 'queued';
                loadQueue.push(view);
                pumpQueue();
            }
        }
    }, { rootMargin: '300px' });

    function applyOrientation(view) {
        if (!view.modelRoot) return;
        view.qYaw.setFromAxisAngle(WORLD_UP, view.modelYaw);
        view.qTilt.setFromAxisAngle(view.tiltAxis, view.modelTilt);
        view.modelRoot.quaternion.multiplyQuaternions(view.qTilt, view.qYaw);
    }

    function updateInertia(view) {
        if (!view.modelRoot) return;
        if (view.pointerId !== null) {
            view.yawVel = view.modelYaw - view.lastYaw;
            view.tiltVel = view.modelTilt - view.lastTilt;
            view.lastYaw = view.modelYaw;
            view.lastTilt = view.modelTilt;
            return;
        }
        if (Math.abs(view.yawVel) < INERTIA_EPSILON && Math.abs(view.tiltVel) < INERTIA_EPSILON) {
            view.lastYaw = view.modelYaw;
            view.lastTilt = view.modelTilt;
            return;
        }
        view.modelYaw += view.yawVel;
        const nextTilt = Math.max(MIN_TILT, Math.min(MAX_TILT, view.modelTilt + view.tiltVel));
        if (nextTilt === MAX_TILT || nextTilt === MIN_TILT) view.tiltVel = 0;
        view.modelTilt = nextTilt;
        view.yawVel *= INERTIA_DECAY;
        view.tiltVel *= INERTIA_DECAY;
        view.lastYaw = view.modelYaw;
        view.lastTilt = view.modelTilt;
        applyOrientation(view);
    }

    function addView({ element, url, name, onStatus }) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
        camera.position.set(-8, 10, 11);

        const view = {
            element, url, name, onStatus,
            scene, camera,
            modelRoot: null,
            status: 'pending',
            error: null,
            modelYaw: 0,
            modelTilt: 0,
            lastYaw: 0,
            lastTilt: 0,
            yawVel: 0,
            tiltVel: 0,
            tiltAxis: new THREE.Vector3(1, 0, 0),
            target: new THREE.Vector3(),
            qYaw: new THREE.Quaternion(),
            qTilt: new THREE.Quaternion(),
            pointerId: null,
            pointerX: 0,
            pointerY: 0,
        };
        element._galleryView = view;
        views.push(view);
        applyHdriToView(view);

        element.style.touchAction = 'none';
        element.addEventListener('pointerdown', (e) => {
            if (!view.modelRoot || view.pointerId !== null) return;
            view.pointerId = e.pointerId;
            view.pointerX = e.clientX;
            view.pointerY = e.clientY;
            element.setPointerCapture(e.pointerId);
        });
        element.addEventListener('pointermove', (e) => {
            if (e.pointerId !== view.pointerId || !view.modelRoot) return;
            const dx = e.clientX - view.pointerX;
            const dy = e.clientY - view.pointerY;
            view.pointerX = e.clientX;
            view.pointerY = e.clientY;
            view.modelYaw += dx * ROTATE_SPEED;
            view.modelTilt = Math.max(MIN_TILT, Math.min(MAX_TILT, view.modelTilt + dy * ROTATE_SPEED));
            applyOrientation(view);
        });
        const endDrag = (e) => {
            if (e.pointerId !== view.pointerId) return;
            view.pointerId = null;
            element.releasePointerCapture?.(e.pointerId);
        };
        element.addEventListener('pointerup', endDrag);
        element.addEventListener('pointercancel', endDrag);

        io.observe(element);
        return view;
    }

    function removeView(view) {
        io.unobserve(view.element);
        const idx = views.indexOf(view);
        if (idx >= 0) views.splice(idx, 1);
        if (view.modelRoot) {
            view.scene.remove(view.modelRoot);
            disposeRoot(view.modelRoot);
        }
    }

    function render() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        renderer.setScissorTest(false);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();

        renderer.setScissorTest(true);
        renderer.setClearColor(0xfdf8f1, 1);

        for (const view of views) {
            const rect = view.element.getBoundingClientRect();
            if (rect.bottom <= 0 || rect.top >= winH) continue;
            if (rect.right <= 0 || rect.left >= winW) continue;
            if (rect.width <= 0 || rect.height <= 0) continue;
            if (!view.modelRoot) continue;

            updateInertia(view);

            const x = Math.round(rect.left);
            const y = Math.round(rect.top);
            const w = Math.round(rect.width);
            const h = Math.round(rect.height);

            renderer.setScissor(x, y, w, h);
            renderer.setViewport(x, y, w, h);

            const aspect = w / h;
            if (Math.abs(view.camera.aspect - aspect) > 0.001) {
                view.camera.aspect = aspect;
                view.camera.updateProjectionMatrix();
            }

            renderer.render(view.scene, view.camera);
        }
    }
    renderer.setAnimationLoop(render);

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return {
        addView,
        removeView,
        backend: forceWebGL ? 'WebGL2' : 'WebGPU',
        setHdriEnabled(v) { hdriEnabled = !!v; applyHdriToAll(); },
        setHdriBackground(v) { hdriBackground = !!v; applyHdriToAll(); },
        setHdriAffectsAll(v) {
            hdriAffectsAll = !!v;
            for (const view of views) {
                if (view.modelRoot) applyHdriMaterials(view.modelRoot);
            }
        },
        rotateEnvBy(dx) {
            hdriYaw -= dx * ROTATE_SPEED;
            for (const v of views) {
                if (v.scene.environmentRotation) v.scene.environmentRotation.y = hdriYaw;
                if (v.scene.backgroundRotation) v.scene.backgroundRotation.y = hdriYaw;
            }
        },
        get hdriEnabled() { return hdriEnabled; },
        get hdriBackground() { return hdriBackground; },
        get hdriAffectsAll() { return hdriAffectsAll; },
    };
}
