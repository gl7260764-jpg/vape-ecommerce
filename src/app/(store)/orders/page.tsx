import { redirect } from "next/navigation";

// "My orders" lives on the account page now; old links keep working.
export default function OrdersPage() {
  redirect("/account");
}
