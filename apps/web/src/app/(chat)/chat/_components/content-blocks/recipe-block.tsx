'use client';

import { ChefHat, Clock, Users } from 'lucide-react';
import { useState } from 'react';
import type { ContentBlockProps } from './registry';

type Ingredient = {
  name: string;
  amount?: string;
  unit?: string;
};

type RecipeBlockComponent = (props: ContentBlockProps) => React.ReactNode;

const RecipeBlock: RecipeBlockComponent = ({ data }) => {
  const title = (data.title ?? 'Recipe') as string;
  const servings = data.servings as number | undefined;
  const prepTime = data.prepTime as string | undefined;
  const cookTime = data.cookTime as string | undefined;
  const ingredients = (data.ingredients ?? []) as Ingredient[];
  const steps = (data.steps ?? []) as string[];
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className='rounded-md border border-border/40 bg-background overflow-hidden'>
      {/* Header */}
      <div className='px-4 py-3 border-b border-border/30'>
        <div className='flex items-center gap-2'>
          <ChefHat className='h-4 w-4 text-muted-foreground' />
          <h3 className='font-medium text-sm text-foreground'>{title}</h3>
        </div>

        {/* Meta row */}
        <div className='mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
          {servings && (
            <span className='inline-flex items-center gap-1'>
              <Users className='h-3 w-3' />
              {servings} serving{servings !== 1 ? 's' : ''}
            </span>
          )}
          {prepTime && (
            <span className='inline-flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              Prep: {prepTime}
            </span>
          )}
          {cookTime && (
            <span className='inline-flex items-center gap-1'>
              <Clock className='h-3 w-3' />
              Cook: {cookTime}
            </span>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-[1fr_1.5fr] divide-y sm:divide-y-0 sm:divide-x divide-border/30'>
        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div className='px-4 py-3'>
            <h4 className='mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground'>Ingredients</h4>
            <ul className='space-y-1'>
              {ingredients.map((ing, i) => (
                <li key={i}>
                  <button
                    type='button'
                    onClick={() => toggleIngredient(i)}
                    className='flex items-start gap-2 text-left text-sm w-full hover:bg-muted/20 rounded px-1 py-0.5 transition-colors'
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${checkedIngredients.has(i) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
                    >
                      {checkedIngredients.has(i) && '\u2713'}
                    </span>
                    <span className={checkedIngredients.has(i) ? 'line-through text-muted-foreground/50' : 'text-foreground/80'}>
                      {ing.amount && (
                        <span className='font-medium'>
                          {ing.amount}
                          {ing.unit ? ` ${ing.unit}` : ''}{' '}
                        </span>
                      )}
                      {ing.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <div className='px-4 py-3'>
            <h4 className='mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground'>Instructions</h4>
            <ol className='space-y-2'>
              {steps.map((step, i) => (
                <li key={i} className='flex gap-2.5 text-sm'>
                  <span className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground'>
                    {i + 1}
                  </span>
                  <span className='text-foreground/80'>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeBlock;
