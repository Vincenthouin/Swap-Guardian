"use strict";
(() => {
  // src/code.ts
  figma.showUI(__html__, { width: 400, height: 600 });
  function extractLayers(node) {
    var layers = [];
    function traverse(child) {
      if (child.type === "TEXT") {
        layers.push({
          id: child.id,
          name: child.name,
          type: "text",
          preview: child.characters.substring(0, 50)
        });
        return;
      }
      if (child.type === "INSTANCE") {
        var inst = child;
        var compName = inst.mainComponent ? inst.mainComponent.name : "Inconnu";
        layers.push({
          id: child.id,
          name: child.name,
          type: "instance",
          componentName: compName
        });
        return;
      }
      if (child.type === "RECTANGLE" || child.type === "ELLIPSE") {
        if ("fills" in child) {
          var fills = child.fills;
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
      if (child.type === "VECTOR" || child.type === "STAR" || child.type === "POLYGON" || child.type === "LINE") {
        layers.push({ id: child.id, name: child.name, type: "vector" });
        return;
      }
      if (child.type === "FRAME" || child.type === "GROUP") {
        if ("fills" in child) {
          var frameFills = child.fills;
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
          var kids = child.children;
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
  function findLayerByName(parent, name) {
    if (!("findOne" in parent)) return null;
    return parent.findOne(
      function(n) {
        return n.name === name;
      }
    );
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
  function getPathToNamedNode(root, targetName) {
    if (root.name === targetName) return [];
    if (!("children" in root)) return null;
    var children = root.children;
    for (var i = 0; i < children.length; i++) {
      var sub = getPathToNamedNode(children[i], targetName);
      if (sub !== null) {
        return [i].concat(sub);
      }
    }
    return null;
  }
  function getNodeByPath(root, path) {
    var current = root;
    for (var i = 0; i < path.length; i++) {
      if (!("children" in current)) return null;
      var children = current.children;
      if (path[i] >= children.length) return null;
      current = children[path[i]];
    }
    return current;
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
  function readCurrentImageHash(node) {
    if (!("fills" in node)) return "pas-de-fills";
    var fills = node.fills;
    if (fills === figma.mixed) return "mixed";
    var arr = fills;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].type === "IMAGE") {
        return arr[i].imageHash || "AUCUN";
      }
    }
    return "pas-d-image";
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
  function applyChildFills(node, overrides, preserveColors, instanceLabel) {
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
      var savedHash = getImageHash(fillsToApply);
      var target = findLayerByName(node, override.name);
      if (!target || usedTargetIds[target.id]) {
        target = findBestImageTarget(node);
      }
      if (target && "fills" in target) {
        try {
          target.fills = fillsToApply;
          usedTargetIds[target.id] = true;
          var hashApres = readCurrentImageHash(target);
          console.log("[CS]     [" + instanceLabel + "] Fill appliqu\xE9 sur '" + target.name + "' | hash: " + savedHash + " \u2192 " + hashApres);
        } catch (e) {
          console.log("[CS]     [" + instanceLabel + "] \u274C Erreur fill:", e);
        }
      } else {
        console.log("[CS]     [" + instanceLabel + "] \u274C Aucun target trouv\xE9 pour fill image");
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
          error: "Aucun \xE9l\xE9ment s\xE9lectionn\xE9. S\xE9lectionnez une instance ou un composant dans le canvas, puis r\xE9essayez."
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
      var layers = extractLayers(mainComp);
      figma.ui.postMessage({
        type: "selection-result",
        component: {
          id: mainComp.id,
          name: mainComp.name,
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
      var newLayers = extractLayers(newMain);
      figma.ui.postMessage({
        type: "new-component-result",
        component: {
          id: newMain.id,
          name: newMain.name,
          layers: newLayers
        }
      });
    }
    if (msg.type === "run-conversion") {
      var oldComponentId = msg.oldComponentId;
      var newComponentId = msg.newComponentId;
      var mappings = msg.mappings;
      var scope = msg.scope;
      var preserveColors = msg.preserveColors !== void 0 ? msg.preserveColors : true;
      console.log("[CS] === D\xC9BUT CONVERSION ===");
      console.log("[CS] preserveColors:", preserveColors);
      try {
        var oldComp = await figma.getNodeByIdAsync(
          oldComponentId
        );
        var newComp = await figma.getNodeByIdAsync(
          newComponentId
        );
        if (!oldComp || !newComp) {
          figma.ui.postMessage({
            type: "conversion-error",
            error: "Impossible de retrouver un des composants. Il a peut-\xEAtre \xE9t\xE9 supprim\xE9."
          });
          return;
        }
        var mappingPaths = {};
        for (var mp = 0; mp < mappings.length; mp++) {
          var pathResult = getPathToNamedNode(oldComp, mappings[mp].sourceLayerName);
          mappingPaths[mappings[mp].id] = pathResult;
          console.log("[CS] Chemin pour '" + mappings[mp].sourceLayerName + "':", pathResult ? pathResult.join(" \u2192 ") : "NON TROUV\xC9 dans le composant");
        }
        var pagesToSearch = scope === "page" ? [figma.currentPage] : figma.root.children;
        var instances = [];
        for (var p = 0; p < pagesToSearch.length; p++) {
          var page = pagesToSearch[p];
          var found = page.findAllWithCriteria({ types: ["INSTANCE"] });
          for (var f = 0; f < found.length; f++) {
            var inst = found[f];
            if (inst.mainComponent && inst.mainComponent.id === oldComponentId) {
              instances.push(inst);
            }
          }
        }
        var totalInstances = instances.length;
        console.log("[CS] Instances trouv\xE9es:", totalInstances);
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
          var instance = instances[i];
          var instancePage = getPage(instance);
          var pageName = instancePage ? instancePage.name : "Inconnue";
          var label = "#" + i;
          try {
            var savedContent = {};
            console.log("[CS] \u2500\u2500 Instance " + label + " '" + instance.name + "' \u2500\u2500");
            for (var m = 0; m < mappings.length; m++) {
              var mapping = mappings[m];
              var sourceNode = findLayerByName(instance, mapping.sourceLayerName);
              if (!sourceNode) {
                var savedPath = mappingPaths[mapping.id];
                if (savedPath) {
                  sourceNode = getNodeByPath(instance, savedPath);
                  if (sourceNode) {
                    console.log("[CS]   [" + label + "] '" + mapping.sourceLayerName + "' pas trouv\xE9 par nom, TROUV\xC9 par chemin \u2192 " + sourceNode.type + " '" + sourceNode.name + "'");
                  }
                }
              }
              if (!sourceNode) {
                console.log("[CS]   [" + label + "] '" + mapping.sourceLayerName + "': NULL \u274C (ni par nom, ni par chemin)");
                continue;
              }
              if (sourceNode.type === "TEXT" && mapping.sourceLayerType === "text") {
                savedContent[mapping.id] = {
                  type: "text",
                  value: sourceNode.characters
                };
              } else if (sourceNode.type === "INSTANCE" && mapping.sourceLayerType === "instance") {
                var nestedInst = sourceNode;
                var compId = nestedInst.mainComponent ? nestedInst.mainComponent.id : null;
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
                  childFills: cFills
                };
              } else if (mapping.sourceLayerType === "image") {
                var directFills = null;
                if ("fills" in sourceNode) {
                  var rawFills = sourceNode.fills;
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
                  childFills: cFills2
                };
              } else if (mapping.sourceLayerType === "instance" && sourceNode.type !== "INSTANCE") {
                console.log("[CS]   [" + label + "] Type mismatch: attendu INSTANCE, trouv\xE9 " + sourceNode.type + " \u2014 on collecte les fills quand m\xEAme");
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
            console.log("[CS]   [" + label + "] SWAP \u2192 " + newComp.name);
            for (var m2 = 0; m2 < mappings.length; m2++) {
              var map = mappings[m2];
              var content = savedContent[map.id];
              if (!content) continue;
              var targetNode = findLayerByName(instance, map.targetLayerName);
              if (!targetNode) {
                var targetPath = getPathToNamedNode(newComp, map.targetLayerName);
                if (targetPath) {
                  targetNode = getNodeByPath(instance, targetPath);
                }
              }
              if (!targetNode) {
                console.log("[CS]   [" + label + "] Target '" + map.targetLayerName + "': NULL \u274C");
                continue;
              }
              if (content.type === "text" && targetNode.type === "TEXT") {
                await loadFontsForText(targetNode);
                targetNode.characters = content.value;
              } else if (content.type === "instance") {
                if (content.value && targetNode.type === "INSTANCE") {
                  var targetInst = targetNode;
                  var currentCompId = targetInst.mainComponent ? targetInst.mainComponent.id : null;
                  if (currentCompId !== content.value) {
                    var comp = await figma.getNodeByIdAsync(
                      content.value
                    );
                    if (comp && comp.type === "COMPONENT") {
                      targetInst.swapComponent(comp);
                      console.log("[CS]   [" + label + "] \u2705 Sous-composant swapp\xE9 vers " + comp.name);
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
                  applyChildFills(targetNode, content.childFills, preserveColors, label);
                }
              } else if (content.type === "fills") {
                if (content.value && "fills" in targetNode) {
                  try {
                    targetNode.fills = content.value;
                    console.log("[CS]   [" + label + "] \u2705 Fills directs appliqu\xE9s sur '" + targetNode.name + "'");
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
                        console.log("[CS]   [" + label + "] \u2705 Fallback fill image dans '" + imgTarget.name + "'");
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
            console.log("[CS] \u274C ERREUR sur " + label + ":", err);
            failedInstances.push({
              id: instance.id,
              name: instance.name,
              pageName,
              reason: err && err.message ? err.message : "Erreur inconnue"
            });
          }
          figma.ui.postMessage({
            type: "conversion-progress",
            progress: Math.round((i + 1) / totalInstances * 100)
          });
        }
        console.log("[CS] === FIN: " + converted + "/" + totalInstances + " converties ===");
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
        console.log("[CS] \u274C ERREUR GLOBALE:", err);
        figma.ui.postMessage({
          type: "conversion-error",
          error: err && err.message ? err.message : "Erreur inattendue lors de la conversion."
        });
      }
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
  };
})();
