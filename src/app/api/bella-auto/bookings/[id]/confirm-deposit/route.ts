import { createClient } from '@/lib/supabase-server';
import { depositConfirmationHttp } from '@/modules/bella-auto/services/AutoMoveDepositConfirmationHttp';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return depositConfirmationHttp(request, user.id, bookingId);

  } catch {
    return Response.json({ error: 'Deposit confirmation failed.' }, { status: 500 });
  }
}
