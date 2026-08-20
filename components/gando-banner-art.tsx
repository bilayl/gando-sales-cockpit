export function GandoBannerArt({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg
        className="absolute -left-[9%] -top-[125%] h-[340%] w-[122%] max-w-none"
        viewBox="0 0 926 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M1446.69 -2084L395.14 83.1529C296.571 286.297 230.107 507.663 198.477 738.167L-0.000169253 2184.59L2151.36 -1572.3L1446.69 -2084Z"
          fill="#816DF4"
          fillOpacity="0.20"
        />
      </svg>

      <svg
        className="absolute -bottom-[205%] -right-[28%] h-[350%] w-[118%] max-w-none rotate-180 opacity-45"
        viewBox="0 0 926 1080"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M1446.69 -2084L395.14 83.1529C296.571 286.297 230.107 507.663 198.477 738.167L-0.000169253 2184.59L2151.36 -1572.3L1446.69 -2084Z"
          fill="#816DF4"
          fillOpacity="0.20"
        />
      </svg>
    </div>
  );
}
