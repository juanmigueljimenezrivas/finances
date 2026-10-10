import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({ open, onOpenChange, title, description, children, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <D.Content
          className={cn("fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border bg-card p-6 shadow-xl focus:outline-none", wide ? "max-w-2xl" : "max-w-lg")}
        >
          <D.Title className="text-lg font-semibold">{title}</D.Title>
          <D.Description className={cn("mt-1 text-sm text-muted-foreground", !description && "sr-only")}>{description ?? title}</D.Description>
          <div className="mt-4">{children}</div>
          <D.Close className="absolute right-4 top-4 rounded-sm p-1 opacity-70 transition hover:bg-accent hover:opacity-100" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
