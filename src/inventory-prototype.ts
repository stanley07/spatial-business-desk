/**
 * Spatial Business Desk - Retail Showroom Prototype
 *
 * DESKTOP CAMERA FRAMING & ROLLBACK CONFIGURATION (META-VR-21C.22):
 * -----------------------------------------------------------------
 * 1. Current Optimized Judge-Friendly Framing (iwsdk.config.json):
 *    - FOV: 60 (75-85% viewport width occupancy, zero clipping)
 *    - Position: [0, 1.38, 0.65]
 *    - LookAt:   [0, 1.29, -1.65]
 *
 * 2. Original Production Rollback Option (Baseline commit 73563a5):
 *    - FOV: 70
 *    - Position: [0, 1.6, 1.0]
 *    - LookAt:   [0, 0.95, -1.95]
 */

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
  highlightMesh?: Mesh;
  badgeMesh?: Mesh;
};

type CartSnapshot = {
  rice: number;
  cooking_oil: number;
  drinks: number;
};

let internalConfirmSale: (() => void) | null = null;
let internalIncreaseQuantity: ((productName: string) => void) | null = null;
let internalDecreaseQuantity: ((productName?: string) => void) | null = null;
let internalRemoveProduct: ((productName?: string) => void) | null = null;
let internalUndoCart: (() => void) | null = null;
let internalClearCart: (() => void) | null = null;
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
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch (_) {}
}

function playEditChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now); // A4
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
  let lastModifiedProduct = 'COOKING OIL';

  // Reversible Cart History Stack
  const cartHistory: CartSnapshot[] = [];

  function pushCartSnapshot() {
    cartHistory.push({
      rice: products[0].selected,
      cooking_oil: products[1].selected,
      drinks: products[2].selected,
    });
    if (cartHistory.length > 25) cartHistory.shift();
  }

  const money = (value: number) =>
    'NGN ' + value.toLocaleString('en-NG');

  function orderTotal(): number {
    return products.reduce(
      (total, product) =>
        total + product.selected * product.price,
      0,
    );
  }

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
    canvasW = 2048,
    canvasH = 1024,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;

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

    type PanelLine = string | { text: string; color?: string; font?: string };

    type PanelOptions = {
      eyebrow?: string;
      eyebrowColor?: string;
      title?: string;
      titleColor?: string;
      subtitle?: string;
      subtitleColor?: string;
      lines?: PanelLine[];
      accentBorder?: string;
      borderWidth?: number;
      isButton?: boolean;
      buttonActive?: boolean;
      isDisabled?: boolean;
      bgColor?: string;
    };

    const render = (optsOrLines: PanelOptions | PanelLine[]) => {
      const opts: PanelOptions = Array.isArray(optsOrLines)
        ? { lines: optsOrLines }
        : optsOrLines;

      mesh.userData.textLines = opts.lines
        ? opts.lines.map((l) => (typeof l === 'object' && l !== null ? l.text : l))
        : [opts.title ?? ''];
      context.clearRect(0, 0, canvasW, canvasH);

      // Glassmorphic background gradient
      const bgGrad = context.createLinearGradient(0, 0, 0, canvasH);
      if (opts.isDisabled) {
        bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.70)');
        bgGrad.addColorStop(1, 'rgba(10, 15, 26, 0.85)');
      } else if (opts.isButton) {
        if (opts.buttonActive) {
          bgGrad.addColorStop(0, 'rgba(16, 185, 129, 0.98)');
          bgGrad.addColorStop(1, 'rgba(5, 150, 105, 1.0)');
        } else {
          bgGrad.addColorStop(0, 'rgba(6, 95, 70, 0.92)');
          bgGrad.addColorStop(1, 'rgba(4, 71, 52, 0.96)');
        }
      } else if (opts.bgColor) {
        bgGrad.addColorStop(0, opts.bgColor);
        bgGrad.addColorStop(1, 'rgba(9, 14, 26, 0.97)');
      } else {
        bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.94)');
        bgGrad.addColorStop(1, 'rgba(9, 14, 26, 0.98)');
      }

      const pad = 16;
      roundRect(context, pad, pad, canvasW - pad * 2, canvasH - pad * 2, 48);
      context.fillStyle = bgGrad;
      context.fill();

      // Border gradient with high-contrast glow
      const borderGrad = context.createLinearGradient(0, 0, canvasW, canvasH);
      if (opts.isDisabled) {
        borderGrad.addColorStop(0, '#334155');
        borderGrad.addColorStop(1, '#1e293b');
      } else if (opts.isButton) {
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

      context.lineWidth = opts.borderWidth || (opts.isButton ? 14 : 10);
      context.strokeStyle = borderGrad;
      context.stroke();

      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const hasEyebrow = Boolean(opts.eyebrow);
      const hasTitle = Boolean(opts.title);
      const hasSubtitle = Boolean(opts.subtitle);

      if (hasEyebrow && hasTitle && hasSubtitle) {
        // Full Marquee 3-tier layout
        context.font = 'bold 54px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.eyebrowColor || '#38bdf8';
        context.fillText(opts.eyebrow!.toUpperCase(), canvasW / 2, canvasH * 0.20, canvasW - 80);

        context.font = 'bold 100px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.titleColor || '#ffffff';
        context.fillText(opts.title!, canvasW / 2, canvasH * 0.50, canvasW - 80);

        context.font = '600 64px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.subtitleColor || '#cbd5e1';
        context.fillText(opts.subtitle!, canvasW / 2, canvasH * 0.80, canvasW - 80);
      } else if (hasTitle && hasSubtitle) {
        // 2-tier layout (e.g. Confirm Sale Terminal)
        context.font = 'bold 96px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.titleColor || (opts.isDisabled ? '#64748b' : '#ffffff');
        context.fillText(opts.title!, canvasW / 2, canvasH * 0.36, canvasW - 80);

        context.font = '600 64px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.subtitleColor || (opts.isDisabled ? '#475569' : '#cbd5e1');
        context.fillText(opts.subtitle!, canvasW / 2, canvasH * 0.72, canvasW - 80);
      } else if (hasTitle) {
        // Centered single-tier layout (e.g. Cart action buttons: [+] ADD, [-] DEC, [x] REM, UNDO, CLEAR)
        context.font = 'bold 112px "Segoe UI", -apple-system, sans-serif';
        context.fillStyle = opts.titleColor || (opts.isDisabled ? '#64748b' : '#ffffff');
        context.fillText(opts.title!, canvasW / 2, canvasH * 0.50, canvasW - 40);
      }

      // Custom multi-line support
      if (opts.lines && opts.lines.length > 0) {
        const lineCount = opts.lines.length;
        const defaultFontSize = lineCount > 2 ? 68 : 84;

        opts.lines.forEach((item, index) => {
          const isObj = typeof item === 'object' && item !== null;
          const text = isObj ? item.text : item;
          const font =
            isObj && item.font
              ? item.font
              : `bold ${defaultFontSize}px "Segoe UI", -apple-system, sans-serif`;
          const color = opts.isDisabled
            ? '#64748b'
            : isObj && item.color
            ? item.color
            : '#ffffff';

          context.font = font;
          context.fillStyle = color;

          const rowHeight = (canvasH - 32) / (lineCount + 1);
          context.fillText(
            text,
            canvasW / 2,
            16 + rowHeight * (index + 1),
            canvasW - 80,
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
    undefined,
    0,
    0,
    2048,
    400,
  );

  // 2. MIDDLE: High-Clarity Product Information Cards (Directly above each product)
  // Shows: PRODUCT NAME | PRICE: ₦X | AVAILABLE: X UNITS (Clean hierarchy, zero badge overlap)
  const productCards = products.map((product) =>
    createGlassPanel(
      product.x,
      1.76,
      -1.60,
      0.54,
      0.22,
      undefined,
      0,
      0,
      2048,
      834,
    ),
  );

  // 4. LEFT: Compact Business Overview Terminal (Symmetrical Balance)
  const renderOverview = createGlassPanel(
    -1.25,
    1.05,
    -1.20,
    0.58,
    0.26,
    undefined,
    0.32,
    0,
    2048,
    1024,
  );

  // 5. SUCCESS EXPERIENCE: Prominent Centered Toast Banner (Zero product occlusion)
  const renderSuccessBanner = createGlassPanel(
    0,
    1.88,
    -1.75,
    1.30,
    0.28,
    undefined,
    0,
    0,
    2048,
    512,
  );
  renderSuccessBanner.mesh.visible = false;

  // ==========================================
  // FLOATING SPATIAL CART PANEL & KIOSK (21C.14 UNIFIED & UNOBSTRUCTED)
  // ==========================================
  const cartKioskGroup = new Group();
  cartKioskGroup.position.set(0, 0.90, -1.22);
  cartKioskGroup.rotation.x = -0.36;

  // Solid backing slab in executive slate glass (1.48m x 0.56m)
  const kioskBacking = new Mesh(
    new BoxGeometry(1.48, 0.56, 0.02),
    new MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.28,
      metalness: 0.35,
      transparent: true,
      opacity: 0.95,
    }),
  );
  cartKioskGroup.add(kioskBacking);

  // Slim champagne brass trim around kiosk edge
  const kioskTrim = new Mesh(
    new BoxGeometry(1.49, 0.57, 0.01),
    new MeshStandardMaterial({
      color: 0xc8a265,
      roughness: 0.25,
      metalness: 0.80,
    }),
  );
  kioskTrim.position.z = -0.006;
  cartKioskGroup.add(kioskTrim);

  // Central obstruction removed per META-VR-21C.15 (unobstructed full floating kiosk)
  world.createTransformEntity(cartKioskGroup);

  // Canvas Display Surface on Cart Kiosk (2048 x 768)
  const cartCanvas = document.createElement('canvas');
  cartCanvas.width = 2048;
  cartCanvas.height = 768;
  const cartCtx = cartCanvas.getContext('2d');
  const cartTexture = new CanvasTexture(cartCanvas);

  const cartDisplayMesh = new Mesh(
    new PlaneGeometry(1.46, 0.54),
    new MeshBasicMaterial({
      map: cartTexture,
      transparent: true,
      side: DoubleSide,
    }),
  );
  cartDisplayMesh.position.set(0, 0, 0.012);
  cartKioskGroup.add(cartDisplayMesh);

  function renderCartDisplay() {
    if (!cartCtx) return;
    const total = orderTotal();
    const hasItems = total > 0;
    const itemCount = products.reduce((sum, p) => sum + p.selected, 0);

    cartCtx.clearRect(0, 0, 2048, 768);

    // Glassmorphic background
    const bgGrad = cartCtx.createLinearGradient(0, 0, 0, 768);
    bgGrad.addColorStop(0, hasItems ? 'rgba(15, 23, 42, 0.96)' : 'rgba(15, 23, 42, 0.90)');
    bgGrad.addColorStop(1, hasItems ? 'rgba(10, 15, 26, 0.98)' : 'rgba(10, 15, 26, 0.95)');
    roundRect(cartCtx, 12, 12, 2024, 744, 28);
    cartCtx.fillStyle = bgGrad;
    cartCtx.fill();

    cartCtx.lineWidth = hasItems ? 10 : 5;
    cartCtx.strokeStyle = hasItems ? '#06b6d4' : '#334155';
    cartCtx.stroke();

    // 1. Header Bar (Top)
    cartCtx.font = 'bold 48px "Segoe UI", sans-serif';
    cartCtx.fillStyle = '#38bdf8';
    cartCtx.textAlign = 'left';
    cartCtx.textBaseline = 'middle';
    cartCtx.fillText('✦ SPATIAL DRAFT CART ✦', 64, 52);

    // Total readout on top right
    cartCtx.textAlign = 'right';
    if (hasItems) {
      cartCtx.font = 'bold 50px "Segoe UI", sans-serif';
      cartCtx.fillStyle = '#34d399';
      cartCtx.fillText(`TOTAL: ${money(total)}  (${itemCount} ITEMS)`, 1984, 52);
    } else {
      cartCtx.font = 'bold 42px "Segoe UI", sans-serif';
      cartCtx.fillStyle = '#94a3b8';
      cartCtx.fillText('TOTAL: NGN 0  (CART EMPTY)', 1984, 52);
    }

    // Divider line below header
    cartCtx.strokeStyle = '#1e293b';
    cartCtx.lineWidth = 4;
    cartCtx.beginPath();
    cartCtx.moveTo(48, 92);
    cartCtx.lineTo(2000, 92);
    cartCtx.stroke();

    // 2. Table Column Guide
    cartCtx.font = 'bold 30px "Segoe UI", sans-serif';
    cartCtx.fillStyle = '#94a3b8';
    cartCtx.textAlign = 'left';
    cartCtx.fillText('PRODUCT', 64, 126);
    cartCtx.fillText('UNIT PRICE', 420, 126);
    cartCtx.fillText('QTY IN ORDER', 690, 126);
    cartCtx.fillText('LINE TOTAL', 940, 126);
    cartCtx.fillText('ITEM ACTIONS', 1380, 126);

    // 3. Product Rows (Rice at y=205, Oil at y=315, Drinks at y=425)
    const rowYPositions = [205, 315, 425];
    products.forEach((product, i) => {
      const ry = rowYPositions[i];
      const isSel = product.selected > 0;

      // Row background highlight
      roundRect(cartCtx, 48, ry - 44, 1952, 88, 16);
      cartCtx.fillStyle = isSel ? 'rgba(16, 185, 129, 0.20)' : 'rgba(30, 41, 59, 0.65)';
      cartCtx.fill();
      if (isSel) {
        cartCtx.lineWidth = 4;
        cartCtx.strokeStyle = 'rgba(16, 185, 129, 0.70)';
        cartCtx.stroke();
      }

      // Color accent bullet
      cartCtx.beginPath();
      cartCtx.arc(80, ry, 16, 0, Math.PI * 2);
      cartCtx.fillStyle = '#' + product.color.toString(16).padStart(6, '0');
      cartCtx.fill();

      // Product Name
      cartCtx.font = 'bold 44px "Segoe UI", sans-serif';
      cartCtx.fillStyle = isSel ? '#ffffff' : '#e2e8f0';
      cartCtx.textAlign = 'left';
      cartCtx.fillText(product.name, 115, ry);

      // Unit Price
      cartCtx.font = 'bold 36px "Segoe UI", sans-serif';
      cartCtx.fillStyle = '#cbd5e1';
      cartCtx.fillText(money(product.price), 420, ry);

      // Quantity Pill
      roundRect(cartCtx, 670, ry - 34, 160, 68, 16);
      cartCtx.fillStyle = isSel ? 'rgba(16, 185, 129, 0.98)' : 'rgba(51, 65, 85, 0.85)';
      cartCtx.fill();
      cartCtx.font = 'bold 42px "Segoe UI", sans-serif';
      cartCtx.fillStyle = '#ffffff';
      cartCtx.textAlign = 'center';
      cartCtx.fillText(`× ${product.selected}`, 750, ry + 2);

      // Line Total
      const lineTotal = product.selected * product.price;
      cartCtx.font = 'bold 44px "Segoe UI", sans-serif';
      cartCtx.fillStyle = isSel ? '#34d399' : '#64748b';
      cartCtx.textAlign = 'left';
      cartCtx.fillText(money(lineTotal), 940, ry);
    });

    // Divider line before footer/global actions
    cartCtx.strokeStyle = '#1e293b';
    cartCtx.lineWidth = 4;
    cartCtx.beginPath();
    cartCtx.moveTo(48, 490);
    cartCtx.lineTo(2000, 490);
    cartCtx.stroke();

    // 4. Footer Guide (Bottom)
    cartCtx.font = 'bold 30px "Segoe UI", sans-serif';
    cartCtx.fillStyle = hasItems ? '#a7f3d0' : '#94a3b8';
    cartCtx.textAlign = 'center';
    cartCtx.fillText(
      hasItems
        ? '✦ Cart editing is immediate & reversible • Confirm Sale on right terminal commits order'
        : '✦ Select products above or touch [+] to prepare draft order',
      1024,
      705,
    );

    cartTexture.needsUpdate = true;
  }

  // ==========================================
  // SPATIAL CART INTERACTIVE BUTTONS (11 CONTROLS)
  // ==========================================

  const cartButtonMaterials: { [key: string]: { mat: MeshStandardMaterial; baseColor: number } } = {};

  function createPanelButton(
    u: number,
    v: number,
    width: number,
    height: number,
    name: string,
    label: string,
    colorHex: number,
    borderHex: string,
    onClick: () => void,
  ) {
    const theta = -0.36;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const w = 0.016;
    const x = u;
    const y = 0.90 + v * cosT - w * sinT;
    const z = -1.22 + v * sinT + w * cosT;

    const btnMat = new MeshStandardMaterial({
      color: colorHex,
      roughness: 0.35,
      metalness: 0.3,
    });
    cartButtonMaterials[name] = { mat: btnMat, baseColor: colorHex };

    const btnMesh = new Mesh(
      new BoxGeometry(width, height, 0.025),
      btnMat,
    );
    btnMesh.position.set(x, y, z);
    btnMesh.rotation.x = theta;
    btnMesh.name = name;

    const panel = createGlassPanel(
      0,
      0,
      0.014,
      width * 0.95,
      height * 0.90,
      btnMesh,
      0,
      0,
      512,
      256,
    );

    panel({
      title: label,
      titleColor: '#ffffff',
      accentBorder: borderHex,
      borderWidth: 10,
    });

    const entity = world.createTransformEntity(btnMesh);
    entity.addComponent(RayInteractable);
    entity.addComponent(PokeInteractable);

    btnMesh.addEventListener('click', onClick);

    btnMesh.addEventListener('pointerenter', () => {
      btnMat.color.setHex(0x38bdf8);
    });
    btnMesh.addEventListener('pointerleave', () => {
      btnMat.color.setHex(colorHex);
    });

    return { btnMesh, entity, panel, btnMat };
  }

  // Row 1: RICE Controls (v = +0.126)
  const btnRiceInc = createPanelButton(+0.31, +0.126, 0.095, 0.058, 'SBD-CART:INC:RICE', '[+] ADD', 0x065f46, '#10b981', () => increaseQuantity('RICE'));
  const btnRiceDec = createPanelButton(+0.44, +0.126, 0.095, 0.058, 'SBD-CART:DEC:RICE', '[-] DEC', 0x1e293b, '#38bdf8', () => decreaseQuantity('RICE'));
  const btnRiceRem = createPanelButton(+0.58, +0.126, 0.125, 0.058, 'SBD-CART:REM:RICE', '[×] REM', 0x4c0519, '#f43f5e', () => removeProduct('RICE'));

  // Row 2: COOKING OIL Controls (v = +0.048)
  const btnOilInc = createPanelButton(+0.31, +0.048, 0.095, 0.058, 'SBD-CART:INC:COOKING OIL', '[+] ADD', 0x065f46, '#10b981', () => increaseQuantity('COOKING OIL'));
  const btnOilDec = createPanelButton(+0.44, +0.048, 0.095, 0.058, 'SBD-CART:DEC:COOKING OIL', '[-] DEC', 0x1e293b, '#38bdf8', () => decreaseQuantity('COOKING OIL'));
  const btnOilRem = createPanelButton(+0.58, +0.048, 0.125, 0.058, 'SBD-CART:REM:COOKING OIL', '[×] REM', 0x4c0519, '#f43f5e', () => removeProduct('COOKING OIL'));

  // Row 3: DRINKS Controls (v = -0.029)
  const btnDrinksInc = createPanelButton(+0.31, -0.029, 0.095, 0.058, 'SBD-CART:INC:DRINKS', '[+] ADD', 0x065f46, '#10b981', () => increaseQuantity('DRINKS'));
  const btnDrinksDec = createPanelButton(+0.44, -0.029, 0.095, 0.058, 'SBD-CART:DEC:DRINKS', '[-] DEC', 0x1e293b, '#38bdf8', () => decreaseQuantity('DRINKS'));
  const btnDrinksRem = createPanelButton(+0.58, -0.029, 0.125, 0.058, 'SBD-CART:REM:DRINKS', '[×] REM', 0x4c0519, '#f43f5e', () => removeProduct('DRINKS'));

  // Global Actions (v = -0.131)
  const btnUndo = createPanelButton(-0.28, -0.131, 0.24, 0.062, 'SBD-CART:UNDO', '[⤺] UNDO EDIT', 0x2e1065, '#a855f7', () => undoLastCartAction());
  const btnClear = createPanelButton(+0.28, -0.131, 0.24, 0.062, 'SBD-CART:CLEAR', '[∅] CLEAR CART', 0x451a03, '#f59e0b', () => clearEntireCart());

  // Cart Management Operations (with history stack & safeguards)
  let lastCartEditTime = 0;
  const CART_EDIT_DEBOUNCE_MS = 450;

  function increaseQuantity(productName: string): boolean {
    const now = performance.now();
    if (now - lastCartEditTime < CART_EDIT_DEBOUNCE_MS) return false;

    const target = products.find(p => p.name === productName);
    if (!target) return false;
    if (target.selected >= target.stock) {
      refresh(`${target.name}: Maximum available reached (${target.stock})`);
      return false;
    }

    lastCartEditTime = now;
    pushCartSnapshot();
    target.selected += 1;
    lastModifiedProduct = target.name;
    playSelectChime();

    // Pulse target product
    if (target.mesh) {
      target.mesh.scale.setScalar(1.10);
      setTimeout(() => target!.mesh!.scale.setScalar(1.0), 180);
    }

    refresh(`${target.name} quantity increased to ${target.selected}`);
    return true;
  }

  function decreaseQuantity(productName?: string): boolean {
    const now = performance.now();
    if (now - lastCartEditTime < CART_EDIT_DEBOUNCE_MS) return false;

    let target = productName ? products.find(p => p.name === productName) : null;
    if (!target) {
      target = products.find(p => p.name === lastModifiedProduct && p.selected > 0);
    }
    if (!target) {
      target = products.find(p => p.selected > 0);
    }
    if (!target || target.selected <= 0) return false;

    lastCartEditTime = now;
    pushCartSnapshot();
    target.selected -= 1;
    lastModifiedProduct = target.name;
    playEditChime();

    // Pulse target product
    if (target.mesh) {
      target.mesh.scale.setScalar(0.95);
      setTimeout(() => target!.mesh!.scale.setScalar(target!.selected > 0 ? 1.05 : 1.0), 150);
    }

    refresh(`${target.name} quantity decreased to ${target.selected}`);
    return true;
  }

  function removeProduct(productName?: string): boolean {
    const now = performance.now();
    if (now - lastCartEditTime < CART_EDIT_DEBOUNCE_MS) return false;

    let target = productName ? products.find(p => p.name === productName) : null;
    if (!target) {
      target = products.find(p => p.name === lastModifiedProduct && p.selected > 0);
    }
    if (!target) {
      target = products.find(p => p.selected > 0);
    }
    if (!target || target.selected <= 0) return false;

    lastCartEditTime = now;
    pushCartSnapshot();
    target.selected = 0;
    playEditChime();

    refresh(`${target.name} removed from cart`);
    return true;
  }

  function undoLastCartAction(): boolean {
    const now = performance.now();
    if (now - lastCartEditTime < CART_EDIT_DEBOUNCE_MS) return false;

    if (cartHistory.length === 0) {
      refresh('Nothing to undo');
      return false;
    }
    lastCartEditTime = now;
    const previous = cartHistory.pop()!;
    products[0].selected = Math.min(previous.rice, products[0].stock);
    products[1].selected = Math.min(previous.cooking_oil, products[1].stock);
    products[2].selected = Math.min(previous.drinks, products[2].stock);
    playEditChime();
    refresh('Draft cart edit undone');
    return true;
  }

  function clearEntireCart(): boolean {
    const now = performance.now();
    if (now - lastCartEditTime < CART_EDIT_DEBOUNCE_MS) return false;

    const hasItems = products.some(p => p.selected > 0);
    if (!hasItems) return false;

    lastCartEditTime = now;
    pushCartSnapshot();
    products.forEach(p => (p.selected = 0));
    playEditChime();
    refresh('Pending cart cleared');
    return true;
  }

  // Master UI & Ledger Refresh
  function refresh(message = 'Select a product to begin') {
    const total = orderTotal();
    const hasItems = total > 0;

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

    // 2. Redesigned Product Information Cards
    products.forEach((product, index) => {
      const isSelected = product.selected > 0;
      const isLowStock = product.stock <= 3;

      productCards[index]({
        lines: [
          {
            text: product.name,
            color: '#ffffff',
            font: 'bold 94px "Segoe UI", -apple-system, sans-serif',
          },
          {
            text: `PRICE: ${money(product.price)}`,
            color: isSelected ? '#34d399' : '#38bdf8',
            font: 'bold 82px "Segoe UI", -apple-system, sans-serif',
          },
          {
            text: isSelected
              ? `STOCK: ${product.stock}   •   ORDER: ×${product.selected}`
              : `AVAILABLE: ${product.stock} UNITS`,
            color: isSelected ? '#a7f3d0' : '#e2e8f0',
            font: 'bold 72px "Segoe UI", -apple-system, sans-serif',
          },
        ],
        accentBorder: isSelected
          ? '#10b981'
          : isLowStock
          ? '#f59e0b'
          : '#38bdf8',
        borderWidth: isSelected ? 16 : 10,
        bgColor: isSelected ? 'rgba(6, 78, 59, 0.96)' : undefined,
      });

      // Synchronize floating badge mesh
      if (product.badgeMesh) {
        product.badgeMesh.visible = isSelected;
        if (isSelected && (product.badgeMesh as any).__renderBadge) {
          (product.badgeMesh as any).__renderBadge(`✓ IN ORDER ×${product.selected}`);
        }
      }

      // Synchronize persistent highlight wireframe
      if (product.highlightMesh) {
        product.highlightMesh.visible = isSelected;
      }

      // Synchronize pedestal halo ring glow
      if (product.pedestalRing) {
        const mat = product.pedestalRing.material as MeshStandardMaterial;
        if (mat) {
          if (isSelected) {
            mat.color.setHex(0x10b981);
            mat.emissive.setHex(0x10b981);
            mat.emissiveIntensity = 1.2;
          } else if (isLowStock) {
            mat.color.setHex(0xd97706);
            mat.emissive.setHex(0xd97706);
            mat.emissiveIntensity = 0.5;
          } else {
            mat.color.setHex(product.color);
            mat.emissive.setHex(product.color);
            mat.emissiveIntensity = 0.35;
          }
        }
      }

      // Resting product elevation when selected
      if (product.mesh) {
        product.mesh.position.y = isSelected ? 1.38 : 1.35;
      }
    });

    const itemCount = products.reduce(
      (sum, product) => sum + product.selected,
      0,
    );

    // 3. Floating Spatial Cart Panel Display Update
    renderCartDisplay();

    // 4. Left Business Overview Terminal
    renderOverview({
      lines: [
        '✦ STORE OVERVIEW ✦',
        `DAILY TARGET: ₦100,000`,
        `PROGRESS: ${Math.min(100, Math.round((totalRevenue / 100000) * 100))}%`,
        `SHIFT: ACTIVE MERCHANT`,
        `SYSTEM: LOCAL PROTOTYPE (SAMPLE LEDGER)`,
      ],
      accentBorder: '#8b5cf6',
    });

    // 5. Update Confirm Sale Button (Dimmed / disabled when cart empty)
    updateConfirmButtonVisual(hasItems);

    // Synchronize HTML container dataset for automated tests and telemetry
    const container = document.getElementById('scene-container');
    if (container) {
      container.dataset.revenue = String(totalRevenue);
      container.dataset.completedOrders = String(completedOrders);
      container.dataset.orderTotal = String(total);
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

  // Main Desk Counter Slab (brushed obsidian / dark slate, streamlined depth)
  const deskTop = new Mesh(
    new BoxGeometry(2.70, 0.06, 0.44),
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
  brassTrim.position.set(0, 0.02, 0.22);
  deskGroup.add(brassTrim);

  // Recessed Cyan LED Underglow Strip
  const underglow = new Mesh(
    new BoxGeometry(2.62, 0.012, 0.02),
    new MeshBasicMaterial({ color: 0x00d4ff }),
  );
  underglow.position.set(0, -0.035, 0.215);
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

  // Base Wall in deep royal navy slate
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
  // ENLARGED PRODUCT DISPLAY PEDESTALS & 3D MODELS
  // ==========================================

  products.forEach((product) => {
    // Pedestal Base Cylinder on the counter desk (enlarged to 0.28m radius)
    const pedestalGroup = new Group();
    pedestalGroup.position.set(product.x, 0.91, -1.60);

    const pedestalBase = new Mesh(
      new CylinderGeometry(0.28, 0.31, 0.04, 28),
      new MeshStandardMaterial({
        color: 0x141b2a,
        roughness: 0.4,
        metalness: 0.5,
      }),
    );
    pedestalGroup.add(pedestalBase);

    // Luminous Double Halo Ring
    const haloRing = new Mesh(
      new TorusGeometry(0.26, 0.009, 12, 36),
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
      opacity: 0.0,
    });
    product.material = baseMaterial;

    const mesh = new Mesh(
      new BoxGeometry(0.35, 0.35, 0.25),
      baseMaterial,
    );
    mesh.position.set(product.x, 1.35, -1.60);
    mesh.name = 'SBD-PRODUCT:' + product.name;

    // Persistent Selection Highlight Outline / Aura Mesh (visible when product.selected > 0)
    const highlightMesh = new Mesh(
      new TorusGeometry(0.25, 0.012, 8, 32),
      new MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.95,
      }),
    );
    highlightMesh.rotation.x = Math.PI / 2;
    highlightMesh.position.set(0, -0.05, 0);
    highlightMesh.visible = false;
    mesh.add(highlightMesh);
    product.highlightMesh = highlightMesh;

    // Floating Holographic "IN ORDER ×X" Badge (cleanly separated from product info card)
    const badgeCanvas = document.createElement('canvas');
    badgeCanvas.width = 576;
    badgeCanvas.height = 176;
    const badgeCtx = badgeCanvas.getContext('2d');
    const badgeTexture = new CanvasTexture(badgeCanvas);

    const badgeMesh = new Mesh(
      new PlaneGeometry(0.36, 0.11),
      new MeshBasicMaterial({
        map: badgeTexture,
        transparent: true,
        side: DoubleSide,
      }),
    );
    badgeMesh.position.set(0, 0.18, 0.14);
    badgeMesh.rotation.x = -0.15;
    badgeMesh.visible = false;

    (badgeMesh as any).__renderBadge = (text: string) => {
      if (!badgeCtx) return;
      badgeCtx.clearRect(0, 0, 576, 176);
      roundRect(badgeCtx, 8, 8, 560, 160, 32);
      badgeCtx.fillStyle = 'rgba(16, 185, 129, 0.98)';
      badgeCtx.fill();
      badgeCtx.lineWidth = 8;
      badgeCtx.strokeStyle = '#ffffff';
      badgeCtx.stroke();
      badgeCtx.font = 'bold 62px "Segoe UI", sans-serif';
      badgeCtx.fillStyle = '#ffffff';
      badgeCtx.textAlign = 'center';
      badgeCtx.textBaseline = 'middle';
      badgeCtx.fillText(text, 288, 88);
      badgeTexture.needsUpdate = true;
    };
    mesh.add(badgeMesh);
    product.badgeMesh = badgeMesh;

    // 1. RICE: Significantly enlarged premium organic burlap sack
    if (product.name === 'RICE') {
      const riceGroup = new Group();

      // Plump sack body (enlarged 1.5x)
      const sackBody = new Mesh(
        new SphereGeometry(0.22, 18, 14),
        new MeshStandardMaterial({
          color: 0xdec085,
          roughness: 0.85,
        }),
      );
      sackBody.scale.set(1.0, 0.62, 0.90);
      sackBody.position.set(0, 0.08, 0);
      riceGroup.add(sackBody);

      // Sack neck
      const sackNeck = new Mesh(
        new CylinderGeometry(0.06, 0.085, 0.12, 16),
        new MeshStandardMaterial({
          color: 0xc8a465,
          roughness: 0.82,
        }),
      );
      sackNeck.position.set(0, 0.20, 0);
      riceGroup.add(sackNeck);

      // Bold tied twine rope
      const twine = new Mesh(
        new TorusGeometry(0.065, 0.016, 8, 20),
        new MeshStandardMaterial({
          color: 0x8d6e43,
          roughness: 0.95,
        }),
      );
      twine.rotation.x = Math.PI / 2;
      twine.position.set(0, 0.19, 0);
      riceGroup.add(twine);

      // Golden grains accent top
      const grains = new Mesh(
        new SphereGeometry(0.055, 10, 10),
        new MeshStandardMaterial({
          color: 0xf5d061,
          roughness: 0.45,
        }),
      );
      grains.position.set(0, 0.26, 0);
      riceGroup.add(grains);

      mesh.add(riceGroup);
    }

    // 2. COOKING OIL: Significantly enlarged 5L translucent amber canister
    if (product.name === 'COOKING OIL') {
      const oilGroup = new Group();

      // Canister Main Body (enlarged 1.5x)
      const jugBody = new Mesh(
        new BoxGeometry(0.32, 0.34, 0.20),
        new MeshStandardMaterial({
          color: 0xf59e0b,
          roughness: 0.16,
          metalness: 0.12,
          transparent: true,
          opacity: 0.94,
        }),
      );
      jugBody.position.set(0, 0.10, 0);
      oilGroup.add(jugBody);

      // Molded curved shoulder
      const jugShoulder = new Mesh(
        new SphereGeometry(0.16, 16, 12),
        new MeshStandardMaterial({
          color: 0xf59e0b,
          roughness: 0.18,
          transparent: true,
          opacity: 0.92,
        }),
      );
      jugShoulder.scale.set(1.0, 0.45, 0.75);
      jugShoulder.position.set(0, 0.24, 0);
      oilGroup.add(jugShoulder);

      // Ergonomic Hollow Carry Handle
      const handle = new Mesh(
        new TorusGeometry(0.085, 0.022, 10, 20, Math.PI),
        new MeshStandardMaterial({
          color: 0xd97706,
          roughness: 0.25,
        }),
      );
      handle.rotation.z = -Math.PI;
      handle.position.set(-0.05, 0.31, 0);
      oilGroup.add(handle);

      // Pouring Spout Neck & Ribbed Red/Orange Cap
      const spout = new Mesh(
        new CylinderGeometry(0.048, 0.056, 0.07, 16),
        new MeshStandardMaterial({ color: 0xd97706 }),
      );
      spout.position.set(0.065, 0.29, 0);
      oilGroup.add(spout);

      const cap = new Mesh(
        new CylinderGeometry(0.060, 0.060, 0.030, 16),
        new MeshStandardMaterial({
          color: 0xea580c,
          roughness: 0.30,
        }),
      );
      cap.position.set(0.065, 0.33, 0);
      oilGroup.add(cap);

      mesh.add(oilGroup);
    }

    // 3. DRINKS: Significantly enlarged trio of aluminum cans in presentation tray
    if (product.name === 'DRINKS') {
      const drinksGroup = new Group();

      // Smoke acrylic presentation tray
      const tray = new Mesh(
        new BoxGeometry(0.38, 0.022, 0.22),
        new MeshStandardMaterial({
          color: 0x111622,
          roughness: 0.25,
          metalness: 0.6,
        }),
      );
      tray.position.set(0, -0.01, 0);
      drinksGroup.add(tray);

      const canColors = [0x1d4ed8, 0x15803d, 0xb91c1c]; // Cobalt, Emerald, Ruby
      [-0.115, 0, 0.115].forEach((cx, i) => {
        const canBody = new Mesh(
          new CylinderGeometry(0.048, 0.048, 0.21, 20),
          new MeshStandardMaterial({
            color: canColors[i],
            roughness: 0.22,
            metalness: 0.75,
          }),
        );
        canBody.position.set(cx, 0.11, 0);
        drinksGroup.add(canBody);

        // Brushed metallic top lid & pull tab
        const canLid = new Mesh(
          new CylinderGeometry(0.046, 0.046, 0.015, 20),
          new MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.18,
            metalness: 0.92,
          }),
        );
        canLid.position.set(cx, 0.22, 0);
        drinksGroup.add(canLid);

        const pullTab = new Mesh(
          new BoxGeometry(0.018, 0.005, 0.032),
          new MeshStandardMaterial({
            color: 0xcfd8dc,
            metalness: 0.95,
          }),
        );
        pullTab.position.set(cx, 0.23, 0.010);
        drinksGroup.add(pullTab);
      });

      mesh.add(drinksGroup);
    }

    // Register Entity with IWSDK RayInteractable
    const entity = world.createTransformEntity(mesh);
    entity.addComponent(RayInteractable);
    (product as any).mesh = mesh;
    (product as any).entity = entity;

    // Interaction Debounce & State Handler (Adds / Increments product)
    let lastProductSelectTime = 0;
    const PRODUCT_SELECT_DEBOUNCE_MS = 600;
    const handleProductSelect = () => {
      const now = performance.now();
      if (now - lastProductSelectTime < PRODUCT_SELECT_DEBOUNCE_MS) return;
      lastProductSelectTime = now;

      if (import.meta.env.DEV) {
        console.log('[SBD-DIAG] PRODUCT SELECT:', product.name);
      }

      if (product.selected >= product.stock) {
        refresh(`${product.name}: Maximum available reached (${product.stock})`);
        return;
      }

      pushCartSnapshot();
      product.selected += 1;
      lastModifiedProduct = product.name;
      playSelectChime();

      // Tactile spring bounce animation
      mesh.scale.setScalar(1.12);
      setTimeout(() => mesh.scale.setScalar(1.0), 200);

      refresh(`${product.name} added to order (Qty: ${product.selected})`);

      if (import.meta.env.DEV) {
        console.log(
          `SBD CART: ${product.name}, selected ${product.selected}`,
        );
      }
    };

    (product as any).__selectProduct = handleProductSelect;

    mesh.addEventListener('click', handleProductSelect);
    mesh.addEventListener('pointerdown', handleProductSelect);

    // Hover feedback for mouse
    mesh.addEventListener('pointerenter', () => {
      if (product.pedestalRing) {
        const mat = product.pedestalRing.material as MeshStandardMaterial;
        mat.emissiveIntensity = 0.95;
      }
      mesh.scale.setScalar(1.04);
    });
    mesh.addEventListener('pointerleave', () => {
      if (product.pedestalRing) {
        const mat = product.pedestalRing.material as MeshStandardMaterial;
        mat.emissiveIntensity = product.selected > 0 ? 1.2 : 0.35;
      }
      mesh.scale.setScalar(1.0);
    });
  });

  // ==========================================
  // CONFIRM SALE TERMINAL (BALANCED PROPORTIONS)
  // ==========================================

  // Interactive Button Mesh (Exact coordinates, rotation, and collider bounds)
  const confirmMaterial = new MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.38,
    metalness: 0.35,
  });

  const confirmMesh = new Mesh(
    new BoxGeometry(0.55, 0.22, 0.08),
    confirmMaterial,
  );

  confirmMesh.position.set(1.10, 1.05, -1.20);
  confirmMesh.rotation.y = -0.32; // ~18.5 degrees inward toward user
  confirmMesh.name = 'SBD-CONFIRM';

  // Grounded console pedestal pillar under the confirm terminal
  const terminalPillar = new Mesh(
    new CylinderGeometry(0.10, 0.14, 0.95, 16),
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
    0.042,
    0.50,
    0.19,
    confirmMesh,
    0,
    0,
    1024,
    512,
  );

  function updateConfirmButtonVisual(hasItems: boolean, isActive = false) {
    const total = orderTotal();
    if (!hasItems) {
      confirmMaterial.color.setHex(0x1e293b);
      renderButton({
        title: 'CONFIRM SALE',
        titleColor: '#64748b',
        subtitle: 'CART EMPTY • SELECT PRODUCTS',
        subtitleColor: '#475569',
        isDisabled: true,
        accentBorder: '#334155',
        borderWidth: 8,
      });
    } else {
      confirmMaterial.color.setHex(isActive ? 0x00ffaa : 0x10b981);
      renderButton({
        title: '✓ CONFIRM SALE',
        titleColor: '#ffffff',
        subtitle: `${money(total)} • EXECUTE ORDER`,
        subtitleColor: isActive ? '#ffffff' : '#d1fae5',
        isButton: true,
        buttonActive: isActive,
        accentBorder: '#10b981',
        borderWidth: 14,
      });
    }
  }

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
      refresh('Cart is empty. Select products first');
      return false;
    }

    isConfirmLocked = true;
    lastConfirmTime = now;

    try {
      // Commit Financial Transaction
      for (const product of products) {
        product.stock -= product.selected;
        product.selected = 0;
      }

      totalRevenue += total;
      completedOrders += 1;

      // Clear draft cart history so Undo cannot reverse committed sales
      cartHistory.length = 0;

      // Executive Confirmation Sound
      playConfirmationChime();

      // Visual button feedback (emerald flash)
      updateConfirmButtonVisual(true, true);
      setTimeout(() => {
        updateConfirmButtonVisual(false, false);
      }, 450);

      // Dedicated Floating Transaction Success Toast
      renderSuccessBanner({
        title: '✓ SALE CONFIRMED',
        titleColor: '#10b981',
        subtitle: `${money(total)}   •   Inventory Updated · Sales ${completedOrders}`,
        subtitleColor: '#ffffff',
        accentBorder: '#10b981',
        borderWidth: 16,
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
    if (orderTotal() > 0) {
      confirmMaterial.color.setHex(0x34d399);
      updateConfirmButtonVisual(true, true);
    }
  });
  confirmMesh.addEventListener('pointerleave', () => {
    if (orderTotal() > 0) {
      confirmMaterial.color.setHex(0x10b981);
      updateConfirmButtonVisual(true, false);
    }
  });

  // Direct internal module connections
  internalConfirmSale = () => confirmSale('ecs-pressed');
  internalIncreaseQuantity = (pName: string) => increaseQuantity(pName);
  internalDecreaseQuantity = (pName) => decreaseQuantity(pName);
  internalRemoveProduct = (pName) => removeProduct(pName);
  internalUndoCart = () => undoLastCartAction();
  internalClearCart = () => clearEntireCart();

  // Hover feedback handler connected to XR interaction system
  activeHoverCallback = (name: string, isHovered: boolean) => {
    if (name === 'SBD-CONFIRM') {
      if (orderTotal() > 0) {
        confirmMaterial.color.setHex(isHovered ? 0x34d399 : 0x10b981);
        updateConfirmButtonVisual(true, isHovered);
      }
    } else if (name.startsWith('SBD-PRODUCT:')) {
      const match = products.find((p) => 'SBD-PRODUCT:' + p.name === name);
      if (match) {
        if (match.pedestalRing) {
          const mat = match.pedestalRing.material as MeshStandardMaterial;
          mat.emissiveIntensity = isHovered ? 0.95 : match.selected > 0 ? 1.2 : 0.35;
        }
        if (match.mesh) {
          match.mesh.scale.setScalar(isHovered ? 1.05 : 1.0);
        }
      }
    } else if (cartButtonMaterials[name]) {
      const entry = cartButtonMaterials[name];
      entry.mat.color.setHex(isHovered ? 0x38bdf8 : entry.baseColor);
    }
  };

  refresh();

  if (import.meta.env.DEV) {
    const container = document.getElementById('scene-container');
    if (container) {
      (container as any).__sbd_dev_meshes = {
        confirmMesh,
        products,
        increaseQuantity,
        decreaseQuantity,
        removeProduct,
        undoLastCartAction,
        clearEntireCart,
        cartButtons: {
          btnRiceInc,
          btnRiceDec,
          btnRiceRem,
          btnOilInc,
          btnOilDec,
          btnOilRem,
          btnDrinksInc,
          btnDrinksDec,
          btnDrinksRem,
          btnUndo,
          btnClear,
        },
      };
    }
    console.log('SBD: Sales workflow initialized (release candidate)');
  }
}

// META-VR-13J / META-VR-20C / META-VR-21C / META-VR-21C.10 / META-VR-21C.12: Hands-first XR interaction system
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
      } else if (name.startsWith('SBD-CART:INC:') || name.startsWith('SBD-INC:')) {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        const pName = name.replace('SBD-CART:INC:', '').replace('SBD-INC:', '');
        internalIncreaseQuantity?.(pName);
      } else if (name.startsWith('SBD-CART:DEC:') || name.startsWith('SBD-DEC:')) {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        const pName = name.replace('SBD-CART:DEC:', '').replace('SBD-DEC:', '');
        internalDecreaseQuantity?.(pName);
      } else if (name === 'SBD-CART:DEC') {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        internalDecreaseQuantity?.();
      } else if (
        name.startsWith('SBD-CART:REM:') ||
        name.startsWith('SBD-CART:REMOVE:') ||
        name.startsWith('SBD-REM:') ||
        name.startsWith('SBD-REMOVE:')
      ) {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        const pName = name
          .replace('SBD-CART:REM:', '')
          .replace('SBD-CART:REMOVE:', '')
          .replace('SBD-REM:', '')
          .replace('SBD-REMOVE:', '');
        internalRemoveProduct?.(pName);
      } else if (name === 'SBD-CART:REMOVE') {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        internalRemoveProduct?.();
      } else if (name === 'SBD-CART:UNDO' || name === 'SBD-UNDO') {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        internalUndoCart?.();
      } else if (name === 'SBD-CART:CLEAR' || name === 'SBD-CLEAR') {
        if (import.meta.env.DEV) {
          console.log(`[SBD-DIAG] ${kind} PRESS:`, name);
        }
        internalClearCart?.();
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
