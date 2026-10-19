// Recadrage carré de la photo avant envoi (amélioration progressive : sans JS, le serveur centre l'image).
(() => {
  const form = document.getElementById('photo-form');
  if (!form) return;
  const MAX = 5 * 1024 * 1024;
  const input = form.querySelector('input[type="file"]');
  const wrap = document.getElementById('crop');
  const img = document.getElementById('crop-img');
  const box = document.getElementById('crop-box');
  const zoom = document.getElementById('crop-zoom');
  const zoomLabel = document.getElementById('crop-zoom-label');
  const sizeError = document.getElementById('photo-size-error');
  const submit = form.querySelector('button');
  const fx = form.elements.namedItem('crop_x');
  const fy = form.elements.namedItem('crop_y');
  const fs = form.elements.namedItem('crop_size');
  let state = { x: 0, y: 0, size: 0 }; // en pixels de l'image d'origine

  function render() {
    const scale = img.clientWidth / img.naturalWidth;
    Object.assign(box.style, { left: state.x * scale + 'px', top: state.y * scale + 'px', width: state.size * scale + 'px', height: state.size * scale + 'px' });
    fx.value = Math.round(state.x); fy.value = Math.round(state.y); fs.value = Math.round(state.size);
  }
  function clamp() {
    state.x = Math.max(0, Math.min(state.x, img.naturalWidth - state.size));
    state.y = Math.max(0, Math.min(state.y, img.naturalHeight - state.size));
  }

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    sizeError.hidden = true; submit.disabled = false;
    if (!file) return;
    if (file.size > MAX) { sizeError.hidden = false; submit.disabled = true; return; }
    img.onload = () => {
      wrap.hidden = false; zoomLabel.hidden = false; zoom.value = 100;
      const min = Math.min(img.naturalWidth, img.naturalHeight);
      state = { size: min, x: (img.naturalWidth - min) / 2, y: (img.naturalHeight - min) / 2 };
      render();
    };
    img.src = URL.createObjectURL(file);
  });

  zoom.addEventListener('input', () => {
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    const cx = state.x + state.size / 2, cy = state.y + state.size / 2;
    state.size = (min * zoom.value) / 100;
    state.x = cx - state.size / 2; state.y = cy - state.size / 2;
    clamp(); render();
  });

  let drag = null;
  box.addEventListener('pointerdown', (e) => { drag = { px: e.clientX, py: e.clientY, x: state.x, y: state.y }; box.setPointerCapture(e.pointerId); });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const scale = img.clientWidth / img.naturalWidth;
    state.x = drag.x + (e.clientX - drag.px) / scale; state.y = drag.y + (e.clientY - drag.py) / scale;
    clamp(); render();
  });
  box.addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('resize', () => { if (!wrap.hidden) render(); });
})();
