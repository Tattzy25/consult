"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Share2 } from 'lucide-react';

interface ImageOverlayProps {
  imageUrl: string | null;
  onClose: () => void;
  onDownload: (url: string) => void;
  onShare: (url: string) => void;
}

const IMAGE_DISPLAY_DURATION = 30; // seconds

export function ImageOverlay({ imageUrl, onClose, onDownload, onShare }: ImageOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(IMAGE_DISPLAY_DURATION);

  useEffect(() => {
    if (!imageUrl) {
      setTimeLeft(IMAGE_DISPLAY_DURATION);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <AnimatePresence>
      {imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative bg-zinc-800 rounded-lg shadow-lg max-w-3xl w-full h-auto max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="relative flex-grow flex items-center justify-center p-4">
              <img
                src={imageUrl}
                alt="Generated Image"
                className="max-w-full max-h-full object-contain rounded-md"
              />
            </div>

            <div className="absolute top-4 left-4 bg-black/50 text-white text-sm px-3 py-1 rounded-full font-mono">
              Image disappears in {timeLeft}s
            </div>

            <div className="flex justify-center gap-4 p-4 border-t border-zinc-700 bg-zinc-900">
              <button
                onClick={() => onDownload(imageUrl)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Download size={20} /> Download
              </button>
              <button
                onClick={() => onShare(imageUrl)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                <Share2 size={20} /> Share
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
