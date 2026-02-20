import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Lang = "fr" | "en";

const translations = {
  // ─── General ───
  pluginTitle:        { fr: "Swap Guardian",  en: "Swap Guardian" },
  pluginSubtitle:     { fr: "Remplacez vos composants en préservant vos contenus", en: "Replace your components while preserving content" },
  plugin:             { fr: "Plugin",         en: "Plugin" },
  next:               { fr: "Étape suivante", en: "Next step" },
  back:               { fr: "Retour",         en: "Back" },

  // ─── Steps ───
  step1Label:         { fr: "Sélection",   en: "Selection" },
  step1Desc:          { fr: "Sélectionner les layers de l'ancien composant", en: "Select layers from the old component" },
  step2Label:         { fr: "Mapping",     en: "Mapping" },
  step2Desc:          { fr: "Associer les layers au nouveau composant", en: "Map layers to the new component" },
  step2bLabel:        { fr: "Properties",  en: "Properties" },
  step2bDesc:         { fr: "Configurer toggles et variants", en: "Configure toggles and variants" },
  step3Label:         { fr: "Conversion",  en: "Conversion" },
  step3Desc:          { fr: "Remplacer toutes les instances", en: "Replace all instances" },

  // ─── Step 1 ───
  step1Instruction:   { fr: "Sélectionnez le composant que vous souhaitez mettre à jour (instance ou source), puis ajoutez les calques dont vous souhaitez conserver le contenu.", en: "Select the component you want to update (instance or source), then add the layers whose content you want to preserve." },
  sourceComponent:    { fr: "Composant source",       en: "Source component" },
  selectingComponent: { fr: "Lecture de la sélection Figma…", en: "Reading Figma selection…" },
  clickToSelect:      { fr: "Sélectionnez le composant dans Figma puis cliquez ici", en: "Select the component in Figma then click here" },
  layersDetected:     { fr: "{count} layers détectés", en: "{count} layers detected" },
  layersToKeep:       { fr: "Layers à conserver",     en: "Layers to keep" },
  noLayersYet:        { fr: "Aucun layer ajouté. Utilisez le bouton ci-dessous.", en: "No layers added. Use the button below." },
  addLayer:           { fr: "Ajouter un layer",       en: "Add a layer" },
  selectNewLayer:     { fr: "Sélectionner le nouveau layer", en: "Select the new layer" },
  chooseLayer:        { fr: "Choisir un layer à conserver",  en: "Choose a layer to keep" },
  noLayersInComp:     { fr: "Aucun layer exploitable trouvé dans ce composant.", en: "No usable layers found in this component." },
  inComponent:        { fr: "dans", en: "in" },
  added:              { fr: "ajouté", en: "added" },
  layerAlreadyAdded:  { fr: "Ce layer est déjà dans la liste.", en: "This layer is already in the list." },

  // ─── Step 2 ───
  step2Instruction:   { fr: "Sélectionnez maintenant le nouveau composant que vous souhaitez insérer, puis associez chaque calque de l'ancien composant à celui correspondant dans le nouveau", en: "Select the new component, then map each layer from the old one to the corresponding layer in the new one." },
  targetComponent:    { fr: "Composant cible",          en: "Target component" },
  clickToSelectNew:   { fr: "Sélectionnez le nouveau composant dans Figma, puis cliquez ici", en: "Select the new component in Figma, then click here" },
  layersAvailable:    { fr: "{count} layers disponibles",en: "{count} layers available" },
  associations:       { fr: "Associations",              en: "Associations" },
  complete:           { fr: "Complet",    en: "Complete" },
  associate:          { fr: "Associer",   en: "Map" },
  choosing:           { fr: "Choisir…",   en: "Choose…" },
  mapLayerTo:         { fr: "Associer « {name} » à :",  en: "Map \"{name}\" to:" },
  noCompatibleLayer:  { fr: "Aucun layer compatible",    en: "No compatible layer" },
  alreadyMapped:      { fr: "associé",   en: "mapped" },

  // ─── Step 2b — Property Inference Engine ───
  step2bInstruction:  { fr: "Le nouveau composant possède des propriétés configurables. Swap Guardian a pré-rempli les règles automatiquement — vérifiez et ajustez si nécessaire.", en: "The new component has configurable properties. Swap Guardian pre-filled the rules automatically — review and adjust as needed." },
  loadingProperties:  { fr: "Analyse des propriétés…", en: "Analyzing properties…" },
  noProperties:       { fr: "Aucune propriété configurable", en: "No configurable properties" },
  noPropertiesDesc:   { fr: "Le nouveau composant n'a pas de propriétés supplémentaires à configurer. Vous pouvez passer directement à la conversion.", en: "The new component has no additional properties to configure. You can proceed to conversion." },

  // Section A — Carry-over
  carryOverSection:   { fr: "Reportées automatiquement", en: "Carried over automatically" },
  carryOverExplanation: { fr: "La propriété « {old} » sera reportée telle quelle de chaque instance source vers « {new} ».", en: "The \"{old}\" property will be carried over as-is from each source instance to \"{new}\"." },
  switchToFixed:      { fr: "Passer en valeur fixe", en: "Switch to fixed value" },
  switchToCarryOver:  { fr: "Reporter depuis l'ancien", en: "Carry over from old" },
  showValueMapping:   { fr: "Voir le mapping des valeurs", en: "Show value mapping" },
  hideValueMapping:   { fr: "Masquer le mapping", en: "Hide value mapping" },

  // Section B — Toggles
  togglesSection:     { fr: "Toggles (nouveaux)", en: "Toggles (new)" },
  modePerInstance:    { fr: "Par instance", en: "Per instance" },
  modeFixed:          { fr: "Valeur fixe", en: "Fixed value" },
  activateWhenVisible:{ fr: "Activer quand ce layer est visible :", en: "Enable when this layer is visible:" },
  noLayerSelected:    { fr: "Aucun layer sélectionné", en: "No layer selected" },
  noMatchDefaultOff:  { fr: "Aucun layer correspondant trouvé — sera OFF par défaut pour toutes les instances.", en: "No matching layer found — will default to OFF for all instances." },
  boolExplanation:    { fr: "Pour chaque instance : si « {layer} » est visible → {prop} = ON, sinon {prop} = OFF", en: "For each instance: if \"{layer}\" is visible → {prop} = ON, else {prop} = OFF" },
  fixedValueLabel:    { fr: "Valeur fixe", en: "Fixed value" },

  // Section C — Variants
  variantsSection:    { fr: "Variants (nouveaux)", en: "Variants (new)" },
  modeAutoDetect:     { fr: "Auto-detect", en: "Auto-detect" },
  autoDetected:       { fr: "Auto", en: "Auto" },
  autoDetectExplanation: { fr: "Swap Guardian analysera la structure de chaque instance pour choisir automatiquement la meilleure option.", en: "Swap Guardian will analyze each instance's structure to automatically choose the best option." },
  autoDetectFallback: { fr: "Si aucun match fiable : « {value} » sera utilisé.", en: "If no reliable match: \"{value}\" will be used." },
  autoDetectUnavailable: { fr: "Auto-detect non disponible pour ce variant (aucune signature structurelle). Utilisez une valeur fixe.", en: "Auto-detect unavailable for this variant (no structural signatures). Use a fixed value." },
  fallbackValue:      { fr: "Valeur de repli", en: "Fallback value" },
  options:            { fr: "options", en: "options" },
  preFilled:          { fr: "Pré-rempli", en: "Pre-filled" },
  defaultLabel:       { fr: "défaut", en: "default" },

  // ─── Step 3 ───
  step3Instruction:   { fr: "Vérifiez le récapitulatif des associations puis lancez la conversion. Toutes les instances de l'ancien composant seront remplacées automatiquement.", en: "Review the mapping summary, then launch the conversion. All instances of the old component will be replaced automatically." },
  summary:            { fr: "Récapitulatif",          en: "Summary" },
  conversionScope:    { fr: "Portée de la conversion", en: "Conversion scope" },
  currentPage:        { fr: "Page active",     en: "Current page" },
  currentPageOnly:    { fr: "Page courante uniquement", en: "Current page only" },
  allDocument:        { fr: "Tout le document",en: "Entire document" },
  allPages:           { fr: "Toutes les pages",en: "All pages" },
  optionsLabel:       { fr: "Options",         en: "Options" },
  preserveColors:     { fr: "Conserver les couleurs du composant source", en: "Preserve source component colors" },
  preserveColorsOn:   { fr: "Les couleurs des instances source seront conservées", en: "Source instance colors will be preserved" },
  preserveColorsOff:  { fr: "Les couleurs du nouveau composant seront appliquées", en: "New component colors will be applied" },
  launchConversion:   { fr: "Lancer la conversion",     en: "Launch conversion" },
  converting:         { fr: "Conversion en cours…",      en: "Converting…" },
  replacingIn:        { fr: "Remplacement des instances dans", en: "Replacing instances in" },
  theCurrentPage:     { fr: "la page active",       en: "the current page" },
  theWholeDocument:   { fr: "tout le document",     en: "the entire document" },
  conversionDone:     { fr: "Conversion terminée",  en: "Conversion complete" },
  instancesConverted: { fr: "{converted} instance{s} convertie{s} sur {total}", en: "{converted} of {total} instance{s} converted" },
  found:              { fr: "Trouvées",   en: "Found" },
  converted:          { fr: "Converties", en: "Converted" },
  errors:             { fr: "Erreurs",    en: "Errors" },
  pageDetail:         { fr: "Détail par page", en: "Page detail" },
  instanceWord:       { fr: "instance",   en: "instance" },
  instancesWord:      { fr: "instances",  en: "instances" },
  failedInstances:    { fr: "Instances en erreur", en: "Failed instances" },
  newConversion:      { fr: "Nouvelle conversion", en: "New conversion" },
  selectInCanvas:     { fr: "Sélectionner dans le canvas", en: "Select in canvas" },

  // Step 3 — Property rules summary
  carryOverSummary:   { fr: "Properties reportées", en: "Carried over" },
  togglesSummary:     { fr: "Toggles", en: "Toggles" },
  variantsSummary:    { fr: "Variants", en: "Variants" },
  visibilityOf:       { fr: "visibilité de « {name} »", en: "visibility of \"{name}\"" },
  defaultValueSummary:{ fr: "= {value} (défaut)", en: "= {value} (default)" },
  carryOverFrom:      { fr: "reporté de « {name} »", en: "carried from \"{name}\"" },
  fixedAt:            { fr: "fixé à « {value} »", en: "fixed at \"{value}\"" },
  autoDetectMode:     { fr: "auto-detect (repli : {value})", en: "auto-detect (fallback: {value})" },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLang(): Lang {
  try {
    const browserLang = navigator.language || navigator.languages?.[0] || "en";
    return browserLang.startsWith("fr") ? "fr" : "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectLang);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let str: string = translations[key]?.[lang] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
