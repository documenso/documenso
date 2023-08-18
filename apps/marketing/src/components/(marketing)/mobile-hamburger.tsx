'use client';

import { useEffect } from 'react';

import { Menu, X } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

import { useWindowSize } from '~/hooks/use-window-size';

export interface HamburgerMenuProps {
  isMenuOpen: boolean;
  menuToggle: () => void;
}

export const HamburgerMenu = ({ isMenuOpen, menuToggle }: HamburgerMenuProps) => {
  const { width } = useWindowSize();

  useEffect(() => {
    // Update document.body.style.overflow based on the menu state
    // If the window width is less than 768px, we want to prevent scrolling when the menu is open
    if (width < 768 && isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isMenuOpen, width]);

  return (
    <div className="flex md:hidden">
      <Button variant="default" className="z-20 w-10 p-0" onClick={menuToggle}>
        {isMenuOpen ? <X /> : <Menu />}
      </Button>
    </div>
  );
};
