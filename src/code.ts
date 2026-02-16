figma.showUI(__html__, { width: 400, height: 600 });

// ─── Types ──────────────────────────────────────────────
interface LayerInfo {
  id: string;
  name: string;
  type: "text" | "instance" | "frame" | "image" | "vector";
  preview?: string;
  componentName?: string;
}

interface ComponentInfo {
  id: string;
  name: string;
  layers: LayerInfo[];
}

interface MappingData {
  id: string;
  sourceLayerName: string;
  targetLayerName: string;
  sourceLayerType: string;
}

interface ChildFillOverride {
  name: string;
  nodeType: string;
  fills: Paint[];
  hasImage: boolean;
}

// ─── Helpers ────────────────────────────────────────────

function extractLayers(node: ComponentNode): LayerInfo[] {
  var layers: LayerInfo[] = [];

  function traverse(child: SceneNode) {
    if (child.type === "TEXT") {
      layers.push({
        id: child.id,
        name: child.name,
        type: "text",
        preview: (child as TextNode).characters.substring(0, 50),
      });
      return;
    }

    if (child.type === "INSTANCE") {
      var inst = child as InstanceNode;
      var compName = inst.mainComponent ? inst.mainComponent.name : "Inconnu";
      layers.push({
        id: child.id,
        name: child.name,
        type: "instance",
        componentName: compName,
      });
      return;
    }

    if (child.type === "RECTANGLE" || child.type === "ELLIPSE") {
      if ("fills" in child) {
        var fills = child.fills as readonly Paint[];
        var hasImage = false;
        for (var i = 0; i < fills.length; i++) {
          if (fills[i].type === "IMAGE") {
            hasImage = true;
            break;
          }
        }
        if (hasImage) {
          layers.push({ id: child.id, name: child.name, type: "image" });
          return;
        }
      }
    }

    if (
      child.type === "VECTOR" ||
      child.type === "STAR" ||
      child.type === "POLYGON" ||
      child.type === "LINE"
    ) {
      layers.push({ id: child.id, name: child.name, type: "vector" });
      return;
    }

    if (child.type === "FRAME" || child.type === "GROUP") {
      if ("fills" in child) {
        var frameFills = child.fills as readonly Paint[];
        var frameHasImage = false;
        for (var j = 0; j < frameFills.length; j++) {
          if (frameFills[j].type === "IMAGE") {
            frameHasImage = true;
            break;
          }
        }
        if (frameHasImage) {
          layers.push({ id: child.id, name: child.name, type: "image" });
          return;
        }
      }
      if ("children" in child) {
        var kids = (child as FrameNode).children;
        for (var k = 0; k < kids.length; k++) {
          traverse(kids[k]);
        }
      }
    }
  }

  for (var c = 0; c < node.children.length; c++) {
    traverse(node.children[c]);
  }

  return layers;
}

function getMainComponent(node: SceneNode): ComponentNode | null {
  if (node.type === "COMPONENT") return node;
  if (node.type === "INSTANCE") return (node as InstanceNode).mainComponent;
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

function findLayerByName(parent: SceneNode, name: string): SceneNode | null {
  if (!("findOne" in parent)) return null;
  return (parent as FrameNode | ComponentNode | InstanceNode).findOne(
    function (n) {
      return n.name === name;
    }
  );
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

// ─── Path-based node finding (NOUVEAU) ───────────────────

/**
 * Trouve le chemin (tableau d'indices enfants) vers un node nommé dans un arbre.
 * Ex: si "il_morning_portrait" est le 1er enfant du 2ème enfant de root → [1, 0]
 */
function getPathToNamedNode(root: SceneNode, targetName: string): number[] | null {
  if (root.name === targetName) return [];
  if (!("children" in root)) return null;
  var children = (root as any).children as SceneNode[];
  for (var i = 0; i < children.length; i++) {
    var sub = getPathToNamedNode(children[i], targetName);
    if (sub !== null) {
      return [i].concat(sub);
    }
  }
  return null;
}

/**
 * Suit un chemin d'indices pour retrouver un node dans un arbre.
 * Fonctionne même si les noms ont changé (swap de composant imbriqué).
 */
function getNodeByPath(root: SceneNode, path: number[]): SceneNode | null {
  var current: SceneNode = root;
  for (var i = 0; i < path.length; i++) {
    if (!("children" in current)) return null;
    var children = (current as any).children as SceneNode[];
    if (path[i] >= children.length) return null;
    current = children[path[i]];
  }
  return current;
}

// ─── Image-fill helpers ─────────────────────────────────

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

function readCurrentImageHash(node: SceneNode): string {
  if (!("fills" in node)) return "pas-de-fills";
  var fills = (node as GeometryMixin).fills;
  if (fills === figma.mixed) return "mixed";
  var arr = fills as readonly Paint[];
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].type === "IMAGE") {
      return (arr[i] as any).imageHash || "AUCUN";
    }
  }
  return "pas-d-image";
}

// ─── Collect / Apply child fills ─────────────────────────

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
  instanceLabel: string
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

    var savedHash = getImageHash(fillsToApply);

    // Stratégie 1 : match par nom
    var target = findLayerByName(node, override.name);

    // Stratégie 2 : fallback
    if (!target || usedTargetIds[(target as any).id]) {
      target = findBestImageTarget(node);
    }

    if (target && "fills" in target) {
      try {
        (target as GeometryMixin).fills = fillsToApply;
        usedTargetIds[(target as any).id] = true;
        var hashApres = readCurrentImageHash(target);
        console.log("[CS]     [" + instanceLabel + "] Fill appliqué sur '" + (target as any).name + "' | hash: " + savedHash + " → " + hashApres);
      } catch (e) {
        console.log("[CS]     [" + instanceLabel + "] ❌ Erreur fill:", e);
      }
    } else {
      console.log("[CS]     [" + instanceLabel + "] ❌ Aucun target trouvé pour fill image");
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
    var selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({
        type: "selection-result",
        component: null,
        error:
          "Aucun élément sélectionné. Sélectionnez une instance ou un composant dans le canvas, puis réessayez.",
      });
      return;
    }

    var mainComp = getMainComponent(selection[0]);
    if (!mainComp) {
      figma.ui.postMessage({
        type: "selection-result",
        component: null,
        error:
          "L'élément sélectionné n'est ni un composant ni une instance de composant.",
      });
      return;
    }

    var layers = extractLayers(mainComp);
    figma.ui.postMessage({
      type: "selection-result",
      component: {
        id: mainComp.id,
        name: mainComp.name,
        layers: layers,
      } as ComponentInfo,
    });
  }

  // ── Sélection du composant cible ──
  if (msg.type === "get-new-component") {
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

    var newMain = getMainComponent(sel[0]);
    if (!newMain) {
      figma.ui.postMessage({
        type: "new-component-result",
        component: null,
        error:
          "L'élément sélectionné n'est ni un composant ni une instance de composant.",
      });
      return;
    }

    var newLayers = extractLayers(newMain);
    figma.ui.postMessage({
      type: "new-component-result",
      component: {
        id: newMain.id,
        name: newMain.name,
        layers: newLayers,
      } as ComponentInfo,
    });
  }

  // ── Lancer la conversion ──
  if (msg.type === "run-conversion") {
    var oldComponentId: string = msg.oldComponentId;
    var newComponentId: string = msg.newComponentId;
    var mappings: MappingData[] = msg.mappings;
    var scope: string = msg.scope;
    var preserveColors: boolean =
      msg.preserveColors !== undefined ? msg.preserveColors : true;

    console.log("[CS] === DÉBUT CONVERSION ===");
    console.log("[CS] preserveColors:", preserveColors);

    try {
      var oldComp = (await figma.getNodeByIdAsync(
        oldComponentId
      )) as ComponentNode | null;
      var newComp = (await figma.getNodeByIdAsync(
        newComponentId
      )) as ComponentNode | null;

      if (!oldComp || !newComp) {
        figma.ui.postMessage({
          type: "conversion-error",
          error:
            "Impossible de retrouver un des composants. Il a peut-être été supprimé.",
        });
        return;
      }

      // ── Pré-calculer les chemins pour chaque mapping ──
      // Ça permet de retrouver un node par POSITION si le nom a changé
      var mappingPaths: Record<string, number[] | null> = {};
      for (var mp = 0; mp < mappings.length; mp++) {
        var pathResult = getPathToNamedNode(oldComp, mappings[mp].sourceLayerName);
        mappingPaths[mappings[mp].id] = pathResult;
        console.log("[CS] Chemin pour '" + mappings[mp].sourceLayerName + "':", pathResult ? pathResult.join(" → ") : "NON TROUVÉ dans le composant");
      }

      var pagesToSearch =
        scope === "page" ? [figma.currentPage] : figma.root.children;

      var instances: InstanceNode[] = [];
      for (var p = 0; p < pagesToSearch.length; p++) {
        var page = pagesToSearch[p];
        var found = page.findAllWithCriteria({ types: ["INSTANCE"] });
        for (var f = 0; f < found.length; f++) {
          var inst = found[f];
          if (
            inst.mainComponent &&
            inst.mainComponent.id === oldComponentId
          ) {
            instances.push(inst);
          }
        }
      }

      var totalInstances = instances.length;
      console.log("[CS] Instances trouvées:", totalInstances);

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
        var instance = instances[i];
        var instancePage = getPage(instance);
        var pageName = instancePage ? instancePage.name : "Inconnue";
        var label = "#" + i;

        try {
          // ──────────────────────────────────────────────
          // 1. LIRE le contenu AVANT le swap
          // ──────────────────────────────────────────────
          var savedContent: Record<
            string,
            {
              type: string;
              value: any;
              directFills?: Paint[] | null;
              childFills?: ChildFillOverride[];
            }
          > = {};

          console.log("[CS] ── Instance " + label + " '" + instance.name + "' ──");

          for (var m = 0; m < mappings.length; m++) {
            var mapping = mappings[m];

            // ── TROUVER LE SOURCE NODE ──
            // Stratégie 1: par nom (rapide)
            var sourceNode = findLayerByName(instance, mapping.sourceLayerName);

            // Stratégie 2: par chemin structurel (si le nom a changé, ex: swap de composant imbriqué)
            if (!sourceNode) {
              var savedPath = mappingPaths[mapping.id];
              if (savedPath) {
                sourceNode = getNodeByPath(instance, savedPath);
                if (sourceNode) {
                  console.log("[CS]   [" + label + "] '" + mapping.sourceLayerName + "' pas trouvé par nom, TROUVÉ par chemin → " + sourceNode.type + " '" + sourceNode.name + "'");
                }
              }
            }

            if (!sourceNode) {
              console.log("[CS]   [" + label + "] '" + mapping.sourceLayerName + "': NULL ❌ (ni par nom, ni par chemin)");
              continue;
            }

            // Texte
            if (
              sourceNode.type === "TEXT" &&
              mapping.sourceLayerType === "text"
            ) {
              savedContent[mapping.id] = {
                type: "text",
                value: (sourceNode as TextNode).characters,
              };
            }
            // Instance imbriquée
            else if (
              sourceNode.type === "INSTANCE" &&
              mapping.sourceLayerType === "instance"
            ) {
              var nestedInst = sourceNode as InstanceNode;
              var compId = nestedInst.mainComponent
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
              var cHash = "aucun";
              for (var cf = 0; cf < cFills.length; cf++) {
                if (cFills[cf].hasImage) {
                  cHash = getImageHash(cFills[cf].fills);
                }
              }
              console.log("[CS]   [" + label + "] Instance '" + sourceNode.name + "' comp:" + compId + " | childFills:" + cFills.length + " | imageHash: " + cHash);

              savedContent[mapping.id] = {
                type: "instance",
                value: compId,
                directFills: instDirectFills,
                childFills: cFills,
              };
            }
            // Image directe
            else if (mapping.sourceLayerType === "image") {
              var directFills: Paint[] | null = null;
              if ("fills" in sourceNode) {
                var rawFills = (sourceNode as GeometryMixin).fills;
                if (rawFills !== figma.mixed) {
                  directFills = JSON.parse(JSON.stringify(rawFills));
                }
              }

              var dHash = directFills ? getImageHash(directFills) : "null";
              console.log("[CS]   [" + label + "] Image directe '" + sourceNode.name + "' | imageHash: " + dHash);

              var cFills2 = collectChildFills(sourceNode);

              savedContent[mapping.id] = {
                type: "fills",
                value: directFills,
                childFills: cFills2,
              };
            }
            // Fallback : si le type ne matche pas (ex: le sourceLayerType est "instance"
            // mais le node trouvé par chemin est un RECTANGLE avec une image)
            else if (
              mapping.sourceLayerType === "instance" &&
              sourceNode.type !== "INSTANCE"
            ) {
              console.log("[CS]   [" + label + "] Type mismatch: attendu INSTANCE, trouvé " + sourceNode.type + " — on collecte les fills quand même");
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
          // 2. SWAP
          // ──────────────────────────────────────────────
          instance.swapComponent(newComp);
          console.log("[CS]   [" + label + "] SWAP → " + newComp.name);

          // ──────────────────────────────────────────────
          // 3. RÉ-APPLIQUER
          // ──────────────────────────────────────────────
          for (var m2 = 0; m2 < mappings.length; m2++) {
            var map = mappings[m2];
            var content = savedContent[map.id];
            if (!content) continue;

            // Trouver le target — d'abord par nom, puis par chemin dans le NOUVEAU composant
            var targetNode = findLayerByName(instance, map.targetLayerName);
            if (!targetNode) {
              var targetPath = getPathToNamedNode(newComp, map.targetLayerName);
              if (targetPath) {
                targetNode = getNodeByPath(instance, targetPath);
              }
            }

            if (!targetNode) {
              console.log("[CS]   [" + label + "] Target '" + map.targetLayerName + "': NULL ❌");
              continue;
            }

            // ── Texte ──
            if (content.type === "text" && targetNode.type === "TEXT") {
              await loadFontsForText(targetNode as TextNode);
              (targetNode as TextNode).characters = content.value;
            }

            // ── Instance imbriquée ──
            else if (content.type === "instance") {
              if (
                content.value &&
                targetNode.type === "INSTANCE"
              ) {
                var targetInst = targetNode as InstanceNode;
                var currentCompId = targetInst.mainComponent
                  ? targetInst.mainComponent.id
                  : null;

                if (currentCompId !== content.value) {
                  var comp = (await figma.getNodeByIdAsync(
                    content.value
                  )) as ComponentNode | null;
                  if (comp && comp.type === "COMPONENT") {
                    targetInst.swapComponent(comp);
                    console.log("[CS]   [" + label + "] ✅ Sous-composant swappé vers " + comp.name);
                  }
                }
              }

              if (content.directFills && content.directFills.length > 0 && "fills" in targetNode) {
                try {
                  (targetNode as GeometryMixin).fills = content.directFills;
                } catch (e) {
                  // Ignorer
                }
              }

              if (content.childFills && content.childFills.length > 0) {
                applyChildFills(targetNode, content.childFills, preserveColors, label);
              }
            }

            // ── Image directe (ou fallback depuis instance) ──
            else if (content.type === "fills") {
              if (content.value && "fills" in targetNode) {
                try {
                  (targetNode as GeometryMixin).fills = content.value;
                  console.log("[CS]   [" + label + "] ✅ Fills directs appliqués sur '" + targetNode.name + "'");
                } catch (e) {
                  // Ignorer
                }
              }

              if (content.childFills && content.childFills.length > 0) {
                applyChildFills(targetNode, content.childFills, true, label);
              }

              // Fallback : si target est une INSTANCE, appliquer dans son enfant image
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
                      console.log("[CS]   [" + label + "] ✅ Fallback fill image dans '" + (imgTarget as any).name + "'");
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
          console.log("[CS] ❌ ERREUR sur " + label + ":", err);
          failedInstances.push({
            id: instance.id,
            name: instance.name,
            pageName: pageName,
            reason: err && err.message ? err.message : "Erreur inconnue",
          });
        }

        figma.ui.postMessage({
          type: "conversion-progress",
          progress: Math.round(((i + 1) / totalInstances) * 100),
        });
      }

      console.log("[CS] === FIN: " + converted + "/" + totalInstances + " converties ===");

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
      console.log("[CS] ❌ ERREUR GLOBALE:", err);
      figma.ui.postMessage({
        type: "conversion-error",
        error:
          err && err.message
            ? err.message
            : "Erreur inattendue lors de la conversion.",
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
};