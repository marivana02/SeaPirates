    /* ══════════════════════════════════════════════
       SES / AMBIENT SİSTEMİ
    ══════════════════════════════════════════════ */
    const audioPool = {};

    function getAudio(src, vol) {
      if (!audioPool[src]) audioPool[src] = [];
      const pool = audioPool[src];
      let a = pool.find(a => a.ended || a.paused);
      if (!a) {
        a = new Audio(src);
        a.volume = vol;
        pool.push(a);
      }
      return a;
    }

    function playSound(name) {
      if (localStorage.getItem('sp_setting_sound') === 'false') return;
      try {
        const a = name === 'firePlayer' ? getAudio('assets/audio/sounds/cannonfire1.mp3', 0.35)
               : name === 'fireNpc' ? getAudio('assets/audio/sounds/cannonfire2.mp3', 0.15)
               : name === 'explosion' ? getAudio('assets/audio/sounds/explosion.mp3', 0.45)
               : null;
        if (!a) return;
        a.currentTime = 0;
        a.play().catch(e => {});
      } catch(e) {}
    }

    function playFireSound(durationSec = 1.3) {
      if (localStorage.getItem('sp_setting_sound') === 'false') return;
      try {
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 1. Noise Generator (Brown + White noise mix)
        const bufSize = Math.floor(actx.sampleRate * durationSec);
        const buf = actx.createBuffer(1, bufSize, actx.sampleRate);
        const data = buf.getChannelData(0);
        
        let lastOut = 0.0;
        for (let i = 0; i < bufSize; i++) {
          const white = Math.random() * 2 - 1;
          // Brown noise filter (leaky integrator)
          const brown = (lastOut + (0.02 * white)) / 1.02;
          lastOut = brown;
          // Mix brown (deep rumble) and white (high hiss) noise
          data[i] = (brown * 3.5 * 0.7) + (white * 0.3);
        }
        
        const noiseNode = actx.createBufferSource();
        noiseNode.buffer = buf;
        
        // 2. Filter with Modulation
        const filter = actx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, actx.currentTime);
        // Modulate filter frequency to create a roaring effect
        filter.frequency.linearRampToValueAtTime(700, actx.currentTime + 0.2);
        
        // Create an LFO to modulate filter frequency for turbulent flame sound
        const lfo = actx.createOscillator();
        lfo.frequency.value = 8; // 8 Hz rumble
        const lfoGain = actx.createGain();
        lfoGain.gain.value = 150; // modulate by +/- 150Hz
        
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        
        // 3. Gain Envelope
        const mainGain = actx.createGain();
        mainGain.gain.setValueAtTime(0.001, actx.currentTime);
        // Fade in
        mainGain.gain.linearRampToValueAtTime(0.35, actx.currentTime + 0.15);
        // Sustain & slight decay
        mainGain.gain.setValueAtTime(0.35, actx.currentTime + durationSec - 0.3);
        // Fade out
        mainGain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + durationSec);
        
        // 4. Sub-bass Dragon Roar Oscillator (Triangle wave at 65Hz)
        const subOsc = actx.createOscillator();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(65, actx.currentTime);
        subOsc.frequency.exponentialRampToValueAtTime(45, actx.currentTime + 0.5);
        
        const subGain = actx.createGain();
        subGain.gain.setValueAtTime(0.2, actx.currentTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.5);
        
        subOsc.connect(subGain);
        subGain.connect(actx.destination);
        
        // Connect noise
        noiseNode.connect(filter);
        filter.connect(mainGain);
        mainGain.connect(actx.destination);
        
        // Start sources
        noiseNode.start();
        subOsc.start();
        
        // Stop LFO and sources
        setTimeout(() => {
          try {
            noiseNode.stop();
            subOsc.stop();
            lfo.stop();
            actx.close();
          } catch(e) {}
        }, durationSec * 1000 + 100);
        
      } catch(e) {}
    }


    const gCanvas = document.getElementById('gulle-canvas');
    const gCtx = gCanvas ? gCanvas.getContext('2d') : null;
    let gProj = [];
    let gParts = [];
    gParts._rawPush = Array.prototype.push;
    gParts.push = function(...args) {
      if (localStorage.getItem('sp_setting_particles') === 'false') return this.length;
      return this._rawPush(...args);
    };

    function resizeCanvas() {
      const bf = document.getElementById('battlefield');
      if (!gCanvas || !bf) return;
      gCanvas.width = bf.clientWidth;
      gCanvas.height = bf.clientHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    function triggerScreenShake(intensity = 8, duration = 400) {
      // no-op (titreme tamamen kaldırıldı)
    }

    /* Offscreen gülle görselleri */
    const GULLE_OS = {};

    function buildMisket() {
      const os = document.createElement('canvas');
      os.width = os.height = 32;
      const c = os.getContext('2d');
      const cx = 16, cy = 16, r = 10;
      c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 4; c.shadowOffsetX = 1; c.shadowOffsetY = 2;
      const g = c.createRadialGradient(cx - 3, cy - 3, 0.5, cx, cy, r);
      g.addColorStop(0, '#a8a89a');
      g.addColorStop(0.3, '#6a6a60');
      g.addColorStop(0.7, '#3a3a32');
      g.addColorStop(1, '#111108');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
      // Texture çizgiler
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        c.save(); c.translate(cx, cy); c.rotate(a);
        c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * 0.3, 0, 0, r); c.stroke();
        c.restore();
      }
      // Parlama
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.beginPath(); c.arc(cx - 4, cy - 4, 2.5, 0, Math.PI * 2); c.fill();
      return os;
    }

    function buildOyuk() {
      const os = document.createElement('canvas');
      os.width = os.height = 32;
      const c = os.getContext('2d');
      const cx = 16, cy = 16, r = 10;
      c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowBlur = 4; c.shadowOffsetX = 1; c.shadowOffsetY = 2;
      const g = c.createRadialGradient(cx - 3, cy - 3, 0.5, cx, cy, r);
      g.addColorStop(0, '#c8a878');
      g.addColorStop(0.3, '#8a6840');
      g.addColorStop(0.7, '#5a3a18');
      g.addColorStop(1, '#1a0e04');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
      // Delik
      const hx = cx + 3, hy = cy - 1, hr = 3.5;
      c.fillStyle = '#1a1a1a';
      c.strokeStyle = 'rgba(120,90,50,0.6)'; c.lineWidth = 0.8;
      c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI * 2); c.fill(); c.stroke();
      const ih = c.createRadialGradient(hx, hy, 0, hx, hy, hr);
      ih.addColorStop(0, '#000'); ih.addColorStop(1, '#111');
      c.fillStyle = ih;
      c.beginPath(); c.arc(hx, hy, hr - 0.5, 0, Math.PI * 2); c.fill();
      // Parlama
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.arc(cx - 4, cy - 4, 2, 0, Math.PI * 2); c.fill();
      return os;
    }

    function buildElit() {
      const os = document.createElement('canvas');
      os.width = os.height = 40;
      const c = os.getContext('2d');
      const cx = 20, cy = 20, r = 11;
      // Corona
      const cor = c.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.6);
      cor.addColorStop(0, 'rgba(255,180,0,0.3)'); cor.addColorStop(1, 'rgba(255,80,0,0)');
      c.fillStyle = cor;
      c.beginPath(); c.arc(cx, cy, r * 1.6, 0, Math.PI * 2); c.fill();
      c.shadowColor = 'rgba(255,160,0,0.5)'; c.shadowBlur = 8;
      const g = c.createRadialGradient(cx - 3, cy - 3, 0.5, cx, cy, r);
      g.addColorStop(0, '#777760');
      g.addColorStop(0.4, '#333320');
      g.addColorStop(1, '#0d0d05');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      // Altın şerit
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
      c.strokeStyle = 'rgba(255,200,30,0.85)'; c.lineWidth = 2;
      c.shadowColor = '#ffd700'; c.shadowBlur = 5;
      c.beginPath(); c.ellipse(cx, cy, r, r * 0.22, Math.PI * 0.15, 0, Math.PI * 2); c.stroke();
      c.restore();
      // Parlama
      c.fillStyle = 'rgba(255,255,200,0.55)';
      c.beginPath(); c.arc(cx - 4, cy - 5, 3, 0, Math.PI * 2); c.fill();
      return os;
    }

    function buildFireGulle() {
      const os = document.createElement('canvas');
      os.width = os.height = 44;
      const c = os.getContext('2d');
      const cx = 22, cy = 22, r = 11;
      // Outer glow
      const glow = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.2);
      glow.addColorStop(0, 'rgba(255,200,50,0.35)');
      glow.addColorStop(0.4, 'rgba(255,80,0,0.15)');
      glow.addColorStop(1, 'rgba(255,0,0,0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(cx, cy, r * 2.2, 0, Math.PI * 2); c.fill();
      // Core fire
      c.shadowColor = '#ff4400'; c.shadowBlur = 14;
      const g = c.createRadialGradient(cx - 2, cy - 3, 0.5, cx, cy, r);
      g.addColorStop(0, '#fff8e0');
      g.addColorStop(0.15, '#ffdd44');
      g.addColorStop(0.4, '#ff8800');
      g.addColorStop(0.7, '#cc3300');
      g.addColorStop(1, '#440000');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      // Flame cracks
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 / 5) * i + Math.random() * 0.5;
        const len = r * (0.5 + Math.random() * 0.4);
        c.save(); c.translate(cx, cy); c.rotate(a);
        c.fillStyle = 'rgba(255,200,50,0.5)';
        c.beginPath(); c.ellipse(len * 0.3, -r * 0.9, 2, 4, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,80,0,0.35)';
        c.beginPath(); c.ellipse(len * 0.5, -r * 0.7, 1.5, 3, 0.3, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      // Bright core
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.arc(cx - 3, cy - 4, 3, 0, Math.PI * 2); c.fill();
      return os;
    }

    GULLE_OS[1] = buildMisket();
    GULLE_OS[2] = buildOyuk();
    GULLE_OS[3] = buildElit();
    GULLE_OS[4] = buildFireGulle();

    function buildTiamatBreath() {
      const W = 72, H = 36;
      const os = document.createElement('canvas');
      os.width = W; os.height = H;
      const c = os.getContext('2d');
      const cx = 8, cy = 18;
      const r = 9;
      const glow = c.createRadialGradient(cx, cy, 1, cx, cy, r * 3);
      glow.addColorStop(0, 'rgba(255,220,100,0.5)');
      glow.addColorStop(0.2, 'rgba(255,150,0,0.25)');
      glow.addColorStop(0.5, 'rgba(200,30,0,0.1)');
      glow.addColorStop(1, 'rgba(100,0,0,0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(cx, cy, r * 3, 0, Math.PI * 2); c.fill();
      c.shadowColor = '#ff2200'; c.shadowBlur = 14;
      const g = c.createRadialGradient(cx - 1, cy - 2, 0.5, cx, cy, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.1, '#fffce0');
      g.addColorStop(0.25, '#ffdd44');
      g.addColorStop(0.5, '#ff8800');
      g.addColorStop(0.75, '#cc2200');
      g.addColorStop(1, '#440000');
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
      for (let i = 0; i < 4; i++) {
        const a = -0.4 + (0.8 / 3) * i + Math.random() * 0.2;
        const len = r * (0.4 + Math.random() * 0.4);
        c.save(); c.translate(cx, cy); c.rotate(a);
        c.fillStyle = 'rgba(255,200,50,' + (0.3 + Math.random() * 0.2) + ')';
        c.beginPath(); c.ellipse(len * 0.3 + 4, -r * 0.8, 4, 2.5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,80,0,' + (0.2 + Math.random() * 0.15) + ')';
        c.beginPath(); c.ellipse(len * 0.6 + 8, -r * 0.6, 5, 2, 0.3, 0, Math.PI * 2); c.fill();
        c.restore();
      }
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.beginPath(); c.arc(cx - 2, cy - 3, 3, 0, Math.PI * 2); c.fill();
      return os;
    }

    GULLE_OS[5] = buildTiamatBreath();
    const GULLE_SIZE = { 1: 5, 2: 5, 3: 7, 4: 8, 5: 12 };

    /* Gemi merkez noktasını al */
    function getShipCenter(nodeId) {
      const bf = document.getElementById('battlefield');
      const node = document.getElementById(nodeId);
      const img = node ? node.querySelector('.ship-img') : null;
      const br = bf.getBoundingClientRect();
      const nr = img ? img.getBoundingClientRect() : (node ? node.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 });
      
      const isWeeklyBoss = localStorage.getItem('sp_combat_is_weekly_boss') === 'true';
      const isAdmiral = npc && npc.name && npc.name.includes('Admiral');
      const isTiamatCenter = localStorage.getItem('sp_combat_is_tiamat') === 'true';
      
      let yFactor = 0.5;
      if (nodeId === 'npc-node') {
        if (isWeeklyBoss) {
          yFactor = 0.55;
        } else if (isAdmiral) {
          yFactor = 0.5;
        } else if (isTiamatCenter) {
          yFactor = 0.58;
        }
      }
      
      return {
        x: nr.left - br.left + nr.width * 0.5,
        y: nr.top - br.top + nr.height * yFactor
      };
    }



    /* Bezier arc */
    function bezier(t, sx, sy, cx2, cy2, ex, ey) {
      return {
        x: (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx2 + t * t * ex,
        y: (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy2 + t * t * ey
      };
    }

    /* Salvo ateşi */
    function fireSalvo(fromId, toId, ammoType, count, delay) {
      let from = getShipCenter(fromId);
      const to = getShipCenter(toId);
      // Tiamat'ın ağzından ateş çıksın
      const isTiamatFiring = fromId === 'npc-node' && localStorage.getItem('sp_combat_is_tiamat') === 'true';
      if (isTiamatFiring) {
        const npcNode = document.getElementById('npc-node');
        const br = document.getElementById('battlefield').getBoundingClientRect();
        
        // 36-frame coordinate offsets relative to 220x220 canvas size
        const TIAMAT_MOUTH_OFFSETS = [
          {x: 77.2, y: 157.6}, {x: 77.2, y: 157.6}, {x: 77.2, y: 157.6}, {x: 77.2, y: 157.6}, {x: 77.2, y: 157.6}, {x: 77.2, y: 157.6}, {x: 77.2, y: 157.6}, 
          {x: 78.3, y: 156.3}, {x: 79.3, y: 154.9}, {x: 80.4, y: 153.7}, {x: 81.4, y: 152.4}, {x: 82.4, y: 151.0}, {x: 83.5, y: 149.8}, 
          {x: 84.3, y: 148.2}, {x: 85.0, y: 146.7}, {x: 85.8, y: 145.1}, {x: 86.6, y: 143.5}, {x: 87.4, y: 142.0}, {x: 88.2, y: 140.4}, 
          {x: 86.9, y: 140.4}, {x: 85.5, y: 140.4}, {x: 84.3, y: 140.4}, {x: 83.0, y: 140.4}, {x: 81.6, y: 140.4}, {x: 80.4, y: 140.4}, 
          {x: 80.0, y: 142.0}, {x: 79.9, y: 143.5}, {x: 79.6, y: 145.1}, {x: 79.3, y: 146.7}, {x: 79.1, y: 148.2}, {x: 78.8, y: 149.8}, 
          {x: 78.5, y: 151.0}, {x: 78.3, y: 152.4}, {x: 78.0, y: 153.7}, {x: 77.7, y: 154.9}, {x: 77.5, y: 156.3}
        ];

        function getMouthPos() {
          let mx = br.width * 0.8; // absolute fallback
          let my = br.height * 0.35;
          const tCanv = npcNode ? npcNode.querySelector('canvas.ship-img') : null;
          if (tCanv) {
            const nr = tCanv.getBoundingClientRect();
            if (nr.width > 10 && nr.height > 10) {
              const currentFrame = window.tiamatCurrentFrame || 0;
              const offset = TIAMAT_MOUTH_OFFSETS[currentFrame] || TIAMAT_MOUTH_OFFSETS[0];
              const scale = nr.width / 220;
              mx = nr.left - br.left + offset.x * scale;
              my = nr.top - br.top + offset.y * scale;
            } else {
              const wr = npcNode.getBoundingClientRect();
              mx = wr.left - br.left + wr.width * 0.32;
              my = wr.top - br.top + wr.height * 0.76;
            }
          } else {
            const wr = npcNode.getBoundingClientRect();
            mx = wr.left - br.left + wr.width * 0.32;
            my = wr.top - br.top + wr.height * 0.76;
          }
          return { x: mx, y: my };
        }

        const startFrom = getMouthPos();
        const BREATH_DURATION = 1300;
        
        playFireSound(BREATH_DURATION / 1000);

        const dx = to.x - startFrom.x;
        const dy = to.y - startFrom.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / dist;
        const uy = dy / dist;
        const px = -uy;
        const py = ux;
        const startTime = performance.now();

        const fireInterval = setInterval(() => {
          const elapsed = performance.now() - startTime;
          if (elapsed >= BREATH_DURATION) {
            clearInterval(fireInterval);
            const endFrom = getMouthPos();
            for (let fi = 0; fi < 5; fi++) {
              setTimeout(() => {
                if (!active) return;
                const bSpeed = 10 + Math.random() * 5;
                const bSpread = (Math.random() - 0.5) * 6;
                gParts.push({
                  x: endFrom.x + (Math.random() - 0.5) * 20,
                  y: endFrom.y + (Math.random() - 0.5) * 16,
                  vx: ux * bSpeed + px * bSpread,
                  vy: uy * bSpeed + py * bSpread,
                  radius: 12 + Math.random() * 6,
                  alpha: 1,
                  decay: 0.006 + Math.random() * 0.004,
                  color: 'rgba(255,220,50,',
                  isFlame: true,
                  growth: 0.12,
                  gravity: 0.03
                });
              }, fi * 120);
            }
            return;
          }

          const phase = elapsed / BREATH_DURATION;
          const intensity = phase < 0.1 ? phase * 10 : phase > 0.8 ? (1 - phase) / 0.2 : 1;
          const currentFrom = getMouthPos();

          // ön kıvılcım
          if (phase < 0.08 && Math.random() < 0.4) {
            gParts.push({
              x: currentFrom.x + (Math.random() - 0.5) * 6,
              y: currentFrom.y + (Math.random() - 0.5) * 6,
              vx: ux * (4 + Math.random() * 3) + px * (Math.random() - 0.5) * 2,
              vy: uy * (4 + Math.random() * 3) + py * (Math.random() - 0.5) * 2,
              radius: 4 + Math.random() * 4,
              alpha: 0.6,
              decay: 0.05 + Math.random() * 0.03,
              color: 'rgba(180,170,150,',
              isFlame: false,
              growth: 0.2,
              gravity: -0.01
            });
          }

          // ana alev
          const pCount = Math.round(2 + 3 * intensity + Math.random() * 2);
          for (let i = 0; i < pCount; i++) {
            const speed = 12 + Math.random() * 12 * intensity;
            const spread = (Math.random() - 0.5) * (3 + 2 * (1 - intensity));
            const sx = currentFrom.x + (Math.random() - 0.5) * 10 + (Math.random() - 0.5) * 6;
            const sy = currentFrom.y + (Math.random() - 0.5) * 10 + (Math.random() - 0.5) * 6;
            const travelTime = dist / (speed + 0.1);
            const decay = 1 / (travelTime + Math.random() * 4);
            const colors = ['rgba(255,255,255,', 'rgba(255,230,60,', 'rgba(255,120,0,', 'rgba(200,40,0,'];
            const color = colors[Math.random() < 0.15 ? 0 : Math.random() < 0.4 ? 1 : Math.random() < 0.8 ? 2 : 3];
            gParts.push({
              x: sx, y: sy, vx: ux * speed + px * spread, vy: uy * speed + py * spread,
              radius: 4 + Math.random() * 5.5,
              alpha: 0.8 + Math.random() * 0.2,
              decay: decay * (0.85 + Math.random() * 0.3),
              color, isFlame: true,
              growth: 0.14 + Math.random() * 0.16,
              gravity: -0.01 + Math.random() * 0.02
            });
          }
        }, 20);
        return;
      }
      const cx2 = (from.x + to.x) / 2 + (Math.random() - 0.5) * 20;
      const cy2 = (from.y + to.y) / 2 - 60;

      const soundName = fromId === 'player-node' ? 'firePlayer' : 'fireNpc';
      playSound(soundName); // Salvo başına sadece tek 1 defa top atış sesi çalsın

      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const spread = (Math.random() - 0.5) * 18;
          gProj.push({
            ammo: ammoType,
            sx: from.x, sy: from.y,
            ex: to.x, ey: to.y,
            cx2: cx2 + spread, cy2: cy2,
            startTime: performance.now(),
            duration: isTiamatFiring ? 700 : 1500,
            done: false
          });
          if (isTiamatFiring) {
            for (let e = 0; e < 2; e++) {
              const eAngle = Math.random() * Math.PI * 2;
              const eSpeed = 0.6 + Math.random() * 1.0;
              gParts.push({
                x: from.x + (Math.random() - 0.5) * 6,
                y: from.y + (Math.random() - 0.5) * 6,
                vx: Math.cos(eAngle) * eSpeed,
                vy: Math.sin(eAngle) * eSpeed,
                radius: 0.4 + Math.random() * 0.6,
                alpha: 0.7 + Math.random() * 0.3,
                decay: 0.03 + Math.random() * 0.03,
                color: ['rgba(255,200,50,', 'rgba(255,100,0,'][Math.floor(Math.random() * 2)],
                isEmber: true,
                gravity: 0.04
              });
            }
          }
        }, i * delay);
      }
    }

    /* Gülle çizim */
    function drawGulle(ammo, x, y, t, sx, sy) {
      const os = GULLE_OS[ammo];
      const size = GULLE_SIZE[ammo];
      gCtx.save();

      gCtx.translate(x, y);

      if (ammo === 3) {
        const pulse = 0.6 + Math.sin(t * Math.PI * 14) * 0.4;
        gCtx.shadowColor = '#ffd700';
        gCtx.shadowBlur = 10 * pulse;
        gCtx.rotate(t * Math.PI * 5);
        gCtx.strokeStyle = `rgba(255,190,0,${0.35 * pulse})`;
        gCtx.lineWidth = 1;
        gCtx.beginPath(); gCtx.arc(0, 0, size * 0.9, 0, Math.PI * 1.5); gCtx.stroke();
        gCtx.rotate(-t * Math.PI * 5);
        } else if (ammo === 4) {
          const pulse = 0.7 + Math.sin(t * Math.PI * 12) * 0.3;
          gCtx.shadowColor = '#ff2200';
          gCtx.shadowBlur = 22 * pulse;
          gCtx.rotate(t * Math.PI * 4);
          gCtx.strokeStyle = `rgba(255,150,0,${0.5 * pulse})`;
          gCtx.lineWidth = 2.5;
          gCtx.beginPath(); gCtx.arc(0, 0, size * 1.1, 0, Math.PI * 0.9); gCtx.stroke();
          gCtx.strokeStyle = `rgba(255,50,0,${0.3 * pulse})`;
          gCtx.lineWidth = 1.5;
          gCtx.beginPath(); gCtx.arc(0, 0, size * 1.35, Math.PI * 0.3, Math.PI * 1.2); gCtx.stroke();
          gCtx.rotate(-t * Math.PI * 4);
          gCtx.shadowColor = '#ff6600';
          gCtx.shadowBlur = 8;
        } else if (ammo === 5) {
          // Tiamat ateş topu — parlayan ateş küresi
          const pulse = 0.8 + Math.sin(t * Math.PI * 18) * 0.2;
          gCtx.shadowColor = '#ff4400';
          gCtx.shadowBlur = 20 * pulse;
        } else {
        gCtx.shadowColor = 'rgba(0,0,0,0.5)';
        gCtx.shadowBlur = 4;
      }

      gCtx.drawImage(os, -size, -size, size * 2, size * 2);
      gCtx.restore();
    }

    /* Çarpma anında kıvılcım/patlama efektleri */
    function createExplosion(x, y, ammo) {
      let count, speedRange, radiusRange, decayRange, colors, useGravity;
      if (ammo === 5) {
        count = 18 + Math.floor(Math.random() * 8);
        speedRange = [1.5, 3.0];
        radiusRange = [1.5, 3.0];
        decayRange = [0.02, 0.04];
        colors = ['rgba(255,255,200,', 'rgba(255,200,50,', 'rgba(255,150,0,', 'rgba(255,80,0,', 'rgba(200,30,0,'];
        useGravity = 0.03;
      } else if (ammo === 4) {
        count = 12 + Math.floor(Math.random() * 6);
        speedRange = [1.2, 2.5];
        radiusRange = [1.2, 2.5];
        decayRange = [0.025, 0.045];
        colors = ['rgba(255,200,50,', 'rgba(255,150,0,', 'rgba(255,80,0,', 'rgba(200,30,0,'];
        useGravity = 0.04;
      } else {
        count = 4 + Math.floor(Math.random() * 3);
        speedRange = [0.6, 1.5];
        radiusRange = [0.8, 1.8];
        decayRange = [0.05, 0.09];
        colors = null;
        useGravity = 0.08;
      }

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
        
        let color;
        if (colors) {
          color = colors[Math.floor(Math.random() * colors.length)];
        } else {
          if (ammo === 3) color = 'rgba(255, 215, 0, ';
          else if (ammo === 2) color = 'rgba(210, 135, 55, ';
          else color = 'rgba(230, 95, 20, ';
        }

        // Embers for ammo 4
        const isEmber = (ammo === 4 || ammo === 5) && Math.random() > 0.55;
        
        gParts.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (ammo === 4 ? 0.8 : 0.4),
          radius: (isEmber ? 0.5 : radiusRange[0] + Math.random() * (radiusRange[1] - radiusRange[0])),
          alpha: 1.0,
          decay: decayRange[0] + Math.random() * (decayRange[1] - decayRange[0]),
          color: color,
          isEmber: !!isEmber,
          gravity: useGravity
        });
      }
    }

    /* Ana canvas döngüsü */
    function gLoop() {
      gCtx.clearRect(0, 0, gCanvas.width, gCanvas.height);

      const now = performance.now();
      const playerCenter = getShipCenter('player-node');
      
      // Gülleler
      for (let i = gProj.length - 1; i >= 0; i--) {
        const p = gProj[i];
        if (p.done) { gProj.splice(i, 1); continue; }

        const elapsed = now - p.startTime;
        const t = Math.min(1.0, elapsed / p.duration); // Delta-time bazlı t hesabı

        if (t >= 1.0) {
          p.done = true;
          createExplosion(p.ex, p.ey, p.ammo);
          // patlama anında ekran titremesi kaldırıldı
          continue;
        }

        const pos = p.ammo === 5
          ? { x: p.sx + (p.ex - p.sx) * t, y: p.sy + (p.ey - p.sy) * t }
          : bezier(t, p.sx, p.sy, p.cx2, p.cy2, p.ex, p.ey);

        // İz
        for (let k = 1; k <= 4; k++) {
          const tp = Math.max(0, t - k * 0.03);
          const tp2 = p.ammo === 5
            ? { x: p.sx + (p.ex - p.sx) * tp, y: p.sy + (p.ey - p.sy) * tp }
            : bezier(tp, p.sx, p.sy, p.cx2, p.cy2, p.ex, p.ey);
          gCtx.save();
          gCtx.globalAlpha = (0.15 - k * 0.03) * (1 - t * 0.5);
          
          if (p.ammo === 4) {
            gCtx.fillStyle = `rgba(255,${150 - k * 30},0,${(0.35 - k * 0.06) * (1 - t * 0.4)})`;
            gCtx.shadowColor = '#ff4400';
            gCtx.shadowBlur = 6;
          } else if (p.ammo === 5) {
            gCtx.fillStyle = `rgba(255,${200 - k * 40},${40 - k * 10},${(0.45 - k * 0.08) * (1 - t * 0.3)})`;
            gCtx.shadowColor = '#ff2200';
            gCtx.shadowBlur = 8;
          } else if (p.ammo === 3) {
            gCtx.fillStyle = '#ffa500';
            gCtx.shadowColor = '#ffd700';
            gCtx.shadowBlur = 4;
          } else {
            gCtx.fillStyle = '#888';
            gCtx.shadowColor = '#555';
            gCtx.shadowBlur = 1;
          }
          
          gCtx.beginPath();
          gCtx.arc(tp2.x, tp2.y, Math.max(1, (GULLE_SIZE[p.ammo] - 2) * (1 - k * 0.15)), 0, Math.PI * 2);
          gCtx.fill();
          gCtx.restore();
        }

        drawGulle(p.ammo, pos.x, pos.y, t, p.sx, p.sy);

        // Tiamat ateş topu uçuşu — hafif kıvılcım izi
        if (p.ammo === 5 && Math.random() > 0.5) {
          gParts.push({
            x: pos.x + (Math.random() - 0.5) * 8,
            y: pos.y + (Math.random() - 0.5) * 8,
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6 - 0.3,
            radius: 0.4 + Math.random() * 0.8,
            alpha: 0.7 + Math.random() * 0.3,
            decay: 0.03 + Math.random() * 0.03,
            color: ['rgba(255,200,50,', 'rgba(255,100,0,'][Math.floor(Math.random() * 2)],
            isEmber: true,
            gravity: 0.03
          });
        }
      }

      // Tiamat yarı can yanma kıvılcımları
      if (window._tiamatBurning && Math.random() > 0.35) {
        const npcNode = document.getElementById('npc-node');
        const tCanv = npcNode ? npcNode.querySelector('.ship-img') : null;
        if (tCanv) {
          const nr = tCanv.getBoundingClientRect();
          const br = document.getElementById('battlefield').getBoundingClientRect();
          const bx = nr.left - br.left, by = nr.top - br.top;
          for (let e = 0; e < 3; e++) {
            gParts.push({
              x: bx + 30 + Math.random() * 160,
              y: by + 30 + Math.random() * 80,
              vx: (Math.random() - 0.5) * 0.6,
              vy: -0.5 - Math.random() * 1.0,
              radius: 0.3 + Math.random() * 0.7,
              alpha: 0.5 + Math.random() * 0.5,
              decay: 0.015 + Math.random() * 0.02,
              color: ['rgba(255,200,50,', 'rgba(255,100,0,', 'rgba(200,50,0,'][Math.floor(Math.random() * 3)],
              isEmber: true,
              gravity: -0.02
            });
          }
        }
      }

      // Parçacıklar (Patlama efektleri)
      for (let i = gParts.length - 1; i >= 0; i--) {
        const pt = gParts[i];
        pt.x += pt.vx;
        pt.y += pt.vy;

        // Tiamat alevlerinin oyuncu gemisine çarptığını kontrol et
        if (pt.isFlame && pt.vx < 0 && playerCenter) {
          const dx = pt.x - playerCenter.x;
          const dy = pt.y - playerCenter.y;
          const distToPlayer = Math.sqrt(dx * dx + dy * dy);
          if (distToPlayer < 45) {
            // Çarpma anında kıvılcım (splash) saç
            const splashCount = Math.random() < 0.35 ? 2 : 1;
            for (let k = 0; k < splashCount; k++) {
              gParts.push({
                x: pt.x,
                y: pt.y,
                vx: 2 + Math.random() * 5, // sağa doğru sıçrasın (splash back)
                vy: (Math.random() - 0.5) * 6,
                radius: 1.5 + Math.random() * 2,
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.025,
                color: Math.random() < 0.65 ? 'rgba(255,200,50,' : 'rgba(255,100,0,',
                isEmber: true,
                gravity: 0.04 + Math.random() * 0.03
              });
            }
            pt.alpha = 0; // alevi söndür
          }
        }

        if (pt.growth) pt.radius += pt.growth;
        pt.vy += pt.gravity !== undefined ? pt.gravity : 0.08;
        pt.vx *= 0.98;
        pt.alpha -= pt.decay;
        
        if (pt.alpha <= 0) {
          gParts.splice(i, 1);
          continue;
        }

        gCtx.save();
        gCtx.globalAlpha = pt.alpha;
        gCtx.fillStyle = pt.color + pt.alpha + ')';
        
        if (pt.isEmber) {
          gCtx.shadowColor = '#ff4400';
          gCtx.shadowBlur = 3;
          gCtx.fillStyle = '#ffaa33';
          gCtx.globalAlpha = pt.alpha * 0.8;
          gCtx.beginPath(); gCtx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); gCtx.fill();
        } else if (pt.isFlame) {
          gCtx.shadowColor = 'rgba(230, 60, 0, 0.4)';
          gCtx.shadowBlur = 8 * pt.alpha;
          
          const grad = gCtx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.radius * 2.0);
          if (pt.color.includes('255,255,255')) { // Core hot yellow/white
            grad.addColorStop(0, 'rgba(255,255,200,' + pt.alpha + ')');
            grad.addColorStop(0.3, 'rgba(255,160,0,' + pt.alpha * 0.8 + ')');
            grad.addColorStop(0.8, 'rgba(200,50,0,' + pt.alpha * 0.3 + ')');
            grad.addColorStop(1, 'rgba(120,20,0,0)');
          } else if (pt.color.includes('255,230,60')) { // Yellow-Orange
            grad.addColorStop(0, 'rgba(255,200,50,' + pt.alpha + ')');
            grad.addColorStop(0.4, 'rgba(230,80,0,' + pt.alpha * 0.7 + ')');
            grad.addColorStop(1, 'rgba(150,20,0,0)');
          } else if (pt.color.includes('255,120,0')) { // Orange
            grad.addColorStop(0, 'rgba(240,100,0,' + pt.alpha + ')');
            grad.addColorStop(0.5, 'rgba(180,30,0,' + pt.alpha * 0.6 + ')');
            grad.addColorStop(1, 'rgba(90,10,0,0)');
          } else { // Red / Smoke
            grad.addColorStop(0, 'rgba(180,30,0,' + pt.alpha * 0.8 + ')');
            grad.addColorStop(0.6, 'rgba(80,10,5,' + pt.alpha * 0.4 + ')');
            grad.addColorStop(1, 'rgba(40,5,2,0)');
          }
          
          gCtx.fillStyle = grad;
          gCtx.beginPath();
          gCtx.arc(pt.x, pt.y, pt.radius * 2.2, 0, Math.PI * 2);
          gCtx.fill();
        } else if (pt.color.includes('255,200') || pt.color.includes('255,215') || pt.color.includes('255,')) {
          gCtx.shadowColor = '#ffd700';
          gCtx.shadowBlur = 5;
          gCtx.beginPath(); gCtx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); gCtx.fill();
        } else {
          gCtx.shadowColor = pt.color.includes('220') ? '#ff2200' : 'transparent';
          gCtx.shadowBlur = pt.color.includes('220') ? 3 : 0;
          gCtx.beginPath(); gCtx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2); gCtx.fill();
        }
        
        gCtx.restore();
      }

      requestAnimationFrame(gLoop);
    }
    requestAnimationFrame(gLoop);

    /* ══════════════════════════════════════════════
       OYUN STATE
    ══════════════════════════════════════════════ */
    let active = true;

    const savedAmmo = parseInt(localStorage.getItem('sp_selected_ammo')) || 1;
    const savedBarut = localStorage.getItem('sp_use_barut') === 'true';
    const savedZirh = localStorage.getItem('sp_use_zirh') === 'true';

    var player = {
      name: 'Kaptan',
      hp: 15000, maxHp: 15000,
      ammo: savedAmmo, barut: savedBarut, zirh: savedZirh
    };

    var isWeeklyBoss = false;
    var isTiamat = false;
    const npcNameEl = document.getElementById('npc-name');
    var npc = { name: '', img: '', hp: 0, maxHp: 0 };

    async function fetchPlayerData() {
      try {
        const res = await fetch((window.__API_URL__ || window.location.origin) + '/api/player/me', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('sp_token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          player.name = data.display_name || data.username;
          document.getElementById('player-name').textContent = player.name;
          document.getElementById('player-pid').textContent = `#ID:${data.id}`;
          
          // Ana rütbe ikonu (sol)
          const rankLeftEl = document.getElementById('player-rank-left');
          if (rankLeftEl) {
            const rankSrc = `assets/ui/rank/rank${data.rankBadge || 13}.png`;
            rankLeftEl.src = rankSrc;
            rankLeftEl.title = data.rankName || 'Kara Adamı';
            rankLeftEl.classList.remove('hidden');
          }
          // PvP rütbe ikonu (sağ)
          const rankRightEl = document.getElementById('player-rank-right');
          if (rankRightEl) {
            if (data.pvpRankBadge) {
              rankRightEl.src = `assets/ui/pvp-badges/${data.pvpRankBadge}.png`;
              rankRightEl.title = data.pvpRankName || '';
              rankRightEl.classList.remove('hidden');
            } else {
              rankRightEl.classList.add('hidden');
            }
          }

          // Seçilen Elit Gemi görselinin savaş açısına (3.png veya 11.png) göre dinamik uygulanması
          const shipLvl = parseInt(data.ship_level) || 0;
          const visLvl = data.visual_ship_level != null ? parseInt(data.visual_ship_level) : null;
          const displayLvl = (visLvl != null && visLvl >= 0) ? visLvl : shipLvl;
          const activeDesign = data.active_design;
          const currentHpPct = (data.hp / data.max_hp) * 100;
          const targetImageName = (currentHpPct <= 50) ? '11.png' : '3.png';
          
          let shipImgSrc;
          if (activeDesign) {
            const designFolder = activeDesign === 'kristal_queen' ? 'kristalquen' : activeDesign;
            shipImgSrc = `assets/items/shop/${designFolder}/${targetImageName}`;
          } else if (displayLvl > 0) {
            shipImgSrc = `assets/ships/elitship/elit${displayLvl}/images/${targetImageName}`;
          } else {
            shipImgSrc = `assets/ships/elitship/default/${targetImageName}`;
          }
          const playerShipImg = document.querySelector('.player-wrap .ship-img');
          if (playerShipImg) {
            playerShipImg.src = shipImgSrc;
          }

          // Envanter miktarlarını player nesnesine atalım
          player.ammoQtys = {};
          if (data.ammo) data.ammo.forEach(a => player.ammoQtys[a.ammo_type] = a.quantity);
          player.itemQtys = {};
          if (data.items) data.items.forEach(i => player.itemQtys[i.item_type] = i.quantity);

          // Sıfır olan barut/zırhların aktifliğini kapat
          if (!player.itemQtys['barut'] || player.itemQtys['barut'] === 0) {
            player.barut = false;
            localStorage.setItem('sp_use_barut', 'false');
          }
          if (!player.itemQtys['zirh'] || player.itemQtys['zirh'] === 0) {
            player.zirh = false;
            localStorage.setItem('sp_use_zirh', 'false');
          }

          if (typeof renderSlots === 'function') renderSlots();
        }
      } catch (e) { console.error(e); }
    }
    fetchPlayerData();

    refreshHP();

    /* HP */
    function hpColor(pct) {
      if (pct > 60) return 'linear-gradient(90deg,#1a7a2e,#27ae60,#2ecc71)';
      if (pct > 30) return 'linear-gradient(90deg,#7a5a00,#e6a817,#f1c40f)';
      if (pct > 15) return 'linear-gradient(90deg,#7a2500,#e05010,#e67e22)';
      return 'linear-gradient(90deg,#7a0a0a,#c0392b,#e74c3c)';
    }
    function refreshHP() {
      const isWeeklyBoss = localStorage.getItem('sp_combat_is_weekly_boss') === 'true';
      const pp = Math.max(0, player.hp / player.maxHp * 100);
      const np = isWeeklyBoss ? 100 : Math.max(0, npc.hp / npc.maxHp * 100);
      const pf = document.getElementById('player-hp-fill');
      const nf = document.getElementById('npc-hp-fill');
      pf.style.width = pp + '%'; pf.style.background = hpColor(pp);
      nf.style.width = np + '%'; nf.style.background = hpColor(np);
      document.getElementById('player-hp-txt').textContent = fmt(Math.ceil(player.hp)) + ' / ' + fmt(player.maxHp);
      
      if (isWeeklyBoss) {
        const bossDmg = Number(localStorage.getItem('sp_boss_dmg_dealt') || 0);
        document.getElementById('npc-hp-txt').textContent = 'Vurulan Hasar: ' + fmt(bossDmg);
      } else {
        document.getElementById('npc-hp-txt').textContent = fmt(Math.ceil(npc.hp)) + ' / ' + fmt(npc.maxHp);
      }

      // Tiamat yarı can yanma efekti
      if (isTiamat) {
        const npcCanvas = document.getElementById('npc-img');
        if (np <= 50) {
          if (!window._tiamatBurning) {
            window._tiamatBurning = true;
            if (npcCanvas && npcCanvas.style) {
              npcCanvas.style.boxShadow = 'inset 0 0 60px 30px rgba(255,0,0,0.4), 0 0 30px rgba(255,100,0,0.3)';
              npcCanvas.style.borderRadius = '50%';
            }
          }
        } else {
          if (window._tiamatBurning) {
            window._tiamatBurning = false;
            if (npcCanvas && npcCanvas.style) {
              npcCanvas.style.boxShadow = 'none';
              npcCanvas.style.borderRadius = '';
            }
          }
        }
      }

      // NPC Yelken Düşürme (HP <= 50% ise -> 9.png, aksi halde -> 1.png) veya Kule Hasarlı görseli - Darbe anında anlık geçiş
      const npcImg = document.getElementById('npc-img');
      if (npcImg && npcImg.src) {
        if (isWeeklyBoss || isTiamat) {
          // Boss hasar görsel geçişi yok
        } else if ((npc.isTower || npc.isPvP) && npc.fullImg) {
          const target = (np <= 50 && npc.damagedImg) ? npc.damagedImg : npc.fullImg;
          const targetUrl = new URL(target, window.location.origin).href;
          if (npcImg.src !== targetUrl) {
            npcImg.src = target;
            npcImg.style.transform = target === npc.damagedImg ? 'none' : 'scaleX(-1)';
          }
        } else {
          const parts = npcImg.src.split('/');
          const last = parts[parts.length - 1];
          const match = last.match(/^(\d+)\.png$/);
          if (match) {
            const isPvPMatch = npc.isPvP || localStorage.getItem('sp_combat_is_pvp') === 'true';
            const target = isPvPMatch ? ((np <= 50) ? '15.png' : '7.png') : ((np <= 50) ? '9.png' : '1.png');
            if (last !== target) {
              parts[parts.length - 1] = target;
              npcImg.src = parts.join('/');
            }
          }
        }
      }

      // Oyuncu Yelken Düşürme (HP <= 50% ise -> 11.png, aksi halde -> 3.png) - Darbe anında anlık geçiş
      const playerShipImg = document.querySelector('.player-wrap .ship-img');
      if (playerShipImg && playerShipImg.src) {
        const parts = playerShipImg.src.split('/');
        const last = parts[parts.length - 1];
        const match = last.match(/^(\d+)\.png$/);
        if (match) {
          const target = (pp <= 50) ? '11.png' : '3.png';
          if (last !== target) {
            parts[parts.length - 1] = target;
            playerShipImg.src = parts.join('/');
          }
        }
      }

      toggleSmoke('player-smoke', pp < 40);
      toggleSmoke('npc-smoke', np < 40);
      toggleFire('player-fire', pp <= 50);
      toggleFire('npc-fire', np <= 50);
    }

    function fmt(n) { return Number(n).toLocaleString('en-US'); }
    function toggleSmoke(id, on) { const el = document.getElementById(id); if (on) { el.classList.add('visible'); el.style.opacity = '1'; } else { el.classList.remove('visible'); el.style.opacity = '0'; } }
    function toggleFire(id, on) { const el = document.getElementById(id); if (el) { el.style.opacity = on ? '0.75' : '0'; } }

    /* Flash — küçük (Kullanıcı isteğiyle kapatıldı) */
    function flash(who) {
      // no-op
    }

    /* Hasar sayısı — geminin üstünde sabit, renk+ikon desteği */
    function spawnDmg(nodeId, amount, color, icon) {
      playSound('explosion'); // Gülle çarpma / patlama sesi!
      const parent = document.getElementById('battlefield');
      const pr = parent.getBoundingClientRect();
      let left, top;
      const isTiamatHit = nodeId === 'npc-node' && localStorage.getItem('sp_combat_is_tiamat') === 'true';
      if (isTiamatHit) {
        const cv = document.getElementById('npc-img');
        const cr = cv.getBoundingClientRect();
        left = cr.left - pr.left + cr.width * 0.5;
        top = cr.top - pr.top + cr.height * 0.35;
      } else {
        const node = document.getElementById(nodeId);
        const nr = node.getBoundingClientRect();
        left = nr.left - pr.left + nr.width * 0.5;
        top = nr.top - pr.top - 18;
      }
      const el = document.createElement('div');
      el.className = 'dmg-static';
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.innerHTML = (icon ? `<span class="dmg-icon">${icon}</span>` : '')
        + `<span class="dmg-val" style="color:${color}">${fmt(amount)}</span>`;
      parent.appendChild(el);
      setTimeout(() => el.remove(), 1600);
    }

    function playHitAnim(nodeId) {
      let imgEl;
      if (nodeId === 'npc-node') imgEl = document.getElementById('npc-img');
      else if (nodeId === 'player-node') imgEl = document.querySelector('.player-wrap .ship-img');
      if (!imgEl) return;
      const parent = document.getElementById('battlefield');
      const ir = imgEl.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      const animSize = Math.min(Math.round(Math.min(ir.width, ir.height) * 0.75), 80);
      const el = document.createElement('img');
      el.style.cssText = 'position:absolute;pointer-events:none;z-index:45;object-fit:contain;';
      el.style.left = Math.round(ir.left - pr.left + ir.width * 0.5 - animSize * 0.5) + 'px';
      el.style.top = Math.round(ir.top - pr.top + ir.height * 0.35 - animSize * 0.5) + 'px';
      el.style.width = animSize + 'px';
      el.style.height = animSize + 'px';
      parent.appendChild(el);
      const frames = [];
      for (let i = 1; i <= 47; i += 2) frames.push(i);
      let idx = 0;
      function nextFrame() {
        if (idx >= frames.length || !active) { el.remove(); return; }
        el.src = 'assets/effects/fight/atack/' + frames[idx] + '.png?' + Date.now();
        idx++;
        setTimeout(nextFrame, 40);
      }
      nextFrame();
    }

    /* Slot sistemi */
    const DEFAULT_SLOTS = [
      { type: 'ammo', ammo: 1, img: 'assets/items/shop/misketgülle.png', title: 'Grapeshot' },
      { type: 'ammo', ammo: 2, img: 'assets/items/shop/oyukgülle.png', title: 'Hollow Shot' },
      { type: 'ammo', ammo: 3, img: 'assets/items/shop/elitgülle.png', title: 'Elite Shot' },
      { type: 'buff', key: 'barut', img: 'assets/items/shop/barut-fight.png', title: 'Gunpowder' },
      { type: 'buff', key: 'zirh', img: 'assets/items/shop/zırh-fghit.png', title: 'Armor' },
      { type: 'empty' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }, { type: 'empty' }
    ];
    let slots;
try { slots = JSON.parse(localStorage.getItem('sp_slot_layout') || 'null'); } catch(e) { slots = null; }
    // Eğer eski, hatalı yerleşim localStorage'da kayıtlıysa veya başlık/görsel eşleşmiyorsa sıfırla/düzelt:
    let isSlotsValid = true;
    if (slots && Array.isArray(slots) && slots.length === 10) {
      slots.forEach(s => {
        if (s && s.img) {
          s.img = s.img.replace('assets/shop/', 'assets/items/shop/');
        }
        if (s && s.type === 'ammo') {
          if (s.ammo === 1 && (!s.title || !s.title.includes('Grape') || !s.img || !s.img.includes('misket'))) isSlotsValid = false;
          if (s.ammo === 2 && (!s.title || !s.title.includes('Hollow') || !s.img || !s.img.includes('oyuk'))) isSlotsValid = false;
          if (s.ammo === 3 && (!s.title || !s.title.includes('Elite') || !s.img || !s.img.includes('elit'))) isSlotsValid = false;
        }
      });
    } else {
      isSlotsValid = false;
    }

    if (!isSlotsValid) {
      slots = null;
      localStorage.removeItem('sp_slot_layout');
    }
    if (!slots) {
      slots = DEFAULT_SLOTS;
    }
    let selectedAmmo = player.ammo;
    function saveSlots() { localStorage.setItem('sp_slot_layout', JSON.stringify(slots)); }
    function formatCompactQty(n) {
      return n.toLocaleString('tr-TR');
    }
    function renderSlots() {
      const bar = document.getElementById('ammo-bar');
      bar.innerHTML = '';
      slots.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'slot';
        div.dataset.index = i;
        div.dataset.dragged = '0';
        div.title = s.title || '';
        div.style.touchAction = 'none';
        if (s.type !== 'empty') {
          if (s.type === 'ammo' && player.ammo === s.ammo) div.classList.add('sel-ammo');
          if (s.key === 'barut' && player.barut) div.classList.add('sel-buff');
          if (s.key === 'zirh' && player.zirh) div.classList.add('sel-buff');
          if (s.img) {
            let imgSrc = s.img;
            if (!imgSrc.includes('assets/')) imgSrc = 'assets/' + imgSrc;
            div.innerHTML = `<img src="${imgSrc}" draggable="false"/>`;
            let qty = 0;
            if (s.type === 'ammo' && player.ammoQtys) {
              qty = player.ammoQtys[s.ammo] || 0;
            } else if (s.type === 'buff' && player.itemQtys) {
              qty = player.itemQtys[s.key] || 0;
            }
            const b = document.createElement('div');
            const zeroCls = qty === 0 ? ' zero' : '';
            const infCls = qty >= 9000000 ? ' infinite' : '';
            b.className = 'qty' + zeroCls + infCls;
            b.textContent = qty >= 9000000 ? '∞' : formatCompactQty(qty);
            div.appendChild(b);
          }
          div.addEventListener('click', () => {
            if (div.dataset.dragged === '1') { div.dataset.dragged = '0'; return; }
            if (s.type === 'ammo') { 
              selectedAmmo = s.ammo; 
              player.ammo = s.ammo; 
              localStorage.setItem('sp_selected_ammo', s.ammo);
            }
            else if (s.type === 'buff') {
              const qty = player.itemQtys ? (player.itemQtys[s.key] || 0) : 0;
              if (qty <= 0) {
                // Miktar sıfırsa aktif edilmesine izin verilmez!
                player[s.key] = false;
                localStorage.setItem('sp_use_' + s.key, 'false');
                renderSlots();
                return;
              }
              if (s.key === 'barut') {
                player.barut = !player.barut;
                localStorage.setItem('sp_use_barut', player.barut);
              }
              if (s.key === 'zirh') {
                player.zirh = !player.zirh;
                localStorage.setItem('sp_use_zirh', player.zirh);
              }
            }
            renderSlots();
          });
        }
        div.addEventListener('pointerdown', (e) => {
          const fromIdx = parseInt(div.dataset.index);
          div.setPointerCapture(e.pointerId);
          let moved = false;
          function onMove(ev) { moved = true; const over = document.elementFromPoint(ev.clientX, ev.clientY); const os2 = over && over.closest('#ammo-bar .slot[data-index]'); document.querySelectorAll('#ammo-bar .slot').forEach(s2 => s2.classList.remove('drag-over')); if (os2 && os2 !== div) os2.classList.add('drag-over'); }
          function onUp(ev) { div.removeEventListener('pointermove', onMove); div.removeEventListener('pointerup', onUp); document.querySelectorAll('#ammo-bar .slot').forEach(s2 => s2.classList.remove('drag-over')); if (!moved) return; const over = document.elementFromPoint(ev.clientX, ev.clientY); const os2 = over && over.closest('#ammo-bar .slot[data-index]'); if (os2 && os2 !== div) { const toIdx = parseInt(os2.dataset.index);[slots[fromIdx], slots[toIdx]] = [slots[toIdx], slots[fromIdx]]; saveSlots(); renderSlots(); div.dataset.dragged = '1'; } }
          div.addEventListener('pointermove', onMove);
          div.addEventListener('pointerup', onUp);
        });
        bar.appendChild(div);
      });
    }
    renderSlots();

    /* Combat API */
    const ORIGIN = window.__API_URL__ || window.location.origin;
    var ATTACK_API_URL = ORIGIN + '/api/combat';
    const SHARED_API_URL = ORIGIN + '/api/combat';
    const token = localStorage.getItem('sp_token');
    if (!token) goTo('index.html');

    let attackInterval;
    let opponentInterval;
    let lastPlayerAttack = 0;
    let bossSocket = null;

    // ── MOBİL OPTİMİZASYON: Page Visibility API ──
    // Uygulama arka plana geçtiğinde (ekran kilitlendiğinde veya başka uygulamaya geçildiğinde)
    // gereksiz CPU ve batarya tüketimini önlemek için döngüleri durdurur.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (attackInterval) { clearInterval(attackInterval); attackInterval = null; }
        if (opponentInterval) { clearInterval(opponentInterval); opponentInterval = null; }
        // Animasyonlar requestAnimationFrame olduğu için zaten tarayıcı tarafından yavaşlatılır
      } else if (document.visibilityState === 'visible' && active) {
        // Geri gelindiğinde savaşı devam ettir (Sunucudan güncel durumu çekerek)
        fetchPlayerData();
        if (!attackInterval) attackInterval = setInterval(doAttack, player.cooldownMs || 4000);
        // Rakip saldırı aralığı sunucudan gelen veriye göre fetchPlayerData içinde veya doAttack'ta güncellenir
      }
    });

    function renderAdmiralLeaderboard(data) {
      npc.hp = data.bossHp;
      npc.maxHp = data.bossMaxHp;
      refreshHP();

      const listEl = document.getElementById('admiral-leaderboard-list');
      if (listEl && data.leaderboard) {
        listEl.innerHTML = '';
        data.leaderboard.slice(0, 30).forEach((row, idx) => {
          const isSelf = row.username === player.name;
          let shipIcon;
          if (row.active_design) {
            const designFolder = row.active_design === 'kristal_queen' ? 'kristalquen' : row.active_design;
            shipIcon = `assets/items/shop/${designFolder}/7.png`;
          } else {
            const cleanLvl = (row.ship_level >= 1 && row.ship_level <= 10) ? row.ship_level : (row.ship_level > 10 ? 10 : 0);
            const visLvl = row.visual_ship_level != null ? parseInt(row.visual_ship_level) : null;
            const displayLvl = (visLvl != null && visLvl >= 0 && visLvl <= 10) ? visLvl : cleanLvl;
            shipIcon = displayLvl > 0 
              ? `assets/ships/elitship/elit${displayLvl}/images/7.png` 
              : `assets/ships/elitship/default/7.png`;
          }
          
          const hpPct = Math.max(0, Math.min(100, (row.current_hp / row.max_hp) * 100));
          
          const rowHtml = `
            <div style="display: flex; align-items: center; gap: 8px; position: relative; padding: 5px 8px; border-radius: 6px; ${isSelf ? 'background: rgba(122, 74, 24, 0.45); border: 1.5px solid #d4af37;' : 'background: rgba(0, 0, 0, 0.55); border: 1.5px solid rgba(122, 74, 24, 0.5);'}">
              <span style="font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 900; color: ${idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#d2b48c'}; width: 14px; text-align: center; text-shadow: 1px 1px 2px #000;">${idx + 1}</span>
              <img src="${shipIcon}" style="width: 26px; height: 26px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));" />
              <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span style="font-family: 'Inter', sans-serif; font-size: 0.68rem; font-weight: 700; color: ${isSelf ? '#ffd700' : '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; text-shadow: 1px 1px 2px #000;">${row.username}</span>
                  <span style="font-family: 'Inter', sans-serif; font-size: 0.65rem; font-weight: 800; color: #ffd700; text-shadow: 1px 1px 2px #000;">${fmt(row.damage_dealt)}</span>
                </div>
                <div style="width: 100%; height: 4px; background: rgba(0, 0, 0, 0.85); border-radius: 2px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.85);">
                  <div style="width: ${hpPct}%; height: 100%; background: ${hpPct > 50 ? '#2e7d32' : hpPct > 20 ? '#f57f17' : '#c62828'}; transition: width 0.3s ease;"></div>
                </div>
              </div>
            </div>
          `;
          listEl.insertAdjacentHTML('beforeend', rowHtml);
        });
      }
      
      if (data.bossHp <= 0 && active) {
        active = false;
        clearInterval(attackInterval);
        endFight(true, { gold: 0, pearl: 0, xp: 0 });
      }
    }

    async function fetchAdmiralStatus() {
      try {
        const statusEndpoint = isTiamat ? 'tiamat-status' : 'admiral-status';
        const res = await fetch(`${SHARED_API_URL}/${statusEndpoint}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.spawned) {
          renderAdmiralLeaderboard(data);
        } else if (active) {
          active = false;
          clearInterval(attackInterval);
          npc.hp = 0;
          refreshHP();
          endFight(true, { gold: 0, pearl: 0, xp: 0 });
        }
      } catch(e) {
        console.error(e);
      }
    }

    function startAdmiralStatusTracking() {
      fetchAdmiralStatus();
      if (bossSocket && bossSocket.connected) return;
      bossSocket = io(ORIGIN, {
        auth: { token }
      });
      bossSocket.on('connect', () => {
        const room = isTiamat ? 0 : (parseInt(localStorage.getItem('sp_current_map')) || 1);
        bossSocket.emit('join:boss', room);
      });
      bossSocket.on('boss:hpUpdate', (data) => {
        renderAdmiralLeaderboard(data);
      });
    }

    let isLeaderboardCollapsed = false;
    function toggleAdmiralLeaderboard() {
      const panel = document.getElementById('admiral-leaderboard');
      const toggleBtn = document.getElementById('admiral-leaderboard-toggle');
      if (!panel || !toggleBtn) return;
      
      isLeaderboardCollapsed = !isLeaderboardCollapsed;
      if (isLeaderboardCollapsed) {
        panel.style.transform = 'translateX(-245px)';
        toggleBtn.innerHTML = '▶';
        toggleBtn.style.boxShadow = '5px 0 15px rgba(255, 215, 0, 0.35)';
      } else {
        panel.style.transform = 'translateX(0)';
        toggleBtn.innerHTML = '◀';
        toggleBtn.style.boxShadow = '5px 0 10px rgba(0,0,0,0.5)';
      }
    }

    function setupIsland(mapLvl) {
      const island = document.getElementById('island-bg');
      if (!island) return;
      
      const islandFiles = {
        1: 'assets/effects/island/images/1_tile_57.png',
        2: 'assets/effects/island/images/2_tile_56.png',
        3: 'assets/effects/island/images/3_tile_55.png',
        4: 'assets/effects/island/images/4_tile_54.png',
        5: 'assets/effects/island/images/5_tile_53.png',
        6: 'assets/effects/island/images/6_tile_52.png',
        7: 'assets/effects/island/images/1_tile_51.png',
        8: 'assets/effects/island/images/2_tile_50.png',
        9: 'assets/effects/island/images/3_tile_49.png',
        10: 'assets/effects/island/images/4_tile_48.png'
      };
      
      const file = islandFiles[mapLvl];
      if (file) {
        island.src = file;
        island.style.display = 'block';
        
        // Reset positions
        island.style.top = 'auto';
        island.style.bottom = 'auto';
        island.style.left = 'auto';
        island.style.right = 'auto';
        
        // Savaş alanı için estetik köşe yerleşimleri (ekran içinde kalacak şekilde)
        if (mapLvl === 1) {
          island.style.top = '320px';
          island.style.left = '5px';
          island.style.width = '130px';
        } else if (mapLvl === 2) {
          island.style.bottom = '180px';
          island.style.right = '5px';
          island.style.width = '140px';
        } else if (mapLvl === 3) {
          island.style.top = '240px';
          island.style.right = '5px';
          island.style.width = '130px';
        } else if (mapLvl === 4) {
          island.style.bottom = '260px';
          island.style.left = '5px';
          island.style.width = '140px';
        } else if (mapLvl === 5) {
          island.style.bottom = '300px';
          island.style.right = '5px';
          island.style.width = '140px';
        } else if (mapLvl === 6) {
          island.style.top = '350px';
          island.style.left = '5px';
          island.style.width = '130px';
        } else if (mapLvl === 7) {
          island.style.bottom = '160px';
          island.style.right = '5px';
          island.style.width = '140px';
        } else if (mapLvl === 8) {
          island.style.top = '40%';
          island.style.left = '5px';
          island.style.width = '135px';
        } else if (mapLvl === 9) {
          island.style.bottom = '250px';
          island.style.right = '5px';
          island.style.width = '140px';
        } else if (mapLvl === 10) {
          island.style.bottom = '150px';
          island.style.right = '5px';
          island.style.width = '145px';
        }
      } else {
        island.style.display = 'none';
      }
    }

    function handleReturn() {
      localStorage.removeItem('sp_combat_is_tower');
      localStorage.removeItem('sp_combat_tower_id');
      localStorage.removeItem('sp_combat_is_weekly_boss');
      localStorage.removeItem('sp_combat_is_tiamat');
      localStorage.removeItem('sp_combat_is_pvp');
      localStorage.removeItem('sp_boss_dmg_dealt');
      // Güvenlik: Sunucudaki active_fights satırını temizle
      fetch(`${SHARED_API_URL}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      }).catch(e => console.error('handleReturn end error:', e))
        .finally(() => window.location.replace('map.html'));
    }

    async function doAttack() {
      if (!active) return;
      const now = Date.now();
      const playerReady = now - lastPlayerAttack >= (player.cooldownMs || 4000) - 100;
      if (!playerReady) return;
      lastPlayerAttack = now;
      try {
        const payload = {
          ammoId: player.ammo,
          useBarut: player.barut,
          useZirh: player.zirh
        };
        const res = await fetch(`${ATTACK_API_URL}/attack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error === 'No active fight') {
            active = false;
            clearInterval(attackInterval);
            if (opponentInterval) clearInterval(opponentInterval);
          }
          return;
        }
        if (res.ok) {

          if (isWeeklyBoss && data.weeklyBossDamageDealt !== undefined) {
            localStorage.setItem('sp_boss_dmg_dealt', data.weeklyBossDamageDealt);
          }
          // Sunucudan dönen yeni can değerlerini geçici değişkenlerde sakla
          const nextPlayerHp = data.playerHp;
          const nextNpcHp = data.npcHp;

          const TRAVEL_MS = 1620; // Delta-time bazlı 1500ms gülle uçuşuna göre tam senkronize süre

          // t=0: Oyuncu ateşler (Sadece seçili gülle envanterde varsa atış yapılır!)
          const hasAmmo = data.consumed && data.consumed.ammo > 0;
          if (hasAmmo) {
            flash('player');
            const ammoCount = player.ammo === 1 ? 4 : player.ammo === 2 ? 5 : 3;
            fireSalvo('player-node', 'npc-node', player.ammo, ammoCount, 80);
          }

          // Oyuncu güllesi NPC'ye çarptığı an (t = TRAVEL_MS) - Sadece atış yapıldıysa hasar efekti tetiklenir
          const isBarutUsed = data.consumed && data.consumed.barut > 0;
          const isNpcZirhUsed = data.opponentConsumed && data.opponentConsumed.zirh > 0;
          if (data.playerDamage && hasAmmo) {
            let pIcons = '';
            if (isBarutUsed) pIcons += '<img src="assets/items/shop/barut-fight.png" style="width:24px;height:24px;object-fit:contain;">';
            if (isNpcZirhUsed) pIcons += '<img src="assets/items/shop/zırh-fghit.png" style="width:24px;height:24px;object-fit:contain;">';
            const pIcon = pIcons ? '<span style="display:inline-flex;align-items:center;gap:3px;">' + pIcons + '</span>' : null;
            setTimeout(() => {
              if (!active) return;
              npc.hp = nextNpcHp; // Yeni canı darbe anında uygula!
              spawnDmg('npc-node', data.playerDamage, '#ff4757', pIcon);
              playHitAnim('npc-node');
              refreshHP(); // HP barı düşer, sails (yelken) düşme kontrolü tam bu saniye gerçekleşir!
            }, TRAVEL_MS);
          } else {
            // Atış yapılmadıysa sessizce canları eşitle
            setTimeout(() => {
              if (!active) return;
              npc.hp = nextNpcHp;
              refreshHP();
            }, TRAVEL_MS);
          }

          // t=600ms: NPC karşı ateş açar
          const isAdmiral = npc.name && npc.name.includes('Admiral');
          const isDataTiamat = data.isTiamat || isTiamat;
          const isGlobalBoss = isAdmiral || isDataTiamat;
          const shouldNpcAttackPlayer = isGlobalBoss || ((!npc.isPvP || (data.npcDamage && data.npcDamage > 0)) && (data.npcDamage && data.npcDamage > 0));

          if (shouldNpcAttackPlayer) {
            setTimeout(() => {
              if (!active) return;
              flash('npc');
              const npcAmmoType = isWeeklyBoss ? 4 : (data.opponentConsumed ? data.opponentConsumed.ammoId : (isDataTiamat ? 5 : 1));
              const npcShots = isWeeklyBoss ? 3 : (isDataTiamat ? 5 : (npc.isPvP ? (npcAmmoType === 1 ? 4 : npcAmmoType === 2 ? 5 : 3) : 1));
              const npcShotDelay = isWeeklyBoss ? 180 : (isDataTiamat ? 55 : (npc.isPvP ? 80 : 0));
              fireSalvo('npc-node', 'player-node', npcAmmoType, npcShots, npcShotDelay);

              // NPC güllesi oyuncuya çarptığı an (t = 600 + TRAVEL_MS)
              const isZirhUsed = data.consumed && data.consumed.zirh > 0;
              const isNpcBarutUsed = data.opponentConsumed && data.opponentConsumed.barut > 0;
              let nIcons = '';
              if (isNpcBarutUsed) nIcons += '<img src="assets/items/shop/barut-fight.png" style="width:24px;height:24px;object-fit:contain;">';
              if (isZirhUsed) nIcons += '<img src="assets/items/shop/zırh-fghit.png" style="width:24px;height:24px;object-fit:contain;">';
              const nIcon = nIcons ? '<span style="display:inline-flex;align-items:center;gap:3px;">' + nIcons + '</span>' : null;
              
              // Tiamat alev püskürmesi için hasar yansıtma zamanını alevlerin ilk çarptığı ana (1050ms) göre ayarlayalım
              const hitDelay = isDataTiamat ? 1050 : TRAVEL_MS;
              
              setTimeout(() => {
                if (!active) return;
                player.hp = nextPlayerHp; // Yeni canı darbe anında uygula!
                if (data.npcDamage) { spawnDmg('player-node', data.npcDamage, '#ff4757', nIcon); playHitAnim('player-node'); }
                refreshHP(); // HP barı darbe anında düşer!
              }, hitDelay);
            }, 600);
          } else {
            // Sessizce canları senkronize et (PvP'de rakip hasar vermediyse, Amiral hedeflemediyse)
            const silentDelay = isDataTiamat ? (600 + 1050) : (600 + TRAVEL_MS);
            setTimeout(() => {
              if (!active) return;
              player.hp = nextPlayerHp;
              refreshHP();
            }, silentDelay);
          }

          // Savaş bitti kontrollerini darbeden hemen sonraya ertele (Darbe hissi tam olsun)
          const totalDelay = isDataTiamat ? (600 + 1050 + 200) : (600 + TRAVEL_MS + 200);
          setTimeout(() => {
            if (data.state === 'won') { endFight(true, data.rewards, data.leveledUp, data.newLevel, data.playerHp, data.note); clearInterval(attackInterval); if (opponentInterval) clearInterval(opponentInterval); }
            else if (data.state === 'lost') { endFight(false, data.rewards, false, null, data.playerHp, data.note); clearInterval(attackInterval); if (opponentInterval) clearInterval(opponentInterval); }
          }, totalDelay);

          if (data.consumed) {
            if (data.consumed.ammo > 0 && player.ammoQtys && player.ammoQtys[player.ammo]) {
              player.ammoQtys[player.ammo] = Math.max(0, player.ammoQtys[player.ammo] - data.consumed.ammo);
            }
            if (player.itemQtys) {
              if (data.consumed.barut > 0 && player.itemQtys['barut']) {
                player.itemQtys['barut'] = Math.max(0, player.itemQtys['barut'] - data.consumed.barut);
              }
              if (data.consumed.zirh > 0 && player.itemQtys['zirh']) {
                player.itemQtys['zirh'] = Math.max(0, player.itemQtys['zirh'] - data.consumed.zirh);
              }
              
              // Eğer dövüş esnasında tükenirse hemen pasife al
              if (player.itemQtys['barut'] === 0 && player.barut) {
                player.barut = false;
                localStorage.setItem('sp_use_barut', 'false');
              }
              if (player.itemQtys['zirh'] === 0 && player.zirh) {
                player.zirh = false;
                localStorage.setItem('sp_use_zirh', 'false');
              }
            }
            if (typeof renderSlots === 'function') renderSlots();
          }
        }
      } catch (e) { console.error(e); }
    }


    (function () {
      const cfg = [
        { p: 'assets/effects/DefineSprite_19_bird', f: 9, t: 'bird' },
        { p: 'assets/effects/DefineSprite_31_albatross', f: 15, t: 'bird' },
        { p: 'assets/effects/DefineSprite_27_dolphin4', f: 13, t: 'fish' },
        { p: 'assets/effects/DefineSprite_54_dolphin3', f: 13, t: 'fish' },
        { p: 'assets/effects/DefineSprite_81_dolphin2', f: 13, t: 'fish' },
        { p: 'assets/effects/DefineSprite_108_dolphin1', f: 13, t: 'fish' }
      ];
      const layer = document.createElement('div');
      layer.style.cssText = 'position:absolute; inset:0; z-index:200; pointer-events:none; overflow:hidden;';
      const page = document.querySelector('.page') || document.body;
      page.appendChild(layer);

      function spawn() {
        if (localStorage.getItem('sp_setting_graphics') === 'false') return;
        if (Math.random() > 0.75) return; // Arttırılmış sıklık şansı (%75 ihtimalle çıkar)
        const c = cfg[Math.floor(Math.random() * cfg.length)];
        const img = document.createElement('img');
        img.style.position = 'absolute';
        // Kuşları küçülttük (30px)
        img.style.width = c.t === 'bird' ? '30px' : '70px';
        img.style.height = c.t === 'bird' ? '30px' : '70px';
        img.style.objectFit = 'contain';
        img.style.opacity = '0';
        img.style.filter = 'drop-shadow(0 8px 8px rgba(0,0,0,0.5))';

        // Kuşlar ekranın bir ucundan girip diğer ucundan tamamen çıksın (kaybolmadan önce ekran kenarına varsın)
        let flyRight = Math.random() > 0.5;
        let startX = c.t === 'bird' ? (flyRight ? -50 : 450) : (Math.random() * 350 - 20);

        // Kuşlar tüm ekranda random uçabilsin ve gemilerin üzerinden de geçebilsin
        let startY = c.t === 'bird' ? (Math.random() * 600 + 50) : (Math.random() * 150 + 400);

        // Kuşlar hareket eder, balıklar sabit noktada sadece kendi animasyonunu oynatır
        let moveX = c.t === 'bird' ? (flyRight ? 520 : -520) : 0;
        // moveY hafif çapraz uçuşlar için random
        let moveY = c.t === 'bird' ? ((Math.random() - 0.5) * 160) : 0;

        let duration = c.t === 'bird' ? 8000 : 1600; // Kuşlar tüm ekranı daha pürüzsüz geçsin diye 8sn

        img.style.transition = `opacity 0.6s, transform ${duration}ms linear`;
        img.style.left = startX + 'px';
        img.style.top = startY + 'px';

        let scale = moveX < 0 ? 'scaleX(-1)' : 'scaleX(1)';

        // Kuşun gidiş yönüne göre burnunu aşağı/yukarı eğ (rotate)
        let angle = 0;
        if (c.t === 'bird') {
          angle = Math.atan2(moveY, Math.abs(moveX)) * (180 / Math.PI);
          angle = angle * 0.5;
        }
        let rotate = c.t === 'bird' ? ` rotate(${angle}deg)` : '';

        img.style.transform = scale + rotate;

        layer.appendChild(img);

        let frame = 1;
        img.src = `${c.p}/${frame}.png`;

        setTimeout(() => {
          img.style.opacity = c.t === 'fish' ? '0.95' : '0.90'; // Arttırılmış netlik / kontrast
          img.style.transform = `translate(${moveX}px, ${moveY}px) ${scale}${rotate}`;
        }, 50);

        let frameInterval = c.t === 'bird' ? 100 : 130;
        const anim = setInterval(() => {
          frame++;
          if (frame > c.f) {
            if (c.t === 'fish') {
              clearInterval(anim);
              return;
            }
            frame = 1;
          }
          img.src = `${c.p}/${frame}.png`;
        }, frameInterval);

        setTimeout(() => {
          img.style.opacity = '0';
          setTimeout(() => {
            clearInterval(anim);
            if (img.parentNode) img.parentNode.removeChild(img);
          }, 600);
        }, duration - 600);
      }

      // Her 2 saniyede bir şans denesin
      setInterval(spawn, 2000);
      setTimeout(spawn, 500);
    })();
    (function() {
      let fireFrame = 1;
      setInterval(() => {
        fireFrame++;
        if (fireFrame > 30) fireFrame = 1;
        const path = `assets/effects/DefineSprite_61_fire/${fireFrame}.png`;
        const playerFire = document.getElementById('player-fire');
        const npcFire = document.getElementById('npc-fire');
        if (playerFire) playerFire.style.backgroundImage = `url('${path}')`;
        if (npcFire) npcFire.style.backgroundImage = `url('${path}')`;
      }, 90);
    })();

    /* ══════════════════════════════════════════════
       TİAMAT SPRİTE ANİMASYONU
    ══════════════════════════════════════════════ */
    const TIAMAT_FRAME_COLS = 6;
    const TIAMAT_FRAME_ROWS = 6;
    const TIAMAT_FRAME_COUNT = 36;
    const TIAMAT_FRAME_W = 132;
    const TIAMAT_FRAME_H = 141;

    function startTiamatAnimation(imgEl, spriteSrc) {
      const offCanvas = document.createElement('canvas');
      const offCtx = offCanvas.getContext('2d');
      const sheetImg = new Image();
      sheetImg.crossOrigin = 'anonymous';

      const displayCanvas = document.createElement('canvas');
      const dispCtx = displayCanvas.getContext('2d');

      let frameIdx = 0;
      let animInterval;
      let started = false;

      sheetImg.onload = function() {
        offCanvas.width = sheetImg.naturalWidth;
        offCanvas.height = sheetImg.naturalHeight;
        offCtx.drawImage(sheetImg, 0, 0);

        const DISPLAY_SIZE = 220;
        displayCanvas.width = DISPLAY_SIZE;
        displayCanvas.height = DISPLAY_SIZE;
        displayCanvas.className = 'ship-img';
        displayCanvas.id = 'npc-img';
        displayCanvas.style.width = DISPLAY_SIZE + 'px';
        displayCanvas.style.height = DISPLAY_SIZE + 'px';
        displayCanvas.style.maxWidth = DISPLAY_SIZE + 'px';
        displayCanvas.style.maxHeight = DISPLAY_SIZE + 'px';
        displayCanvas.style.mixBlendMode = 'normal';
        displayCanvas.style.display = 'block';
        displayCanvas.style.filter = 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 25px rgba(255, 50, 0, 0.5)) drop-shadow(0 0 50px rgba(255, 0, 0, 0.25))';
        displayCanvas.style.animation = 'tiamatPulse 2s ease-in-out infinite';

        // Center the frame in the canvas to preserve aspect ratio
        const srcRatio = TIAMAT_FRAME_W / TIAMAT_FRAME_H;
        let drawW, drawH, drawX, drawY;
        if (srcRatio > 1) {
          drawW = DISPLAY_SIZE;
          drawH = DISPLAY_SIZE / srcRatio;
          drawX = 0;
          drawY = (DISPLAY_SIZE - drawH) / 2;
        } else {
          drawH = DISPLAY_SIZE;
          drawW = DISPLAY_SIZE * srcRatio;
          drawX = (DISPLAY_SIZE - drawW) / 2;
          drawY = 0;
        }

        if (imgEl && imgEl.parentNode) {
          imgEl.style.display = 'none';
          imgEl.parentNode.replaceChild(displayCanvas, imgEl);
        }

        function drawFrame(idx) {
          const col = idx % TIAMAT_FRAME_COLS;
          const row = Math.floor(idx / TIAMAT_FRAME_COLS);
          const sx = col * TIAMAT_FRAME_W;
          const sy = row * TIAMAT_FRAME_H;
          dispCtx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
          dispCtx.drawImage(offCanvas, sx, sy, TIAMAT_FRAME_W, TIAMAT_FRAME_H, drawX, drawY, drawW, drawH);
        }

        drawFrame(0);
        started = true;

        animInterval = setInterval(() => {
          if (!active) {
            clearInterval(animInterval);
            return;
          }
          frameIdx = (frameIdx + 1) % TIAMAT_FRAME_COUNT;
          window.tiamatCurrentFrame = frameIdx;
          drawFrame(frameIdx);
        }, 80);
      };

      sheetImg.onerror = function() {
        if (imgEl) imgEl.style.display = 'block';
      };

      sheetImg.src = spriteSrc;
    }
