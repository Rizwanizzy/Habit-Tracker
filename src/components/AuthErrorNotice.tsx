/** Shared error surface for auth forms (role="alert", danger tint). */
export function AuthErrorNotice({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-body text-danger">
      {message}
    </p>
  )
}
