'use client';

import React, { useState } from 'react';

import type { DropResult } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

const EmailItem = ({
  email,
  index,
}: {
  email: { id: string; subject: string; sender: string };
  index: number;
}) => (
  <Draggable draggableId={email.id} index={index}>
    {(provided) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className="mb-2 rounded bg-white p-4 shadow"
      >
        <span className="mr-4 w-8 text-center text-lg font-bold text-blue-500">{index + 1}</span>
        <h3 className="font-bold">{email.subject}</h3>
        <p className="text-gray-600">{email.sender}</p>
      </div>
    )}
  </Draggable>
);

const EmailList = () => {
  const [emails, setEmails] = useState([
    { id: 'email1', subject: 'Meeting Tomorrow', sender: 'boss@company.com' },
    { id: 'email2', subject: 'Project Update', sender: 'colleague@company.com' },
    { id: 'email3', subject: 'Lunch Plans', sender: 'friend@gmail.com' },
  ]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const newEmails = Array.from(emails);
    const [reorderedItem] = newEmails.splice(result.source.index, 1);
    newEmails.splice(result.destination.index, 0, reorderedItem);

    setEmails(newEmails);
  };

  return (
    <div className="mx-auto mt-10 max-w-md">
      <h2 className="mb-4 text-2xl font-bold">Email Inbox</h2>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="emailList">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {emails.map((email, index) => (
                <EmailItem key={email.id} email={email} index={index} />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default EmailList;
