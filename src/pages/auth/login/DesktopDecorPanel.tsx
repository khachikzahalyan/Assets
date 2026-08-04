import { useTranslation } from 'react-i18next'
import { DesktopNetworkSvg } from './DesktopNetworkSvg'

/** Desktop-only right decorative panel: network art, glows, stats cards. */
export function DesktopDecorPanel() {
  const { t } = useTranslation('login')

  return (
    <div
      className="hidden lg:flex flex-1 relative overflow-hidden"
      style={{ background: '#0f111a' }}
      aria-hidden="true"
    >

      {/* 1. Orange radial glow — CENTERED */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '40%',
          transform: 'translate(-50%, -50%)',
          width: '43.75rem',
          height: '43.75rem',
          background: 'radial-gradient(circle, rgba(232,105,42,0.18) 0%, rgba(232,105,42,0.05) 40%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 2. Blue glow — TOP-RIGHT */}
      <div
        style={{
          position: 'absolute',
          top: '-6.25rem',
          right: '-5rem',
          width: '31.25rem',
          height: '31.25rem',
          background: 'radial-gradient(circle, rgba(56,130,220,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* 3. Dot grid */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          opacity: 0.15,
        }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#4a5a7a" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* 4. Network SVG — full cover, viewBox 800×600, slice */}
      <DesktopNetworkSvg />

      {/* 5. Giant AMS — anchored BOTTOM-RIGHT */}
      <div
        style={{
          position: 'absolute',
          bottom: '-2.5rem',
          right: '-1.875rem',
          fontSize: '17.5rem',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.025)',
          letterSpacing: '-0.625rem',
          lineHeight: 1,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        AMS
      </div>

      {/* 6. Scan line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(232,105,42,0.4), transparent)',
          animation: 'scan 6s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />

      {/* 7. Info card — bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: '2.5rem',
          left: '2.5rem',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0.875rem',
          padding: '1.25rem 1.5rem',
          maxWidth: '17.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
          <div
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 0.5rem #22c55e',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: '#6b7280',
              fontSize: '0.6875rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            {t('visual.statusOnline')}
          </span>
        </div>
        <p style={{ color: '#e5e7eb', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>
          {t('visual.infoTitle')}
        </p>
        <p style={{ color: '#4a5065', fontSize: '0.75rem', lineHeight: 1.5 }}>
          {t('visual.infoDesc')}
        </p>
      </div>

      {/* 8. Stats cards — top-right, right-aligned text */}
      <div
        style={{
          position: 'absolute',
          top: '2.5rem',
          right: '2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          alignItems: 'flex-end',
        }}
      >
        {/* Roles card — orange tinted */}
        <div
          style={{
            background: 'rgba(232,105,42,0.12)',
            border: '1px solid rgba(232,105,42,0.25)',
            borderRadius: '0.625rem',
            padding: '0.625rem 1rem',
            textAlign: 'right',
          }}
        >
          <p style={{ color: '#E8692A', fontSize: '1.125rem', fontWeight: 700, lineHeight: 1 }}>
            {t('visual.rolesValue')}
          </p>
          <p style={{ color: '#4a5065', fontSize: '0.6875rem', marginTop: '0.125rem' }}>
            {t('visual.rolesDesc')}
          </p>
        </div>

        {/* QR card — neutral */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '0.625rem',
            padding: '0.625rem 1rem',
            textAlign: 'right',
          }}
        >
          <p style={{ color: '#e5e7eb', fontSize: '1.125rem', fontWeight: 700, lineHeight: 1 }}>
            {t('visual.qrValue')}
          </p>
          <p style={{ color: '#4a5065', fontSize: '0.6875rem', marginTop: '0.125rem' }}>
            {t('visual.qrDesc')}
          </p>
        </div>
      </div>

    </div>
  )
}
