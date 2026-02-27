import EventEmitter from '../core/EventEmitter.js';
import Stats from 'stats-gl';

export default class Debug extends EventEmitter {
  constructor() {
    super();
    this.active = window.location.hash === '#debug' || new URLSearchParams(location.search).has('debug');
    if (!this.active) {
      this.pane = null;
      this.addFolder = () => ({ addBinding: () => {}, addButton: () => ({ on: () => {} }) });
      return;
    }

    import('tweakpane').then(({ Pane }) => {
      import('@tweakpane/plugin-essentials').then(({ TpPluginEssentials }) => {
        this.pane = new Pane({ title: 'Ocean Outlaws', expanded: true });
        this.pane.registerPlugin(TpPluginEssentials);
        this.trigger('ready');
      });
    });

    this.stats = new Stats({ trackGPU: true });
    document.body.appendChild(this.stats.dom);

    globalThis.experience?.ticker?.register(999, 'debug.monitor', () => {
      this.stats.update();
    });
  }

  addFolder(title) {
    if (!this.pane) return { addBinding: () => {}, addButton: () => ({ on: () => {} }) };
    return this.pane.addFolder({ title, expanded: false });
  }
}
