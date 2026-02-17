import { useState, useCallback, useMemo, Fragment } from "react";
import {
  Plus, Trash2, MousePointerClick, AlertCircle,
  Component, RefreshCw, ChevronRight, X, Layers,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LayerIcon } from "./layer-icon";
import { useI18n } from "./i18n";
import { flattenLayers } from "./utils";
import type { LayerItem, ComponentInfo } from "./types";

interface Step1Props {
  stepTitle: string;
  selectedComponent: ComponentInfo | null;
  selectedLayers: LayerItem[];
  onLayersChange: (layers: LayerItem[]) => void;
  isSelecting: boolean;
  selectionError: string | null;
  onRequestSelection: () => void;
  onClearComponent: () => void;
  onNext: () => void;
}

export function Step1SelectLayers({
  stepTitle,
  selectedComponent, selectedLayers, onLayersChange,
  isSelecting, selectionError, onRequestSelection, onClearComponent, onNext,
}: Step1Props) {
  const { t } = useI18n();
  const [editingLayerIndex, setEditingLayerIndex] = useState<number | null>(null);
  const [showLayerPicker, setShowLayerPicker] = useState(false);

  const flatLayers = useMemo(
    () => (selectedComponent ? flattenLayers(selectedComponent.layers) : []),
    [selectedComponent]
  );

  const handleAddLayer = useCallback(() => {
    setEditingLayerIndex(null);
    setShowLayerPicker(true);
  }, []);

  const handleEditLayer = useCallback((index: number) => {
    setEditingLayerIndex(index);
    setShowLayerPicker(true);
  }, []);

  const handlePickLayer = useCallback(
    (layer: LayerItem) => {
      if (!selectedComponent) return;
      const existingIndex = selectedLayers.findIndex((l) => l.id === layer.id);
      if (existingIndex !== -1 && editingLayerIndex !== existingIndex) return;

      if (editingLayerIndex !== null) {
        const newLayers = [...selectedLayers];
        newLayers[editingLayerIndex] = layer;
        onLayersChange(newLayers);
      } else {
        onLayersChange([...selectedLayers, layer]);
      }
      setEditingLayerIndex(null);
      setShowLayerPicker(false);
    },
    [selectedComponent, selectedLayers, editingLayerIndex, onLayersChange]
  );

  const handleRemoveLayer = useCallback(
    (index: number) => onLayersChange(selectedLayers.filter((_, i) => i !== index)),
    [selectedLayers, onLayersChange]
  );

  const handleCancelPicker = useCallback(() => {
    setShowLayerPicker(false);
    setEditingLayerIndex(null);
  }, []);

  // Reusable picker component
  const renderPicker = () => (
    <div className="border border-blue-200 rounded-lg bg-blue-50/50 overflow-hidden">
      <div className="px-3 py-2 bg-blue-100/60 border-b border-blue-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs text-blue-800">
            {editingLayerIndex !== null ? t("selectNewLayer") : t("chooseLayer")}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCancelPicker}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="p-2 flex flex-col gap-0.5">
        {flatLayers.length === 0 && (
          <p className="text-xs text-neutral-400 p-2 text-center">{t("noLayersInComp")}</p>
        )}
        {flatLayers.map((layer) => {
          const isAlreadySelected = selectedLayers.some((l) => l.id === layer.id);
          const isCurrentEditTarget =
            editingLayerIndex !== null &&
            selectedLayers[editingLayerIndex]?.id === layer.id;
          const isUsedByOther = isAlreadySelected && !isCurrentEditTarget;
          const isNested = !!layer.parentInstanceName;
          return (
            <button
              key={layer.id}
              onClick={() => handlePickLayer(layer)}
              disabled={isUsedByOther}
              className={`flex items-center gap-2.5 p-2 rounded-md text-left transition-colors ${
                isNested ? "pl-7" : ""
              } ${
                isUsedByOther
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-blue-100 cursor-pointer"
              }`}
            >
              <LayerIcon type={layer.type} />
              <span className="text-sm text-neutral-900 flex-1 truncate">{layer.name}</span>
              {layer.parentComponentName && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 shrink-0 bg-violet-50 text-violet-600 border-violet-200"
                >
                  {t("inComponent")} {layer.parentComponentName}
                </Badge>
              )}
              <span className="text-[10px] text-neutral-400">{layer.type}</span>
              {isUsedByOther && (
                <span className="text-[10px] text-blue-500">{t("added")}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4">
        <h2 className="text-sm text-neutral-900 pt-4 pb-3">{stepTitle}</h2>

        <div className="flex flex-col gap-5 pb-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5">
            <div className="flex gap-2.5">
              <MousePointerClick className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">{t("step1Instruction")}</p>
            </div>
          </div>

          {/* Component Selection */}
          <div>
            <label className="text-xs text-neutral-500 mb-2 block">{t("sourceComponent")}</label>
            {!selectedComponent ? (
              <button
                onClick={onRequestSelection}
                disabled={isSelecting}
                className="w-full border-2 border-dashed border-neutral-200 rounded-lg p-5 flex flex-col items-center gap-2.5 hover:border-neutral-300 hover:bg-neutral-50 transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                  {isSelecting ? (
                    <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin" />
                  ) : (
                    <Component className="w-4 h-4 text-neutral-400" />
                  )}
                </div>
                <span className="text-xs text-neutral-400">
                  {isSelecting ? t("selectingComponent") : t("clickToSelect")}
                </span>
              </button>
            ) : (
              <div className="border border-neutral-200 rounded-lg p-3.5 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-violet-100 flex items-center justify-center">
                      <Component className="w-4 h-4 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-900">{selectedComponent.name}</p>
                      <p className="text-xs text-neutral-500">
                        {t("layersDetected", { count: flatLayers.length })}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearComponent}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Selection error */}
          {selectionError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{selectionError}</p>
            </div>
          )}

          {/* Layer List */}
          {selectedComponent && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-neutral-500">
                  {t("layersToKeep")} ({selectedLayers.length})
                </label>
              </div>

              {selectedLayers.length === 0 && !showLayerPicker && (
                <div className="border border-dashed border-neutral-200 rounded-lg p-4 flex flex-col items-center gap-2 text-center">
                  <Layers className="w-5 h-5 text-neutral-300" />
                  <p className="text-xs text-neutral-400">{t("noLayersYet")}</p>
                </div>
              )}

              {selectedLayers.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {selectedLayers.map((layer, index) => (
                    <Fragment key={`${layer.id}-${index}`}>
                      <div className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors">
                        <LayerIcon type={layer.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900 truncate">{layer.name}</p>
                          {layer.parentComponentName ? (
                            <p className="text-[10px] text-violet-600 truncate">
                              {t("inComponent")} {layer.parentComponentName}
                              {layer.parentInstanceName ? ` (${layer.parentInstanceName})` : ""}
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-400 truncate">
                              {layer.type === "instance"
                                ? layer.componentName
                                : layer.type === "text"
                                  ? `"${layer.preview}"`
                                  : layer.type}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                          {layer.type}
                        </Badge>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditLayer(index)}>
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-600"
                            onClick={() => handleRemoveLayer(index)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Inline picker when EDITING this layer */}
                      {showLayerPicker && editingLayerIndex === index && (
                        <div className="mt-1 mb-1">
                          {renderPicker()}
                        </div>
                      )}
                    </Fragment>
                  ))}
                </div>
              )}

              {/* Bottom picker when ADDING a new layer */}
              {showLayerPicker && editingLayerIndex === null && (
                <div className="mt-2">
                  {renderPicker()}
                </div>
              )}

              {/* Add button */}
              {!showLayerPicker && flatLayers.length > 0 && (
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleAddLayer}>
                  <Plus className="w-3.5 h-3.5" />
                  {t("addLayer")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-4 py-3 border-t border-neutral-200 bg-white">
        <Button className="w-full" onClick={onNext} disabled={selectedLayers.length === 0}>
          {t("next")}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}