export const currency = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const dateKey = (value: string | Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
export const timeLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...options }).format(new Date(value.length === 10 ? value + 'T12:00:00-03:00' : value));
export const toISO = (day: string, time: string) => new Date(`${day}T${time}:00-03:00`).toISOString();
export const uid = () => crypto.randomUUID();
export const centsFromInput = (value: string) => Math.round(Number(value.replace(',', '.')) * 100);
export function monthRange(month: string) { const [y, m] = month.split('-').map(Number); return { from: `${month}-01`, to: `${month}-${new Date(y, m, 0).getDate()}` }; }
export function readableText(hex: string) {
 const rgb = hex.replace('#', '').match(/.{2}/g)?.map(part => parseInt(part, 16) / 255) ?? [1, 1, 1];
 const [r, g, b] = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
 const luminance = .2126 * r + .7152 * g + .0722 * b;
 return luminance > .201 ? '#111111' : luminance > .179 ? '#000000' : '#FFFFFF';
}
