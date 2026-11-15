import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  RayInteractable,
  PokeInteractable,
  Hovered,
  Pressed,
  createSystem,
  type World,
} from '@iwsdk/core';

import {
  CanvasTexture,
  MeshBasicMaterial,
  PlaneGeometry,
  DoubleSide,
  CylinderGeometry,
  SphereGeometry,
  Object3D,
} from 'three';

type Product = {
  name: string;
  price: number;
  stock: number;
  initialStock: number;
  selected: number;
  color: number;
  x: number;
  material?: MeshStandardMaterial;
};

let internalConfirmSale: (() => void) | null = null;

export function createInventoryPrototype(world: World): void {
  const products: Product[] = [
    {
      name: 'RICE',
      price: 25000,
      stock: 12,
      initialStock: 12,
      selected: 0,
      color: 0xe2b35b,
      x: -0.65,
    },
    {
      name: 'COOKING OIL',
      price: 8500,
      stock: 8,
      initialStock: 8,
      selected: 0,
      color: 0x4c9f70,
      x: 0,
    },
    {
      name: 'DRINKS',
      price: 4500,
      stock: 15,
      initialStock: 15,
      selected: 0,
      color: 0x518ae0,
      x: 0.65,
    },
  ];

  let totalRevenue = 0;
  let completedOrders = 0;

  const money = (value: number) =>
    'NGN ' + value.toLocaleString('en-NG');

  // Render an actual text panel in the 3D world.
  function createTextPanel(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    parent?: Mesh | Object3D,
    rotY = 0,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;

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
    if (rotY) {
      mesh.rotation.y = rotY;
    }

    if (parent) {
      parent.add(mesh);
    } else {
      world.createTransformEntity(mesh);
    }

    const render = (lines: string[]) => {
      mesh.userData.textLines = lines;
      context.clearRect(0, 0, 1024, 256);

      context.fillStyle = '#142434';
      context.fillRect(0, 0, 1024, 256);

      context.strokeStyle = '#4b8ba9';
      context.lineWidth = 8;
      context.strokeRect(4, 4, 1016, 248);

      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#ffffff';

      const fontSize = lines.length > 2 ? 39 : 48;
      context.font = `bold ${fontSize}px Arial`;

      lines.forEach((line, index) => {
        const rowHeight = 256 / (lines.length + 1);
        context.fillText(
          line,
          512,
          rowHeight * (index + 1),
          970,
        );
      });

      texture.needsUpdate = true;
    };

    mesh.userData.textLines = [];
    render.mesh = mesh;
    return render;
  }

  const renderHeading = createTextPanel(
    0, 1.98, -1.85, 1.55, 0.32,
  );

  const renderStatus = createTextPanel(
    0, 1.75, -1.80, 1.55, 0.27,
  );

  const renderOrder = createTextPanel(
    0, 0.91, -1.45, 1.35, 0.29,
  );

  const renderConfirmation = createTextPanel(
    1.10, 0.72, -1.15, 0.85, 0.19, undefined, -0.32,
  );

  renderHeading([
    'SPATIAL BUSINESS DESK',
    'Interactive Inventory',
  ]);

  const productLabels = products.map((product) =>
    createTextPanel(
      product.x,
      1.08,
      -1.54,
      0.59,
      0.23,
    ),
  );

  function orderTotal(): number {
    return products.reduce(
      (total, product) =>
        total + product.selected * product.price,
      0,
    );
  }

  function refresh(message = 'Select a product to begin') {
    products.forEach((product, index) => {
      productLabels[index]([
        product.name,
        `Stock ${product.stock} | Cart ${product.selected}`,
      ]);

      product.material?.color.setHex(
        product.stock <= 3 ? 0xd64c4c : product.color,
      );
    });

    const itemCount = products.reduce(
      (sum, product) => sum + product.selected,
      0,
    );

    renderOrder([
      `ORDER: ${itemCount} ITEMS`,
      `TOTAL: ${money(orderTotal())}`,
    ]);

    renderStatus([
      message,
      `Revenue ${money(totalRevenue)} | Sales ${completedOrders}`,
    ]);

    renderConfirmation([
      'Select CONFIRM SALE to post order',
    ]);

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

  // Interactive inventory objects.
  products.forEach((product) => {
    const material = new MeshStandardMaterial({
      color: product.color,
      roughness: 0.65,
    });

    product.material = material;

    const mesh = new Mesh(
      new BoxGeometry(0.35, 0.35, 0.25),
      material,
    );

    // META-VR-12B PRODUCT DETAILS
    // Preserve the existing clickable base mesh.
    if (product.name === 'RICE') {
      const sack = new Mesh(
        new SphereGeometry(0.14, 12, 8),
        new MeshStandardMaterial({ color: 0xf4e2b5 }),
      );
      sack.position.set(0, 0.16, 0);
      sack.scale.set(1, 0.48, 0.8);
      mesh.add(sack);

      const tie = new Mesh(
        new CylinderGeometry(0.025, 0.035, 0.07, 8),
        new MeshStandardMaterial({ color: 0x957044 }),
      );
      tie.position.set(0, 0.235, 0);
      mesh.add(tie);
    }

    if (product.name === 'COOKING OIL') {
      const shoulder = new Mesh(
        new SphereGeometry(0.105, 12, 8),
        new MeshStandardMaterial({ color: 0xe1c65b }),
      );
      shoulder.position.set(0, 0.16, 0);
      shoulder.scale.set(1, 0.45, 0.85);
      mesh.add(shoulder);

      const neck = new Mesh(
        new CylinderGeometry(0.045, 0.055, 0.09, 10),
        new MeshStandardMaterial({ color: 0xe1c65b }),
      );
      neck.position.set(0, 0.235, 0);
      mesh.add(neck);

      const cap = new Mesh(
        new CylinderGeometry(0.064, 0.064, 0.035, 10),
        new MeshStandardMaterial({ color: 0xe86b3a }),
      );
      cap.position.set(0, 0.295, 0);
      mesh.add(cap);
    }

    if (product.name === 'DRINKS') {
      const bottleMaterial = new MeshStandardMaterial({
        color: 0x375b78,
        roughness: 0.35,
      });
      const capMaterial = new MeshStandardMaterial({
        color: 0xefca63,
      });

      [-0.10, 0, 0.10].forEach((x) => {
        const bottle = new Mesh(
          new CylinderGeometry(0.045, 0.055, 0.15, 8),
          bottleMaterial,
        );
        bottle.position.set(x, 0.22, 0);
        mesh.add(bottle);

        const cap = new Mesh(
          new CylinderGeometry(0.035, 0.035, 0.025, 8),
          capMaterial,
        );
        cap.position.set(x, 0.31, 0);
        mesh.add(cap);
      });
    }
    mesh.position.set(product.x, 1.35, -1.60);
    mesh.name = 'SBD-PRODUCT:' + product.name;

    const entity = world.createTransformEntity(mesh);
    entity.addComponent(RayInteractable);
    (product as any).mesh = mesh;
    (product as any).entity = entity;

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
      mesh.scale.setScalar(1.07);
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
  });

  // The confirmation button is an actual XR-selectable object.
  const confirmMaterial = new MeshStandardMaterial({
    color: 0x147e64,
    roughness: 0.5,
  });

  const confirmMesh = new Mesh(
    new BoxGeometry(0.80, 0.32, 0.14),
    confirmMaterial,
  );

  confirmMesh.position.set(1.10, 1.05, -1.20);
  confirmMesh.rotation.y = -0.32; // ~18.5 degrees inward toward user
  confirmMesh.name = 'SBD-CONFIRM';

  const confirmEntity = world.createTransformEntity(confirmMesh);
  confirmEntity.addComponent(RayInteractable);
  confirmEntity.addComponent(PokeInteractable);

  const renderButton = createTextPanel(
    0, 0, 0.072, 0.72, 0.24, confirmMesh,
  );
  renderButton(['CONFIRM SALE']);

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

      // Visual button feedback (emerald flash)
      confirmMaterial.color.setHex(0x27ae60);
      setTimeout(() => {
        confirmMaterial.color.setHex(0x147e64);
      }, 450);

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
    confirmMaterial.color.setHex(0x1c9878);
  });
  confirmMesh.addEventListener('pointerleave', () => {
    confirmMaterial.color.setHex(0x147e64);
  });

  // Direct internal module connection to ECS Pressed handler (no globals, no console bypass)
  internalConfirmSale = () => confirmSale('ecs-pressed');

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

// META-VR-13J / META-VR-20C: Hands-first XR interaction system.
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

    if (import.meta.env.DEV) {
      this.queries.rayHovered.subscribe('qualify', (entity) => {
        const name = entity.object3D?.name ?? '';
        if (name.startsWith('SBD-')) {
          console.log('[SBD-DIAG] RAY HOVER:', name);
        }
      });

      this.queries.pokeHovered.subscribe('qualify', (entity) => {
        const name = entity.object3D?.name ?? '';
        if (name.startsWith('SBD-')) {
          console.log('[SBD-DIAG] POKE HOVER:', name);
        }
      });
    }

    this.queries.rayPressed.subscribe('qualify', (entity) => {
      handlePress(entity, 'RAY');
    });

    this.queries.pokePressed.subscribe('qualify', (entity) => {
      handlePress(entity, 'POKE');
    });
  }
}

// Retain export alias so src/index.ts and any other consumers remain 100% compatible
export { InventoryInteractionSystem as InventoryTargetDiagnosticSystem };
