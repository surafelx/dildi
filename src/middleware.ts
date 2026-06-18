import { withAuth } from "next-auth/middleware";

// Unauthenticated visitors land on the beautiful /welcome page.
export default withAuth({
  pages: { signIn: "/welcome" },
});

// Protect everything except the public landing, login, auth/register, and any
// static file (paths containing a dot, e.g. /scene.jpg, /favicon.ico).
export const config = {
  matcher: [
    "/((?!welcome|login|api/auth|api/register|_next/static|_next/image|.*\\.).*)",
  ],
};
