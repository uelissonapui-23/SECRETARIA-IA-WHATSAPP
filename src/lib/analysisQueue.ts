export type AnalysisJobStatus='pending'|'processing'|'done'|'failed'
export type AnalysisQueueJob={status:AnalysisJobStatus;attempts:number;max_attempts:number;last_error:string|null}

export function canRetryAnalysisJob(job:AnalysisQueueJob){return job.status==='failed'&&job.attempts<job.max_attempts}
export function queueSeverity(pending:number,failed:number,exhausted:number){if(exhausted>0)return 'critical' as const;if(failed>0)return 'attention' as const;if(pending>10)return 'busy' as const;return 'healthy' as const}
export function queueLabel(status:AnalysisJobStatus){return status==='pending'?'Aguardando':status==='processing'?'Processando':status==='done'?'Concluído':'Falhou'}
