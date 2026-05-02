import type { Metadata } from 'next'
import './globals.css'
import { getCurrentUser } from '@/actions/auth'
import AuthScreen from '@/components/AuthScreen'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'МЕРКАРЕ — Система управления строительством',
  description: 'Учёт времени, снабжение, зарплата, СИЗ и инструмент',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <html lang="ru">
      <body>
        <AuthProvider user={user}>
          {user ? children : <AuthScreen />}
        </AuthProvider>
      </body>
    </html>
  )
}
