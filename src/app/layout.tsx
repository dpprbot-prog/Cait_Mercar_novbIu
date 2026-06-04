import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getCurrentUser } from '@/actions/auth'
import AuthScreen from '@/components/AuthScreen'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'МЕРКАРЕ — Система управления строительством',
  description: 'Учёт времени, снабжение, зарплата, СИЗ и инструмент',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'МЕРКАРЕ',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#18181c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  return (
    <html lang="ru">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <AuthProvider user={user}>
          {user ? children : <AuthScreen />}
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('SW registered:', reg.scope);
                  }).catch(function(err) {
                    console.error('SW registration failed:', err);
                  });
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}
