import './style.css';
import { showFallback } from './fallback.js';

// Проверяем WebGL до загрузки тяжёлого бандла Three.js
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
  showFallback('WebGL недоступен');
}
