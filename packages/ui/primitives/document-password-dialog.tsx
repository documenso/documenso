import React from 'react';

import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Input } from './input';

type PasswordDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
  setPassword: (_password: string) => void;
  onPasswordSubmit: () => void;
  isError?: boolean;
};

export const PasswordDialog = ({
  open,
  onOpenChange,
  onPasswordSubmit,
  isError,
  setPassword,
}: PasswordDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Password Required</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This document is password protected. Please enter the password to view the document.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex w-full items-center justify-center gap-4">
          <Input
            type="password"
            className="bg-background mt-1.5"
            placeholder="Enter password"
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
          <Button onClick={onPasswordSubmit}>Submit</Button>
        </DialogFooter>
        {isError && (
          <span className="text-xs text-red-500">
            The password you entered is incorrect. Please try again.
          </span>
        )}
      </DialogContent>
    </Dialog>
  );
};
