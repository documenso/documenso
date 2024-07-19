import React from 'react';

const ColorPalettePage = () => {
  const colorGroups = [
    { name: 'Neutral', prefix: '--new-neutral-' },
    { name: 'White', prefix: '--new-white-' },
    { name: 'Primary', prefix: '--new-primary-' },
    { name: 'Info', prefix: '--new-info-' },
    { name: 'Error', prefix: '--new-error-' },
    { name: 'Warning', prefix: '--new-warning-' },
  ];

  const surfaceColors = [
    { name: 'Surface Black', variable: '--new-surface-black' },
    { name: 'Surface White', variable: '--new-surface-white' },
  ];

  const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Color Palette</h1>
      {colorGroups.map((group) => (
        <div key={group.name} className="mb-8">
          <h2 className="mb-2 text-xl font-semibold">{group.name}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shades.map((shade) => {
              const variable = `${group.prefix}${shade}`;
              return (
                <div key={variable} className="flex flex-col items-center">
                  <div
                    className="h-20 w-20 rounded-md shadow-md"
                    style={{ backgroundColor: `hsl(var(${variable}))` }}
                  ></div>
                  <span className="mt-1 text-sm">{variable}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="mb-8">
        <h2 className="mb-2 text-xl font-semibold">Surface Colors</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {surfaceColors.map((color) => (
            <div key={color.variable} className="flex flex-col items-center">
              <div
                className="h-20 w-20 rounded-md shadow-md"
                style={{ backgroundColor: `hsl(var(${color.variable}))` }}
              ></div>
              <span className="mt-1 text-sm">{color.variable}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPalettePage;
