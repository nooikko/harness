import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../alert-dialog';

const renderDialog = (open = false) =>
  render(
    <AlertDialog defaultOpen={open}>
      <AlertDialogTrigger>Open</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );

describe('AlertDialog', () => {
  it('renders the trigger button', () => {
    renderDialog();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('does not show dialog content when closed', () => {
    renderDialog(false);
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('shows dialog content when opened', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByText('Open'));

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('renders cancel and confirm buttons when open', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByText('Open'));

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('closes dialog when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });
});
