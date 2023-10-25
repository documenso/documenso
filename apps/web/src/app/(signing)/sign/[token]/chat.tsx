'use client';

import { useChat } from 'ai/react';

import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';

type Props = {};

export function Chat({}: Props) {
  const { input, handleInputChange, handleSubmit, messages } = useChat({
    api: '/api/chat',
  });

  // continue https://youtu.be/bZFedu-0emE?si=2JGSJfSQ38aXSlp2&t=10941

  return (
    <div>
      <div className="flex flex-col gap-8">
        <ul>
          {messages.map((message, index) => (
            <li
              className={cn(
                'flex',
                message.role === 'user'
                  ? 'mb-6 ml-10 mt-6 flex justify-end'
                  : 'mr-10 justify-start',
              )}
              key={index}
            >
              <span
                className={
                  message.role === 'user'
                    ? 'bg-background text-foreground group relative rounded-lg border-2 p-4 backdrop-blur-[2px]'
                    : 'bg-primary text-primary-foreground rounded-lg p-4 backdrop-blur-[2px]'
                }
              >
                {message.content}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <form className="mb-2 mt-8 flex" onSubmit={handleSubmit}>
        <Input
          value={input}
          className="mr-6 w-1/2"
          onChange={handleInputChange}
          placeholder="Ask away..."
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
