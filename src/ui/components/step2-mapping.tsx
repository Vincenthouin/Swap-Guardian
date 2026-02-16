import { useState, useCallback, useMemo } from "react";
import {
  ArrowRight, MousePointerClick, ChevronRight, ChevronLeft,
  Component, X, Check, Link2, RefreshCw, AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LayerIcon } from "./layer-icon";
import { useI18n } from "./i18n";
import { flattenLayers } from "./utils";
import type { LayerItem, MappingEntry, ComponentInfo } from "./types";

interface Step2Props {
  selectedLayers: LayerItem[];
  mappings: MappingEntry[];
  onMappingsChange: (mappings: MappingEntry[]) => void;
  newComponent: ComponentInfo | null;
  isSelectingNew: boolean;
  newComponentError: string | null;
  onRequestNewComponent: () => void;
  onClearNewComponent: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Mapping({
  selectedLayers, mappings, onMappingsChange,
  newComponent, isSelectingNew, newComponentError,
  onRequestNewComponent, onClearNewComponent, onNext, onBack,
}: Step2Props) {
  const { t } = useI18n();
  const [activeMappingId, setActiveMappingId] = useState<string | null>(null);

  // Flatten nested layers for the target picker
  const flatNewLayers = useMemo(
    () => (newComponent ? flattenLayers(newComponent.layers) : []),
    [newComponent]
  );

  const handlePickTarget = useCallback(
    (targetLayer: LayerItem) => {
      if (!activeMappingId) return;
      const alreadyMapped = mappings.find(
        (m) => m.targetLayer?.id === targetLayer.id && m.id !== activeMappingId
      );
      if (alreadyMapped) return;
      const newMappings = mappings.map((m) =>
        m.id === activeMappingId ? { ...m, targetLayer } : m
      );
      onMappingsChange(newMappings);
      setActiveMappingId(null);
    },
    [activeMappingId, mappings, onMappingsChange]
  );

  const handleClearMapping = useCallback(
    (mappingId: string) => {
      onMappingsChange(mappings.map((m) => m.id === mappingId ? { ...m, targetLayer: null } : m));
    },
    [mappings, onMappingsChange]
  );

  const mappedCount = mappings.filter((m) => m.targetLayer !== null).length;
  const allMapped = mappedCount === mappings.length && mappings.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5">
        <div className="flex gap-2.5">
          <Link2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">{t("step2Instruction")}</p>
        </div>
      </div>

      {/* New Component Selection */}
      <div>
        <label className="text-xs text-neutral-500 mb-2 block">{t("targetComponent")}</label>
        {!newComponent ? (
          <button
            onClick={onRequestNewComponent}
            disabled={isSelectingNew}
            className="w-full border-2 border-dashed border-neutral-200 rounded-lg p-5 flex flex-col items-center gap-2.5 hover:border-neutral-300 hover:bg-neutral-50 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
              {isSelectingNew ? (
                <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin" />
              ) : (
                <Component className="w-4 h-4 text-neutral-400" />
              )}
            </div>
            <span className="text-xs text-neutral-400">
              {isSelectingNew ? t("selectingComponent") : t("clickToSelectNew")}
            </span>
          </button>
        ) : (
          <div className="border border-neutral-200 rounded-lg p-3.5 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-emerald-100 flex items-center justify-center">
                  <Component className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-900">{newComponent.name}</p>
                  <p className="text-xs text-neutral-500">
                    {t("layersAvailable", { count: flatNewLayers.length })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClearNewComponent}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {newComponentError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{newComponentError}</p>
        </div>
      )}

      {/* Mapping List */}
      {newComponent && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-neutral-500">
              {t("associations")} ({mappedCount}/{mappings.length})
            </label>
            {allMapped && (
              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                <Check className="w-3 h-3" /> {t("complete")}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {mappings.map((mapping) => {
              const isActive = activeMappingId === mapping.id;
              const isMapped = mapping.targetLayer !== null;

              return (
                <div key={mapping.id}>
                  <div className={`rounded-lg border transition-all ${isActive ? "border-blue-300 bg-blue-50/50" : "border-neutral-200 bg-white"}`}>
                    <div className="p-2.5">
                      <div className="flex items-center gap-2">
                        {/* Source */}
                        <div className="flex items-center gap-2 flex-1 min-w-0 bg-neutral-100 rounded-md px-2.5 py-2">
                          <LayerIcon type={mapping.sourceLayer.type} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-neutral-900 truncate">{mapping.sourceLayer.name}</p>
                            {mapping.sourceLayer.parentComponentName && (
                              <p className="text-[10px] text-violet-600 truncate">
                                {t("inComponent")} {mapping.sourceLayer.parentComponentName}
                              </p>
                            )}
                          </div>
                        </div>

                        <ArrowRight className={`w-4 h-4 shrink-0 ${isMapped ? "text-emerald-500" : "text-neutral-300"}`} />

                        {/* Target */}
                        {isMapped ? (
                          <div className="flex items-center gap-2 flex-1 min-w-0 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-2">
                            <LayerIcon type={mapping.targetLayer!.type} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-neutral-900 truncate">{mapping.targetLayer!.name}</p>
                              {mapping.targetLayer!.parentComponentName && (
                                <p className="text-[10px] text-violet-600 truncate">
                                  {t("inComponent")} {mapping.targetLayer!.parentComponentName}
                                </p>
                              )}
                            </div>
                            <button onClick={() => handleClearMapping(mapping.id)} className="shrink-0 hover:text-red-500 transition-colors cursor-pointer">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveMappingId(mapping.id)}
                            className={`flex items-center gap-2 flex-1 min-w-0 rounded-md px-2.5 py-2 transition-all cursor-pointer ${
                              isActive ? "bg-blue-100 border border-blue-300" : "border border-dashed border-neutral-200 hover:border-neutral-300"
                            }`}
                          >
                            <MousePointerClick className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-500" : "text-neutral-400"}`} />
                            <span className={`text-xs ${isActive ? "text-blue-600" : "text-neutral-400"}`}>
                              {isActive ? t("choosing") : t("associate")}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Target picker — filtered by type, uses flatNewLayers for nested support */}
                  {isActive && (
                    <div className="mt-1.5 border border-blue-200 rounded-lg bg-blue-50/50 overflow-hidden">
                      <div className="px-3 py-2 bg-blue-100/60 border-b border-blue-200 flex items-center justify-between">
                        <span className="text-xs text-blue-800">
                          {t("mapLayerTo", { name: mapping.sourceLayer.name })}
                        </span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setActiveMappingId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="p-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                        {flatNewLayers
                          .filter((nl) => nl.type === mapping.sourceLayer.type)
                          .map((layer) => {
                            const alreadyUsed = mappings.some(
                              (m) => m.targetLayer?.id === layer.id && m.id !== mapping.id
                            );
                            const isNested = !!layer.parentInstanceName;
                            return (
                              <button
                                key={layer.id}
                                onClick={() => handlePickTarget(layer)}
                                disabled={alreadyUsed}
                                className={`flex items-center gap-2.5 p-2 rounded-md text-left transition-colors ${
                                  isNested ? "pl-7" : ""
                                } ${
                                  alreadyUsed ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-100 cursor-pointer"
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
                                {layer.componentName && !layer.parentComponentName && (
                                  <span className="text-[10px] text-neutral-400">{layer.componentName}</span>
                                )}
                                {alreadyUsed && <span className="text-[10px] text-blue-500">{t("alreadyMapped")}</span>}
                              </button>
                            );
                          })}
                        {flatNewLayers.filter((nl) => nl.type === mapping.sourceLayer.type).length === 0 && (
                          <p className="text-xs text-neutral-400 p-2 text-center">
                            {t("noCompatibleLayer")} ({mapping.sourceLayer.type})
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="pt-2 border-t border-neutral-200 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> {t("back")}
        </Button>
        <Button className="flex-1" onClick={onNext} disabled={!allMapped}>
          {t("next")} <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}