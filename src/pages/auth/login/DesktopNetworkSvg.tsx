/** Full-cover network art SVG for the desktop decorative right panel. */
export function DesktopNetworkSvg() {
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <filter id="glow-orange">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glow-blue">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="node-orange" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8692A" />
          <stop offset="100%" stopColor="#c45520" />
        </radialGradient>
        <radialGradient id="node-blue" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4a9eff" />
          <stop offset="100%" stopColor="#2d6fd4" />
        </radialGradient>
        <radialGradient id="node-dim" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2e3a55" />
          <stop offset="100%" stopColor="#1e2840" />
        </radialGradient>
      </defs>

      {/* Orange connection lines */}
      <g stroke="#E8692A" strokeWidth="1" fill="none" opacity="0.25">
        <line x1="400" y1="300" x2="220" y2="160" />
        <line x1="400" y1="300" x2="580" y2="180" />
        <line x1="400" y1="300" x2="600" y2="400" />
        <line x1="400" y1="300" x2="240" y2="430" />
        <line x1="400" y1="300" x2="400" y2="130" />
        <line x1="220" y1="160" x2="100" y2="220" />
        <line x1="220" y1="160" x2="290" y2="60" />
        <line x1="580" y1="180" x2="690" y2="100" />
        <line x1="580" y1="180" x2="700" y2="240" />
        <line x1="600" y1="400" x2="730" y2="380" />
        <line x1="600" y1="400" x2="660" y2="490" />
        <line x1="240" y1="430" x2="130" y2="490" />
        <line x1="240" y1="430" x2="160" y2="340" />
        <line x1="400" y1="130" x2="490" y2="60" />
        <line x1="400" y1="130" x2="310" y2="55" />
      </g>

      {/* Blue secondary lines */}
      <g stroke="#3a82dc" strokeWidth="0.8" fill="none" opacity="0.2">
        <line x1="100" y1="220" x2="160" y2="340" />
        <line x1="290" y1="60" x2="310" y2="55" />
        <line x1="690" y1="100" x2="700" y2="240" />
        <line x1="730" y1="380" x2="660" y2="490" />
        <line x1="130" y1="490" x2="160" y2="340" />
      </g>

      {/* Dim leaf nodes */}
      <g opacity="0.5">
        <circle cx="100" cy="220" r="5" fill="url(#node-dim)" />
        <circle cx="290" cy="60" r="5" fill="url(#node-dim)" />
        <circle cx="690" cy="100" r="5" fill="url(#node-dim)" />
        <circle cx="700" cy="240" r="5" fill="url(#node-dim)" />
        <circle cx="730" cy="380" r="5" fill="url(#node-dim)" />
        <circle cx="660" cy="490" r="5" fill="url(#node-dim)" />
        <circle cx="130" cy="490" r="5" fill="url(#node-dim)" />
        <circle cx="160" cy="340" r="5" fill="url(#node-dim)" />
        <circle cx="490" cy="60" r="5" fill="url(#node-dim)" />
        <circle cx="310" cy="55" r="5" fill="url(#node-dim)" />
      </g>

      {/* Blue intermediate nodes */}
      <g filter="url(#glow-blue)">
        <circle cx="220" cy="160" r="8" fill="url(#node-blue)" opacity="0.85" />
        <circle cx="580" cy="180" r="8" fill="url(#node-blue)" opacity="0.85" />
        <circle cx="600" cy="400" r="8" fill="url(#node-blue)" opacity="0.85" />
        <circle cx="240" cy="430" r="8" fill="url(#node-blue)" opacity="0.85" />
        <circle cx="400" cy="130" r="7" fill="url(#node-blue)" opacity="0.7" />
      </g>

      {/* Pulse rings on CENTER node (400,300) — prototype breathing pulse;
          wrapped in a group that fades in once so the staggered rings ease in. */}
      <g style={{ animation: 'ringsIn 2s ease-in-out both' }}>
        <circle
          cx="400" cy="300" r="42" fill="none" stroke="#E8692A" strokeWidth="1.5"
          style={{
            opacity: 0,
            animation: 'pulse-ring 3s ease-in-out infinite',
          }}
        />
        <circle
          cx="400" cy="300" r="64" fill="none" stroke="#E8692A" strokeWidth="1"
          style={{
            opacity: 0,
            animation: 'pulse-ring 3s ease-in-out .8s infinite',
          }}
        />
        <circle
          cx="400" cy="300" r="88" fill="none" stroke="#E8692A" strokeWidth="0.7"
          style={{
            opacity: 0,
            animation: 'pulse-ring 3s ease-in-out 1.6s infinite',
          }}
        />
      </g>

      {/* Center node: concentric circles + layers icon */}
      <g filter="url(#glow-orange)">
        <circle cx="400" cy="300" r="26" fill="#1a1e2a" stroke="#E8692A" strokeWidth="1.5" opacity="0.9" />
        <circle cx="400" cy="300" r="14" fill="url(#node-orange)" />
        <g
          transform="translate(392,292)"
          fill="none"
          stroke="white"
          strokeWidth="1.3"
          strokeLinejoin="round"
        >
          <path d="M8 1L1 4.5l7 3.5 7-3.5L8 1z" />
          <path d="M1 11.5l7 3.5 7-3.5" />
          <path d="M1 8l7 3.5 7-3.5" />
        </g>
      </g>
    </svg>
  )
}
