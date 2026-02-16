import { useState, useCallback } from "react";
import {
  Plus, Trash2, MousePointerClick, AlertCircle,
  Component, RefreshCw, ChevronRight, X, Layers,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LayerIcon } from "./layer-icon";
import type { LayerItem, ComponentInfo } from "./types";

interface Step1Props {
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
  selectedComponent, selectedLayers, onLayersChange,
  isSelecting, selectionError, onRequestSelection, onClearComponent, onNext,
}: Step1Props) {
  const [editingLayerIndex, setEditingLayerIndex] = useState<number | null>(null);
  const [showLayerPicker, setShowLayerPicker] = useState(false);

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

  return (
    <div className="flex flex-col gap-5">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5">
        <div className="flex gap-2.5">
          <MousePointerClick className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            Sélectionnez le composant que vous souhaitez mettre à jour (instances ou source), puis ajoutez les calques dont vous souhaitez conserver le contenu.
          </p>
        </div>
      </div>

      {/* Component Selection */}
      <div>
        <label className="text-xs text-neutral-500 mb-2 block">Composant source</label>
        {!selectedComponent ? (
          <button
            onClick={onRequestSelection}
            disabled={isSelecting}
            className="w-full border-2 border-dashed border-neutral-200 rounded-lg p-5 flex flex-col items-center gap-2.5 hover:border-neutral-300 hover:bg-neutral-50 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSelecting ? (
              <>
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4 text-neutral-400 animate-spin" />
                </div>
                <span className="text-xs text-neutral-400">Lecture de la sélection Figma...</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                  <Component className="w-4 h-4 text-neutral-400" />
                </div>
                <span className="text-xs text-neutral-400">Sélectionner le composant (ou une instance) dans Figma puis cliquez ici</span>
              </>
            )}
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
                  <p className="text-xs text-neutral-500">{selectedComponent.layers.length} layers détectés</p>
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
            <label className="text-xs text-neutral-500">Layers à conserver ({selectedLayers.length})</label>
          </div>

          {selectedLayers.length === 0 && !showLayerPicker && (
            <div className="border border-dashed border-neutral-200 rounded-lg p-4 flex flex-col items-center gap-2 text-center">
              <Layers className="w-5 h-5 text-neutral-300" />
              <p className="text-xs text-neutral-400">Aucun layer ajouté. Utilisez le bouton ci-dessous.</p>
            </div>
          )}

          {selectedLayers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {selectedLayers.map((layer, index) => (
                <div key={`${layer.id}-${index}`} className="group flex items-center gap-2.5 p-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors">
                  <LayerIcon type={layer.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 truncate">{layer.name}</p>
                    <p className="text-xs text-neutral-400 truncate">
                      {layer.type === "instance" ? layer.componentName : layer.type === "text" ? `"${layer.preview}"` : layer.type}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{layer.type}</Badge>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditLayer(index)}>
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={() => handleRemoveLayer(index)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Layer Picker — affiche les VRAIS layers du composant */}
          {showLayerPicker && (
            <div className="mt-2 border border-blue-200 rounded-lg bg-blue-50/50 overflow-hidden">
              <div className="px-3 py-2 bg-blue-100/60 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs text-blue-800">
                    {editingLayerIndex !== null ? "Sélectionner le nouveau layer" : "Choisir un layer à conserver"}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCancelPicker}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="p-2 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                {selectedComponent.layers.length === 0 && (
                  <p className="text-xs text-neutral-400 p-2 text-center">Aucun layer exploitable trouvé dans ce composant.</p>
                )}
                {selectedComponent.layers.map((layer) => {
                  const isAlreadySelected = selectedLayers.some((l) => l.id === layer.id);
                  return (
                    <button
                      key={layer.id}
                      onClick={() => handlePickLayer(layer)}
                      disabled={isAlreadySelected && editingLayerIndex === null}
                      className={`flex items-center gap-2.5 p-2 rounded-md text-left transition-colors ${
                        isAlreadySelected && editingLayerIndex === null
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-blue-100 cursor-pointer"
                      }`}
                    >
                      <LayerIcon type={layer.type} />
                      <span className="text-sm text-neutral-900 flex-1 truncate">{layer.name}</span>
                      <span className="text-[10px] text-neutral-400">{layer.type}</span>
                      {isAlreadySelected && editingLayerIndex === null && (
                        <span className="text-[10px] text-blue-500">ajouté</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add button */}
          {!showLayerPicker && selectedComponent.layers.length > 0 && (
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={handleAddLayer}>
              <Plus className="w-3.5 h-3.5" />
              Ajouter un layer
            </Button>
          )}
        </div>
      )}

      {/* Next button */}
      <div className="pt-2 border-t border-neutral-200">
        <Button className="w-full" onClick={onNext} disabled={selectedLayers.length === 0}>
          Étape suivante
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}