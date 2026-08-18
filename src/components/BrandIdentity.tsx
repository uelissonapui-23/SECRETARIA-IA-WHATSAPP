type BrandIdentityProps = {
  variant?: 'compact' | 'large'
  context?: string
}

export function BrandIdentity({ variant = 'compact', context }: BrandIdentityProps) {
  return (
    <div className={`evoria-brand evoria-brand-${variant}`}>
      <img src="/evoria-logo.png" alt="evoria Secretaria IA" />
      {context && <span>{context}</span>}
    </div>
  )
}
