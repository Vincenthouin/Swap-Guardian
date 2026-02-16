import { useState, useCallback } from "react";
import {
  ChevronLeft, Play, FileText, FolderOpen, Check, AlertCircle,
  ArrowRight, RefreshCw, Sparkles, Component, Crosshair, ChevronDown, ChevronUp,
  Palette,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { LayerIcon } from "./layer-icon";
import type { MappingEntry, ComponentInfo, ConversionResult } from "./types";

interface Step3Props {
  oldComponent: ComponentInfo;
  newComponent: ComponentInfo;
  mappings: MappingEntry[];
  conversionState: "idle" | "running" | "complete";
  progress: number;
  result: ConversionResult | null;
  conversionError: string | null;
  onRunConversion: (scope: "page" | "document", preserveColors: boolean) => void;
  onFocusNode: (nodeId: string) => void;
  onBack: () => void;
  onReset: () => void;
}

export function Step3Conversion({
  oldComponent, newComponent, mappings,
  conversionState, progress, result, conversionError,
  onRunConversion, onFocusNode, onBack, onReset,
}: Step3Props) {
  const [scope, setScope] = useState<"page" | "document">("page");
  const [preserveColors, setPreserveColors] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(true);
  const [focusedInstanceId, setFocusedInstanceId] = useState<string | null>(null);

  const handleFocusInstance = useCallback(
    (instanceId: string) => {
      setFocusedInstanceId(instanceId);
      onFocusNode(instanceId);
      setTimeout(() => setFocusedInstanceId(null), 1500);
    },
    [onFocusNode]
  );

  return (
    <div className="flex flex-col gap-5">
      {conversionState === "idle" && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5">
            <div className="flex gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800">
                Vérifiez le récapitulatif des associations puis lancez la conversion.
                Toutes les instances de l'ancien composant seront remplacées automatiquement.
              </p>
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="text-xs text-neutral-500 mb-2 block">Récapitulatif</label>
            <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-200 overflow-hidden">
              <div className="p-3 bg-white">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-violet-100 flex items-center justify-center shrink-0">
                      <Component className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <p className="text-xs text-neutral-900 truncate">{oldComponent.name}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                      <Component className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-neutral-900 truncate">{newComponent.name}</p>
                  </div>
                </div>
              </div>
              {mappings.map((m) => (
                <div key={m.id} className="px-3 py-2 flex items-center gap-2 bg-white">
                  <LayerIcon type={m.sourceLayer.type} />
                  <span className="text-xs text-neutral-900 flex-1 truncate">{m.sourceLayer.name}</span>
                  <ArrowRight className="w-3 h-3 text-neutral-300 shrink-0" />
                  <span className="text-xs text-emerald-600 flex-1 truncate text-right">{m.targetLayer?.name || "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scope */}
          <div>
            <label className="text-xs text-neutral-500 mb-2 block">Portée de la conversion</label>
            <div className="flex gap-2">
              <button
                onClick={() => setScope("page")}
                className={`flex-1 flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  scope === "page" ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <FileText className={`w-4 h-4 ${scope === "page" ? "text-neutral-900" : "text-neutral-400"}`} />
                <div className="text-left">
                  <p className={`text-xs ${scope === "page" ? "text-neutral-900" : "text-neutral-400"}`}>Page active</p>
                  <p className="text-[10px] text-neutral-400">Page courante uniquement</p>
                </div>
              </button>
              <button
                onClick={() => setScope("document")}
                className={`flex-1 flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                  scope === "document" ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <FolderOpen className={`w-4 h-4 ${scope === "document" ? "text-neutral-900" : "text-neutral-400"}`} />
                <div className="text-left">
                  <p className={`text-xs ${scope === "document" ? "text-neutral-900" : "text-neutral-400"}`}>Tout le document</p>
                  <p className="text-[10px] text-neutral-400">Toutes les pages</p>
                </div>
              </button>
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="text-xs text-neutral-500 mb-2 block">Options</label>
            <label
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                preserveColors
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
              onClick={() => setPreserveColors(!preserveColors)}
            >
              <div className={`w-8 h-5 rounded-full relative transition-colors ${preserveColors ? "bg-neutral-900" : "bg-neutral-300"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${preserveColors ? "left-3.5" : "left-0.5"}`} />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Palette className={`w-4 h-4 ${preserveColors ? "text-neutral-900" : "text-neutral-400"}`} />
                <div>
                  <p className={`text-xs ${preserveColors ? "text-neutral-900" : "text-neutral-500"}`}>
                    Conserver les couleurs du composant source
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {preserveColors
                      ? "Les couleurs des instances source seront conservées"
                      : "Les couleurs du nouveau composant seront appliquées"}
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Conversion error */}
          {conversionError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{conversionError}</p>
            </div>
          )}

          <div className="pt-2 border-t border-neutral-200 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onBack}>
              <ChevronLeft className="w-4 h-4" /> Retour
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onRunConversion(scope, preserveColors)}>
              <Play className="w-4 h-4" /> Lancer la conversion
            </Button>
          </div>
        </>
      )}

      {conversionState === "running" && (
        <div className="flex flex-col items-center gap-5 py-6">
          <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-neutral-900 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm text-neutral-900 mb-1">Conversion en cours...</p>
            <p className="text-xs text-neutral-500">
              Remplacement des instances dans {scope === "page" ? "la page active" : "tout le document"}
            </p>
          </div>
          <div className="w-full">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-neutral-500 text-center mt-2">{progress}%</p>
          </div>
        </div>
      )}

      {conversionState === "complete" && result && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-neutral-900">Conversion terminée</p>
              <p className="text-xs text-neutral-500 mt-1">
                {result.converted} instance{result.converted > 1 ? "s" : ""} convertie{result.converted > 1 ? "s" : ""} sur {result.totalInstances}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-neutral-200 rounded-lg p-3 text-center">
              <p className="text-lg text-neutral-900">{result.totalInstances}</p>
              <p className="text-[10px] text-neutral-500">Trouvées</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
              <p className="text-lg text-emerald-600">{result.converted}</p>
              <p className="text-[10px] text-emerald-600">Converties</p>
            </div>
            <div className={`rounded-lg p-3 text-center ${result.errors > 0 ? "bg-red-50 border border-red-200" : "bg-white border border-neutral-200"}`}>
              <p className={`text-lg ${result.errors > 0 ? "text-red-500" : "text-neutral-900"}`}>{result.errors}</p>
              <p className={`text-[10px] ${result.errors > 0 ? "text-red-500" : "text-neutral-500"}`}>Erreurs</p>
            </div>
          </div>

          {/* Pages */}
          {result.pages.length > 0 && (
            <div>
              <label className="text-xs text-neutral-500 mb-2 block">Détail par page</label>
              <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-200 overflow-hidden">
                {result.pages.map((page) => (
                  <div key={page.name} className="px-3 py-2.5 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-xs text-neutral-900">{page.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{page.count} instance{page.count > 1 ? "s" : ""}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors > 0 && result.failedInstances.length > 0 && (
            <div>
              <button onClick={() => setErrorsExpanded(!errorsExpanded)} className="flex items-center justify-between w-full mb-2 cursor-pointer group">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  <label className="text-xs text-red-600 cursor-pointer">Instances en erreur ({result.failedInstances.length})</label>
                </div>
                {errorsExpanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                  : <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition-colors" />}
              </button>

              {errorsExpanded && (
                <div className="border border-red-200 rounded-lg overflow-hidden divide-y divide-red-100">
                  {result.failedInstances.map((instance) => {
                    const isFocused = focusedInstanceId === instance.id;
                    return (
                      <div key={instance.id} className={`px-3 py-2.5 bg-white transition-colors ${isFocused ? "bg-red-50" : ""}`}>
                        <div className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Component className="w-3 h-3 text-red-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs text-neutral-900 truncate">{instance.name}</p>
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0 bg-red-50 text-red-500 border-red-200">{instance.pageName}</Badge>
                            </div>
                            <p className="text-[11px] text-neutral-500 mt-0.5">{instance.reason}</p>
                          </div>
                          <Button
                            variant="outline" size="icon"
                            className={`h-7 w-7 shrink-0 transition-all ${isFocused ? "border-red-300 bg-red-100 text-red-600" : "hover:border-red-300 hover:bg-red-50 hover:text-red-600"}`}
                            onClick={() => handleFocusInstance(instance.id)}
                            title={`Sélectionner ${instance.name} dans le canvas`}
                          >
                            <Crosshair className={`w-3.5 h-3.5 ${isFocused ? "animate-pulse" : ""}`} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-neutral-200">
            <Button variant="outline" className="w-full" onClick={onReset}>
              <RefreshCw className="w-4 h-4" /> Nouvelle conversion
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}