import { redirect } from "next/navigation";

/** The console currently opens on orders; Proxy redirects signed-out visitors to login. */
export default function AdminIndexPage() {
  redirect("/admin/orders");
}
