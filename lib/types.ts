export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled' | 'noshow';
export interface Client { id: string; name: string; phone: string; notes: string; active: boolean; createdAt: string }
export interface MaterialRequirement { materialId: string; quantity: number }
export interface Service { id: string; name: string; priceCents: number; costCents?: number; durationMinutes: number; color: string; active: boolean; materials?: MaterialRequirement[] }
export interface Appointment { id: string; clientId: string; serviceId: string; serviceName: string; serviceColor: string; startAt: string; durationMinutes: number; priceCents: number; costCents?: number; status: AppointmentStatus; notes: string; draftId?: string; materials?: MaterialRequirement[] }
export interface CashMovement { id: string; direction: 'in' | 'out'; amountCents: number; date: string; category: string; description: string; appointmentId?: string; stockMovementId?: string; origin: 'manual' | 'payment' | 'purchase' | 'refund'; createdAt: string }
export interface Material { id: string; name: string; unit: string; quantity: number; minimum: number; active: boolean; manualDemand?: number; alwaysOnShoppingList?: boolean }
export interface StockMovement { id: string; materialId: string; kind: 'purchase' | 'consumption' | 'adjustment'; quantity: number; date: string; notes: string; costCents: number }
export interface AssistantDraft { id: string; clientName: string; clientPhone: string; serviceId: string; startAt: string; priceCents: number; notes: string; message: string; confirmedAppointmentId?: string }
export interface AppData { schemaVersion: 1; clients: Client[]; services: Service[]; appointments: Appointment[]; cashMovements: CashMovement[]; materials: Material[]; stockMovements: StockMovement[]; drafts: AssistantDraft[]; appliedCommandIds: string[] }
export type ClientInput = Omit<Client, 'createdAt'>;
export type AppointmentInput = Omit<Appointment, 'serviceName' | 'serviceColor' | 'status'>;
export type Command = { commandId: string } & (
 | { type: 'saveClient'; client: ClientInput }
 | { type: 'saveService'; service: Service }
 | { type: 'saveAppointment'; appointment: AppointmentInput }
 | { type: 'setAppointmentStatus'; appointmentId: string; status: AppointmentStatus }
 | { type: 'recordCash'; movement: Omit<CashMovement, 'createdAt' | 'origin'> }
 | { type: 'refund'; appointmentId: string; movementId: string; amountCents: number; date: string; description: string }
 | { type: 'saveMaterial'; material: Material }
 | { type: 'recordStock'; movement: StockMovement }
);
export interface AppRepository { load(): Promise<AppData>; execute(command: Command): Promise<AppData> }
export interface FinancialSummary { received: number; spent: number; balance: number; receivable: number }
