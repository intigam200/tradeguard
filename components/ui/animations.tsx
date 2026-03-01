"use client";

import { motion, AnimatePresence } from "framer-motion";

// ── Page-level fade+slide in ──────────────────────────────────────────────────
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex-1 flex flex-col min-w-0"
    >
      {children}
    </motion.div>
  );
}

// ── Card stagger container ────────────────────────────────────────────────────
export function CardGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Single animated card ──────────────────────────────────────────────────────
export function CardTransition({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden:  { opacity: 0, y: 16, scale: 0.97 },
        visible: { opacity: 1, y: 0,  scale: 1 },
      }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Modal with AnimatePresence ────────────────────────────────────────────────
export function ModalTransition({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Number counter animation ──────────────────────────────────────────────────
export { motion, AnimatePresence };
