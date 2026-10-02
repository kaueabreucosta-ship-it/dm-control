export const metadata = {
  title: "DM Control — CBX",
  description: "Painel de verificação e disparo de DM via bot",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, background: "#070707" }}>{children}</body>
    </html>
  );
}
