import { memo } from "react";
import { Skeleton } from "./Skeleton";

/**
 * Componente de skeleton para item de busca
 * Reutilizável para listas de loading
 */
export const SearchItemSkeleton = memo(function SearchItemSkeleton() {
  return (
    <div className="item-row bg-white/5 border border-white/5 flex p-4 mb-2 rounded-2xl">
      <div className="flex-1">
        <Skeleton width="60%" height="18px" className="mb-2" />
        <Skeleton width="40%" height="14px" />
      </div>
      <div className="text-right">
        <Skeleton
          width="80px"
          height="20px"
          className="mb-1"
        />
        <Skeleton width="40px" height="12px" className="ml-auto" />
      </div>
    </div>
  );
});
