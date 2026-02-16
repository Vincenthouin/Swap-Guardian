import type { LayerItem } from "./types";

/**
 * Recursively flatten a component's layer tree.
 * Children of instance layers are surfaced with
 * parentInstanceName / parentComponentName metadata.
 */
export function flattenLayers(layers: LayerItem[]): LayerItem[] {
  const result: LayerItem[] = [];

  function walk(items: LayerItem[], parentName?: string, parentComp?: string) {
    for (const layer of items) {
      result.push({
        ...layer,
        ...(parentName ? { parentInstanceName: parentName } : {}),
        ...(parentComp ? { parentComponentName: parentComp } : {}),
      });

      if (layer.children && layer.children.length > 0) {
        walk(layer.children, layer.name, layer.componentName ?? parentComp);
      }
    }
  }

  walk(layers);
  return result;
}