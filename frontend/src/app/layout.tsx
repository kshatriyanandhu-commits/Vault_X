import type { Metadata } from 'next';
import './globals.css';
import { VaultProvider } from '@/context/VaultContext';

export const metadata: Metadata = {
  title: 'Argus Vault | Zero-Knowledge 3D Credential Vault',
  description:
    'High-security credential vault featuring an interactive 3D steel vault door, client-side Web Crypto AES-256-GCM encryption, and admin session auditing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased bg-[#070a10]">
      <body className="min-h-full flex flex-col bg-[#070a10] text-slate-100 font-sans">
        <VaultProvider>{children}</VaultProvider>
      </body>
    </html>
  );
}
