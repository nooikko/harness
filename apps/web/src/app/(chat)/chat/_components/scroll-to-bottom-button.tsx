'use client';

import { Button } from '@harness/ui';
import { ArrowDown } from 'lucide-react';

type ScrollToBottomButtonProps = {
  isVisible: boolean;
  onClick: () => void;
};

type ScrollToBottomButtonComponent = (props: ScrollToBottomButtonProps) => React.ReactNode;

export const ScrollToBottomButton: ScrollToBottomButtonComponent = ({ isVisible, onClick }) => {
  if (!isVisible) {
    return null;
  }

  return (
    <Button
      variant='outline'
      size='sm'
      onClick={onClick}
      aria-label='Scroll to bottom'
      className='absolute bottom-20 right-6 z-10 rounded-full shadow-md transition-opacity'
    >
      <ArrowDown className='h-4 w-4' />
    </Button>
  );
};
