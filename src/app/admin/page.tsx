import { redirect } from "next/navigation";
import { DEFAULT_ADMIN_PATH } from "@/domain/merchant/navigation";

/** The console opens on the overview; Proxy redirects signed-out visitors to login. */
export default function AdminIndexPage() {
  redirect(DEFAULT_ADMIN_PATH);
}
