import * as polyDecomp from "https://cdn.skypack.dev/poly-decomp@0.3.0";

const {
  Bodies,
  Body,
  Bounds,
  Common,
  Composite,
  Constraint,
  Engine,
  Events,
  Mouse,
  MouseConstraint,
  Query,
  Render,
  Runner,
  Vector,
  Vertices,
} = Matter;

Common.setDecomp(polyDecomp);

const engine = Engine.create({
  gravity: {
    scale: 0.001,
    x: 0,
    y: 1,
  },
});

const rect = document.documentElement.getBoundingClientRect();
const render = Render.create({
  element: document.body,
  engine: engine,
  options: {
    width: rect.height,
    height: rect.height,
    pixelRatio: 1,
    hasBounds: true,
    showConvexHulls: true,
    showAxes: true,
  },
});

const boxA = Bodies.rectangle(100, -50, 80, 80);
const boxB = Bodies.rectangle(400 * 0.60, -50, 80, 80);
const ground = Bodies.rectangle(0, 0, 1000, 50, { isStatic: true });

const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
  mouse,
  constraint: {
    angularStiffness: 0.8,
    render: {
      visible: true,
    },
  },
  collisionFilter: {
    category: 0x0000,
    mask: 0x00000000,
    group: 0,
  },
  /*{ // Default
    category: 0x0001,
    mask: 0xFFFFFFFF,
    group: 0,
  },*/
});
render.mouse = mouse;

Composite.add(engine.world, [boxA, boxB, ground, mouseConstraint]);

const runner = Runner.create();
Runner.run(runner, engine);
Render.run(render);

// Setup
const KEYS_DOWN = new Set();
setInterval(() => console.log(KEYS_DOWN), 1000);

const SHAPE_FACTORIES = [
  { key: 'rectangle',
    icon: 'square',
    numPoints: 2,
    factory: ([pointStart, pointEnd], isAlternateMode) => {
      if (!pointStart || !pointEnd) return;
      
      
      const min = Vector.create(Math.min(pointStart.position.x, pointEnd.position.x), Math.min(pointStart.position.y, pointEnd.position.y));
      const max = Vector.create(Math.max(pointStart.position.x, pointEnd.position.x), Math.max(pointStart.position.y, pointEnd.position.y));
      
      let width = max.x - min.x
      let height = max.y - min.y
      let position = Vector.div(Vector.add(pointStart.position, pointEnd.position), 2);
      if (isAlternateMode) {
        width *= 2;
        height *= 2;
        position = pointStart.position;
      }
      
      if (width > 0 && height > 0) {
        return Bodies.rectangle(position.x, position.y, width, height, {});
      }
      return null;
    },
  },
  { key: 'circle',
    icon: 'circle',
    numPoints: 2,
    factory: ([pointStart, pointEnd], isAlternateMode) => {
      if (!pointStart || !pointEnd) return;
      
      let radius = Vector.magnitude(Vector.sub(pointStart.position, pointEnd.position));
      if (isAlternateMode) radius /= 2;
      
      if (radius > 0) {
        let position = pointStart.position;
        if (isAlternateMode) position = Vector.div(Vector.add(pointStart.position, pointEnd.position), 2);
        return Bodies.circle(position.x, position.y, radius, {}, 50);
      }
      return null;
    },
  },
  { key: 'capsule',
    icon: 'capsules',
    numPoints: 3,
    factory: ([pointStart, pointEnd, pointTangent], isAlternateMode) => {
      if (!pointStart || !pointEnd || !pointTangent) return;
      
      // Note: There is no way any of this is efficient
      const midpoint = Vector.div(Vector.add(pointStart.position, pointEnd.position), 2);
      const delta = Vector.sub(pointEnd.position, pointStart.position);
      const deltaMagSq = Vector.magnitudeSquared(delta);
      const deltaMag = Math.sqrt(deltaMagSq);
      const deltaDir = Vector.div(delta, deltaMag);
      
      let radius = 0;
      if (deltaMagSq <= (Number.EPSILON * Number.EPSILON)) {
        radius = Vector.magnitude(Vector.sub(pointStart.position, pointTangent.position));
      } else {
        let proj, scale;
        if (true) {
          proj = Vector.mult(deltaDir, Vector.dot(Vector.sub(pointTangent.position, pointStart.position), deltaDir));
          scale = Vector.magnitudeSquared(proj) / deltaMagSq * Math.sign(Vector.dot(deltaDir, Vector.normalise(Vector.sub(pointTangent.position, pointStart.position))));
        }
        if (scale < 0)
          radius = Vector.magnitude(Vector.sub(pointStart.position, pointTangent.position));
        else if (scale > 1)
          radius = Vector.magnitude(Vector.sub(pointEnd.position, pointTangent.position));
        else
          radius = Math.abs((pointEnd.position.x - pointStart.position.x) * (pointStart.position.y - pointTangent.position.y) - (pointStart.position.x - pointTangent.position.x) * (pointEnd.position.y - pointStart.position.y)) / Vector.magnitude(Vector.sub(pointEnd.position, pointStart.position));
      }
      
      const width = !isAlternateMode ? deltaMag + radius * 2 : deltaMag;
      const height = radius * 2;

      if (width > 0 && height > 0 && radius > 0) {
        const body = Bodies.rectangle(midpoint.x, midpoint.y, width, height, { chamfer: { radius } });
        Body.setAngle(body, Vector.angle(pointStart.position, pointEnd.position));
        return body;
      }
      return null;
    },
  },
  { key: 'polygon',
    icon: 'draw-polygon',
    numPoints: 0,
    factory: (points, isAlternateMode) => {
      if (points.length < 3) return;

      const positions = points.map(point => point.position);
      const body = Bodies.fromVertices(0, 0, positions, {}, true);
      
      const positionBounds = Bounds.create(positions);
      const offset = Vector.create(positionBounds.min.x - body.bounds.min.x, positionBounds.min.y - body.bounds.min.y);
      Body.setPosition(body, Vector.add(body.position, offset));
      console.log(offset);
      
      return body;
    },
  },
  { key: 'clone',
    icon: 'clone',
    numPoints: 2,
    doUnfreeze: false,
    factory: ([original, placement]) => {
      if (!original || !original.body || !placement) return;
      const body = Object.assign(clone(original.body), {
        id: Common.nextId(),
        collisionFilter: { category: 0x0000,
          mask: 0x00000000,
          group: 0,
        },
      });
      Body.setAngle(body, original.angle);
      Body.setPosition(body, Vector.sub(placement.position, original.offset));
      return body;
    },
    onFinalize: (body, [original, placement]) => {
      body.collisionFilter = clone(original.body.collisionFilter);
      Body.setStatic(body, original.body.isStatic);
      return true; // Override default finalization
    },
  },
];
const SHAPE_TOOL_BUILDER = ({ key, icon, iconStyle, numPoints, doUnfreeze, factory, onFinalize }) => {
  const createPoint = (position, bodies, ignoreBodies) => {
    position = Vector.clone(position);
    bodies = bodies || Composite.allBodies(engine.world);
    ignoreBodies = !Array.isArray(ignoreBodies) ? [ignoreBodies] : ignoreBodies;
    
    if (KEYS_DOWN.has('ControlLeft')) {
      position.x = Math.floor(position.x / 10 + 0.5) * 10;
      position.y = Math.floor(position.y / 10 + 0.5) * 10;
    }
    
    const queryResult = Query.point(bodies, position);
    const body = _.first(ignoreBodies ? queryResult.filter(body => !ignoreBodies.includes(body)) : queryResult);
    if (body && KEYS_DOWN.has('AltLeft')) {
      position = Vector.clone(body.position);
    }
    
    return {
      body,
      position,
      angle: body ? body.angle : 0,
      offset: body? Vector.sub(position, body.position) : Vector.create(0, 0),
    };
  };
  
  const updateBody = (state) => {
    if (!state.isActive) return;

    if (state.body) {
      Composite.remove(engine.world, state.body);
      state.body = null;
    }

    try {
      state.body = factory(state.points, state.isAlternateMode);
      if (state.body) {
        Body.setStatic(state.body, true);
        Composite.add(engine.world, [state.body]);
      }
    } catch (err) {
      // TODO: Include points
      console.error(`Unable to generate body from '${key}' factory: ${err.message}\n${err.stack || err}`);
    }
  };
  
  const finalizeBody = (state) => {
    if (!state.isActive) return;
    
    state.points = state.points.slice(0, state.pointsCommitted);
    updateBody(state);
    
    if (state.body) {
      if (!onFinalize || !onFinalize(state.body, state.points)) {
        if (!KEYS_DOWN.has('ShiftLeft')) {
          Body.setStatic(state.body, false);
        } else {
          Body.setStatic(state.body, true);
        }
      }
    }
  };

  return {
    key,
    innerHTML: `
      <i class="fa-solid fa-${icon} fa-xl" style="${iconStyle || ''}"></i>
      <i class="fa-solid fa-plus"></i>
    `,
    onEvent: {
      mousedown: (event, state) => {
        const bodies = Composite.allBodies(engine.world);
        
        if (!state.isActive) {
          state.isActive = true;
          state.isAlternateMode = event.mouse.button === 2;
          state.points = [createPoint(event.mouse.position, bodies, state.body)];
          state.pointsCommitted = 1;
          state.body = null;
        } else if (event.mouse.button === 0) {
          state.points[state.pointsCommitted] = createPoint(event.mouse.position, bodies, state.body);
          state.pointsCommitted++;
        }

        updateBody(state);

        if ((numPoints > 0 && state.points.length >= numPoints) || (numPoints <= 0 && event.mouse.button === 2)) {
          finalizeBody(state);
          state.isActive = false;
          state.body = null;
        }
      },
      mousemove: (event, state) => {
        if (!state.isActive) return;
        state.points[state.pointsCommitted] = createPoint(event.mouse.position, null, state.body);
        updateBody(state);
      },
    },
    state: {
      isActive: false,
      points: null,
      pointsCommitted: 0,
      body: null,
    },
  };
};

const CONSTRAINT_FACTORIES = [
  { key: 'pin',
    icon: 'thumbtack',
    numPoints: 1,
    factory: ([point]) => {
      if (!point || !point.body) return;
      return Constraint.create({
        bodyB: point.body,
        pointA: point.position,
        pointB: point.offset,
        length: 0,
      });
    },
  },
  ...[1.00, 0.10, 0.01, 0.001].map(stiffness => ({
    key: `connect-${stiffness.toPrecision(2)}`,
    icon: stiffness !== 1.00 ? 'share-nodes' : 'circle-nodes',
    iconStyle: stiffness !== 1.00 ? `color:rgba(${150 + 100 * (stiffness / 0.15)}, 255, ${150 + 100 * (1-(stiffness / 0.15))}, 1);` : '',
    numPoints: 2,
    factory: ([pointStart, pointEnd]) => {
      if (!pointStart || !pointEnd) return;
      if (!pointStart.body && !pointEnd.body) return;
      return Constraint.create({
        bodyA: pointStart.body,
        bodyB: pointEnd.body,
        pointA: pointStart.body ? pointStart.offset : pointStart.position,
        pointB: pointEnd.body ? pointEnd.offset : pointEnd.position,
        stiffness,
      });
    },
  })),
  { key: 'union',
    icon: 'object-group',
    numPoints: 0,
    factory: (points) => {
      if (!points || points.length < 2) return;
      
      const bodies = points.map(point => point.body).filter(Boolean);
      for (let body of bodies) {
        // Note: Deep search? Would be slow, right?
        Composite.remove(engine.world, body);
      }
      
      // TODO: Clone only specific body properties needed
      const parts = bodies.map(body => body.parts.length > 1 ? body.parts.filter(p => p !== body) : body.parts).flat();
      const clones = parts.map(part => Object.assign(clone(part), { id: Common.nextId() }));
      return Body.create({
        parts: clones,
        isStatic: clones.some(body => body.isStatic),
      });
    },
  },
];
const CONSTRAINT_TOOL_BUILDER = ({ key, icon, iconStyle, numPoints, factory }) => {
  const createPoint = (position, bodies, ignoreBodies) => {
    position = Vector.clone(position);
    bodies = bodies || Composite.allBodies(engine.world);
    ignoreBodies = !Array.isArray(ignoreBodies) ? [ignoreBodies] : ignoreBodies;
    
    if (KEYS_DOWN.has('ControlLeft')) {
      position.x = Math.floor(position.x / 10 + 0.5) * 10;
      position.y = Math.floor(position.y / 10 + 0.5) * 10;
    }
    
    const queryResult = Query.point(bodies, position);
    const body = _.first(ignoreBodies ? queryResult.filter(body => !ignoreBodies.includes(body)) : queryResult);
    if (body && KEYS_DOWN.has('AltLeft')) {
      position = Vector.clone(body.position);
    }
    
    return {
      body,
      position,
      angle: body ? body.angle : 0,
      offset: body? Vector.sub(position, body.position) : Vector.create(0, 0),
    };
  };

  const finalizeConstraint = (state) => {
    if (!state.isActive) return;

    try {
      const result = factory(state.points);
      if (result) {
        Composite.add(engine.world, [result]);
      }
    } catch (err) {
      // TODO: Include points
      console.error(`Unable to generate constraint from '${key}' factory: ${err.message}\n${err.stack || err}`);
    }
  };

  return {
    key,
    innerHTML: `
      <i class="fa-solid fa-${icon} fa-xl" style="${iconStyle || ''}"></i>
      <i class="fa-solid fa-link"></i>
    `,
    onEvent: {
      mousedown: (event, state) => {
        const bodies = Composite.allBodies(engine.world);
        
        if (!state.isActive) {
          state.isActive = true;
          state.points = [createPoint(event.mouse.position, bodies)];
          state.pointsCommitted = 1;
        } else {
          state.points[state.pointsCommitted] = createPoint(event.mouse.position, bodies);
          state.pointsCommitted++;
        }

        if ((numPoints > 0 && state.points.length >= numPoints) || (numPoints <= 0 && event.mouse.button === 2)) {
          finalizeConstraint(state);
          state.isActive = false;
        }
      },
    },
    state: {
      isActive: false,
      points: null,
      pointsCommitted: 0,
    },
  };
};

let INSPECTED_OBJECT = null;
let INSPECTED_OBJECT_PROPERTIES = null;
let INSPECTED_OBJECT_LAST_UPDATE = 0;

let ACTIVE_TOOL = null;
const TOOL_BOX = [
  { key: 'general',
    tools: [
      { key: 'pointer',
        innerHTML: `
          <i class="fa-solid fa-arrow-pointer"></i>
        `,
       onDeactivate: (state) => {
         if (state.isDown) {
           state.isDown = false;
           state.isExpired = true;
         }

         if (state.timeout) {
           clearTimeout(state.timeout);
           state.timeout = null;
         }

         if (state.contextMenu) {
           state.contextMenu.hide();
           state.contextMenu = null;
         }
        },
        onEvent: {
          mousedown: (event, state) => {
            state.isDown = true;
            state.isExpired = false;
            
            state.position = Vector.clone(event.mouse.position);
            state.bodies = Query.point(Composite.allBodies(engine.world), state.position);
            
            if (state.timeout) {
              clearTimeout(state.timeout);
              state.timeout = null;
            }
            
            if (state.contextMenu) {
              state.contextMenu.hide();
              state.contextMenu = null;
            }
            
            state.timeout = setTimeout(() => {
              state.isExpired = true;
              
              const menuItems = state.bodies.map(body => ({
                text: body.label,
                hotkey: body.id,
                onclick: () => inspectObject(body),
              }));
              
              const contextMenu = state.contextMenu = new ContextMenu(document.body, menuItems);
              contextMenu.show(event.mouse.absolute.x, event.mouse.absolute.y);
            }, 1500);
          },
          mouseup: (event, state) => {
            if (!state.isDown || state.isExpired) return;

            state.isDown = false;
            
            if (state.timeout) {
              clearTimeout(state.timeout);
              state.timeout = null;
            }
            
            inspectObject(_.first(state.bodies));
          },
        },
       state: {
         isDown: false,
         isExpired: false,
         timeout: null,
         contextMenu: null,
         position: null,
         bodies: null,
       },
      },
      { key: 'move',
        innerHTML: `
          <i class="fa-solid fa-arrows-up-down-left-right"></i>
        `,
        onEvent: {
          mousedown: (event, state) => {
            if (state.isDown) return;
            state.isDown = true;
            state.position = Vector.clone(event.mouse.position);
            state.body = _.first(Query.point(Composite.allBodies(engine.world), state.position));
            if (state.body) {
              state.wasStatic = state.body.isStatic;
              Body.setStatic(state.body, true);
              state.localPosition = Vector.sub(state.body.position, state.position);
            }
          },
          mousemove: (event, state) => {
            if (!state.isDown) return;
            
            if (state.body) {
              Body.setPosition(state.body, Vector.add(event.mouse.position, state.localPosition));
            }
          },
          mouseup: (event, state) => {
            if (!state.isDown) return;
            
            if (state.body) {
              Body.setStatic(state.body, state.wasStatic);
            }
            
            state.isDown = false;
            state.body = null;
            state.wasStatic = false;
            state.position = null;
            state.localPosition = null;
          },
        },
        state: { isDown: false, body: null, wasStatic: false, position: null, localPosition: null },
      },
      { key: 'grab',
        innerHTML: `
          <i class="fa-solid fa-hand"></i>
        `,
        onActivate: () => {
          mouseConstraint.collisionFilter = { // Default
            category: 0x0001,
            mask: 0xFFFFFFFF,
            group: 0,
          };
        },
        onDeactivate: () => {
          mouseConstraint.collisionFilter = { // Empty
            category: 0x0000,
            mask: 0x00000000,
            group: 0,
          };
        },
      },
    ],
  },
  { key: 'destructive',
    tools: [
      { key: 'remove',
        innerHTML: `
          <i class="fa-solid fa-delete-left"></i>
        `,
        onEvent: {
          mousedown: (event, state) => {
            if (state.isDown) return;
            state.isDown = true;
            state.bodies = Query.point(Composite.allBodies(engine.world), event.mouse.position);
          },
          mouseup: (event, state) => {
            if (!state.isDown) return;
            
            const confirm = Query.point(Composite.allBodies(engine.world), event.mouse.position);
            const body = _.first(state.bodies, _.intersection(state.bodies, confirm));
            if (body) {
              Composite.remove(engine.world, body);
            }
            
            state.isDown = false;
            state.bodies = null;
          },
        },
        state: { isDown: false, bodies: null },
      },
    ],
  },
  
  { key: 'create',
    tools: SHAPE_FACTORIES.map(shapeFactory => SHAPE_TOOL_BUILDER(shapeFactory)),
  },
  
  { key: 'constrain',
    tools: CONSTRAINT_FACTORIES.map(constraintFactory => CONSTRAINT_TOOL_BUILDER(constraintFactory)),
  },
];

// Functions
function updateCanvasDimensions() {
  const rect = document.documentElement.getBoundingClientRect();
  const size = Vector.create(rect.width, rect.height);
  
  render.options.width = size.x;
  render.options.height = size.y;
  render.canvas.width = size.x;
  render.canvas.height = size.y;
  render.bounds.min.x = size.x * -0.5;
  render.bounds.min.y = size.y * -0.90;
  render.bounds.max.x = size.x * 0.5;
  render.bounds.max.y = size.y * 0.10;
}

function buildToolbox() {
  const elToolBox = document.getElementById('tool-box');
  
  let firstTool = null;
  for (let category of TOOL_BOX) {
    const elCategory = category.element = elToolBox.appendChild(document.createElement('div'));
    elCategory.id = `tool-category-${category.key}`;
    elCategory.classList.add('container')
    
    for (let tool of category.tools) {
      if (!firstTool) firstTool = tool;
      
      tool.category = category;
      tool.state = tool.state || {};
      tool._onEventCallbacks = {};
      
      const elTool = tool.element = elCategory.appendChild(document.createElement('div'));
      elTool.id = `tool-tool-${category.key}-${tool.key}`;
      elTool.classList.add('tool');
      elTool.innerHTML = tool.innerHTML;
      elTool.addEventListener('click', event => {
        activateTool(tool);
      });
    }
    
    if (firstTool) {
      activateTool(firstTool);
    }
  }
}

function activateTool(tool) {
  if (tool === ACTIVE_TOOL) return;
  
  if (ACTIVE_TOOL !== null) {
    if (ACTIVE_TOOL.onEvent) {
      for (let [eventName, eventHandler] of Object.entries(ACTIVE_TOOL.onEvent)) {
        const callback = ACTIVE_TOOL._onEventCallbacks[eventName];
        if (callback) {
          Events.off(mouseConstraint, eventName, callback);
          delete ACTIVE_TOOL._onEventCallbacks[eventName];
        }
      }
    }
    
    if (ACTIVE_TOOL.onDeactivate) {
      try {
        ACTIVE_TOOL.onDeactivate(ACTIVE_TOOL.state);
      } catch (err) {
        const message = `Error attempting to deactivate tool '${ACTIVE_TOOL.category.key}:${ACTIVE_TOOL.key}': ${err.stack || err}`;
        console.error(message);
        alert(message);
      }
    }
  
    if (ACTIVE_TOOL.element) ACTIVE_TOOL.element.classList.remove('active');
  
    ACTIVE_TOOL = null;
  }
  
  if (tool !== null) {
    ACTIVE_TOOL = tool;
    
    if (ACTIVE_TOOL.onEvent) {
      for (let [eventName, eventHandler] of Object.entries(ACTIVE_TOOL.onEvent)) {
        const _tool = ACTIVE_TOOL;
        const callback = _tool._onEventCallbacks[eventName] = (event) => eventHandler(event, _tool.state);
        Events.on(mouseConstraint, eventName, callback);
      }
    }
    
    if (ACTIVE_TOOL.onActivate) {
      try {
        ACTIVE_TOOL.onActivate(ACTIVE_TOOL.state);
      } catch (err) {
        const message = `Error attempting to activate tool '${ACTIVE_TOOL.category.key}:${ACTIVE_TOOL.key}': ${err.stack || err}`;
        console.error(message);
        alert(message);
      }
    }
    
    if (ACTIVE_TOOL.element) ACTIVE_TOOL.element.classList.add('active');
  }
}

function inspectObject(object) {
  INSPECTED_OBJECT = object;
  INSPECTED_OBJECT_PROPERTIES = object ? {} : null;
  
  const elInspector = document.getElementById('inspector');
  if (!object) return elInspector.replaceChildren();
  
  const elTable = elInspector.appendChild(document.createElement('table'));
  elTable.appendChild(document.createElement('thead')).innerHTML = `
    <tr>
      <th>Key</th>
      <th>Value</th>
    </tr>
  `;
  
  const elTBody = elTable.appendChild(document.createElement('tbody'));
  for (let [key, value] of Object.entries(object)) {
    const elRow = elTBody.appendChild(document.createElement('tr'));
    elRow.setAttribute('data-key', key);
    elRow.classList.add('property');
    
    const elKey = elRow.appendChild(document.createElement('td'));
    elKey.classList.add('key');
    elKey.append(_.toString(key));
    
    const elValue = elRow.appendChild(document.createElement('td'));
    elValue.classList.add('value');
    elValue.append(_.toString(value));
    
    INSPECTED_OBJECT_PROPERTIES[key] = { key, value, elements: { row: elRow, key: elKey, value: elValue } };
  }
  
  elInspector.replaceChildren(elTable);
}

function updateInspectedObject() {
  if (!INSPECTED_OBJECT) return;
  
  for (let [key, property] of Object.entries(INSPECTED_OBJECT_PROPERTIES)) {
    const value = property.value = INSPECTED_OBJECT[key];
    const elValue = property.elements.value;
    
    elValue.replaceChildren();
    elValue.append(_.toString(value));
  }
}

Events.on(engine, 'afterUpdate', () => {
  const now = Date.now();

  if (now - INSPECTED_OBJECT_LAST_UPDATE < 100) return;
  INSPECTED_OBJECT_LAST_UPDATE = now;
  
  updateInspectedObject();
});

Events.on(render, 'beforeRender', () => {
  
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  window.addEventListener('resize', updateCanvasDimensions);
  document.addEventListener('keydown', event => {
    KEYS_DOWN.add(event.code);
    if (event.key === 'Alt') event.preventDefault();
  });
  document.addEventListener('keyup', event => {
    KEYS_DOWN.delete(event.code);
    if (event.key === 'Alt') event.preventDefault();
  });
  updateCanvasDimensions();
  buildToolbox();
});