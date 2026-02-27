import { encode, decode } from '@msgpack/msgpack';
import EventEmitter from '../core/EventEmitter.js';

export default class NetworkClient extends EventEmitter {
  constructor(url) {
    super();
    this.ws = new WebSocket(url || import.meta.env.VITE_WS_URL);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => this.trigger('connected');
    this.ws.onclose = () => this.trigger('disconnected');
    this.ws.onmessage = (e) => this._onMessage(e);
    this.ws.onerror = (e) => console.error('WS error', e);
  }

  send(type, data) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(encode({ t: type, d: data }));
  }

  _onMessage(event) {
    try {
      const msg = decode(new Uint8Array(event.data));
      this.trigger(`msg.${msg.t}`, [msg.d]);
    } catch (e) {
      console.warn('Failed to decode message', e);
    }
  }
}
