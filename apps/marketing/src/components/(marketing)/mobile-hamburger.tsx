import { Menu, X } from 'lucide-react';

import { Button } from '@documenso/ui/primitives/button';

export interface HamburgerMenuProps {
  isMenuOpen: boolean;
  menuToggle: () => void;
}

export const HamburgerMenu = ({ isMenuOpen, menuToggle }: HamburgerMenuProps) => {
  return (
    <div className="flex md:hidden">
      <Button variant="default" className="z-20 w-10 p-0" onClick={menuToggle}>
        {isMenuOpen ? <X /> : <Menu />}
      </Button>
    </div>
  );
};
