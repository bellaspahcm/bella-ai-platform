import { NextResponse } from 'next/server';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createServerClient } from '@/lib/supabase-server';
import {
  parseVehicleSaleRecognitionCommand,
  recognizeVehicleSaleRevenue,
  VehicleSaleRecognitionError,
} from '@/modules/bella-auto/services/VehicleSaleRecognitionService';
import {
  asSupabaseVehicleSaleRecognitionClient,
  SupabaseVehicleSaleRecognitionRepository,
} from '@/modules/bella-auto/services/SupabaseVehicleSaleRecognitionRepository';

export async function POST(request: Request) {
  try {
    const userClient = createServerClient();
    const adminClient = createSupabaseAdminClient();

    if (!adminClient) {
      return NextResponse.json(
        { error: 'Vehicle sale recognition admin client is not configured.' },
        { status: 503 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json();
    const command = parseVehicleSaleRecognitionCommand(body);
    const repository = new SupabaseVehicleSaleRecognitionRepository(
      asSupabaseVehicleSaleRecognitionClient(userClient),
      asSupabaseVehicleSaleRecognitionClient(adminClient)
    );

    const result = await recognizeVehicleSaleRevenue({
      actorUserId: user.id,
      command,
      repository,
    });

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        recognition: result.recognition,
      },
      { status: result.status === 'created' ? 201 : 200 }
    );
  } catch (error: unknown) {
    if (error instanceof VehicleSaleRecognitionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.httpStatus }
      );
    }

    console.error('[AutoMove] Vehicle sale recognition failed:', error);
    return NextResponse.json(
      { error: 'Vehicle sale recognition failed.' },
      { status: 500 }
    );
  }
}
