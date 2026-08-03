interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const SunIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const MoonIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

export const GridIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </svg>
);

export const TargetIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

export const CheckIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={2.4}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const CrossIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const ArrowRightIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const ArrowLeftIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 12H5M11 6l-6 6 6 6" />
  </svg>
);

export const RefreshIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11a8 8 0 1 0-.7 4.3" />
    <path d="M20 4.5V11h-6.2" />
  </svg>
);

export const FlameIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 22a6 6 0 0 0 6-6c0-4-3-5.5-3-9 0 0-2.5 1.5-2.5 4.5C12.5 9 11 7.5 11 5.5 8.5 7.5 6 10 6 16a6 6 0 0 0 6 6Z" />
  </svg>
);

export const SparkIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18.1l-1.8-5.5-5.7-1.8L10.2 9 12 3.5Z" />
    <path d="M18.5 16.5 19.3 19l2.2.7-2.2.8-.8 2.5-.8-2.5-2.2-.8 2.2-.7.8-2.5Z" />
  </svg>
);

export const ShuffleIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 6h3.5c1.6 0 2.6.9 3.4 2.2l3.2 5.6c.8 1.3 1.8 2.2 3.4 2.2H21" />
    <path d="M3 18h3.5c1.6 0 2.6-.9 3.4-2.2l.7-1.2" />
    <path d="M13.6 9.4l.5-.9c.8-1.4 1.8-2.5 3.4-2.5H21" />
    <path d="M18 3l3 3-3 3M18 15l3 3-3 3" />
  </svg>
);

export const BookIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M4 4.5h5.5A2.5 2.5 0 0 1 12 7v13a2 2 0 0 0-2-2H4Z" />
    <path d="M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v13a2 2 0 0 1 2-2h6Z" />
  </svg>
);

export const BoltIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />
  </svg>
);

export const FlagIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5 21V4" />
    <path d="M5 4.5h11l-1.8 3.5L16 11.5H5Z" />
  </svg>
);

export const ClockIcon = ({ size = 18, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
