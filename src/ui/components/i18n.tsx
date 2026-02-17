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

  // ─── Step 3 ───
  step3Instruction:   { fr: "Vérifiez le récapitulatif des associations puis lancez la conversion. Toutes les instances de l'ancien composant seront remplacées automatiquement.", en: "Review the mapping summary, then launch the conversion. All instances of the old component will be replaced automatically." },
  summary:            { fr: "Récapitulatif",          en: "Summary" },
  conversionScope:    { fr: "Portée de la conversion", en: "Conversion scope" },
  currentPage:        { fr: "Page active",     en: "Current page" },
  currentPageOnly:    { fr: "Page courante uniquement", en: "Current page only" },
  allDocument:        { fr: "Tout le document",en: "Entire document" },
  allPages:           { fr: "Toutes les pages",en: "All pages" },
  options:            { fr: "Options",         en: "Options" },
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
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("fr");

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let str = translations[key]?.[lang] ?? key;
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