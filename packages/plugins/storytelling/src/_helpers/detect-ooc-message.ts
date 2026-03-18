type DetectOocResult = {
  isOoc: boolean;
  content: string;
};

type DetectOocMessage = (message: string) => DetectOocResult;

export const detectOocMessage: DetectOocMessage = (message) => {
  const trimmed = message.trimStart();

  if (!trimmed.startsWith('//')) {
    return { isOoc: false, content: message };
  }

  const cleaned = trimmed.slice(2).trim();
  return { isOoc: true, content: cleaned };
};
