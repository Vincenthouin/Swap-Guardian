import { useState, useCallback } from "react";
import { Repeat, Globe } from "lucide-react";
import { I18nProvider, useI18n } from "./components/i18n";
import { StepIndicator } from "./components/step-indicator";
import { Step1SelectLayers } from "./components/step1-select-layers";
import { Step2Mapping } from "./components/step2-mapping";
import { Step2bProperties } from "./components/step2b-properties";
import { Step3Conversion } from "./components/step3-conversion";
import { Button } from "./components/ui/button";
import { postToPlugin, usePluginMessage } from "./components/use-figma";
import { flattenLayers, fuzzyMatchValue, buildValueMapping } from "./components/utils";
import type {
  LayerItem, ComponentInfo, MappingEntry, ConversionResult,
  PropertyDef, OldPropertyDef, PropertyRules,
  CarryOverRule, BooleanRule, VariantRule,
} from "./components/types";

// ════════════════════════════════════════════════════════════
//  Auto-detection logic (builds initial PropertyRules from
//  backend data + user's layer mappings)
// ════════════════════════════════════════════════════════════

function buildAutoDetectedRules(
  newProps: PropertyDef[],
  oldProps: OldPropertyDef[],
  mappings: MappingEntry[],
  oldLayers: LayerItem[]
): PropertyRules {
  const flatOld = flattenLayers(oldLayers);

  // Index old properties by displayName (lowercase) for matching
  const oldPropsByName = new Map<string, OldPropertyDef>();
  for (const op of oldProps) {
    oldPropsByName.set(op.displayName.toLowerCase().trim(), op);
    // Also index by cleaned name (remove trailing hash)
    const clean = op.name.replace(/#\d+:\d+$/, "").toLowerCase().trim();
    if (!oldPropsByName.has(clean)) oldPropsByName.set(clean, op);
  }

  const carryOvers: CarryOverRule[] = [];
  const booleans: BooleanRule[] = [];
  const variants: VariantRule[] = [];

  for (const newProp of newProps) {
    const newDisplayLower = newProp.displayName.toLowerCase().trim();
    const newClean = newProp.name.replace(/#\d+:\d+$/, "").toLowerCase().trim();

    // ── Try to find a matching old property (carry-over) ──
    const matchedOld =
      oldPropsByName.get(newDisplayLower) ||
      oldPropsByName.get(newClean) ||
      // Fuzzy: try synonym matching on display names
      oldProps.find((op) => {
        const match = fuzzyMatchValue(
          op.displayName,
          [newProp.displayName]
        );
        return match !== null;
      }) ||
      null;

    if (matchedOld && matchedOld.type === newProp.type) {
      // ══ CARRY-OVER ══
      let valueMapping: Record<string, string> = {};

      if (newProp.type === "VARIANT" && matchedOld.variantOptions && newProp.variantOptions) {
        valueMapping = buildValueMapping(
          matchedOld.variantOptions,
          newProp.variantOptions,
          String(newProp.defaultValue)
        );
      }

      carryOvers.push({
        newPropertyName: newProp.name,
        oldPropertyName: matchedOld.name,
        displayName: newProp.displayName,
        type: newProp.type,
        mode: "carry-over",
        valueMapping,
        fixedValue: newProp.defaultValue,
        autoMatched: true,
      });
      continue;
    }

    // ── Not a carry-over → new property ──

    if (newProp.type === "BOOLEAN") {
      // ══ BOOLEAN TOGGLE ══
      let matchedLayer: LayerItem | null = null;

      // Strategy 1: layer mapping (old→new where target name = controlledLayerName)
      if (newProp.controlledLayerName) {
        const mappingHit = mappings.find(
          (m) => m.targetLayer?.name === newProp.controlledLayerName
        );
        if (mappingHit) matchedLayer = mappingHit.sourceLayer;
      }

      // Strategy 2: fuzzy name match in old layers
      if (!matchedLayer && newProp.controlledLayerName) {
        const ctrlLower = newProp.controlledLayerName.toLowerCase();
        const displayLower = newProp.displayName
          .toLowerCase()
          .replace(/^show\s+/i, "");
        matchedLayer =
          flatOld.find((l) => l.name.toLowerCase() === ctrlLower) ||
          flatOld.find((l) => l.name.toLowerCase().includes(displayLower)) ||
          flatOld.find((l) => displayLower.includes(l.name.toLowerCase())) ||
          null;
      }

      booleans.push({
        propertyName: newProp.name,
        displayName: newProp.displayName,
        mode: matchedLayer ? "per-instance" : "fixed",
        sourceLayerId: matchedLayer?.id ?? null,
        sourceLayerName: matchedLayer?.name ?? null,
        // Point 4: no match → OFF by default
        fixedValue: matchedLayer ? true : false,
        autoDetected: matchedLayer !== null,
      });
    } else if (newProp.type === "VARIANT") {
      // ══ VARIANT ══
      const hasSignatures =
        newProp.variantSignatures &&
        Object.keys(newProp.variantSignatures).length > 0;

      variants.push({
        propertyName: newProp.name,
        displayName: newProp.displayName,
        mode: hasSignatures ? "auto-detect" : "fixed",
        options: newProp.variantOptions || [],
        signatures: newProp.variantSignatures,
        fixedValue: String(newProp.defaultValue),
        autoDetected: false,
      });
    }
  }

  return { carryOvers, booleans, variants };
}

// ════════════════════════════════════════════════════════════
//  Main App
// ════════════════════════════════════════════════════════════

function AppContent() {
  const { t, lang, setLang } = useI18n();

  const steps = [
    { label: t("step1Label"), description: t("step1Desc") },
    { label: t("step2Label"), description: t("step2Desc") },
    { label: t("step2bLabel"), description: t("step2bDesc") },
    { label: t("step3Label"), description: t("step3Desc") },
  ];

  // Navigation
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [selectedComponent, setSelectedComponent] = useState<ComponentInfo | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<LayerItem[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  // Step 2
  const [newComponent, setNewComponent] = useState<ComponentInfo | null>(null);
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [isSelectingNew, setIsSelectingNew] = useState(false);
  const [newComponentError, setNewComponentError] = useState<string | null>(null);

  // Step 2b
  const [propertyRules, setPropertyRules] = useState<PropertyRules>({
    carryOvers: [],
    booleans: [],
    variants: [],
  });
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);

  // Step 3
  const [conversionState, setConversionState] = useState<"idle" | "running" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0 });
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // We keep a ref to mappings & selectedComponent for the message handler
  // to avoid stale closure issues. Using a functional approach instead.
  usePluginMessage(
    useCallback(
      (msg) => {
        switch (msg.type) {
          case "selection-result":
            setIsSelecting(false);
            if (msg.component) {
              setSelectedComponent(msg.component);
              setSelectionError(null);
            } else {
              setSelectionError(msg.error || "Erreur inconnue");
            }
            break;

          case "new-component-result":
            setIsSelectingNew(false);
            if (msg.component) {
              setNewComponent(msg.component);
              setNewComponentError(null);
              setMappings((prev) =>
                prev.map((m) => ({ ...m, targetLayer: null }))
              );
            } else {
              setNewComponentError(msg.error || "Erreur inconnue");
            }
            break;

          case "component-properties-result":
            setIsLoadingProperties(false);
            // Build rules using latest state via functional updates
            // We use a trick: store the received data and compute in a useEffect-like way
            // Instead, we compute immediately using the closure values we DO have
            // This handler is stable (useCallback([], [])), so we use setState updaters
            setSelectedComponent((currentComp) => {
              setMappings((currentMappings) => {
                if (currentComp) {
                  const rules = buildAutoDetectedRules(
                    msg.newProperties,
                    msg.oldProperties,
                    currentMappings,
                    currentComp.layers
                  );
                  setPropertyRules(rules);
                }
                return currentMappings; // don't change mappings
              });
              return currentComp; // don't change selectedComponent
            });
            break;

          case "conversion-progress":
            setProgress(msg.progress);
            setProgressInfo({ current: msg.current, total: msg.total });
            break;

          case "conversion-complete":
            setConversionState("complete");
            setConversionResult(msg.result);
            break;

          case "conversion-error":
            setConversionState("idle");
            setConversionError(msg.error);
            break;
        }
      },
      [] // stable handler — uses setState updaters to read latest values
    )
  );

  const handleRequestSelection = useCallback(() => {
    setIsSelecting(true);
    setSelectionError(null);
    postToPlugin({ type: "get-selection" });
  }, []);

  const handleClearComponent = useCallback(() => {
    setSelectedComponent(null);
    setSelectedLayers([]);
    setSelectionError(null);
  }, []);

  const handleRequestNewComponent = useCallback(() => {
    setIsSelectingNew(true);
    setNewComponentError(null);
    postToPlugin({ type: "get-new-component" });
  }, []);

  const handleClearNewComponent = useCallback(() => {
    setNewComponent(null);
    setNewComponentError(null);
    setMappings((prev) => prev.map((m) => ({ ...m, targetLayer: null })));
  }, []);

  const handleGoToStep2 = useCallback(() => {
    const initialMappings: MappingEntry[] = selectedLayers.map((layer) => ({
      id: `mapping-${layer.id}`,
      sourceLayer: layer,
      targetLayer: null,
    }));
    setMappings(initialMappings);
    setCurrentStep(2);
  }, [selectedLayers]);

  // Step 2 → Step 2b: request properties from backend
  const handleGoToStep2b = useCallback(() => {
    if (selectedComponent && newComponent) {
      setIsLoadingProperties(true);
      postToPlugin({
        type: "get-component-properties",
        oldComponentId: selectedComponent.id,
        newComponentId: newComponent.id,
      });
    }
    setCurrentStep(3); // internal step 3 = UI step "Properties"
  }, [selectedComponent, newComponent]);

  // Step 2b → Step 3 (conversion)
  const handleGoToStep3 = useCallback(() => {
    setConversionState("idle");
    setProgress(0);
    setProgressInfo({ current: 0, total: 0 });
    setConversionResult(null);
    setConversionError(null);
    setCurrentStep(4); // internal step 4 = UI step "Conversion"
  }, []);

  const handleRunConversion = useCallback(
    (scope: "page" | "document", preserveColors: boolean) => {
      if (!selectedComponent || !newComponent) return;
      setConversionState("running");
      setProgress(0);
      setConversionError(null);

      postToPlugin({
        type: "run-conversion",
        scope,
        preserveColors,
        oldComponentKey: selectedComponent.componentKey,
        newComponentKey: newComponent.componentKey,
        mappings: mappings
          .filter((m) => m.targetLayer !== null)
          .map((m) => ({
            id: m.id,
            sourcePath: m.sourceLayer.path,
            sourceIndexPath: m.sourceLayer.indexPath || [],
            targetPath: m.targetLayer!.path,
            targetIndexPath: m.targetLayer!.indexPath || [],
            layerType: m.sourceLayer.type,
          })),
        carryOverRules: propertyRules.carryOvers.map((c) => ({
          newPropertyName: c.newPropertyName,
          oldPropertyName: c.oldPropertyName,
          mode: c.mode,
          valueMapping: c.valueMapping,
          fixedValue: c.fixedValue,
        })),
        booleanRules: propertyRules.booleans.map((b) => ({
          propertyName: b.propertyName,
          mode: b.mode,
          sourceLayerName: b.sourceLayerName,
          fixedValue: b.fixedValue,
        })),
        variantRules: propertyRules.variants.map((v) => ({
          propertyName: v.propertyName,
          mode: v.mode,
          fixedValue: v.fixedValue,
          signatures: v.mode === "auto-detect" ? v.signatures : undefined,
        })),
      });
    },
    [selectedComponent, newComponent, mappings, propertyRules]
  );

  const handleFocusNode = useCallback((nodeId: string) => {
    postToPlugin({ type: "focus-node", nodeId });
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStep(1);
    setSelectedComponent(null);
    setSelectedLayers([]);
    setNewComponent(null);
    setMappings([]);
    setPropertyRules({ carryOvers: [], booleans: [], variants: [] });
    setConversionState("idle");
    setProgress(0);
    setProgressInfo({ current: 0, total: 0 });
    setConversionResult(null);
    setConversionError(null);
    setSelectionError(null);
    setNewComponentError(null);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shrink-0">
          <Repeat className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm text-neutral-900 truncate">{t("pluginTitle")}</h1>
          <p className="text-[10px] text-neutral-500">{t("pluginSubtitle")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setLang(lang === "fr" ? "en" : "fr")}
          title={lang === "fr" ? "Switch to English" : "Passer en français"}
        >
          <Globe className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200 shrink-0">
        <StepIndicator
          currentStep={currentStep}
          steps={steps}
          isComplete={conversionState === "complete"}
        />
      </div>

      {/* Step Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {currentStep === 1 && (
          <Step1SelectLayers
            stepTitle={steps[0].label}
            selectedComponent={selectedComponent}
            selectedLayers={selectedLayers}
            onLayersChange={setSelectedLayers}
            isSelecting={isSelecting}
            selectionError={selectionError}
            onRequestSelection={handleRequestSelection}
            onClearComponent={handleClearComponent}
            onNext={handleGoToStep2}
          />
        )}
        {currentStep === 2 && (
          <Step2Mapping
            stepTitle={steps[1].label}
            selectedLayers={selectedLayers}
            mappings={mappings}
            onMappingsChange={setMappings}
            newComponent={newComponent}
            isSelectingNew={isSelectingNew}
            newComponentError={newComponentError}
            onRequestNewComponent={handleRequestNewComponent}
            onClearNewComponent={handleClearNewComponent}
            onNext={handleGoToStep2b}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <Step2bProperties
            stepTitle={steps[2].label}
            oldLayers={selectedComponent?.layers ?? []}
            propertyRules={propertyRules}
            onPropertyRulesChange={setPropertyRules}
            isLoading={isLoadingProperties}
            onNext={handleGoToStep3}
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && selectedComponent && newComponent && (
          <Step3Conversion
            stepTitle={steps[3].label}
            oldComponent={selectedComponent}
            newComponent={newComponent}
            mappings={mappings}
            propertyRules={propertyRules}
            conversionState={conversionState}
            progress={progress}
            progressInfo={progressInfo}
            result={conversionResult}
            conversionError={conversionError}
            onRunConversion={handleRunConversion}
            onFocusNode={handleFocusNode}
            onBack={() => setCurrentStep(3)}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
