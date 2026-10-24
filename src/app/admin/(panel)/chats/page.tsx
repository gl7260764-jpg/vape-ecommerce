import { ChatsCircleIcon } from "@phosphor-icons/react/dist/ssr";

/** Nothing picked yet: a quiet prompt beside the list (phones show only the list). */
export default function ChatsPage() {
  return (
    <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-background px-8 text-center lg:flex">
      <span className="grid size-16 place-items-center rounded-full bg-surface-2">
        <ChatsCircleIcon className="size-7 text-muted-foreground" aria-hidden />
      </span>
      <p className="font-medium">Pick a chat</p>
      <p className="max-w-[36ch] text-sm text-muted-foreground">Customers can message you from the device they ordered on. New messages show here with a sound.</p>
    </div>
  );
}
