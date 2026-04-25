import { useId } from 'react';

interface TangleLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function TangleLogo({ size = 40, className = "", showText = true }: TangleLogoProps) {
  // SVG <defs> ids are document-global; scope per-instance so two TangleLogos
  // on the same page don't corrupt each other's gradients.
  const uid = useId();
  const g1 = `${uid}-g1`;
  const g2 = `${uid}-g2`;
  const g3 = `${uid}-g3`;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Logo Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Curved connecting lines representing data flow */}
        <path d="M20 30 Q35 20, 50 30 T80 30" stroke={`url(#${g1})`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M15 50 Q35 40, 50 50 T85 50" stroke={`url(#${g2})`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M20 70 Q35 60, 50 70 T80 70" stroke={`url(#${g3})`} strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Connecting nodes */}
        <circle cx="20" cy="30" r="4" fill="#EF4444" />
        <circle cx="50" cy="30" r="4" fill="#3B82F6" />
        <circle cx="80" cy="30" r="4" fill="#8B5CF6" />

        <circle cx="15" cy="50" r="4" fill="#3B82F6" />
        <circle cx="50" cy="50" r="4" fill="#8B5CF6" />
        <circle cx="85" cy="50" r="4" fill="#EF4444" />

        <circle cx="20" cy="70" r="4" fill="#8B5CF6" />
        <circle cx="50" cy="70" r="4" fill="#EF4444" />
        <circle cx="80" cy="70" r="4" fill="#3B82F6" />

        {/* Brand gradients — intentionally not themed; logo is a fixed mark. */}
        <defs>
          <linearGradient id={g1} x1="20" y1="30" x2="80" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id={g2} x1="15" y1="50" x2="85" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
          <linearGradient id={g3} x1="20" y1="70" x2="80" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="50%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Logo Text */}
      {showText && (
        <span className="text-2xl font-semibold tracking-tight text-white">
          tangle
        </span>
      )}
    </div>
  );
}
