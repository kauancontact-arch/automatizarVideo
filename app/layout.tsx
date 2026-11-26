import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'automatizarVideo',
  description: 'Roteiro, narracao, video e publicacao automatizados',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <nav className="nav">
          <a href="/flows">Fluxos</a>
          <a href="/runs">Execucoes</a>
          <a href="/costs">Custos</a>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
