import { useTranslation } from 'react-i18next'

/** Mobile-only hero panel — decorative network art + AMS label overlay. */
export function MobileHero() {
  const { t } = useTranslation('login')

  return (
    <div
      className="lg:hidden flex-shrink-0 relative h-[clamp(200px,28dvh,240px)]"
      aria-hidden="true"
      style={{ background: '#0f111a', overflow: 'hidden' }}
    >
      {/* Orange glow — centered */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(232,105,42,0.22) 0%, rgba(232,105,42,0.06) 40%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Blue accent — top-right */}
      <div
        style={{
          position: 'absolute',
          top: '-60px',
          right: '-60px',
          width: '260px',
          height: '260px',
          background: 'radial-gradient(circle, rgba(56,130,220,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* Dot grid */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          opacity: 0.12,
        }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="mdots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#4a5a7a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mdots)" />
      </svg>
      {/* Network SVG — viewBox 393×300, slice */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
        viewBox="0 0 393 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <filter id="mg-orange">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="mg-blue">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="mno" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E8692A" />
            <stop offset="100%" stopColor="#c45520" />
          </radialGradient>
          <radialGradient id="mnb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4a9eff" />
            <stop offset="100%" stopColor="#2d6fd4" />
          </radialGradient>
          <radialGradient id="mnd" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2e3a55" />
            <stop offset="100%" stopColor="#1e2840" />
          </radialGradient>
        </defs>
        {/* Orange connection lines */}
        <g stroke="#E8692A" strokeWidth="0.8" fill="none" opacity="0.22">
          <line x1="196" y1="150" x2="100" y2="80" />
          <line x1="196" y1="150" x2="290" y2="85" />
          <line x1="196" y1="150" x2="300" y2="210" />
          <line x1="196" y1="150" x2="95" y2="220" />
          <line x1="196" y1="150" x2="196" y2="55" />
          <line x1="100" y1="80" x2="44" y2="110" />
          <line x1="100" y1="80" x2="136" y2="28" />
          <line x1="290" y1="85" x2="348" y2="50" />
          <line x1="290" y1="85" x2="355" y2="130" />
          <line x1="300" y1="210" x2="362" y2="195" />
          <line x1="95" y1="220" x2="38" y2="255" />
          <line x1="95" y1="220" x2="50" y2="170" />
        </g>
        {/* Blue secondary lines */}
        <g stroke="#3a82dc" strokeWidth="0.6" fill="none" opacity="0.15">
          <line x1="44" y1="110" x2="50" y2="170" />
          <line x1="348" y1="50" x2="355" y2="130" />
          <line x1="362" y1="195" x2="38" y2="255" />
        </g>
        {/* Dim leaf nodes */}
        <g opacity="0.45">
          <circle cx="44" cy="110" r="3.5" fill="url(#mnd)" />
          <circle cx="136" cy="28" r="3.5" fill="url(#mnd)" />
          <circle cx="348" cy="50" r="3.5" fill="url(#mnd)" />
          <circle cx="355" cy="130" r="3.5" fill="url(#mnd)" />
          <circle cx="362" cy="195" r="3.5" fill="url(#mnd)" />
          <circle cx="38" cy="255" r="3.5" fill="url(#mnd)" />
          <circle cx="50" cy="170" r="3.5" fill="url(#mnd)" />
          <circle cx="196" cy="55" r="3.5" fill="url(#mnd)" />
        </g>
        {/* Blue intermediate nodes */}
        <g filter="url(#mg-blue)">
          <circle cx="100" cy="80" r="5.5" fill="url(#mnb)" opacity="0.85" />
          <circle cx="290" cy="85" r="5.5" fill="url(#mnb)" opacity="0.85" />
          <circle cx="300" cy="210" r="5.5" fill="url(#mnb)" opacity="0.85" />
          <circle cx="95" cy="220" r="5.5" fill="url(#mnb)" opacity="0.85" />
        </g>
        {/* Pulse rings on center node (196,150) — prototype breathing pulse;
            group fades in once so the staggered rings ease in on mount. */}
        <g style={{ animation: 'ringsIn 2s ease-in-out both' }}>
          <circle
            cx="196"
            cy="150"
            r="28"
            fill="none"
            stroke="#E8692A"
            strokeWidth="1"
            style={{
              opacity: 0,
              animation: 'pulse-ring-m 3s ease-in-out infinite',
            }}
          />
          <circle
            cx="196"
            cy="150"
            r="42"
            fill="none"
            stroke="#E8692A"
            strokeWidth=".7"
            style={{
              opacity: 0,
              animation: 'pulse-ring-m 3s ease-in-out .9s infinite',
            }}
          />
        </g>
        {/* Center node */}
        <g filter="url(#mg-orange)">
          <circle cx="196" cy="150" r="18" fill="#1a1e2a" stroke="#E8692A" strokeWidth="1.2" opacity="0.9" />
          <circle cx="196" cy="150" r="9" fill="url(#mno)" />
          <g
            transform="translate(191,145)"
            fill="none"
            stroke="white"
            strokeWidth="1"
            strokeLinejoin="round"
          >
            <path d="M5 0.5L0 3l5 2.5 5-2.5L5 0.5z" />
            <path d="M0 8l5 2.5 5-2.5" />
            <path d="M0 5.5l5 2.5 5-2.5" />
          </g>
        </g>
      </svg>
      {/* Scan line — sweeps hero top→bottom via global `scan` keyframe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '1.5px',
          background: 'linear-gradient(90deg,transparent,rgba(232,105,42,0.45),transparent)',
          pointerEvents: 'none',
          animation: 'scan 5s ease-in-out infinite',
        }}
      />
      {/* AMS label overlay — bottom of hero */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 24px',
          background: 'linear-gradient(to top,#0f111a 0%,transparent 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              background: '#E8692A',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p style={{ color: '#fff', fontSize: '13px', fontWeight: 700, lineHeight: 1.1 }}>AMS</p>
            <p style={{ color: '#4a5065', fontSize: '10px', lineHeight: 1.1 }}>{t('hero.brand')}</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 6px #22c55e',
              }}
            />
            <span style={{ color: '#22c55e', fontSize: '10px', fontWeight: 500 }}>{t('hero.online')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
