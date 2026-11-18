export default function Home() {
  const mode = process.env.BOT_MODE === 'live' ? 'live' : 'mock';
  return (
    <main>
      <h1>Sunrose chatbot is running</h1>
      <p>Mode: {mode}</p>
      <p>Webhook: /api/chatwoot?secret=…</p>
    </main>
  );
}
