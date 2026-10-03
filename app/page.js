import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionValue, SESSION_COOKIE_NAME } from "../lib/auth";

export default async function RootPage() {
  const store = cookies();
  const session = store.get(SESSION_COOKIE_NAME)?.value;
  const valid = await verifySessionValue(session);
  redirect(valid ? "/dashboard" : "/login");
}
