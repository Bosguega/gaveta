import React from "react";

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  className = "",
  style
}) => {
  return (
    <div
      className={`skeleton-line ${className}`}
      style={{
        width: width || "100%",
        height: height || "20px",
        borderRadius: borderRadius || "6px",
        ...style
      }}
    />
  );
};

export const SkeletonCard: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className = "",
  style
}) => (
  <div className={`glass-card ${className}`} style={style}>
    {children}
  </div>
);

export const ReceiptSkeleton: React.FC = () => (
  <SkeletonCard>
    <div className="flex justify-between mb-4">
      <div className="flex-1">
        <Skeleton width="70%" height="24px" className="mb-2" />
        <Skeleton width="40%" height="16px" />
      </div>
      <Skeleton width="60px" height="24px" />
    </div>
    <div className="items-list">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="skeleton-item flex justify-between items-center gap-4">
          <div className="flex-1">
            <Skeleton width="80%" height="16px" className="mb-1" />
            <Skeleton width="50%" height="14px" />
          </div>
          <Skeleton width="50px" height="20px" />
        </div>
      ))}
    </div>
  </SkeletonCard>
);

export const ProductSkeleton: React.FC = () => (
  <SkeletonCard className="flex justify-between items-center">
    <div>
      <Skeleton width="180px" height="20px" className="mb-2" />
      <Skeleton width="120px" height="16px" />
    </div>
    <Skeleton width="80px" height="32px" borderRadius="8px" />
  </SkeletonCard>
);

export const TabSkeleton: React.FC = () => (
  <div className="glass-card p-8 text-center">
    <div className="skeleton-line w-[60%] h-[20px] mx-auto mb-4" />
    <div className="skeleton-line w-[80%] h-[16px] mx-auto" />
  </div>
);
