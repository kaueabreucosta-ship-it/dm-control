import { cookies } from "next/headers";
import { verifySessionValue, SESSION_COOKIE_NAME } from "./auth";

export async function isAdminRequest() {
  const store = cookies();
  const session = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionValue(session);
}
