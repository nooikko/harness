import { motion } from 'motion/react';
import type React from 'react';
import type { ReactNode } from 'react';
import type { IEvent } from '../_helpers/interfaces';
import { useDragDrop } from './dnd-context';

interface DraggableEventProps {
  event: IEvent;
  children: ReactNode;
  className?: string;
}

type DraggableEventComponent = (props: DraggableEventProps) => React.ReactNode;

export const DraggableEvent: DraggableEventComponent = ({ event, children, className }) => {
  const { startDrag, endDrag, isDragging, draggedEvent } = useDragDrop();

  const isCurrentlyDragged = isDragging && draggedEvent?.id === event.id;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <button
      type='button'
      tabIndex={0}
      draggable
      onKeyDown={() => {}}
      onDragStart={(e: React.DragEvent<HTMLButtonElement>) => {
        e.dataTransfer.setData('text/plain', event.id.toString());
        startDrag(event);
      }}
      onDragEnd={() => {
        endDrag();
      }}
      className='appearance-none border-0 bg-transparent p-0 text-left w-full'
    >
      <motion.div
        className={`${className || ''} ${isCurrentlyDragged ? 'opacity-50 cursor-grabbing' : 'cursor-grab'}`}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => handleClick(e as unknown as React.MouseEvent<HTMLButtonElement>)}
      >
        {children}
      </motion.div>
    </button>
  );
};
