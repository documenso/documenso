import React from 'react';

export type SettingsHeaderProps = {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
};

export const SettingsHeader = ({ children, title, subtitle }: SettingsHeaderProps) => {
  return (
    <>
      <div className="flex flex-row items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{title}</h3>

          <p className="text-muted-foreground text-sm md:mt-2">{subtitle}</p>
        </div>

        {children}
      </div>

      <hr className="my-4" />
    </>
  );
};
