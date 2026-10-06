export const metadata = {
  title: "Eclipse Beaming — DM Control",
  description: "Painel de verificação e disparo de DM via bot",
  robots: "noindex, nofollow",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, background: "#070707", color: "#f5f5f5" }}>{children}</body>
    </html>
  );
}
