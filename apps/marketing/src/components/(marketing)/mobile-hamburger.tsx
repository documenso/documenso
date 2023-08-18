'use client';

import { useEffect } from 'react';

import { Menu, X } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export interface HamburgerMenuProps {
  isMenuOpen: boolean;
  menuToggle: () => void;
}

export const HamburgerMenu = ({ isMenuOpen, menuToggle }: HamburgerMenuProps) => {
  useEffect(() => {
    // Update document.body.style.overflow based on the menu state
    // and check that the window width is less than 768px
    // if (window.innerWidth < 768) {
    // document.body.style.overflow = isMenuOpen ? 'hidden' : 'auto';
    // }
  }, [isMenuOpen]);

  return (
    <div className="flex md:hidden">
      <Button variant="default" className="z-20 w-10 p-0" onClick={menuToggle}>
        {isMenuOpen ? <X /> : <Menu />}
      </Button>
    </div>
  );
};
