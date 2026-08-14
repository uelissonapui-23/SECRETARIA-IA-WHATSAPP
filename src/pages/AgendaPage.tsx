export function AgendaPage() { return <Empty title="Agenda" text="A agenda interna será a fonte principal dos compromissos. Google Agenda fica preparado para uma integração futura." /> }
function Empty({title,text}:{title:string,text:string}) {return <div className="empty-page"><span className="eyebrow">V1</span><h1>{title}</h1><p>{text}</p></div>}
