export default function VerifyPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Check your email</h1>
        <p className="text-gray-600">
          A sign-in link has been sent to your email address. Click it to
          continue.
        </p>
      </div>
    </main>
  );
}
