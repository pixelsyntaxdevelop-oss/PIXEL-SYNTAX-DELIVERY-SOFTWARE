import React, { useState } from 'react';

export interface LoginBrandPanelProps {
  loginHeroUrl?: string | null;
  companyName?: string;
  portalTitle?: string | null;
  loginTagline?: string | null;
  logoUrl?: string | null;
  className?: string;
  isLoading?: boolean;
}

/**
 * Single Shared Login Branding Renderer
 * Enforces identical container styling, aspect ratio, image fit, and responsive rules
 * across both the real /login page and the Platform Admin Live Login Screen Preview.
 *
 * LOGIN LEFT PANEL: uses /pixel-syntax-logo.webp as the complete left panel image.
 * Renders ONLY the approved hero artwork with object-fit: contain, preserving
 * the full image aspect ratio without crop, stretch, overlay text, or generated SVG.
 */
export const LoginBrandPanel: React.FC<LoginBrandPanelProps> = ({
  loginHeroUrl,
  companyName = 'Pixel Syntax',
  className = '',
}) => {
  const effectiveHeroUrl = loginHeroUrl === '/pixel-syntax-logo.webp' ? loginHeroUrl : '/pixel-syntax-logo.webp';
  const [heroImageError, setHeroImageError] = useState(false);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  React.useEffect(() => {
    setHeroImageError(false);
  }, [effectiveHeroUrl]);

  return (
    <div
      id="login-brand-panel"
      className={`w-full sm:w-[438px] max-w-full sm:max-w-[48%] shrink-0 overflow-hidden flex items-center justify-center relative ${className}`}
      style={{
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: 0,
        width: '438px',
        maxWidth: '100%',
        aspectRatio: '506 / 562',
      }}
    >
      <img
        ref={imgRef}
        id="login-hero-artwork"
        src={heroImageError ? '/pixel-syntax-logo.webp' : effectiveHeroUrl}
        alt=""
        aria-label={companyName}
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain object-center block select-none"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          display: 'block',
        }}
        onError={() => {
          if (!heroImageError) {
            setHeroImageError(true);
          }
        }}
      />
    </div>
  );
};
