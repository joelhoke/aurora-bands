import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Aurora — Band playground', description: 'A little space to play with light. Draw, shape, and animate luminous gradient bands.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
