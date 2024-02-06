'use client';

import { motion } from 'framer-motion';

type AnimateGenericFadeInOutProps = {
  children: React.ReactNode;
  className?: string;
};

export const AnimateGenericFadeInOut = ({ children, className }: AnimateGenericFadeInOutProps) => {
  return (
    <motion.section
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      className={className}
    >
      {children}
    </motion.section>
  );
};
