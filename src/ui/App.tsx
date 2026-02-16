import { useState, useCallback } from "react";
import { Repeat, Figma, Globe } from "lucide-react";
import { I18nProvider, useI18n } from "./components/i18n";
import { StepIndicator } from "./components/step-indicator";
import { Step1SelectLayers } from "./components/step1-select-layers";
import { Step2Mapping } from "./components/step2-mapping";
import { Step3Conversion } from "./components/step3-conversion";
import { Button } from "./components/ui/button";
import { postToPlugin, usePluginMessage } from "./components/use-figma";
import type {
  LayerItem, ComponentInfo, MappingEntry, ConversionResult,
} from "./components/types";

function AppContent() {
  const { t, lang, setLang } = useI18n();

  const steps = [
    { label: t("step1Label"), description: t("step1Desc") },
    { label: t("step2Label"), description: t("step2Desc") },
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

  // Step 3
  const [conversionState, setConversionState] = useState<"idle" | "running" | "complete">("idle");
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState({ current: 0, total: 0 });
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // ── Listen for sandbox messages (single handler via typed hook) ──
  usePluginMessage(
    useCallback((msg) => {
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
            setMappings((prev) => prev.map((m) => ({ ...m, targetLayer: null })));
          } else {
            setNewComponentError(msg.error || "Erreur inconnue");
          }
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
    }, [])
  );

  // ── Actions ──
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

  const handleGoToStep3 = useCallback(() => {
    setConversionState("idle");
    setProgress(0);
    setProgressInfo({ current: 0, total: 0 });
    setConversionResult(null);
    setConversionError(null);
    setCurrentStep(3);
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
            sourceIndexPath: m.sourceLayer.indexPath || [],   // ← AJOUT
            targetPath: m.targetLayer!.path,
            targetIndexPath: m.targetLayer!.indexPath || [],  // ← AJOUT
            layerType: m.sourceLayer.type,
          })),
      });
    },
    [selectedComponent, newComponent, mappings]
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
      <div className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center gap-3">
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
        <div className="flex items-center gap-1.5 text-neutral-300">
          <Figma className="w-3.5 h-3.5" />
          <span className="text-[10px]">{t("plugin")}</span>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="px-4 py-3 bg-white border-b border-neutral-200">
        <StepIndicator currentStep={currentStep} steps={steps} />
      </div>

      {/* Step Title */}
      <div className="px-4 pt-4 pb-1">
        <h2 className="text-sm text-neutral-900">{steps[currentStep - 1].label}</h2>
        <p className="text-xs text-neutral-500 mt-0.5">{steps[currentStep - 1].description}</p>
      </div>

      {/* Step Content */}
      <div className="px-4 py-4 flex-1 overflow-y-auto">
        {currentStep === 1 && (
          <Step1SelectLayers
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
            selectedLayers={selectedLayers}
            mappings={mappings}
            onMappingsChange={setMappings}
            newComponent={newComponent}
            isSelectingNew={isSelectingNew}
            newComponentError={newComponentError}
            onRequestNewComponent={handleRequestNewComponent}
            onClearNewComponent={handleClearNewComponent}
            onNext={handleGoToStep3}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && selectedComponent && newComponent && (
          <Step3Conversion
            oldComponent={selectedComponent}
            newComponent={newComponent}
            mappings={mappings}
            conversionState={conversionState}
            progress={progress}
            progressInfo={progressInfo}
            result={conversionResult}
            conversionError={conversionError}
            onRunConversion={handleRunConversion}
            onFocusNode={handleFocusNode}
            onBack={() => setCurrentStep(2)}
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