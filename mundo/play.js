/* Midnight World — simulación local jugable.
   No abre sesión de juego ni le manda órdenes al autopilot.

   Marco espacial (una sola fuente):
   - Los droides tienen el ojo en +z local, así que el frente del mesh es +z.
     Mirar hacia d: rotation.y = atan2(d.x, d.z).
   - Conducción: la cámara se apoya en camYaw y el movimiento lee
     camera.getWorldDirection en ese mismo frame.
     right = forward × up.
     yaw 0 deja la cámara en +z mirando hacia −z → forward (0,0,−1), right (1,0,0).
*/
(function () {
  const UP = new THREE.Vector3(0, 1, 0);
  const RAD = 1.15;
  const WORLD = 108;
  const SIM_KEY = "mc-play-v1";

  const STATIONS = [
    { id: "contracts", name: "Mesa de contratos", x: 0, z: 8, r: 3.4, kind: "contract", color: 0x7cf0d0 },
    { id: "forge", name: "Forja", x: 16, z: 12, r: 3.2, kind: "smith", color: 0xffad33 },
    { id: "bench", name: "Banco de trabajo", x: -16, z: 12, r: 3.2, kind: "craft", color: 0xc792ff },
    { id: "terminal", name: "Terminal hacker", x: -48, z: -42, r: 4.2, kind: "hack", color: 0x4da3ff },
    { id: "wilds", name: "Amoeba Wilds", x: -74, z: 48, r: 18, kind: "combat", color: 0xff3366 },
  ];

  const state = {
    ctx: null,
    camYaw: 0.5,
    camDist: 16,
    driving: false,
    nav: null,
    channel: null,
    atkCd: 0,
    hurt: 0,
    toast: "",
    toastUntil: 0,
    hp: 100,
    hounds: [],
    colliders: [],
    sparkBits: [],
    selRing: null,
    motes: null,
    motePos: null,
    keys: {},
    prevDown: {},
    stick: { x: 0, y: 0, on: false },
    drag: null,
    sim: null,
    lastQuest: "",
    bootedInput: false,
  };

  function $(s) { return document.querySelector(s); }

  function baseSim() {
    return {
      left: { "R2": 10, "BB-8": 6, "C-3PO": 1 },
      xp: { "R2": 0, "BB-8": 0, "C-3PO": 0 },
      smith: 0, craft: 0, hack: 0, kills: 0, log: [],
    };
  }

  function loadSim() {
    const sim = baseSim();
    try {
      const raw = JSON.parse(localStorage.getItem(SIM_KEY) || "null");
      if (raw && raw.left && raw.xp) {
        for (const k of Object.keys(sim.left)) sim.left[k] = raw.left[k] ?? sim.left[k];
        for (const k of Object.keys(sim.xp)) sim.xp[k] = raw.xp[k] || 0;
        sim.smith = raw.smith || 0;
        sim.craft = raw.craft || 0;
        sim.hack = raw.hack || 0;
        sim.kills = raw.kills || 0;
        sim.log = Array.isArray(raw.log) ? raw.log.slice(0, 6) : [];
      }
    } catch { /* sim nueva */ }
    return sim;
  }

  function saveSim() {
    try { localStorage.setItem(SIM_KEY, JSON.stringify(state.sim)); } catch { /* privado */ }
  }

  function lcg(seed) {
    let s = seed >>> 0;
    return function () {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function addCollider(x, z, hw, hd) {
    state.colliders.push({ x, z, hw, hd });
    if (!state.debug) return;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2, 1.4, hd * 2),
      new THREE.MeshBasicMaterial({ color: 0xff44aa, wireframe: true })
    );
    m.position.set(x, 0.7, z);
    state.ctx.scene.add(m);
  }

  function blocked(x, z) {
    if (Math.abs(x) > WORLD || Math.abs(z) > WORLD) return true;
    for (const c of state.colliders) {
      if (Math.abs(x - c.x) < c.hw + RAD && Math.abs(z - c.z) < c.hd + RAD) return true;
    }
    return false;
  }

  function tryMove(pos, dx, dz) {
    const nx = pos.x + dx;
    const nz = pos.z + dz;
    if (!blocked(nx, nz)) { pos.x = nx; pos.z = nz; return; }
    if (!blocked(nx, pos.z)) pos.x = nx;
    else if (!blocked(pos.x, nz)) pos.z = nz;
  }

  function basisFromCamera(cam) {
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1);
    else fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, UP);
    return { fwd, right };
  }

  function placeChase(target) {
    const cam = state.ctx.camera;
    const back = new THREE.Vector3(Math.sin(state.camYaw), 0, Math.cos(state.camYaw));
    cam.position.copy(target);
    cam.position.y += 8;
    cam.position.addScaledVector(back, state.camDist);
    cam.lookAt(target.x, target.y + 1.7, target.z);
    cam.updateMatrixWorld(true);
  }

  function nearCardinal(a) {
    const q = Math.PI / 2;
    const m = ((a % q) + q) % q;
    return m < 0.26 || m > q - 0.26;
  }

  function box(scene, x, y, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }

  function buildCity(scene) {
    const rnd = lcg(0x51c3);
    const bldMat = new THREE.MeshStandardMaterial({ color: 0x243044, roughness: 0.45, metalness: 0.55, emissive: 0x101820 });
    const cyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const mag = new THREE.MeshBasicMaterial({ color: 0xff2d86 });

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (nearCardinal(a)) continue;
      const rad = 34;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const w = 4.4 + (i % 3);
      const d = 4.4 + ((i + 1) % 3);
      const h = 12 + (i % 5) * 5;
      box(scene, x, h / 2, z, w, h, d, bldMat);
      box(scene, x, h * 0.72, z, w + 0.15, 0.28, d + 0.15, i % 2 ? cyan : mag);
      windows(scene, x, z, w, h, d, i % 3 === 0 ? 0xff2d86 : i % 3 === 1 ? 0x00f0ff : 0xffc14d);
      addCollider(x, z, w / 2, d / 2);
      if (h > 22) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 3.2),
          new THREE.MeshBasicMaterial({ color: 0x9bb })
        );
        spire.position.set(x, h + 1.6, z);
        scene.add(spire);
      }
    }

    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.1, 0),
      new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true })
    );
    core.position.set(0, 6, 0);
    core.name = "Central_Core";
    scene.add(core);
    const plaza = new THREE.Mesh(
      new THREE.RingGeometry(7.2, 7.7, 64),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.05;
    scene.add(plaza);
    const pCentral = new THREE.PointLight(0x00ffff, 2.2, 48);
    pCentral.position.set(0, 10, 0);
    scene.add(pCentral);

    road(scene, 0, -40, 6, 70);
    road(scene, 0, 46, 6, 80);
    road(scene, -40, 0, 70, 6);
    road(scene, 40, 0, 70, 6);

    buildHouse(scene);
    buildForest(scene, rnd);
    buildVolcano(scene, rnd);
    buildWilds(scene);
    buildYard(scene);
    for (const st of STATIONS) addPad(scene, st);
    placeSign(scene, "PLAZA", "#7cf0d0", 0, 9.2, 0);
    placeSign(scene, "HACKER", "#4da3ff", -48, 8.2, -42);
    placeSign(scene, "BOSQUE", "#3ddc84", -78, 8.4, -36);
    placeSign(scene, "VOLCAN", "#ffad33", 74, 8.4, -30);
    placeSign(scene, "WILDS", "#c792ff", -74, 8.2, 48);
    placeSign(scene, "YARD", "#ffcc66", 8, 24.5, 86);

    const motePos = new Float32Array(48 * 3);
    for (let i = 0; i < 48; i++) {
      motePos[i * 3] = (rnd() - 0.5) * 180;
      motePos[i * 3 + 1] = 1.5 + rnd() * 10;
      motePos[i * 3 + 2] = (rnd() - 0.5) * 180;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const motes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({ color: 0x8cf6e0, size: 0.38, transparent: true, opacity: 0.75 })
    );
    scene.add(motes);
    state.motes = motes;
    state.motePos = motePos;

    const sparkGroup = new THREE.Group();
    scene.add(sparkGroup);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 5, 5),
        new THREE.MeshBasicMaterial({ color: 0xffaa55 })
      );
      m.visible = false;
      sparkGroup.add(m);
      state.sparkBits.push({ m, v: new THREE.Vector3(), life: 0 });
    }
    state.sparkGroup = sparkGroup;

    const sel = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.4, 28),
      new THREE.MeshBasicMaterial({ color: 0x7cf0d0, side: THREE.DoubleSide })
    );
    sel.rotation.x = -Math.PI / 2;
    sel.position.y = 0.06;
    scene.add(sel);
    state.selRing = sel;
  }

  function windows(scene, x, z, w, h, d, color) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const rows = Math.max(2, Math.floor(h / 3.4));
    for (let r = 0; r < rows; r++) {
      const y = 2.1 + r * 3.3;
      if (y > h - 1.2) break;
      const front = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.42, 0.08), mat);
      front.position.set(x, y, z + d / 2 + 0.06);
      scene.add(front);
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, d * 0.55), mat);
      side.position.set(x + w / 2 + 0.06, y, z);
      scene.add(side);
    }
  }

  function placeSign(scene, text, color, x, y, z) {
    const s = makeLabel(text, color);
    s.position.set(x, y, z);
    s.scale.set(7.2, 1.8, 1);
    scene.add(s);
  }

  function road(scene, x, z, w, d) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: 0x102033 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.03, z);
    scene.add(mesh);
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.4, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.045, z - d / 2);
    scene.add(edge);
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(w > d ? w * 0.72 : 0.12, w > d ? 0.12 : d * 0.72),
      new THREE.MeshBasicMaterial({ color: 0xff2d86 })
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(x, 0.05, z);
    scene.add(lane);
  }

  function buildHouse(scene) {
    const g = new THREE.Group();
    g.position.set(-48, 0, -42);
    const mat = new THREE.MeshStandardMaterial({ color: 0x141a2e, metalness: 0.9, roughness: 0.3 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 14), mat);
    roof.position.y = 6.5;
    g.add(roof);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ color: 0x00c8e0, wireframe: true })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.04;
    g.add(floor);
    const posts = [[-6, -6], [6, -6], [-6, 6], [6, 6]];
    for (const [px, pz] of posts) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6.5, 1.1), mat);
      post.position.set(px, 3.25, pz);
      g.add(post);
      addCollider(-48 + px, -42 + pz, 0.7, 0.7);
    }
    const holo = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.1, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x4da3ff })
    );
    holo.rotation.x = Math.PI / 2;
    holo.position.y = 3.4;
    g.add(holo);
    scene.add(g);
    const light = new THREE.PointLight(0x4da3ff, 2.2, 32);
    light.position.set(-48, 5, -42);
    scene.add(light);
  }

  function buildForest(scene, rnd) {
    const ox = -78, oz = -36;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x004422, roughness: 0.4 });
    for (let i = 0; i < 12; i++) {
      const tx = (rnd() - 0.5) * 22;
      const tz = (rnd() - 0.5) * 22;
      if (tx * tx + tz * tz < 25) continue;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 3.2), trunkMat);
      trunk.position.set(ox + tx, 1.6, oz + tz);
      scene.add(trunk);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.4, 6), leafMat);
      leaves.position.set(ox + tx, 4.6, oz + tz);
      scene.add(leaves);
      addCollider(ox + tx, oz + tz, 0.7, 0.7);
    }
    const light = new THREE.PointLight(0x00ff88, 2.1, 36);
    light.position.set(ox, 6, oz);
    scene.add(light);
  }

  function buildVolcano(scene, rnd) {
    const ox = 74, oz = -30;
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a100e, roughness: 0.92 });
    for (let i = 0; i < 7; i++) {
      const rx = (rnd() - 0.5) * 16;
      const rz = (rnd() - 0.5) * 16;
      if (rx * rx + rz * rz < 20) continue;
      const s = 2.4 + rnd() * 2.2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      rock.position.set(ox + rx, s * 0.6, oz + rz);
      scene.add(rock);
      addCollider(ox + rx, oz + rz, s * 0.7, s * 0.7);
    }
    const lava = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ color: 0xff3b14 })
    );
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(ox, 0.05, oz);
    scene.add(lava);
    const light = new THREE.PointLight(0xff3300, 2.6, 36);
    light.position.set(ox, 5, oz);
    scene.add(light);
  }

  function buildWilds(scene) {
    const ox = -74, oz = 48;
    const slime = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x9900ff, wireframe: true })
    );
    slime.rotation.x = -Math.PI / 2;
    slime.position.set(ox, 0.05, oz);
    scene.add(slime);
    const light = new THREE.PointLight(0xb800ff, 2.4, 40);
    light.position.set(ox, 5, oz);
    scene.add(light);

    const homes = [
      { x: ox - 6, z: oz - 4 },
      { x: ox + 7, z: oz + 2 },
      { x: ox - 1, z: oz + 8 },
    ];
    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, metalness: 0.8, roughness: 0.35 });
    homes.forEach((home, i) => {
      const g = new THREE.Group();
      g.position.set(home.x, 0, home.z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.2), mat);
      body.position.y = 1;
      g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1), mat);
      head.position.set(0, 1.4, 1.3);
      g.add(head);
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.15, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xff0033 })
      );
      visor.position.set(0, 1.45, 1.82);
      visor.name = "eye";
      g.add(visor);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xff3355 })
      );
      bar.position.y = 2.35;
      bar.name = "hp";
      g.add(bar);
      g.name = "Ash_Hound_" + i;
      scene.add(g);
      state.hounds.push({ mesh: g, home, hp: 30, max: 30, alive: true, hitCd: 0, respawn: 0, phase: i * 2.1 });
    });
  }

  function buildYard(scene) {
    const g = new THREE.Group();
    g.position.set(8, 0, 86);
    const grid = new THREE.GridHelper(36, 8, 0xffbb00, 0x443300);
    g.add(grid);
    const craneMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.1, 22, 1.1), craneMat);
    tower.position.y = 11;
    g.add(tower);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(18, 0.6, 0.6), craneMat);
    jib.position.set(6, 21.5, 0);
    g.add(jib);
    scene.add(g);
    addCollider(8, 86, 0.9, 0.9);
  }

  function addPad(scene, st) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.min(st.r, 3.2) * 0.72, 0.07, 8, 28),
      new THREE.MeshBasicMaterial({ color: st.color })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(st.x, 0.12, st.z);
    scene.add(ring);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.4),
      new THREE.MeshBasicMaterial({ color: st.color })
    );
    pole.position.set(st.x, 1.2, st.z);
    scene.add(pole);
    const light = new THREE.PointLight(st.color, 1.1, 12);
    light.position.set(st.x, 2.2, st.z);
    scene.add(light);
  }

  function makeLabel(text, color) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(7,8,13,0.78)";
    g.fillRect(18, 10, 220, 44);
    g.fillStyle = color;
    g.font = "bold 28px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 128, 32);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
    }));
    s.scale.set(4.4, 1.1, 1);
    s.position.y = 4.5;
    return s;
  }

  function burst(x, y, z, color) {
    state.sparkGroup.position.set(x, y, z);
    for (const s of state.sparkBits) {
      s.m.visible = true;
      s.m.position.set((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4);
      s.m.material.color.set(color);
      s.v.set((Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5);
      s.life = 0.45;
    }
  }

  function stepSparks(dt) {
    for (const s of state.sparkBits) {
      if (!s.m.visible) continue;
      s.life -= dt;
      if (s.life <= 0) { s.m.visible = false; continue; }
      s.m.position.addScaledVector(s.v, dt);
      s.v.y -= 9 * dt;
    }
  }

  function floater(world, text, color) {
    const wrap = $("#viewport3d-wrap");
    const cam = state.ctx.camera;
    if (!wrap || !cam) return;
    const v = world.clone().project(cam);
    const el = document.createElement("div");
    el.className = "floater";
    el.style.color = color;
    el.textContent = text;
    el.style.left = ((v.x * 0.5 + 0.5) * wrap.clientWidth) + "px";
    el.style.top = ((-v.y * 0.5 + 0.5) * wrap.clientHeight) + "px";
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function toast(msg) {
    state.toast = msg;
    state.toastUntil = performance.now() + 2400;
  }

  function grant(name, amount, label) {
    state.sim.xp[name] = (state.sim.xp[name] || 0) + amount;
    state.sim.log.unshift(name + " · " + label);
    state.sim.log = state.sim.log.slice(0, 6);
    saveSim();
    const g = state.ctx.droids[name].group;
    floater(g.position.clone().setY(3.2), label, "#7cf0d0");
    if (typeof state.ctx.onChange === "function") state.ctx.onChange();
  }

  function resolve(st) {
    const name = state.ctx.active();
    const pos = state.ctx.droids[name].group.position;
    if (st.kind === "contract") {
      if ((state.sim.left[name] || 0) <= 0) {
        toast(name + " no tiene contratos listos en la mochila.");
        return;
      }
      state.sim.left[name] -= 1;
      const xp = 80 + Math.floor(Math.random() * 201);
      grant(name, xp, "Contrato +" + xp + " XP");
      state.ctx.audio.click();
      burst(pos.x, 1.2, pos.z, 0x7cf0d0);
      return;
    }
    if (st.kind === "smith") {
      const xp = name === "BB-8" ? 60 : 40;
      state.sim.smith += 1;
      grant(name, xp, "Forja +" + xp + " XP");
      burst(pos.x, 1.2, pos.z, 0xffad33);
      state.ctx.audio.blip(220);
      return;
    }
    if (st.kind === "craft") {
      const xp = name === "C-3PO" ? 60 : 40;
      state.sim.craft += 1;
      grant(name, xp, "Banco +" + xp + " XP");
      burst(pos.x, 1.2, pos.z, 0xc792ff);
      state.ctx.audio.blip(330);
      return;
    }
    if (st.kind === "hack") {
      const xp = name === "R2" ? 70 : 45;
      state.sim.hack += 1;
      grant(name, xp, "Terminal +" + xp + " XP");
      burst(pos.x, 1.4, pos.z, 0x4da3ff);
      state.ctx.audio.r2Beep();
    }
  }

  function nearestStation() {
    const name = state.ctx.active();
    const p = state.ctx.droids[name].group.position;
    let best = null;
    let bestD = 1e9;
    for (const st of STATIONS) {
      if (st.kind === "combat") continue;
      const d = Math.hypot(p.x - st.x, p.z - st.z);
      if (d < st.r && d < bestD) { best = st; bestD = d; }
    }
    return best;
  }

  function inWilds(p) {
    const w = STATIONS.find((s) => s.kind === "combat");
    return Math.hypot(p.x - w.x, p.z - w.z) < w.r;
  }

  function livingHounds() {
    return state.hounds.filter((h) => h.alive);
  }

  function nearestHound(maxDist) {
    const p = state.ctx.droids[state.ctx.active()].group.position;
    let best = null;
    let bestD = maxDist;
    for (const h of livingHounds()) {
      const d = Math.hypot(p.x - h.mesh.position.x, p.z - h.mesh.position.z);
      if (d < bestD) { best = h; bestD = d; }
    }
    return best;
  }

  function attack() {
    if (state.atkCd > 0) return;
    const h = nearestHound(2.7);
    const name = state.ctx.active();
    const g = state.ctx.droids[name].group;
    if (!h) {
      if (inWilds(g.position)) toast("Ningún hound a distancia de golpe.");
      return;
    }
    state.atkCd = 0.42;
    const dmg = name === "C-3PO" ? 14 : 11;
    h.hp -= dmg;
    const bar = h.mesh.getObjectByName("hp");
    if (bar) bar.scale.x = Math.max(0.05, h.hp / h.max);
    floater(h.mesh.position.clone().setY(2.6), "−" + dmg, "#ff8aa0");
    state.ctx.audio.blip(140);
    g.userData.swing = 0.18;
    if (h.hp <= 0) {
      h.alive = false;
      h.mesh.visible = false;
      h.respawn = 8;
      state.sim.kills += 1;
      grant(name, 57, "Hound +57 XP");
      toast("Ash Hound caído. En esta simulación no se arriesgan cristales.");
    }
  }

  function edge(code) {
    const down = !!state.keys[code];
    const was = !!state.prevDown[code];
    state.prevDown[code] = down;
    return down && !was;
  }

  function readMove() {
    let forward = 0;
    let strafe = 0;
    if (state.keys.KeyW || state.keys.ArrowUp) forward += 1;
    if (state.keys.KeyS || state.keys.ArrowDown) forward -= 1;
    if (state.keys.KeyD || state.keys.ArrowRight) strafe += 1;
    if (state.keys.KeyA || state.keys.ArrowLeft) strafe -= 1;
    if (state.stick.on) {
      strafe += state.stick.x;
      forward += -state.stick.y;
    }
    const len = Math.hypot(forward, strafe);
    if (len > 1) { forward /= len; strafe /= len; }
    return { forward, strafe, manual: len > 0.08 };
  }

  function questText() {
    const left = Object.values(state.sim.left).reduce((a, b) => a + b, 0);
    if (left > 0) return "Fase 1 · Plaza · quedan " + left + " contratos";
    const made = state.sim.smith + state.sim.craft + state.sim.hack;
    if (made < 6) return "Fase 2 · Talleres · " + made + "/6 piezas";
    return "Fase 3 · Wilds · " + state.sim.kills + " hounds · 0 💎 en riesgo";
  }

  function districtName(x, z) {
    if (Math.hypot(x + 48, z + 42) < 12) return "Hacker House";
    if (Math.hypot(x - 74, z + 30) < 16) return "Volcano";
    if (Math.hypot(x + 78, z + 36) < 16) return "Forest";
    if (inWilds({ x, z })) return "Amoeba Wilds";
    if (z > 68) return "Construction Yard";
    if (Math.hypot(x, z) < 22) return "Central Plaza";
    return "Calles de Midnight";
  }

  function updateHud(dt) {
    const q = questText();
    const qEl = $("#questChip");
    if (qEl && qEl.textContent !== q) qEl.textContent = q;
    const name = state.ctx.active();
    const p = state.ctx.droids[name].group.position;
    const dist = districtName(p.x, p.z);
    if (dist !== state.lastDist) {
      state.lastDist = dist;
      const banner = $("#distBanner");
      if (banner) {
        banner.textContent = dist;
        banner.style.opacity = "1";
        clearTimeout(state.bannerTimer);
        state.bannerTimer = setTimeout(() => { banner.style.opacity = "0"; }, 1600);
      }
    }
    const hpFill = $("#hpFill");
    if (hpFill) hpFill.style.width = Math.max(0, state.hp) + "%";
    const prompt = $("#prompt");
    if (!prompt) return;
    const now = performance.now();
    if (now < state.toastUntil) {
      prompt.innerHTML = "<b>" + state.toast + "</b>";
      return;
    }
    if (!state.driving) {
      prompt.innerHTML = state.coarse
        ? "Tocá Conducir. El stick mueve, Usar en un taller, Golpe contra los hounds."
        : "Elegí un droide y tocá Conducir. WASD para caminar, E en un taller, Espacio para golpear.";
      return;
    }
    if (state.channel) {
      const pct = Math.min(100, (state.channel.t / state.channel.need) * 100);
      prompt.innerHTML = state.channel.name + "<div class='bar'><i style='width:" + pct + "%'></i></div>";
      return;
    }
    const st = nearestStation();
    if (st) {
      const verb = st.kind === "contract" ? "Entregar contrato" : st.kind === "smith" ? "Fundir" : st.kind === "craft" ? "Aserrar" : "Hackear";
      prompt.innerHTML = (state.coarse ? "Usar · " : "E · ") + verb + " · " + st.name;
      return;
    }
    const h = nearestHound(6);
    if (h) {
      prompt.innerHTML = (state.coarse ? "Golpe · " : "Espacio · ") + "Ash Hound · " + Math.max(0, Math.ceil(h.hp)) + " HP";
      return;
    }
    if (state.nav) prompt.innerHTML = "Yendo al punto marcado. WASD cancela.";
    else prompt.innerHTML = dist + " · Q/R o arrastrá para girar la cámara";
    void dt;
  }

  function drawMini() {
    const cnv = $("#mini");
    if (!cnv) return;
    const c = cnv.getContext("2d");
    const w = cnv.width;
    const h = cnv.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "rgba(6,8,14,0.55)";
    c.fillRect(0, 0, w, h);
    const P = (x, z) => [(x + WORLD) / (WORLD * 2) * w, (z + WORLD) / (WORLD * 2) * h];
    c.strokeStyle = "#1e3a4a";
    c.strokeRect(8, 8, w - 16, h - 16);
    for (const st of STATIONS) {
      const [sx, sy] = P(st.x, st.z);
      c.fillStyle = "#" + st.color.toString(16).padStart(6, "0");
      c.fillRect(sx - 2, sy - 2, 4, 4);
    }
    for (const hnd of state.hounds) {
      if (!hnd.alive) continue;
      const [sx, sy] = P(hnd.mesh.position.x, hnd.mesh.position.z);
      c.fillStyle = "#ff3355";
      c.beginPath();
      c.arc(sx, sy, 2.2, 0, Math.PI * 2);
      c.fill();
    }
    const droids = state.ctx.droids;
    for (const name of Object.keys(droids)) {
      const g = droids[name].group;
      const [sx, sy] = P(g.position.x, g.position.z);
      c.fillStyle = state.ctx.colors[name];
      c.beginPath();
      c.arc(sx, sy, name === state.ctx.active() ? 4 : 2.6, 0, Math.PI * 2);
      c.fill();
    }
  }

  function stepHounds(dt) {
    const name = state.ctx.active();
    const player = state.ctx.droids[name].group.position;
    const hunting = state.driving && inWilds(player);
    for (const h of state.hounds) {
      if (!h.alive) {
        h.respawn -= dt;
        if (h.respawn <= 0) {
          h.alive = true;
          h.hp = h.max;
          h.mesh.visible = true;
          h.mesh.position.set(h.home.x, 0, h.home.z);
          const bar = h.mesh.getObjectByName("hp");
          if (bar) bar.scale.x = 1;
        }
        continue;
      }
      const dx = player.x - h.mesh.position.x;
      const dz = player.z - h.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (hunting && dist < 14) {
        if (dist > 1.55) {
          const sp = 5.2 * dt;
          h.mesh.position.x += (dx / dist) * sp;
          h.mesh.position.z += (dz / dist) * sp;
          h.mesh.rotation.y = Math.atan2(dx, dz);
        } else if (state.hurt <= 0) {
          h.hitCd -= dt;
          if (h.hitCd <= 0) {
            h.hitCd = 0.95;
            state.hp = Math.max(0, state.hp - 8);
            state.hurt = 0.35;
            const hurt = $("#hurt");
            if (hurt) hurt.style.opacity = "1";
            floater(player.clone().setY(2.4), "−8", "#ff5c6c");
            if (state.hp <= 0) {
              state.hp = 100;
              player.set(-40, 0, 28);
              toast("Caíste. Simulación: no se pierden cristales ni hay office fee.");
              state.ctx.droids[name].group.position.copy(player);
            }
          }
        }
      } else {
        const ang = performance.now() / 1000 * 0.45 + h.phase;
        const vx = -Math.sin(ang);
        const vz = Math.cos(ang);
        h.mesh.position.x = h.home.x + Math.cos(ang) * 5;
        h.mesh.position.z = h.home.z + Math.sin(ang) * 5;
        h.mesh.rotation.y = Math.atan2(vx, vz);
      }
    }
    if (state.hurt > 0) {
      state.hurt -= dt;
      if (state.hurt <= 0) {
        const hurt = $("#hurt");
        if (hurt) hurt.style.opacity = "0";
      }
    } else if (nearestHound(8) == null) {
      state.hp = Math.min(100, state.hp + 10 * dt);
    }
  }

  function stepIdle(time) {
    const droids = state.ctx.droids;
    const homes = state.ctx.homes;
    let i = 0;
    for (const name of Object.keys(droids)) {
      i += 1;
      if (state.driving && name === state.ctx.active()) continue;
      const g = droids[name].group;
      const home = homes[name];
      const ang = time * 0.45 + i;
      const vx = -Math.sin(ang);
      const vz = Math.cos(ang);
      g.position.x = home.x + Math.cos(ang) * 2.4;
      g.position.z = home.z + Math.sin(ang) * 2.4;
      g.rotation.y = Math.atan2(vx, vz);
    }
  }

  function step(dt, time) {
    dt = Math.min(Math.max(dt, 0), 0.05);
    const ctx = state.ctx;
    const name = ctx.active();
    const d = ctx.droids[name];
    const g = d.group;
    if (state.keys.KeyQ) state.camYaw += 1.7 * dt;
    if (state.keys.KeyR) state.camYaw -= 1.7 * dt;

    const chase = state.driving || ctx.camMode() !== "free";
    ctx.controls.enabled = !chase;
    if (chase) placeChase(g.position);

    if (state.driving) {
      const input = readMove();
      if (input.manual) state.nav = null;
      const speed = (state.keys.ShiftLeft || state.keys.ShiftRight) ? 22 : 14;
      let moved = false;
      if (input.manual) {
        const { fwd, right } = basisFromCamera(ctx.camera);
        const move = new THREE.Vector3();
        move.addScaledVector(fwd, input.forward).addScaledVector(right, input.strafe);
        tryMove(g.position, move.x * speed * dt, move.z * speed * dt);
        if (move.lengthSq() > 1e-6) {
          g.rotation.y = Math.atan2(move.x, move.z);
          moved = true;
        }
      } else if (state.nav) {
        const dx = state.nav.x - g.position.x;
        const dz = state.nav.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.7) state.nav = null;
        else {
          tryMove(g.position, (dx / dist) * speed * dt, (dz / dist) * speed * dt);
          g.rotation.y = Math.atan2(dx, dz);
          moved = true;
        }
      }
      if (moved && d.ball) d.ball.rotation.x += speed * dt * 0.35;
      if (moved && chase) placeChase(g.position);

      const st = nearestStation();
      if (state.channel) {
        const still = st && st.id === state.channel.id;
        if (!still) state.channel = null;
        else {
          state.channel.t += dt;
          if (state.channel.t >= state.channel.need) {
            const done = state.channel;
            state.channel = null;
            resolve(done);
          }
        }
      }
      if (edge("KeyE") && !state.channel && st) {
        state.channel = { id: st.id, name: st.name, kind: st.kind, t: 0, need: st.kind === "contract" ? 0.35 : 0.7 };
        ctx.audio.click();
      }
      if (edge("Space")) attack();
      state.atkCd = Math.max(0, state.atkCd - dt);
    } else {
      readMove();
      edge("KeyE");
      edge("Space");
    }

    stepIdle(time);
    if (chase) placeChase(state.ctx.droids[state.ctx.active()].group.position);
    stepHounds(dt);
    stepSparks(dt);
    if (state.motePos) {
      const arr = state.motePos;
      for (let i = 1; i < arr.length; i += 3) {
        arr[i] += Math.sin(time * 0.8 + i) * 0.004;
      }
      state.motes.geometry.attributes.position.needsUpdate = true;
    }
    g.userData.swing = Math.max(0, (g.userData.swing || 0) - dt);
    if (state.selRing) {
      const c = ctx.colors[name];
      state.selRing.material.color.set(c);
      state.selRing.position.x = g.position.x;
      state.selRing.position.z = g.position.z;
    }
    updateHud(dt);
    drawMini();

    const core = ctx.scene.getObjectByName("Central_Core");
    if (core) {
      core.rotation.y += dt * 0.8;
      core.rotation.x += dt * 0.35;
      core.position.y = 6 + Math.sin(time * 2) * 0.35;
    }
    const r2 = ctx.droids.R2;
    if (r2) {
      r2.holo.rotation.y += dt;
      r2.head.rotation.y = Math.sin(time * 1.5) * 0.35;
    }
    const bb = ctx.droids["BB-8"];
    if (bb) {
      bb.headGroup.rotation.z = Math.sin(time * 2.5) * 0.08;
      bb.headGroup.position.y = 2.05 + Math.sin(time * 4) * 0.03;
    }
    const c3 = ctx.droids["C-3PO"];
    if (c3 && c3.axe) {
      const swing = c3.group.userData.swing || 0;
      c3.axe.rotation.x = Math.PI / 4 + Math.sin(time * 3) * 0.25 + swing * 4;
    }
  }

  function bindInput() {
    if (state.bootedInput) return;
    state.bootedInput = true;
    window.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      state.keys[e.code] = true;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape") {
        state.ctx.setCamMode("free");
        window.MidnightPlay.setDriving(false);
      }
      if (e.code === "Digit1") state.ctx.select("R2");
      if (e.code === "Digit2") state.ctx.select("BB-8");
      if (e.code === "Digit3") state.ctx.select("C-3PO");
      const move = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (move.includes(e.code) && !state.driving) window.MidnightPlay.setDriving(true);
    });
    window.addEventListener("keyup", (e) => { state.keys[e.code] = false; });

    const canvas = state.ctx.renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      canvas.focus();
      state.drag = { x: e.clientX, y: e.clientY, yaw: state.camYaw, moved: false, id: e.pointerId };
    });
    window.addEventListener("pointermove", (e) => {
      if (!state.drag || e.pointerId !== state.drag.id) return;
      const dx = e.clientX - state.drag.x;
      if (Math.abs(dx) > 4) state.drag.moved = true;
      if (state.driving || state.ctx.camMode() !== "free") state.camYaw = state.drag.yaw - dx * 0.008;
    });
    window.addEventListener("pointerup", (e) => {
      if (!state.drag || e.pointerId !== state.drag.id) return;
      const was = state.drag;
      state.drag = null;
      if (!was.moved) state.ctx.onPick(e);
    });
    canvas.addEventListener("wheel", (e) => {
      if (!state.driving && state.ctx.camMode() === "free") return;
      e.preventDefault();
      state.camDist = Math.max(8, Math.min(36, state.camDist + Math.sign(e.deltaY) * 1.15));
    }, { passive: false });

    const stick = $("#stick");
    if (stick) {
      const knob = stick.querySelector("i");
      const set = (clientX, clientY) => {
        const r = stick.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let x = (clientX - cx) / (r.width / 2);
        let y = (clientY - cy) / (r.height / 2);
        const len = Math.hypot(x, y) || 1;
        if (len > 1) { x /= len; y /= len; }
        state.stick.x = x;
        state.stick.y = y;
        state.stick.on = true;
        if (knob) knob.style.transform = "translate(" + (x * 22) + "px," + (y * 22) + "px)";
      };
      stick.addEventListener("pointerdown", (e) => {
        stick.setPointerCapture(e.pointerId);
        set(e.clientX, e.clientY);
        if (!state.driving) window.MidnightPlay.setDriving(true);
      });
      stick.addEventListener("pointermove", (e) => {
        if (e.buttons || e.pressure > 0) set(e.clientX, e.clientY);
      });
      const end = () => {
        state.stick.on = false;
        state.stick.x = 0;
        state.stick.y = 0;
        if (knob) knob.style.transform = "translate(0,0)";
      };
      stick.addEventListener("pointerup", end);
      stick.addEventListener("pointercancel", end);
    }
    const hold = (id, code) => {
      const btn = $(id);
      if (!btn) return;
      const on = (e) => { e.preventDefault(); state.keys[code] = true; if (!state.driving) window.MidnightPlay.setDriving(true); };
      const off = (e) => { e.preventDefault(); state.keys[code] = false; };
      btn.addEventListener("pointerdown", on);
      btn.addEventListener("pointerup", off);
      btn.addEventListener("pointerleave", off);
    };
    hold("#tUse", "KeyE");
    hold("#tAtk", "Space");
    state.coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
    const touch = $("#touch");
    if (touch && state.coarse) touch.hidden = false;
  }

  function syncYawFromCamera() {
    const g = state.ctx.droids[state.ctx.active()].group;
    const cam = state.ctx.camera;
    state.camYaw = Math.atan2(cam.position.x - g.position.x, cam.position.z - g.position.z);
  }

  window.MidnightPlay = {
    STATIONS,
    start(ctx) {
      state.ctx = ctx;
      state.debug = ctx.debug;
      state.sim = loadSim();
      state.driving = false;
      buildCity(ctx.scene);
      for (const name of Object.keys(ctx.droids)) {
        ctx.droids[name].group.add(makeLabel(name, ctx.colors[name]));
      }
      bindInput();
      const ground = ctx.scene.getObjectByName("Ground");
      if (ground) {
        ground.updateMatrixWorld(true);
        const n = new THREE.Vector3(0, 0, 1).applyQuaternion(ground.quaternion);
        if (n.y < 0.9) console.error("Ground mira hacia abajo", n.toArray());
      }
    },
    step,
    sim() { return state.sim; },
    isDriving() { return state.driving; },
    setDriving(on) {
      state.driving = !!on;
      if (state.driving && state.ctx.camMode() === "free") state.ctx.setCamMode(state.ctx.active());
      const shown = state.driving ? state.ctx.active() : state.ctx.camMode();
      document.querySelectorAll("#camModes button").forEach((b) => b.classList.toggle("active", b.dataset.cam === shown));
      if (state.driving) {
        syncYawFromCamera();
        state.ctx.controls.enabled = false;
        const btn = $("#driveToggle");
        if (btn) btn.classList.add("active");
        const hint = $("#hudHint");
        if (hint) hint.textContent = state.coarse
          ? "Stick caminar · Usar en el taller · Golpe a los hounds · Esc soltar"
          : "WASD caminar · Shift correr · E usar · Espacio golpear · Q/R cámara · Esc soltar";
      } else {
        state.nav = null;
        state.channel = null;
        state.ctx.controls.enabled = state.ctx.camMode() === "free";
        const btn = $("#driveToggle");
        if (btn) btn.classList.remove("active");
        const hint = $("#hudHint");
        if (hint) hint.textContent = "Arrastrá para orbitar · Clic en un droide · 1 2 3 para elegirlo";
      }
      if (typeof state.ctx.onChange === "function") state.ctx.onChange();
    },
    goTo(id) {
      const st = STATIONS.find((s) => s.id === id);
      if (!st) return;
      this.setDriving(true);
      state.nav = { x: st.x, z: st.z };
      toast("En camino a " + st.name + ".");
    },
    goHome() {
      const name = state.ctx.active();
      const home = state.ctx.homes[name];
      this.setDriving(true);
      state.nav = { x: home.x, z: home.z };
    },
    resetSim() {
      state.sim = baseSim();
      saveSim();
      toast("Simulación local reiniciada.");
      if (typeof state.ctx.onChange === "function") state.ctx.onChange();
    },
    frameMathSelfTest() {
      const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
      const cases = [0, Math.PI / 2];
      const out = [];
      for (const yaw of cases) {
        const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        cam.position.set(0, 8, 0).addScaledVector(back, 16);
        cam.lookAt(0, 1.7, 0);
        cam.updateMatrixWorld(true);
        const fwd = new THREE.Vector3();
        cam.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, UP);
        const expectF = back.clone().negate();
        const expectR = new THREE.Vector3().crossVectors(expectF, UP);
        out.push(["yaw " + yaw.toFixed(2) + " fwd", fwd.distanceTo(expectF) < 0.05, fwd.toArray().map((n) => +n.toFixed(3))]);
        out.push(["yaw " + yaw.toFixed(2) + " right", right.distanceTo(expectR) < 0.05, right.toArray().map((n) => +n.toFixed(3))]);
        for (const [label, dir] of [["W", fwd], ["D", right]]) {
          const group = new THREE.Object3D();
          const eye = new THREE.Object3D();
          eye.position.set(0, 2, 1);
          eye.name = "eye";
          group.add(eye);
          group.rotation.y = Math.atan2(dir.x, dir.z);
          group.updateMatrixWorld(true);
          const origin = new THREE.Vector3();
          const tip = new THREE.Vector3();
          group.getWorldPosition(origin);
          eye.getWorldPosition(tip);
          const nose = tip.sub(origin).setY(0).normalize();
          const along = nose.dot(dir.clone().normalize());
          out.push(["face " + label + " @" + yaw.toFixed(2), along > 0.9, +along.toFixed(3)]);
        }
      }
      const ground = new THREE.Object3D();
      ground.rotation.x = -Math.PI / 2;
      ground.updateMatrixWorld(true);
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(ground.quaternion);
      out.push(["ground up", n.y > 0.9, +n.y.toFixed(3)]);
      return out;
    },
    controlSelfTest() {
      const ctx = state.ctx;
      const g = ctx.droids.R2.group;
      const prev = {
        driving: state.driving,
        yaw: state.camYaw,
        pos: g.position.clone(),
        active: ctx.active(),
        mode: ctx.camMode(),
      };
      ctx.setActive("R2");
      ctx.setCamMode("R2");
      state.driving = true;
      state.nav = null;
      state.camYaw = 0;
      state.camDist = 16;
      g.position.set(0, 0, 0);
      state.keys = {};
      const results = [];
      const press = (code, frames) => {
        placeChase(g.position);
        const b = basisFromCamera(ctx.camera);
        const p0 = g.position.clone();
        state.keys = { [code]: true };
        state.prevDown = {};
        for (let i = 0; i < frames; i++) step(1 / 60, i / 60);
        state.keys = {};
        const dlt = g.position.clone().sub(p0);
        dlt.y = 0;
        return { b, dlt };
      };
      const w = press("KeyW", 40);
      const wn = w.dlt.clone().normalize();
      results.push(["W along fwd", wn.dot(w.b.fwd) > 0.9, +wn.dot(w.b.fwd).toFixed(3)]);
      const eye = g.getObjectByName("eye");
      const o = new THREE.Vector3();
      const tip = new THREE.Vector3();
      g.getWorldPosition(o);
      eye.getWorldPosition(tip);
      const nose = tip.sub(o).setY(0).normalize();
      results.push(["W eye faces move", nose.dot(wn) > 0.9, +nose.dot(wn).toFixed(3)]);
      g.position.set(0, 0, 0);
      state.camYaw = 0;
      const d = press("KeyD", 40);
      const dn = d.dlt.clone().normalize();
      results.push(["D along right", dn.dot(d.b.right) > 0.9, +dn.dot(d.b.right).toFixed(3)]);
      g.position.copy(prev.pos);
      state.driving = prev.driving;
      state.camYaw = prev.yaw;
      ctx.setActive(prev.active);
      ctx.setCamMode(prev.mode);
      state.keys = {};
      return results;
    },
  };
})();
