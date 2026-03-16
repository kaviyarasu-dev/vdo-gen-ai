import UserModel from './user.model.js';
import type { IUserDocument, IUserDefaultProviders, UpdateUserDto } from './user.types.js';

export class UserRepository {
  async findByEmail(email: string): Promise<IUserDocument | null> {
    return UserModel.findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokens')
      .exec();
  }

  async findById(id: string): Promise<IUserDocument | null> {
    return UserModel.findById(id).exec();
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name: string;
  }): Promise<IUserDocument> {
    const user = new UserModel(data);
    return user.save();
  }

  async updateById(
    id: string,
    data: UpdateUserDto,
  ): Promise<IUserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
  }

  async addRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $push: { refreshTokens: tokenHash },
    }).exec();
  }

  async removeRefreshToken(
    userId: string,
    tokenHash: string,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: tokenHash },
    }).exec();
  }

  async getRefreshTokens(userId: string): Promise<string[]> {
    const user = await UserModel.findById(userId)
      .select('+refreshTokens')
      .exec();

    return user?.refreshTokens ?? [];
  }

  async setProviderApiKey(
    userId: string,
    provider: string,
    encryptedKey: string,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: { [`providerApiKeys.${provider}`]: encryptedKey },
    }).exec();
  }

  async removeProviderApiKey(
    userId: string,
    provider: string,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $unset: { [`providerApiKeys.${provider}`]: '' },
    }).exec();
  }

  async getProviderApiKeys(userId: string): Promise<Map<string, string>> {
    const user = await UserModel.findById(userId)
      .select('providerApiKeys')
      .exec();

    return user?.providerApiKeys ?? new Map();
  }

  async updateDefaultProviders(
    userId: string,
    providers: IUserDefaultProviders,
  ): Promise<IUserDocument | null> {
    return UserModel.findByIdAndUpdate(
      userId,
      { $set: { defaultProviders: providers } },
      { new: true },
    ).exec();
  }
}
