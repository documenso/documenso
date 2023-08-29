import React from 'react';

export type SharePageProps = {
  params: {
    shortId?: string;
  };
};

export default async function SharePage({ params: { shortId } }: SharePageProps) {
  console.log(shortId);

  return (
    <div>
      <h1>Share Page</h1>
    </div>
  );
}
