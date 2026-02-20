export type LayerType = "text" | "instance" | "frame" | "image" | "vector";

export interface LayerItem {
  id: string;
  name: string;
  type: LayerType;
  preview?: string;
  componentName?: string;
  path: string[];
  indexPath: number[];
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

// ════════════════════════════════════════════════════════════
//  Property Inference Engine
// ════════════════════════════════════════════════════════════

/**
 * Fingerprint of a variant option for structural matching.
 * Built by the backend from each variant sub-component.
 */
export interface VariantSignature {
  visibleLayerNames: string[];
  visibleLayerTypes: string[];
  childCount: number;
}

/**
 * Property definition returned by the backend for the NEW component.
 */
export interface PropertyDef {
  name: string;           // Figma internal name (e.g. "Show Badge#1234:0")
  displayName: string;    // Human name (e.g. "Show Badge")
  type: "BOOLEAN" | "VARIANT";
  defaultValue: string | boolean;
  /** BOOLEAN only: layer controlled via componentPropertyReferences */
  controlledLayerName?: string;
  /** VARIANT only: available option values */
  variantOptions?: string[];
  /** VARIANT only: per-option fingerprint signatures (for auto-detect) */
  variantSignatures?: Record<string, VariantSignature>;
}

/**
 * Property definition for the OLD component (for carry-over detection).
 */
export interface OldPropertyDef {
  name: string;
  displayName: string;
  type: "BOOLEAN" | "VARIANT";
  defaultValue: string | boolean;
  variantOptions?: string[];
}

// ── Rules (configured by user in Step 2b, sent to backend in run-conversion) ──

/**
 * A property that exists in BOTH old and new components.
 * Per-instance: read old value → remap if needed → set on new.
 * Can be overridden to "fixed" mode.
 */
export interface CarryOverRule {
  newPropertyName: string;
  oldPropertyName: string;
  displayName: string;
  type: "BOOLEAN" | "VARIANT";
  mode: "carry-over" | "fixed";
  /** VARIANT: old value → new value mapping (for renamed values) */
  valueMapping: Record<string, string>;
  /** If mode="fixed", this value is applied to all instances */
  fixedValue?: string | boolean;
  /** True if the match was auto-detected (vs. manually set) */
  autoMatched: boolean;
}

/**
 * A BOOLEAN property that is NEW (not in old component).
 * "per-instance": ON/OFF based on old layer visibility.
 * "fixed": same value for all instances.
 */
export interface BooleanRule {
  propertyName: string;
  displayName: string;
  mode: "per-instance" | "fixed";
  /** per-instance: which old layer's visibility to check */
  sourceLayerId: string | null;
  sourceLayerName: string | null;
  /** fixed value or fallback when no match found (defaults to false) */
  fixedValue: boolean;
  autoDetected: boolean;
}

/**
 * A VARIANT property that is NEW (not in old component).
 * "auto-detect": fingerprint matching per-instance.
 * "fixed": same value for all instances.
 */
export interface VariantRule {
  propertyName: string;
  displayName: string;
  mode: "auto-detect" | "fixed";
  options: string[];
  /** Backend-computed signatures for auto-detect (kept in UI state, re-sent to backend) */
  signatures?: Record<string, VariantSignature>;
  /** Fixed value or default fallback when auto-detect has no good match */
  fixedValue: string;
  autoDetected: boolean;
}

/**
 * All property rules combined.
 */
export interface PropertyRules {
  carryOvers: CarryOverRule[];
  booleans: BooleanRule[];
  variants: VariantRule[];
}

// ════════════════════════════════════════════════════════════
//  Messages
// ════════════════════════════════════════════════════════════

export type UIMessage =
  | { type: "get-selection" }
  | { type: "get-new-component" }
  | {
      type: "get-component-properties";
      oldComponentId: string;
      newComponentId: string;
    }
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
        sourceIndexPath: number[];
        targetPath: string[];
        targetIndexPath: number[];
        layerType: string;
      }[];
      carryOverRules: {
        newPropertyName: string;
        oldPropertyName: string;
        mode: "carry-over" | "fixed";
        valueMapping: Record<string, string>;
        fixedValue?: string | boolean;
      }[];
      booleanRules: {
        propertyName: string;
        mode: "per-instance" | "fixed";
        sourceLayerName: string | null;
        fixedValue: boolean;
      }[];
      variantRules: {
        propertyName: string;
        mode: "auto-detect" | "fixed";
        fixedValue: string;
        signatures?: Record<string, VariantSignature>;
      }[];
    };

export type PluginMessage =
  | { type: "selection-result"; component: ComponentInfo | null; error?: string }
  | { type: "new-component-result"; component: ComponentInfo | null; error?: string }
  | {
      type: "component-properties-result";
      newProperties: PropertyDef[];
      oldProperties: OldPropertyDef[];
    }
  | { type: "conversion-progress"; progress: number; current: number; total: number }
  | { type: "conversion-complete"; result: ConversionResult }
  | { type: "conversion-error"; error: string };
