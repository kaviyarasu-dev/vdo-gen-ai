export type User = {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
  defaultProviders: {
    textAnalysis?: string;
    imageGeneration?: string;
    videoGeneration?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: User;
  accessToken: string;
  refreshToken: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name: string;
};
