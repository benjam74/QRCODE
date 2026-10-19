export const LINK_KINDS = ['linkedin', 'facebook', 'instagram', 'x', 'youtube', 'website', 'other'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export type CardLink = { kind: LinkKind; url: string };
export type CardField = { label: string; value: string };

export type Card = {
  id: number;
  userId: number;
  slug: string;
  firstName: string;
  lastName: string;
  titleLine1: string;
  titleLine2: string;
  company: string;
  phone: string;
  email: string;
  whatsapp: string;
  accentColor: string;
  photoFile: string | null;
  updatedAt: string;
};

export type CardFull = Card & { links: CardLink[]; fields: CardField[] };
export type CardInput = Omit<CardFull, 'id' | 'userId' | 'photoFile' | 'updatedAt'>;
