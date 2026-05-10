<script>
    let { viewer } = $props();

    const base = import.meta.env.BASE_URL;
    const builtIn = [
        { id: 'rol-canela', name: 'Rol de Canela', url: base + 'RolCanela.glb' },
        { id: 'sandwich',   name: 'Sandwich',     url: base + 'sandwich.glb'   },
    ];

    let custom = $state([]);
    let models = $derived([...builtIn, ...custom]);
    let activeId = $state(null);
    let status = $state('idle');
    let error = $state(null);
    let collapsed = $state(false);

    let fileInput = $state();

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
            <h1>Scene</h1>
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
        width: 280px;
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
</style>
