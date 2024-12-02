export interface BusinessCard {
  id: number;
  owner: number;
  name: string;
  title: string;
  phone: string;
  email: string;
  address: string;
  organization: string;
  department: string;
  position: string;
  sns: SNS[];
  image_path: string;
  avatar: Avatar;
  introduction: string;
  created_at: number;
}

export interface SNS {
  type: 0 | 1 | 2 | 3;
  link: string;
}

export interface Avatar {
  type: 0 | 1 | 2;
  data?: string;
}
