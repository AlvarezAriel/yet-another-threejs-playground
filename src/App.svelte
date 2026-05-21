<script>
    let { viewer } = $props();

    const base = import.meta.env.BASE_URL;
    const builtIn = [
        { id: 'gateau-praline',      name: 'Gateau Praline',      url: base + '01_Gateau_praline.glb' },
        { id: 'cheesecake-maracuya', name: 'Cheesecake Maracuya', url: base + '02_Cheesecakemaracuya.glb' },
        { id: 'financier-pistache',  name: 'Financier Pistache',  url: base + '03_Financier_pistache.glb' },
        { id: 'gastro-canard',       name: 'Gastro Canard',       url: base + '04_Gastro_canard.glb' },
        { id: 'gastro-salmon',       name: 'Gastro Salmon',       url: base + '05_Gastro_salmon.glb' },
        { id: 'gastro-vegetable',    name: 'Gastro Vegetable',    url: base + '06_Gastro%20vegetable.glb' },
        { id: 'croissant',           name: 'Croissant',           url: base + '07_Croissant.glb' },
        { id: 'croissant-cycles',    name: 'Croissant (Cycles)',  url: base + '07_Croissant_Cycles.glb' },
        { id: 'pizza',               name: 'Pizza',               url: base + '08_Pizza.glb' },
        { id: 'bobun',               name: 'Bobun',               url: base + '09_Bobun.glb' },
        { id: 'cesar',               name: 'Cesar',               url: base + '10_cesar.glb' },
        { id: 'nouilles-chicken',    name: 'Nouilles Chicken',    url: base + '11_Nouilles%20chicken.glb' },
        { id: 'burger',              name: 'Burger',              url: base + '12_burger.glb' },
    ];

    const isMobile = typeof window !== 'undefined'
        && window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

    let custom = $state([]);
    let models = $derived([...builtIn, ...custom]);
    let activeId = $state(null);
    let status = $state('idle');
    let error = $state(null);
    let collapsed = $state(isMobile);

    let hdriEnabled = $state(true);
    let hdriBackground = $state(false);
    let hdriAffectsAll = $state(false);

    function toggleHdri(e) {
        hdriEnabled = e.target.checked;
        viewer.setHdriEnabled(hdriEnabled);
    }

    function toggleHdriBackground(e) {
        hdriBackground = e.target.checked;
        viewer.setHdriBackground(hdriBackground);
    }

    function toggleHdriAffectsAll(e) {
        hdriAffectsAll = e.target.checked;
        viewer.setHdriAffectsAll(hdriAffectsAll);
    }

    let fileInput = $state();

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
        const dy = e.clientY - camPadLast.y;
        camPadLast.x = e.clientX;
        camPadLast.y = e.clientY;
        viewer.rotateCameraBy(dx, dy);
    }

    function onCamPadUp(e) {
        if (e.pointerId !== camPadPointer) return;
        camPadPointer = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
    }

    async function select(model) {
        if (model.id === activeId && status !== 'error') return;
        activeId = model.id;
        status = 'loading';
        error = null;
        try {
            await viewer.loadModel(model.url);
            status = 'ready';
        } catch (e) {
            console.error(e);
            error = e?.message ?? String(e);
            status = 'error';
        }
    }

    function onFiles(event) {
        const files = Array.from(event.target.files ?? []);
        for (const file of files) {
            const id = `custom-${crypto.randomUUID()}`;
            const url = URL.createObjectURL(file);
            custom = [...custom, { id, name: file.name.replace(/\.glb$/i, ''), url, owned: true }];
        }
        event.target.value = '';
        const last = custom.at(-1);
        if (last) select(last);
    }

    function removeCustom(model, e) {
        e.stopPropagation();
        if (model.owned) URL.revokeObjectURL(model.url);
        custom = custom.filter((m) => m.id !== model.id);
        if (activeId === model.id) select(builtIn[0]);
    }

    select(builtIn[0]);
</script>

<aside class="panel" class:collapsed>
    <header>
        <div class="title">
            <span class="dot" data-status={status}></span>
            <h1>Demo</h1>
        </div>
        <button class="ghost" onclick={() => (collapsed = !collapsed)} aria-label="Toggle panel">
            {collapsed ? '+' : '–'}
        </button>
    </header>

    {#if !collapsed}
        <section class="body">
            <div class="meta">
                <span class="badge">{viewer.backend}</span>
                {#if status === 'loading'}<span class="meta-text">loading…</span>{/if}
                {#if status === 'error'}<span class="meta-text err">{error}</span>{/if}
            </div>

            <div class="group">
                <div class="group-label">Model</div>
                <ul class="list">
                    {#each models as model (model.id)}
                        <li class="row" class:active={activeId === model.id}>
                            <button
                                class="item"
                                onclick={() => select(model)}
                            >
                                <span class="item-name">{model.name}</span>
                            </button>
                            {#if model.owned}
                                <button
                                    class="x"
                                    aria-label="Remove {model.name}"
                                    onclick={(e) => removeCustom(model, e)}
                                >×</button>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </div>

            <div class="group">
                <div class="group-label">HDRI</div>
                <label class="toggle">
                    <input type="checkbox" checked={hdriEnabled} onchange={toggleHdri} />
                    <span>Enable HDRI</span>
                </label>
                <label class="toggle" class:disabled={!hdriEnabled}>
                    <input
                        type="checkbox"
                        checked={hdriBackground}
                        disabled={!hdriEnabled}
                        onchange={toggleHdriBackground}
                    />
                    <span>Show as background</span>
                </label>
                <label class="toggle" class:disabled={!hdriEnabled}>
                    <input
                        type="checkbox"
                        checked={hdriAffectsAll}
                        disabled={!hdriEnabled}
                        onchange={toggleHdriAffectsAll}
                    />
                    <span>Apply to all meshes</span>
                </label>

                <div
                    class="cam-pad"
                    role="slider"
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

            <button class="cta" onclick={() => fileInput.click()}>
                <span class="plus">+</span> Add GLB
            </button>
            <input
                bind:this={fileInput}
                type="file"
                accept=".glb,model/gltf-binary"
                multiple
                hidden
                onchange={onFiles}
            />
        </section>
    {/if}
</aside>

<style>
    :global(body) {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        color: #e8eaee;
    }

    .panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 224px;
        max-height: calc(100vh - 40px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: rgba(18, 20, 26, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.45),
            0 1px 0 rgba(255, 255, 255, 0.04) inset;
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
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .title { display: flex; align-items: center; gap: 10px; }

    h1 {
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin: 0;
        color: rgba(232, 234, 238, 0.92);
    }

    .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #6b7280;
        box-shadow: 0 0 10px currentColor;
        transition: background 200ms ease;
    }
    .dot[data-status="ready"]   { background: #34d399; color: #34d399; }
    .dot[data-status="loading"] { background: #fbbf24; color: #fbbf24; animation: pulse 1.1s ease-in-out infinite; }
    .dot[data-status="error"]   { background: #f87171; color: #f87171; }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.5; transform: scale(0.85); }
    }

    .ghost {
        width: 24px;
        height: 24px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: rgba(232, 234, 238, 0.7);
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease;
    }
    .ghost:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }

    .body {
        padding: 14px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        overflow-y: auto;
    }

    .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
    }

    .badge {
        padding: 3px 8px;
        border-radius: 999px;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25));
        border: 1px solid rgba(168, 85, 247, 0.35);
        color: #d8b4fe;
        font-weight: 600;
        letter-spacing: 0.05em;
    }

    .meta-text { color: rgba(232, 234, 238, 0.55); }
    .meta-text.err { color: #fca5a5; }

    .group-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(232, 234, 238, 0.45);
        margin-bottom: 8px;
    }

    .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .row {
        display: flex;
        align-items: stretch;
        gap: 4px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        overflow: hidden;
        transition: background 140ms ease, border-color 140ms ease;
    }
    .row:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.1); }
    .row.active {
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.14));
        border-color: rgba(168, 85, 247, 0.45);
        box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.25) inset;
    }

    .item {
        flex: 1;
        padding: 9px 12px;
        background: transparent;
        border: 0;
        color: rgba(232, 234, 238, 0.85);
        font-size: 13px;
        text-align: left;
        cursor: pointer;
        transition: transform 140ms ease, color 140ms ease;
    }
    .item:active { transform: scale(0.99); }
    .row.active .item { color: #fff; }

    .item-name {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .x {
        width: 26px;
        margin: 4px;
        border: 0;
        border-radius: 6px;
        font-size: 14px;
        color: rgba(232, 234, 238, 0.55);
        background: rgba(255, 255, 255, 0.04);
        cursor: pointer;
        transition: background 140ms ease, color 140ms ease;
    }
    .x:hover { background: rgba(248, 113, 113, 0.18); color: #fca5a5; }

    .cta {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px dashed rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.02);
        color: rgba(232, 234, 238, 0.85);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
    }
    .cta:hover {
        background: rgba(168, 85, 247, 0.08);
        border-color: rgba(168, 85, 247, 0.45);
        color: #fff;
    }

    .plus {
        font-size: 16px;
        line-height: 1;
        color: rgba(168, 85, 247, 0.9);
        font-weight: 600;
    }

    .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: rgba(232, 234, 238, 0.85);
        font-size: 12px;
        cursor: pointer;
        margin-bottom: 4px;
        transition: background 140ms ease, border-color 140ms ease;
    }
    .toggle:hover { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.1); }
    .toggle input { accent-color: #a855f7; cursor: pointer; }
    .toggle.disabled { opacity: 0.5; cursor: not-allowed; }
    .toggle.disabled input { cursor: not-allowed; }

    .cam-pad {
        margin-top: 6px;
        height: 70px;
        border-radius: 10px;
        border: 1px dashed rgba(168, 85, 247, 0.35);
        background:
            radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.12), transparent 70%),
            rgba(255, 255, 255, 0.02);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        cursor: grab;
        touch-action: none;
        user-select: none;
        color: rgba(232, 234, 238, 0.85);
        transition: background 140ms ease, border-color 140ms ease;
    }
    .cam-pad:hover { border-color: rgba(168, 85, 247, 0.55); }
    .cam-pad:active { cursor: grabbing; background: rgba(168, 85, 247, 0.12); }
    .cam-pad-label { font-size: 12px; font-weight: 500; }
    .cam-pad-hint {
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(232, 234, 238, 0.45);
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
