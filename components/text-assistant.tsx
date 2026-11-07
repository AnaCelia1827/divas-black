'use client';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCheck, LoaderCircle, MessageCircle, Sparkles } from 'lucide-react';
import type { AppData, AssistantDraft, Command } from '@/lib/types';
import { currency, dateLabel, toISO, uid, centsFromInput } from '@/lib/format';
import { MAX_MESSAGE_LENGTH, MESSAGE_EXAMPLE, paymentWarning, textDraftNotes, textExtractionSchema, type TextExtraction } from '@/lib/text-draft';
import { AssistantScreen as ExampleDrafts } from './screens';
import type { Operation } from './operation-panel';
import './text-assistant.css';

type Props = { data: AppData; busy: boolean; execute: (command: Command) => Promise<boolean>; open: (operation: Operation) => void };
const normalize = (text: string) => text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const moneyValue = (value: number | null) => value === null ? '' : (value / 100).toFixed(2);

export function TextAssistant({ data, busy, execute, open }: Props) {
 const [message, setMessage] = useState('');
 const [working, setWorking] = useState(false);
 const [error, setError] = useState('');
 const [pending, setPending] = useState<(AssistantDraft & { extraction: TextExtraction }) | null>(null);
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const lock = useRef(false);
 const drafts = data.drafts.filter(draft => draft.extraction).slice().reverse();
 async function organize(event: FormEvent) {
  event.preventDefault(); if (lock.current || busy) return;
  lock.current = true; setWorking(true); setError('');
  try {
   let draft = pending;
   if (!draft) {
    const response = await fetch('/api/assistant/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal: AbortSignal.timeout(40000) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Não foi possível organizar o texto. Tente novamente.');
    const fields = textExtractionSchema.parse(body.extraction);
    draft = { id: uid(), clientName: fields.clientName || '', clientPhone: '', serviceId: '', startAt: fields.date && fields.time ? toISO(fields.date, fields.time) : '', priceCents: fields.totalCents ?? 0, notes: '', message, extraction: fields };
    setPending(draft);
   }
   if (!await execute({ commandId: `text:${draft.id}`, type: 'saveTextDraft', draft })) throw new Error('O texto foi organizado, mas o rascunho não foi salvo. Tente salvar novamente.');
   setSelectedId(draft.id); setPending(null); setMessage('');
  } catch (err) { setError(err instanceof Error && !['TimeoutError', 'ZodError'].includes(err.name) ? err.message : 'Não foi possível concluir a análise. Seu texto foi mantido; tente novamente.'); }
  finally { lock.current = false; setWorking(false); }
 }
 return <div className="text-assistant">
  <section className="panel text-composer">
   <div className="text-heading"><Sparkles size={25}/><div><h2>Da mensagem para a agenda</h2><p>Cole o texto combinado com a cliente. A IA organiza e você confere.</p></div></div>
   <form onSubmit={organize}>
    <label className="text-message-label" htmlFor="appointment-message">Mensagem do atendimento</label>
    <textarea id="appointment-message" rows={5} required maxLength={MAX_MESSAGE_LENGTH} value={message} disabled={working} onChange={event => { setMessage(event.target.value); setPending(null); setError(''); }} placeholder={MESSAGE_EXAMPLE}/>
    <div className="text-composer-actions"><button className="text-button" type="button" disabled={working || busy} onClick={() => { setMessage(MESSAGE_EXAMPLE); setPending(null); setError(''); }}>Usar exemplo</button><span>{message.length}/{MAX_MESSAGE_LENGTH}</span><button className="button primary" type="submit" disabled={working || busy || !message.trim()} aria-busy={working}>{working ? <LoaderCircle className="pdf-spinner" size={18}/> : <Sparkles size={18}/>} {working ? 'Organizando…' : pending ? 'Tentar salvar rascunho' : 'Organizar mensagem'}</button></div>
   </form>
   <p className="text-privacy">O texto será analisado por IA. O atendimento só entra na agenda após sua confirmação.</p>
   {error && <p className="inline-error" role="alert">{error}</p>}
  </section>
  <section className="text-drafts" aria-label="Mensagens organizadas">
   <div className="section-heading"><h2>Mensagens organizadas <span className="count">{drafts.length}</span></h2></div>
   {!drafts.length && <div className="panel text-drafts-empty"><MessageCircle size={28}/><p>Envie uma mensagem acima para começar. Dados ausentes ficam pendentes para você completar.</p></div>}
   {drafts.map(draft => {
    const fields = draft.reviewed || draft.extraction!;
    const appointment = data.appointments.find(item => item.id === draft.confirmedAppointmentId);
    return <article className="panel text-draft-card" key={draft.id}>
     <div className="section-heading"><h3>{fields.clientName || 'Cliente a informar'}</h3><span className="status-tag">{appointment ? 'Agendado' : 'Para revisar'}</span></div>
     <blockquote className="text-original">{draft.message}</blockquote>
     {appointment ? <><p className="text-confirmed"><CheckCheck size={20}/>Atendimento adicionado à agenda</p><p>{dateLabel(appointment.startAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {appointment.serviceName}</p><p>Entrada combinada: {fields.depositCents === null ? 'não informada' : currency(fields.depositCents)} · Final combinado: {fields.finalCents === null ? 'não informado' : currency(fields.finalCents)}</p><button className="text-button" onClick={() => open({ kind: 'appointmentDetail', appointment })}>Ver atendimento<ArrowRight size={17}/></button></> : selectedId === draft.id ? <Review key={draft.id} draft={draft} data={data} busy={busy} execute={execute}/> : <>
      <dl className="text-summary"><div><dt>Data</dt><dd>{fields.date ? dateLabel(fields.date, { day: '2-digit', month: '2-digit', year: 'numeric' }) : fields.dateText || 'A informar'}</dd></div><div><dt>Horário</dt><dd>{fields.time || 'A informar'}</dd></div><div><dt>Local</dt><dd>{fields.location || 'A informar'}</dd></div><div><dt>Serviço</dt><dd>{fields.serviceName || 'A informar'}</dd></div><div><dt>Total</dt><dd>{fields.totalCents === null ? 'A informar' : currency(fields.totalCents)}</dd></div><div><dt>Entrada / final</dt><dd>{fields.depositCents === null ? '—' : currency(fields.depositCents)} / {fields.finalCents === null ? '—' : currency(fields.finalCents)}</dd></div></dl>
      <button className="button primary" onClick={() => setSelectedId(draft.id)}>Revisar dados<ArrowRight size={18}/></button>
     </>}
    </article>;
   })}
  </section>
  {data.drafts.some(draft => !draft.extraction) && <section className="text-legacy"><h2>Rascunhos de demonstração</h2><ExampleDrafts data={{ ...data, drafts: data.drafts.filter(draft => !draft.extraction) }} open={open}/></section>}
 </div>;
}

function Review({ draft, data, busy, execute }: Omit<Props, 'open'> & { draft: AssistantDraft }) {
 const original = draft.extraction!;
 const [fields, setFields] = useState(original);
 const [amounts, setAmounts] = useState({ totalCents: moneyValue(original.totalCents), depositCents: moneyValue(original.depositCents), finalCents: moneyValue(original.finalCents) });
 const [clientId, setClientId] = useState(() => { const matches = data.clients.filter(client => client.active && normalize(client.name) === normalize(original.clientName || '')); return matches.length === 1 ? matches[0].id : '__new__'; });
 const [serviceId, setServiceId] = useState(() => { const matches = data.services.filter(service => service.active && normalize(service.name) === normalize(original.serviceName || '')); return matches.length === 1 ? matches[0].id : '__new__'; });
 const availableServices = data.services.filter(service => service.active).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
 const selectedService = data.services.find(service => service.id === serviceId);
 const [duration, setDuration] = useState(selectedService?.durationMinutes ?? 60);
 const [error, setError] = useState('');
 const [ids] = useState(() => ({ client: uid(), service: uid(), appointment: uid(), command: uid() }));
 const lock = useRef(false);
 const set = (key: keyof TextExtraction, value: string | number | null) => { setFields(previous => ({ ...previous, [key]: value })); setError(''); };
 const chooseService = (id: string) => {
  setServiceId(id);
  const service = availableServices.find(item => item.id === id);
  set('serviceName', service?.name ?? original.serviceName);
  setDuration(service?.durationMinutes ?? 60);
 };
 const warning = paymentWarning(fields.totalCents, fields.depositCents, fields.finalCents);
 const complete = !!(fields.clientName?.trim() && fields.date && fields.time && fields.location?.trim() && fields.serviceName?.trim() && fields.totalCents !== null && (serviceId === '__new__' || selectedService?.active));
 async function confirm(event: FormEvent) {
  event.preventDefault(); if (lock.current || busy || !complete || warning) return;
  lock.current = true; setError('');
  try {
   const review = textExtractionSchema.parse({ ...fields, warnings: [] });
   const selectedClient = data.clients.find(item => item.id === clientId);
   const client = selectedClient ? { id: selectedClient.id, name: selectedClient.name, phone: selectedClient.phone, notes: selectedClient.notes, active: selectedClient.active } : { id: ids.client, name: review.clientName!, phone: '', notes: '', active: true };
   const service = serviceId === '__new__' ? { id: ids.service, name: review.serviceName!, priceCents: review.totalCents!, durationMinutes: duration, color: '#F4B6DA', active: true } : selectedService!;
   const ok = await execute({ commandId: ids.command, type: 'confirmTextDraft', draftId: draft.id, client, service, review,
    appointment: { id: ids.appointment, clientId: client.id, serviceId: service.id, draftId: draft.id, startAt: toISO(review.date!, review.time!), durationMinutes: duration, priceCents: review.totalCents!, notes: textDraftNotes(draft.message, review) },
   });
   if (!ok) setError('Não foi possível agendar. Confira os dados e o horário disponível; seu rascunho foi preservado.');
  } catch { setError('Confira os campos antes de confirmar.'); }
  finally { lock.current = false; }
 }
 return <form className="text-review" onSubmit={confirm} aria-label={`Revisão de ${original.clientName || 'atendimento'}`}>
  <h3>Confira e complete o atendimento</h3>
  {original.warnings.length > 0 && <div className="text-pending"><strong>Pontos para conferir</strong><ul>{original.warnings.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
  <p className="text-service-source">Serviço identificado na mensagem: <strong>{original.serviceName || 'Não informado'}</strong></p>
  <div className="text-review-grid">
   <label>Nome da cliente<input required maxLength={120} value={fields.clientName || ''} onChange={event => set('clientName', event.target.value || null)}/></label>
   <label>Cadastro da cliente<select value={clientId} onChange={event => setClientId(event.target.value)}><option value="__new__">Cadastrar esta cliente</option>{data.clients.filter(client => client.active).map(client => <option key={client.id} value={client.id}>{client.name}{client.phone ? ` · ${client.phone}` : ''}</option>)}</select></label>
   <label>Data do atendimento<input required type="date" value={fields.date || ''} onChange={event => set('date', event.target.value || null)}/></label>
   <label>Horário do atendimento<input required type="time" value={fields.time || ''} onChange={event => set('time', event.target.value || null)}/></label>
   <label>Local do atendimento<input required maxLength={160} value={fields.location || ''} onChange={event => set('location', event.target.value || null)}/></label>
   <label>Serviço do atendimento<select value={serviceId} onChange={event => chooseService(event.target.value)}><option value="__new__">+ Cadastrar outro serviço</option>{availableServices.map(service => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</option>)}</select></label>
   {serviceId === '__new__' && <label>Nome do novo serviço<input required maxLength={120} value={fields.serviceName || ''} onChange={event => set('serviceName', event.target.value || null)}/></label>}
   <label>Duração · minutos<input required type="number" min="5" max="1440" step="5" value={duration} onChange={event => setDuration(Number(event.target.value))}/></label>
   {(['totalCents', 'depositCents', 'finalCents'] as const).map((key, index) => <label key={key}>{['Valor total · R$', 'Entrada combinada · R$', 'Valor final combinado · R$'][index]}<input type="number" inputMode="decimal" min="0" max="1000000" step="0.01" required={key === 'totalCents'} value={amounts[key]} onChange={event => { setAmounts(previous => ({ ...previous, [key]: event.target.value })); set(key, event.target.value === '' ? null : centsFromInput(event.target.value)); }}/></label>)}
  </div>
  {!availableServices.length && <p className="text-privacy">Nenhum serviço ativo cadastrado. Informe o nome acima para cadastrar um serviço ao confirmar.</p>}
  <p className="text-privacy">Ao selecionar um serviço, o valor combinado na mensagem é mantido. Horário de Brasília. Confira a duração e os cadastros escolhidos. Entrada e valor final são combinados; registre o recebimento no caixa quando acontecer.</p>
  {warning && <p className="inline-error" role="alert">{warning}</p>}
  {error && <p className="inline-error" role="alert">{error}</p>}
  <button className="button primary" type="submit" disabled={busy || !complete || !!warning}>Confirmar atendimento na agenda<ArrowRight size={18}/></button>
 </form>;
}
