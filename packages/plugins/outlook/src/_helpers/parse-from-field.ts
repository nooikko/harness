type FromAddress = {
  name: string;
  email: string;
};

type ParseFromField = (from: string) => FromAddress;

const parseFromField: ParseFromField = (from) => {
  const name = from.split('<')[0]?.trim() ?? from;
  const email = from.match(/<([^>]+)>/)?.[1] ?? from;
  return { name, email };
};

export { parseFromField };
