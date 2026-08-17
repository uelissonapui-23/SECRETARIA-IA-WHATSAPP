export type AiReleaseStatus='draft'|'approved'|'retired'
export function aiReleaseStatusLabel(status:AiReleaseStatus){return status==='approved'?'Aprovada':status==='retired'?'Arquivada':'Rascunho'}
export function canActivateRelease(status:AiReleaseStatus){return status==='approved'}
export function formatReleaseVersion(version:number){return `v${version}`}
