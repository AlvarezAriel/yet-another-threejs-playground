import { mount } from 'svelte';
import { createViewer } from './viewer.js';
import App from './App.svelte';

const viewer = createViewer();
console.info(`Renderer backend: ${viewer.backend}`);

const target = document.getElementById('ui') ?? document.body;
mount(App, { target, props: { viewer } });
