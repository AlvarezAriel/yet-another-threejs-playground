import { mount } from 'svelte';
import { createGallery } from './viewer.js';
import App from './App.svelte';

const gallery = createGallery();
console.info(`Renderer backend: ${gallery.backend}`);

const target = document.getElementById('ui') ?? document.body;
mount(App, { target, props: { gallery } });
