'use client';

import React, { useCallback, useRef, useState } from 'react';

import type { DropResult, SensorAPI } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

const items = [
  { id: 'item1', content: 'Item 1' },
  { id: 'item2', content: 'Item 2' },
  { id: 'item3', content: 'Item 3' },
];

const ProgrammaticDragAndDrop = () => {
  const [list, setList] = useState(items);
  const sensorApiRef = useRef<SensorAPI | null>(null);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const newItems = Array.from(list);
      const [reorderedItem] = newItems.splice(result.source.index, 1);
      newItems.splice(result.destination.index, 0, reorderedItem);

      setList(newItems);
    },
    [list],
  );

  const triggerDragAndDrop = () => {
    if (!sensorApiRef.current) return;

    const preDrag = sensorApiRef.current.tryGetLock('item3');
    if (!preDrag) return;

    const drag = preDrag.snapLift();

    setTimeout(() => {
      drag.moveUp();
      setTimeout(() => {
        drag.drop();
      }, 500);
    }, 500);
  };

  return (
    <div>
      <button onClick={triggerDragAndDrop}>Trigger Drag and Drop</button>
      <DragDropContext
        onDragEnd={onDragEnd}
        sensors={[
          (api: SensorAPI) => {
            sensorApiRef.current = api;
          },
        ]}
      >
        <Droppable droppableId="list">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef}>
              {list.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      {item.content}
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default ProgrammaticDragAndDrop;
