import { Skeleton, SkeletonCard } from "../../Skeleton";
import { LOADING_STEP_LABELS } from "../../../types/scanner";
import type { LoadingScreenProps } from "../../../types/scanner";

export function LoadingScreen({
  message = "Extraindo dados da nota fiscal...",
  step,
}: LoadingScreenProps) {
  const currentMessage = step ? LOADING_STEP_LABELS[step] : message;

  return (
    <>
      <SkeletonCard className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton width="60px" height="60px" borderRadius="50%" />
          <div className="flex-1">
            <Skeleton width="180px" height="24px" className="mb-2" />
            <Skeleton width="120px" height="18px" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="skeleton-item bg-white/5 flex flex-col gap-1"
            >
              <Skeleton width="70%" height="16px" />
              <Skeleton width="50%" height="14px" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Mensagem da etapa atual */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-center text-slate-400 text-sm">
          {currentMessage}
        </p>
      </div>

      {/* Aviso persistente */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-3 mx-4">
        <p className="text-amber-400 text-xs text-center font-medium">
          ⏳ Processando... Não feche ou saia desta tela
        </p>
      </div>
    </>
  );
}
