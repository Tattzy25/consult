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
  summary: string;
  onClose: () => void;
}

export function SessionSummaryOverlay({ open, summary, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Session Summary</DialogTitle>
          <DialogDescription>What was covered this session</DialogDescription>
        </DialogHeader>

        <div className="no-scrollbar max-h-[60vh] overflow-y-auto style-mira:-mx-4 style-mira:px-4">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {summary}
          </pre>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
