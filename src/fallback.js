import { PROJECTS } from './projects.js';

const $ = (id) => document.getElementById(id);

/* ================= Fallback without WebGL ================= */
export function showFallback(reason) {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-fallback');
  const list = $('fallback-list');
  list.innerHTML = '';
  for (const p of PROJECTS) {
    const a = document.createElement('a');
    a.className = 'fb-card glass';
    a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.innerHTML = `<b></b><span></span><em>Открыть на GitHub ↗</em>`;
    a.querySelector('b').textContent = p.name;
    a.querySelector('span').textContent = `${p.kind}. ${p.desc}`;
    list.appendChild(a);
  }
  $('fallback').hidden = false;
  console.info('[universe] fallback:', reason);
}

