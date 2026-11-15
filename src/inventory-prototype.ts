import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  PlaneGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  Group,
  Object3D,
  DoubleSide,
  Color,
  RayInteractable,
  PokeInteractable,
  Hovered,
  Pressed,
  createSystem,
  type World,
} from '@iwsdk/core';

type Product = {
  name: string;
  price: number;
  stock: number;
  initialStock: number;
  selected: number;
  color: number;
  accentHex: string;
  x: number;
  material?: MeshStandardMaterial;
  mesh?: Mesh;
  pedestalRing?: Mesh;
};

let internalConfirmSale: (() => void) | null = null;
let activeHoverCallback: ((name: string, isHovered: boolean) => void) | null = null;

// Executive Audio Feedback (client-side Web Audio API synthesis)
let audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playSelectChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now); // F#5
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (_) {}
}

function playConfirmationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Dual harmonic chime: D5 (587.33Hz) -> A5 (880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.0, now + 0.08);
    gain2.gain.setValueAtTime(0.09, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.65);
  } catch (_) {}
}

export function createInventoryPrototype(world: World): void {
  const products: Product[] = [
    {
      name: 'RICE',
      price: 25000,
      stock: 12,
      initialStock: 12,
      selected: 0,
      color: 0xd4ac60,
      accentHex: '#f59e0b',
      x: -0.65,
    },
    {
      name: 'COOKING OIL',
      price: 8500,
      stock: 8,
      initialStock: 8,
      selected: 0,
      color: 0x10b981,
      accentHex: '#10b981',
      x: 0,
    },
    {
      name: 'DRINKS',
      price: 4500,
      stock: 15,
      initialStock: 15,
      selected: 0,
      color: 0x06b6d4,
      accentHex: '#06b6d4',
      x: 0.65,
    },
  ];

  let totalRevenue = 0;
  let completedOrders = 0;

  const money = (value: number) =>
    'NGN ' + value.toLocaleString('en-NG');

  // Helper to draw rounded rectangle in Canvas 2D
  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // High-Resolution Glassmorphic 3D Canvas Panel
  function createGlassPanel(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    parent?: Mesh | Object3D,
    rotY = 0,
    rotX = 0,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 512;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D unavailable');
    }

    const texture = new CanvasTexture(canvas);

    const material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    });

    const mesh = new Mesh(
      new PlaneGeometry(width, height),
      material,
    );

    mesh.position.set(x, y, z);
    if (rotY) mesh.rotation.y = rotY;
    if (rotX) mesh.rotation.x = rotX;

    if (parent) {
      parent.add(mesh);
    } else {
      world.createTransformEntity(mesh);
    }

    type PanelOptions = {
      eyebrow?: string;
      eyebrowColor?: string;
      title?: string;
      titleColor?: string;
      subtitle?: string;
      subtitleColor?: string;
      lines?: string[];
      accentBorder?: string;
      badge?: { text: string; bg: string; color: string };
      isButton?: boolean;
      buttonActive?: boolean;
    };

    const render = (optsOrLines: PanelOptions | string[]) => {
      const opts: PanelOptions = Array.isArray(optsOrLines)
        ? { lines: optsOrLines }
        : optsOrLines;

      mesh.userData.textLines = opts.lines ?? [opts.title ?? ''];
      context.clearRect(0, 0, 2048, 512);

      // Glassmorphic background gradient
      const bgGrad = context.createLinearGradient(0, 0, 0, 512);
      if (opts.isButton) {
        if (opts.buttonActive) {
          bgGrad.addColorStop(0, 'rgba(16, 185, 129, 0.98)');
          bgGrad.addColorStop(1, 'rgba(5, 150, 105, 1.0)');
        } else {
          bgGrad.addColorStop(0, 'rgba(6, 95, 70, 0.92)');
          bgGrad.addColorStop(1, 'rgba(4, 71, 52, 0.96)');
        }
      } else {
        bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.92)');
        bgGrad.addColorStop(1, 'rgba(9, 14, 26, 0.97)');
      }

      roundRect(context, 16, 16, 2016, 480, 48);
      context.fillStyle = bgGrad;
      context.fill();

      // Border gradient with high-contrast glow
      const borderGrad = context.createLinearGradient(0, 0, 2048, 512);
      if (opts.isButton) {
        borderGrad.addColorStop(0, opts.buttonActive ? '#a7f3d0' : '#34d399');
        borderGrad.addColorStop(1, '#059669');
      } else if (opts.accentBorder) {
        borderGrad.addColorStop(0, opts.accentBorder);
        borderGrad.addColorStop(1, '#38bdf8');
      } else {
        borderGrad.addColorStop(0, '#38bdf8');
        borderGrad.addColorStop(0.5, '#818cf8');
        borderGrad.addColorStop(1, '#10b981');
      }

      context.lineWidth = opts.isButton ? 14 : 10;
      context.strokeStyle = borderGrad;
      context.stroke();

      context.textAlign = 'center';
      context.textBaseline = 'middle';

      let currentY = 100;

      // Eyebrow
      if (opts.eyebrow) {
        context.font = 'bold 44px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.eyebrowColor || '#38bdf8';
        context.fillText(opts.eyebrow.toUpperCase(), 1024, currentY, 1920);
        currentY += 95;
      }

      // Title (large, high-contrast, perfectly legible)
      if (opts.title) {
        context.font = 'bold 88px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.titleColor || '#ffffff';
        context.fillText(opts.title, 1024, currentY, 1920);
        currentY += 105;
      }

      // Subtitle
      if (opts.subtitle) {
        context.font = '600 52px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.subtitleColor || '#cbd5e1';
        context.fillText(opts.subtitle, 1024, currentY, 1920);
      }

      // Plain lines fallback if passed as array
      if (opts.lines && opts.lines.length > 0) {
        const lineCount = opts.lines.length;
        const fontSize = lineCount > 2 ? 60 : 76;
        context.font = `bold ${fontSize}px "Segoe UI", -apple-system, sans-serif`;
        context.fillStyle = '#ffffff';

        opts.lines.forEach((line, index) => {
          const rowHeight = 480 / (lineCount + 1);
          context.fillText(
            line,
            1024,
            16 + rowHeight * (index + 1),
            1920,
          );
        });
      }

      texture.needsUpdate = true;
    };

    mesh.userData.textLines = [];
    render.mesh = mesh;
    return render;
  }

  // ==========================================
  // SPATIAL UI PANELS (ZERO-OCCLUSION HIERARCHY)
  // ==========================================

  // 1. TOP: Unified Executive Marquee (Identity + Live Business Revenue)
  const renderMarquee = createGlassPanel(
    0,
    2.22,
    -1.85,
    1.90,
    0.36,
  );

  // 2. MIDDLE: Floating Product Info Tags (directly above each product)
  const productLabels = products.map((product) =>
    createGlassPanel(
      product.x,
      1.62,
      -1.60,
      0.42,
      0.16,
    ),
  );

  // 3. BOTTOM CENTER: Pending Order & Checkout Summary (tilted along counter)
  const renderOrder = createGlassPanel(
    0,
    0.76,
    -1.38,
    0.95,
    0.22,
    undefined,
    0,
    -0.38,
  );

  // 4. LEFT: Compact Business Overview Terminal (symmetrical balance)
  const renderOverview = createGlassPanel(
    -1.25,
    1.05,
    -1.20,
    0.58,
    0.26,
    undefined,
    0.32,
  );

  // 5. SUCCESS EXPERIENCE: Dedicated Centered Toast Banner (zero product occlusion)
  const renderSuccessBanner = createGlassPanel(
    0,
    1.88,
    -1.75,
    1.30,
    0.28,
  );
  renderSuccessBanner.mesh.visible = false;

  function orderTotal(): number {
    return products.reduce(
      (total, product) =>
        total + product.selected * product.price,
      0,
    );
  }

  function refresh(message = 'Select a product to begin') {
    // 1. Top Marquee Update
    renderMarquee({
      eyebrow: '✦ SPATIAL BUSINESS DESK  |  INTERACTIVE RETAIL WORKSPACE ✦',
      eyebrowColor: '#38bdf8',
      title: `REVENUE: ${money(totalRevenue)}   |   SALES: ${completedOrders}`,
      titleColor: '#ffffff',
      subtitle: message,
      subtitleColor: '#cbd5e1',
      accentBorder: '#38bdf8',
    });

    // 2. Product Labels (Positioned above each product)
    products.forEach((product, index) => {
      const isLowStock = product.stock <= 3;
      const isInCart = product.selected > 0;

      let tagSubtitle = `${money(product.price)} • Stock: ${product.stock}`;
      if (isInCart) {
        tagSubtitle = `${money(product.price)} • IN CART: ${product.selected}`;
      } else if (isLowStock) {
        tagSubtitle = `${money(product.price)} • LOW STOCK: ${product.stock}`;
      }

      productLabels[index]({
        eyebrow: isLowStock ? '⚠️ LOW STOCK' : isInCart ? '✓ IN ORDER' : 'IN STOCK',
        eyebrowColor: isLowStock ? '#ef4444' : isInCart ? '#34d399' : '#38bdf8',
        title: product.name,
        titleColor: '#ffffff',
        subtitle: tagSubtitle,
        subtitleColor: isInCart ? '#34d399' : isLowStock ? '#f59e0b' : '#cbd5e1',
        accentBorder: isLowStock
          ? '#ef4444'
          : isInCart
          ? '#10b981'
          : product.accentHex,
      });

      // Update pedestal halo ring intensity based on stock / cart status
      if (product.pedestalRing) {
        const mat = product.pedestalRing.material as MeshStandardMaterial;
        if (mat) {
          if (isInCart) {
            mat.color.setHex(0x10b981);
            mat.emissive.setHex(0x10b981);
            mat.emissiveIntensity = 0.85;
          } else if (isLowStock) {
            mat.color.setHex(0xd97706);
            mat.emissive.setHex(0xd97706);
            mat.emissiveIntensity = 0.5;
          } else {
            mat.color.setHex(product.color);
            mat.emissive.setHex(product.color);
            mat.emissiveIntensity = 0.3;
          }
        }
      }
    });

    const itemCount = products.reduce(
      (sum, product) => sum + product.selected,
      0,
    );

    // 3. Bottom Center Order Terminal
    renderOrder({
      title: `TOTAL: ${money(orderTotal())}`,
      titleColor: itemCount > 0 ? '#34d399' : '#ffffff',
      subtitle: itemCount > 0 ? `STAGED: ${itemCount} ITEM(S) • PINCH CONFIRM` : 'ORDER BASKET EMPTY',
      subtitleColor: itemCount > 0 ? '#a7f3d0' : '#94a3b8',
      accentBorder: itemCount > 0 ? '#10b981' : '#38bdf8',
    });

    // 4. Left Business Overview Terminal (Accurate Prototype Attribution)
    renderOverview({
      eyebrow: '✦ STORE OVERVIEW ✦',
      eyebrowColor: '#a78bfa',
      title: 'DAILY TARGET: ₦100K',
      titleColor: '#ffffff',
      subtitle: `Shift: Active Merchant • Prototype Ledger`,
      subtitleColor: '#cbd5e1',
      accentBorder: '#8b5cf6',
    });

    // Update Confirm Button Face
    updateConfirmButtonVisual(false);

    // Synchronize HTML container dataset for automated tests and telemetry
    const container = document.getElementById('scene-container');
    if (container) {
      container.dataset.revenue = String(totalRevenue);
      container.dataset.completedOrders = String(completedOrders);
      container.dataset.orderTotal = String(orderTotal());
      container.dataset.itemCount = String(itemCount);
      for (const p of products) {
        const key = p.name.toLowerCase().replace(/\s+/g, '_');
        container.dataset[`stock_${key}`] = String(p.stock);
        container.dataset[`selected_${key}`] = String(p.selected);
      }
    }
  }

  // ==========================================
  // SHOWROOM ARCHITECTURAL ENVIRONMENT
  // ==========================================

  // 1. Executive Floating Counter Desk
  const deskGroup = new Group();
  deskGroup.position.set(0, 0.88, -1.60);

  // Main Desk Counter Slab (brushed obsidian / dark slate)
  const deskTop = new Mesh(
    new BoxGeometry(2.70, 0.06, 0.85),
    new MeshStandardMaterial({
      color: 0x0f1523,
      roughness: 0.28,
      metalness: 0.35,
    }),
  );
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  deskGroup.add(deskTop);

  // Champagne Brass Front Edge Trim
  const brassTrim = new Mesh(
    new BoxGeometry(2.72, 0.018, 0.03),
    new MeshStandardMaterial({
      color: 0xc8a265,
      roughness: 0.22,
      metalness: 0.85,
    }),
  );
  brassTrim.position.set(0, 0.02, 0.42);
  deskGroup.add(brassTrim);

  // Recessed Cyan LED Underglow Strip
  const underglow = new Mesh(
    new BoxGeometry(2.62, 0.012, 0.02),
    new MeshBasicMaterial({ color: 0x00d4ff }),
  );
  underglow.position.set(0, -0.035, 0.41);
  deskGroup.add(underglow);

  // Dual Architectural Support Pedestals (grounded pillars)
  [-0.95, 0.95].forEach((px) => {
    const pillar = new Mesh(
      new CylinderGeometry(0.16, 0.20, 0.88, 20),
      new MeshStandardMaterial({
        color: 0x0b101c,
        roughness: 0.6,
        metalness: 0.2,
      }),
    );
    pillar.position.set(px, -0.44, 0);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    deskGroup.add(pillar);
  });

  world.createTransformEntity(deskGroup);

  // 2. Executive Architectural Feature Wall (Rich Navy/Slate with Vertical Slats)
  const backdropGroup = new Group();
  backdropGroup.position.set(0, 1.85, -3.20);

  // Base Wall in deep royal navy slate (reflects studio lighting)
  const wallBase = new Mesh(
    new BoxGeometry(4.40, 2.60, 0.06),
    new MeshStandardMaterial({
      color: 0x1c283c,
      roughness: 0.45,
      metalness: 0.20,
    }),
  );
  wallBase.receiveShadow = true;
  backdropGroup.add(wallBase);

  // 5 Vertical Architectural Acoustic Slats in Slate (#24334a)
  [-1.40, -0.70, 0, 0.70, 1.40].forEach((sx) => {
    const slat = new Mesh(
      new BoxGeometry(0.58, 2.40, 0.02),
      new MeshStandardMaterial({
        color: 0x24334a,
        roughness: 0.50,
        metalness: 0.15,
      }),
    );
    slat.position.set(sx, 0, 0.035);
    slat.receiveShadow = true;
    backdropGroup.add(slat);
  });

  // Horizontal Champagne Brass Frieze Trim
  const frieze = new Mesh(
    new BoxGeometry(4.42, 0.028, 0.025),
    new MeshStandardMaterial({
      color: 0xc8a265,
      roughness: 0.22,
      metalness: 0.85,
    }),
  );
  frieze.position.set(0, 1.15, 0.045);
  backdropGroup.add(frieze);

  // Vertical Architectural Accent LED Bars
  const leftLed = new Mesh(
    new BoxGeometry(0.025, 2.40, 0.02),
    new MeshBasicMaterial({ color: 0xf59e0b }),
  );
  leftLed.position.set(-2.10, 0, 0.05);
  backdropGroup.add(leftLed);

  const rightLed = new Mesh(
    new BoxGeometry(0.025, 2.40, 0.02),
    new MeshBasicMaterial({ color: 0x06b6d4 }),
  );
  rightLed.position.set(2.10, 0, 0.05);
  backdropGroup.add(rightLed);

  // Soft Base Wall Floor Underglow
  const wallUnderglow = new Mesh(
    new BoxGeometry(4.30, 0.015, 0.02),
    new MeshBasicMaterial({ color: 0x00e5ff }),
  );
  wallUnderglow.position.set(0, -1.25, 0.04);
  backdropGroup.add(wallUnderglow);

  world.createTransformEntity(backdropGroup);

  // ==========================================
  // HIGH-FIDELITY PRODUCT PEDESTALS & MODELS
  // ==========================================

  products.forEach((product) => {
    // Pedestal Base Cylinder on the counter desk
    const pedestalGroup = new Group();
    pedestalGroup.position.set(product.x, 0.91, -1.60);

    const pedestalBase = new Mesh(
      new CylinderGeometry(0.24, 0.27, 0.04, 24),
      new MeshStandardMaterial({
        color: 0x141b2a,
        roughness: 0.4,
        metalness: 0.5,
      }),
    );
    pedestalGroup.add(pedestalBase);

    // Luminous Pedestal Halo Ring
    const haloRing = new Mesh(
      new TorusGeometry(0.22, 0.007, 12, 32),
      new MeshStandardMaterial({
        color: product.color,
        emissive: new Color(product.color),
        emissiveIntensity: 0.35,
        roughness: 0.3,
      }),
    );
    haloRing.rotation.x = Math.PI / 2;
    haloRing.position.y = 0.022;
    pedestalGroup.add(haloRing);
    product.pedestalRing = haloRing;

    world.createTransformEntity(pedestalGroup);

    // Interactive Base Mesh (Preserves exact hit target coordinates & collider bounds)
    const baseMaterial = new MeshStandardMaterial({
      color: product.color,
      roughness: 0.5,
      transparent: true,
      opacity: 0.0, // Invisible hit container so realistic 3D child meshes shine
    });
    product.material = baseMaterial;

    const mesh = new Mesh(
      new BoxGeometry(0.35, 0.35, 0.25),
      baseMaterial,
    );
    mesh.position.set(product.x, 1.35, -1.60);
    mesh.name = 'SBD-PRODUCT:' + product.name;

    // 1. RICE: Premium organic burlap sack with tied rope neck
    if (product.name === 'RICE') {
      const riceGroup = new Group();

      // Plump sack body
      const sackBody = new Mesh(
        new SphereGeometry(0.155, 16, 12),
        new MeshStandardMaterial({
          color: 0xd9be8b,
          roughness: 0.88,
        }),
      );
      sackBody.scale.set(1.0, 0.55, 0.85);
      sackBody.position.set(0, 0.10, 0);
      riceGroup.add(sackBody);

      // Sack neck
      const sackNeck = new Mesh(
        new CylinderGeometry(0.04, 0.06, 0.09, 12),
        new MeshStandardMaterial({
          color: 0xc4a86f,
          roughness: 0.85,
        }),
      );
      sackNeck.position.set(0, 0.19, 0);
      riceGroup.add(sackNeck);

      // Tied twine rope
      const twine = new Mesh(
        new TorusGeometry(0.045, 0.012, 8, 16),
        new MeshStandardMaterial({
          color: 0x8d6e43,
          roughness: 0.95,
        }),
      );
      twine.rotation.x = Math.PI / 2;
      twine.position.set(0, 0.18, 0);
      riceGroup.add(twine);

      // Golden grains accent top
      const grains = new Mesh(
        new SphereGeometry(0.04, 8, 8),
        new MeshStandardMaterial({
          color: 0xf5d061,
          roughness: 0.5,
        }),
      );
      grains.position.set(0, 0.23, 0);
      riceGroup.add(grains);

      mesh.add(riceGroup);
    }

    // 2. COOKING OIL: Translucent amber 5L commercial canister with handle & cap
    if (product.name === 'COOKING OIL') {
      const oilGroup = new Group();

      // Canister Main Body (amber translucent plastic)
      const jugBody = new Mesh(
        new BoxGeometry(0.24, 0.26, 0.16),
        new MeshStandardMaterial({
          color: 0xf5b041,
          roughness: 0.18,
          metalness: 0.1,
          transparent: true,
          opacity: 0.92,
        }),
      );
      jugBody.position.set(0, 0.12, 0);
      oilGroup.add(jugBody);

      // Molded curved shoulder
      const jugShoulder = new Mesh(
        new SphereGeometry(0.12, 16, 10),
        new MeshStandardMaterial({
          color: 0xf5b041,
          roughness: 0.2,
          transparent: true,
          opacity: 0.9,
        }),
      );
      jugShoulder.scale.set(1.0, 0.45, 0.7);
      jugShoulder.position.set(0, 0.23, 0);
      oilGroup.add(jugShoulder);

      // Ergonomic Hollow Carry Handle
      const handle = new Mesh(
        new TorusGeometry(0.065, 0.016, 8, 16, Math.PI),
        new MeshStandardMaterial({
          color: 0xe67e22,
          roughness: 0.3,
        }),
      );
      handle.rotation.z = -Math.PI;
      handle.position.set(-0.04, 0.28, 0);
      oilGroup.add(handle);

      // Pouring Spout Neck & Red Cap
      const spout = new Mesh(
        new CylinderGeometry(0.038, 0.045, 0.06, 12),
        new MeshStandardMaterial({ color: 0xe67e22 }),
      );
      spout.position.set(0.05, 0.27, 0);
      oilGroup.add(spout);

      const cap = new Mesh(
        new CylinderGeometry(0.048, 0.048, 0.025, 12),
        new MeshStandardMaterial({
          color: 0xd35400,
          roughness: 0.35,
        }),
      );
      cap.position.set(0.05, 0.305, 0);
      oilGroup.add(cap);

      mesh.add(oilGroup);
    }

    // 3. DRINKS: Premium Trio of Aluminum Cans in Acrylic Tray
    if (product.name === 'DRINKS') {
      const drinksGroup = new Group();

      // Smoke acrylic presentation tray
      const tray = new Mesh(
        new BoxGeometry(0.32, 0.018, 0.18),
        new MeshStandardMaterial({
          color: 0x111622,
          roughness: 0.25,
          metalness: 0.6,
        }),
      );
      tray.position.set(0, 0.02, 0);
      drinksGroup.add(tray);

      const canColors = [0x1a5276, 0x1e8449, 0x922b21]; // Cobalt, Emerald, Ruby
      [-0.095, 0, 0.095].forEach((cx, i) => {
        const canBody = new Mesh(
          new CylinderGeometry(0.038, 0.038, 0.16, 16),
          new MeshStandardMaterial({
            color: canColors[i],
            roughness: 0.25,
            metalness: 0.7,
          }),
        );
        canBody.position.set(cx, 0.12, 0);
        drinksGroup.add(canBody);

        // Brushed metallic top lid & pull tab
        const canLid = new Mesh(
          new CylinderGeometry(0.036, 0.036, 0.012, 16),
          new MeshStandardMaterial({
            color: 0xd5dbdb,
            roughness: 0.2,
            metalness: 0.9,
          }),
        );
        canLid.position.set(cx, 0.205, 0);
        drinksGroup.add(canLid);

        const pullTab = new Mesh(
          new BoxGeometry(0.015, 0.004, 0.025),
          new MeshStandardMaterial({
            color: 0xbdc3c7,
            metalness: 0.9,
          }),
        );
        pullTab.position.set(cx, 0.215, 0.008);
        drinksGroup.add(pullTab);
      });

      mesh.add(drinksGroup);
    }

    // Register Entity with IWSDK RayInteractable
    const entity = world.createTransformEntity(mesh);
    entity.addComponent(RayInteractable);
    (product as any).mesh = mesh;
    (product as any).entity = entity;

    // Interaction Debounce & State Handler
    let lastProductSelectTime = 0;
    const PRODUCT_SELECT_DEBOUNCE_MS = 500;
    const handleProductSelect = () => {
      const now = performance.now();
      if (now - lastProductSelectTime < PRODUCT_SELECT_DEBOUNCE_MS) return;
      lastProductSelectTime = now;

      if (import.meta.env.DEV) {
        console.log('[SBD-DIAG] PRODUCT SELECT:', product.name);
      }

      if (product.selected >= product.stock) {
        refresh(`${product.name}: No more available`);
        return;
      }

      product.selected += 1;
      playSelectChime();

      // Tactile spring bounce
      mesh.scale.setScalar(1.08);
      setTimeout(() => mesh.scale.setScalar(1.0), 180);

      refresh(`${product.name} added to order`);

      if (import.meta.env.DEV) {
        console.log(
          `SBD CART: ${product.name}, selected ${product.selected}`,
        );
      }
    };

    mesh.addEventListener('click', handleProductSelect);
    mesh.addEventListener('pointerdown', handleProductSelect);

    // Hover feedback for mouse
    mesh.addEventListener('pointerenter', () => {
      if (product.pedestalRing) {
        const mat = product.pedestalRing.material as MeshStandardMaterial;
        mat.emissiveIntensity = 0.9;
      }
    });
    mesh.addEventListener('pointerleave', () => {
      if (product.pedestalRing) {
        const mat = product.pedestalRing.material as MeshStandardMaterial;
        mat.emissiveIntensity = product.selected > 0 ? 0.85 : 0.35;
      }
    });
  });

  // ==========================================
  // CONFIRM SALE TERMINAL (RIGHT SECTION)
  // ==========================================

  // Interactive Button Mesh (Exact coordinates, rotation, and collider bounds)
  const confirmMaterial = new MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.35,
    metalness: 0.4,
  });

  const confirmMesh = new Mesh(
    new BoxGeometry(0.80, 0.32, 0.14),
    confirmMaterial,
  );

  confirmMesh.position.set(1.10, 1.05, -1.20);
  confirmMesh.rotation.y = -0.32; // ~18.5 degrees inward toward user
  confirmMesh.name = 'SBD-CONFIRM';

  // Grounded console pedestal pillar under the confirm terminal
  const terminalPillar = new Mesh(
    new CylinderGeometry(0.12, 0.16, 0.95, 16),
    new MeshStandardMaterial({
      color: 0x0c1322,
      roughness: 0.5,
      metalness: 0.4,
    }),
  );
  terminalPillar.position.set(0, -0.55, 0);
  confirmMesh.add(terminalPillar);

  const confirmEntity = world.createTransformEntity(confirmMesh);
  confirmEntity.addComponent(RayInteractable);
  confirmEntity.addComponent(PokeInteractable);

  const renderButton = createGlassPanel(
    0,
    0,
    0.072,
    0.72,
    0.24,
    confirmMesh,
  );

  function updateConfirmButtonVisual(isActive = false) {
    const total = orderTotal();
    renderButton({
      title: '✓ CONFIRM SALE',
      titleColor: '#ffffff',
      subtitle: total > 0 ? `${money(total)} • EXECUTE ORDER` : 'TOUCH OR PINCH TO EXECUTE',
      subtitleColor: isActive ? '#ffffff' : '#d1fae5',
      isButton: true,
      buttonActive: isActive,
    });
  }
  updateConfirmButtonVisual(false);

  let lastConfirmTime = 0;
  let isConfirmLocked = false;
  const CONFIRM_DEBOUNCE_MS = 600;

  function confirmSale(trigger = 'event'): boolean {
    const now = performance.now();
    if (now - lastConfirmTime < CONFIRM_DEBOUNCE_MS) {
      if (import.meta.env.DEV) {
        console.log(
          `[SBD] Discarded duplicate confirm (${trigger}) within debounce window (${Math.round(now - lastConfirmTime)}ms)`,
        );
      }
      return false;
    }

    if (isConfirmLocked) {
      return false;
    }

    const total = orderTotal();
    if (total <= 0) {
      refresh('Add products before confirming');
      return false;
    }

    isConfirmLocked = true;
    lastConfirmTime = now;

    try {
      for (const product of products) {
        product.stock -= product.selected;
        product.selected = 0;
      }

      totalRevenue += total;
      completedOrders += 1;

      // Executive Confirmation Sound
      playConfirmationChime();

      // Visual button feedback (emerald flash)
      confirmMaterial.color.setHex(0x00ffaa);
      updateConfirmButtonVisual(true);
      setTimeout(() => {
        confirmMaterial.color.setHex(0x10b981);
        updateConfirmButtonVisual(false);
      }, 450);

      // Dedicated Floating Transaction Success Toast (Accurate Terminology & Zero Occlusion)
      renderSuccessBanner({
        title: '✓ SALE CONFIRMED',
        titleColor: '#10b981',
        subtitle: `${money(total)}   •   Inventory Updated · Sales ${completedOrders}`,
        subtitleColor: '#ffffff',
        accentBorder: '#10b981',
      });
      renderSuccessBanner.mesh.visible = true;
      setTimeout(() => {
        renderSuccessBanner.mesh.visible = false;
      }, 4200);

      refresh(`SALE CONFIRMED: ${money(total)}`);

      if (import.meta.env.DEV) {
        console.log(
          `[SBD] SALE CONFIRMED (${trigger}): ${money(total)} | Revenue: ${money(totalRevenue)} | Completed: ${completedOrders}`,
        );
        console.log(
          'SBD STOCK:',
          products.map((p) => ({
            name: p.name,
            remaining: p.stock,
          })),
        );
      }

      return true;
    } finally {
      setTimeout(() => {
        isConfirmLocked = false;
      }, CONFIRM_DEBOUNCE_MS);
    }
  }

  confirmMesh.addEventListener('click', () => confirmSale('click'));
  confirmMesh.addEventListener('pointerdown', () => confirmSale('pointerdown'));

  confirmMesh.addEventListener('pointerenter', () => {
    confirmMaterial.color.setHex(0x34d399);
    updateConfirmButtonVisual(true);
  });
  confirmMesh.addEventListener('pointerleave', () => {
    confirmMaterial.color.setHex(0x10b981);
    updateConfirmButtonVisual(false);
  });

  // Direct internal module connection to ECS Pressed handler
  internalConfirmSale = () => confirmSale('ecs-pressed');

  // Hover feedback handler connected to XR interaction system
  activeHoverCallback = (name: string, isHovered: boolean) => {
    if (name === 'SBD-CONFIRM') {
      confirmMaterial.color.setHex(isHovered ? 0x34d399 : 0x10b981);
      updateConfirmButtonVisual(isHovered);
    } else {
      const match = products.find((p) => 'SBD-PRODUCT:' + p.name === name);
      if (match && match.pedestalRing) {
        const mat = match.pedestalRing.material as MeshStandardMaterial;
        mat.emissiveIntensity = isHovered ? 0.95 : match.selected > 0 ? 0.85 : 0.35;
      }
    }
  };

  refresh();

  if (import.meta.env.DEV) {
    const container = document.getElementById('scene-container');
    if (container) {
      (container as any).__sbd_dev_meshes = {
        confirmMesh,
        products,
      };
    }
    console.log('SBD: Sales workflow initialized (release candidate)');
  }
}

// META-VR-13J / META-VR-20C / META-VR-21C: Hands-first XR interaction system
export class InventoryInteractionSystem extends createSystem({
  rayHovered: { required: [RayInteractable, Hovered] },
  rayPressed: { required: [RayInteractable, Pressed] },
  pokeHovered: { required: [PokeInteractable, Hovered] },
  pokePressed: { required: [PokeInteractable, Pressed] },
}) {
  init(): void {
    const handlePress = (entity: any, kind: string) => {
      const name = entity.object3D?.name ?? '';
      if (name === 'SBD-CONFIRM') {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        internalConfirmSale?.();
      }
    };

    this.queries.rayHovered.subscribe('qualify', (entity) => {
      const name = entity.object3D?.name ?? '';
      if (name.startsWith('SBD-')) {
        if (import.meta.env.DEV) {
          console.log('[SBD-DIAG] RAY HOVER:', name);
        }
        activeHoverCallback?.(name, true);
      }
    });

    this.queries.rayHovered.subscribe('disqualify', (entity) => {
      const name = entity.object3D?.name ?? '';
      if (name.startsWith('SBD-')) {
        activeHoverCallback?.(name, false);
      }
    });

    this.queries.pokeHovered.subscribe('qualify', (entity) => {
      const name = entity.object3D?.name ?? '';
      if (name.startsWith('SBD-')) {
        if (import.meta.env.DEV) {
          console.log('[SBD-DIAG] POKE HOVER:', name);
        }
        activeHoverCallback?.(name, true);
      }
    });

    this.queries.pokeHovered.subscribe('disqualify', (entity) => {
      const name = entity.object3D?.name ?? '';
      if (name.startsWith('SBD-')) {
        activeHoverCallback?.(name, false);
      }
    });

    this.queries.rayPressed.subscribe('qualify', (entity) => {
      handlePress(entity, 'RAY');
    });

    this.queries.pokePressed.subscribe('qualify', (entity) => {
      handlePress(entity, 'POKE');
    });
  }
}

export { InventoryInteractionSystem as InventoryTargetDiagnosticSystem };
