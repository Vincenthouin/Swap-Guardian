"use strict";
(() => {
  // src/code.ts
  figma.showUI(__html__, { width: 400, height: 600 });
  function collectLayers(node, parentPath, parentIndexPath, childIndex, result) {
    var myIndexPath = parentIndexPath.concat([childIndex]);
    if (node.type === "TEXT") {
      result.push({
        id: node.id,
        name: node.name,
        type: "text",
        preview: node.characters.substring(0, 50),
        path: parentPath.concat([node.name]),
        indexPath: myIndexPath
      });
      return;
    }
    if (node.type === "INSTANCE") {
      var inst = node;
      var compName = inst.mainComponent ? inst.mainComponent.name : "Inconnu";
      var myPath = parentPath.concat([node.name]);
      var item = {
        id: node.id,
        name: node.name,
        type: "instance",
        componentName: compName,
        path: myPath,
        indexPath: myIndexPath
      };
      if ("children" in inst && inst.children.length > 0) {
        var children = [];
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
        var fills = node.fills;
        for (var j = 0; j < fills.length; j++) {
          if (fills[j].type === "IMAGE") {
            result.push({
              id: node.id,
              name: node.name,
              type: "image",
              path: parentPath.concat([node.name]),
              indexPath: myIndexPath
            });
            return;
          }
        }
      }
      return;
    }
    if (node.type === "VECTOR" || node.type === "STAR" || node.type === "POLYGON" || node.type === "LINE" || node.type === "BOOLEAN_OPERATION") {
      result.push({
        id: node.id,
        name: node.name,
        type: "vector",
        path: parentPath.concat([node.name]),
        indexPath: myIndexPath
      });
      return;
    }
    if (node.type === "FRAME" || node.type === "GROUP") {
      if ("fills" in node) {
        var frameFills = node.fills;
        for (var k = 0; k < frameFills.length; k++) {
          if (frameFills[k].type === "IMAGE") {
            result.push({
              id: node.id,
              name: node.name,
              type: "image",
              path: parentPath.concat([node.name]),
              indexPath: myIndexPath
            });
            return;
          }
        }
      }
      if ("children" in node) {
        var kids = node.children;
        for (var c = 0; c < kids.length; c++) {
          collectLayers(kids[c], parentPath, myIndexPath, c, result);
        }
      }
    }
  }
  function buildComponentLayers(node) {
    var layers = [];
    if ("children" in node) {
      for (var i = 0; i < node.children.length; i++) {
        collectLayers(node.children[i], [], [], i, layers);
      }
    }
    return layers;
  }
  function getMainComponent(node) {
    if (node.type === "COMPONENT") return node;
    if (node.type === "INSTANCE") return node.mainComponent;
    return null;
  }
  function getPage(node) {
    var current = node;
    while (current) {
      if (current.type === "PAGE") return current;
      current = current.parent;
    }
    return null;
  }
  function findNodeByIndexPath(root, indexPath) {
    var current = root;
    for (var i = 0; i < indexPath.length; i++) {
      if (!("children" in current)) return null;
      var children = current.children;
      if (indexPath[i] < 0 || indexPath[i] >= children.length) return null;
      current = children[indexPath[i]];
    }
    return current;
  }
  function findLayerByName(parent, name) {
    if (!("findOne" in parent)) return null;
    return parent.findOne(
      function(n) {
        return n.name === name;
      }
    );
  }
  function findNodeByPath(root, path) {
    var current = root;
    for (var i = 0; i < path.length; i++) {
      if (!("children" in current)) return null;
      var children = current.children;
      var found = null;
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
  function findSourceNode(root, indexPath, namePath, label) {
    if (indexPath && indexPath.length > 0) {
      var byIndex = findNodeByIndexPath(root, indexPath);
      if (byIndex) {
        console.log(
          "[SG]   [" + label + "] '" + byIndex.name + "' trouv\xE9 par indexPath [" + indexPath.join(",") + "]"
        );
        return byIndex;
      }
    }
    var byPath = findNodeByPath(root, namePath);
    if (byPath) return byPath;
    var name = namePath[namePath.length - 1];
    var byName = findLayerByName(root, name);
    if (byName) {
      console.log(
        "[SG]   [" + label + "] '" + name + "' pas trouv\xE9 par indexPath/path, TROUV\xC9 par recherche profonde"
      );
    }
    return byName;
  }
  function findTargetNode(root, namePath, indexPath, label) {
    var byPath = findNodeByPath(root, namePath);
    if (byPath) return byPath;
    var name = namePath[namePath.length - 1];
    var byName = findLayerByName(root, name);
    if (byName) {
      console.log(
        "[SG]   [" + label + "] target '" + name + "' pas trouv\xE9 par path, TROUV\xC9 par recherche profonde"
      );
      return byName;
    }
    if (indexPath && indexPath.length > 0) {
      var byIndex = findNodeByIndexPath(root, indexPath);
      if (byIndex) {
        console.log(
          "[SG]   [" + label + "] target trouv\xE9 par indexPath [" + indexPath.join(",") + "] \u2192 '" + byIndex.name + "'"
        );
      }
      return byIndex;
    }
    return null;
  }
  async function loadFontsForText(textNode) {
    var fontName = textNode.fontName;
    if (fontName === figma.mixed) {
      var loaded = {};
      for (var i = 0; i < textNode.characters.length; i++) {
        var font = textNode.getRangeFontName(i, i + 1);
        var key = font.family + "::" + font.style;
        if (!loaded[key]) {
          await figma.loadFontAsync(font);
          loaded[key] = true;
        }
      }
    } else {
      await figma.loadFontAsync(fontName);
    }
  }
  function findDescendantWithImageFill(node) {
    if (!("children" in node)) return null;
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if ("fills" in child) {
        var fills = child.fills;
        if (fills !== figma.mixed) {
          var arr = fills;
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
  function findFirstRectOrEllipse(node) {
    if (!("children" in node)) return null;
    var children = node.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.type === "RECTANGLE" || child.type === "ELLIPSE") return child;
      var deeper = findFirstRectOrEllipse(child);
      if (deeper) return deeper;
    }
    return null;
  }
  function findBestImageTarget(node) {
    var withImage = findDescendantWithImageFill(node);
    if (withImage) return withImage;
    return findFirstRectOrEllipse(node);
  }
  function getImageHash(fills) {
    for (var i = 0; i < fills.length; i++) {
      if (fills[i].type === "IMAGE") {
        return fills[i].imageHash || "AUCUN";
      }
    }
    return "n/a";
  }
  function collectChildFills(node) {
    var results = [];
    function traverse(child) {
      if ("fills" in child) {
        var fills = child.fills;
        if (fills !== figma.mixed) {
          var fillsArr = fills;
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
              hasImage: hasImg
            });
          }
        }
      }
      if ("children" in child) {
        var kids = child.children;
        for (var k = 0; k < kids.length; k++) {
          traverse(kids[k]);
        }
      }
    }
    if ("children" in node) {
      var children = node.children;
      for (var c = 0; c < children.length; c++) {
        traverse(children[c]);
      }
    }
    return results;
  }
  function applyChildFills(node, overrides, preserveColors, label) {
    var imageOverrides = [];
    var colorOverrides = [];
    for (var i = 0; i < overrides.length; i++) {
      if (overrides[i].hasImage) {
        imageOverrides.push(overrides[i]);
      } else {
        colorOverrides.push(overrides[i]);
      }
    }
    var usedTargetIds = {};
    for (var i = 0; i < imageOverrides.length; i++) {
      var override = imageOverrides[i];
      var fillsToApply;
      if (!preserveColors) {
        fillsToApply = [];
        for (var j = 0; j < override.fills.length; j++) {
          if (override.fills[j].type === "IMAGE") {
            fillsToApply.push(override.fills[j]);
          }
        }
      } else {
        fillsToApply = override.fills;
      }
      if (fillsToApply.length === 0) continue;
      var target = findLayerByName(node, override.name);
      if (!target || usedTargetIds[target.id]) {
        target = findBestImageTarget(node);
      }
      if (target && "fills" in target) {
        try {
          target.fills = fillsToApply;
          usedTargetIds[target.id] = true;
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
            cTarget.fills = cOverride.fills;
          } catch (e) {
          }
        }
      }
    }
  }
  figma.ui.onmessage = async function(msg) {
    if (msg.type === "get-selection") {
      var selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.ui.postMessage({
          type: "selection-result",
          component: null,
          error: "Aucun \xE9l\xE9ment s\xE9lectionn\xE9. S\xE9lectionnez une instance ou un composant dans le canvas."
        });
        return;
      }
      var mainComp = getMainComponent(selection[0]);
      if (!mainComp) {
        figma.ui.postMessage({
          type: "selection-result",
          component: null,
          error: "L'\xE9l\xE9ment s\xE9lectionn\xE9 n'est ni un composant ni une instance de composant."
        });
        return;
      }
      var layerSource = selection[0].type === "INSTANCE" ? selection[0] : mainComp;
      var layers = buildComponentLayers(layerSource);
      figma.ui.postMessage({
        type: "selection-result",
        component: {
          id: mainComp.id,
          name: mainComp.name,
          componentKey: mainComp.key,
          layers
        }
      });
    }
    if (msg.type === "get-new-component") {
      var sel = figma.currentPage.selection;
      if (sel.length === 0) {
        figma.ui.postMessage({
          type: "new-component-result",
          component: null,
          error: "Aucun \xE9l\xE9ment s\xE9lectionn\xE9. S\xE9lectionnez le nouveau composant dans le canvas."
        });
        return;
      }
      var newMain = getMainComponent(sel[0]);
      if (!newMain) {
        figma.ui.postMessage({
          type: "new-component-result",
          component: null,
          error: "L'\xE9l\xE9ment s\xE9lectionn\xE9 n'est ni un composant ni une instance de composant."
        });
        return;
      }
      var newLayerSource = sel[0].type === "INSTANCE" ? sel[0] : newMain;
      var newLayers = buildComponentLayers(newLayerSource);
      figma.ui.postMessage({
        type: "new-component-result",
        component: {
          id: newMain.id,
          name: newMain.name,
          componentKey: newMain.key,
          layers: newLayers
        }
      });
    }
    if (msg.type === "focus-node" && msg.nodeId) {
      var focusNode = await figma.getNodeByIdAsync(msg.nodeId);
      if (focusNode && focusNode.type !== "DOCUMENT" && focusNode.type !== "PAGE") {
        var sceneNode = focusNode;
        var nodePage = getPage(sceneNode);
        if (nodePage && figma.currentPage !== nodePage) {
          await figma.setCurrentPageAsync(nodePage);
        }
        figma.currentPage.selection = [sceneNode];
        figma.viewport.scrollAndZoomIntoView([sceneNode]);
      }
    }
    if (msg.type === "run-conversion") {
      var oldComponentKey = msg.oldComponentKey;
      var newComponentKey = msg.newComponentKey;
      var preserveColors = msg.preserveColors !== void 0 ? msg.preserveColors : true;
      var mappings = msg.mappings;
      var scope = msg.scope;
      console.log("[SG] === D\xC9BUT CONVERSION ===");
      console.log("[SG] oldKey:", oldComponentKey, "newKey:", newComponentKey);
      console.log("[SG] scope:", scope, "preserveColors:", preserveColors);
      console.log("[SG] mappings:", mappings.length);
      try {
        var newComp = null;
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
            error: "Impossible de retrouver le nouveau composant. V\xE9rifiez qu'il est pr\xE9sent dans le fichier ou publi\xE9 en librairie."
          });
          return;
        }
        var pagesToSearch = scope === "page" ? [figma.currentPage] : figma.root.children;
        var instances = [];
        for (var p = 0; p < pagesToSearch.length; p++) {
          var page = pagesToSearch[p];
          var found = page.findAllWithCriteria({ types: ["INSTANCE"] });
          for (var f = 0; f < found.length; f++) {
            var inst = found[f];
            if (inst.mainComponent && inst.mainComponent.key === oldComponentKey) {
              instances.push({ node: inst, pageName: page.name });
            }
          }
        }
        var totalInstances = instances.length;
        console.log("[SG] Instances trouv\xE9es:", totalInstances);
        if (totalInstances === 0) {
          figma.ui.postMessage({
            type: "conversion-complete",
            result: {
              totalInstances: 0,
              converted: 0,
              errors: 0,
              pages: [],
              failedInstances: []
            }
          });
          return;
        }
        var converted = 0;
        var failedInstances = [];
        var pageStats = {};
        for (var i = 0; i < instances.length; i++) {
          var instance = instances[i].node;
          var pageName = instances[i].pageName;
          var label = "#" + i;
          try {
            console.log(
              "[SG] \u2500\u2500 Instance " + label + " '" + instance.name + "' \u2500\u2500"
            );
            var savedContent = {};
            for (var m = 0; m < mappings.length; m++) {
              var mapping = mappings[m];
              var sourceNode = findSourceNode(
                instance,
                mapping.sourceIndexPath,
                mapping.sourcePath,
                label
              );
              if (!sourceNode) {
                console.log(
                  "[SG]   [" + label + "] source [" + mapping.sourcePath.join(" \u2192 ") + "] indexPath [" + (mapping.sourceIndexPath || []).join(",") + "]: NON TROUV\xC9"
                );
                continue;
              }
              if (sourceNode.type === "TEXT" && mapping.layerType === "text") {
                savedContent[mapping.id] = {
                  type: "text",
                  value: sourceNode.characters
                };
                console.log(
                  "[SG]   [" + label + "] TEXT '" + sourceNode.name + `' = "` + sourceNode.characters.substring(0, 30) + '"'
                );
              } else if (sourceNode.type === "INSTANCE" && mapping.layerType === "instance") {
                var nestedInst = sourceNode;
                var nestedKey = nestedInst.mainComponent ? nestedInst.mainComponent.key : null;
                var nestedId = nestedInst.mainComponent ? nestedInst.mainComponent.id : null;
                var instDirectFills = null;
                if ("fills" in nestedInst) {
                  var rawInstFills = nestedInst.fills;
                  if (rawInstFills !== figma.mixed) {
                    var parsed = JSON.parse(JSON.stringify(rawInstFills));
                    if (parsed.length > 0) {
                      instDirectFills = parsed;
                    }
                  }
                }
                var cFills = collectChildFills(nestedInst);
                console.log(
                  "[SG]   [" + label + "] INSTANCE '" + sourceNode.name + "' key:" + nestedKey + " id:" + nestedId + " | childFills:" + cFills.length
                );
                savedContent[mapping.id] = {
                  type: "instance",
                  value: nestedKey,
                  compId: nestedId,
                  directFills: instDirectFills,
                  childFills: cFills
                };
              } else if (mapping.layerType === "image") {
                var directFills = null;
                if ("fills" in sourceNode) {
                  var rawFills = sourceNode.fills;
                  if (rawFills !== figma.mixed) {
                    directFills = JSON.parse(JSON.stringify(rawFills));
                  }
                }
                var cFills2 = collectChildFills(sourceNode);
                console.log(
                  "[SG]   [" + label + "] IMAGE '" + sourceNode.name + "' | hash: " + (directFills ? getImageHash(directFills) : "null")
                );
                savedContent[mapping.id] = {
                  type: "fills",
                  value: directFills,
                  childFills: cFills2
                };
              } else if (mapping.layerType === "instance" && sourceNode.type !== "INSTANCE") {
                console.log(
                  "[SG]   [" + label + "] Type mismatch: attendu INSTANCE, trouv\xE9 " + sourceNode.type + " \u2014 on collecte les fills"
                );
                var fallbackFills = null;
                if ("fills" in sourceNode) {
                  var fbRaw = sourceNode.fills;
                  if (fbRaw !== figma.mixed) {
                    fallbackFills = JSON.parse(JSON.stringify(fbRaw));
                  }
                }
                savedContent[mapping.id] = {
                  type: "fills",
                  value: fallbackFills,
                  childFills: collectChildFills(sourceNode)
                };
              }
            }
            instance.swapComponent(newComp);
            console.log("[SG]   [" + label + "] SWAP \u2192 " + newComp.name);
            for (var m2 = 0; m2 < mappings.length; m2++) {
              var map = mappings[m2];
              var content = savedContent[map.id];
              if (!content) continue;
              var targetNode = findTargetNode(
                instance,
                map.targetPath,
                map.targetIndexPath,
                label
              );
              if (!targetNode) {
                console.log(
                  "[SG]   [" + label + "] Target [" + map.targetPath.join(" \u2192 ") + "]: NON TROUV\xC9"
                );
                continue;
              }
              if (content.type === "text" && targetNode.type === "TEXT") {
                await loadFontsForText(targetNode);
                targetNode.characters = content.value;
                console.log(
                  "[SG]   [" + label + "] \u2705 TEXT \u2192 '" + targetNode.name + "'"
                );
              } else if (content.type === "instance") {
                if ((content.value || content.compId) && targetNode.type === "INSTANCE") {
                  var targetInst = targetNode;
                  var currentKey = targetInst.mainComponent ? targetInst.mainComponent.key : null;
                  if (currentKey !== content.value) {
                    var nestedComp = null;
                    if (content.value) {
                      try {
                        nestedComp = await figma.importComponentByKeyAsync(content.value);
                      } catch (e) {
                        console.log(
                          "[SG]   [" + label + "] importByKey \xE9chou\xE9 pour nested, fallback ID"
                        );
                      }
                    }
                    if (!nestedComp && content.compId) {
                      var byId = await figma.getNodeByIdAsync(content.compId);
                      if (byId && byId.type === "COMPONENT") {
                        nestedComp = byId;
                      }
                    }
                    if (nestedComp) {
                      targetInst.swapComponent(nestedComp);
                      console.log(
                        "[SG]   [" + label + "] \u2705 Sous-composant swapp\xE9 \u2192 " + nestedComp.name
                      );
                    } else {
                      console.log(
                        "[SG]   [" + label + "] \u26A0\uFE0F Nested component introuvable (key:" + content.value + " id:" + content.compId + ")"
                      );
                    }
                  }
                }
                if (content.directFills && content.directFills.length > 0 && "fills" in targetNode) {
                  try {
                    targetNode.fills = content.directFills;
                  } catch (e) {
                  }
                }
                if (content.childFills && content.childFills.length > 0) {
                  applyChildFills(
                    targetNode,
                    content.childFills,
                    preserveColors,
                    label
                  );
                }
              } else if (content.type === "fills") {
                if (content.value && "fills" in targetNode) {
                  try {
                    targetNode.fills = content.value;
                    console.log(
                      "[SG]   [" + label + "] \u2705 Fills \u2192 '" + targetNode.name + "'"
                    );
                  } catch (e) {
                  }
                }
                if (content.childFills && content.childFills.length > 0) {
                  applyChildFills(targetNode, content.childFills, true, label);
                }
                if (content.value && targetNode.type === "INSTANCE") {
                  var hasImageFill = false;
                  for (var fi = 0; fi < content.value.length; fi++) {
                    if (content.value[fi].type === "IMAGE") {
                      hasImageFill = true;
                      break;
                    }
                  }
                  if (hasImageFill) {
                    var imgTarget = findBestImageTarget(targetNode);
                    if (imgTarget && "fills" in imgTarget) {
                      try {
                        imgTarget.fills = content.value;
                        console.log(
                          "[SG]   [" + label + "] \u2705 Fallback image \u2192 '" + imgTarget.name + "'"
                        );
                      } catch (e) {
                      }
                    }
                  }
                }
              }
            }
            converted++;
            pageStats[pageName] = (pageStats[pageName] || 0) + 1;
          } catch (err) {
            console.log("[SG] \u274C ERREUR sur " + label + ":", err);
            failedInstances.push({
              id: instance.id,
              name: instance.name,
              pageName,
              reason: err && err.message ? err.message : "Erreur inconnue"
            });
          }
          figma.ui.postMessage({
            type: "conversion-progress",
            progress: Math.round((i + 1) / totalInstances * 100),
            current: i + 1,
            total: totalInstances
          });
        }
        console.log(
          "[SG] === FIN: " + converted + "/" + totalInstances + " converties ==="
        );
        var pages = [];
        for (var pName in pageStats) {
          if (pageStats.hasOwnProperty(pName)) {
            pages.push({ name: pName, count: pageStats[pName] });
          }
        }
        figma.ui.postMessage({
          type: "conversion-complete",
          result: {
            totalInstances,
            converted,
            errors: failedInstances.length,
            pages,
            failedInstances
          }
        });
      } catch (err) {
        console.log("[SG] \u274C ERREUR GLOBALE:", err);
        figma.ui.postMessage({
          type: "conversion-error",
          error: err && err.message ? err.message : "Erreur inattendue lors de la conversion."
        });
      }
    }
  };
})();
