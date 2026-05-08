import { Skeleton, SkeletonCard } from "../../Skeleton";
import type { LoadingScreenProps } from "../../../types/scanner";

export function LoadingScreen({ message = "Extraindo dados da nota fiscal..." }: LoadingScreenProps) {
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
      <p className="text-center text-slate-400 mt-4 text-sm">
        {message}
      </p>
    </>
  );
}
