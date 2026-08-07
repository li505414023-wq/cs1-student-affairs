/**
 * 抽象盾形徽记 — 纯几何轮廓，不含真实警徽元素。
 * currentColor 描边 + 金色内纹，em 自适应，装饰用途 aria-hidden。
 */
export function ShieldMark({ className, size = "1em" }: { className?: string; size?: number | string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      focusable="false"
    >
      <path
        d="M12 1.8 20.5 4.9v6.4c0 5.5-3.4 9.8-8.5 11.5C6.9 21.1 3.5 16.8 3.5 11.3V4.9Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M12 1.8 20.5 4.9v6.4c0 5.5-3.4 9.8-8.5 11.5C6.9 21.1 3.5 16.8 3.5 11.3V4.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.3 12.6 12 8.2l3.7 4.4" stroke="var(--color-gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8.2v8.4" stroke="var(--color-gold)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
