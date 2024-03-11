'use client';

import { motion } from 'framer-motion';

type AnimateGenericFadeInOutProps = {
  children: React.ReactNode;
  className?: string;
  key?: string;
};

export const AnimateGenericFadeInOut = ({
  children,
  className,
  key,
}: AnimateGenericFadeInOutProps) => {
  return (
    <motion.section
      key={key}
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
