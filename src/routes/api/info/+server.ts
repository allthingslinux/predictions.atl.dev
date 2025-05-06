import { json } from '@sveltejs/kit';

export async function GET() {
  try {
    const data = { message: 'Random data for display', timestamp: new Date().toISOString() };
    return json({ success: true, data });
  } catch (error) {
    console.error('Error in /api/info:', error);
    return json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}