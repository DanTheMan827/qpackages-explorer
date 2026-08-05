import type { SVGProps } from "react";
type P = SVGProps<SVGSVGElement>;
function I({ children, ...props }: P) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}
export const PackageIcon = (p: P) => (
  <I {...p}>
    <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
    <path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12.1V21" />
  </I>
);
export const SearchIcon = (p: P) => (
  <I {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </I>
);
export const ExternalLinkIcon = (p: P) => (
  <I {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </I>
);
export const RefreshIcon = (p: P) => (
  <I {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </I>
);
export const CopyIcon = (p: P) => (
  <I {...p}>
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </I>
);
export const CheckIcon = (p: P) => (
  <I {...p}>
    <path d="m5 12 4 4L19 6" />
  </I>
);
export const ChevronIcon = (p: P) => (
  <I {...p}>
    <path d="m9 18 6-6-6-6" />
  </I>
);
export const CodeIcon = (p: P) => (
  <I {...p}>
    <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />
  </I>
);
export const LinkIcon = (p: P) => (
  <I {...p}>
    <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
    <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
  </I>
);
export const AlertIcon = (p: P) => (
  <I {...p}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 4.4 2.8 17.5A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.5L13.7 4.4a2 2 0 0 0-3.4 0Z" />
  </I>
);
export const SunMoonIcon = (p: P) => (
  <I {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 2V1M8 15v-1M2 8H1M15 8h-1M3.8 3.8l-.7-.7M12.9 12.9l-.7-.7M12.2 3.8l.7-.7M3.1 12.9l.7-.7" />
    <path d="M15.5 9.8A6 6 0 1 0 21 18a7 7 0 0 1-5.5-8.2Z" />
  </I>
);
