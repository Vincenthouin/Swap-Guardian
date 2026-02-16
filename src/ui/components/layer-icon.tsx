import { Type, Component, Frame, ImageIcon, Spline } from "lucide-react";
import type { LayerType } from "./types";

interface LayerIconProps {
  type: LayerType;
  className?: string;
}

const iconMap: Record<LayerType, React.ElementType> = {
  text: Type,
  instance: Component,
  frame: Frame,
  image: ImageIcon,
  vector: Spline,
};

const colorMap: Record<LayerType, string> = {
  text: "text-violet-500",
  instance: "text-emerald-500",
  frame: "text-blue-500",
  image: "text-amber-500",
  vector: "text-rose-500",
};

export function LayerIcon({ type, className = "" }: LayerIconProps) {
  const Icon = iconMap[type];
  const color = colorMap[type];
  return <Icon className={`w-3.5 h-3.5 ${color} ${className}`} />;
}