(function () {
  'use strict';

  var CLOUD_FOLDER = 'assets/effects/bulut';
  var CLOUD_FILES = [];
  for (var i = 1; i <= 10; i++) {
    CLOUD_FILES.push(CLOUD_FOLDER + '/' + i + '_cloud_' + (11 - i) + '.png');
  }

  var activeClouds = [];
  var spawnTimer = null;
  var isRunning = false;

  function getPageWrap() {
    return document.querySelector('.page') || document.body;
  }

  function getOrCreateLayer() {
    var wrap = getPageWrap();
    var layer = wrap.querySelector('.cloud-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'cloud-layer';
      layer.style.position = 'absolute';
      layer.style.inset = '0';
      layer.style.pointerEvents = 'none';
      layer.style.zIndex = '1';
      layer.style.overflow = 'hidden';
      if (wrap.firstChild) {
        wrap.insertBefore(layer, wrap.firstChild);
      } else {
        wrap.appendChild(layer);
      }
    }
    return layer;
  }

  function spawnCloud() {
    if (!isRunning) return;
    var layer = getOrCreateLayer();

    var img = new Image();
    var fileIdx = Math.floor(Math.random() * CLOUD_FILES.length);
    img.src = CLOUD_FILES[fileIdx];
    img.className = 'cloud-sprite';
    img.draggable = false;

    var pageW = layer.clientWidth || 430;
    var pageH = layer.clientHeight || window.innerHeight;

    var fromLeft = Math.random() < 0.5;
    var scale = 0.4 + Math.random() * 0.8;
    var baseW = 120 * scale;
    var baseH = 80 * scale;
    var topPos = 5 + Math.random() * 45;
    var opacity = 0.35 + Math.random() * 0.4;
    var duration = 12 + Math.random() * 20;
    var delay = Math.random() * 6;

    var startX = fromLeft ? -baseW : pageW;
    var endX = fromLeft ? pageW + baseW : -baseW;

    img.style.width = Math.round(baseW) + 'px';
    img.style.height = 'auto';
    img.style.top = topPos + '%';
    img.style.left = startX + 'px';
    img.style.opacity = '0';
    img.style.zIndex = Math.random() < 0.5 ? '1' : '2';

    layer.appendChild(img);

    var cloudObj = { el: img, active: true };

    requestAnimationFrame(function () {
      img.style.transition = 'opacity ' + (0.5 + delay * 0.1) + 's ease';
      img.style.opacity = String(opacity);

      setTimeout(function () {
        if (!cloudObj.active) return;
        img.style.transition = 'transform ' + duration + 's linear, opacity ' + (duration * 0.1) + 's ease ' + (duration * 0.85) + 's';
        img.style.transform = 'translateX(' + (endX - startX) + 'px)';
        img.style.opacity = String(opacity * 0.1);
      }, delay * 200);
    });

    var totalLife = (delay * 200) + (duration * 1000) + 2000;
    activeClouds.push(cloudObj);

    setTimeout(function () {
      cloudObj.active = false;
      if (img.parentNode) img.parentNode.removeChild(img);
      var idx = activeClouds.indexOf(cloudObj);
      if (idx !== -1) activeClouds.splice(idx, 1);
    }, totalLife);
  }

  function scheduleNext() {
    if (!isRunning) return;
    var nextDelay = 8000 + Math.random() * 22000;
    spawnTimer = setTimeout(function () {
      spawnCloud();
      scheduleNext();
    }, nextDelay);
  }

  window.startClouds = function () {
    if (isRunning) return;
    if (localStorage.getItem('sp_setting_graphics') === 'false') return;
    isRunning = true;

    var layer = getOrCreateLayer();
    layer.innerHTML = '';

    for (var i = 0; i < 3; i++) {
      (function (idx) {
        setTimeout(function () {
          spawnCloud();
        }, idx * 3000 + Math.random() * 4000);
      })(i);
    }

    scheduleNext();
  };

  window.stopClouds = function () {
    isRunning = false;
    if (spawnTimer) {
      clearTimeout(spawnTimer);
      spawnTimer = null;
    }
    activeClouds.forEach(function (c) { c.active = false; });
    activeClouds = [];
    var layer = document.querySelector('.cloud-layer');
    if (layer) layer.innerHTML = '';
  };
})();
