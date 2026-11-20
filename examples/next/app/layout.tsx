export const metadata = { title: 'flow-hero in Next.js' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#000' }}>{children}</body>
    </html>
  );
}
