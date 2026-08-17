import{describe,expect,it}from'vitest'
import{aiReleaseStatusLabel,canActivateRelease,formatReleaseVersion}from'./aiRelease'
describe('ai release governance',()=>{it('só ativa release aprovada',()=>{expect(canActivateRelease('approved')).toBe(true);expect(canActivateRelease('draft')).toBe(false)});it('formata versão',()=>expect(formatReleaseVersion(12)).toBe('v12'));it('rotula status',()=>expect(aiReleaseStatusLabel('retired')).toBe('Arquivada'))})
