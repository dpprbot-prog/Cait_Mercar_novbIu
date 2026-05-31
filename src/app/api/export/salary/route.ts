import { NextRequest, NextResponse } from 'next/server'
import { exportSalaryToTemplate } from '@/actions/export'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') || '0')
  const year = parseInt(searchParams.get('year') || '2024')
  const brigadeId = searchParams.get('brigadeId') || undefined

  try {
    const res = await exportSalaryToTemplate(month, year, brigadeId)
    
    if (!res.success || !res.base64) {
      return NextResponse.json({ error: res.error || 'Export failed' }, { status: 500 })
    }

    const buffer = Buffer.from(res.base64, 'base64')
    
    const encodedFileName = encodeURIComponent(res.fileName || 'Salary_Export.xlsx')
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Salary_Export.xlsx"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
