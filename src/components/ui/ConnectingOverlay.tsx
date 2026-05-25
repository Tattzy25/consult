import { motion, AnimatePresence } from 'motion/react';

interface Props {
  show: boolean;
}

export function ConnectingOverlay({ show }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="connecting-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center backdrop-blur-md bg-black/50"
        >
          <div className="relative flex items-center justify-center w-16 h-16">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-white/20"
              animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-white/10"
              animate={{ scale: [1, 1.6], opacity: [0.3, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
            <span className="relative inline-flex h-6 w-6 rounded-full bg-white/80" />
          </div>
          <p className="mt-6 text-white/50 text-xs tracking-widest uppercase">Connecting</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
