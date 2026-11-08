import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getCachedBranding, fetchAuthoritativeTenantContext } from '../../utils/brandingCache';

interface AlliedLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Authoritative Branding Component
 * Complies with strict rule: Only authoritative tenant branding from Platform Admin is rendered.
 */
export const AlliedLogo: React.FC<AlliedLogoProps> = ({ className = '', size = 'md' }) => {
  const [branding, setBranding] = useState<{
    company_name?: string;
    logo_url?: string;
    primary_color?: string;
  } | null>(() => {
    const cached = getCachedBranding('company_pixel_syntax');
    return {
      company_name: cached.companyName,
      logo_url: cached.mainLogoUrl || undefined,
      primary_color: cached.primaryColor || '#059669',
    };
  });

  useEffect(() => {
    let isMounted = true;
    fetchAuthoritativeTenantContext('company_pixel_syntax')
      .then((data) => {
        if (data && isMounted) {
          setBranding({
            company_name: data.companyName,
            logo_url: data.logoUrl || data.mainLogoUrl || undefined,
            primary_color: data.primaryColor || '#059669',
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const isSmall = size === 'sm';
  const isLarge = size === 'lg';

  if (branding?.logo_url) {
    return (
      <div className={`flex items-center gap-2 select-none ${className}`}>
        <img
          src="/pixel-syntax-logo.webp"
          alt={branding.company_name || 'Enterprise Logo'}
          referrerPolicy="no-referrer"
          className={`${
            isSmall ? 'h-6' : isLarge ? 'h-12' : 'h-8'
          } w-auto object-contain`}
        />
      </div>
    );
  }

  const companyName = branding?.company_name || 'Enterprise ERP';
  const primaryColor = branding?.primary_color || '#10b981';

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <div
        className={`${
          isSmall ? 'w-6 h-6 text-xs' : isLarge ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm'
        } rounded-lg flex items-center justify-center text-white font-bold shadow-xs`}
        style={{ backgroundColor: primaryColor }}
      >
        <Building2 className={`${isSmall ? 'w-3.5 h-3.5' : isLarge ? 'w-6 h-6' : 'w-4 h-4'}`} />
      </div>
      {!isSmall && (
        <span className="font-bold text-slate-900 dark:text-white tracking-tight text-sm">
          {companyName}
        </span>
      )}
    </div>
  );
};
