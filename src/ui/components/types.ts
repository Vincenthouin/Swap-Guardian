export type LayerType = "text" | "instance" | "frame" | "image" | "vector";

export interface LayerItem {
  id: string;
  name: string;
  type: LayerType;
  preview?: string;
  componentName?: string;
  path: string[];
  indexPath: number[];              // ← AJOUT : position structurelle dans l'arbre
  children?: LayerItem[];
  parentInstanceName?: string;
  parentComponentName?: string;
}

export interface ComponentInfo {
  id: string;
  name: string;
  componentKey: string;
  layers: LayerItem[];
}

export interface MappingEntry {
  id: string;
  sourceLayer: LayerItem;
  targetLayer: LayerItem | null;
}

export interface ConversionResult {
  totalInstances: number;
  converted: number;
  errors: number;
  pages: { name: string; count: number }[];
  failedInstances: {
    id: string;
    name: string;
    pageName: string;
    reason: string;
  }[];
}

// Messages UI → Plugin
export type UIMessage =
  | { type: "get-selection" }
  | { type: "get-new-component" }
  | { type: "focus-node"; nodeId: string }
  | {
      type: "run-conversion";
      scope: "page" | "document";
      preserveColors: boolean;
      oldComponentKey: string;
      newComponentKey: string;
      mappings: {
        id: string;
        sourcePath: string[];
        sourceIndexPath: number[];   // ← AJOUT
        targetPath: string[];
        targetIndexPath: number[];   // ← AJOUT
        layerType: string;
      }[];
    };

// Messages Plugin → UI
export type PluginMessage =
  | { type: "selection-result"; component: ComponentInfo | null; error?: string }
  | { type: "new-component-result"; component: ComponentInfo | null; error?: string }
  | { type: "conversion-progress"; progress: number; current: number; total: number }
  | { type: "conversion-complete"; result: ConversionResult }
  | { type: "conversion-error"; error: string };