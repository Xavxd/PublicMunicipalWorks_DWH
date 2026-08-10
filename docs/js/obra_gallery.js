/* Lightweight, dependency-free viewer for the illustrative work galleries. */
(function () {
  'use strict';
  var modal, state;
  function t(key, vars) { return window.I18N && window.I18N.t ? window.I18N.t(key, vars) : key; }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fallback(label) { return '<span class="obra-thumb-fallback" role="img" aria-label="' + escapeHtml(label) + '">🛠️</span>'; }
  function thumbnail(obra, className) {
    var images = Array.isArray(obra.imagenes) ? obra.imagenes.filter(Boolean) : [];
    var label = t('galeria.abrir', { titulo: obra.nombre || '' });
    if (!images.length) return '<button type="button" class="obra-thumb ' + (className || '') + ' obra-thumb--empty" aria-label="' + escapeHtml(label) + '" disabled>' + fallback(t('galeria.noDisponible')) + '</button>';
    return '<button type="button" class="obra-thumb ' + (className || '') + '" aria-label="' + escapeHtml(label) + '" onclick="ObraGallery.openById(\'' + escapeHtml(obra.id) + '\')"><img src="../' + escapeHtml(images[0]) + '" alt="' + escapeHtml(t('galeria.alt', { numero: 1, total: images.length, titulo: obra.nombre || '' })) + '" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden>' + fallback(t('galeria.noDisponible')) + '</span></button>';
  }
  function buildModal() {
    if (modal) return modal;
    modal = document.createElement('div'); modal.className = 'obra-gallery-modal'; modal.hidden = true;
    modal.innerHTML = '<div class="obra-gallery-modal__backdrop" data-close-gallery></div><section class="obra-gallery-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="obra-gallery-title"><button type="button" class="obra-gallery-modal__close" data-close-gallery></button><h2 id="obra-gallery-title"></h2><div class="obra-gallery-modal__frame"><img class="obra-gallery-modal__image" /><div class="obra-gallery-modal__fallback" hidden></div></div><div class="obra-gallery-modal__controls"><button type="button" class="obra-gallery-modal__previous"></button><span class="obra-gallery-modal__count" aria-live="polite"></span><button type="button" class="obra-gallery-modal__next"></button></div></section>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) { if (event.target.hasAttribute('data-close-gallery')) close(); if (event.target.classList.contains('obra-gallery-modal__previous')) move(-1); if (event.target.classList.contains('obra-gallery-modal__next')) move(1); });
    return modal;
  }
  function render() {
    if (!state || !modal) return;
    var image = modal.querySelector('.obra-gallery-modal__image'), empty = modal.querySelector('.obra-gallery-modal__fallback'), index = state.index;
    modal.querySelector('#obra-gallery-title').textContent = state.title;
    modal.querySelector('.obra-gallery-modal__close').textContent = t('galeria.cerrar'); modal.querySelector('.obra-gallery-modal__previous').textContent = t('galeria.anterior'); modal.querySelector('.obra-gallery-modal__next').textContent = t('galeria.siguiente'); modal.querySelector('.obra-gallery-modal__count').textContent = t('galeria.foto', { numero: index + 1, total: state.images.length });
    image.hidden = false; empty.hidden = true; image.loading = index === 0 ? 'eager' : 'lazy'; image.alt = t('galeria.alt', { numero: index + 1, total: state.images.length, titulo: state.title });
    image.onerror = function () { image.hidden = true; empty.hidden = false; empty.innerHTML = fallback(t('galeria.noDisponible')); };
    image.src = '../' + state.images[index];
  }
  function move(delta) { if (!state || state.images.length < 2) return; state.index = (state.index + delta + state.images.length) % state.images.length; render(); }
  function keydown(event) { if (!state) return; if (event.key === 'Escape') { close(); return; } if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); } if (event.key === 'ArrowRight') { event.preventDefault(); move(1); } }
  function close() { if (!modal) return; modal.hidden = true; document.removeEventListener('keydown', keydown); state = null; }
  function open(obra) { var images = Array.isArray(obra && obra.imagenes) ? obra.imagenes.filter(Boolean) : []; if (!images.length) return; buildModal(); state = { images: images, index: 0, title: obra.nombre || '' }; modal.hidden = false; render(); document.addEventListener('keydown', keydown); modal.querySelector('.obra-gallery-modal__close').focus(); }
  window.ObraGallery = { thumbnail: thumbnail, open: open, openById: function (id) { var obra = (window.__obrasGaleria || []).find(function (item) { return item.id === id; }); if (obra) open(obra); } };
  document.addEventListener('idiomacambiado', function () { if (state) render(); });
})();
