export type LayerType = "text" | "instance" | "frame" | "image" | "vector";

export interface LayerItem {
  id: string;
  name: string;
  type: LayerType;
  preview?: string;
  componentName?: string;
}

export interface ComponentInfo {
  id: string;
  name: string;
  layers: LayerItem[];
}

export interface MappingEntry {
  id: string;
  sourceLayer: LayerItem;
  targetLayer: LayerItem | null;
}

export interface FailedInstance {
  id: string;
  name: string;
  pageName: string;
  reason: string;
}

export interface ConversionResult {
  totalInstances: number;
  converted: number;
  errors: number;
  pages: { name: string; count: number }[];
  failedInstances: FailedInstance[];
}

// Fonction utilitaire pour envoyer un message au sandbox Figma
export function postToPlugin(message: Record<string, unknown>) {
  parent.postMessage({ pluginMessage: message }, "*");
}