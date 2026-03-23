import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { Providers } from '@/components/Providers'
import './globals.css'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'BotCryptoIA — Grid Trading Dashboard',
  description: 'Bot de trading automático de criptomonedas con Grid Strategy e IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          {children}
          <Toaster theme="dark" richColors closeButton />
        </Providers>
      </body>
    </html>
  )
}
