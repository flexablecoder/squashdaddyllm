export interface EmailLogData {
    coach_id: string;
    coach_email: string;
    recipient_email: string;
    original_sender?: string;
    subject: string;
    body: string;
    email_type: 'sent' | 'drafted';
    handling_mode: 'draft_only' | 'send_full_replies';
    admin_override_active: boolean;
    thread_id?: string;
    message_id?: string;
}

export interface SystemAdminSettings {
    email_override_enabled: boolean;
    override_email_address: string | null;
}
