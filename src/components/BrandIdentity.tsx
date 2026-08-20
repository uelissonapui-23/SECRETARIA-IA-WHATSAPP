type BrandIdentityProps = {
  variant?: 'compact' | 'large'
  context?: string
  surface?: 'light' | 'dark'
}

export function BrandIdentity({ variant = 'compact', context, surface = 'light' }: BrandIdentityProps) {
  const branding=useBranding()
  const logo=variant==='large'
    ?(surface==='dark'?branding.login_logo_dark_url:branding.login_logo_light_url)||(surface==='dark'?branding.full_logo_dark_url:branding.full_logo_light_url)||branding.login_logo_url||branding.full_logo_url
    :(surface==='dark'?branding.menu_logo_dark_url:branding.menu_logo_light_url)||(surface==='dark'?branding.icon_dark_url:branding.icon_light_url)||branding.menu_logo_url||branding.full_logo_url
  return (
    <div className={`evoria-brand evoria-brand-${variant} brand-on-${surface}`}>
      <img src={logo||'/evoria-logo.png'} alt={branding.app_name} />
      {context && <span>{context}</span>}
    </div>
  )
}
import { useBranding } from '../branding/BrandingProvider'
