export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">PolicyDiff</h1>
      <p className="text-lg text-gray-600 mb-8 text-center max-w-xl">
        Upload two insurance policies. See every change, with citations to the
        exact page and region. Built for independent commercial P&amp;C agencies.
      </p>
      <a
        href="/auth/signin"
        className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
      >
        Sign In
      </a>
    </main>
  );
}
