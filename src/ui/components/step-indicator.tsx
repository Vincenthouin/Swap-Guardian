import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  steps: { label: string; description: string }[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div key={step.label} className="flex items-center flex-1 last:flex-0">
            {/* Cercle + label empilés verticalement */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition-all duration-300 ${
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isActive
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-xs">{stepNumber}</span>
                )}
              </div>
              <span
                className={`text-[10px] whitespace-nowrap ${
                  isActive
                    ? "text-neutral-900"
                    : isCompleted
                      ? "text-emerald-600"
                      : "text-neutral-400"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Ligne de connexion */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2 -mt-5">
                <div className="h-px bg-neutral-200 relative">
                  <div
                    className={`absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500 ${
                      isCompleted ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}