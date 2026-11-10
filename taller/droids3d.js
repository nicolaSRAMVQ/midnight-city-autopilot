// ───────────────────────── Droides 3D de Alta Fidelidad y 10 Mods Transformables ─────────────────────────
// Inspirado en RobotView.swift (la Comandera de R2) llevado a Three.js con materiales PBR realistas.

window.DROID_SKINS = {
  clasico:  { title: "Clásico",  body: "#f2f5fa", body2: "#cfd6e3", trim: "#2563eb", metal: "#8b95a8", dark: "#272d3b", eye: "#38bdf8" },
  imperial: { title: "Imperial", body: "#323642", body2: "#1c1f28", trim: "#e11d48", metal: "#687082", dark: "#11131a", eye: "#ff2a4b" },
  dorado:   { title: "Dorado",   body: "#f6c85f", body2: "#c8962e", trim: "#8f5314", metal: "#a38852", dark: "#3d2b12", eye: "#fef08a" },
  neon:     { title: "Neón",     body: "#25293e", body2: "#151826", trim: "#f43f5e", metal: "#22d3ee", dark: "#090b12", eye: "#34d399" },
  bosque:   { title: "Bosque",   body: "#8a996c", body2: "#5d6b47", trim: "#ea580c", metal: "#736e5f", dark: "#2c3024", eye: "#a3e635" },
  sakura:   { title: "Sakura",   body: "#fdf2f6", body2: "#f5d0fe", trim: "#ec4899", metal: "#b89da8", dark: "#4a2c3a", eye: "#f472b6" },
};

window.ROBOT_MODS = [
  { id: "droide",       icon: "🤖", title: "Droide",       sub: "clásico",       flies: false, key: "1" },
  { id: "cohete",       icon: "🚀", title: "Cohete",       sub: "propulsores",   flies: true,  key: "2" },
  { id: "nave",         icon: "✈️", title: "Nave",         sub: "caza estelar",  flies: true,  key: "3" },
  { id: "mechaBlaster", icon: "🔫", title: "Mecha Blaster",sub: "blaster",       flies: false, key: "4" },
  { id: "mechaSable",   icon: "⚔️", title: "Mecha Sable",  sub: "sable láser",   flies: false, key: "5" },
  { id: "mechaCanon",   icon: "💥", title: "Mecha Cañón",  sub: "artillería",    flies: false, key: "6" },
  { id: "tanque",       icon: "🛡️", title: "Tanque",       sub: "orugas",        flies: false, key: "7" },
  { id: "transformer",  icon: "🏎️", title: "Transformer",  sub: "auto ↔ robot",  flies: false, key: "8" },
  { id: "bola",         icon: "⚪", title: "Bola",         sub: "esfera BB",     flies: false, key: "9" },
  { id: "dron",         icon: "🚁", title: "Dron",         sub: "cuadricóptero", flies: true,  key: "0" },
];

(function () {
  const ENV_METAL = 1.05;

  function pbr(color, opts = {}) {
    const metalness = opts.metalness ?? 0.35;
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.32,
      metalness,
      envMapIntensity: opts.envMapIntensity ?? (metalness > 0.4 ? ENV_METAL : 0.5),
      ...opts,
    });
  }

  function mesh(parent, geo, material, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot[0] || rot[1] || rot[2]) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale[0] !== 1 || scale[1] !== 1 || scale[2] !== 1) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function materialsOf(d) {
    const sk = window.DROID_SKINS[d.skin] || window.DROID_SKINS.clasico;
    const bodyHex = d.body || sk.body;
    const trimHex = d.trim || sk.trim;
    const eyeHex = d.eye || sk.eye;
    return {
      body: pbr(bodyHex, { metalness: 0.35, roughness: 0.28 }),
      body2: pbr(sk.body2, { metalness: 0.45, roughness: 0.34 }),
      chrome: pbr(bodyHex, { metalness: 0.88, roughness: 0.14 }),
      trim: pbr(trimHex, { metalness: 0.52, roughness: 0.26 }),
      metal: pbr(sk.metal, { metalness: 0.78, roughness: 0.24 }),
      dark: pbr(sk.dark, { metalness: 0.4, roughness: 0.5 }),
      lensBlack: pbr(0x06080f, { metalness: 0.92, roughness: 0.06 }),
      copper: pbr(0xc27838, { metalness: 0.85, roughness: 0.22 }),
      eye: pbr(eyeHex, { emissive: eyeHex, emissiveIntensity: 1.5, roughness: 0.15 }),
      ledRed: pbr(0xff2942, { emissive: 0xff2942, emissiveIntensity: 1.6 }),
      ledCyan: pbr(0x38bdf8, { emissive: 0x38bdf8, emissiveIntensity: 1.4 }),
      flameOuter: new THREE.MeshBasicMaterial({ color: 0xff7b1c, transparent: true, opacity: 0.88 }),
      flameInner: new THREE.MeshBasicMaterial({ color: 0xfff59e, transparent: true, opacity: 0.95 }),
    };
  }

  // Cúpula detallada de R2 (se usa en R2 clásico y en todos sus mods)
  function buildDomeHead(M, radius = 0.64, withAntenna = true) {
    const head = new THREE.Group();
    // Semiesfera cromada principal
    mesh(head, new THREE.SphereGeometry(radius, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), M.chrome);
    // Anillo base mecanizado
    mesh(head, new THREE.CylinderGeometry(radius * 1.01, radius * 1.02, radius * 0.11, 40), M.metal, [0, radius * 0.04, 0]);
    mesh(head, new THREE.TorusGeometry(radius * 1.005, radius * 0.03, 10, 40), M.trim, [0, radius * 0.1, 0], [Math.PI / 2, 0, 0]);

    // Corona superior y segmentos radiales azules en la cúpula
    mesh(head, new THREE.CylinderGeometry(radius * 0.25, radius * 0.28, radius * 0.04, 24), M.trim, [0, radius * 0.97, 0]);
    for (let i = 0; i < 8; i++) {
      if (i === 0) continue; // deja espacio al fotoreceptor frontal
      const a = (i / 8) * Math.PI * 2;
      const seg = new THREE.Group();
      seg.rotation.y = a;
      mesh(seg, new THREE.BoxGeometry(radius * 0.22, radius * 0.16, radius * 0.04), M.trim, [0, radius * 0.24, radius * 0.94], [-0.24, 0, 0]);
      if (i % 2 === 0) {
        mesh(seg, new THREE.BoxGeometry(radius * 0.18, radius * 0.22, radius * 0.035), M.trim, [0, radius * 0.54, radius * 0.81], [-0.62, 0, 0]);
      }
      head.add(seg);
    }

    // Fotoreceptor principal (ojo negro brillante + pupila luminosa + reflejo)
    const eyeGrp = new THREE.Group();
    eyeGrp.position.set(0, radius * 0.44, radius * 0.86);
    eyeGrp.rotation.x = -0.38;
    mesh(eyeGrp, new THREE.CylinderGeometry(radius * 0.2, radius * 0.22, radius * 0.12, 24), M.trim, [0, 0, 0], [Math.PI / 2, 0, 0]);
    mesh(eyeGrp, new THREE.SphereGeometry(radius * 0.17, 20, 16), M.lensBlack, [0, 0, radius * 0.03]);
    const pupil = mesh(eyeGrp, new THREE.SphereGeometry(radius * 0.075, 16, 12), M.eye, [0, 0, radius * 0.13]);
    mesh(eyeGrp, new THREE.SphereGeometry(radius * 0.028, 10, 10), pbr(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), [-radius * 0.045, radius * 0.045, radius * 0.16]);
    head.add(eyeGrp);

    // Holoproyector frontal biselado + LED lógico rojo/verde + displays de estado
    const holo = mesh(head, new THREE.CylinderGeometry(radius * 0.08, radius * 0.1, radius * 0.14, 16), M.metal, [-radius * 0.34, radius * 0.22, radius * 0.89], [Math.PI / 2 - 0.2, -0.35, 0]);
    mesh(holo, new THREE.SphereGeometry(radius * 0.065, 14, 12), M.ledCyan, [0, radius * 0.06, 0]);

    const led = mesh(head, new THREE.SphereGeometry(radius * 0.06, 14, 14), M.ledRed, [radius * 0.28, radius * 0.24, radius * 0.9]);
    // Ranura lógica frontal con 3 micro-barras luminosas
    for (let k = -1; k <= 1; k++) {
      mesh(head, new THREE.BoxGeometry(radius * 0.045, radius * 0.09, radius * 0.03), k === 0 ? M.eye : M.ledCyan, [radius * 0.48 + k * radius * 0.06, radius * 0.22, radius * 0.81], [0, 0.48, 0]);
    }

    if (withAntenna) {
      const ant = new THREE.Group();
      ant.position.set(radius * 0.22, radius * 0.92, -radius * 0.1);
      mesh(ant, new THREE.CylinderGeometry(radius * 0.04, radius * 0.055, radius * 0.1, 12), M.metal, [0, 0.04, 0]);
      mesh(ant, new THREE.CylinderGeometry(radius * 0.018, radius * 0.022, radius * 0.48, 10), M.chrome, [0, radius * 0.26, 0]);
      const tip = mesh(ant, new THREE.SphereGeometry(radius * 0.055, 12, 12), M.ledRed, [0, radius * 0.52, 0]);
      head.add(ant);
      head.userData.antTip = tip;
    }

    head.userData.pupil = pupil;
    head.userData.led = led;
    return head;
  }

  function makeFlameGroup(M, scale = 1) {
    const g = new THREE.Group();
    const outer = mesh(g, new THREE.ConeGeometry(0.14 * scale, 0.65 * scale, 14), M.flameOuter, [0, -0.32 * scale, 0], [Math.PI, 0, 0]);
    const inner = mesh(g, new THREE.ConeGeometry(0.075 * scale, 0.42 * scale, 12), M.flameInner, [0, -0.21 * scale, 0], [Math.PI, 0, 0]);
    g.userData = { outer, inner, baseScale: scale };
    return g;
  }

  // 1. R2 Clásico / Cohete
  function buildR2Classic(d, hover = false) {
    const g = new THREE.Group();
    const M = materialsOf(d);
    g.userData.anim = { flames: [], rotors: [], wheels: [] };

    // Torso cilíndrico detallado con faldón inferior
    const torso = new THREE.Group();
    torso.position.y = 1.24;
    mesh(torso, new THREE.CylinderGeometry(0.64, 0.64, 1.28, 40), M.body);
    mesh(torso, new THREE.CylinderGeometry(0.64, 0.52, 0.22, 32), M.body2, [0, -0.74, 0]);
    mesh(torso, new THREE.TorusGeometry(0.642, 0.022, 8, 40), M.metal, [0, 0.62, 0], [Math.PI / 2, 0, 0]);
    mesh(torso, new THREE.TorusGeometry(0.642, 0.018, 8, 40), M.metal, [0, -0.62, 0], [Math.PI / 2, 0, 0]);

    // Paneles frontales de pecho (ranuras horizontales, rejilla de ventilación y puerto octogonal)
    mesh(torso, new THREE.BoxGeometry(0.46, 0.11, 0.05), M.trim, [0, 0.38, 0.625]);
    mesh(torso, new THREE.BoxGeometry(0.46, 0.11, 0.05), M.trim, [0, 0.22, 0.625]);
    // 3 barras verticales luminosas + puerto de datos
    for (let i = 0; i < 3; i++) {
      mesh(torso, new THREE.BoxGeometry(0.06, 0.24, 0.055), M.trim, [-0.16 + i * 0.09, -0.05, 0.626]);
      mesh(torso, new THREE.BoxGeometry(0.03, 0.18, 0.06), M.ledCyan, [-0.16 + i * 0.09, -0.05, 0.63]);
    }
    mesh(torso, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), M.metal, [0.16, -0.05, 0.62], [Math.PI / 2, 0, 0]);
    mesh(torso, new THREE.CylinderGeometry(0.06, 0.06, 0.07, 8), M.dark, [0.16, -0.05, 0.625], [Math.PI / 2, 0, 0]);
    mesh(torso, new THREE.BoxGeometry(0.38, 0.22, 0.045), M.body2, [0, -0.38, 0.622]);
    // Panel trasero
    mesh(torso, new THREE.BoxGeometry(0.48, 0.72, 0.04), M.body2, [0, 0.04, -0.622]);
    g.add(torso);

    // Cúpula
    const head = buildDomeHead(M, 0.64, d.parts?.antena !== false);
    head.position.set(0, 1.9, 0);
    g.add(head);
    g.userData.head = head;

    // 2 Piernas articuladas laterales + hombreras + cables de cobre + pies trapezoidales
    [-1, 1].forEach((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.76, 1.52, 0);
      // Hombrera circular con tapa metálica
      mesh(leg, new THREE.CylinderGeometry(0.24, 0.24, 0.16, 24), M.body2, [0, 0, 0], [0, 0, Math.PI / 2]);
      mesh(leg, new THREE.CylinderGeometry(0.15, 0.15, 0.19, 20), M.metal, [s * 0.02, 0, 0], [0, 0, Math.PI / 2]);
      // Columna de la pierna con franja azul
      mesh(leg, new THREE.BoxGeometry(0.22, 1.06, 0.36), M.body, [0, -0.52, 0]);
      mesh(leg, new THREE.BoxGeometry(0.23, 0.68, 0.14), M.trim, [0, -0.46, 0.12]);
      // Cilindro hidráulico lateral
      mesh(leg, new THREE.CylinderGeometry(0.045, 0.045, 0.85, 12), M.metal, [s * 0.09, -0.52, -0.14]);
      // Tobillo y cables de cobre
      mesh(leg, new THREE.CylinderGeometry(0.13, 0.15, 0.18, 16), M.body2, [0, -1.06, 0], [0, 0, Math.PI / 2]);
      mesh(leg, new THREE.TorusGeometry(0.09, 0.022, 8, 16, Math.PI), M.copper, [s * 0.08, -1.12, 0.1], [0, Math.PI / 2, 0]);
      // Pie trapezoidal + batería lateral
      const foot = new THREE.Group();
      foot.position.set(0, -1.32, 0.04);
      mesh(foot, new THREE.CylinderGeometry(0.18, 0.28, 0.28, 4), M.body, [0, 0, 0], [0, Math.PI / 4, 0], [0.85, 1, 1.55]);
      mesh(foot, new THREE.BoxGeometry(0.32, 0.08, 0.56), M.trim, [0, -0.12, 0]);
      mesh(foot, new THREE.BoxGeometry(0.1, 0.16, 0.38), M.body2, [s * 0.18, -0.04, 0]);
      leg.add(foot);

      // Propulsores de cohete en las piernas
      if (hover) {
        const booster = new THREE.Group();
        booster.position.set(s * 0.14, -0.78, 0);
        mesh(booster, new THREE.CylinderGeometry(0.09, 0.12, 0.32, 16), M.metal);
        mesh(booster, new THREE.CylinderGeometry(0.11, 0.07, 0.14, 16), M.dark, [0, -0.2, 0]);
        const fl = makeFlameGroup(M, 1.15);
        fl.position.set(0, -0.26, 0);
        booster.add(fl);
        g.userData.anim.flames.push(fl);
        leg.add(booster);
      }
      g.add(leg);
    });

    // 3ra pata central retráctil (plegada en modo cohete, apoyada en modo clásico)
    if (!hover) {
      const centerLeg = new THREE.Group();
      centerLeg.position.set(0, 0.55, 0.24);
      centerLeg.rotation.x = -0.22;
      mesh(centerLeg, new THREE.BoxGeometry(0.16, 0.45, 0.2), M.body2, [0, 0, 0]);
      mesh(centerLeg, new THREE.BoxGeometry(0.26, 0.14, 0.42), M.trim, [0, -0.28, 0.05], [0.22, 0, 0]);
      g.add(centerLeg);
    } else {
      g.position.y = 0.55;
    }

    return g;
  }

  // 2. Mod Nave (Caza Estelar de R2)
  function buildR2Ship(d) {
    const g = new THREE.Group();
    const M = materialsOf(d);
    g.userData.anim = { flames: [], rotors: [], wheels: [] };

    const ship = new THREE.Group();
    ship.position.y = 1.65;

    // Fuselaje central aerodinámico
    mesh(ship, new THREE.CylinderGeometry(0.55, 0.72, 2.5, 24), M.body, [0, 0, 0.15], [Math.PI / 2, 0, 0], [1.1, 1, 0.58]);
    mesh(ship, new THREE.ConeGeometry(0.45, 1.25, 24), M.trim, [0, -0.02, 1.95], [Math.PI / 2, 0, 0], [1.1, 1, 0.55]);
    // Cabina / cúpula de R2 encastrada arriba como astromecánico de caza
    const head = buildDomeHead(M, 0.54, true);
    head.position.set(0, 0.32, 0.05);
    ship.add(head);
    g.userData.head = head;

    // Alas en flecha con cañones láser y luces de navegación
    [-1, 1].forEach((s) => {
      const wing = new THREE.Group();
      mesh(wing, new THREE.BoxGeometry(1.75, 0.08, 0.95), M.body, [s * 1.18, 0, -0.1], [0, -s * 0.25, -s * 0.06]);
      mesh(wing, new THREE.BoxGeometry(1.4, 0.09, 0.24), M.trim, [s * 1.15, 0.01, 0.12], [0, -s * 0.25, -s * 0.06]);
      // Estabilizador vertical inclinado
      mesh(wing, new THREE.BoxGeometry(0.08, 0.65, 0.72), M.body2, [s * 1.92, 0.24, -0.32], [0, 0, -s * 0.35]);
      // Cañón láser en punta de ala
      mesh(wing, new THREE.CylinderGeometry(0.045, 0.06, 1.25, 12), M.metal, [s * 1.98, -0.04, 0.35], [Math.PI / 2, 0, 0]);
      mesh(wing, new THREE.SphereGeometry(0.06, 10, 10), M.ledCyan, [s * 1.98, -0.04, 0.98]);
      // Luz de navegación (roja babor / verde estribor)
      const navMat = pbr(s < 0 ? 0xff2942 : 0x22c55e, { emissive: s < 0 ? 0xff2942 : 0x22c55e, emissiveIntensity: 1.8 });
      mesh(wing, new THREE.SphereGeometry(0.055, 10, 10), navMat, [s * 2.02, 0.52, -0.35]);
      // Turbina trasera con llama
      mesh(wing, new THREE.CylinderGeometry(0.22, 0.26, 0.75, 20), M.metal, [s * 0.45, 0.02, -1.15], [Math.PI / 2, 0, 0]);
      mesh(wing, new THREE.CylinderGeometry(0.2, 0.16, 0.22, 16), M.dark, [s * 0.45, 0.02, -1.58], [Math.PI / 2, 0, 0]);
      const fl = makeFlameGroup(M, 1.35);
      fl.position.set(s * 0.45, 0.02, -1.68);
      fl.rotation.x = -Math.PI / 2;
      wing.add(fl);
      g.userData.anim.flames.push(fl);
      ship.add(wing);
    });

    g.add(ship);
    g.userData.shipBody = ship;
    return g;
  }

  // 3. Mod Mecha (Blaster / Sable Láser / Cañón de Hombro)
  function buildR2Mech(d, weapon = "blaster") {
    const g = new THREE.Group();
    const M = materialsOf(d);
    g.userData.anim = { flames: [], rotors: [], wheels: [], legs: [], arms: [] };

    // Pelvis y cadera articulada
    const pelvis = mesh(g, new THREE.BoxGeometry(0.76, 0.26, 0.48), M.metal, [0, 1.38, 0]);
    mesh(pelvis, new THREE.BoxGeometry(0.32, 0.34, 0.52), M.trim, [0, -0.02, 0]);

    // Piernas bípedas articuladas
    [-1, 1].forEach((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.32, 1.32, 0);
      // Muslo
      mesh(leg, new THREE.BoxGeometry(0.28, 0.62, 0.32), M.body, [0, -0.32, 0]);
      mesh(leg, new THREE.CylinderGeometry(0.14, 0.14, 0.34, 16), M.metal, [0, -0.62, 0.04], [0, 0, Math.PI / 2]);
      // Rodillera blindada
      mesh(leg, new THREE.BoxGeometry(0.3, 0.24, 0.16), M.trim, [0, -0.6, 0.18]);
      // Pantorrilla + pie mecánico
      const shin = new THREE.Group();
      shin.position.set(0, -0.62, 0);
      mesh(shin, new THREE.BoxGeometry(0.25, 0.58, 0.3), M.body2, [0, -0.3, 0]);
      mesh(shin, new THREE.BoxGeometry(0.14, 0.38, 0.34), M.trim, [0, -0.3, 0.02]);
      mesh(shin, new THREE.BoxGeometry(0.34, 0.14, 0.58), M.metal, [0, -0.62, 0.1]);
      mesh(shin, new THREE.BoxGeometry(0.36, 0.08, 0.24), M.dark, [0, -0.65, 0.28]);
      leg.add(shin);
      leg.userData.shin = shin;
      g.add(leg);
      g.userData.anim.legs.push(leg);
    });

    // Torso Mecha con Arc Reactor luminoso
    const torso = new THREE.Group();
    torso.position.set(0, 1.96, 0);
    mesh(torso, new THREE.BoxGeometry(0.98, 0.92, 0.64), M.body);
    mesh(torso, new THREE.BoxGeometry(0.82, 0.44, 0.68), M.trim, [0, 0.16, 0]);
    // Reactor pectoral
    mesh(torso, new THREE.CylinderGeometry(0.19, 0.22, 0.08, 24), M.metal, [0, 0.16, 0.33], [Math.PI / 2, 0, 0]);
    const reactor = mesh(torso, new THREE.CylinderGeometry(0.13, 0.13, 0.1, 24), M.eye, [0, 0.16, 0.34], [Math.PI / 2, 0, 0]);
    g.userData.reactor = reactor;
    // Jetpack dorsal
    mesh(torso, new THREE.BoxGeometry(0.68, 0.62, 0.28), M.body2, [0, 0.06, -0.42]);
    [-0.2, 0.2].forEach((x) => {
      mesh(torso, new THREE.CylinderGeometry(0.1, 0.13, 0.22, 16), M.dark, [x, -0.3, -0.44]);
    });
    g.add(torso);

    // Cúpula de R2 como cabeza del Mecha
    const head = buildDomeHead(M, 0.56, true);
    head.position.set(0, 2.46, 0);
    g.add(head);
    g.userData.head = head;

    // Cañón pesado de hombro (si weapon === "canon")
    if (weapon === "canon") {
      const cannon = new THREE.Group();
      cannon.position.set(-0.56, 2.55, 0.05);
      cannon.rotation.x = -0.18;
      mesh(cannon, new THREE.BoxGeometry(0.32, 0.32, 0.48), M.trim);
      mesh(cannon, new THREE.CylinderGeometry(0.12, 0.14, 1.35, 20), M.metal, [0, 0.08, 0.62], [Math.PI / 2, 0, 0]);
      mesh(cannon, new THREE.CylinderGeometry(0.15, 0.15, 0.22, 20), M.dark, [0, 0.08, 1.25], [Math.PI / 2, 0, 0]);
      const muzzle = mesh(cannon, new THREE.SphereGeometry(0.11, 14, 14), pbr(0xff9f1c, { emissive: 0xff7b00, emissiveIntensity: 2.0 }), [0, 0.08, 1.36]);
      g.userData.muzzle = muzzle;
      g.add(cannon);
    }

    // Brazos articulados + arma en mano derecha
    [-1, 1].forEach((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 0.68, 2.26, 0);
      // Hombrera blindada
      mesh(arm, new THREE.BoxGeometry(0.36, 0.34, 0.42), M.trim, [s * 0.06, 0.06, 0]);
      mesh(arm, new THREE.CylinderGeometry(0.11, 0.1, 0.48, 16), M.body, [s * 0.08, -0.26, 0]);
      const forearm = new THREE.Group();
      forearm.position.set(s * 0.08, -0.5, 0);
      forearm.rotation.x = s > 0 ? -0.85 : -0.35;
      mesh(forearm, new THREE.BoxGeometry(0.22, 0.52, 0.24), M.body2, [0, -0.24, 0]);
      mesh(forearm, new THREE.BoxGeometry(0.18, 0.18, 0.22), M.dark, [0, -0.54, 0]);

      if (s > 0 && weapon === "blaster") {
        const gun = new THREE.Group();
        gun.position.set(0, -0.62, 0.16);
        gun.rotation.x = Math.PI / 2;
        mesh(gun, new THREE.BoxGeometry(0.14, 0.22, 0.58), M.dark, [0, 0, 0.12]);
        mesh(gun, new THREE.CylinderGeometry(0.055, 0.065, 0.52, 14), M.metal, [0, 0.06, 0.42], [Math.PI / 2, 0, 0]);
        const bolt = mesh(gun, new THREE.SphereGeometry(0.075, 12, 12), M.ledCyan, [0, 0.06, 0.72]);
        g.userData.muzzle = bolt;
        forearm.add(gun);
      } else if (s > 0 && weapon === "sable") {
        forearm.rotation.x = -1.25;
        const saber = new THREE.Group();
        saber.position.set(0, -0.58, 0.08);
        saber.rotation.x = 0.35;
        mesh(saber, new THREE.CylinderGeometry(0.045, 0.05, 0.36, 16), M.metal);
        mesh(saber, new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), M.dark, [0, 0.16, 0]);
        const bladeMat = new THREE.MeshBasicMaterial({ color: 0x60efff });
        const glowMat = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.38 });
        const blade = mesh(saber, new THREE.CylinderGeometry(0.026, 0.03, 1.55, 16), bladeMat, [0, 0.96, 0]);
        mesh(saber, new THREE.CylinderGeometry(0.068, 0.072, 1.58, 16), glowMat, [0, 0.96, 0]);
        g.userData.saberBlade = blade;
        g.userData.saberArm = arm;
        forearm.add(saber);
      }

      arm.add(forearm);
      g.add(arm);
      g.userData.anim.arms.push(arm);
    });

    return g;
  }

  // 4. Mod Tanque (Orugas + Cañón Pesado + Cúpula Torreta)
  function buildR2Tank(d) {
    const g = new THREE.Group();
    const M = materialsOf(d);
    g.userData.anim = { flames: [], rotors: [], wheels: [] };

    // Orugas laterales con ruedas dentadas
    [-1, 1].forEach((s) => {
      const track = new THREE.Group();
      track.position.set(s * 0.86, 0.36, 0);
      mesh(track, new THREE.BoxGeometry(0.34, 0.46, 2.2), M.dark);
      mesh(track, new THREE.BoxGeometry(0.38, 0.16, 2.28), M.trim, [0, 0.22, 0]);
      for (let i = -2; i <= 2; i++) {
        const w = mesh(track, new THREE.CylinderGeometry(0.19, 0.19, 0.38, 16), M.metal, [0, -0.03, i * 0.44], [0, 0, Math.PI / 2]);
        mesh(w, new THREE.BoxGeometry(0.32, 0.4, 0.06), M.dark);
        g.userData.anim.wheels.push(w);
      }
      g.add(track);
    });

    // Casco blindado
    const hull = new THREE.Group();
    hull.position.set(0, 0.66, 0);
    mesh(hull, new THREE.BoxGeometry(1.42, 0.46, 2.05), M.body);
    mesh(hull, new THREE.BoxGeometry(1.36, 0.18, 0.55), M.trim, [0, 0.12, 0.85], [0.35, 0, 0]);
    // Faros delanteros
    [-0.45, 0.45].forEach((x) => {
      mesh(hull, new THREE.CylinderGeometry(0.08, 0.08, 0.08, 14), M.eye, [x, 0.08, 1.04], [Math.PI / 2, 0, 0]);
    });
    g.add(hull);

    // Torreta giratoria = base + cañón largo + cúpula R2
    const turret = new THREE.Group();
    turret.position.set(0, 0.92, -0.08);
    mesh(turret, new THREE.CylinderGeometry(0.68, 0.76, 0.24, 32), M.body2, [0, 0.1, 0]);
    // Cañón principal
    const barrel = new THREE.Group();
    barrel.position.set(0, 0.32, 0.55);
    mesh(barrel, new THREE.BoxGeometry(0.32, 0.26, 0.42), M.trim, [0, 0, 0]);
    mesh(barrel, new THREE.CylinderGeometry(0.095, 0.115, 1.55, 20), M.metal, [0, 0, 0.85], [Math.PI / 2, 0, 0]);
    mesh(barrel, new THREE.CylinderGeometry(0.135, 0.135, 0.24, 20), M.dark, [0, 0, 1.62], [Math.PI / 2, 0, 0]);
    turret.add(barrel);

    const head = buildDomeHead(M, 0.64, true);
    head.position.set(0, 0.22, 0);
    turret.add(head);
    g.userData.head = head;
    g.add(turret);

    return g;
  }

  // 5. Mod Transformer (interpolación continua entre Auto Deportivo Cyber [pose=0] y Robot [pose=1])
  function buildR2Transformer(d) {
    const g = new THREE.Group();
    const M = materialsOf(d);
    const pose = d.pose ?? 1; // 0 = auto, 1 = robot
    g.userData.anim = { flames: [], rotors: [], wheels: [], legs: [], arms: [] };

    const mix = (a, b, k) => a + (b - a) * k;
    const p = Math.max(0, Math.min(1, pose));

    // Piernas (en auto se pliegan hacia atrás formando la cola del deportivo; en robot se paran verticales)
    [-1, 1].forEach((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * mix(0.38, 0.34, p), mix(0.42, 1.15, p), mix(-0.55, 0, p));
      leg.rotation.x = mix(Math.PI / 2, 0, p);
      mesh(leg, new THREE.BoxGeometry(0.34, 0.92, 0.38), M.body, [0, -0.42, 0]);
      mesh(leg, new THREE.BoxGeometry(0.26, 0.65, 0.42), M.trim, [0, -0.45, 0.03]);
      mesh(leg, new THREE.BoxGeometry(0.38, 0.16, 0.56), M.dark, [0, -0.96, 0.08]);
      // Rueda trasera montada en la pierna
      const w = mesh(leg, new THREE.CylinderGeometry(0.28, 0.28, 0.2, 24), M.dark, [s * 0.22, -0.55, 0], [0, 0, Math.PI / 2]);
      mesh(w, new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16), M.metal);
      g.userData.anim.wheels.push(w);
      g.add(leg);
      g.userData.anim.legs.push(leg);
    });

    // Pecho / Trompa del auto con parrilla y parabrisas
    const chest = new THREE.Group();
    chest.position.set(0, mix(0.52, 1.88, p), mix(0.42, 0, p));
    chest.rotation.x = mix(Math.PI / 2, 0, p);
    mesh(chest, new THREE.BoxGeometry(1.06, 0.96, 0.56), M.trim);
    // Ventanas / parabrisas divididos en el pecho
    const glassMat = pbr(0x7dd3fc, { metalness: 0.9, roughness: 0.08 });
    [-0.24, 0.24].forEach((x) => {
      mesh(chest, new THREE.BoxGeometry(0.38, 0.32, 0.59), glassMat, [x, 0.2, 0]);
    });
    // Parrilla cromada y faros amarillos
    mesh(chest, new THREE.BoxGeometry(0.52, 0.28, 0.6), M.metal, [0, -0.22, 0]);
    [-0.36, 0.36].forEach((x) => {
      mesh(chest, new THREE.SphereGeometry(0.085, 14, 14), pbr(0xfef08a, { emissive: 0xfacc15, emissiveIntensity: 1.8 }), [x, -0.24, 0.28]);
    });
    // Ruedas delanteras en los flancos del torso
    [-1, 1].forEach((s) => {
      const w = mesh(chest, new THREE.CylinderGeometry(0.28, 0.28, 0.2, 24), M.dark, [s * 0.6, -0.18, -0.05], [0, 0, Math.PI / 2]);
      mesh(w, new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16), M.metal);
      g.userData.anim.wheels.push(w);
    });
    g.add(chest);

    // Brazos desplegables (ocultos en el chasis cuando pose=0)
    if (p > 0.15) {
      [-1, 1].forEach((s) => {
        const arm = new THREE.Group();
        arm.position.set(s * mix(0.35, 0.72, p), mix(0.6, 2.18, p), 0);
        arm.scale.setScalar(Math.min(1, (p - 0.15) / 0.85));
        mesh(arm, new THREE.BoxGeometry(0.32, 0.34, 0.36), M.trim, [0, 0, 0]);
        mesh(arm, new THREE.BoxGeometry(0.24, 0.78, 0.26), M.body, [s * 0.06, -0.48, 0]);
        mesh(arm, new THREE.BoxGeometry(0.2, 0.2, 0.24), M.dark, [s * 0.06, -0.92, 0]);
        g.add(arm);
        g.userData.anim.arms.push(arm);
      });
    }

    // Cabeza Transformer con antenas y visor + cúpula R2
    if (p > 0.35) {
      const k = (p - 0.35) / 0.65;
      const head = buildDomeHead(M, 0.5, true);
      head.position.set(0, mix(1.4, 2.38, k), 0);
      head.scale.setScalar(k);
      // Cresta y antenas estilo Optimus/Mecha
      mesh(head, new THREE.BoxGeometry(0.14, 0.32, 0.38), M.trim, [0, 0.42, 0.08]);
      [-0.48, 0.48].forEach((x) => {
        mesh(head, new THREE.BoxGeometry(0.07, 0.42, 0.12), M.trim, [x, 0.26, 0]);
      });
      g.add(head);
      g.userData.head = head;
    }

    return g;
  }

  // 6. Mod Bola / BB-8 de Alta Fidelidad
  function buildBallDroid(d, isBB8 = false) {
    const g = new THREE.Group();
    const sk = isBB8 && !d.skinCustom
      ? { body: d.body || "#f4f1ea", trim: d.trim || "#f08a24", eye: d.eye || "#11131a", skin: d.skin || "clasico" }
      : d;
    const M = materialsOf(sk);
    g.userData.anim = { flames: [], rotors: [], wheels: [] };

    const r = 0.96;
    const sphere = new THREE.Group();
    sphere.position.y = r;
    mesh(sphere, new THREE.SphereGeometry(r, 48, 32), M.body);

    // 6 discos característicos en las caras de la esfera + detalles internos
    const dirs = [
      [0, 0, 1, 0, 0, 0],
      [0, 0, -1, 0, Math.PI, 0],
      [1, 0, 0, 0, Math.PI / 2, 0],
      [-1, 0, 0, 0, -Math.PI / 2, 0],
      [0, 1, 0, -Math.PI / 2, 0, 0],
      [0, -1, 0, Math.PI / 2, 0, 0],
    ];
    dirs.forEach(([ , , , rx, ry, rz]) => {
      const face = new THREE.Group();
      face.rotation.set(rx, ry, rz);
      mesh(face, new THREE.TorusGeometry(r * 0.56, r * 0.075, 12, 36), M.trim, [0, 0, r * 0.82]);
      mesh(face, new THREE.CylinderGeometry(r * 0.38, r * 0.38, r * 0.04, 24), M.metal, [0, 0, r * 0.91], [Math.PI / 2, 0, 0]);
      mesh(face, new THREE.BoxGeometry(r * 0.52, r * 0.1, r * 0.05), M.trim, [0, 0, r * 0.93]);
      sphere.add(face);
    });
    // Anillos ecuatoriales sutiles de costura
    mesh(sphere, new THREE.TorusGeometry(r * 1.002, 0.012, 8, 48), M.metal);
    mesh(sphere, new THREE.TorusGeometry(r * 1.002, 0.012, 8, 48), M.metal, [0, 0, 0], [Math.PI / 2, 0, 0]);
    g.add(sphere);
    g.userData.ball = sphere;

    // Cabeza magnética arriba de la esfera
    if (isBB8) {
      const head = new THREE.Group();
      head.position.set(0, r * 2 + 0.02, 0);
      const hr = 0.54;
      mesh(head, new THREE.SphereGeometry(hr, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), M.body);
      mesh(head, new THREE.CylinderGeometry(hr * 1.01, hr * 0.92, 0.1, 36), M.metal, [0, -0.02, 0]);
      mesh(head, new THREE.TorusGeometry(hr * 0.98, 0.032, 10, 36), M.trim, [0, 0.05, 0], [Math.PI / 2, 0, 0]);
      mesh(head, new THREE.TorusGeometry(hr * 0.72, 0.028, 10, 36), M.trim, [0, hr * 0.66, 0], [Math.PI / 2, 0, 0]);
      // Fotoreceptor principal negro brillante + aro cromado + holoproyector lateral
      mesh(head, new THREE.CylinderGeometry(0.15, 0.16, 0.1, 24), M.metal, [0, 0.24, hr * 0.86], [Math.PI / 2 - 0.3, 0, 0]);
      mesh(head, new THREE.SphereGeometry(0.135, 20, 16), M.lensBlack, [0, 0.24, hr * 0.9]);
      mesh(head, new THREE.SphereGeometry(0.035, 10, 10), M.ledRed, [0.03, 0.24, hr * 1.02]);
      mesh(head, new THREE.CylinderGeometry(0.075, 0.085, 0.1, 18), M.dark, [0.22, 0.18, hr * 0.82], [Math.PI / 2 - 0.2, 0.35, 0]);
      mesh(head, new THREE.SphereGeometry(0.055, 12, 12), M.ledCyan, [0.23, 0.18, hr * 0.87]);
      // Doble antena trasera de BB-8
      if (d.parts?.antena !== false) {
        mesh(head, new THREE.CylinderGeometry(0.012, 0.015, 0.52, 8), M.metal, [-0.08, hr + 0.2, -0.14]);
        mesh(head, new THREE.BoxGeometry(0.08, 0.025, 0.02), M.trim, [-0.08, hr + 0.46, -0.14]);
        mesh(head, new THREE.CylinderGeometry(0.01, 0.012, 0.28, 8), M.dark, [0.06, hr + 0.1, -0.18]);
      }
      g.add(head);
      g.userData.head = head;
    } else {
      const head = buildDomeHead(M, 0.54, true);
      head.position.set(0, r * 2 + 0.02, 0);
      g.add(head);
      g.userData.head = head;
    }

    return g;
  }

  // 7. Mod Dron (Cuadricóptero Táctico con Gimbal y 4 Rotores)
  function buildR2Drone(d) {
    const g = new THREE.Group();
    const M = materialsOf(d);
    g.userData.anim = { flames: [], rotors: [], wheels: [] };

    const body = new THREE.Group();
    body.position.y = 1.65;

    // Chasis central octogonal + tren de aterrizaje tipo patín
    mesh(body, new THREE.CylinderGeometry(0.62, 0.54, 0.28, 8), M.body);
    mesh(body, new THREE.CylinderGeometry(0.64, 0.64, 0.08, 8), M.trim, [0, 0.06, 0]);

    // Cámara Gimbal inferior con lente luminoso
    const gimbal = new THREE.Group();
    gimbal.position.set(0, -0.26, 0.22);
    mesh(gimbal, new THREE.SphereGeometry(0.18, 20, 16), M.dark);
    mesh(gimbal, new THREE.CylinderGeometry(0.1, 0.11, 0.12, 16), M.metal, [0, -0.02, 0.14], [Math.PI / 2 + 0.25, 0, 0]);
    mesh(gimbal, new THREE.SphereGeometry(0.08, 14, 14), M.eye, [0, -0.04, 0.19]);
    body.add(gimbal);

    // Patines de aterrizaje
    [-1, 1].forEach((s) => {
      mesh(body, new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8), M.metal, [s * 0.42, -0.34, 0], [0, 0, s * 0.32]);
      mesh(body, new THREE.CylinderGeometry(0.035, 0.035, 1.15, 10), M.dark, [s * 0.52, -0.56, 0], [Math.PI / 2, 0, 0]);
    });

    // 4 Brazos diagonales con motores brushless, protectores y hélices dobles
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], idx) => {
      const arm = new THREE.Group();
      const angle = Math.atan2(sx, sz);
      mesh(arm, new THREE.CylinderGeometry(0.045, 0.055, 1.25, 10), M.metal, [sx * 0.55, 0.04, sz * 0.55], [Math.PI / 2, 0, -angle]);
      const mx = sx * 1.02, mz = sz * 1.02;
      // Motor y aro protector
      mesh(arm, new THREE.CylinderGeometry(0.14, 0.12, 0.18, 16), M.trim, [mx, 0.08, mz]);
      mesh(arm, new THREE.TorusGeometry(0.52, 0.025, 8, 28), M.body2, [mx, 0.16, mz], [Math.PI / 2, 0, 0]);
      // Luz estroboscópica debajo del motor
      const ledMat = pbr(sz > 0 ? 0x38bdf8 : 0xff2942, { emissive: sz > 0 ? 0x38bdf8 : 0xff2942, emissiveIntensity: 1.8 });
      mesh(arm, new THREE.SphereGeometry(0.05, 10, 10), ledMat, [mx, -0.04, mz]);
      // Rotor con 2 palas + disco de velocidad translúcido
      const rotor = new THREE.Group();
      rotor.position.set(mx, 0.2, mz);
      mesh(rotor, new THREE.BoxGeometry(0.92, 0.018, 0.09), M.dark);
      mesh(rotor, new THREE.BoxGeometry(0.09, 0.018, 0.92), M.dark);
      mesh(rotor, new THREE.CylinderGeometry(0.46, 0.46, 0.008, 24), new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.22 }));
      arm.add(rotor);
      g.userData.anim.rotors.push(rotor);
      body.add(arm);
    });

    const head = buildDomeHead(M, 0.52, true);
    head.position.set(0, 0.14, 0);
    body.add(head);
    g.userData.head = head;
    g.add(body);
    g.userData.shipBody = body;

    return g;
  }

  // 8. C-3PO de Alta Fidelidad (Androide de Protocolo)
  function buildC3POHigh(d) {
    const mod = d.mod || "droide";
    if (mod === "nave") return buildR2Ship({ ...d, body: d.body || "#e3b84c", trim: d.trim || "#b8862b", eye: d.eye || "#ffe9a6" });
    if (mod === "tanque") return buildR2Tank({ ...d, body: d.body || "#e3b84c", trim: d.trim || "#b8862b", eye: d.eye || "#ffe9a6" });
    if (mod === "dron") return buildR2Drone({ ...d, body: d.body || "#e3b84c", trim: d.trim || "#b8862b", eye: d.eye || "#ffe9a6" });
    if (mod === "bola") return buildBallDroid({ ...d, body: d.body || "#e3b84c", trim: d.trim || "#b8862b", eye: d.eye || "#ffe9a6" }, false);
    if (mod === "transformer") return buildR2Transformer({ ...d, body: d.body || "#e3b84c", trim: d.trim || "#b8862b", eye: d.eye || "#ffe9a6" });

    const g = new THREE.Group();
    const M = materialsOf({
      ...d,
      body: d.body || "#ecc354",
      trim: d.trim || "#b58324",
      eye: d.eye || "#fef08a",
    });
    const gold = pbr(d.body || "#ecc354", { metalness: 0.88, roughness: 0.18 });
    const brass = pbr(d.trim || "#b58324", { metalness: 0.82, roughness: 0.25 });
    const silver = pbr("#cfd6e3", { metalness: 0.9, roughness: 0.16 }); // pierna derecha plateada clásica
    g.userData.anim = { flames: [], rotors: [], wheels: [], legs: [], arms: [] };

    // Pelvis esculpida
    mesh(g, new THREE.CylinderGeometry(0.32, 0.26, 0.34, 20), gold, [0, 1.38, 0]);
    mesh(g, new THREE.TorusGeometry(0.3, 0.04, 10, 24), brass, [0, 1.52, 0], [Math.PI / 2, 0, 0]);

    // Abdomen de cables multicolores/oscuros expuestos
    const waist = new THREE.Group();
    waist.position.set(0, 1.66, 0);
    mesh(waist, new THREE.CylinderGeometry(0.22, 0.24, 0.28, 16), M.dark);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mesh(waist, new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8), i % 2 ? M.copper : silver, [Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22]);
    }
    g.add(waist);

    // Torso anatómico dorado con disco pectoral y hombreras de campana
    const torso = new THREE.Group();
    torso.position.set(0, 2.16, 0);
    mesh(torso, new THREE.CylinderGeometry(0.42, 0.29, 0.74, 24), gold, [0, 0, 0], [0, 0, 0], [1.15, 1, 0.72]);
    mesh(torso, new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20), brass, [0, 0.12, 0.29], [Math.PI / 2, 0, 0]);
    mesh(torso, new THREE.TorusGeometry(0.15, 0.02, 8, 24), silver, [0, 0.12, 0.31], [Math.PI / 2, 0, 0]);
    if (mod === "cohete") {
      [-0.22, 0.22].forEach((x) => {
        const fl = makeFlameGroup(M, 1.1);
        fl.position.set(x, -0.5, -0.32);
        torso.add(fl);
        g.userData.anim.flames.push(fl);
      });
    }
    g.add(torso);

    // Cuello anillado + Cabeza esculpida de protocolo
    mesh(g, new THREE.CylinderGeometry(0.13, 0.15, 0.22, 16), brass, [0, 2.6, 0]);
    const head = new THREE.Group();
    head.position.set(0, 2.92, 0);
    mesh(head, new THREE.SphereGeometry(0.31, 28, 24), gold, [0, 0.04, 0], [0, 0, 0], [0.88, 1.16, 0.94]);
    // Cresta craneal
    mesh(head, new THREE.BoxGeometry(0.05, 0.42, 0.36), brass, [0, 0.16, -0.02]);
    // Ojos fotoreceptores redondos con rejilla vertical
    [-1, 1].forEach((s) => {
      mesh(head, new THREE.CylinderGeometry(0.085, 0.095, 0.06, 18), brass, [s * 0.11, 0.08, 0.26], [Math.PI / 2, 0, 0]);
      mesh(head, new THREE.SphereGeometry(0.072, 14, 14), M.eye, [s * 0.11, 0.08, 0.27]);
      mesh(head, new THREE.BoxGeometry(0.014, 0.15, 0.02), brass, [s * 0.11, 0.08, 0.33]);
    });
    // Vocabulador (boca rectangular oscura)
    mesh(head, new THREE.BoxGeometry(0.11, 0.045, 0.05), M.dark, [0, -0.12, 0.27]);
    // Orejeras laterales
    [-1, 1].forEach((s) => {
      mesh(head, new THREE.CylinderGeometry(0.08, 0.08, 0.08, 16), brass, [s * 0.28, 0.04, 0], [0, 0, Math.PI / 2]);
    });
    g.add(head);
    g.userData.head = head;

    // Piernas articuladas (derecha con pantorrilla plateada)
    [-1, 1].forEach((s) => {
      const leg = new THREE.Group();
      leg.position.set(s * 0.22, 1.32, 0);
      const shinMat = s > 0 ? silver : gold;
      mesh(leg, new THREE.CylinderGeometry(0.14, 0.11, 0.58, 18), gold, [0, -0.28, 0]);
      mesh(leg, new THREE.SphereGeometry(0.12, 16, 14), brass, [0, -0.6, 0.02]);
      mesh(leg, new THREE.CylinderGeometry(0.11, 0.09, 0.56, 18), shinMat, [0, -0.9, 0]);
      mesh(leg, new THREE.BoxGeometry(0.2, 0.12, 0.38), shinMat, [0, -1.24, 0.08]);
      g.add(leg);
      g.userData.anim.legs.push(leg);
    });

    // Brazos con pistones hidráulicos en los codos + armas opcionales si elige mod Mecha
    [-1, 1].forEach((s) => {
      const arm = new THREE.Group();
      arm.position.set(s * 0.54, 2.42, 0);
      mesh(arm, new THREE.SphereGeometry(0.16, 18, 14), brass);
      mesh(arm, new THREE.CylinderGeometry(0.1, 0.085, 0.48, 16), gold, [s * 0.04, -0.26, 0]);
      // Pistón dorado del codo
      mesh(arm, new THREE.CylinderGeometry(0.022, 0.022, 0.36, 8), silver, [s * 0.14, -0.38, 0.08], [0.35, 0, 0]);
      const forearm = new THREE.Group();
      forearm.position.set(s * 0.04, -0.5, 0);
      forearm.rotation.x = -0.48;
      mesh(forearm, new THREE.CylinderGeometry(0.085, 0.07, 0.46, 16), gold, [0, -0.22, 0]);
      mesh(forearm, new THREE.SphereGeometry(0.08, 12, 12), brass, [0, -0.48, 0]);

      if (s > 0 && (mod === "mechaSable" || d.parts?.brazo)) {
        const saber = new THREE.Group();
        saber.position.set(0, -0.52, 0.08);
        saber.rotation.x = 0.55;
        mesh(saber, new THREE.CylinderGeometry(0.035, 0.04, 0.3, 14), silver);
        mesh(saber, new THREE.CylinderGeometry(0.022, 0.026, 1.35, 14), new THREE.MeshBasicMaterial({ color: 0xfef08a }), [0, 0.78, 0]);
        forearm.add(saber);
      }
      arm.add(forearm);
      g.add(arm);
      g.userData.anim.arms.push(arm);
    });

    if (mod === "cohete") g.position.y = 0.5;
    return g;
  }

  // Constructor unificado para cualquier droide + su Mod y piezas extra
  window.createDroid3D = function (key, design) {
    const d = design || {};
    const mod = d.mod || "droide";
    let root;

    if (key === "C-3PO") {
      root = buildC3POHigh(d);
    } else if (key === "BB-8" && mod === "droide") {
      root = buildBallDroid(d, true);
    } else {
      switch (mod) {
        case "cohete":       root = buildR2Classic(d, true); break;
        case "nave":         root = buildR2Ship(d); break;
        case "mechaBlaster": root = buildR2Mech(d, "blaster"); break;
        case "mechaSable":   root = buildR2Mech(d, "sable"); break;
        case "mechaCanon":   root = buildR2Mech(d, "canon"); break;
        case "tanque":       root = buildR2Tank(d); break;
        case "transformer":  root = buildR2Transformer(d); break;
        case "bola":         root = buildBallDroid(d, key === "BB-8"); break;
        case "dron":         root = buildR2Drone(d); break;
        default:             root = buildR2Classic(d, false); break;
      }
    }

    // Piezas opcionales adicionales (hélices / brazo extra si están activas en un mod terrestre)
    const M = materialsOf(d);
    const topY = key === "C-3PO" ? 3.28 : 2.52;
    if (d.parts?.helices && mod !== "dron") {
      root.userData.anim = root.userData.anim || { flames: [], rotors: [], wheels: [] };
      [[-0.65, -0.65], [0.65, -0.65], [-0.65, 0.65], [0.65, 0.65]].forEach(([x, z]) => {
        mesh(root, new THREE.CylinderGeometry(0.025, 0.03, 0.75, 8), M.metal, [x * 0.6, topY - 0.1, z * 0.6], [z * 0.4, 0, -x * 0.4]);
        const r = new THREE.Group();
        r.position.set(x, topY + 0.18, z);
        mesh(r, new THREE.BoxGeometry(0.75, 0.016, 0.07), M.dark);
        mesh(r, new THREE.BoxGeometry(0.07, 0.016, 0.75), M.dark);
        root.add(r);
        root.userData.anim.rotors.push(r);
      });
    }
    if (d.parts?.brazo && key !== "C-3PO" && !mod.startsWith("mecha")) {
      const arm = new THREE.Group();
      arm.position.set(0.68, 1.55, 0.25);
      arm.rotation.z = -0.65;
      mesh(arm, new THREE.CylinderGeometry(0.05, 0.05, 0.65, 10), M.metal, [0, 0.25, 0]);
      mesh(arm, new THREE.TorusGeometry(0.11, 0.03, 8, 16, Math.PI * 1.3), M.trim, [0, 0.62, 0], [0, 0, 0.8]);
      root.add(arm);
    }

    const holder = new THREE.Group();
    holder.add(root);
    holder.scale.setScalar(d.scale || 1);
    holder.name = key;
    holder.userData.droidRoot = root;
    holder.userData.mod = mod;
    return holder;
  };

  // Animación por cuadro de cualquier droide (rotores, llamas, piernas, ruedas, bola, cabeza)
  window.animateDroid3D = function (holder, dt, t, motion = 0, travel = 0) {
    if (!holder || !holder.userData.droidRoot) return;
    const root = holder.userData.droidRoot;
    const anim = root.userData.anim || {};

    // Rotores de dron
    (anim.rotors || []).forEach((r, i) => {
      r.rotation.y += dt * (28 + i * 3);
    });

    // Llamas de cohete / nave
    (anim.flames || []).forEach((fl, i) => {
      const flick = 0.82 + 0.35 * Math.abs(Math.sin(t * 28 + i * 2.1));
      fl.scale.set(1, flick + motion * 0.35, 1);
    });

    // Ruedas de tanque / transformer
    (anim.wheels || []).forEach((w) => {
      w.rotation.x = travel * 1.8;
    });

    // Esfera rodante (BB-8 o Mod Bola)
    if (root.userData.ball) {
      root.userData.ball.rotation.x = travel * 1.1;
      root.userData.ball.rotation.z = Math.sin(t * 1.5) * 0.06;
    }

    // Piernas bípedas (Mecha / Transformer / C-3PO)
    if (anim.legs && anim.legs.length === 2) {
      const stride = Math.sin(travel * 2.6) * motion * 0.55;
      anim.legs[0].rotation.x = stride;
      anim.legs[1].rotation.x = -stride;
      if (anim.arms && anim.arms.length === 2) {
        anim.arms[0].rotation.x = -stride * 0.6;
        if (!root.userData.saberArm) anim.arms[1].rotation.x = stride * 0.6;
      }
    }

    // Esgrima suave del sable láser
    if (root.userData.saberArm) {
      root.userData.saberArm.rotation.x = Math.sin(t * 2.4) * 0.22;
      root.userData.saberArm.rotation.z = Math.cos(t * 1.8) * 0.12;
    }

    // Cabeza viva mirando alrededor
    if (root.userData.head) {
      root.userData.head.rotation.y = Math.sin(t * 0.9) * 0.28 + Math.sin(t * 2.3) * 0.06;
    }

    // Flotación suave en modos de vuelo
    if (root.userData.shipBody) {
      root.userData.shipBody.position.y = 1.65 + Math.sin(t * 2.6) * 0.12;
    }
  };
})();
