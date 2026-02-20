import { useState, useCallback, useMemo } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ToggleLeft,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Settings2,
  Check,
  Info,
  RefreshCw,
  ArrowRight,
  Repeat,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useI18n } from "./i18n";
import { flattenLayers } from "./utils";
import type {
  LayerItem,
  PropertyRules,
  CarryOverRule,
  BooleanRule,
  VariantRule,
} from "./types";

// ════════════════════════════════════════════════════════════

interface Step2bProps {
  stepTitle: string;
  oldLayers: LayerItem[];
  propertyRules: PropertyRules;
  onPropertyRulesChange: (rules: PropertyRules) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function Step2bProperties({
  stepTitle,
  oldLayers,
  propertyRules,
  onPropertyRulesChange,
  isLoading,
  onNext,
  onBack,
}: Step2bProps) {
  const { t } = useI18n();
  const flatOldLayers = useMemo(() => flattenLayers(oldLayers), [oldLayers]);

  const hasCarryOvers = propertyRules.carryOvers.length > 0;
  const hasBooleans = propertyRules.booleans.length > 0;
  const hasVariants = propertyRules.variants.length > 0;
  const hasAnyRules = hasCarryOvers || hasBooleans || hasVariants;

  // ── Carry-over handlers ──

  const handleCarryOverModeChange = useCallback(
    (newPropName: string, mode: "carry-over" | "fixed") => {
      const updated = propertyRules.carryOvers.map((c) =>
        c.newPropertyName === newPropName ? { ...c, mode } : c
      );
      onPropertyRulesChange({ ...propertyRules, carryOvers: updated });
    },
    [propertyRules, onPropertyRulesChange]
  );

  const handleCarryOverFixedValue = useCallback(
    (newPropName: string, fixedValue: string | boolean) => {
      const updated = propertyRules.carryOvers.map((c) =>
        c.newPropertyName === newPropName ? { ...c, fixedValue } : c
      );
      onPropertyRulesChange({ ...propertyRules, carryOvers: updated });
    },
    [propertyRules, onPropertyRulesChange]
  );

  const handleCarryOverValueMapping = useCallback(
    (newPropName: string, oldValue: string, newValue: string) => {
      const updated = propertyRules.carryOvers.map((c) =>
        c.newPropertyName === newPropName
          ? { ...c, valueMapping: { ...c.valueMapping, [oldValue]: newValue } }
          : c
      );
      onPropertyRulesChange({ ...propertyRules, carryOvers: updated });
    },
    [propertyRules, onPropertyRulesChange]
  );

  // ── Boolean handlers ──

  const handleBooleanModeChange = useCallback(
    (propName: string, mode: "per-instance" | "fixed") => {
      const updated = propertyRules.booleans.map((b) =>
        b.propertyName === propName ? { ...b, mode } : b
      );
      onPropertyRulesChange({ ...propertyRules, booleans: updated });
    },
    [propertyRules, onPropertyRulesChange]
  );

  const handleBooleanLayerChange = useCallback(
    (propName: string, layerId: string | null) => {
      const layer = layerId
        ? flatOldLayers.find((l) => l.id === layerId) ?? null
        : null;
      const updated = propertyRules.booleans.map((b) =>
        b.propertyName === propName
          ? {
              ...b,
              mode: "per-instance" as const,
              sourceLayerId: layer?.id ?? null,
              sourceLayerName: layer?.name ?? null,
              autoDetected: false,
            }
          : b
      );
      onPropertyRulesChange({ ...propertyRules, booleans: updated });
    },
    [propertyRules, flatOldLayers, onPropertyRulesChange]
  );

  const handleBooleanFixedChange = useCallback(
    (propName: string, value: boolean) => {
      const updated = propertyRules.booleans.map((b) =>
        b.propertyName === propName ? { ...b, fixedValue: value } : b
      );
      onPropertyRulesChange({ ...propertyRules, booleans: updated });
    },
    [propertyRules, onPropertyRulesChange]
  );

  // ── Variant handlers ──

  const handleVariantModeChange = useCallback(
    (propName: string, mode: "auto-detect" | "fixed") => {
      const updated = propertyRules.variants.map((v) =>
        v.propertyName === propName ? { ...v, mode } : v
      );
      onPropertyRulesChange({ ...propertyRules, variants: updated });
    },
    [propertyRules, onPropertyRulesChange]
  );

  const handleVariantFixedChange = useCallback(
    (propName: string, value: string) => {
      const updated = propertyRules.variants.map((v) =>
        v.propertyName === propName ? { ...v, fixedValue: value } : v
      );
      onPropertyRulesChange({ ...propertyRules, variants: updated });
    },
    [propertyRules, onPropertyRulesChange]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-4">
        <h2 className="text-sm text-neutral-900 pt-4 pb-3">{stepTitle}</h2>

        <div className="flex flex-col gap-5 pb-4">
          {/* Instructions */}
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3.5">
            <div className="flex gap-2.5">
              <Settings2 className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-800">
                {t("step2bInstruction")}
              </p>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3 py-6">
              <RefreshCw className="w-5 h-5 text-neutral-400 animate-spin" />
              <p className="text-xs text-neutral-500">
                {t("loadingProperties")}
              </p>
            </div>
          )}

          {/* No properties at all */}
          {!isLoading && !hasAnyRules && (
            <div className="border border-dashed border-neutral-200 rounded-lg p-6 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
                <Check className="w-5 h-5 text-neutral-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-900">
                  {t("noProperties")}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  {t("noPropertiesDesc")}
                </p>
              </div>
            </div>
          )}

          {/* ═══ SECTION A — Carry-Overs ═══ */}
          {!isLoading && hasCarryOvers && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Repeat className="w-4 h-4 text-emerald-500" />
                <label className="text-xs text-neutral-500">
                  {t("carryOverSection")} ({propertyRules.carryOvers.length})
                </label>
              </div>

              <div className="flex flex-col gap-2">
                {propertyRules.carryOvers.map((rule) => (
                  <CarryOverCard
                    key={rule.newPropertyName}
                    rule={rule}
                    onModeChange={(mode) =>
                      handleCarryOverModeChange(rule.newPropertyName, mode)
                    }
                    onFixedValueChange={(v) =>
                      handleCarryOverFixedValue(rule.newPropertyName, v)
                    }
                    onValueMappingChange={(oldVal, newVal) =>
                      handleCarryOverValueMapping(
                        rule.newPropertyName,
                        oldVal,
                        newVal
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* ═══ SECTION B — Boolean Toggles ═══ */}
          {!isLoading && hasBooleans && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ToggleLeft className="w-4 h-4 text-blue-500" />
                <label className="text-xs text-neutral-500">
                  {t("togglesSection")} ({propertyRules.booleans.length})
                </label>
              </div>

              <div className="flex flex-col gap-2">
                {propertyRules.booleans.map((rule) => (
                  <BooleanRuleCard
                    key={rule.propertyName}
                    rule={rule}
                    oldLayers={flatOldLayers}
                    onModeChange={(mode) =>
                      handleBooleanModeChange(rule.propertyName, mode)
                    }
                    onLayerChange={(layerId) =>
                      handleBooleanLayerChange(rule.propertyName, layerId)
                    }
                    onFixedChange={(value) =>
                      handleBooleanFixedChange(rule.propertyName, value)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* ═══ SECTION C — Variant Properties ═══ */}
          {!isLoading && hasVariants && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-amber-500" />
                <label className="text-xs text-neutral-500">
                  {t("variantsSection")} ({propertyRules.variants.length})
                </label>
              </div>

              <div className="flex flex-col gap-2">
                {propertyRules.variants.map((rule) => (
                  <VariantRuleCard
                    key={rule.propertyName}
                    rule={rule}
                    onModeChange={(mode) =>
                      handleVariantModeChange(rule.propertyName, mode)
                    }
                    onFixedChange={(value) =>
                      handleVariantFixedChange(rule.propertyName, value)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer */}
      <div className="shrink-0 px-4 py-3 border-t border-neutral-200 bg-white flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> {t("back")}
        </Button>
        <Button className="flex-1" onClick={onNext} disabled={isLoading}>
          {t("next")} <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SECTION A — Carry-Over Card
// ════════════════════════════════════════════════════════════

function CarryOverCard({
  rule,
  onModeChange,
  onFixedValueChange,
  onValueMappingChange,
}: {
  rule: CarryOverRule;
  onModeChange: (mode: "carry-over" | "fixed") => void;
  onFixedValueChange: (v: string | boolean) => void;
  onValueMappingChange: (oldVal: string, newVal: string) => void;
}) {
  const { t } = useI18n();
  const [showMapping, setShowMapping] = useState(false);
  const isCarryOver = rule.mode === "carry-over";

  // For variants: check if any value mapping differs from identity
  const hasRemappedValues =
    rule.type === "VARIANT" &&
    Object.entries(rule.valueMapping).some(([k, v]) => k !== v);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
              <Repeat className="w-3 h-3 text-emerald-600" />
            </div>
            <div>
              <span className="text-xs text-neutral-900">
                {rule.displayName}
              </span>
              <span className="text-[10px] text-neutral-400 ml-1.5">
                {rule.type === "BOOLEAN" ? "toggle" : "variant"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {rule.autoMatched && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"
              >
                {t("autoDetected")}
              </Badge>
            )}
            {/* Toggle carry-over vs fixed */}
            <button
              onClick={() =>
                onModeChange(isCarryOver ? "fixed" : "carry-over")
              }
              className="p-1 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
              title={
                isCarryOver
                  ? t("switchToFixed")
                  : t("switchToCarryOver")
              }
            >
              {isCarryOver ? (
                <Unlock className="w-3 h-3 text-emerald-600" />
              ) : (
                <Lock className="w-3 h-3 text-neutral-400" />
              )}
            </button>
          </div>
        </div>

        {/* Carry-over mode info */}
        {isCarryOver && (
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-emerald-50 border border-emerald-200">
            <Info className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-emerald-700">
              <p>
                {t("carryOverExplanation", {
                  old: rule.oldPropertyName,
                  new: rule.displayName,
                })}
              </p>
              {hasRemappedValues && (
                <button
                  onClick={() => setShowMapping(!showMapping)}
                  className="mt-1 underline cursor-pointer hover:text-emerald-800"
                >
                  {showMapping
                    ? t("hideValueMapping")
                    : t("showValueMapping")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Value mapping table (variants only, carry-over mode) */}
        {isCarryOver &&
          showMapping &&
          rule.type === "VARIANT" &&
          Object.keys(rule.valueMapping).length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {Object.entries(rule.valueMapping).map(([oldVal, newVal]) => {
                const isSame = oldVal === newVal;
                return (
                  <div
                    key={oldVal}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <span className="text-neutral-600 min-w-0 truncate flex-1 text-right">
                      {oldVal}
                    </span>
                    <ArrowRight
                      className={`w-3 h-3 shrink-0 ${
                        isSame ? "text-emerald-400" : "text-amber-500"
                      }`}
                    />
                    <span
                      className={`min-w-0 truncate flex-1 ${
                        isSame
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {newVal}
                      {!isSame && " *"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        {/* Fixed mode: value selector */}
        {!isCarryOver && (
          <div className="mt-2">
            <label className="text-[10px] text-neutral-500 block mb-1">
              {t("fixedValueLabel")}
            </label>
            {rule.type === "BOOLEAN" ? (
              <div className="flex gap-2">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => onFixedValueChange(val)}
                    className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors cursor-pointer ${
                      rule.fixedValue === val
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                    }`}
                  >
                    {val ? "ON" : "OFF"}
                  </button>
                ))}
              </div>
            ) : (
              <select
                value={String(rule.fixedValue ?? "")}
                onChange={(e) => onFixedValueChange(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-neutral-200 bg-white"
              >
                {Object.values(rule.valueMapping)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((val) => (
                    <option key={val} value={val}>
                      {val}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SECTION B — Boolean Toggle Card
// ════════════════════════════════════════════════════════════

function BooleanRuleCard({
  rule,
  oldLayers,
  onModeChange,
  onLayerChange,
  onFixedChange,
}: {
  rule: BooleanRule;
  oldLayers: LayerItem[];
  onModeChange: (mode: "per-instance" | "fixed") => void;
  onLayerChange: (layerId: string | null) => void;
  onFixedChange: (value: boolean) => void;
}) {
  const { t } = useI18n();
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const isPerInstance = rule.mode === "per-instance";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
              <ToggleLeft className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-xs text-neutral-900">
              {rule.displayName}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {rule.autoDetected && (
              <Badge
                variant="secondary"
                className="text-[10px] bg-violet-50 text-violet-600 border-violet-200"
              >
                <Sparkles className="w-3 h-3" />
                {t("autoDetected")}
              </Badge>
            )}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1.5 mb-2.5">
          <button
            onClick={() => onModeChange("per-instance")}
            className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors cursor-pointer ${
              isPerInstance
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {t("modePerInstance")}
          </button>
          <button
            onClick={() => onModeChange("fixed")}
            className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors cursor-pointer ${
              !isPerInstance
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {t("modeFixed")}
          </button>
        </div>

        {/* Per-instance: layer selector */}
        {isPerInstance && (
          <div className="relative">
            <label className="text-[10px] text-neutral-500 block mb-1">
              {t("activateWhenVisible")}
            </label>
            <button
              onClick={() => setShowLayerPicker(!showLayerPicker)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors cursor-pointer text-left"
            >
              {rule.sourceLayerId ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Eye className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="text-xs text-neutral-900 truncate">
                    {rule.sourceLayerName}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <EyeOff className="w-3 h-3 text-neutral-400 shrink-0" />
                  <span className="text-xs text-neutral-400">
                    {t("noLayerSelected")}
                  </span>
                </div>
              )}
              <ChevronDown
                className={`w-3 h-3 text-neutral-400 shrink-0 transition-transform ${
                  showLayerPicker ? "rotate-180" : ""
                }`}
              />
            </button>

            {showLayerPicker && (
              <div className="absolute z-10 left-0 right-0 mt-1 border border-neutral-200 rounded-lg bg-white shadow-lg overflow-hidden">
                <div className="max-h-40 overflow-y-auto">
                  {oldLayers.map((layer) => (
                    <button
                      key={layer.id}
                      onClick={() => {
                        onLayerChange(layer.id);
                        setShowLayerPicker(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                        rule.sourceLayerId === layer.id
                          ? "bg-blue-50"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      <Eye className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="text-xs text-neutral-900 truncate flex-1">
                        {layer.name}
                      </span>
                      {layer.parentComponentName && (
                        <span className="text-[10px] text-violet-600 shrink-0">
                          {t("inComponent")} {layer.parentComponentName}
                        </span>
                      )}
                      {rule.sourceLayerId === layer.id && (
                        <Check className="w-3 h-3 text-blue-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Explanation when a layer is selected */}
            {rule.sourceLayerId && rule.sourceLayerName && (
              <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md bg-emerald-50 border border-emerald-200">
                <Info className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-emerald-700">
                  {t("boolExplanation", {
                    layer: rule.sourceLayerName,
                    prop: rule.displayName,
                  })}
                </p>
              </div>
            )}

            {/* Warning: no layer matched = defaults to OFF */}
            {!rule.sourceLayerId && (
              <div className="flex items-start gap-1.5 mt-2 p-2 rounded-md bg-amber-50 border border-amber-200">
                <Info className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700">
                  {t("noMatchDefaultOff")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fixed mode: ON/OFF toggle */}
        {!isPerInstance && (
          <div>
            <label className="text-[10px] text-neutral-500 block mb-1">
              {t("fixedValueLabel")}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onFixedChange(true)}
                className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors cursor-pointer ${
                  rule.fixedValue
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                    : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                ON
              </button>
              <button
                onClick={() => onFixedChange(false)}
                className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors cursor-pointer ${
                  !rule.fixedValue
                    ? "bg-red-100 border-red-300 text-red-700"
                    : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                }`}
              >
                OFF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SECTION C — Variant Property Card
// ════════════════════════════════════════════════════════════

function VariantRuleCard({
  rule,
  onModeChange,
  onFixedChange,
}: {
  rule: VariantRule;
  onModeChange: (mode: "auto-detect" | "fixed") => void;
  onFixedChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const isAutoDetect = rule.mode === "auto-detect";
  const hasSignatures =
    rule.signatures && Object.keys(rule.signatures).length > 0;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
              <Layers className="w-3 h-3 text-amber-600" />
            </div>
            <div>
              <span className="text-xs text-neutral-900">
                {rule.displayName}
              </span>
              <span className="text-[10px] text-neutral-400 ml-1.5">
                {rule.options.length} {t("options")}
              </span>
            </div>
          </div>
          {rule.autoDetected && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-violet-50 text-violet-600 border-violet-200"
            >
              <Sparkles className="w-3 h-3" />
              {t("autoDetected")}
            </Badge>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1.5 mb-2.5">
          <button
            onClick={() => onModeChange("auto-detect")}
            disabled={!hasSignatures}
            className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors cursor-pointer ${
              isAutoDetect && hasSignatures
                ? "bg-amber-100 border-amber-300 text-amber-700"
                : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
            } ${!hasSignatures ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {t("modeAutoDetect")}
          </button>
          <button
            onClick={() => onModeChange("fixed")}
            className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors cursor-pointer ${
              !isAutoDetect || !hasSignatures
                ? "bg-amber-100 border-amber-300 text-amber-700"
                : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            {t("modeFixed")}
          </button>
        </div>

        {/* Auto-detect info */}
        {isAutoDetect && hasSignatures && (
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-50 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[10px] text-amber-700">
              <p>{t("autoDetectExplanation")}</p>
              <p className="mt-1 text-amber-600">
                {t("autoDetectFallback", { value: rule.fixedValue })}
              </p>
            </div>
          </div>
        )}

        {/* Auto-detect: still need a fallback value */}
        {isAutoDetect && hasSignatures && (
          <div className="mt-2">
            <label className="text-[10px] text-neutral-500 block mb-1">
              {t("fallbackValue")}
            </label>
            <select
              value={rule.fixedValue}
              onChange={(e) => onFixedChange(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-md border border-neutral-200 bg-white"
            >
              {rule.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* No signatures: auto-detect unavailable */}
        {isAutoDetect && !hasSignatures && (
          <div className="flex items-start gap-1.5 p-2 rounded-md bg-neutral-50 border border-neutral-200">
            <Info className="w-3 h-3 text-neutral-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-neutral-500">
              {t("autoDetectUnavailable")}
            </p>
          </div>
        )}

        {/* Fixed mode: option selector */}
        {(!isAutoDetect || !hasSignatures) && (
          <div className="mt-2">
            <label className="text-[10px] text-neutral-500 block mb-1">
              {t("fixedValueLabel")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {rule.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => onFixedChange(opt)}
                  className={`text-[10px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    rule.fixedValue === opt
                      ? "bg-amber-100 border-amber-300 text-amber-700"
                      : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
