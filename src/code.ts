console.log("[SG] ★ Plugin sandbox loaded (v12.1 — flicker-free swap with visibility toggle)");

figma.showUI(__html__, { width: 400, height: 600 });

// ─── Types ──────────────────────────────────────────────

type LayerType = "text" | "instance" | "frame" | "image" | "vector";

interface LayerInfo {
  id: string;
  name: string;
  type: LayerType;
  preview?: string;
  componentName?: string;
  path: string[];
  indexPath: number[];
  children?: LayerInfo[];
}

interface ComponentInfo {
  id: string;
  name: string;
  componentKey: string;
  layers: LayerInfo[];
}

interface ChildFillOverride {
  name: string;
  nodeType: string;
  fills: Paint[];
  hasImage: boolean;
}

// ─── Dynamic page support ───────────────────────────────

var pagesLoaded = false;

async function ensurePagesLoaded(): Promise<void> {
  if (!pagesLoaded) {
    console.log("[SG] Loading all pages...");
    await figma.loadAllPagesAsync();
    pagesLoaded = true;
    console.log("[SG] All pages loaded.");
  }
}

// ─── Safe async wrappers ────────────────────────────────
// In Figma Web + dynamic-page, certain async APIs return Promises
// that NEVER resolve (getMainComponentAsync, loadFontAsync, etc).
// We wrap them with a setTimeout fallback so our own Promise resolves.

var ASYNC_TIMEOUT_MS = 500;

function safeLoadFontAsync(font: FontName): Promise<boolean> {
  return new Promise(function (resolve) {
    var done = false;

    // Timeout fallback — fires even if Figma's Promise hangs
    setTimeout(function () {
      if (!done) {
        done = true;
        console.log("[SG] ⏱ Font load timeout for " + font.family + " " + font.style);
        resolve(false);
      }
    }, ASYNC_TIMEOUT_MS);

    // Try the real API with .then() — never await Figma's Promise directly
    try {
      figma.loadFontAsync(font).then(
        function () {
          if (!done) { done = true; resolve(true); }
        },
        function () {
          if (!done) { done = true; resolve(false); }
        }
      );
    } catch (e) {
      if (!done) { done = true; resolve(false); }
    }
  });
}

function safeImportComponentByKeyAsync(key: string): Promise<ComponentNode | null> {
  return new Promise(function (resolve) {
    var done = false;

    setTimeout(function () {
      if (!done) {
        done = true;
        console.log("[SG] ⏱ importComponentByKey timeout for " + key);
        resolve(null);
      }
    }, ASYNC_TIMEOUT_MS);

    try {
      figma.importComponentByKeyAsync(key).then(
        function (comp) {
          if (!done) { done = true; resolve(comp); }
        },
        function () {
          if (!done) { done = true; resolve(null); }
        }
      );
    } catch (e) {
      if (!done) { done = true; resolve(null); }
    }
  });
}

// ★ v12: Safe wrapper for getMainComponentAsync — the CORRECT API for dynamic-page
var ASYNC_TIMEOUT_NESTED_MS = 3000; // Longer timeout for library component resolution

function safeGetMainComponentAsync(inst: InstanceNode): Promise<ComponentNode | null> {
  return new Promise(function (resolve) {
    var done = false;

    setTimeout(function () {
      if (!done) {
        done = true;
        console.log("[SG]   ⏱ getMainComponentAsync timeout for '" + inst.name + "'");
        resolve(null);
      }
    }, ASYNC_TIMEOUT_NESTED_MS);

    try {
      inst.getMainComponentAsync().then(
        function (comp) {
          if (!done) { done = true; resolve(comp); }
        },
        function (err) {
          if (!done) {
            done = true;
            console.log("[SG]   getMainComponentAsync rejected for '" + inst.name + "': " + err);
            resolve(null);
          }
        }
      );
    } catch (e) {
      if (!done) {
        done = true;
        console.log("[SG]   getMainComponentAsync threw for '" + inst.name + "': " + e);
        resolve(null);
      }
    }
  });
}

// ─── Dual Fingerprint System ────────────────────────────
// STRICT: includes instance names — distinguishes different library components
// RELAXED: ignores instance names — matches instances with overridden nested components

function buildStrictFingerprint(node: SceneNode, depth: number): string {
  var parts: string[] = [];
  if ("children" in node) {
    var kids = (node as any).children as SceneNode[];
    for (var i = 0; i < kids.length; i++) {
      var child = kids[i];
      var childPart = child.type + ":" + child.name;
      if (depth > 0 && "children" in child) {
        childPart += "{" + buildStrictFingerprint(child, depth - 1) + "}";
      }
      parts.push(childPart);
    }
  }
  return parts.join("|");
}

function buildRelaxedFingerprint(node: SceneNode, depth: number): string {
  var parts: string[] = [];
  if ("children" in node) {
    var kids = (node as any).children as SceneNode[];
    for (var i = 0; i < kids.length; i++) {
      var child = kids[i];
      if (child.type === "INSTANCE") {
        parts.push("INSTANCE");
      } else {
        var childPart = child.type + ":" + child.name;
        if (depth > 0 && "children" in child) {
          childPart += "{" + buildRelaxedFingerprint(child, depth - 1) + "}";
        }
        parts.push(childPart);
      }
    }
  }
  return parts.join("|");
}

// Search local components: try strict first, then relaxed
function findComponentByFingerprint(
  strictFP: string,
  relaxedFP: string,
  instanceName: string
): ComponentNode | null {
  // Pass 1: strict match (exact structure including instance names)
  for (var pi = 0; pi < figma.root.children.length; pi++) {
    var page = figma.root.children[pi];
    var comps = page.findAllWithCriteria({ types: ["COMPONENT"] });
    for (var ci = 0; ci < comps.length; ci++) {
      if (buildStrictFingerprint(comps[ci], 2) === strictFP) {
        console.log("[SG] ✅ Strict FP match: '" + comps[ci].name + "' on page '" + page.name + "'");
        return comps[ci];
      }
    }
  }
  // Pass 1b: strict match in component sets
  for (var pi1b = 0; pi1b < figma.root.children.length; pi1b++) {
    var page1b = figma.root.children[pi1b];
    var sets1b = page1b.findAllWithCriteria({ types: ["COMPONENT_SET"] });
    for (var si = 0; si < sets1b.length; si++) {
      var set = sets1b[si] as ComponentSetNode;
      for (var vi = 0; vi < set.children.length; vi++) {
        var v = set.children[vi];
        if (v.type === "COMPONENT" && buildStrictFingerprint(v, 2) === strictFP) {
          console.log("[SG] ✅ Strict FP match (variant): '" + v.name + "' in '" + set.name + "'");
          return v as ComponentNode;
        }
      }
    }
  }

  // Pass 2: relaxed match (ignoring instance names — catches component updates)
  for (var pi2 = 0; pi2 < figma.root.children.length; pi2++) {
    var page2 = figma.root.children[pi2];
    var comps2 = page2.findAllWithCriteria({ types: ["COMPONENT"] });
    for (var ci2 = 0; ci2 < comps2.length; ci2++) {
      if (buildRelaxedFingerprint(comps2[ci2], 2) === relaxedFP) {
        console.log("[SG] ✅ Relaxed FP match: '" + comps2[ci2].name + "' on page '" + page2.name + "'");
        return comps2[ci2];
      }
    }
  }
  // Pass 2b: relaxed in component sets
  for (var pi2b = 0; pi2b < figma.root.children.length; pi2b++) {
    var page2b = figma.root.children[pi2b];
    var sets2b = page2b.findAllWithCriteria({ types: ["COMPONENT_SET"] });
    for (var si2 = 0; si2 < sets2b.length; si2++) {
      var set2 = sets2b[si2] as ComponentSetNode;
      for (var vi2 = 0; vi2 < set2.children.length; vi2++) {
        var v2 = set2.children[vi2];
        if (v2.type === "COMPONENT" && buildRelaxedFingerprint(v2, 2) === relaxedFP) {
          console.log("[SG] ✅ Relaxed FP match (variant): '" + v2.name + "' in '" + set2.name + "'");
          return v2 as ComponentNode;
        }
      }
    }
  }

  console.log("[SG] ⚠ No local fingerprint match for '" + instanceName + "' — likely a library component");
  return null;
}

// ─── Prefixes for encoded keys ──────────────────────────

var FP_PREFIX = "sg-fp:";
var TPL_PREFIX = "sg-tpl:";

function isFingerprintKey(key: string): boolean {
  return key.indexOf(FP_PREFIX) === 0;
}

function isTemplateKey(key: string): boolean {
  return key.indexOf(TPL_PREFIX) === 0;
}

function extractFingerprint(key: string): string {
  return key.substring(FP_PREFIX.length);
}

function extractTemplateNodeId(key: string): string {
  return key.substring(TPL_PREFIX.length);
}

// ─── Component resolution ───────────────────────────────

function resolveComponentFromInstance(
  inst: InstanceNode
): { comp: ComponentNode | null; strictFP: string; relaxedFP: string } {
  var strictFP = buildStrictFingerprint(inst, 2);
  var relaxedFP = buildRelaxedFingerprint(inst, 2);
  console.log("[SG] StrictFP: " + strictFP.substring(0, 100) + (strictFP.length > 100 ? "..." : ""));
  console.log("[SG] RelaxedFP: " + relaxedFP.substring(0, 100) + (relaxedFP.length > 100 ? "..." : ""));
  var comp = findComponentByFingerprint(strictFP, relaxedFP, inst.name);
  return { comp: comp, strictFP: strictFP, relaxedFP: relaxedFP };
}

// ─── Layer Tree Builder ─────────────────────────────────

function collectLayers(
  node: SceneNode,
  parentPath: string[],
  parentIndexPath: number[],
  childIndex: number,
  result: LayerInfo[]
): void {
  var myIndexPath = parentIndexPath.concat([childIndex]);

  if (node.type === "TEXT") {
    result.push({
      id: node.id,
      name: node.name,
      type: "text",
      preview: (node as TextNode).characters.substring(0, 50),
      path: parentPath.concat([node.name]),
      indexPath: myIndexPath,
    });
    return;
  }

  if (node.type === "INSTANCE") {
    var inst = node as InstanceNode;
    var compName: string;
    try {
      compName = inst.mainComponent ? inst.mainComponent.name : inst.name;
    } catch (e) {
      compName = inst.name;
    }
    var myPath = parentPath.concat([node.name]);
    var item: LayerInfo = {
      id: node.id,
      name: node.name,
      type: "instance",
      componentName: compName,
      path: myPath,
      indexPath: myIndexPath,
    };
    if ("children" in inst && inst.children.length > 0) {
      var children: LayerInfo[] = [];
      for (var i = 0; i < inst.children.length; i++) {
        collectLayers(inst.children[i], myPath, myIndexPath, i, children);
      }
      if (children.length > 0) item.children = children;
    }
    result.push(item);
    return;
  }

  if (node.type === "RECTANGLE" || node.type === "ELLIPSE") {
    if ("fills" in node) {
      var fills = node.fills as readonly Paint[];
      for (var j = 0; j < fills.length; j++) {
        if (fills[j].type === "IMAGE") {
          result.push({
            id: node.id,
            name: node.name,
            type: "image",
            path: parentPath.concat([node.name]),
            indexPath: myIndexPath,
          });
          return;
        }
      }
    }
    return;
  }

  if (
    node.type === "VECTOR" || node.type === "STAR" ||
    node.type === "POLYGON" || node.type === "LINE" ||
    node.type === "BOOLEAN_OPERATION"
  ) {
    result.push({
      id: node.id,
      name: node.name,
      type: "vector",
      path: parentPath.concat([node.name]),
      indexPath: myIndexPath,
    });
    return;
  }

  if (node.type === "FRAME" || node.type === "GROUP") {
    if ("fills" in node) {
      var frameFills = node.fills as readonly Paint[];
      for (var k = 0; k < frameFills.length; k++) {
        if (frameFills[k].type === "IMAGE") {
          result.push({
            id: node.id,
            name: node.name,
            type: "image",
            path: parentPath.concat([node.name]),
            indexPath: myIndexPath,
          });
          return;
        }
      }
    }
    if ("children" in node) {
      var kids = (node as FrameNode).children;
      for (var c = 0; c < kids.length; c++) {
        collectLayers(kids[c], parentPath, myIndexPath, c, result);
      }
    }
  }
}

function buildComponentLayers(
  node: ComponentNode | InstanceNode
): LayerInfo[] {
  var layers: LayerInfo[] = [];
  if ("children" in node) {
    for (var i = 0; i < node.children.length; i++) {
      collectLayers(node.children[i], [], [], i, layers);
    }
  }
  return layers;
}

// ─── Helpers ────────────────────────────────────────────

function getPage(node: BaseNode): PageNode | null {
  var current: BaseNode | null = node;
  while (current) {
    if (current.type === "PAGE") return current as PageNode;
    current = current.parent;
  }
  return null;
}

function findNodeByIndexPath(root: SceneNode, indexPath: number[]): SceneNode | null {
  var current: SceneNode = root;
  for (var i = 0; i < indexPath.length; i++) {
    if (!("children" in current)) return null;
    var children = (current as any).children as SceneNode[];
    if (indexPath[i] < 0 || indexPath[i] >= children.length) return null;
    current = children[indexPath[i]];
  }
  return current;
}

function findLayerByName(parent: SceneNode, name: string): SceneNode | null {
  if (!("findOne" in parent)) return null;
  return (parent as FrameNode | ComponentNode | InstanceNode).findOne(
    function (n) { return n.name === name; }
  );
}

function findNodeByPath(root: SceneNode, path: string[]): SceneNode | null {
  var current: SceneNode = root;
  for (var i = 0; i < path.length; i++) {
    if (!("children" in current)) return null;
    var children = (current as any).children as SceneNode[];
    var found: SceneNode | null = null;
    for (var j = 0; j < children.length; j++) {
      if (children[j].name === path[i]) { found = children[j]; break; }
    }
    if (!found) return null;
    current = found;
  }
  return current;
}

function findSourceNode(root: SceneNode, indexPath: number[], namePath: string[], label: string): SceneNode | null {
  if (indexPath && indexPath.length > 0) {
    var byIndex = findNodeByIndexPath(root, indexPath);
    if (byIndex) {
      console.log("[SG]   [" + label + "] '" + byIndex.name + "' trouvé par indexPath [" + indexPath.join(",") + "]");
      return byIndex;
    }
  }
  var byPath = findNodeByPath(root, namePath);
  if (byPath) return byPath;
  var name = namePath[namePath.length - 1];
  var byName = findLayerByName(root, name);
  if (byName) {
    console.log("[SG]   [" + label + "] '" + name + "' TROUVÉ par recherche profonde");
  }
  return byName;
}

function findTargetNode(root: SceneNode, namePath: string[], indexPath: number[], label: string): SceneNode | null {
  var byPath = findNodeByPath(root, namePath);
  if (byPath) return byPath;
  var name = namePath[namePath.length - 1];
  var byName = findLayerByName(root, name);
  if (byName) {
    console.log("[SG]   [" + label + "] target '" + name + "' TROUVÉ par recherche profonde");
    return byName;
  }
  if (indexPath && indexPath.length > 0) {
    var byIndex = findNodeByIndexPath(root, indexPath);
    if (byIndex) {
      console.log("[SG]   [" + label + "] target par indexPath [" + indexPath.join(",") + "] → '" + byIndex.name + "'");
    }
    return byIndex;
  }
  return null;
}

// ─── Safe font loading + text write ─────────────────────

async function safeLoadFontsAndWriteText(textNode: TextNode, newText: string, label: string): Promise<boolean> {
  // Strategy 1: Try writing directly (works if font already loaded by Figma)
  try {
    textNode.characters = newText;
    console.log("[SG]   [" + label + "] ✅ TEXT (direct) → '" + textNode.name + "'");
    return true;
  } catch (e1) {
    console.log("[SG]   [" + label + "] Direct write failed, loading fonts...");
  }

  // Strategy 2: Load fonts with timeout wrapper
  var fontName = textNode.fontName;
  if (fontName === figma.mixed) {
    // Mixed fonts — load each unique font
    var loaded: Record<string, boolean> = {};
    for (var i = 0; i < textNode.characters.length; i++) {
      var font = textNode.getRangeFontName(i, i + 1) as FontName;
      var key = font.family + "::" + font.style;
      if (!loaded[key]) {
        var ok = await safeLoadFontAsync(font);
        loaded[key] = true;
        if (!ok) { console.log("[SG]   [" + label + "] ⚠ Timeout loading " + key); }
      }
    }
  } else {
    var ok2 = await safeLoadFontAsync(fontName as FontName);
    if (!ok2) { console.log("[SG]   [" + label + "] ⚠ Timeout loading " + (fontName as FontName).family); }
  }

  // Strategy 2b: Try writing after font load attempt
  try {
    textNode.characters = newText;
    console.log("[SG]   [" + label + "] ✅ TEXT (after font load) → '" + textNode.name + "'");
    return true;
  } catch (e2) {
    console.log("[SG]   [" + label + "] ⚠ TEXT write failed after font load: " + e2);
  }

  // Strategy 3: Try with Inter as fallback font
  try {
    var interFont: FontName = { family: "Inter", style: "Regular" };
    var ok3 = await safeLoadFontAsync(interFont);
    if (ok3) {
      textNode.fontName = interFont;
      textNode.characters = newText;
      console.log("[SG]   [" + label + "] ✅ TEXT (Inter fallback) → '" + textNode.name + "'");
      return true;
    }
  } catch (e3) {
    console.log("[SG]   [" + label + "] ⚠ Inter fallback also failed: " + e3);
  }

  console.log("[SG]   [" + label + "] ❌ TEXT write SKIPPED for '" + textNode.name + "'");
  return false;
}

// ─── Image / Fill helpers ───────────────────────────────

function findDescendantWithImageFill(node: SceneNode): SceneNode | null {
  if (!("children" in node)) return null;
  var children = (node as any).children as SceneNode[];
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if ("fills" in child) {
      var fills = (child as GeometryMixin).fills;
      if (fills !== figma.mixed) {
        var arr = fills as readonly Paint[];
        for (var j = 0; j < arr.length; j++) {
          if (arr[j].type === "IMAGE") return child;
        }
      }
    }
    var deeper = findDescendantWithImageFill(child);
    if (deeper) return deeper;
  }
  return null;
}

function findFirstRectOrEllipse(node: SceneNode): SceneNode | null {
  if (!("children" in node)) return null;
  var children = (node as any).children as SceneNode[];
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.type === "RECTANGLE" || child.type === "ELLIPSE") return child;
    var deeper = findFirstRectOrEllipse(child);
    if (deeper) return deeper;
  }
  return null;
}

function findBestImageTarget(node: SceneNode): SceneNode | null {
  var withImage = findDescendantWithImageFill(node);
  if (withImage) return withImage;
  return findFirstRectOrEllipse(node);
}

function getImageHash(fills: Paint[]): string {
  for (var i = 0; i < fills.length; i++) {
    if ((fills[i] as any).type === "IMAGE") { return (fills[i] as any).imageHash || "AUCUN"; }
  }
  return "n/a";
}

function collectChildFills(node: SceneNode): ChildFillOverride[] {
  var results: ChildFillOverride[] = [];
  function traverse(child: SceneNode) {
    if ("fills" in child) {
      var fills = (child as GeometryMixin).fills;
      if (fills !== figma.mixed) {
        var fillsArr = fills as readonly Paint[];
        if (fillsArr.length > 0) {
          var hasImg = false;
          for (var k = 0; k < fillsArr.length; k++) {
            if (fillsArr[k].type === "IMAGE") { hasImg = true; break; }
          }
          results.push({ name: child.name, nodeType: child.type, fills: JSON.parse(JSON.stringify(fillsArr)), hasImage: hasImg });
        }
      }
    }
    if ("children" in child) {
      var kids = (child as any).children;
      for (var k = 0; k < kids.length; k++) { traverse(kids[k]); }
    }
  }
  if ("children" in node) {
    var children = (node as any).children;
    for (var c = 0; c < children.length; c++) { traverse(children[c]); }
  }
  return results;
}

function applyChildFills(node: SceneNode, overrides: ChildFillOverride[], preserveColors: boolean, label: string): void {
  var imageOverrides: ChildFillOverride[] = [];
  var colorOverrides: ChildFillOverride[] = [];
  for (var i = 0; i < overrides.length; i++) {
    if (overrides[i].hasImage) { imageOverrides.push(overrides[i]); }
    else { colorOverrides.push(overrides[i]); }
  }

  var usedTargetIds: Record<string, boolean> = {};
  for (var i2 = 0; i2 < imageOverrides.length; i2++) {
    var override = imageOverrides[i2];
    var fillsToApply: Paint[];
    if (!preserveColors) {
      fillsToApply = [];
      for (var j = 0; j < override.fills.length; j++) {
        if ((override.fills[j] as any).type === "IMAGE") { fillsToApply.push(override.fills[j]); }
      }
    } else { fillsToApply = override.fills; }
    if (fillsToApply.length === 0) continue;
    var target = findLayerByName(node, override.name);
    if (!target || usedTargetIds[(target as any).id]) { target = findBestImageTarget(node); }
    if (target && "fills" in target) {
      try { (target as GeometryMixin).fills = fillsToApply; usedTargetIds[(target as any).id] = true; } catch (e) { }
    }
  }
  if (preserveColors) {
    for (var i3 = 0; i3 < colorOverrides.length; i3++) {
      var cTarget = findLayerByName(node, colorOverrides[i3].name);
      if (cTarget && "fills" in cTarget) {
        try { (cTarget as GeometryMixin).fills = colorOverrides[i3].fills; } catch (e) { }
      }
    }
  }
}

// ─── Nested component resolution ────────────────────────

// ★ v12: Now ASYNC — uses getMainComponentAsync (required by dynamic-page)
async function resolveNestedComponentInfo(nestedInst: InstanceNode): Promise<{
  key: string | null;
  id: string | null;
  compNode: ComponentNode | null;
}> {
  // ★ Strategy 1: getMainComponentAsync — the CORRECT API for dynamic-page mode
  // Figma explicitly says: "Cannot call mainComponent with documentAccess: dynamic-page.
  // Use node.getMainComponentAsync instead."
  var mcRef = await safeGetMainComponentAsync(nestedInst);
  if (mcRef) {
    var mcKey: string | null = null;
    var mcId: string | null = null;
    try { mcKey = mcRef.key; } catch (e) { console.log("[SG]   getMainComponentAsync.key threw: " + e); }
    try { mcId = mcRef.id; } catch (e) { console.log("[SG]   getMainComponentAsync.id threw: " + e); }
    console.log("[SG]   ✅ getMainComponentAsync resolved: '" + (mcRef.name || "?") + "' key:" + mcKey);
    return { key: mcKey, id: mcId, compNode: mcRef };
  }

  // ★ Strategy 2: Fingerprint-based local search (fallback if async timed out)
  var strictFP = buildStrictFingerprint(nestedInst, 2);
  var relaxedFP = buildRelaxedFingerprint(nestedInst, 2);
  var found = findComponentByFingerprint(strictFP, relaxedFP, nestedInst.name);
  if (found) { return { key: found.key, id: found.id, compNode: found }; }
  return { key: null, id: null, compNode: null };
}

// ─── Clone-based replacement ────────────────────────────

function getChildIndex(node: SceneNode): number {
  var parent = node.parent;
  if (!parent || !("children" in parent)) return -1;
  var children = (parent as any).children as SceneNode[];
  for (var i = 0; i < children.length; i++) {
    if (children[i].id === node.id) return i;
  }
  return -1;
}

function replaceWithClone(
  oldInstance: InstanceNode,
  templateInstance: InstanceNode
): InstanceNode {
  var parent = oldInstance.parent as (FrameNode | GroupNode | PageNode | ComponentNode | SectionNode);
  var idx = getChildIndex(oldInstance);

  var oldX = oldInstance.x;
  var oldY = oldInstance.y;
  var oldWidth = oldInstance.width;
  var oldHeight = oldInstance.height;
  var oldRotation = oldInstance.rotation;
  var oldName = oldInstance.name;
  var oldVisible = oldInstance.visible;
  var oldOpacity = oldInstance.opacity;
  var oldLocked = oldInstance.locked;

  var oldLayoutAlign: string | undefined;
  var oldLayoutGrow: number | undefined;
  var oldLayoutPositioning: string | undefined;
  try { oldLayoutAlign = (oldInstance as any).layoutAlign; } catch (e) { }
  try { oldLayoutGrow = (oldInstance as any).layoutGrow; } catch (e) { }
  try { oldLayoutPositioning = (oldInstance as any).layoutPositioning; } catch (e) { }

  var oldConstraints: any;
  try { oldConstraints = oldInstance.constraints; } catch (e) { }

  var newInst = templateInstance.clone();

  if (idx >= 0 && parent) {
    parent.insertChild(idx, newInst);
  }

  newInst.x = oldX;
  newInst.y = oldY;
  try { newInst.resize(oldWidth, oldHeight); } catch (e) { }
  newInst.rotation = oldRotation;
  newInst.name = oldName;
  newInst.visible = oldVisible;
  newInst.opacity = oldOpacity;
  newInst.locked = oldLocked;

  if (oldLayoutAlign !== undefined) {
    try { (newInst as any).layoutAlign = oldLayoutAlign; } catch (e) { }
  }
  if (oldLayoutGrow !== undefined) {
    try { (newInst as any).layoutGrow = oldLayoutGrow; } catch (e) { }
  }
  if (oldLayoutPositioning !== undefined) {
    try { (newInst as any).layoutPositioning = oldLayoutPositioning; } catch (e) { }
  }
  if (oldConstraints) {
    try { newInst.constraints = oldConstraints; } catch (e) { }
  }

  oldInstance.remove();
  return newInst;
}

// ─── Message handler ────────────────────────────────────

figma.ui.onmessage = async function (msg: Record<string, any>) {

  // ── Sélection du composant source ──
  if (msg.type === "get-selection") {
    try {
      await ensurePagesLoaded();
      var selection = figma.currentPage.selection;
      console.log("[SG] get-selection: " + selection.length + " node(s)");

      if (selection.length === 0) {
        figma.ui.postMessage({ type: "selection-result", component: null,
          error: "Aucun élément sélectionné. Sélectionnez une instance ou un composant dans le canvas." });
        return;
      }

      var selectedNode = selection[0];
      console.log("[SG] Selected: type=" + selectedNode.type + " name='" + selectedNode.name + "'");

      if (selectedNode.type === "COMPONENT") {
        var compNode = selectedNode as ComponentNode;
        var layers = buildComponentLayers(compNode);
        console.log("[SG] ✅ Direct component: '" + compNode.name + "' key=" + compNode.key);
        figma.ui.postMessage({ type: "selection-result",
          component: { id: compNode.id, name: compNode.name, componentKey: compNode.key, layers: layers } as ComponentInfo });
        return;
      }

      if (selectedNode.type === "INSTANCE") {
        var inst = selectedNode as InstanceNode;
        var resolved = resolveComponentFromInstance(inst);
        var layers2 = buildComponentLayers(inst);

        if (resolved.comp) {
          console.log("[SG] ✅ Resolved locally: '" + resolved.comp.name + "' key=" + resolved.comp.key);
          figma.ui.postMessage({ type: "selection-result",
            component: { id: resolved.comp.id, name: resolved.comp.name, componentKey: resolved.comp.key, layers: layers2 } as ComponentInfo });
        } else {
          // Library component → encode STRICT fingerprint (distinguishes versions)
          var pseudoKey = FP_PREFIX + resolved.strictFP;
          console.log("[SG] ✅ Library component (fingerprint mode): '" + inst.name + "'");
          figma.ui.postMessage({ type: "selection-result",
            component: { id: inst.id, name: inst.name, componentKey: pseudoKey, layers: layers2 } as ComponentInfo });
        }
        return;
      }

      figma.ui.postMessage({ type: "selection-result", component: null,
        error: "L'élément sélectionné n'est ni un composant ni une instance de composant." });

    } catch (err: any) {
      console.log("[SG] ❌ ERREUR get-selection:", err);
      figma.ui.postMessage({ type: "selection-result", component: null,
        error: err && err.message ? err.message : "Erreur lors de la lecture du composant." });
    }
  }

  // ── Sélection du composant cible ──
  if (msg.type === "get-new-component") {
    try {
      await ensurePagesLoaded();
      var sel = figma.currentPage.selection;
      console.log("[SG] get-new-component: " + sel.length + " node(s)");

      if (sel.length === 0) {
        figma.ui.postMessage({ type: "new-component-result", component: null,
          error: "Aucun élément sélectionné. Sélectionnez le nouveau composant dans le canvas." });
        return;
      }

      var newNode = sel[0];

      if (newNode.type === "COMPONENT") {
        var newCompNode = newNode as ComponentNode;
        var newLayers = buildComponentLayers(newCompNode);
        console.log("[SG] ✅ Direct new component: '" + newCompNode.name + "' key=" + newCompNode.key);
        figma.ui.postMessage({ type: "new-component-result",
          component: { id: newCompNode.id, name: newCompNode.name, componentKey: newCompNode.key, layers: newLayers } as ComponentInfo });
        return;
      }

      if (newNode.type === "INSTANCE") {
        var newInst = newNode as InstanceNode;
        var newLayers2 = buildComponentLayers(newInst);

        // ★ ALWAYS use template mode for instances.
        // Even if we find a local match, the user selected THIS specific instance
        // as the replacement template. Using clone mode ensures:
        // 1. Library instances stay connected to the library
        // 2. We don't confuse old/new when both resolve to the same local component
        var tplKey = TPL_PREFIX + newInst.id;
        console.log("[SG] ✅ New component (template mode): '" + newInst.name + "' nodeId=" + newInst.id);
        figma.ui.postMessage({ type: "new-component-result",
          component: { id: newInst.id, name: newInst.name, componentKey: tplKey, layers: newLayers2 } as ComponentInfo });
        return;
      }

      figma.ui.postMessage({ type: "new-component-result", component: null,
        error: "L'élément sélectionné n'est ni un composant ni une instance de composant." });

    } catch (err: any) {
      console.log("[SG] ❌ ERREUR get-new-component:", err);
      figma.ui.postMessage({ type: "new-component-result", component: null,
        error: err && err.message ? err.message : "Erreur lors de la lecture du composant." });
    }
  }

  // ── Focus sur un node ──
  if (msg.type === "focus-node" && msg.nodeId) {
    var focusNode = await figma.getNodeByIdAsync(msg.nodeId);
    if (focusNode && focusNode.type !== "DOCUMENT" && focusNode.type !== "PAGE") {
      var sceneNode = focusNode as SceneNode;
      var nodePage = getPage(sceneNode);
      if (nodePage && figma.currentPage !== nodePage) { await figma.setCurrentPageAsync(nodePage); }
      figma.currentPage.selection = [sceneNode];
      figma.viewport.scrollAndZoomIntoView([sceneNode]);
    }
  }

  // ── Lancer la conversion ──
  if (msg.type === "run-conversion") {
    var oldComponentKey: string = msg.oldComponentKey;
    var newComponentKey: string = msg.newComponentKey;
    var preserveColors: boolean = msg.preserveColors !== undefined ? msg.preserveColors : true;
    var mappings: {
      id: string; sourcePath: string[]; sourceIndexPath: number[];
      targetPath: string[]; targetIndexPath: number[]; layerType: string;
    }[] = msg.mappings;
    var scope: string = msg.scope;

    console.log("[SG] === DÉBUT CONVERSION ===");
    console.log("[SG] oldKey:", oldComponentKey.substring(0, 80));
    console.log("[SG] newKey:", newComponentKey.substring(0, 80));
    console.log("[SG] scope:", scope, "preserveColors:", preserveColors);
    console.log("[SG] mappings:", mappings.length);

    var useCloneMode = isTemplateKey(newComponentKey);
    var useFingerprintMatch = isFingerprintKey(oldComponentKey);

    console.log("[SG] Mode: " + (useCloneMode ? "CLONE" : "SWAP") + " | Match: " + (useFingerprintMatch ? "FINGERPRINT" : "KEY"));

    try {
      await ensurePagesLoaded();

      // ── Resolve NEW component or template ──
      var newComp: ComponentNode | null = null;
      var templateInstance: InstanceNode | null = null;

      if (useCloneMode) {
        var tplNodeId = extractTemplateNodeId(newComponentKey);
        var tplNode = await figma.getNodeByIdAsync(tplNodeId);
        if (tplNode && tplNode.type === "INSTANCE") {
          templateInstance = tplNode as InstanceNode;
          console.log("[SG] Template instance found: '" + templateInstance.name + "'");

          // ★ AUTO-UPGRADE: Try to resolve the template's ComponentNode locally.
          // If found and different from OLD → switch to SWAP mode.
          // SWAP mode lets Figma automatically preserve nested component overrides
          // (including library components we can't resolve manually).
          var tplResolved = resolveComponentFromInstance(templateInstance);
          if (tplResolved.comp && tplResolved.comp.key !== oldComponentKey) {
            console.log("[SG] ★ Auto-upgrade CLONE→SWAP: '" + tplResolved.comp.name + "' key=" + tplResolved.comp.key);
            newComp = tplResolved.comp;
            useCloneMode = false;
            templateInstance = null;
          } else if (tplResolved.comp) {
            console.log("[SG] ⚠ Template resolves to same key as OLD — keeping CLONE mode");
          } else {
            console.log("[SG] Template component not found locally — keeping CLONE mode");
          }
        } else {
          figma.ui.postMessage({ type: "conversion-error",
            error: "L'instance template du nouveau composant est introuvable. Re-sélectionnez le nouveau composant." });
          return;
        }
      } else {
        // ★ Search locally FIRST (instant) before trying importByKey
        for (var pi2 = 0; pi2 < figma.root.children.length; pi2++) {
          var lc = figma.root.children[pi2].findAllWithCriteria({ types: ["COMPONENT"] });
          for (var ci2 = 0; ci2 < lc.length; ci2++) {
            if (lc[ci2].key === newComponentKey) { newComp = lc[ci2]; break; }
          }
          if (newComp) break;
        }
        if (!newComp) {
          newComp = await safeImportComponentByKeyAsync(newComponentKey);
        }
        if (!newComp) {
          figma.ui.postMessage({ type: "conversion-error",
            error: "Impossible de retrouver le nouveau composant. Vérifiez qu'il est présent dans le fichier ou publié en librairie." });
          return;
        }
      }

      // ── Resolve OLD component for matching ──
      var oldStrictFP: string | null = null;
      var oldRelaxedFP: string | null = null;
      var oldComp: ComponentNode | null = null;

      if (useFingerprintMatch) {
        // Strict fingerprint was encoded in the key
        oldStrictFP = extractFingerprint(oldComponentKey);
        console.log("[SG] Matching by encoded strict fingerprint");
      } else {
        // Find old component by key → build fingerprints from it
        for (var pi2 = 0; pi2 < figma.root.children.length; pi2++) {
          var lc = figma.root.children[pi2].findAllWithCriteria({ types: ["COMPONENT"] });
          for (var ci2 = 0; ci2 < lc.length; ci2++) {
            if (lc[ci2].key === oldComponentKey) { oldComp = lc[ci2]; break; }
          }
          if (oldComp) break;
        }
        if (!oldComp) {
          oldComp = await safeImportComponentByKeyAsync(oldComponentKey);
        }
        if (oldComp) {
          oldStrictFP = buildStrictFingerprint(oldComp, 2);
          oldRelaxedFP = buildRelaxedFingerprint(oldComp, 2);
          console.log("[SG] Old component resolved: '" + oldComp.name + "'");
        } else {
          console.log("[SG] ⚠ Old component not resolvable — matching by key only");
        }
      }

      // Also build relaxed FP from strict FP for matching overridden instances
      // We can't easily derive relaxed from strict, so we build it when we have the component
      if (!oldRelaxedFP && oldComp) {
        oldRelaxedFP = buildRelaxedFingerprint(oldComp, 2);
      }

      // For fingerprint keys, we also need the relaxed version
      // Build it from the first matching instance we find
      var needRelaxedFromInstance = useFingerprintMatch && !oldRelaxedFP;

      // ── Find all instances of old component ──
      var pagesToSearch = scope === "page" ? [figma.currentPage] : figma.root.children;

      interface InstanceInfo { node: InstanceNode; pageName: string; }
      var instances: InstanceInfo[] = [];

      // Also compute the new template's strict FP for exclusion
      var newStrictFP: string | null = null;
      if (templateInstance) {
        newStrictFP = buildStrictFingerprint(templateInstance, 2);
      }

      for (var p = 0; p < pagesToSearch.length; p++) {
        var page = pagesToSearch[p];
        var found = page.findAllWithCriteria({ types: ["INSTANCE"] });
        for (var f = 0; f < found.length; f++) {
          var testInst = found[f];
          var isMatch = false;

          // Don't include the template instance
          if (templateInstance && testInst.id === templateInstance.id) continue;

          // Strategy 1: sync mainComponent.key (try/catch for Web)
          if (!useFingerprintMatch && oldComponentKey) {
            try {
              if (testInst.mainComponent && testInst.mainComponent.key === oldComponentKey) {
                isMatch = true;
              }
            } catch (e) { /* Expected on Web+dynamic-page */ }
          }

          // Strategy 2: strict fingerprint match
          if (!isMatch && oldStrictFP) {
            var testStrictFP = buildStrictFingerprint(testInst, 2);
            if (testStrictFP === oldStrictFP) {
              isMatch = true;
            }
          }

          // Strategy 3: relaxed fingerprint match (catches overridden instances)
          if (!isMatch && oldRelaxedFP) {
            var testRelaxedFP = buildRelaxedFingerprint(testInst, 2);
            if (testRelaxedFP === oldRelaxedFP) {
              // Check it's not a NEW component instance (by comparing strict FP)
              if (newStrictFP) {
                var tsfp = buildStrictFingerprint(testInst, 2);
                if (tsfp === newStrictFP) {
                  console.log("[SG]   Excluding '" + testInst.name + "' — matches NEW component strict FP");
                  continue;
                }
              }
              isMatch = true;
            }
          }

          // Capture relaxed FP from first match if needed
          if (isMatch && needRelaxedFromInstance) {
            oldRelaxedFP = buildRelaxedFingerprint(testInst, 2);
            needRelaxedFromInstance = false;
          }

          if (isMatch) {
            instances.push({ node: testInst, pageName: page.name });
          }
        }
      }

      var totalInstances = instances.length;
      console.log("[SG] Instances trouvées:", totalInstances);

      if (totalInstances === 0) {
        figma.ui.postMessage({ type: "conversion-complete",
          result: { totalInstances: 0, converted: 0, errors: 0, pages: [], failedInstances: [] } });
        return;
      }

      var converted = 0;
      var failedInstances: { id: string; name: string; pageName: string; reason: string; }[] = [];
      var pageStats: Record<string, number> = {};

      for (var i = 0; i < instances.length; i++) {
        var instance = instances[i].node;
        var pageName = instances[i].pageName;
        var label = "#" + i;

        try {
          console.log("[SG] ── Instance " + label + " '" + instance.name + "' ──");

          // ──────────────────────────────────────────────
          // 1. READ content BEFORE swap
          // ──────────────────────────────────────────────

          // ★ Step 1a: Read ALL component properties (INSTANCE_SWAP, TEXT, BOOLEAN, etc.)
          // This is the primary strategy for preserving nested library components.
          // componentProperties gives us the override values including instance swap IDs.
          var savedComponentProps: Record<string, string | boolean> = {};
          var hasInstanceSwapProps = false;
          try {
            var rawProps = instance.componentProperties;
            for (var propName in rawProps) {
              if (rawProps.hasOwnProperty(propName)) {
                var prop = rawProps[propName];
                savedComponentProps[propName] = prop.value as (string | boolean);
                if (prop.type === "INSTANCE_SWAP") {
                  hasInstanceSwapProps = true;
                  console.log("[SG]   [" + label + "] PROP " + propName + " (INSTANCE_SWAP) = " + prop.value);
                }
              }
            }
            if (hasInstanceSwapProps) {
              console.log("[SG]   [" + label + "] ★ Found " + Object.keys(savedComponentProps).length + " component properties");
            }
          } catch (e) {
            console.log("[SG]   [" + label + "] ⚠ componentProperties not available: " + e);
          }

          // Step 1b: Read per-mapping content
          var savedContent: Record<string, {
            type: string; value: any; compId?: string | null;
            localComp?: ComponentNode | null;
            directFills?: Paint[] | null; childFills?: ChildFillOverride[];
          }> = {};

          for (var m = 0; m < mappings.length; m++) {
            var mapping = mappings[m];
            var sourceNode = findSourceNode(instance, mapping.sourceIndexPath, mapping.sourcePath, label);

            if (!sourceNode) {
              console.log("[SG]   [" + label + "] source [" + mapping.sourcePath.join(" → ") + "]: NON TROUVÉ");
              continue;
            }

            if (sourceNode.type === "TEXT" && mapping.layerType === "text") {
              savedContent[mapping.id] = { type: "text", value: (sourceNode as TextNode).characters };
              console.log("[SG]   [" + label + "] TEXT '" + sourceNode.name + "' = \"" + (sourceNode as TextNode).characters.substring(0, 30) + "\"");
            }
            else if (sourceNode.type === "INSTANCE" && mapping.layerType === "instance") {
              var nestedInst = sourceNode as InstanceNode;
              var nestedInfo = await resolveNestedComponentInfo(nestedInst);

              // ★ Use compNode from mainComponent first, then fallback to local key search
              var localComp: ComponentNode | null = nestedInfo.compNode;
              if (!localComp && nestedInfo.key) {
                // compNode was null but we have a key — search locally
                for (var lpi = 0; lpi < figma.root.children.length && !localComp; lpi++) {
                  var lcs = figma.root.children[lpi].findAllWithCriteria({ types: ["COMPONENT"] });
                  for (var lci = 0; lci < lcs.length; lci++) {
                    if (lcs[lci].key === nestedInfo.key) { localComp = lcs[lci]; break; }
                  }
                }
              }

              var instDirectFills: Paint[] | null = null;
              if ("fills" in nestedInst) {
                var rawIF = (nestedInst as any).fills;
                if (rawIF !== figma.mixed) {
                  var parsedIF = JSON.parse(JSON.stringify(rawIF));
                  if (parsedIF.length > 0) instDirectFills = parsedIF;
                }
              }
              var cFills = collectChildFills(nestedInst);
              var compLabel = localComp ? (localComp.name || "ref") : "null";
              var compSource = nestedInfo.compNode ? "(mainComponent)" : (nestedInfo.key ? "(by key)" : "");
              console.log("[SG]   [" + label + "] INSTANCE '" + sourceNode.name + "' key:" + nestedInfo.key + " comp:" + compLabel + " " + compSource + " | childFills:" + cFills.length);
              savedContent[mapping.id] = {
                type: "instance", value: nestedInfo.key, compId: nestedInfo.id,
                localComp: localComp,
                directFills: instDirectFills, childFills: cFills
              };
            }
            else if (mapping.layerType === "image") {
              var directFills: Paint[] | null = null;
              if ("fills" in sourceNode) {
                var rawF = (sourceNode as GeometryMixin).fills;
                if (rawF !== figma.mixed) directFills = JSON.parse(JSON.stringify(rawF));
              }
              var cFills2 = collectChildFills(sourceNode);
              console.log("[SG]   [" + label + "] IMAGE '" + sourceNode.name + "' | hash: " + (directFills ? getImageHash(directFills) : "null"));
              savedContent[mapping.id] = { type: "fills", value: directFills, childFills: cFills2 };
            }
            else if (mapping.layerType === "instance" && sourceNode.type !== "INSTANCE") {
              console.log("[SG]   [" + label + "] Type mismatch → collecte fills");
              var fbFills: Paint[] | null = null;
              if ("fills" in sourceNode) {
                var fbRaw = (sourceNode as GeometryMixin).fills;
                if (fbRaw !== figma.mixed) fbFills = JSON.parse(JSON.stringify(fbRaw));
              }
              savedContent[mapping.id] = { type: "fills", value: fbFills, childFills: collectChildFills(sourceNode) };
            }
          }

          // ──────────────────────────────────────────────
          // 2. SWAP or CLONE  (★ v12.1: hide during transition to avoid flicker)
          // ──────────────────────────────────────────────
          var targetInstance: InstanceNode;
          var savedVisible = instance.visible;
          try { instance.visible = false; } catch (e) { }

          if (useCloneMode && templateInstance) {
            targetInstance = replaceWithClone(instance, templateInstance);
            try { targetInstance.visible = false; } catch (e) { }
            console.log("[SG]   [" + label + "] CLONE → '" + targetInstance.name + "'");
          } else if (newComp) {
            instance.swapComponent(newComp);
            targetInstance = instance;
            console.log("[SG]   [" + label + "] SWAP → " + newComp.name);
          } else {
            throw new Error("Ni template ni composant disponible pour le remplacement");
          }

          // ──────────────────────────────────────────────
          // 3. RE-APPLY content
          // ──────────────────────────────────────────────

          // ★ Step 3a: Re-apply INSTANCE_SWAP component properties.
          // This uses setProperties() to restore nested library component overrides.
          // We only apply INSTANCE_SWAP properties (not TEXT/BOOLEAN) because
          // text content is handled separately in the per-mapping loop.
          if (hasInstanceSwapProps) {
            try {
              var targetProps = targetInstance.componentProperties;
              var swapPropsToApply: Record<string, string | boolean> = {};
              var swapCount = 0;
              for (var spName in savedComponentProps) {
                if (savedComponentProps.hasOwnProperty(spName)) {
                  // Only apply if the target also has this property as INSTANCE_SWAP
                  if (targetProps[spName] && targetProps[spName].type === "INSTANCE_SWAP") {
                    swapPropsToApply[spName] = savedComponentProps[spName];
                    swapCount++;
                  }
                }
              }
              if (swapCount > 0) {
                targetInstance.setProperties(swapPropsToApply);
                console.log("[SG]   [" + label + "] ✅ Applied " + swapCount + " INSTANCE_SWAP properties via setProperties");
              }
            } catch (e) {
              console.log("[SG]   [" + label + "] ⚠ setProperties failed: " + e);
            }
          }

          // Step 3b: Re-apply per-mapping content
          for (var m2 = 0; m2 < mappings.length; m2++) {
            var map = mappings[m2];
            var content = savedContent[map.id];
            if (!content) continue;

            var targetNode = findTargetNode(targetInstance, map.targetPath, map.targetIndexPath, label);
            if (!targetNode) {
              console.log("[SG]   [" + label + "] Target [" + map.targetPath.join(" → ") + "]: NON TROUVÉ");
              continue;
            }

            if (content.type === "text" && targetNode.type === "TEXT") {
              await safeLoadFontsAndWriteText(targetNode as TextNode, content.value, label);
            }
            else if (content.type === "instance") {
              // ★ Nested component handling — swapComponent only (no insertChild!)
              if (targetNode.type === "INSTANCE") {
                var targetInst = targetNode as InstanceNode;
                if (content.localComp) {
                  // LOCAL component found → swapComponent (instant, no timeout)
                  try {
                    targetInst.swapComponent(content.localComp);
                    console.log("[SG]   [" + label + "] ✅ Nested swap → " + content.localComp.name);
                  } catch (e) {
                    console.log("[SG]   [" + label + "] ⚠ Nested swapComponent failed: " + e);
                  }
                } else {
                  // LIBRARY component — cannot swap without ComponentNode
                  // Best effort: apply fills to preserve colors/images
                  console.log("[SG]   [" + label + "] ⚠ Library nested '" + targetNode.name + "' — applying fills only");
                }
              }
              // Apply fills on the target (whether swapped or not)
              if (content.directFills && content.directFills.length > 0 && "fills" in targetNode) {
                try { (targetNode as GeometryMixin).fills = content.directFills; } catch (e) { }
              }
              if (content.childFills && content.childFills.length > 0) {
                applyChildFills(targetNode, content.childFills, preserveColors, label);
              }
            }
            else if (content.type === "fills") {
              if (content.value && "fills" in targetNode) {
                try { (targetNode as GeometryMixin).fills = content.value; console.log("[SG]   [" + label + "] ✅ Fills → '" + targetNode.name + "'"); } catch (e) { }
              }
              if (content.childFills && content.childFills.length > 0) {
                applyChildFills(targetNode, content.childFills, true, label);
              }
              if (content.value && targetNode.type === "INSTANCE") {
                var hasImgFill = false;
                for (var fi = 0; fi < content.value.length; fi++) {
                  if ((content.value[fi] as any).type === "IMAGE") { hasImgFill = true; break; }
                }
                if (hasImgFill) {
                  var imgTgt = findBestImageTarget(targetNode);
                  if (imgTgt && "fills" in imgTgt) {
                    try { (imgTgt as GeometryMixin).fills = content.value; console.log("[SG]   [" + label + "] ✅ Fallback image → '" + (imgTgt as any).name + "'"); } catch (e) { }
                  }
                }
              }
            }
          }

          // ★ v12.1: Restore visibility
          try { targetInstance.visible = savedVisible; } catch (e) { }

          converted++;
          pageStats[pageName] = (pageStats[pageName] || 0) + 1;
          console.log("[SG]   [" + label + "] ✅ Conversion réussie");
        } catch (err: any) {
          console.log("[SG] ❌ ERREUR sur " + label + ":", err);
          // ★ v12.1: Restore visibility even on error
          try { if (typeof savedVisible !== "undefined") instance.visible = savedVisible; } catch (e) { }
          failedInstances.push({ id: instance.id, name: instance.name, pageName: pageName,
            reason: err && err.message ? err.message : "Erreur inconnue" });
        }

        figma.ui.postMessage({ type: "conversion-progress",
          progress: Math.round(((i + 1) / totalInstances) * 100), current: i + 1, total: totalInstances });
      }

      console.log("[SG] === FIN: " + converted + "/" + totalInstances + " converties ===");
      var pages: { name: string; count: number }[] = [];
      for (var pName in pageStats) {
        if (pageStats.hasOwnProperty(pName)) pages.push({ name: pName, count: pageStats[pName] });
      }
      figma.ui.postMessage({ type: "conversion-complete",
        result: { totalInstances: totalInstances, converted: converted, errors: failedInstances.length, pages: pages, failedInstances: failedInstances } });

    } catch (err: any) {
      console.log("[SG] ❌ ERREUR GLOBALE:", err);
      figma.ui.postMessage({ type: "conversion-error",
        error: err && err.message ? err.message : "Erreur inattendue lors de la conversion." });
    }
  }
};