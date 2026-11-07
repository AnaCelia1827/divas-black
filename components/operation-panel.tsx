'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, Clock3, Pencil, X } from 'lucide-react';
import type { AppData, Appointment, AssistantDraft, Client, Command, Material, Service, StockMovement } from '@/lib/types';
import { currency, dateKey, dateLabel, timeLabel, toISO, uid, centsFromInput, readableText } from '@/lib/format';
import { getAppointmentBalance, getAppointmentPaid } from '@/lib/domain';
import './operation-panel.css';

export type Operation =
 | { kind: 'appointment'; appointment?: Appointment; date?: string; draft?: AssistantDraft; serviceId?: string }
 | { kind: 'appointmentDetail'; appointment: Appointment }
 | { kind: 'client'; client?: Client }
 | { kind: 'clientDetail'; client: Client }
 | { kind: 'service'; service?: Service }
 | { kind: 'cash'; direction: 'in' | 'out'; appointmentId?: string }
 | { kind: 'material'; material?: Material }
 | { kind: 'stock'; materialId?: string; stockKind?: StockMovement['kind']; quantity?: number }
 | { kind: 'demand'; materialId?: string }
 | { kind: 'refund'; appointmentId: string };
interface Props { operation: Operation | null; onClose: () => void; data: AppData; busy: boolean; error?: string | null; onCommand: (command: Command) => Promise<boolean> }
interface FormProps { data: AppData; busy: boolean; save: (command: Command) => Promise<boolean>; close: () => void; navigate: (operation: Operation) => void }
const moneyInput = (value: number) => (value / 100).toFixed(2);
const statusNames = { confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado', noshow: 'Não compareceu' };
const valueOf = (event: FormEvent<HTMLFormElement>) => new FormData(event.currentTarget);
const stringOf = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={`op-field${wide ? ' op-wide' : ''}`}><span>{label}</span>{children}</label>; }
function Submit({ busy, children = 'Salvar' }: { busy: boolean; children?: ReactNode }) { return <button className="op-primary op-submit" type="submit" disabled={busy}>{busy ? 'Salvando…' : <><Check size={19}/>{children}</>}</button>; }
function Empty({children}:{children:ReactNode}) { return <p className="op-empty">{children}</p>; }

export function OperationPanel({ operation, onClose, data, busy, error, onCommand }: Props) {
 const [current, setCurrent] = useState(operation);
 const [localError, setLocalError] = useState('');
 const panel = useRef<HTMLDivElement>(null);
 const isOpen = Boolean(operation && current);
 useEffect(() => { setCurrent(operation); setLocalError(''); }, [operation]);
 useEffect(() => {
  if (!isOpen) return;
  const previousFocus = document.activeElement as HTMLElement | null;
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  panel.current?.focus();
  return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
 }, [isOpen]);
 if (!operation || !current) return null;
 const titles: Record<Operation['kind'], string> = { appointment: current.kind === 'appointment' && current.appointment ? 'Editar atendimento' : 'Novo atendimento', appointmentDetail: 'Seu atendimento', client: current.kind === 'client' && current.client ? 'Editar cliente' : 'Nova cliente', clientDetail: 'Histórico da cliente', service: current.kind === 'service' && current.service ? 'Editar serviço' : 'Novo serviço', cash: current.kind === 'cash' && current.direction === 'out' ? 'Adicionar custo' : 'Registrar entrada', material: current.kind === 'material' && current.material ? 'Editar material' : 'Novo material', stock: 'Movimentar material', demand: 'Adicionar demanda', refund: 'Reembolsar pagamento' };
 const navigate = (next: Operation) => { setCurrent(next); setLocalError(''); panel.current?.focus(); };
 const save = async (command: Command) => { const ok = await onCommand(command); setLocalError(ok ? '' : 'Não foi possível salvar. Confira os dados e tente novamente.'); return ok; };
 const props: FormProps = { data, busy, save, close: onClose, navigate };
 return <div className="op-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><div className="operation-panel" ref={panel} role="dialog" aria-modal="true" aria-labelledby="operation-title" tabIndex={-1} onKeyDown={event => {
  if (event.key === 'Escape' && !busy) onClose();
  if (event.key === 'Tab') { const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'); if (!elements?.length) return; const first = elements[0]; const last = elements[elements.length - 1]; if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); } }
 }}><header className="op-header"><h2 id="operation-title">{titles[current.kind]}</h2><button className="op-icon" aria-label="Fechar painel" onClick={onClose} disabled={busy}><X/></button></header>
 <div className="op-body">{(error || localError) && <p role="alert" className="op-error">{error || localError}</p>}
 {current.kind === 'client' && <ClientForm key={current.client?.id ?? 'new-client'} {...props} client={current.client}/>}
 {current.kind === 'clientDetail' && <ClientHistory {...props} client={current.client}/>}
 {current.kind === 'service' && <ServiceForm key={current.service?.id ?? 'new-service'} {...props} service={current.service}/>}
 {current.kind === 'material' && <MaterialForm key={current.material?.id ?? 'new-material'} {...props} material={current.material}/>}
 {current.kind === 'cash' && <CashForm key={`${current.direction}-${current.appointmentId}`} {...props} direction={current.direction} appointmentId={current.appointmentId}/>}
 {current.kind === 'stock' && <StockForm key={`${current.materialId}-${current.stockKind}`} {...props} operation={current}/>}
 {current.kind === 'demand' && <DemandForm key={current.materialId??'new-demand'} {...props} materialId={current.materialId}/>}
 {current.kind === 'appointment' && <AppointmentForm key={current.appointment?.id ?? current.draft?.id ?? 'new-appointment'} {...props} operation={current}/>}
 {current.kind === 'appointmentDetail' && <AppointmentDetail {...props} appointmentId={current.appointment.id}/>}
 {current.kind === 'refund' && <RefundForm {...props} appointmentId={current.appointmentId}/>}
 </div></div></div>;
}

function ClientForm({client,busy,save,close}:FormProps & {client?:Client}) {
 const [id] = useState(client?.id ?? uid); const [commandId] = useState(uid);
 return <form className="op-form" onSubmit={async event=>{ event.preventDefault(); const f=valueOf(event); if(await save({commandId,type:'saveClient',client:{id,name:stringOf(f,'name'),phone:stringOf(f,'phone'),notes:stringOf(f,'notes'),active:client?.active ?? true}})) close(); }}>
 <Field label="Nome"><input name="name" required maxLength={120} defaultValue={client?.name} autoComplete="name" placeholder="Como ela se chama?"/></Field>
 <Field label="Celular · opcional"><input name="phone" type="tel" maxLength={30} defaultValue={client?.phone} autoComplete="tel" placeholder="(11) 90000-0000"/></Field>
 <Field label="Observações · opcional"><textarea name="notes" maxLength={2000} defaultValue={client?.notes} placeholder="Preferências para lembrar no próximo atendimento" rows={3}/></Field>
 <Submit busy={busy}/>{client && <button type="button" className="op-text-button" disabled={busy} onClick={async()=>{if(await save({commandId:uid(),type:'saveClient',client:{id:client.id,name:client.name,phone:client.phone,notes:client.notes,active:!client.active}}))close();}}>{client.active?'Arquivar cliente':'Reativar cliente'}</button>}</form>;
}

function ServiceForm({service,data,busy,save,close}:FormProps & {service?:Service}) {
 const [id]=useState(service?.id ?? uid); const [commandId]=useState(uid); const [color,setColor]=useState(service?.color??'#F4B6DA');
 return <form className="op-form" onSubmit={async event=>{event.preventDefault();const f=valueOf(event);const materials=data.materials.filter(m=>m.active).map(m=>({materialId:m.id,quantity:Number(f.get(`material:${m.id}`))})).filter(r=>r.quantity>0);if(await save({commandId,type:'saveService',service:{id,name:stringOf(f,'name'),priceCents:centsFromInput(stringOf(f,'price')),costCents:centsFromInput(stringOf(f,'cost')),durationMinutes:Number(f.get('duration')),color,active:service?.active??true,materials}}))close();}}>
 <Field label="Nome do serviço"><input name="name" required maxLength={120} defaultValue={service?.name} placeholder="Ex.: Box Braids"/></Field>
 <div className="op-columns"><Field label="Preço · R$"><input name="price" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required defaultValue={moneyInput(service?.priceCents??0)}/></Field><Field label="Duração · minutos"><input name="duration" type="number" min="5" max="1440" step="5" required defaultValue={service?.durationMinutes??60}/></Field></div>
 <Field label="Custo estimado · R$"><input name="cost" type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required defaultValue={moneyInput(service?.costCents??0)}/></Field><p className="op-hint">Inclua materiais e outros custos desse serviço. A estimativa não lança uma despesa no caixa.</p>
 <Field label="Cor na agenda"><div className="op-colors">{['#F4B6DA','#E4D5F9','#F4DE9C','#C4E3D5','#C6DCF7'].map((c,i)=><button key={c} type="button" aria-label={`Cor ${['rosa','lilás','amarela','verde','azul'][i]}`} aria-pressed={color===c} style={{background:c}} onClick={()=>setColor(c)}>{color===c&&<Check size={20}/>}</button>)}<input type="color" aria-label="Escolher outra cor" value={color} onChange={e=>setColor(e.target.value)}/></div></Field>
 <details className="op-details"><summary>Materiais por atendimento</summary><p className="op-hint">Essa previsão alimenta a lista “Preciso comprar”. O consumo é registrado separadamente.</p>{data.materials.filter(m=>m.active).map(m=><Field key={m.id} label={`${m.name} · ${m.unit}`}><input name={`material:${m.id}`} type="number" min="0" step="0.001" defaultValue={service?.materials?.find(r=>r.materialId===m.id)?.quantity??0}/></Field>)}{!data.materials.some(m=>m.active)&&<Empty>Cadastre materiais para informar o consumo previsto.</Empty>}</details>
 <Submit busy={busy}/>{service&&<button type="button" className="op-text-button" disabled={busy} onClick={async()=>{if(await save({commandId:uid(),type:'saveService',service:{...service,active:!service.active}}))close();}}>{service.active?'Desativar serviço':'Ativar serviço'}</button>}</form>;
}

function MaterialForm({material,busy,save,close}:FormProps & {material?:Material}) {
 const [id]=useState(material?.id??uid);const [commandId]=useState(uid);
 return <form className="op-form" onSubmit={async event=>{event.preventDefault();const f=valueOf(event);if(await save({commandId,type:'saveMaterial',material:{...material,id,name:stringOf(f,'name'),unit:stringOf(f,'unit'),quantity:material?.quantity??Number(f.get('quantity')),minimum:Number(f.get('minimum')),active:material?.active??true}}))close();}}>
 <Field label="Nome do material"><input name="name" required maxLength={120} defaultValue={material?.name} placeholder="Ex.: Fibra jumbo · preto"/></Field>
 <Field label="Unidade"><select name="unit" defaultValue={material?.unit??'pacote'}>{Array.from(new Set([material?.unit??'pacote','pacote','pote','frasco','unidade','litro','kg','grama','ml'])).map(u=><option key={u}>{u}</option>)}</select></Field>
 <div className="op-columns"><Field label="Quantidade atual"><input name="quantity" type="number" min="0" step="0.001" required disabled={Boolean(material)} defaultValue={material?.quantity??0}/></Field><Field label="Estoque mínimo"><input name="minimum" type="number" min="0" step="0.001" required defaultValue={material?.minimum??1}/></Field></div>
 {material&&<p className="op-hint">Para alterar a quantidade, registre uma compra, uso ou ajuste.</p>}<Submit busy={busy}/></form>;
}

function CashForm({direction,appointmentId,data,busy,save,close}:FormProps & {direction:'in'|'out';appointmentId?:string}) {
 const [id]=useState(uid);const [commandId]=useState(uid);const [linked,setLinked]=useState(appointmentId??'');const [amount,setAmount]=useState(appointmentId?moneyInput(getAppointmentBalance(data,appointmentId)):'');
 const appointments=data.appointments.filter(a=>a.status!=='cancelled'&&a.status!=='noshow'&&getAppointmentBalance(data,a.id)>0);
 return <form className="op-form" onSubmit={async event=>{event.preventDefault();const f=valueOf(event);if(await save({commandId,type:'recordCash',movement:{id,direction,amountCents:centsFromInput(amount),date:stringOf(f,'date'),category:stringOf(f,'category'),description:stringOf(f,'description'),...(direction==='in'&&linked?{appointmentId:linked}:{})}}))close();}}>
 {direction==='in'&&<Field label="Vincular a um atendimento"><select value={linked} onChange={e=>{setLinked(e.target.value);setAmount(e.target.value?moneyInput(getAppointmentBalance(data,e.target.value)):'');}}><option value="">Entrada avulsa</option>{appointments.map(a=><option key={a.id} value={a.id}>{data.clients.find(c=>c.id===a.clientId)?.name} · {a.serviceName} · {currency(getAppointmentBalance(data,a.id))}</option>)}</select></Field>}
 <Field label={direction==='in'?'Quanto recebeu? · R$':'Quanto pagou? · R$'}><input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></Field>
 {linked&&<p className="op-hint">Pode ser um sinal ou parte do valor. Restante: {currency(getAppointmentBalance(data,linked))}.</p>}
 <div className="op-columns"><Field label="Data"><input name="date" type="date" required defaultValue={dateKey()}/></Field><Field label="Categoria"><select name="category" defaultValue={linked?'Serviços':'Outros'}>{(direction==='in'?['Serviços','Venda','Outros']:['Materiais','Espaço','Contas','Transporte','Retirada','Outros']).map(c=><option key={c}>{c}</option>)}</select></Field></div>
 <Field label="Descrição · opcional"><input name="description" maxLength={2000} placeholder={direction==='in'?'Ex.: Sinal de uma cliente':'Ex.: Conta de energia'}/></Field><Submit busy={busy}>{direction==='in'?'Confirmar recebimento':'Confirmar saída'}</Submit></form>;
}

function StockForm({operation,data,busy,save,close}:FormProps & {operation:Extract<Operation,{kind:'stock'}>}) {
 const [id]=useState(uid);const [commandId]=useState(uid);const [kind,setKind]=useState<StockMovement['kind']>(operation.stockKind??'purchase');
 return <form className="op-form" onSubmit={async event=>{event.preventDefault();const f=valueOf(event);if(await save({commandId,type:'recordStock',movement:{id,kind,materialId:stringOf(f,'material'),quantity:Number(f.get('quantity')),date:stringOf(f,'date'),costCents:kind==='purchase'?centsFromInput(stringOf(f,'cost')):0,notes:stringOf(f,'notes')}}))close();}}>
 <Field label="Material"><select name="material" required defaultValue={operation.materialId??''}><option value="" disabled>Escolha o material</option>{data.materials.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name} · {m.quantity} {m.unit}</option>)}</select></Field>
 <Field label="O que aconteceu?"><select value={kind} onChange={e=>setKind(e.target.value as StockMovement['kind'])}><option value="purchase">Comprei e paguei</option><option value="consumption">Usei no salão</option><option value="adjustment">Ajustar quantidade</option></select></Field>
 <Field label={kind==='adjustment'?'Quantidade a somar ou retirar':'Quantidade'}><input name="quantity" type="number" min={kind==='adjustment'?undefined:'0.001'} step="0.001" required defaultValue={operation.quantity??1}/></Field>
 {kind==='adjustment'&&<p className="op-hint">Ex.: 2 acrescenta duas unidades; -2 retira duas.</p>}
 {kind==='purchase'&&<><Field label="Valor total pago · R$"><input name="cost" type="number" inputMode="decimal" min="0.01" step="0.01" required/></Field><p className="op-hint">A compra também será registrada como saída no caixa.</p></>}
 <Field label="Data"><input name="date" type="date" required defaultValue={dateKey()}/></Field><Field label="Observação · opcional"><input name="notes" maxLength={2000}/></Field><Submit busy={busy}>{kind==='purchase'?'Registrar compra':kind==='consumption'?'Registrar uso':'Salvar ajuste'}</Submit></form>;
}

function DemandForm({materialId,data,busy,save,close}:FormProps & {materialId?:string}) {
 const [id]=useState(uid);const [commandId]=useState(uid);const [selected,setSelected]=useState(materialId??'');
 const existing=data.materials.find(m=>m.id===selected);
 const [quantity,setQuantity]=useState(String(existing?.manualDemand??1));
 const [fixed,setFixed]=useState(existing?.alwaysOnShoppingList??false);
 const permanent=Boolean(existing&&(/^(pomada|mousse)$/i.test(existing.name)||['mat-pomada','mat-mousse'].includes(existing.id)));
 return <form className="op-form" onSubmit={async event=>{event.preventDefault();const f=valueOf(event);const material=selected==='__new__'?{id,name:stringOf(f,'name'),unit:stringOf(f,'unit'),quantity:0,minimum:0,active:true}:existing;if(!material)return;if(await save({commandId,type:'saveMaterial',material:{...material,manualDemand:Number(quantity),alwaysOnShoppingList:permanent||fixed}}))close();}}>
 <Field label="Material da lista"><select required value={selected} onChange={e=>{setSelected(e.target.value);const material=data.materials.find(m=>m.id===e.target.value);setQuantity(String(material?.manualDemand??1));setFixed(material?.alwaysOnShoppingList??false);}}><option value="" disabled>Escolha um material</option><option value="__new__">+ Adicionar outro material</option>{data.materials.filter(m=>m.active).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
 {selected==='__new__'&&<div className="op-inline-fields"><Field label="Nome do material"><input name="name" required maxLength={120} placeholder="Ex.: Fibra castanha"/></Field><Field label="Unidade"><select name="unit" defaultValue="pacote">{['pacote','pote','frasco','unidade','ml','kg','litro'].map(unit=><option key={unit}>{unit}</option>)}</select></Field></div>}
 <Field label={`Demanda extra${existing?` · ${existing.unit}`:''}`}><input type="number" min={selected==='__new__'&&!fixed?'0.001':'0'} step="0.001" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field><p className="op-hint">Somamos este extra aos materiais previstos na agenda. Use zero para retirar o extra.</p>
 <label className="op-checkbox"><input type="checkbox" checked={permanent||fixed} disabled={permanent} onChange={e=>setFixed(e.target.checked)}/><span>Manter sempre na lista</span></label>
 <Submit busy={busy}>Atualizar lista</Submit></form>;
}

function AppointmentForm({operation,data,busy,save,close}:FormProps & {operation:Extract<Operation,{kind:'appointment'}>}) {
 const {appointment,draft}=operation;
 const matchingClient=draft?data.clients.find(c=>(draft.clientPhone&&c.phone===draft.clientPhone)||c.name.toLocaleLowerCase()===draft.clientName.toLocaleLowerCase()):undefined;
 const initialService=data.services.find(s=>s.id===(appointment?.serviceId??draft?.serviceId??operation.serviceId))??data.services.find(s=>s.active);
 const [id]=useState(appointment?.id??uid);const [commandId]=useState(uid);const [clientCommandId]=useState(uid);const [newClientId]=useState(uid);
 const [clientId,setClientId]=useState(appointment?.clientId??matchingClient?.id??(draft?'__new__':''));
 const [serviceId,setServiceId]=useState(initialService?.id??'');
 const [price,setPrice]=useState(moneyInput(appointment?.priceCents??draft?.priceCents??initialService?.priceCents??0));
 const [cost,setCost]=useState(moneyInput(appointment?.costCents??initialService?.costCents??0));
 const [duration,setDuration]=useState(appointment?.durationMinutes??initialService?.durationMinutes??60);
 const start=appointment?.startAt??draft?.startAt;
 const serviceChanged=(value:string)=>{setServiceId(value);const service=data.services.find(s=>s.id===value);if(service){setPrice(moneyInput(service.priceCents));setCost(moneyInput(service.costCents??0));setDuration(service.durationMinutes);}};
 return <form className="op-form" onSubmit={async event=>{
  event.preventDefault();const f=valueOf(event);let selectedClient=clientId;
  if(clientId==='__new__') { selectedClient=newClientId; if(!await save({commandId:clientCommandId,type:'saveClient',client:{id:newClientId,name:stringOf(f,'newName'),phone:stringOf(f,'newPhone'),notes:'',active:true}}))return; setClientId(newClientId); }
  const next:Command={commandId,type:'saveAppointment',appointment:{id,clientId:selectedClient,serviceId,startAt:toISO(stringOf(f,'day'),stringOf(f,'time')),durationMinutes:duration,priceCents:centsFromInput(price),costCents:centsFromInput(cost),notes:stringOf(f,'notes'),...(draft?{draftId:draft.id}:appointment?.draftId?{draftId:appointment.draftId}:{})}};
  if(await save(next))close();
 }}>
 {draft&&<div className="op-message"><span>Conversa simulada · revise antes de salvar</span><p>{draft.message}</p><strong>Data e horário são sugestões da demonstração.</strong></div>}
 <Field label="Cliente"><select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="" disabled>Escolha a cliente</option><option value="__new__">+ Cadastrar nova cliente</option>{data.clients.filter(c=>c.active||c.id===appointment?.clientId).sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}{!c.active?' · arquivada':''}</option>)}</select></Field>
 {clientId==='__new__'&&<div className="op-inline-fields"><Field label="Nome da nova cliente"><input name="newName" required maxLength={120} defaultValue={draft?.clientName} placeholder="Nome da cliente"/></Field><Field label="Celular · opcional"><input name="newPhone" type="tel" maxLength={30} defaultValue={draft?.clientPhone}/></Field></div>}
 <Field label="Serviço"><select required value={serviceId} onChange={e=>serviceChanged(e.target.value)}><option value="" disabled>Escolha o serviço</option>{data.services.filter(s=>s.active||s.id===appointment?.serviceId).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
 {!data.services.some(s=>s.active)&&<p className="op-hint">Cadastre um serviço antes de agendar.</p>}
 <div className="op-columns"><Field label="Dia"><input name="day" type="date" required defaultValue={start?dateKey(start):operation.date??dateKey()}/></Field><Field label="Horário"><input name="time" type="time" required defaultValue={start?timeLabel(start):'09:00'}/></Field></div>
 <div className="op-columns"><Field label="Valor combinado · R$"><input name="price" type="number" inputMode="decimal" min="0" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></Field><Field label="Duração · minutos"><input name="duration" type="number" min="5" max="1440" step="5" required value={duration} onChange={e=>setDuration(Number(e.target.value))}/></Field></div>
 <Field label="Custo estimado · R$"><input name="cost" type="number" inputMode="decimal" min="0" step="0.01" required value={cost} onChange={e=>setCost(e.target.value)}/></Field><div className="op-cost-estimate"><span>Sobra prevista</span><strong>{currency((centsFromInput(price)||0)-(centsFromInput(cost)||0))}</strong><small>Estimativa do atendimento. Não altera o caixa.</small></div>
 <Field label="Observações · opcional"><textarea name="notes" rows={3} maxLength={2000} defaultValue={appointment?.notes??draft?.notes} placeholder="Modelo, comprimento, cor…"/></Field>
 <p className="op-hint">Agendar não registra dinheiro recebido.</p><Submit busy={busy}>{appointment?'Salvar alterações':draft?'Confirmar na agenda':'Agendar atendimento'}</Submit></form>;
}

function AppointmentDetail({appointmentId,data,busy,save,close,navigate}:FormProps & {appointmentId:string}) {
 const appointment=data.appointments.find(a=>a.id===appointmentId);
 const [confirmAction,setConfirmAction]=useState<'cancelled'|'noshow'|null>(null);
 if(!appointment)return <Empty>Esse atendimento não foi encontrado.</Empty>;
 const client=data.clients.find(c=>c.id===appointment.clientId);
 const paid=getAppointmentPaid(data,appointment.id);const remaining=getAppointmentBalance(data,appointment.id);
 const changeStatus=async(status:Appointment['status'],thenReceive=false)=>{if(await save({commandId:uid(),type:'setAppointmentStatus',appointmentId:appointment.id,status})){setConfirmAction(null);if(thenReceive&&remaining>0)navigate({kind:'cash',direction:'in',appointmentId:appointment.id});}};
 return <div className="op-form"><div className="op-appointment-hero" style={{backgroundColor:appointment.serviceColor,color:readableText(appointment.serviceColor)}}><span>{statusNames[appointment.status]}</span><h3>{client?.name??'Cliente'}</h3><p>{appointment.serviceName}</p><div><Clock3 size={18}/>{dateLabel(appointment.startAt,{day:'numeric',month:'long'})} · {timeLabel(appointment.startAt)} · {appointment.durationMinutes} min</div></div>
 <div className="op-payment-summary"><div><span>Combinado</span><strong>{currency(appointment.priceCents)}</strong></div><div><span>Recebido</span><strong>{currency(paid)}</strong></div><div><span>{appointment.status==='cancelled'||appointment.status==='noshow'?'Saldo cancelado':'Falta receber'}</span><strong>{currency(remaining)}</strong></div></div>
 <div className="op-cost-estimate"><span>Custo estimado: {appointment.costCents===undefined?'não informado':currency(appointment.costCents)}</span>{appointment.costCents!==undefined&&<strong>Sobra prevista: {currency(appointment.priceCents-appointment.costCents)}</strong>}<small>Estimativa do atendimento, separada do caixa realizado.</small></div>
 {appointment.notes&&<p className="op-note">{appointment.notes}</p>}
 {remaining>0&&appointment.status!=='cancelled'&&appointment.status!=='noshow'&&<button type="button" className="op-primary" disabled={busy} onClick={()=>navigate({kind:'cash',direction:'in',appointmentId:appointment.id})}><ArrowDownLeft size={20}/> {appointment.status==='completed'?'Recebi o restante':'Registrar pagamento'}</button>}
 {appointment.status==='confirmed'&&<><button type="button" className="op-secondary" disabled={busy} onClick={()=>changeStatus('completed',true)}><Check size={20}/>Concluir atendimento</button><button type="button" className="op-secondary" disabled={busy} onClick={()=>navigate({kind:'appointment',appointment})}><Pencil size={18}/>Editar ou remarcar</button><div className="op-columns"><button type="button" className="op-text-button" disabled={busy} onClick={()=>setConfirmAction('noshow')}>Não compareceu</button><button type="button" className="op-text-button op-danger" disabled={busy} onClick={()=>setConfirmAction('cancelled')}>Cancelar atendimento</button></div></>}
 {(appointment.status==='cancelled'||appointment.status==='noshow')&&<button className="op-secondary" disabled={busy} onClick={()=>changeStatus('confirmed')}>Reativar atendimento</button>}
 {confirmAction&&<div className="op-confirm" role="group" aria-label="Confirmar alteração"><p>{confirmAction==='cancelled'?'Cancelar este atendimento?':'Registrar que a cliente não compareceu?'} Os pagamentos serão preservados.</p><div className="op-columns"><button className="op-secondary" disabled={busy} onClick={()=>setConfirmAction(null)}>Voltar</button><button className="op-primary" disabled={busy} onClick={()=>changeStatus(confirmAction)}>Confirmar</button></div></div>}
 {paid>0&&<button className="op-text-button" disabled={busy} onClick={()=>navigate({kind:'refund',appointmentId:appointment.id})}><ArrowUpRight size={18}/>Reembolsar pagamento</button>}
 <div className="op-history"><h3>Pagamentos</h3>{data.cashMovements.filter(m=>m.appointmentId===appointment.id).sort((a,b)=>b.date.localeCompare(a.date)).map(m=><div key={m.id}><span>{m.origin==='refund'?'Reembolso':'Recebimento'}<small>{dateLabel(m.date)}</small></span><strong>{m.direction==='out'?'−':''}{currency(m.amountCents)}</strong></div>)}{!data.cashMovements.some(m=>m.appointmentId===appointment.id)&&<Empty>Nenhum recebimento registrado.</Empty>}</div>
 <button className="op-text-button" onClick={close}>Fechar</button></div>;
}

function RefundForm({appointmentId,data,busy,save,close}:FormProps & {appointmentId:string}) {
 const [commandId]=useState(uid);const [movementId]=useState(uid);const paid=getAppointmentPaid(data,appointmentId);
 return <form className="op-form" onSubmit={async event=>{event.preventDefault();const f=valueOf(event);if(await save({commandId,type:'refund',appointmentId,movementId,amountCents:centsFromInput(stringOf(f,'amount')),date:stringOf(f,'date'),description:stringOf(f,'description')}))close();}}><p className="op-hint">Você pode devolver até {currency(paid)}. O reembolso será uma saída no caixa.</p><Field label="Valor devolvido · R$"><input name="amount" type="number" inputMode="decimal" min="0.01" max={paid/100} step="0.01" required defaultValue={moneyInput(paid)}/></Field><Field label="Data"><input name="date" type="date" required defaultValue={dateKey()}/></Field><Field label="Motivo · opcional"><input name="description" maxLength={2000}/></Field><Submit busy={busy}>Confirmar reembolso</Submit></form>;
}

function ClientHistory({client,data,busy,navigate}:FormProps & {client:Client}) {
 const appointments=data.appointments.filter(a=>a.clientId===client.id).sort((a,b)=>b.startAt.localeCompare(a.startAt));
 return <div className="op-form"><div className="op-client-profile"><span>{client.name.split(' ').slice(0,2).map(n=>n[0]).join('')}</span><h3>{client.name}</h3><p>{client.phone||'Celular não informado'}</p>{!client.active&&<p>Cliente arquivada</p>}</div>{client.notes&&<p className="op-note">{client.notes}</p>}<button className="op-secondary" disabled={busy} onClick={()=>navigate({kind:'client',client})}><Pencil size={18}/>Editar cliente</button><div className="op-history"><h3>Atendimentos · {appointments.length}</h3>{appointments.map(a=><button className="op-history-appointment" key={a.id} onClick={()=>navigate({kind:'appointmentDetail',appointment:a})}><span>{a.serviceName}<small>{dateLabel(a.startAt)} · {timeLabel(a.startAt)} · {statusNames[a.status]}</small></span><strong>{currency(a.priceCents)}</strong></button>)}{appointments.length===0&&<Empty>O primeiro atendimento dela começa aqui.</Empty>}</div></div>;
}
