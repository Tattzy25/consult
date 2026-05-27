import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function DisclaimerModal({ open, onAccept, onDecline }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDecline(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Before you start</DialogTitle>
          <DialogDescription>Read before connecting to TaTTTy</DialogDescription>
        </DialogHeader>

        <div className="no-scrollbar max-h-[60vh] overflow-y-auto style-mira:-mx-4 style-mira:px-4 flex flex-col gap-4 text-muted-foreground">
          <section className="flex flex-col gap-1">
            <p className="text-xs font-medium text-foreground">Privacy</p>
            <p className="text-xs leading-relaxed">
              During live sessions we do not record or store any data on our servers. We are not
              responsible for any third-party data collection. For full details see our{" "}
              <a href="https://tattty.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline text-foreground">Privacy Policy</a>
              {" "}and{" "}
              <a href="https://tattty.com/terms-of-service" target="_blank" rel="noopener noreferrer" className="underline text-foreground">Terms of Service</a>.
            </p>
          </section>

          <section className="flex flex-col gap-1">
            <p className="text-xs font-medium text-foreground">Content</p>
            <p className="text-xs leading-relaxed">
              Showing skin or body parts for placement reference is completely normal.
              Sexual acts unrelated to tattoo consultation are not permitted and will result in
              immediate session termination.
            </p>
          </section>

          <section className="flex flex-col gap-1">
            <p className="text-xs font-medium text-foreground">Zero tolerance</p>
            <p className="text-xs leading-relaxed">
              Any attempt to generate, request, or display sexual content involving minors results
              in immediate permanent ban. No exceptions.
            </p>
          </section>

          <section className="flex flex-col gap-1">
            <p className="text-xs font-medium text-foreground">Credits</p>
            <p className="text-xs leading-relaxed">250 credits are charged at the start of each session.</p>
          </section>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={onAccept}>I agree — start session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
