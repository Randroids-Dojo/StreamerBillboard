export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-8">
      <h1 className="text-5xl font-bold mb-4">Streamer Billboard</h1>
      <p className="text-xl text-gray-400 max-w-2xl text-center">
        A live-streamer&apos;s interactive backdrop — viewers type commands in
        YouTube or Twitch chat to control what appears on screen in real time.
      </p>
      <a
        href="/billboard"
        className="mt-8 px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
      >
        Open Billboard
      </a>
    </main>
  );
}
