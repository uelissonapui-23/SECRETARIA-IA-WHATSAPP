type BrandIdentityProps = {
  variant?: 'compact' | 'large'
  context?: string
}

export function BrandIdentity({ variant = 'compact', context }: BrandIdentityProps) {
  const branding=useBranding()
  const logo=variant==='large'?(branding.login_logo_url||branding.full_logo_url):(branding.menu_logo_url||branding.full_logo_url)
  return (
    <div className={`evoria-brand evoria-brand-${variant}`}>
      <img src={logo||'/evoria-logo.png'} alt={branding.app_name} />
      {context && <span>{context}</span>}
    </div>
  )
}
import { useBranding } from '../branding/BrandingProvider'
