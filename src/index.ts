/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { PanelSystem } from './panel.js';
import { createInventoryPrototype, InventoryTargetDiagnosticSystem } from './inventory-prototype.js';
import { RobotSystem } from './robot.js';
import { initLandingPage } from './landing.js';
import './landing.css';

initLandingPage();

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(RobotSystem);
  world.registerSystem(PanelSystem);
  createInventoryPrototype(world);
  world.registerSystem(InventoryTargetDiagnosticSystem);
});
