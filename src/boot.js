import './style.css';
import { showFallback } from './fallback.js';

// Check for WebGL before loading the heavy Three.js bundle
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

if (hasWebGL()) {
  import('./main.js').catch((err) => showFallback(err));
} else {
  showFallback('WebGL unavailable');
}
