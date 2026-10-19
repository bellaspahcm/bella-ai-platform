export type IncidentSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';

export interface IReportIncidentCommand {
  tenantId: string;
  studentId: string;
  incidentTime: Date;
  incidentType: string;
  severity: IncidentSeverity;
  description: string;
  actionTaken: string;
  actorId: string;
}

export interface IEscalateIncidentCommand {
  tenantId: string;
  incidentId: string;
  notifiedAt: Date;
}

export interface ICloseIncidentCommand {
  tenantId: string;
  incidentId: string;
  acknowledgedAt?: Date;
  escalationNotes?: string;
  /** Queue reviewers require the same OPEN revision; omitted by existing consumers. */
  expectedOpenUpdatedAt?: string;
}

export interface IIncidentSafetyContract {
  /**
   * Reports a new health incident. 
   * If severity is SEVERE or CRITICAL, forces `escalation_required = true`.
   */
  reportIncident(command: IReportIncidentCommand): Promise<{ incidentId: string; escalationRequired: boolean }>;

  /**
   * Records that parent was notified about an escalation.
   */
  recordEscalationNotification(command: IEscalateIncidentCommand): Promise<void>;

  /**
   * Closes an incident.
   * If `escalation_required` is true, requires `acknowledgedAt` evidence to close.
   * @throws INCIDENT_CLOSURE_VIOLATION if attempting to close a required escalation without acknowledgement.
   */
  closeIncident(command: ICloseIncidentCommand): Promise<void>;
}
