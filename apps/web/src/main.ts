import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

// iOS Safari only shows :active (the buttons' press-down) once the page listens for touches.
document.addEventListener('touchstart', () => {}, { passive: true });

// A prerendered page (scripts/prerender.ts) has its text in #app for search engines; the app
// takes its place.
target.replaceChildren();
const app = mount(App, { target });

export default app;
