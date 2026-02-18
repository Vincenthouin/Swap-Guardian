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

// ─── Layer Tree Builder ─────────────────────────────────
// Frames are TRANSPARENT for name path (don't add their name),
// but ARE tracked in indexPath (structural position).
// Instances add their name to both path AND indexPath.

function collectLayers(
  node: SceneNode,
  parentPath: string[],
  parentIndexPath: number[],
  childIndex: number,
  result: LayerInfo[]
): void {
  var myIndexPath = parentIndexPath.concat([childIndex]);

  // TEXT
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

  // INSTANCE — include AND recurse into children
  if (node.type === "INSTANCE") {
    var inst = node as InstanceNode;
    var compName: string;
    try {
      compName = inst.mainComponent ? inst.mainComponent.name : "Inconnu";
    } catch (e) {
      compName = "Inconnu";
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

  // RECTANGLE / ELLIPSE — only include if has image fill
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

  // VECTOR types
  if (
    node.type === "VECTOR" ||
    node.type === "STAR" ||
    node.type === "POLYGON" ||
    node.type === "LINE" ||
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

  // FRAME / GROUP — transparent for name path, tracked in indexPath
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
    // ★ Frames transparentes pour le name path, mais indexPath les traverse
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

async function getMainComponent(node: SceneNode): Promise<ComponentNode | null> {
  if (node.type === "COMPONENT") return node;
  if (node.type === "INSTANCE") {
    // getMainComponentAsync is reliable for both local and library components
    return await (node as InstanceNode).getMainComponentAsync();
  }
  return null;
}

function getPage(node: BaseNode): PageNode | null {
  var current: BaseNode | null = node;
  while (current) {
    if (current.type === "PAGE") return current as PageNode;
    current = current.parent;
  }
  return null;
}

/**
 * Find a node by its structural index path.
 * MOST RELIABLE: works even when nested components have been overridden (name changed).
 * indexPath = [3] means root.children[3]
 * indexPath = [0, 2] means root.children[0].children[2]
 */
function findNodeByIndexPath(
  root: SceneNode,
  indexPath: number[]
): SceneNode | null {
  var current: SceneNode = root;
  for (var i = 0; i < indexPath.length; i++) {
    if (!("children" in current)) return null;
    var children = (current as any).children as SceneNode[];
    if (indexPath[i] < 0 || indexPath[i] >= children.length) return null;
    current = children[indexPath[i]];
  }
  return current;
}

/**
 * Deep search by name (reliable fallback).
 */
function findLayerByName(
  parent: SceneNode,
  name: string
): SceneNode | null {
  if (!("findOne" in parent)) return null;
  return (parent as FrameNode | ComponentNode | InstanceNode).findOne(
    function (n) {
      return n.name === name;
    }
  );
}

/**
 * Find a node by structural name path.
 */
function findNodeByPath(
  root: SceneNode,
  path: string[]
): SceneNode | null {
  var current: SceneNode = root;
  for (var i = 0; i < path.length; i++) {
    if (!("children" in current)) return null;
    var children = (current as any).children as SceneNode[];
    var found: SceneNode | null = null;
    for (var j = 0; j < children.length; j++) {
      if (children[j].name === path[i]) {
        found = children[j];
        break;
      }
    }
    if (!found) return null;
    current = found;
  }
  return current;
}

/**
 * Smart node finder for SOURCE (before swap):
 * 1. indexPath (most reliable — works with overrides)
 * 2. name path
 * 3. deep name search
 */
function findSourceNode(
  root: SceneNode,
  indexPath: number[],
  namePath: string[],
  label: string
): SceneNode | null {
  // Strategy 1: indexPath (structural position — always correct)
  if (indexPath && indexPath.length > 0) {
    var byIndex = findNodeByIndexPath(root, indexPath);
    if (byIndex) {
      console.log(
        "[SG]   [" + label + "] '" + byIndex.name +
        "' trouvé par indexPath [" + indexPath.join(",") + "]"
      );
      return byIndex;
    }
  }

  // Strategy 2: name path
  var byPath = findNodeByPath(root, namePath);
  if (byPath) return byPath;

  // Strategy 3: deep name search
  var name = namePath[namePath.length - 1];
  var byName = findLayerByName(root, name);
  if (byName) {
    console.log(
      "[SG]   [" + label + "] '" + name +
      "' pas trouvé par indexPath/path, TROUVÉ par recherche profonde"
    );
  }
  return byName;
}

/**
 * Smart node finder for TARGET (after swap):
 * Uses name-based search (no overrides exist on freshly swapped instance).
 * 1. name path
 * 2. deep name search
 * 3. indexPath as last resort
 */
function findTargetNode(
  root: SceneNode,
  namePath: string[],
  indexPath: number[],
  label: string
): SceneNode | null {
  // Strategy 1: name path
  var byPath = findNodeByPath(root, namePath);
  if (byPath) return byPath;

  // Strategy 2: deep name search
  var name = namePath[namePath.length - 1];
  var byName = findLayerByName(root, name);
  if (byName) {
    console.log(
      "[SG]   [" + label + "] target '" + name +
      "' pas trouvé par path, TROUVÉ par recherche profonde"
    );
    return byName;
  }

  // Strategy 3: indexPath fallback
  if (indexPath && indexPath.length > 0) {
    var byIndex = findNodeByIndexPath(root, indexPath);
    if (byIndex) {
      console.log(
        "[SG]   [" + label + "] target trouvé par indexPath [" +
        indexPath.join(",") + "] → '" + byIndex.name + "'"
      );
    }
    return byIndex;
  }

  return null;
}

async function loadFontsForText(textNode: TextNode): Promise<void> {
  var fontName = textNode.fontName;
  if (fontName === figma.mixed) {
    var loaded: Record<string, boolean> = {};
    for (var i = 0; i < textNode.characters.length; i++) {
      var font = textNode.getRangeFontName(i, i + 1) as FontName;
      var key = font.family + "::" + font.style;
      if (!loaded[key]) {
        await figma.loadFontAsync(font);
        loaded[key] = true;
      }
    }
  } else {
    await figma.loadFontAsync(fontName as FontName);
  }
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
    if ((fills[i] as any).type === "IMAGE") {
      return (fills[i] as any).imageHash || "AUCUN";
    }
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
            if (fillsArr[k].type === "IMAGE") {
              hasImg = true;
              break;
            }
          }
          results.push({
            name: child.name,
            nodeType: child.type,
            fills: JSON.parse(JSON.stringify(fillsArr)),
            hasImage: hasImg,
          });
        }
      }
    }
    if ("children" in child) {
      var kids = (child as any).children;
      for (var k = 0; k < kids.length; k++) {
        traverse(kids[k]);
      }
    }
  }

  if ("children" in node) {
    var children = (node as any).children;
    for (var c = 0; c < children.length; c++) {
      traverse(children[c]);
    }
  }
  return results;
}

function applyChildFills(
  node: SceneNode,
  overrides: ChildFillOverride[],
  preserveColors: boolean,
  label: string
): void {
  var imageOverrides: ChildFillOverride[] = [];
  var colorOverrides: ChildFillOverride[] = [];

  for (var i = 0; i < overrides.length; i++) {
    if (overrides[i].hasImage) {
      imageOverrides.push(overrides[i]);
    } else {
      colorOverrides.push(overrides[i]);
    }
  }

  var usedTargetIds: Record<string, boolean> = {};

  for (var i = 0; i < imageOverrides.length; i++) {
    var override = imageOverrides[i];
    var fillsToApply: Paint[];
    if (!preserveColors) {
      fillsToApply = [];
      for (var j = 0; j < override.fills.length; j++) {
        if ((override.fills[j] as any).type === "IMAGE") {
          fillsToApply.push(override.fills[j]);
        }
      }
    } else {
      fillsToApply = override.fills;
    }
    if (fillsToApply.length === 0) continue;

    var target = findLayerByName(node, override.name);
    if (!target || usedTargetIds[(target as any).id]) {
      target = findBestImageTarget(node);
    }
    if (target && "fills" in target) {
      try {
        (target as GeometryMixin).fills = fillsToApply;
        usedTargetIds[(target as any).id] = true;
      } catch (e) {
        console.log("[SG] [" + label + "] Erreur fill:", e);
      }
    }
  }

  if (preserveColors) {
    for (var i = 0; i < colorOverrides.length; i++) {
      var cOverride = colorOverrides[i];
      var cTarget = findLayerByName(node, cOverride.name);
      if (cTarget && "fills" in cTarget) {
        try {
          (cTarget as GeometryMixin).fills = cOverride.fills;
        } catch (e) {
          // Ignorer
        }
      }
    }
  }
}

// ─── Message handler ────────────────────────────────────

figma.ui.onmessage = async function (msg: Record<string, any>) {
  // ── Sélection du composant source ──
  if (msg.type === "get-selection") {
    try {
      var selection = figma.currentPage.selection;

      if (selection.length === 0) {
        figma.ui.postMessage({
          type: "selection-result",
          component: null,
          error:
            "Aucun élément sélectionné. Sélectionnez une instance ou un composant dans le canvas.",
        });
        return;
      }

      var mainComp = await getMainComponent(selection[0]);
      if (!mainComp) {
        figma.ui.postMessage({
          type: "selection-result",
          component: null,
          error:
            "L'élément sélectionné n'est ni un composant ni une instance de composant.",
        });
        return;
      }

      var layerSource =
        selection[0].type === "INSTANCE" ? selection[0] : mainComp;
      var layers = buildComponentLayers(layerSource as any);

      figma.ui.postMessage({
        type: "selection-result",
        component: {
          id: mainComp.id,
          name: mainComp.name,
          componentKey: mainComp.key,
          layers: layers,
        } as ComponentInfo,
      });
    } catch (err: any) {
      console.log("[SG] ❌ ERREUR get-selection:", err);
      figma.ui.postMessage({
        type: "selection-result",
        component: null,
        error: err && err.message ? err.message : "Erreur lors de la lecture du composant.",
      });
    }
  }

  // ── Sélection du composant cible ──
  if (msg.type === "get-new-component") {
    try {
      var sel = figma.currentPage.selection;

      if (sel.length === 0) {
        figma.ui.postMessage({
          type: "new-component-result",
          component: null,
          error:
            "Aucun élément sélectionné. Sélectionnez le nouveau composant dans le canvas.",
        });
        return;
      }

      var newMain = await getMainComponent(sel[0]);
      if (!newMain) {
        figma.ui.postMessage({
          type: "new-component-result",
          component: null,
          error:
            "L'élément sélectionné n'est ni un composant ni une instance de composant.",
        });
        return;
      }

      var newLayerSource =
        sel[0].type === "INSTANCE" ? sel[0] : newMain;
      var newLayers = buildComponentLayers(newLayerSource as any);

      figma.ui.postMessage({
        type: "new-component-result",
        component: {
          id: newMain.id,
          name: newMain.name,
          componentKey: newMain.key,
          layers: newLayers,
        } as ComponentInfo,
      });
    } catch (err: any) {
      console.log("[SG] ❌ ERREUR get-new-component:", err);
      figma.ui.postMessage({
        type: "new-component-result",
        component: null,
        error: err && err.message ? err.message : "Erreur lors de la lecture du composant.",
      });
    }
  }

  // ── Focus sur un node ──
  if (msg.type === "focus-node" && msg.nodeId) {
    var focusNode = await figma.getNodeByIdAsync(msg.nodeId);
    if (
      focusNode &&
      focusNode.type !== "DOCUMENT" &&
      focusNode.type !== "PAGE"
    ) {
      var sceneNode = focusNode as SceneNode;
      var nodePage = getPage(sceneNode);
      if (nodePage && figma.currentPage !== nodePage) {
        await figma.setCurrentPageAsync(nodePage);
      }
      figma.currentPage.selection = [sceneNode];
      figma.viewport.scrollAndZoomIntoView([sceneNode]);
    }
  }

  // ── Lancer la conversion ──
  if (msg.type === "run-conversion") {
    var oldComponentKey: string = msg.oldComponentKey;
    var newComponentKey: string = msg.newComponentKey;
    var preserveColors: boolean =
      msg.preserveColors !== undefined ? msg.preserveColors : true;
    var mappings: {
      id: string;
      sourcePath: string[];
      sourceIndexPath: number[];
      targetPath: string[];
      targetIndexPath: number[];
      layerType: string;
    }[] = msg.mappings;
    var scope: string = msg.scope;

    console.log("[SG] === DÉBUT CONVERSION ===");
    console.log("[SG] oldKey:", oldComponentKey, "newKey:", newComponentKey);
    console.log("[SG] scope:", scope, "preserveColors:", preserveColors);
    console.log("[SG] mappings:", mappings.length);

    try {
      // ── Resolve new component: try import by key, fallback to local search ──
      var newComp: ComponentNode | null = null;

      try {
        newComp = await figma.importComponentByKeyAsync(newComponentKey);
        console.log("[SG] New component imported by key:", newComp.name);
      } catch (importErr) {
        console.log("[SG] importByKey failed, searching locally...");
        for (var pi = 0; pi < figma.root.children.length; pi++) {
          var searchPage = figma.root.children[pi];
          var comps = searchPage.findAllWithCriteria({ types: ["COMPONENT"] });
          for (var ci = 0; ci < comps.length; ci++) {
            if (comps[ci].key === newComponentKey) {
              newComp = comps[ci];
              break;
            }
          }
          if (newComp) break;
        }
      }

      if (!newComp) {
        figma.ui.postMessage({
          type: "conversion-error",
          error:
            "Impossible de retrouver le nouveau composant. Vérifiez qu'il est présent dans le fichier ou publié en librairie.",
        });
        return;
      }

      // ── Find all instances of old component by KEY ──
      var pagesToSearch =
        scope === "page"
          ? [figma.currentPage]
          : figma.root.children;

      interface InstanceInfo {
        node: InstanceNode;
        pageName: string;
      }

      var instances: InstanceInfo[] = [];
      for (var p = 0; p < pagesToSearch.length; p++) {
        var page = pagesToSearch[p];
        var found = page.findAllWithCriteria({ types: ["INSTANCE"] });
        for (var f = 0; f < found.length; f++) {
          var inst = found[f];
          if (
            inst.mainComponent &&
            inst.mainComponent.key === oldComponentKey
          ) {
            instances.push({ node: inst, pageName: page.name });
          }
        }
      }

      var totalInstances = instances.length;
      console.log("[SG] Instances trouvées:", totalInstances);

      if (totalInstances === 0) {
        figma.ui.postMessage({
          type: "conversion-complete",
          result: {
            totalInstances: 0,
            converted: 0,
            errors: 0,
            pages: [],
            failedInstances: [],
          },
        });
        return;
      }

      var converted = 0;
      var failedInstances: {
        id: string;
        name: string;
        pageName: string;
        reason: string;
      }[] = [];
      var pageStats: Record<string, number> = {};

      for (var i = 0; i < instances.length; i++) {
        var instance = instances[i].node;
        var pageName = instances[i].pageName;
        var label = "#" + i;

        try {
          console.log(
            "[SG] ── Instance " + label + " '" + instance.name + "' ──"
          );

          // ──────────────────────────────────────────────
          // 1. READ content BEFORE swap
          // ──────────────────────────────────────────────
          var savedContent: Record<
            string,
            {
              type: string;
              value: any;
              compId?: string | null;
              directFills?: Paint[] | null;
              childFills?: ChildFillOverride[];
            }
          > = {};

          for (var m = 0; m < mappings.length; m++) {
            var mapping = mappings[m];

            // ★ Find source node: indexPath FIRST, then name fallback
            var sourceNode = findSourceNode(
              instance,
              mapping.sourceIndexPath,
              mapping.sourcePath,
              label
            );

            if (!sourceNode) {
              console.log(
                "[SG]   [" + label + "] source [" +
                mapping.sourcePath.join(" → ") + "] indexPath [" +
                (mapping.sourceIndexPath || []).join(",") +
                "]: NON TROUVÉ"
              );
              continue;
            }

            // ── Text ──
            if (
              sourceNode.type === "TEXT" &&
              mapping.layerType === "text"
            ) {
              savedContent[mapping.id] = {
                type: "text",
                value: (sourceNode as TextNode).characters,
              };
              console.log(
                "[SG]   [" + label + "] TEXT '" + sourceNode.name +
                "' = \"" +
                (sourceNode as TextNode).characters.substring(0, 30) +
                "\""
              );
            }
            // ── Instance (nested component) ──
            else if (
              sourceNode.type === "INSTANCE" &&
              mapping.layerType === "instance"
            ) {
              var nestedInst = sourceNode as InstanceNode;
              // ★ Save BOTH key AND id for maximum compatibility
              var nestedKey = nestedInst.mainComponent
                ? nestedInst.mainComponent.key
                : null;
              var nestedId = nestedInst.mainComponent
                ? nestedInst.mainComponent.id
                : null;

              var instDirectFills: Paint[] | null = null;
              if ("fills" in nestedInst) {
                var rawInstFills = (nestedInst as any).fills;
                if (rawInstFills !== figma.mixed) {
                  var parsed = JSON.parse(JSON.stringify(rawInstFills));
                  if (parsed.length > 0) {
                    instDirectFills = parsed;
                  }
                }
              }

              var cFills = collectChildFills(nestedInst);
              console.log(
                "[SG]   [" + label + "] INSTANCE '" + sourceNode.name +
                "' key:" + nestedKey + " id:" + nestedId +
                " | childFills:" + cFills.length
              );

              savedContent[mapping.id] = {
                type: "instance",
                value: nestedKey,
                compId: nestedId,
                directFills: instDirectFills,
                childFills: cFills,
              };
            }
            // ── Image ──
            else if (mapping.layerType === "image") {
              var directFills: Paint[] | null = null;
              if ("fills" in sourceNode) {
                var rawFills = (sourceNode as GeometryMixin).fills;
                if (rawFills !== figma.mixed) {
                  directFills = JSON.parse(JSON.stringify(rawFills));
                }
              }
              var cFills2 = collectChildFills(sourceNode);

              console.log(
                "[SG]   [" + label + "] IMAGE '" + sourceNode.name +
                "' | hash: " +
                (directFills ? getImageHash(directFills) : "null")
              );

              savedContent[mapping.id] = {
                type: "fills",
                value: directFills,
                childFills: cFills2,
              };
            }
            // ── Fallback: type mismatch — collect fills anyway ──
            else if (
              mapping.layerType === "instance" &&
              sourceNode.type !== "INSTANCE"
            ) {
              console.log(
                "[SG]   [" + label +
                "] Type mismatch: attendu INSTANCE, trouvé " +
                sourceNode.type + " — on collecte les fills"
              );
              var fallbackFills: Paint[] | null = null;
              if ("fills" in sourceNode) {
                var fbRaw = (sourceNode as GeometryMixin).fills;
                if (fbRaw !== figma.mixed) {
                  fallbackFills = JSON.parse(JSON.stringify(fbRaw));
                }
              }
              savedContent[mapping.id] = {
                type: "fills",
                value: fallbackFills,
                childFills: collectChildFills(sourceNode),
              };
            }
          }

          // ──────────────────────────────────────────────
          // 2. SWAP component
          // ──────────────────────────────────────────────
          instance.swapComponent(newComp);
          console.log("[SG]   [" + label + "] SWAP → " + newComp.name);

          // ──────────────────────────────────────────────
          // 3. RE-APPLY content (using target paths/indexPaths)
          // ──────────────────────────────────────────────
          for (var m2 = 0; m2 < mappings.length; m2++) {
            var map = mappings[m2];
            var content = savedContent[map.id];
            if (!content) continue;

            // ★ Find target node: name-based first (reliable after fresh swap),
            //   indexPath as fallback
            var targetNode = findTargetNode(
              instance,
              map.targetPath,
              map.targetIndexPath,
              label
            );

            if (!targetNode) {
              console.log(
                "[SG]   [" + label + "] Target [" +
                map.targetPath.join(" → ") + "]: NON TROUVÉ"
              );
              continue;
            }

            // ── Text ──
            if (content.type === "text" && targetNode.type === "TEXT") {
              await loadFontsForText(targetNode as TextNode);
              (targetNode as TextNode).characters = content.value;
              console.log(
                "[SG]   [" + label + "] ✅ TEXT → '" + targetNode.name + "'"
              );
            }

            // ── Instance (nested component) ──
            else if (content.type === "instance") {
              if (
                (content.value || content.compId) &&
                targetNode.type === "INSTANCE"
              ) {
                var targetInst = targetNode as InstanceNode;
                var currentKey = targetInst.mainComponent
                  ? targetInst.mainComponent.key
                  : null;

                // Only swap if the component is different
                if (currentKey !== content.value) {
                  var nestedComp: ComponentNode | null = null;

                  // ★ Strategy 1: import by KEY (works for published/library)
                  if (content.value) {
                    try {
                      nestedComp =
                        await figma.importComponentByKeyAsync(content.value);
                    } catch (e) {
                      console.log(
                        "[SG]   [" + label +
                        "] importByKey échoué pour nested, fallback ID"
                      );
                    }
                  }

                  // ★ Strategy 2: get by ID (works for local components)
                  if (!nestedComp && content.compId) {
                    var byId = await figma.getNodeByIdAsync(content.compId);
                    if (byId && byId.type === "COMPONENT") {
                      nestedComp = byId as ComponentNode;
                    }
                  }

                  if (nestedComp) {
                    targetInst.swapComponent(nestedComp);
                    console.log(
                      "[SG]   [" + label +
                      "] ✅ Sous-composant swappé → " + nestedComp.name
                    );
                  } else {
                    console.log(
                      "[SG]   [" + label +
                      "] ⚠️ Nested component introuvable (key:" +
                      content.value + " id:" + content.compId + ")"
                    );
                  }
                }
              }

              // Apply direct fills
              if (
                content.directFills &&
                content.directFills.length > 0 &&
                "fills" in targetNode
              ) {
                try {
                  (targetNode as GeometryMixin).fills = content.directFills;
                } catch (e) {
                  // Ignorer
                }
              }

              // Apply child fills (images + optionally colors)
              if (content.childFills && content.childFills.length > 0) {
                applyChildFills(
                  targetNode,
                  content.childFills,
                  preserveColors,
                  label
                );
              }
            }

            // ── Image / Fills ──
            else if (content.type === "fills") {
              if (content.value && "fills" in targetNode) {
                try {
                  (targetNode as GeometryMixin).fills = content.value;
                  console.log(
                    "[SG]   [" + label + "] ✅ Fills → '" +
                    targetNode.name + "'"
                  );
                } catch (e) {
                  // Ignorer
                }
              }

              if (content.childFills && content.childFills.length > 0) {
                applyChildFills(targetNode, content.childFills, true, label);
              }

              // Fallback: if target is INSTANCE, apply image to child
              if (content.value && targetNode.type === "INSTANCE") {
                var hasImageFill = false;
                for (var fi = 0; fi < content.value.length; fi++) {
                  if ((content.value[fi] as any).type === "IMAGE") {
                    hasImageFill = true;
                    break;
                  }
                }
                if (hasImageFill) {
                  var imgTarget = findBestImageTarget(targetNode);
                  if (imgTarget && "fills" in imgTarget) {
                    try {
                      (imgTarget as GeometryMixin).fills = content.value;
                      console.log(
                        "[SG]   [" + label +
                        "] ✅ Fallback image → '" +
                        (imgTarget as any).name + "'"
                      );
                    } catch (e) {
                      // Ignorer
                    }
                  }
                }
              }
            }
          }

          converted++;
          pageStats[pageName] = (pageStats[pageName] || 0) + 1;
        } catch (err: any) {
          console.log("[SG] ❌ ERREUR sur " + label + ":", err);
          failedInstances.push({
            id: instance.id,
            name: instance.name,
            pageName: pageName,
            reason: err && err.message ? err.message : "Erreur inconnue",
          });
        }

        // Send progress
        figma.ui.postMessage({
          type: "conversion-progress",
          progress: Math.round(((i + 1) / totalInstances) * 100),
          current: i + 1,
          total: totalInstances,
        });
      }

      console.log(
        "[SG] === FIN: " + converted + "/" + totalInstances +
        " converties ==="
      );

      var pages: { name: string; count: number }[] = [];
      for (var pName in pageStats) {
        if (pageStats.hasOwnProperty(pName)) {
          pages.push({ name: pName, count: pageStats[pName] });
        }
      }

      figma.ui.postMessage({
        type: "conversion-complete",
        result: {
          totalInstances: totalInstances,
          converted: converted,
          errors: failedInstances.length,
          pages: pages,
          failedInstances: failedInstances,
        },
      });
    } catch (err: any) {
      console.log("[SG] ❌ ERREUR GLOBALE:", err);
      figma.ui.postMessage({
        type: "conversion-error",
        error:
          err && err.message
            ? err.message
            : "Erreur inattendue lors de la conversion.",
      });
    }
  }
};