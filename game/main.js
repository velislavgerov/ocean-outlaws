import Experience from './core/Experience.js';

const canvas = document.querySelector('#canvas');
const experience = new Experience(canvas);

globalThis.exp = experience;
