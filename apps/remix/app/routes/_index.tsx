import { useState } from 'react';

import { Button } from '@documenso/ui/primitives/button';

import { authClient, signOut, useSession } from '~/lib/auth-client';
import { auth } from '~/lib/auth.server';

import type { Route } from '../+types/root';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'New React Router App' },
    { name: 'description', content: 'Welcome to React Router!' },
  ];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const session = await auth.api.getSession({
    query: {
      disableCookieCache: true,
    },
    headers: request.headers, // pass the headers
  });

  return {
    session,
  };
}

export function clientLoader({ params }: Route.ClientLoaderArgs) {
  return {
    session: authClient.getSession(),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { data } = useSession();

  const [email, setEmail] = useState('deepfriedcoconut@gmail.com');
  const [password, setPassword] = useState('password');

  const signIn = async () => {
    await authClient.signIn.email(
      {
        email,
        password,
      },
      {
        onRequest: (ctx) => {
          // show loading state
        },
        onSuccess: (ctx) => {
          console.log('success');
          // redirect to home
        },
        onError: (ctx) => {
          console.log(ctx.error);
          alert(ctx.error);
        },
      },
    );
  };

  const signUp = async () => {
    await authClient.signUp.email(
      {
        email,
        password,
        name: '',
      },
      {
        onRequest: (ctx) => {
          // show loading state
        },
        onSuccess: (ctx) => {
          console.log(ctx);
          // redirect to home
        },
        onError: (ctx) => {
          console.log(ctx.error);
          alert(ctx.error);
        },
      },
    );
  };

  return (
    <main className="flex flex-col items-center justify-center pb-4 pt-16">
      <h1>Status: {data ? 'Authenticated' : 'Not Authenticated'}</h1>

      {data ? (
        <>
          <div>
            <p>Session data</p>
            <p className="mt-2 max-w-2xl text-xs">{JSON.stringify(data, null, 2)}</p>
          </div>

          <div className="space-x-2">
            <Button
              onClick={() => {
                authClient.twoFactor
                  .enable({
                    password: 'password', // user password required
                  })
                  .catch((e) => {
                    console.log(e);
                  });
              }}
            >
              Enable 2FA
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                authClient.twoFactor.disable({
                  password: 'password',
                });
              }}
            >
              Disable 2FA
            </Button>
          </div>

          <button onClick={() => signOut()}>signout</button>
        </>
      ) : (
        <>
          <div className="">
            <h2>Sign In</h2>
            <input
              className="border border-blue-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="border border-blue-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button type="submit" onClick={signIn}>
              Sign In
            </button>
          </div>

          <div className="mt-8">
            <h2>Sign Up</h2>

            <input
              type="email"
              className="border border-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
            />
            <input
              type="password"
              className="border border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button type="submit" onClick={signUp}>
              Sign Up
            </button>
          </div>

          <button
            onClick={() => {
              authClient.signIn.social({
                provider: 'google',
              });
            }}
          >
            google
          </button>

          <button
            onClick={async () => {
              const response = await authClient.signIn.passkey();
              console.log(response);
            }}
          >
            passkey
          </button>
        </>
      )}
    </main>
  );
}
