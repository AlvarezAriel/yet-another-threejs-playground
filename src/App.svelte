<script>
    import { onMount } from 'svelte';

    let { gallery } = $props();

    const base = import.meta.env.BASE_URL;
    const models = [
        { id: 'gateau-praline',      name: 'Gateau Praline',      url: base + '01_Gateau_praline.glb' },
        { id: 'cheesecake-maracuya', name: 'Cheesecake Maracuya', url: base + '02_Cheesecakemaracuya.glb' },
        { id: 'financier-pistache',  name: 'Financier Pistache',  url: base + '03_Financier_pistache.glb' },
        { id: 'gastro-canard',       name: 'Gastro Canard',       url: base + '04_Gastro_canard.glb' },
        { id: 'gastro-salmon',       name: 'Gastro Salmon',       url: base + '05_Gastro_salmon.glb' },
        { id: 'gastro-vegetable',    name: 'Gastro Vegetable',    url: base + '06_Gastro%20vegetable.glb' },
        { id: 'croissant',           name: 'Croissant',           url: base + '07_Croissant.glb' },
        { id: 'pizza',               name: 'Pizza',               url: base + '08_Pizza.glb' },
        { id: 'bobun',               name: 'Bobun',               url: base + '09_Bobun.glb' },
        { id: 'cesar',               name: 'Cesar',               url: base + '10_cesar.glb' },
        { id: 'nouilles-chicken',    name: 'Nouilles Chicken',    url: base + '11_Nouilles%20chicken.glb' },
        { id: 'burger',              name: 'Burger',              url: base + '12_burger.glb' },
    ];

    const isMobile = typeof window !== 'undefined'
        && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

    let elements = $state({});
    let statuses = $state({});
    let errors = $state({});

    let collapsed = $state(isMobile);
    let hdriEnabled = $state(true);
    let hdriBackground = $state(false);
    let hdriAffectsAll = $state(true);

    function toggleHdri(e)            { hdriEnabled    = e.target.checked; gallery.setHdriEnabled(hdriEnabled); }
    function toggleHdriBackground(e)  { hdriBackground = e.target.checked; gallery.setHdriBackground(hdriBackground); }
    function toggleHdriAffectsAll(e)  { hdriAffectsAll = e.target.checked; gallery.setHdriAffectsAll(hdriAffectsAll); }

    let camPadPointer = null;
    let camPadLast = { x: 0, y: 0 };
    function onCamPadDown(e) {
        if (camPadPointer !== null) return;
        camPadPointer = e.pointerId;
        camPadLast.x = e.clientX;
        camPadLast.y = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
    }
    function onCamPadMove(e) {
        if (e.pointerId !== camPadPointer) return;
        const dx = e.clientX - camPadLast.x;
        camPadLast.x = e.clientX;
        camPadLast.y = e.clientY;
        gallery.rotateEnvBy(dx);
    }
    function onCamPadUp(e) {
        if (e.pointerId !== camPadPointer) return;
        camPadPointer = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    }

    onMount(() => {
        const handles = [];
        for (const m of models) {
            const el = elements[m.id];
            if (!el) continue;
            const handle = gallery.addView({
                element: el,
                url: m.url,
                name: m.name,
                onStatus: (status, error) => {
                    statuses[m.id] = status;
                    if (error) errors[m.id] = error;
                },
            });
            handles.push(handle);
            statuses[m.id] = 'pending';
        }
        return () => {
            for (const h of handles) gallery.removeView(h);
        };
    });
</script>

<aside class="panel" class:collapsed>
    <header>
        <div class="title">
            <h1>Gallery</h1>
        </div>
        <button class="ghost" onclick={() => (collapsed = !collapsed)} aria-label="Toggle panel">
            {collapsed ? '+' : '–'}
        </button>
    </header>

    {#if !collapsed}
        <section class="body">
            <div class="meta">
                <span class="badge">{gallery.backend}</span>
            </div>

            <div class="group">
                <div class="group-label">HDRI</div>
                <label class="toggle">
                    <input type="checkbox" checked={hdriEnabled} onchange={toggleHdri} />
                    <span>Enable HDRI</span>
                </label>
                <label class="toggle" class:disabled={!hdriEnabled}>
                    <input type="checkbox" checked={hdriBackground} disabled={!hdriEnabled} onchange={toggleHdriBackground} />
                    <span>Show as background</span>
                </label>
                <label class="toggle" class:disabled={!hdriEnabled}>
                    <input type="checkbox" checked={hdriAffectsAll} disabled={!hdriEnabled} onchange={toggleHdriAffectsAll} />
                    <span>Apply to all meshes</span>
                </label>

                <div
                    class="cam-pad"
                    role="button"
                    aria-label="Drag to rotate environment"
                    tabindex="0"
                    onpointerdown={onCamPadDown}
                    onpointermove={onCamPadMove}
                    onpointerup={onCamPadUp}
                    onpointercancel={onCamPadUp}
                >
                    <span class="cam-pad-label">Rotate environment</span>
                    <span class="cam-pad-hint">drag</span>
                </div>
            </div>
        </section>
    {/if}
</aside>

<main class="gallery">
    {#each models as model (model.id)}
        <article class="card">
            <header class="card-header">
                <h2 class="card-title">{model.name}</h2>
            </header>
            <div class="card-viewport" bind:this={elements[model.id]}>
                {#if statuses[model.id] === 'pending' || statuses[model.id] === 'queued'}
                    <span class="card-overlay">…</span>
                {:else if statuses[model.id] === 'loading'}
                    <span class="card-overlay">Loading…</span>
                {:else if statuses[model.id] === 'error'}
                    <span class="card-overlay err">{errors[model.id] ?? 'Error'}</span>
                {/if}
            </div>
        </article>
    {/each}
</main>

<style>
    :global(body) {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        color: #3a2e23;
        background: #fdf8f1;
        min-height: 100vh;
    }

    .gallery {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: 1fr;
        gap: 24px;
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 32px 80px;
    }
    @media (min-width: 640px) {
        .gallery { grid-template-columns: repeat(2, 1fr); }
    }
    @media (min-width: 960px) {
        .gallery { grid-template-columns: repeat(3, 1fr); padding: 56px 48px 120px; }
    }

    .card {
        display: flex;
        flex-direction: column;
        border-radius: 14px;
        background: transparent;
        border: 1px solid rgba(58, 46, 35, 0.08);
        box-shadow:
            0 14px 30px rgba(120, 80, 40, 0.10),
            0 2px 0 rgba(255, 255, 255, 0.5) inset;
        overflow: hidden;
        transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 220ms ease;
    }
    .card:hover {
        transform: translateY(-2px);
        box-shadow:
            0 20px 40px rgba(120, 80, 40, 0.16),
            0 2px 0 rgba(255, 255, 255, 0.6) inset;
    }

    .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(58, 46, 35, 0.08);
        background: #ffffff;
    }

    .card-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: #3a2e23;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .card-viewport {
        position: relative;
        aspect-ratio: 1 / 1;
        cursor: grab;
        background: transparent;
    }
    .card-viewport:active { cursor: grabbing; }

    .card-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(58, 46, 35, 0.45);
        pointer-events: none;
    }
    .card-overlay.err { color: #b91c1c; text-transform: none; padding: 8px; text-align: center; }

    .panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 224px;
        max-height: calc(100vh - 40px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border: 1px solid rgba(58, 46, 35, 0.08);
        border-radius: 14px;
        box-shadow:
            0 18px 40px rgba(120, 80, 40, 0.14),
            0 1px 0 rgba(255, 255, 255, 0.6) inset;
        z-index: 10;
        animation: rise 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    @keyframes rise {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to   { opacity: 1; transform: none; }
    }

    header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(58, 46, 35, 0.08);
    }
    .panel header { padding: 14px 16px; }

    .title { display: flex; align-items: center; gap: 10px; }

    h1 {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin: 0;
        color: #c2410c;
    }

    .ghost {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: rgba(194, 65, 12, 0.06);
        border: 1px solid rgba(194, 65, 12, 0.18);
        color: #c2410c;
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
    }
    .ghost:hover { background: rgba(194, 65, 12, 0.12); border-color: rgba(194, 65, 12, 0.35); }

    .body {
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        overflow-y: auto;
    }

    .meta { display: flex; align-items: center; gap: 8px; font-size: 11px; }

    .badge {
        padding: 3px 8px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(194, 65, 12, 0.12), rgba(154, 64, 36, 0.12));
        border: 1px solid rgba(194, 65, 12, 0.28);
        color: #9a3412;
        font-weight: 600;
        letter-spacing: 0.05em;
    }

    .group-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(58, 46, 35, 0.55);
        margin-bottom: 8px;
    }

    .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        background: #fbf6ec;
        border: 1px solid rgba(58, 46, 35, 0.08);
        color: #3a2e23;
        font-size: 12px;
        cursor: pointer;
        margin-bottom: 4px;
        transition: background 140ms ease, border-color 140ms ease;
    }
    .toggle:hover { background: #f5ecdb; border-color: rgba(194, 65, 12, 0.25); }
    .toggle input { accent-color: #c2410c; cursor: pointer; }
    .toggle.disabled { opacity: 0.5; cursor: not-allowed; }
    .toggle.disabled input { cursor: not-allowed; }

    .cam-pad {
        margin-top: 6px;
        height: 70px;
        border-radius: 10px;
        border: 1px dashed rgba(194, 65, 12, 0.4);
        background:
            radial-gradient(circle at 50% 50%, rgba(194, 65, 12, 0.10), transparent 70%),
            #fbf6ec;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        cursor: grab;
        touch-action: none;
        user-select: none;
        color: #3a2e23;
        transition: background 140ms ease, border-color 140ms ease;
    }
    .cam-pad:hover { border-color: rgba(194, 65, 12, 0.6); }
    .cam-pad:active { cursor: grabbing; background: rgba(194, 65, 12, 0.12); }
    .cam-pad-label { font-size: 12px; font-weight: 600; color: #9a3412; }
    .cam-pad-hint {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(58, 46, 35, 0.5);
    }

    @media (max-width: 768px), (pointer: coarse) {
        .panel {
            top: 12px;
            right: 12px;
            left: 12px;
            width: auto;
            max-height: calc(100vh - 24px);
        }
        .panel.collapsed {
            left: auto;
            width: auto;
        }
        .ghost {
            width: 32px;
            height: 32px;
            font-size: 18px;
        }
    }
</style>
