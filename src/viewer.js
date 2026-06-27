import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView } from 'three/tsl';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { denoise } from 'three/addons/tsl/display/DenoiseNode.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const TONE_MAPPINGS = {
    None: THREE.NoToneMapping,
    Linear: THREE.LinearToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
    Cineon: THREE.CineonToneMapping,
    ACESFilmic: THREE.ACESFilmicToneMapping,
    AgX: THREE.AgXToneMapping,
    Neutral: THREE.NeutralToneMapping,
};

export const GTAO_DEFAULTS = {
    samples: 16,
    // Occlusion radius in world units. The models are scaled 5x, so this must stay
    // small: too large and GTAO samples past the contact, darkening a ring out on the
    // plate while leaving the actual contact bright (reads as a "contact glow").
    radius: 0.19,
    thickness: 0.35,
    distanceExponent: 1.35,
    scale: 2.05, // "Intensity" — darkening power applied to the AO (pow(ao, scale))
    resolutionScale: 1,
};

const HDRI_NAME_PREFIXES = ['Plate', 'Cylinder'];
function usesHdri(obj) {
    return HDRI_NAME_PREFIXES.some((p) => obj.name?.startsWith(p));
}

const ROTATE_SPEED = 0.006;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const MAX_TILT = (80 * Math.PI) / 180;
const MIN_TILT = -0.5;
const INERTIA_DECAY = 0.88;
const INERTIA_EPSILON = 0.00005;

// Mirror-glossy plates throw a sharp specular reflection of the bright HDRI right
// where a model meets them — a "contact glow" that screen-space AO can't darken
// (it sits on a depth edge with ~no occlusion). Enforcing a roughness floor turns
// that hotspot into a soft satin sheen, killing the glow. Already-matte materials
// are above the floor and untouched.
const MIN_ROUGHNESS = 0.55;
function tameSpecular(material) {
    const apply = (m) => {
        if (!m) return;
        if ((m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) && typeof m.roughness === 'number') {
            m.roughness = Math.max(m.roughness, MIN_ROUGHNESS);
        }
    };
    if (Array.isArray(material)) material.forEach(apply); else apply(material);
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(new THREE.Color(0xfefcf7), 0);

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

    new HDRLoader().load(`${import.meta.env.BASE_URL}church_meeting_room_1k.hdr`, (texture) => {
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
                tameSpecular(obj.material);
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

    const CLICK_THRESHOLD_PX = 6;

    function attachPointers(view, element) {
        element.style.touchAction = 'none';
        const onDown = (e) => {
            if (!view.modelRoot || view.pointerId !== null) return;
            if (e.target instanceof Element && e.target.closest('button')) return;
            view.pointerId = e.pointerId;
            view.pointerX = e.clientX;
            view.pointerY = e.clientY;
            view.pointerStartX = e.clientX;
            view.pointerStartY = e.clientY;
            element.setPointerCapture(e.pointerId);
        };
        const onMove = (e) => {
            if (e.pointerId !== view.pointerId || !view.modelRoot) return;
            const dx = e.clientX - view.pointerX;
            const dy = e.clientY - view.pointerY;
            view.pointerX = e.clientX;
            view.pointerY = e.clientY;
            view.modelYaw += dx * ROTATE_SPEED;
            view.modelTilt = Math.max(MIN_TILT, Math.min(MAX_TILT, view.modelTilt + dy * ROTATE_SPEED));
            applyOrientation(view);
        };
        const onUp = (e) => {
            if (e.pointerId !== view.pointerId) return;
            const ddx = e.clientX - view.pointerStartX;
            const ddy = e.clientY - view.pointerStartY;
            view.pointerId = null;
            element.releasePointerCapture?.(e.pointerId);
            if (Math.hypot(ddx, ddy) < CLICK_THRESHOLD_PX) view.onClick?.();
        };
        element.addEventListener('pointerdown', onDown);
        element.addEventListener('pointermove', onMove);
        element.addEventListener('pointerup', onUp);
        element.addEventListener('pointercancel', onUp);
        return () => {
            element.removeEventListener('pointerdown', onDown);
            element.removeEventListener('pointermove', onMove);
            element.removeEventListener('pointerup', onUp);
            element.removeEventListener('pointercancel', onUp);
        };
    }

    let focusedView = null;

    // --- GTAO post-processing (applied to the focused / detail view only) ---
    let gtaoEnabled = true;
    const gtaoParams = { ...GTAO_DEFAULTS };
    let pipeline = null;
    let pipelineView = null;
    let aoNode = null;

    function applyGtaoParams() {
        if (!aoNode) return;
        aoNode.samples.value = gtaoParams.samples;
        aoNode.radius.value = gtaoParams.radius;
        aoNode.thickness.value = gtaoParams.thickness;
        aoNode.distanceExponent.value = gtaoParams.distanceExponent;
        aoNode.scale.value = gtaoParams.scale; // darkening power (pow(ao, scale))
        aoNode.resolutionScale = gtaoParams.resolutionScale;
    }

    function disposePipeline() {
        pipeline?.dispose?.();
        aoNode?.dispose?.();
        pipeline = null;
        aoNode = null;
        pipelineView = null;
    }

    function buildPipeline(view) {
        const scenePass = pass(view.scene, view.camera);
        scenePass.setMRT(mrt({ output, normal: normalView }));
        const colorNode = scenePass.getTextureNode('output');
        const normalNode = scenePass.getTextureNode('normal');
        const depthNode = scenePass.getTextureNode('depth');

        aoNode = ao(depthNode, normalNode, view.camera);
        applyGtaoParams();

        // Standard GTAO: denoise the raw AO (edge-aware, so it cleans noise without
        // bleeding across silhouettes) and multiply it into the colour. AO is 1 in open
        // areas and < 1 in creases / close proximity, so this darkens exactly where
        // surfaces are near each other.
        const aoDenoised = denoise(aoNode.getTextureNode(), depthNode, normalNode, view.camera);

        pipeline = new THREE.RenderPipeline(renderer);
        pipeline.outputNode = colorNode.mul(aoDenoised.r.add(0.5)); //(1.0).sub(aoDenoised.r);// .mul(-1).add(1); //colorNode.mul(aoDenoised.r);
        pipelineView = view;
    }

    function renderFocusedWithGtao(view, winW, winH) {
        if (!view.modelRoot) return;
        updateInertia(view);
        if (pipelineView !== view) {
            disposePipeline();
            buildPipeline(view);
        }
        const aspect = winW / winH;
        if (Math.abs(view.camera.aspect - aspect) > 0.001) {
            view.camera.aspect = aspect;
            view.camera.updateProjectionMatrix();
        }
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, winW, winH);
        renderer.setClearColor(0xfefcf7, 1);
        pipeline.render();
    }

    function addView({ element, url, name, onStatus, onClick }) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
        camera.position.set(-8, 10, 11);

        const view = {
            element, cardElement: element, url, name, onStatus, onClick,
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
            pointerStartX: 0,
            pointerStartY: 0,
            detachPointers: null,
        };
        element._galleryView = view;
        views.push(view);
        applyHdriToView(view);

        view.detachPointers = attachPointers(view, element);
        io.observe(element);
        return view;
    }

    function removeView(view) {
        if (pipelineView === view) disposePipeline();
        if (focusedView === view) focusedView = null;
        view.detachPointers?.();
        io.unobserve(view.cardElement);
        const idx = views.indexOf(view);
        if (idx >= 0) views.splice(idx, 1);
        if (view.modelRoot) {
            view.scene.remove(view.modelRoot);
            disposeRoot(view.modelRoot);
        }
    }

    function focusView(view, detailElement) {
        if (focusedView && focusedView !== view) unfocusView(focusedView);
        view.detachPointers?.();
        view.element = detailElement;
        view.detachPointers = attachPointers(view, detailElement);
        focusedView = view;
    }

    function unfocusView(view) {
        view.detachPointers?.();
        view.element = view.cardElement;
        view.detachPointers = attachPointers(view, view.cardElement);
        if (pipelineView === view) disposePipeline();
        if (focusedView === view) focusedView = null;
    }

    function renderView(view, winW, winH) {
        const rect = view.element.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= winH) return;
        if (rect.right <= 0 || rect.left >= winW) return;
        if (rect.width <= 0 || rect.height <= 0) return;
        if (!view.modelRoot) return;

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

    function render() {
        const winW = window.innerWidth;
        const winH = window.innerHeight;

        renderer.setScissorTest(false);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();

        renderer.setScissorTest(true);
        renderer.setClearColor(0xfefcf7, 1);

        if (focusedView) {
            if (gtaoEnabled) renderFocusedWithGtao(focusedView, winW, winH);
            else renderView(focusedView, winW, winH);
        } else {
            for (const view of views) renderView(view, winW, winH);
        }
    }
    renderer.setAnimationLoop(render);

    window.addEventListener('resize', () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return {
        addView,
        removeView,
        focusView,
        unfocusView,
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

        // --- Tone mapping ---
        toneMappings: Object.keys(TONE_MAPPINGS),
        setToneMapping(name) {
            renderer.toneMapping = TONE_MAPPINGS[name] ?? THREE.LinearToneMapping;
            // Direct-render NodeMaterials bake tone mapping into their shader, so
            // force a recompile; the GTAO pipeline reads toneMapping live but must
            // be rebuilt to pick up the new output node.
            for (const view of views) {
                view.scene.traverse((obj) => {
                    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
                    for (const m of mats) m.needsUpdate = true;
                });
            }
            disposePipeline();
        },
        setExposure(v) { renderer.toneMappingExposure = v; },

        // --- GTAO ---
        gtaoDefaults: { ...GTAO_DEFAULTS },
        setGtaoEnabled(v) { gtaoEnabled = !!v; },
        setGtaoParam(key, value) {
            if (!(key in gtaoParams)) return;
            gtaoParams[key] = value;
            applyGtaoParams();
        },
        get gtaoEnabled() { return gtaoEnabled; },
    };
}
