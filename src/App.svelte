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
    let viewHandles = {};

    let selectedId = $state(null);
    let detailViewport = $state();
    const selectedModel = $derived(selectedId ? models.find((m) => m.id === selectedId) : null);

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
                onClick: () => { selectedId = m.id; },
            });
            handles.push(handle);
            viewHandles[m.id] = handle;
            statuses[m.id] = 'pending';
        }
        return () => {
            for (const h of handles) gallery.removeView(h);
            viewHandles = {};
        };
    });

    $effect(() => {
        if (!selectedId || !detailViewport) return;
        const view = viewHandles[selectedId];
        if (!view) return;
        gallery.focusView(view, detailViewport);
        document.body.style.overflow = 'hidden';
        return () => {
            gallery.unfocusView(view);
            document.body.style.overflow = '';
        };
    });

    function closeDetail() { selectedId = null; }

    function onDetailKey(e) {
        if (e.key === 'Escape') closeDetail();
    }

    let cart = $state({});
    let cartOpen = $state(false);
    const cartCount = $derived(Object.values(cart).reduce((s, q) => s + q, 0));
    const cartItems = $derived(
        Object.entries(cart).map(([id, qty]) => ({ qty, model: models.find((m) => m.id === id) }))
    );

    function addToCart(e, id) {
        e.stopPropagation();
        cart[id] = (cart[id] ?? 0) + 1;
        cartOpen = true;
    }

    function decQty(id) {
        const next = (cart[id] ?? 0) - 1;
        if (next <= 0) { const { [id]: _, ...rest } = cart; cart = rest; }
        else cart[id] = next;
    }
    function incQty(id) { cart[id] = (cart[id] ?? 0) + 1; }
    function removeItem(id) { const { [id]: _, ...rest } = cart; cart = rest; }
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

<main class="gallery" class:gallery-hidden={selectedModel}>
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
                <button
                    class="add-btn"
                    aria-label="Add {model.name} to cart"
                    onclick={(e) => addToCart(e, model.id)}
                >
                    {#if cart[model.id]}
                        <span class="add-btn-qty">{cart[model.id]}</span>
                    {:else}
                        +
                    {/if}
                </button>
            </div>
        </article>
    {/each}
</main>

<button
    class="cart-fab"
    class:has-items={cartCount > 0}
    onclick={() => (cartOpen = !cartOpen)}
    aria-label="Shopping cart"
>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2.5 3h2.6l2.3 11.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L21.5 7H6" />
    </svg>
    {#if cartCount > 0}
        <span class="cart-badge">{cartCount}</span>
    {/if}
</button>

{#if cartOpen}
    <button type="button" class="cart-scrim" aria-label="Close cart" onclick={() => (cartOpen = false)}></button>
    <aside class="cart-drawer" role="dialog" aria-label="Shopping cart">
        <header class="cart-header">
            <h3 class="cart-title">Your cart</h3>
            <button class="cart-close" aria-label="Close cart" onclick={() => (cartOpen = false)}>×</button>
        </header>
        {#if cartItems.length === 0}
            <p class="cart-empty">Your cart is empty.</p>
        {:else}
            <ul class="cart-list">
                {#each cartItems as item (item.model.id)}
                    <li class="cart-item">
                        <div class="cart-item-info">
                            <span class="cart-item-name">{item.model.name}</span>
                            <span class="cart-item-meta">In cart</span>
                        </div>
                        <div class="qty">
                            <button class="qty-btn" aria-label="Decrease" onclick={() => decQty(item.model.id)}>−</button>
                            <span class="qty-val">{item.qty}</span>
                            <button class="qty-btn" aria-label="Increase" onclick={() => incQty(item.model.id)}>+</button>
                        </div>
                        <button class="cart-remove" aria-label="Remove" onclick={() => removeItem(item.model.id)}>Remove</button>
                    </li>
                {/each}
            </ul>
            <footer class="cart-footer">
                <div class="cart-total">
                    <span>Items</span>
                    <strong>{cartCount}</strong>
                </div>
                <button class="checkout-btn" type="button">Checkout</button>
            </footer>
        {/if}
    </aside>
{/if}

{#if selectedModel}
    <section class="detail" onkeydown={onDetailKey}>
        <header class="detail-header">
            <button class="back-btn" onclick={closeDetail} aria-label="Back to gallery">
                <span class="back-arrow" aria-hidden="true">←</span>
                <span>Back</span>
            </button>
            <h2 class="detail-title">{selectedModel.name}</h2>
            <div class="detail-spacer"></div>
        </header>
        <div class="detail-viewport" bind:this={detailViewport}></div>
    </section>
{/if}

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
        gap: 36px;
        max-width: 1240px;
        margin: 0 auto;
        padding: 40px 32px 96px;
    }
    .gallery-hidden { visibility: hidden; }
    @media (min-width: 640px) {
        .gallery { grid-template-columns: repeat(2, 1fr); gap: 40px; }
    }
    @media (min-width: 960px) {
        .gallery { grid-template-columns: repeat(3, 1fr); gap: 44px; padding: 64px 56px 140px; }
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

    .card-viewport { user-select: none; }

    .add-btn {
        position: absolute;
        right: 12px;
        bottom: 12px;
        width: 40px;
        height: 40px;
        border-radius: 999px;
        border: 0;
        background: #c2410c;
        color: #ffffff;
        font-size: 22px;
        font-weight: 500;
        line-height: 1;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(194, 65, 12, 0.35);
        transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
        z-index: 2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    .add-btn:hover {
        background: #9a3412;
        transform: translateY(-1px);
        box-shadow: 0 10px 22px rgba(194, 65, 12, 0.45);
    }
    .add-btn:active { transform: translateY(0) scale(0.96); }
    .add-btn-qty {
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    .cart-fab {
        position: fixed;
        right: 28px;
        bottom: 28px;
        width: 60px;
        height: 60px;
        border-radius: 999px;
        border: 0;
        background: #c2410c;
        color: #ffffff;
        cursor: pointer;
        box-shadow: 0 14px 28px rgba(194, 65, 12, 0.4);
        transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
        z-index: 11;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .cart-fab:hover {
        background: #9a3412;
        transform: translateY(-2px);
        box-shadow: 0 18px 32px rgba(194, 65, 12, 0.5);
    }
    .cart-fab:active { transform: translateY(0) scale(0.97); }
    .cart-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ffffff;
        color: #c2410c;
        font-size: 12px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
    }

    .cart-scrim {
        position: fixed;
        inset: 0;
        z-index: 11;
        background: rgba(58, 46, 35, 0.35);
        border: 0;
        padding: 0;
        cursor: pointer;
        animation: fade-in 180ms ease both;
    }

    .cart-drawer {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(420px, 100vw);
        z-index: 12;
        background: #ffffff;
        box-shadow: -16px 0 40px rgba(120, 80, 40, 0.18);
        display: flex;
        flex-direction: column;
        animation: slide-in 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    @keyframes slide-in {
        from { transform: translateX(100%); }
        to   { transform: translateX(0); }
    }

    .cart-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(58, 46, 35, 0.08);
        background: #ffffff;
    }
    .cart-title { margin: 0; font-size: 16px; font-weight: 700; color: #3a2e23; }
    .cart-close {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid rgba(58, 46, 35, 0.12);
        background: #ffffff;
        font-size: 18px;
        line-height: 1;
        color: #3a2e23;
        cursor: pointer;
    }
    .cart-close:hover { background: rgba(194, 65, 12, 0.08); color: #c2410c; border-color: rgba(194, 65, 12, 0.3); }

    .cart-empty {
        margin: 40px 22px;
        color: rgba(58, 46, 35, 0.6);
        text-align: center;
        font-size: 14px;
    }

    .cart-list {
        list-style: none;
        margin: 0;
        padding: 8px 0;
        overflow-y: auto;
        flex: 1;
    }
    .cart-item {
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-areas:
            "info qty"
            "info remove";
        align-items: center;
        gap: 6px 16px;
        padding: 14px 22px;
        border-bottom: 1px solid rgba(58, 46, 35, 0.06);
    }
    .cart-item-info { grid-area: info; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .cart-item-name { font-size: 14px; font-weight: 600; color: #3a2e23; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cart-item-meta { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(58, 46, 35, 0.5); }

    .qty {
        grid-area: qty;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #fbf6ec;
        border: 1px solid rgba(58, 46, 35, 0.08);
        border-radius: 999px;
        padding: 2px;
    }
    .qty-btn {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        border: 0;
        background: transparent;
        color: #3a2e23;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
    }
    .qty-btn:hover { background: rgba(194, 65, 12, 0.12); color: #c2410c; }
    .qty-val { min-width: 18px; text-align: center; font-size: 13px; font-weight: 600; color: #3a2e23; }

    .cart-remove {
        grid-area: remove;
        justify-self: end;
        background: transparent;
        border: 0;
        padding: 2px 0;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(58, 46, 35, 0.6);
        cursor: pointer;
    }
    .cart-remove:hover { color: #b91c1c; }

    .cart-footer {
        padding: 16px 22px 20px;
        border-top: 1px solid rgba(58, 46, 35, 0.08);
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #ffffff;
    }
    .cart-total {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        color: rgba(58, 46, 35, 0.7);
    }
    .cart-total strong { color: #3a2e23; font-size: 16px; }
    .checkout-btn {
        padding: 12px 16px;
        border: 0;
        border-radius: 10px;
        background: #c2410c;
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.02em;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(194, 65, 12, 0.3);
        transition: background 140ms ease, transform 140ms ease;
    }
    .checkout-btn:hover { background: #9a3412; transform: translateY(-1px); }
    .checkout-btn:active { transform: translateY(0); }

    .detail {
        position: fixed;
        inset: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        background: transparent;
        animation: fade-in 220ms ease both;
        pointer-events: none;
    }
    .detail-header, .detail-viewport { pointer-events: auto; }
    @keyframes fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
    }

    .detail-header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 16px;
        padding: 18px 28px;
        background: #ffffff;
        border-bottom: 1px solid rgba(58, 46, 35, 0.08);
        box-shadow: 0 1px 0 rgba(58, 46, 35, 0.04);
    }

    .back-btn {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px 8px 12px;
        border-radius: 10px;
        border: 1px solid rgba(58, 46, 35, 0.12);
        background: #ffffff;
        color: #3a2e23;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
    }
    .back-btn:hover {
        background: rgba(194, 65, 12, 0.06);
        border-color: rgba(194, 65, 12, 0.35);
        color: #c2410c;
    }
    .back-arrow { font-size: 16px; line-height: 1; }

    .detail-title {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: #3a2e23;
        text-align: center;
    }

    .detail-spacer { width: 1px; }

    .detail-viewport {
        flex: 1;
        cursor: grab;
        touch-action: none;
        user-select: none;
    }
    .detail-viewport:active { cursor: grabbing; }

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
