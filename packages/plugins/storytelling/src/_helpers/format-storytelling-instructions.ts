type FormatStorytellingInstructions = () => string;

export const formatStorytellingInstructions: FormatStorytellingInstructions = () => {
  return `# Narrative Formatting Conventions

Follow these formatting conventions for all story content:

## Dialogue
Write dialogue as: **CHARACTER NAME**: "Dialogue text here."
Example: **ELENA**: "I never thought it would end like this."

## Actions & Descriptions
Write actions and physical descriptions in italics:
*She crossed the room slowly, trailing her fingers along the dusty shelf.*

## Inner Thoughts
Write internal monologue as blockquotes:
> This couldn't be happening. Not again.

## Scene Breaks
Use a horizontal rule to indicate a scene transition or time skip:
---

## General Narration
Write narration as plain prose paragraphs with no special formatting.

## Important Rules
- Keep character names consistent and in ALL CAPS within the **bold** tag
- Use these conventions consistently throughout the story
- Do not break character or reference these formatting rules in your responses
- When responding to an [OUT OF CHARACTER] message, acknowledge the direction naturally and continue the story`;
};
