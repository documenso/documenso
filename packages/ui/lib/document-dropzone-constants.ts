import type { Variants } from 'framer-motion';

export const DocumentDropzoneContainerVariants: Variants = {
  initial: {
    scale: 1,
  },
  animate: {
    scale: 1,
  },
  hover: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const DocumentDropzoneCardLeftVariants: Variants = {
  initial: {
    x: 40,
    y: -10,
    rotate: -14,
  },
  animate: {
    x: 40,
    y: -10,
    rotate: -14,
  },
  hover: {
    x: -25,
    y: -25,
    rotate: -22,
  },
};

export const DocumentDropzoneCardRightVariants: Variants = {
  initial: {
    x: -40,
    y: -10,
    rotate: 14,
  },
  animate: {
    x: -40,
    y: -10,
    rotate: 14,
  },
  hover: {
    x: 25,
    y: -25,
    rotate: 22,
  },
};

export const DocumentDropzoneCardCenterVariants: Variants = {
  initial: {
    x: 0,
    y: 0,
  },
  animate: {
    x: 0,
    y: 0,
  },
  hover: {
    x: 0,
    y: -25,
  },
};

export const DocumentDropzoneDisabledCardLeftVariants: Variants = {
  initial: {
    x: 50,
    y: 0,
    rotate: -14,
  },
  animate: {
    x: 50,
    y: 0,
    rotate: -14,
  },
  hover: {
    x: 30,
    y: 0,
    rotate: -17,
    transition: { type: 'spring', duration: 0.3, stiffness: 500 },
  },
};

export const DocumentDropzoneDisabledCardRightVariants: Variants = {
  initial: {
    x: -50,
    y: 0,
    rotate: 14,
  },
  animate: {
    x: -50,
    y: 0,
    rotate: 14,
  },
  hover: {
    x: -30,
    y: 0,
    rotate: 17,
    transition: { type: 'spring', duration: 0.3, stiffness: 500 },
  },
};

export const DocumentDropzoneDisabledCardCenterVariants: Variants = {
  initial: {
    x: -10,
    y: 0,
  },
  animate: {
    x: -10,
    y: 0,
  },
  hover: {
    x: [-15, -10, -5, -10],
    y: 0,
    transition: { type: 'spring', duration: 0.3, stiffness: 1000 },
  },
};
